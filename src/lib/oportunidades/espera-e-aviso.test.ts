/**
 * Onda 8, C (09/10/2026): as peças puras da espera e dos avisos do Mapa, que moram em `app/mapa/_componentes/` ao lado
 * dos componentes que as usam (sem import nenhum, por isso o Node as roda direto).
 *   - N22: o que a região de status única diz (`textoDaEspera`) e como os links e os esqueletos a alimentam;
 *   - N13: as abas do esqueleto pelo nível, conferidas contra a aba que cada página abre de fato;
 *   - N20: um aviso por vez no pé da janela (`tomarAVez`).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AVISO_DO_LINK,
  ESPERA_VAZIA,
  abasDoEsqueleto,
  marcarEsqueleto,
  marcarLink,
  textoDaEspera,
} from "../../app/mapa/_componentes/espera.ts";
import { largarAVez, tomarAVez } from "../../app/mapa/_componentes/aviso-da-vez.ts";
import { ABAS_BRASIL, abaDoBrasil } from "./pagina-brasil.ts";
import { ABAS_ENTIDADE, abaDaEntidade } from "./pagina-entidade.ts";
import { ABAS_MUNICIPIO, abaEscolhida } from "./pagina-municipio.ts";
import { ABAS_UF, abaDaUf } from "./pagina-uf.ts";

// ------------------------------------------------------------------ N22: a região de status única

test("textoDaEspera: vazia sem nada pendente; o aviso do link enquanto um link espera", () => {
  assert.equal(textoDaEspera(ESPERA_VAZIA), "");
  const um = marcarLink(ESPERA_VAZIA, "a", true);
  assert.equal(textoDaEspera(um), AVISO_DO_LINK);
  assert.equal(textoDaEspera(marcarLink(um, "a", false)), "");
});

test("textoDaEspera: o esqueleto vence o link, e o último esqueleto que montou fala", () => {
  let e = marcarLink(ESPERA_VAZIA, "link", true);
  e = marcarEsqueleto(e, "esq1", "Carregando a página do estado…");
  assert.equal(textoDaEspera(e), "Carregando a página do estado…");
  e = marcarEsqueleto(e, "esq2", "Carregando a página do município…");
  assert.equal(textoDaEspera(e), "Carregando a página do município…");
  e = marcarEsqueleto(e, "esq2", null);
  assert.equal(textoDaEspera(e), "Carregando a página do estado…");
  // O link sai no mesmo instante em que o esqueleto entra: o texto troca de uma vez, sem passar pelo vazio.
  e = marcarEsqueleto(marcarLink(e, "link", false), "esq1", null);
  assert.equal(textoDaEspera(e), "");
});

test("marcarLink e marcarEsqueleto: sem mudança, o mesmo objeto (o React não renderiza de novo)", () => {
  assert.equal(marcarLink(ESPERA_VAZIA, "a", false), ESPERA_VAZIA);
  const um = marcarLink(ESPERA_VAZIA, "a", true);
  assert.equal(marcarLink(um, "a", true), um);
  assert.equal(marcarEsqueleto(ESPERA_VAZIA, "x", null), ESPERA_VAZIA);
  const esq = marcarEsqueleto(ESPERA_VAZIA, "x", "Carregando…");
  assert.equal(marcarEsqueleto(esq, "x", "Carregando…"), esq);
  // Dois links pendentes: o aviso fica até o último sair.
  const dois = marcarLink(um, "b", true);
  assert.equal(textoDaEspera(marcarLink(dois, "a", false)), AVISO_DO_LINK);
});

// ------------------------------------------------------------------ N13: as abas do esqueleto pelo nível

/** O que o esqueleto mostra a cada nível: as abas à vista e a posição da que aparece acesa. */
function visto(abas: readonly { minimo: number }[], publico: boolean) {
  const todas = abasDoEsqueleto(abas);
  const visiveis = todas.filter((a) => !publico || !a.cadastro);
  return { n: visiveis.length, acesa: visiveis.findIndex((a) => (publico ? a.entradaDoPublico : a.entrada)) };
}

test("abasDoEsqueleto: o público vê o mesmo número de abas que a página desenha para o nível 0", () => {
  for (const abas of [ABAS_MUNICIPIO, ABAS_UF, ABAS_BRASIL, ABAS_ENTIDADE]) {
    assert.equal(visto(abas, true).n, abas.filter((a) => a.minimo <= 0).length);
    assert.equal(visto(abas, false).n, abas.length);
  }
  // Os números da auditoria R1: o município desenhava 7, e o público vê 3.
  assert.equal(visto(ABAS_MUNICIPIO, true).n, 3);
  assert.equal(visto(ABAS_MUNICIPIO, false).n, 7);
});

test("abasDoEsqueleto: a aba acesa é a que a página abre sem `?aba=`, para o público e para o cadastrado", () => {
  const casos = [
    { abas: ABAS_MUNICIPIO, abre: (nivel: 0 | 1) => abaEscolhida(undefined, nivel) },
    { abas: ABAS_ENTIDADE, abre: (nivel: 0 | 1) => abaDaEntidade(undefined, nivel) },
    { abas: ABAS_UF, abre: (nivel: 0 | 1) => abaDaUf(undefined, nivel) },
    { abas: ABAS_BRASIL, abre: (nivel: 0 | 1) => abaDoBrasil(undefined, nivel) },
  ] as const;
  for (const { abas, abre } of casos) {
    for (const nivel of [0, 1] as const) {
      const publico = nivel === 0;
      const desenhadas = abas.filter((a) => nivel >= a.minimo);
      assert.equal(visto(abas, publico).acesa, desenhadas.findIndex((a) => a.id === abre(nivel)), `${abas[0].id}… nível ${nivel}`);
    }
  }
});

test("abasDoEsqueleto: com um número, as abas de antes, todas à vista e a primeira acesa", () => {
  const tres = abasDoEsqueleto(3);
  assert.equal(tres.length, 3);
  assert.ok(tres.every((a) => !a.cadastro));
  assert.deepEqual(
    tres.map((a) => [a.entrada, a.entradaDoPublico]),
    [
      [true, true],
      [false, false],
      [false, false],
    ],
  );
  assert.deepEqual(abasDoEsqueleto(0), []);
});

// ------------------------------------------------------------------ N20: um aviso por vez

test("tomarAVez: quem publica fecha o aviso do outro, nunca o próprio", () => {
  const fechados: string[] = [];
  const estrela = () => {
    fechados.push("estrela");
    largarAVez(estrela);
  };
  const marcar = () => {
    fechados.push("marcar");
    largarAVez(marcar);
  };
  tomarAVez(estrela);
  tomarAVez(estrela); // o "Desfazer" publica de novo o mesmo aviso: não fecha nada
  assert.deepEqual(fechados, []);
  tomarAVez(marcar); // "Marcar como lidas" depois da estrela: o da estrela fecha
  assert.deepEqual(fechados, ["estrela"]);
  tomarAVez(estrela); // e o contrário
  assert.deepEqual(fechados, ["estrela", "marcar"]);
  estrela(); // o relógio da estrela fecha o próprio aviso e devolve a vez
  tomarAVez(marcar); // ninguém à vista: nada a fechar
  assert.deepEqual(fechados, ["estrela", "marcar", "estrela"]);
  largarAVez(marcar);
});

test("largarAVez: quem já perdeu a vez não a tira de quem tem", () => {
  const fechados: string[] = [];
  const a = () => fechados.push("a");
  const b = () => fechados.push("b");
  tomarAVez(a);
  tomarAVez(b); // fecha a
  largarAVez(a); // a já não tinha a vez
  tomarAVez(a); // b ainda tinha: fecha b
  assert.deepEqual(fechados, ["a", "b"]);
  largarAVez(a);
});
