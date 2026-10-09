import test from "node:test";
import assert from "node:assert/strict";
import { destinoSeguro } from "./destino.ts";
import { parametrosBusca, urlBusca, urlDoMunicipio, urlInstrumento, urlInvestimentos, urlProposta } from "./busca.ts";
import { urlTermo } from "./glossario.ts";
import { ABAS_BRASIL, URL_CSV_BRASIL, URL_RELATORIO_BRASIL, urlBrasil } from "./pagina-brasil.ts";
import { ABAS_ENTIDADE, saidasEntidadeVazia, urlEntidade, urlRelatorioEntidade } from "./pagina-entidade.ts";
import { ABAS_MUNICIPIO, abaEscolhida, destinoConvenio, nivelDeAcesso, urlMunicipio } from "./pagina-municipio.ts";
import { ABAS_UF, urlRelatorioUf, urlUf } from "./pagina-uf.ts";
import { trilha } from "./trilha.ts";
import {
  MARCA_PEDE_CADASTRO,
  NIVEL_DO_PUBLICO,
  NOTA_DA_IMPRESSAO_PUBLICA,
  ROTAS_PUBLICAS,
  URL_AGUARDANDO,
  abasSoComCadastro,
  acessoDoLayout,
  chaveDoAmbiente,
  chaveLigada,
  convitePublico,
  destinoDoPublico,
  emLista,
  linkNoPublico,
  portaDoPublico,
  quemAPaginaAtende,
  rotaPublica,
  urlEntrar,
  voltaParaOMapa,
  type AcessoDoLayout,
} from "./publico.ts";

// ================================================================ a lógica de antes de C4a, copiada do layout

type V = { status: string; email: string };

/**
 * O layout do `/mapa` até 09/10/2026, linha a linha, com `redirect()` virando valor. É a referência da prova: com a
 * chave desligada, `acessoDoLayout` tem de devolver exatamente isto, em todo caso.
 */
function acessoDeAntes(e: { configurado: boolean; visitante: V | null; caminho: string | null | undefined }): AcessoDoLayout<V> {
  const pedido = destinoSeguro(e.caminho, "/mapa");
  const next = encodeURIComponent(pedido.startsWith("/mapa") ? pedido : "/mapa");
  if (!e.configurado) return { tipo: "redirecionar", destino: `/oportunidades/entrar?erro=config&next=${next}` };
  const visitante = e.visitante;
  if (!visitante) return { tipo: "redirecionar", destino: `/oportunidades/entrar?next=${next}` };
  if (visitante.status !== "aprovado") return { tipo: "redirecionar", destino: "/oportunidades/aguardando" };
  return { tipo: "aprovado", visitante };
}

/** A guarda de antes de C4a no topo de cada página: `if (!visitante || visitante.status !== "aprovado") return null`. */
function paginaDeAntes(visitante: V | null): V | null {
  return !visitante || visitante.status !== "aprovado" ? null : visitante;
}

const VISITANTES: (V | null)[] = [
  null,
  { status: "aprovado", email: "a@x.org" },
  { status: "pendente", email: "p@x.org" },
  { status: "bloqueado", email: "b@x.org" },
  { status: "sem_conta", email: "s@x.org" },
  { status: "", email: "vazio@x.org" },
  { status: "APROVADO", email: "maiuscula@x.org" },
];

/** Rotas abertas, fechadas, de administrador, de CSV, com query, e caminhos que não servem de destino. */
const CAMINHOS: (string | null | undefined)[] = [
  null,
  undefined,
  "",
  "/mapa",
  "/mapa?x=1",
  "/mapa/",
  "/mapa/busca",
  "/mapa/busca?q=pocinhos&aba=tudo",
  "/mapa/brasil",
  "/mapa/brasil?aba=tempos",
  "/mapa/brasil/relatorio",
  "/mapa/brasil/csv",
  "/mapa/uf/pb",
  "/mapa/uf/PB?aba=municipios",
  "/mapa/uf/pb/relatorio",
  "/mapa/uf/pb/csv",
  "/mapa/municipio/2507507",
  "/mapa/municipio/2507507?aba=contas",
  "/mapa/municipio/2507507/relatorio",
  "/mapa/municipio/2507507/relatorio/csv",
  "/mapa/municipio/2507507/investimentos",
  "/mapa/municipio/2507507/organizacoes",
  "/mapa/entidade/09112236000194",
  "/mapa/entidade/09.112.236%2F0001-94",
  "/mapa/entidade/09112236000194/relatorio",
  "/mapa/entidade/09112236000194/csv",
  "/mapa/instrumento/942082",
  "/mapa/instrumento/942082/laudo",
  "/mapa/proposta/1234567",
  "/mapa/avisos",
  "/mapa/carteira",
  "/mapa/conta/organizacao",
  "/mapa/glossario",
  "/mapa/meu-municipio",
  "/mapa/minha-organizacao",
  "/mapa/painel",
  "/mapa/painel/municipio/2507507",
  "/mapa/painel/exportar",
  "/mapa/radar",
  "/mapa/fiscal",
  "/mapa/fiscal/2507507/simular",
  "/mapa/fornecedores",
  "/mapa/fornecedor/05476456000146",
  "/mapa/suspensivas",
  "/mapa/pix/ente/2507507",
  "/mapa/pix/plano/123",
  "/mapa/explorador",
  "//evil.example/mapa",
  "/\\evil.example",
  "/mapa\t/carteira",
  "https://evil.example/mapa",
  "/oportunidades",
  "/mapafalso",
];

// ================================================================ a chave

test("C4a: a chave só liga com exatamente \"1\"", () => {
  assert.equal(chaveLigada("1"), true);
  for (const v of [undefined, null, "", "0", "true", "TRUE", "yes", "sim", " 1", "1 ", "01", "1.0", "on", "l"]) {
    assert.equal(chaveLigada(v), false, JSON.stringify(v));
  }
});

test("C4a: a chave do ambiente lê MAPA_PUBLICO, e ausente é desligada", () => {
  const antes = process.env.MAPA_PUBLICO;
  try {
    delete process.env.MAPA_PUBLICO;
    assert.equal(chaveDoAmbiente(), false, "ausente");
    process.env.MAPA_PUBLICO = "true";
    assert.equal(chaveDoAmbiente(), false, "\"true\" não liga");
    process.env.MAPA_PUBLICO = "1";
    assert.equal(chaveDoAmbiente(), true);
  } finally {
    if (antes === undefined) delete process.env.MAPA_PUBLICO;
    else process.env.MAPA_PUBLICO = antes;
  }
});

// ================================================================ a prova da chave desligada

test("C4a: com a chave desligada, o layout decide exatamente como antes, em todo caso", () => {
  let casos = 0;
  for (const configurado of [true, false]) {
    for (const visitante of VISITANTES) {
      for (const caminho of CAMINHOS) {
        const agora = acessoDoLayout({ configurado, visitante, chave: false, caminho });
        assert.deepEqual(agora, acessoDeAntes({ configurado, visitante, caminho }), JSON.stringify({ configurado, visitante, caminho }));
        assert.notEqual(agora.tipo, "publico");
        casos++;
      }
    }
  }
  assert.equal(casos, 2 * VISITANTES.length * CAMINHOS.length);
});

test("C4a: com a chave desligada, cada página de nível 0 atende exatamente quem atendia antes", () => {
  for (const visitante of VISITANTES) {
    for (const caminho of CAMINHOS) {
      const quem = quemAPaginaAtende(visitante, false, caminho ?? "");
      assert.equal(quem?.aprovado ?? null, paginaDeAntes(visitante), JSON.stringify({ visitante, caminho }));
      assert.equal(quem === null || quem.sessao === null, true, "desligada, ninguém entra como público");
    }
  }
});

test("C4a: com a chave ligada, o aprovado e a falta de Supabase seguem como antes", () => {
  for (const caminho of CAMINHOS) {
    for (const visitante of VISITANTES) {
      const semBanco = acessoDoLayout({ configurado: false, visitante, chave: true, caminho });
      assert.deepEqual(semBanco, acessoDeAntes({ configurado: false, visitante, caminho }), "sem Supabase, a porta fecha");
    }
    const aprovado = VISITANTES[1];
    assert.deepEqual(acessoDoLayout({ configurado: true, visitante: aprovado, chave: true, caminho }), { tipo: "aprovado", visitante: aprovado });
  }
});

// ================================================================ a chave ligada

test("C4a: ligada, o anônimo entra nas rotas da lista com nível 0 e vai à entrada nas outras", () => {
  const anonimo = (caminho: string | null) => acessoDoLayout<V>({ configurado: true, visitante: null, chave: true, caminho });
  assert.deepEqual(anonimo("/mapa"), { tipo: "publico", sessao: "anonimo" });
  assert.deepEqual(anonimo("/mapa/municipio/2507507?aba=dinheiro"), { tipo: "publico", sessao: "anonimo" });
  assert.deepEqual(anonimo("/mapa/carteira"), { tipo: "redirecionar", destino: "/oportunidades/entrar?next=%2Fmapa%2Fcarteira" });
  assert.deepEqual(anonimo("/mapa/instrumento/942082/laudo"), {
    tipo: "redirecionar",
    destino: "/oportunidades/entrar?next=%2Fmapa%2Finstrumento%2F942082%2Flaudo",
  });
  // Sem o cabeçalho do caminho (o proxy não passou), o padrão "/mapa" NÃO abre: a falta de informação fecha a porta.
  assert.deepEqual(anonimo(null), { tipo: "redirecionar", destino: "/oportunidades/entrar?next=%2Fmapa" });
  assert.deepEqual(anonimo("//evil.example/mapa"), { tipo: "redirecionar", destino: "/oportunidades/entrar?next=%2Fmapa" });
});

test("C4a: ligada, o cadastro não aprovado vê o mesmo que o anônimo, e fora da lista vai à sala de espera", () => {
  for (const status of ["pendente", "bloqueado", "sem_conta"]) {
    const v: V = { status, email: "x@x.org" };
    assert.deepEqual(acessoDoLayout({ configurado: true, visitante: v, chave: true, caminho: "/mapa/brasil" }), { tipo: "publico", sessao: "nao_aprovado" });
    assert.deepEqual(acessoDoLayout({ configurado: true, visitante: v, chave: true, caminho: "/mapa/avisos" }), { tipo: "redirecionar", destino: URL_AGUARDANDO });
  }
});

test("C4a: a conta do público (navegação dentro do Mapa) manda para o mesmo lugar que o layout", () => {
  for (const visitante of VISITANTES.filter((v) => v?.status !== "aprovado")) {
    for (const caminho of CAMINHOS) {
      const layout = acessoDoLayout({ configurado: true, visitante, chave: true, caminho });
      const sessao = visitante ? "nao_aprovado" : "anonimo";
      const cliente = destinoDoPublico(sessao, caminho);
      if (layout.tipo === "publico") assert.equal(cliente, null, `${caminho}: pública nos dois`);
      else assert.deepEqual(layout, { tipo: "redirecionar", destino: cliente }, `${caminho}: o mesmo destino`);
    }
  }
});

test("C4a: ligada, a página atende o público só na própria rota da lista", () => {
  assert.deepEqual(quemAPaginaAtende<V>(null, true, "/mapa/brasil"), { aprovado: null, sessao: "anonimo" });
  assert.deepEqual(quemAPaginaAtende<V>({ status: "pendente", email: "p@x.org" }, true, "/mapa/uf/pb"), { aprovado: null, sessao: "nao_aprovado" });
  assert.equal(quemAPaginaAtende<V>(null, true, "/mapa/carteira"), null);
  assert.equal(quemAPaginaAtende<V>(null, true, "/mapa/municipio/2507507/relatorio"), null);
  const a: V = { status: "aprovado", email: "a@x.org" };
  assert.deepEqual(quemAPaginaAtende(a, true, "/mapa/carteira"), { aprovado: a, sessao: null }, "o aprovado nunca depende da lista");
});

// ================================================================ a lista branca

test("C4a: a lista branca tem exatamente as oito rotas de nível 0 (a busca, a proposta e as OSC ficam com o titular)", () => {
  assert.deepEqual(
    ROTAS_PUBLICAS.map((r) => r.rota),
    [
      "/mapa",
      "/mapa/brasil",
      "/mapa/uf/[sigla]",
      "/mapa/municipio/[ibge]",
      "/mapa/municipio/[ibge]/investimentos",
      "/mapa/entidade/[cnpj]",
      "/mapa/instrumento/[numero]",
      "/mapa/glossario",
    ],
  );
  for (const r of ROTAS_PUBLICAS) assert.ok(r.porque.length > 10, `${r.rota} diz o porquê`);
});

test("C4a: abrem as páginas de nível 0, com ou sem query", () => {
  for (const c of [
    "/mapa",
    "/mapa?fonte=transferegov",
    "/mapa/brasil",
    "/mapa/brasil?aba=estados",
    "/mapa/uf/pb",
    "/mapa/uf/SP",
    "/mapa/municipio/2507507",
    "/mapa/municipio/2507507?aba=indicadores",
    "/mapa/municipio/2507507/investimentos",
    "/mapa/municipio/3550308/investimentos",
    "/mapa/entidade/09112236000194",
    "/mapa/entidade/09.112.236%2F0001-94",
    "/mapa/entidade/12ABC34501DE35",
    "/mapa/instrumento/942082",
    "/mapa/instrumento/942082#topo",
    "/mapa/glossario",
    "/mapa/glossario#cauc",
  ]) {
    assert.equal(rotaPublica(c), true, c);
  }
});

test("C4a: continuam exigindo login a busca, a proposta, as OSC, laudos, relatórios, CSV, carteira, avisos, fiscal, painel, radar, fornecedores, Pix, explorador e conta", () => {
  for (const c of [
    // decisão do titular em aberto (R3, seção 6): a busca no Brasil inteiro e a paginação funda são a porta da raspagem
    "/mapa/busca",
    "/mapa/busca?q=agua&aba=instrumentos&pagina=2",
    "/mapa/proposta/1234567",
    "/mapa/municipio/2507507/organizacoes",
    "/mapa/municipio/2507507/organizacoes?area=saude",
    "/mapa/instrumento/942082/laudo",
    "/mapa/municipio/2507507/relatorio",
    "/mapa/municipio/2507507/relatorio/csv",
    "/mapa/municipio/2507507/investimentos/x",
    "/mapa/uf/pb/relatorio",
    "/mapa/uf/pb/csv",
    "/mapa/brasil/relatorio",
    "/mapa/brasil/csv",
    "/mapa/entidade/09112236000194/relatorio",
    "/mapa/entidade/09112236000194/csv",
    "/mapa/pix/ente/2507507/csv",
    "/mapa/painel/exportar",
    "/mapa/carteira",
    "/mapa/avisos",
    "/mapa/avisos?mural=itens",
    "/mapa/fiscal",
    "/mapa/fiscal/2507507",
    "/mapa/fiscal/2507507/simular",
    "/mapa/painel",
    "/mapa/painel/municipio/2507507",
    "/mapa/painel/pix",
    "/mapa/painel/tce/2507507",
    "/mapa/radar",
    "/mapa/fornecedores",
    "/mapa/fornecedor/05476456000146",
    "/mapa/pix/ente/2507507",
    "/mapa/pix/plano/123",
    "/mapa/explorador",
    "/mapa/glossario/x",
    "/mapa/conta/organizacao",
    "/mapa/meu-municipio",
    "/mapa/minha-organizacao",
    "/mapa/suspensivas",
    "/mapa/suspensivas/checklist",
    // rota que ainda não existe: lista branca, nasce fechada
    "/mapa/nova-rota",
  ]) {
    assert.equal(rotaPublica(c), false, c);
  }
});

test("C4a: caminho torto não abre — barra no fim, segmento a mais, '..', fora do Mapa, destino inseguro", () => {
  for (const c of [
    null,
    undefined,
    "",
    "/mapa/",
    "/mapa/busca/",
    "/mapafalso",
    "/mapa/uf/pbx",
    "/mapa/uf/p",
    "/mapa/municipio/250750",
    "/mapa/municipio/25075070",
    "/mapa/municipio/abc",
    "/mapa/entidade/..",
    "/mapa/entidade/.",
    "/mapa/entidade/" + "1".repeat(65),
    "/mapa/instrumento/942082/",
    "/mapa/instrumento/" + "9".repeat(21),
    "/mapa/municipio/2507507/../../carteira",
    "//mapa",
    "/\\mapa",
    "/mapa\n",
    "https://evil.example/mapa",
    "/oportunidades",
  ]) {
    assert.equal(rotaPublica(c), false, JSON.stringify(c));
  }
});

// ================================================================ o caminho de volta, a porta e o convite

test("C4a: a volta depois de entrar é a regra do layout de antes", () => {
  for (const c of CAMINHOS) {
    const pedido = destinoSeguro(c, "/mapa");
    assert.equal(voltaParaOMapa(c), pedido.startsWith("/mapa") ? pedido : "/mapa");
  }
  assert.equal(urlEntrar("/mapa/uf/pb?aba=dinheiro"), "/oportunidades/entrar?next=%2Fmapa%2Fuf%2Fpb%3Faba%3Ddinheiro");
  assert.equal(urlEntrar("/oportunidades/admin"), "/oportunidades/entrar?next=%2Fmapa", "fora do Mapa, volta à raiz do Mapa");
});

test("C4a: a porta da moldura — Entrar para o anônimo, a situação do cadastro para o não aprovado", () => {
  assert.deepEqual(portaDoPublico("anonimo", "/mapa/brasil"), { href: "/oportunidades/entrar?next=%2Fmapa%2Fbrasil", rotulo: "Entrar" });
  assert.deepEqual(portaDoPublico("nao_aprovado", "/mapa/brasil"), { href: URL_AGUARDANDO, rotulo: "Situação do cadastro" });
});

test("C4a: o convite diz o que o cadastro abre e volta para a mesma página", () => {
  const anonimo = convitePublico("anonimo", "/mapa/municipio/2507507?aba=dinheiro", "ver também a aba “Controle”");
  assert.equal(anonimo.href, "/oportunidades/entrar?next=%2Fmapa%2Fmunicipio%2F2507507%3Faba%3Ddinheiro");
  assert.equal(anonimo.rotulo, "Entrar");
  assert.match(anonimo.texto, /Entre para ver também a aba “Controle”\./);
  const naoAprovado = convitePublico("nao_aprovado", "/mapa/brasil", "seguir este convênio");
  assert.equal(naoAprovado.href, URL_AGUARDANDO);
  assert.match(naoAprovado.texto, /você vai poder seguir este convênio\./);
});

test("C4a: a lista em português", () => {
  assert.equal(emLista([]), "");
  assert.equal(emLista(["a"]), "a");
  assert.equal(emLista(["a", "b"]), "a e b");
  assert.equal(emLista(["a", "b", "c"]), "a, b e c");
});

// ================================================================ o nível 0 e a D1

test("C4a: o nível do público é o 0 da D1, e é o que as regras de nível já davam ao não aprovado", () => {
  assert.equal(NIVEL_DO_PUBLICO, 0);
  assert.equal(nivelDeAcesso({ aprovado: false, administrador: false, clienteDoMunicipio: false }), NIVEL_DO_PUBLICO);
  // a aba de entrada do público é o resumo; pedir uma aba fechada também cai nele
  assert.equal(abaEscolhida(undefined, NIVEL_DO_PUBLICO), "resumo");
  assert.equal(abaEscolhida("contas", NIVEL_DO_PUBLICO), "resumo");
  assert.equal(abaEscolhida("relatorio", NIVEL_DO_PUBLICO), "resumo");
  assert.equal(abaEscolhida("indicadores", NIVEL_DO_PUBLICO), "indicadores");
});

test("C4a: o convite lê das listas de abas o que só o cadastro abre (D1: fiscal e relatório completo com cadastro)", () => {
  assert.equal(abasSoComCadastro(ABAS_MUNICIPIO), "“O que trava e o que destrava”, “Contas públicas”, “Controle” e “Relatório e dados”");
  assert.equal(abasSoComCadastro(ABAS_BRASIL), "“Tempos e funil” e “Relatório e dados”");
  assert.equal(abasSoComCadastro(ABAS_UF), "“Tempos e funil” e “Relatório e dados”");
  assert.equal(abasSoComCadastro(ABAS_ENTIDADE), "“O que trava e o que destrava”, “Controle” e “Relatório e dados”");
  // D1: o público vê o resumo e os indicadores do município; o relatório completo e as contas (fiscal), não
  const abertas = ABAS_MUNICIPIO.filter((a) => a.minimo <= NIVEL_DO_PUBLICO).map((a) => a.id);
  assert.deepEqual(abertas, ["resumo", "dinheiro", "indicadores"]);
});

test("C4a: a impressão da versão pública diz que o relatório completo pede cadastro (C5 da R3)", () => {
  assert.match(NOTA_DA_IMPRESSAO_PUBLICA, /^Versão pública/);
  assert.match(NOTA_DA_IMPRESSAO_PUBLICA, /pede cadastro\.$/);
});

// ================================================================ os links das páginas abertas (auditoria R1, 4.1)

test("C4a: o link do nível 0 — rota aberta segue; rota fechada leva à entrada com a marca; o cadastrado não muda", () => {
  assert.deepEqual(linkNoPublico("/mapa/brasil", true), { href: "/mapa/brasil", pedeCadastro: false });
  assert.deepEqual(linkNoPublico("/mapa/avisos", true), { href: "/oportunidades/entrar?next=%2Fmapa%2Favisos", pedeCadastro: true });
  assert.deepEqual(linkNoPublico("/mapa/avisos", false), { href: "/mapa/avisos", pedeCadastro: false });
  assert.equal(MARCA_PEDE_CADASTRO, "(pede cadastro)");
});

const IBGE_PB = "2507507";
const IBGE_FORA = "3550308";
const CNPJ = "09112236000194";

/**
 * Os destinos que as páginas do nível 0 oferecem, montados com os mesmos construtores de URL que elas usam, e o que cada
 * página faz com o link no nível 0: "aberta" (segue), "marcada" (diz "(pede cadastro)" e vai à entrada) ou "sem link"
 * (o texto fica, sem link; a página decide isso por `linkNoPublico(...).pedeCadastro`). Os casos da auditoria R1 (4.1)
 * estão todos aqui. Página nova no nível 0, ou link novo numa delas, entra nesta lista.
 */
const OFERTAS_DO_NIVEL_0: { onde: string; destino: string; nivel0: "aberta" | "marcada" | "sem link" }[] = [
  // moldura e menu
  { onde: "MapaFrame: a marca", destino: "/mapa", nivel0: "aberta" },
  { onde: "MapaFrame: o rodapé", destino: "/mapa/glossario", nivel0: "aberta" },
  { onde: "MapaNav: Território", destino: urlBrasil(), nivel0: "aberta" },
  // R1: "Ver no glossário" em todo balão de termo
  { onde: "Termo: Ver no glossário", destino: urlTermo("cauc"), nivel0: "aberta" },
  // janelas
  { onde: "CatalogoClient: Declarar a entidade (R1)", destino: "/mapa/conta/organizacao", nivel0: "marcada" },
  { onde: "CatalogoClient: Avisos, no vazio", destino: "/mapa/avisos", nivel0: "marcada" },
  // Brasil e UF
  { onde: "BrasilConteudo: Ver a Paraíba", destino: urlUf("PB"), nivel0: "aberta" },
  { onde: "BrasilConteudo: as abas", destino: urlBrasil("estados"), nivel0: "aberta" },
  { onde: "UfConteudo: município da PB", destino: urlMunicipio(IBGE_PB), nivel0: "aberta" },
  { onde: "UfConteudo: município de fora da PB, aos investimentos (R1)", destino: `/mapa/municipio/${IBGE_FORA}/investimentos`, nivel0: "aberta" },
  { onde: "UfConteudo: o estado como proponente", destino: urlEntidade(CNPJ), nivel0: "aberta" },
  { onde: "UfConteudo: as abas", destino: urlUf("pb", "municipios"), nivel0: "aberta" },
  // município
  { onde: "MunicipioConteudo: as abas", destino: urlMunicipio(IBGE_PB, "indicadores"), nivel0: "aberta" },
  { onde: "MunicipioConteudo: Ver os investimentos (R1)", destino: urlInvestimentos(IBGE_PB), nivel0: "aberta" },
  { onde: "MunicipioConteudo: convênio na tabela", destino: destinoConvenio(NIVEL_DO_PUBLICO)("942082"), nivel0: "aberta" },
  { onde: "QuemRecebe: a entidade", destino: urlEntidade(CNPJ), nivel0: "aberta" },
  { onde: "QuemRecebe: Ver as N organizações (R1)", destino: `/mapa/municipio/${IBGE_PB}/organizacoes`, nivel0: "marcada" },
  { onde: "QuemRecebe: a área da sociedade civil (R1)", destino: `/mapa/municipio/${IBGE_PB}/organizacoes?area=saude`, nivel0: "sem link" },
  // investimentos
  { onde: "InvestimentosConteudo: Página do município", destino: urlMunicipio(IBGE_PB, "dinheiro"), nivel0: "aberta" },
  { onde: "InvestimentosConteudo: Ver os convênios na busca", destino: urlBusca(parametrosBusca({}), { uf: "PB", municipio: IBGE_PB }), nivel0: "marcada" },
  { onde: "InvestimentosConteudo: barra por tema", destino: urlBusca(parametrosBusca({}), { uf: "PB", municipio: IBGE_PB, tema: "saude" }), nivel0: "sem link" },
  { onde: "InvestimentosConteudo: barra por situação", destino: urlBusca(parametrosBusca({}), { uf: "PB", municipio: IBGE_PB, grupo: "execucao" }), nivel0: "sem link" },
  { onde: "InvestimentosConteudo: Ver as propostas", destino: urlBusca(parametrosBusca({}), { aba: "propostas", uf: "SP", municipio: IBGE_FORA }), nivel0: "marcada" },
  { onde: "InvestimentosConteudo: a UF", destino: urlUf("SP"), nivel0: "aberta" },
  // entidade
  { onde: "EntidadeConteudo: a página do município", destino: urlMunicipio(IBGE_PB), nivel0: "aberta" },
  { onde: "EntidadeConteudo: as abas", destino: urlEntidade(CNPJ, "instrumentos"), nivel0: "aberta" },
  ...saidasEntidadeVazia({ cnpj: CNPJ, nome: "Associação X" })
    .filter((s) => !s.externo)
    .map((s) => ({ onde: `EntidadeVazia: ${s.rotulo}`, destino: s.href, nivel0: "marcada" as const })),
  // instrumento
  { onde: "InstrumentoConteudo: a entidade", destino: urlEntidade(CNPJ), nivel0: "aberta" },
  { onde: "InstrumentoConteudo: o município da PB", destino: urlDoMunicipio(IBGE_PB), nivel0: "aberta" },
  { onde: "InstrumentoConteudo: o município de fora da PB", destino: urlDoMunicipio(IBGE_FORA), nivel0: "aberta" },
  { onde: "InstrumentoConteudo: Ver a proposta (R1)", destino: urlProposta("123456"), nivel0: "marcada" },
  { onde: "InstrumentoConteudo: etiqueta de tema", destino: urlBusca(parametrosBusca({}), { tema: "saude", uf: "PB" }), nivel0: "sem link" },
  { onde: "instrumento/page: Buscar pelo número", destino: `/mapa/busca?q=${encodeURIComponent("942082")}`, nivel0: "marcada" },
  { onde: "instrumento/page: indisponível, a volta", destino: urlBrasil(), nivel0: "aberta" },
  // a trilha de toda página do território
  ...trilha({ uf: "PB", regiaoImediata: "Patos", municipio: { ibge: IBGE_PB, nome: "Patos" }, entidade: { cnpj: CNPJ, nome: "X" } }, "fim")
    .filter((e) => e.href)
    .map((e) => ({ onde: `Trilha: ${e.rotulo}`, destino: e.href as string, nivel0: "aberta" as const })),
  ...trilha({ uf: "SP", municipio: { ibge: IBGE_FORA, nome: "São Paulo" } }, "fim")
    .filter((e) => e.href)
    .map((e) => ({ onde: `Trilha fora da PB: ${e.rotulo}`, destino: e.href as string, nivel0: "aberta" as const })),
];

test("C4a: nenhum link do nível 0 leva a rota fechada sem a marca (varredura dos destinos, auditoria R1 4.1)", () => {
  assert.ok(OFERTAS_DO_NIVEL_0.length >= 35);
  for (const o of OFERTAS_DO_NIVEL_0) {
    const l = linkNoPublico(o.destino, true);
    // o invariante: ou o destino abre para o público, ou o link vai marcado à entrada
    assert.ok(l.pedeCadastro || rotaPublica(l.href), `${o.onde}: ${o.destino}`);
    if (o.nivel0 === "aberta") {
      assert.equal(rotaPublica(o.destino), true, `${o.onde} deveria abrir: ${o.destino}`);
      assert.deepEqual(l, { href: o.destino, pedeCadastro: false }, o.onde);
    } else {
      assert.equal(rotaPublica(o.destino), false, `${o.onde} é fechada: ${o.destino}`);
      assert.equal(l.pedeCadastro, true, o.onde);
      assert.equal(l.href, urlEntrar(o.destino), `${o.onde}: entra e volta para o destino`);
    }
    // para o cadastrado, nenhum link muda
    assert.deepEqual(linkNoPublico(o.destino, false), { href: o.destino, pedeCadastro: false }, `${o.onde} (cadastrado)`);
  }
});

test("C4a: o que o nível 0 nem chega a oferecer (relatório, CSV, laudo, painel) é rota fechada", () => {
  for (const d of [
    urlRelatorioEntidade(CNPJ),
    urlRelatorioUf("PB"),
    URL_RELATORIO_BRASIL,
    URL_CSV_BRASIL,
    "/mapa/uf/pb/csv",
    `/mapa/municipio/${IBGE_PB}/relatorio`,
    `/mapa/municipio/${IBGE_PB}/relatorio/csv`,
    `/mapa/entidade/${CNPJ}/csv`,
    `${urlInstrumento("942082")}/laudo`,
    `/mapa/pix/ente/${IBGE_PB}`,
    `/mapa/painel/municipio/${IBGE_PB}`,
  ]) {
    assert.equal(rotaPublica(d), false, d);
  }
});
