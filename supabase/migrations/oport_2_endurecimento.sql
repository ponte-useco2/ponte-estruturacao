-- =============================================================================
-- oport_2 — Endurecimento de permissões das tabelas de acesso
--
-- MUDA COMPORTAMENTO. Aplicar com atenção e testar o login logo depois.
--
-- O que corrige:
--
-- 1. `oport_registrar_solicitacao` pode ser chamada por qualquer pessoa pela API
--    pública (/rest/v1/rpc), e não confere se quem chama é dono da linha. O
--    ataque: entrar com qualquer conta Google, ficar pendente, e chamar a função
--    com o próprio id e um e-mail falso. O painel de administração passa a
--    mostrar o pedido com o e-mail de outra pessoa, e a aprovação pode ser dada
--    por engano. Não há escalada direta: a função nunca muda o status.
--    O linter do Supabase aponta o mesmo (0028 e 0029).
--
-- 2. `anon` e `authenticated` têm todos os privilégios de tabela em oport_acesso
--    e oport_evento. A RLS impede ler linha alheia, mas as tabelas aparecem no
--    esquema GraphQL para qualquer um (linter 0026 e 0027), e TRUNCATE não passa
--    pela RLS.
--
-- Por que não quebra o app: em 11/09/2026, TODO acesso do código a essas tabelas
-- e a essa função passa pela service role (`clienteServidor`) — conferido em
-- lib/supabase-auth.ts, app/oportunidades/eventos.ts e app/oportunidades/admin/.
-- A service role não é afetada, e ganha a permissão por escrito abaixo para não
-- depender de herança.
--
-- Como verificar depois de aplicar: sair e entrar de novo na /oportunidades.
-- Se a página abrir, o login continua funcionando.
--
-- Ordem: 1 → 2 → 3.
-- =============================================================================

revoke execute on function public.oport_registrar_solicitacao(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.oport_registrar_solicitacao(uuid, text, text, text)
  to service_role;

revoke all on table public.oport_acesso, public.oport_evento from anon, authenticated;
grant all on table public.oport_acesso, public.oport_evento to service_role;
grant usage, select on sequence public.oport_evento_id_seq to service_role;

-- A política "le a propria linha" continua valendo para o cliente da sessão.
-- Nenhum código a usa hoje; mantida porque é inofensiva e prevista.
grant select on table public.oport_acesso to authenticated;
