-- Registro de acessos à página restrita /estudo-camaras-tpf.html
-- Projeto: vxvymlwxnejtlqbijatk (ponte-useco2)
-- Executar no SQL Editor do painel Supabase (ou via CLI).
--
-- Segurança: RLS ativo. Usuários autenticados podem APENAS inserir o próprio
-- registro (user_id = auth.uid()). Ninguém lê/edita/apaga pela API pública —
-- a leitura é feita só pelo painel (service_role).

create table if not exists public.estudo_tpf_acessos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  email text not null,
  provedor text,
  evento text not null default 'unlock',
  pagina text not null default 'estudo-camaras-tpf',
  user_agent text,
  criado_em timestamptz not null default now()
);

alter table public.estudo_tpf_acessos enable row level security;

drop policy if exists "authenticated_insert_own" on public.estudo_tpf_acessos;
create policy "authenticated_insert_own"
  on public.estudo_tpf_acessos
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- (sem policies de select/update/delete: acesso de leitura apenas via painel)

comment on table public.estudo_tpf_acessos is
  'Log de quem desbloqueou a página Estudo Câmaras × TPF (parceria Ponte × MS&LG).';
