-- =============================================================================
-- oport_45 — Seguir uma emenda da Câmara de João Pessoa e ser avisado quando ela anda (emendas de João Pessoa, J4,
-- 20/10/2026)
--
-- Um tipo novo de item seguido, `emenda_municipal`, com a chave do endereço da página da emenda (`AAAA-NNNN`, o ano do
-- exercício e o número com quatro dígitos, como `2026-0171`). O retrato vem da última rodada das emendas de João
-- Pessoa (`ejp_*`, oport_44), só das linhas do PAINEL da Prefeitura (o exercício corrente, lido todo dia):
--   · `ejp_atual`, `ejp_empenhado`, `ejp_liquidado`, `ejp_pago`: a soma das linhas da emenda, em reais inteiros;
--   · `ejp_unidade`: as unidades gestoras com valor (o remanejamento muda a unidade e zera a linha antiga);
--   · `ejp_empenhos_tce`: quantos empenhos da despesa de João Pessoa no TCE-PB citam a emenda (código 3310; o histórico
--     cita o número com o ano da apresentação, o exercício menos um — a regra de `empenhosDaEmenda` no site).
-- Os anos do portal (2021 a 2025) não mudam e não se seguem. Quando o exercício vira, as emendas do ano anterior saem
-- do painel e geram "fora_do_recorte".
--
-- A geração (`oport_gerar_avisos_ejp`) é a da oport_43 com o retrato municipal: o job `emendas_jp/` a chama depois de
-- publicar. Só compara o item cujo retrato é de outra rodada; a emenda que sumiu do painel gera "fora_do_recorte" e
-- fica marcada como ausente.
--
-- SÓ ADMINISTRADOR, como as telas da Câmara de João Pessoa. O banco não sabe quem é administrador (a lista mora no
-- ambiente do site): a política de inserção recusa este tipo pela sessão, como a emenda estadual, e só a ação do site,
-- depois de conferir o administrador, grava pela chave de serviço. A leitura e a exclusão continuam as de sempre (só os
-- próprios). O retrato não leva nome de credor nem de vereador.
--
-- Idempotente. Pré-requisitos: oport_43 (o gatilho atual) e oport_44.
-- =============================================================================

-- O gatilho de agora é o da oport_43 (com o ramo das emendas estaduais). Se mudou, esta migração pede revisão.
do $$
declare
  v_def text := pg_get_functiondef('public.oport_favorito_preparar()'::regprocedure);
begin
  if position('public.oport_estado_epb(new.chave, v_epb.id)' in v_def) = 0
     or position('from public.oport_janela_retrato r' in v_def) = 0 then
    raise exception 'oport_favorito_preparar mudou desde a oport_43: rever a oport_45 antes de aplicar';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- O tipo novo nas duas tabelas.
-- -----------------------------------------------------------------------------
alter table public.oport_favorito drop constraint if exists oport_favorito_tipo_check;
alter table public.oport_favorito add constraint oport_favorito_tipo_check
  check (tipo in ('janela', 'instrumento', 'proposta', 'municipio', 'entidade', 'emenda_estadual', 'emenda_municipal'));

alter table public.oport_favorito drop constraint if exists oport_favorito_chave_do_tipo;
alter table public.oport_favorito add constraint oport_favorito_chave_do_tipo check (
  tipo = 'janela'
  or (tipo = 'instrumento' and chave ~ '^[0-9A-Za-z]{1,20}$')
  or (tipo = 'proposta' and chave ~ '^[0-9]{1,12}$')
  or (tipo = 'municipio' and chave ~ '^[0-9]{7}$')
  or (tipo = 'entidade' and chave ~ '^[0-9A-Z]{12}[0-9]{2}$')
  or (tipo = 'emenda_estadual' and chave ~ '^20[0-9]{2}-[0-9]{4}$')
  or (tipo = 'emenda_municipal' and chave ~ '^20[0-9]{2}-[0-9]{4}$')
);

alter table public.oport_aviso drop constraint if exists oport_aviso_tipo_check;
alter table public.oport_aviso add constraint oport_aviso_tipo_check
  check (tipo in ('janela', 'instrumento', 'proposta', 'municipio', 'entidade', 'emenda_estadual', 'emenda_municipal'));

-- A pessoa aprovada segue pela própria sessão tudo, menos as emendas estaduais e municipais (só administrador, pela
-- ação do site).
drop policy if exists "favorito: cria os proprios" on public.oport_favorito;
create policy "favorito: cria os proprios" on public.oport_favorito
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.oport_aprovado())
    and tipo not in ('emenda_estadual', 'emenda_municipal')
  );

-- -----------------------------------------------------------------------------
-- O retrato de uma emenda municipal numa rodada.
-- -----------------------------------------------------------------------------
create or replace function public.oport_referencia_ejp(p_dado_ate timestamptz)
returns text
language sql
immutable
set search_path to 'public'
as $$ select 'ejp:' || to_char(p_dado_ate at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') $$;

create or replace function public.oport_estado_ejp(p_chave text, p_execucao bigint)
returns table (titulo text, estado jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  with k as (
    select substr(p_chave, 1, 4)::integer as ano, substr(p_chave, 6, 4)::integer as codigo
     where p_chave ~ '^20[0-9]{2}-[0-9]{4}$'
  ),
  l as (
    select k.ano, k.codigo,
           sum(x.dotacao) as atual, sum(x.empenhado) as empenhado, sum(x.liquidado) as liquidado, sum(x.pago) as pago,
           string_agg(distinct x.ug, ' · ' order by x.ug) filter (where x.dotacao > 0) as unidades_com_valor,
           string_agg(distinct x.ug, ' · ' order by x.ug) as unidades,
           max(x.objeto) as objeto
      from k
      join public.ejp_linha x on x.execucao_id = p_execucao and x.ano = k.ano and x.codigo = k.codigo
     group by k.ano, k.codigo
  )
  select left('Emenda ' || l.codigo || '/' || l.ano || coalesce(' · ' || nullif(l.objeto, ''), ''), 300),
         jsonb_build_object(
           'ejp_atual', round(coalesce(l.atual, 0)),
           'ejp_empenhado', round(coalesce(l.empenhado, 0)),
           'ejp_liquidado', round(coalesce(l.liquidado, 0)),
           'ejp_pago', round(coalesce(l.pago, 0)),
           'ejp_unidade', coalesce(l.unidades_com_valor, l.unidades),
           'ejp_empenhos_tce', (
             select count(*)
               from public.ejp_empenho e
              where e.execucao_id = p_execucao and e.ano = l.ano and e.codigo_citado = l.codigo and e.ano_citado = l.ano - 1
           )
         )
    from l
$$;

revoke execute on function public.oport_referencia_ejp(timestamptz) from public, anon, authenticated;
revoke execute on function public.oport_estado_ejp(text, bigint) from public, anon, authenticated;
grant execute on function public.oport_referencia_ejp(timestamptz) to service_role;
grant execute on function public.oport_estado_ejp(text, bigint) to service_role;

-- -----------------------------------------------------------------------------
-- O gatilho de antes de gravar a estrela (oport_43), com o ramo da emenda municipal. O resto, igual.
-- -----------------------------------------------------------------------------
create or replace function public.oport_favorito_preparar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_execucao   public.painel_execucao;
  v_epb        public.epb_execucao;
  v_ejp        public.ejp_execucao;
  v_titulo     text;
  v_estado     jsonb;
  v_referencia text;
begin
  if (select count(*) from public.oport_favorito where user_id = new.user_id) >= public.oport_favorito_limite() then
    raise exception 'limite de % itens seguidos', public.oport_favorito_limite() using errcode = 'check_violation';
  end if;

  new.criado_em := now();

  if new.tipo = 'janela' then
    select r.titulo, jsonb_build_object('aberta', r.aberta, 'prazo', r.prazo), r.referencia
      into v_titulo, v_estado, v_referencia
      from public.oport_janela_retrato r
     where r.chave = new.chave;
    new.titulo := v_titulo;
    new.estado := v_estado;
    new.referencia := v_referencia;
    new.estado_em := case when v_estado is null then null else now() end;
    return new;
  end if;

  -- oport_43: a emenda estadual, contra a última rodada das emendas estaduais (e não do painel).
  if new.tipo = 'emenda_estadual' then
    select * into v_epb from public.epb_ultima_execucao();
    if v_epb.id is not null then
      select s.titulo, s.estado into v_titulo, v_estado from public.oport_estado_epb(new.chave, v_epb.id) s;
    end if;
    if v_estado is null then
      raise exception 'emenda fora da última rodada das emendas estaduais' using errcode = 'foreign_key_violation';
    end if;
    new.titulo := v_titulo;
    new.estado := v_estado;
    new.referencia := public.oport_referencia_epb(v_epb.dado_ate);
    new.estado_em := now();
    return new;
  end if;

  -- oport_45: a emenda municipal, contra a última rodada das emendas de João Pessoa (só o painel do exercício).
  if new.tipo = 'emenda_municipal' then
    select * into v_ejp from public.ejp_ultima_execucao();
    if v_ejp.id is not null then
      select s.titulo, s.estado into v_titulo, v_estado from public.oport_estado_ejp(new.chave, v_ejp.id) s;
    end if;
    if v_estado is null then
      raise exception 'emenda fora do painel da última rodada das emendas de João Pessoa' using errcode = 'foreign_key_violation';
    end if;
    new.titulo := v_titulo;
    new.estado := v_estado;
    new.referencia := public.oport_referencia_ejp(v_ejp.dado_ate);
    new.estado_em := now();
    return new;
  end if;

  select * into v_execucao from public.painel_ultima_execucao();
  if v_execucao.id is not null then
    select s.titulo, s.estado into v_titulo, v_estado
      from public.oport_estado_painel(new.tipo, new.chave, v_execucao.id) s;
  end if;
  if v_estado is null then
    raise exception 'item fora da última execução do painel' using errcode = 'foreign_key_violation';
  end if;

  new.titulo := v_titulo;
  new.estado := v_estado;
  new.referencia := public.oport_referencia_painel(v_execucao.dado_ate);
  new.estado_em := now();
  return new;
end $$;

revoke execute on function public.oport_favorito_preparar() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Geração: as emendas municipais seguidas, contra a última rodada. Chamada pelo job `emendas_jp/` depois de publicar.
-- -----------------------------------------------------------------------------
create or replace function public.oport_gerar_avisos_ejp()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_execucao public.ejp_execucao;
  v_ref      text;
  v_campos   integer;
  v_saidas   integer;
  v_retratos integer;
begin
  select * into v_execucao from public.ejp_ultima_execucao();
  if v_execucao.id is null then
    return jsonb_build_object('execucao', null);
  end if;
  v_ref := public.oport_referencia_ejp(v_execucao.dado_ate);

  with atual as (
    select f.user_id, f.tipo, f.chave, f.titulo as titulo_antes, f.estado as antes, s.titulo, s.estado as depois
      from public.oport_favorito f
      join public.oport_acesso a on a.id = f.user_id and a.status = 'aprovado'
      left join lateral public.oport_estado_ejp(f.chave, v_execucao.id) s on true
     where f.tipo = 'emenda_municipal'
       and f.referencia is distinct from v_ref
  ),
  campos as (
    insert into public.oport_aviso (user_id, tipo, chave, evento, titulo, antes, depois, referencia)
    select a.user_id, a.tipo, a.chave, c.key, a.titulo, a.antes ->> c.key, c.value #>> '{}', v_ref
      from atual a
     cross join lateral jsonb_each(a.depois) c
     where a.depois is not null
       and a.antes is not null
       and not (a.antes ? 'ausente')
       and a.antes ? c.key
       and (a.antes -> c.key) is distinct from c.value
    on conflict do nothing
    returning 1
  ),
  saidas as (
    insert into public.oport_aviso (user_id, tipo, chave, evento, titulo, antes, depois, referencia)
    select a.user_id, a.tipo, a.chave, 'fora_do_recorte', a.titulo_antes, null, null, v_ref
      from atual a
     where a.depois is null and a.antes is not null and not (a.antes ? 'ausente')
    on conflict do nothing
    returning 1
  ),
  retratos as (
    update public.oport_favorito f
       set estado = coalesce(a.depois, '{"ausente": true}'::jsonb),
           titulo = coalesce(a.titulo, f.titulo),
           referencia = v_ref,
           estado_em = now()
      from atual a
     where f.user_id = a.user_id and f.tipo = a.tipo and f.chave = a.chave
    returning 1
  )
  select (select count(*) from campos), (select count(*) from saidas), (select count(*) from retratos)
    into v_campos, v_saidas, v_retratos;

  return jsonb_build_object('execucao', v_execucao.id, 'referencia', v_ref, 'avisos', v_campos + v_saidas, 'retratos', v_retratos);
end $$;

revoke execute on function public.oport_gerar_avisos_ejp() from public, anon, authenticated;
grant execute on function public.oport_gerar_avisos_ejp() to service_role;
