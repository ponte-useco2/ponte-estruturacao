-- =============================================================================
-- oport_50 — As mudanças do painel com filtro em cada coluna (onda 15, fase 3, F3.5a, 28/10/2026)
--
-- A visão "Mudanças" mostrava as 100 primeiras de `painel_mudancas` (v1, oport_11), com o tipo como único filtro: a
-- tabela não podia filtrar proponente, programa, órgão nem faixa de valor sem mentir na contagem. Aqui:
--
--   · painel_mudancas_janela(p_dias, p_uf, p_ibge, p_agente): a janela inteira, só de execuções concluídas, com a
--     mesma regra de dias da v1 (1 = o dado da última execução concluída; 7, 30 ou 60 = os últimos dias de dado). Sem
--     tipo e sem limite: o tipo, o filtro de cada coluna, a ordem, a faixa e a contagem vão pelo PostgREST, sobre o
--     resultado da função. Medido em 28/10/2026: 12.364 linhas na janela de 30 dias do Brasil; filtro de texto sem
--     acento + contagem + 100 primeiras, 293 ms;
--   · busca_proponente, busca_municipio, busca_programa e busca_objeto (painel_mudanca): a versão sem acento das
--     colunas de texto, como as da oport_46 para painel_convenio (mesmos nomes, outro tipo de linha).
--
-- A v1 continua: o e-mail diário e a ficha do município a usam. Só `service_role` executa. Nada é gravado.
--
-- Idempotente. Pré-requisitos: oport_11 (painel_mudanca) e oport_46 (oport_sem_acento).
-- =============================================================================

create or replace function public.painel_mudancas_janela(
  p_dias integer default 1,
  p_uf text default null,
  p_ibge text default null,
  p_agente text default null
)
returns setof public.painel_mudanca
language sql stable
set search_path to 'public'
as $$
  select m.*
    from public.painel_mudanca m
    join public.painel_execucao e on e.id = m.execucao_id and e.status = 'concluida'
   cross join (select dado_ate from public.painel_ultima_execucao()) u
   where case when coalesce(p_dias, 1) <= 1 then m.dado_ate = u.dado_ate
              else m.dado_ate > u.dado_ate - make_interval(days => least(p_dias, 60)) end
     and (p_uf is null or m.uf = p_uf)
     and (p_ibge is null or m.cod_ibge = p_ibge)
     and (p_agente is null or m.tipo_agente = p_agente)
$$;

create or replace function public.busca_proponente(public.painel_mudanca)
returns text language sql immutable parallel safe set search_path to ''
as $$ select public.oport_sem_acento($1.proponente) $$;

create or replace function public.busca_municipio(public.painel_mudanca)
returns text language sql immutable parallel safe set search_path to ''
as $$ select public.oport_sem_acento($1.municipio) $$;

create or replace function public.busca_programa(public.painel_mudanca)
returns text language sql immutable parallel safe set search_path to ''
as $$ select public.oport_sem_acento($1.programa) $$;

create or replace function public.busca_objeto(public.painel_mudanca)
returns text language sql immutable parallel safe set search_path to ''
as $$ select public.oport_sem_acento($1.objeto) $$;

revoke execute on function public.painel_mudancas_janela(integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.busca_proponente(public.painel_mudanca) from public, anon, authenticated;
revoke execute on function public.busca_municipio(public.painel_mudanca) from public, anon, authenticated;
revoke execute on function public.busca_programa(public.painel_mudanca) from public, anon, authenticated;
revoke execute on function public.busca_objeto(public.painel_mudanca) from public, anon, authenticated;
grant execute on function public.painel_mudancas_janela(integer, text, text, text) to service_role;
grant execute on function public.busca_proponente(public.painel_mudanca) to service_role;
grant execute on function public.busca_municipio(public.painel_mudanca) to service_role;
grant execute on function public.busca_programa(public.painel_mudanca) to service_role;
grant execute on function public.busca_objeto(public.painel_mudanca) to service_role;

-- O PostgREST relê o esquema para enxergar a função e os campos calculados novos.
notify pgrst, 'reload schema';
