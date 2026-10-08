import test from "node:test";
import assert from "node:assert/strict";
import { ABAS_MUNICIPIO, NOME_ABA, ORDEM_DAS_ABAS, PODE, abaEscolhida, destinoConvenio, nivelDeAcesso, urlMunicipio } from "./pagina-municipio.ts";
import { ABAS_BRASIL } from "./pagina-brasil.ts";
import { ABAS_ENTIDADE, abaDaEntidade } from "./pagina-entidade.ts";
import { ABAS_UF } from "./pagina-uf.ts";

test("nível de acesso: público, cadastrado, cliente do próprio município e administrador", () => {
  assert.equal(nivelDeAcesso({ aprovado: false, administrador: true, clienteDoMunicipio: true }), 0, "sem aprovação não há nível, nem de administrador");
  assert.equal(nivelDeAcesso({ aprovado: true, administrador: false, clienteDoMunicipio: false }), 1);
  assert.equal(nivelDeAcesso({ aprovado: true, administrador: false, clienteDoMunicipio: true }), 2);
  assert.equal(nivelDeAcesso({ aprovado: true, administrador: true, clienteDoMunicipio: false }), 3);
});

test("aba: a pedida quando o nível alcança; senão a de entrada", () => {
  assert.equal(abaEscolhida(undefined, 1), "trava");
  assert.equal(abaEscolhida("contas", 1), "contas");
  assert.equal(abaEscolhida(["controle", "x"], 2), "controle");
  assert.equal(abaEscolhida("inventada", 3), "trava");
  assert.equal(abaEscolhida("contas", 0), "resumo", "o público não vê as contas e cai no resumo");
  assert.equal(abaEscolhida("indicadores", 0), "indicadores");
  assert.deepEqual(ABAS_MUNICIPIO.filter((a) => a.minimo === 0).map((a) => a.id), ["resumo", "dinheiro", "indicadores"], "a D1 abre ao público o resumo, o dinheiro e os indicadores");
});

test("endereços e o que cada nível alcança dentro das abas", () => {
  assert.equal(urlMunicipio("2510808"), "/mapa/municipio/2510808");
  assert.equal(urlMunicipio("2510808", "trava"), "/mapa/municipio/2510808");
  assert.equal(urlMunicipio("2510808", "contas"), "/mapa/municipio/2510808?aba=contas");
  assert.equal(destinoConvenio(1)("942082"), "/mapa/instrumento/942082", "o cadastrado vai à página do instrumento");
  assert.equal(destinoConvenio(2)("942082"), "/mapa/instrumento/942082/laudo");
  assert.deepEqual([PODE.simulador(1), PODE.simulador(2), PODE.interno(2), PODE.interno(3)], [false, true, false, true]);
});

test("B11: as abas comuns têm o mesmo nome e a mesma ordem nos 4 níveis do território", () => {
  const niveis: Record<string, readonly { id: string; nome: string }[]> = { Brasil: ABAS_BRASIL, UF: ABAS_UF, município: ABAS_MUNICIPIO, entidade: ABAS_ENTIDADE };
  for (const [nivel, abas] of Object.entries(niveis)) {
    for (const a of abas) {
      if (Object.hasOwn(NOME_ABA, a.id)) assert.equal(a.nome, NOME_ABA[a.id as keyof typeof NOME_ABA], `${nivel}: aba ${a.id}`);
    }
    const posicoes = abas.map((a) => ORDEM_DAS_ABAS.indexOf(a.id));
    assert.ok(posicoes.every((p) => p >= 0), `${nivel}: toda aba está na ordem comum`);
    assert.deepEqual(posicoes, [...posicoes].sort((x, y) => x - y), `${nivel}: as abas seguem a ordem comum`);
    // o dinheiro e o relatório existem nos quatro, com o mesmo nome; o relatório fecha a fila
    assert.equal(abas.find((a) => a.id === "dinheiro")?.nome, "Dinheiro federal", `${nivel}: um nome só para o dinheiro`);
    assert.equal(abas.at(-1)?.nome, "Relatório e dados", `${nivel}: "Relatório e dados" é a última`);
  }
  // nenhum nome repete o de outra aba do mesmo nível
  for (const abas of Object.values(niveis)) assert.equal(new Set(abas.map((a) => a.nome)).size, abas.length);
});

test("B11: a aba de entrada do município e da entidade segue «O que trava e o que destrava» (decisão de 06/10)", () => {
  assert.equal(ABAS_MUNICIPIO[0].id, "trava");
  assert.equal(ABAS_ENTIDADE[0].id, "trava");
  assert.equal(abaEscolhida(undefined, 1), "trava");
  assert.equal(abaDaEntidade(undefined, 1), "trava");
});
