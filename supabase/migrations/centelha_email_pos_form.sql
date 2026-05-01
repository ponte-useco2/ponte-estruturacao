-- =====================================================================
-- Email automático pós-formulário Centelha 3 PB
-- =====================================================================
-- Adiciona 2 colunas na tabela `leads` para agendar o envio de email
-- automático 1 hora após o lead preencher o formulário gratuito de
-- pré-diagnóstico.
--
-- RODE NO SUPABASE STUDIO → SQL EDITOR
-- Idempotente — pode rodar múltiplas vezes sem problemas.
-- =====================================================================

-- 1. Coluna que marca quando o email DEVE ser enviado (now() + 1 hour)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email_pos_form_send_at TIMESTAMPTZ;

-- 2. Coluna que marca quando o email FOI enviado (NULL = ainda não enviado)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email_pos_form_sent_at TIMESTAMPTZ;

-- 3. Índice parcial para acelerar a busca de emails pendentes
-- (Apenas leads com send_at preenchido E sent_at NULL aparecem no índice)
CREATE INDEX IF NOT EXISTS idx_leads_email_pos_form_pending
  ON public.leads (email_pos_form_send_at)
  WHERE email_pos_form_send_at IS NOT NULL
    AND email_pos_form_sent_at IS NULL;

-- =====================================================================
-- Verificação
-- =====================================================================
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name = 'leads'
--      AND column_name LIKE 'email_pos_form%';
--
-- Esperado: 2 linhas com email_pos_form_send_at e email_pos_form_sent_at,
--           ambas timestamptz, nullable.
-- =====================================================================
