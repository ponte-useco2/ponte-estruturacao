-- =============================================================================
-- oport_57 — Cadeia quebrada do gasto: os casos por CNPJ (descida até o último nível, 30/10/2026)
--
-- O titular pediu (30/10/2026) que tudo em /mapa/cadeia-quebrada seja clicável até o último nível dos dados: situação →
-- órgão → caso (CNPJ) → origem (página do Diário, notas, PNCP, dossiê do fornecedor). Os casos estão no pacote da
-- DOE-PB (`casos.json`) e, pelo plano de publicação, são a fase 2: por CNPJ, atrás de conta aprovada — a página já é só
-- para quem está logado e aprovado.
--
-- `cq_caso` guarda um caso por linha, como o pacote traz, SEM a razão social: o pacote marca `exibir_nome = CNPJ`, e 31
-- razões terminam com cara de nome de pessoa (aviso R1b da conferência). Sem nome de pessoa, sem texto do ato (só o link).
-- O carregador (`cadeia/carregar.py`) grava os casos junto com os agregados, na mesma execução de `cq_execucao`.
--
-- Só acréscimo; idempotente. Pré-requisito: oport_56.
-- =============================================================================

create table if not exists public.cq_caso (
  execucao_id   bigint not null references public.cq_execucao (id) on delete cascade,
  ordem         integer not null,
  -- notas_empenho | emendas | sancoes: o bloco da página, como o pacote escreve.
  teste         text not null check (teste in ('notas_empenho', 'emendas', 'sancoes')),
  -- A situação como o pacote escreve (a mesma das linhas de `cq_resultado`, salvo "sanção alcança" × "alcança").
  situacao      text not null,
  status        text,
  cnpj          text not null check (cnpj ~ '^[0-9]{14}$'),
  orgao         text,
  pago          numeric,
  notas         integer,
  anos          text[],
  -- A página do Diário Oficial (edição da A União com #page=), quando o pacote traz.
  link_diario   text check (link_diario is null or link_diario ~ '^https://'),
  tipo_ato      text,
  data_ato      date,
  motivo        text,
  -- O registro da sanção que alcança (tipo, órgão sancionador, datas), quando o caso é de sanção.
  sancao        jsonb,
  primary key (execucao_id, ordem)
);
create index if not exists cq_caso_cnpj_idx on public.cq_caso (execucao_id, cnpj);
create index if not exists cq_caso_situacao_idx on public.cq_caso (execucao_id, teste, situacao, orgao);

alter table public.cq_caso enable row level security;
revoke all on table public.cq_caso from anon, authenticated;
grant all on table public.cq_caso to service_role;

-- A limpeza passa a levar os casos junto com os resultados das execuções antigas.
create or replace function public.cq_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.cq_ultima_execucao()), p_manter], null);
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  foreach t in array array['cq_resultado', 'cq_caso'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id <> all ($1) limit $2))', t, t)
      using manter, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.cq_limpar(bigint, integer) from public, anon, authenticated;
grant  execute on function public.cq_limpar(bigint, integer) to service_role;

notify pgrst, 'reload schema';
