/**
 * O recorte da versão 2 do portal das emendas (17/11/2026): o endereço (CONTRATO §11), os argumentos do banco, a volta
 * da ficha sem redirecionamento aberto, os totais com a cobertura (ajuste A), a frase do período (ajuste B), os
 * instrumentos da emenda e a fonte oficial de cada um (ajuste C), e o arquivo do recorte com a coluna `ausencias`.
 * Os números de Patos são os da base real (execução 14; o protocolo de IMPLEMENTACAO-V2.md).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LinhaCatalogo, LinhaPublica } from "./emendas-publico.ts";
import {
  DICIONARIO_RECORTE,
  NAO_INFORMADO,
  argumentosDoRecorte,
  blocosDoRecorte,
  caixaDoContorno,
  camposDoInstrumento,
  coberturas,
  comp,
  consultaDoRecorte,
  csvDoRecorte,
  deSeguro,
  execucaoDaLinhaPb,
  execucaoNacional,
  exportado,
  faixaDaPagina,
  fonteDoInstrumento,
  fraseDaCobertura,
  fraseDoRealizado,
  fraseSemCatalogo,
  instrumentosDaEmenda,
  lerConsultaInstrumentos,
  lerOrigem,
  lerPeriodo,
  lerRecorte,
  mudar,
  nomeDoArquivoDoRecorte,
  notaDoPeriodo,
  paginasVisiveis,
  periodosDoSeletor,
  quantosFiltros,
  recorteDaListaAntiga,
  recorteVazio,
  registroDaLinha,
  rotuloDaVolta,
  rs,
  somar,
  suavizar,
  urlExportacao,
  urlFicha,
  urlRegistros,
  gruposDoFiltro,
  type Soma,
} from "./emendas-recorte.ts";

const ANO = 2026;
const sp = (q: string) => new URLSearchParams(q);

function linha(extra: Partial<LinhaPublica> = {}): LinhaPublica {
  return {
    linha: 1, ano: 2024, codigo: "202450070002", numero: "0002", tipo: "comissao", tipo_texto: "Emenda de Comissão", no_catalogo: true,
    autor_codigo: "5007", autor_nome: "COM. TURISMO", autor_tipo: "comissao", coletivo: true, canal: "convenio", instrumento: "960337",
    ano_pagamento: null, ente_tipo: "municipio", ente_nome: "MUNICIPIO DE PATOS", ente_cnpj: "09084815000170", ibge: "2510808",
    municipio: "Patos", uf: "PB", objeto: "Construção do Centro de Eventos", objeto_fonte: "convenio", funcao: "Comércio e Serviços",
    subfuncao: "Turismo", programa: null, acao: null, previsto: 1000, empenhado: 1000, pago: 400, n_autores: 1, etapa: "execucao",
    situacao: "Em execução", caducou_em: null, dt_assinatura: "2024-12-20", dt_primeiro_pagamento: "2025-03-01", dt_ultimo_pagamento: "2025-06-01",
    concedente: "MINISTERIO DO TURISMO", orgao: null, vigencia_inicio: "2024-12-20", vigencia_fim: "2026-12-20", convenio_repasse: 1000,
    convenio_desembolsado: 400, valor_global: 1100, contrapartida: 100, fisico: 0.62, pix_area: null, pix_custeio: null,
    pix_investimento: null, pix_fim_execucao: null, fns_tipo_recurso: null,
    ...extra,
  };
}

// ================================================================ o endereço

test("endereço: o recorte lido e escrito volta igual, na ordem do dicionário; o padrão não vai ao endereço", () => {
  const q = "municipio=2510808&periodo=2023-2026&canal=convenio&ordem=-realizado&pagina=2";
  const r = lerRecorte(sp(q), ANO);
  assert.equal(consultaDoRecorte(r), q);
  assert.equal(urlRegistros(r), `/emendas/registros?${q}`);
  assert.equal(consultaDoRecorte(lerRecorte(sp(""), ANO)), "periodo=2023-2026", "o período padrão: os quatro anos mais recentes");
  const bagunca = lerRecorte(sp("canal=direto,convenio&canal=convenio&q=%20%20centro%20%20de%20eventos&periodo=2026-2023&por=20&pagina=1&destinatario=empresas,prefeitura,xyz"), ANO);
  assert.equal(consultaDoRecorte(bagunca), "periodo=2023-2026&canal=convenio,direto&destinatario=prefeitura,empresas&q=centro%20de%20eventos");
  assert.equal(lerRecorte(sp("municipio=3550308"), ANO).municipio, null, "só município da PB");
  assert.deepEqual(lerRecorte(sp("periodo=2023-2026&ano=2022,2024,abc"), ANO).ano, [2024], "o ano isolado só dentro do período");
  assert.deepEqual(lerRecorte(sp("ordem=-objeto"), ANO).ordem, { campo: "codigo", desc: false }, "ordem fora do dicionário vira o padrão");
  assert.equal(lerRecorte(sp("por=7"), ANO).por, 20);
  assert.equal(lerRecorte(sp("pagina=0"), ANO).pagina, 1);
  assert.equal(quantosFiltros(lerRecorte(sp("canal=convenio&autoria=5007&q=x"), ANO)), 3);
});

test("período: é o ano da emenda; fora dos limites vira o limite; invertido desvira; o formulário personalizado também", () => {
  assert.deepEqual(lerPeriodo("2014-2030", ANO), { de: 2019, ate: 2026 });
  assert.deepEqual(lerPeriodo("2024", ANO), { de: 2024, ate: 2024 });
  assert.deepEqual(lerPeriodo("lixo", ANO), { de: 2023, ate: 2026 });
  assert.deepEqual(lerRecorte(sp("ano_de=2020&ano_ate=2021"), ANO).periodo, { de: 2020, ate: 2021 });
  assert.deepEqual(periodosDoSeletor(ANO).map((p) => [p.id, p.rotulo]), [
    ["2023-2026", "2023–2026"],
    ["2019-2022", "2019–2022"],
    ["2019-2026", "Toda a série (2019–2026)"],
  ]);
});

test("ajuste B: a frase diz o ano da emenda e o realizado até a data de referência", () => {
  assert.equal(
    fraseDoRealizado({ de: 2023, ate: 2026 }, 44_133_807.49, "em Patos", "2026-11-13T19:24:48+00:00"),
    "Emendas de 2023 a 2026: R$ 44,13 mi pagos a destinatários em Patos até 13/11/2026",
  );
  assert.equal(notaDoPeriodo({ de: 2024, ate: 2024 }, "2026-11-13T19:24:48+00:00"), "emendas de 2024; valores até 13/11/2026");
});

test("banco: os argumentos de emd_pub_linhas saem do recorte (forma, destinatário, função, tipo, autoria, ano, busca, ordem, página)", () => {
  const r = lerRecorte(sp("municipio=2510808&periodo=2023-2026&canal=especial,direto&destinatario=empresas&funcao=assistencia-social,nao-localizado-na-fonte&tipo=individual-especial&autoria=3530&ano=2024&q=centro&ordem=-realizado&pagina=2"), ANO);
  const a = argumentosDoRecorte(r, faixaDaPagina(r));
  assert.deepEqual(a, {
    p_ano_de: 2023, p_ano_ate: 2026, p_ibge: "2510808", p_canal: ["pix", "favorecido"], p_ente_tipo: ["empresa", "consorcio", "orgao_federal", "outro", ""],
    p_funcao: ["assistencia social", ""], p_tipo: ["individual_especial"], p_autores: ["3530"], p_anos: [2024], p_busca: ["%centro%"],
    p_ordem: "pago", p_desc: true, p_limite: 20, p_deslocamento: 20,
  });
  assert.equal(argumentosDoRecorte(recorteVazio({ de: 2023, ate: 2026 }), { limite: 1, deslocamento: 0 }).p_ordem, "codigo", "a ordem padrão é o código");
});

test("exportação: o arquivo do recorte tem os mesmos parâmetros e a mesma ordem da tela, sem a página", () => {
  const r = lerRecorte(sp("municipio=2510808&periodo=2023-2026&ordem=-realizado&pagina=2&por=20"), ANO);
  assert.equal(urlExportacao(r, "json"), "/emendas/dados/recorte.json?municipio=2510808&periodo=2023-2026&ordem=-realizado");
  assert.equal(nomeDoArquivoDoRecorte(mudar(r, { canal: ["convenio"] }), "Patos", "csv"), "emendas_patos-2510808_2023-2026_1-filtro.csv");
});

// ================================================================ a volta da ficha

test("volta: o `de` só aceita caminho do portal; nada de esquema, //, \\, segmentos . e .., controle", () => {
  for (const ok of ["/emendas", "/emendas/registros?municipio=2510808&periodo=2023-2026#linha-3474", "/emendas/municipios/2510808?periodo=2023-2026", "/emendas?periodo=2023-2026"])
    assert.equal(deSeguro(ok), ok, ok);
  for (const ruim of ["//exemplo.com/x", "https://exemplo.com/emendas", "/emendas//exemplo.com", "/emendas/\\exemplo.com", "/emendasx", "/emendas/../mapa", "/emendas/%2e%2e/mapa", "/emendas/registros\nx", "javascript:alert(1)", "/mapa", "", null])
    assert.equal(deSeguro(ruim), null, String(ruim));
  assert.equal(urlFicha("202450070002", "/emendas/registros?periodo=2023-2026"), "/emendas/emenda/202450070002?de=%2Femendas%2Fregistros%3Fperiodo%3D2023-2026");
});

test("volta: o rótulo diz de onde veio, com os filtros e a ordem; o foco vem do fragmento", () => {
  const nome = (i: string) => (i === "2510808" ? "Patos" : null);
  const o = lerOrigem("/emendas/registros?municipio=2510808&periodo=2023-2026&canal=convenio&ordem=-realizado#linha-3474", ANO);
  assert.equal(o?.tela, "registros");
  assert.equal(o && o.tela === "registros" ? o.foco : null, 3474);
  assert.equal(rotuloDaVolta(o, nome), "← Voltar aos registros de Patos (1 filtro, ordem: realizado decrescente)");
  assert.equal(rotuloDaVolta(lerOrigem("/emendas/registros?periodo=2023-2026", ANO), nome), "← Voltar aos registros da Paraíba (sem filtros, ordem: emenda)");
  assert.equal(rotuloDaVolta(lerOrigem("/emendas/municipios/2510808?periodo=2019-2026", ANO), nome), "← Voltar a Patos");
  assert.equal(rotuloDaVolta(lerOrigem("//exemplo.com", ANO), nome), "← Voltar ao início");
});

// ================================================================ ajuste A: cobertura

const PATOS: Soma = { registros: 44, emendas: 40, previsto: 59_788_001, comPrevisto: 32, empenhado: 37_191_410, comEmpenhado: 13, realizado: 44_133_807.49 };

test("ajuste A: todo total de medida parcial diz a cobertura e por que falta; nunca trata a falta como zero", () => {
  const c = coberturas(PATOS);
  assert.equal(fraseDaCobertura("Previsto", c.previsto), "Previsto: R$ 59,79 mi em 32 dos 44 registros · o pagamento direto não traz previsto na fonte");
  assert.equal(fraseDaCobertura("Empenhado", c.empenhado), "Empenhado: R$ 37,19 mi em 13 dos 44 registros · o fundo a fundo e o pagamento direto não trazem empenho");
  const conv = coberturas({ ...PATOS, registros: 6, comPrevisto: 6, comEmpenhado: 6 }, ["convenio"]);
  assert.equal(conv.previsto.cobertura, null, "cobertura total: sem nota");
  assert.equal(conv.previsto.porque, null);
  const saude = coberturas({ registros: 19, emendas: 18, previsto: 22_596_591, comPrevisto: 19, empenhado: 0, comEmpenhado: 0, realizado: 22_596_591 }, ["saude"]);
  assert.equal(saude.empenhado.valor, NAO_INFORMADO, "nenhum registro com empenho: não é R$ 0,00");
  assert.equal(saude.empenhado.porque, "o fundo a fundo não traz empenho");
  assert.equal(coberturas({ ...PATOS, registros: 0 }).previsto.valor, "nenhum registro");
});

test("somar: o nulo não vira zero (conta só quem tem a medida); zero é valor", () => {
  const s = somar([linha(), linha({ codigo: "202650490001", canal: "favorecido", previsto: null, empenhado: null, pago: 0 }), linha({ canal: "fns", empenhado: null, previsto: 50, pago: 50 })]);
  assert.deepEqual(s, { registros: 3, emendas: 2, previsto: 1050, comPrevisto: 2, empenhado: 1000, comEmpenhado: 1, realizado: 450 });
});

// ================================================================ o registro e o arquivo

test("registro: as colunas da tela, as ausências por campo, o MEI omitido e a prefeitura pelo nome do município", () => {
  const r = registroDaLinha(linha({ canal: "favorecido", previsto: null, empenhado: null, objeto: null, pago: 0, ano_pagamento: 2026, ente_tipo: "empresa", ente_nome: "12345678 FULANA DE TAL" }));
  assert.equal(r.canal, "direto");
  assert.equal(r.destinatario, "Microempreendedor individual (nome omitido)");
  assert.equal(r.anoPagamento, 2026);
  assert.deepEqual(r.ausencias, ["previsto: não informado pela fonte", "empenhado: não informado pela fonte", "finalidade: não informado pela fonte"]);
  assert.ok(!r.ausencias.some((a) => a.startsWith("realizado")), "zero é valor");
  assert.equal(registroDaLinha(linha()).destinatario, "Município de Patos");
  assert.equal(registroDaLinha(linha()).instrumentoRotulo, "Instrumento nº 960337");
  assert.equal(registroDaLinha(linha({ etapa: "caducou", situacao: null, ano: 2023 })).situacao, "Proposta não assinada até 31/12/2024");
  const e = exportado(r);
  assert.equal(e.ausencias, "previsto: não informado pela fonte | empenhado: não informado pela fonte | finalidade: não informado pela fonte");
  assert.equal(e.realizado, 0);
});

test("arquivo do recorte: o cabeçalho é o dicionário, vírgula decimal, identificador intacto, a coluna ausencias", () => {
  const csv = csvDoRecorte([exportado(registroDaLinha(linha({ pago: 10280311.3 })))]);
  const [cab, l1] = csv.replace(/^﻿/, "").split("\r\n");
  assert.equal(cab, DICIONARIO_RECORTE.map((d) => d.campo).join(";"));
  assert.ok(cab.includes("realizado") && cab.endsWith("ausencias"));
  assert.ok(l1.includes("10280311,3"), l1);
  assert.ok(l1.startsWith('"=""202450070002"""'), "o código da emenda como texto no Excel");
});

// ================================================================ os blocos do município

test("blocos: os quatro canais sempre (com nenhum registro), todos os anos do período, o Estado fora do município", () => {
  const b = blocosDoRecorte(
    [linha(), linha({ linha: 2, codigo: "202435300009", canal: "pix", autor_codigo: "3530", autor_nome: "DAMIAO FELICIANO", coletivo: false, ano: 2024 }), linha({ linha: 3, no_catalogo: false, funcao: null, codigo: "202612710004", ano: 2026 })],
    { de: 2023, ate: 2026 },
    false,
  );
  assert.deepEqual(b.canais.map((c) => [c.id, c.soma.registros]), [["convenio", 2], ["especial", 1], ["saude", 0], ["direto", 0]]);
  assert.deepEqual(b.anos.map((a) => a.ano), [2023, 2024, 2025, 2026]);
  assert.ok(!b.destinatarios.some((d) => d.id === "estado"));
  assert.deepEqual(b.autorias.map((a) => a.nome), ["Comissão de Turismo", "Damião Feliciano"], "em ordem alfabética, nunca por valor");
  assert.equal(fraseSemCatalogo(b.semCatalogo), "Tipo e função não localizados na fonte para 1 emenda de 2026.");
  assert.equal(b.convenios, 2);
  assert.equal(b.comFisico, 2);
});

// ================================================================ ajuste C: os instrumentos e as fontes

test("instrumentos: todos os da emenda na PB; o município do recorte no topo; busca, ordem e página", () => {
  const xs = Array.from({ length: 24 }, (_, i) =>
    linha({ linha: i + 1, ibge: i === 17 ? "2510808" : `25${String(10000 + i).slice(1)}`, municipio: i === 17 ? "Patos" : `Município ${String.fromCharCode(65 + i)}`, instrumento: String(960000 + i), pago: i * 10 }),
  );
  const a = instrumentosDaEmenda(xs, "2510808", lerConsultaInstrumentos(sp("")));
  assert.equal(a.total, 24);
  assert.equal(a.itens[0].municipio, "Patos", "o do recorte no topo");
  assert.equal(a.itens.length, 20);
  assert.equal(a.paginas, 2);
  const b = instrumentosDaEmenda(xs, "2510808", lerConsultaInstrumentos(sp("iordem=-realizado&ipagina=2")));
  assert.equal(b.itens.length, 4);
  assert.equal(b.pagina, 2);
  const c = instrumentosDaEmenda(xs, null, lerConsultaInstrumentos(sp("iq=960003")));
  assert.equal(c.filtrados, 1);
  assert.equal(c.itens[0].instrumento, "960003");
});

test("fontes oficiais: convênio e emenda com endereço direto; especial e FNS com o número escrito (sem link direto)", () => {
  assert.equal(
    fonteDoInstrumento(linha()).href,
    "https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarProposta/ResultadoDaConsultaDeConvenioSelecionarConvenio.do?sequencialConvenio=960337&Usr=guest&Pwd=guest",
  );
  const pix = fonteDoInstrumento(linha({ canal: "pix", instrumento: "65837" }));
  assert.deepEqual([pix.texto, pix.href, pix.numero], ["Consulte o plano de ação nº 65837", "https://especiais.transferegov.sistema.gov.br/", "65837"]);
  const fns = fonteDoInstrumento(linha({ canal: "fns", instrumento: "36000717056202500" }));
  assert.deepEqual([fns.texto, fns.href, fns.numero], ["Consulte a proposta nº 36000717056202500", "https://consultafns.saude.gov.br/", "36000717056202500"]);
  assert.equal(fonteDoInstrumento(linha({ canal: "favorecido", codigo: "202650490001" })).href, "https://portaldatransparencia.gov.br/emendas/detalhe?codigoEmenda=202650490001");
});

test("detalhe do instrumento: o físico só no convênio; no pagamento direto 'não se aplica'; o FNS não traz empenho", () => {
  const conv = camposDoInstrumento(linha());
  assert.equal(conv.find((c) => c.rotulo === "Execução física atestada")?.valor, "62,0%");
  assert.equal(conv.find((c) => c.rotulo === "Contrapartida")?.valor, "R$ 100,00");
  assert.equal(conv.find((c) => c.rotulo === "Valor global")?.valor, "R$ 1.100,00");
  const dir = camposDoInstrumento(linha({ canal: "favorecido", previsto: null, empenhado: null, ano_pagamento: 2026 }));
  assert.equal(dir.find((c) => c.rotulo === "Execução física")?.valor, "não se aplica");
  assert.equal(dir.find((c) => c.rotulo === "Ano do pagamento")?.valor, "2026");
  const fns = camposDoInstrumento(linha({ canal: "fns", empenhado: null }));
  assert.equal(fns.find((c) => c.rotulo === "Empenhado")?.valor, NAO_INFORMADO);
});

test("execução orçamentária: a nacional à parte (nunca somada à PB); a linha da PB só quando a localidade é a PB", () => {
  const cat = (extra: Partial<LinhaCatalogo>): LinhaCatalogo => ({
    codigo: "202450070002", linha: 1, ano: 2024, tipo: "comissao", tipo_texto: null, autor_codigo: "5007", autor_nome: null, numero: "0002",
    localidade: "MÚLTIPLO", uf: null, ibge: null, pb_localidade: false, funcao: null, subfuncao: null, programa: null, acao: null,
    empenhado: null, liquidado: null, pago: null, rp_pago: null, rp_cancelado: null, pago_total: null, a_pagar: null,
    nacional_empenhado: 668_379_249.02, nacional_liquidado: 4_092_326, nacional_pago: 4_075_004.15, nacional_rp_pago: 210_450_658.82,
    nacional_rp_cancelado: 10_485_381.69, nacional_a_pagar: 443_368_204.36, localidades: 1,
    ...extra,
  });
  const n = execucaoNacional([cat({})]);
  assert.equal(n?.degraus.length, 6);
  assert.equal(n?.pagoTotal, 214_525_662.97);
  assert.equal(execucaoDaLinhaPb([cat({})]), null, "Múltiplo: sem linha só da PB");
  const pb = execucaoDaLinhaPb([cat({ pb_localidade: true, empenhado: 300, liquidado: 300, pago: 100, rp_pago: 20, rp_cancelado: 0, a_pagar: 180 })]);
  assert.equal(pb?.pagoTotal, 120);
});

// ================================================================ miudezas

test("grafia, números, páginas, contorno e o endereço velho da lista", () => {
  assert.equal(suavizar("MUNICIPIO DE SAO BENTO"), "Município de São Bento");
  assert.equal(suavizar("Já tem minúscula"), "Já tem minúscula");
  assert.equal(comp(44_133_807.49), "R$ 44,13 mi");
  assert.equal(comp(4_086_475_124.13), "R$ 4,09 bi");
  assert.equal(comp(0), "R$ 0,00");
  assert.equal(rs(10_280_311.3), "R$ 10.280.311,30");
  assert.deepEqual(paginasVisiveis(1, 3), [1, 2, 3]);
  assert.deepEqual(paginasVisiveis(10, 20), [1, null, 8, 9, 10, 11, 12, null, 20]);
  assert.deepEqual(caixaDoContorno("M10 20L30 5L15 40Z"), { x0: 10, y0: 5, x1: 30, y1: 40, cx: 20, cy: 22.5 });
  const velho = recorteDaListaAntiga(sp("q=patos&t.emendas.forma=Pagamento%20direto%20ao%20favorecido&t.emendas.o=pago.desc"), ANO);
  assert.equal(consultaDoRecorte(velho), "periodo=2019-2026&canal=direto&q=patos&ordem=-realizado");
});

test("painel Filtrar: contagem ao lado de cada opção, ordem fixa ou alfabética (nunca por valor), marcada aparece mesmo com zero", () => {
  const r = lerRecorte(sp("municipio=2510808&periodo=2023-2026&autoria=9999&funcao=saude"), ANO);
  const g = gruposDoFiltro(
    [
      { grupo: "canal", chave: "fns", rotulo: null, registros: 19 },
      { grupo: "canal", chave: "convenio", rotulo: null, registros: 6 },
      { grupo: "ente_tipo", chave: "municipio", rotulo: null, registros: 16 },
      { grupo: "ente_tipo", chave: "empresa", rotulo: null, registros: 3 },
      { grupo: "ente_tipo", chave: "", rotulo: null, registros: 1 },
      { grupo: "funcao", chave: "urbanismo", rotulo: "Urbanismo", registros: 40 },
      { grupo: "funcao", chave: "saude", rotulo: "Saúde", registros: 2 },
      { grupo: "autoria", chave: "5007", rotulo: "COM. TURISMO", registros: 3 },
      { grupo: "autoria", chave: "3530", rotulo: "DAMIAO FELICIANO", registros: 30 },
      { grupo: "ano", chave: "2024", rotulo: null, registros: 10 },
    ],
    r,
  );
  const grupo = (nome: string) => g.find((x) => x.nome === nome)!;
  assert.deepEqual(grupo("canal").opcoes.map((o) => [o.valor, o.registros]), [["convenio", 6], ["especial", 0], ["saude", 19], ["direto", 0]], "ordem fixa, as quatro");
  assert.deepEqual(grupo("destinatario").opcoes.map((o) => [o.valor, o.registros]), [["prefeitura", 16], ["empresas", 4]], "empresas e outros soma o tipo vazio");
  assert.deepEqual(grupo("funcao").opcoes.map((o) => [o.rotulo, o.marcada]), [["Saúde", true], ["Urbanismo", false]], "alfabética, não pelo valor");
  assert.deepEqual(grupo("autoria").opcoes.map((o) => [o.rotulo, o.registros, o.marcada]), [["Comissão de Turismo", 3, false], ["Damião Feliciano", 30, false], ["não localizado na fonte", 0, true]], "alfabética; a marcada sem registro continua, para desmarcar");
  assert.deepEqual(grupo("ano").opcoes.map((o) => [o.valor, o.registros]), [["2023", 0], ["2024", 10], ["2025", 0], ["2026", 0]]);
  assert.equal(gruposDoFiltro(null, r)[0].opcoes[0].registros, null, "sem as contagens, o painel sai sem números");
});
