-- =============================================================================
-- oport_53 — Seguir a primeira infância de um município (P3, 29/10/2026)
--
-- Quem segue um município (favorito `municipio`, oport_28) passa a receber aviso quando um termo de creche ou de
-- educação infantil do município:
--   · recebe parcela (`creche_liberado`, o total liberado em reais inteiros, sobe);
--   · faz o primeiro pagamento (`creche_pagando`, os termos com algum pagamento, sobe);
--   · completa 180 dias parado (`creche_parada_180`, os termos com dinheiro liberado, nenhum pagamento e 180 dias desde
--     a última liberação, sobe).
-- Os três campos entram no retrato do município em `oport_estado_painel`; a geração é a de sempre
-- (`oport_gerar_avisos_painel`, na rodada diária do painel), que compara o retrato novo com o anterior campo a campo.
-- Os campos existem sempre (zero sem creche): o primeiro termo de creche do município também vira aviso. Na primeira
-- rodada depois desta migração os campos só entram no retrato, sem aviso (a comparação olha as chaves que já existiam).
--
-- A função é a da oport_32 com um `left join lateral` a mais no ramo do município; os outros ramos não mudam.
-- Medido em 29/10/2026 (painel de 27/10): 58 termos em 42 municípios, R$ 19,5 mi liberados, 8 com pagamento, 16 parados
-- há 180+ dias.
--
-- Idempotente. Pré-requisitos: oport_32 (a função) e oport_46 (oport_sem_acento).
-- =============================================================================
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
         ) || coalesce(f.retrato, '{}'::jsonb) || coalesce(px.retrato, '{}'::jsonb) || cr.retrato
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
    -- oport_53 (P3 da primeira infância, 29/10/2026): os termos de creche e educação infantil do município, com a regra
    -- da página (`ehCreche`, em execução ou com saldo em conta) e o "parado longo" do ponto da fila (P2b): dinheiro
    -- liberado, nenhum pagamento e 180 dias desde a última liberação, contados até o dia do arquivo do painel.
    left join lateral (
      select jsonb_build_object(
               'creche_liberado', round(coalesce(sum(i.vl_desembolsado), 0)),
               'creche_pagando', count(*) filter (where i.dt_ultimo_pagamento is not null),
               'creche_parada_180', count(*) filter (
                  where i.situacao = 'Em execução' and coalesce(i.vl_desembolsado, 0) > 0 and i.dt_ultimo_pagamento is null
                    and coalesce(i.dt_ultimo_desembolso, i.dt_primeiro_desembolso)
                        <= (select x.referencia from public.painel_execucao x where x.id = p_execucao) - 180)
             ) as retrato
        from public.painel_instrumento i
       where i.execucao_id = p_execucao and i.cod_ibge = p_chave
         and public.oport_sem_acento(coalesce(i.programa, '') || ' ' || coalesce(i.objeto, ''))
             ~ '(creche|educacao infantil|ensino infantil|pre-?escola|proinfancia|pro-infancia|primeira infancia|\ycmei\y)'
         and (i.situacao = 'Em execução' or coalesce(i.vl_saldo_conta, 0) > 0)
    ) cr on true
   where p_tipo = 'municipio' and (pi.n > 0 or f.nome is not null)
  union all
  -- Entidade (E2): as mesmas chaves do município, menos o fiscal; mais instrumentos e propostas.
  select left(coalesce(en.nome, pr.nome, os.nome, 'Entidade ' || p_chave), 300),
         jsonb_build_object(
           'instrumentos', coalesce(en.n, 0),
           'em_execucao', coalesce(en.n_execucao, 0),
           'em_suspensiva', coalesce(sc.n_suspensiva, 0),
           'contas_atrasadas', coalesce(sc.n_contas_atrasadas, 0),
           'contas_rejeitadas', coalesce(sc.n_contas_negativas, 0),
           'saldo_parado', coalesce(sc.n_saldo, 0),
           'sem_desembolso', coalesce(sc.n_sem_desembolso, 0),
           'tce_tcu', coalesce(te.n, 0),
           'propostas', coalesce(pr.n, 0)
         ) || coalesce(pe.retrato, '{}'::jsonb)
    from (select 1) um
    left join lateral (
      select count(*) as n,
             count(*) filter (where i.situacao = 'Em execução') as n_execucao,
             (array_agg(i.proponente order by i.dt_assinatura desc nulls last))[1] as nome
        from public.painel_instrumento i
       where i.execucao_id = p_execucao and i.cnpj = p_chave
    ) en on true
    left join lateral (
      select count(*) as n, (array_agg(p.proponente order by p.dt_envio desc nulls last))[1] as nome
        from public.painel_proposta p
       where p.execucao_id = p_execucao and p.cnpj = p_chave
    ) pr on true
    -- Os sinais por convênio, com as regras do job para o município (DIAS_SUSPENSIVA_SINAL = 90,
    -- DIAS_SEM_DESEMBOLSO_SINAL = 365, contado da data de referência do arquivo do painel).
    left join lateral (
      select count(*) filter (where c.saldo_parado) as n_saldo,
             count(*) filter (where c.em_suspensiva and c.suspensiva_dias <= 90) as n_suspensiva,
             count(*) filter (where c.contas_atrasada) as n_contas_atrasadas,
             count(*) filter (where c.contas_lado = 'negativo' or c.tce) as n_contas_negativas,
             count(*) filter (where c.nunca_desembolsado and not c.em_suspensiva
                                and c.dt_assinatura < (select x.referencia from public.painel_execucao x where x.id = p_execucao) - 365) as n_sem_desembolso
        from public.painel_convenio c
       where c.execucao_id = p_execucao
         and c.nr_convenio in (select i.nr_convenio from public.painel_instrumento i where i.execucao_id = p_execucao and i.cnpj = p_chave)
    ) sc on true
    left join lateral (
      select sum(c.n_tce) as n
        from public.tcu_consulta c
       where c.execucao_id = (select e.id from public.tcu_ultima_execucao() e)
         and c.nr_convenio in (select i.nr_convenio from public.painel_instrumento i where i.execucao_id = p_execucao and i.cnpj = p_chave)
    ) te on true
    left join lateral (
      select jsonb_build_object(
               'pix_vez_ente', count(c.*) filter (where c.vez = 'ente'),
               'pix_vez_orgao', count(c.*) filter (where c.vez = 'orgao'),
               'pix_prazo_ente', min(c.prazo) filter (where c.vez = 'ente')
             ) as retrato
        from (select e.id from public.pixc_ultima_execucao() e) ex
        left join public.pix_ciclo_plano c on c.execucao_id = ex.id and c.cnpj = p_chave
       group by ex.id
    ) pe on true
    -- oport_32: a organização da sociedade civil que está só no cadastro do Mapa das OSC também se segue (retrato
    -- zerado; o aviso sai quando aparecer a primeira proposta ou o primeiro instrumento).
    left join lateral (
      select o.razao_social as nome
        from public.osc_entidade o
       where o.execucao_id = (select e.id from public.osc_ultima_execucao() e) and o.cnpj = p_chave
    ) os on true
   where p_tipo = 'entidade' and (en.n > 0 or pr.n > 0 or os.nome is not null)
  limit 1
$$;

revoke execute on function public.oport_estado_painel(text, text, bigint) from public, anon, authenticated;
grant execute on function public.oport_estado_painel(text, text, bigint) to service_role;

-- O PostgREST relê o esquema (a assinatura não muda; por garantia).
notify pgrst, 'reload schema';
