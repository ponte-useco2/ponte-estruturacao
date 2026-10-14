-- =============================================================================
-- oport_40 — Três tipos novos de agente: ICT privada, hospital e fundação de apoio (contrato 2.2, 14/10/2026)
--
-- O catálogo v2 do radar passa ao contrato 2.2, com as fontes de saúde (PPSUS, Decit pelo CNPq, PDIL, EMBRAPII e
-- BNDES). Essas fontes separam a ICT pública da privada sem fins lucrativos (Lei 10.973/2004, art. 2º, V) e dão
-- papel próprio ao hospital e à fundação de apoio. O radar ganhou `ict_privada`, `hospital` e `fundacao_apoio` em
-- `ORGANIZATION_TYPES` (`funding_intelligence/models.py`), e o site em `TipoAgente` (`organizacao.ts`).
--
-- Os tipos têm de ser IGUAIS nos três lugares (radar, site e esta trava), porque a elegibilidade é comparação de
-- texto (ver o cabeçalho da oport_6). Sem esta migração, a entidade que se declarar hospital recebe erro da trava
-- `oport_organizacao_tipo_check` ao salvar.
--
-- Desde o contrato 2.2, `ict` quer dizer ICT pública. Nenhuma organização cadastrada usava `ict` em 14/10/2026
-- (conferido pelo MCP: 2 OSC, 2 municípios e 1 empresa), então ninguém muda de sentido.
--
-- Só troca a trava: não cria tabela, não muda dado e não mexe em permissão. É idempotente: rodar de novo recria a
-- mesma trava.
-- -----------------------------------------------------------------------------

alter table public.oport_organizacao drop constraint if exists oport_organizacao_tipo_check;

alter table public.oport_organizacao add constraint oport_organizacao_tipo_check check (tipo in (
  'empresa', 'startup', 'osc', 'ict', 'ict_privada', 'universidade', 'hospital', 'fundacao_apoio', 'municipio',
  'estado', 'consorcio_publico', 'cooperativa', 'pesquisador', 'pessoa_fisica', 'outros'
));

-- Conferência (só leitura): a trava nova com os quinze tipos.
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.oport_organizacao'::regclass and conname = 'oport_organizacao_tipo_check';
