-- =============================================================================
-- oport_58 — O plano de trabalho de cada proposta da PB (30/10/2026)
--
-- O titular pediu que a página da proposta mostre o conteúdo dela e o plano de trabalho. O job do painel
-- (`painel_execucao/plano_trabalho.py`) lê dos dados abertos do SICONV as metas e etapas, os itens do plano de aplicação
-- e as parcelas previstas, e grava UMA linha por proposta, com cada parte em `jsonb`. Na base de agosto: 26.888 propostas
-- da PB com plano, 34 mil metas, 67 mil etapas, 106 mil itens e 65 mil parcelas, uns 66 MB de JSON (mediana de 1,2 KB
-- por proposta; a maior, 155 KB). Endereço e CEP ficam de fora; os textos passam pela máscara de CPF.
--
-- A tabela entra na execução do painel (`painel_execucao`) e na limpeza dele (`painel_limpar`, que passa a apagá-la
-- junto, em lotes). Só `service_role` lê e grava; a página lê pelo servidor, uma linha pela chave.
--
-- ORDEM: aplicar ANTES de o código do job chegar à `main` — sem a tabela, a gravação do painel cairia. Aplicar fora
-- da rodada diária do painel (conferir que não há execução 'gravando'). Idempotente. Pré-requisitos: oport_35 e oport_52.
-- =============================================================================

create table if not exists public.painel_proposta_plano (
  execucao_id     bigint not null references public.painel_execucao (id) on delete cascade,
  id_proposta     text not null,
  -- [{nr, tipo, descricao, inicio, fim, uf, municipio, quantidade, unidade, valor, etapas: [{nr, descricao, inicio, fim,
  --   municipio, quantidade, unidade, valor}]}]
  metas           jsonb not null default '[]'::jsonb,
  -- [{descricao, aquisicao, tipo, natureza, cod_natureza, situacao, quantidade, valor_unitario, valor_total}], do maior
  -- valor ao menor, até 400 por proposta (`itens_cortados` diz quando passou).
  itens           jsonb not null default '[]'::jsonb,
  -- [{nr, mes, ano, responsavel, valor}]
  parcelas        jsonb not null default '[]'::jsonb,
  n_metas         integer,
  n_etapas        integer,
  n_itens         integer,
  itens_cortados  boolean not null default false,
  vl_metas        numeric,
  vl_itens        numeric,
  primary key (execucao_id, id_proposta)
);

alter table public.painel_proposta_plano enable row level security;
revoke all on table public.painel_proposta_plano from anon, authenticated;
grant all on table public.painel_proposta_plano to service_role;

-- O mesmo corpo da versão no banco (oport_52: a lista com painel_pagamento), com painel_proposta_plano na lista.
create or replace function public.painel_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  ultima        public.painel_execucao;
  manter        bigint[];
  apagar        bigint[];
  sem_conclusao bigint[];
  resta         integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total         integer := 0;
  n             integer;
  lote          integer;
  t             text;
  inicio        timestamptz := clock_timestamp();
  orcamento     constant interval := interval '3 seconds';
begin
  select * into ultima from public.painel_ultima_execucao();
  manter := array_remove(array[ultima.id, p_manter], null);
  select coalesce(array_agg(id), '{}'), coalesce(array_agg(id) filter (where status <> 'concluida'), '{}')
    into apagar, sem_conclusao
    from public.painel_execucao where id <> all (manter);

  if cardinality(apagar) > 0 then
    <<tabelas>>
    foreach t in array array['painel_convenio', 'painel_municipio', 'painel_aditivo_motivo', 'painel_etapa_tempo',
                             'painel_etapa_ano', 'painel_programa_desfecho', 'painel_proposta',
                             'painel_instrumento', 'painel_instrumento_evento', 'painel_instrumento_emenda',
                             'painel_fornecedor', 'painel_fornecedor_convenio', 'painel_contrato',
                             'painel_fornecedor_municipio', 'painel_territorio', 'painel_pagamento',
                             'painel_proposta_plano'] loop
      loop
        -- O plano tem linhas largas (até ~155 KB de jsonb): lote menor, para cada comando ficar longe dos 8 s.
        lote := least(resta, case when t = 'painel_proposta_plano' then 200 else 1000 end);
        execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
          using apagar, lote;
        get diagnostics n = row_count;
        total := total + n;
        resta := resta - n;
        exit tabelas when resta <= 0 or (total > 0 and clock_timestamp() - inicio > orcamento);
        -- menos linhas que o lote: esta tabela acabou
        exit when n < lote;
      end loop;
    end loop;
  end if;

  if resta > 0 and not (total > 0 and clock_timestamp() - inicio > orcamento) then
    delete from public.painel_mudanca where ctid = any (array(
      select ctid from public.painel_mudanca
       where execucao_id = any (sem_conclusao)
          or dado_ate < ultima.dado_ate - interval '60 days'
       limit resta));
    get diagnostics n = row_count;
    total := total + n;
  end if;
  return total;
end $function$;

revoke execute on function public.painel_limpar(bigint, integer) from public, anon, authenticated;
grant  execute on function public.painel_limpar(bigint, integer) to service_role;

notify pgrst, 'reload schema';
