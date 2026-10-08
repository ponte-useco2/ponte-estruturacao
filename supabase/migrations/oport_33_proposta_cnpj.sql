-- =============================================================================
-- oport_33 — Índice das propostas por CNPJ (08/10/2026)
--
-- A página da entidade (E1) e o retrato do "seguir entidade" (oport_31) procuram as propostas pelo CNPJ do
-- proponente, e `painel_proposta` não tinha índice por CNPJ: cada leitura percorria a tabela inteira (137 mil
-- linhas, 240 MB; 1,9 s com o banco aquecido, bem mais logo depois da rodada diária). O teste da E3 viu a troca
-- de entidade levar de 5 a 15 s. Os instrumentos já têm o índice equivalente (`painel_instrumento_cnpj_idx`).
--
-- Só cria o índice (alguns segundos; trava a escrita na tabela só enquanto cria — aplicar fora do horário da
-- rodada diária, que grava entre ~11h30 e ~13h UTC). Idempotente.
-- =============================================================================

create index if not exists painel_proposta_cnpj_idx on public.painel_proposta (execucao_id, cnpj);
