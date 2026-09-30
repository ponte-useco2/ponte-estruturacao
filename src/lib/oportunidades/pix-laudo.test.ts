import test from "node:test";
import assert from "node:assert/strict";
import { paraCsv } from "./painel.ts";
import {
  catalogoDe,
  chaveEnteValida,
  classeEstado,
  colunasCsvEnte,
  itensDoGrupo,
  podeVerPlanoPix,
  pontosAConferir,
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
