\set ON_ERROR_STOP on
\pset format aligned

\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set C '33333333-3333-3333-3333-333333333333'

insert into auth.users (id) values (:'A'), (:'B'), (:'C') on conflict do nothing;

insert into public.oport_acesso (id, email, status) values
  (:'A', 'aprovado-a@exemplo', 'aprovado'),
  (:'B', 'aprovado-b@exemplo', 'aprovado'),
  (:'C', 'pendente-c@exemplo', 'pendente')
on conflict (id) do update set status = excluded.status, email = excluded.email;

-- =============================================================================
-- 1. Criação: entidade e vínculo na mesma transação, quem cria vira dono.
-- =============================================================================
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

  select public.oport_criar_organizacao('Prefeitura de Exemplo', 'municipio', 'pb', '2507507', '12.345.678/0001-90') as org_a \gset

  select public.t_ok(
    (select count(*) = 1 from public.oport_organizacao where id = :'org_a'),
    'criou a organizacao');

  select public.t_ok(
    (select papel = 'dono' from public.oport_membro where organizacao_id = :'org_a' and user_id = :'A'),
    'quem criou virou dono');

  -- Normalizações feitas pela função, não confiadas à tela.
  select public.t_ok(
    (select uf = 'PB' and municipio_ibge = '2507507' and cnpj = '12345678000190'
     from public.oport_organizacao where id = :'org_a'),
    'normalizou UF para maiuscula e CNPJ para so digitos');
commit;

-- =============================================================================
-- 2. A função recusa quem não está aprovado, e quem não tem sessão.
-- =============================================================================
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
  do $$
  begin
    begin
      perform public.oport_criar_organizacao('OSC do Pendente', 'osc');
      raise exception 'FALHOU: pendente conseguiu criar organizacao';
    exception when insufficient_privilege then raise notice 'ok: pendente recusado';
    end;
  end $$;
commit;

begin;
  set local role anon;
  do $$
  begin
    begin
      perform public.oport_criar_organizacao('Sem Sessao', 'empresa');
      raise exception 'FALHOU: anon conseguiu criar organizacao';
    exception when insufficient_privilege then raise notice 'ok: anon recusado';
    end;
  end $$;
commit;

-- =============================================================================
-- 3. Isolamento: B cria a dele e não enxerga a de A.
-- =============================================================================
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

  select public.oport_criar_organizacao('Instituto Exemplo', 'osc', 'PB') as org_b \gset

  select public.t_ok(
    (select count(*) = 1 from public.oport_organizacao),
    'B enxerga UMA organizacao: a dele');

  select public.t_ok(
    (select count(*) = 0 from public.oport_organizacao where nome = 'Prefeitura de Exemplo'),
    'B NAO enxerga a organizacao de A');

  select public.t_ok(
    (select count(*) = 1 from public.oport_membro),
    'B enxerga UM vinculo: o dele');
commit;

-- =============================================================================
-- 4. Papel: dono edita; leitor não.
-- =============================================================================
insert into public.oport_membro (organizacao_id, user_id, papel)
values (:'org_a', :'B', 'leitor') on conflict do nothing;

begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

  select public.t_ok(
    (select count(*) = 2 from public.oport_organizacao),
    'como leitor de A, B passa a enxergar as duas');

  update public.oport_organizacao set nome = 'Renomeada pelo leitor' where id = :'org_a';
  select public.t_ok(
    (select nome = 'Prefeitura de Exemplo' from public.oport_organizacao where id = :'org_a'),
    'leitor NAO renomeia: o update nao alcanca a linha');
commit;

begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
  update public.oport_organizacao set nome = 'Prefeitura Renomeada' where id = :'org_a';
  select public.t_ok(
    (select nome = 'Prefeitura Renomeada' from public.oport_organizacao where id = :'org_a'),
    'dono renomeia');
commit;

-- =============================================================================
-- 5. Ninguém escreve vínculo pela sessão: entrar em organização é convite,
--    e convite ainda não existe.
-- =============================================================================
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
  do $$
  begin
    begin
      insert into public.oport_membro (organizacao_id, user_id, papel)
      select id, '22222222-2222-2222-2222-222222222222', 'dono' from public.oport_organizacao limit 1;
      raise exception 'FALHOU: usuario se promoveu a dono';
    exception when insufficient_privilege then raise notice 'ok: sessao nao escreve vinculo';
    end;
  end $$;
commit;

-- =============================================================================
-- 6. Superfície de permissão.
-- =============================================================================
select 'anon em oport_organizacao' as checagem,
       coalesce(nullif(concat_ws(',',
         case when has_table_privilege('anon', 'public.oport_organizacao', 'SELECT') then 'select' end,
         case when has_table_privilege('anon', 'public.oport_organizacao', 'INSERT') then 'insert' end,
         case when has_table_privilege('anon', 'public.oport_organizacao', 'UPDATE') then 'update' end,
         case when has_table_privilege('anon', 'public.oport_organizacao', 'DELETE') then 'delete' end), ''), 'nada') as valor
union all
select 'anon em oport_membro',
       coalesce(nullif(concat_ws(',',
         case when has_table_privilege('anon', 'public.oport_membro', 'SELECT') then 'select' end,
         case when has_table_privilege('anon', 'public.oport_membro', 'INSERT') then 'insert' end), ''), 'nada')
union all
select 'authenticated em oport_organizacao',
       coalesce(nullif(concat_ws(',',
         case when has_table_privilege('authenticated', 'public.oport_organizacao', 'SELECT') then 'select' end,
         case when has_table_privilege('authenticated', 'public.oport_organizacao', 'INSERT') then 'insert' end,
         case when has_table_privilege('authenticated', 'public.oport_organizacao', 'UPDATE') then 'update' end,
         case when has_table_privilege('authenticated', 'public.oport_organizacao', 'DELETE') then 'delete' end), ''), 'nada')
union all
select 'authenticated em oport_membro',
       coalesce(nullif(concat_ws(',',
         case when has_table_privilege('authenticated', 'public.oport_membro', 'SELECT') then 'select' end,
         case when has_table_privilege('authenticated', 'public.oport_membro', 'INSERT') then 'insert' end,
         case when has_table_privilege('authenticated', 'public.oport_membro', 'DELETE') then 'delete' end), ''), 'nada');

select 'executa oport_criar_organizacao' as checagem, r.papel,
       has_function_privilege(r.papel, 'public.oport_criar_organizacao(text,text,text,text,text)', 'EXECUTE')::text as valor
from (values ('anon'), ('authenticated'), ('service_role')) as r(papel);

select 'executa oport_organizacoes_do_usuario' as checagem, r.papel,
       has_function_privilege(r.papel, 'public.oport_organizacoes_do_usuario()', 'EXECUTE')::text as valor
from (values ('anon'), ('authenticated'), ('service_role')) as r(papel);

-- =============================================================================
-- 7. Restrições de domínio.
-- =============================================================================
do $$
begin
  begin
    insert into public.oport_organizacao (nome, tipo) values ('Tipo Invalido', 'prefeitura');
    raise exception 'FALHOU: aceitou tipo fora dos 12';
  exception when check_violation then raise notice 'ok: tipo fora dos 12 recusado';
  end;
  begin
    insert into public.oport_organizacao (nome, tipo, uf) values ('UF Invalida', 'osc', 'Paraiba');
    raise exception 'FALHOU: aceitou UF invalida';
  exception when check_violation then raise notice 'ok: UF invalida recusada';
  end;
  begin
    insert into public.oport_organizacao (nome, tipo, cnpj) values ('CNPJ com mascara', 'empresa', '12.345.678/0001-90');
    raise exception 'FALHOU: aceitou CNPJ com mascara';
  exception when check_violation then raise notice 'ok: CNPJ so com digitos';
  end;
  begin
    insert into public.oport_organizacao (nome, tipo) values (' A ', 'osc');
    raise exception 'FALHOU: aceitou nome de 1 caractere';
  exception when check_violation then raise notice 'ok: nome curto demais recusado';
  end;
end $$;

-- Os doze tipos do radar são aceitos, um a um.
do $$
declare t text;
begin
  foreach t in array array['empresa','startup','osc','ict','universidade','municipio','estado',
                           'consorcio_publico','cooperativa','pesquisador','pessoa_fisica','outros'] loop
    insert into public.oport_organizacao (nome, tipo) values ('Teste ' || t, t);
  end loop;
  perform public.t_ok(
    (select count(*) = 12 from public.oport_organizacao where nome like 'Teste %'),
    'os 12 tipos de ORGANIZATION_TYPES sao aceitos');
  delete from public.oport_organizacao where nome like 'Teste %';
end $$;

-- =============================================================================
-- 8. Esquecimento: apaga vínculo, apaga órfã, PRESERVA a que tem colega.
-- =============================================================================
select public.t_ok((select count(*) = 2 from public.oport_organizacao), 'duas organizacoes antes do esquecimento');

select public.oport_esquecer('aprovado-a@exemplo');

select public.t_ok(
  (select count(*) = 0 from public.oport_membro where user_id = :'A'),
  'esquecer apagou o vinculo de A');

select public.t_ok(
  (select count(*) = 1 from public.oport_organizacao where id = :'org_a'),
  'a organizacao de A SOBREVIVEU: B ainda pertence a ela');

select public.oport_esquecer('aprovado-b@exemplo');

select public.t_ok(
  (select count(*) = 0 from public.oport_organizacao),
  'sem nenhum membro, as organizacoes orfas foram apagadas');

select '--- checagens da oport_6 concluidas ---' as fim;
