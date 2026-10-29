-- =============================================================================
-- oport_55 — Apaga os avisos "Situação mudou" em que só a ordem mudou (A5-04 da investigação do portal, 29/10/2026)
--
-- O radar juntava as situações dos códigos de uma janela sem ordem fixa, e o programa 5120 (Ministério da Saúde)
-- alternou "CADASTRADO / DISPONIBILIZADO" e "DISPONIBILIZADO / CADASTRADO" em 23, 24, 26 e 27/10: 4 mudanças falsas
-- em `oport_mudanca` (ids 820, 831, 849 e 938, conferidas pelo MCP em 29/10) e 8 notificações, nenhuma lida. O site
-- passou a comparar a situação como conjunto (`situacaoNormalizada`, `diff.ts`) e o radar a ordenar o agregado; isto
-- limpa o que já tinha entrado. As notificações saem junto (`oport_notificacao.mudanca_id` é `on delete cascade`).
--
-- Só apaga `situacao_mudou` cujo antes e depois são o mesmo conjunto de partes: uma mudança de verdade nunca casa.
-- Idempotente (a segunda vez apaga 0). Não depende da ordem de publicação.
-- =============================================================================

delete from public.oport_mudanca m
 where m.tipo = 'situacao_mudou'
   and (select string_agg(distinct btrim(x), ' / ' order by btrim(x)) from unnest(string_to_array(m.antes, '/')) x where btrim(x) <> '')
     = (select string_agg(distinct btrim(x), ' / ' order by btrim(x)) from unnest(string_to_array(m.depois, '/')) x where btrim(x) <> '');
