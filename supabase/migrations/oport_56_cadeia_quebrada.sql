-- =============================================================================
-- oport_56 — Cadeia quebrada do gasto, fase 1: o pacote da DOE-PB no portal (PUB-09, 29/10/2026)
--
-- O plano de publicação da "cadeia quebrada do gasto" (Grafos/PUB-01-cadeia-quebrada/PLANO_PUBLICACAO_v0.2.md,
-- portões decididos pelo titular em 29/10/2026) põe o portal só como vitrine: a análise é da sessão DOE-PB, que
-- entrega um pacote determinístico (manifesto.json com o sha256 do conteúdo, agregados.json, casos.json e
-- regra_alcance.json). O portal confere o hash e as contagens do manifesto e grava os AGREGADOS, nunca os casos (a
-- fase 2 é por CNPJ, atrás de conta aprovada, e fica para depois).
--
--   cq_execucao  uma por pacote carregado (o padrão `*_execucao`: gravando → concluida, a página lê a última
--                concluída). Leva o manifesto: versão, sha256, regra de alcance e a versão dela, o limiar de
--                precisão, a regra do "fecha", a precisão medida, os insumos com hash e as coberturas.
--   cq_resultado as linhas das três tabelas de situação (notas de empenho, emendas, sanções) e os recortes por
--                órgão e por motivo. Sem CNPJ, sem nome de empresa ou de pessoa: só situação, órgão pagador
--                estadual, pares e valor pago.
--
-- O mesmo pacote (mesmo sha256) não entra duas vezes: o índice único em `sha256_pacote` das execuções concluídas
-- faz a segunda conclusão falhar, e o carregador confere antes de abrir a execução.
--
-- Só `service_role` lê e grava: a página (`/mapa/cadeia-quebrada`, só para quem está logado e aprovado, decisão do
-- titular de 29/10/2026) lê pelo servidor com a chave de serviço, como as outras. RLS ligada, sem política.
--
-- Só acréscimo; idempotente. Sem pré-requisito além do esquema `public`.
-- =============================================================================

create table if not exists public.cq_execucao (
  id               bigint generated always as identity primary key,
  iniciada_em      timestamptz not null default now(),
  concluida_em     timestamptz,
  status           text not null check (status in ('gravando', 'concluida', 'erro')),
  -- O `dado_ate` do manifesto (o dia do retrato da DOE-PB).
  dado_ate         timestamptz,
  referencia       date,
  arquivos         jsonb not null default '{}'::jsonb,
  -- As contagens do manifesto, conferidas pelo carregador contra os agregados.
  contagens        jsonb not null default '{}'::jsonb,
  erro             text,
  versao_pacote    text,
  sha256_pacote    text check (sha256_pacote ~ '^[0-9a-f]{64}$'),
  gerado_em        timestamptz,
  regra_versao     text,
  regra_fecha      text,
  limiar_precisao  text,
  precisao         jsonb not null default '{}'::jsonb,
  insumos          jsonb not null default '{}'::jsonb,
  -- regra_alcance.json inteiro (13 regras com base legal), para a página mostrar a regra da própria geração.
  regra_alcance    jsonb not null default '{}'::jsonb,
  -- As coberturas e o aviso de cada bloco (órgãos, período, credor, ligação, fornecedores consultados).
  cobertura        jsonb not null default '{}'::jsonb
);
create index if not exists cq_execucao_concluida_idx on public.cq_execucao (concluida_em desc) where status = 'concluida';
create unique index if not exists cq_execucao_pacote_idx on public.cq_execucao (sha256_pacote) where status = 'concluida';

create table if not exists public.cq_resultado (
  execucao_id      bigint not null references public.cq_execucao (id) on delete cascade,
  -- notas: situações das notas de empenho; notas_orgao: as mesmas por órgão pagador; emendas: situações das emendas
  -- estaduais; emendas_sem_cnpj: pago sem CNPJ de credor, por órgão; sancoes_classe e sancoes_motivo: os cruzamentos
  -- com o CEIS/CNEP pela regra de alcance.
  conjunto         text not null check (conjunto in ('notas', 'notas_orgao', 'emendas', 'emendas_sem_cnpj', 'sancoes_classe', 'sancoes_motivo')),
  ordem            integer not null,
  orgao            text,
  situacao         text,
  -- "alta", "a conferir" ou nulo, como o pacote diz.
  confianca        text,
  -- Só a linha "fecha" soma como cadeia fechada (PUB-05: "nome…(a conferir)" nunca soma).
  soma_como_fecha  boolean not null default false,
  pares            integer,
  pago             numeric,
  primary key (execucao_id, conjunto, ordem)
);

do $$
declare
  t text;
begin
  foreach t in array array['cq_execucao', 'cq_resultado'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.cq_execucao_id_seq from anon, authenticated;
grant usage, select on sequence public.cq_execucao_id_seq to service_role;

create or replace function public.cq_ultima_execucao()
returns setof public.cq_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.cq_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.cq_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.cq_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga as linhas das execuções que não são a última concluída nem `p_manter`. As linhas de `cq_execucao` ficam
-- (o histórico de quais pacotes entraram, com o hash); só os resultados saem. Poucas dezenas de linhas por pacote.
create or replace function public.cq_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.cq_ultima_execucao()), p_manter], null);
  n      integer;
begin
  delete from public.cq_resultado
   where ctid = any (array(select ctid from public.cq_resultado
                            where execucao_id <> all (manter)
                            limit greatest(1, least(coalesce(p_limite, 5000), 20000))));
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.cq_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.cq_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.cq_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.cq_ultima_execucao()                    to service_role;
grant  execute on function public.cq_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.cq_limpar(bigint, integer)               to service_role;

notify pgrst, 'reload schema';
