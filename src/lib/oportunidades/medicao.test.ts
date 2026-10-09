import { test } from "node:test";
import assert from "node:assert/strict";
import { semConsultaNasAreasDeDado } from "./medicao.ts";

test("R3: a medição do Mapa não leva o termo buscado", () => {
  assert.equal(semConsultaNasAreasDeDado("https://ponte.org.br/mapa/busca?q=123.456.789-09&uf=PB"), "https://ponte.org.br/mapa/busca");
  assert.equal(
    semConsultaNasAreasDeDado("https://ponte.org.br/mapa/municipio/2510808/organizacoes?q=maria#lista"),
    "https://ponte.org.br/mapa/municipio/2510808/organizacoes",
  );
  assert.equal(semConsultaNasAreasDeDado("https://ponte.org.br/mapa?aba=x"), "https://ponte.org.br/mapa");
  assert.equal(semConsultaNasAreasDeDado("https://ponte.org.br/oportunidades?busca=fulano"), "https://ponte.org.br/oportunidades");
});

test("R3: fora das áreas de dado a URL segue inteira (campanhas)", () => {
  const u = "https://ponte.org.br/?utm_source=instagram&utm_campaign=lancamento";
  assert.equal(semConsultaNasAreasDeDado(u), u);
  assert.equal(semConsultaNasAreasDeDado("https://ponte.org.br/mapas-do-brasil?x=1"), "https://ponte.org.br/mapas-do-brasil?x=1");
  assert.equal(semConsultaNasAreasDeDado("/contato?assunto=1"), "/contato?assunto=1");
});
