import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENTES,
  ROTULO_AGENTE,
  UFS,
  agentesPorGrupo,
  cnpjValido,
  digitosDoCnpj,
  ehTipoAgente,
  ehUF,
} from "./organizacao.ts";

/**
 * A lista abaixo é a cópia literal de `ORGANIZATION_TYPES`, em
 * `funding_intelligence/models.py` do repositório do radar
 * (diretoriajnconsulting-dotcom/jn-portal-oportunidades), lida em 12/09/2026.
 *
 * Está duplicada aqui de propósito: o radar é outro repositório e não está
 * disponível no CI deste. Se os dois divergirem, o cruzamento com
 * `eligibility.organization_types` do catálogo v2 passa a descartar em silêncio
 * as oportunidades do tipo que sumiu — e silêncio é o pior modo de falhar num
 * portão de elegibilidade. Este teste transforma a divergência em falha.
 */
const TIPOS_DO_RADAR = [
  "empresa",
  "startup",
  "osc",
  "ict",
  "universidade",
  "municipio",
  "estado",
  "consorcio_publico",
  "cooperativa",
  "pesquisador",
  "pessoa_fisica",
  "outros",
];

test("os ids batem, um a um, com ORGANIZATION_TYPES do radar", () => {
  const daqui = AGENTES.map((a) => a.id).sort();
  assert.deepEqual(daqui, [...TIPOS_DO_RADAR].sort());
});

test("nenhum id repetido e todo id tem rótulo", () => {
  const ids = AGENTES.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, "id repetido");
  for (const a of AGENTES) {
    assert.ok(ROTULO_AGENTE[a.id], `sem rótulo: ${a.id}`);
    assert.ok(a.exemplos.length > 10, `exemplo curto demais em ${a.id}`);
  }
});

test("os grupos cobrem os doze, sem sobra nem repetição", () => {
  const agrupados = agentesPorGrupo().flatMap((g) => g.agentes.map((a) => a.id));
  assert.equal(agrupados.length, AGENTES.length);
  assert.deepEqual([...agrupados].sort(), AGENTES.map((a) => a.id).sort());
});

test("ehTipoAgente recusa o que não está na lista", () => {
  assert.ok(ehTipoAgente("municipio"));
  assert.ok(ehTipoAgente("consorcio_publico"));
  assert.ok(!ehTipoAgente("prefeitura"));
  assert.ok(!ehTipoAgente("Municipio"));
  assert.ok(!ehTipoAgente(""));
  assert.ok(!ehTipoAgente(null));
  assert.ok(!ehTipoAgente(42));
});

test("as 27 unidades da federação, sem repetição", () => {
  assert.equal(UFS.length, 27);
  assert.equal(new Set(UFS).size, 27);
  assert.ok(ehUF("PB"));
  assert.ok(!ehUF("XX"), "regex do banco aceitaria XX; a lista não");
  assert.ok(!ehUF("pb"), "minúscula é normalizada antes, não aceita aqui");
});

test("digitosDoCnpj tira a máscara e devolve null quando não há nada", () => {
  assert.equal(digitosDoCnpj("12.345.678/0001-95"), "12345678000195");
  assert.equal(digitosDoCnpj("  "), null);
  assert.equal(digitosDoCnpj(null), null);
  assert.equal(digitosDoCnpj(undefined), null);
});

test("cnpjValido confere os dígitos verificadores, não só o formato", () => {
  // Válido, com e sem máscara.
  assert.ok(cnpjValido("11.222.333/0001-81"));
  assert.ok(cnpjValido("11222333000181"));

  // O caso que o regex do banco deixaria passar.
  assert.ok(!cnpjValido("00000000000000"), "sequência repetida não é CNPJ");
  assert.ok(!cnpjValido("11111111111111"));

  // Dígito verificador errado.
  assert.ok(!cnpjValido("11222333000182"));

  // Comprimento errado.
  assert.ok(!cnpjValido("1122233300018"));
  assert.ok(!cnpjValido("112223330001811"));

  // Ausente é permitido: o campo é opcional.
  assert.ok(cnpjValido(null));
  assert.ok(cnpjValido(""));
  assert.ok(cnpjValido(undefined));
});
