import assert from "node:assert/strict";
import { test } from "node:test";
import { ABAS_BRASIL, abaDoBrasil } from "./pagina-brasil.ts";
import { ABAS_UF, NOME_UF, abaDaUf } from "./pagina-uf.ts";
import {
  SUFIXO_DO_TITULO,
  tituloBrasil,
  tituloDaPagina,
  tituloInstrumento,
  tituloProposta,
  tituloUf,
} from "./titulo-pagina.ts";

// ------------------------------------------------------------------ N01: o título com o nome e a aba

test("tituloDaPagina junta as partes que existem e termina no sufixo do Mapa", () => {
  assert.equal(tituloDaPagina("Patos (PB)", "Resumo"), `Patos (PB) · Resumo · ${SUFIXO_DO_TITULO}`);
  assert.equal(tituloDaPagina("Brasil", null, undefined, "  "), `Brasil · ${SUFIXO_DO_TITULO}`);
  assert.equal(tituloDaPagina(), SUFIXO_DO_TITULO);
});

test("tituloUf: o nome da UF com a sigla e o nome da aba", () => {
  assert.equal(tituloUf("PB", "dinheiro"), "Paraíba (PB) · Dinheiro federal · Mapa de Oportunidades · PONTE");
  assert.equal(tituloUf("SP", "municipios"), "São Paulo (SP) · Municípios · Mapa de Oportunidades · PONTE");
  assert.equal(tituloUf("AC", null), "Acre (AC) · Mapa de Oportunidades · PONTE");
});

test("tituloUf: as 27 UFs e todas as abas dão títulos diferentes", () => {
  const titulos = new Set<string>();
  for (const sigla of Object.keys(NOME_UF)) for (const a of ABAS_UF) titulos.add(tituloUf(sigla, a.id));
  assert.equal(titulos.size, 27 * ABAS_UF.length);
});

test("tituloUf: sigla que não existe não vai para o título (genérico, sem ecoar o endereço)", () => {
  assert.equal(tituloUf(null, "resumo"), `Estado · ${SUFIXO_DO_TITULO}`);
  assert.equal(tituloUf("XX", "resumo"), `Estado · ${SUFIXO_DO_TITULO}`);
  assert.equal(tituloUf("constructor", "resumo"), `Estado · ${SUFIXO_DO_TITULO}`);
});

test("tituloUf: a aba de cadastro pedida pelo público cai no Resumo, como a página (nada além do que ela mostra)", () => {
  assert.equal(tituloUf("PB", abaDaUf("tempos", 0)), "Paraíba (PB) · Resumo · Mapa de Oportunidades · PONTE");
  assert.equal(tituloUf("PB", abaDaUf("relatorio", 0)), "Paraíba (PB) · Resumo · Mapa de Oportunidades · PONTE");
  assert.equal(tituloUf("PB", abaDaUf("tempos", 1)), "Paraíba (PB) · Tempos e funil · Mapa de Oportunidades · PONTE");
});

test("tituloBrasil: a aba que a página abre para o nível", () => {
  assert.equal(tituloBrasil("estados"), "Brasil · As 27 UFs · Mapa de Oportunidades · PONTE");
  assert.equal(tituloBrasil(abaDoBrasil("tempos", 0)), "Brasil · Resumo · Mapa de Oportunidades · PONTE");
  assert.equal(tituloBrasil(abaDoBrasil(undefined, 1)), "Brasil · Resumo · Mapa de Oportunidades · PONTE");
  assert.equal(new Set(ABAS_BRASIL.map((a) => tituloBrasil(a.id))).size, ABAS_BRASIL.length);
});

test("tituloInstrumento: o número quando ele é número de convênio; senão o genérico", () => {
  assert.equal(tituloInstrumento("912345"), "Convênio nº 912345 · Mapa de Oportunidades · PONTE");
  assert.equal(tituloInstrumento("7AACFT"), "Convênio nº 7AACFT · Mapa de Oportunidades · PONTE");
  assert.notEqual(tituloInstrumento("912345"), tituloInstrumento("912346"));
  assert.equal(tituloInstrumento(null), `Convênio · ${SUFIXO_DO_TITULO}`);
  assert.equal(tituloInstrumento("<script>"), `Convênio · ${SUFIXO_DO_TITULO}`);
  assert.equal(tituloInstrumento("1".repeat(21)), `Convênio · ${SUFIXO_DO_TITULO}`);
});

test("tituloProposta: o id do SICONV, sem 'nº' (o número da proposta é outro), só com dígitos", () => {
  assert.equal(tituloProposta("1234567"), "Proposta 1234567 · Mapa de Oportunidades · PONTE");
  assert.equal(tituloProposta("12a"), `Proposta · ${SUFIXO_DO_TITULO}`);
  assert.equal(tituloProposta(undefined), `Proposta · ${SUFIXO_DO_TITULO}`);
});
