/**
 * Teste da apresentação das telas dos parlamentares (onda 14, parte 2, B, 13/10/2026). Só `parlamentares-tela.ts`: as
 * funções do contrato `emendas.ts` são do agente A e têm o teste dele; aqui elas entram só pelo caminho da tela (a
 * ordem da lista).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { TIPOS_AUTOR, type AnoCanalEmendas, type AutorEmendas, type DestinoEmendas, type MunicipioPopulacao } from "./emendas.ts";
import {
  ABAS_PARLAMENTAR,
  COLUNAS_DESTINO_MUNICIPIOS,
  COLUNAS_PARLAMENTARES,
  COLUNAS_SAFRA,
  COLUNAS_SERIE_ACESSO,
  ROTULO_ATENDIDO,
  SEM_AUTOR_FNS,
  TABELA_DESTINO_MUNICIPIOS,
  TABELA_EMENDAS_MUNICIPIO,
  TABELA_SAFRA,
  TABELA_SERIE_ACESSO,
  colunasAParte,
  colunasDoCanal,
  colunasEmendasDoMunicipio,
  valoresDaLinhaAParte,
  valoresDaSafra,
  valoresDaSerie,
  valoresDoAutorNoMunicipio,
  valoresDoDestinoMunicipio,
  GRUPOS_DESTINO,
  ROTULO_CURTO_GRUPO,
  TABELA_PARLAMENTARES,
  TOTAL_MUNICIPIOS_PB,
  abaDoParlamentar,
  autoresNaOrdemPadrao,
  caducadosPorAno,
  contarPorTipo,
  cortesDasFaixas,
  faixaDe,
  grupoDeDestino,
  linhasPorMunicipio,
  listaDaTela,
  municipiosDe223,
  naoAtendidos,
  periodoDoAutor,
  porcento,
  reaisPorHabitante,
  resumoPorCanalETipo,
  rotulosDasFaixas,
  serieDoAcesso,
  soPago,
  tipoDaUrl,
  tipoDoEndereco,
  tituloParlamentar,
  tituloParlamentares,
  totaisPorCanal,
  urlParlamentar,
  urlParlamentares,
  valoresDoAutor,
} from "./parlamentares-tela.ts";
import { aplicar, csvDaTabela, idValido, lerEstado, type LinhaTabela } from "./tabela-filtro.ts";
import { SUFIXO_DO_TITULO } from "./titulo-pagina.ts";

function autor(p: Partial<AutorEmendas> & Pick<AutorEmendas, "codigo">): AutorEmendas {
  return {
    nome: null,
    tipo: "individual",
    coletivo: false,
    pessoa: null,
    emendas: 0,
    ano_min: null,
    ano_max: null,
    convenio_indicado: 0,
    convenio_valido: 0,
    convenio_pago: 0,
    pix_indicado: 0,
    pix_valido: 0,
    pix_pago: 0,
    fns_indicado: 0,
    fns_valido: 0,
    fns_pago: 0,
    favorecido_pago: 0,
    caducados: 0,
    caducado_valor: 0,
    na_fila: 0,
    municipios: 0,
    catalogo_empenhado: 0,
    catalogo_pago_total: 0,
    catalogo_a_pagar: 0,
    catalogo_empenhado_pb: 0,
    catalogo_pago_total_pb: 0,
    ...p,
  };
}

function destino(p: Partial<DestinoEmendas>): DestinoEmendas {
  return { ibge: null, autor_codigo: "1277", canal: "convenio", ente_tipo: "municipio", instrumentos: 1, emendas: 1, indicado: 0, valido: 0, pago: 0, caducado: 0, ...p };
}

const MUNICIPIOS: MunicipioPopulacao[] = [
  { ibge: "2510808", nome: "Patos", populacao: 100_000 },
  { ibge: "2504009", nome: "Campina Grande", populacao: 400_000 },
  { ibge: "2513901", nome: "São José dos Cordeiros", populacao: 3_000 },
  { ibge: "2500106", nome: "Água Branca", populacao: 10_000 },
];

// ------------------------------------------------------------------ a lista

test("tipoDaUrl aceita só os cinco tipos; o resto é 'todos'", () => {
  for (const t of TIPOS_AUTOR) assert.equal(tipoDaUrl(t), t);
  assert.equal(tipoDaUrl(["bancada", "comissao"]), "bancada");
  assert.equal(tipoDaUrl("Bancada"), null);
  assert.equal(tipoDaUrl("ranking"), null);
  assert.equal(tipoDaUrl(""), null);
  assert.equal(tipoDaUrl(undefined), null);
  assert.equal(urlParlamentares(null), "/mapa/parlamentares");
  // Onda 15, A: o filtro de tipo é o da coluna "Tipo" da tabela, pelo rótulo.
  assert.equal(urlParlamentares("relator"), "/mapa/parlamentares?t.parl.tipo=Relator-geral");
  assert.equal(urlParlamentares("comissao"), "/mapa/parlamentares?t.parl.tipo=Comiss%C3%A3o");
});

// ------------------------------------------------------------------ a tabela da lista (onda 15, A, 13/10/2026)

test("as colunas da tabela: ids que cabem no endereço, sem repetição, e o código como texto no CSV", () => {
  const ids = COLUNAS_PARLAMENTARES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(idValido(id), id);
  assert.ok(idValido(TABELA_PARLAMENTARES));
  // Tela de administrador: toda coluna ordena e filtra.
  assert.ok(COLUNAS_PARLAMENTARES.every((c) => c.ordenavel !== false && c.filtravel !== false));
  assert.equal(COLUNAS_PARLAMENTARES.find((c) => c.id === "codigo")?.textoNoCsv, true);
  assert.equal(COLUNAS_PARLAMENTARES.find((c) => c.id === "tipo")?.tipo, "categoria");
  assert.equal(COLUNAS_PARLAMENTARES.find((c) => c.id === "grupo")?.tipo, "categoria");
});

test("valoresDoAutor: um valor cru por coluna; o catálogo só no grupo sem canal", () => {
  const publico = autor({ codigo: "1277", nome: "Wellington Roberto", tipo: "individual", municipios: 65, convenio_valido: 68e6, convenio_pago: 40e6, ano_min: 2015, ano_max: 2026, catalogo_empenhado_pb: 9e6 });
  const v = valoresDoAutor(publico);
  assert.deepEqual(Object.keys(v).sort(), COLUNAS_PARLAMENTARES.map((c) => c.id).sort());
  assert.equal(v.autor, "Wellington Roberto");
  assert.equal(v.codigo, "1277");
  assert.equal(v.tipo, "Individual");
  assert.equal(v.grupo, ROTULO_CURTO_GRUPO.publico);
  assert.equal(v["convenio-valido"], 68e6);
  assert.equal(v["pix-valido"], 0);
  assert.equal(v["ano-inicial"], 2015);
  assert.equal(v["catalogo-empenhado"], null);
  const semCanal = valoresDoAutor(autor({ codigo: "9999", tipo: "comissao", catalogo_empenhado_pb: 100, catalogo_pago_total_pb: 40 }));
  assert.equal(semCanal.autor, "Autor 9999 (sem nome publicado)");
  assert.equal(semCanal.tipo, "Comissão");
  assert.equal(semCanal.grupo, ROTULO_CURTO_GRUPO.sem_canal);
  assert.equal(semCanal["catalogo-empenhado"], 100);
  assert.equal(semCanal["catalogo-pago"], 40);
  assert.equal(semCanal["ano-final"], null);
});

test("o ?tipo= antigo vira o filtro da coluna Tipo, e a ordem padrão é grupo, tipo e nome", () => {
  const lista = [
    autor({ codigo: "6011", tipo: "comissao", nome: "Comissão de Desenvolvimento Regional", municipios: 162 }),
    autor({ codigo: "1277", nome: "Wellington Roberto", municipios: 65 }),
    autor({ codigo: "2000", nome: "Autor de fora", favorecido_pago: 1e5 }),
    autor({ codigo: "7101", tipo: "bancada", nome: "Bancada da Paraíba", convenio_valido: 5e6 }),
  ];
  const ordenados = autoresNaOrdemPadrao(lista);
  assert.deepEqual(ordenados.map((a) => a.codigo), ["1277", "6011", "7101", "2000"]);
  const linhas: LinhaTabela[] = ordenados.map((a) => ({ chave: a.codigo, valores: valoresDoAutor(a), celulas: {} }));
  const estado = lerEstado(TABELA_PARLAMENTARES, COLUNAS_PARLAMENTARES, new URL(urlParlamentares("comissao"), "https://x").searchParams);
  assert.deepEqual(aplicar(COLUNAS_PARLAMENTARES, linhas, estado).map((l) => l.chave), ["6011"]);
  // O CSV leva o código como texto e o grupo de cada autor.
  const [cabecalho, primeira] = csvDaTabela(COLUNAS_PARLAMENTARES, linhas).slice(1).split("\r\n");
  assert.ok(cabecalho.startsWith("Autor;Código;Tipo;Grupo;Convênio válido;"));
  assert.ok(primeira.startsWith('Wellington Roberto;"=""1277""";Individual;Destino público na PB;0;'));
});

test("listaDaTela ordena por tipo e nome (sem nome no fim), nunca por valor", () => {
  const lista = [
    autor({ codigo: "6011", tipo: "comissao", nome: "Comissão de Desenvolvimento Regional" }),
    autor({ codigo: "3611", nome: "Luiza Erundina", convenio_valido: 7e6 }),
    autor({ codigo: "1277", nome: "Wellington Roberto", convenio_valido: 68e6 }),
    autor({ codigo: "9999", nome: null }),
    autor({ codigo: "0001", nome: "Ângela" }),
    autor({ codigo: "7101", tipo: "bancada", nome: "Bancada da Paraíba" }),
    autor({ codigo: "8100", tipo: "relator", nome: "Relator-geral" }),
  ];
  const ordem = listaDaTela(lista, null).flatMap((g) => g.autores.map((a) => a.codigo));
  // todos caem em "sem canal" (nenhum valor de canal), menos os dois com convênio, que ficam no grupo deles
  assert.deepEqual(ordem, ["3611", "1277", "0001", "9999", "7101", "6011", "8100"]);
  // não muda a lista dada
  assert.equal(lista[0].codigo, "6011");
});

test("grupoDeDestino: a separação da lista só com as colunas de emd_autores", () => {
  assert.equal(grupoDeDestino(autor({ codigo: "1", municipios: 3 })), "publico");
  // Pix e FNS só vão a ente público, mesmo sem município (estado ou fundo estadual)
  assert.equal(grupoDeDestino(autor({ codigo: "1", pix_valido: 1 })), "publico");
  assert.equal(grupoDeDestino(autor({ codigo: "1", fns_valido: 1 })), "publico");
  // convênio sem município: entidade ou governo do estado (a ficha separa)
  assert.equal(grupoDeDestino(autor({ codigo: "1", convenio_valido: 10, favorecido_pago: 5 })), "convenio_sem_municipio");
  // só o pagamento direto, sem município atendido
  assert.equal(grupoDeDestino(autor({ codigo: "1", favorecido_pago: 5, convenio_indicado: 9 })), "entidade");
  // nenhum canal com valor (só catálogo, só proposta não válida, só pessoa física)
  assert.equal(grupoDeDestino(autor({ codigo: "1", catalogo_empenhado_pb: 100, convenio_indicado: 9, caducados: 1 })), "sem_canal");
});

test("listaDaTela: filtro de tipo, quatro grupos na ordem fixa, vazios inclusive", () => {
  const lista = [
    autor({ codigo: "1277", nome: "Wellington Roberto", municipios: 65 }),
    autor({ codigo: "3611", nome: "Luiza Erundina", convenio_valido: 7e6 }),
    autor({ codigo: "2000", nome: "Autor de fora", favorecido_pago: 1e5 }),
    autor({ codigo: "6011", tipo: "comissao", nome: "Comissão", municipios: 162 }),
  ];
  const todos = listaDaTela(lista, null);
  assert.deepEqual(
    todos.map((g) => g.id),
    GRUPOS_DESTINO.map((g) => g.id),
  );
  assert.deepEqual(
    todos.map((g) => g.autores.map((a) => a.codigo)),
    [["1277", "6011"], ["3611"], ["2000"], []],
  );
  const comissoes = listaDaTela(lista, "comissao");
  assert.deepEqual(
    comissoes.map((g) => g.autores.length),
    [1, 0, 0, 0],
  );
  assert.deepEqual(contarPorTipo(lista), { individual: 3, bancada: 0, comissao: 1, relator: 0, outro: 0 });
});

test("municipiosDe223 e periodoDoAutor", () => {
  assert.equal(TOTAL_MUNICIPIOS_PB, 223);
  assert.equal(municipiosDe223(65), "65 de 223");
  assert.equal(municipiosDe223(0), "nenhum");
  assert.equal(periodoDoAutor({ ano_min: 2015, ano_max: 2026 }), "2015 a 2026");
  assert.equal(periodoDoAutor({ ano_min: 2024, ano_max: 2024 }), "2024");
  assert.equal(periodoDoAutor({ ano_min: null, ano_max: 2023 }), "2023");
  assert.equal(periodoDoAutor({ ano_min: null, ano_max: null }), "—");
});

// ------------------------------------------------------------------ a ficha: abas, endereço e título

test("abaDoParlamentar: a pedida, se existir; senão Acesso", () => {
  assert.deepEqual(
    ABAS_PARLAMENTAR.map((a) => a.id),
    ["acesso", "destinacao", "execucao", "contexto"],
  );
  assert.equal(abaDoParlamentar("destinacao"), "destinacao");
  assert.equal(abaDoParlamentar(["execucao"]), "execucao");
  assert.equal(abaDoParlamentar("ranking"), "acesso");
  assert.equal(abaDoParlamentar(undefined), "acesso");
});

test("urlParlamentar: a aba de entrada sem ?aba=", () => {
  assert.equal(urlParlamentar("1277"), "/mapa/parlamentar/1277");
  assert.equal(urlParlamentar("1277", "acesso"), "/mapa/parlamentar/1277");
  assert.equal(urlParlamentar("1277", "contexto"), "/mapa/parlamentar/1277?aba=contexto");
});

test("títulos no padrão do Mapa, só com o que está no endereço", () => {
  assert.equal(tituloParlamentar("1277", "destinacao"), `Autor 1277 · Destinação · ${SUFIXO_DO_TITULO}`);
  assert.equal(tituloParlamentar("6011", "acesso"), `Autor 6011 · Acesso · ${SUFIXO_DO_TITULO}`);
  assert.equal(tituloParlamentar(null, "acesso"), `Autor de emendas · ${SUFIXO_DO_TITULO}`);
  assert.equal(tituloParlamentares(null), `Parlamentares · ${SUFIXO_DO_TITULO}`);
  assert.equal(tituloParlamentares("comissao"), `Parlamentares · Comissão · ${SUFIXO_DO_TITULO}`);
});

test("tipoDoEndereco (integração da onda 15): o título lê o ?tipo= antigo e o filtro da coluna Tipo com um tipo só", () => {
  assert.equal(tipoDoEndereco({ tipo: "bancada" }), "bancada");
  // A forma nova, como `urlParlamentares` grava: ida e volta.
  const novo = Object.fromEntries(new URL(`http://x${urlParlamentares("comissao")}`).searchParams);
  assert.equal(tipoDoEndereco(novo), "comissao");
  assert.equal(tituloParlamentares(tipoDoEndereco(novo)), `Parlamentares · Comissão · ${SUFIXO_DO_TITULO}`);
  // Sem acento e sem caixa também.
  assert.equal(tipoDoEndereco({ "t.parl.tipo": "comissao" }), "comissao");
  // Nenhum, lixo ou mais de um tipo: título genérico.
  assert.equal(tipoDoEndereco({}), null);
  assert.equal(tipoDoEndereco({ "t.parl.tipo": "qualquer" }), null);
  const dois = Object.fromEntries(new URL(`http://x${urlParlamentares("comissao")}`).searchParams);
  dois["t.parl.tipo"] = `${dois["t.parl.tipo"]},Bancada`;
  assert.equal(tipoDoEndereco(dois), null);
});

// ------------------------------------------------------------------ Acesso

const ANOS: AnoCanalEmendas[] = [
  { ano: 2023, canal: "pix", emendas: 2, indicado: 13e6, valido: 12e6, pago: 11e6, caducado: 0 },
  { ano: 2014, canal: "convenio", emendas: 3, indicado: 5e6, valido: 2e6, pago: 1.5e6, caducado: 1e6 },
  { ano: 2023, canal: "convenio", emendas: 1, indicado: 3e6, valido: 3e6, pago: 1e6, caducado: 0 },
  { ano: 2015, canal: "convenio", emendas: 2, indicado: 4e6, valido: 3e6, pago: 3e6, caducado: 0.5e6 },
  { ano: 2023, canal: "favorecido", emendas: 1, indicado: 0, valido: 0, pago: 2e5, caducado: 0 },
];

test("totaisPorCanal: soma por canal, na ordem dos canais, só os que existem", () => {
  const t = totaisPorCanal(ANOS);
  assert.deepEqual(
    t.map((x) => x.canal),
    ["convenio", "pix", "favorecido"],
  );
  assert.deepEqual(t[0], { canal: "convenio", emendas: 6, indicado: 12e6, valido: 8e6, pago: 5.5e6, caducado: 1.5e6 });
  assert.equal(soPago("favorecido"), true);
  assert.equal(soPago("pix"), false);
});

test("serieDoAcesso: o ano mais novo primeiro e, no ano, a ordem dos canais", () => {
  assert.deepEqual(
    serieDoAcesso(ANOS).map((l) => `${l.ano}-${l.canal}`),
    ["2023-convenio", "2023-pix", "2023-favorecido", "2015-convenio", "2014-convenio"],
  );
});

test("caducadosPorAno: só os anos com caducado, o mais novo primeiro, e o total", () => {
  assert.deepEqual(caducadosPorAno(ANOS), {
    linhas: [
      { ano: 2015, valor: 0.5e6 },
      { ano: 2014, valor: 1e6 },
    ],
    total: 1.5e6,
  });
  assert.deepEqual(caducadosPorAno([]), { linhas: [], total: 0 });
});

// ------------------------------------------------------------------ Destinação

test("linhasPorMunicipio: junta os canais por município, em ordem alfabética, com o pago por habitante", () => {
  const linhas = linhasPorMunicipio(
    [
      destino({ ibge: "2510808", canal: "pix", ente_tipo: "municipio", instrumentos: 2, indicado: 3e6, valido: 3e6, pago: 2e6 }),
      destino({ ibge: "2510808", canal: "convenio", ente_tipo: "municipio", instrumentos: 1, indicado: 1e6, valido: 1e6, pago: 1e6 }),
      destino({ ibge: "2513901", canal: "fns", ente_tipo: "fundo_municipal", indicado: 3e5, valido: 3e5, pago: 3e5 }),
      // só proposta caducada: aparece na tabela, mas não é atendido
      destino({ ibge: "2500106", canal: "convenio", indicado: 2e6, caducado: 2e6 }),
      // IBGE fora da base: o código no lugar do nome
      destino({ ibge: "2599999", canal: "convenio", valido: 1e5, pago: 0 }),
      destino({ ibge: null, canal: "convenio", ente_tipo: "estado", valido: 9e6 }),
    ],
    MUNICIPIOS,
  );
  assert.deepEqual(
    linhas.map((l) => l.nome),
    ["Água Branca", "IBGE 2599999", "Patos", "São José dos Cordeiros"],
  );
  const patos = linhas.find((l) => l.ibge === "2510808")!;
  assert.deepEqual(patos.canais, ["convenio", "pix"]);
  assert.equal(patos.instrumentos, 3);
  assert.equal(patos.pago, 3e6);
  assert.equal(patos.pagoPorHabitante, 30);
  assert.equal(patos.atendido, true);
  const agua = linhas.find((l) => l.ibge === "2500106")!;
  assert.equal(agua.atendido, false);
  assert.equal(agua.pagoPorHabitante, null);
  const fora = linhas.find((l) => l.ibge === "2599999")!;
  assert.equal(fora.atendido, true);
  assert.equal(fora.pagoPorHabitante, null);
  assert.equal(linhas.find((l) => l.ibge === "2513901")!.pagoPorHabitante, 100);

  // os não atendidos: os da base sem destino atendido, em ordem alfabética
  assert.deepEqual(
    naoAtendidos(linhas, MUNICIPIOS).map((m) => m.nome),
    ["Água Branca", "Campina Grande"],
  );
});

test("cortesDasFaixas e faixaDe: quartis entre os atendidos; o não atendido é a faixa 0", () => {
  assert.deepEqual(cortesDasFaixas([5, 1, 3]), []);
  assert.deepEqual(cortesDasFaixas([1, 2, 3, 4, 5, 6, 7, 8]), [2, 4, 6]);
  // valores repetidos não repetem o corte, e o corte no maior valor sai
  assert.deepEqual(cortesDasFaixas([1, 1, 1, 1]), []);
  assert.deepEqual(cortesDasFaixas([1, 1, 1, 9]), [1]);
  // zero e não finito não entram
  assert.deepEqual(cortesDasFaixas([0, Number.NaN, 1, 2, 3, 4]), [1, 2, 3]);

  const cortes = [2, 4, 6];
  assert.equal(faixaDe(null, cortes), 0);
  assert.equal(faixaDe(0, cortes), 0);
  assert.equal(faixaDe(1, cortes), 1);
  assert.equal(faixaDe(2, cortes), 1);
  assert.equal(faixaDe(3, cortes), 2);
  assert.equal(faixaDe(6, cortes), 3);
  assert.equal(faixaDe(100, cortes), 4);
  assert.equal(faixaDe(7, []), 1);

  const fmt = (v: number) => `R$ ${v}`;
  assert.deepEqual(rotulosDasFaixas(cortes, fmt), ["até R$ 2/hab.", "R$ 2 a R$ 4/hab.", "R$ 4 a R$ 6/hab.", "acima de R$ 6/hab."]);
  assert.deepEqual(rotulosDasFaixas([], fmt), ["com destino atendido"]);
});

test("resumoPorCanalETipo: o estadual e a entidade com sede, por canal e tipo; a sede conta município sem virar destino", () => {
  const r = resumoPorCanalETipo([
    destino({ ibge: "2507507", canal: "favorecido", ente_tipo: "osc", instrumentos: 2, pago: 5e5 }),
    destino({ ibge: "2504009", canal: "favorecido", ente_tipo: "osc", instrumentos: 1, pago: 1e5 }),
    destino({ ibge: "2504009", canal: "convenio", ente_tipo: "osc", instrumentos: 1, valido: 9e6, pago: 4e6 }),
    destino({ ibge: "2504009", canal: "favorecido", ente_tipo: "empresa", instrumentos: 1, pago: 2e4 }),
    destino({ ibge: null, canal: "pix", ente_tipo: "estado", instrumentos: 1, valido: 1e6, pago: 1e6 }),
  ]);
  assert.deepEqual(r, [
    { canal: "convenio", ente_tipo: "osc", instrumentos: 1, municipiosSede: 1, valido: 9e6, pago: 4e6 },
    { canal: "pix", ente_tipo: "estado", instrumentos: 1, municipiosSede: 0, valido: 1e6, pago: 1e6 },
    { canal: "favorecido", ente_tipo: "empresa", instrumentos: 1, municipiosSede: 1, valido: 0, pago: 2e4 },
    { canal: "favorecido", ente_tipo: "osc", instrumentos: 3, municipiosSede: 2, valido: 0, pago: 6e5 },
  ]);
});

// ------------------------------------------------------------------ números

test("porcento e reaisPorHabitante", () => {
  assert.equal(porcento(0.92), "92%");
  assert.equal(porcento(0.004), "0,4%");
  assert.equal(porcento(0), "0%");
  assert.equal(porcento(null), "—");
  assert.equal(porcento(Number.NaN), "—");
  assert.equal(reaisPorHabitante(35.6), "R$ 35,60");
  assert.equal(reaisPorHabitante(879.4), "R$ 879");
  assert.equal(reaisPorHabitante(1479), "R$ 1.479");
  assert.equal(reaisPorHabitante(null), "—");
});

// ------------------------------------------------------------------ as tabelas da ficha e do município (onda 15, fase 2, lote A, 13/10/2026)

function colunasValidas(colunas: { id: string }[]) {
  const ids = colunas.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, `id repetido em ${ids.join(", ")}`);
  for (const id of ids) assert.ok(idValido(id), id);
}

test("as emendas do município: as colunas de canal mudam com o município, com os ids da lista; o favorecido só tem o pago", () => {
  assert.ok(idValido(TABELA_EMENDAS_MUNICIPIO));
  assert.deepEqual(colunasDoCanal("convenio").map((c) => [c.id, c.titulo]), [["convenio-valido", "Convênio válido"], ["convenio-pago", "Convênio pago"]]);
  assert.deepEqual(colunasDoCanal("favorecido").map((c) => c.id), ["favorecido-pago"]);
  const colunas = colunasEmendasDoMunicipio(["convenio", "pix", "favorecido"]);
  colunasValidas(colunas);
  assert.deepEqual(colunas.map((c) => c.id), ["autor", "codigo", "tipo", "convenio-valido", "convenio-pago", "pix-valido", "pix-pago", "favorecido-pago"]);
  // Os ids dos canais são os mesmos da lista dos autores: o mesmo filtro serve nas duas telas.
  const daLista = new Set(COLUNAS_PARLAMENTARES.map((c) => c.id));
  assert.ok(colunas.filter((c) => c.tipo === "numero").every((c) => daLista.has(c.id)));
  assert.ok(colunas.every((c) => c.ordenavel !== false), "tela de administrador: toda coluna ordena");
  assert.equal(colunas.find((c) => c.id === "codigo")?.oculta, true);

  const canais = ["convenio", "pix", "favorecido"] as const;
  const v = valoresDoAutorNoMunicipio(
    { codigo: "1277", autor: { nome: "Wellington Roberto", tipo: "individual" }, canais: [{ canal: "convenio", valido: 5e5, pago: 0 }] },
    canais,
  );
  assert.deepEqual(v, {
    autor: "Wellington Roberto", codigo: "1277", tipo: "Individual",
    "convenio-valido": 5e5, "convenio-pago": 0, "pix-valido": null, "pix-pago": null, "favorecido-pago": null,
  }, "o canal sem valor fica vazio; o zero fica zero");
  const semAutor = valoresDoAutorNoMunicipio({ codigo: null, autor: null, canais: [{ canal: "fns", valido: 1, pago: 2 }] }, ["fns"]);
  assert.deepEqual([semAutor.autor, semAutor.codigo, semAutor.tipo], [SEM_AUTOR_FNS, null, null]);
  // O filtro de tipo acha o autor; o vazio (o FNS sem autor) fica fora do filtro ativo.
  const linhas: LinhaTabela[] = [
    { chave: "1277", valores: v, celulas: {} },
    { chave: "sem-autor", valores: valoresDoAutorNoMunicipio({ codigo: null, autor: null, canais: [] }, canais), celulas: {} },
  ];
  const estado = lerEstado(TABELA_EMENDAS_MUNICIPIO, colunas, new URLSearchParams("t.emendas-autor.tipo=individual"));
  assert.deepEqual(aplicar(colunas, linhas, estado).map((l) => l.chave), ["1277"]);
});

test("a ficha: série, municípios, à parte e safra; a coluna de baixo da célula vai oculta e filtra", () => {
  for (const t of [TABELA_SERIE_ACESSO, TABELA_DESTINO_MUNICIPIOS, TABELA_SAFRA, "estadual", "entidade"]) assert.ok(idValido(t), t);
  assert.equal(new Set([TABELA_SERIE_ACESSO, TABELA_DESTINO_MUNICIPIOS, TABELA_SAFRA, "estadual", "entidade"]).size, 5, "um prefixo por tabela da ficha");
  for (const c of [COLUNAS_SERIE_ACESSO, COLUNAS_DESTINO_MUNICIPIOS, COLUNAS_SAFRA, colunasAParte(false), colunasAParte(true)]) {
    colunasValidas(c);
    assert.ok(c.every((x) => x.ordenavel !== false), "tela de administrador: toda coluna ordena");
  }

  const serie = valoresDaSerie({ ano: 2024, canal: "favorecido", emendas: 2, indicado: 9, valido: 9, pago: 5, caducado: 0 });
  assert.deepEqual(serie, { ano: 2024, canal: "Pago ao favorecido", emendas: 2, indicado: null, valido: null, pago: 5, caducado: 0 }, "o favorecido não tem indicado nem válido");
  assert.equal(COLUNAS_SERIE_ACESSO.find((c) => c.id === "canal")?.oculta, true);

  const [patos] = linhasPorMunicipio([destino({ ibge: "2510808", canal: "pix", valido: 0, pago: 0, indicado: 10 })], MUNICIPIOS);
  const m = valoresDoDestinoMunicipio(patos);
  assert.equal(m.situacao, ROTULO_ATENDIDO.nao, "só proposta: a situação que a célula diz embaixo do nome vira categoria");
  assert.equal(m.canais, "Pix (transferência especial)");
  assert.deepEqual(Object.keys(m).sort(), COLUNAS_DESTINO_MUNICIPIOS.map((c) => c.id).sort());
  const porTexto = lerEstado(TABELA_DESTINO_MUNICIPIOS, COLUNAS_DESTINO_MUNICIPIOS, new URLSearchParams("t.destino.canais=pix"));
  assert.deepEqual(aplicar(COLUNAS_DESTINO_MUNICIPIOS, [{ chave: patos.ibge, valores: m, celulas: {} }], porTexto).length, 1, "canais é texto: «pix» acha a linha");

  const [est] = resumoPorCanalETipo([destino({ ibge: null, canal: "favorecido", ente_tipo: "estado", pago: 7 })]);
  assert.deepEqual(valoresDaLinhaAParte(est, false), { ente: "Governo do estado", canal: "Pago ao favorecido", instrumentos: 1, valido: null, pago: 7 });
  assert.deepEqual(colunasAParte(true).map((c) => c.id), ["ente", "canal", "instrumentos", "municipios-sede", "valido", "pago"]);
  assert.ok("municipios-sede" in valoresDaLinhaAParte(est, true));

  const safra = valoresDaSafra({ ano: 2023, canal: "convenio", validoAutor: 100, pagoAutor: 46, fracaoAutor: 0.46, fracaoPb: null });
  assert.deepEqual(safra, { safra: 2023, canal: "Convênio", "valido-autor": 100, "pago-autor": 46, "fracao-autor": 46, "fracao-pb": null }, "a fração em pontos percentuais, como a tela mostra");
  assert.match(COLUNAS_SAFRA.find((c) => c.id === "fracao-autor")?.titulo ?? "", /\(%\)$/);
});
