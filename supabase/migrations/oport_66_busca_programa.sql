-- =============================================================================
-- oport_66 — Busca das propostas pelo código do programa (Diagnóstico externo de 17/11/2026, A04/A15)
--
-- O Radar abria a busca das propostas pelo NOME do programa (`q=`). O primeiro termo é o único que usa o índice de
-- trigramas (oport_54), e "fomento" casa ~50 mil das 139 mil propostas: a busca estourou os 8 s do PostgREST (57014
-- nos logs de 17/11/2026 às 10:19 e 10:27 UTC) e a tela disse "A busca está indisponível agora". O código do programa
-- (`painel_proposta.cod_programa`, 13 dígitos) não tinha índice nem parâmetro na busca.
--
--   (1) Índice `(execucao_id, cod_programa)` em painel_proposta (3.967 propostas no programa 2200020260004, 306 na PB).
--   (2) `painel_busca_propostas_v2` ganha `p_cod_programa text default null` (nulo = todos os programas, como hoje).
--       Corpo, colunas e permissões iguais aos da oport_54; só a condição do código a mais. A assinatura muda: `drop` da
--       antiga antes do `create` (acrescentar parâmetro com padrão criaria uma SOBRECARGA, como na oport_17), numa
--       transação, com os mesmos `revoke`/`grant` (só `service_role`, como a seguranca_1 manda).
--
-- ORDEM: independe do site. O site publicado não manda `p_cod_programa` e continua casando com a função nova (o
-- parâmetro tem padrão); o site novo só o manda com `?programa=` e, sem esta migração, diz que o filtro depende de uma
-- atualização do banco (PGRST202). Aplicar FORA da rodada diária do painel (conferir antes que não há execução
-- 'gravando'): o `create index` trava a escrita em painel_proposta (~219 MB) enquanto cria; as leituras seguem.
-- Idempotente. Pré-requisito: oport_54.
--
-- REVERTER: `drop index if exists public.painel_proposta_programa_idx;`, `drop function if exists
-- public.painel_busca_propostas_v2(text[], text, text, text, text[], text, text[], text[], text[], text[], text[], text[],
-- text[], numeric, numeric, date, date, text, boolean, integer, integer, text);` e rodar de novo, da oport_54, o
-- `create or replace function public.painel_busca_propostas_v2` e as linhas de `revoke`/`grant` dele, e o `notify`.
-- =============================================================================

-- (1) Índice do código do programa
create index if not exists painel_proposta_programa_idx
  on public.painel_proposta (execucao_id, cod_programa);

-- (2) A função das propostas com o código do programa
begin;

drop function if exists public.painel_busca_propostas_v2(text[], text, text, text, text[], text, text[], text[], text[], text[], text[], text[], text[], numeric, numeric, date, date, text, boolean, integer, integer);

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
  p_offset        integer default 0,
  -- oport_66: o código do programa no Transferegov; nulo = todos.
  p_cod_programa  text    default null
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
       -- oport_66: com `force_custom_plan`, o código entra no plano como constante e usa painel_proposta_programa_idx.
       and (p_cod_programa is null or p.cod_programa = p_cod_programa)
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

revoke execute on function public.painel_busca_propostas_v2(text[], text, text, text, text[], text, text[], text[], text[], text[], text[], text[], text[], numeric, numeric, date, date, text, boolean, integer, integer, text) from public, anon, authenticated;
grant  execute on function public.painel_busca_propostas_v2(text[], text, text, text, text[], text, text[], text[], text[], text[], text[], text[], text[], numeric, numeric, date, date, text, boolean, integer, integer, text) to service_role;

commit;

-- O PostgREST relê o esquema para enxergar a assinatura nova.
notify pgrst, 'reload schema';
