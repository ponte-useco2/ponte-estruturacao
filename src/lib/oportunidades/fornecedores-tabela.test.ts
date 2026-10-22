/** A lista das empresas do painel de fornecedores como tabela com filtro (onda 15, fase 3, F3.3, 22/10/2026). */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPOS_FORNECEDOR,
  OPCOES_FORNECEDORES,
  colunasFornecedores,
  filtroDosParametros,
  ordemDoFormulario,
  urlCsvFornecedores,
  valoresDoFornecedor,
} from "./fornecedores-tabela.ts";
import type { Fornecedor } from "./fornecedores.ts";

const f: Fornecedor = {
  cnpj: "08939944000130", nome: "CONSTRUTORA X LTDA", mei: false, pb_convenios: 12, pb_municipios: 5, pb_proponentes: 5, pb_orgaos: 2,
  pb_pago: 1_500_000, pb_n_pagamentos: 30, pb_primeiro_pagamento: "2022-01-01", pb_ultimo_pagamento: "2026-01-01", pb_contratos: 0,
  pb_contratado: 0, br_convenios: 20, br_ufs: 3, br_pago: 3_000_000, inidoneo_tcu: null, tcu_acordao: null, tcu_inicio: null,
  tcu_data_final: null, tcu_link: null,
};

test("as colunas: valor cru em cada uma; no caminho comum, campo no banco para todas", () => {
  for (const municipio of [null, "Patos"]) {
    const colunas = colunasFornecedores(municipio);
    const v = valoresDoFornecedor({ ...f, noMunicipio: municipio ? { pago: 200_000 } : null });
    assert.equal(new Set(colunas.map((c) => c.id)).size, colunas.length);
    for (const c of colunas) {
      assert.match(c.id, /^[a-z0-9-]+$/);
      assert.ok(c.id in v, c.id);
      if (!municipio) assert.ok(CAMPOS_FORNECEDOR[c.id], `${c.id}: campo no banco`);
    }
    assert.equal(v.recebeu, municipio ? 200_000 : 1_500_000, "com município, o que recebeu lá");
  }
  const v = valoresDoFornecedor({ ...f, noMunicipio: null });
  assert.deepEqual([v.tcu, v.mei, v.contratado], ["Não verificado", "Não", null], "TCU não lido não é 'não consta'");
  assert.deepEqual(OPCOES_FORNECEDORES.tcu.map((o) => o.valor), ["Inidônea", "Não consta", "Não verificado"]);
});

test("a lista do TCU no banco: rótulo para true, false e nulo", () => {
  const tcu = CAMPOS_FORNECEDOR.tcu.especial!;
  assert.equal(tcu({ tipo: "categoria", valores: ["inidônea", "Não verificado"] }), "inidoneo_tcu.eq.true,inidoneo_tcu.is.null");
  assert.equal(tcu({ tipo: "categoria", valores: ["outra"] }), "cnpj.is.null");
  assert.equal(tcu({ tipo: "categoria", valores: [] }), null);
});

test("o formulário: lido do endereço, com a ordem padrão; o CSV leva a mesma consulta", () => {
  assert.deepEqual(filtroDosParametros(new URLSearchParams("q=%20x%20&municipio=2510808&ordem=valor&marca=mei")), {
    q: "x", municipio: "2510808", ordem: "valor", marca: "mei",
  });
  assert.deepEqual(filtroDosParametros(new URLSearchParams("municipio=25&marca=outra")), { q: null, municipio: null, ordem: "municipios", marca: null });
  assert.equal(ordemDoFormulario("municipios")[0].coluna, "pb_municipios");
  assert.equal(urlCsvFornecedores("ordem=valor&t.forn-lista.mei=Sim"), "/mapa/fornecedores/exportar?ordem=valor&t.forn-lista.mei=Sim");
  assert.equal(urlCsvFornecedores(""), "/mapa/fornecedores/exportar");
});
