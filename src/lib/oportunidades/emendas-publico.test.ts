/**
 * Testes da lógica pura do portal público das emendas federais na PB (17/11/2026). `node --test`, TypeScript executado
 * direto pelo Node 24. A lista branca do servidor e da migração está em `emendas-publico.server.test.ts`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROTULO_ETAPA_LAUDO } from "./diagnostico.ts";
import {
  ARQUIVOS,
  AUTOAVALIACAO_PNTP,
  COOKIES_DO_PORTAL,
  CAMPOS_PROIBIDOS,
  CATALOGO_BRUTO,
  COLUNAS_AGREGADO,
  COLUNAS_AUTOR,
  COLUNAS_CATALOGO,
  COLUNAS_EXECUCAO,
  COLUNAS_LINHA,
  COLUNAS_LISTA,
  COLUNAS_MUNICIPIO,
  COLUNAS_PF,
  DICIONARIO_CATALOGO,
  DICIONARIO_LINHAS,
  DICIONARIO_PF,
  ETAPAS,
  FUNCAO_NAO_CONSTA,
  NOME_MEI_OMITIDO,
  POR_PAGINA,
  ROTULO_ETAPA,
  ROTULO_FORMA,
  ROTULO_TIPO_EMENDA,
  TIPO_NAO_IDENTIFICADO,
  anoDeBrasilia,
  anosDosArquivos,
  aplicarPedido,
  argumentosDaLista,
  arquivoDoEndereco,
  codigoEmendaDaUrl,
  codigoLegivel,
  comoCitar,
  fraseDasDatas,
  consultaDoAno,
  csvDe,
  descreverConsulta,
  execucaoNaPb,
  ibgeDaUrl,
  identificacaoDaEmenda,
  jsonDe,
  largura,
  lerConsulta,
  lerPreferencias,
  lerRecorteFixo,
  linhaSegura,
  mascararCpf,
  metadados,
  moeda,
  moedaCurta,
  nomeDoArquivo,
  nomePublicoDoEnte,
  opcoesDaLista,
  padroesDeTexto,
  paginaDaLista,
  parametrosDoEndereco,
  porFuncao,
  rotuloEtapa,
  separarAutores,
  separarMunicipios,
  serieAnual,
  situacaoDaFonte,
  somaDasLinhas,
  totalDePaginas,
  urlComConsulta,
  urlDaListaFiltrada,
  urlDoArquivoDoAno,
  urlDoRecorte,
  valoresDaLinha,
  voltaSegura,
  type AgregadoPublico,
  type AutorPublico,
  type ConsultaLista,
  type LinhaCatalogo,
  type LinhaPublica,
  type MunicipioPublico,
} from "./emendas-publico.ts";
import { ESTADO_VAZIO } from "./tabela-filtro.ts";

const aqui = path.dirname(fileURLToPath(import.meta.url));

function linha(extra: Partial<LinhaPublica> = {}): LinhaPublica {
  return {
    linha: 1,
    ano: 2024,
    codigo: "202412770001",
    numero: "0001",
    tipo: "individual_finalidade",
    tipo_texto: "Emenda Individual - Transferências com Finalidade Definida",
    no_catalogo: true,
    autor_codigo: "1277",
    autor_nome: "FULANO DE TAL",
    autor_tipo: "individual",
    coletivo: false,
    canal: "convenio",
    instrumento: "900001",
    ano_pagamento: null,
    ente_tipo: "municipio",
    ente_nome: "MUNICIPIO DE JOAO PESSOA",
    ente_cnpj: "08778326000156",
    ibge: "2507507",
    municipio: "João Pessoa",
    uf: "PB",
    objeto: "PAVIMENTAÇÃO",
    objeto_fonte: "convenio",
    funcao: "Urbanismo",
    subfuncao: null,
    programa: null,
    acao: null,
    previsto: 1000,
    empenhado: 1000,
    pago: 600.5,
    n_autores: 1,
    etapa: "execucao",
    situacao: "Em execução",
    caducou_em: null,
    dt_assinatura: "2024-06-10",
    dt_primeiro_pagamento: null,
    dt_ultimo_pagamento: null,
    concedente: "MINISTÉRIO DAS CIDADES",
    orgao: null,
    vigencia_inicio: null,
    vigencia_fim: "2026-06-10",
    convenio_repasse: 975000,
    convenio_desembolsado: 600000,
    valor_global: 1000000,
    contrapartida: 25000,
    fisico: 0.62,
    pix_area: null,
    pix_custeio: null,
    pix_investimento: null,
    pix_fim_execucao: null,
    fns_tipo_recurso: null,
    ...extra,
  };
}

const consulta = (sp: string): ConsultaLista => lerConsulta(new URLSearchParams(sp));

// ================================================================ a lista branca

test("lista branca: nenhuma coluna pedida ao banco é proibida, e as do 17.1 estão todas lá", () => {
  const todas = [...COLUNAS_LINHA, ...COLUNAS_AGREGADO, ...COLUNAS_CATALOGO, ...COLUNAS_PF, ...COLUNAS_AUTOR, ...COLUNAS_MUNICIPIO, ...COLUNAS_EXECUCAO];
  for (const c of todas) assert.ok(!(CAMPOS_PROIBIDOS as readonly string[]).includes(c), `${c} é proibida`);
  for (const c of todas) assert.ok(!CATALOGO_BRUTO.test(c), `${c}: catálogo bruto`);
  // 17.1: origem (canal, concedente), forma de repasse, tipo, número, autoria, previsto, realizado, objeto e função.
  for (const c of ["canal", "concedente", "tipo", "tipo_texto", "numero", "codigo", "autor_nome", "previsto", "pago", "objeto", "funcao"]) {
    assert.ok((COLUNAS_LINHA as readonly string[]).includes(c), `${c} falta`);
  }
  // 17.3: a execução orçamentária do catálogo.
  for (const c of ["empenhado", "liquidado", "pago", "rp_pago", "rp_cancelado", "pago_total", "a_pagar"]) {
    assert.ok((COLUNAS_CATALOGO as readonly string[]).includes(c), `${c} falta`);
  }
  assert.ok(!(COLUNAS_CATALOGO as readonly string[]).includes("rp_inscrito"), "o rp_inscrito não se soma e não sai");
});

test("dicionários: cada campo é uma coluna pedida, nenhum é proibido e a linha da execução não vai ao arquivo", () => {
  for (const d of DICIONARIO_LINHAS) assert.ok((COLUNAS_LINHA as readonly string[]).includes(d.campo), d.campo);
  for (const d of DICIONARIO_CATALOGO) assert.ok((COLUNAS_CATALOGO as readonly string[]).includes(d.campo), d.campo);
  for (const d of DICIONARIO_PF) assert.ok((COLUNAS_PF as readonly string[]).includes(d.campo), d.campo);
  for (const d of [...DICIONARIO_LINHAS, ...DICIONARIO_CATALOGO, ...DICIONARIO_PF]) {
    assert.ok(!(CAMPOS_PROIBIDOS as readonly string[]).includes(d.campo), d.campo);
    assert.ok(d.descricao.length > 10, `${d.campo} sem descrição`);
  }
  assert.ok(!DICIONARIO_LINHAS.some((d) => d.campo === "linha"), "a linha muda a cada execução: não é identificador");
  assert.equal(new Set(DICIONARIO_LINHAS.map((d) => d.campo)).size, DICIONARIO_LINHAS.length, "sem campo repetido");
});

// ================================================================ privacidade

test("MEI: a razão social que começa pela raiz do CNPJ vira 'nome omitido'; o resto fica, com o CPF mascarado", () => {
  assert.equal(nomePublicoDoEnte("49.680.467 JOSE LEANDRO DA SILVA MEDEIROS"), NOME_MEI_OMITIDO);
  assert.equal(nomePublicoDoEnte("49680467 JOSE LEANDRO"), NOME_MEI_OMITIDO);
  assert.equal(nomePublicoDoEnte("  12.345.678 MARIA"), NOME_MEI_OMITIDO);
  assert.equal(nomePublicoDoEnte("MUNICIPIO DE PATOS"), "MUNICIPIO DE PATOS");
  assert.equal(nomePublicoDoEnte("12345678000190 LTDA"), "12345678000190 LTDA", "CNPJ inteiro no começo não é a raiz seguida de nome");
  assert.equal(nomePublicoDoEnte("CNPJ 12.345.678/0001-90 COMERCIO"), "CNPJ 12.345.678/0001-90 COMERCIO");
  assert.equal(nomePublicoDoEnte("JOSE DA SILVA 123.456.789-09"), "JOSE DA SILVA ***.***.***-**");
  assert.equal(nomePublicoDoEnte(null), null);
});

test("CPF: o formato com e sem pontuação é mascarado; CNPJ e número maior, não", () => {
  assert.equal(mascararCpf("a 123.456.789-09 b 12345678909 c"), "a ***.***.***-** b ***.***.***-** c");
  assert.equal(mascararCpf("CNPJ 12345678000190"), "CNPJ 12345678000190");
  assert.equal(mascararCpf("processo 25000.123456/2020-11"), "processo 25000.123456/2020-11");
  const l = linhaSegura(linha({ ente_nome: "49.680.467 FULANA", objeto: "pago a 111.222.333-44" }));
  assert.equal(l.ente_nome, NOME_MEI_OMITIDO);
  assert.equal(l.objeto, "pago a ***.***.***-**");
  assert.equal(valoresDaLinha(linha({ ente_nome: "49680467 FULANA" })).destino, NOME_MEI_OMITIDO, "o valor da tabela (filtro e CSV da tela) também");
});

test("busca: sem acento, minúsculas, curingas escapados; número com formato de CPF não vira busca", () => {
  assert.deepEqual(padroesDeTexto("  Pavimentação  JOÃO "), ["%pavimentacao%", "%joao%"]);
  assert.deepEqual(padroesDeTexto("50% a_b"), ["%50\\%%", "%a\\_b%"]);
  assert.equal(padroesDeTexto("123.456.789-09"), null);
  assert.deepEqual(padroesDeTexto("12345678909 patos"), ["%patos%"]);
  assert.deepEqual(padroesDeTexto("08778326000156"), ["%08778326000156%"], "CNPJ busca");
  assert.equal(padroesDeTexto("   "), null);
  assert.equal(padroesDeTexto("a b c d e f g h i j")?.length, 8, "no máximo 8 palavras");
});

// ================================================================ rótulos

test("rótulos: as etapas do convênio são as do laudo; o caducou diz a data; o tipo sem dado é 'Não identificado'", () => {
  for (const [k, v] of Object.entries(ROTULO_ETAPA_LAUDO)) assert.equal(ROTULO_ETAPA[k as keyof typeof ROTULO_ETAPA], v, k);
  assert.equal(rotuloEtapa("caducou", 2024), "Proposta não assinada até 31/12/2025");
  assert.equal(rotuloEtapa("caducou", null), ROTULO_ETAPA.caducou);
  assert.equal(rotuloEtapa(null), "Não consta registro");
  assert.equal(ROTULO_FORMA.pix, "Transferência especial");
  assert.equal(ROTULO_FORMA.favorecido, "Pagamento direto ao favorecido");
  assert.equal(situacaoDaFonte(linha({ etapa: "execucao", situacao: "Em execução" })), null, "não repete o rótulo");
  assert.equal(situacaoDaFonte(linha({ etapa: "pago", situacao: "CIENTE" })), "CIENTE");
  assert.equal(situacaoDaFonte(linha({ situacao: null })), null);
  assert.equal(codigoLegivel("202412770015"), "2024 1277 0015");
  assert.equal(codigoLegivel(null), "—");
});

test("textos neutros: nenhum 'irregular', 'melhor', 'pior' nem 'ranking' nos textos do portal", () => {
  const arquivos = [path.join(aqui, "emendas-publico.ts")];
  const app = path.join(aqui, "..", "..", "app", "emendas");
  const andar = (d: string) => {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) andar(p);
      else if (/\.(tsx?|css)$/.test(n.name)) arquivos.push(p);
    }
  };
  andar(app);
  assert.ok(arquivos.length > 10);
  for (const a of arquivos) {
    const texto = fs
      .readFileSync(a, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!/\birregular/i.test(texto), `${a}: "irregular"`);
    assert.ok(!/\bmelhor(es)?\b/i.test(texto), `${a}: "melhor"`);
    assert.ok(!/\bpior(es)?\b/i.test(texto.replace(/"pior"/g, "")), `${a}: "pior"`);
  }
});

// ================================================================ a consulta da lista

test("consulta: lê a busca, a página e a tabela do endereço; lixo vira o padrão", () => {
  const c = consulta("q=%20patos%20&pagina=3&t.emendas.ano=2023..2025&t.emendas.o=pago.desc");
  assert.equal(c.busca, "patos");
  assert.equal(c.pagina, 3);
  assert.deepEqual(c.estado.filtros.ano, { tipo: "numero", de: 2023, ate: 2025 });
  assert.deepEqual(c.estado.ordem, { coluna: "pago", sentido: "desc" });
  assert.equal(consulta("pagina=0").pagina, 1);
  assert.equal(consulta("pagina=abc").pagina, 1);
  assert.equal(consulta("pagina=2.5").pagina, 1);
  assert.equal(consulta(`q=${"x".repeat(500)}`).busca.length, 200);
  assert.equal(consulta("t.emendas.o=ente.asc").estado.ordem, null, "coluna oculta não ordena");
  assert.deepEqual(parametrosDoEndereco({ a: "1", b: ["2", "3"], c: undefined }).getAll("b"), ["2", "3"]);
});

test("argumentos: cada coluna vira o parâmetro da função, com os rótulos trocados pelos códigos", () => {
  const c = consulta(
    [
      "t.emendas.ano=2023.4..2025.6",
      "t.emendas.emenda=2024",
      "t.emendas.tipo=Bancada,N%C3%A3o%20identificado,Inventado",
      "t.emendas.autor=jo%C3%A3o",
      "t.emendas.forma=Transfer%C3%AAncia%20especial",
      "t.emendas.destino=prefeitura",
      "t.emendas.municipio=patos",
      "t.emendas.objeto=pavimenta%C3%A7%C3%A3o",
      "t.emendas.funcao=Sa%C3%BAde,N%C3%A3o%20consta",
      "t.emendas.situacao=Pago,Proposta%20n%C3%A3o%20assinada%20at%C3%A9%2031%2F12%20do%20ano%20seguinte",
      "t.emendas.ente=Governo%20do%20estado,N%C3%A3o%20informado",
      "t.emendas.fonte-situacao=ciente",
      "t.emendas.instrumento=900001",
      "t.emendas.previsto=1000..",
      "t.emendas.pago=..5000",
      "t.emendas.o=autor.desc",
      "q=fulano",
    ].join("&"),
  );
  const a = argumentosDaLista(c, { autor: "1277", ibge: "2507507", emenda: "202412770001" }, { limite: 50, deslocamento: 100 });
  assert.deepEqual(a, {
    p_ano_de: 2024,
    p_ano_ate: 2025,
    p_codigo: ["%2024%"],
    p_emenda: "202412770001",
    p_tipo: ["bancada", "", "(nenhum)"],
    p_autor: "1277",
    p_autor_nome: ["%joao%"],
    p_canal: ["pix"],
    p_ente_tipo: ["estado", ""],
    p_ente: ["%prefeitura%"],
    p_ibge: "2507507",
    p_municipio: ["%patos%"],
    p_objeto: ["%pavimentacao%"],
    p_funcao: ["saude", ""],
    p_etapa: ["pago", "caducou"],
    p_situacao: ["%ciente%"],
    p_instrumento: ["%900001%"],
    p_previsto_de: 1000,
    p_pago_ate: 5000,
    p_busca: ["%fulano%"],
    p_ordem: "autor",
    p_desc: true,
    p_limite: 50,
    p_deslocamento: 100,
  });
});

test("argumentos: sem filtro, só a página; recorte fixo fora do formato não vai; o limite nunca passa de mil", () => {
  assert.deepEqual(argumentosDaLista(consulta("")), {});
  assert.deepEqual(argumentosDaLista(consulta(""), { autor: "12", ibge: "3550308", emenda: "abc" }), {}, "autor, IBGE e código inválidos");
  assert.deepEqual(argumentosDaLista(consulta(""), {}, { limite: 5000, deslocamento: -3 }), { p_limite: 1000, p_deslocamento: 0 });
  assert.deepEqual(argumentosDaLista(consulta("t.emendas.o=emenda.asc")), { p_ordem: "codigo", p_desc: false });
  assert.deepEqual(argumentosDaLista(consulta("t.emendas.o=forma.desc")), { p_ordem: "canal", p_desc: true });
  assert.deepEqual(paginaDaLista(3), { limite: POR_PAGINA, deslocamento: 2 * POR_PAGINA });
  assert.deepEqual(paginaDaLista(-1), { limite: POR_PAGINA, deslocamento: 0 });
  assert.equal(totalDePaginas(0), 1);
  assert.equal(totalDePaginas(POR_PAGINA + 1), 2);
});

test("opções: a ordem é fixa (nunca por valor); cada opção volta a um código válido", () => {
  const op = opcoesDaLista(["Saúde", null, "Agricultura", "Educação", "Saúde"]);
  assert.deepEqual(
    op.funcao.map((o) => o.valor),
    ["Agricultura", "Educação", "Saúde", FUNCAO_NAO_CONSTA],
  );
  assert.deepEqual(
    op.tipo.map((o) => o.valor),
    [...Object.values(ROTULO_TIPO_EMENDA), TIPO_NAO_IDENTIFICADO],
  );
  for (const [coluna, opcoes] of Object.entries(op)) {
    for (const o of opcoes) {
      const c: ConsultaLista = { ...consulta(""), estado: { filtros: { [coluna]: { tipo: "categoria", valores: [o.valor] } }, ordem: null } };
      const a = argumentosDaLista(c);
      const valores = Object.values(a)[0] as string[];
      assert.ok(Array.isArray(valores) && !valores.includes("(nenhum)"), `${coluna}: ${o.valor}`);
    }
  }
  assert.equal(op.situacao.length, ETAPAS.length);
});

test("endereços: a consulta vai e volta igual; o recorte leva o recorte fixo e nunca a página", () => {
  const c = consulta("q=patos&pagina=4&t.emendas.tipo=Bancada&t.emendas.o=pago.desc");
  const volta = lerConsulta(new URL(`https://x${urlComConsulta("/emendas/lista", c)}`).searchParams);
  assert.deepEqual(volta, c);
  const r = new URL(`https://x${urlDoRecorte("csv", c, { autor: "1277" })}`);
  assert.equal(r.pathname, "/emendas/dados/recorte.csv");
  assert.equal(r.searchParams.get("pagina"), null);
  assert.deepEqual(lerRecorteFixo(r.searchParams), { autor: "1277", ibge: null, emenda: null });
  assert.deepEqual(lerConsulta(r.searchParams), { ...c, pagina: 1 });
  assert.equal(urlComConsulta("/emendas/lista", { estado: ESTADO_VAZIO, busca: "", pagina: 1 }), "/emendas/lista");
  const f = new URL(`https://x${urlDaListaFiltrada({ funcao: { tipo: "categoria", valores: ["Saúde, educação"] } })}`);
  assert.deepEqual(lerConsulta(f.searchParams).estado.filtros.funcao, { tipo: "categoria", valores: ["Saúde, educação"] }, "a vírgula no valor vai escapada");
  assert.deepEqual(descreverConsulta(c, { ibge: "2507507" }), ["município de código IBGE 2507507", "busca “patos”", "Tipo: Bancada"]);
});

test("códigos da URL: emenda com 12 dígitos, município da PB com 7 (25…)", () => {
  assert.equal(codigoEmendaDaUrl("202412770001"), "202412770001");
  assert.equal(codigoEmendaDaUrl("20241277000"), null);
  assert.equal(codigoEmendaDaUrl("2024127700011"), null);
  assert.equal(ibgeDaUrl("2507507"), "2507507");
  assert.equal(ibgeDaUrl("3550308"), null, "fora da Paraíba");
  assert.equal(ibgeDaUrl(undefined), null);
});

// ================================================================ dados abertos

test("CSV: cabeçalho na primeira linha (os nomes dos campos), BOM, ponto e vírgula, vírgula decimal, datas e códigos protegidos", () => {
  const csv = csvDe(DICIONARIO_LINHAS, [linha({ caducou_em: "2025-12-31", ente_nome: "=SOMA(A1)" })]);
  assert.ok(csv.startsWith("﻿"));
  const [cabeca, corpo] = csv.slice(1).split("\r\n");
  assert.deepEqual(cabeca.split(";"), DICIONARIO_LINHAS.map((d) => d.campo));
  const celulas = corpo.split(";");
  const em = (campo: string) => celulas[DICIONARIO_LINHAS.findIndex((d) => d.campo === campo)];
  assert.equal(em("codigo"), '"=""202412770001"""', "o código não vira 2,02E+11");
  assert.equal(em("ibge"), '"=""2507507"""');
  assert.equal(em("pago"), "600,50", "reais com duas casas");
  assert.equal(em("caducou_em"), "31/12/2025");
  assert.equal(em("no_catalogo"), "sim");
  assert.equal(em("ente_nome"), '" =SOMA(A1)"', "fórmula neutralizada");
  assert.equal(em("previsto"), "1000,00");
});

test("JSON: metadados (fonte, data, licença, como citar, recorte), os campos do dicionário em ordem e cada linha uma lista", () => {
  const meta = metadados({
    titulo: "t",
    descricao: "d",
    execucao: { dadoAte: "2026-10-30T04:48:48+00:00", concluidaEm: "2026-11-04T12:00:00Z", painelDadoAte: "2026-11-03T12:00:00Z", pixDadoAte: null },
    geradoEm: "2026-11-17T15:00:00Z",
    site: "https://ponteprojetos.com.br/",
    recorte: ["busca “patos”"],
    total: 1,
  });
  const j = JSON.parse(jsonDe(DICIONARIO_LINHAS, [linha()], meta));
  assert.equal(j.metadados.dados_do_portal_de, "2026-10-30");
  assert.equal(j.metadados.lidos_pela_ponte_em, "2026-11-04");
  assert.deepEqual(j.metadados.datas_das_fontes.map((d: { data: string }) => d.data), ["dados de 30/10/2026", "dados de 03/11/2026", "data não informada", "lido pela PONTE em 04/11/2026"]);
  assert.ok(!("dado_ate" in j.metadados), "nenhuma data sem dizer de quê");
  assert.equal(j.metadados.gerado_em, "2026-11-17");
  assert.match(j.metadados.licenca, /CC BY 4\.0/);
  assert.equal(j.metadados.dicionario, "https://ponteprojetos.com.br/emendas/dados#dicionario");
  assert.match(j.metadados.como_citar, /PONTE Estruturação de Projetos de Impacto.*Dados do Portal da Transparência de 30\/10\/2026, lidos pela PONTE em 04\/11\/2026.*Acesso em 17\/11\/2026/);
  assert.equal(fraseDasDatas({ dadoAte: "2026-11-13T19:24:48+00:00", concluidaEm: "2026-11-17T18:49:10Z" }), "Dados do Portal da Transparência de 13/11/2026, lidos pela PONTE em 17/11/2026.");
  assert.deepEqual(Object.keys(j), ["metadados", "campos", "linhas"]);
  assert.deepEqual(j.campos, DICIONARIO_LINHAS.map((d) => d.campo));
  assert.ok(Array.isArray(j.linhas[0]) && j.linhas[0].length === j.campos.length, "a linha é uma lista na ordem de `campos`");
  const v = (campo: string) => j.linhas[0][j.campos.indexOf(campo)];
  assert.equal(v("codigo"), "202412770001", "no JSON o código vem puro");
  assert.equal(v("pago"), 600.5);
  assert.equal(v("caducou_em"), null, "vazio = null");
  assert.ok(!j.campos.includes("linha"));
  assert.match(comoCitar(null, "https://x.br", "2026-11-17"), /^PONTE .* Disponível em https:\/\/x\.br\/emendas\/dados\. Acesso em 17\/11\/2026\.$/);
});

test("arquivos: os nomes conhecidos e a data do dado no nome; nada de propriedade herdada", () => {
  assert.deepEqual(arquivoDoEndereco("linhas.csv"), { conjunto: "linhas", formato: "csv" });
  assert.deepEqual(arquivoDoEndereco("recorte.json"), { conjunto: "recorte", formato: "json" });
  assert.equal(arquivoDoEndereco("toString"), null);
  assert.equal(arquivoDoEndereco("__proto__"), null);
  assert.equal(arquivoDoEndereco("linhas.xlsx"), null);
  assert.equal(Object.keys(ARQUIVOS).length, 8);
  assert.equal(nomeDoArquivo("linhas", "2026-10-30T04:48:48+00:00", "csv"), "emendas-pb-linhas-dado-2026-10-30.csv");
  assert.equal(nomeDoArquivo("linhas", null, "json"), "emendas-pb-linhas.json");
  assert.equal(nomeDoArquivo("linhas-2025", "2026-10-30T04:48:48+00:00", "csv"), "emendas-pb-linhas-2025-dado-2026-10-30.csv");
});

test("arquivos por ano: linhas-AAAA.csv|json entre 2000 e 2100; o resto não é arquivo", () => {
  assert.deepEqual(arquivoDoEndereco("linhas-2025.csv"), { conjunto: "ano", formato: "csv", ano: 2025 });
  assert.deepEqual(arquivoDoEndereco("linhas-2014.json"), { conjunto: "ano", formato: "json", ano: 2014 });
  for (const nome of ["linhas-1999.csv", "linhas-2101.json", "linhas-20250.csv", "linhas-2025.xlsx", "linhas-25.csv", "linhas-2025.csv.exe", "x-linhas-2025.csv"]) {
    assert.equal(arquivoDoEndereco(nome), null, nome);
  }
  assert.equal(urlDoArquivoDoAno(2025, "json"), "/emendas/dados/linhas-2025.json");
  assert.deepEqual(argumentosDaLista(consultaDoAno(2025)), { p_ano_de: 2025, p_ano_ate: 2025 }, "o arquivo do ano é o filtro do ano");
  assert.equal(anoDeBrasilia("2027-01-01T01:00:00Z"), 2026, "ainda 31/12 em Brasília");
  assert.equal(anoDeBrasilia("2026-11-17"), 2026);
});

test("lista dos anos: do mais recente a 2014 (ou antes, se houver dado), com os registros; sem o agregado, sem número", () => {
  const ag = [
    { grupo: "ano", ano: 2012, tipo: null, canal: null, funcao: null, ente_tipo: null, emendas: 1, linhas: 186, previsto: 0, pago: 0 },
    { grupo: "ano", ano: 2025, tipo: null, canal: null, funcao: null, ente_tipo: null, emendas: 9, linhas: 2897, previsto: 0, pago: 0 },
    { grupo: "canal", ano: null, tipo: null, canal: "pix", funcao: null, ente_tipo: null, emendas: 9, linhas: 99, previsto: 0, pago: 0 },
  ] as AgregadoPublico[];
  const anos = anosDosArquivos(ag, 2026);
  assert.deepEqual(anos.map((a) => a.ano), [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012]);
  assert.deepEqual(anos[1], { ano: 2025, linhas: 2897 });
  assert.deepEqual(anos[0], { ano: 2026, linhas: 0 }, "o ano sem registro aparece com zero");
  const sem = anosDosArquivos(null, 2026);
  assert.equal(sem[sem.length - 1].ano, 2014);
  assert.equal(sem[0].ano, 2026);
  assert.ok(sem.every((a) => a.linhas === null));
});

test("tamanho: o JSON em listas tira o nome dos campos de cada linha (o arquivo do ano fica bem abaixo de 4,5 MB)", () => {
  const meta = metadados({ titulo: "t", descricao: "d", execucao: { dadoAte: null }, geradoEm: "2026-11-17", site: "https://x", total: 0 });
  const bytes = (t: string) => Buffer.byteLength(t, "utf-8");
  // Uma linha do tamanho médio medido em 17/11/2026 (~650 B no CSV): o objeto e os nomes longos de verdade.
  const media = linha({ objeto: "AQUISIÇÃO DE EQUIPAMENTOS E MATERIAL PERMANENTE PARA A UNIDADE BÁSICA DE SAÚDE ".repeat(2), concedente: "MINISTÉRIO DA SAÚDE", orgao: "FUNDO NACIONAL DE SAÚDE", acao: "Estruturação da Rede de Serviços de Atenção Primária à Saúde", programa: "Atenção Primária à Saúde", subfuncao: "Atenção básica" });
  const n = 3000;
  const linhas = Array.from({ length: n }, (_, i) => ({ ...media, linha: i + 1 }));
  const csv = bytes(csvDe(DICIONARIO_LINHAS, linhas));
  const json = bytes(jsonDe(DICIONARIO_LINHAS, linhas, meta));
  const comChaves = bytes(JSON.stringify(linhas.map((l) => Object.fromEntries(DICIONARIO_LINHAS.map((d) => [d.campo, (l as unknown as Record<string, unknown>)[d.campo] ?? null])))));
  assert.ok(csv / n > 550 && csv / n < 800, `a linha do teste tem o tamanho médio medido (~650 B no CSV): ${Math.round(csv / n)} B`);
  assert.ok(csv < 3e6, `CSV de 3 mil linhas médias: ${csv} B (dois terços de 4,5 MB no máximo)`);
  assert.ok(json < 3e6, `JSON em listas de 3 mil linhas médias: ${json} B (dois terços de 4,5 MB no máximo)`);
  assert.ok(comChaves - json > 400 * n, "o nome dos campos pesava mais de 400 B por linha");
});

// ================================================================ as somas

const ag = (extra: Partial<AgregadoPublico>): AgregadoPublico => ({
  grupo: "total",
  ano: null,
  tipo: null,
  canal: null,
  funcao: null,
  ente_tipo: null,
  emendas: 1,
  linhas: 1,
  municipios: 1,
  previsto: 10,
  empenhado: 0,
  pago: 5,
  com_previsto: 1,
  com_empenhado: 0,
  com_fisico: 0,
  ...extra,
});

test("série: todo ano de 2014 (ou antes, se houver dado) ao último, sem pular; colunas na ordem fixa; ano não identificado à parte", () => {
  const agregado = [
    ag({ grupo: "ano", ano: 2012, pago: 1 }),
    ag({ grupo: "ano", ano: 2016, pago: 2 }),
    ag({ grupo: "ano", ano: null, pago: 3, linhas: 18 }),
    ag({ grupo: "ano_canal", ano: 2016, canal: "favorecido", pago: 1 }),
    ag({ grupo: "ano_canal", ano: 2016, canal: "convenio", pago: 1 }),
    ag({ grupo: "ano_tipo", ano: 2016, tipo: "bancada", pago: 2 }),
  ];
  const s = serieAnual(agregado, "canal");
  assert.deepEqual(s.anos.map((a) => a.ano), [2012, 2013, 2014, 2015, 2016]);
  assert.equal(s.anos[1].total.pago, 0, "o ano sem dado aparece com zero");
  assert.deepEqual(s.chaves, ["convenio", "favorecido"]);
  assert.equal(s.semAno?.linhas, 18);
  assert.deepEqual(serieAnual(agregado, "tipo").chaves, ["bancada"]);
  assert.deepEqual(serieAnual([ag({ grupo: "ano", ano: 2025 })], "tipo").anos[0].ano, 2014);
});

test("função: em ordem alfabética, nunca por valor; a não informada no fim", () => {
  const f = porFuncao([
    ag({ grupo: "funcao", funcao: "Urbanismo", pago: 999 }),
    ag({ grupo: "funcao", funcao: null, pago: 5000 }),
    ag({ grupo: "funcao", funcao: "Saúde", pago: 1 }),
    ag({ grupo: "funcao", funcao: "Agricultura", pago: 2 }),
    ag({ grupo: "canal", canal: "pix" }),
  ]);
  assert.deepEqual(f.map((x) => x.funcao), ["Agricultura", "Saúde", "Urbanismo", FUNCAO_NAO_CONSTA]);
  assert.equal(largura(50, 100), 50);
  assert.equal(largura(0, 100), 0);
  assert.equal(largura(1, 1e9), 0.5, "o menor positivo ainda aparece");
  assert.equal(largura(5, 0), 0);
});

const autor = (codigo: string, nome: string, extra: Partial<AutorPublico> = {}): AutorPublico => ({
  codigo,
  nome,
  tipo: "individual",
  coletivo: false,
  emendas: 1,
  linhas: 1,
  previsto: 0,
  pago: 0,
  municipios: 0,
  ano_min: 2024,
  ano_max: 2024,
  convenio_pago: 0,
  pix_pago: 0,
  fns_pago: 0,
  favorecido_pago: 0,
  emendas_catalogo_pb: 0,
  ...extra,
});

test("autores: alfabéticos (sem acento pesar), coletivos à parte, sem quem não tem nada na PB", () => {
  const { individuais, coletivos } = separarAutores([
    autor("1", "ZÉ", { pago: 9e9 }),
    autor("2", "ÁLVARO"),
    autor("3", "BANCADA DA PARAÍBA", { tipo: "bancada", coletivo: true }),
    autor("4", "SEM NADA", { linhas: 0, emendas_catalogo_pb: 0 }),
    autor("5", "SÓ CATÁLOGO", { linhas: 0, emendas_catalogo_pb: 2 }),
    autor("6", "BRUNO"),
  ]);
  assert.deepEqual(individuais.map((a) => a.nome), ["ÁLVARO", "BRUNO", "SÓ CATÁLOGO", "ZÉ"]);
  assert.deepEqual(coletivos.map((a) => a.codigo), ["3"]);
});

test("municípios: os 223 em ordem alfabética do português; estado e sem município à parte", () => {
  const m = (grupo: MunicipioPublico["grupo"], ibge: string | null, nome: string, pago = 0): MunicipioPublico => ({
    grupo,
    ibge,
    nome,
    emendas: 0,
    linhas: pago ? 1 : 0,
    previsto: 0,
    pago,
    convenio_pago: 0,
    pix_pago: 0,
    fns_pago: 0,
    favorecido_pago: 0,
    entidades_pago: 0,
  });
  const s = separarMunicipios([
    m("municipio", "2510808", "Patos", 900),
    m("estado", null, "Governo do estado e fundos estaduais", 70),
    m("municipio", "2500106", "Água Branca"),
    m("municipio", "2507507", "João Pessoa", 5),
  ]);
  assert.deepEqual(s.municipios.map((x) => x.nome), ["Água Branca", "João Pessoa", "Patos"]);
  assert.equal(s.estado?.pago, 70);
  assert.equal(s.semMunicipio, null);
});

const cat = (extra: Partial<LinhaCatalogo>): LinhaCatalogo => ({
  codigo: "202471000001",
  linha: 1,
  ano: 2024,
  tipo: "bancada",
  tipo_texto: "Emenda de Bancada",
  autor_codigo: "7100",
  autor_nome: "BANCADA",
  numero: "0001",
  localidade: "PARAÍBA (UF)",
  uf: "PB",
  ibge: null,
  pb_localidade: true,
  funcao: "Saúde",
  subfuncao: null,
  programa: null,
  acao: null,
  empenhado: 300,
  liquidado: 300,
  pago: 100,
  rp_pago: 20,
  rp_cancelado: 0,
  pago_total: 120,
  a_pagar: 180,
  nacional_empenhado: 9600000300,
  nacional_liquidado: 9000000000,
  nacional_pago: 8000000100,
  nacional_rp_pago: 20,
  nacional_rp_cancelado: 0,
  nacional_a_pagar: 1600000180,
  localidades: 2,
  ...extra,
});

test("ficha: a execução do catálogo soma só a PB e lista as localidades de fora; a identificação cai do catálogo para o canal", () => {
  const e = execucaoNaPb([
    cat({ linha: 1 }),
    cat({ linha: 2, localidade: "Nacional", pb_localidade: false, empenhado: null, pago_total: null }),
    cat({ linha: 3, localidade: "JOÃO PESSOA - PB", empenhado: 50, pago_total: 10, a_pagar: 40 }),
  ]);
  assert.equal(e.soma.empenhado, 350);
  assert.equal(e.soma.pago_total, 130);
  assert.deepEqual(e.fora, ["Nacional"]);
  assert.equal(e.linhas.length, 2);

  const id = identificacaoDaEmenda("201112770009", [linha({ codigo: "201112770009", tipo_texto: null, no_catalogo: false, numero: "0009", funcao: null })], []);
  assert.equal(id.no_catalogo, false);
  assert.equal(id.numero, "0009");
  assert.equal(id.autor_codigo, "1277");
  const so = identificacaoDaEmenda("202533000005", [], [cat({ pb_localidade: false, funcao: "Saúde", autor_codigo: "3300" })]);
  assert.equal(so.funcao, "Saúde");
  assert.equal(so.no_catalogo, true);

  const s = somaDasLinhas([linha(), linha({ canal: "favorecido", previsto: null, pago: 50 }), linha({ canal: "convenio", previsto: 300, pago: 0 })]);
  assert.equal(s.previsto, 1300);
  assert.equal(s.pago, 650.5);
  assert.deepEqual(s.porForma.map((f) => f.canal), ["convenio", "favorecido"]);
  assert.equal(s.comPrevisto, true);
  assert.equal(somaDasLinhas([linha({ canal: "favorecido", previsto: null })]).comPrevisto, false, "só pagamento direto: sem previsto");
});

// ================================================================ acessibilidade

test("preferências (v2): tema, texto de 80% a 160% e movimento; lixo vira o padrão; os cookies da v1 ainda valem", () => {
  assert.deepEqual(lerPreferencias({}), { tema: "sistema", texto: 100, movimento: "normal", titulos: "padrao" });
  assert.deepEqual(lerPreferencias({ tema: "escuro", texto: "160", movimento: "reduzido", titulos: "simples" }), { tema: "escuro", texto: 160, movimento: "reduzido", titulos: "simples" });
  assert.deepEqual(lerPreferencias({ tema: "rosa", texto: "170", movimento: "x", titulos: "y" }), { tema: "sistema", texto: 100, movimento: "normal", titulos: "padrao" });
  assert.deepEqual(lerPreferencias({ texto: "95" }).texto, 100, "fora do passo de 10");
  assert.deepEqual(lerPreferencias({ contrasteAntigo: "alto", fonteAntiga: "3" }), { tema: "contraste", texto: 150, movimento: "normal", titulos: "padrao" });
  assert.equal(lerPreferencias({ tema: "claro", contrasteAntigo: "alto" }).tema, "claro", "o cookie novo vence o velho");
  const p = { tema: "sistema" as const, texto: 160, movimento: "normal" as const, titulos: "padrao" as const };
  assert.equal(aplicarPedido(p, { texto: "mais" }).texto, 160, "teto");
  assert.equal(aplicarPedido({ ...p, texto: 80 }, { texto: "menos" }).texto, 80, "piso");
  assert.equal(aplicarPedido(p, { texto: "menos" }).texto, 150);
  assert.equal(aplicarPedido(p, { texto: "normal" }).texto, 100);
  assert.deepEqual(aplicarPedido(p, { tema: "contraste", movimento: "reduzido" }), { tema: "contraste", texto: 160, movimento: "reduzido", titulos: "padrao" });
  assert.equal(aplicarPedido(p, { titulos: "simples" }).titulos, "simples");
  assert.equal(aplicarPedido({ ...p, titulos: "simples" }, { titulos: "padrao" }).titulos, "padrao");
  assert.deepEqual(aplicarPedido(p, { tema: "x", texto: "y", movimento: "z", titulos: "w" }), p);
  assert.deepEqual([...COOKIES_DO_PORTAL].sort(), ["emendas_contraste", "emendas_fonte", "emendas_movimento", "emendas_tema", "emendas_texto", "emendas_titulos"], "o restaurar apaga todos");
});

test("volta da preferência: só para dentro de /emendas no mesmo site; o resto volta ao início do portal", () => {
  const o = "https://ponteprojetos.com.br";
  assert.equal(voltaSegura(`${o}/emendas/lista?q=patos&t.emendas.o=pago.desc`, o), "/emendas/lista?q=patos&t.emendas.o=pago.desc");
  assert.equal(voltaSegura(`${o}/emendas`, o), "/emendas");
  assert.equal(voltaSegura("https://outro.site/emendas/lista", o), "/emendas");
  assert.equal(voltaSegura(`${o}/mapa`, o), "/emendas");
  assert.equal(voltaSegura(`${o}/emendasx`, o), "/emendas");
  assert.equal(voltaSegura(`${o}/emendas/preferencias?fonte=mais`, o), "/emendas", "sem laço");
  assert.equal(voltaSegura(`${o}/emendas//evil.com`, o), "/emendas");
  assert.equal(voltaSegura(null, o), "/emendas");
  assert.equal(voltaSegura("não é url", o), "/emendas");
});

// ================================================================ o PNTP

test("autoavaliação: os critérios da especificação estão todos, e nenhum diz que tem selo", () => {
  const criterios = AUTOAVALIACAO_PNTP.map((i) => i.criterio).join(" | ");
  for (const c of ["17.1", "17.3", "17.2", "1.4", "2.7", "13.1", "13.2", "13.3", "13.4", "13.5", "15.2", "15.4", "5.1"]) assert.ok(criterios.includes(c), c);
  for (const i of AUTOAVALIACAO_PNTP) assert.ok(!/\bselo\b/i.test(`${i.faz} ${i.exige}`), i.criterio);
});

test("moeda: o valor exato em reais, e o curto nas somas", () => {
  assert.equal(moeda(1234567.891), "R$ 1.234.567,89");
  assert.equal(moeda(null), "—");
  assert.equal(moedaCurta(1_250_000), "R$ 1,3 mi");
  assert.equal(moedaCurta(4_832_900_000), "R$ 4,8 bi");
  assert.equal(moedaCurta(350_000), "R$ 350 mil");
});

test("tabela: as colunas do 17.1 estão na lista, cada uma com filtro, e as visíveis ordenam (decisão 5)", () => {
  const ids = COLUNAS_LISTA.map((c) => c.id);
  for (const id of ["ano", "emenda", "tipo", "autor", "forma", "destino", "municipio", "objeto", "funcao", "previsto", "pago", "situacao"]) assert.ok(ids.includes(id), id);
  for (const c of COLUNAS_LISTA) {
    assert.notEqual(c.filtravel, false, `${c.id} filtra`);
    if (!c.oculta) assert.notEqual(c.ordenavel, false, `${c.id} ordena`);
    assert.notEqual(c.id, "o", "nenhuma coluna pode se chamar 'o'");
  }
});

test("arquivos do portal: reais sempre com duas casas — zero é 0,00 no CSV e 0.00 no JSON (o dicionário)", () => {
  const linhas = [linha({ pago: 0, previsto: 1000, convenio_desembolsado: 1761109.3 })];
  const csv = csvDe(DICIONARIO_LINHAS, linhas);
  const [cab, l1] = csv.replace(/^\uFEFF/, "").split("\r\n");
  const col = (nome: string) => l1.split(";")[cab.split(";").indexOf(nome)];
  assert.equal(col("pago"), "0,00");
  assert.equal(col("previsto"), "1000,00");
  assert.equal(col("convenio_desembolsado"), "1761109,30");
  assert.equal(col("ano"), "2024", "inteiro continua sem casas");
  const json = jsonDe(DICIONARIO_LINHAS, linhas, { titulo: "t" } as unknown as Parameters<typeof jsonDe>[2]);
  assert.match(json, /,0\.00,|,0\.00\]/, "0.00 literal no JSON");
  assert.match(json, /1761109\.30/);
  const lido = JSON.parse(json) as { campos: string[]; linhas: unknown[][] };
  assert.equal(lido.linhas[0][lido.campos.indexOf("pago")], 0, "continua número");
  assert.ok(!json.includes("reais:"), "nenhuma marca sobra");
});
