-- =============================================================================
-- oport_6 — Organização e tipo de agente
--
-- O Mapa servia a um perfil implícito: o da própria Ponte. O campo `aderente`
-- do catálogo v1.1 já vem calculado no radar contra `config/portfolios.json`,
-- que descreve as quatro carteiras da Ponte e mais ninguém. Para servir aos
-- doze tipos de agente que captam recurso público — município, OSC, empresa,
-- ICT, consórcio, cooperativa, startup, universidade, estado, pesquisador,
-- pessoa física —, o produto precisa saber QUEM está perguntando.
--
-- Duas tabelas e uma função:
--   1. `oport_organizacao` — a entidade e o que decide sua ELEGIBILIDADE:
--      tipo, UF, município. Não é preferência; é o que ela pode pleitear.
--   2. `oport_membro` — quem pertence a ela. Uma pessoa pode pertencer a
--      várias: é o caso da consultoria e do gabinete, que cuidam de uma
--      carteira de entidades.
--   3. `oport_criar_organizacao` — cria a entidade e o primeiro vínculo na
--      mesma transação.
--
-- O QUE ESTA MIGRAÇÃO NÃO FAZ, de propósito: mexer em `oport_preferencia`.
-- Temas, órgãos e naturezas continuam POR PESSOA. A decisão de 11/09/2026
-- (docs/superpowers/specs/aderente-decisao-privacidade.md) e o aviso de
-- privacidade publicado prometem que a escolha "serve só para destacar janelas
-- PARA ELA". Passá-la para a organização a tornaria visível aos colegas —
-- mudança de finalidade que exigiria novo consentimento, não migração.
--
-- Elegibilidade é da entidade; destaque de leitura é da pessoa.
--
-- Idempotente. Pré-requisito: oport_4.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A entidade.
--
-- Os doze tipos são os mesmos de `funding_intelligence/models.py`
-- (ORGANIZATION_TYPES) no radar, com a grafia idêntica. Não é coincidência nem
-- gosto: o catálogo v2 traz `eligibility.organization_types` com essas mesmas
-- cadeias, e o cruzamento precisa ser comparação de string. Qualquer tradução
-- aqui vira tabela de-para depois, e tabela de-para vira divergência.
-- -----------------------------------------------------------------------------
create table if not exists public.oport_organizacao (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (length(btrim(nome)) between 2 and 160),
  tipo           text not null check (tipo in (
                   'empresa', 'startup', 'osc', 'ict', 'universidade', 'municipio',
                   'estado', 'consorcio_publico', 'cooperativa', 'pesquisador',
                   'pessoa_fisica', 'outros'
                 )),
  -- Onde ela atua. O v2 traz `eligibility.geography` com siglas de UF e "BR";
  -- guardamos a UF da entidade e, quando for ente municipal, o código do IBGE.
  uf             text check (uf is null or uf ~ '^[A-Z]{2}$'),
  municipio_ibge text check (municipio_ibge is null or municipio_ibge ~ '^[0-9]{7}$'),
  -- Só dígitos: máscara é assunto de tela. Sem `unique` de propósito — duas
  -- unidades da mesma prefeitura podem declarar o mesmo CNPJ raiz, e recusar
  -- cadastro por isso seria adivinhar a estrutura administrativa de terceiros.
  cnpj           text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  criada_em      timestamptz not null default now(),
  criada_por     uuid references auth.users (id) on delete set null
);

create index if not exists oport_organizacao_tipo_idx on public.oport_organizacao (tipo);


-- -----------------------------------------------------------------------------
-- O vínculo. `papel` existe desde já porque acrescentar coluna de permissão
-- depois, com linhas em produção, obriga a escolher um padrão para quem já
-- estava — e o padrão seguro ('leitor') tiraria acesso de quem tinha.
-- -----------------------------------------------------------------------------
create table if not exists public.oport_membro (
  organizacao_id uuid not null references public.oport_organizacao (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  papel          text not null default 'dono' check (papel in ('dono', 'editor', 'leitor')),
  criado_em      timestamptz not null default now(),
  primary key (organizacao_id, user_id)
);

create index if not exists oport_membro_user_idx on public.oport_membro (user_id);


-- -----------------------------------------------------------------------------
-- A quais organizações a pessoa pertence.
--
-- SECURITY DEFINER não é conveniência: sem ele, a política de `oport_membro`
-- consultaria `oport_membro`, e o Postgres entra em recursão infinita de RLS.
-- A função não recebe identificador — lê `auth.uid()` por dentro. É a lição do
-- `oport_2`: função que aceita de quem chama o identificador de quem ele diz
-- ser acaba respondendo por terceiros.
-- -----------------------------------------------------------------------------
create or replace function public.oport_organizacoes_do_usuario()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select organizacao_id from public.oport_membro where user_id = (select auth.uid())
$$;

revoke execute on function public.oport_organizacoes_do_usuario() from public, anon;
grant execute on function public.oport_organizacoes_do_usuario() to authenticated, service_role;


-- ------------------------------------------------------------------ permissões
alter table public.oport_organizacao enable row level security;
alter table public.oport_membro      enable row level security;

-- O padrão do Supabase concede ALL a anon e authenticated em objeto novo do
-- schema public. Sem este revoke, as políticas abaixo seriam a única barreira.
revoke all on table public.oport_organizacao from anon, authenticated;
revoke all on table public.oport_membro      from anon, authenticated;

grant all on table public.oport_organizacao to service_role;
grant all on table public.oport_membro      to service_role;

-- Ler e atualizar pela sessão; criar passa pela função, que é quem sabe montar
-- entidade e vínculo na mesma transação.
grant select, update on table public.oport_organizacao to authenticated;
grant select          on table public.oport_membro      to authenticated;

drop policy if exists "organizacao: membro le" on public.oport_organizacao;
create policy "organizacao: membro le" on public.oport_organizacao
  for select to authenticated
  using (id in (select public.oport_organizacoes_do_usuario()));

-- Quem edita a ficha é dono ou editor. Leitor lê.
drop policy if exists "organizacao: dono ou editor muda" on public.oport_organizacao;
create policy "organizacao: dono ou editor muda" on public.oport_organizacao
  for update to authenticated
  using (
    (select public.oport_aprovado())
    and exists (
      select 1 from public.oport_membro m
      where m.organizacao_id = oport_organizacao.id
        and m.user_id = (select auth.uid())
        and m.papel in ('dono', 'editor')
    )
  )
  with check (id in (select public.oport_organizacoes_do_usuario()));

drop policy if exists "membro: ve os colegas" on public.oport_membro;
create policy "membro: ve os colegas" on public.oport_membro
  for select to authenticated
  using (organizacao_id in (select public.oport_organizacoes_do_usuario()));

-- Não há política de insert nem de delete para `authenticated`: entrar e sair
-- de organização é convite, e convite é a próxima fase. Enquanto não existir,
-- só a chave de serviço e a função abaixo mexem em vínculo.


-- -----------------------------------------------------------------------------
-- Cria a entidade e o primeiro vínculo na mesma transação.
--
-- Precisa ser função porque o passo 1 (a entidade) e o passo 2 (o vínculo que
-- torna quem criou seu dono) não cabem em RLS: no instante do insert do
-- vínculo, ainda não existe vínculo que autorize o insert do vínculo.
--
-- Devolve o id da organização criada.
-- -----------------------------------------------------------------------------
create or replace function public.oport_criar_organizacao(
  p_nome           text,
  p_tipo           text,
  p_uf             text default null,
  p_municipio_ibge text default null,
  p_cnpj           text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;

  -- A aprovação é conferida AQUI dentro, e não confiada à tela: função
  -- SECURITY DEFINER é endereço público da API.
  if not public.oport_aprovado() then
    raise exception 'acesso não aprovado' using errcode = '42501';
  end if;

  insert into public.oport_organizacao (nome, tipo, uf, municipio_ibge, cnpj, criada_por)
  values (btrim(p_nome), p_tipo, nullif(btrim(upper(coalesce(p_uf, ''))), ''),
          nullif(btrim(coalesce(p_municipio_ibge, '')), ''),
          nullif(regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g'), ''),
          v_uid)
  returning id into v_id;

  insert into public.oport_membro (organizacao_id, user_id, papel)
  values (v_id, v_uid, 'dono');

  return v_id;
end $$;

revoke execute on function public.oport_criar_organizacao(text, text, text, text, text)
  from public, anon;
grant execute on function public.oport_criar_organizacao(text, text, text, text, text)
  to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- Direito ao esquecimento (LGPD) — agora alcança o vínculo.
--
-- A organização em si NÃO é apagada por tabela: ela pode ter colegas que
-- continuam usando, e apagar o que é de outros não é esquecimento, é dano.
-- Apaga-se a organização apenas quando ninguém mais pertence a ela — aí é
-- dado órfão, sem dono e sem uso.
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
    delete from public.oport_membro       where user_id = any(v_ids);

    delete from public.oport_organizacao o
    where not exists (select 1 from public.oport_membro m where m.organizacao_id = o.id);
  end if;

  delete from public.oport_acesso where email = p_email;
  return n;
end $function$;

revoke execute on function public.oport_esquecer(text) from public, anon, authenticated;
grant execute on function public.oport_esquecer(text) to service_role;
