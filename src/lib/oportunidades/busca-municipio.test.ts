import { test } from "node:test";
import assert from "node:assert/strict";
import { parametrosBusca } from "./busca.ts";
import {
  CANDIDATOS_PB,
  LIMITE_MUNICIPIOS,
  casarMunicipios,
  chaveMunicipio,
  grauDoMunicipio,
  municipiosDaBusca,
  nomeDeMunicipio,
  ondeProcurarMunicipio,
  pareceMunicipio,
  regexMunicipio,
  saidasBuscaVazia,
  textoBuscaVazia,
  tituloBuscaVazia,
} from "./busca-municipio.ts";
import { MUNICIPIOS_PB } from "./municipios-pb.ts";
import { urlUf } from "./pagina-uf.ts";

test("B12: a lista da PB tem os 223 municípios, códigos da PB sem repetição", () => {
  assert.equal(MUNICIPIOS_PB.length, 223);
  assert.ok(MUNICIPIOS_PB.every(([ibge, nome]) => /^25\d{5}$/.test(ibge) && nome.trim() === nome && nome.length > 2));
  assert.equal(new Set(MUNICIPIOS_PB.map(([ibge]) => ibge)).size, 223);
  assert.deepEqual(
    MUNICIPIOS_PB.find(([ibge]) => ibge === "2516201"),
    ["2516201", "Sousa"],
  );
});

test("B12: a chave de comparar tira acento, caixa, hífen e apóstrofo; z vale s, y vale i, letra dobrada conta uma", () => {
  assert.equal(chaveMunicipio("São José de Piranhas"), "saojosedepiranhas");
  assert.equal(chaveMunicipio("SÃO JOSÉ DE PIRANHAS"), chaveMunicipio("sao jose de piranhas"));
  assert.equal(chaveMunicipio("Souza"), chaveMunicipio("Sousa"));
  assert.equal(chaveMunicipio("Olho d'Água"), "olhodagua");
  assert.equal(chaveMunicipio("OLHO-D'ÁGUA DO BORGES"), chaveMunicipio("olho dagua do borges"));
  assert.equal(chaveMunicipio("Igaracy"), "igaraci");
  assert.equal(chaveMunicipio("Massaranduba"), chaveMunicipio("masaranduba"));
  assert.equal(chaveMunicipio("Araçagi"), "aracagi");
});

test("B12: o que parece nome de município; número, CNPJ e texto curto não", () => {
  assert.ok(pareceMunicipio("Sousa"));
  assert.ok(pareceMunicipio("são josé de piranhas"));
  assert.ok(!pareceMunicipio("956541"));
  assert.ok(!pareceMunicipio("08.778.326/0001-56"));
  assert.ok(!pareceMunicipio("creche 2024"));
  assert.ok(!pareceMunicipio("sa"));
  assert.ok(!pareceMunicipio("  "));
  assert.ok(!pareceMunicipio("construção de uma quadra poliesportiva coberta na escola municipal"), "frase longa");
});

test("B12: graus — o nome inteiro, o começo do nome, o começo de uma palavra", () => {
  assert.equal(grauDoMunicipio("Sousa", "Sousa"), 3);
  assert.equal(grauDoMunicipio("souza", "Sousa"), 3);
  assert.equal(grauDoMunicipio("SOUSA", "SOUSA"), 3);
  assert.equal(grauDoMunicipio("sao jose de piranhas", "São José de Piranhas"), 3);
  assert.equal(grauDoMunicipio("sao jose piranhas", "São José de Piranhas"), 3, "o 'de' pode faltar");
  assert.equal(grauDoMunicipio("olho dagua", "Olho d'Água"), 3, "o d' pode vir colado");
  assert.equal(grauDoMunicipio("olho agua", "Olho d'Água"), 3, "ou faltar");
  assert.equal(grauDoMunicipio("campina", "Campina Grande"), 2);
  assert.equal(grauDoMunicipio("sao jose", "São José de Piranhas"), 2);
  assert.equal(grauDoMunicipio("piranhas", "São José de Piranhas"), 1);
  assert.equal(grauDoMunicipio("grande", "Campina Grande"), 1);
  assert.equal(grauDoMunicipio("ranhas", "São José de Piranhas"), 0, "meio de palavra não casa");
  assert.equal(grauDoMunicipio("escola", "Escada"), 0);
  assert.equal(grauDoMunicipio("pavimentação", "Patos"), 0);
});

test("B12: Sousa, souza e São José de Piranhas sem acento acham o município da PB, com link para a página em abas", () => {
  for (const q of ["Sousa", "souza", "SOUSA"]) {
    const [primeiro] = casarMunicipios(q, CANDIDATOS_PB);
    assert.deepEqual(primeiro, { ibge: "2516201", nome: "Sousa", uf: "PB", grau: 3, href: "/mapa/municipio/2516201" });
  }
  const [sjp] = casarMunicipios("sao jose de piranhas", CANDIDATOS_PB);
  assert.equal(sjp.nome, "São José de Piranhas");
  assert.equal(sjp.href, "/mapa/municipio/2514503");
  assert.deepEqual(casarMunicipios("joao pessoa", CANDIDATOS_PB).map((m) => m.nome), ["João Pessoa"]);
  assert.deepEqual(casarMunicipios("956541", CANDIDATOS_PB), []);
  assert.deepEqual(casarMunicipios("pavimentação", CANDIDATOS_PB), []);
});

test("B12: ordem — grau, PB na frente, nome mais curto; fora da PB o link vai aos investimentos", () => {
  const candidatos = [
    ...CANDIDATOS_PB,
    { ibge: "3148004", nome: "PATOS DE MINAS" },
    { ibge: "2207793", nome: "PATOS DO PIAUÍ" },
    { ibge: "2408102", nome: "NATAL" },
  ];
  const patos = casarMunicipios("patos", candidatos);
  assert.deepEqual(
    patos.map((m) => [m.nome, m.uf, m.grau]),
    [
      ["Patos", "PB", 3],
      ["Patos de Minas", "MG", 2],
      ["Patos do Piauí", "PI", 2],
    ],
  );
  assert.equal(patos[1].href, "/mapa/municipio/3148004/investimentos");
  assert.deepEqual(casarMunicipios("natal", candidatos), [
    { ibge: "2408102", nome: "Natal", uf: "RN", grau: 3, href: "/mapa/municipio/2408102/investimentos" },
  ]);
  const areia = casarMunicipios("areia", CANDIDATOS_PB).map((m) => m.nome);
  assert.deepEqual(areia, ["Areia", "Areial", "Areia de Baraúnas", "Cacimba de Areia"]);
});

test("B12: o mesmo código aparece uma vez, com o nome da lista da PB; código inválido e nome vazio saem", () => {
  const r = casarMunicipios("sousa", [{ ibge: "2516201", nome: "Sousa" }, { ibge: "2516201", nome: "SOUSA" }, { ibge: "999", nome: "Sousa" }, { ibge: "2400000", nome: "" }]);
  assert.deepEqual(r.map((m) => m.nome), ["Sousa"]);
});

test("B12: o grupo mostra os primeiros e avisa que há mais", () => {
  const santa = municipiosDaBusca("santa", CANDIDATOS_PB);
  assert.equal(santa.achados.length, LIMITE_MUNICIPIOS);
  assert.equal(santa.mais, true);
  assert.ok(santa.achados.every((m) => m.grau === 2), "Santa Rita, Santa Luzia… começam com 'santa'");
  const sousa = municipiosDaBusca("sousa", CANDIDATOS_PB);
  assert.equal(sousa.mais, false);
});

test("B12: nome do banco (caixa alta) em caixa de título, com d', hífen e partículas", () => {
  assert.equal(nomeDeMunicipio("SÃO JOÃO DO TIGRE"), "São João do Tigre");
  assert.equal(nomeDeMunicipio("ALTA FLORESTA D'OESTE"), "Alta Floresta d'Oeste");
  assert.equal(nomeDeMunicipio("OLHO-D'ÁGUA DO BORGES"), "Olho-d'Água do Borges");
  assert.equal(nomeDeMunicipio("SANT'ANA DO LIVRAMENTO"), "Sant'Ana do Livramento");
  assert.equal(nomeDeMunicipio("GOVERNADOR DIX-SEPT ROSADO"), "Governador Dix-Sept Rosado");
  assert.equal(nomeDeMunicipio("XIQUE-XIQUE"), "Xique-Xique");
  assert.equal(nomeDeMunicipio("DIAS D'ÁVILA"), "Dias d'Ávila");
  assert.equal(nomeDeMunicipio("  MOJI  DAS CRUZES "), "Moji das Cruzes");
  assert.equal(nomeDeMunicipio("Mãe d'Água"), "Mãe d'Água", "nome em caixa mista fica como está");
});

test("B12: onde procurar — nada com número, município escolhido ou página 2; só a PB nas organizações", () => {
  assert.equal(ondeProcurarMunicipio(parametrosBusca({ q: "sousa" })), "brasil");
  assert.equal(ondeProcurarMunicipio(parametrosBusca({ aba: "instrumentos", q: "sousa", uf: "PB" })), "pb");
  // C2: na unificada a PB é o padrão (sai da URL) e o município se procura no Brasil.
  assert.equal(ondeProcurarMunicipio(parametrosBusca({ q: "sousa", uf: "PB" })), "brasil");
  assert.equal(ondeProcurarMunicipio(parametrosBusca({ q: "natal", uf: "RN" })), "uf");
  assert.equal(ondeProcurarMunicipio(parametrosBusca({ q: "sousa", aba: "organizacoes" })), "pb");
  assert.equal(ondeProcurarMunicipio(parametrosBusca({ q: "956541" })), null);
  assert.equal(ondeProcurarMunicipio(parametrosBusca({ q: "sousa", municipio: "2516201" })), null);
  assert.equal(ondeProcurarMunicipio(parametrosBusca({ q: "sousa", pagina: "2" })), null);
  assert.equal(ondeProcurarMunicipio(parametrosBusca({})), null);
});

test("B12: o filtro do banco — cada palavra começa uma palavra do nome, sem acento nem caixa; só letras entram", () => {
  const re = regexMunicipio("Souza");
  assert.equal(re, "^(?=.*(^|[^[:alnum:]])[sz]+[^[:alnum:]]*[oóòôõö]+[^[:alnum:]]*[uúùûü]+[^[:alnum:]]*[sz]+[^[:alnum:]]*[aáàâãä]+)");
  // A mesma expressão em JavaScript (o `~*` do banco ignora a caixa; [[:alnum:]] vira \p{L}\p{N}).
  const js = (r: string) => new RegExp(r.replace(/\[\^\[:alnum:\]\]/g, "[^\\p{L}\\p{N}]"), "iu");
  assert.ok(js(re!).test("SOUSA"));
  assert.ok(js(regexMunicipio("sao jose piranhas")!).test("SÃO JOSÉ DE PIRANHAS"));
  assert.ok(js(regexMunicipio("olho dagua")!).test("OLHO D'ÁGUA DAS FLORES"));
  assert.ok(js(regexMunicipio("rio preto sao jose")!).test("SÃO JOSÉ DO RIO PRETO"), "a ordem das palavras não importa no banco");
  assert.ok(!js(regexMunicipio("ranhas")!).test("SÃO JOSÉ DE PIRANHAS"), "meio de palavra não passa");
  assert.equal(regexMunicipio("956541"), null);
  assert.equal(regexMunicipio("ab"), null);
  // Nada do que se digita vira operador: parêntese, ponto, asterisco e barra separam palavras, como o espaço.
  assert.equal(regexMunicipio("so(u)sa.*|x"), regexMunicipio("so u sa x"));
});

test("B12: título e saídas da busca vazia — tirar filtro, uma palavra, outra lista, município, janelas", () => {
  const p = parametrosBusca({ q: "creche municipal", uf: "PB", tema: "educacao" });
  assert.equal(tituloBuscaVazia(p), "Nada encontrado para “creche municipal” com os filtros escolhidos");
  assert.equal(tituloBuscaVazia(parametrosBusca({ q: "creche" })), "Nada encontrado para “creche”");
  assert.equal(tituloBuscaVazia(parametrosBusca({ uf: "PB" })), "Nada encontrado com esses filtros");
  // C2: as listas levam a aba na URL, e a lista vazia oferece a busca nos cinco tipos.
  assert.deepEqual(saidasBuscaVazia(p), [
    { texto: "Buscar “creche municipal” sem os filtros", href: "/mapa/busca?aba=instrumentos&q=creche+municipal" },
    { texto: "Buscar só “municipal”", href: "/mapa/busca?aba=instrumentos&q=municipal&uf=PB&tema=educacao" },
    { texto: "Procurar “creche municipal” nas propostas", href: "/mapa/busca?aba=propostas&q=creche+municipal&uf=PB&tema=educacao" },
    {
      texto: "Procurar “creche municipal” em todos os tipos",
      href: "/mapa/busca?q=creche+municipal",
      nota: "municípios, entidades, organizações, convênios e propostas",
    },
    { texto: "Ver os municípios da Paraíba", href: urlUf("PB", "municipios"), nota: "ou escreva na busca só o nome do município, como “Sousa”" },
    { texto: "Ver as janelas abertas", href: "/mapa" },
  ]);
});

test("B12: a frase do cartão vazio diz a lista e se havia termo, filtro ou os dois", () => {
  assert.equal(textoBuscaVazia(parametrosBusca({ aba: "instrumentos", q: "creche" })), "Nenhum convênio com esses termos.");
  assert.equal(textoBuscaVazia(parametrosBusca({ q: "creche", tema: "saude" })), "Nenhum convênio com esses termos e filtros.");
  assert.equal(textoBuscaVazia(parametrosBusca({ aba: "propostas", uf: "AC", grupo: "negada" })), "Nenhuma proposta com esses filtros.");
  assert.equal(textoBuscaVazia(parametrosBusca({ aba: "organizacoes", q: "laureano" })), "Nenhuma organização da Paraíba com esse nome ou CNPJ.");
  assert.equal(
    textoBuscaVazia(parametrosBusca({ aba: "organizacoes", q: "x1", municipio: "2516201" })),
    "Nenhuma organização da Paraíba com esse nome ou CNPJ nesse município.",
  );
  assert.equal(textoBuscaVazia(parametrosBusca({ aba: "organizacoes", municipio: "2516201" })), "Nenhuma organização da Paraíba nesse município.");
});

test("B12: saídas da busca vazia — com o grupo de municípios, sem a dica; número pede conferência; outra UF", () => {
  const textos = (s: { texto: string }[]) => s.map((x) => x.texto);
  assert.deepEqual(textos(saidasBuscaVazia(parametrosBusca({ aba: "instrumentos", q: "sousa" }), true)), [
    "Procurar “sousa” nas propostas",
    "Procurar “sousa” em todos os tipos",
    "Ver as janelas abertas",
  ]);
  assert.deepEqual(textos(saidasBuscaVazia(parametrosBusca({ aba: "propostas", q: "123456" }))), [
    "Procurar “123456” nos convênios",
    "Procurar “123456” em todos os tipos",
    "Confira o número digitado.",
    "Ver os municípios da Paraíba",
    "Ver as janelas abertas",
  ]);
  const rn = saidasBuscaVazia(parametrosBusca({ aba: "instrumentos", q: "xyz", uf: "RN" }));
  assert.equal(rn[rn.length - 2].texto, "Ver os municípios na página da UF (Rio Grande do Norte)");
  assert.equal(rn[rn.length - 2].href, urlUf("RN", "municipios"));
  const org = saidasBuscaVazia(parametrosBusca({ aba: "organizacoes", q: "laureano", municipio: "2507507" }));
  assert.equal(org[0].texto, "Buscar “laureano” sem os filtros");
  assert.equal(org[0].href, "/mapa/busca?aba=organizacoes&q=laureano");
  assert.equal(org[1].texto, "Procurar “laureano” nos convênios");
  assert.deepEqual(textos(saidasBuscaVazia(parametrosBusca({ uf: "PB" }))), ["Ver os municípios da Paraíba", "Ver as janelas abertas"], "sem termo: só as saídas gerais");
});
