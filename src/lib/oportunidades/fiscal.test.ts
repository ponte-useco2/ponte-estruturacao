import test from "node:test";
import assert from "node:assert/strict";
import {
  contarDecisoes,
  filtrarMunicipios,
  fonteDaEvidencia,
  linhasDaEvidencia,
  ordenarVerificacoes,
  parametrosFiscal,
  pct,
  urlFiscal,
  type ConclusaoFiscal,
  type MunicipioFiscal,
} from "./fiscal.ts";

const conclusao = (decisao: "A" | "B" | "C", estado: ConclusaoFiscal["estado"]): ConclusaoFiscal => ({
  decisao, nome: decisao, estado, bloqueantes: [], alertas: [], sem_dado: [], documentais: [], versao: "v",
});

const municipio = (ibge: string, nome: string, a: ConclusaoFiscal["estado"], b: ConclusaoFiscal["estado"]): MunicipioFiscal => ({
  ibge, nome, populacao: 1, tce: "001", estados: {}, indicadores: {},
  conclusoes: [conclusao("A", a), conclusao("B", b), conclusao("C", "nao_verificavel")],
});

const MS = [
  municipio("2513802", "Santa Teresinha", "nao_atendido", "nao_atendido"),
  municipio("2500106", "Água Branca", "atendido", "desatualizado"),
  municipio("2507507", "João Pessoa", "atendido", "atencao"),
];

test("parâmetros: só decisão e estado conhecidos; estado sem decisão não entra na URL", () => {
  assert.deepEqual(parametrosFiscal({ q: "agua", decisao: "B", estado: "atencao" }), { q: "agua", decisao: "B", estado: "atencao" });
  assert.deepEqual(parametrosFiscal({ decisao: "Z", estado: "verde" }), { q: "", decisao: null, estado: null });
  assert.equal(urlFiscal({ q: "", decisao: null, estado: "atencao" }), "/mapa/fiscal");
  assert.equal(urlFiscal({ q: "joão", decisao: "C", estado: "nao_verificavel" }), "/mapa/fiscal?q=jo%C3%A3o&decisao=C&estado=nao_verificavel");
});

test("filtro: nome sem acento, IBGE pelo começo e ordem alfabética", () => {
  assert.deepEqual(filtrarMunicipios(MS, { q: "agua", decisao: null, estado: null }).map((m) => m.nome), ["Água Branca"]);
  assert.deepEqual(filtrarMunicipios(MS, { q: "25075", decisao: null, estado: null }).map((m) => m.nome), ["João Pessoa"]);
  assert.deepEqual(filtrarMunicipios(MS, { q: "", decisao: null, estado: null }).map((m) => m.nome), ["Água Branca", "João Pessoa", "Santa Teresinha"]);
});

test("filtro por decisão: desatualizado e atenção são o mesmo grupo (com alertas)", () => {
  const comAlertas = filtrarMunicipios(MS, { q: "", decisao: "B", estado: "atencao" }).map((m) => m.nome);
  assert.deepEqual(comAlertas, ["Água Branca", "João Pessoa"]);
  assert.deepEqual(filtrarMunicipios(MS, { q: "", decisao: "A", estado: "nao_atendido" }).map((m) => m.nome), ["Santa Teresinha"]);
});

test("contagem por decisão agrupa os alertas", () => {
  const c = contarDecisoes(MS);
  assert.deepEqual(c.A, { nao_atendido: 1, atendido: 2 });
  assert.deepEqual(c.B, { nao_atendido: 1, atencao: 2 });
  assert.deepEqual(c.C, { nao_verificavel: 3 });
});

test("ordem de leitura das verificações e desconhecidas no fim", () => {
  const ordem = ordenarVerificacoes([{ codigo: "G10" }, { codigo: "G2" }, { codigo: "GX" }, { codigo: "G1" }, { codigo: "G7" }]);
  assert.deepEqual(ordem.map((v) => v.codigo), ["G1", "G7", "G2", "G10", "GX"]);
});

test("evidência de pessoal (Santa Teresinha, 16/09/2026) em linhas", () => {
  const linhas = linhasDaEvidencia({
    codigo: "G2",
    evidencia: {
      referencia: "RGF 1º quadrimestre de 2026", dtp: 17452222.7, rcl_ajustada: 33467757.49, dtp_pct: 52.15,
      limite_alerta_pct: 48.6, limite_prudencial_pct: 51.3, limite_maximo_pct: 54, calculo: "52,15% = …",
    },
  });
  assert.deepEqual(linhas.map((l) => l.valor).slice(0, 5), ["RGF 1º quadrimestre de 2026", "R$ 17,5 mi", "R$ 33,5 mi", "52,15%", "48,60% · 51,30% · 54,00%"]);
});

test("evidência do CAUC e das entregas, e o que falta vira travessão", () => {
  const cauc = linhasDaEvidencia({ codigo: "G7", evidencia: { data_pesquisa: "2026-09-15", pendencias: [{ item: "1.1", nome: "Tributos" }] } });
  assert.deepEqual(cauc, [{ rotulo: "Posição do CAUC", valor: "15/09/2026" }, { rotulo: "Pendências", valor: "1.1 Tributos" }]);
  const g1 = linhasDaEvidencia({ codigo: "G1", evidencia: { faltas: [{ entregavel: "Balanço anual (DCA)", exercicio: 2025, prazo: "2026-04-30" }], retificadas: [1, 2] } });
  assert.equal(g1[0].valor, "Balanço anual (DCA)/2025 (prazo 30/04/2026)");
  assert.equal(g1[1].valor, "2");
  assert.equal(linhasDaEvidencia({ codigo: "G11", evidencia: {} })[1].valor, "—");
  assert.deepEqual(linhasDaEvidencia({ codigo: "G8", evidencia: {} }), []);
  assert.equal(pct(null), "—");
});

test("fonte da evidência só quando existe", () => {
  assert.equal(fonteDaEvidencia({ evidencia: {} }), null);
  assert.equal(fonteDaEvidencia({ evidencia: { fonte: {} } }), null);
  assert.equal(fonteDaEvidencia({ evidencia: { fonte: { sistema: "SIOPS" } } })?.sistema, "SIOPS");
});
