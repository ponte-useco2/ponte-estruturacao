-- =============================================================================
-- oport_54 — Índice de trigramas na busca e índice dos temas da página da UF (investigação do portal, 29/10/2026)
--
-- A rodada 1 da investigação (M-01, A3-05; `Site-Ponte/investigacao-portal/E2`) mediu a busca varrendo a tabela
-- inteira: `painel_busca_instrumentos_v2` 2,8 s de média e até o corte de 8 s; "saude" levou 10 s com o disco frio
-- (seq scan de painel_instrumento, 162 MB, para 9.918 de 79 mil linhas). Não havia `pg_trgm` em nenhuma migração.
-- E a leitura dos temas da página da UF (`pagina-uf.server.ts`, `lerTemasDosMunicipios`) caiu no corte em 28/10, 22h24
-- UTC: 5,8 s medidos em 29/10 lendo 2,6 mil páginas do heap para 2,7 mil linhas.
--
--   (1) `pg_trgm` no esquema `extensions` (o padrão do Supabase) e índices GIN de trigramas em `texto_busca` de
--       painel_instrumento, painel_proposta e osc_entidade. O `like '%termo%'` usa o índice; o `like all (array)` não
--       (o GIN não aceita vetor), por isso as funções v2 ganham a condição do primeiro termo sozinho.
--   (2) As funções v2 da oport_51, idênticas, com essa condição a mais: mesmas assinaturas, colunas e permissões.
--       Com `force_custom_plan`, `v_padroes[1]` entra no plano como constante.
--   (3) Índice parcial de cobertura para os temas dos instrumentos vivos da UF: leitura só do índice, sem o heap.
--
-- Termo comum ("saude", 12% das linhas) pode continuar na varredura: aí quem segura é o cache do site (10 min por
-- execução e chamada, `rpc-guardada.server.ts`). O ganho do índice é nos termos raros (nome de município, número).
--
-- ORDEM: independe do site (o site publicado e o novo chamam as mesmas funções). Aplicar FORA da rodada diária do
-- painel (conferir antes que não há execução 'gravando'): cada `create index` trava a escrita na sua tabela enquanto
-- cria (a de painel_proposta é a maior, ~200 MB); as leituras seguem. Idempotente. Pré-requisitos: oport_35, oport_46,
-- oport_51 e a da OSC (osc_entidade.texto_busca).
-- =============================================================================

-- (1) Trigramas
create extension if not exists pg_trgm with schema extensions;

create index if not exists painel_instrumento_texto_trgm_idx
  on public.painel_instrumento using gin (texto_busca extensions.gin_trgm_ops);
create index if not exists painel_proposta_texto_trgm_idx
  on public.painel_proposta using gin (texto_busca extensions.gin_trgm_ops);
create index if not exists osc_entidade_texto_trgm_idx
  on public.osc_entidade using gin (texto_busca extensions.gin_trgm_ops);

-- (3) Temas dos vivos da UF, na ordem da leitura (número do convênio), com as três colunas que ela pede.
create index if not exists painel_instrumento_vivo_temas_idx
  on public.painel_instrumento (execucao_id, uf, nr_convenio) include (cod_ibge, temas, vl_global)
  where vivo and temas is not null;

-- (2) Funções da busca, v2 com a condição do primeiro termo
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
       -- oport_54: o primeiro termo sozinho entra no índice de trigramas; o `like all` confere os outros.
       and (v_padroes is null or i.texto_busca like v_padroes[1])
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
       -- oport_54: idem (o nulo não casa com '%termo%', como o '' do coalesce abaixo).
       and (v_padroes is null or p.texto_busca like v_padroes[1])
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
