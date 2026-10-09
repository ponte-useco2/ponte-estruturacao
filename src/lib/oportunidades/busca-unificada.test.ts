import { test } from "node:test";
import assert from "node:assert/strict";
import { parametrosBusca } from "./busca.ts";
import {
  LIMITE_GRUPO,
  MOTIVO_MUNICIPIO_FORA,
  alcanceDoGrupo,
  avisoDoEscopo,
  notaEntidadesFora,
  casarEntidades,
  classificarEntrada,
  cortar,
  entidadeAchada,
  escopoUnificado,
  pedeDireto,
  resumoUnificado,
  rotuloVerTodos,
  semCpf,
  textoGrupoVazio,
  tudoVazio,
  urlBrasilInteiro,
  urlDoChip,
  urlVerTodos,
  vazioUnificado,
  type Contado,
  type IdGrupo,
  type ProponenteBusca,
} from "./busca-unificada.ts";

test("C2: a entrada — CNPJ válido com ou sem máscara, CNPJ que não fecha, número de convênio, texto e vazio", () => {
  assert.deepEqual(classificarEntrada("11.222.333/0001-81"), { tipo: "cnpj", cnpj: "11222333000181" });
  assert.deepEqual(classificarEntrada(" 08778326000156 "), { tipo: "cnpj", cnpj: "08778326000156" });
  assert.deepEqual(classificarEntrada("11222333000182"), { tipo: "cnpj_invalido", digitos: "11222333000182" });
  assert.deepEqual(classificarEntrada("956541"), { tipo: "numero", numero: "956541" });
  assert.deepEqual(classificarEntrada("nº 956541"), { tipo: "numero", numero: "956541" });
  assert.deepEqual(classificarEntrada("N°956541"), { tipo: "numero", numero: "956541" });
  assert.deepEqual(classificarEntrada("7AACFT"), { tipo: "numero", numero: "7AACFT" });
  assert.deepEqual(classificarEntrada("creche"), { tipo: "texto" });
  assert.deepEqual(classificarEntrada("patos 2024"), { tipo: "texto" }, "duas palavras não são número");
  assert.deepEqual(classificarEntrada("11218/2008"), { tipo: "texto" }, "com barra, é texto (vai aos convênios e propostas pelo LIKE)");
  assert.deepEqual(classificarEntrada("12"), { tipo: "texto" }, "menos de 3 posições não é número de convênio");
  assert.deepEqual(classificarEntrada("   "), { tipo: "vazia" });
  assert.equal(classificarEntrada("123.456.789-09").tipo, "texto", "CPF (11 dígitos) não é CNPJ nem número");
});

test("C2: só o formulário da unificada pede para ir direto (direto=1)", () => {
  assert.equal(pedeDireto({ direto: "1" }), true);
  assert.equal(pedeDireto({ direto: ["1", "0"] }), true);
  assert.equal(pedeDireto({}), false);
  assert.equal(pedeDireto({ direto: "sim" }), false);
});

test("C2: o escopo — sem UF, convênios e propostas na PB, com o Brasil oferecido; com UF, nela", () => {
  assert.deepEqual(escopoUnificado({ uf: null }), { uf: "PB", ehPb: true, padrao: true, onde: "na Paraíba" });
  assert.deepEqual(escopoUnificado({ uf: "PB" }), { uf: "PB", ehPb: true, padrao: true, onde: "na Paraíba" });
  assert.deepEqual(escopoUnificado({ uf: "SP" }), { uf: "SP", ehPb: false, padrao: false, onde: "em SP" });
  assert.match(avisoDoEscopo(escopoUnificado({ uf: null })), /No Brasil inteiro, essa busca leva de 4 a 15 segundos/);
  assert.match(avisoDoEscopo(escopoUnificado({ uf: "SP" })), /em SP \(São Paulo\).*alguns segundos.*não mudam com a UF/);
});

test("C2: cada grupo diz onde procura; a UF muda só convênios e propostas", () => {
  const pb = escopoUnificado({ uf: null });
  const rn = escopoUnificado({ uf: "RN" });
  assert.equal(alcanceDoGrupo("convenios", pb), "Na Paraíba, todos desde 2008.");
  assert.equal(alcanceDoGrupo("propostas", pb), "Na Paraíba, desde 2019.");
  assert.equal(alcanceDoGrupo("convenios", rn), "Rio Grande do Norte (RN): os em execução ou prestando contas.");
  assert.equal(alcanceDoGrupo("entidades", rn), alcanceDoGrupo("entidades", pb));
  assert.equal(alcanceDoGrupo("organizacoes", rn), alcanceDoGrupo("organizacoes", pb));
  assert.equal(notaEntidadesFora(pb), null);
  assert.match(notaEntidadesFora(rn) ?? "", /entidades de RN se acham pelo CNPJ completo/);
  assert.match(MOTIVO_MUNICIPIO_FORA, /^Não procurado/);
});

test("C2: cortar nos 5 primeiros e o rótulo do Ver todos com o tipo e o número", () => {
  const sete = [1, 2, 3, 4, 5, 6, 7];
  assert.equal(LIMITE_GRUPO, 5);
  assert.deepEqual(cortar(sete), { primeiros: [1, 2, 3, 4, 5], resto: [6, 7] });
  assert.deepEqual(cortar([1, 2]), { primeiros: [1, 2], resto: [] });
  assert.equal(rotuloVerTodos("convenios", 1234), "Ver todos os convênios (1.234)");
  assert.equal(rotuloVerTodos("organizacoes", 7), "Ver todas as organizações (7)");
});

test("C2: o Ver todos leva à aba do tipo com o mesmo termo e a mesma UF (o mesmo N); municípios e entidades abrem no lugar", () => {
  const pb = parametrosBusca({ q: "patos" });
  assert.equal(pb.aba, "tudo");
  assert.equal(urlVerTodos(pb, "convenios"), "/mapa/busca?aba=instrumentos&q=patos&uf=PB");
  assert.equal(urlVerTodos(pb, "propostas"), "/mapa/busca?aba=propostas&q=patos&uf=PB");
  assert.equal(urlVerTodos(pb, "organizacoes"), "/mapa/busca?aba=organizacoes&q=patos");
  assert.equal(urlVerTodos(pb, "municipios"), null);
  assert.equal(urlVerTodos(pb, "entidades"), null);
  const sp = parametrosBusca({ q: "escola", uf: "sp" });
  assert.equal(urlVerTodos(sp, "convenios"), "/mapa/busca?aba=instrumentos&q=escola&uf=SP");
  assert.equal(urlBrasilInteiro(pb, "convenios"), "/mapa/busca?aba=instrumentos&q=patos");
  assert.equal(urlBrasilInteiro(sp, "propostas"), "/mapa/busca?aba=propostas&q=escola");
});

test("C2: os chips — da unificada com termo, Convênios e Propostas levam a UF do grupo; o resto como antes", () => {
  const pb = parametrosBusca({ q: "patos" });
  assert.equal(urlDoChip(pb, "instrumentos"), "/mapa/busca?aba=instrumentos&q=patos&uf=PB");
  assert.equal(urlDoChip(pb, "propostas"), "/mapa/busca?aba=propostas&q=patos&uf=PB");
  assert.equal(urlDoChip(pb, "organizacoes"), "/mapa/busca?aba=organizacoes&q=patos");
  assert.equal(urlDoChip(parametrosBusca({ q: "x", uf: "SP" }), "instrumentos"), "/mapa/busca?aba=instrumentos&q=x&uf=SP");
  assert.equal(urlDoChip(parametrosBusca({}), "instrumentos"), "/mapa/busca?aba=instrumentos", "sem termo, a lista de sempre");
  const lista = parametrosBusca({ aba: "instrumentos", q: "creche" });
  assert.equal(urlDoChip(lista, "propostas"), "/mapa/busca?aba=propostas&q=creche", "entre as listas, a UF segue a da lista");
  assert.equal(urlDoChip(lista, "tudo"), "/mapa/busca?q=creche");
});

const PB: ProponenteBusca[] = [
  { cnpj: "08778326000156", proponente: "MUNICIPIO DE PATOS", tipo_agente: "municipio", cod_ibge: "2510808", municipio: "PATOS", instrumentos: 188, em_execucao: 12 },
  // Como o SICONV grava (execução 43): o fundo de Patos sem a cidade no nome.
  { cnpj: "11222333000181", proponente: "FUNDO MUNICIPAL DE SAUDE", tipo_agente: "municipio", cod_ibge: "2510808", municipio: "PATOS", instrumentos: 20, em_execucao: 3 },
  { cnpj: "22333444000155", proponente: "ACAO SOCIAL DIOCESANA DE PATOS", tipo_agente: "osc", cod_ibge: "2510808", municipio: "PATOS", instrumentos: 4, em_execucao: 1 },
  { cnpj: "33444555000166", proponente: "SAPATOS E CIA LTDA", tipo_agente: "empresa", cod_ibge: "2507507", municipio: "JOAO PESSOA", instrumentos: 1, em_execucao: 0 },
  { cnpj: "44555666000177", proponente: "MUNICIPIO DE SOUSA", tipo_agente: "municipio", cod_ibge: "2516201", municipio: "SOUSA", instrumentos: 90, em_execucao: 7 },
];

test("C2: entidades pelo nome ou pelo município — sem acento; o nome antes do município, o começo de palavra antes do pedaço", () => {
  const patos = casarEntidades("Patos", PB);
  assert.deepEqual(
    patos.map((e) => e.nome),
    ["MUNICIPIO DE PATOS", "ACAO SOCIAL DIOCESANA DE PATOS", "FUNDO MUNICIPAL DE SAUDE", "SAPATOS E CIA LTDA"],
    "o fundo entra pelo município; \"sapatos\" casa como pedaço (o mesmo LIKE dos convênios) e fica por último",
  );
  assert.deepEqual(patos.map((e) => e.rotulo), ["Prefeitura", "Organização da sociedade civil", "Fundo municipal", "Empresa"]);
  assert.equal(patos[0].href, "/mapa/entidade/08778326000156");
  assert.equal(patos[0].uf, "PB");
  assert.equal(patos[0].instrumentos, 188);
  assert.deepEqual(casarEntidades("município de pátos", PB).map((e) => e.nome)[0], "MUNICIPIO DE PATOS", "o nome que começa pelo digitado vem primeiro");
  assert.deepEqual(casarEntidades("fundo saude patos", PB).map((e) => e.nome), ["FUNDO MUNICIPAL DE SAUDE"], "nome e município juntos");
  assert.deepEqual(casarEntidades("sousa", PB).map((e) => e.nome), ["MUNICIPIO DE SOUSA"]);
  assert.deepEqual(casarEntidades("08778326", PB).map((e) => e.cnpj), ["08778326000156"], "a raiz do CNPJ acha a entidade");
  assert.deepEqual(casarEntidades("x", PB), [], "termo de uma letra não procura");
  assert.deepEqual(casarEntidades("campina", PB), []);
});

test("C2: privacidade — o CPF no nome de um proponente sai mascarado", () => {
  assert.equal(semCpf("JOAO DA SILVA 123.456.789-09"), "JOAO DA SILVA ***");
  assert.equal(semCpf("MARIA 12345678909 ME"), "MARIA *** ME");
  assert.equal(semCpf("FUNDO MUNICIPAL 2024"), "FUNDO MUNICIPAL 2024", "número curto fica");
  const e = entidadeAchada({ cnpj: "55666777000188", nome: "JOSE 12345678909", tipo_agente: "empresa", municipio: null, uf: "RN" });
  assert.equal(e.nome, "JOSE ***");
  assert.equal(entidadeAchada({ cnpj: "55666777000188", nome: null, municipio: null, uf: null }).nome, "CNPJ 55666777000188");
});

const todos = (c: Contado): Record<IdGrupo, Contado> => ({ municipios: c, entidades: c, organizacoes: c, convenios: c, propostas: c });

test("C2: a frase da região viva — total, cada tipo com concordância, e o que não pôde ser lido", () => {
  assert.equal(
    resumoUnificado("patos", {
      municipios: { estado: "ok", total: 1 },
      entidades: { estado: "ok", total: 6 },
      organizacoes: { estado: "ok", total: 30 },
      convenios: { estado: "ok", total: 1200 },
      propostas: { estado: "ok", total: 8 },
    }),
    "1.245 resultados para “patos”: 1 município, 6 entidades, 30 organizações, 1.200 convênios e 8 propostas.",
  );
  assert.equal(
    resumoUnificado("escola", {
      municipios: { estado: "ok", total: 0 },
      entidades: { estado: "fora" },
      organizacoes: { estado: "fora" },
      convenios: { estado: "erro" },
      propostas: { estado: "ok", total: 1 },
    }),
    "1 resultado para “escola”: 1 proposta. Não puderam ser lidos agora: convênios.",
  );
  assert.equal(resumoUnificado("xyz", todos({ estado: "ok", total: 0 })), "Nada encontrado para “xyz” em municípios, entidades, organizações, convênios e propostas.");
});

test("C2: vazio só quando nenhum grupo achou e nenhum falhou", () => {
  assert.equal(tudoVazio(todos({ estado: "ok", total: 0 })), true);
  assert.equal(tudoVazio({ ...todos({ estado: "ok", total: 0 }), organizacoes: { estado: "fora" } }), true);
  assert.equal(tudoVazio({ ...todos({ estado: "ok", total: 0 }), convenios: { estado: "erro" } }), false);
  assert.equal(tudoVazio({ ...todos({ estado: "ok", total: 0 }), propostas: { estado: "ok", total: 2 } }), false);
});

test("C2: o vazio diz o que foi procurado e onde, e as saídas vão do mais perto ao mais longe", () => {
  const pb = parametrosBusca({ q: "creche municipal xyz" });
  const v = vazioUnificado(pb, classificarEntrada(pb.q));
  assert.equal(v.titulo, "Nada encontrado para “creche municipal xyz”");
  assert.match(v.texto, /convênios e propostas na Paraíba/);
  assert.deepEqual(
    v.saidas.map((s) => s.texto),
    [
      "Buscar só “municipal”",
      "Procurar “creche municipal xyz” nos convênios do Brasil inteiro",
      "Procurar “creche municipal xyz” nas propostas do Brasil inteiro",
      "Ver os municípios da Paraíba",
      "Ver as janelas abertas",
    ],
  );
  assert.equal(v.saidas[0].href, "/mapa/busca?q=municipal");
  assert.equal(v.saidas[1].href, "/mapa/busca?aba=instrumentos&q=creche+municipal+xyz");
  const sp = parametrosBusca({ q: "xyz", uf: "SP" });
  assert.deepEqual(vazioUnificado(sp, classificarEntrada("xyz")).saidas.map((s) => s.href)[0], "/mapa/busca?q=xyz", "de outra UF, a primeira saída é a PB");
  const cnpj = vazioUnificado(parametrosBusca({ q: "11222333000182" }), classificarEntrada("11222333000182"));
  assert.match(cnpj.saidas[0].texto, /Confira o CNPJ/);
  assert.equal(cnpj.saidas[0].href, null);
  const nr = vazioUnificado(parametrosBusca({ q: "999999" }), classificarEntrada("999999"));
  assert.ok(nr.saidas.some((s) => /6 posições/.test(s.texto)));
});

test("C2: o texto de cada grupo vazio diz onde se procurou", () => {
  const pb = parametrosBusca({ q: "xyz" });
  assert.equal(textoGrupoVazio("convenios", pb, { tipo: "texto" }), "Nenhum convênio na Paraíba com esses termos.");
  assert.equal(textoGrupoVazio("propostas", parametrosBusca({ q: "xyz", uf: "RN" }), { tipo: "texto" }), "Nenhuma proposta em RN com esses termos.");
  assert.match(textoGrupoVazio("municipios", parametrosBusca({ q: "956541" }), { tipo: "numero", numero: "956541" }), /^Não procurado/);
  assert.match(textoGrupoVazio("entidades", pb, { tipo: "cnpj", cnpj: "11222333000181" }), /com esse CNPJ/);
});
