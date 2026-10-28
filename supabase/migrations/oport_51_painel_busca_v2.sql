-- =============================================================================
-- oport_51 — A busca com filtro e ordem em cada coluna (onda 15, fase 3, F3.5b, 28/10/2026)
--
-- As listas de convênios e de propostas da busca (/mapa/busca) liam 30 por página de `painel_busca_instrumentos` e
-- `painel_busca_propostas` (oport_35), sem filtro por coluna e sempre na mesma ordem. As versões 2 recebem, além dos
-- filtros de hoje (termos, UF, município, tema, situações ou desfechos, órgão exato):
--
--   · o filtro de cada coluna da tabela: as palavras (padrões `like` já escapados pelo site, sem acento e em
--     minúsculas) do número, do proponente, do município, do programa, do objeto e do órgão; a lista de situações ou de
--     desfechos marcados; as faixas de repasse, de desembolsado e da data (assinatura ou envio);
--   · a ordem por uma coluna, de uma lista fechada (`p_ordem`; outra coisa vale a ordem de sempre), com o vazio no fim
--     nos dois sentidos e a ordem de sempre como desempate. A correspondência exata do número continua no topo; sem
--     `nr_proposta`, a marca dela era nula na v1 e, em ordem decrescente, nulo vem primeiro: aqui ela é falsa.
--
-- O truque da oport_35 continua: a ordem, a contagem e o corte correm sobre colunas estreitas (o ctid e a posição), e só
-- as linhas da página voltam à tabela. O teto de deslocamento continua 10.000; o teto menor para quem não administra é
-- do site (a busca é a porta da raspagem).
--
-- As versões 1 ficam no banco enquanto o site publicado as usa; o site novo usa só as v2 (também na busca unificada).
-- Só `service_role` executa. Nada é gravado.
--
-- Idempotente. Pré-requisitos: oport_35 (painel_instrumento.texto_busca, painel_proposta.texto_busca) e oport_46
-- (oport_sem_acento).
-- =============================================================================

create or replace function public.painel_busca_instrumentos_v2(
  p_termos        text[]  default null,
  p_uf            text    default null,
  p_ibge          text    default null,
  p_tema          text    default null,
  p_situacoes     text[]  default null,
  p_orgao         text    default null,
  p_numero        text[]  default null,
  p_proponente    text[]  default null,
  p_municipio     text[]  default null,
  p_programa      text[]  default null,
  p_objeto        text[]  default null,
  p_orgao_texto   text[]  default null,
  p_marcadas      text[]  default null,
  p_repasse_de    numeric default null,
  p_repasse_ate   numeric default null,
  p_desemb_de     numeric default null,
  p_desemb_ate    numeric default null,
  p_data_de       date    default null,
  p_data_ate      date    default null,
  p_ordem         text    default null,
  p_crescente     boolean default false,
  p_limite        integer default 30,
  p_offset        integer default 0
)
returns table (
  nr_convenio text, nr_proposta text, modalidade text, situacao text, vivo boolean, detalhe boolean, uf text,
  cod_ibge text, municipio text, proponente text, orgao_sup text, programa text, temas text[], objeto text,
  vl_repasse numeric, vl_desembolsado numeric, dt_assinatura date, dt_fim_vigencia date, cnpj text, total bigint
)
language plpgsql stable
set search_path to 'public'
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
declare
  v_ex      bigint;
  v_padroes text[];
  -- Vazio = sem filtro (o site manda null, mas um vetor vazio também não filtra).
  v_numero  text[] := nullif(p_numero, '{}');
  v_prop    text[] := nullif(p_proponente, '{}');
  v_mun     text[] := nullif(p_municipio, '{}');
  v_prog    text[] := nullif(p_programa, '{}');
  v_obj     text[] := nullif(p_objeto, '{}');
  v_org     text[] := nullif(p_orgao_texto, '{}');
  v_marc    text[] := nullif(p_marcadas, '{}');
  v_ordem   text := case when p_ordem in ('numero', 'proponente', 'municipio', 'programa', 'orgao', 'situacao', 'assinatura',
                                          'repasse', 'desembolsado') then p_ordem end;
  v_cresc   boolean := coalesce(p_crescente, false);
begin
  select e.id into v_ex from public.painel_ultima_execucao() e;
  if p_termos is not null and cardinality(p_termos) > 0 then
    v_padroes := array(select '%' || t || '%' from unnest(p_termos) t);
  end if;

  return query
  with f as (
    select i.ctid tid,
           count(*) over () total,
           row_number() over (order by
             coalesce(p_termos is not null and cardinality(p_termos) = 1 and (i.nr_convenio = p_termos[1] or i.nr_proposta = p_termos[1]), false) desc,
             case when v_ordem = 'numero'       and v_cresc     then i.nr_convenio end asc nulls last,
             case when v_ordem = 'numero'       and not v_cresc then i.nr_convenio end desc nulls last,
             case when v_ordem = 'proponente'   and v_cresc     then i.proponente end asc nulls last,
             case when v_ordem = 'proponente'   and not v_cresc then i.proponente end desc nulls last,
             case when v_ordem = 'municipio'    and v_cresc     then i.municipio end asc nulls last,
             case when v_ordem = 'municipio'    and not v_cresc then i.municipio end desc nulls last,
             case when v_ordem = 'programa'     and v_cresc     then i.programa end asc nulls last,
             case when v_ordem = 'programa'     and not v_cresc then i.programa end desc nulls last,
             case when v_ordem = 'orgao'        and v_cresc     then i.orgao_sup end asc nulls last,
             case when v_ordem = 'orgao'        and not v_cresc then i.orgao_sup end desc nulls last,
             case when v_ordem = 'situacao'     and v_cresc     then i.situacao end asc nulls last,
             case when v_ordem = 'situacao'     and not v_cresc then i.situacao end desc nulls last,
             case when v_ordem = 'assinatura'   and v_cresc     then i.dt_assinatura end asc nulls last,
             case when v_ordem = 'assinatura'   and not v_cresc then i.dt_assinatura end desc nulls last,
             case when v_ordem = 'repasse'      and v_cresc     then i.vl_repasse end asc nulls last,
             case when v_ordem = 'repasse'      and not v_cresc then i.vl_repasse end desc nulls last,
             case when v_ordem = 'desembolsado' and v_cresc     then i.vl_desembolsado end asc nulls last,
             case when v_ordem = 'desembolsado' and not v_cresc then i.vl_desembolsado end desc nulls last,
             i.vivo desc, i.dt_assinatura desc nulls last, i.nr_convenio) pos
      from public.painel_instrumento i
     where i.execucao_id = v_ex
       and (v_padroes is null or i.texto_busca like all (v_padroes))
       and (p_uf is null or i.uf = p_uf)
       and (p_ibge is null or i.cod_ibge = p_ibge)
       and (p_tema is null or p_tema = any (i.temas))
       and (p_situacoes is null or cardinality(p_situacoes) = 0 or i.situacao = any (p_situacoes))
       and (p_orgao is null or i.orgao_sup = p_orgao)
       and (v_numero is null or lower(i.nr_convenio) like all (v_numero))
       and (v_prop is null or public.oport_sem_acento(i.proponente) like all (v_prop))
       and (v_mun is null or public.oport_sem_acento(i.municipio) like all (v_mun))
       and (v_prog is null or public.oport_sem_acento(i.programa) like all (v_prog))
       and (v_obj is null or public.oport_sem_acento(i.objeto) like all (v_obj))
       and (v_org is null or public.oport_sem_acento(i.orgao_sup) like all (v_org))
       and (v_marc is null or i.situacao = any (v_marc))
       and (p_repasse_de is null or i.vl_repasse >= p_repasse_de)
       and (p_repasse_ate is null or i.vl_repasse <= p_repasse_ate)
       and (p_desemb_de is null or i.vl_desembolsado >= p_desemb_de)
       and (p_desemb_ate is null or i.vl_desembolsado <= p_desemb_ate)
       and (p_data_de is null or i.dt_assinatura >= p_data_de)
       and (p_data_ate is null or i.dt_assinatura <= p_data_ate)
     order by pos
     limit greatest(1, least(coalesce(p_limite, 30), 100))
    offset greatest(0, least(coalesce(p_offset, 0), 10000))
  )
  select i.nr_convenio, i.nr_proposta, i.modalidade, i.situacao, i.vivo, i.detalhe, i.uf, i.cod_ibge, i.municipio,
         i.proponente, i.orgao_sup, i.programa, i.temas, i.objeto, i.vl_repasse, i.vl_desembolsado, i.dt_assinatura,
         i.dt_fim_vigencia, i.cnpj, f.total
    from f join public.painel_instrumento i on i.ctid = f.tid
   order by f.pos;
end $function$;

create or replace function public.painel_busca_propostas_v2(
  p_termos        text[]  default null,
  p_uf            text    default null,
  p_ibge          text    default null,
  p_tema          text    default null,
  p_desfechos     text[]  default null,
  p_orgao         text    default null,
  p_numero        text[]  default null,
  p_proponente    text[]  default null,
  p_municipio     text[]  default null,
  p_programa      text[]  default null,
  p_objeto        text[]  default null,
  p_orgao_texto   text[]  default null,
  p_marcados      text[]  default null,
  p_repasse_de    numeric default null,
  p_repasse_ate   numeric default null,
  p_data_de       date    default null,
  p_data_ate      date    default null,
  p_ordem         text    default null,
  p_crescente     boolean default false,
  p_limite        integer default 30,
  p_offset        integer default 0
)
returns table (
  id_proposta text, nr_proposta text, uf text, cod_ibge text, municipio text, proponente text, orgao_sup text,
  programa text, temas text[], objeto text, valor_repasse numeric, dt_envio date, ano_envio integer, desfecho text,
  situacao text, nr_convenio text, cnpj text, total bigint
)
language plpgsql stable
set search_path to 'public'
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
declare
  v_ex      bigint;
  v_padroes text[];
  v_numero  text[] := nullif(p_numero, '{}');
  v_prop    text[] := nullif(p_proponente, '{}');
  v_mun     text[] := nullif(p_municipio, '{}');
  v_prog    text[] := nullif(p_programa, '{}');
  v_obj     text[] := nullif(p_objeto, '{}');
  v_org     text[] := nullif(p_orgao_texto, '{}');
  v_marc    text[] := nullif(p_marcados, '{}');
  v_ordem   text := case when p_ordem in ('numero', 'proponente', 'municipio', 'programa', 'orgao', 'desfecho', 'envio',
                                          'repasse') then p_ordem end;
  v_cresc   boolean := coalesce(p_crescente, false);
begin
  select e.id into v_ex from public.painel_ultima_execucao() e;
  if p_termos is not null and cardinality(p_termos) > 0 then
    v_padroes := array(select '%' || t || '%' from unnest(p_termos) t);
  end if;

  return query
  with f as (
    select p.ctid tid,
           count(*) over () total,
           row_number() over (order by
             coalesce(p_termos is not null and cardinality(p_termos) = 1 and (p.nr_proposta = p_termos[1] or p.id_proposta = p_termos[1]), false) desc,
             case when v_ordem = 'numero'     and v_cresc     then coalesce(p.nr_proposta, p.id_proposta) end asc nulls last,
             case when v_ordem = 'numero'     and not v_cresc then coalesce(p.nr_proposta, p.id_proposta) end desc nulls last,
             case when v_ordem = 'proponente' and v_cresc     then p.proponente end asc nulls last,
             case when v_ordem = 'proponente' and not v_cresc then p.proponente end desc nulls last,
             case when v_ordem = 'municipio'  and v_cresc     then p.municipio end asc nulls last,
             case when v_ordem = 'municipio'  and not v_cresc then p.municipio end desc nulls last,
             case when v_ordem = 'programa'   and v_cresc     then p.programa end asc nulls last,
             case when v_ordem = 'programa'   and not v_cresc then p.programa end desc nulls last,
             case when v_ordem = 'orgao'      and v_cresc     then p.orgao_sup end asc nulls last,
             case when v_ordem = 'orgao'      and not v_cresc then p.orgao_sup end desc nulls last,
             case when v_ordem = 'desfecho'   and v_cresc     then p.desfecho end asc nulls last,
             case when v_ordem = 'desfecho'   and not v_cresc then p.desfecho end desc nulls last,
             case when v_ordem = 'envio'      and v_cresc     then p.dt_envio end asc nulls last,
             case when v_ordem = 'envio'      and not v_cresc then p.dt_envio end desc nulls last,
             case when v_ordem = 'repasse'    and v_cresc     then p.valor_repasse end asc nulls last,
             case when v_ordem = 'repasse'    and not v_cresc then p.valor_repasse end desc nulls last,
             p.dt_envio desc nulls last, p.id_proposta) pos
      from public.painel_proposta p
     where p.execucao_id = v_ex
       and (v_padroes is null or coalesce(p.texto_busca, '') like all (v_padroes))
       and (p_uf is null or p.uf = p_uf)
       and (p_ibge is null or p.cod_ibge = p_ibge)
       and (p_tema is null or p_tema = any (p.temas))
       and (p_desfechos is null or cardinality(p_desfechos) = 0 or p.desfecho = any (p_desfechos))
       and (p_orgao is null or p.orgao_sup = p_orgao)
       and (v_numero is null or lower(coalesce(p.nr_proposta, p.id_proposta)) like all (v_numero))
       and (v_prop is null or public.oport_sem_acento(p.proponente) like all (v_prop))
       and (v_mun is null or public.oport_sem_acento(p.municipio) like all (v_mun))
       and (v_prog is null or public.oport_sem_acento(p.programa) like all (v_prog))
       and (v_obj is null or public.oport_sem_acento(p.objeto) like all (v_obj))
       and (v_org is null or public.oport_sem_acento(p.orgao_sup) like all (v_org))
       and (v_marc is null or p.desfecho = any (v_marc))
       and (p_repasse_de is null or p.valor_repasse >= p_repasse_de)
       and (p_repasse_ate is null or p.valor_repasse <= p_repasse_ate)
       and (p_data_de is null or p.dt_envio >= p_data_de)
       and (p_data_ate is null or p.dt_envio <= p_data_ate)
     order by pos
     limit greatest(1, least(coalesce(p_limite, 30), 100))
    offset greatest(0, least(coalesce(p_offset, 0), 10000))
  )
  select p.id_proposta, p.nr_proposta, p.uf, p.cod_ibge, p.municipio, p.proponente, p.orgao_sup, p.programa, p.temas,
         p.objeto, p.valor_repasse, p.dt_envio, p.ano_envio, p.desfecho, p.situacao, p.nr_convenio, p.cnpj, f.total
    from f join public.painel_proposta p on p.ctid = f.tid
   order by f.pos;
end $function$;

revoke execute on function public.painel_busca_instrumentos_v2(text[], text, text, text, text[], text, text[], text[], text[], text[], text[], text[], text[], numeric, numeric, numeric, numeric, date, date, text, boolean, integer, integer) from public, anon, authenticated;
revoke execute on function public.painel_busca_propostas_v2(text[], text, text, text, text[], text, text[], text[], text[], text[], text[], text[], text[], numeric, numeric, date, date, text, boolean, integer, integer) from public, anon, authenticated;
grant  execute on function public.painel_busca_instrumentos_v2(text[], text, text, text, text[], text, text[], text[], text[], text[], text[], text[], text[], numeric, numeric, numeric, numeric, date, date, text, boolean, integer, integer) to service_role;
grant  execute on function public.painel_busca_propostas_v2(text[], text, text, text, text[], text, text[], text[], text[], text[], text[], text[], text[], numeric, numeric, date, date, text, boolean, integer, integer) to service_role;

-- O PostgREST relê o esquema para enxergar as funções novas.
notify pgrst, 'reload schema';
