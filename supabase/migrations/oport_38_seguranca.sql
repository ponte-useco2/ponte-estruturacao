-- =============================================================================
-- oport_38 — Travas do banco da revisão R3 (onda 7, D, 09/10/2026)
--
-- A revisão de privacidade e segurança da onda 6 (`ux-onda6/R3-privacidade-seguranca.md`, seção 2) deixou três
-- melhorias que moram no banco. Nenhuma expõe dado de terceiro hoje; cada uma fecha uma porta que a API pública
-- (`/rest/v1`, com a sessão do próprio usuário) deixa aberta por fora das server actions.
--
--   M3. `oport_organizacao` concedia UPDATE de TODAS as colunas a `authenticated`, inclusive `id`, `criada_por`
--       e `criada_em`. Passa a conceder só `nome`, `tipo`, `uf`, `municipio_ibge` e `cnpj`. Não quebra nada: o
--       site não atualiza a organização pela sessão (cria pela `oport_criar_organizacao` e lê pela chave de
--       serviço; conferido em `conta/organizacao/acoes.ts`, `organizacao.server.ts` e `cliente.server.ts`).
--
--   M4. `oport_favorito` aceitava `titulo`, `estado` e `referencia` de quem grava, para `tipo = 'janela'`.
--       Quem chamasse a API direto gravava qualquer título e qualquer `jsonb` (sem limite de tamanho) na própria
--       linha, e o retrato forjado virava aviso. O gatilho passa a tirar os três de um retrato que só o banco
--       escreve (`oport_janela_retrato`), como já fazia com convênio e proposta a partir do painel.
--
--       Por que não basta ignorar: a server action `seguir` (`app/mapa/acoes.ts`) grava pela SESSÃO, com o
--       título e o retrato montados no servidor a partir do catálogo. Para o banco, ela e uma chamada forjada
--       são o mesmo `authenticated` com o mesmo token: não há como aceitar uma e recusar a outra. Ignorar tudo
--       deixaria a estrela sem título até a sincronização seguinte e, se a janela fechasse antes, sem título
--       para sempre e sem o aviso de "encerrada". Revogar a coluna quebraria a ação (permissão negada). Por
--       isso o banco guarda o próprio retrato das janelas, renovado a cada sincronização por
--       `oport_gerar_avisos_janelas` (o mesmo `p_abertas` que o site já manda), e o gatilho copia dele.
--       Janela que o banco ainda não viu (catálogo novo antes da sincronização) entra sem título nem retrato,
--       e a sincronização seguinte preenche, como já fazia.
--
--   M6. `oport_evento` (registro de uso, com e-mail) não tinha prazo de guarda. `oport_evento_limpar(p_meses)`
--       apaga o que passou do prazo, em lotes, dentro dos 8 s do tempo-limite da API, e só a chave de serviço
--       executa. NÃO há agendamento: o prazo é decisão do titular (a R3 sugere 24 meses), e a política de
--       privacidade tem de dizer o mesmo número antes de a limpeza rodar sozinha.
--
-- Trava de versão: as duas funções da oport_15 são recriadas inteiras. Antes, o corpo em produção é comparado
-- com o da oport_15 (md5 sem `\r`, lido no catálogo em 09/10/2026). Se outra migração mudou uma delas, esta
-- para com erro, em vez de desfazer a mudança.
--
-- Idempotente: rodar de novo não muda nada. RLS preservada: nenhuma política é criada, trocada ou removida.
-- Pré-requisitos: oport_1 (oport_evento), oport_6 (oport_organizacao) e oport_15 (oport_favorito e as duas
-- funções). Conferência depois de aplicar: `ux-onda7/D-seguranca.md`, seção "Roteiro pelo MCP".
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Trava de versão, antes de qualquer mudança. Depois da 1ª aplicação, as duas funções já citam
-- `oport_janela_retrato`, e a trava deixa passar a 2ª.
-- -----------------------------------------------------------------------------
do $$
declare
  v_src text;
begin
  select replace(p.prosrc, E'\r', '') into v_src
    from pg_proc p
   where p.oid = 'public.oport_gerar_avisos_janelas(text, date, jsonb)'::regprocedure;
  if position('oport_janela_retrato' in v_src) = 0 and md5(v_src) <> '0b731bc4582b9f05ab9b2a5ac1a5d80a' then
    raise exception 'oport_gerar_avisos_janelas mudou desde a oport_15: rever a oport_38 antes de aplicar';
  end if;

  select replace(p.prosrc, E'\r', '') into v_src
    from pg_proc p
   where p.oid = 'public.oport_favorito_preparar()'::regprocedure;
  if position('oport_janela_retrato' in v_src) = 0 and md5(v_src) <> '3b8bea2cbf89c96d99c3996752f8f2f1' then
    raise exception 'oport_favorito_preparar mudou desde a oport_15: rever a oport_38 antes de aplicar';
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- M3. UPDATE da organização só nas colunas que a pessoa pode editar.
--
-- Revogar no nível da tabela revoga também as concessões por coluna; por isso a ordem é revogar e conceder, e
-- rodar de novo chega ao mesmo estado. A política "organizacao: dono ou editor muda" continua decidindo QUAIS
-- linhas; a concessão decide QUAIS colunas.
-- -----------------------------------------------------------------------------
alter table public.oport_organizacao enable row level security;

revoke update on table public.oport_organizacao from anon, authenticated;
grant update (nome, tipo, uf, municipio_ibge, cnpj) on table public.oport_organizacao to authenticated;


-- -----------------------------------------------------------------------------
-- M4. O retrato das janelas, escrito só pelo banco.
--
-- Uma linha por janela que já apareceu aberta numa sincronização. `aberta` diz se estava aberta na última;
-- `aberta_em` é a última vez que esteve. A que fechou fica com o último título e prazo (seguir janela recém-
-- fechada continua tendo nome) e sai 400 dias depois de fechar, o prazo dos avisos.
--
-- Não é dado pessoal: título e prazo do catálogo público. Ainda assim, só a chave de serviço e as funções
-- SECURITY DEFINER leem: ninguém precisa da tabela pela API.
-- -----------------------------------------------------------------------------
create table if not exists public.oport_janela_retrato (
  chave      text primary key,
  titulo     text not null check (length(titulo) <= 300),
  prazo      text check (prazo is null or prazo ~ '^\d{4}-\d{2}-\d{2}$'),
  aberta     boolean not null,
  referencia text not null check (length(referencia) <= 80),
  aberta_em  timestamptz not null default now()
);

alter table public.oport_janela_retrato enable row level security;

revoke all on table public.oport_janela_retrato from public, anon, authenticated;
grant all on table public.oport_janela_retrato to service_role;


-- -----------------------------------------------------------------------------
-- Geração dos avisos das janelas: o corpo da oport_15 sem mudança, mais o bloco que renova o retrato.
--
-- O bloco tem o próprio tratamento de erro: se o retrato falhar, fica um aviso no log do banco e os avisos
-- das pessoas saem como antes. Catálogo vazio continua não fechando nada (a saída antecipada vem antes).
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

  -- O retrato das janelas que o gatilho da estrela copia (oport_38, M4). Chave fora do formato de
  -- `oport_favorito.chave` e janela sem título não entram: nunca seriam seguidas.
  begin
    insert into public.oport_janela_retrato (chave, titulo, prazo, aberta, referencia, aberta_em)
    select j.key,
           left(btrim(j.value ->> 'titulo'), 300),
           case when j.value ->> 'prazo' ~ '^\d{4}-\d{2}-\d{2}$' then j.value ->> 'prazo' end,
           true,
           left(p_referencia, 80),
           now()
      from jsonb_each(p_abertas) j
     where j.key ~ '^[A-Za-z0-9._-]{1,160}$'
       and jsonb_typeof(j.value) = 'object'
       and coalesce(btrim(j.value ->> 'titulo'), '') <> ''
    on conflict (chave) do update
       set titulo = excluded.titulo,
           prazo = excluded.prazo,
           aberta = true,
           referencia = excluded.referencia,
           aberta_em = excluded.aberta_em;

    update public.oport_janela_retrato r
       set aberta = false,
           referencia = left(p_referencia, 80)
     where r.aberta and not (p_abertas ? r.chave);

    delete from public.oport_janela_retrato
     where not aberta and aberta_em < now() - interval '400 days';
  exception when others then
    raise warning 'oport_janela_retrato não foi renovado: %', sqlerrm;
  end;

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
-- Antes de gravar a estrela: o corpo da oport_15, com o ramo da janela trocado.
--
-- Janela: título, retrato e referência saem de `oport_janela_retrato`; o que veio na gravação é descartado,
-- venha da server action ou da API. Janela que o banco não conhece fica com os três nulos, e a próxima
-- sincronização preenche. Convênio, proposta, município e entidade: sem mudança (o painel, pela
-- `oport_estado_painel`).
--
-- As colunas `titulo`, `estado` e `referencia` continuam na concessão de INSERT a `authenticated` de propósito:
-- a server action as manda, e tirá-las faria a gravação dela falhar por permissão.
-- -----------------------------------------------------------------------------
create or replace function public.oport_favorito_preparar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_execucao   public.painel_execucao;
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

-- O gatilho `oport_favorito_preparar` da oport_15 já aponta para esta função: não é recriado, para não
-- haver instante sem ele.
revoke execute on function public.oport_favorito_preparar() from public, anon, authenticated;

alter table public.oport_favorito enable row level security;


-- -----------------------------------------------------------------------------
-- M6. Prazo de guarda do registro de uso.
--
-- Apaga, do mais antigo para o mais novo, os eventos com mais de `p_meses` meses, em lotes de 5.000, e para
-- com 5 s de trabalho: a chamada pela API tem 8 s. Devolve quantos apagou e se sobrou (`restam`); com
-- `restam = true`, chamar de novo. O índice em `criado_em` é o que faz cada lote achar o seu pedaço sem ler a
-- tabela inteira.
--
-- SECURITY INVOKER: quem chama precisa poder apagar em `oport_evento`, e só a chave de serviço pode (oport_2).
-- Prazo abaixo de 1 mês é recusado: zero apagaria tudo, e isso não é guarda, é esquecimento (`oport_esquecer`).
-- -----------------------------------------------------------------------------
create index if not exists oport_evento_criado_idx on public.oport_evento (criado_em);

create or replace function public.oport_evento_limpar(p_meses integer default 24)
returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_lote   constant integer  := 5000;
  v_folga  constant interval := interval '5 seconds';
  v_inicio timestamptz := clock_timestamp();
  v_corte  timestamptz;
  v_n      integer;
  v_total  bigint := 0;
  v_restam boolean := false;
begin
  if p_meses is null or p_meses < 1 then
    raise exception 'prazo de guarda inválido: % meses (mínimo 1)', p_meses using errcode = 'invalid_parameter_value';
  end if;
  v_corte := now() - make_interval(months => p_meses);

  loop
    delete from public.oport_evento
     where id in (select e.id from public.oport_evento e where e.criado_em < v_corte order by e.criado_em limit v_lote);
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    exit when v_n < v_lote;
    if clock_timestamp() - v_inicio > v_folga then
      v_restam := true;
      exit;
    end if;
  end loop;

  return jsonb_build_object('meses', p_meses, 'corte', v_corte, 'apagados', v_total, 'restam', v_restam);
end $$;

revoke execute on function public.oport_evento_limpar(integer) from public, anon, authenticated;
grant execute on function public.oport_evento_limpar(integer) to service_role;
