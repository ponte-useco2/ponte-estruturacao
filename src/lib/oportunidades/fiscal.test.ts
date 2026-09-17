import test from "node:test";
import assert from "node:assert/strict";
import {
  contarDecisoes,
  filtrarMunicipios,
  fonteDaEvidencia,
  linhasDaEvidencia,
  mesesDaConferencia,
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

test("evidência do comprometimento com a dívida: valor, origem e percentual", () => {
  const jp = linhasDaEvidencia({
    codigo: "G5",
    evidencia: {
      pct: 5.73, pvls: 29, rcl_ajustada: 4588455772.25,
      servico: { fonte: "sadipem", exercicio: 2026, valor: 262994309.02, pvl: "PVL02.001741/2024-73", data_pvl: "2026-06-16" },
    },
  });
  assert.deepEqual(jp.map((l) => l.valor).slice(0, 4), ["R$ 263,0 mi", "cronograma do PVL PVL02.001741/2024-73 (16/06/2026), previsto para 2026", "R$ 4,6 bi", "5,73%"]);
  const st = linhasDaEvidencia({ codigo: "G5", evidencia: { servico: { fonte: "siconfi", exercicio: 2025, valor: 261455.93 } } });
  assert.equal(st[1].valor, "empenhado em juros e amortização em 2025 (RREO), repetido");
  assert.equal(linhasDaEvidencia({ codigo: "G5", evidencia: { servico: null } })[1].valor, "—");
});

test("conferência de pessoal com o TCE-PB (Sapé, 2025): linhas, tabela mês a mês e ordem logo depois do pessoal", () => {
  const meses = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, rgf: 14_000_000, tce: 14_000_000, fora: false }));
  meses[11] = { mes: 12, rgf: 20216030.26, tce: 19346442.22, fora: false };
  const v = {
    codigo: "G2A",
    evidencia: {
      exercicio: 2025, rgf: "RGF 3º quadrimestre de 2025", total_tce: 177256297.79, total_rgf: 178340133.26, pct: -0.61,
      diferenca: -1083835.47, maior_mes: { mes: 12, diferenca: -869588.04 }, ausentes: [], meses,
      excluidos: { legislativo: 5897711.76, consorcio: 0 },
      tce: { arquivo: { modificado: "2026-02-06T03:14:32.507000+00:00" } },
    },
  };
  const valores = Object.fromEntries(linhasDaEvidencia(v).map((l) => [l.rotulo, l.valor]));
  assert.equal(valores["Diferença"], "-0,61% · R$ -1,1 mi");
  assert.equal(valores["Maior diferença"], "dezembro · R$ -870 mil");
  assert.equal(valores["Meses fora da conta"], "nenhum");
  assert.equal(valores["Fora do Executivo no TCE-PB"], "Câmara R$ 5,9 mi · consórcio R$ 0");
  assert.equal(valores["Arquivo do TCE-PB"], "gerado em 06/02/2026");
  const tabela = mesesDaConferencia(v);
  assert.equal(tabela.length, 12);
  assert.deepEqual(tabela[11], { mes: "dezembro", rgf: "R$ 20,2 mi", tce: "R$ 19,3 mi", diferenca: "R$ -870 mil", fora: false });
  assert.deepEqual(mesesDaConferencia({ codigo: "G2", evidencia: { meses } }), []);
  assert.deepEqual(ordenarVerificacoes([{ codigo: "G11" }, { codigo: "G2A" }, { codigo: "G2" }]).map((x) => x.codigo), ["G2", "G2A", "G11"]);
  const semCalculo = Object.fromEntries(linhasDaEvidencia({ codigo: "G2A", evidencia: { exercicio: 2025 } }).map((l) => [l.rotulo, l.valor]));
  assert.equal(semCalculo["Diferença"], "—");
  assert.equal(semCalculo["Arquivo do TCE-PB"], "—");
});

test("fonte da evidência só quando existe", () => {
  assert.equal(fonteDaEvidencia({ evidencia: {} }), null);
  assert.equal(fonteDaEvidencia({ evidencia: { fonte: {} } }), null);
  assert.equal(fonteDaEvidencia({ evidencia: { fonte: { sistema: "SIOPS" } } })?.sistema, "SIOPS");
});
