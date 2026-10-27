/** Primeira infância na PB (P2, 22/10/2026). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DIAS_PARADO,
  classePix,
  colunasPI,
  ehCreche,
  estadoTermo,
  ordenarObras,
  resumoMunicipio,
  temCarimbado,
  totais,
  valoresPI,
  type MunicipioPI,
  type ObraCreche,
  type TermoCreche,
} from "./primeira-infancia.ts";

const termo = (x: Partial<TermoCreche>): TermoCreche => ({
  nr: "957750", ibge: "2516706", municipio: "TEIXEIRA", programa: "Novo PAC - FORMALIZAÇÃO - Creches e Escolas de Educação Infantil",
  situacao: "Em execução", repasse: 5_183_628.71, desembolsado: 777_544.31, saldo: 855_705.76, assinatura: "2024-05-22",
  vigencia: "2028-05-22", fisico: 0, dias: 308, nuncaPagou: true, licitacao: null, ...x,
});

const municipio = (x: Partial<MunicipioPI>): MunicipioPI => ({
  ibge: "2516706", nome: "Teixeira", termos: [], pix: [], obras: [], contexto: { cfSaldo: null, cfRepasse12: null, siope: null, saude: null },
  creche03: null, ...x,
});

test("creche pelo programa ou pelo objeto; 'trabalho infantil' e 'mortalidade infantil' não contam", () => {
  assert.ok(ehCreche("Novo PAC - Creches e Pré-Escolas de Educação Infantil", null));
  assert.ok(ehCreche("Programa SIMEC/PAR4", "Construção de unidade de educação infantil - Proinfância"));
  assert.ok(!ehCreche("PSE MC ERRADICAÇÃO DO TRABALHO INFANTIL", null));
  assert.ok(!ehCreche("Rede Cegonha", "redução da mortalidade infantil"));
});

test("o estado do termo: PAR4 à parte; sem desembolso, a liberar; sem pagamento, parado só a partir de 90 dias", () => {
  assert.equal(estadoTermo(termo({})), "parado");
  assert.equal(estadoTermo(termo({ dias: DIAS_PARADO - 1 })), "recente");
  assert.equal(estadoTermo(termo({ nuncaPagou: false })), "pagando");
  assert.equal(estadoTermo(termo({ desembolsado: null, saldo: 0 })), "a_liberar");
  assert.equal(estadoTermo(termo({ programa: "Programa SIMEC/PAR4", desembolsado: null })), "par");
});

test("a classe do Pix é a mesma do job (pix_fundo/laudo.py) e a coluna do job manda quando vem", () => {
  // Os mesmos casos de `test_classe_primeira_infancia_do_objeto`, no Python.
  assert.equal(classePix("Construção de uma creche tipo II – Pró infância"), "exclusivo");
  assert.equal(classePix("Aquisição de Brinquedos para creches e escolas com turmas da educação infantil"), "exclusivo");
  assert.equal(classePix("Construção de Muro da Creche"), "exclusivo");
  assert.equal(classePix("Construção de creche. - construção do SAMU - centro de fisioterapia"), "misto");
  assert.equal(classePix("Material escolar para o ensino infantil e fundamental"), "misto");
  assert.equal(classePix("Instalação de energia fotovoltaica em prédios públicos, inclusive creches"), "misto");
  assert.equal(classePix("Pavimentação em paralelepípedo"), null);
  assert.equal(classePix(null), null);
  assert.equal(classePix("Ampliação da escola e da CEI Pedro"), "exclusivo");
  assert.equal(classePix("Pavimentação", "exclusivo"), "exclusivo", "a coluna do laudo, quando preenchida, vale");
  // As duas regras andam juntas: as palavras do Python estão aqui.
  const py = fs.readFileSync(path.resolve(import.meta.dirname, "..", "..", "..", "..", "pix_fundo", "laudo.py"), "utf-8");
  for (const palavra of ["fotovolt", "socioassistencial", "fisioterap", "fundamental", "pro-?infancia"]) assert.ok(py.includes(palavra), palavra);
});

test("o resumo do município: parado, longo, a liberar, Pix só exclusivo, meses do Criança Feliz e a estimativa do FUNDEB", () => {
  const m = municipio({
    termos: [
      termo({}),
      termo({ nr: "1", dias: 100, saldo: 100 }),
      termo({ nr: "2", desembolsado: null, saldo: 0, repasse: 3_000_000 }),
      termo({ nr: "3", programa: "Programa SIMEC/PAR4", desembolsado: null, saldo: 50 }),
    ],
    pix: [
      { id: 1, codigo: "a", ibge: "2516706", ano: 2025, pago: 1, saldo: 10, dataSaldo: null, objeto: "creche", classe: "exclusivo" },
      { id: 2, codigo: "b", ibge: "2516706", ano: 2025, pago: 1, saldo: 99, dataSaldo: null, objeto: "creche e UBS", classe: "misto" },
    ],
    contexto: { cfSaldo: 12_000, cfRepasse12: 144_000, siope: { "7.3": 1_000_000, "2.1": 30, "1.4": 12, "166": 5 }, saude: { custeio: 7, emenda: 3 } },
  });
  const r = resumoMunicipio(m);
  assert.deepEqual(
    [r.parado, r.paradoLongo, r.nParado, r.aLiberar, r.parSaldo, r.pixSaldo, r.cfMeses, r.fundebEiEstimado, r.fundebAcimaDoLimite, r.saude],
    [855_805.76, 855_705.76, 2, 3_000_000, 50, 10, 1, 300_000, true, 10],
  );
  const t = totais([m, municipio({ ibge: "2510808", nome: "Patos" })]);
  assert.equal(t.municipios, 2);
  assert.deepEqual(t.acimaDoLimite, ["Teixeira"]);
  assert.ok(temCarimbado(m) && !temCarimbado(municipio({})));
});

test("a lista: cada coluna tem o valor cru; fora da casa, as colunas de valor não ordenam (sem ranking)", () => {
  const v = valoresPI(municipio({ termos: [termo({})] }));
  for (const adm of [true, false]) {
    const colunas = colunasPI(adm);
    assert.equal(new Set(colunas.map((c) => c.id)).size, colunas.length);
    for (const c of colunas) {
      assert.match(c.id, /^[a-z0-9-]+$/);
      assert.ok(c.id in v, c.id);
    }
  }
  const fora = colunasPI(false);
  assert.ok(fora.filter((c) => c.tipo === "numero" && c.id !== "creche-03").every((c) => c.ordenavel === false));
  assert.ok(colunasPI(true).every((c) => c.ordenavel !== false));
  assert.equal(v.parado, 855_705.76);
  assert.equal(v["a-liberar"], null, "zero vira vazio: a célula mostra '—'");
});

const obra = (x: Partial<ObraCreche>): ObraCreche => ({
  id: "87529.25-60", ibge: "2507507", origem: "nome", nome: "Gramame - João Pessoa - PB", situacao: "Paralisada", sistema: "SIMEC-FNDE",
  pct: 16.17, inicio: "2023-12-19", fimPrevista: "2025-12-27", dataSituacao: "2026-02-02", justificativa: "Paralisada", ...x,
});

test("P0.4: as obras do Obrasgov contam paralisadas e em execução, entram na lista e põem o município na fila", () => {
  const m = municipio({ obras: [obra({}), obra({ id: "2.25-1", situacao: "Em execução" }), obra({ id: "3.25-1", situacao: "Concluída" })] });
  const r = resumoMunicipio(m);
  assert.deepEqual([r.obrasParalisadas, r.obrasEmExecucao], [1, 1]);
  assert.equal(valoresPI(m)["obras-paralisadas"], 1);
  assert.equal(valoresPI(municipio({}))["obras-paralisadas"], null);
  assert.ok(temCarimbado(municipio({ obras: [obra({})] })), "obra paralisada põe o município na lista");
  assert.ok(!temCarimbado(municipio({ obras: [obra({ situacao: "Concluída" })] })));
  assert.equal(totais([m, m]).obrasParalisadas, 2);
  assert.deepEqual(
    ordenarObras([obra({ id: "a", situacao: "Concluída", nome: "A" }), obra({ id: "b", situacao: "Em execução" }), obra({ id: "c" })]).map((o) => o.id),
    ["c", "b", "a"],
  );
});

test("a página: cadastrado e acima; a aba do município também", () => {
  const raiz = path.resolve(import.meta.dirname, "..", "..", "app", "mapa");
  const pagina = fs.readFileSync(path.join(raiz, "primeira-infancia", "page.tsx"), "utf-8");
  assert.ok(pagina.indexOf("if (nivel < 1) redirect") < pagina.indexOf("await lerPrimeiraInfancia"), "confere o nível antes de ler");
  const mun = fs.readFileSync(path.join(raiz, "municipio", "[ibge]", "page.tsx"), "utf-8");
  assert.match(mun, /aba === "primeira-infancia" \? await lerPrimeiraInfancia\(ibge\)/);
});

test("P2b: a porta de entrada na página da PB (do cadastro em diante) e o ponto da fila no relatório", () => {
  const raiz = path.resolve(import.meta.dirname, "..", "..", "app", "mapa");
  const uf = fs.readFileSync(path.join(raiz, "uf", "[sigla]", "UfConteudo.tsx"), "utf-8");
  const cadastro = uf.indexOf("PODE.cadastro(nivel) && (");
  const link = uf.indexOf('href="/mapa/primeira-infancia"');
  assert.ok(cadastro > 0 && link > cadastro, "o botão fica dentro do bloco do cadastro");
  const rel = fs.readFileSync(path.join(import.meta.dirname, "relatorio-municipio.ts"), "utf-8");
  assert.match(rel, /ehCreche\(i\.programa, i\.objeto\)/);
});
