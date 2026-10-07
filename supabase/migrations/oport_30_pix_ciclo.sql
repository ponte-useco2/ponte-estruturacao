-- =============================================================================
-- oport_30 — Pix: o ciclo em curso e o alerta na carteira (07/10/2026)
--
-- Em 2026, 18 planos do Pix da PB (R$ 12,8 mi) ficaram impedidos porque o ente não deu ciência, não
-- enviou ou não complementou o plano de trabalho no prazo. O job `pix_fundo/ciclo.py`, diário no
-- radar-propostas.yml e ANTES do painel, grava os planos da UF do exercício corrente com algo pendente:
--
--   · `pixc_execucao` (+ `pixc_ultima_execucao`, `pixc_concluir`, `pixc_limpar`), o mesmo ciclo de vida
--     das outras execuções (publicar_execucao, prefixo `pixc`);
--   · `pix_ciclo_plano`: um plano por linha — situação do plano e do plano de trabalho, de quem é a vez
--     (ente, órgão ou a_conferir), a etapa, desde quando, o prazo do comunicado (cadastrado à mão em
--     pix_fundo/prazos_ciclo.json; a API não traz) e a última análise do órgão (trecho sem CPF).
--
-- O retrato do município na carteira (`oport_estado_painel`) ganha `pix_vez_ente`, `pix_vez_orgao` e
-- `pix_prazo_ente`. A geração de avisos da oport_15 compara só as chaves que o retrato anterior já tinha:
-- os campos novos entram sem aviso no primeiro dia e avisam a partir do segundo. O resto da função é o da
-- oport_28, sem mudança.
--
-- Idempotente. Pré-requisito: oport_28 (carteira). Grants explícitos: nada para anon e authenticated.
-- =============================================================================

create table if not exists public.pixc_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  dado_ate     timestamptz,
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists pixc_execucao_concluida_idx on public.pixc_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.pix_ciclo_plano (
  execucao_id       bigint not null references public.pixc_execucao (id) on delete cascade,
  id_plano_acao     bigint not null,
  codigo_plano_acao text,
  ano               integer,
  ciclo             integer,
  beneficiario      text,
  cnpj              text,
  cod_ibge          text,
  autor             text,
  valor             numeric,
  situacao_plano    text,
  situacao_pt       text,
  desde             date,
  vez               text not null check (vez in ('ente', 'orgao', 'a_conferir')),
  etapa             text,
  prazo             date,
  prazo_fonte       text,
  -- {"orgao", "situacao", "parecer", "data", "valor_reprovado", "trecho", "fora_da_area"}
  ultima_analise    jsonb,
  primary key (execucao_id, id_plano_acao)
);
create index if not exists pix_ciclo_plano_ibge_idx on public.pix_ciclo_plano (execucao_id, cod_ibge);

do $$
declare
  t text;
begin
  foreach t in array array['pixc_execucao', 'pix_ciclo_plano'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.pixc_execucao_id_seq from anon, authenticated;
grant usage, select on sequence public.pixc_execucao_id_seq to service_role;

create or replace function public.pixc_ultima_execucao()
returns setof public.pixc_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.pixc_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.pixc_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.pixc_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

create or replace function public.pixc_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.pixc_ultima_execucao()), p_manter], null);
  apagar bigint[];
  n      integer;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.pixc_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;
  delete from public.pix_ciclo_plano
   where ctid = any (array(select ctid from public.pix_ciclo_plano where execucao_id = any (apagar)
                           limit greatest(1, least(coalesce(p_limite, 5000), 20000))));
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.pixc_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.pixc_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.pixc_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.pixc_ultima_execucao()                    to service_role;
grant  execute on function public.pixc_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.pixc_limpar(bigint, integer)               to service_role;


-- -----------------------------------------------------------------------------
-- O retrato do município ganha o Pix em curso. Mesmo corpo da oport_28 nos outros ramos.
-- -----------------------------------------------------------------------------
create or replace function public.oport_estado_painel(p_tipo text, p_chave text, p_execucao bigint)
returns table (titulo text, estado jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  select left(coalesce(i.objeto, i.programa, 'Convênio ' || i.nr_convenio), 300),
         jsonb_build_object(
           'situacao', i.situacao,
           'subsituacao', i.subsituacao,
           'vl_desembolsado', i.vl_desembolsado,
           'n_aditivos', i.n_aditivos,
           'n_prorrogas', i.n_prorrogas,
           'dt_fim_vigencia', i.dt_fim_vigencia,
           'dt_limite_contas', i.dt_limite_contas,
           'dt_retirada_suspensiva', i.dt_retirada_suspensiva,
           'pct_fisico', i.pct_fisico
         )
    from public.painel_instrumento i
   where p_tipo = 'instrumento' and i.execucao_id = p_execucao and i.nr_convenio = p_chave
  union all
  select left(coalesce(p.objeto, p.programa, 'Proposta ' || p.id_proposta), 300),
         jsonb_build_object(
           'situacao', p.situacao,
           'desfecho', p.desfecho,
           'nr_convenio', p.nr_convenio
         )
    from public.painel_proposta p
   where p_tipo = 'proposta' and p.execucao_id = p_execucao and p.id_proposta = p_chave
  union all
  select left(coalesce(f.nome, pm.municipio, pi.municipio, 'Município ' || p_chave), 300),
         jsonb_build_object(
           'em_execucao', coalesce(pi.n_execucao, 0),
           'em_suspensiva', coalesce(pm.n_suspensiva, 0),
           'contas_atrasadas', coalesce(pm.n_contas_atrasadas, 0),
           'contas_rejeitadas', coalesce(pm.n_contas_negativas, 0),
           'saldo_parado', coalesce(pm.n_saldo, 0),
           'sem_desembolso', coalesce(pm.n_sem_desembolso, 0),
           'tce_tcu', coalesce(t.n, 0)
         ) || coalesce(f.retrato, '{}'::jsonb) || coalesce(px.retrato, '{}'::jsonb)
    from (select 1) um
    left join lateral (
      select count(*) filter (where i.situacao = 'Em execução') as n_execucao, max(i.municipio) as municipio, count(*) as n
        from public.painel_instrumento i
       where i.execucao_id = p_execucao and i.cod_ibge = p_chave and i.tipo_agente = 'municipio'
    ) pi on true
    left join public.painel_municipio pm on pm.execucao_id = p_execucao and pm.cod_ibge = p_chave
    left join lateral (
      select m.nome,
             jsonb_strip_nulls(jsonb_build_object(
               'fiscal_a', (select c ->> 'estado' from jsonb_array_elements(m.conclusoes) c where c ->> 'decisao' = 'A'),
               'fiscal_b', (select c ->> 'estado' from jsonb_array_elements(m.conclusoes) c where c ->> 'decisao' = 'B'),
               'fiscal_c', (select c ->> 'estado' from jsonb_array_elements(m.conclusoes) c where c ->> 'decisao' = 'C'),
               'cauc', coalesce((select string_agg(x, ', ' order by x) from jsonb_array_elements_text(
                          case when jsonb_typeof(m.indicadores -> 'cauc_pendencias') = 'array' then m.indicadores -> 'cauc_pendencias' else '[]'::jsonb end) x), ''),
               'pessoal_pct', m.indicadores -> 'pessoal_pct'
             )) as retrato
        from public.fiscal_municipio m
       where m.execucao_id = (select e.id from public.fiscal_ultima_execucao() e) and m.ibge = p_chave
    ) f on true
    left join lateral (
      select sum(c.n_tce) as n
        from public.tcu_consulta c
       where c.execucao_id = (select e.id from public.tcu_ultima_execucao() e) and c.cod_ibge = p_chave
    ) t on true
    -- Pix, ciclo em curso (oport_30): só entra depois da primeira coleta do ciclo; o prazo fica mesmo nulo,
    -- para a mudança de "sem prazo" para uma data também virar aviso.
    left join lateral (
      select jsonb_build_object(
               'pix_vez_ente', count(c.*) filter (where c.vez = 'ente'),
               'pix_vez_orgao', count(c.*) filter (where c.vez = 'orgao'),
               'pix_prazo_ente', min(c.prazo) filter (where c.vez = 'ente')
             ) as retrato
        from (select e.id from public.pixc_ultima_execucao() e) ex
        left join public.pix_ciclo_plano c on c.execucao_id = ex.id and c.cod_ibge = p_chave
       group by ex.id
    ) px on true
   where p_tipo = 'municipio' and (pi.n > 0 or f.nome is not null)
  limit 1
$$;

revoke execute on function public.oport_estado_painel(text, text, bigint) from public, anon, authenticated;
grant execute on function public.oport_estado_painel(text, text, bigint) to service_role;
