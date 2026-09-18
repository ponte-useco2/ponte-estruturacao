-- =============================================================================
-- oport_18b — o texto do motivo da cláusula suspensiva no painel_instrumento (onda 11)
--
-- `MOTIVO_SUSPENSAO` dos dados abertos do SICONV é a lista formal do que o termo exige para a
-- retirada ("Titularidade de Área, Projeto de Engenharia, Licenciamento Ambiental Prévio…"). O
-- painel de execução já lia o campo, mas guardava só cinco categorias (`painel_convenio.exige_*`).
-- O laudo da suspensiva precisa do texto: é ele que diz o que falta, com as palavras do termo.
--
-- Por que importa, com um caso: em Cabedelo (963081) o termo exige "Projeto de Engenharia", e a
-- única análise registrada na aba de requisitos do Acesso Livre diz "Adimplente". Sem o motivo, o
-- laudo leria "atendido" como se a condição estivesse cumprida.
--
-- O job grava o texto só enquanto a suspensiva está pendente (prazo informado e sem retirada): o
-- SICONV apaga o motivo na retirada (19.690 dos 19.692 com motivo em 14/09/2026 estavam pendentes).
-- Maior texto medido: 286 caracteres; o job corta em 500 e mascara CPF, como faz no objeto.
--
-- ORDEM: esta migração ANTES do job com `motivo_suspensao` chegar à `main`. Sem a coluna, a
-- gravação do painel falha inteira (o PostgREST recusa coluna desconhecida). O site tolera as duas
-- ordens: sem a coluna, o laudo mostra "não informado".
--
-- Aditiva e idempotente. A tabela já tem RLS e grant só para `service_role` (oport_14); coluna nova
-- herda o acesso da tabela.
-- =============================================================================

alter table public.painel_instrumento add column if not exists motivo_suspensao text;

comment on column public.painel_instrumento.motivo_suspensao is
  'MOTIVO_SUSPENSAO do SICONV (o que o termo exige), só com a suspensiva pendente; CPF mascarado; até 500 caracteres.';
