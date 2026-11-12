import assert from "node:assert/strict";
import { test } from "node:test";
import { AVISO_LEITURA, avisoLeitura } from "./aviso-leitura.ts";

test("a frase comum diz a data e «a conferir» como ponto para olhar (regras 1 e 4 do dicionário)", () => {
  const a = avisoLeitura();
  assert.ok(a.includes("cada uma com a sua data."));
  assert.ok(a.includes("«A conferir» é ponto para olhar, nunca irregularidade"));
  assert.ok(!a.includes("{DATAS}"));
  assert.ok(!AVISO_LEITURA.includes("irregular."), "a palavra 'irregular' só aparece negada");
});

test("as datas no fim, o uso interno e as frases próprias entram na ordem certa, sem espaço sobrando", () => {
  const a = avisoLeitura({ interno: true, datasNoFim: true, antes: "Versão para a sua organização.", depois: "Fora da Paraíba só os vivos." });
  assert.ok(a.startsWith("Uso interno da PONTE. Versão para a sua organização. Leitura automática"));
  assert.ok(a.includes("cada uma com a sua data (ver o fim)."));
  assert.ok(a.endsWith("orientação jurídica. Fora da Paraíba só os vivos."));
  assert.ok(!a.includes("  "));
  assert.equal(avisoLeitura({ antes: "  ", depois: "" }), avisoLeitura());
});
