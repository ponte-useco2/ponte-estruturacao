-- =============================================================================
-- oport_18 — exigências da cláusula suspensiva: o que falta, desde quando e de quem é a vez (onda 11)
--
-- O painel já sabia quais convênios estão em cláusula suspensiva e conseguia CATEGORIZAR o motivo
-- (o texto livre `MOTIVO_SUSPENSIVA` dos dados abertos, lido por expressão regular em
-- painel_execucao/definicoes.py). O que faltava era o andamento: quais documentos foram entregues,
-- quando, quem analisou, o que o concedente respondeu — e há quanto tempo ninguém mexe.
-- Nada disso está nos dados abertos: não há parecer, análise nem documento, e o SICONV apaga
-- motivo e prazo na retirada, sem registrar o evento no histórico.
--
-- Quem guarda essa memória é a tela "Requisitos para Celebração" do Acesso Livre do Transferegov.
-- Apesar do nome, ela continua registrando análises DEPOIS da celebração — foi conferido caso a
-- caso contra `painel_instrumento.dt_assinatura` (Cabedelo/963081: assinado em 03/10/2024, análise
-- em 10/10/2024). É ali que a suspensiva vive. De lá vêm três coisas:
--   · os documentos anexados, com data e hora de envio e validade, no agrupamento da própria tela;
--   · o histórico datado ("Complementação Solicitada", "Enviado para Verificação",
--     "Análise Registrada - Atendido / Não Atendido"), com o nome de quem agiu;
--   · o detalhe de cada evento, onde está o TEXTO do concedente — observação e solicitação de
--     complementação — e a data da análise, que NÃO é a data em que o sistema registrou.
--
-- FONTE DE COLETA ASSISTIDA. O Acesso Livre abre sessão anônima de 30 minutos atrás de SAML: não há
-- job que reproduza o acesso. A carga vem de uma coleta conduzida no navegador e conferida antes de
-- subir. Por isso `fonte` fica gravado na execução: sem dizer como foi colhido, o dado não pode ser
-- lido como retrato de nada.
--
-- Segue o mesmo contrato de `radar_execucao` (gravando → lotes → concluir), para que o carregador
-- use `radar_propostas.publica.publicar_execucao` em vez de uma máquina paralela. O volume é
-- pequeno (centenas de instrumentos, milhares de linhas), então `exigencia_concluir` apaga as
-- execuções antigas na mesma transação, como o radar faz — sem limpeza em lotes.
--
-- Uso EXCLUSIVO da PONTE: nada de `anon` nem de `authenticated`; a leitura pelas telas é sempre
-- pelo servidor, com a chave de serviço. Grants explícitos, como manda a seguranca_1. Idempotente.
-- =============================================================================

create table if not exists public.exigencia_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- Carimbo do evento mais recente visto na coleta: é até ele que as esperas contam.
  dado_ate     timestamptz,
  -- "Hoje" da coleta, para os dias de espera não mudarem quando a página é aberta meses depois.
  referencia   date,
  -- Como foi colhido: ferramenta, versão do leitor e quantos instrumentos foram pedidos.
  arquivos     jsonb not null default '{}'::jsonb,
  contagens    jsonb not null default '{}'::jsonb,
  fonte        text not null default 'transferegov_acesso_livre',
  erro         text
);

create index if not exists exigencia_execucao_concluida_idx
  on public.exigencia_execucao (concluida_em desc) where status = 'concluida';

-- -----------------------------------------------------------------------------
-- Instrumento: uma linha por convênio coletado, com a leitura já feita do histórico.
--
-- `vez_de` responde "quem está devendo agora". Guardo a leitura, e não só o dado cru, porque é ela
-- que a tela mostra e a estatística agrupa — e porque a regra está versionada no job, à vista, e
-- não escondida numa consulta. A regra NÃO é inverter o lado de quem agiu por último: "Análise
-- Registrada - Atendido" é o concedente dizendo que está tudo certo, e nesse caso a espera é dele,
-- que ainda não retirou a suspensiva. Inverter cegamente jogava 100% dos casos no colo do
-- município, que foi o erro da primeira versão do leitor.
--
-- `numero` é texto de propósito: contrato de repasse da Caixa vem alfanumérico ("7AAAAK").
-- -----------------------------------------------------------------------------
create table if not exists public.exigencia_instrumento (
  execucao_id          bigint not null references public.exigencia_execucao (id) on delete cascade,
  numero               text not null,
  id_convenio          text,
  proposta             text,
  situacao_contratacao text,
  modalidade           text,
  vez_de               text check (vez_de in ('concedente', 'proponente')),
  ultimo_evento        text,
  parado_desde         timestamptz,
  primeiro_evento_em   timestamptz,
  rodadas_de_exigencia integer not null default 0,
  envios_do_municipio  integer not null default 0,
  documentos           integer not null default 0,
  eventos              integer not null default 0,
  erro                 text,
  coletado_em          timestamptz,
  primary key (execucao_id, numero)
);

create index if not exists exigencia_instrumento_numero_idx
  on public.exigencia_instrumento (numero);
create index if not exists exigencia_instrumento_parado_idx
  on public.exigencia_instrumento (execucao_id, vez_de, parado_desde);

-- -----------------------------------------------------------------------------
-- Documento: o que foi anexado, quando e até quando vale.
-- `requisito` é a descrição normalizada (caixa alta, sem ponto final): a mesma exigência aparece
-- como "KIT PREFEITO" e "Kit Prefeito", e sem juntar as duas a estatística conta dobrado.
-- -----------------------------------------------------------------------------
create table if not exists public.exigencia_documento (
  execucao_id bigint not null references public.exigencia_execucao (id) on delete cascade,
  numero      text not null,
  ordem       integer not null,
  grupo       text,
  arquivo     text not null,
  descricao   text,
  requisito   text,
  enviado_em  timestamptz,
  validade    date,
  primary key (execucao_id, numero, ordem)
);

create index if not exists exigencia_documento_requisito_idx
  on public.exigencia_documento (execucao_id, requisito);

-- -----------------------------------------------------------------------------
-- Evento: a linha do tempo, na ordem em que a tela lista (do mais recente ao mais antigo).
-- `lado` é quem agiu; `resultado` é a leitura do rótulo. O rótulo cru fica em `evento`, para que
-- uma mudança de vocabulário do Transferegov apareça como 'indefinido' em vez de virar silêncio.
-- -----------------------------------------------------------------------------
create table if not exists public.exigencia_evento (
  execucao_id bigint not null references public.exigencia_execucao (id) on delete cascade,
  numero      text not null,
  ordem       integer not null,
  evento      text not null,
  lado        text not null check (lado in ('concedente', 'proponente', 'indefinido')),
  resultado   text,
  responsavel text,
  ocorrido_em timestamptz not null,
  id_situacao text,
  primary key (execucao_id, numero, ordem)
);

create index if not exists exigencia_evento_tempo_idx
  on public.exigencia_evento (execucao_id, numero, ocorrido_em desc);

-- -----------------------------------------------------------------------------
-- Detalhe: o texto do concedente, palavra por palavra, com a data da análise.
-- `analisada_em` é a data que o analista informou; `ocorrido_em` do evento é quando o sistema
-- registrou. As duas divergem — e essa diferença é, ela mesma, uma medida de atraso.
-- -----------------------------------------------------------------------------
create table if not exists public.exigencia_detalhe (
  execucao_id  bigint not null references public.exigencia_execucao (id) on delete cascade,
  numero       text not null,
  id_situacao  text not null,
  analise      text,
  responsavel  text,
  atribuicao   text,
  analisada_em date,
  situacao     text,
  observacao   text,
  solicitacao  text,
  primary key (execucao_id, numero, id_situacao)
);

-- -----------------------------------------------------------------------------
-- Fechamento do acesso: nada de anon nem de authenticated em nenhuma das tabelas.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['exigencia_execucao', 'exigencia_instrumento', 'exigencia_documento',
                           'exigencia_evento', 'exigencia_detalhe']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;


-- -----------------------------------------------------------------------------
-- Última execução concluída. Toda leitura parte daqui, para nunca misturar retratos.
-- -----------------------------------------------------------------------------
create or replace function public.exigencia_ultima_execucao()
returns table (id bigint, concluida_em timestamptz, dado_ate timestamptz, referencia date,
               fonte text, contagens jsonb)
language sql stable
set search_path to 'public'
as $$
  select e.id, e.concluida_em, e.dado_ate, e.referencia, e.fonte, e.contagens
    from public.exigencia_execucao e
   where e.status = 'concluida'
   order by e.concluida_em desc
   limit 1
$$;

-- -----------------------------------------------------------------------------
-- Conclusão: marca a execução e apaga as anteriores na mesma transação, como o radar.
-- -----------------------------------------------------------------------------
create or replace function public.exigencia_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.exigencia_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate,
         contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;

  -- Cascata pelas chaves estrangeiras: apagar a execução leva junto os fatos dela.
  delete from public.exigencia_execucao where id <> p_execucao;
end $$;

-- -----------------------------------------------------------------------------
-- Dossiê de um instrumento: tudo o que a página precisa, numa chamada só.
-- Devolve jsonb porque são quatro formatos diferentes e a tela monta a narrativa a partir deles.
-- -----------------------------------------------------------------------------
create or replace function public.exigencia_dossie(p_numero text)
returns jsonb
language sql stable
set search_path to 'public'
as $$
  with ex as (select id, concluida_em, referencia, fonte from public.exigencia_ultima_execucao())
  select jsonb_build_object(
    'coletado_em', (select concluida_em from ex),
    'referencia',  (select referencia from ex),
    'fonte',       (select fonte from ex),
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
-- Placar: quantos estão parados de cada lado e há quanto tempo. É a base da estatística.
-- Conta a partir da `referencia` da execução, e não de now(): a espera é a do retrato coletado.
-- -----------------------------------------------------------------------------
create or replace function public.exigencia_placar()
returns table (vez_de text, instrumentos integer, mediana_dias numeric, acima_90 integer, acima_180 integer)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id, coalesce(referencia, current_date) ref from public.exigencia_ultima_execucao()),
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

revoke execute on function public.exigencia_ultima_execucao()                       from public, anon, authenticated;
revoke execute on function public.exigencia_concluir(bigint, timestamptz, jsonb)    from public, anon, authenticated;
revoke execute on function public.exigencia_dossie(text)                            from public, anon, authenticated;
revoke execute on function public.exigencia_placar()                                from public, anon, authenticated;
grant  execute on function public.exigencia_ultima_execucao()                       to service_role;
grant  execute on function public.exigencia_concluir(bigint, timestamptz, jsonb)    to service_role;
grant  execute on function public.exigencia_dossie(text)                            to service_role;
grant  execute on function public.exigencia_placar()                                to service_role;
