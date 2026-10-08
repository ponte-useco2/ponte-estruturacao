import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { MACRORREGIAO, abaDoBrasil, gruposDeCor, janelasPorUf, ufsLadoALado, urlBrasil, type Malha } from "./pagina-brasil.ts";
import type { LinhaTerritorio } from "./pagina-uf.ts";
import type { LinhaDesfecho } from "./painel.ts";
import type { LinhaEspecialAno } from "./pix.ts";

const t = (recorte: string, dimensao: LinhaTerritorio["dimensao"], chave: string, n: number, valor: number, vivo: boolean | null = null, extra: Partial<LinhaTerritorio> = {}): LinhaTerritorio => ({
  recorte, dimensao, chave, vivo, n, em_execucao: 0, valor, desembolsado: 0, municipios: null, proponentes: null, ...extra,
});

test("U2: abas e endereço do Brasil", () => {
  assert.equal(abaDoBrasil("tempos", 0), "resumo");
  assert.equal(abaDoBrasil("estados", 0), "estados");
  assert.equal(urlBrasil(), "/mapa/brasil");
  assert.equal(urlBrasil("estados"), "/mapa/brasil?aba=estados");
  assert.equal(Object.keys(MACRORREGIAO).length, 27);
});

test("U2: as 27 UFs em ordem alfabética, só com o comparável (os vivos)", () => {
  const territorio = [
    t("PB", "total", "vivos", 2699, 5.6e9, null, { municipios: 222 }),
    t("PB", "situacao", "Em execução", 1790, 4.7e9, true),
    t("PB", "situacao", "Prestação de Contas Aprovada", 5000, 2e9, false),   // morto: fora da comparação
    t("PB", "situacao", "Aguardando Prestação de Contas", 300, 1e8, true),
    t("SP", "total", "vivos", 9000, 2e10, null, { municipios: 600 }),
    t("SP", "situacao", "Em execução", 6000, 1e10, true),
  ];
  const d = (uf: string, ano: number, enviadas: number, assinadas: number): LinhaDesfecho => ({
    cod_programa: null, programa: null, orgao_sup: null, ano_envio: ano, uf, enviadas, assinadas, reprovadas: 0, reprovadas_lote: 0, impedimento: 0,
    impedimento_lote: 0, eliminadas: 0, abertas_concedente: 0, limbo: 0, abertas_proponente: 0, aguardando_assinatura: 0, com_emenda: 0, assinadas_com_emenda: 0, valor_pedido: 0,
  });
  const pix = [{ recorte: "PB", ano: 2026, pago: 140e6 }, { recorte: "PB", ano: 2025, pago: 217e6 }] as LinhaEspecialAno[];
  const l = ufsLadoALado(territorio, [d("PB", 2026, 1223, 241), d("PB", 2025, 2370, 439)], pix, janelasPorUf([{ uf: "PB" }, { uf: "PB" }, { uf: "SP" }, { uf: null }]), 2026);
  assert.equal(l.length, 27);
  assert.deepEqual(l.slice(0, 3).map((u) => u.nome), ["Acre", "Alagoas", "Amapá"]);
  const pb = l.find((u) => u.sigla === "PB");
  assert.deepEqual(pb && [pb.vivos, pb.emExecucao, pb.prestandoContas, pb.municipiosVivos, pb.propostasAno, pb.pixPagoAno, pb.janelas, pb.regiao], [2699, 1790, 300, 222, 1223, 140e6, 2, "NE"]);
  const ac = l.find((u) => u.sigla === "AC");
  assert.deepEqual(ac && [ac.vivos, ac.propostasAno, ac.pixPagoAno, ac.janelas], [0, null, null, 0]);
});

test("U2: cor só por região, nunca mais de 5 grupos", () => {
  const g = gruposDeCor(["João Pessoa", "Campina Grande", "Patos", "Sousa - Cajazeiras"]);
  assert.deepEqual([...g.values()], [0, 1, 2, 3]);
  assert.equal(gruposDeCor(["a", "b", "c", "d", "e", "f"]).get("f"), 0);
});

test("U2: as malhas geradas do IBGE têm as 27 UFs e os 223 municípios da PB", () => {
  const br = JSON.parse(readFileSync(new URL("./malhas/brasil-uf.json", import.meta.url), "utf-8")) as Malha;
  const pb = JSON.parse(readFileSync(new URL("./malhas/pb-municipios.json", import.meta.url), "utf-8")) as Malha;
  assert.deepEqual(br.areas.map((a) => a.id).sort(), Object.keys(MACRORREGIAO).sort());
  assert.equal(pb.areas.length, 223);
  assert.ok(pb.areas.every((a) => /^25\d{5}$/.test(a.id) && a.d.startsWith("M")));
  assert.match(br.viewBox, /^0 0 \d+ \d+$/);
});
