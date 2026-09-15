-- =============================================================================
-- oport_10b — Painel: limpeza das execuções antigas em lotes
--
-- Na primeira execução com a oport_10 (run 34930142385, 15/09), painel_concluir
-- estourou o statement_timeout de 8 s da API: apagava, num comando só, as ~200 mil
-- linhas da execução anterior (125 mil só de propostas). A execução ficou em "erro"
-- com as linhas gravadas, e o site continuou na anterior.
--
-- A partir daqui:
--   · painel_concluir só fecha a execução (rápido e atômico, como antes);
--   · painel_limpar apaga no máximo p_limite linhas por chamada, e o job repete a
--     chamada até voltar 0 — antes de gravar (sobras de execução com erro) e depois
--     de concluir (a execução anterior).
--
-- A execução que o site lê (a última concluída) nunca é apagada, qualquer que seja o
-- parâmetro. Compatível com o job publicado: ele só deixa de apagar as antigas, que a
-- primeira execução do job novo recolhe. Aplicar ANTES do job novo chegar à main —
-- sem painel_limpar, a gravação falha logo no início.
--
-- Grants explícitos (seguranca_1). Idempotente.
-- =============================================================================

create or replace function public.painel_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.painel_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- Apaga linhas de todas as execuções, menos a última concluída e p_manter (a que o
-- job está gravando). Devolve quantas linhas apagou; 0 = nada mais a limpar.
-- O ctid = any(array(...)) usa o índice (execucao_id, …) de cada tabela para achar as
-- linhas e apaga só o lote, sem varrer a tabela inteira.
-- -----------------------------------------------------------------------------
create or replace function public.painel_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.painel_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.painel_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['painel_convenio', 'painel_municipio', 'painel_aditivo_motivo', 'painel_etapa_tempo',
                           'painel_etapa_ano', 'painel_programa_desfecho', 'painel_proposta'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;


revoke execute on function public.painel_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.painel_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.painel_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.painel_limpar(bigint, integer)               to service_role;
