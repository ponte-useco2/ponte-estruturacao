-- =============================================================================
-- oport_52 — Os pagamentos um a um às empresas dos convênios da PB (onda 19, 28/10/2026)
--
-- Até aqui o painel guardava, por empresa e convênio (`painel_fornecedor_convenio`), só o total pago, o número de
-- pagamentos, o primeiro e o último. O job já lê cada pagamento do SICONV (`siconv_pagamento`) e somava antes de
-- gravar; agora grava também a linha de cada pagamento a pessoa jurídica, para o detalhe da empresa na aba Execução
-- do instrumento (só administrador) mostrar a data, o valor e o documento de cada um.
--
-- Recorte e privacidade (as mesmas regras de `painel_execucao/fornecedores.py`, decisão do titular de 29/09/2026):
--   · só a PB e só pessoa jurídica (CNPJ de 14 dígitos). Pessoa física continua só somada, sem linha;
--   · o próprio convenente e o órgão executor (OBTV para o convenente ou para o executor) não são fornecedor e
--     ficam fora, como nas somas;
--   · em 28/10/2026 eram 35.474 pagamentos a empresas na PB (maior par empresa × convênio: 801), uns 4 MB.
--
-- Leitura só pelo servidor, com a chave de serviço, como as outras tabelas do painel. A limpeza das execuções
-- antigas (`painel_limpar`) passa a apagar também esta tabela: mesmo corpo da oport_35, muda só a lista.
-- =============================================================================

create table if not exists public.painel_pagamento (
  execucao_id   bigint not null references public.painel_execucao (id) on delete cascade,
  nr_convenio   text not null,
  cnpj          text not null,
  -- NR_MOV_FIN: o número da movimentação financeira no SICONV, único por pagamento.
  nr_mov_fin    text,
  -- Data do pagamento; vazia quando a do arquivo é impossível (fora da janela válida do painel).
  data          date,
  valor         numeric not null default 0,
  -- DESC_DL e NR_DL: o tipo e o número do documento de liquidação (em geral, "NOTA FISCAL" e o número dela).
  documento     text,
  nr_documento  text
);
create index if not exists painel_pagamento_convenio_idx on public.painel_pagamento (execucao_id, nr_convenio, cnpj);

alter table public.painel_pagamento enable row level security;
revoke all on table public.painel_pagamento from anon, authenticated;
grant all on table public.painel_pagamento to service_role;

-- -----------------------------------------------------------------------------
-- Limpeza em lotes: a mesma da oport_35, com `painel_pagamento` na lista.
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
                             'painel_fornecedor_municipio', 'painel_territorio', 'painel_pagamento'] loop
      loop
        lote := least(resta, 1000);
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
