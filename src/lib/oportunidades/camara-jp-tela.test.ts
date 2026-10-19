import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  COLUNAS_CREDORES_JP,
  COLUNAS_EMENDAS_VEREADOR_JP,
  COLUNAS_EMPENHOS_JP,
  COLUNAS_ENTIDADE_JP,
  COLUNAS_FILA_JP,
  COLUNAS_SERIE_JP,
  COLUNAS_VEREADORES_JP,
  TABELA_CREDORES_JP,
  TABELA_EMENDAS_VEREADOR_JP,
  TABELA_EMPENHOS_JP,
  TABELA_ENTIDADE_JP,
  TABELA_FILA_JP,
  TABELA_SERIE_JP,
  TABELA_VEREADORES_JP,
  porcento,
  tituloCamaraJp,
  tituloEmendaJp,
  tituloVereadorJp,
  valoresDaFilaJp,
  valoresDoVereadorJp,
} from "./camara-jp-tela.ts";
import type { EmendaJp, VereadorJp } from "./emendas-jp.ts";

test("cada tabela: ids válidos e únicos, e toda coluna ordena (tela de administrador)", () => {
  const tabelas: [string, { id: string; ordenavel?: boolean }[]][] = [
    [TABELA_VEREADORES_JP, COLUNAS_VEREADORES_JP],
    [TABELA_FILA_JP, COLUNAS_FILA_JP],
    [TABELA_EMENDAS_VEREADOR_JP, COLUNAS_EMENDAS_VEREADOR_JP],
    [TABELA_EMPENHOS_JP, COLUNAS_EMPENHOS_JP],
    [TABELA_ENTIDADE_JP, COLUNAS_ENTIDADE_JP],
    [TABELA_CREDORES_JP, COLUNAS_CREDORES_JP],
    [TABELA_SERIE_JP, COLUNAS_SERIE_JP],
  ];
  assert.equal(new Set(tabelas.map(([t]) => t)).size, tabelas.length);
  for (const [t, colunas] of tabelas) {
    assert.match(t, /^[a-z0-9-]+$/, t);
    assert.equal(new Set(colunas.map((c) => c.id)).size, colunas.length, t);
    for (const c of colunas) {
      assert.match(c.id, /^[a-z0-9-]+$/, `${t}.${c.id}`);
      assert.notEqual(c.ordenavel, false, `${t}.${c.id}`);
    }
  }
});

test("os valores crus batem com as colunas", () => {
  const v: VereadorJp = {
    pessoa: "APELIDO", slug: "apelido", tipo: "vereador", anoMin: 2021, anoMax: 2026, emendas: 10, atual: 1000, empenhado: 800, pago: 500,
    exercicioEmendas: 3, exercicioAtual: 300, exercicioPago: 0, exercicioSemEmpenho: 2,
  };
  assert.deepEqual(Object.keys(valoresDoVereadorJp(v)).sort(), COLUNAS_VEREADORES_JP.map((c) => c.id).sort());
  assert.equal(valoresDoVereadorJp(v)["pct-pago"], 50);
  const e: EmendaJp = {
    chave: "2026-0171", ano: 2026, codigo: 171, origem: "painel", mesReferencia: null, pessoa: null, autorPublicado: "GRAFIA", objeto: null,
    cnpj: "08939944000130", unidades: ["FMS", "FUNJOPE"], original: null, atual: 10, empenhado: 0, liquidado: 0, pago: 0, etapa: "sem_empenho",
    remanejada: false, materia: null, primeiroEmpenho: null, empenhosTce: 0,
  };
  const f = valoresDaFilaJp(e);
  assert.deepEqual(Object.keys(f).sort(), COLUNAS_FILA_JP.map((c) => c.id).sort());
  assert.deepEqual([f.vereador, f.unidade, f.etapa, f.cnpj], ["GRAFIA", "FMS · FUNJOPE", "Sem empenho", "Sim"]);
});

test("títulos só com o que está no endereço", () => {
  assert.equal(tituloCamaraJp(), "Câmara de João Pessoa · Parlamentares · Mapa de Oportunidades · PONTE");
  assert.equal(tituloVereadorJp("carlao-pelo-bem"), "CARLAO PELO BEM · Câmara de João Pessoa · Parlamentares · Mapa de Oportunidades · PONTE");
  assert.equal(tituloEmendaJp(2026, 171), "Emenda 171/2026 · Câmara de João Pessoa · Parlamentares · Mapa de Oportunidades · PONTE");
  assert.equal(porcento(33.33), "33,3%");
  assert.equal(porcento(null), "—");
});

test("as telas da Câmara de João Pessoa: todas de administrador, e os blocos só do nível interno", () => {
  const raiz = path.resolve(import.meta.dirname, "..", "..", "app", "mapa");
  const paginas = ["parlamentares/camara-jp/page.tsx", "parlamentares/camara-jp/fila/page.tsx", "parlamentares/camara-jp/[vereador]/page.tsx", "parlamentares/camara-jp/emenda/[emenda]/page.tsx"];
  for (const p of paginas) {
    const fonte = fs.readFileSync(path.join(raiz, p), "utf-8");
    assert.match(fonte, /if \(!ehAdministrador\(visitante\.email\)\) redirect\("\/mapa"\);/, p);
    const leitura = fonte.search(/await ler(CamaraJp|EmendaJp)\(/);
    assert.ok(leitura > 0 && fonte.indexOf("ehAdministrador(") < leitura, `${p}: confere antes de ler`);
  }
  for (const [p, bloco] of [
    ["municipio/[ibge]/MunicipioConteudo.tsx", "EmendasDaCamaraNoMunicipio"],
    ["municipio/[ibge]/relatorio/RelatorioConteudo.tsx", "EmendasDaCamaraNoMunicipio"],
    ["entidade/[cnpj]/EntidadeConteudo.tsx", "EmendasDaCamaraNaEntidade"],
  ] as const) {
    const fonte = fs.readFileSync(path.join(raiz, p), "utf-8");
    assert.match(fonte, new RegExp(`PODE\\.interno\\(nivel\\) && camaraJp !== undefined && <${bloco} `), p);
  }
  // O nome de credor só sai nas telas de administrador desta pasta: o bloco do município não o lê.
  const bloco = fs.readFileSync(path.join(raiz, "parlamentares/camara-jp/EmendasDaCamaraJp.tsx"), "utf-8");
  assert.equal(/credor_nome/.test(bloco), false);
});

test("a sala da Ilha Tech: a Câmara de João Pessoa só com fatos públicos, sem ranking e sem entidade nomeada", () => {
  const pasta = path.resolve(import.meta.dirname, "..", "..", "app", "sala", "_salas", "ilha-tech");
  const conteudo = fs.readFileSync(path.join(pasta, "Conteudo.tsx"), "utf-8");
  const colunas = conteudo.slice(conteudo.indexOf("const COLUNAS_VEREADORES_MUNICIPAIS"), conteudo.indexOf("function linhasVereadoresMunicipais"));
  const valores = colunas.split("\n").filter((l) => /tipo: "numero"/.test(l));
  assert.equal(valores.length, 4);
  for (const l of valores) assert.match(l, /ordenavel: false/, l);
  const dados = fs.readFileSync(path.join(pasta, "dados-municipais.ts"), "utf-8");
  assert.equal(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/.test(dados), false, "nenhum CNPJ");
  assert.equal(/credor|cnpj/i.test(dados.replace(/\/\*[\s\S]*?\*\//g, "")), false, "nenhum credor nos dados");
});
