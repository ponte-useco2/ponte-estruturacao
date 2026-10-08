import test from "node:test";
import assert from "node:assert/strict";
import { MUNICIPIOS_PB, REGIOES_IMEDIATAS_PB, regiaoDoMunicipioPb } from "./municipios-pb.ts";
import { eloInstrumento, eloProposta, lugarDaEntidade, trilha, type Elo } from "./trilha.ts";

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

test("C1c: a região imediata dos 223 — cada município da lista em uma região só, 15 imediatas e 4 intermediárias", () => {
  const codigos = REGIOES_IMEDIATAS_PB.flatMap((r) => r.ibges.split(" "));
  assert.equal(codigos.length, 223);
  assert.equal(new Set(codigos).size, 223, "nenhum código repetido");
  assert.ok(MUNICIPIOS_PB.every(([ibge]) => regiaoDoMunicipioPb(ibge) !== null), "todo município da lista tem região");
  assert.equal(REGIOES_IMEDIATAS_PB.length, 15);
  assert.equal(new Set(REGIOES_IMEDIATAS_PB.map((r) => r.intermediaria)).size, 4);
  assert.deepEqual(regiaoDoMunicipioPb("2510808"), { imediata: "Patos", intermediaria: "Patos" });
  assert.deepEqual(regiaoDoMunicipioPb(" 2504009 "), { imediata: "Campina Grande", intermediaria: "Campina Grande" });
  assert.deepEqual(regiaoDoMunicipioPb("2516201"), { imediata: "Sousa", intermediaria: "Sousa - Cajazeiras" });
  assert.equal(regiaoDoMunicipioPb("3509502"), null, "fora da PB");
  assert.equal(regiaoDoMunicipioPb(null), null);
});

test("C1c: trilha da entidade da PB passa pela região imediata, tirada do IBGE da sede", () => {
  const patos = lugarDaEntidade({ cnpj: "09084815000170", nome: "MUNICIPIO DE PATOS", uf: "PB", cod_ibge: "2510808", municipio: "Patos" });
  const t = trilha(patos);
  assert.deepEqual(rotulos(t), ["Brasil", "Paraíba", "Região imediata de Patos", "Patos", "MUNICIPIO DE PATOS"]);
  assert.deepEqual(links(t), ["/mapa/brasil", "/mapa/uf/pb", "/mapa/uf/pb?aba=municipios#regiao-patos", "/mapa/municipio/2510808", null]);
  // a região de nome composto leva à âncora da UF
  const marcacao = trilha(lugarDaEntidade({ cnpj: "11222333000181", nome: "ASSOCIACAO DE EXEMPLO", uf: "pb", cod_ibge: "2509057", municipio: "Marcação" }));
  assert.equal(marcacao[2].rotulo, "Região imediata de Mamanguape - Rio Tinto");
  assert.equal(marcacao[2].href, "/mapa/uf/pb?aba=municipios#regiao-mamanguape-rio-tinto");
});

test("C1c: entidade sem região — fora da PB, sem UF, sem código ou com código de outra UF, o elo não aparece", () => {
  const sp = trilha(lugarDaEntidade({ cnpj: "51885242000140", nome: "MUNICIPIO DE CAMPINAS", uf: "SP", cod_ibge: "3509502", municipio: "Campinas" }));
  assert.deepEqual(rotulos(sp), ["Brasil", "São Paulo", "Campinas", "MUNICIPIO DE CAMPINAS"]);
  // UF do dado diz PB, mas o código é de outra UF: nada de região inventada
  assert.deepEqual(rotulos(trilha(lugarDaEntidade({ cnpj: "51885242000140", nome: "X", uf: "PB", cod_ibge: "3509502", municipio: "Campinas" }))), ["Brasil", "Paraíba", "Campinas", "X"]);
  // código da PB, mas sem UF no dado: some a UF e, com ela, a região
  assert.deepEqual(rotulos(trilha(lugarDaEntidade({ cnpj: "09084815000170", nome: "MUNICIPIO DE PATOS", uf: null, cod_ibge: "2510808", municipio: "Patos" }))), ["Brasil", "Patos", "MUNICIPIO DE PATOS"]);
  // sem município nem código: só Brasil, UF e a entidade
  assert.deepEqual(rotulos(trilha(lugarDaEntidade({ cnpj: "08885692000104", nome: "CTLC", uf: "PB", cod_ibge: null, municipio: null }))), ["Brasil", "Paraíba", "CTLC"]);
  // só o nome do município, sem código: o elo existe sem link, e sem região
  const semCodigo = trilha(lugarDaEntidade({ cnpj: "08885692000104", nome: "CTLC", uf: "PB", cod_ibge: "", municipio: "Campina Grande" }));
  assert.deepEqual(rotulos(semCodigo), ["Brasil", "Paraíba", "Campina Grande", "CTLC"]);
  assert.equal(semCodigo[2].href, null);
});

test("C1c: o relatório para imprimir volta à aba «Relatório e dados» da entidade", () => {
  const lugar = lugarDaEntidade({ cnpj: "08885692000104", nome: "CENTRO TECNOLOGICO LYNALDO CAVALCANTI", uf: "PB", cod_ibge: "2504009", municipio: "Campina Grande" }, "relatorio");
  const t = trilha(lugar, "Relatório completo");
  assert.deepEqual(rotulos(t), ["Brasil", "Paraíba", "Região imediata de Campina Grande", "Campina Grande", "CENTRO TECNOLOGICO LYNALDO CAVALCANTI", "Relatório completo"]);
  assert.equal(t[4].href, "/mapa/entidade/08885692000104?aba=relatorio");
  assert.equal(t.at(-1)?.href, null);
  // sem aba (a OSC só do cadastro não tem abas), a entidade volta à página dela
  assert.equal(trilha(lugarDaEntidade({ cnpj: "08885692000104", nome: "CTLC", uf: "PB" }), "Relatório completo")[2].href, "/mapa/entidade/08885692000104");
});
