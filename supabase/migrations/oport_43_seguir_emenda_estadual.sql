-- =============================================================================
-- oport_43 — Seguir uma emenda estadual e ser avisado quando ela anda no caminho (emendas estaduais, E4, 16/10/2026)
--
-- Um tipo novo de item seguido, `emenda_estadual`, com a chave do endereço da página da emenda (`AAAA-NNNN`, como
-- `2025-0075`). O retrato vem da última rodada das emendas estaduais (`epb_*`, oport_41):
--   · `epb_passo`: o passo atual do caminho (envio, parecer da SEPLAG, secretário da SEPLAG, cronograma da SEFAZ,
--     secretário da SEFAZ, empenhada, paga);
--   · `epb_empenhado` e `epb_pago`: o catálogo da emenda, em reais inteiros;
--   · `epb_devolvida`: algum parecer fala em devolver;
--   · `epb_credores`: quantos credores pessoa jurídica já têm empenho.
-- A data do passo não entra: muda junto com o passo, e o aviso repetiria.
--
-- A geração (`oport_gerar_avisos_epb`) é a do painel (oport_15) com o retrato estadual: o job `emendas_pb/` a chama
-- depois de publicar. Só compara o item cujo retrato é de outra rodada; a emenda que sumiu da rodada gera
-- "fora_do_recorte" e fica marcada como ausente.
--
-- SÓ ADMINISTRADOR, como as telas das emendas estaduais (até a revisão jurídica). O banco não sabe quem é
-- administrador (a lista mora no ambiente do site), então a pessoa aprovada NÃO insere este tipo pela própria
-- sessão: a política de inserção o recusa, e só a ação do site, depois de conferir o administrador, grava pela chave
-- de serviço. A leitura e a exclusão continuam as de sempre (só os próprios). O retrato não leva nome de servidor.
--
-- Os retratos de "município" e "entidade" NÃO ganham dado estadual: clientes seguem esses itens, e as emendas
-- estaduais são só de administrador.
--
-- Idempotente. Pré-requisitos: oport_15, oport_28, oport_31, oport_38 (o gatilho atual) e oport_41.
-- =============================================================================

-- O gatilho de agora é o da oport_38 (janela pelo retrato do servidor). Se mudou, esta migração pede revisão.
do $$
declare
  v_def text := pg_get_functiondef('public.oport_favorito_preparar()'::regprocedure);
begin
  if position('from public.oport_janela_retrato r' in v_def) = 0 then
    raise exception 'oport_favorito_preparar mudou desde a oport_38: rever a oport_43 antes de aplicar';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- O tipo novo nas duas tabelas.
-- -----------------------------------------------------------------------------
alter table public.oport_favorito drop constraint if exists oport_favorito_tipo_check;
alter table public.oport_favorito add constraint oport_favorito_tipo_check
  check (tipo in ('janela', 'instrumento', 'proposta', 'municipio', 'entidade', 'emenda_estadual'));

alter table public.oport_favorito drop constraint if exists oport_favorito_chave_do_tipo;
alter table public.oport_favorito add constraint oport_favorito_chave_do_tipo check (
  tipo = 'janela'
  or (tipo = 'instrumento' and chave ~ '^[0-9A-Za-z]{1,20}$')
  or (tipo = 'proposta' and chave ~ '^[0-9]{1,12}$')
  or (tipo = 'municipio' and chave ~ '^[0-9]{7}$')
  or (tipo = 'entidade' and chave ~ '^[0-9A-Z]{12}[0-9]{2}$')
  or (tipo = 'emenda_estadual' and chave ~ '^20[0-9]{2}-[0-9]{4}$')
);

alter table public.oport_aviso drop constraint if exists oport_aviso_tipo_check;
alter table public.oport_aviso add constraint oport_aviso_tipo_check
  check (tipo in ('janela', 'instrumento', 'proposta', 'municipio', 'entidade', 'emenda_estadual'));

-- A pessoa aprovada segue pela própria sessão tudo, menos a emenda estadual (só administrador, pela ação do site).
drop policy if exists "favorito: cria os proprios" on public.oport_favorito;
create policy "favorito: cria os proprios" on public.oport_favorito
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.oport_aprovado()) and tipo <> 'emenda_estadual');

-- -----------------------------------------------------------------------------
-- O retrato de uma emenda estadual numa rodada.
-- -----------------------------------------------------------------------------
create or replace function public.oport_referencia_epb(p_dado_ate timestamptz)
returns text
language sql
immutable
set search_path to 'public'
as $$ select 'epb:' || to_char(p_dado_ate at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') $$;

create or replace function public.oport_estado_epb(p_chave text, p_execucao bigint)
returns table (titulo text, estado jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  with k as (select substr(p_chave, 6, 4) || '/' || substr(p_chave, 1, 4) as emenda where p_chave ~ '^20[0-9]{2}-[0-9]{4}$')
  select left('Emenda ' || k.emenda || coalesce(' · ' || nullif(coalesce(f.retificacao_objeto, f.objeto), ''), ''), 300),
         jsonb_build_object(
           'epb_passo', f.passo,
           'epb_empenhado', round(coalesce(c.empenhado, 0)),
           'epb_pago', round(coalesce(c.pago, 0)),
           'epb_devolvida', coalesce(f.devolvida, false),
           'epb_credores', coalesce(d.n, 0)
         )
    from k
    left join public.epb_ficha f on f.execucao_id = p_execucao and f.emenda = k.emenda
    left join lateral (
      select sum(e.empenhado) as empenhado, sum(e.pago) as pago, count(*) as n
        from public.epb_emenda e
       where e.execucao_id = p_execucao and e.emenda = k.emenda
    ) c on true
    left join lateral (
      select count(distinct x.credor_cnpj) as n
        from public.epb_destino x
       where x.execucao_id = p_execucao and x.emenda = k.emenda
    ) d on true
   where f.emenda is not null or c.n > 0
$$;

revoke execute on function public.oport_referencia_epb(timestamptz) from public, anon, authenticated;
revoke execute on function public.oport_estado_epb(text, bigint) from public, anon, authenticated;
grant execute on function public.oport_referencia_epb(timestamptz) to service_role;
grant execute on function public.oport_estado_epb(text, bigint) to service_role;

-- -----------------------------------------------------------------------------
-- O gatilho de antes de gravar a estrela (oport_38), com o ramo da emenda estadual. O resto, igual.
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
-- Geração: as emendas estaduais seguidas, contra a última rodada. Chamada pelo job `emendas_pb/` depois de publicar.
-- -----------------------------------------------------------------------------
create or replace function public.oport_gerar_avisos_epb()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_execucao public.epb_execucao;
  v_ref      text;
  v_campos   integer;
  v_saidas   integer;
  v_retratos integer;
begin
  select * into v_execucao from public.epb_ultima_execucao();
  if v_execucao.id is null then
    return jsonb_build_object('execucao', null);
  end if;
  v_ref := public.oport_referencia_epb(v_execucao.dado_ate);

  with atual as (
    select f.user_id, f.tipo, f.chave, f.titulo as titulo_antes, f.estado as antes, s.titulo, s.estado as depois
      from public.oport_favorito f
      join public.oport_acesso a on a.id = f.user_id and a.status = 'aprovado'
      left join lateral public.oport_estado_epb(f.chave, v_execucao.id) s on true
     where f.tipo = 'emenda_estadual'
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

revoke execute on function public.oport_gerar_avisos_epb() from public, anon, authenticated;
grant execute on function public.oport_gerar_avisos_epb() to service_role;
