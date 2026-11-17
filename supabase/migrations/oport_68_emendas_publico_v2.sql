-- =============================================================================
-- oport_68 — Portal público das emendas, versão 2 do desenho: o que faltava no banco (17/11/2026)
--
-- Decisão do titular (17/11/2026, `Site-Ponte/transparencia-emendas/IMPLEMENTACAO-V2.md`): a v2 orienta a
-- implementação, com três ajustes — (A) toda soma de medida disponível só em parte dos registros diz a cobertura
-- ("Previsto: R$ 59,79 mi em 32 dos 44 registros"); (B) o período é o ANO DA EMENDA e o realizado é acumulado até a
-- data de referência; (C) a ficha lista TODOS os instrumentos da emenda na PB, cada um com a fonte oficial e o detalhe.
-- O site lê só estas funções (`emd_pub_*`), pela chave de serviço; as tabelas continuam só para `service_role`.
--
-- O que muda (as três por `drop` + `create`, porque a assinatura ou o retorno mudam; numa transação):
--   · emd_pub_linhas — novos filtros `p_autores` (vários códigos de autor) e `p_anos` (anos da emenda isolados, dentro do
--     período); nova ordem `empenhado`; o empate de qualquer ordem escolhida segue o código da emenda; novas colunas do
--     registro `empenhado` (do canal), `fisico` (execução física atestada do convênio, 0 a 1), `valor_global` e
--     `contrapartida` (do convênio); e os TOTAIS DO RECORTE INTEIRO em toda linha (registros, emendas distintas, previsto
--     e quantos registros têm previsto, empenhado e quantos têm empenho, realizado), para a tela e o arquivo dizerem o
--     total com a cobertura sem somar só a página;
--   · emd_pub_agregado — período por parâmetro (`p_ano_de`, `p_ano_ate`) e, por grupo: municípios com registro, empenhado
--     e a cobertura (registros com previsto, com empenho e com execução física registrada); passa a plpgsql com plano
--     sob medida (o plano genérico da função `sql` virava laço aninhado: 3 a 8 s com os dados reais; agora < 0,5 s);
--   · emd_pub_emenda — a execução orçamentária NACIONAL da emenda (empenhado, liquidado, pago no exercício, restos pagos,
--     restos cancelados, a pagar, somando todas as localidades do Portal) em colunas `nacional_*`, rotuladas e repetidas em
--     cada linha. Nunca somadas à parcela da PB: a página mostra lado a lado. A linha de outra localidade continua sem os
--     valores dela (só a localidade).
--   · emd_pub_facetas (nova) — as contagens do painel "Filtrar" da tela de registros: para cada grupo de filtro, quantos
--     registros cada opção teria com os outros filtros aplicados (os mesmos filtros de emd_pub_linhas).
-- As outras funções da oport_67 ficam como estão.
--
-- Cobertura (ajuste A): `previsto` é nulo no pagamento direto (a fonte não traz), `empenhado` é nulo no fundo a fundo e
-- no pagamento direto; nulo NUNCA vira zero nas contagens (`count(coluna)` conta só o que existe).
--
-- Acesso: SÓ `service_role` (revoke de public, anon e authenticated). `security invoker`, `stable`, `search_path` fixo.
--
-- ORDEM: depois da oport_67 (aplicada em produção). O site da v2 chama as assinaturas novas; o site publicado antes da v2
-- não chama nenhuma destas funções. Idempotente (o `drop ... if exists` cobre as duas assinaturas, a da oport_67 e a
-- desta). O titular aplica no SQL Editor. Ensaio: 2× em Postgres 17 descartável (`scratchpad/portal-emendas/ensaio`).
--
-- REVERTER: rodar de novo, da oport_67, os três `create or replace function` (linhas, agregado, emenda) e os
-- `revoke`/`grant` deles, depois do `drop` das assinaturas desta e de `emd_pub_facetas` (nova; nada da v1 a chama).
-- =============================================================================

begin;

drop function if exists public.emd_pub_linhas(integer, integer, text[], text, text[], text, text[], text[], text[], text[], text, text[], text[], text[], text[], text[], text[], numeric, numeric, numeric, numeric, text[], text, boolean, integer, integer, bigint);
drop function if exists public.emd_pub_linhas(integer, integer, text[], text, text[], text, text[], text[], text[], text[], text, text[], text[], text[], text[], text[], text[], numeric, numeric, numeric, numeric, text[], text[], integer[], text, boolean, integer, integer, bigint);
drop function if exists public.emd_pub_agregado(text, text, bigint);
drop function if exists public.emd_pub_agregado(text, text, integer, integer, bigint);
drop function if exists public.emd_pub_emenda(text, bigint);
drop function if exists public.emd_pub_facetas(integer, integer, text, text[], text[], text[], text[], text[], integer[], text[], bigint);

-- -----------------------------------------------------------------------------
-- As linhas (17.1), com os totais do recorte inteiro
-- -----------------------------------------------------------------------------

create function public.emd_pub_linhas(
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
  -- oport_68: vários autores e anos isolados (o "Quando" e a "Autoria" da página do município, que abrem os registros).
  p_autores       text[]  default null,
  p_anos          integer[] default null,
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
  empenhado              numeric,
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
  valor_global           numeric,
  convenio_repasse       numeric,
  contrapartida          numeric,
  convenio_desembolsado  numeric,
  fisico                 numeric,
  pix_area               text,
  pix_custeio            numeric,
  pix_investimento       numeric,
  pix_fim_execucao       date,
  fns_tipo_recurso       text,
  total                  bigint,
  total_emendas          bigint,
  total_previsto         numeric,
  total_com_previsto     bigint,
  total_empenhado        numeric,
  total_com_empenhado    bigint,
  total_pago             numeric
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
  v_autores text[] := nullif(p_autores, '{}');
  v_anos   integer[] := nullif(p_anos, '{}');
  v_ordem  text    := case when p_ordem in ('ano', 'codigo', 'tipo', 'autor', 'canal', 'ente', 'municipio', 'objeto',
                                            'funcao', 'previsto', 'empenhado', 'pago', 'situacao') then p_ordem end;
  v_desc   boolean := coalesce(p_desc, false);
  v_lim    integer := greatest(1, least(coalesce(p_limite, 100), 1000));
  v_desl   integer := greatest(0, least(coalesce(p_deslocamento, 0), 1000000));
  -- O objeto (e o nome público do ente) de TODAS as linhas só quando a busca, o filtro ou a ordem pedem (oport_67).
  v_todos  boolean;
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
           c.indicado previsto, c.empenhado, c.pago,
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
       and (v_autores is null or c.autor_codigo = any (v_autores))
       and (p_ibge is null or c.ibge = p_ibge)
       and (p_ano_de is null or c.ano >= p_ano_de)
       and (p_ano_ate is null or c.ano <= p_ano_ate)
       and (v_anos is null or c.ano = any (v_anos))
       and (v_canal is null or c.canal = any (v_canal))
       and (v_entet is null or coalesce(c.ente_tipo, '') = any (v_entet))
       and (p_previsto_de is null or c.indicado >= p_previsto_de)
       and (p_previsto_ate is null or c.indicado <= p_previsto_ate)
       and (p_pago_de is null or c.pago >= p_pago_de)
       and (p_pago_ate is null or c.pago <= p_pago_ate)
       and (v_instr is null or lower(c.instrumento) like all (v_instr))
  ),
  -- O recorte inteiro (todas as páginas): é dele que saem os totais e a ordem.
  g as materialized (
    select b.*
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
  ),
  -- Os totais com a cobertura (ajuste A): o nulo não conta como zero.
  tot as (
    select count(*) n, count(distinct g.codigo) emendas,
           coalesce(sum(g.previsto), 0) previsto, count(g.previsto) com_previsto,
           coalesce(sum(g.empenhado), 0) empenhado, count(g.empenhado) com_empenhado,
           coalesce(sum(g.pago), 0) pago
      from g
  ),
  f as (
    select g.linha, g.codigo, g.canal, g.instrumento, g.numero, g.funcao, g.autor_nome, g.tipo, g.municipio, g.etapa,
           g.objeto,
           row_number() over (order by
             case when v_ordem = 'ano'       and not v_desc then g.ano end asc nulls last,
             case when v_ordem = 'ano'       and v_desc     then g.ano end desc nulls last,
             case when v_ordem = 'codigo'    and not v_desc then g.codigo end asc nulls last,
             case when v_ordem = 'codigo'    and v_desc     then g.codigo end desc nulls last,
             case when v_ordem = 'tipo'      and not v_desc then array_position(array['individual_finalidade', 'individual_especial', 'bancada', 'comissao', 'relator', 'outro'], g.tipo) end asc nulls last,
             case when v_ordem = 'tipo'      and v_desc     then array_position(array['individual_finalidade', 'individual_especial', 'bancada', 'comissao', 'relator', 'outro'], g.tipo) end desc nulls last,
             case when v_ordem = 'autor'     and not v_desc then nullif(public.oport_sem_acento(g.autor_nome), '') end asc nulls last,
             case when v_ordem = 'autor'     and v_desc     then nullif(public.oport_sem_acento(g.autor_nome), '') end desc nulls last,
             case when v_ordem = 'canal'     and not v_desc then array_position(array['convenio', 'pix', 'fns', 'favorecido'], g.canal) end asc nulls last,
             case when v_ordem = 'canal'     and v_desc     then array_position(array['convenio', 'pix', 'fns', 'favorecido'], g.canal) end desc nulls last,
             case when v_ordem = 'ente'      and not v_desc then nullif(public.oport_sem_acento(g.ente_nome), '') end asc nulls last,
             case when v_ordem = 'ente'      and v_desc     then nullif(public.oport_sem_acento(g.ente_nome), '') end desc nulls last,
             case when v_ordem = 'municipio' and not v_desc then nullif(public.oport_sem_acento(g.municipio), '') end asc nulls last,
             case when v_ordem = 'municipio' and v_desc     then nullif(public.oport_sem_acento(g.municipio), '') end desc nulls last,
             case when v_ordem = 'objeto'    and not v_desc then nullif(public.oport_sem_acento(g.objeto), '') end asc nulls last,
             case when v_ordem = 'objeto'    and v_desc     then nullif(public.oport_sem_acento(g.objeto), '') end desc nulls last,
             case when v_ordem = 'funcao'    and not v_desc then nullif(public.oport_sem_acento(g.funcao), '') end asc nulls last,
             case when v_ordem = 'funcao'    and v_desc     then nullif(public.oport_sem_acento(g.funcao), '') end desc nulls last,
             case when v_ordem = 'previsto'  and not v_desc then g.previsto end asc nulls last,
             case when v_ordem = 'previsto'  and v_desc     then g.previsto end desc nulls last,
             case when v_ordem = 'empenhado' and not v_desc then g.empenhado end asc nulls last,
             case when v_ordem = 'empenhado' and v_desc     then g.empenhado end desc nulls last,
             case when v_ordem = 'pago'      and not v_desc then g.pago end asc nulls last,
             case when v_ordem = 'pago'      and v_desc     then g.pago end desc nulls last,
             case when v_ordem = 'situacao'  and not v_desc then array_position(array['proposta', 'assinatura', 'suspensiva', 'execucao', 'contas', 'concluido', 'extinto', 'caducou', 'impedido', 'reapresentado', 'sem_pagamento', 'pago_parcial', 'pago'], g.etapa) end asc nulls last,
             case when v_ordem = 'situacao'  and v_desc     then array_position(array['proposta', 'assinatura', 'suspensiva', 'execucao', 'contas', 'concluido', 'extinto', 'caducou', 'impedido', 'reapresentado', 'sem_pagamento', 'pago_parcial', 'pago'], g.etapa) end desc nulls last,
             -- v2: o empate de qualquer ordem escolhida segue o código da emenda (crescente); sem ordem, nada muda.
             case when v_ordem is not null then g.codigo end asc nulls last,
             -- A ordem padrão, que também desempata qualquer outra: alfabética e estável, nunca por valor (oport_67).
             g.ano desc nulls last,
             nullif(public.oport_sem_acento(g.autor_nome), '') asc nulls last,
             g.codigo asc nulls last,
             array_position(array['convenio', 'pix', 'fns', 'favorecido'], g.canal),
             g.instrumento,
             g.ano_pagamento nulls first,
             g.linha) pos
      from g
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
         c.indicado, c.empenhado, c.pago, c.n_autores,
         nullif(f.etapa, ''), c.situacao, c.caducou_em,
         c.dt_assinatura, c.dt_primeiro_pagamento, c.dt_ultimo_pagamento,
         i.orgao_sup, i.orgao, i.dt_inicio_vigencia, i.dt_fim_vigencia, i.vl_global, i.vl_repasse, i.vl_contrapartida,
         i.vl_desembolsado,
         -- A execução física do painel vem em percentual (0 a 100) ou em fração; aqui sai sempre em fração (0 a 1).
         case when i.pct_fisico is null then null when i.pct_fisico > 1 then i.pct_fisico / 100 else i.pct_fisico end,
         p.area, p.custeio, p.investimento, p.fim_execucao,
         fp.tipo_recurso,
         tot.n, tot.emendas, tot.previsto, tot.com_previsto, tot.empenhado, tot.com_empenhado, tot.pago
    from f
    cross join tot
    join public.emd_canal c on c.execucao_id = v_ex and c.linha = f.linha
    left join cat t on t.codigo = f.codigo
    left join public.emd_autor a on a.execucao_id = c.execucao_id and a.codigo = c.autor_codigo
    left join lateral (
      select i2.objeto, i2.orgao_sup, i2.orgao, i2.dt_inicio_vigencia, i2.dt_fim_vigencia, i2.vl_global, i2.vl_repasse,
             i2.vl_contrapartida, i2.vl_desembolsado, i2.pct_fisico
        from public.painel_instrumento i2
       where f.canal = 'convenio' and i2.execucao_id = v_pe and i2.nr_convenio = f.instrumento
       order by i2.objeto nulls last
       limit 1
    ) i on true
    left join public.pix_laudo_plano p
           on f.canal = 'pix' and p.execucao_id = v_px
          and p.id_plano_acao = (case when f.instrumento ~ '^[0-9]{1,18}$' then f.instrumento::bigint end)
    left join public.emd_fns_proposta fp on f.canal = 'fns' and fp.execucao_id = v_ex and fp.nu_proposta = f.instrumento
    left join lateral (
      select coalesce(f.objeto, case f.canal when 'convenio' then i.objeto when 'pix' then p.objeto
                                             when 'fns' then fp.tipo_proposta else t.acao end) objeto
    ) ob on true
   order by f.pos;
end $function$;

-- -----------------------------------------------------------------------------
-- As somas, com o período e a cobertura
-- -----------------------------------------------------------------------------

-- `grupo` diz o conjunto de agrupamento (os mesmos da oport_67). Por grupo: emendas distintas, registros, municípios com
-- registro (o Estado não conta), previsto e realizado, empenhado, e a cobertura — quantos registros têm previsto, quantos
-- têm empenho e quantos convênios têm execução física registrada no Transferegov.
create function public.emd_pub_agregado(
  p_autor     text    default null,
  p_ibge      text    default null,
  p_ano_de    integer default null,
  p_ano_ate   integer default null,
  p_execucao  bigint  default null
)
returns table (
  grupo          text,
  ano            integer,
  tipo           text,
  canal          text,
  funcao         text,
  ente_tipo      text,
  emendas        integer,
  linhas         integer,
  municipios     integer,
  previsto       numeric,
  empenhado      numeric,
  pago           numeric,
  com_previsto   integer,
  com_empenhado  integer,
  com_fisico     integer
)
language plpgsql stable
set search_path to 'public'
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
begin
  -- plpgsql com plano sob medida (como emd_pub_linhas): numa função `language sql` o plano é genérico, os filtros
  -- `(p_x is null or …)` derrubam a estimativa para 1 linha e o plano vira laço aninhado (3 a 8 s no ensaio real).
  return query
  with ex as (select coalesce(p_execucao, (select e.id from public.emd_ultima_execucao() e)) id),
  pe as (select e.id from public.painel_ultima_execucao() e),
  cat as materialized (select k.* from public.emd_pub_catalogo((select ex.id from ex)) k),
  b as (
    select c.ano, c.codigo, c.canal, c.ente_tipo, c.ibge, c.indicado, c.empenhado, c.pago, t.funcao,
           public.emd_pub_tipo(t.tipo_texto, a.tipo, c.canal) tipo,
           -- A execução física registrada (só convênio): busca pelo índice (execucao_id, nr_convenio) do painel. Uma
           -- junção com a lista dos convênios virava laço aninhado no plano genérico da função (8 s no ensaio real).
           (c.canal = 'convenio' and exists (
              select 1 from public.painel_instrumento i
               where i.execucao_id = (select pe.id from pe) and i.nr_convenio = c.instrumento and i.pct_fisico is not null
           )) tem_fisico
      from public.emd_canal c
      left join cat t on t.codigo = c.codigo
      left join public.emd_autor a on a.execucao_id = c.execucao_id and a.codigo = c.autor_codigo
     where c.execucao_id = (select ex.id from ex)
       and c.coberto_por is null
       and (p_autor is null or c.autor_codigo = p_autor)
       and (p_ibge is null or c.ibge = p_ibge)
       and (p_ano_de is null or c.ano >= p_ano_de)
       and (p_ano_ate is null or c.ano <= p_ano_ate)
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
         (count(distinct b.ibge) filter (where b.ibge is not null))::integer,
         coalesce(sum(b.indicado), 0), coalesce(sum(b.empenhado), 0), coalesce(sum(b.pago), 0),
         count(b.indicado)::integer, count(b.empenhado)::integer, (count(*) filter (where b.tem_fisico))::integer
    from b
   group by grouping sets ((b.ano, b.tipo, b.canal, b.funcao), (b.ano, b.tipo), (b.ano, b.canal), (b.ano), (b.tipo),
                           (b.canal), (b.funcao), (b.ente_tipo), ())
   order by 1, 2 nulls first, 3 nulls first, 4 nulls first, 5 nulls first, 6 nulls first;
end $function$;

-- -----------------------------------------------------------------------------
-- As contagens do painel "Filtrar" da tela de registros (nova)
-- -----------------------------------------------------------------------------

-- Para cada grupo de filtro (forma de repasse, tipo do ente, função, tipo da emenda, autoria, ano da emenda), quantos
-- registros do recorte cada opção teria: o recorte com TODOS os outros filtros e sem o do próprio grupo (a contagem que a
-- pessoa vê ao lado de cada caixa). Os filtros são os de `emd_pub_linhas`, com o mesmo significado (inclusive a busca).
-- `chave` é o valor do filtro no banco (canal, ente_tipo, função sem acento, tipo, código do autor, ano); `rotulo` só
-- na função (o nome com acento) e na autoria (o nome publicado). Um registro conta uma vez por grupo.
create function public.emd_pub_facetas(
  p_ano_de    integer default null,
  p_ano_ate   integer default null,
  p_ibge      text    default null,
  p_canal     text[]  default null,
  p_ente_tipo text[]  default null,
  p_funcao    text[]  default null,
  p_tipo      text[]  default null,
  p_autores   text[]  default null,
  p_anos      integer[] default null,
  p_busca     text[]  default null,
  p_execucao  bigint  default null
)
returns table (
  grupo      text,
  chave      text,
  rotulo     text,
  registros  integer
)
language plpgsql stable
set search_path to 'public'
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
declare
  v_ex      bigint    := coalesce(p_execucao, (select e.id from public.emd_ultima_execucao() e));
  v_pe      bigint    := (select e.id from public.painel_ultima_execucao() e);
  v_px      bigint    := (select e.id from public.pix_ultima_execucao() e);
  v_fx      bigint    := (select e.id from public.fiscal_ultima_execucao() e);
  v_canal   text[]    := nullif(p_canal, '{}');
  v_entet   text[]    := nullif(p_ente_tipo, '{}');
  v_func    text[]    := nullif(p_funcao, '{}');
  v_tipo    text[]    := nullif(p_tipo, '{}');
  v_autores text[]    := nullif(p_autores, '{}');
  v_anos    integer[] := nullif(p_anos, '{}');
  v_busca   text[]    := nullif(p_busca, '{}');
begin
  return query
  with cat as materialized (
    select k.* from public.emd_pub_catalogo(v_ex) k
  ),
  -- O objeto só quando há busca (como em emd_pub_linhas).
  obj as materialized (
    select 'convenio'::text canal, i.nr_convenio instrumento, i.objeto
      from public.painel_instrumento i
     where v_busca is not null
       and i.execucao_id = v_pe
       and i.nr_convenio = any (array(select distinct c2.instrumento from public.emd_canal c2
                                       where c2.execucao_id = v_ex and c2.canal = 'convenio' and c2.coberto_por is null))
    union all
    select 'pix', p.id_plano_acao::text, p.objeto
      from public.pix_laudo_plano p
     where v_busca is not null and p.execucao_id = v_px
    union all
    select 'fns', f.nu_proposta, f.tipo_proposta
      from public.emd_fns_proposta f
     where v_busca is not null and f.execucao_id = v_ex
  ),
  b as materialized (
    select c.canal, coalesce(c.ente_tipo, '') ente_tipo, c.ano, coalesce(c.autor_codigo, '') autor_codigo,
           coalesce(a.nome, t.autor_nome) autor_nome, t.funcao, public.oport_sem_acento(t.funcao) funcao_sa,
           coalesce(public.emd_pub_tipo(t.tipo_texto, a.tipo, c.canal), '') tipo
      from public.emd_canal c
      left join cat t on t.codigo = c.codigo
      left join public.emd_autor a on a.execucao_id = c.execucao_id and a.codigo = c.autor_codigo
      left join public.fiscal_municipio m on v_busca is not null and m.execucao_id = v_fx and m.ibge = c.ibge
      left join obj o on o.canal = c.canal and o.instrumento = c.instrumento
     where c.execucao_id = v_ex
       and c.coberto_por is null
       and (p_ibge is null or c.ibge = p_ibge)
       and (p_ano_de is null or c.ano >= p_ano_de)
       and (p_ano_ate is null or c.ano <= p_ano_ate)
       and (v_busca is null
            or public.oport_sem_acento(concat_ws(' ', c.codigo, coalesce(t.numero, substr(c.codigo, 9, 4)),
                                                 coalesce(a.nome, t.autor_nome), public.emd_pub_ente_nome(c.ente_nome),
                                                 m.nome, case when c.canal = 'favorecido' then t.acao else o.objeto end,
                                                 c.instrumento)) like all (v_busca))
  ),
  f as materialized (
    select b.*,
           (v_canal is null or b.canal = any (v_canal)) k_canal,
           (v_entet is null or b.ente_tipo = any (v_entet)) k_ente,
           (v_func is null or b.funcao_sa = any (v_func)) k_func,
           (v_tipo is null or b.tipo = any (v_tipo)) k_tipo,
           (v_autores is null or b.autor_codigo = any (v_autores)) k_aut,
           (v_anos is null or b.ano = any (v_anos)) k_ano
      from b
  )
  select 'canal'::text, f.canal, null::text, count(*)::integer
    from f where f.k_ente and f.k_func and f.k_tipo and f.k_aut and f.k_ano group by f.canal
  union all
  select 'ente_tipo', f.ente_tipo, null, count(*)::integer
    from f where f.k_canal and f.k_func and f.k_tipo and f.k_aut and f.k_ano group by f.ente_tipo
  union all
  select 'funcao', f.funcao_sa, max(f.funcao), count(*)::integer
    from f where f.k_canal and f.k_ente and f.k_tipo and f.k_aut and f.k_ano group by f.funcao_sa
  union all
  select 'tipo', f.tipo, null, count(*)::integer
    from f where f.k_canal and f.k_ente and f.k_func and f.k_aut and f.k_ano group by f.tipo
  union all
  select 'autoria', f.autor_codigo, max(f.autor_nome), count(*)::integer
    from f where f.k_canal and f.k_ente and f.k_func and f.k_tipo and f.k_ano group by f.autor_codigo
  union all
  select 'ano', f.ano::text, null, count(*)::integer
    from f where f.k_canal and f.k_ente and f.k_func and f.k_tipo and f.k_aut group by f.ano;
end $function$;

-- -----------------------------------------------------------------------------
-- O catálogo: a linha da PB e, à parte, a execução NACIONAL da emenda
-- -----------------------------------------------------------------------------

-- Com o código: todas as linhas da emenda; a de outra localidade só com a localidade (sem os valores dela). Sem código:
-- só as linhas com a PB na localidade. Em toda linha, a execução nacional da emenda (`nacional_*`: a soma de TODAS as
-- localidades do Portal), rotulada como nacional. A página mostra a nacional ao lado da parcela da PB, nunca somadas.
create function public.emd_pub_emenda(p_codigo text default null, p_execucao bigint default null)
returns table (
  codigo                 text,
  linha                  integer,
  ano                    integer,
  tipo                   text,
  tipo_texto             text,
  autor_codigo           text,
  autor_nome             text,
  numero                 text,
  localidade             text,
  uf                     text,
  ibge                   text,
  pb_localidade          boolean,
  funcao                 text,
  subfuncao              text,
  programa               text,
  acao                   text,
  empenhado              numeric,
  liquidado              numeric,
  pago                   numeric,
  rp_pago                numeric,
  rp_cancelado           numeric,
  pago_total             numeric,
  a_pagar                numeric,
  nacional_empenhado     numeric,
  nacional_liquidado     numeric,
  nacional_pago          numeric,
  nacional_rp_pago       numeric,
  nacional_rp_cancelado  numeric,
  nacional_a_pagar       numeric,
  localidades            integer
)
language sql stable
set search_path to 'public'
as $$
  with ex as (select coalesce(p_execucao, (select x.id from public.emd_ultima_execucao() x)) id),
  nac as (
    select e.codigo,
           sum(e.empenhado) empenhado, sum(e.liquidado) liquidado, sum(e.pago) pago, sum(e.rp_pago) rp_pago,
           sum(e.rp_cancelado) rp_cancelado, sum(e.a_pagar) a_pagar, count(*)::integer localidades
      from public.emd_emenda e
     where e.execucao_id = (select ex.id from ex)
       and e.codigo is not null
       and (p_codigo is null or e.codigo = p_codigo)
     group by e.codigo)
  select e.codigo, e.linha, e.ano, public.emd_pub_tipo(e.tipo, a.tipo, null), e.tipo, e.autor_codigo,
         coalesce(a.nome, e.autor_nome), e.numero, e.localidade, e.uf, e.ibge, e.pb_localidade,
         e.funcao, e.subfuncao, e.programa, e.acao,
         case when e.pb_localidade then e.empenhado end,
         case when e.pb_localidade then e.liquidado end,
         case when e.pb_localidade then e.pago end,
         case when e.pb_localidade then e.rp_pago end,
         case when e.pb_localidade then e.rp_cancelado end,
         case when e.pb_localidade then e.pago_total end,
         case when e.pb_localidade then e.a_pagar end,
         n.empenhado, n.liquidado, n.pago, n.rp_pago, n.rp_cancelado, n.a_pagar, n.localidades
    from public.emd_emenda e
    join nac n on n.codigo = e.codigo
    left join public.emd_autor a on a.execucao_id = e.execucao_id and a.codigo = e.autor_codigo
   where e.execucao_id = (select ex.id from ex)
     and e.codigo is not null
     and ((p_codigo is null and e.pb_localidade) or e.codigo = p_codigo)
   order by e.codigo, e.pb_localidade desc, e.linha
$$;

-- -----------------------------------------------------------------------------
-- Permissões: só `service_role`
-- -----------------------------------------------------------------------------

revoke execute on function public.emd_pub_linhas(integer, integer, text[], text, text[], text, text[], text[], text[], text[], text, text[], text[], text[], text[], text[], text[], numeric, numeric, numeric, numeric, text[], text[], integer[], text, boolean, integer, integer, bigint) from public, anon, authenticated;
revoke execute on function public.emd_pub_agregado(text, text, integer, integer, bigint) from public, anon, authenticated;
revoke execute on function public.emd_pub_emenda(text, bigint) from public, anon, authenticated;
revoke execute on function public.emd_pub_facetas(integer, integer, text, text[], text[], text[], text[], text[], integer[], text[], bigint) from public, anon, authenticated;

grant execute on function public.emd_pub_linhas(integer, integer, text[], text, text[], text, text[], text[], text[], text[], text, text[], text[], text[], text[], text[], text[], numeric, numeric, numeric, numeric, text[], text[], integer[], text, boolean, integer, integer, bigint) to service_role;
grant execute on function public.emd_pub_agregado(text, text, integer, integer, bigint) to service_role;
grant execute on function public.emd_pub_emenda(text, bigint) to service_role;
grant execute on function public.emd_pub_facetas(integer, integer, text, text[], text[], text[], text[], text[], integer[], text[], bigint) to service_role;

commit;

-- O PostgREST relê o esquema para enxergar as assinaturas novas.
notify pgrst, 'reload schema';
