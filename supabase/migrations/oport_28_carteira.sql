-- =============================================================================
-- oport_28 — Carteira: seguir município (MVP da tarefa recorrente, 02/10/2026)
--
-- A tarefa que a plataforma passa a resolver é "acompanhar uma carteira de municípios
-- e instrumentos, entender o que mudou e chegar à recomendação fundamentada". Os
-- convênios, as propostas e as janelas já se seguem desde a onda 7 (oport_15). Esta
-- migração acrescenta o município:
--
--   · `oport_favorito` e `oport_aviso` aceitam o tipo `municipio` (chave = IBGE de 7 dígitos);
--   · `oport_estado_painel` ganha o retrato do município, montado só de agregados que
--     já estão no banco: convênios em execução e os sinais do painel (`painel_municipio`),
--     as três decisões do painel fiscal e as pendências do CAUC (`fiscal_municipio`,
--     só PB), a despesa com pessoal e as TCE no TCU (`tcu_consulta`). Nenhum nome de pessoa.
--
-- A geração dos avisos é a mesma da oport_15 (`oport_gerar_avisos_painel`, chamada
-- pelo job do painel): compara o retrato novo com o anterior campo a campo e grava um
-- aviso por diferença. Por isso uma decisão fiscal que mudou numa manhã aparece na
-- rodada seguinte do painel, com a referência do painel.
--
-- Município que não está em nenhuma das fontes é recusado, como o convênio fora do painel.
--
-- Idempotente. Pré-requisitos: oport_15 (itens seguidos e avisos), oport_9 e oport_14
-- (painel), fiscal_1 (painel fiscal) e oport_25 (e-TCE do TCU).
-- =============================================================================

alter table public.oport_favorito drop constraint if exists oport_favorito_tipo_check;
alter table public.oport_favorito add constraint oport_favorito_tipo_check
  check (tipo in ('janela', 'instrumento', 'proposta', 'municipio'));

alter table public.oport_favorito drop constraint if exists oport_favorito_chave_do_tipo;
alter table public.oport_favorito add constraint oport_favorito_chave_do_tipo check (
  tipo = 'janela'
  or (tipo = 'instrumento' and chave ~ '^[0-9A-Za-z]{1,20}$')
  or (tipo = 'proposta' and chave ~ '^[0-9]{1,12}$')
  or (tipo = 'municipio' and chave ~ '^[0-9]{7}$')
);

alter table public.oport_aviso drop constraint if exists oport_aviso_tipo_check;
alter table public.oport_aviso add constraint oport_aviso_tipo_check
  check (tipo in ('janela', 'instrumento', 'proposta', 'municipio'));


-- -----------------------------------------------------------------------------
-- O retrato de um convênio, de uma proposta ou de um município na execução do painel.
--
-- Os ramos do convênio e da proposta são os da oport_15, sem mudança. O do município
-- junta contagens e estados; campo que a fonte não traz (o fiscal fora da PB) não entra
-- no retrato, e a comparação só olha as chaves que o retrato anterior já tinha.
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
         ) || coalesce(f.retrato, '{}'::jsonb)
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
   where p_tipo = 'municipio' and (pi.n > 0 or f.nome is not null)
  limit 1
$$;

revoke execute on function public.oport_estado_painel(text, text, bigint) from public, anon, authenticated;
grant execute on function public.oport_estado_painel(text, text, bigint) to service_role;


-- -----------------------------------------------------------------------------
-- A geração passa a incluir o município. Mesmo corpo da oport_15; muda só o filtro de tipo.
-- -----------------------------------------------------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public.oport_gerar_avisos_painel()'::regprocedure);
begin
  if position($q$where f.tipo in ('instrumento', 'proposta')$q$ in v_def) > 0 then
    execute replace(v_def, $q$where f.tipo in ('instrumento', 'proposta')$q$, $q$where f.tipo in ('instrumento', 'proposta', 'municipio')$q$);
  elsif position($q$where f.tipo in ('instrumento', 'proposta', 'municipio')$q$ in v_def) = 0 then
    raise exception 'oport_gerar_avisos_painel mudou desde a oport_15: rever a oport_28';
  end if;
end $$;
