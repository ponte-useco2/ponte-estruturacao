-- =============================================================================
-- oport_59 — Salas que gravam: a sala do Pablo (30/10/2026)
--
-- As salas de hoje (`/sala/<slug>`) são material de leitura atrás de uma senha. A sala do Pablo (`/sala/pablo`,
-- parceria PONTE × Pablo Forlan) GRAVA: Pablo cadastra demandas, muda a prioridade dos objetos, valida entregas, e cada
-- mudança guarda quem fez e quando. Por isso: login por pessoa (Supabase Auth, o mesmo Google do portal) e uma lista de
-- membros por sala. Decisão do titular (30/10): o Pablo entra SÓ na sala — a conta dele não é aprovada no portal
-- (`oport_acesso`), e ser membro da sala não depende dessa aprovação. A marca `sala_membro.so_sala` trava isso no banco:
-- aprovar no portal uma conta só de sala é recusado (gatilho em `oport_acesso`).
--
-- Adendo 1 (mesma data, pedidos do titular): pedido de melhoria no pé de toda página (só a PONTE responde); links e
-- arquivos por projeto (arquivo no bucket privado `salas`, até 25 MB, tipos fechados, download por link assinado;
-- retirar esconde e mantém o registro; apagar os bytes só a PONTE, com motivo); Pablo cadastra projeto (próximo PB-nn,
-- fim da ordem, nome sem repetir).
--
-- Desenho combinado com a sessão de Grafos (PONTE Graph Builder), que fez o protótipo:
--   - as tabelas são genéricas por sala (coluna `sala`);
--   - o membro é a CONTA (`auth.users.id`), nunca o e-mail;
--   - quem está logado só LÊ as tabelas, pela RLS (`sala_eh_membro`). Não há INSERT, UPDATE nem DELETE pela API em
--     nenhuma delas: toda escrita passa por uma função por ato (`sala_demanda_combinar`, `sala_validar`…), que confere o
--     membro, a transição de estado e a versão da linha, faz a mudança e grava o evento NA MESMA TRANSAÇÃO. Sem isso, um
--     membro com o próprio token faria UPDATE direto e pularia a regra e o histórico;
--   - `sala_evento` só cresce: nenhuma função apaga ou edita evento;
--   - texto livre tem teto de tamanho e é recusado com forma de CPF, telefone, e-mail ou valor em R$ (a sala não guarda
--     dado pessoal nem financeiro). A mesma regra está em `web/src/lib/oportunidades/sala-escrita.ts`, que dá o aviso
--     antes de chegar aqui; esta é a guarda.
--   - concorrência: cada ato sobre uma linha recebe o `atualizado_em` que a tela leu e recusa se a linha mudou.
--
-- Regras de negócio (BRIEF da sessão de Grafos, D-12 de 30/10 "Pablo define a prioridade, Jonathan propõe a data"):
--   recebida → combinada → andamento → validacao → concluida; qualquer aberta → cancelada (com motivo).
--   A data combinada nasce no "combinar" e depois só muda por "rever data", com motivo, guardando a anterior.
--   Classificar/priorizar nunca toca data combinada, responsável nem estado. Mover objeto só troca a ordem.
--
-- Membros e carga inicial: o titular insere no SQL Editor (DML dele); o roteiro está no fim deste arquivo, comentado.
--
-- ORDEM: aplicar ANTES de o código do site chegar à `main` (a página lê estas tabelas). Idempotente. Sem pré-requisito.
-- =============================================================================

create table if not exists public.sala_membro (
  sala       text not null check (sala ~ '^[a-z0-9-]{2,40}$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  papel      text not null check (papel in ('cliente', 'ponte')),
  nome       text not null check (char_length(nome) between 1 and 80),   -- como aparece no histórico
  -- Conta SÓ de sala (o Pablo): nunca pode ser aprovada no portal (`oport_acesso`), então não abre /mapa nem
  -- /plataforma/app. A trava está nos dois lados, nos gatilhos `sala_guarda_so_sala_*` abaixo.
  so_sala    boolean not null default false,
  criado_em  timestamptz not null default now(),
  primary key (sala, user_id)
);

create table if not exists public.sala_objeto (
  sala           text not null,
  id             text not null check (id ~ '^[A-Z]{2}-[0-9]{2}$'),
  -- nome, nomes_anteriores, iniciativa, organizacao, fase, papeis, papel_pablo, papel_ponte, instrumento, resumo,
  -- documentos[], relacoes[], fonte, confirmado_em (como o protótipo)
  dados          jsonb not null,
  ordem          integer not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid,
  primary key (sala, id)
);

create table if not exists public.sala_demanda (
  sala                text not null,
  id                  text not null,
  objeto              text not null,                           -- 'PB-0n' ou 'A_CLASSIFICAR'
  estado              text not null check (estado in ('recebida', 'combinada', 'andamento', 'validacao', 'concluida', 'cancelada')),
  titulo              text not null,
  descricao           text not null default '',
  prioridade          text not null default 'normal' check (prioridade in ('alta', 'normal', 'baixa')),
  data_desejada       date,
  data_combinada      date,
  responsavel         text check (responsavel in ('PONTE', 'Pablo', 'Terceiro')),   -- nulo = a definir
  criterio            text not null default '',
  referencia          text not null default '',
  dependencia         jsonb,                                   -- {de, quem, acompanha, ultimo_contato, proximo_contato}
  entrega             jsonb,                                   -- {descricao, versao, em, por}
  validacao           jsonb,                                   -- {resultado, comentario, em, por}
  datas_anteriores    jsonb not null default '[]'::jsonb,      -- [{data, ate, motivo}]
  motivo_cancelamento text,
  origem              text not null default 'sala',
  autor_rotulo        text,                                    -- só na carga inicial
  criado_em           timestamptz not null default now(),
  criado_por          uuid,
  atualizado_em       timestamptz not null default now(),
  atualizado_por      uuid,
  primary key (sala, id)
);

create table if not exists public.sala_decisao (
  sala            text not null,
  id              text not null,
  objeto          text not null,
  questao         text not null,
  alternativas    jsonb not null default '[]'::jsonb,
  decisor         text not null check (decisor in ('Pablo', 'Jonathan', 'Pablo e Jonathan', 'Terceiro')),
  estado          text not null check (estado in ('aberta', 'decidida')),
  decisao         text not null default '',
  efeito          text not null default '',
  autor_rotulo    text,
  decidido_rotulo text,
  criado_em       timestamptz not null default now(),
  criado_por      uuid,
  decidido_em     timestamptz,
  decidido_por    uuid,
  primary key (sala, id)
);

create table if not exists public.sala_reuniao (
  sala              text not null,
  data              date not null,
  pauta             jsonb not null default '[]'::jsonb,
  trabalho_da_manha jsonb not null default '[]'::jsonb,
  decisoes_tomadas  jsonb not null default '[]'::jsonb,
  compromissos      jsonb not null default '[]'::jsonb,
  notas             text not null default '',
  criado_em         timestamptz not null default now(),
  criado_por        uuid,
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid,
  primary key (sala, data)
);

create table if not exists public.sala_evento (
  id           bigint generated always as identity primary key,
  sala         text not null,
  quando       timestamptz not null default now(),
  quem         uuid,                     -- a conta; nulo só na carga inicial
  autor_rotulo text,                     -- só na carga inicial
  tipo         text not null,
  alvo         text not null,            -- 'demandas/<id>', 'decisoes/<id>', 'objetos/<id>', 'reunioes/<data>'
  objeto       text,
  antes        jsonb,
  depois       jsonb,
  motivo       text
);
-- Adendo 1 (30/10): pedido de melhoria em toda página da sala; links e arquivos enviados por projeto.
create table if not exists public.sala_melhoria (
  sala           text not null,
  id             text not null,
  pagina         text not null,          -- 'atencao' | 'carteira' | 'reunioes' | 'historico' | 'PB-01'…
  texto          text not null,
  estado         text not null default 'recebida' check (estado in ('recebida', 'em_analise', 'feita', 'nao_sera_feita')),
  resposta       text not null default '',
  criado_em      timestamptz not null default now(),
  criado_por     uuid,
  respondido_em  timestamptz,
  respondido_por uuid,
  primary key (sala, id)
);

create table if not exists public.sala_envio (
  sala            text not null,
  id              text not null,
  objeto          text not null,
  tipo            text not null check (tipo in ('link', 'arquivo')),
  titulo          text not null,
  nota            text not null default '',
  url             text check (url is null or url ~* '^https?://'),
  caminho_storage text,                  -- bucket 'salas': <sala>/<objeto>/<id>/<nome>
  nome_arquivo    text,
  tipo_conteudo   text,
  tamanho         bigint check (tamanho is null or tamanho <= 26214400),
  sha256          text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),   -- calculado no navegador
  estado          text not null default 'ativo' check (estado in ('ativo', 'retirado')),
  retirado_motivo text,
  retirado_em     timestamptz,
  retirado_por    uuid,
  arquivo_apagado boolean not null default false,
  apagado_motivo  text,
  apagado_em      timestamptz,
  apagado_por     uuid,
  criado_em       timestamptz not null default now(),
  criado_por      uuid,
  primary key (sala, id),
  check ((tipo = 'link' and url is not null and caminho_storage is null)
      or (tipo = 'arquivo' and caminho_storage is not null and url is null))
);

create index if not exists sala_evento_sala_quando_idx on public.sala_evento (sala, quando desc);
create index if not exists sala_demanda_sala_objeto_idx on public.sala_demanda (sala, objeto);

-- -----------------------------------------------------------------------------
-- Quem é membro. `security definer` para ler `sala_membro` dentro das políticas sem recursão.
-- -----------------------------------------------------------------------------
create or replace function public.sala_eh_membro(p_sala text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.sala_membro m where m.sala = p_sala and m.user_id = auth.uid());
$$;

alter table public.sala_membro  enable row level security;
alter table public.sala_objeto  enable row level security;
alter table public.sala_demanda enable row level security;
alter table public.sala_decisao enable row level security;
alter table public.sala_reuniao enable row level security;
alter table public.sala_evento  enable row level security;
alter table public.sala_melhoria enable row level security;
alter table public.sala_envio    enable row level security;

drop policy if exists sala_melhoria_ler on public.sala_melhoria;
drop policy if exists sala_envio_ler    on public.sala_envio;
create policy sala_melhoria_ler on public.sala_melhoria for select to authenticated using ((select public.sala_eh_membro(sala)));
create policy sala_envio_ler    on public.sala_envio    for select to authenticated using ((select public.sala_eh_membro(sala)));
revoke all on table public.sala_melhoria, public.sala_envio from public, anon, authenticated;
grant select on table public.sala_melhoria, public.sala_envio to authenticated;
grant all on table public.sala_melhoria, public.sala_envio to service_role;

drop policy if exists sala_membro_ler  on public.sala_membro;
drop policy if exists sala_objeto_ler  on public.sala_objeto;
drop policy if exists sala_demanda_ler on public.sala_demanda;
drop policy if exists sala_decisao_ler on public.sala_decisao;
drop policy if exists sala_reuniao_ler on public.sala_reuniao;
drop policy if exists sala_evento_ler  on public.sala_evento;
-- O membro vê os nomes dos outros membros da mesma sala (o histórico mostra quem fez); `sala_membro` não tem e-mail.
create policy sala_membro_ler  on public.sala_membro  for select to authenticated using ((select public.sala_eh_membro(sala)));
create policy sala_objeto_ler  on public.sala_objeto  for select to authenticated using ((select public.sala_eh_membro(sala)));
create policy sala_demanda_ler on public.sala_demanda for select to authenticated using ((select public.sala_eh_membro(sala)));
create policy sala_decisao_ler on public.sala_decisao for select to authenticated using ((select public.sala_eh_membro(sala)));
create policy sala_reuniao_ler on public.sala_reuniao for select to authenticated using ((select public.sala_eh_membro(sala)));
create policy sala_evento_ler  on public.sala_evento  for select to authenticated using ((select public.sala_eh_membro(sala)));

-- Só leitura pela API; nada para `anon`. A escrita é das funções abaixo (dono: postgres).
revoke all on table public.sala_membro, public.sala_objeto, public.sala_demanda, public.sala_decisao, public.sala_reuniao,
  public.sala_evento from public, anon, authenticated;
grant select on table public.sala_membro, public.sala_objeto, public.sala_demanda, public.sala_decisao, public.sala_reuniao,
  public.sala_evento to authenticated;
grant all on table public.sala_membro, public.sala_objeto, public.sala_demanda, public.sala_decisao, public.sala_reuniao,
  public.sala_evento to service_role;

revoke execute on function public.sala_eh_membro(text) from public, anon;
grant  execute on function public.sala_eh_membro(text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Auxiliares (internas: sem grant para `authenticated`). As mensagens começam com "sala: " — a página mostra o texto
-- depois do prefixo; qualquer outro erro vira uma mensagem genérica.
-- -----------------------------------------------------------------------------
create or replace function public.sala_exigir_membro(p_sala text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.sala_eh_membro(p_sala) then
    raise exception 'sala: esta conta não é membro da sala.' using errcode = '42501';
  end if;
end;
$$;

-- Texto livre: apara, exige quando obrigatório, limita o tamanho e recusa dado pessoal ou financeiro.
create or replace function public.sala_texto(p_valor text, p_rotulo text, p_max integer, p_obrigatorio boolean default false)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text := btrim(coalesce(p_valor, ''));
begin
  if p_obrigatorio and v = '' then
    raise exception 'sala: preencha %.', p_rotulo;
  end if;
  if char_length(v) > p_max then
    raise exception 'sala: % passa de % caracteres.', p_rotulo, p_max;
  end if;
  -- CPF (com ou sem pontuação; 11 dígitos soltos), telefone (com DDD entre parênteses ou com hífen no número), e-mail
  -- e valor em R$. CNPJ (14 dígitos) e números de processo passam.
  if v ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' or v ~ '(^|[^0-9./-])\d{11}([^0-9./-]|$)' then
    raise exception 'sala: % parece ter um CPF. A sala não guarda documento pessoal.', p_rotulo;
  end if;
  -- O celular sem DDD precisa do 9 na frente: "2024-2025" é período, não telefone.
  if v ~ '\(\d{2}\)\s*9?\d{4}[-\s.]?\d{4}' or v ~ '(^|[^0-9])9\d{4}-\d{4}([^0-9]|$)' or v ~ '\+55\s?\d' then
    raise exception 'sala: % parece ter um telefone. A sala não guarda contato pessoal.', p_rotulo;
  end if;
  if v ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    raise exception 'sala: % parece ter um e-mail. A sala não guarda contato pessoal.', p_rotulo;
  end if;
  if v ~* 'R\$\s*\d' then
    raise exception 'sala: % tem um valor em R$. A sala não registra valores financeiros.', p_rotulo;
  end if;
  return v;
end;
$$;

-- Lista de linhas (pauta, alternativas…): cada item passa por `sala_texto`; vazios saem.
create or replace function public.sala_lista(p_itens text[], p_rotulo text, p_max_itens integer, p_max integer)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  saida jsonb := '[]'::jsonb;
  item text;
begin
  foreach item in array coalesce(p_itens, '{}'::text[]) loop
    item := public.sala_texto(item, p_rotulo, p_max);
    if item <> '' then
      saida := saida || to_jsonb(item);
    end if;
  end loop;
  if jsonb_array_length(saida) > p_max_itens then
    raise exception 'sala: % passa de % itens.', p_rotulo, p_max_itens;
  end if;
  return saida;
end;
$$;

create or replace function public.sala_exigir_objeto(p_sala text, p_objeto text, p_aceita_classificar boolean default true)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_aceita_classificar and p_objeto = 'A_CLASSIFICAR' then
    return;
  end if;
  if not exists (select 1 from public.sala_objeto o where o.sala = p_sala and o.id = p_objeto) then
    raise exception 'sala: objeto % não existe nesta sala.', coalesce(p_objeto, '(vazio)');
  end if;
end;
$$;

-- Trava a demanda para o ato e confere a versão lida pela tela. Devolve a linha travada.
create or replace function public.sala_demanda_travar(p_sala text, p_id text, p_versao timestamptz, p_estados text[])
returns public.sala_demanda
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.sala_demanda;
begin
  perform public.sala_exigir_membro(p_sala);
  select * into d from public.sala_demanda where sala = p_sala and id = p_id for update;
  if not found then
    raise exception 'sala: demanda não encontrada.';
  end if;
  if p_versao is null or d.atualizado_em <> p_versao then
    raise exception 'sala: esta demanda mudou desde que a página foi aberta. Recarregue e tente de novo.' using errcode = '40001';
  end if;
  if not (d.estado = any (p_estados)) then
    raise exception 'sala: esta ação não vale para uma demanda %.', d.estado;
  end if;
  return d;
end;
$$;

create or replace function public.sala_registrar_evento(p_sala text, p_tipo text, p_alvo text, p_objeto text, p_antes jsonb,
  p_depois jsonb, p_motivo text default null)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.sala_evento (sala, quem, tipo, alvo, objeto, antes, depois, motivo)
  values (p_sala, auth.uid(), p_tipo, p_alvo, nullif(p_objeto, 'A_CLASSIFICAR'), p_antes, p_depois, nullif(p_motivo, ''));
$$;

create or replace function public.sala_novo_id(p_prefixo text)
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select p_prefixo || '-' || substr(md5(gen_random_uuid()::text), 1, 10);
$$;

-- -----------------------------------------------------------------------------
-- Atos sobre demandas
-- -----------------------------------------------------------------------------
create or replace function public.sala_demanda_registrar(p_sala text, p_titulo text, p_descricao text, p_objeto text,
  p_prioridade text, p_data_desejada date, p_referencia text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := public.sala_novo_id('d');
  v_titulo text;
begin
  perform public.sala_exigir_membro(p_sala);
  perform public.sala_exigir_objeto(p_sala, p_objeto);
  v_titulo := public.sala_texto(p_titulo, 'o que precisa acontecer', 300, true);
  if p_prioridade not in ('alta', 'normal', 'baixa') then
    raise exception 'sala: prioridade inválida.';
  end if;
  -- Nasce recebida, sem responsável e sem data combinada: a sala nunca inventa prazo.
  insert into public.sala_demanda (sala, id, objeto, estado, titulo, descricao, prioridade, data_desejada, referencia,
    criado_por, atualizado_por)
  values (p_sala, v_id, p_objeto, 'recebida', v_titulo, public.sala_texto(p_descricao, 'o detalhe', 4000), p_prioridade,
    p_data_desejada, public.sala_texto(p_referencia, 'a referência', 300), auth.uid(), auth.uid());
  perform public.sala_registrar_evento(p_sala, 'criou demanda', 'demandas/' || v_id, p_objeto, null,
    jsonb_build_object('estado', 'recebida', 'titulo', v_titulo));
  return v_id;
end;
$$;

create or replace function public.sala_demanda_combinar(p_sala text, p_id text, p_versao timestamptz, p_responsavel text,
  p_data_combinada date, p_criterio text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.sala_demanda := public.sala_demanda_travar(p_sala, p_id, p_versao, array['recebida']);
  v_criterio text := public.sala_texto(p_criterio, 'o critério de conclusão', 1000);
begin
  if p_responsavel not in ('PONTE', 'Pablo', 'Terceiro') then
    raise exception 'sala: escolha quem faz.';
  end if;
  update public.sala_demanda
     set estado = 'combinada', responsavel = p_responsavel, data_combinada = p_data_combinada, criterio = v_criterio,
         atualizado_em = now(), atualizado_por = auth.uid()
   where sala = p_sala and id = p_id;
  perform public.sala_registrar_evento(p_sala, 'combinou', 'demandas/' || p_id, d.objeto,
    jsonb_build_object('estado', d.estado, 'data_combinada', d.data_combinada),
    jsonb_build_object('estado', 'combinada', 'responsavel', p_responsavel, 'data_combinada', p_data_combinada,
      'criterio', v_criterio));
end;
$$;

create or replace function public.sala_demanda_iniciar(p_sala text, p_id text, p_versao timestamptz)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.sala_demanda := public.sala_demanda_travar(p_sala, p_id, p_versao, array['combinada']);
begin
  update public.sala_demanda set estado = 'andamento', atualizado_em = now(), atualizado_por = auth.uid()
   where sala = p_sala and id = p_id;
  perform public.sala_registrar_evento(p_sala, 'iniciou', 'demandas/' || p_id, d.objeto,
    jsonb_build_object('estado', d.estado), jsonb_build_object('estado', 'andamento'));
end;
$$;

create or replace function public.sala_demanda_entregar(p_sala text, p_id text, p_versao timestamptz, p_descricao text,
  p_versao_entrega text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.sala_demanda := public.sala_demanda_travar(p_sala, p_id, p_versao, array['combinada', 'andamento']);
  v_entrega jsonb := jsonb_build_object(
    'descricao', public.sala_texto(p_descricao, 'o que foi entregue', 2000, true),
    'versao', public.sala_texto(p_versao_entrega, 'a versão', 80),
    'em', now(), 'por', auth.uid());
begin
  update public.sala_demanda set estado = 'validacao', entrega = v_entrega, atualizado_em = now(), atualizado_por = auth.uid()
   where sala = p_sala and id = p_id;
  perform public.sala_registrar_evento(p_sala, 'entregou para validação', 'demandas/' || p_id, d.objeto,
    jsonb_build_object('estado', d.estado), jsonb_build_object('estado', 'validacao', 'versao', v_entrega ->> 'versao'));
end;
$$;

create or replace function public.sala_demanda_validar(p_sala text, p_id text, p_versao timestamptz, p_resultado text,
  p_comentario text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.sala_demanda := public.sala_demanda_travar(p_sala, p_id, p_versao, array['validacao']);
  v_comentario text;
begin
  if p_resultado = 'aprovar' then
    v_comentario := public.sala_texto(p_comentario, 'o comentário', 2000);
    update public.sala_demanda
       set estado = 'concluida', atualizado_em = now(), atualizado_por = auth.uid(),
           validacao = jsonb_build_object('resultado', 'aprovada', 'comentario', v_comentario, 'em', now(), 'por', auth.uid())
     where sala = p_sala and id = p_id;
    perform public.sala_registrar_evento(p_sala, 'validou e concluiu', 'demandas/' || p_id, d.objeto,
      jsonb_build_object('estado', d.estado), jsonb_build_object('estado', 'concluida'), v_comentario);
  elsif p_resultado = 'ajuste' then
    -- Pedir ajuste exige dizer o quê, e devolve a demanda para Em andamento.
    v_comentario := public.sala_texto(p_comentario, 'o que precisa ser ajustado', 2000, true);
    update public.sala_demanda
       set estado = 'andamento', atualizado_em = now(), atualizado_por = auth.uid(),
           validacao = jsonb_build_object('resultado', 'ajuste', 'comentario', v_comentario, 'em', now(), 'por', auth.uid())
     where sala = p_sala and id = p_id;
    perform public.sala_registrar_evento(p_sala, 'pediu ajuste', 'demandas/' || p_id, d.objeto,
      jsonb_build_object('estado', d.estado), jsonb_build_object('estado', 'andamento'), v_comentario);
  else
    raise exception 'sala: escolha entre aprovar e pedir ajuste.';
  end if;
end;
$$;

create or replace function public.sala_demanda_rever_data(p_sala text, p_id text, p_versao timestamptz, p_nova date,
  p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.sala_demanda := public.sala_demanda_travar(p_sala, p_id, p_versao, array['combinada', 'andamento', 'validacao']);
  v_motivo text := public.sala_texto(p_motivo, 'o motivo', 1000, true);
begin
  if p_nova is not distinct from d.data_combinada then
    raise exception 'sala: a nova data é igual à combinada.';
  end if;
  update public.sala_demanda
     set data_combinada = p_nova,
         datas_anteriores = datas_anteriores || jsonb_build_array(jsonb_build_object('data', d.data_combinada, 'ate', now(),
           'motivo', v_motivo)),
         atualizado_em = now(), atualizado_por = auth.uid()
   where sala = p_sala and id = p_id;
  perform public.sala_registrar_evento(p_sala, 'reviu a data combinada', 'demandas/' || p_id, d.objeto,
    jsonb_build_object('data_combinada', d.data_combinada), jsonb_build_object('data_combinada', p_nova), v_motivo);
end;
$$;

-- `p_de` nulo retira a dependência.
create or replace function public.sala_demanda_dependencia(p_sala text, p_id text, p_versao timestamptz, p_de text,
  p_quem text, p_acompanha text, p_ultimo_contato date, p_proximo_contato date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.sala_demanda := public.sala_demanda_travar(p_sala, p_id, p_versao,
    array['recebida', 'combinada', 'andamento', 'validacao']);
  v_dep jsonb;
begin
  if p_de is not null then
    if p_de not in ('PONTE', 'Pablo', 'Terceiro') or p_acompanha not in ('PONTE', 'Pablo') then
      raise exception 'sala: escolha de quem depende e quem acompanha.';
    end if;
    v_dep := jsonb_build_object('de', p_de, 'quem', public.sala_texto(p_quem, 'quem é', 120), 'acompanha', p_acompanha,
      'ultimo_contato', p_ultimo_contato, 'proximo_contato', p_proximo_contato);
  end if;
  update public.sala_demanda set dependencia = v_dep, atualizado_em = now(), atualizado_por = auth.uid()
   where sala = p_sala and id = p_id;
  perform public.sala_registrar_evento(p_sala, case when v_dep is null then 'retirou dependência' else 'registrou dependência' end,
    'demandas/' || p_id, d.objeto, jsonb_build_object('dependencia', d.dependencia), jsonb_build_object('dependencia', v_dep));
end;
$$;

-- Classificar ou priorizar: título, objeto, prioridade e data desejada. Nunca toca data combinada, responsável ou estado.
create or replace function public.sala_demanda_classificar(p_sala text, p_id text, p_versao timestamptz, p_titulo text,
  p_objeto text, p_prioridade text, p_data_desejada date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.sala_demanda := public.sala_demanda_travar(p_sala, p_id, p_versao,
    array['recebida', 'combinada', 'andamento', 'validacao']);
  v_titulo text := public.sala_texto(p_titulo, 'o que precisa acontecer', 300, true);
begin
  perform public.sala_exigir_objeto(p_sala, p_objeto);
  if p_prioridade not in ('alta', 'normal', 'baixa') then
    raise exception 'sala: prioridade inválida.';
  end if;
  update public.sala_demanda
     set titulo = v_titulo, objeto = p_objeto, prioridade = p_prioridade, data_desejada = p_data_desejada,
         atualizado_em = now(), atualizado_por = auth.uid()
   where sala = p_sala and id = p_id;
  perform public.sala_registrar_evento(p_sala, 'classificou ou priorizou', 'demandas/' || p_id, p_objeto,
    jsonb_build_object('titulo', d.titulo, 'objeto', d.objeto, 'prioridade', d.prioridade, 'data_desejada', d.data_desejada),
    jsonb_build_object('titulo', v_titulo, 'objeto', p_objeto, 'prioridade', p_prioridade, 'data_desejada', p_data_desejada));
end;
$$;

create or replace function public.sala_demanda_cancelar(p_sala text, p_id text, p_versao timestamptz, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.sala_demanda := public.sala_demanda_travar(p_sala, p_id, p_versao,
    array['recebida', 'combinada', 'andamento', 'validacao']);
  v_motivo text := public.sala_texto(p_motivo, 'o motivo', 1000, true);
begin
  update public.sala_demanda set estado = 'cancelada', motivo_cancelamento = v_motivo, atualizado_em = now(),
         atualizado_por = auth.uid()
   where sala = p_sala and id = p_id;
  perform public.sala_registrar_evento(p_sala, 'cancelou', 'demandas/' || p_id, d.objeto,
    jsonb_build_object('estado', d.estado), jsonb_build_object('estado', 'cancelada'), v_motivo);
end;
$$;

-- -----------------------------------------------------------------------------
-- Objetos
-- -----------------------------------------------------------------------------
-- Sobe (-1) ou desce (+1) uma posição, trocando a ordem com o vizinho. Só a ordem muda.
create or replace function public.sala_objeto_mover(p_sala text, p_id text, p_direcao integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.sala_objeto;
  vizinho public.sala_objeto;
begin
  perform public.sala_exigir_membro(p_sala);
  if p_direcao not in (-1, 1) then
    raise exception 'sala: direção inválida.';
  end if;
  -- Trava a carteira inteira da sala: duas trocas ao mesmo tempo não embaralham a ordem.
  perform 1 from public.sala_objeto where sala = p_sala for update;
  select * into o from public.sala_objeto where sala = p_sala and id = p_id;
  if not found then
    raise exception 'sala: objeto não encontrado.';
  end if;
  if p_direcao < 0 then
    select * into vizinho from public.sala_objeto where sala = p_sala and ordem < o.ordem order by ordem desc limit 1;
  else
    select * into vizinho from public.sala_objeto where sala = p_sala and ordem > o.ordem order by ordem asc limit 1;
  end if;
  if not found then
    return;  -- já é o primeiro (ou o último)
  end if;
  update public.sala_objeto set ordem = vizinho.ordem, atualizado_em = now(), atualizado_por = auth.uid()
   where sala = p_sala and id = o.id;
  update public.sala_objeto set ordem = o.ordem, atualizado_em = now(), atualizado_por = auth.uid()
   where sala = p_sala and id = vizinho.id;
  perform public.sala_registrar_evento(p_sala, 'mudou a prioridade do objeto', 'objetos/' || o.id, o.id,
    jsonb_build_object('ordem', o.ordem), jsonb_build_object('ordem', vizinho.ordem, 'trocou_com', vizinho.id));
end;
$$;

create or replace function public.sala_objeto_atualizar(p_sala text, p_id text, p_versao timestamptz, p_fase text,
  p_resumo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.sala_objeto;
  v_resumo text := public.sala_texto(p_resumo, 'o resumo', 2000);
begin
  perform public.sala_exigir_membro(p_sala);
  select * into o from public.sala_objeto where sala = p_sala and id = p_id for update;
  if not found then
    raise exception 'sala: objeto não encontrado.';
  end if;
  if p_versao is null or o.atualizado_em <> p_versao then
    raise exception 'sala: este objeto mudou desde que a página foi aberta. Recarregue e tente de novo.' using errcode = '40001';
  end if;
  if p_fase not in ('Captação', 'Execução', 'Prestação de contas', 'A confirmar', 'Encerrado') then
    raise exception 'sala: fase inválida.';
  end if;
  update public.sala_objeto
     set dados = dados || jsonb_build_object('fase', p_fase, 'resumo', v_resumo), atualizado_em = now(),
         atualizado_por = auth.uid()
   where sala = p_sala and id = p_id;
  perform public.sala_registrar_evento(p_sala, 'atualizou o objeto', 'objetos/' || p_id, p_id,
    jsonb_build_object('fase', o.dados ->> 'fase', 'resumo', coalesce(o.dados ->> 'resumo', '')),
    jsonb_build_object('fase', p_fase, 'resumo', v_resumo));
end;
$$;

-- -----------------------------------------------------------------------------
-- Decisões
-- -----------------------------------------------------------------------------
create or replace function public.sala_decisao_abrir(p_sala text, p_questao text, p_alternativas text[], p_decisor text,
  p_objeto text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := public.sala_novo_id('q');
  v_questao text;
begin
  perform public.sala_exigir_membro(p_sala);
  perform public.sala_exigir_objeto(p_sala, p_objeto);
  v_questao := public.sala_texto(p_questao, 'a questão', 300, true);
  if p_decisor not in ('Pablo', 'Jonathan', 'Pablo e Jonathan', 'Terceiro') then
    raise exception 'sala: escolha quem decide.';
  end if;
  insert into public.sala_decisao (sala, id, objeto, questao, alternativas, decisor, estado, criado_por)
  values (p_sala, v_id, p_objeto, v_questao, public.sala_lista(p_alternativas, 'as alternativas', 10, 300), p_decisor,
    'aberta', auth.uid());
  perform public.sala_registrar_evento(p_sala, 'abriu decisão', 'decisoes/' || v_id, p_objeto, null,
    jsonb_build_object('questao', v_questao));
  return v_id;
end;
$$;

create or replace function public.sala_decisao_decidir(p_sala text, p_id text, p_decisao text, p_efeito text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  q public.sala_decisao;
  v_decisao text := public.sala_texto(p_decisao, 'a decisão', 1000, true);
  v_efeito text := public.sala_texto(p_efeito, 'o efeito', 1000);
begin
  perform public.sala_exigir_membro(p_sala);
  select * into q from public.sala_decisao where sala = p_sala and id = p_id for update;
  if not found then
    raise exception 'sala: decisão não encontrada.';
  end if;
  if q.estado <> 'aberta' then
    raise exception 'sala: esta decisão já foi tomada. Recarregue a página.' using errcode = '40001';
  end if;
  update public.sala_decisao
     set estado = 'decidida', decisao = v_decisao, efeito = v_efeito, decidido_em = now(), decidido_por = auth.uid()
   where sala = p_sala and id = p_id;
  perform public.sala_registrar_evento(p_sala, 'decidiu', 'decisoes/' || p_id, q.objeto,
    jsonb_build_object('estado', 'aberta'), jsonb_build_object('decisao', v_decisao));
end;
$$;

-- -----------------------------------------------------------------------------
-- Reuniões (uma por data). `p_versao` nulo = reunião nova; se ela já existir, recusa.
-- -----------------------------------------------------------------------------
create or replace function public.sala_reuniao_salvar(p_sala text, p_data date, p_versao timestamptz, p_pauta text[],
  p_trabalho_da_manha text[], p_decisoes_tomadas text[], p_compromissos text[], p_notas text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.sala_reuniao;
  v_pauta jsonb := public.sala_lista(p_pauta, 'a pauta', 40, 300);
  v_manha jsonb := public.sala_lista(p_trabalho_da_manha, 'o trabalho da manhã', 40, 300);
  v_decisoes jsonb := public.sala_lista(p_decisoes_tomadas, 'as decisões tomadas', 40, 300);
  v_compromissos jsonb := public.sala_lista(p_compromissos, 'os compromissos', 40, 300);
  v_notas text := public.sala_texto(p_notas, 'as notas', 4000);
begin
  perform public.sala_exigir_membro(p_sala);
  if p_data is null then
    raise exception 'sala: escolha a data da reunião.';
  end if;
  select * into r from public.sala_reuniao where sala = p_sala and data = p_data for update;
  if found then
    if p_versao is null or r.atualizado_em <> p_versao then
      raise exception 'sala: esta reunião mudou desde que a página foi aberta. Recarregue e tente de novo.' using errcode = '40001';
    end if;
    update public.sala_reuniao
       set pauta = v_pauta, trabalho_da_manha = v_manha, decisoes_tomadas = v_decisoes, compromissos = v_compromissos,
           notas = v_notas, atualizado_em = now(), atualizado_por = auth.uid()
     where sala = p_sala and data = p_data;
    perform public.sala_registrar_evento(p_sala, 'atualizou a reunião', 'reunioes/' || p_data, null, null,
      jsonb_build_object('data', p_data));
  else
    if p_versao is not null then
      raise exception 'sala: esta reunião não existe mais. Recarregue a página.' using errcode = '40001';
    end if;
    insert into public.sala_reuniao (sala, data, pauta, trabalho_da_manha, decisoes_tomadas, compromissos, notas,
      criado_por, atualizado_por)
    values (p_sala, p_data, v_pauta, v_manha, v_decisoes, v_compromissos, v_notas, auth.uid(), auth.uid());
    perform public.sala_registrar_evento(p_sala, 'abriu a reunião', 'reunioes/' || p_data, null, null,
      jsonb_build_object('data', p_data));
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Adendo 1: projeto novo, pedido de melhoria, links e arquivos
-- -----------------------------------------------------------------------------
create or replace function public.sala_exigir_ponte(p_sala text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.sala_membro m where m.sala = p_sala and m.user_id = auth.uid() and m.papel = 'ponte'
  ) then
    raise exception 'sala: só a PONTE faz isto.' using errcode = '42501';
  end if;
end;
$$;

-- Pablo cadastra projeto: nome sem repetir (sem diferença de maiúscula ou espaço), o próximo número (PB-09…) e o fim da
-- ordem. Nenhuma demanda muda.
create or replace function public.sala_objeto_cadastrar(p_sala text, p_nome text, p_organizacao text, p_fase text,
  p_instrumento text, p_papel_pablo text, p_papel_ponte text, p_resumo text, p_nome_anterior text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome text;
  v_prefixo text;
  v_num integer;
  v_ordem integer;
  v_id text;
  v_anterior text;
begin
  perform public.sala_exigir_membro(p_sala);
  v_nome := public.sala_texto(p_nome, 'o nome do projeto', 160, true);
  v_anterior := public.sala_texto(p_nome_anterior, 'o nome anterior', 160);
  if p_fase not in ('Captação', 'Execução', 'Prestação de contas', 'A confirmar') then
    raise exception 'sala: fase inválida.';
  end if;
  perform 1 from public.sala_objeto where sala = p_sala for update;   -- dois cadastros ao mesmo tempo não pegam o mesmo número
  if exists (select 1 from public.sala_objeto o where o.sala = p_sala
             and lower(regexp_replace(btrim(o.dados ->> 'nome'), '\s+', ' ', 'g')) = lower(regexp_replace(v_nome, '\s+', ' ', 'g'))) then
    raise exception 'sala: já existe um projeto com esse nome na carteira.';
  end if;
  select coalesce(max(left(id, 2)), 'PB'), coalesce(max(substr(id, 4)::integer), 0), coalesce(max(ordem), 0)
    into v_prefixo, v_num, v_ordem
    from public.sala_objeto where sala = p_sala;
  if v_num >= 99 then
    raise exception 'sala: a carteira chegou a 99 projetos; fale com a PONTE.';
  end if;
  v_id := v_prefixo || '-' || lpad((v_num + 1)::text, 2, '0');
  insert into public.sala_objeto (sala, id, dados, ordem, atualizado_por)
  values (p_sala, v_id, jsonb_build_object(
      'nome', v_nome,
      'nomes_anteriores', case when v_anterior = '' then '[]'::jsonb else jsonb_build_array(v_anterior) end,
      'iniciativa', v_nome,
      'organizacao', coalesce(nullif(public.sala_texto(p_organizacao, 'a organização', 120), ''), 'a confirmar'),
      'fase', p_fase,
      'instrumento', coalesce(nullif(public.sala_texto(p_instrumento, 'o instrumento', 200), ''), 'a confirmar'),
      'papeis', '{}'::jsonb,
      'papel_pablo', public.sala_texto(p_papel_pablo, 'o papel de Pablo', 160),
      'papel_ponte', coalesce(nullif(public.sala_texto(p_papel_ponte, 'o papel da PONTE', 160), ''), 'a confirmar'),
      'resumo', public.sala_texto(p_resumo, 'o resumo', 2000),
      'documentos', '[]'::jsonb,
      'relacoes', '[]'::jsonb,
      'fonte', 'cadastrado na sala'),
    v_ordem + 1, auth.uid());
  perform public.sala_registrar_evento(p_sala, 'cadastrou projeto', 'objetos/' || v_id, v_id, null,
    jsonb_build_object('id', v_id, 'nome', v_nome, 'ordem', v_ordem + 1));
  return v_id;
end;
$$;

-- Páginas da sala que recebem pedido de melhoria: as quatro abas e a ficha de cada projeto.
create or replace function public.sala_melhoria_pedir(p_sala text, p_pagina text, p_texto text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := public.sala_novo_id('m');
  v_texto text;
begin
  perform public.sala_exigir_membro(p_sala);
  if p_pagina not in ('atencao', 'carteira', 'reunioes', 'historico') then
    perform public.sala_exigir_objeto(p_sala, p_pagina, false);
  end if;
  v_texto := public.sala_texto(p_texto, 'o pedido', 2000, true);
  insert into public.sala_melhoria (sala, id, pagina, texto, criado_por) values (p_sala, v_id, p_pagina, v_texto, auth.uid());
  perform public.sala_registrar_evento(p_sala, 'pediu melhoria na sala', 'melhorias/' || v_id,
    case when p_pagina ~ '^[A-Z]{2}-[0-9]{2}$' then p_pagina end, null, jsonb_build_object('pagina', p_pagina));
  return v_id;
end;
$$;

create or replace function public.sala_melhoria_responder(p_sala text, p_id text, p_estado text, p_resposta text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sala_melhoria;
  v_resposta text;
begin
  perform public.sala_exigir_ponte(p_sala);
  v_resposta := public.sala_texto(p_resposta, 'a resposta', 2000);
  if p_estado not in ('recebida', 'em_analise', 'feita', 'nao_sera_feita') then
    raise exception 'sala: situação inválida.';
  end if;
  select * into m from public.sala_melhoria where sala = p_sala and id = p_id for update;
  if not found then
    raise exception 'sala: pedido não encontrado.';
  end if;
  update public.sala_melhoria set estado = p_estado, resposta = v_resposta, respondido_em = now(), respondido_por = auth.uid()
   where sala = p_sala and id = p_id;
  perform public.sala_registrar_evento(p_sala, 'respondeu pedido de melhoria', 'melhorias/' || p_id,
    case when m.pagina ~ '^[A-Z]{2}-[0-9]{2}$' then m.pagina end,
    jsonb_build_object('estado', m.estado), jsonb_build_object('estado', p_estado));
end;
$$;

create or replace function public.sala_envio_link(p_sala text, p_objeto text, p_url text, p_titulo text, p_nota text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := public.sala_novo_id('e');
  v_url text;
  v_titulo text;
begin
  perform public.sala_exigir_membro(p_sala);
  perform public.sala_exigir_objeto(p_sala, p_objeto, false);
  v_url := public.sala_texto(p_url, 'o endereço', 2000, true);
  if v_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'sala: só links que começam com https:// ou http://.';
  end if;
  v_titulo := public.sala_texto(p_titulo, 'o título', 200, true);
  insert into public.sala_envio (sala, id, objeto, tipo, titulo, nota, url, criado_por)
  values (p_sala, v_id, p_objeto, 'link', v_titulo, public.sala_texto(p_nota, 'a nota', 2000), v_url, auth.uid());
  perform public.sala_registrar_evento(p_sala, 'enviou link', 'envios/' || v_id, p_objeto, null,
    jsonb_build_object('titulo', v_titulo));
  return v_id;
end;
$$;

-- O arquivo sobe direto do navegador ao bucket privado `salas`, por um link de envio assinado que o servidor só gera
-- para membro. Depois, este registro confere que o objeto está lá, no caminho da sala e do projeto, com tamanho e tipo
-- aceitos (os mesmos do bucket), e grava o envio. O sha256 vem do navegador.
create or replace function public.sala_arquivo_registrar(p_sala text, p_objeto text, p_id text, p_caminho text,
  p_titulo text, p_nota text, p_nome text, p_sha256 text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_titulo text;
  v_nome text;
  v_tamanho bigint;
  v_tipo text;
begin
  perform public.sala_exigir_membro(p_sala);
  perform public.sala_exigir_objeto(p_sala, p_objeto, false);
  if p_id !~ '^e-[0-9a-f]{10}$' or p_caminho !~ ('^' || p_sala || '/' || p_objeto || '/' || p_id || '/[A-Za-z0-9._-]{1,120}$')
     or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'sala: envio de arquivo inválido. Tente de novo.';
  end if;
  v_titulo := public.sala_texto(p_titulo, 'o título', 200, true);
  v_nome := public.sala_texto(p_nome, 'o nome do arquivo', 200, true);
  select (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype' into v_tamanho, v_tipo
    from storage.objects o where o.bucket_id = 'salas' and o.name = p_caminho;
  if not found then
    raise exception 'sala: o arquivo não chegou ao armazenamento. Tente enviar de novo.';
  end if;
  if v_tamanho > 26214400 or v_tipo not in (select unnest(public.sala_tipos_arquivo())) then
    raise exception 'sala: tipo ou tamanho do arquivo fora do aceito.';
  end if;
  insert into public.sala_envio (sala, id, objeto, tipo, titulo, nota, caminho_storage, nome_arquivo, tipo_conteudo, tamanho,
    sha256, criado_por)
  values (p_sala, p_id, p_objeto, 'arquivo', v_titulo, public.sala_texto(p_nota, 'a nota', 2000), p_caminho, v_nome, v_tipo,
    v_tamanho, p_sha256, auth.uid());
  perform public.sala_registrar_evento(p_sala, 'enviou arquivo', 'envios/' || p_id, p_objeto, null,
    jsonb_build_object('titulo', v_titulo, 'sha256', left(p_sha256, 12)));
end;
$$;

-- Retirar esconde da ficha; o registro e o evento ficam.
create or replace function public.sala_envio_retirar(p_sala text, p_id text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.sala_envio;
  v_motivo text;
begin
  perform public.sala_exigir_membro(p_sala);
  v_motivo := public.sala_texto(p_motivo, 'o motivo', 1000, true);
  select * into e from public.sala_envio where sala = p_sala and id = p_id for update;
  if not found then
    raise exception 'sala: envio não encontrado.';
  end if;
  if e.estado <> 'ativo' then
    raise exception 'sala: este envio já foi retirado. Recarregue a página.' using errcode = '40001';
  end if;
  update public.sala_envio set estado = 'retirado', retirado_motivo = v_motivo, retirado_em = now(), retirado_por = auth.uid()
   where sala = p_sala and id = p_id;
  perform public.sala_registrar_evento(p_sala, 'retirou da ficha', 'envios/' || p_id, e.objeto,
    jsonb_build_object('estado', 'ativo'), jsonb_build_object('estado', 'retirado'), v_motivo);
end;
$$;

-- Apagar os bytes: só a PONTE, com motivo (dado pessoal enviado por engano). Dois passos, porque o arquivo sai pela API
-- do armazenamento: `sala_arquivo_para_apagar` confere e devolve o caminho; o servidor apaga; `sala_arquivo_apagado`
-- confere que o objeto saiu mesmo e só então marca e grava o evento.
create or replace function public.sala_arquivo_para_apagar(p_sala text, p_id text, p_motivo text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.sala_envio;
begin
  perform public.sala_exigir_ponte(p_sala);
  perform public.sala_texto(p_motivo, 'o motivo', 1000, true);
  select * into e from public.sala_envio where sala = p_sala and id = p_id;
  if not found or e.tipo <> 'arquivo' then
    raise exception 'sala: arquivo não encontrado.';
  end if;
  if e.arquivo_apagado then
    raise exception 'sala: este arquivo já foi apagado.';
  end if;
  return e.caminho_storage;
end;
$$;

create or replace function public.sala_arquivo_apagado(p_sala text, p_id text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.sala_envio;
  v_motivo text;
begin
  perform public.sala_exigir_ponte(p_sala);
  v_motivo := public.sala_texto(p_motivo, 'o motivo', 1000, true);
  select * into e from public.sala_envio where sala = p_sala and id = p_id for update;
  if not found or e.tipo <> 'arquivo' or e.arquivo_apagado then
    raise exception 'sala: arquivo não encontrado ou já apagado.';
  end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'salas' and o.name = e.caminho_storage) then
    raise exception 'sala: o arquivo ainda está no armazenamento. Nada foi marcado.';
  end if;
  update public.sala_envio
     set arquivo_apagado = true, apagado_motivo = v_motivo, apagado_em = now(), apagado_por = auth.uid(),
         estado = 'retirado', retirado_motivo = coalesce(retirado_motivo, v_motivo), retirado_em = coalesce(retirado_em, now()),
         retirado_por = coalesce(retirado_por, auth.uid())
   where sala = p_sala and id = p_id;
  perform public.sala_registrar_evento(p_sala, 'apagou o arquivo', 'envios/' || p_id, e.objeto,
    jsonb_build_object('arquivo_apagado', false), jsonb_build_object('arquivo_apagado', true), v_motivo);
end;
$$;

-- -----------------------------------------------------------------------------
-- Conta só de sala: travas nos dois lados. Aprovar no portal uma conta marcada `so_sala` é recusado; marcar `so_sala`
-- numa conta já aprovada também. Sem aprovação, o /mapa e o /plataforma/app mandam para "aguardando".
-- -----------------------------------------------------------------------------
create or replace function public.sala_guarda_so_sala_acesso()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'aprovado' and exists (select 1 from public.sala_membro m where m.user_id = new.id and m.so_sala) then
    raise exception 'Conta só de sala de trabalho: não pode ser aprovada no portal.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.sala_guarda_so_sala_membro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.so_sala and exists (select 1 from public.oport_acesso a where a.id = new.user_id and a.status = 'aprovado') then
    raise exception 'Esta conta já é aprovada no portal; para ser só de sala, tire a aprovação antes.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists oport_acesso_so_sala on public.oport_acesso;
create trigger oport_acesso_so_sala before insert or update of status on public.oport_acesso
  for each row execute function public.sala_guarda_so_sala_acesso();
drop trigger if exists sala_membro_so_sala on public.sala_membro;
create trigger sala_membro_so_sala before insert or update on public.sala_membro
  for each row execute function public.sala_guarda_so_sala_membro();
revoke execute on function public.sala_guarda_so_sala_acesso() from public, anon, authenticated;
revoke execute on function public.sala_guarda_so_sala_membro() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Armazenamento: bucket PRIVADO `salas`, 25 MB, tipos fechados. Nenhuma política em storage.objects para `anon` ou
-- `authenticated`: ninguém lê, envia ou apaga direto, nem com o caminho exato. O servidor confere o membro e então
-- entrega um link assinado de curta duração (envio ou download), ou apaga com a chave de serviço (só a PONTE).
-- -----------------------------------------------------------------------------
create or replace function public.sala_tipos_arquivo()
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'text/plain'
  ];
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('salas', 'salas', false, 26214400, public.sala_tipos_arquivo())
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Permissões das funções: os atos para `authenticated` (cada um confere o membro); as auxiliares, para ninguém da API.
-- -----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'sala_exigir_membro(text)',
    'sala_texto(text, text, integer, boolean)',
    'sala_lista(text[], text, integer, integer)',
    'sala_exigir_objeto(text, text, boolean)',
    'sala_demanda_travar(text, text, timestamptz, text[])',
    'sala_registrar_evento(text, text, text, text, jsonb, jsonb, text)',
    'sala_novo_id(text)',
    'sala_exigir_ponte(text)',
    'sala_tipos_arquivo()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'sala_demanda_registrar(text, text, text, text, text, date, text)',
    'sala_demanda_combinar(text, text, timestamptz, text, date, text)',
    'sala_demanda_iniciar(text, text, timestamptz)',
    'sala_demanda_entregar(text, text, timestamptz, text, text)',
    'sala_demanda_validar(text, text, timestamptz, text, text)',
    'sala_demanda_rever_data(text, text, timestamptz, date, text)',
    'sala_demanda_dependencia(text, text, timestamptz, text, text, text, date, date)',
    'sala_demanda_classificar(text, text, timestamptz, text, text, text, date)',
    'sala_demanda_cancelar(text, text, timestamptz, text)',
    'sala_objeto_mover(text, text, integer)',
    'sala_objeto_atualizar(text, text, timestamptz, text, text)',
    'sala_decisao_abrir(text, text, text[], text, text)',
    'sala_decisao_decidir(text, text, text, text)',
    'sala_reuniao_salvar(text, date, timestamptz, text[], text[], text[], text[], text)',
    'sala_objeto_cadastrar(text, text, text, text, text, text, text, text, text)',
    'sala_melhoria_pedir(text, text, text)',
    'sala_melhoria_responder(text, text, text, text)',
    'sala_envio_link(text, text, text, text, text)',
    'sala_arquivo_registrar(text, text, text, text, text, text, text, text)',
    'sala_envio_retirar(text, text, text)',
    'sala_arquivo_para_apagar(text, text, text)',
    'sala_arquivo_apagado(text, text, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Membros (DML do titular, no SQL Editor, depois de cada pessoa entrar UMA vez com o Google em /sala/pablo — só então
-- a conta existe em auth.users). O e-mail é digitado só aqui; a tabela guarda o id da conta e o nome de exibição.
--
--   insert into public.sala_membro (sala, user_id, papel, nome)
--   select 'pablo', u.id, 'ponte', 'Jonathan' from auth.users u where lower(u.email) = lower('<e-mail da conta da PONTE>')
--   on conflict (sala, user_id) do nothing;
--   insert into public.sala_membro (sala, user_id, papel, nome, so_sala)
--   select 'pablo', u.id, 'cliente', 'Pablo', true from auth.users u where lower(u.email) = lower('<e-mail da conta do Pablo>')
--   on conflict (sala, user_id) do nothing;
--
-- A conta do Pablo é só de sala (`so_sala = true`): se ele abrir o /mapa, aparece um pedido pendente no painel de
-- acesso, e aprovar é recusado pelo banco.
--
-- A carga inicial (8 objetos, 7 demandas, 2 decisões, 1 evento) sai de `scripts/sala_pablo_carga.py`, que gera o SQL a
-- partir da exportação da sessão de Grafos.
-- =============================================================================
