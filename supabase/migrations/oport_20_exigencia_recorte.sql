-- =============================================================================
-- oport_20 — duas coletas do Acesso Livre lado a lado: suspensiva e assinatura (onda 12, parte 2)
--
-- A coleta da onda 11 cobre os convênios da PB em cláusula suspensiva. A onda 12 colhe, na MESMA
-- tela ("Requisitos para Celebração"), os instrumentos da PB aprovados e ainda não assinados — os
-- requisitos para celebrar são analisados antes da assinatura, e o vocabulário do histórico é o
-- mesmo. Três casos conferidos em 28/09/2026: 962210 (requisitos "Atendido" em 08/10/2024 e nunca
-- assinado), 7AAAEU (complementação pedida em 25/06/2026) e 7AAAHJ (cinco pedidos e um reenvio).
--
-- O problema: `exigencia_concluir` apagava TODA outra execução, e toda leitura partia de uma só.
-- Carregar a coleta das assinaturas apagaria a das suspensivas. Esta migração:
--   · grava o recorte na execução ('suspensiva', o padrão, ou 'assinatura');
--   · faz `exigencia_concluir` apagar só as execuções antigas do MESMO recorte;
--   · `exigencia_ultima_execucao` e `exigencia_placar` passam a receber o recorte, com
--     'suspensiva' como padrão — as telas da onda 11 seguem chamando sem argumento e lendo o mesmo;
--   · `exigencia_dossie(numero)` procura o número na execução mais recente que o contém, em
--     qualquer recorte, e diz qual é. Um número não está nos dois ao mesmo tempo (suspensiva é
--     assinado, assinatura é não assinado); se passar de um para o outro, vale a coleta mais nova.
--
-- As funções mudam de assinatura: as antigas (sem argumento) saem antes, senão a chamada sem
-- argumento ficaria ambígua entre as duas.
--
-- Uso exclusivo da PONTE, pela chave de serviço. Grants explícitos, como manda a seguranca_1.
-- Aditiva e idempotente.
-- =============================================================================

alter table public.exigencia_execucao add column if not exists recorte text not null default 'suspensiva';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'exigencia_execucao_recorte_check') then
    alter table public.exigencia_execucao
      add constraint exigencia_execucao_recorte_check check (recorte in ('suspensiva', 'assinatura'));
  end if;
end $$;

comment on column public.exigencia_execucao.recorte is
  'Que instrumentos a coleta cobre: suspensiva (PB em cláusula suspensiva) ou assinatura (PB aprovados e não assinados).';

drop index if exists public.exigencia_execucao_concluida_idx;
create index if not exists exigencia_execucao_recorte_idx
  on public.exigencia_execucao (recorte, concluida_em desc) where status = 'concluida';

drop function if exists public.exigencia_ultima_execucao();
drop function if exists public.exigencia_placar();

-- -----------------------------------------------------------------------------
-- Última execução concluída de um recorte.
-- -----------------------------------------------------------------------------
create or replace function public.exigencia_ultima_execucao(p_recorte text default 'suspensiva')
returns table (id bigint, concluida_em timestamptz, dado_ate timestamptz, referencia date,
               fonte text, contagens jsonb, recorte text)
language sql stable
set search_path to 'public'
as $$
  select e.id, e.concluida_em, e.dado_ate, e.referencia, e.fonte, e.contagens, e.recorte
    from public.exigencia_execucao e
   where e.status = 'concluida' and e.recorte = coalesce(p_recorte, 'suspensiva')
   order by e.concluida_em desc
   limit 1
$$;

-- -----------------------------------------------------------------------------
-- Conclusão: marca a execução e apaga as anteriores DO MESMO RECORTE, na mesma transação.
-- -----------------------------------------------------------------------------
create or replace function public.exigencia_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  meu_recorte text;
begin
  update public.exigencia_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate,
         contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando'
  returning recorte into meu_recorte;
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;

  -- Cascata pelas chaves estrangeiras: apagar a execução leva junto os fatos dela.
  delete from public.exigencia_execucao where id <> p_execucao and recorte = meu_recorte;
end $$;

-- -----------------------------------------------------------------------------
-- Dossiê de um instrumento: a execução concluída mais recente que tem o número, de qualquer recorte.
-- -----------------------------------------------------------------------------
create or replace function public.exigencia_dossie(p_numero text)
returns jsonb
language sql stable
set search_path to 'public'
as $$
  with ex as (
    select e.id, e.concluida_em, e.referencia, e.fonte, e.recorte
      from public.exigencia_execucao e
      join public.exigencia_instrumento i on i.execucao_id = e.id and i.numero = p_numero
     where e.status = 'concluida'
     order by e.concluida_em desc
     limit 1
  )
  select jsonb_build_object(
    'coletado_em', (select concluida_em from ex),
    'referencia',  (select referencia from ex),
    'fonte',       (select fonte from ex),
    'recorte',     (select recorte from ex),
    'instrumento', (select to_jsonb(i) from public.exigencia_instrumento i, ex
                     where i.execucao_id = ex.id and i.numero = p_numero),
    'documentos',  coalesce((select jsonb_agg(to_jsonb(d) order by d.enviado_em desc)
                               from public.exigencia_documento d, ex
                              where d.execucao_id = ex.id and d.numero = p_numero), '[]'::jsonb),
    'eventos',     coalesce((select jsonb_agg(to_jsonb(v) order by v.ocorrido_em desc)
                               from public.exigencia_evento v, ex
                              where v.execucao_id = ex.id and v.numero = p_numero), '[]'::jsonb),
    'detalhes',    coalesce((select jsonb_agg(to_jsonb(t) order by t.analisada_em desc nulls last)
                               from public.exigencia_detalhe t, ex
                              where t.execucao_id = ex.id and t.numero = p_numero), '[]'::jsonb)
  )
$$;

-- -----------------------------------------------------------------------------
-- Placar de um recorte: quantos parados de cada lado e há quanto tempo, a partir da referência.
-- -----------------------------------------------------------------------------
create or replace function public.exigencia_placar(p_recorte text default 'suspensiva')
returns table (vez_de text, instrumentos integer, mediana_dias numeric, acima_90 integer, acima_180 integer)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id, coalesce(referencia, current_date) ref from public.exigencia_ultima_execucao(p_recorte)),
       base as (select i.vez_de, (ex.ref - i.parado_desde::date)::numeric dias
                  from public.exigencia_instrumento i, ex
                 where i.execucao_id = ex.id and i.erro is null and i.parado_desde is not null)
  select b.vez_de,
         count(*)::int,
         percentile_cont(0.5) within group (order by b.dias),
         count(*) filter (where b.dias > 90)::int,
         count(*) filter (where b.dias > 180)::int
    from base b
   group by b.vez_de
$$;

revoke execute on function public.exigencia_ultima_execucao(text)                   from public, anon, authenticated;
revoke execute on function public.exigencia_concluir(bigint, timestamptz, jsonb)    from public, anon, authenticated;
revoke execute on function public.exigencia_dossie(text)                            from public, anon, authenticated;
revoke execute on function public.exigencia_placar(text)                            from public, anon, authenticated;
grant  execute on function public.exigencia_ultima_execucao(text)                   to service_role;
grant  execute on function public.exigencia_concluir(bigint, timestamptz, jsonb)    to service_role;
grant  execute on function public.exigencia_dossie(text)                            to service_role;
grant  execute on function public.exigencia_placar(text)                            to service_role;
