/**
 * Teste da tabela com filtro e ordem em cada coluna (onda 15, A, 13/10/2026): só a lógica pura de `tabela-filtro.ts`.
 * O componente (`TabelaFiltravel.tsx`) só liga estas funções ao endereço e à tela. Roda nos fusos UTC e
 * America/Sao_Paulo: nada aqui usa `Date`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAVE_ORDEM,
  ESTADO_VAZIO,
  aplicar,
  chaveDoEstado,
  csvDaTabela,
  dataValida,
  descreverFiltro,
  descreverOrdem,
  filtroAtivo,
  filtrosAtivos,
  formatarNumeroBr,
  gravarEstado,
  idValido,
  juntarCategorias,
  lerEstado,
  lerNumeroBr,
  nomeDoCsv,
  normalizarTexto,
  opcoesDaCategoria,
  proximaOrdem,
  separarCategorias,
  textoDoValor,
  type ColunaTabela,
  type EstadoTabela,
  type LinhaTabela,
  type ValorCelula,
} from "./tabela-filtro.ts";

const COLUNAS: ColunaTabela[] = [
  { id: "nome", titulo: "Nome", tipo: "texto" },
  { id: "codigo", titulo: "Código", tipo: "texto", textoNoCsv: true },
  { id: "tipo", titulo: "Tipo", tipo: "categoria" },
  { id: "valor", titulo: "Valor", tipo: "numero", alinhar: "direita" },
  { id: "data", titulo: "Data", tipo: "data" },
  { id: "link", titulo: "Ficha", tipo: "texto", semCsv: true, filtravel: false, ordenavel: false },
];

function linha(chave: string, v: Record<string, ValorCelula>): LinhaTabela {
  return { chave, valores: v, celulas: {} };
}

const LINHAS: LinhaTabela[] = [
  linha("a", { nome: "João da Silva", codigo: "0012", tipo: "Comissão", valor: 1500, data: "2024-03-07", link: "x" }),
  linha("b", { nome: "Maria Souza", codigo: "0034", tipo: "Bancada", valor: null, data: null, link: "x" }),
  linha("c", { nome: "ÁLVARO SÃO JOSÉ", codigo: "0056", tipo: "Individual", valor: 300, data: "2023-12-31", link: "x" }),
  linha("d", { nome: "Ana", codigo: "0078", tipo: "Comissão", valor: 1500, data: "2024-01-01", link: "x" }),
  linha("e", { nome: null, codigo: "0090", tipo: null, valor: 0, data: "2025-06-30T12:00:00Z", link: "x" }),
];

const chaves = (ls: LinhaTabela[]) => ls.map((l) => l.chave).join("");
const com = (filtros: EstadoTabela["filtros"], ordem: EstadoTabela["ordem"] = null): EstadoTabela => ({ filtros, ordem });

// ================================================================ peças

test("normalizarTexto tira acento, caixa e espaço sobrando", () => {
  assert.equal(normalizarTexto("  São  JOÃO da Conceição "), "sao joao da conceicao");
  assert.equal(normalizarTexto(""), "");
});

test("lerNumeroBr lê o número como se digita no Brasil", () => {
  assert.equal(lerNumeroBr("1.234,5"), 1234.5);
  assert.equal(lerNumeroBr("1234,5"), 1234.5);
  assert.equal(lerNumeroBr("1.234"), 1234);
  assert.equal(lerNumeroBr("1.234.567"), 1234567);
  assert.equal(lerNumeroBr("1.5"), 1.5);
  assert.equal(lerNumeroBr("1234.56"), 1234.56);
  assert.equal(lerNumeroBr(",5"), 0.5);
  assert.equal(lerNumeroBr("5,"), 5);
  assert.equal(lerNumeroBr("  42 "), 42);
  assert.equal(lerNumeroBr("-7,25"), -7.25);
  assert.equal(lerNumeroBr("R$ 350 mil"), 350000);
  assert.equal(lerNumeroBr("R$ 1,1 mi"), 1100000);
  assert.equal(lerNumeroBr("2 bi"), 2e9);
  assert.equal(lerNumeroBr("-R$ 5"), -5);
  assert.equal(lerNumeroBr("R$ -5"), -5);
  assert.equal(lerNumeroBr("0"), 0);
  assert.equal(lerNumeroBr("-0"), 0);
  for (const lixo of ["", " ", "abc", "1,2,3", "1.23.4", ".", ",", "1e3", "5 kg", "R$", "--5", "1..2"]) {
    assert.equal(lerNumeroBr(lixo), null, `lixo: ${JSON.stringify(lixo)}`);
  }
});

test("formatarNumeroBr escreve como a tela e volta igual pelo lerNumeroBr", () => {
  assert.equal(formatarNumeroBr(1234.5), "1.234,5");
  assert.equal(formatarNumeroBr(1100000), "1.100.000");
  for (const n of [0, 1, 1234.5, 1100000, -7.25, 0.125]) assert.equal(lerNumeroBr(formatarNumeroBr(n)), n);
});

test("dataValida confere o calendário sem Date", () => {
  assert.equal(dataValida("2024-02-29"), true);
  assert.equal(dataValida("2023-02-29"), false);
  assert.equal(dataValida("1900-02-29"), false);
  assert.equal(dataValida("2000-02-29"), true);
  assert.equal(dataValida("2024-04-31"), false);
  assert.equal(dataValida("2024-13-01"), false);
  assert.equal(dataValida("2024-00-10"), false);
  assert.equal(dataValida("2024-1-1"), false);
  assert.equal(dataValida("07/03/2024"), false);
});

test("categorias: vírgula separa, barra escapa, e a ida e volta preserva", () => {
  assert.deepEqual(separarCategorias("A,B , ,C"), ["A", "B", "C"]);
  assert.deepEqual(separarCategorias("Saúde\\, educação,Obras"), ["Saúde, educação", "Obras"]);
  assert.deepEqual(separarCategorias("a\\\\b"), ["a\\b"]);
  assert.deepEqual(separarCategorias("fim\\"), ["fim\\"]);
  const valores = ["Saúde, educação", "C:\\pasta", "Relator-geral", "x,y\\,z"];
  assert.deepEqual(separarCategorias(juntarCategorias(valores)), valores);
});

test("idValido: minúsculas, dígitos e hífen; 'o' é da ordem", () => {
  assert.equal(idValido("convenio-valido"), true);
  assert.equal(idValido("ano2"), true);
  assert.equal(idValido(CHAVE_ORDEM), false);
  assert.equal(idValido("Nome"), false);
  assert.equal(idValido("a.b"), false);
  assert.equal(idValido(""), false);
});

// ================================================================ filtros

test("texto: contém todas as palavras, sem acento e sem caixa; null fica de fora", () => {
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({ nome: { tipo: "texto", contem: "silva" } }))), "a");
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({ nome: { tipo: "texto", contem: "SILVA joão" } }))), "a");
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({ nome: { tipo: "texto", contem: "sao jose" } }))), "c");
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({ nome: { tipo: "texto", contem: "a" } }))), "abcd");
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({ codigo: { tipo: "texto", contem: "00" } }))), "abcde");
  // Texto em branco não filtra.
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({ nome: { tipo: "texto", contem: "   " } }))), "abcde");
});

test("número: limites inclusivos, um lado só, zero é valor e null fica de fora", () => {
  const f = (de: number | null, ate: number | null) => chaves(aplicar(COLUNAS, LINHAS, com({ valor: { tipo: "numero", de, ate } })));
  assert.equal(f(300, 1500), "acd");
  assert.equal(f(301, 1499), "");
  assert.equal(f(1500, null), "ad");
  assert.equal(f(null, 300), "ce");
  assert.equal(f(0, 0), "e");
  assert.equal(f(null, null), "abcde");
  // De maior que até não troca os lados: não sobra nada, e a tela mostra isso.
  assert.equal(f(1500, 300), "");
});

test("data: limites inclusivos, instante ISO conta pelo dia e null fica de fora", () => {
  const f = (de: string | null, ate: string | null) => chaves(aplicar(COLUNAS, LINHAS, com({ data: { tipo: "data", de, ate } })));
  assert.equal(f("2024-01-01", "2024-03-07"), "ad");
  assert.equal(f("2024-01-02", "2024-03-06"), "");
  assert.equal(f(null, "2023-12-31"), "c");
  assert.equal(f("2025-06-30", null), "e");
  // Data que não existe é como lado vazio.
  assert.equal(f("2024-02-30", null), "abcde");
});

test("categoria: qualquer uma das escolhidas, sem acento e sem caixa; null fica de fora", () => {
  const f = (valores: string[]) => chaves(aplicar(COLUNAS, LINHAS, com({ tipo: { tipo: "categoria", valores } })));
  assert.equal(f(["Comissão"]), "ad");
  assert.equal(f(["comissao", "BANCADA"]), "abd");
  assert.equal(f(["Inexistente"]), "");
  assert.equal(f([]), "abcde");
});

test("filtros somam (E); coluna inexistente, sem filtro ou de tipo trocado é ignorada", () => {
  assert.equal(
    chaves(aplicar(COLUNAS, LINHAS, com({ tipo: { tipo: "categoria", valores: ["Comissão"] }, nome: { tipo: "texto", contem: "ana" } }))),
    "d",
  );
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({ fantasma: { tipo: "texto", contem: "x" } }))), "abcde");
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({ link: { tipo: "texto", contem: "zzz" } }))), "abcde");
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({ valor: { tipo: "texto", contem: "zzz" } }))), "abcde");
});

test("aplicar não muda a lista recebida", () => {
  const copia = [...LINHAS];
  aplicar(COLUNAS, LINHAS, com({}, { coluna: "valor", sentido: "desc" }));
  assert.deepEqual(LINHAS, copia);
  assert.notEqual(aplicar(COLUNAS, LINHAS, ESTADO_VAZIO), LINHAS);
});

// ================================================================ ordem

test("ordem: null vai para o fim nos dois sentidos; empate fica na ordem de chegada", () => {
  // valor: a=1500, b=null, c=300, d=1500, e=0
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({}, { coluna: "valor", sentido: "asc" }))), "ecadb");
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({}, { coluna: "valor", sentido: "desc" }))), "adceb");
  // nome: Álvaro antes de Ana (o acento e a caixa não contam); null (e) no fim.
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({}, { coluna: "nome", sentido: "asc" }))), "cdabe");
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({}, { coluna: "nome", sentido: "desc" }))), "badce");
  // data: o instante ISO conta pelo dia.
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({}, { coluna: "data", sentido: "asc" }))), "cdaeb");
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({}, { coluna: "data", sentido: "desc" }))), "eadcb");
});

test("ordem estável: empate total mantém a ordem padrão que a tela mandou, nos dois sentidos", () => {
  const iguais = ["p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"].map((k) => linha(k, { tipo: "Comissão", valor: 7 }));
  assert.equal(chaves(aplicar(COLUNAS, iguais, com({}, { coluna: "valor", sentido: "asc" }))), "pqrstuvwxyz");
  assert.equal(chaves(aplicar(COLUNAS, iguais, com({}, { coluna: "valor", sentido: "desc" }))), "pqrstuvwxyz");
  assert.equal(chaves(aplicar(COLUNAS, iguais, com({}, { coluna: "tipo", sentido: "desc" }))), "pqrstuvwxyz");
});

test("ordem numérica no texto: 'Autor 9' antes de 'Autor 10'", () => {
  const ls = [linha("x", { nome: "Autor 10" }), linha("y", { nome: "Autor 9" })];
  assert.equal(chaves(aplicar(COLUNAS, ls, com({}, { coluna: "nome", sentido: "asc" }))), "yx");
});

test("ordenavel: false não ordena nem no aplicar", () => {
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({}, { coluna: "link", sentido: "desc" }))), "abcde");
  assert.equal(chaves(aplicar(COLUNAS, LINHAS, com({}, { coluna: "fantasma", sentido: "desc" }))), "abcde");
});

test("proximaOrdem: crescente → decrescente → padrão, e a padrão não vai ao endereço", () => {
  assert.deepEqual(proximaOrdem(null, "valor"), { coluna: "valor", sentido: "asc" });
  assert.deepEqual(proximaOrdem({ coluna: "valor", sentido: "asc" }, "valor"), { coluna: "valor", sentido: "desc" });
  assert.equal(proximaOrdem({ coluna: "valor", sentido: "desc" }, "valor"), null);
  assert.deepEqual(proximaOrdem({ coluna: "nome", sentido: "desc" }, "valor"), { coluna: "valor", sentido: "asc" });
  // Padrão nome crescente: a tela já está nele, o clique vai ao decrescente e o próximo volta ao padrão.
  const padrao = { coluna: "nome", sentido: "asc" } as const;
  assert.deepEqual(proximaOrdem(null, "nome", padrao), { coluna: "nome", sentido: "desc" });
  assert.equal(proximaOrdem({ coluna: "nome", sentido: "desc" }, "nome", padrao), null);
  // Padrão valor decrescente: o clique vai ao crescente e o próximo, que é o padrão, sai do endereço.
  const padraoDesc = { coluna: "valor", sentido: "desc" } as const;
  assert.deepEqual(proximaOrdem(null, "valor", padraoDesc), { coluna: "valor", sentido: "asc" });
  assert.equal(proximaOrdem({ coluna: "valor", sentido: "asc" }, "valor", padraoDesc), null);
});

// ================================================================ endereço

test("lerEstado lê cada tipo no formato documentado", () => {
  const p = new URLSearchParams(
    "t.parl.nome=silva&t.parl.tipo=Bancada,Comiss%C3%A3o&t.parl.valor=1000..5000.5&t.parl.data=2024-01-01..&t.parl.o=valor.desc",
  );
  assert.deepEqual(lerEstado("parl", COLUNAS, p), {
    filtros: {
      nome: { tipo: "texto", contem: "silva" },
      tipo: { tipo: "categoria", valores: ["Bancada", "Comissão"] },
      valor: { tipo: "numero", de: 1000, ate: 5000.5 },
      data: { tipo: "data", de: "2024-01-01", ate: null },
    },
    ordem: { coluna: "valor", sentido: "desc" },
  });
});

test("lerEstado: um lado só, valor exato, forma brasileira à mão e categoria repetida", () => {
  const p = new URLSearchParams();
  p.append("t.x.valor", "..300");
  p.append("t.x.data", "2024-03-07");
  p.append("t.x.tipo", "Bancada");
  p.append("t.x.tipo", "Comissão,Bancada");
  assert.deepEqual(lerEstado("x", COLUNAS, p).filtros, {
    valor: { tipo: "numero", de: null, ate: 300 },
    data: { tipo: "data", de: "2024-03-07", ate: "2024-03-07" },
    tipo: { tipo: "categoria", valores: ["Bancada", "Comissão"] },
  });
  assert.deepEqual(lerEstado("x", COLUNAS, new URLSearchParams({ "t.x.valor": "1.234,5..1,2 mi" })).filtros.valor, {
    tipo: "numero",
    de: 1234.5,
    ate: 1200000,
  });
  // No endereço, ponto é decimal: "1.234" é um vírgula dois três quatro.
  assert.deepEqual(lerEstado("x", COLUNAS, new URLSearchParams({ "t.x.valor": "1.234.." })).filtros.valor, {
    tipo: "numero",
    de: 1.234,
    ate: null,
  });
});

test("lerEstado ignora o lixo do endereço, nunca erro", () => {
  const lixo = new URLSearchParams(
    [
      "t.parl.fantasma=1", // coluna que não existe
      "t.parl.link=zzz", // coluna sem filtro
      "t.parl.valor=abc..", // número ilegível
      "t.parl.data=2024-02-30..2024-03-01", // data que não existe
      "t.parl.codigo=%20%20", // texto em branco
      "t.parl.tipo=,,", // categoria vazia
      "t.parl.o=valor.cima", // sentido desconhecido
      "t.parl..x=1",
      "t.parl=1",
      "t..o=valor.asc",
    ].join("&"),
  );
  assert.deepEqual(lerEstado("parl", COLUNAS, lixo), { filtros: {}, ordem: null });
  for (const o of ["", "valor", ".asc", "valor.", "fantasma.asc", "link.asc", "valor.asc.desc", "VALOR.DESC"]) {
    const ordem = lerEstado("parl", COLUNAS, new URLSearchParams({ "t.parl.o": o })).ordem;
    if (o === "VALOR.DESC") assert.deepEqual(ordem, { coluna: "valor", sentido: "desc" });
    else assert.equal(ordem, null, `ordem: ${JSON.stringify(o)}`);
  }
  for (const v of ["1..2..3", "...5", "1...5", "..", "e5..", "Infinity..", "NaN", "1e999.."]) {
    assert.equal(lerEstado("parl", COLUNAS, new URLSearchParams({ "t.parl.valor": v })).filtros.valor, undefined, `número: ${v}`);
  }
  // Texto gigante é cortado; categoria com centenas de valores também.
  const grande = lerEstado("parl", COLUNAS, new URLSearchParams({ "t.parl.nome": "x".repeat(5000), "t.parl.tipo": Array.from({ length: 500 }, (_, i) => `v${i}`).join(",") }));
  assert.equal((grande.filtros.nome as { contem: string }).contem.length, 200);
  assert.equal((grande.filtros.tipo as { valores: string[] }).valores.length, 50);
});

test("ordenavel: false não aceita ordem nem vinda pelo endereço", () => {
  const publicas: ColunaTabela[] = [
    { id: "nome", titulo: "Município", tipo: "texto" },
    { id: "valor", titulo: "Valor", tipo: "numero", ordenavel: false },
  ];
  assert.equal(lerEstado("pub", publicas, new URLSearchParams("t.pub.o=valor.desc")).ordem, null);
  assert.deepEqual(lerEstado("pub", publicas, new URLSearchParams("t.pub.o=nome.desc")).ordem, { coluna: "nome", sentido: "desc" });
  // O filtro da coluna de valor continua valendo.
  assert.deepEqual(lerEstado("pub", publicas, new URLSearchParams("t.pub.valor=10..")).filtros.valor, { tipo: "numero", de: 10, ate: null });
  const ls = [linha("a", { nome: "B", valor: 1 }), linha("b", { nome: "A", valor: 9 })];
  assert.equal(chaves(aplicar(publicas, ls, com({}, { coluna: "valor", sentido: "desc" }))), "ab");
});

test("ida e volta pelo endereço, com outras tabelas e outros parâmetros na mesma URL", () => {
  const estado: EstadoTabela = {
    filtros: {
      nome: { tipo: "texto", contem: "são joão" },
      tipo: { tipo: "categoria", valores: ["Comissão", "Saúde, educação", "a\\b"] },
      valor: { tipo: "numero", de: -2.5, ate: 1e21 },
      data: { tipo: "data", de: null, ate: "2024-12-31" },
    },
    ordem: { coluna: "data", sentido: "asc" },
  };
  const antes = new URLSearchParams("aba=destinacao&t.outra.nome=x&t.outra.o=nome.desc&t.parl.nome=velho&t.parl2.nome=vizinha&q=a%26b");
  const depois = gravarEstado("parl", estado, antes);
  assert.deepEqual(lerEstado("parl", COLUNAS, new URLSearchParams(depois.toString())), estado);
  // As outras tabelas, a tabela de prefixo parecido e os outros parâmetros ficam intactos e na mesma ordem.
  assert.equal(depois.get("aba"), "destinacao");
  assert.equal(depois.get("q"), "a&b");
  assert.equal(depois.get("t.outra.nome"), "x");
  assert.equal(depois.get("t.outra.o"), "nome.desc");
  assert.equal(depois.get("t.parl2.nome"), "vizinha");
  assert.deepEqual([...depois.keys()].slice(0, 5), ["aba", "t.outra.nome", "t.outra.o", "t.parl2.nome", "q"]);
  assert.equal(depois.getAll("t.parl.nome").length, 1);
  // A entrada não muda (o Next entrega parâmetros que não aceitam mudança).
  assert.equal(antes.get("t.parl.nome"), "velho");
  // Gravar o estado vazio limpa só esta tabela.
  const limpo = gravarEstado("parl", ESTADO_VAZIO, depois);
  assert.equal([...limpo.keys()].some((k) => k.startsWith("t.parl.")), false);
  assert.equal(limpo.get("t.outra.nome"), "x");
  // E a outra tabela lê o dela sem ver o desta.
  assert.deepEqual(lerEstado("outra", COLUNAS, depois), { filtros: { nome: { tipo: "texto", contem: "x" } }, ordem: { coluna: "nome", sentido: "desc" } });
});

test("gravarEstado escreve o formato documentado e não escreve filtro vazio", () => {
  const p = gravarEstado(
    "parl",
    {
      filtros: {
        nome: { tipo: "texto", contem: "  silva " },
        codigo: { tipo: "texto", contem: "   " },
        valor: { tipo: "numero", de: 1000, ate: null },
        data: { tipo: "data", de: "2024-01-01", ate: "2024-12-31" },
        tipo: { tipo: "categoria", valores: [] },
        "Mau.Id": { tipo: "texto", contem: "x" },
        o: { tipo: "texto", contem: "x" },
      },
      ordem: { coluna: "valor", sentido: "desc" },
    },
    new URLSearchParams(),
  );
  assert.equal(p.toString(), "t.parl.nome=silva&t.parl.valor=1000..&t.parl.data=2024-01-01..2024-12-31&t.parl.o=valor.desc");
  assert.equal(chaveDoEstado("parl", ESTADO_VAZIO), "");
});

test("filtrosAtivos conta só o que filtra", () => {
  assert.equal(filtrosAtivos(ESTADO_VAZIO), 0);
  assert.equal(
    filtrosAtivos(
      com({
        nome: { tipo: "texto", contem: "a" },
        codigo: { tipo: "texto", contem: " " },
        valor: { tipo: "numero", de: null, ate: null },
        data: { tipo: "data", de: "2024-01-01", ate: null },
        tipo: { tipo: "categoria", valores: [] },
      }, { coluna: "nome", sentido: "asc" }),
    ),
    2,
  );
  assert.equal(filtroAtivo({ tipo: "numero", de: 0, ate: null }), true);
});

// ================================================================ opções, CSV e textos

test("opcoesDaCategoria: sem repetição, sem vazio, em ordem alfabética", () => {
  assert.deepEqual(opcoesDaCategoria("tipo", LINHAS), ["Bancada", "Comissão", "Individual"]);
  assert.deepEqual(opcoesDaCategoria("fantasma", LINHAS), []);
});

test("csvDaTabela: cabeçalho, só as linhas filtradas, colunas fora do CSV e proteção de fórmula", () => {
  const filtradas = aplicar(COLUNAS, LINHAS, com({ tipo: { tipo: "categoria", valores: ["Comissão"] } }, { coluna: "valor", sentido: "desc" }));
  const csv = csvDaTabela(COLUNAS, filtradas);
  assert.ok(csv.startsWith("\uFEFF"), "BOM");
  const linhas = csv.slice(1).split("\r\n");
  assert.equal(linhas[0], "Nome;Código;Tipo;Valor;Data");
  assert.equal(linhas[1], 'João da Silva;"=""0012""";Comissão;1500;07/03/2024');
  assert.equal(linhas[2], 'Ana;"=""0078""";Comissão;1500;01/01/2024');
  assert.equal(linhas.length, 4); // cabeçalho, 2 linhas e o fim de linha final
  assert.equal(linhas[3], "");

  const perigosas = [
    linha("p", { nome: "=HYPERLINK(\"http://x\")", codigo: 1277, tipo: "+1", valor: -3.456, data: "@SOMA" }),
    linha("q", { nome: "a;b", codigo: "12/2024", tipo: "-x", valor: null, data: null }),
  ];
  const [, p1, p2] = csvDaTabela(COLUNAS, perigosas).slice(1).split("\r\n");
  assert.equal(p1, '" =HYPERLINK(""http://x"")";"=""1277""";" +1";-3,46;" @SOMA"');
  assert.equal(p2, '"a;b";"=""12/2024""";" -x";;');
});

test("descreverOrdem e descreverFiltro dizem em palavras", () => {
  assert.equal(descreverOrdem(COLUNAS[3], "desc"), "Valor, do maior para o menor");
  assert.equal(descreverOrdem(COLUNAS[0], "asc"), "Nome, de A a Z");
  assert.equal(descreverOrdem(COLUNAS[4], "asc"), "Data, da mais antiga para a mais recente");
  assert.equal(descreverFiltro(COLUNAS[0], { tipo: "texto", contem: " silva " }), "Nome contém “silva”");
  assert.equal(descreverFiltro(COLUNAS[3], { tipo: "numero", de: 1000, ate: 1234.5 }), "Valor de 1.000 a 1.234,5");
  assert.equal(descreverFiltro(COLUNAS[3], { tipo: "numero", de: 1000, ate: null }), "Valor a partir de 1.000");
  assert.equal(descreverFiltro(COLUNAS[3], { tipo: "numero", de: null, ate: 5 }), "Valor até 5");
  assert.equal(descreverFiltro(COLUNAS[3], { tipo: "numero", de: 5, ate: 5 }), "Valor igual a 5");
  assert.equal(descreverFiltro(COLUNAS[4], { tipo: "data", de: "2024-01-01", ate: null }), "Data a partir de 01/01/2024");
  assert.equal(descreverFiltro(COLUNAS[2], { tipo: "categoria", valores: ["Bancada", "Comissão"] }), "Tipo: Bancada ou Comissão");
});

test("textoDoValor: o vazio é travessão, número em pt-BR e data DD/MM/AAAA", () => {
  assert.equal(textoDoValor(COLUNAS[3], null), "—");
  assert.equal(textoDoValor(COLUNAS[3], undefined), "—");
  assert.equal(textoDoValor(COLUNAS[0], ""), "—");
  assert.equal(textoDoValor(COLUNAS[3], 1234.567), "1.234,57");
  assert.equal(textoDoValor(COLUNAS[1], 1277), "1277");
  assert.equal(textoDoValor(COLUNAS[4], "2024-03-07"), "07/03/2024");
  assert.equal(textoDoValor(COLUNAS[4], "2024-03-07T23:30:00Z"), "07/03/2024");
  assert.equal(textoDoValor(COLUNAS[0], "Ana"), "Ana");
});

test("nomeDoCsv: sempre .csv, sem caractere proibido", () => {
  assert.equal(nomeDoCsv("parlamentares-pb"), "parlamentares-pb.csv");
  assert.equal(nomeDoCsv("parlamentares-pb.CSV"), "parlamentares-pb.csv");
  assert.equal(nomeDoCsv("a/b:c"), "a-b-c.csv");
  assert.equal(nomeDoCsv("   "), "tabela.csv");
});

test("coluna oculta (integração da onda 15): filtra, ordena e vai ao CSV, mesmo sem ser desenhada", () => {
  const colunas: ColunaTabela[] = [
    { id: "nome", titulo: "Proponente e convênio", tipo: "texto" },
    { id: "uf", titulo: "UF", tipo: "categoria", oculta: true },
  ];
  const linhas: LinhaTabela[] = [
    { chave: "1", valores: { nome: "Patos · 912345", uf: "PB" }, celulas: {} },
    { chave: "2", valores: { nome: "Natal · 812345", uf: "RN" }, celulas: {} },
  ];
  const so = aplicar(colunas, linhas, { filtros: { uf: { tipo: "categoria", valores: ["PB"] } }, ordem: null });
  assert.deepEqual(so.map((l) => l.chave), ["1"]);
  const csv = csvDaTabela(colunas, so);
  assert.ok(csv.includes("UF"), "a coluna oculta entra no CSV");
  assert.ok(csv.includes("PB"));
  const ordem = aplicar(colunas, linhas, { filtros: {}, ordem: { coluna: "uf", sentido: "desc" } });
  assert.deepEqual(ordem.map((l) => l.chave), ["2", "1"]);
});
