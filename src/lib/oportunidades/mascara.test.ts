import { test } from "node:test";
import assert from "node:assert/strict";
import { semDadoPessoal } from "./mascara.ts";

test("R3: o parecer sai sem CPF, e-mail e telefone; processo, CNPJ e valor ficam", () => {
  const t =
    "Contato: fulano.tal@cidades.gov.br, (61) 2108-1234 ou 61 99876-5432; celular 98765-4321. " +
    "CPF 123.456.789-09. Processo 71000.012345/2025-11, CNPJ 12.345.678/0001-90, R$ 1.234.567,89.";
  assert.equal(
    semDadoPessoal(t),
    "Contato: [e-mail], [telefone] ou [telefone]; celular [telefone]. " +
      "CPF ***. Processo 71000.012345/2025-11, CNPJ 12.345.678/0001-90, R$ 1.234.567,89.",
  );
});

test("N3: fixo sem DDD sai; processo, data, valor, SEI, CEP e intervalo de anos ficam", () => {
  assert.equal(
    semDadoPessoal("Contatos: 3218-0000 / 3218-0001 (ramal 2101-1234); (083) 3218-0002; Tel.:4321-1234. Fim"),
    "Contatos: [telefone] / [telefone] (ramal [telefone]); (083) [telefone]; Tel.:[telefone]. Fim",
  );
  const fica =
    "Processo 71000.012345/2025-11, CNPJ 12.345.678/0001-90, CEP 58051-900, R$ 1.234.567,89 e R$3218-0000, " +
    "SEI 19037514, 10/07/2026 15:57:19, PPA 2024-2027, Parecer 2024-0012, ID 1234-5678-9012, Lei 8.666/1993.";
  assert.equal(semDadoPessoal(fica), fica);
});

test("N3: o fixo de Brasília (20xx) só sai depois de palavra de contato", () => {
  assert.equal(semDadoPessoal("Telefone: 2022-8800."), "Telefone: [telefone].");
  assert.equal(semDadoPessoal("Fones: 2022-8800/2022-8801 e 3218-0000."), "Fones: [telefone]/[telefone] e [telefone].");
  assert.equal(semDadoPessoal("Contatos: 3218-0000 ou 2030-1234"), "Contatos: [telefone] ou [telefone]");
  for (const fica of ["Contato no período 2023-2026", "Hotel 2024-0012", "Documentos de 2023-2026", "Telefone 2022-8800-1"]) {
    assert.equal(semDadoPessoal(fica), fica);
  }
});

test("R3: o que o job já mascarou não muda, e vazio continua vazio", () => {
  assert.equal(semDadoPessoal("Falar com [e-mail] ou [telefone]; CPF ***."), "Falar com [e-mail] ou [telefone]; CPF ***.");
  assert.equal(semDadoPessoal(null), null);
  assert.equal(semDadoPessoal(""), "");
});
