-- =============================================================================
-- oport_29 — Análise do plano de trabalho no laudo do Pix (07/10/2026)
--
-- `pix_laudo_plano` ganha `analise_pt` (jsonb), montada pelo job do Pix (pix_fundo/laudo.py,
-- regras 2026-10-07.1) a partir de `planos-trabalho-analises-especiais`:
--
--   · `analises`: até 4 análises do plano de trabalho, as mais recentes primeiro — órgão,
--     situação, parecer, data, valor reprovado e um trecho do texto do parecer (sem CPF);
--     `fora_da_area` marca o parecer que diz que o plano não é da área do órgão;
--   · `impedimento` (só no plano impedido): o motivo como a API escreve, o motivo agrupado
--     (o mesmo do painel: falta_analise, falta_complementacao…), o gêmeo do mesmo exercício
--     (a reapresentação no ciclo seguinte) e a reindicação no exercício seguinte (o mesmo
--     autor indicou o mesmo ente de novo; LC 210/2024, art. 12).
--
-- Plano aprovado e ciente fica com `analise_pt` nulo: a coleta só lê a análise dos planos de
-- trabalho não aprovados e dos planos impedidos.
--
-- Aplicar ANTES da rodada do pix-fundo.yml com o código novo: o job grava a coluna.
-- Idempotente. Os grants da tabela (oport_23: tudo para service_role, nada para anon e
-- authenticated) valem para a coluna nova; o `pix_limpar` apaga a linha inteira.
-- =============================================================================

alter table public.pix_laudo_plano add column if not exists analise_pt jsonb;

comment on column public.pix_laudo_plano.analise_pt is
  'Análise do plano de trabalho e, no impedido, o porquê (motivo agrupado, gêmeo, reindicação). Job pix_fundo, regras 2026-10-07.1.';
