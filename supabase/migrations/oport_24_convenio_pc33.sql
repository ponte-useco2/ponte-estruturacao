-- =============================================================================
-- oport_24 — execução dos convênios pela Portaria Conjunta MGI/MF/CGU 33/2023 (onda 13B)
--
-- O job do painel (`painel_execucao/portaria33.py`) grava, em cada convênio da PB, os itens da PC 33
-- conferíveis nos dados abertos (compilada até a PC 45/2026), na redação da época da celebração:
--   · pc33_regime: 'pc33' | 'simplificado' (até o limite do art. 184-A da Lei 14.133) |
--                  'anterior' (antes de 01/09/2023: norma da época) | 'fora' (termos de fomento, colaboração
--                  e compromisso, art. 2º);
--   · pc33_nivel:  o nível do art. 7º (I a V desde a PC 29/2024; I a VI antes), só no regime 'pc33';
--   · pc33_pior:   o nível mais grave entre os itens a conferir ('alto' | 'moderado'), para ordenar;
--   · pc33_itens:  [{"item": "P9", "titulo": ..., "dispositivo": ..., "estado": ..., "nivel": ..., "fato": ...}].
-- Fora da PB, as colunas ficam vazias.
--
-- Mesmas regras de acesso da painel_instrumento (oport_14): só service_role. Sem pessoa física: só somas.
-- Aditiva e idempotente. Depende da oport_14.
-- =============================================================================

alter table public.painel_instrumento add column if not exists pc33_regime text;
alter table public.painel_instrumento add column if not exists pc33_nivel  text;
alter table public.painel_instrumento add column if not exists pc33_pior   text;
alter table public.painel_instrumento add column if not exists pc33_itens  jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'painel_instrumento_pc33_regime_check') then
    alter table public.painel_instrumento add constraint painel_instrumento_pc33_regime_check
      check (pc33_regime is null or pc33_regime in ('pc33', 'simplificado', 'anterior', 'fora'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'painel_instrumento_pc33_pior_check') then
    alter table public.painel_instrumento add constraint painel_instrumento_pc33_pior_check
      check (pc33_pior is null or pc33_pior in ('critico', 'alto', 'moderado'));
  end if;
end $$;

comment on column public.painel_instrumento.pc33_itens is
  'Itens da PC 33/2023 conferidos nos dados abertos, na redação da época (onda 13B). "nao_atendido" é "a conferir".';
