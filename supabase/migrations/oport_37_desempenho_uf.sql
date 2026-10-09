-- =============================================================================
-- oport_37 — Desempenho da UF: plano por chamada e leitura só do índice nas funções da UF (onda 7, B, 09/10/2026)
--
-- A auditoria R2 (09/10, `ux-onda6/R2-desempenho-final.md`, §2.3, §3.3 e §5.5) mostrou o que a oport_35 deixou de
-- fora. Medições de antes e a prova de equivalência em `ux-onda7/B-oport37.md`.
--
--   · painel_territorio_proponente / painel_territorio_municipio (página `/mapa/uf/[sigla]` e busca unificada):
--     somam na hora a fatia da UF em `painel_instrumento`, indo ao heap linha a linha (Index Scan em
--     `painel_instrumento_uf_idx`). A tabela tem ~2 kB por linha e a UF não segue a ordem física (correlação 0,06):
--     SP toca 5.520 blocos (43 MB) para 7.861 linhas; MG, 4.770; PB, 4.887. Frio, isso foi 4,8 s em SP e 2,5 s em
--     MG; em produção, média de 1,6 s e máximo de 2,2 s. E o site chama os proponentes de SP 3 vezes (páginas de mil).
--   · painel_municipios(uf) (seletor do painel e da busca): `language sql` com a execução num CTE juntado. O plano
--     genérico não conhece a execução e o índice de cobertura da oport_35 entra só por `uf = $1`: percorre os dois
--     índices inteiros (3.212 blocos em qualquer UF; 1,85 s frio em SP).
--
-- Esta migração:
--
--   (1) As três funções passam de `language sql` a plpgsql com `plan_cache_mode = force_custom_plan`, como na
--       oport_35. `painel_municipios` lê a execução antes (`v_ex`), e o filtro vira `execucao_id = 43 and uf = 'SP'`
--       dentro do índice: 243 blocos em SP (medido com o corpo novo, 14 ms). Mesmas assinaturas, colunas, nomes,
--       padrão de `p_tipo`, `stable`, `security invoker` e `search_path`: o site não muda.
--   (2) Um índice de cobertura em `painel_instrumento` com as colunas que as duas funções de território usam. Elas
--       passam a ler só o índice (Index Only Scan), sem ir ao heap: ~200 blocos em SP em vez de 5.520. A chave
--       termina em `dt_assinatura desc nulls last`, a ordem do "instrumento mais recente": os proponentes saem já
--       ordenados para o `array_agg`, sem ordenação.
--       · Não dá para ser parcial: as funções filtram só `cnpj is not null` e `cod_ibge is not null`, e as duas
--         colunas não têm nulo hoje. Um predicado que tirasse linhas mudaria o resultado de uma das funções.
--       · Tamanho: ~140 bytes por linha (medido em SP, MG e PB), ~12 MB recém-criado (79,2 mil linhas). Com a
--         troca diária da execução (a nova é inserida em ordem aleatória antes de a velha sair), deve estabilizar
--         entre 30 e 40 MB de arquivo, ~19 MB vivos, como os índices da oport_35 (o de propostas tem 19 MB para
--         ~10 MB vivos). A fatia lida por visita é de 1 a 2,3 MB (MG, SP, PB).
--       · Custo na rodada: mais uma entrada de índice para cada uma das ~79 mil linhas gravadas por dia, em 79
--         lotes de mil (~1 a 1,5 s de CPU no total, de 15 a 35 MB a mais de WAL), e mais um índice para o
--         autovacuum que segue a rodada. A limpeza (`painel_limpar`) não muda.
--       · Vale com as páginas marcadas como visíveis, o que o autovacuum faz minutos depois da rodada (em 09/10:
--         rodada às 11h58 UTC, autovacuum às 12h00). Até lá, a leitura volta a passar pelo heap, como hoje.
--
-- ORDEM: independe do site e do job. Aplicar FORA da rodada diária do painel (11h30 às 12h UTC; conferir antes que
-- não há execução com status 'gravando'): o `create index` lê a tabela inteira (162 MB) e trava a escrita nela
-- enquanto cria (de segundos a ~20 s com o disco frio); as leituras do site seguem. Idempotente. Pré-requisitos:
-- oport_9, oport_34 e oport_35.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- (2) Índice de cobertura das funções de território da UF
-- -----------------------------------------------------------------------------
-- Chave: a fatia (execução e UF), o proponente e a data, na ordem do `array_agg` de painel_territorio_proponente.
-- Incluídas: o resto do que as duas funções leem. O `painel_instrumento_uf_idx` (execucao_id, uf) é prefixo deste,
-- mas é 4 vezes mais estreito e serve a outras leituras: fica.
create index if not exists painel_instrumento_territorio_idx
  on public.painel_instrumento (execucao_id, uf, cnpj, dt_assinatura desc nulls last)
  include (vl_global, vivo, situacao, tipo_agente, cod_ibge, municipio, proponente);


-- -----------------------------------------------------------------------------
-- (1) Funções de território da UF: plano por chamada (o corpo é o da oport_34)
-- -----------------------------------------------------------------------------
-- Por município de uma UF: instrumentos (todos e vivos), em execução e o valor em execução.
create or replace function public.painel_territorio_municipio(p_execucao bigint, p_uf text)
returns table (cod_ibge text, municipio text, instrumentos bigint, vivos bigint, em_execucao bigint, valor_execucao numeric,
               ultimo_ano integer)
language plpgsql stable security invoker
set search_path to 'public'
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
begin
  return query
  select i.cod_ibge, max(i.municipio), count(*), count(*) filter (where i.vivo),
         count(*) filter (where i.situacao = 'Em execução'),
         coalesce(sum(i.vl_global) filter (where i.situacao = 'Em execução'), 0),
         max(extract(year from i.dt_assinatura))::integer
    from public.painel_instrumento i
   where i.execucao_id = p_execucao and i.uf = p_uf and i.cod_ibge is not null
   group by i.cod_ibge;
end $function$;

-- Por proponente (CNPJ) de uma UF, de um tipo (`tipo_agente`) ou de todos (p_tipo nulo). O nome é o do
-- instrumento mais recente (a razão social muda com o tempo), como na página da entidade.
create or replace function public.painel_territorio_proponente(p_execucao bigint, p_uf text, p_tipo text default null)
returns table (cnpj text, proponente text, tipo_agente text, cod_ibge text, municipio text, instrumentos bigint,
               em_execucao bigint, valor numeric, ultimo_ano integer)
language plpgsql stable security invoker
set search_path to 'public'
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
begin
  return query
  select i.cnpj,
         (array_agg(i.proponente order by i.dt_assinatura desc nulls last))[1],
         (array_agg(i.tipo_agente order by i.dt_assinatura desc nulls last))[1],
         (array_agg(i.cod_ibge order by i.dt_assinatura desc nulls last))[1],
         (array_agg(i.municipio order by i.dt_assinatura desc nulls last))[1],
         count(*), count(*) filter (where i.situacao = 'Em execução'), coalesce(sum(i.vl_global), 0),
         max(extract(year from i.dt_assinatura))::integer
    from public.painel_instrumento i
   where i.execucao_id = p_execucao and i.uf = p_uf and i.cnpj is not null and (p_tipo is null or i.tipo_agente = p_tipo)
   group by i.cnpj;
end $function$;


-- -----------------------------------------------------------------------------
-- (1) painel_municipios: a execução lida antes e plano por chamada (o corpo é o da oport_9)
-- -----------------------------------------------------------------------------
-- Municípios de uma UF que têm convênio no painel ou proposta recente, para o seletor. Nome do arquivo de
-- propostas quando o município só aparece lá. Usa os índices de cobertura da oport_35 (só o índice, sem heap).
create or replace function public.painel_municipios(p_uf text)
returns table (cod_ibge text, municipio text, convenios integer, propostas integer)
language plpgsql stable security invoker
set search_path to 'public'
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
declare
  v_ex bigint;
begin
  select e.id into v_ex from public.painel_ultima_execucao() e;

  return query
  with c as (
    select c.cod_ibge, max(c.municipio) municipio, count(*)::int n
      from public.painel_convenio c
     where c.execucao_id = v_ex and c.uf = p_uf and c.cod_ibge is not null
     group by c.cod_ibge
  ),
  p as (
    select p.cod_ibge, max(p.municipio) municipio, count(*)::int n
      from public.painel_proposta p
     where p.execucao_id = v_ex and p.uf = p_uf and p.cod_ibge is not null
     group by p.cod_ibge
  )
  select coalesce(c.cod_ibge, p.cod_ibge), coalesce(c.municipio, p.municipio), coalesce(c.n, 0), coalesce(p.n, 0)
    from c full join p on p.cod_ibge = c.cod_ibge
   order by 2;
end $function$;


-- -----------------------------------------------------------------------------
-- Permissões: as mesmas de antes (só a chave de serviço) e recarga do esquema da API
-- -----------------------------------------------------------------------------
revoke all on function public.painel_territorio_municipio(bigint, text)        from public, anon, authenticated;
revoke all on function public.painel_territorio_proponente(bigint, text, text) from public, anon, authenticated;
revoke all on function public.painel_municipios(text)                          from public, anon, authenticated;
grant  execute on function public.painel_territorio_municipio(bigint, text)        to service_role;
grant  execute on function public.painel_territorio_proponente(bigint, text, text) to service_role;
grant  execute on function public.painel_municipios(text)                          to service_role;

notify pgrst, 'reload schema';
