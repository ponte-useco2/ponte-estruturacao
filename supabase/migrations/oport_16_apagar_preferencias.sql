-- =============================================================================
-- oport_16 — Quem foi bloqueado consegue, de fato, apagar a própria preferência
--
-- A oport_4 deixou a política de DELETE de `oport_preferencia` sem exigir
-- aprovação, "para quem foi bloqueado depois de escolher ainda poder retirar a
-- escolha". Não funcionava. DELETE com filtro também passa pela política de
-- SELECT, e essa exige aprovação. Para o bloqueado, `limparPreferencias()` apagava
-- 0 linhas, não dava erro, e a tela dizia "Preferências apagadas.". Só um DELETE
-- sem filtro nenhum alcançava a linha, e o site não manda esse. Conferido em
-- Postgres descartável em 15/09/2026, com a oport_1…oport_4 aplicadas.
--
-- A correção: uma função SECURITY DEFINER que apaga a linha de `auth.uid()` e
-- devolve quantas saíram. Não recebe parâmetro, então ninguém apaga a escolha de
-- outra pessoa. Revogar consentimento continua sem depender de aprovação.
--
-- Por que não uma política de SELECT sem aprovação: o bloqueado passaria a ler as
-- próprias escolhas pela API. O dado é dele e a exposição é pequena, mas isso
-- abriria a única exceção à regra das tabelas oport_* (quem não está aprovado não
-- lê nada), só para servir a um DELETE.
--
-- A política de DELETE passa a exigir aprovação, como a de `oport_favorito`
-- (oport_15). A porta do bloqueado passa a ser a função, e a política deixa de
-- prometer o que não entrega. Para o aprovado nada muda.
--
-- Idempotente. Pré-requisitos: oport_3 (oport_aprovado) e oport_4 (oport_preferencia).
-- Grants explícitos: desde a seguranca_1, função nova não nasce executável.
-- =============================================================================

create or replace function public.oport_apagar_minhas_preferencias()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := (select auth.uid());
  n     integer;
begin
  if v_uid is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;

  delete from public.oport_preferencia where user_id = v_uid;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.oport_apagar_minhas_preferencias() from public, anon;
grant execute on function public.oport_apagar_minhas_preferencias() to authenticated;

drop policy if exists "preferencia: apaga a propria" on public.oport_preferencia;
create policy "preferencia: apaga a propria" on public.oport_preferencia
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.oport_aprovado()));
