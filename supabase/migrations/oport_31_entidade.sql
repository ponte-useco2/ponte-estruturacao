-- =============================================================================
-- oport_31 — Página da entidade, E2 (07/10/2026)
--
-- Três coisas, todas para a entidade (um CNPJ proponente) virar cidadã do Mapa como o município:
--
--   (1) Vínculo confirmado entre organização e CNPJ. O cliente que não é prefeitura — organização da sociedade
--       civil, órgão estadual, consórcio — vê o laudo dos próprios instrumentos e a página da própria entidade
--       como cliente. Mesmo desenho da oport_12: tabela à parte, porque dono e editor podem dar UPDATE na
--       organização pela sessão, e uma coluna "confirmado" ali seria autoconfirmável. Só a chave de serviço
--       escreve; o administrador confirma na tela de acessos. A confirmação guarda o CNPJ confirmado e só vale
--       enquanto o cadastro tiver esse mesmo CNPJ (a leitura compara os dois, sem gatilho).
--
--   (2) Seguir entidade. `oport_favorito` e `oport_aviso` aceitam o tipo `entidade` (chave = CNPJ), e
--       `oport_estado_painel` ganha o retrato por CNPJ com as MESMAS chaves do retrato do município (para a
--       carteira usar os mesmos números e recomendações): convênios em execução, os sinais do painel por
--       convênio (`painel_convenio`, com as regras do job para o município em `painel_execucao/convenios.py`),
--       as TCE no TCU dos convênios do CNPJ, as propostas e o Pix em curso. Sem fiscal: o CAUC e a LRF são do
--       ente federativo e já estão no retrato do município. A geração de avisos passa a incluir o tipo.
--
--   (3) As buscas do painel devolvem o CNPJ do proponente, para a lista de resultados levar à entidade. A
--       mudança do tipo de retorno exige DROP + CREATE; os grants voltam como estavam (só service_role).
--
-- Idempotente. Pré-requisitos: oport_12, oport_14, oport_15, oport_25, oport_28 e oport_30.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (1) Vínculo confirmado entre organização e CNPJ
-- -----------------------------------------------------------------------------
create table if not exists public.oport_vinculo_cnpj (
  organizacao_id uuid primary key references public.oport_organizacao (id) on delete cascade,
  -- 14 posições; aceita o CNPJ alfanumérico (12 letras ou dígitos + 2 dígitos verificadores)
  cnpj           text not null check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  confirmado_em  timestamptz not null default now(),
  -- E-mail do administrador, como `oport_vinculo_municipio.confirmado_por`.
  confirmado_por text not null check (length(btrim(confirmado_por)) > 3)
);

alter table public.oport_vinculo_cnpj enable row level security;
revoke all on table public.oport_vinculo_cnpj from anon, authenticated;
grant all on table public.oport_vinculo_cnpj to service_role;


-- -----------------------------------------------------------------------------
-- (2) Seguir entidade
-- -----------------------------------------------------------------------------
alter table public.oport_favorito drop constraint if exists oport_favorito_tipo_check;
alter table public.oport_favorito add constraint oport_favorito_tipo_check
  check (tipo in ('janela', 'instrumento', 'proposta', 'municipio', 'entidade'));

alter table public.oport_favorito drop constraint if exists oport_favorito_chave_do_tipo;
alter table public.oport_favorito add constraint oport_favorito_chave_do_tipo check (
  tipo = 'janela'
  or (tipo = 'instrumento' and chave ~ '^[0-9A-Za-z]{1,20}$')
  or (tipo = 'proposta' and chave ~ '^[0-9]{1,12}$')
  or (tipo = 'municipio' and chave ~ '^[0-9]{7}$')
  or (tipo = 'entidade' and chave ~ '^[0-9A-Z]{12}[0-9]{2}$')
);

alter table public.oport_aviso drop constraint if exists oport_aviso_tipo_check;
alter table public.oport_aviso add constraint oport_aviso_tipo_check
  check (tipo in ('janela', 'instrumento', 'proposta', 'municipio', 'entidade'));


-- O retrato. Os ramos do convênio, da proposta e do município são os da oport_30, sem mudança; o da entidade
-- é novo. Entidade que não tem instrumento nem proposta no painel é recusada, como o convênio fora do painel.
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
  union all
  -- Entidade (E2): as mesmas chaves do município, menos o fiscal; mais instrumentos e propostas.
  select left(coalesce(en.nome, pr.nome, 'Entidade ' || p_chave), 300),
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
   where p_tipo = 'entidade' and (en.n > 0 or pr.n > 0)
  limit 1
$$;

revoke execute on function public.oport_estado_painel(text, text, bigint) from public, anon, authenticated;
grant execute on function public.oport_estado_painel(text, text, bigint) to service_role;


-- A geração passa a incluir a entidade. Mesmo corpo da oport_28; muda só o filtro de tipo.
do $$
declare
  v_def text := pg_get_functiondef('public.oport_gerar_avisos_painel()'::regprocedure);
begin
  if position($q$where f.tipo in ('instrumento', 'proposta', 'municipio')$q$ in v_def) > 0 then
    execute replace(v_def, $q$where f.tipo in ('instrumento', 'proposta', 'municipio')$q$, $q$where f.tipo in ('instrumento', 'proposta', 'municipio', 'entidade')$q$);
  elsif position($q$where f.tipo in ('instrumento', 'proposta', 'municipio', 'entidade')$q$ in v_def) = 0 then
    raise exception 'oport_gerar_avisos_painel mudou desde a oport_28: rever a oport_31';
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- (3) As buscas devolvem o CNPJ do proponente
-- -----------------------------------------------------------------------------
drop function if exists public.painel_busca_instrumentos(text[], text, text, text, text[], text, integer, integer);
create function public.painel_busca_instrumentos(
  p_termos     text[]  default null,
  p_uf         text    default null,
  p_ibge       text    default null,
  p_tema       text    default null,
  p_situacoes  text[]  default null,
  p_orgao      text    default null,
  p_limite     integer default 30,
  p_offset     integer default 0
)
returns table (
  nr_convenio text, nr_proposta text, modalidade text, situacao text, vivo boolean, detalhe boolean, uf text,
  cod_ibge text, municipio text, proponente text, orgao_sup text, programa text, temas text[], objeto text,
  vl_repasse numeric, vl_desembolsado numeric, dt_assinatura date, dt_fim_vigencia date, cnpj text, total bigint
)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id from public.painel_ultima_execucao()),
  f as (
    select i.* from public.painel_instrumento i, ex
     where i.execucao_id = ex.id
       and (p_termos is null or cardinality(p_termos) = 0
            or i.texto_busca like all (array(select '%' || t || '%' from unnest(p_termos) t)))
       and (p_uf is null or i.uf = p_uf)
       and (p_ibge is null or i.cod_ibge = p_ibge)
       and (p_tema is null or p_tema = any (i.temas))
       and (p_situacoes is null or cardinality(p_situacoes) = 0 or i.situacao = any (p_situacoes))
       and (p_orgao is null or i.orgao_sup = p_orgao)
  )
  select f.nr_convenio, f.nr_proposta, f.modalidade, f.situacao, f.vivo, f.detalhe, f.uf, f.cod_ibge, f.municipio,
         f.proponente, f.orgao_sup, f.programa, f.temas, f.objeto, f.vl_repasse, f.vl_desembolsado, f.dt_assinatura,
         f.dt_fim_vigencia, f.cnpj, count(*) over ()
    from f
   order by (p_termos is not null and cardinality(p_termos) = 1 and (f.nr_convenio = p_termos[1] or f.nr_proposta = p_termos[1])) desc,
            f.vivo desc, f.dt_assinatura desc nulls last, f.nr_convenio
   limit greatest(1, least(coalesce(p_limite, 30), 100))
  offset greatest(0, least(coalesce(p_offset, 0), 10000))
$$;

drop function if exists public.painel_busca_propostas(text[], text, text, text, text[], text, integer, integer);
create function public.painel_busca_propostas(
  p_termos    text[]  default null,
  p_uf        text    default null,
  p_ibge      text    default null,
  p_tema      text    default null,
  p_desfechos text[]  default null,
  p_orgao     text    default null,
  p_limite    integer default 30,
  p_offset    integer default 0
)
returns table (
  id_proposta text, nr_proposta text, uf text, cod_ibge text, municipio text, proponente text, orgao_sup text,
  programa text, temas text[], objeto text, valor_repasse numeric, dt_envio date, ano_envio integer, desfecho text,
  situacao text, nr_convenio text, cnpj text, total bigint
)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id from public.painel_ultima_execucao()),
  f as (
    select p.* from public.painel_proposta p, ex
     where p.execucao_id = ex.id
       and (p_termos is null or cardinality(p_termos) = 0
            or coalesce(p.texto_busca, '') like all (array(select '%' || t || '%' from unnest(p_termos) t)))
       and (p_uf is null or p.uf = p_uf)
       and (p_ibge is null or p.cod_ibge = p_ibge)
       and (p_tema is null or p_tema = any (p.temas))
       and (p_desfechos is null or cardinality(p_desfechos) = 0 or p.desfecho = any (p_desfechos))
       and (p_orgao is null or p.orgao_sup = p_orgao)
  )
  select f.id_proposta, f.nr_proposta, f.uf, f.cod_ibge, f.municipio, f.proponente, f.orgao_sup, f.programa, f.temas,
         f.objeto, f.valor_repasse, f.dt_envio, f.ano_envio, f.desfecho, f.situacao, f.nr_convenio, f.cnpj, count(*) over ()
    from f
   order by (p_termos is not null and cardinality(p_termos) = 1 and (f.nr_proposta = p_termos[1] or f.id_proposta = p_termos[1])) desc,
            f.dt_envio desc nulls last, f.id_proposta
   limit greatest(1, least(coalesce(p_limite, 30), 100))
  offset greatest(0, least(coalesce(p_offset, 0), 10000))
$$;

revoke execute on function public.painel_busca_instrumentos(text[], text, text, text, text[], text, integer, integer) from public, anon, authenticated;
grant execute on function public.painel_busca_instrumentos(text[], text, text, text, text[], text, integer, integer) to service_role;
revoke execute on function public.painel_busca_propostas(text[], text, text, text, text[], text, integer, integer) from public, anon, authenticated;
grant execute on function public.painel_busca_propostas(text[], text, text, text, text[], text, integer, integer) to service_role;
