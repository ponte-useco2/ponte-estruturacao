-- =============================================================================
-- seguranca_1 — Fecha o acesso público de objetos antigos (alertas do Security Advisor, 15/09/2026)
--
-- O schema public nasce com privilégios padrão abertos: toda tabela criada por
-- `postgres` recebe ALL para anon e authenticated, e toda função recebe EXECUTE.
-- As migrations oport_*, radar_* e painel_* revogam isso uma a uma; os objetos
-- anteriores a elas nunca foram corrigidos. O site grava nessas tabelas pela chave
-- de serviço (web/src/lib/supabase.ts não tem fallback para anon), então nada do
-- que está no ar usa os acessos removidos aqui.
--
-- NÃO mexe nas oport_*: o acesso de authenticated a elas é intencional e filtrado
-- por RLS (auth.uid() e oport_aprovado()).
--
-- Idempotente. Rodar como `postgres` no SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Cupons do Centelha. Os códigos estão no repositório público e as três
-- funções SECURITY DEFINER eram executáveis sem login: dava para consultar a linha
-- inteira, esgotar cupons e "devolver" usos sem ter consumido. Nenhum código atual
-- chama as funções (a rota /centelha-3-pb é um redirecionamento). Os cupons ficam
-- inativos e o histórico de usos é preservado.
-- -----------------------------------------------------------------------------
revoke execute on function public.consultar_cupom_centelha(text) from public, anon, authenticated;
revoke execute on function public.consumir_cupom_centelha(text)  from public, anon, authenticated;
revoke execute on function public.devolver_cupom_centelha(text)  from public, anon, authenticated;
grant  execute on function public.consultar_cupom_centelha(text) to service_role;
grant  execute on function public.consumir_cupom_centelha(text)  to service_role;
grant  execute on function public.devolver_cupom_centelha(text)  to service_role;

revoke all on table public.centelha_cupons from anon, authenticated;
update public.centelha_cupons set ativo = false, updated_at = now() where ativo;

-- -----------------------------------------------------------------------------
-- 2 · Formulários. `leads` e `finep_subvencao_forms` aceitavam INSERT de qualquer
-- um com a chave pública (política `with check (true)`), herança de uma landing
-- antiga que não está mais no ar. O site atual grava pelo servidor, com a chave de
-- serviço, que ignora RLS.
-- -----------------------------------------------------------------------------
revoke all on table public.leads from anon, authenticated;
drop policy if exists "Permitir inserções anonimas em leads" on public.leads;

revoke all on table public.finep_subvencao_forms from anon, authenticated;
drop policy if exists "Permitir inserts anônimos para finep_subvencao_forms" on public.finep_subvencao_forms;

-- Sem política e com RLS ligada: nenhuma linha saía, mas o esquema aparecia.
revoke all on table public.perfil_institucional from anon, authenticated;

-- A chave de serviço continua com acesso total nas quatro tabelas.
grant all on table public.leads, public.finep_subvencao_forms, public.perfil_institucional, public.centelha_cupons
  to service_role;

-- -----------------------------------------------------------------------------
-- 3 · Correção de raiz: objeto novo criado por `postgres` em public deixa de nascer
-- aberto para anon e authenticated. Toda migration passa a dar grant explícito — o
-- que oport_*, radar_* e painel_* já fazem. Não altera objetos existentes.
-- (Os padrões do supabase_admin não podem ser mudados por este papel.)
-- -----------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
-- O EXECUTE para PUBLIC em função nova é padrão GLOBAL do Postgres: a revogação
-- por schema não o remove (o Postgres soma padrões globais e por schema). Sem esta
-- linha, anon continuaria executando função nova via PUBLIC.
alter default privileges for role postgres revoke execute on functions from public;
