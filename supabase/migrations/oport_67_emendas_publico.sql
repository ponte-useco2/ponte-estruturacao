-- =============================================================================
-- oport_67 — Portal público das emendas federais com destino à PB: funções de leitura (17/11/2026)
--
-- Plano e especificação: `Site-Ponte/transparencia-emendas/PLANO.md` e `ESPEC-CONSTRUCAO.md` (aprovados pelo titular em
-- 17/11/2026). O site ganha `/emendas`, público e só de leitura, que usa a matriz do PNTP 2026 (critérios 17.1 e 17.3)
-- como referência de qualidade. As tabelas são as da oport_39 (`emd_*`), que seguem só para `service_role`: o público não
-- lê o banco; o servidor do site lê por estas funções, com a chave de serviço, e guarda em cache.
--
-- POR QUE FUNÇÕES PRÓPRIAS, e não as da oport_39: as de administrador devolvem colunas que não podem sair ao público ("de
-- quem é a vez", motivo, válido, os campos do laudo, o catálogo bruto). Aqui cada função devolve SÓ a lista branca do
-- portal, e a lista é conferida por teste no site (`emendas-publico.server.test.ts`). Fora daqui, sempre: `vez`,
-- `motivo`, `valido`, `coberto_por`, `ano_inferido`; `pior`, `n_critico`, `n_alto`, `n_moderado`, `n_pendente`, `itens`,
-- `versao`, `analise_pt` e `saldo` do Pix; `catalogo_*` sem o recorte da PB; fornecedor de convênio; TRAMITA; CPF.
--
-- As regras de dado (as da oport_39 e as decisões do titular):
--   · a unidade da lista é a linha de `emd_canal` com `coberto_por is null` (emenda × canal × instrumento); as linhas
--     cobertas por outro canal ficam fora e não somam;
--   · o CATÁLOGO (`emd_emenda`) e o CANAL nunca se somam. O valor do catálogo só sai das linhas com `pb_localidade`: a
--     emenda "Múltiplo" ou "Nacional" traz o valor do Brasil inteiro. A linha de outra localidade aparece só com a
--     localidade, sem valor;
--   · "previsto" = `indicado` do canal (o que o autor indicou para aquele destino; o pagamento direto ao favorecido não
--     tem); "realizado" = `pago` do canal. As somas são das linhas, todas (a soma de um recorte é a soma das linhas que
--     ele mostra, e quem soma o CSV chega ao mesmo número);
--   · pessoa física só somada (`emd_pf`), por emenda × ano, na PB. Nunca nome nem documento;
--   · o nome do microempreendedor individual (razão social que começa pela raiz do CNPJ e traz o nome da pessoa) não sai:
--     vira "Microempreendedor individual (nome omitido)", com o CNPJ e os valores (`emd_pub_ente_nome`, regra do
--     supervisor de 17/11/2026);
--   · o nome do ente e o objeto saem com qualquer número no formato de CPF mascarado (`emd_pub_mascara`); hoje não há
--     nenhum (conferido em 17/11), e a máscara é a defesa para quando houver;
--   · o objeto vem do canal: o do convênio (`painel_instrumento`, última execução do painel), o do plano de ação do Pix
--     (`pix_laudo_plano`, última execução do Pix), o tipo da proposta do FNS (`emd_fns_proposta`) e, no pagamento direto,
--     a ação orçamentária da emenda (o arquivo não traz objeto), com `objeto_fonte` dizendo qual;
--   · o tipo da emenda é o texto do Portal (`tipo_texto`) e um código (`tipo`): individual com finalidade definida,
--     individual transferência especial, bancada, comissão, relator ou outro. A emenda sem linha no arquivo do Portal
--     (2010–2013 e algumas de 2014–2018: 2.136 linhas na execução 13) leva o código pelo tipo do autor e pela forma de
--     repasse (individual pelo Pix é transferência especial), com `no_catalogo = false` para a página dizer;
--   · "caducou" vira a etapa `caducou` (proposta não assinada até 31/12 do ano seguinte ao da emenda), sem juízo;
--   · ordem padrão alfabética e estável (ano mais recente, autor sem acento, código, canal, instrumento, linha); ordem
--     por valor só quando pedida. Nenhuma ordem por posição.
--
-- DESEMPENHO (medido em 17/11/2026 na execução 13, 22.826 linhas, instância de ~1 GB com CPU irregular): a lista na
-- ordem padrão leva ~0,3 s; o objeto do convênio é a parte cara (4.164 consultas a `painel_instrumento` levavam 1,6 s
-- uma a uma), então ele só é lido para TODAS as linhas quando a busca, o filtro ou a ordem pedem o objeto, e de uma vez
-- (`= any (array[...])`, ~50 ms); fora disso, só para as linhas da página. O site guarda cada chamada em cache por
-- execução (horas), e nenhuma visita repete consulta pesada.
--
--   · emd_pub_mascara(texto), emd_pub_ente_nome(nome), emd_pub_tipo(tipo do Portal, tipo do autor, canal) e
--     emd_pub_catalogo(execução): peças internas, as mesmas regras em todas as funções;
--   · emd_pub_execucao(): a execução publicada e a data de cada fonte;
--   · emd_pub_linhas(filtros por coluna, busca, ordem, página): as linhas, com o `total` do recorte;
--   · emd_pub_agregado(autor, ibge): emendas distintas, linhas, previsto e pago por ano, tipo, canal, função e tipo do
--     ente, em conjuntos de agrupamento (`grupo` diz qual);
--   · emd_pub_emenda(código): as linhas do catálogo (execução orçamentária na PB, 17.3); sem código, todas as da PB;
--   · emd_pub_pf(código): a pessoa física somada, por emenda e ano;
--   · emd_pub_autores(): os autores, com as somas dos canais;
--   · emd_pub_municipios(): os 223 (os sem nada com zero), o estado e o "sem município" à parte.
--
-- Acesso: SÓ `service_role` (revoke de public, anon e authenticated). `security invoker`, `stable`, `search_path` fixo.
--
-- ORDEM: independe do job e do site publicado (nada lê estas funções antes do portal). O portal novo, sem esta
-- migração, mostra "dado indisponível" (PGRST202). Aditiva e idempotente (só `create or replace`, numa transação).
-- Pré-requisitos: oport_39 (emd_*), oport_46 (`oport_sem_acento`), oport_8/14 (painel), oport_13/23 (Pix), fiscal_1.
--
-- REVERTER: `drop function if exists` das onze funções `public.emd_pub_*` (assinaturas no fim deste arquivo).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Peças internas
-- -----------------------------------------------------------------------------

-- Qualquer número no formato de CPF (11 dígitos, com ou sem pontuação, sem dígito colado antes ou depois) vira
-- "***.***.***-**". O CNPJ (14 dígitos ou com barra) não casa.
create or replace function public.emd_pub_mascara(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
  select regexp_replace(p_texto, '(?<![0-9])[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}(?![0-9])', '***.***.***-**', 'g')
$$;

-- O nome do ente como o portal mostra (regra do supervisor, 17/11/2026). O microempreendedor individual e o empresário
-- individual têm o nome da PESSOA na razão social, que o Portal publica começando pela raiz do CNPJ ("49.680.467 JOSE
-- ..."; 35 linhas de empresa na execução 13): esse nome não sai, e a linha fica com o CNPJ e os valores. A base não tem a
-- natureza jurídica do favorecido; a regra é a do formato (8 dígitos no começo, com ou sem pontos, e espaço). No resto, o
-- número com formato de CPF é mascarado.
create or replace function public.emd_pub_ente_nome(p_nome text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
  select case when p_nome ~ '^\s*[0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\s' then 'Microempreendedor individual (nome omitido)'
              else public.emd_pub_mascara(p_nome) end
$$;

-- O código do tipo da emenda: pelo texto do Portal; sem ele, pelo tipo do autor e pela forma de repasse (a emenda
-- individual pelo Pix é transferência especial; por outro canal, com finalidade definida). Sem texto e sem autor (a
-- proposta do FNS ainda sem o detalhe): nulo, e a página diz "não identificado".
create or replace function public.emd_pub_tipo(p_tipo text, p_autor_tipo text, p_canal text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
  select case
    when p_tipo ilike '%transfer%especia%' then 'individual_especial'
    when p_tipo ilike '%individual%'       then 'individual_finalidade'
    when p_tipo ilike '%bancada%'          then 'bancada'
    when p_tipo ilike '%comiss%'           then 'comissao'
    when p_tipo ilike '%relator%'          then 'relator'
    when p_tipo is not null                then 'outro'
    when p_autor_tipo = 'individual' and p_canal = 'pix' then 'individual_especial'
    when p_autor_tipo = 'individual'       then 'individual_finalidade'
    when p_autor_tipo in ('bancada', 'comissao', 'relator') then p_autor_tipo
    when p_autor_tipo is null              then null
    else 'outro'
  end
$$;

-- Uma linha por código de emenda do catálogo: a linha com a PB na localidade, se houver; senão, a primeira.
create or replace function public.emd_pub_catalogo(p_execucao bigint)
returns table (
  codigo      text,
  tipo_texto  text,
  numero      text,
  autor_nome  text,
  funcao      text,
  subfuncao   text,
  programa    text,
  acao        text
)
language sql stable
set search_path to 'public'
as $$
  select distinct on (e.codigo) e.codigo, e.tipo, e.numero, e.autor_nome, e.funcao, e.subfuncao, e.programa, e.acao
    from public.emd_emenda e
   where e.execucao_id = p_execucao
     and e.codigo is not null
   order by e.codigo, e.pb_localidade desc, e.linha
$$;

-- -----------------------------------------------------------------------------
-- A execução publicada e a data de cada fonte
-- -----------------------------------------------------------------------------

create or replace function public.emd_pub_execucao()
returns table (
  id               bigint,
  concluida_em     timestamptz,
  -- A data do arquivo de emendas do Portal da Transparência (Last-Modified do zip).
  dado_ate         timestamptz,
  referencia       date,
  -- Propostas do FNS ainda sem o detalhe do autor (contam no município, não na emenda).
  fns_pendentes    integer,
  painel_execucao  bigint,
  painel_dado_ate  timestamptz,
  pix_execucao     bigint,
  pix_dado_ate     timestamptz,
  fiscal_execucao  bigint
)
language sql stable
set search_path to 'public'
as $$
  select e.id, e.concluida_em, e.dado_ate, e.referencia,
         case when (e.contagens ->> 'emd_fns_detalhes_pendentes') ~ '^[0-9]{1,9}$'
              then (e.contagens ->> 'emd_fns_detalhes_pendentes')::integer else 0 end,
         pe.id, pe.dado_ate, px.id, px.dado_ate, fx.id
    from public.emd_ultima_execucao() e
    left join public.painel_ultima_execucao() pe on true
    left join public.pix_ultima_execucao() px on true
    left join public.fiscal_ultima_execucao() fx on true
$$;

-- -----------------------------------------------------------------------------
-- As linhas (critério 17.1), com filtro por coluna, busca, ordem e página
-- -----------------------------------------------------------------------------

-- Os filtros de texto recebem PADRÕES `like` já sem acento e em minúsculas ('%palavra%'), um por palavra, e a linha
-- passa quando casa todos (a regra da `TabelaFiltravel`, como na oport_51). As categorias recebem os códigos (tipo,
-- canal, tipo do ente, etapa) ou, na função de governo, o texto sem acento; '' é o "não consta" de cada uma (tipo, tipo
-- do ente, etapa e função nulos). Nulo ou vazio = sem filtro.
create or replace function public.emd_pub_linhas(
  p_ano_de        integer default null,
  p_ano_ate       integer default null,
  p_codigo        text[]  default null,
  p_emenda        text    default null,
  p_tipo          text[]  default null,
  p_autor         text    default null,
  p_autor_nome    text[]  default null,
  p_canal         text[]  default null,
  p_ente_tipo     text[]  default null,
  p_ente          text[]  default null,
  p_ibge          text    default null,
  p_municipio     text[]  default null,
  p_objeto        text[]  default null,
  p_funcao        text[]  default null,
  p_etapa         text[]  default null,
  p_situacao      text[]  default null,
  p_instrumento   text[]  default null,
  p_previsto_de   numeric default null,
  p_previsto_ate  numeric default null,
  p_pago_de       numeric default null,
  p_pago_ate      numeric default null,
  p_busca         text[]  default null,
  p_ordem         text    default null,
  p_desc          boolean default false,
  p_limite        integer default 100,
  p_deslocamento  integer default 0,
  p_execucao      bigint  default null
)
returns table (
  linha                  integer,
  ano                    integer,
  codigo                 text,
  numero                 text,
  tipo                   text,
  tipo_texto             text,
  no_catalogo            boolean,
  autor_codigo           text,
  autor_nome             text,
  autor_tipo             text,
  coletivo               boolean,
  canal                  text,
  instrumento            text,
  ano_pagamento          integer,
  ente_tipo              text,
  ente_nome              text,
  ente_cnpj              text,
  ibge                   text,
  municipio              text,
  uf                     text,
  objeto                 text,
  objeto_fonte           text,
  funcao                 text,
  subfuncao              text,
  programa               text,
  acao                   text,
  previsto               numeric,
  pago                   numeric,
  n_autores              integer,
  etapa                  text,
  situacao               text,
  caducou_em             date,
  dt_assinatura          date,
  dt_primeiro_pagamento  date,
  dt_ultimo_pagamento    date,
  concedente             text,
  orgao                  text,
  vigencia_inicio        date,
  vigencia_fim           date,
  convenio_repasse       numeric,
  convenio_desembolsado  numeric,
  pix_area               text,
  pix_custeio            numeric,
  pix_investimento       numeric,
  pix_fim_execucao       date,
  fns_tipo_recurso       text,
  total                  bigint
)
language plpgsql stable
set search_path to 'public'
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
declare
  v_ex     bigint  := coalesce(p_execucao, (select e.id from public.emd_ultima_execucao() e));
  v_pe     bigint  := (select e.id from public.painel_ultima_execucao() e);
  v_px     bigint  := (select e.id from public.pix_ultima_execucao() e);
  v_fx     bigint  := (select e.id from public.fiscal_ultima_execucao() e);
  v_cod    text[]  := nullif(p_codigo, '{}');
  v_tipo   text[]  := nullif(p_tipo, '{}');
  v_anome  text[]  := nullif(p_autor_nome, '{}');
  v_canal  text[]  := nullif(p_canal, '{}');
  v_entet  text[]  := nullif(p_ente_tipo, '{}');
  v_ente   text[]  := nullif(p_ente, '{}');
  v_mun    text[]  := nullif(p_municipio, '{}');
  v_obj    text[]  := nullif(p_objeto, '{}');
  v_func   text[]  := nullif(p_funcao, '{}');
  v_etapa  text[]  := nullif(p_etapa, '{}');
  v_sit    text[]  := nullif(p_situacao, '{}');
  v_instr  text[]  := nullif(p_instrumento, '{}');
  v_busca  text[]  := nullif(p_busca, '{}');
  v_ordem  text    := case when p_ordem in ('ano', 'codigo', 'tipo', 'autor', 'canal', 'ente', 'municipio', 'objeto',
                                            'funcao', 'previsto', 'pago', 'situacao') then p_ordem end;
  v_desc   boolean := coalesce(p_desc, false);
  v_lim    integer := greatest(1, least(coalesce(p_limite, 100), 1000));
  v_desl   integer := greatest(0, least(coalesce(p_deslocamento, 0), 1000000));
  -- O objeto de TODAS as linhas só quando a busca, o filtro ou a ordem pedem (é a parte cara: ver o cabeçalho).
  v_todos  boolean;
  -- O nome público do ente (`emd_pub_ente_nome`) de todas as linhas só quando a busca, o filtro ou a ordem pedem: o
  -- filtro e a ordem usam o nome que a página mostra, e o nome omitido do MEI não é achado pela busca.
  v_nomes  boolean;
begin
  v_todos := v_obj is not null or v_busca is not null or v_ordem = 'objeto';
  v_nomes := v_ente is not null or v_busca is not null or v_ordem = 'ente';

  return query
  with cat as materialized (
    select k.* from public.emd_pub_catalogo(v_ex) k
  ),
  obj as materialized (
    select 'convenio'::text canal, i.nr_convenio instrumento, i.objeto
      from public.painel_instrumento i
     where v_todos
       and i.execucao_id = v_pe
       and i.nr_convenio = any (array(select distinct c2.instrumento from public.emd_canal c2
                                       where c2.execucao_id = v_ex and c2.canal = 'convenio' and c2.coberto_por is null))
    union all
    select 'pix', p.id_plano_acao::text, p.objeto
      from public.pix_laudo_plano p
     where v_todos and p.execucao_id = v_px
    union all
    select 'fns', f.nu_proposta, f.tipo_proposta
      from public.emd_fns_proposta f
     where v_todos and f.execucao_id = v_ex
  ),
  b as (
    select c.linha, c.ano, c.codigo, c.canal, c.instrumento, c.ano_pagamento, c.ente_tipo, c.ibge,
           c.indicado previsto, c.pago,
           case when c.caducou then 'caducou' else coalesce(c.etapa, '') end etapa,
           c.situacao,
           case when v_nomes then public.emd_pub_ente_nome(c.ente_nome) end ente_nome,
           coalesce(t.numero, substr(c.codigo, 9, 4)) numero,
           t.funcao,
           coalesce(a.nome, t.autor_nome) autor_nome,
           public.emd_pub_tipo(t.tipo_texto, a.tipo, c.canal) tipo,
           m.nome municipio,
           case when c.canal = 'favorecido' then t.acao else o.objeto end objeto
      from public.emd_canal c
      left join cat t on t.codigo = c.codigo
      left join public.emd_autor a on a.execucao_id = c.execucao_id and a.codigo = c.autor_codigo
      left join public.fiscal_municipio m on m.execucao_id = v_fx and m.ibge = c.ibge
      left join obj o on o.canal = c.canal and o.instrumento = c.instrumento
     where c.execucao_id = v_ex
       and c.coberto_por is null
       and (p_emenda is null or c.codigo = p_emenda)
       and (p_autor is null or c.autor_codigo = p_autor)
       and (p_ibge is null or c.ibge = p_ibge)
       and (p_ano_de is null or c.ano >= p_ano_de)
       and (p_ano_ate is null or c.ano <= p_ano_ate)
       and (v_canal is null or c.canal = any (v_canal))
       and (v_entet is null or coalesce(c.ente_tipo, '') = any (v_entet))
       and (p_previsto_de is null or c.indicado >= p_previsto_de)
       and (p_previsto_ate is null or c.indicado <= p_previsto_ate)
       and (p_pago_de is null or c.pago >= p_pago_de)
       and (p_pago_ate is null or c.pago <= p_pago_ate)
       and (v_instr is null or lower(c.instrumento) like all (v_instr))
  ),
  f as (
    select b.linha, b.codigo, b.canal, b.instrumento, b.numero, b.funcao, b.autor_nome, b.tipo, b.municipio, b.etapa,
           b.objeto,
           count(*) over () total,
           row_number() over (order by
             case when v_ordem = 'ano'       and not v_desc then b.ano end asc nulls last,
             case when v_ordem = 'ano'       and v_desc     then b.ano end desc nulls last,
             case when v_ordem = 'codigo'    and not v_desc then b.codigo end asc nulls last,
             case when v_ordem = 'codigo'    and v_desc     then b.codigo end desc nulls last,
             case when v_ordem = 'tipo'      and not v_desc then array_position(array['individual_finalidade', 'individual_especial', 'bancada', 'comissao', 'relator', 'outro'], b.tipo) end asc nulls last,
             case when v_ordem = 'tipo'      and v_desc     then array_position(array['individual_finalidade', 'individual_especial', 'bancada', 'comissao', 'relator', 'outro'], b.tipo) end desc nulls last,
             case when v_ordem = 'autor'     and not v_desc then nullif(public.oport_sem_acento(b.autor_nome), '') end asc nulls last,
             case when v_ordem = 'autor'     and v_desc     then nullif(public.oport_sem_acento(b.autor_nome), '') end desc nulls last,
             case when v_ordem = 'canal'     and not v_desc then array_position(array['convenio', 'pix', 'fns', 'favorecido'], b.canal) end asc nulls last,
             case when v_ordem = 'canal'     and v_desc     then array_position(array['convenio', 'pix', 'fns', 'favorecido'], b.canal) end desc nulls last,
             case when v_ordem = 'ente'      and not v_desc then nullif(public.oport_sem_acento(b.ente_nome), '') end asc nulls last,
             case when v_ordem = 'ente'      and v_desc     then nullif(public.oport_sem_acento(b.ente_nome), '') end desc nulls last,
             case when v_ordem = 'municipio' and not v_desc then nullif(public.oport_sem_acento(b.municipio), '') end asc nulls last,
             case when v_ordem = 'municipio' and v_desc     then nullif(public.oport_sem_acento(b.municipio), '') end desc nulls last,
             case when v_ordem = 'objeto'    and not v_desc then nullif(public.oport_sem_acento(b.objeto), '') end asc nulls last,
             case when v_ordem = 'objeto'    and v_desc     then nullif(public.oport_sem_acento(b.objeto), '') end desc nulls last,
             case when v_ordem = 'funcao'    and not v_desc then nullif(public.oport_sem_acento(b.funcao), '') end asc nulls last,
             case when v_ordem = 'funcao'    and v_desc     then nullif(public.oport_sem_acento(b.funcao), '') end desc nulls last,
             case when v_ordem = 'previsto'  and not v_desc then b.previsto end asc nulls last,
             case when v_ordem = 'previsto'  and v_desc     then b.previsto end desc nulls last,
             case when v_ordem = 'pago'      and not v_desc then b.pago end asc nulls last,
             case when v_ordem = 'pago'      and v_desc     then b.pago end desc nulls last,
             case when v_ordem = 'situacao'  and not v_desc then array_position(array['proposta', 'assinatura', 'suspensiva', 'execucao', 'contas', 'concluido', 'extinto', 'caducou', 'impedido', 'reapresentado', 'sem_pagamento', 'pago_parcial', 'pago'], b.etapa) end asc nulls last,
             case when v_ordem = 'situacao'  and v_desc     then array_position(array['proposta', 'assinatura', 'suspensiva', 'execucao', 'contas', 'concluido', 'extinto', 'caducou', 'impedido', 'reapresentado', 'sem_pagamento', 'pago_parcial', 'pago'], b.etapa) end desc nulls last,
             -- A ordem padrão, que também desempata qualquer outra: alfabética e estável, nunca por valor.
             b.ano desc nulls last,
             nullif(public.oport_sem_acento(b.autor_nome), '') asc nulls last,
             b.codigo asc nulls last,
             array_position(array['convenio', 'pix', 'fns', 'favorecido'], b.canal),
             b.instrumento,
             b.ano_pagamento nulls first,
             b.linha) pos
      from b
     where (v_tipo is null or coalesce(b.tipo, '') = any (v_tipo))
       and (v_func is null or public.oport_sem_acento(b.funcao) = any (v_func))
       and (v_etapa is null or b.etapa = any (v_etapa))
       and (v_cod is null or public.oport_sem_acento(concat_ws(' ', b.codigo, b.numero)) like all (v_cod))
       and (v_anome is null or public.oport_sem_acento(b.autor_nome) like all (v_anome))
       and (v_ente is null or public.oport_sem_acento(b.ente_nome) like all (v_ente))
       and (v_mun is null or public.oport_sem_acento(b.municipio) like all (v_mun))
       and (v_obj is null or public.oport_sem_acento(b.objeto) like all (v_obj))
       and (v_sit is null or public.oport_sem_acento(b.situacao) like all (v_sit))
       and (v_busca is null or public.oport_sem_acento(concat_ws(' ', b.codigo, b.numero, b.autor_nome, b.ente_nome,
                                                                 b.municipio, b.objeto, b.instrumento)) like all (v_busca))
     order by pos
     limit v_lim
    offset v_desl
  )
  select c.linha, c.ano, c.codigo, f.numero, f.tipo, t.tipo_texto, (t.codigo is not null),
         c.autor_codigo, f.autor_nome, a.tipo, coalesce(a.coletivo, false),
         c.canal, c.instrumento, c.ano_pagamento,
         c.ente_tipo, public.emd_pub_ente_nome(c.ente_nome), c.ente_cnpj, c.ibge, f.municipio, c.uf,
         public.emd_pub_mascara(ob.objeto),
         case when ob.objeto is null then null
              when c.canal = 'convenio' then 'convenio'
              when c.canal = 'pix' then 'plano_acao'
              when c.canal = 'fns' then 'proposta_fns'
              else 'acao_orcamentaria' end,
         f.funcao, t.subfuncao, t.programa, t.acao,
         c.indicado, c.pago, c.n_autores,
         nullif(f.etapa, ''), c.situacao, c.caducou_em,
         c.dt_assinatura, c.dt_primeiro_pagamento, c.dt_ultimo_pagamento,
         i.orgao_sup, i.orgao, i.dt_inicio_vigencia, i.dt_fim_vigencia, i.vl_repasse, i.vl_desembolsado,
         p.area, p.custeio, p.investimento, p.fim_execucao,
         fp.tipo_recurso,
         f.total
    from f
    join public.emd_canal c on c.execucao_id = v_ex and c.linha = f.linha
    left join cat t on t.codigo = f.codigo
    left join public.emd_autor a on a.execucao_id = c.execucao_id and a.codigo = c.autor_codigo
    left join lateral (
      select i2.objeto, i2.orgao_sup, i2.orgao, i2.dt_inicio_vigencia, i2.dt_fim_vigencia, i2.vl_repasse, i2.vl_desembolsado
        from public.painel_instrumento i2
       where f.canal = 'convenio' and i2.execucao_id = v_pe and i2.nr_convenio = f.instrumento
       order by i2.objeto nulls last
       limit 1
    ) i on true
    left join public.pix_laudo_plano p
           on f.canal = 'pix' and p.execucao_id = v_px
          and p.id_plano_acao = (case when f.instrumento ~ '^[0-9]{1,18}$' then f.instrumento::bigint end)
    left join public.emd_fns_proposta fp on f.canal = 'fns' and fp.execucao_id = v_ex and fp.nu_proposta = f.instrumento
    -- O objeto da linha: o já lido na busca, ou o da página (convênio, Pix, FNS) e a ação no pagamento direto.
    left join lateral (
      select coalesce(f.objeto, case f.canal when 'convenio' then i.objeto when 'pix' then p.objeto
                                             when 'fns' then fp.tipo_proposta else t.acao end) objeto
    ) ob on true
   order by f.pos;
end $function$;

-- -----------------------------------------------------------------------------
-- As somas: por ano, tipo, canal, função e tipo do ente (a série, a página inicial e as fichas)
-- -----------------------------------------------------------------------------

-- `grupo` diz o conjunto de agrupamento da linha; a coluna fora do conjunto vem nula. `emendas` conta códigos distintos
-- DENTRO do grupo: as linhas de grupos diferentes não se somam para contar emendas (uma emenda pode ter dois canais).
create or replace function public.emd_pub_agregado(p_autor text default null, p_ibge text default null, p_execucao bigint default null)
returns table (
  grupo      text,
  ano        integer,
  tipo       text,
  canal      text,
  funcao     text,
  ente_tipo  text,
  emendas    integer,
  linhas     integer,
  previsto   numeric,
  pago       numeric
)
language sql stable
set search_path to 'public'
as $$
  with ex as (select coalesce(p_execucao, (select e.id from public.emd_ultima_execucao() e)) id),
  cat as materialized (select k.* from public.emd_pub_catalogo((select ex.id from ex)) k),
  b as (
    select c.ano, c.codigo, c.canal, c.ente_tipo, c.indicado, c.pago, t.funcao,
           public.emd_pub_tipo(t.tipo_texto, a.tipo, c.canal) tipo
      from public.emd_canal c
      left join cat t on t.codigo = c.codigo
      left join public.emd_autor a on a.execucao_id = c.execucao_id and a.codigo = c.autor_codigo
     where c.execucao_id = (select ex.id from ex)
       and c.coberto_por is null
       and (p_autor is null or c.autor_codigo = p_autor)
       and (p_ibge is null or c.ibge = p_ibge)
  )
  select case grouping(b.ano, b.tipo, b.canal, b.funcao, b.ente_tipo)
           when 1  then 'ano_tipo_canal_funcao'
           when 7  then 'ano_tipo'
           when 11 then 'ano_canal'
           when 15 then 'ano'
           when 23 then 'tipo'
           when 27 then 'canal'
           when 29 then 'funcao'
           when 30 then 'ente'
           else 'total'
         end,
         b.ano, b.tipo, b.canal, b.funcao, b.ente_tipo,
         count(distinct b.codigo)::integer, count(*)::integer,
         coalesce(sum(b.indicado), 0), coalesce(sum(b.pago), 0)
    from b
   group by grouping sets ((b.ano, b.tipo, b.canal, b.funcao), (b.ano, b.tipo), (b.ano, b.canal), (b.ano), (b.tipo),
                           (b.canal), (b.funcao), (b.ente_tipo), ())
   order by 1, 2 nulls first, 3 nulls first, 4 nulls first, 5 nulls first, 6 nulls first
$$;

-- -----------------------------------------------------------------------------
-- O catálogo: a execução orçamentária no Portal da Transparência (17.3), só pelo recorte da PB
-- -----------------------------------------------------------------------------

-- Com o código: TODAS as linhas da emenda, e a de outra localidade ("Nacional", "Múltiplo", outra UF) só com a
-- localidade, sem valor (o valor dela é do Brasil, ou de outro lugar). Sem código: só as linhas com a PB na localidade.
-- O `rp_inscrito` não sai: ele soma cada reinscrição do mesmo saldo e não se soma com nada.
create or replace function public.emd_pub_emenda(p_codigo text default null, p_execucao bigint default null)
returns table (
  codigo         text,
  linha          integer,
  ano            integer,
  tipo           text,
  tipo_texto     text,
  autor_codigo   text,
  autor_nome     text,
  numero         text,
  localidade     text,
  uf             text,
  ibge           text,
  pb_localidade  boolean,
  funcao         text,
  subfuncao      text,
  programa       text,
  acao           text,
  empenhado      numeric,
  liquidado      numeric,
  pago           numeric,
  rp_pago        numeric,
  rp_cancelado   numeric,
  pago_total     numeric,
  a_pagar        numeric
)
language sql stable
set search_path to 'public'
as $$
  select e.codigo, e.linha, e.ano, public.emd_pub_tipo(e.tipo, a.tipo, null), e.tipo, e.autor_codigo,
         coalesce(a.nome, e.autor_nome), e.numero, e.localidade, e.uf, e.ibge, e.pb_localidade,
         e.funcao, e.subfuncao, e.programa, e.acao,
         case when e.pb_localidade then e.empenhado end,
         case when e.pb_localidade then e.liquidado end,
         case when e.pb_localidade then e.pago end,
         case when e.pb_localidade then e.rp_pago end,
         case when e.pb_localidade then e.rp_cancelado end,
         case when e.pb_localidade then e.pago_total end,
         case when e.pb_localidade then e.a_pagar end
    from public.emd_emenda e
    left join public.emd_autor a on a.execucao_id = e.execucao_id and a.codigo = e.autor_codigo
   where e.execucao_id = coalesce(p_execucao, (select x.id from public.emd_ultima_execucao() x))
     and e.codigo is not null
     and ((p_codigo is null and e.pb_localidade) or e.codigo = p_codigo)
   order by e.codigo, e.pb_localidade desc, e.linha
$$;

-- A pessoa física: só a soma, por emenda e ano, na PB. Sem nome, documento ou município, por desenho da oport_39.
create or replace function public.emd_pub_pf(p_codigo text default null, p_execucao bigint default null)
returns table (
  codigo        text,
  ano           integer,
  n_pagamentos  integer,
  valor         numeric
)
language sql stable
set search_path to 'public'
as $$
  select p.codigo, p.ano, sum(p.n_pagamentos)::integer, sum(p.valor)
    from public.emd_pf p
   where p.execucao_id = coalesce(p_execucao, (select x.id from public.emd_ultima_execucao() x))
     and p.uf = 'PB'
     and (p_codigo is null or p.codigo = p_codigo)
   group by p.codigo, p.ano
   order by p.codigo, p.ano
$$;

-- -----------------------------------------------------------------------------
-- Os autores e os municípios
-- -----------------------------------------------------------------------------

-- Um por código de autor da execução, com as somas dos canais (nunca do catálogo) e as emendas com a PB na localidade
-- no catálogo. A página põe em ordem alfabética; aqui a ordem é a do código (a chave, para a leitura em páginas).
create or replace function public.emd_pub_autores(p_execucao bigint default null)
returns table (
  codigo               text,
  nome                 text,
  tipo                 text,
  coletivo             boolean,
  emendas              integer,
  linhas               integer,
  previsto             numeric,
  pago                 numeric,
  municipios           integer,
  ano_min              integer,
  ano_max              integer,
  convenio_pago        numeric,
  pix_pago             numeric,
  fns_pago             numeric,
  favorecido_pago      numeric,
  emendas_catalogo_pb  integer
)
language sql stable
set search_path to 'public'
as $$
  with ex as (select coalesce(p_execucao, (select e.id from public.emd_ultima_execucao() e)) id),
  porc as (
    select c.autor_codigo,
           count(distinct c.codigo)::integer emendas, count(*)::integer linhas,
           coalesce(sum(c.indicado), 0) previsto, coalesce(sum(c.pago), 0) pago,
           (count(distinct c.ibge) filter (where c.ibge is not null))::integer municipios,
           min(c.ano) ano_min, max(c.ano) ano_max,
           coalesce(sum(c.pago) filter (where c.canal = 'convenio'), 0) convenio_pago,
           coalesce(sum(c.pago) filter (where c.canal = 'pix'), 0) pix_pago,
           coalesce(sum(c.pago) filter (where c.canal = 'fns'), 0) fns_pago,
           coalesce(sum(c.pago) filter (where c.canal = 'favorecido'), 0) favorecido_pago
      from public.emd_canal c
     where c.execucao_id = (select ex.id from ex) and c.coberto_por is null and c.autor_codigo is not null
     group by c.autor_codigo),
  cat as (
    select e.autor_codigo, (count(distinct e.codigo) filter (where e.pb_localidade))::integer emendas_pb
      from public.emd_emenda e
     where e.execucao_id = (select ex.id from ex) and e.autor_codigo is not null
     group by e.autor_codigo)
  select a.codigo, a.nome, a.tipo, a.coletivo,
         coalesce(p.emendas, 0), coalesce(p.linhas, 0), coalesce(p.previsto, 0), coalesce(p.pago, 0),
         coalesce(p.municipios, 0), p.ano_min, p.ano_max,
         coalesce(p.convenio_pago, 0), coalesce(p.pix_pago, 0), coalesce(p.fns_pago, 0), coalesce(p.favorecido_pago, 0),
         coalesce(k.emendas_pb, 0)
    from public.emd_autor a
    left join porc p on p.autor_codigo = a.codigo
    left join cat k on k.autor_codigo = a.codigo
   where a.execucao_id = (select ex.id from ex)
   order by a.codigo
$$;

-- Os 223 municípios da última execução do fiscal (os sem nada aparecem com zero), cada um com o que as linhas com o IBGE
-- dele somam: prefeitura e fundos municipais e, à parte (`entidades_pago`), OSC, empresa e outros com sede nele. O
-- governo e os fundos estaduais vêm numa linha própria (`grupo = 'estado'`, sem IBGE: a sede não é o destino), e o que
-- não tem município identificado, noutra (`sem_municipio`). Ordem: grupo e nome.
create or replace function public.emd_pub_municipios(p_execucao bigint default null)
returns table (
  grupo            text,
  ibge             text,
  nome             text,
  emendas          integer,
  linhas           integer,
  previsto         numeric,
  pago             numeric,
  convenio_pago    numeric,
  pix_pago         numeric,
  fns_pago         numeric,
  favorecido_pago  numeric,
  entidades_pago   numeric
)
language sql stable
set search_path to 'public'
as $$
  with ex as (select coalesce(p_execucao, (select e.id from public.emd_ultima_execucao() e)) id),
  fx as (select e.id from public.fiscal_ultima_execucao() e),
  c as (
    select c.*, case when c.ente_tipo in ('estado', 'fundo_estadual') then 'estado'
                     when c.ibge is null then 'sem_municipio'
                     else 'municipio' end grupo
      from public.emd_canal c
     where c.execucao_id = (select ex.id from ex) and c.coberto_por is null),
  porm as (
    select c.grupo, case when c.grupo = 'municipio' then c.ibge end ibge,
           count(distinct c.codigo)::integer emendas, count(*)::integer linhas,
           coalesce(sum(c.indicado), 0) previsto, coalesce(sum(c.pago), 0) pago,
           coalesce(sum(c.pago) filter (where c.canal = 'convenio'), 0) convenio_pago,
           coalesce(sum(c.pago) filter (where c.canal = 'pix'), 0) pix_pago,
           coalesce(sum(c.pago) filter (where c.canal = 'fns'), 0) fns_pago,
           coalesce(sum(c.pago) filter (where c.canal = 'favorecido'), 0) favorecido_pago,
           coalesce(sum(c.pago) filter (where c.ente_tipo is distinct from 'municipio'
                                          and c.ente_tipo is distinct from 'fundo_municipal'), 0) entidades_pago
      from c
     group by 1, 2),
  mun as (select m.ibge, m.nome from public.fiscal_municipio m where m.execucao_id = (select fx.id from fx))
  select 'municipio'::text, coalesce(m.ibge, p.ibge), coalesce(m.nome, p.ibge),
         coalesce(p.emendas, 0), coalesce(p.linhas, 0), coalesce(p.previsto, 0), coalesce(p.pago, 0),
         coalesce(p.convenio_pago, 0), coalesce(p.pix_pago, 0), coalesce(p.fns_pago, 0), coalesce(p.favorecido_pago, 0),
         coalesce(p.entidades_pago, 0)
    from mun m
    full join (select * from porm where porm.grupo = 'municipio') p on p.ibge = m.ibge
  union all
  select p.grupo, null::text,
         case p.grupo when 'estado' then 'Governo do estado e fundos estaduais' else 'Sem município identificado' end,
         p.emendas, p.linhas, p.previsto, p.pago, p.convenio_pago, p.pix_pago, p.fns_pago, p.favorecido_pago,
         p.entidades_pago
    from porm p
   where p.grupo <> 'municipio'
   order by 1, 3
$$;

-- -----------------------------------------------------------------------------
-- Permissões: só `service_role`
-- -----------------------------------------------------------------------------

revoke execute on function public.emd_pub_mascara(text)                                       from public, anon, authenticated;
revoke execute on function public.emd_pub_ente_nome(text)                                     from public, anon, authenticated;
revoke execute on function public.emd_pub_tipo(text, text, text)                              from public, anon, authenticated;
revoke execute on function public.emd_pub_catalogo(bigint)                                    from public, anon, authenticated;
revoke execute on function public.emd_pub_execucao()                                          from public, anon, authenticated;
revoke execute on function public.emd_pub_linhas(integer, integer, text[], text, text[], text, text[], text[], text[], text[], text, text[], text[], text[], text[], text[], text[], numeric, numeric, numeric, numeric, text[], text, boolean, integer, integer, bigint) from public, anon, authenticated;
revoke execute on function public.emd_pub_agregado(text, text, bigint)                        from public, anon, authenticated;
revoke execute on function public.emd_pub_emenda(text, bigint)                                from public, anon, authenticated;
revoke execute on function public.emd_pub_pf(text, bigint)                                    from public, anon, authenticated;
revoke execute on function public.emd_pub_autores(bigint)                                     from public, anon, authenticated;
revoke execute on function public.emd_pub_municipios(bigint)                                  from public, anon, authenticated;

grant execute on function public.emd_pub_mascara(text)                                        to service_role;
grant execute on function public.emd_pub_ente_nome(text)                                      to service_role;
grant execute on function public.emd_pub_tipo(text, text, text)                               to service_role;
grant execute on function public.emd_pub_catalogo(bigint)                                     to service_role;
grant execute on function public.emd_pub_execucao()                                           to service_role;
grant execute on function public.emd_pub_linhas(integer, integer, text[], text, text[], text, text[], text[], text[], text[], text, text[], text[], text[], text[], text[], text[], numeric, numeric, numeric, numeric, text[], text, boolean, integer, integer, bigint) to service_role;
grant execute on function public.emd_pub_agregado(text, text, bigint)                         to service_role;
grant execute on function public.emd_pub_emenda(text, bigint)                                 to service_role;
grant execute on function public.emd_pub_pf(text, bigint)                                     to service_role;
grant execute on function public.emd_pub_autores(bigint)                                      to service_role;
grant execute on function public.emd_pub_municipios(bigint)                                   to service_role;

commit;

-- O PostgREST relê o esquema para enxergar as funções novas.
notify pgrst, 'reload schema';
