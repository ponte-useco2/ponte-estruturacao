/**
 * A lista branca do portal público das emendas (17/11/2026), conferida no código-fonte — o módulo de leitura não roda
 * aqui (ele pede o cliente do Supabase e o cache do Next), então o teste LÊ os arquivos:
 *   · `emendas-publico.server.ts` só chama as funções `emd_pub_*` da lista (`FUNCOES_PUBLICAS`), por um único `.rpc`, com
 *     as colunas das listas `COLUNAS_*`, e não lê tabela nenhuma (`.from`);
 *   · as migrações `oport_67` e `oport_68` (a v2 recria `emd_pub_linhas`, `emd_pub_agregado` e `emd_pub_emenda`; vale a
 *     última definição) devolvem, de cada função, EXATAMENTE as colunas da lista (coluna nova no banco quebra o teste
 *     até entrar na lista, com a decisão de que pode sair), nenhuma proibida, e só `service_role` executa;
 *   · as páginas e as rotas de `/emendas` só leem pelo módulo público (nada do `emendas.server.ts` de administrador, nada
 *     de cliente do Supabase, nada de campo proibido).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAMPOS_PROIBIDOS,
  CATALOGO_BRUTO,
  COLUNAS_AGREGADO,
  COLUNAS_AUTOR,
  COLUNAS_CATALOGO,
  COLUNAS_EXECUCAO,
  COLUNAS_FACETA,
  COLUNAS_LINHA,
  COLUNAS_MUNICIPIO,
  COLUNAS_PF,
  COLUNAS_TOTAIS,
  FUNCOES_PUBLICAS,
} from "./emendas-publico.ts";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(aqui, "..", "..", "..");
const servidor = fs.readFileSync(path.join(aqui, "emendas-publico.server.ts"), "utf-8");
const migracao = fs.readFileSync(path.join(web, "supabase", "migrations", "oport_67_emendas_publico.sql"), "utf-8");
const migracaoV2 = fs.readFileSync(path.join(web, "supabase", "migrations", "oport_68_emendas_publico_v2.sql"), "utf-8");

/** O código sem os comentários (o cabeçalho explica o que não se faz, e não pode contar como uso). */
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const codigo = semComentarios(servidor);

test("servidor: um único .rpc, com a função da lista; nenhuma tabela lida direto", () => {
  const rpcs = [...codigo.matchAll(/\.rpc\(([^,)]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(rpcs, ["c.funcao"], "só o `executar` chama o banco");
  assert.match(codigo, /funcao: FuncaoPublica;/, "a chamada só aceita uma função da lista (pelo tipo)");
  assert.ok(!/\.from\(/.test(codigo.replace(/\bArray\.from\(/g, "")), "nenhuma tabela lida direto");
  assert.ok(!/\.schema\(|\.storage\b|\.auth\./.test(codigo), "nada além de RPC");
  const funcoes = [...codigo.matchAll(/funcao: "([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(funcoes.length >= 7);
  for (const f of funcoes) assert.ok((FUNCOES_PUBLICAS as readonly string[]).includes(f), `${f} não está na lista`);
  for (const f of FUNCOES_PUBLICAS) assert.ok(funcoes.includes(f), `${f} da lista não é usada`);
  const literais = [...codigo.matchAll(/"(emd_[a-z_]+)"/g)].map((m) => m[1]);
  for (const f of literais) assert.ok((FUNCOES_PUBLICAS as readonly string[]).includes(f), `${f}: fora da lista`);
});

test("servidor: as colunas pedidas são sempre as das listas COLUNAS_*", () => {
  assert.deepEqual([...codigo.matchAll(/\.select\(([^)]*\))?[^)]*\)/g)].map((m) => m[0]), ['.select(c.colunas.join(","))']);
  const pedidas = [...codigo.matchAll(/colunas: ([A-Z_]+)/g)].map((m) => m[1]);
  assert.ok(pedidas.length >= 6);
  for (const p of pedidas) assert.ok(/^COLUNAS_(LINHA|EXECUCAO|AGREGADO|CATALOGO|PF|AUTOR|MUNICIPIO|COM_TOTAL|FACETA)$/.test(p), p);
  assert.match(codigo, /const COLUNAS_COM_TOTAL = \[\.\.\.COLUNAS_LINHA, \.\.\.COLUNAS_TOTAIS\] as const;/);
  assert.ok(!/from "\.\/emendas\.server"/.test(codigo), "nada do módulo de administrador");
  assert.match(codigo, /linhaSegura/, "as linhas passam pela regra do nome e do CPF também aqui");
});

/** As colunas de saída (`returns table (...)`) de cada função da migração. */
function saidas(sql: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const f of sql.matchAll(/create (?:or replace )?function public\.(emd_pub_[a-z_]+)\(([\s\S]*?)\nreturns ([\s\S]*?)\n(?:language|as)/g)) {
    const nome = f[1];
    const retorno = f[3];
    const tabela = /^table \(([\s\S]*)\)\s*$/.exec(retorno.trim());
    if (!tabela) {
      m.set(nome, []);
      continue;
    }
    const colunas = tabela[1]
      .split("\n")
      .map((l) => l.replace(/--.*$/, "").trim())
      .filter(Boolean)
      .map((l) => l.replace(/,$/, "").split(/\s+/)[0]);
    m.set(nome, colunas);
  }
  return m;
}

test("migração: cada função devolve exatamente as colunas da lista (a oport_68 por cima da oport_67); nenhuma proibida", () => {
  const v2 = saidas(migracaoV2);
  assert.deepEqual([...v2.keys()].sort(), ["emd_pub_agregado", "emd_pub_emenda", "emd_pub_facetas", "emd_pub_linhas"], "a v2 recria três e cria as facetas");
  const s = new Map([...saidas(migracao), ...v2]);
  const esperado: Record<string, readonly string[]> = {
    emd_pub_execucao: COLUNAS_EXECUCAO,
    emd_pub_linhas: [...COLUNAS_LINHA, ...COLUNAS_TOTAIS],
    emd_pub_agregado: COLUNAS_AGREGADO,
    emd_pub_emenda: COLUNAS_CATALOGO,
    emd_pub_pf: COLUNAS_PF,
    emd_pub_autores: COLUNAS_AUTOR,
    emd_pub_municipios: COLUNAS_MUNICIPIO,
    emd_pub_facetas: COLUNAS_FACETA,
  };
  for (const [f, cols] of Object.entries(esperado)) assert.deepEqual(s.get(f), [...cols], f);
  for (const [f, cols] of s) for (const c of cols) assert.ok(!(CAMPOS_PROIBIDOS as readonly string[]).includes(c) && !CATALOGO_BRUTO.test(c), `${f}.${c}`);
  // As peças internas existem e o site não as chama.
  for (const f of ["emd_pub_mascara", "emd_pub_ente_nome", "emd_pub_tipo", "emd_pub_catalogo"]) {
    assert.ok(s.has(f), `${f} falta`);
    assert.ok(!(FUNCOES_PUBLICAS as readonly string[]).includes(f), `${f} é interna`);
  }
  assert.equal(s.size, 12);
});

test("oport_68: numa transação, drop das assinaturas velhas, só service_role executa, e avisa o PostgREST", () => {
  const sql = migracaoV2.replace(/--.*$/gm, "");
  assert.match(sql, /^\s*begin;/m);
  assert.match(sql, /^\s*commit;/m);
  assert.ok(sql.indexOf("commit;") < sql.indexOf("notify pgrst"), "o notify depois do commit");
  assert.ok(!/security definer/i.test(sql));
  for (const f of ["emd_pub_linhas", "emd_pub_agregado", "emd_pub_emenda", "emd_pub_facetas"]) {
    assert.match(sql, new RegExp(`drop function if exists public\\.${f}\\(`), `${f}: drop`);
    assert.match(sql, new RegExp(`revoke execute on function public\\.${f}\\([^)]*\\)\\s+from public, anon, authenticated;`), `${f}: revoke`);
    assert.match(sql, new RegExp(`grant execute on function public\\.${f}\\([^)]*\\)\\s+to service_role;`), `${f}: grant`);
  }
  assert.ok(!/grant execute[^;]*to (anon|authenticated|public)/i.test(sql));
  assert.match(sql, /public\.emd_pub_ente_nome\(c\.ente_nome\)/, "o nome do ente passa pela regra do MEI");
  assert.match(sql, /public\.emd_pub_mascara\(ob\.objeto\)/, "o objeto passa pela máscara");
  assert.match(sql, /c\.coberto_por is null/, "a linha coberta não entra");
  for (const c of ["c.vez", "c.motivo", "c.valido", "c.ano_inferido", "p.pior", "p.itens", "p.saldo", "rp_inscrito"]) assert.ok(!sql.includes(c), c);
});

test("migração: só service_role executa; nada de security definer; o nome do MEI e o CPF passam pelas peças", () => {
  const sql = migracao.replace(/--.*$/gm, "");
  assert.ok(!/security definer/i.test(sql));
  const funcoes = [...sql.matchAll(/create or replace function public\.(emd_pub_[a-z_]+)\(/g)].map((m) => m[1]);
  for (const f of funcoes) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${f}\\([^)]*\\)\\s+from public, anon, authenticated;`), `${f}: revoke`);
    assert.match(sql, new RegExp(`grant execute on function public\\.${f}\\([^)]*\\)\\s+to service_role;`), `${f}: grant`);
  }
  assert.ok(!/grant execute[^;]*to (anon|authenticated|public)/i.test(sql), "nenhum grant a anon, authenticated ou public");
  assert.match(sql, /public\.emd_pub_ente_nome\(c\.ente_nome\), c\.ente_cnpj/, "a saída do nome do ente passa pela regra do MEI");
  assert.match(sql, /public\.emd_pub_mascara\(ob\.objeto\)/, "o objeto passa pela máscara");
  assert.match(sql, /c\.coberto_por is null/, "a linha coberta não entra");
  assert.match(sql, /and p\.uf = 'PB'/, "a pessoa física só da PB");
  assert.match(sql, /case when e\.pb_localidade then e\.empenhado end/, "o catálogo fora da PB sai sem valor");
  for (const c of ["c.vez", "c.motivo", "c.valido", "c.ano_inferido", "p.pior", "p.itens", "p.saldo", "rp_inscrito"]) {
    assert.ok(!sql.includes(c), `${c} aparece no corpo da migração`);
  }
});

test("páginas e rotas de /emendas: só o módulo público; nada de cliente do Supabase, do módulo de administrador ou de campo proibido", () => {
  const raiz = path.join(web, "src", "app", "emendas");
  const arquivos: string[] = [];
  const andar = (d: string) => {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) andar(p);
      else if (/\.tsx?$/.test(n.name)) arquivos.push(p);
    }
  };
  andar(raiz);
  assert.ok(arquivos.length >= 15, `${arquivos.length} arquivos`);
  for (const a of arquivos) {
    const fonte = semComentarios(fs.readFileSync(a, "utf-8"));
    const rel = path.relative(raiz, a);
    for (const m of fonte.matchAll(/from "([^"]+)"/g)) {
      const mod = m[1];
      if (/\.server$/.test(mod)) assert.equal(mod, "@/lib/oportunidades/emendas-publico.server", `${rel}: ${mod}`);
      assert.ok(!/supabase/.test(mod), `${rel}: ${mod}`);
      assert.ok(!/oportunidades\/emendas"$|oportunidades\/emendas\.server/.test(mod), `${rel}: ${mod}`);
    }
    assert.ok(!/\.rpc\(|\.from\(/.test(fonte.replace(/\bArray\.from\(/g, "")), `${rel}: chamada ao banco`);
    for (const c of [".vez", ".motivo", ".valido", "coberto_por", "rp_inscrito"]) assert.ok(!fonte.includes(c), `${rel}: ${c}`);
    assert.ok(!/catalogo_[a-z_]+/.test(fonte), `${rel}: catálogo bruto`);
  }
});
