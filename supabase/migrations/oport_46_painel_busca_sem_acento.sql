-- =============================================================================
-- oport_46 — O texto sem acento das listas do painel, para o filtro das tabelas (onda 15, fase 3, F3.2, 20/10/2026)
--
-- As seis visões de convênio do painel filtram e ordenam no banco (a tela lê os 100 primeiros de até 26 mil). O filtro
-- de texto da tabela é "contém as palavras, sem caixa e sem acento". A expressão regular com as vogais acentuadas
-- levava de 2 a 4 s nos 21 mil convênios de uma visão (medido em 20/10/2026); comparar com a versão sem acento da
-- coluna leva 70 ms. Estas funções dão essa versão, e o PostgREST as filtra como se fossem colunas ("campos
-- calculados": `?busca_objeto=like.%saude%`).
--
--   · oport_sem_acento(text): minúsculas e sem os acentos do português (translate; sem extensão);
--   · busca_proponente, busca_municipio, busca_programa, busca_objeto, busca_situacao (painel_convenio).
--
-- Nada é gravado: são funções de leitura, `immutable` e `parallel safe`. Só `service_role` executa (o site lê o painel
-- pela chave de serviço). Sem índice: o filtro roda depois do índice parcial de cada visão.
--
-- Idempotente. Pré-requisito: a tabela painel_convenio (oport_8).
-- =============================================================================

create or replace function public.oport_sem_acento(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
  select translate(lower(coalesce(p_texto, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
$$;

create or replace function public.busca_proponente(public.painel_convenio)
returns text language sql immutable parallel safe set search_path to ''
as $$ select public.oport_sem_acento($1.proponente) $$;

create or replace function public.busca_municipio(public.painel_convenio)
returns text language sql immutable parallel safe set search_path to ''
as $$ select public.oport_sem_acento($1.municipio) $$;

create or replace function public.busca_programa(public.painel_convenio)
returns text language sql immutable parallel safe set search_path to ''
as $$ select public.oport_sem_acento($1.programa) $$;

create or replace function public.busca_objeto(public.painel_convenio)
returns text language sql immutable parallel safe set search_path to ''
as $$ select public.oport_sem_acento($1.objeto) $$;

create or replace function public.busca_situacao(public.painel_convenio)
returns text language sql immutable parallel safe set search_path to ''
as $$ select public.oport_sem_acento($1.situacao) $$;

revoke execute on function public.oport_sem_acento(text) from public, anon, authenticated;
revoke execute on function public.busca_proponente(public.painel_convenio) from public, anon, authenticated;
revoke execute on function public.busca_municipio(public.painel_convenio) from public, anon, authenticated;
revoke execute on function public.busca_programa(public.painel_convenio) from public, anon, authenticated;
revoke execute on function public.busca_objeto(public.painel_convenio) from public, anon, authenticated;
revoke execute on function public.busca_situacao(public.painel_convenio) from public, anon, authenticated;
grant execute on function public.oport_sem_acento(text) to service_role;
grant execute on function public.busca_proponente(public.painel_convenio) to service_role;
grant execute on function public.busca_municipio(public.painel_convenio) to service_role;
grant execute on function public.busca_programa(public.painel_convenio) to service_role;
grant execute on function public.busca_objeto(public.painel_convenio) to service_role;
grant execute on function public.busca_situacao(public.painel_convenio) to service_role;

-- O PostgREST relê o esquema para enxergar os campos calculados novos.
notify pgrst, 'reload schema';
