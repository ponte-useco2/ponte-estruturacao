import test from "node:test";
import assert from "node:assert/strict";
import { eloInstrumento, eloProposta, trilha, type Elo } from "./trilha.ts";

const rotulos = (elos: Elo[]) => elos.map((e) => e.rotulo);
const links = (elos: Elo[]) => elos.map((e) => e.href);

test("B11: Brasil e UF — o último elo é a página aberta, sem link", () => {
  assert.deepEqual(trilha({}), [{ rotulo: "Brasil", href: null }]);
  const uf = trilha({ uf: "pb" });
  assert.deepEqual(rotulos(uf), ["Brasil", "Paraíba"]);
  assert.deepEqual(links(uf), ["/mapa/brasil", null]);
});

test("B11: município da PB com a região imediata, que leva à lista da UF na região dele", () => {
  const t = trilha({ uf: "PB", regiaoImediata: "Sousa - Cajazeiras", municipio: { ibge: "2516201", nome: "Sousa" } });
  assert.deepEqual(rotulos(t), ["Brasil", "Paraíba", "Região imediata de Sousa - Cajazeiras", "Sousa"]);
  assert.deepEqual(links(t), ["/mapa/brasil", "/mapa/uf/pb", "/mapa/uf/pb?aba=municipios#regiao-sousa-cajazeiras", null]);
});

test("B11: nunca se inventa elo — sem região, sem UF válida ou sem município, o elo não aparece", () => {
  assert.deepEqual(rotulos(trilha({ uf: "PB", regiaoImediata: "  ", municipio: { ibge: "2516201", nome: "Sousa" } })), ["Brasil", "Paraíba", "Sousa"]);
  // UF fora das 27: some a UF e, com ela, a região
  assert.deepEqual(rotulos(trilha({ uf: "XX", regiaoImediata: "Patos", municipio: { ibge: "2510808", nome: "Patos" } })), ["Brasil", "Patos"]);
  assert.deepEqual(rotulos(trilha({ uf: null, municipio: null, entidade: { cnpj: "09084815000170", nome: "MUNICIPIO DE PATOS" } })), ["Brasil", "MUNICIPIO DE PATOS"]);
  // só o nome, sem código: o elo existe, mas sem link
  const semIbge = trilha({ uf: "PB", municipio: { nome: "Patos" } }, "Organizações");
  assert.deepEqual(links(semIbge), ["/mapa/brasil", "/mapa/uf/pb", null, null]);
  // só o código: o nome vira "IBGE …"
  assert.deepEqual(rotulos(trilha({ uf: "PB", municipio: { ibge: "2510808" } })), ["Brasil", "Paraíba", "IBGE 2510808"]);
});

test("B11: entidade — município na PB leva à página dele; fora da PB, aos investimentos", () => {
  const pb = trilha({ uf: "PB", municipio: { ibge: "2510808", nome: "Patos" }, entidade: { cnpj: "09084815000170", nome: "MUNICIPIO DE PATOS" } });
  assert.deepEqual(rotulos(pb), ["Brasil", "Paraíba", "Patos", "MUNICIPIO DE PATOS"]);
  assert.deepEqual(links(pb), ["/mapa/brasil", "/mapa/uf/pb", "/mapa/municipio/2510808", null]);
  const sp = trilha({ uf: "SP", municipio: { ibge: "3509502", nome: "Campinas" }, entidade: { cnpj: "51885242000140", nome: "MUNICIPIO DE CAMPINAS" } });
  assert.deepEqual(links(sp), ["/mapa/brasil", "/mapa/uf/sp", "/mapa/municipio/3509502/investimentos", null]);
  // sem nome, o CNPJ legível
  assert.deepEqual(rotulos(trilha({ entidade: { cnpj: "09084815000170" } })), ["Brasil", "CNPJ 09.084.815/0001-70"]);
});

test("B11: subpágina do município volta à aba de onde se abre", () => {
  const osc = trilha({ uf: "PB", municipio: { ibge: "2510808", nome: "Patos", aba: "dinheiro" } }, "Organizações da sociedade civil");
  assert.deepEqual(rotulos(osc), ["Brasil", "Paraíba", "Patos", "Organizações da sociedade civil"]);
  assert.deepEqual(links(osc), ["/mapa/brasil", "/mapa/uf/pb", "/mapa/municipio/2510808?aba=dinheiro", null]);
  const rel = trilha({ uf: "PB", municipio: { ibge: "2510808", nome: "Patos", aba: "relatorio" } }, "Relatório completo");
  assert.equal(rel[2].href, "/mapa/municipio/2510808?aba=relatorio");
});

test("B11: convênio, proposta e laudo descem até o instrumento", () => {
  const lugar = { uf: "PB", municipio: { ibge: "2510808", nome: "PATOS" }, entidade: { cnpj: "09084815000170", nome: "MUNICIPIO DE PATOS" } };
  const conv = trilha(lugar, eloInstrumento("942082", "CONTRATO DE REPASSE"));
  assert.deepEqual(rotulos(conv), ["Brasil", "Paraíba", "PATOS", "MUNICIPIO DE PATOS", "Contrato de repasse nº 942082"]);
  assert.equal(conv.at(-1)?.href, null, "o convênio aberto não leva a ele mesmo");
  const laudo = trilha(lugar, eloInstrumento("942082", null), "Laudo");
  assert.deepEqual(laudo.slice(-2), [{ rotulo: "Convênio nº 942082", href: "/mapa/instrumento/942082" }, { rotulo: "Laudo", href: null }]);
  const proposta = trilha(lugar, eloProposta("1234567", "12345/2025"));
  assert.deepEqual(proposta.at(-1), { rotulo: "Proposta nº 12345/2025", href: null });
  assert.equal(eloProposta("1234567", null).rotulo, "Proposta nº 1234567");
  // elos vazios no fim não contam
  assert.deepEqual(rotulos(trilha({ uf: "PB" }, null, false, undefined)), ["Brasil", "Paraíba"]);
});
