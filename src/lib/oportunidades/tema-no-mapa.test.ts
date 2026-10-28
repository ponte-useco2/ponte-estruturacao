import test from "node:test";
import assert from "node:assert/strict";
import { enderecoComTema, lerTema, linhaDoTema, opcoesDeTema, resumoDoTema, somaNoTema, temasDasUfs, temasDosMunicipios } from "./tema-no-mapa.ts";

test("onda 17: as UFs por tema vêm do território, sem o Brasil e sem soma zerada", () => {
  const t = temasDasUfs([
    { recorte: "PB", dimensao: "tema", chave: "saude", n: 200, valor: 3e8 },
    { recorte: "BR", dimensao: "tema", chave: "saude", n: 9000, valor: 1e10 },
    { recorte: "PE", dimensao: "situacao", chave: "Em execução", n: 50, valor: 1 },
    { recorte: "AC", dimensao: "tema", chave: "cultura", n: 0, valor: 0 },
  ]);
  assert.deepEqual(t, { PB: { saude: [200, 3e8] } });
});

test("onda 17: nos municípios, cada tema do instrumento conta uma vez, com o valor global", () => {
  const t = temasDosMunicipios([
    { cod_ibge: "2507507", temas: ["saude", "saude", "educacao"], vl_global: "100.5" },
    { cod_ibge: "2507507", temas: ["saude"], vl_global: 50 },
    { cod_ibge: "2510808", temas: [], vl_global: 10 },
    { cod_ibge: null, temas: ["saude"], vl_global: 10 },
    { cod_ibge: "2510808", temas: ["cultura"], vl_global: null },
  ]);
  assert.deepEqual(t, { "2507507": { saude: [2, 150.5], educacao: [1, 100.5] }, "2510808": { cultura: [1, 0] } });
});

test("onda 17: os temas vêm por alcance (áreas), não por dinheiro; empate pelo rótulo", () => {
  const o = opcoesDeTema({ PB: { saude: [1, 1], cultura: [9, 9e9] }, PE: { saude: [1, 1], educacao: [1, 1] } });
  assert.deepEqual(
    o.map((x) => [x.id, x.areas]),
    [
      ["saude", 2],
      ["cultura", 1],
      ["educacao", 1],
    ],
  );
  assert.equal(o[0].rotulo, "Saúde");
});

test("onda 17: o tema do endereço só vale se o mapa o oferece", () => {
  const o = opcoesDeTema({ PB: { saude: [1, 1] } });
  assert.equal(lerTema("saude", o), "saude");
  assert.equal(lerTema(" saude ", o), "saude");
  assert.equal(lerTema("cultura", o), null);
  assert.equal(lerTema(null, o), null);
});

test("onda 17: a soma e a linha da prévia", () => {
  const p = { PB: { saude: [3, 2.1e6] as const, cultura: [0, 0] as const } };
  assert.deepEqual(somaNoTema(p, "PB", "saude"), [3, 2.1e6]);
  assert.equal(somaNoTema(p, "PB", "cultura"), null);
  assert.equal(somaNoTema(p, "PE", "saude"), null);
  assert.equal(linhaDoTema("Saúde", [3, 2.1e6]), "Saúde: 3 instrumentos vivos · R$ 2,1 mi");
  assert.equal(linhaDoTema("Saúde", [1, 0]), "Saúde: 1 instrumento vivo");
  assert.equal(linhaDoTema("Saúde", null), "Saúde: nenhum instrumento vivo");
  assert.equal(resumoDoTema("Saúde", 140, 223, { um: "município", varios: "municípios" }), "Saúde: 140 de 223 municípios com instrumento vivo no tema.");
});

test("onda 17: o tema vai para o endereço sem perder a aba, o filtro da tabela e a âncora", () => {
  assert.equal(enderecoComTema("/mapa/uf/pb?aba=municipios&t.mun.porte=Pequeno#mapa", "saude"), "/mapa/uf/pb?aba=municipios&t.mun.porte=Pequeno&tema=saude#mapa");
  assert.equal(enderecoComTema("/mapa/brasil?tema=saude&aba=resumo", null), "/mapa/brasil?aba=resumo");
  assert.equal(enderecoComTema("/mapa/brasil?tema=saude", "cultura"), "/mapa/brasil?tema=cultura");
});
