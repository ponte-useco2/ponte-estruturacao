import { test } from "node:test";
import assert from "node:assert/strict";
import { proximoDiaDoMes, recorteDaBase, vazioCatalogo, voltarParaUf } from "./vazios.ts";

test("B12b: o recorte da base na PB, fora dela e sem UF", () => {
  const pb = recorteDaBase("PB");
  assert.match(pb.convenios, /todos os convênios .* da Paraíba, desde 2008/);
  assert.match(pb.propostas, /desde 2019/);
  assert.deepEqual(recorteDaBase("pb"), pb, "a sigla vale em minúscula, como na URL");

  const rn = recorteDaBase("RN");
  assert.match(rn.convenios, /^só os convênios em execução, em prestação de contas ou em tomada de contas especial$/);
  assert.match(rn.propostas, /últimos três anos/);
  assert.ok(!/TCE/.test(rn.convenios), "a tomada de contas especial vai por extenso");

  for (const uf of [null, undefined, "", "XX"]) {
    const ambos = recorteDaBase(uf);
    assert.ok(ambos.convenios.startsWith(pb.convenios) && ambos.convenios.endsWith(rn.convenios), `uf ${String(uf)}`);
    assert.match(ambos.convenios, /no resto do país/);
    assert.ok(ambos.propostas.startsWith(pb.propostas) && ambos.propostas.endsWith(rn.propostas));
  }
});

test("B12b: a volta até a UF", () => {
  assert.deepEqual(voltarParaUf("PB"), { rotulo: "Voltar à Paraíba", href: "/mapa/uf/pb" });
  assert.deepEqual(voltarParaUf("rn"), { rotulo: "Voltar à página da UF (Rio Grande do Norte)", href: "/mapa/uf/rn" });
  assert.equal(voltarParaUf(null), null);
  assert.equal(voltarParaUf("ZZ"), null);
});

test("B12b: o próximo dia 5, contando hoje, com a virada do mês e do ano", () => {
  assert.equal(proximoDiaDoMes("2026-10-08", 5), "2026-11-05");
  assert.equal(proximoDiaDoMes("2026-10-05", 5), "2026-10-05", "no próprio dia, é hoje");
  assert.equal(proximoDiaDoMes("2026-10-04", 5), "2026-10-05");
  assert.equal(proximoDiaDoMes("2026-12-20", 5), "2027-01-05");
  assert.equal(proximoDiaDoMes("2026-10-08T13:00:00Z", 5), "2026-11-05", "aceita o instante, lê só a data");
});

test("B12b: dia que o mês não tem vai ao último dia dele", () => {
  assert.equal(proximoDiaDoMes("2026-11-15", 31), "2026-11-30");
  assert.equal(proximoDiaDoMes("2026-11-30", 31), "2026-11-30");
  assert.equal(proximoDiaDoMes("2027-02-01", 30), "2027-02-28");
  assert.equal(proximoDiaDoMes("2028-02-01", 30), "2028-02-29", "ano bissexto");
  assert.equal(proximoDiaDoMes("2026-12-31", 31), "2026-12-31");
});

test("B12b: data ou dia inválidos dão null", () => {
  assert.equal(proximoDiaDoMes("08/10/2026", 5), null);
  assert.equal(proximoDiaDoMes("2026-10-08", 0), null);
  assert.equal(proximoDiaDoMes("2026-10-08", 32), null);
  assert.equal(proximoDiaDoMes("2026-10-08", 5.5), null);
});

const BASE = { busca: "", outrosFiltros: false, tipo: null, abertasHoje: 120, fontesComProblema: [] as string[] };

test("B12b: o vazio do catálogo diz o termo procurado e os filtros", () => {
  assert.equal(vazioCatalogo({ ...BASE, busca: "  creche " }).frase, "Nenhuma janela com “creche” no programa ou no órgão.");
  assert.equal(
    vazioCatalogo({ ...BASE, busca: "creche", outrosFiltros: true }).frase,
    "Nenhuma janela com “creche” no programa ou no órgão, com os filtros escolhidos.",
  );
  assert.equal(vazioCatalogo({ ...BASE, outrosFiltros: true }).frase, "Nenhuma janela com os filtros escolhidos.");
  assert.equal(vazioCatalogo({ ...BASE, busca: "   ", outrosFiltros: true }).frase, "Nenhuma janela com os filtros escolhidos.", "espaço não é termo");
});

test("B12b: sem filtro, o vazio diz o universo e o tipo da entidade", () => {
  assert.equal(vazioCatalogo({ ...BASE, tipo: "ICT", abertasHoje: 1234 }).frase, "Nenhuma das 1.234 janelas abertas hoje no catálogo aceita ICT.");
  assert.equal(vazioCatalogo({ ...BASE, tipo: "município", abertasHoje: 1 }).frase, "A única janela aberta hoje no catálogo não aceita município.");
  assert.equal(vazioCatalogo({ ...BASE, tipo: "município", abertasHoje: 0 }).frase, "Nenhuma janela aberta hoje no catálogo.");
  assert.equal(vazioCatalogo(BASE).frase, "Nenhuma janela aberta hoje no catálogo.");
  assert.equal(vazioCatalogo(BASE).motivo, null);
});

test("B12b: fonte com problema vira motivo provável, sem afirmar que não há janela", () => {
  assert.equal(
    vazioCatalogo({ ...BASE, fontesComProblema: ["Finep"] }).motivo,
    "As janelas de Finep podem estar faltando: a leitura dessa fonte está com problema.",
  );
  assert.equal(
    vazioCatalogo({ ...BASE, fontesComProblema: ["Finep", "BNDES", "Fundação Banco do Brasil"] }).motivo,
    "As janelas de Finep, BNDES e Fundação Banco do Brasil podem estar faltando: a leitura dessas fontes está com problema.",
  );
  assert.equal(vazioCatalogo({ ...BASE, fontesComProblema: [" "] }).motivo, null);
});
