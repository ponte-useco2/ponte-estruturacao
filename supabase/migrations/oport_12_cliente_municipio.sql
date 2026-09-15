-- =============================================================================
-- oport_12 — Vínculo confirmado entre organização e município
--
-- A ficha do município (painel de execução) mostra o que trava na prefeitura. O
-- cliente pode ver a ficha do PRÓPRIO município — e "próprio" precisa de alguém que
-- confira: o cadastro de organização é autodeclarado, e qualquer pessoa aprovada pode
-- dizer que é a prefeitura de João Pessoa.
--
-- Por que tabela à parte, e não colunas em `oport_organizacao`: dono e editor podem
-- dar UPDATE na própria organização pela sessão (oport_6). Uma coluna
-- `municipio_confirmado_em` ali seria autoconfirmável. Aqui só a chave de serviço
-- escreve, e o administrador confirma pela tela de acessos.
--
-- A confirmação guarda o IBGE confirmado. Ela só vale enquanto a organização continuar
-- do tipo município e com esse mesmo IBGE — trocar o município no cadastro desfaz o
-- vínculo sem precisar de gatilho, porque a leitura compara os dois.
--
-- Apagar a organização (inclusive pelo `oport_esquecer`) apaga o vínculo em cascata.
-- Grants explícitos (seguranca_1). Idempotente.
-- =============================================================================

create table if not exists public.oport_vinculo_municipio (
  organizacao_id uuid primary key references public.oport_organizacao (id) on delete cascade,
  municipio_ibge text not null check (municipio_ibge ~ '^[0-9]{7}$'),
  confirmado_em  timestamptz not null default now(),
  -- E-mail do administrador, como `oport_acesso.decidido_por`.
  confirmado_por text not null check (length(btrim(confirmado_por)) > 3)
);

alter table public.oport_vinculo_municipio enable row level security;
revoke all on table public.oport_vinculo_municipio from anon, authenticated;
grant all on table public.oport_vinculo_municipio to service_role;
