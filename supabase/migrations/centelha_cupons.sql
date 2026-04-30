-- =====================================================================
-- Centelha Cupons — sistema de cupons para o checkout /centelha-3-pb
-- =====================================================================
-- RODE ESTE SQL UMA ÚNICA VEZ no Supabase Studio → SQL Editor.
-- Idempotente: usa CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING
-- na inserção, e CREATE OR REPLACE FUNCTION.
-- =====================================================================

-- 1. Tabela de cupons
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.centelha_cupons (
  codigo TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('afiliado_20', 'amigos_270')),
  valor_final_centavos INT NOT NULL,
  max_usos INT,                                  -- NULL = ilimitado
  usos_atuais INT NOT NULL DEFAULT 0,
  afiliado_nome TEXT,                             -- nome do indicador, p/ atribuição
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_centelha_cupons_ativo
  ON public.centelha_cupons (ativo) WHERE ativo = true;

-- 2. RLS — bloqueio total para anon (validação acontece via server action)
-- ---------------------------------------------------------------------
ALTER TABLE public.centelha_cupons ENABLE ROW LEVEL SECURITY;

-- Removemos qualquer policy existente para garantir estado limpo
DROP POLICY IF EXISTS "Block anon access to centelha_cupons" ON public.centelha_cupons;

-- Por padrão, RLS sem policy = nega tudo. Não criamos policy para anon —
-- apenas a service_role (server-side) acessa. Aí:
--   ✓ Sem leitura pública (impede alguém listar todos os códigos)
--   ✓ Sem update direto (somente via função abaixo, que é atômica)

-- 3. Função atômica para "consumir" um cupom
-- ---------------------------------------------------------------------
-- Decrementa atomicamente o cupom. Retorna o cupom se foi consumido com
-- sucesso, ou NULL se: não existe / inativo / esgotado.
--
-- Race-condition safe: o UPDATE com WHERE garante que duas requisições
-- simultâneas não consumam a mesma "última vaga".
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consumir_cupom_centelha(p_codigo TEXT)
RETURNS public.centelha_cupons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupom public.centelha_cupons;
  v_codigo_norm TEXT;
BEGIN
  -- Normaliza para uppercase (case-insensitive)
  v_codigo_norm := UPPER(TRIM(p_codigo));

  UPDATE public.centelha_cupons
     SET usos_atuais = usos_atuais + 1,
         updated_at = now()
   WHERE codigo = v_codigo_norm
     AND ativo = true
     AND (max_usos IS NULL OR usos_atuais < max_usos)
   RETURNING * INTO v_cupom;

  -- Se v_cupom é NULL, falhou (não existe / inativo / esgotado)
  RETURN v_cupom;
END;
$$;

-- 4. Função para "lookup sem consumir" — usado pra mostrar valor antes de pagar
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consultar_cupom_centelha(p_codigo TEXT)
RETURNS public.centelha_cupons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupom public.centelha_cupons;
BEGIN
  SELECT * INTO v_cupom
    FROM public.centelha_cupons
   WHERE codigo = UPPER(TRIM(p_codigo))
     AND ativo = true
     AND (max_usos IS NULL OR usos_atuais < max_usos)
   LIMIT 1;

  RETURN v_cupom;
END;
$$;

-- 5. Função para "devolver" um cupom (em caso de pagamento falho)
-- ---------------------------------------------------------------------
-- Útil se a cobrança Asaas falhar APÓS termos decrementado o cupom.
-- Reverte o decremento. Idempotente: nunca vai abaixo de zero.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.devolver_cupom_centelha(p_codigo TEXT)
RETURNS public.centelha_cupons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupom public.centelha_cupons;
BEGIN
  UPDATE public.centelha_cupons
     SET usos_atuais = GREATEST(usos_atuais - 1, 0),
         updated_at = now()
   WHERE codigo = UPPER(TRIM(p_codigo))
   RETURNING * INTO v_cupom;

  RETURN v_cupom;
END;
$$;

-- 6. Seed inicial dos 10 cupons
-- ---------------------------------------------------------------------
-- ON CONFLICT DO NOTHING para você poder rodar este SQL várias vezes
-- sem duplicar. Se quiser ATUALIZAR depois, faça UPDATE manual.
-- ---------------------------------------------------------------------

-- Afiliados 20% (uso ilimitado)
INSERT INTO public.centelha_cupons
  (codigo, tipo, valor_final_centavos, max_usos, afiliado_nome)
VALUES
  ('PEDRO',  'afiliado_20', 216000, NULL, 'Pedro'),
  ('GAYOSO', 'afiliado_20', 216000, NULL, 'Gayoso'),
  ('ESC',    'afiliado_20', 216000, NULL, 'ESC'),
  ('WS',     'afiliado_20', 216000, NULL, 'WS'),
  ('RESULT', 'afiliado_20', 216000, NULL, 'Result')
ON CONFLICT (codigo) DO NOTHING;

-- Amigos R$ 270 (2 vagas cada, total 10)
INSERT INTO public.centelha_cupons
  (codigo, tipo, valor_final_centavos, max_usos, afiliado_nome)
VALUES
  ('LUZERO',   'amigos_270', 27000, 2, 'Luzero'),
  ('FABRICIO', 'amigos_270', 27000, 2, 'Fabrício'),
  ('PAULO',    'amigos_270', 27000, 2, 'Paulo'),
  ('ISABELLE', 'amigos_270', 27000, 2, 'Isabelle'),
  ('PABLO',    'amigos_270', 27000, 2, 'Pablo')
ON CONFLICT (codigo) DO NOTHING;

-- 7. Permitir que a service_role chame as funções (já tem por padrão,
--    mas explicitar evita surpresa se alguém mexer nas permissões)
-- ---------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.consultar_cupom_centelha(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consumir_cupom_centelha(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.devolver_cupom_centelha(TEXT) TO service_role;

-- =====================================================================
-- Pronto! Verifique com:
--
--   SELECT codigo, tipo, valor_final_centavos / 100.0 AS valor_reais,
--          max_usos, usos_atuais, ativo
--     FROM public.centelha_cupons ORDER BY tipo, codigo;
-- =====================================================================
