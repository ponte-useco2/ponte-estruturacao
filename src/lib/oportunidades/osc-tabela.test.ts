/** As OSC do município como tabela com filtro (onda 15, fase 3, F3.3, 22/10/2026). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { listaDoMunicipio, type OscNaLista } from "./osc.ts";
import { COLUNAS_OSC_MUNICIPIO, OSC_NA_TELA, valoresDaOsc } from "./osc-tabela.ts";
import { aplicar, lerEstado } from "./tabela-filtro.ts";

function osc(cnpj: string, nome: string, x: Partial<OscNaLista> = {}): OscNaLista {
  return {
    cnpj, cnpj_raiz: cnpj.slice(0, 8), razao_social: nome, nome_fantasia: null, natureza_juridica: "3999", matriz: true, areas: ["saude"],
    dt_fundacao: "1998-05-02", municipio: "Patos", ...x,
  } as OscNaLista;
}

test("a lista inteira (sem página) e os valores de cada coluna; a contagem de instrumentos não ordena", () => {
  const ativas = Array.from({ length: 250 }, (_, k) => osc(`${String(10_000_000 + k)}000199`, `ASSOCIACAO ${k}`));
  const lista = listaDoMunicipio(ativas, new Map([["10000005000199", 3]]), { area: null, q: "", pagina: 1 }, true);
  assert.equal(lista.grupos.length, 250, "tudo, para a tabela filtrar e cortar depois");
  assert.equal(lista.grupos[0].principal.cnpj, "10000005000199", "quem tem instrumento vem primeiro");
  assert.equal(listaDoMunicipio(ativas, new Map(), { area: null, q: "", pagina: 1 }).grupos.length, 100, "sem `tudo`, a página de antes");
  const v = valoresDaOsc(lista.grupos[0]);
  for (const c of COLUNAS_OSC_MUNICIPIO) {
    assert.ok(c.id in v, c.id);
    assert.match(c.id, /^[a-z0-9-]+$/);
  }
  assert.deepEqual([v.natureza, v.area, v.fundacao, v.instrumentos], ["Associação privada", "Saúde", 1998, 3]);
  assert.equal(COLUNAS_OSC_MUNICIPIO.find((c) => c.id === "instrumentos")?.ordenavel, false);
  assert.equal(OSC_NA_TELA, 100);
  // O filtro do endereço, em memória: o mesmo da tabela no navegador.
  const linhas = lista.grupos.map((g) => ({ chave: g.principal.cnpj, valores: valoresDaOsc(g), celulas: {} }));
  const estado = lerEstado("osc-lista", COLUNAS_OSC_MUNICIPIO, new URLSearchParams("t.osc-lista.organizacao=associacao%2012"));
  const achadas = aplicar(COLUNAS_OSC_MUNICIPIO, linhas, estado).map((l) => String(l.valores.organizacao));
  assert.equal(achadas.length, 13, "12, 112, 120 a 129 e 212: o texto é 'contém'");
  assert.ok(achadas.every((x) => x.includes("12")));
});

test("a página das OSC usa a tabela no modo servidor, e o CSV confere o cadastro aprovado antes de ler", () => {
  const pasta = path.resolve(import.meta.dirname, "..", "..", "app", "mapa", "municipio", "[ibge]", "organizacoes");
  const tela = fs.readFileSync(path.join(pasta, "OrganizacoesConteudo.tsx"), "utf-8");
  assert.match(tela, /<TabelaFiltravel\b[\s\S]*servidor=\{/);
  assert.equal(/Página \{n\(atual\)\}/.test(tela), false, "a paginação antiga saiu");
  const rota = fs.readFileSync(path.join(pasta, "exportar", "route.ts"), "utf-8");
  assert.ok(rota.indexOf('visitante.status !== "aprovado"') < rota.indexOf("lerOscDoMunicipio(ibge)"));
});
