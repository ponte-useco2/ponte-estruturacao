-- =============================================================================
-- oport_17 — filtro por canal e por tipo de proponente no radar (onda 10)
--
-- O radar já recortava por UF, janela e categoria. O titular pediu o filtro por coluna: as três
-- funções de leitura passam a aceitar `p_canal` e, onde faz sentido, `p_tipo`. Nulo = tudo, como hoje.
--
-- `drop` antes do `create`: acrescentar parâmetro com padrão criaria uma SOBRECARGA, e o PostgREST
-- resolveria pela chamada, deixando duas versões vivas. A função some por instantes durante a
-- migração; o radar é de administrador e a página refaz a leitura.
--
-- As funções validam o filtro em vez de devolver vazio: valor fora da lista é erro de chamada.
-- A lista de canais é a mesma do check de `radar_evento` (com 'ambiguo', que a coluna aceita e o
-- dado de hoje não usa); a de tipo de proponente é a que o job grava: municipio, osc, estado,
-- consorcio_publico e empresa.
--
-- Pré-requisito: oport_7. Grants explícitos, como manda a seguranca_1: só `service_role`.
-- =============================================================================

drop function if exists public.radar_placar(text);
drop function if exists public.radar_recorte(text, text, integer, text);
drop function if exists public.radar_disputa(text, integer);

create or replace function public.radar_filtro_valido(p_canal text, p_tipo text)
returns void
language plpgsql immutable
set search_path to 'public'
as $$
begin
  if p_canal is not null and p_canal not in ('voluntaria', 'emenda_parlamentar', 'beneficiario_especifico', 'ambiguo', 'nao_determinado') then
    raise exception 'canal inválido: %', p_canal;
  end if;
  if p_tipo is not null and p_tipo not in ('municipio', 'osc', 'estado', 'consorcio_publico', 'empresa') then
    raise exception 'tipo de proponente inválido: %', p_tipo;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- Placar: propostas distintas por categoria e janela, contra a janela anterior.
-- -----------------------------------------------------------------------------
create or replace function public.radar_placar(p_uf text default null, p_canal text default null, p_tipo text default null)
returns table (categoria text, dias integer, atual integer, anterior integer)
language plpgsql stable
set search_path to 'public'
as $$
begin
  perform public.radar_filtro_valido(p_canal, p_tipo);
  return query
  with ex as (select id, dado_ate from public.radar_ultima_execucao()),
       cat as (select unnest(array['nova', 'em_revisao', 'revisada']) categoria),
       jan as (select unnest(array[1, 7, 30]) dias)
  select cat.categoria, jan.dias,
         (select count(distinct e.id_proposta)::int
            from public.radar_evento e, ex
           where e.execucao_id = ex.id and e.categoria = cat.categoria
             and (p_uf is null or e.uf = p_uf)
             and (p_canal is null or e.canal = p_canal)
             and (p_tipo is null or e.tipo_agente = p_tipo)
             and e.ocorrido_em >  ex.dado_ate - make_interval(days => jan.dias)
             and e.ocorrido_em <= ex.dado_ate),
         (select count(distinct e.id_proposta)::int
            from public.radar_evento e, ex
           where e.execucao_id = ex.id and e.categoria = cat.categoria
             and (p_uf is null or e.uf = p_uf)
             and (p_canal is null or e.canal = p_canal)
             and (p_tipo is null or e.tipo_agente = p_tipo)
             and e.ocorrido_em >  ex.dado_ate - make_interval(days => 2 * jan.dias)
             and e.ocorrido_em <= ex.dado_ate - make_interval(days => jan.dias))
    from cat cross join jan
   where exists (select 1 from ex);
end $$;


-- -----------------------------------------------------------------------------
-- Recorte por canal, tipo de proponente ou programa, na janela e categoria escolhidas.
-- -----------------------------------------------------------------------------
create or replace function public.radar_recorte(
  p_uf text, p_dimensao text, p_dias integer, p_categoria text default 'nova',
  p_canal text default null, p_tipo text default null)
returns table (chave text, rotulo text, atual integer, anterior integer, valor_atual numeric, inferidos integer)
language plpgsql stable
set search_path to 'public'
as $$
-- As colunas de saída (chave, rotulo, atual…) são variáveis em PL/pgSQL e colidem
-- com as colunas de mesmo nome das CTEs. Sem esta diretiva, "column reference is
-- ambiguous".
#variable_conflict use_column
begin
  if p_dimensao not in ('canal', 'tipo_agente', 'programa') then
    raise exception 'dimensão inválida: %', p_dimensao;
  end if;
  if p_dias not in (1, 7, 30) then
    raise exception 'janela inválida: % dias', p_dias;
  end if;
  if p_categoria not in ('nova', 'em_revisao', 'revisada') then
    raise exception 'categoria inválida: %', p_categoria;
  end if;
  perform public.radar_filtro_valido(p_canal, p_tipo);

  return query
  with ex as (select id, dado_ate from public.radar_ultima_execucao()),
  base as (
    select e.id_proposta,
           case p_dimensao when 'canal' then e.canal when 'tipo_agente' then e.tipo_agente else e.cod_programa end chave,
           case p_dimensao when 'programa' then e.programa end rotulo,
           e.valor_repasse, e.canal_inferido,
           (e.ocorrido_em > ex.dado_ate - make_interval(days => p_dias)) no_atual
      from public.radar_evento e, ex
     where e.execucao_id = ex.id and e.categoria = p_categoria
       and (p_uf is null or e.uf = p_uf)
       and (p_canal is null or e.canal = p_canal)
       and (p_tipo is null or e.tipo_agente = p_tipo)
       and e.ocorrido_em > ex.dado_ate - make_interval(days => 2 * p_dias)
       and e.ocorrido_em <= ex.dado_ate
  ),
  -- Uma linha por proposta por período, para contagem e soma não duplicarem.
  por_proposta as (
    select chave, no_atual, id_proposta, max(rotulo) rotulo, max(valor_repasse) valor, bool_or(canal_inferido) inferido
      from base group by chave, no_atual, id_proposta
  )
  select p.chave,
         max(p.rotulo),
         (count(*) filter (where p.no_atual))::int,
         (count(*) filter (where not p.no_atual))::int,
         coalesce(sum(p.valor) filter (where p.no_atual), 0),
         (count(*) filter (where p.no_atual and p.inferido))::int
    from por_proposta p
   group by p.chave
   order by 3 desc, 4 desc, 1;
end $$;


-- -----------------------------------------------------------------------------
-- Disputa por programa aberto. Com UF, as janelas dela; sem UF, somadas por
-- programa e canal no Brasil. A janela não tem tipo de proponente: só o canal filtra.
-- -----------------------------------------------------------------------------
create or replace function public.radar_disputa(p_uf text default null, p_limite integer default 50, p_canal text default null)
returns table (cod_programa text, programa text, orgao text, canal text, abre date, fecha date,
               dias_restantes integer, ufs integer, novas_desde_abertura integer, novas_30d integer, valor_pedido numeric)
language plpgsql stable
set search_path to 'public'
as $$
#variable_conflict use_column
begin
  perform public.radar_filtro_valido(p_canal, null);
  return query
  with ex as (select id from public.radar_ultima_execucao())
  select a.cod_programa, max(a.programa), max(a.orgao), a.canal, min(a.abre), max(a.fecha),
         min(a.dias_restantes), count(distinct a.uf)::int,
         sum(a.novas_desde_abertura)::int, sum(a.novas_30d)::int, sum(a.valor_pedido)
    from public.radar_programa_aberto a, ex
   where a.execucao_id = ex.id and (p_uf is null or a.uf = p_uf)
     and (p_canal is null or a.canal = p_canal)
   group by a.cod_programa, a.canal
   order by 9 desc, 7 asc, 2
   limit greatest(1, least(coalesce(p_limite, 50), 500));
end $$;


revoke execute on function public.radar_filtro_valido(text, text)                            from public, anon, authenticated;
revoke execute on function public.radar_placar(text, text, text)                             from public, anon, authenticated;
revoke execute on function public.radar_recorte(text, text, integer, text, text, text)       from public, anon, authenticated;
revoke execute on function public.radar_disputa(text, integer, text)                         from public, anon, authenticated;
grant  execute on function public.radar_filtro_valido(text, text)                            to service_role;
grant  execute on function public.radar_placar(text, text, text)                             to service_role;
grant  execute on function public.radar_recorte(text, text, integer, text, text, text)       to service_role;
grant  execute on function public.radar_disputa(text, integer, text)                         to service_role;
