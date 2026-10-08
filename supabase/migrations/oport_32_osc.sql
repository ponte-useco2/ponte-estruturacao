-- =============================================================================
-- oport_32 — Organizações da sociedade civil da PB pelo Mapa das OSC (Ipea), E3 da página da entidade (07/10/2026)
--
-- O job `osc_mapa` (mensal, `osc.yml`) lê o arquivo nacional do Mapa das OSC, fica com as linhas da PB e grava:
--
--   · osc_execucao e as funções osc_ultima_execucao / osc_concluir / osc_limpar (o desenho da oport_25), com a
--     versão da fonte (a data no nome do arquivo, AAAAMMDD) — o job não grava duas vezes a mesma versão;
--   · osc_entidade: uma linha por CNPJ da PB, de qualquer situação cadastral (a página de uma entidade com
--     convênio diz se ela está inapta na Receita). Ativa = situação "Ativa" e não removida pelo Ipea;
--   · osc_municipio: o resumo dos 223 municípios (ativas, matrizes, filiais, raízes, inaptas, recentes, por área
--     e por natureza) — a lente "Sociedade civil" da página do município.
--
-- E o retrato do "seguir entidade" (oport_31) passa a aceitar a OSC que está só no cadastro: o retrato sai zerado
-- e o aviso vem quando aparecer a primeira proposta ou o primeiro instrumento.
--
-- Privacidade: NENHUMA coluna de endereço, coordenadas, contato, dirigente ou sócio. O arquivo do Ipea não traz
-- pessoa física; o job descarta endereço e coordenadas na leitura (em associação pequena o endereço registrado
-- costuma ser a casa de um dirigente). Das planilhas de CEBAS ficam só tipo, situação e vigência.
--
-- ORDEM: esta migração ANTES do job chegar à `main`. Leitura só pelo servidor, com a chave de serviço (grants
-- explícitos). Idempotente. Pré-requisitos: oport_25, oport_30 e oport_31.
-- =============================================================================

create table if not exists public.osc_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- O Last-Modified do arquivo do mês.
  dado_ate     timestamptz,
  referencia   date,
  -- A data no nome do arquivo do Ipea (AAAAMMDD), ou "local".
  versao_fonte text,
  arquivos     jsonb not null default '{}'::jsonb,
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists osc_execucao_concluida_idx on public.osc_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.osc_entidade (
  execucao_id        bigint not null references public.osc_execucao (id) on delete cascade,
  -- 14 posições; aceita o alfanumérico (12 letras ou dígitos + 2 dígitos verificadores)
  cnpj               text not null check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  cnpj_raiz          text not null,
  razao_social       text,
  nome_fantasia      text,
  -- 4 dígitos da tabela da Receita: 3999 associação, 3069 fundação, 3220 religiosa, 3301 OS, 3204 estrangeira
  natureza_juridica  text,
  -- null = "Não Identificado" no arquivo (as baixadas)
  matriz             boolean,
  situacao_cadastral text,
  removida           boolean not null default false,
  ativa              boolean not null,
  dt_fundacao        date,
  dt_fechamento      date,
  cod_ibge           text not null,
  -- o nome dos 223 da semente do job fiscal (com acento)
  municipio          text,
  cnae_principal     text,
  cnaes_secundarias  text[] not null default '{}',
  -- os códigos das colunas Area_* e SubArea_* do Ipea (o rótulo fica no site)
  areas              text[] not null default '{}',
  subareas           text[] not null default '{}',
  -- [{tipo: suas|saude|educacao, situacao, inicio, fim}], pelas planilhas do Mapa (paradas em 12/2024)
  cebas              jsonb not null default '[]'::jsonb,
  -- razão social, nome fantasia e CNPJ em minúsculas e sem acento, para a busca
  texto_busca        text not null default '',
  primary key (execucao_id, cnpj)
);
create index if not exists osc_entidade_municipio_idx on public.osc_entidade (execucao_id, cod_ibge) where ativa;
create index if not exists osc_entidade_raiz_idx on public.osc_entidade (execucao_id, cnpj_raiz);

create table if not exists public.osc_municipio (
  execucao_id  bigint not null references public.osc_execucao (id) on delete cascade,
  cod_ibge     text not null,
  ativas       integer not null,
  matrizes     integer not null,
  filiais      integer not null,
  raizes       integer not null,
  inaptas      integer not null,
  suspensas    integer not null,
  baixadas     integer not null,
  removidas    integer not null,
  -- ativas fundadas nos últimos 5 anos (da data de referência da carga)
  recentes     integer not null,
  com_cebas    integer not null,
  por_area     jsonb not null default '{}'::jsonb,
  por_natureza jsonb not null default '{}'::jsonb,
  primary key (execucao_id, cod_ibge)
);

do $$
declare
  t text;
begin
  foreach t in array array['osc_execucao', 'osc_entidade', 'osc_municipio'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.osc_execucao_id_seq from anon, authenticated;
grant usage, select on sequence public.osc_execucao_id_seq to service_role;

create or replace function public.osc_ultima_execucao()
returns setof public.osc_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.osc_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.osc_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.osc_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída e p_manter. Devolve quantas apagou;
-- 0 = nada mais a limpar. As execuções antigas (sem linhas) ficam como histórico.
create or replace function public.osc_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.osc_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.osc_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['osc_entidade', 'osc_municipio'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.osc_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.osc_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.osc_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.osc_ultima_execucao()                    to service_role;
grant  execute on function public.osc_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.osc_limpar(bigint, integer)               to service_role;


-- -----------------------------------------------------------------------------
-- O retrato do "seguir entidade": o da oport_31, com a OSC que está só no cadastro. Os ramos do convênio, da
-- proposta e do município ficam sem mudança.
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
