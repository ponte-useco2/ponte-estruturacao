/** As listas da busca como tabelas com filtro no banco (onda 15, fase 3, F3.5b, 28/10/2026). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CAMPOS_ORGANIZACAO,
  COLUNAS_ORGANIZACOES,
  RESULTADOS_NAVEGAVEIS,
  SITUACOES_CONVENIO,
  TABELA_BUSCA_CONVENIOS,
  TABELA_BUSCA_PROPOSTAS,
  colunasDasPropostas,
  colunasDosConvenios,
  estadoDaBusca,
  parametrosDaTabela,
  tetoDePaginas,
  urlComTabela,
} from "./busca-tabelas.ts";
import { LIMITE_POR_PAGINA, PAGINA_MAXIMA } from "./busca.ts";
import { parametrosDaPagina } from "./painel-tabelas.ts";

const MIGRACAO = path.resolve(import.meta.dirname, "..", "..", "..", "supabase", "migrations", "oport_51_painel_busca_v2.sql");

test("convênios: o estado da tabela vira os parâmetros da v2 — palavras sem acento e escapadas, faixas, situações e ordem", () => {
  const e = estadoDaBusca(
    "instrumentos",
    parametrosDaPagina({
      [`t.${TABELA_BUSCA_CONVENIOS}.proponente`]: "Prefeitura  de SÃO",
      [`t.${TABELA_BUSCA_CONVENIOS}.numero`]: "95_6",
      [`t.${TABELA_BUSCA_CONVENIOS}.repasse`]: "1000000..",
      [`t.${TABELA_BUSCA_CONVENIOS}.assinatura`]: "2024-01-01..2024-12-31",
      [`t.${TABELA_BUSCA_CONVENIOS}.situacao`]: ["Em execução", "Inadimplente"],
      [`t.${TABELA_BUSCA_CONVENIOS}.o`]: "repasse.desc",
    }),
  );
  const r = parametrosDaTabela("instrumentos", e);
  assert.deepEqual(r.p_proponente, ["%prefeitura%", "%de%", "%sao%"]);
  assert.deepEqual(r.p_numero, [String.raw`%95\_6%`]);
  assert.deepEqual([r.p_repasse_de, r.p_repasse_ate, r.p_data_de, r.p_data_ate], [1_000_000, null, "2024-01-01", "2024-12-31"]);
  assert.deepEqual(r.p_marcadas, ["Em execução", "Inadimplente"]);
  assert.deepEqual([r.p_ordem, r.p_crescente], ["repasse", false]);
  assert.equal(r.p_objeto, null, "coluna sem filtro vai como null");
});

test("propostas: o desfecho vai pelo código (um rótulo pode valer dois); rótulo que não existe não deixa passar nada", () => {
  const ler = (valores: string[]) =>
    parametrosDaTabela("propostas", estadoDaBusca("propostas", parametrosDaPagina({ [`t.${TABELA_BUSCA_PROPOSTAS}.desfecho`]: valores })));
  assert.deepEqual(ler(["Assinada"]).p_marcados, ["assinada"]);
  assert.deepEqual(ler(["rótulo antigo"]).p_marcados, ["(nenhum)"]);
  const sem = parametrosDaTabela("propostas", estadoDaBusca("propostas", parametrosDaPagina({})));
  assert.equal(sem.p_marcados, null);
  assert.equal(sem.p_ordem, null);
  assert.equal("p_desemb_de" in sem, false, "propostas não têm desembolsado");
});

test("a ordem só vai ao banco pelas colunas que a função conhece; o resto fica com a de sempre", () => {
  const e = estadoDaBusca("instrumentos", parametrosDaPagina({ [`t.${TABELA_BUSCA_CONVENIOS}.o`]: "objeto.asc" }));
  assert.equal(parametrosDaTabela("instrumentos", e).p_ordem, null);
  const sql = fs.readFileSync(MIGRACAO, "utf-8");
  for (const c of colunasDosConvenios(false)) {
    if (c.ordenavel === false || c.id === "objeto") continue;
    assert.ok(sql.includes(`v_ordem = '${c.id}'`), `${c.id}: a função sabe ordenar`);
  }
  for (const c of colunasDasPropostas(false)) {
    if (c.ordenavel === false || c.id === "objeto") continue;
    assert.ok(sql.includes(`v_ordem = '${c.id}'`), `${c.id}: a função sabe ordenar (propostas)`);
  }
});

test("as colunas: a estrela não filtra, não ordena e fica fora do CSV; as situações das opções são as dos grupos", () => {
  const seguir = colunasDosConvenios(true).find((c) => c.id === "seguir");
  assert.deepEqual([seguir?.filtravel, seguir?.ordenavel, seguir?.semCsv], [false, false, true]);
  assert.equal(colunasDosConvenios(false).some((c) => c.id === "seguir"), false);
  assert.ok(SITUACOES_CONVENIO.includes("Em execução") && SITUACOES_CONVENIO.includes("Convênio Anulado"));
  // a coluna "objeto" é oculta e filtra, mas a função não ordena por ela
  assert.equal(colunasDosConvenios(false).find((c) => c.id === "objeto")?.oculta, true);
});

test("o teto de páginas: quem não administra vai até 34 páginas (1.020 resultados); o administrador, até o teto da função", () => {
  assert.equal(tetoDePaginas(LIMITE_POR_PAGINA, false, PAGINA_MAXIMA), Math.ceil(RESULTADOS_NAVEGAVEIS / LIMITE_POR_PAGINA));
  assert.equal(tetoDePaginas(LIMITE_POR_PAGINA, false, PAGINA_MAXIMA), 34);
  assert.equal(tetoDePaginas(LIMITE_POR_PAGINA, true, PAGINA_MAXIMA), PAGINA_MAXIMA);
});

test("a página seguinte leva o filtro e a ordem da tabela", () => {
  const e = estadoDaBusca("instrumentos", parametrosDaPagina({ [`t.${TABELA_BUSCA_CONVENIOS}.proponente`]: "patos", [`t.${TABELA_BUSCA_CONVENIOS}.o`]: "repasse.asc" }));
  const url = new URL(urlComTabela("/mapa/busca?aba=instrumentos&q=agua&pagina=2", "instrumentos", e), "http://x").searchParams;
  assert.deepEqual(
    [url.get("q"), url.get("pagina"), url.get(`t.${TABELA_BUSCA_CONVENIOS}.proponente`), url.get(`t.${TABELA_BUSCA_CONVENIOS}.o`)],
    ["agua", "2", "patos", "repasse.asc"],
  );
});

test("organizações: toda coluna tem campo no cadastro; a área marcada vira `ov`, e a desconhecida não deixa passar nada", () => {
  for (const c of COLUNAS_ORGANIZACOES) assert.ok(CAMPOS_ORGANIZACAO[c.id], `${c.id}: tem campo no banco`);
  const area = CAMPOS_ORGANIZACAO.area.especial!;
  assert.equal(area({ tipo: "categoria", valores: ["Saúde", "Religião"] }), "areas.ov.{religiao,saude}");
  assert.equal(area({ tipo: "categoria", valores: ["outra"] }), "cnpj.is.null");
});

test("oport_51: só a chave de serviço executa as duas funções, e o deslocamento continua no teto de 10 mil", () => {
  const sql = fs.readFileSync(MIGRACAO, "utf-8");
  assert.match(sql, /grant {2}execute on function public\.painel_busca_instrumentos_v2\([^)]*\) to service_role;/);
  assert.match(sql, /grant {2}execute on function public\.painel_busca_propostas_v2\([^)]*\) to service_role;/);
  assert.equal(/to (anon|authenticated)\b/.test(sql), false);
  assert.equal((sql.match(/least\(coalesce\(p_offset, 0\), 10000\)/g) ?? []).length, 2);
});

test("a busca usa as funções v2 com o estado da tabela, e a página aplica o teto pelo administrador", () => {
  const leitura = fs.readFileSync(path.resolve(import.meta.dirname, "busca.server.ts"), "utf-8");
  assert.match(leitura, /rpcDaBusca\(db, ex\.id, "painel_busca_instrumentos_v2", \{ \.\.\.comuns, \.\.\.parametrosDaTabela\("instrumentos", estado\)/);
  assert.match(leitura, /rpcDaBusca\(db, ex\.id, "painel_busca_propostas_v2", \{ \.\.\.comuns, \.\.\.parametrosDaTabela\("propostas", estado\)/);
  const pagina = fs.readFileSync(path.resolve(import.meta.dirname, "..", "..", "app", "mapa", "busca", "page.tsx"), "utf-8");
  assert.match(pagina, /tetoDePaginas\(LIMITE_POR_PAGINA, ehAdministrador\(visitante\.email\), PAGINA_MAXIMA\)/);
  const tela = fs.readFileSync(path.resolve(import.meta.dirname, "..", "..", "app", "mapa", "busca", "BuscaConteudo.tsx"), "utf-8");
  assert.equal((tela.match(/<TabelaFiltravel\b/g) ?? []).length, 3);
  assert.equal(/csvHref/.test(tela), false, "a busca não tem CSV");
});
