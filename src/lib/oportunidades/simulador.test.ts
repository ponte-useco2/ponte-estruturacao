import test from "node:test";
import assert from "node:assert/strict";
import type { ConclusaoFiscal, IndicadoresFiscais } from "./fiscal.ts";
import {
  baseFiscal,
  cronograma,
  diagnosticar,
  existente,
  moeda,
  numeroBr,
  parametrosSimulador,
  simular,
  urlSimulador,
  valorMaximo,
  type Operacao,
} from "./simulador.ts";

const r2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

// Santa Teresinha na execução 3 (17/09/2026): sem PVL recente, serviço estimado pelo RREO de 2025.
const SANTA_TERESINHA: Partial<IndicadoresFiscais> = {
  rgf: "1Q/2026",
  rcl_ajustada: 34009641.8,
  dcl: 7935632.48,
  operacoes_exercicio: 0,
  servico_ano: { fonte: "siconfi", exercicio: 2025, valor: 261455.93 },
  servico_siconfi: { exercicio: 2025, juros: 0, amortizacao: 261455.93, total: 261455.93 },
  caixa: { exercicio: 2025, nao_vinculado_liquido: -2387701.73, nao_vinculado_bruto: -139483, total_liquido: 1538525.2 },
  pvl_referencia: null,
};

const OP: Operacao = { valor: 5_000_000, taxa: 10, prazo: 10, carencia: 2, liberacao: 2, sistema: "sac", inicio: 2027 };

test("número à brasileira, com ponto decimal e com R$", () => {
  assert.equal(numeroBr("1.500.000,00"), 1500000);
  assert.equal(numeroBr("1500000"), 1500000);
  assert.equal(numeroBr("1.500"), 1500);
  assert.equal(numeroBr("R$ 2.000"), 2000);
  assert.equal(numeroBr("8,5"), 8.5);
  assert.equal(numeroBr("8.5"), 8.5);
  assert.equal(numeroBr("-2"), -2);
  assert.equal(numeroBr("dez"), null);
  assert.equal(numeroBr(""), null);
  assert.equal(numeroBr(undefined), null);
});

test("parâmetros: sem valor do projeto não simula; o padrão volta ao formulário", () => {
  const p = parametrosSimulador({}, 2027);
  assert.equal(p.projeto, null);
  assert.equal(p.operacao, null);
  assert.deepEqual(p.erros, []);
  assert.equal(p.bruto.prazo, "20");
  assert.equal(p.bruto.inicio, "2027");
  assert.equal(p.bruto.sistema, "sac");
});

test("parâmetros de um projeto com repasse e crédito", () => {
  const p = parametrosSimulador(
    { total: "6.500.000,00", repasse: "1.000.000", credito: "5000000", taxa: "10", prazo: "10", carencia: "2", liberacao: "2", sistema: "price", inicio: "2027" },
    2027,
  );
  assert.deepEqual(p.erros, []);
  assert.deepEqual(p.projeto, { total: 6500000, repasse: 1000000, credito: 5000000 });
  assert.deepEqual(p.operacao, { ...OP, sistema: "price" });
  assert.equal(p.bruto.total, "6.500.000,00", "devolve o que foi digitado");
});

test("parâmetros inválidos viram erro em português e não simulam", () => {
  const semTaxa = parametrosSimulador({ credito: "1000000" }, 2027);
  assert.equal(semTaxa.operacao, null);
  assert.ok(semTaxa.erros.includes("Taxa de juros: informe um valor."));
  const carencia = parametrosSimulador({ credito: "1000000", taxa: "8", carencia: "1", liberacao: "2" }, 2027);
  assert.ok(carencia.erros.includes("A carência precisa cobrir os anos de liberação."));
  const total = parametrosSimulador({ total: "100", repasse: "80", credito: "50", taxa: "8" }, 2027);
  assert.ok(total.erros.includes("O valor total do projeto é menor que a soma do repasse e do crédito."));
  const letras = parametrosSimulador({ repasse: "um milhão" }, 2027);
  assert.deepEqual(letras.erros, ["Repasse: use só números, como 1.500.000,00."]);
  const prazo = parametrosSimulador({ credito: "10", taxa: "8", prazo: "2,5" }, 2027);
  assert.ok(prazo.erros.includes("Prazo total: um número inteiro de 1 a 40."));
});

test("só repasse: diagnóstico sem operação de crédito", () => {
  const p = parametrosSimulador({ total: "1.200.000", repasse: "1.000.000" }, 2027);
  assert.deepEqual(p.erros, []);
  assert.deepEqual(p.projeto, { total: 1200000, repasse: 1000000, credito: 0 });
  assert.equal(p.operacao, null);
});

test("URL do simulador leva só os campos preenchidos", () => {
  assert.equal(urlSimulador("2513802", { total: "", credito: "5.000.000", sistema: "sac" }), "/mapa/fiscal/2513802/simular?credito=5.000.000&sistema=sac");
  assert.equal(urlSimulador("2513802", {}), "/mapa/fiscal/2513802/simular");
});

test("cronograma SAC: juros na carência sobre a liberação do meio do ano e amortização constante", () => {
  const c = cronograma({ valor: 1000, taxa: 10, prazo: 4, carencia: 2, liberacao: 2, sistema: "sac", inicio: 2027 });
  assert.deepEqual(
    c.map((l) => [l.ano, r2(l.liberacao), r2(l.juros), r2(l.amortizacao), r2(l.servico), r2(l.saldo)]),
    [
      [2027, 500, 25, 0, 25, 500],
      [2028, 500, 75, 0, 75, 1000],
      [2029, 0, 100, 500, 600, 500],
      [2030, 0, 50, 500, 550, 0],
    ],
  );
});

test("cronograma Price: prestação constante depois da carência e saldo zerado no fim", () => {
  const c = cronograma({ valor: 1000, taxa: 10, prazo: 4, carencia: 2, liberacao: 2, sistema: "price", inicio: 2027 });
  assert.deepEqual(c.slice(2).map((l) => [r2(l.juros), r2(l.amortizacao), r2(l.servico)]), [[100, 476.19, 576.19], [52.38, 523.81, 576.19]]);
  assert.equal(c[3].saldo, 0, "zero exato, sem resíduo de arredondamento");
  assert.equal(r2(c.reduce((s, l) => s + l.amortizacao, 0)), 1000);
});

test("cronograma sem juros: só a amortização", () => {
  for (const sistema of ["sac", "price"] as const) {
    const c = cronograma({ valor: 1200, taxa: 0, prazo: 4, carencia: 1, liberacao: 1, sistema, inicio: 2027 });
    assert.deepEqual(c.map((l) => r2(l.servico)), [0, 400, 400, 400], sistema);
  }
});

test("base: exercício do RGF, caixa não vinculado e o existente sem PVL (RREO repetido)", () => {
  const base = baseFiscal(SANTA_TERESINHA, []);
  assert.equal(base.anoBase, 2026);
  assert.deepEqual(base.caixa, { exercicio: 2025, valor: -2387701.73 });
  assert.deepEqual(existente(base, 2026), { servico: 261455.93, liberacoes: 0 });
  assert.deepEqual(existente(base, 2040), { servico: 261455.93, liberacoes: 0 });
});

test("base com PVL (João Pessoa): cronograma do SADIPEM, fora dele zero, e o realizado no exercício do RGF", () => {
  const base = baseFiscal(
    { rgf: "1Q/2026", rcl_ajustada: 4588455772.25, dcl: -422767123.83, operacoes_exercicio: 54383432.17 },
    [
      { ano: 2027, servico_demais: 233376510, servico_pleiteada: 1414620.36, liberacoes: 70213200 },
      { ano: 2026, servico_demais: 262771273.12, servico_pleiteada: 223035.9, liberacoes: 381231592.46 },
    ],
  );
  assert.deepEqual(base.projecao.map((p) => p.ano), [2026, 2027], "ordenado");
  assert.equal(r2(existente(base, 2026).servico), 262994309.02);
  assert.equal(existente(base, 2026).liberacoes, 381231592.46, "o previsto supera o realizado");
  assert.deepEqual(existente(base, 2029), { servico: 0, liberacoes: 0 });
  // Quando o já realizado no exercício passa do previsto no cronograma, vale o realizado.
  const realizado = baseFiscal({ rgf: "2Q/2026", rcl_ajustada: 1000, operacoes_exercicio: 50 }, [{ ano: 2026, servico_demais: 1, servico_pleiteada: 0, liberacoes: 10 }]);
  assert.equal(existente(realizado, 2026).liberacoes, 50);
});

test("simulação de R$ 5 mi em Santa Teresinha: cada limite ano a ano", () => {
  const s = simular(baseFiscal(SANTA_TERESINHA, []), OP, 0);
  assert.equal(s.anos.length, 10);
  const [a2027, a2028] = s.anos;
  assert.equal(r2(a2027.operacoesPct), 7.35);
  assert.equal(r2(a2027.servicoPct), 1.14);
  assert.equal(r2(a2028.dcl), 12935632.48);
  assert.equal(r2(s.anos[9].dcl), 7935632.48, "a amortização devolve a DCL ao ponto de partida");
  const [g4, g5, g6] = s.limites;
  assert.deepEqual([g4.codigo, g4.estado, r2(g4.pct), g4.ano], ["G4", "atendido", 7.35, 2027]);
  assert.deepEqual([g5.codigo, g5.estado, r2(g5.pct), g5.ano], ["G5", "atendido", 3.05, 2029]);
  assert.deepEqual([g6.codigo, g6.estado, r2(g6.pct), g6.ano], ["G6", "atendido", 38.04, 2028]);
  assert.match(g5.frase, /nos 10 anos com pagamento/);
});

test("crescimento da RCL reduz o percentual dos anos seguintes", () => {
  const sem = simular(baseFiscal(SANTA_TERESINHA, []), OP, 0);
  const com = simular(baseFiscal(SANTA_TERESINHA, []), OP, 3);
  assert.equal(r2(com.anos[0].rcl), r2(34009641.8 * 1.03));
  assert.ok((com.limites[1].pct as number) < (sem.limites[1].pct as number));
});

test("11,5% é pela média: dentro na média e acima num ano vira atenção", () => {
  const base = baseFiscal({ rgf: "3Q/2026", rcl_ajustada: 100, dcl: 0 }, [{ ano: 2028, servico_demais: 11, servico_pleiteada: 0, liberacoes: 0 }]);
  const s = simular(base, { valor: 4, taxa: 0, prazo: 3, carencia: 1, liberacao: 1, sistema: "sac", inicio: 2027 }, 0);
  const g5 = s.limites[1];
  assert.deepEqual([g5.estado, r2(g5.pct), g5.ano], ["atencao", 7.5, 2028]);
  assert.match(g5.frase, /mas 2028 chega a 13,00%/);
});

test("valor acima do limite de 16% e o valor máximo que cabe", () => {
  const base = baseFiscal(SANTA_TERESINHA, []);
  const grande = simular(base, { ...OP, valor: 20_000_000 }, 0);
  assert.equal(grande.limites[0].estado, "nao_atendido");
  // O limite que prende é o de 16%: metade do valor por ano ≤ 16% de R$ 34.009.641,80.
  const max = valorMaximo(base, OP, 0);
  assert.equal(max, 10_883_000);
  assert.ok(simular(base, { ...OP, valor: max as number }, 0).limites.every((l) => l.estado !== "nao_atendido"));
  assert.ok(simular(base, { ...OP, valor: (max as number) * 1.01 }, 0).limites.some((l) => l.estado === "nao_atendido"));
});

test("sem RCL ou sem o serviço existente: não verificável e sem valor máximo", () => {
  const semRcl = simular(baseFiscal({ ...SANTA_TERESINHA, rcl_ajustada: null }, []), OP, 0);
  assert.deepEqual(semRcl.limites.map((l) => l.estado), ["nao_verificavel", "nao_verificavel", "nao_verificavel"]);
  const semServico = baseFiscal({ ...SANTA_TERESINHA, servico_siconfi: null }, []);
  const s = simular(semServico, OP, 0);
  assert.deepEqual(s.limites.map((l) => l.estado), ["atendido", "nao_verificavel", "atendido"]);
  assert.equal(s.limites[1].frase, "Sem o serviço da dívida que o município já tem, não há como calcular.");
  assert.equal(valorMaximo(semServico, OP, 0), null);
});

test("limites já estourados sem a operação: valor máximo zero", () => {
  const base = baseFiscal({ ...SANTA_TERESINHA, dcl: 45_000_000 }, []);
  assert.equal(valorMaximo(base, OP, 0), 0);
});

// ------------------------------------------------------------ diagnóstico

const conclusao = (decisao: "A" | "B" | "C", c: Partial<ConclusaoFiscal>): ConclusaoFiscal => ({
  decisao, nome: decisao, estado: "nao_atendido", bloqueantes: [], alertas: [], sem_dado: [], documentais: [], versao: "v", ...c,
});

const CONCLUSOES = [
  conclusao("A", { bloqueantes: ["G7A"] }),
  conclusao("B", { bloqueantes: ["G7"], alertas: ["G2"], documentais: ["G8", "G10"] }),
  conclusao("C", { bloqueantes: ["G7"], alertas: ["G2"], sem_dado: ["G3", "G5"], documentais: ["G8", "G9", "G10"] }),
];

const VERIFICACOES = [
  { codigo: "G7", nome: "CAUC", estado: "nao_atendido" as const, resumo: "O CAUC registra pendência na posição de 17/09/2026: 1.1 (Tributos)." },
  { codigo: "G2", nome: "Pessoal", estado: "atencao" as const, resumo: "52,15% da RCL ajustada no RGF 1º quadrimestre de 2026: acima do prudencial (51,30%)." },
];

test("diagnóstico com repasse, crédito e contrapartida: o caminho mínimo na ordem", () => {
  const base = baseFiscal(SANTA_TERESINHA, []);
  const d = diagnosticar({
    projeto: { total: 6_500_000, repasse: 1_000_000, credito: 5_000_000 },
    conclusoes: CONCLUSOES,
    verificacoes: VERIFICACOES,
    base,
    simulacao: simular(base, OP, 0),
  });
  assert.deepEqual(d.decisoes, ["A", "B", "C"]);
  assert.equal(d.contrapartida, 500_000);
  assert.equal(d.estado, "nao_atendido");
  assert.deepEqual(
    d.providencias.map((p) => `${p.tipo}:${p.codigo ?? "-"}`),
    ["bloqueio:G7", "contrapartida:-", "conferir:G3", "documento:G8", "documento:G9", "documento:G10"],
    "G5 sem dado no retrato sai (a simulação calculou) e o G7A some dentro do G7",
  );
  assert.equal(d.providencias[0].porque, VERIFICACOES[0].resumo);
  assert.match(d.providencias[1].porque, /31\/12\/2025 era negativo \(-R\$ 2\.387\.702\)/);
  assert.deepEqual(d.acompanhar.map((p) => p.codigo), ["G2"]);
});

test("diagnóstico só com repasse: sem a decisão C nem a lei autorizativa", () => {
  const d = diagnosticar({
    projeto: { total: null, repasse: 1_000_000, credito: 0 },
    conclusoes: CONCLUSOES,
    verificacoes: VERIFICACOES,
    base: baseFiscal(SANTA_TERESINHA, []),
    simulacao: null,
  });
  assert.deepEqual(d.decisoes, ["A", "B"]);
  assert.deepEqual(d.providencias.map((p) => p.codigo), ["G7", "G8", "G10"]);
  assert.equal(d.contrapartida, 0);
});

test("diagnóstico de obra só com recurso próprio: vale a decisão A, com o G7A", () => {
  const d = diagnosticar({
    projeto: { total: 500_000, repasse: 0, credito: 0 },
    conclusoes: CONCLUSOES,
    verificacoes: VERIFICACOES,
    base: baseFiscal(SANTA_TERESINHA, []),
    simulacao: null,
  });
  assert.deepEqual(d.decisoes, ["A"]);
  assert.deepEqual(d.providencias.map((p) => `${p.tipo}:${p.codigo ?? "-"}`), ["bloqueio:G7A", "contrapartida:-"]);
});

test("diagnóstico: limite da operação estourado entra no caminho, depois dos bloqueios", () => {
  const base = baseFiscal(SANTA_TERESINHA, []);
  const d = diagnosticar({
    projeto: { total: null, repasse: 0, credito: 20_000_000 },
    conclusoes: [conclusao("A", {}), conclusao("C", { bloqueantes: ["G7"] })],
    verificacoes: VERIFICACOES,
    base,
    simulacao: simular(base, { ...OP, valor: 20_000_000 }, 0),
  });
  assert.deepEqual(d.providencias.map((p) => `${p.tipo}:${p.codigo}`), ["bloqueio:G7", "limite:G4"]);
  assert.match(d.providencias[1].porque, /limite de 16%/);
});

test("diagnóstico sem bloqueio, mas com dado a conferir: em aberto (Piancó, regra de ouro)", () => {
  const base = baseFiscal(SANTA_TERESINHA, []);
  const d = diagnosticar({
    projeto: { total: null, repasse: 0, credito: 1_000_000 },
    conclusoes: [conclusao("A", { estado: "atendido" }), conclusao("C", { estado: "nao_verificavel", sem_dado: ["G3"] })],
    verificacoes: [],
    base,
    simulacao: simular(base, { ...OP, valor: 1_000_000 }, 0),
  });
  assert.equal(d.estado, "nao_verificavel");
  assert.deepEqual(d.providencias.map((p) => `${p.tipo}:${p.codigo}`), ["conferir:G3"]);
});

test("diagnóstico sem bloqueio: contrapartida cabe no caixa, com a ressalva", () => {
  const d = diagnosticar({
    projeto: { total: 1_500_000, repasse: 1_000_000, credito: 0 },
    conclusoes: [conclusao("A", { estado: "atendido" }), conclusao("B", { estado: "atendido" })],
    verificacoes: [],
    base: baseFiscal({ ...SANTA_TERESINHA, caixa: { exercicio: 2025, nao_vinculado_liquido: 2_000_000, nao_vinculado_bruto: null, total_liquido: null } }, []),
    simulacao: null,
  });
  assert.equal(d.estado, "atendido");
  assert.deepEqual(d.providencias, []);
  assert.match(d.notaContrapartida ?? "", /cabe no caixa não vinculado de 31\/12\/2025 \(R\$ 2\.000\.000\)/);
  assert.equal(moeda(-1500.4), "-R$ 1.500");
});
