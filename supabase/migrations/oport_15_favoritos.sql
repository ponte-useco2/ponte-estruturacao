-- =============================================================================
-- oport_15 — Itens seguidos, avisos sobre eles e normas (onda 7)
--
-- A pessoa aprovada marca com estrela uma janela do catálogo, um convênio ou uma
-- proposta. Cada item seguido guarda o último retrato visto (`estado`). Quando o
-- dado novo chega, o retrato é comparado com o atual e cada diferença vira um
-- aviso só para quem segue o item. Os avisos ficam só dentro do site: não há
-- e-mail para clientes.
--
-- Por que retrato por item, e não `painel_mudanca`:
--   · `painel_mudanca` só cobre os convênios vivos e o desfecho das propostas; o
--     convênio concluído da PB e a troca de situação da proposta ficam de fora;
--   · ela zera as linhas quando o arquivo repete ou passa do teto, e some em 60 dias;
--   · os tipos dela são sinais de administrador ("saldo parado"), que as telas dos
--     usuários aprovados não mostram desde a onda 6.
--
-- Quem grava aviso: só as funções `oport_gerar_avisos_*`, pela chave de serviço.
-- O job do painel chama a de convênios e propostas depois de publicar; a
-- sincronização das janelas chama a do catálogo.
--
-- Normas: curadoria dos administradores, lida por qualquer aprovado.
--
-- Idempotente. Pré-requisitos: oport_3 (oport_aprovado), oport_6 (oport_esquecer),
-- oport_9 e oport_14 (painel_proposta e painel_instrumento).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Itens seguidos
-- -----------------------------------------------------------------------------
create table if not exists public.oport_favorito (
  user_id    uuid not null references auth.users (id) on delete cascade,
  tipo       text not null check (tipo in ('janela', 'instrumento', 'proposta')),
  -- Janela: `id` do catálogo v2. Convênio: número. Proposta: id do SICONV.
  chave      text not null check (chave ~ '^[A-Za-z0-9._-]{1,160}$'),
  titulo     text check (length(titulo) <= 300),
  -- Último retrato comparado. Convênio e proposta: campos do painel; janela: aberta e prazo.
  estado     jsonb,
  -- De que dado é o retrato: `painel:<dado_ate>` ou o `gerado_em` do catálogo.
  referencia text check (length(referencia) <= 80),
  estado_em  timestamptz,
  criado_em  timestamptz not null default now(),
  primary key (user_id, tipo, chave),
  -- Há número de convênio com letra ("7AAAAA", 1.649 na execução de 15/09); o id da proposta é só dígito.
  constraint oport_favorito_chave_do_tipo check (
    tipo = 'janela'
    or (tipo = 'instrumento' and chave ~ '^[0-9A-Za-z]{1,20}$')
    or (tipo = 'proposta' and chave ~ '^[0-9]{1,12}$')
  )
);

create index if not exists oport_favorito_item_idx on public.oport_favorito (tipo, chave);

-- Quanto uma pessoa pode seguir. Acima disso o aviso vira ruído e a geração cresce sem teto.
create or replace function public.oport_favorito_limite()
returns integer
language sql
immutable
set search_path to 'public'
as $$ select 300 $$;

revoke execute on function public.oport_favorito_limite() from public, anon, authenticated;
grant execute on function public.oport_favorito_limite() to service_role;

-- A referência de um retrato do painel. Em UTC fixo: `timestamptz::text` depende do fuso da sessão,
-- e a estrela (sessão do site) e a geração (job) não podem escrever a mesma data de dois jeitos.
create or replace function public.oport_referencia_painel(p_dado_ate timestamptz)
returns text
language sql
immutable
set search_path to 'public'
as $$ select 'painel:' || to_char(p_dado_ate at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') $$;

revoke execute on function public.oport_referencia_painel(timestamptz) from public, anon, authenticated;
grant execute on function public.oport_referencia_painel(timestamptz) to service_role;


-- -----------------------------------------------------------------------------
-- O retrato de um convênio ou de uma proposta na execução do painel.
--
-- Só entram campos que descrevem o andamento: nada de sinal de problema. Campo
-- novo aqui não gera aviso falso: a comparação só olha as chaves que o retrato
-- anterior já tinha.
-- -----------------------------------------------------------------------------
create or replace function public.oport_estado_painel(p_tipo text, p_chave text, p_execucao bigint)
returns table (titulo text, estado jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  select left(coalesce(i.objeto, i.programa, 'Convênio ' || i.nr_convenio), 300),
         jsonb_build_object(
           'situacao', i.situacao,
           'subsituacao', i.subsituacao,
           'vl_desembolsado', i.vl_desembolsado,
           'n_aditivos', i.n_aditivos,
           'n_prorrogas', i.n_prorrogas,
           'dt_fim_vigencia', i.dt_fim_vigencia,
           'dt_limite_contas', i.dt_limite_contas,
           'dt_retirada_suspensiva', i.dt_retirada_suspensiva,
           'pct_fisico', i.pct_fisico
         )
    from public.painel_instrumento i
   where p_tipo = 'instrumento' and i.execucao_id = p_execucao and i.nr_convenio = p_chave
  union all
  select left(coalesce(p.objeto, p.programa, 'Proposta ' || p.id_proposta), 300),
         jsonb_build_object(
           'situacao', p.situacao,
           'desfecho', p.desfecho,
           'nr_convenio', p.nr_convenio
         )
    from public.painel_proposta p
   where p_tipo = 'proposta' and p.execucao_id = p_execucao and p.id_proposta = p_chave
  limit 1
$$;

-- A leitura pelo número usa os índices que já existem: (execucao_id, nr_convenio) da oport_14 e
-- (execucao_id, id_proposta) da oport_11.

revoke execute on function public.oport_estado_painel(text, text, bigint) from public, anon, authenticated;
grant execute on function public.oport_estado_painel(text, text, bigint) to service_role;


-- -----------------------------------------------------------------------------
-- Antes de gravar a estrela: limite por pessoa e, para convênio e proposta, o
-- título e o retrato vêm do painel, nunca do navegador. Item que não está na
-- última execução do painel é recusado.
--
-- A janela chega com título e retrato montados pelo servidor do site a partir do
-- catálogo (a ação confere que o id existe). Quem forjar esses campos pela API
-- só atrapalha os próprios avisos.
-- -----------------------------------------------------------------------------
create or replace function public.oport_favorito_preparar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_execucao public.painel_execucao;
  v_titulo   text;
  v_estado   jsonb;
begin
  if (select count(*) from public.oport_favorito where user_id = new.user_id) >= public.oport_favorito_limite() then
    raise exception 'limite de % itens seguidos', public.oport_favorito_limite() using errcode = 'check_violation';
  end if;

  new.criado_em := now();

  if new.tipo = 'janela' then
    if new.estado is not null and jsonb_typeof(new.estado) <> 'object' then
      new.estado := null;
    end if;
    new.estado_em := case when new.estado is null then null else now() end;
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

drop trigger if exists oport_favorito_preparar on public.oport_favorito;
create trigger oport_favorito_preparar
  before insert on public.oport_favorito
  for each row execute function public.oport_favorito_preparar();

alter table public.oport_favorito enable row level security;

revoke all on table public.oport_favorito from anon, authenticated;
grant all on table public.oport_favorito to service_role;
-- Sem UPDATE: o retrato é mantido pelas funções de geração. Seguir de novo é apagar e criar.
grant select, delete on table public.oport_favorito to authenticated;
grant insert (user_id, tipo, chave, titulo, estado, referencia) on table public.oport_favorito to authenticated;

drop policy if exists "favorito: le os proprios" on public.oport_favorito;
create policy "favorito: le os proprios" on public.oport_favorito
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.oport_aprovado()));

drop policy if exists "favorito: cria os proprios" on public.oport_favorito;
create policy "favorito: cria os proprios" on public.oport_favorito
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.oport_aprovado()));

-- Com aprovação, como a leitura. Sem ela não adiantaria: DELETE com filtro também passa
-- pela política de SELECT (conferido no Postgres descartável). Quem é bloqueado não vê
-- o site, e o esquecimento (`oport_esquecer`) apaga as estrelas.
drop policy if exists "favorito: apaga os proprios" on public.oport_favorito;
create policy "favorito: apaga os proprios" on public.oport_favorito
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.oport_aprovado()));


-- -----------------------------------------------------------------------------
-- Avisos sobre os itens seguidos
-- -----------------------------------------------------------------------------
create table if not exists public.oport_aviso (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  tipo         text not null check (tipo in ('janela', 'instrumento', 'proposta')),
  chave        text not null,
  -- O campo que mudou (situacao, vl_desembolsado, prazo...) ou o fato (encerrada, fechando, fora_do_recorte).
  evento       text not null check (length(evento) <= 40),
  titulo       text,
  antes        text,
  depois       text,
  referencia   text not null,
  criado_em    timestamptz not null default now(),
  lida_em      timestamptz,
  arquivada_em timestamptz,
  -- Gerar de novo com o mesmo dado não repete o aviso.
  unique (user_id, tipo, chave, evento, referencia)
);

create index if not exists oport_aviso_nao_lido_idx on public.oport_aviso (user_id)
  where lida_em is null and arquivada_em is null;
create index if not exists oport_aviso_usuario_idx on public.oport_aviso (user_id, criado_em desc);

alter table public.oport_aviso enable row level security;

revoke all on table public.oport_aviso from anon, authenticated;
grant all on table public.oport_aviso to service_role;
grant select on table public.oport_aviso to authenticated;
grant update (lida_em, arquivada_em) on table public.oport_aviso to authenticated;

drop policy if exists "aviso: le os proprios" on public.oport_aviso;
create policy "aviso: le os proprios" on public.oport_aviso
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.oport_aprovado()));

drop policy if exists "aviso: marca os proprios" on public.oport_aviso;
create policy "aviso: marca os proprios" on public.oport_aviso
  for update to authenticated
  using ((select auth.uid()) = user_id and (select public.oport_aprovado()))
  with check ((select auth.uid()) = user_id);


-- -----------------------------------------------------------------------------
-- Geração: convênios e propostas seguidos, contra a última execução do painel.
--
-- Chamada pelo job do painel depois de publicar. Só compara o item cujo retrato é
-- de outro dado: rodar de novo com o mesmo arquivo não faz nada. Item que saiu do
-- recorte do painel gera um aviso e fica marcado como ausente; se voltar, o
-- retrato recomeça sem aviso.
-- -----------------------------------------------------------------------------
create or replace function public.oport_gerar_avisos_painel()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_execucao public.painel_execucao;
  v_ref      text;
  v_campos   integer;
  v_saidas   integer;
  v_retratos integer;
  v_velhos   integer;
begin
  select * into v_execucao from public.painel_ultima_execucao();
  if v_execucao.id is null then
    return jsonb_build_object('execucao', null);
  end if;
  v_ref := public.oport_referencia_painel(v_execucao.dado_ate);

  with atual as (
    select f.user_id, f.tipo, f.chave, f.titulo as titulo_antes, f.estado as antes, s.titulo, s.estado as depois
      from public.oport_favorito f
      join public.oport_acesso a on a.id = f.user_id and a.status = 'aprovado'
      left join lateral public.oport_estado_painel(f.tipo, f.chave, v_execucao.id) s on true
     where f.tipo in ('instrumento', 'proposta')
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

  -- Aviso com mais de 400 dias já cumpriu o papel.
  delete from public.oport_aviso where criado_em < now() - interval '400 days';
  get diagnostics v_velhos = row_count;

  return jsonb_build_object(
    'execucao', v_execucao.id,
    'referencia', v_ref,
    'avisos', v_campos + v_saidas,
    'retratos', v_retratos,
    'apagados', v_velhos
  );
end $$;

revoke execute on function public.oport_gerar_avisos_painel() from public, anon, authenticated;
grant execute on function public.oport_gerar_avisos_painel() to service_role;


-- -----------------------------------------------------------------------------
-- Geração: janelas seguidas, contra o catálogo do dia.
--
-- `p_abertas`: objeto { id: { "titulo": ..., "prazo": "AAAA-MM-DD" | null } } com as
-- janelas abertas em `p_hoje`, montado pelo site a partir do catálogo v2. Roda em
-- toda sincronização, com dado novo ou não, porque o "fecha em N dias" depende do dia.
--
-- Avisos: prazo mudou, janela fechou ou saiu do catálogo, voltou a abrir, e fecha em
-- até 7, 3 ou 1 dia (uma vez por prazo e limiar, como os avisos gerais).
-- Catálogo vazio não fecha nada: é mais provável ser falha de leitura que fim de todas.
-- -----------------------------------------------------------------------------
create or replace function public.oport_gerar_avisos_janelas(p_referencia text, p_hoje date, p_abertas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_avisos   integer;
  v_retratos integer;
begin
  if p_referencia is null or p_hoje is null or jsonb_typeof(p_abertas) is distinct from 'object'
     or p_abertas = '{}'::jsonb then
    return jsonb_build_object('aplicada', false, 'motivo', 'catálogo vazio ou parâmetro ausente');
  end if;

  with atual as (
    select f.user_id, f.chave, f.titulo as titulo_antes, f.estado as antes, p_abertas -> f.chave as janela
      from public.oport_favorito f
      join public.oport_acesso a on a.id = f.user_id and a.status = 'aprovado'
     where f.tipo = 'janela'
  ),
  novo as (
    select x.*,
           case when x.janela is not null
                then jsonb_build_object('aberta', true, 'prazo', x.janela -> 'prazo')
                else jsonb_build_object('aberta', false, 'prazo', coalesce(x.antes -> 'prazo', 'null'::jsonb))
           end as depois,
           case when x.janela ->> 'prazo' ~ '^\d{4}-\d{2}-\d{2}$' then (x.janela ->> 'prazo')::date - p_hoje end as dias
      from atual x
  ),
  eventos as (
    select n.user_id, n.chave, left(coalesce(n.janela ->> 'titulo', n.titulo_antes), 300) as titulo,
           e.evento, e.antes, e.depois, e.referencia
      from novo n
     cross join lateral (values
       ('prazo', n.antes ->> 'prazo', n.depois ->> 'prazo', p_referencia,
        (n.antes ->> 'aberta') = 'true' and n.janela is not null and (n.antes -> 'prazo') is distinct from (n.depois -> 'prazo')),
       ('encerrada', n.antes ->> 'prazo', null, p_referencia,
        (n.antes ->> 'aberta') = 'true' and n.janela is null),
       ('reaberta', null, n.depois ->> 'prazo', p_referencia,
        (n.antes ->> 'aberta') = 'false' and n.janela is not null),
       ('fechando', n.janela ->> 'prazo', n.dias::text,
        'fechando:' || (n.janela ->> 'prazo') || ':' ||
          (case when n.dias <= 1 then 1 when n.dias <= 3 then 3 else 7 end)::text,
        n.dias between 0 and 7)
     ) as e(evento, antes, depois, referencia, ocorre)
     where e.ocorre
  ),
  gravados as (
    insert into public.oport_aviso (user_id, tipo, chave, evento, titulo, antes, depois, referencia)
    select user_id, 'janela', chave, evento, titulo, antes, depois, referencia from eventos
    on conflict do nothing
    returning 1
  ),
  retratos as (
    update public.oport_favorito f
       set estado = n.depois,
           titulo = left(coalesce(n.janela ->> 'titulo', f.titulo), 300),
           referencia = p_referencia,
           estado_em = now()
      from novo n
     where f.user_id = n.user_id and f.tipo = 'janela' and f.chave = n.chave
       and (f.estado is distinct from n.depois or f.referencia is distinct from p_referencia)
    returning 1
  )
  select (select count(*) from gravados), (select count(*) from retratos) into v_avisos, v_retratos;

  return jsonb_build_object('aplicada', true, 'avisos', v_avisos, 'retratos', v_retratos);
end $$;

revoke execute on function public.oport_gerar_avisos_janelas(text, date, jsonb) from public, anon, authenticated;
grant execute on function public.oport_gerar_avisos_janelas(text, date, jsonb) to service_role;


-- -----------------------------------------------------------------------------
-- Normas: novidades normativas escolhidas pelos administradores.
-- -----------------------------------------------------------------------------
create table if not exists public.oport_norma (
  id           bigint generated always as identity primary key,
  titulo       text not null check (length(titulo) between 3 and 300),
  orgao        text check (length(orgao) <= 200),
  publicada_em date not null,
  link         text not null check (link ~ '^https://[^[:space:]]+$' and length(link) <= 500),
  resumo       text check (length(resumo) <= 1000),
  temas        text[] not null default '{}'::text[],
  -- E-mail do administrador, como `decidido_por` em oport_acesso.
  criada_por   text,
  criada_em    timestamptz not null default now()
);

create index if not exists oport_norma_publicada_idx on public.oport_norma (publicada_em desc, id desc);

alter table public.oport_norma enable row level security;

revoke all on table public.oport_norma from anon, authenticated;
grant all on table public.oport_norma to service_role;
grant select on table public.oport_norma to authenticated;

drop policy if exists "norma: aprovados leem" on public.oport_norma;
create policy "norma: aprovados leem" on public.oport_norma
  for select to authenticated
  using ((select public.oport_aprovado()));


-- -----------------------------------------------------------------------------
-- Direito ao esquecimento (LGPD): alcança os itens seguidos e os avisos. Resto
-- idêntico ao de oport_6.
-- -----------------------------------------------------------------------------
create or replace function public.oport_esquecer(p_email text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n     integer;
  v_ids uuid[];
begin
  select array_agg(id) into v_ids from public.oport_acesso where email = p_email;

  delete from public.oport_evento where email = p_email;
  get diagnostics n = row_count;

  if v_ids is not null then
    delete from public.oport_notificacao where user_id = any(v_ids);
    delete from public.oport_preferencia where user_id = any(v_ids);
    delete from public.oport_aviso       where user_id = any(v_ids);
    delete from public.oport_favorito    where user_id = any(v_ids);
    delete from public.oport_membro      where user_id = any(v_ids);

    delete from public.oport_organizacao o
    where not exists (select 1 from public.oport_membro m where m.organizacao_id = o.id);
  end if;

  delete from public.oport_acesso where email = p_email;
  return n;
end $function$;

revoke execute on function public.oport_esquecer(text) from public, anon, authenticated;
grant execute on function public.oport_esquecer(text) to service_role;
