-- =============================================================================
-- oport_64 — Índices que faltam no coletor do TRAMITA (auditoria das rotinas, 04/11/2026)
--
-- A cada processo detalhado, o coletor apaga as linhas antigas por `id_processo`. Em três tabelas não há índice nessa
-- coluna, e cada DELETE lê a tabela inteira. Medido no pg_stat_statements e no pg_stat_user_tables em 04/11/2026:
--   · vinculo: 3.818 varreduras, 310 milhões de linhas lidas, 94 ms por DELETE;
--   · decisao: 7.134 varreduras, 8,3 milhões de linhas lidas;
--   · sancao:  3.303 varreduras, 4,0 milhões de linhas lidas.
-- São leituras inúteis num banco com ~1 GB de RAM.
--
-- O `on delete cascade` destas tabelas também passa a usar o índice.
--
-- ORDEM: independente das outras, e sem mudança de código. Aplicar FORA de uma sessão do TRAMITA: o CREATE INDEX trava a
-- escrita nessas tabelas por poucos segundos. Aditiva e idempotente.
-- =============================================================================

create index if not exists ix_vinculo_processo on tramita.vinculo (id_processo);
create index if not exists ix_decisao_processo on tramita.decisao (id_processo, fonte);
create index if not exists ix_sancao_processo  on tramita.sancao (id_processo);
