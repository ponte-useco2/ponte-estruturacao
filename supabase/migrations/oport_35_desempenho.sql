-- =============================================================================
-- oport_35 — Desempenho do banco: plano por chamada, resumo numa passada e índices das listas (D35, 08/10/2026)
--
-- A API do Supabase corta cada comando em 8 s, e a auditoria B3 (08/10) mostrou o site encostando nisso:
-- `painel_resumo` 7,97 s, `painel_busca_instrumentos` 7,75 s (11,2 s medido), `painel_por_orgao` 7,59 s, as listas
-- do Brasil no painel ~7 s, o histórico das suspensivas 7,0 s e a limpeza do job 7,99 s. Medições de antes e
-- depois em `ux-onda2/D35-desempenho.md`. Esta migração:
--
--   (1) painel_resumo, painel_busca_instrumentos e painel_busca_propostas passam de `language sql` a plpgsql com
--       `plan_cache_mode = force_custom_plan`. Função SQL com `set search_path` não é expandida na consulta e, no
--       Postgres 17, é planejada sem conhecer os valores: `(p_uf is null or uf = p_uf)` vira varredura da tabela
--       inteira até para um município. Com o plano feito a cada chamada, o filtro vira `uf = 'PB'` e entra no
--       índice. Mesmas assinaturas, colunas, `stable` e `search_path`: o site não muda.
--   (2) painel_resumo numa passada: o CTE com `c.*` (~39 MB no Brasil) era guardado e relido ~20 vezes e
--       transbordava o work_mem de 2 MB (700 MB de leitura temporária). Agora a tabela é lida uma vez e somada por
--       combinação das marcas (~2,4 mil linhas no Brasil, cabem na memória); as mesmas 20 somas saem dessas linhas.
--   (3) painel_por_orgao (já plpgsql) ganha só o plano por chamada: depois de 5 chamadas na mesma conexão o
--       Postgres pode passar ao plano genérico, que varre a tabela inteira mesmo com UF.
--   (4) Nas buscas, a contagem total (`count(*) over ()`) guarda só a chave das linhas que casam, e não as linhas
--       largas (objeto, temas); as até 100 linhas da página são lidas depois pelo endereço físico (ctid).
--   (5) Índices parciais: listas do painel sem UF (suspensiva, nunca, contas, saldo, vigência, físico), histórico
--       das suspensivas (padrões, checklist e laudo) e funil do Brasil; e índices de cobertura para a lista de
--       municípios da UF (leitura só do índice).
--   (6) painel_limpar apaga em lotes de até mil linhas e para depois de ~3 s de trabalho; o job já chama de novo
--       até voltar 0. Assim cada chamada fica bem abaixo dos 8 s, também nos dias de disco lento.
--
-- ORDEM: independe do site. O site da D35 (suspensiva filtrada pelo prazo, exportação e histórico por chave)
-- funciona com e sem esta migração; com ela, a lista da suspensiva passa a usar o índice (5) pelo prazo.
-- Aplicar FORA da rodada diária do painel (a de 08/10 gravou entre ~14h30 e 14h40 UTC; conferir antes que não há
-- execução com status 'gravando'): cada `create index` trava a escrita na sua tabela enquanto cria (segundos);
-- as leituras do site seguem. Idempotente. Pré-requisitos: oport_9, oport_10, oport_14, oport_31 e oport_34.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- (1) e (2) painel_resumo: plano por chamada e uma leitura só de painel_convenio
-- -----------------------------------------------------------------------------
-- `c` tem uma linha por combinação das colunas que as somas usam, com a contagem e as cinco somas de valor. Cada
-- linha de saída é a mesma de antes: `count(*)` vira a soma das contagens e `sum(x)` a soma das somas. As linhas
-- sem GROUP BY (e o "total" dos grouping sets) saem mesmo sem convênio, com n = 0 e valor nulo, como antes — por
-- isso o `coalesce(sum(c.qtd), 0)`.
create or replace function public.painel_resumo(
  p_uf            text default null,
  p_orgao         text default null,
  p_ibge          text default null,
  p_agente        text default null,
  p_assinado_de   date default null,
  p_assinado_ate  date default null,
  p_movimento     text default null
)
returns table (visao text, chave text, n integer, valor numeric)
language plpgsql stable
set search_path to 'public'
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
declare
  v_ex bigint;
begin
  select e.id into v_ex from public.painel_ultima_execucao() e;

  return query
  with c as materialized (
    select pc.suspensiva_faixa, pc.em_suspensiva,
           pc.exige_titularidade, pc.exige_projeto, pc.exige_licenca, pc.exige_sustentabilidade, pc.exige_termo_referencia,
           pc.nunca_desembolsado, pc.grupo_suspensiva, pc.etapa_licitacao, pc.aceite_parado,
           pc.vigencia_faixa, pc.motivo_aditivo,
           pc.contas_lado, pc.contas_atrasada, pc.contas_parada_1ano, pc.tce,
           pc.saldo_faixa, pc.saldo_parado, pc.nunca_pagou,
           pc.financeiro_sem_fisico, (pc.pct_fisico = 0) fisico_zero, (pc.dias_sem_movimentacao > 365) parado_1ano,
           count(*) qtd,
           sum(pc.repasse) repasse,
           sum(greatest(coalesce(pc.repasse, 0) - coalesce(pc.desembolsado, 0), 0)) a_liberar,
           sum(pc.saldo_conta) saldo_conta,
           sum(pc.rendimento_implicito) rendimento,
           sum(pc.desembolsado) desembolsado
      from public.painel_convenio pc
     where pc.execucao_id = v_ex
       and (p_uf is null or pc.uf = p_uf)
       and (p_orgao is null or pc.orgao_sup = p_orgao)
       and (p_ibge is null or pc.cod_ibge = p_ibge)
       and (p_agente is null or pc.tipo_agente = p_agente)
       and (p_assinado_de is null or pc.dt_assinatura >= p_assinado_de)
       and (p_assinado_ate is null or pc.dt_assinatura <= p_assinado_ate)
       and (p_movimento is null
            or (p_movimento = 'parado_1ano' and pc.dias_sem_movimentacao > 365)
            or (p_movimento = 'recente_30d' and pc.dias_sem_movimentacao <= 30))
     group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23
  )
  select 'suspensiva', coalesce(c.suspensiva_faixa, 'total'), coalesce(sum(c.qtd), 0)::int, sum(c.repasse)
    from c where c.em_suspensiva group by grouping sets ((c.suspensiva_faixa), ())
  union all
  select 'suspensiva', e.chave, coalesce(sum(c.qtd), 0)::int, sum(c.repasse)
    from c cross join lateral (values
      ('exige_titularidade', c.exige_titularidade), ('exige_projeto', c.exige_projeto),
      ('exige_licenca', c.exige_licenca), ('exige_sustentabilidade', c.exige_sustentabilidade),
      ('exige_termo_referencia', c.exige_termo_referencia)) e(chave, marca)
   where c.em_suspensiva and e.marca
   group by e.chave
  union all
  select 'nunca', 'total', coalesce(sum(c.qtd), 0)::int, sum(c.repasse) from c where c.nunca_desembolsado
  union all
  select 'nunca', 'grupo_' || c.grupo_suspensiva, coalesce(sum(c.qtd), 0)::int, sum(c.repasse)
    from c where c.nunca_desembolsado group by c.grupo_suspensiva
  union all
  select 'nunca', 'etapa_' || c.etapa_licitacao, coalesce(sum(c.qtd), 0)::int, sum(c.repasse)
    from c where c.nunca_desembolsado and c.etapa_licitacao is not null group by c.etapa_licitacao
  union all
  select 'nunca', 'aceite_parado', coalesce(sum(c.qtd), 0)::int, sum(c.repasse) from c where c.aceite_parado
  union all
  select 'vigencia', coalesce(c.vigencia_faixa, 'total'), coalesce(sum(c.qtd), 0)::int, sum(c.a_liberar)
    from c where c.vigencia_faixa is not null group by grouping sets ((c.vigencia_faixa), ())
  union all
  select 'vigencia', 'motivo_' || c.motivo_aditivo, coalesce(sum(c.qtd), 0)::int, sum(c.a_liberar)
    from c where c.vigencia_faixa is not null and c.motivo_aditivo is not null group by c.motivo_aditivo
  union all
  select 'contas', c.contas_lado, coalesce(sum(c.qtd), 0)::int, sum(c.repasse)
    from c where c.contas_lado is not null group by c.contas_lado
  union all
  select 'contas', 'atrasada', coalesce(sum(c.qtd), 0)::int, sum(c.repasse) from c where c.contas_atrasada
  union all
  select 'contas', c.contas_lado || '_1ano', coalesce(sum(c.qtd), 0)::int, sum(c.repasse)
    from c where c.contas_parada_1ano group by c.contas_lado
  union all
  select 'contas', 'tce', coalesce(sum(c.qtd), 0)::int, sum(c.repasse) from c where c.tce
  union all
  select 'saldo', c.saldo_faixa, coalesce(sum(c.qtd), 0)::int, sum(c.saldo_conta)
    from c where c.saldo_faixa is not null group by c.saldo_faixa
  union all
  select 'saldo', 'parado', coalesce(sum(c.qtd), 0)::int, sum(c.saldo_conta) from c where c.saldo_parado
  union all
  select 'saldo', 'parado_nunca_pagou', coalesce(sum(c.qtd), 0)::int, sum(c.saldo_conta) from c where c.saldo_parado and c.nunca_pagou
  union all
  select 'saldo', 'rendimento_parado', coalesce(sum(c.qtd), 0)::int, sum(c.rendimento) from c where c.saldo_parado
  union all
  select 'fisico', 'total', coalesce(sum(c.qtd), 0)::int, sum(c.desembolsado) from c where c.financeiro_sem_fisico
  union all
  select 'fisico', 'fisico_zero', coalesce(sum(c.qtd), 0)::int, sum(c.desembolsado) from c where c.financeiro_sem_fisico and c.fisico_zero
  union all
  select 'fisico', 'parado_1ano', coalesce(sum(c.qtd), 0)::int, sum(c.desembolsado) from c where c.financeiro_sem_fisico and c.parado_1ano
  union all
  select 'municipios', m.n_sinais::text, count(*)::int, null::numeric
    from public.painel_municipio m
   where m.execucao_id = v_ex and (p_uf is null or m.uf = p_uf) and (p_ibge is null or m.cod_ibge = p_ibge)
   group by m.n_sinais;
end $function$;


-- -----------------------------------------------------------------------------
-- (1) e (4) Buscas: plano por chamada; a contagem guarda só a chave
-- -----------------------------------------------------------------------------
-- `f` faz o filtro, a contagem e a ordem sobre colunas estreitas (ctid e as chaves de ordem); só as linhas da
-- página voltam à tabela pelo ctid (mesmo instantâneo da consulta, então é a mesma versão da linha). A ordem final
-- repete a de `f`, que é total: `nr_convenio` e `id_proposta` são únicos por execução.
create or replace function public.painel_busca_instrumentos(
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
language plpgsql stable
set search_path to 'public'
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
declare
  v_ex      bigint;
  -- '%termo%' de cada termo; nulo quando não há termo (como `p_termos is null or cardinality(p_termos) = 0`)
  v_padroes text[];
begin
  select e.id into v_ex from public.painel_ultima_execucao() e;
  if p_termos is not null and cardinality(p_termos) > 0 then
    v_padroes := array(select '%' || t || '%' from unnest(p_termos) t);
  end if;

  return query
  with f as (
    select i.ctid tid,
           (p_termos is not null and cardinality(p_termos) = 1 and (i.nr_convenio = p_termos[1] or i.nr_proposta = p_termos[1])) exato,
           i.vivo, i.dt_assinatura, i.nr_convenio,
           count(*) over () total
      from public.painel_instrumento i
     where i.execucao_id = v_ex
       and (v_padroes is null or i.texto_busca like all (v_padroes))
       and (p_uf is null or i.uf = p_uf)
       and (p_ibge is null or i.cod_ibge = p_ibge)
       and (p_tema is null or p_tema = any (i.temas))
       and (p_situacoes is null or cardinality(p_situacoes) = 0 or i.situacao = any (p_situacoes))
       and (p_orgao is null or i.orgao_sup = p_orgao)
     order by 2 desc, i.vivo desc, i.dt_assinatura desc nulls last, i.nr_convenio
     limit greatest(1, least(coalesce(p_limite, 30), 100))
    offset greatest(0, least(coalesce(p_offset, 0), 10000))
  )
  select i.nr_convenio, i.nr_proposta, i.modalidade, i.situacao, i.vivo, i.detalhe, i.uf, i.cod_ibge, i.municipio,
         i.proponente, i.orgao_sup, i.programa, i.temas, i.objeto, i.vl_repasse, i.vl_desembolsado, i.dt_assinatura,
         i.dt_fim_vigencia, i.cnpj, f.total
    from f join public.painel_instrumento i on i.ctid = f.tid
   order by f.exato desc, f.vivo desc, f.dt_assinatura desc nulls last, f.nr_convenio;
end $function$;

create or replace function public.painel_busca_propostas(
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
language plpgsql stable
set search_path to 'public'
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
declare
  v_ex      bigint;
  v_padroes text[];
begin
  select e.id into v_ex from public.painel_ultima_execucao() e;
  if p_termos is not null and cardinality(p_termos) > 0 then
    v_padroes := array(select '%' || t || '%' from unnest(p_termos) t);
  end if;

  return query
  with f as (
    select p.ctid tid,
           (p_termos is not null and cardinality(p_termos) = 1 and (p.nr_proposta = p_termos[1] or p.id_proposta = p_termos[1])) exato,
           p.dt_envio, p.id_proposta,
           count(*) over () total
      from public.painel_proposta p
     where p.execucao_id = v_ex
       and (v_padroes is null or coalesce(p.texto_busca, '') like all (v_padroes))
       and (p_uf is null or p.uf = p_uf)
       and (p_ibge is null or p.cod_ibge = p_ibge)
       and (p_tema is null or p_tema = any (p.temas))
       and (p_desfechos is null or cardinality(p_desfechos) = 0 or p.desfecho = any (p_desfechos))
       and (p_orgao is null or p.orgao_sup = p_orgao)
     order by 2 desc, p.dt_envio desc nulls last, p.id_proposta
     limit greatest(1, least(coalesce(p_limite, 30), 100))
    offset greatest(0, least(coalesce(p_offset, 0), 10000))
  )
  select p.id_proposta, p.nr_proposta, p.uf, p.cod_ibge, p.municipio, p.proponente, p.orgao_sup, p.programa, p.temas,
         p.objeto, p.valor_repasse, p.dt_envio, p.ano_envio, p.desfecho, p.situacao, p.nr_convenio, p.cnpj, f.total
    from f join public.painel_proposta p on p.ctid = f.tid
   order by f.exato desc, f.dt_envio desc nulls last, f.id_proposta;
end $function$;


-- -----------------------------------------------------------------------------
-- (3) painel_por_orgao: só o plano por chamada (o corpo é o da oport_10)
-- -----------------------------------------------------------------------------
alter function public.painel_por_orgao(text, text, integer, text, date, date, text) set plan_cache_mode to 'force_custom_plan';


-- -----------------------------------------------------------------------------
-- (5) Índices
-- -----------------------------------------------------------------------------
-- Listas do painel sem UF (`painel.server.ts`, `naVisao`): cada uma pede 50 linhas de um subconjunto, na ordem da
-- tela, e sem índice o Brasil varria os 83 MB de painel_convenio (0,8 s com o banco aquecido; 6,6 a 7,2 s em
-- produção). Parciais e na ordem da tela: devolvem as 50 primeiras sem varrer. Juntos, ~2 MB.
-- O PostgREST manda `em_suspensiva = true` como parâmetro; o índice parcial entra porque o plano é feito com o
-- valor (o plano genérico, que não o usaria, custa mais e não é escolhido). Conferir com as consultas do relatório.

-- Suspensiva (visão padrão): a vencer (prazo >= referência, crescente) e vencidos (prazo < referência, decrescente).
create index if not exists painel_convenio_susp_prazo_idx
  on public.painel_convenio (execucao_id, suspensiva_prazo) where em_suspensiva;
-- Nunca desembolsado: aceite parado primeiro, depois aceite e assinatura mais antigos.
create index if not exists painel_convenio_nunca_idx
  on public.painel_convenio (execucao_id, aceite_parado desc, dt_aceite, dt_assinatura) where nunca_desembolsado;
-- Prestação de contas, lado padrão "concedente": há mais dias com o concedente primeiro.
create index if not exists painel_convenio_contas_concedente_idx
  on public.painel_convenio (execucao_id, dias_com_concedente desc) where contas_lado = 'concedente';
-- Prestação de contas atrasada: as mais recentes primeiro.
create index if not exists painel_convenio_contas_atrasada_idx
  on public.painel_convenio (execucao_id, dias_apos_limite) where contas_atrasada;
-- Prestação de contas, lados "negativo" e "tce": maior repasse primeiro.
create index if not exists painel_convenio_contas_negativo_idx
  on public.painel_convenio (execucao_id, repasse desc) where contas_lado = 'negativo';
create index if not exists painel_convenio_tce_idx
  on public.painel_convenio (execucao_id, repasse desc) where tce;
-- Saldo parado: maior saldo primeiro.
create index if not exists painel_convenio_saldo_idx
  on public.painel_convenio (execucao_id, saldo_conta desc) where saldo_parado;
-- Vigência: menos dias para o fim primeiro.
create index if not exists painel_convenio_vigencia_idx
  on public.painel_convenio (execucao_id, dias_para_fim) where vigencia_faixa is not null;
-- Financeiro sem físico: maior desembolso primeiro.
create index if not exists painel_convenio_fisico_idx
  on public.painel_convenio (execucao_id, desembolsado desc) where financeiro_sem_fisico;

-- Histórico das suspensivas (padrões e checklist: PB por número; laudo: PB, órgão e número). Antes percorria o
-- índice de número inteiro e lia o heap de cada instrumento (3,8 s na 1ª página; 7,0 s no laudo em produção).
-- ~40 mil das 79 mil linhas, ~2 MB.
create index if not exists painel_instrumento_suspensiva_hist_idx
  on public.painel_instrumento (execucao_id, uf, orgao_sup, nr_convenio)
  where dt_suspensiva is not null or dt_retirada_suspensiva is not null;

-- Funil do Brasil e da UF (`pagina-brasil.server.ts`, `pagina-uf.server.ts`): só as linhas de total, sem
-- programa nem órgão (224 de 34 mil). Antes, varredura dos 15 MB (1,7 s com o banco frio).
create index if not exists painel_programa_desfecho_total_idx
  on public.painel_programa_desfecho (execucao_id, uf) where cod_programa is null and orgao_sup is null;

-- Municípios da UF (`painel_municipios`, no seletor do painel e da busca): leitura só do índice, sem ir ao heap
-- (SP levava 5,1 s, quase tudo leitura aleatória do heap). Vale depois do autovacuum que segue a rodada diária
-- (marca as páginas como visíveis). Os `*_uf_idx` atuais são prefixo destes e podem sair numa limpeza futura.
create index if not exists painel_convenio_uf_ibge_idx
  on public.painel_convenio (execucao_id, uf, cod_ibge) include (municipio);
create index if not exists painel_proposta_uf_ibge_idx
  on public.painel_proposta (execucao_id, uf, cod_ibge) include (municipio);


-- -----------------------------------------------------------------------------
-- (6) painel_limpar: lotes de até mil linhas e ~3 s de trabalho por chamada
-- -----------------------------------------------------------------------------
-- Mesmo corpo da oport_34 (mesma lista de tabelas), com duas mudanças: cada tabela é apagada em lotes de até mil
-- linhas, e a chamada para no primeiro lote que termina depois de 3 s de trabalho, devolvendo o que já apagou
-- (o job chama de novo até voltar 0; ver `limpar_em_lotes` em radar_propostas/publica.py). Só para depois de ter
-- apagado alguma linha: 0 continua querendo dizer "nada mais a apagar". Os lotes seguintes da mesma tabela
-- revisitam as linhas já apagadas nesta chamada, mas essas páginas acabaram de ser lidas e estão no cache.
create or replace function public.painel_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  ultima        public.painel_execucao;
  manter        bigint[];
  apagar        bigint[];
  sem_conclusao bigint[];
  resta         integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total         integer := 0;
  n             integer;
  lote          integer;
  t             text;
  inicio        timestamptz := clock_timestamp();
  orcamento     constant interval := interval '3 seconds';
begin
  select * into ultima from public.painel_ultima_execucao();
  manter := array_remove(array[ultima.id, p_manter], null);
  select coalesce(array_agg(id), '{}'), coalesce(array_agg(id) filter (where status <> 'concluida'), '{}')
    into apagar, sem_conclusao
    from public.painel_execucao where id <> all (manter);

  if cardinality(apagar) > 0 then
    <<tabelas>>
    foreach t in array array['painel_convenio', 'painel_municipio', 'painel_aditivo_motivo', 'painel_etapa_tempo',
                             'painel_etapa_ano', 'painel_programa_desfecho', 'painel_proposta',
                             'painel_instrumento', 'painel_instrumento_evento', 'painel_instrumento_emenda',
                             'painel_fornecedor', 'painel_fornecedor_convenio', 'painel_contrato',
                             'painel_fornecedor_municipio', 'painel_territorio'] loop
      loop
        lote := least(resta, 1000);
        execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
          using apagar, lote;
        get diagnostics n = row_count;
        total := total + n;
        resta := resta - n;
        exit tabelas when resta <= 0 or (total > 0 and clock_timestamp() - inicio > orcamento);
        -- menos linhas que o lote: esta tabela acabou
        exit when n < lote;
      end loop;
    end loop;
  end if;

  if resta > 0 and not (total > 0 and clock_timestamp() - inicio > orcamento) then
    delete from public.painel_mudanca where ctid = any (array(
      select ctid from public.painel_mudanca
       where execucao_id = any (sem_conclusao)
          or dado_ate < ultima.dado_ate - interval '60 days'
       limit resta));
    get diagnostics n = row_count;
    total := total + n;
  end if;
  return total;
end $function$;


-- -----------------------------------------------------------------------------
-- Permissões: as mesmas de antes (só a chave de serviço) e recarga do esquema da API
-- -----------------------------------------------------------------------------
revoke execute on function public.painel_resumo(text, text, text, text, date, date, text)                              from public, anon, authenticated;
revoke execute on function public.painel_busca_instrumentos(text[], text, text, text, text[], text, integer, integer) from public, anon, authenticated;
revoke execute on function public.painel_busca_propostas(text[], text, text, text, text[], text, integer, integer)    from public, anon, authenticated;
revoke execute on function public.painel_por_orgao(text, text, integer, text, date, date, text)                       from public, anon, authenticated;
revoke execute on function public.painel_limpar(bigint, integer)                                                      from public, anon, authenticated;
grant  execute on function public.painel_resumo(text, text, text, text, date, date, text)                              to service_role;
grant  execute on function public.painel_busca_instrumentos(text[], text, text, text, text[], text, integer, integer) to service_role;
grant  execute on function public.painel_busca_propostas(text[], text, text, text, text[], text, integer, integer)    to service_role;
grant  execute on function public.painel_por_orgao(text, text, integer, text, date, date, text)                       to service_role;
grant  execute on function public.painel_limpar(bigint, integer)                                                      to service_role;

notify pgrst, 'reload schema';
