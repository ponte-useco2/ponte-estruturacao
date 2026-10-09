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

test("R3: o que o job já mascarou não muda, e vazio continua vazio", () => {
  assert.equal(semDadoPessoal("Falar com [e-mail] ou [telefone]; CPF ***."), "Falar com [e-mail] ou [telefone]; CPF ***.");
  assert.equal(semDadoPessoal(null), null);
  assert.equal(semDadoPessoal(""), "");
});
