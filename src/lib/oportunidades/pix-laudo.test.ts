import test from "node:test";
import assert from "node:assert/strict";
import { paraCsv } from "./painel.ts";
import {
  catalogoDe,
  chaveEnteValida,
  classeEstado,
  colunasCsvEnte,
  impedidosPorAno,
  itensDoGrupo,
  podeVerPlanoPix,
  planoSemContato,
  pontosAConferir,
  porQueImpedido,
  resumoPorItem,
  rotuloItem,
  type ItemLaudoPix,
  type PlanoLaudoPix,
} from "./pix-laudo.ts";

const it = (item: string, estado: ItemLaudoPix["estado"], nivel: ItemLaudoPix["nivel"] = null): ItemLaudoPix => ({
  item, titulo: `título ${item}`, dispositivo: "IN-TCU 93/2024", estado, nivel, fato: `fato ${item}`,
});

function plano(extra: Partial<PlanoLaudoPix> = {}): PlanoLaudoPix {
  return {
    id_plano_acao: 1, codigo_plano_acao: "0903-000001", ano: 2025, beneficiario: "MUNICIPIO DE SAPE", cnpj: "08917080000156",
    cod_ibge: "2515302", autor: "Fulano", codigo_emenda: "202512830005-Fulano", situacao: "CIENTE", valor: 300000, custeio: 0,
    investimento: 300000, pago: 300000, dt_primeira_ob: "2025-09-01", fim_execucao: "2028-09-01", limite_execucao: "2029-01-01",
    area: "15-Urbanismo", objeto: "- Pavimentação", saldo: 1000, dt_saldo: "2026-09-28", pior: "alto", n_critico: 0, n_alto: 1,
    n_moderado: 1, n_pendente: 0, versao: "2026-09-30.1",
    itens: [it("A1", "atendido"), it("A4b", "nao_atendido", "alto"), it("A5", "nao_atendido", "critico"), it("B4", "nao_atendido", "moderado"),
      it("C1", "pendente"), it("D1", "atendido")],
    ...extra,
  };
}

test("pontos a conferir: do crítico ao moderado, e só os não atendidos com nível", () => {
  assert.deepEqual(pontosAConferir(plano().itens).map((i) => i.item), ["A5", "A4b", "B4"]);
});

test("grupos pela letra do item", () => {
  assert.deepEqual(itensDoGrupo(plano().itens, "A").map((i) => i.item), ["A1", "A4b", "A5"]);
  assert.deepEqual(itensDoGrupo(plano().itens, "E"), []);
});

test("rótulo e cor: 'a conferir' nunca vira 'irregular'", () => {
  assert.equal(rotuloItem(it("A4b", "nao_atendido", "alto")), "a conferir · alto");
  assert.equal(rotuloItem(it("A1b", "nao_verificavel")), "não verificável");
  assert.equal(classeEstado(it("A5", "nao_atendido", "critico")), "mp-laudo-critico");
  assert.equal(classeEstado(it("A1", "atendido")), "mp-laudo-atendido");
  assert.equal(classeEstado(it("C1", "pendente")), "mp-laudo-informativo");
});

test("resumo por item: soma os estados e ignora o que não se aplica", () => {
  const linhas = resumoPorItem(
    [
      { item: "A4b", estado: "nao_atendido", nivel: "alto", planos: 138, valor: 70e6 },
      { item: "A4b", estado: "nao_atendido", nivel: "moderado", planos: 196, valor: 5e6 },
      { item: "A4b", estado: "atendido", nivel: null, planos: 570, valor: 1 },
      { item: "A4b", estado: "informativo", nivel: null, planos: 407, valor: 1 },
      { item: "A4b", estado: "nao_se_aplica", nivel: null, planos: 180, valor: 0 },
      { item: "A10", estado: "atendido", nivel: null, planos: 1, valor: 0 },
      { item: "A2", estado: "nao_verificavel", nivel: null, planos: 1745, valor: 0 },
    ],
    { A4b: "Saída para outra conta do próprio ente" },
  );
  assert.deepEqual(linhas.map((l) => l.item), ["A2", "A4b", "A10"]); // ordem natural, não alfabética
  const a4b = linhas.find((l) => l.item === "A4b")!;
  assert.deepEqual([a4b.planos, a4b.alto, a4b.moderado, a4b.atendido, a4b.outros, a4b.valorConferir], [1311, 138, 196, 570, 407, 75e6]);
  assert.equal(a4b.titulo, "Saída para outra conta do próprio ente");
});

test("cliente: só o plano do próprio município confirmado; o Estado fica de fora", () => {
  const acesso = { ok: true as const, ibge: "2515302" };
  assert.equal(podeVerPlanoPix(acesso, plano()), true);
  assert.equal(podeVerPlanoPix(acesso, plano({ cod_ibge: "2513802" })), false);
  assert.equal(podeVerPlanoPix(acesso, plano({ cod_ibge: null })), false);
  assert.equal(podeVerPlanoPix({ ok: false, motivo: "aguardando_confirmacao" }, plano()), false);
});

test("chave do ente: CNPJ ou IBGE da PB, nada mais", () => {
  assert.deepEqual(chaveEnteValida("08917080000156"), { tipo: "cnpj", valor: "08917080000156" });
  assert.deepEqual(chaveEnteValida("2515302"), { tipo: "ibge", valor: "2515302" });
  assert.equal(chaveEnteValida("3550308"), null);
  assert.equal(chaveEnteValida("abc"), null);
});

test("CSV do ente: um plano por linha, um item por coluna, identificadores intactos", () => {
  const planos = [plano(), plano({ id_plano_acao: 2, itens: [] })];
  const cat = catalogoDe(planos);
  assert.deepEqual(cat.map((c) => c.item), ["A1", "A4b", "A5", "B4", "C1", "D1"]);
  const csv = paraCsv(colunasCsvEnte(cat), planos);
  const [cab, l1] = csv.replace("﻿", "").split("\r\n");
  assert.ok(cab.includes("A4b título A4b"));
  assert.ok(l1.includes('"=""08917080000156"""'));     // CNPJ não vira número
  assert.ok(l1.includes("a conferir · alto"));
  assert.ok(l1.includes('" - Pavimentação"'));           // texto com sinal não vira fórmula
});

test("não verificável tem marca própria, separada da informação", () => {
  assert.equal(classeEstado(it("A1b", "nao_verificavel")), "mp-laudo-informativo mp-laudo-semdado");
});

// ------------------------------------------------------------------ impedidos (oport_29, 07/10/2026)

const impedidoPor = (grupo: string, extra: Partial<PlanoLaudoPix> = {}, im: Record<string, unknown> = {}): PlanoLaudoPix =>
  plano({
    situacao: "IMPEDIDO", pago: 0, valor: 500000,
    analise_pt: { analises: [], total_analises: 0, impedimento: { motivo: "Impedido por falta de análise conclusiva no prazo estabelecido.", grupo, gemeo: null, reindicacao: null, ...im } },
    ...extra,
  });

test("por que impedido: rótulo e lado do painel, e o que veio depois", () => {
  assert.equal(porQueImpedido(plano()), null, "plano ciente não tem porquê");
  const q = porQueImpedido(impedidoPor("falta_analise", {}, {
    gemeo: { codigo: "0903-000009", situacao: "CIENTE", pago: 500000 },
    reindicacao: { ano: 2026, planos: 2, valor: 800000, nao_impedidos: 1, pago: 0 },
  }));
  assert.ok(q);
  assert.equal(q.rotulo, "O órgão federal não analisou o plano no prazo");
  assert.equal(q.lado, "orgao");
  assert.equal(q.recuperado, true);
  assert.match(q.depois[0], /^Reapresentado no mesmo ano, num ciclo seguinte \(plano 0903-000009\), que ficou ciente e recebeu R\$/);
  assert.match(q.depois[1], /^Em 2026, o mesmo autor indicou de novo este ente: 2 planos, .* \(1 sem impedimento\)\.$/);
  const sem = porQueImpedido(impedidoPor("falta_complementacao", {}, { ano_seguinte_no_dado: true }));
  assert.ok(sem);
  assert.equal(sem.lado, "beneficiario");
  assert.equal(sem.recuperado, false);
  assert.deepEqual(sem.depois, ["Em 2026, o mesmo autor não indicou de novo este ente pelo Pix."]);
  const cedo = porQueImpedido(impedidoPor("falta_complementacao", { ano: 2026 }, { ano_seguinte_no_dado: false }));
  assert.deepEqual(cedo?.depois, [], "2027 ainda não tem planos na API: nada a dizer sobre reindicação");
  const area = porQueImpedido(impedidoPor("falta_analise", {
    analise_pt: { analises: [{ orgao: "MCID", situacao: "Em elaboração", parecer: null, data: "2025-08-07", valor_reprovado: null, trecho: "Fora da área", fora_da_area: true }],
      total_analises: 1, impedimento: { motivo: null, grupo: "falta_analise", gemeo: null, reindicacao: null } },
  }));
  assert.match(area?.depois[0] ?? "", /^O único órgão que se manifestou disse que o plano não é da área dele/);
  const misto = porQueImpedido(impedidoPor("falta_analise", {
    analise_pt: { analises: [
      { orgao: "MCID", situacao: "Concluída", parecer: "Não se aplica", data: "2025-08-07", valor_reprovado: null, trecho: "Fora da área", fora_da_area: true },
      { orgao: "MS", situacao: "Em elaboração", parecer: null, data: "2025-08-01", valor_reprovado: null, trecho: "Em análise", fora_da_area: false }],
      total_analises: 2, impedimento: { motivo: null, grupo: "falta_analise", gemeo: null, reindicacao: null } },
  }));
  assert.deepEqual(misto?.depois, [], "um órgão competente se manifestou: o 'não é da minha área' do outro é só roteamento");
  const antigo = porQueImpedido(plano({ situacao: "IMPEDIDO" }));
  assert.ok(antigo, "linha gravada antes da oport_29 continua impedida");
  assert.equal(antigo.rotulo, "Impedido sem motivo agrupado");
  assert.deepEqual(antigo.depois, []);
});

test("impedidos por ano: do ano mais recente para o mais antigo, por valor, com recuperados e reindicados", () => {
  const planos = [
    impedidoPor("falta_analise", { ano: 2025, valor: 100000 }, { gemeo: { codigo: "x", situacao: "CIENTE", pago: 0 } }),
    impedidoPor("falta_analise", { ano: 2025, valor: 300000 }, { reindicacao: { ano: 2026, planos: 1, valor: 1, nao_impedidos: 1, pago: 0 } }),
    impedidoPor("falta_complementacao", { ano: 2026, valor: 50000 }),
    impedidoPor("falta_analise", { ano: 2023, valor: 900000 }),
    plano({ ano: 2026 }),
  ];
  const r = impedidosPorAno(planos, 2025);
  assert.deepEqual(r.map((x) => [x.ano, x.grupo, x.planos, x.valor, x.recuperados, x.valorRecuperado, x.valorPerdido, x.reindicados]), [
    [2026, "falta_complementacao", 1, 50000, 0, 0, 50000, 0],
    [2025, "falta_analise", 2, 400000, 1, 100000, 300000, 1],
  ]);
  const repetido = impedidoPor("falta_analise", { ano: 2025, valor: 70000 }, { repetido_de: { codigo: "0903-2-1", situacao: "CIENTE", pago: 70000 } });
  const q = porQueImpedido(repetido);
  assert.ok(q?.recuperado, "repetição não é perda");
  assert.match(q?.depois[0] ?? "", /^Repetição do mesmo dinheiro num ciclo seguinte do mesmo ano: o valor está no plano 0903-2-1/);
  assert.equal(impedidosPorAno([repetido], 2025)[0].valorPerdido, 0);
});

test("R3: o trecho do parecer e o motivo chegam à tela sem contato de servidor", () => {
  const p = impedidoPor("falta_analise", {
    analise_pt: {
      analises: [{ orgao: "MCID", situacao: "Concluída", parecer: "Desfavorável", data: "2025-08-07", valor_reprovado: null,
        trecho: "Dúvidas: fulano@cidades.gov.br ou (61) 2108-1234.", fora_da_area: false }],
      total_analises: 1,
      impedimento: { motivo: "Ver com 61 99876-5432", grupo: "falta_analise", gemeo: null, reindicacao: null },
    },
  });
  const limpo = planoSemContato(p);
  assert.equal(limpo.analise_pt?.analises[0].trecho, "Dúvidas: [e-mail] ou [telefone].");
  assert.equal(limpo.analise_pt?.impedimento?.motivo, "Ver com [telefone]");
  assert.equal(p.analise_pt?.analises[0].trecho, "Dúvidas: fulano@cidades.gov.br ou (61) 2108-1234.", "não muda o original");
  assert.equal(planoSemContato(plano()).analise_pt, plano().analise_pt, "sem análise, nada a fazer");
});
