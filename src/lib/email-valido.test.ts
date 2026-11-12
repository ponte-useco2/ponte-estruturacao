import assert from "node:assert/strict";
import { test } from "node:test";
import { emailValido } from "./email-valido.ts";

test("emailValido aceita o comum e recusa o resto", () => {
  for (const ok of ["a@b.co", "fulano.tal@cidades.gov.br", "x+y@dominio-com-hifen.com"]) assert.ok(emailValido(ok), ok);
  for (const nao of ["", "a", "a@b", "a@b.c", "a@.com", "a@b..com", "a b@c.com", "a@b.com ", "@b.com"]) assert.ok(!emailValido(nao), nao);
});
