import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ABAS_MUNICIPIO,
  CAMPOS_DE_ANALISE_DO_INSTRUMENTO,
  CARTOES_DO_PUBLICO,
  DIMENSOES_DO_PUBLICO,
  NOME_ABA,
  ORDEM_DAS_ABAS,
  PODE,
  abaEscolhida,
  colunasDoPublico,
  destinoConvenio,
  emendasNoMunicipio,
  ibgeDaUrl,
  instrumentoDoPublico,
  leEmendasDoMunicipio,
  leituraDoPublico,
  nivelDeAcesso,
  nivelSemCliente,
  podeAbaMunicipio,
  relatorioDoNivel,
  relatorioDoPublico,
  urlMunicipio,
} from "./pagina-municipio.ts";
import { MUNICIPIOS_PB } from "./municipios-pb.ts";
import { ABAS_BRASIL } from "./pagina-brasil.ts";
import { ABAS_ENTIDADE, abaDaEntidade } from "./pagina-entidade.ts";
import { ABAS_UF, podeRelatorioUf } from "./pagina-uf.ts";
import type { MunicipioFiscal, VerificacaoFiscal } from "./fiscal.ts";
import type { PlanoLaudoPix } from "./pix-laudo.ts";
import type { TceTcu } from "./tce-tcu.ts";
import { COLUNAS_INSTRUMENTO, montarRelatorio, relatorioSemNomes, type EntradaRelatorio, type InstrumentoRelatorio, type Relatorio } from "./relatorio-municipio.ts";
import type { AutorEmendas, DestinoEmendas } from "./emendas.ts";

test("nível de acesso: público, cadastrado, cliente do próprio município e administrador", () => {
  assert.equal(nivelDeAcesso({ aprovado: false, administrador: true, clienteDoMunicipio: true }), 0, "sem aprovação não há nível, nem de administrador");
  assert.equal(nivelDeAcesso({ aprovado: true, administrador: false, clienteDoMunicipio: false }), 1);
  assert.equal(nivelDeAcesso({ aprovado: true, administrador: false, clienteDoMunicipio: true }), 2);
  assert.equal(nivelDeAcesso({ aprovado: true, administrador: true, clienteDoMunicipio: false }), 3);
});

test("aba: a pedida quando o nível alcança; senão a de entrada", () => {
  assert.equal(abaEscolhida(undefined, 1), "trava");
  assert.equal(abaEscolhida("contas", 1), "contas");
  assert.equal(abaEscolhida(["controle", "x"], 2), "controle");
  assert.equal(abaEscolhida("inventada", 3), "trava");
  assert.equal(abaEscolhida("contas", 0), "resumo", "o público não vê as contas e cai no resumo");
  assert.equal(abaEscolhida("indicadores", 0), "indicadores");
  assert.deepEqual(ABAS_MUNICIPIO.filter((a) => a.minimo === 0).map((a) => a.id), ["resumo", "dinheiro", "indicadores"], "a D1 abre ao público o resumo, o dinheiro e os indicadores");
});

test("endereços e o que cada nível alcança dentro das abas", () => {
  assert.equal(urlMunicipio("2510808"), "/mapa/municipio/2510808");
  assert.equal(urlMunicipio("2510808", "trava"), "/mapa/municipio/2510808");
  assert.equal(urlMunicipio("2510808", "contas"), "/mapa/municipio/2510808?aba=contas");
  assert.equal(destinoConvenio(1)("942082"), "/mapa/instrumento/942082", "o cadastrado vai à página do instrumento");
  assert.equal(destinoConvenio(2)("942082"), "/mapa/instrumento/942082/laudo");
  assert.deepEqual([PODE.simulador(1), PODE.simulador(2), PODE.interno(2), PODE.interno(3)], [false, true, false, true]);
});

test("B11: as abas comuns têm o mesmo nome e a mesma ordem nos 4 níveis do território", () => {
  const niveis: Record<string, readonly { id: string; nome: string }[]> = { Brasil: ABAS_BRASIL, UF: ABAS_UF, município: ABAS_MUNICIPIO, entidade: ABAS_ENTIDADE };
  for (const [nivel, abas] of Object.entries(niveis)) {
    for (const a of abas) {
      if (Object.hasOwn(NOME_ABA, a.id)) assert.equal(a.nome, NOME_ABA[a.id as keyof typeof NOME_ABA], `${nivel}: aba ${a.id}`);
    }
    const posicoes = abas.map((a) => ORDEM_DAS_ABAS.indexOf(a.id));
    assert.ok(posicoes.every((p) => p >= 0), `${nivel}: toda aba está na ordem comum`);
    assert.deepEqual(posicoes, [...posicoes].sort((x, y) => x - y), `${nivel}: as abas seguem a ordem comum`);
    // o dinheiro e o relatório existem nos quatro, com o mesmo nome; o relatório fecha a fila
    assert.equal(abas.find((a) => a.id === "dinheiro")?.nome, "Dinheiro federal", `${nivel}: um nome só para o dinheiro`);
    assert.equal(abas.at(-1)?.nome, "Relatório e dados", `${nivel}: "Relatório e dados" é a última`);
  }
  // nenhum nome repete o de outra aba do mesmo nível
  for (const abas of Object.values(niveis)) assert.equal(new Set(abas.map((a) => a.nome)).size, abas.length);
});

test("B11: a aba de entrada do município e da entidade segue «O que trava e o que destrava» (decisão de 06/10)", () => {
  assert.equal(ABAS_MUNICIPIO[0].id, "trava");
  assert.equal(ABAS_ENTIDADE[0].id, "trava");
  assert.equal(abaEscolhida(undefined, 1), "trava");
  assert.equal(abaDaEntidade(undefined, 1), "trava");
});

// ================================================================ C4a: o nível 0 de verdade

test("C4a: Brasil e UF não têm cliente — 0 sem aprovação, 1 cadastrado, 3 administrador (B1 da R3)", () => {
  assert.equal(nivelSemCliente({ aprovado: false, administrador: false }), 0);
  assert.equal(nivelSemCliente({ aprovado: false, administrador: true }), 0, "sem aprovação, nem o administrador");
  assert.equal(nivelSemCliente({ aprovado: true, administrador: false }), 1);
  assert.equal(nivelSemCliente({ aprovado: true, administrador: true }), 3);
  // A UF: "Tempos e funil", o relatório e o CSV pedem 1; o público fica no resumo, nos municípios, no estado e no dinheiro.
  assert.equal(podeRelatorioUf(nivelSemCliente({ aprovado: false, administrador: false })), false);
  assert.deepEqual(ABAS_UF.filter((a) => a.minimo === 0).map((a) => a.id), ["resumo", "municipios", "estado", "dinheiro"]);
});

test("C4a: o relatório do município pede o nível da aba «Relatório e dados», como o da entidade (B1 da R3)", () => {
  assert.equal(podeAbaMunicipio("relatorio", 0), false);
  for (const n of [1, 2, 3] as const) assert.equal(podeAbaMunicipio("relatorio", n), true);
  // coerente com a escolha da aba: quem abre a aba abre a rota
  for (const n of [0, 1, 2, 3] as const) assert.equal(podeAbaMunicipio("relatorio", n), abaEscolhida("relatorio", n) === "relatorio");
  assert.equal(podeAbaMunicipio("contas", 0), false, "D1: o fiscal é do cadastro");
  assert.equal(podeAbaMunicipio("indicadores", 0), true);
});

test("C4a: o que o cadastro abre dentro das abas — fiscal, controle, Pix, fornecedores, imprimir e seguir — fica em 1 ou mais", () => {
  assert.deepEqual(([0, 1, 2, 3] as const).map((n) => PODE.cadastro(n)), [false, true, true, true]);
  // o resto do PODE não muda
  assert.deepEqual([PODE.laudo(1), PODE.laudo(2), PODE.interno(2), PODE.interno(3)], [false, true, false, true]);
});

// Um município com tudo: fiscal, TCU, Pix, fornecedores, convênios em situações de análise, propostas e emendas. É a
// entrada do teste do relatório (Patos, onda 14), mais curta.
const verificacao = (codigo: string, estado: string, resumo: string) =>
  ({ codigo, nome: codigo, estado, resumo, decisoes: [], evidencia: {}, base_legal: "", documental: false, versao: "x" }) as unknown as VerificacaoFiscal;
const municipioFiscal: MunicipioFiscal = {
  ibge: "2510808", nome: "Patos", populacao: 103165, tce: "135",
  estados: { G2: "nao_atendido", G7: "nao_atendido", G1: "atendido" },
  conclusoes: [
    { decisao: "B", nome: "Transferência voluntária", estado: "nao_atendido", bloqueantes: ["G2", "G7"], alertas: [], sem_dado: [], documentais: [], versao: "x" },
  ] as MunicipioFiscal["conclusoes"],
  indicadores: { pessoal_pct: 54.54, cauc_pendencias: ["1.5", "4.2"] },
};
const instrumento = (x: Partial<InstrumentoRelatorio>): InstrumentoRelatorio => ({
  nr_convenio: "900000", modalidade: "Convênio", situacao: "Em execução", subsituacao: null, orgao_sup: "MINISTERIO DA AGRICULTURA", programa: null,
  objeto: null, vl_global: 1_000_000, vl_repasse: 950_000, vl_desembolsado: 500_000, vl_pago: 400_000, vl_saldo_conta: 100_000, pct_fisico: 0.5,
  dt_assinatura: "2024-06-01", dt_fim_vigencia: "2027-12-31", dt_limite_contas: null, dt_primeiro_desembolso: "2025-01-10",
  dt_ultimo_desembolso: "2026-08-01", dt_ultimo_pagamento: "2026-08-20", situacao_contratacao: null, ...x,
});
const tceTcu = (nr: string): TceTcu => ({
  nr_convenio: nr, codigo: 1, numero: "1", ano: 2024, situacao: "Processo autuado", origem_recursos: null, motivo: null, submotivo: null, iniciativa: null,
  dt_instauracao: "2024-01-01", dt_inicio_prazo: null, dt_prestacao_contas: null, dt_atualizacao_debito: null, debito_original: 300_000,
  debito_sem_juros: null, debito_com_juros: 900_000, numero_processo: `0${nr}/2024-0`, url_processo: null, numero_acordao: null, origem_acordao: null,
  parecer_controle_interno: null, analise_boa_fe: null,
});
const planoPix = (id: number): PlanoLaudoPix => ({
  id_plano_acao: id, codigo_plano_acao: null, ano: 2024, beneficiario: "Patos", cnpj: "09084815000170", cod_ibge: "2510808", autor: null, codigo_emenda: null,
  situacao: null, valor: 1_400_000, custeio: 0, investimento: 1_400_000, pago: 1_337_500, dt_primeira_ob: null, fim_execucao: null, limite_execucao: null,
  area: null, objeto: null, saldo: null, dt_saldo: null, pior: "alto", n_critico: 0, n_alto: 1, n_moderado: 0, n_pendente: 0, versao: null,
  itens: [{ item: "C1", titulo: "Relatório de gestão não entregue", dispositivo: "IN 93, art. 3º", estado: "nao_atendido", nivel: "alto", fato: "x" }],
});
const entradaCompleta = (): EntradaRelatorio => ({
  ibge: "2510808",
  nome: "Patos",
  fiscal: {
    municipio: municipioFiscal,
    verificacoes: [verificacao("G1", "atendido", "Entregues."), verificacao("G2", "nao_atendido", "54,54% da RCL ajustada.")],
    referencia: "2026-09-30",
  },
  serie: {
    anos: [2025, 2026],
    periodos: [
      { exercicio: 2025, periodicidade: "Q", periodo: 3, dtp_pct: 55.75, limite_maximo_pct: 54, limite_prudencial_pct: 51.3 },
      { exercicio: 2026, periodicidade: "Q", periodo: 1, dtp_pct: 54.13, limite_maximo_pct: 54, limite_prudencial_pct: 51.3 },
    ],
  },
  instrumentos: [
    instrumento({ nr_convenio: "942082", objeto: "Máquinas agrícolas", dt_fim_vigencia: "2026-09-30" }),
    instrumento({ nr_convenio: "990001", vl_global: 66_000_000, vl_desembolsado: 31_000_000 }),
    instrumento({ nr_convenio: "826152", situacao: "Aguardando Prestação de Contas", dt_limite_contas: "2020-02-29" }),
    instrumento({ nr_convenio: "703764", situacao: "Prestação de Contas Rejeitada", orgao_sup: "MINISTERIO DO TURISMO" }),
    instrumento({ nr_convenio: "989358", situacao_contratacao: "Liminar Judicial", dt_fim_vigencia: "2027-06-30" }),
  ],
  referenciaPainel: "2026-09-29",
  emendas: [{ nr_convenio: "990001", parlamentar: "FULANO DE TAL", tipo_parlamentar: "Deputado Federal", valor: 500_000 }],
  propostas: [
    { id_proposta: "1", ano_envio: 2019, desfecho: "aberta_concedente", orgao_sup: null, programa: null, valor_repasse: 200_000, dias_sem_evento: 2000, dt_ultimo_evento: null, limbo: true },
    { id_proposta: "3", ano_envio: 2025, desfecho: "assinada", orgao_sup: null, programa: null, valor_repasse: 500_000, dias_sem_evento: null, dt_ultimo_evento: null },
  ],
  tcu: {
    consultas: [{ nr_convenio: "703764", situacao_convenio: null, cod_ibge: "2510808", n_tce: 1, erro: null }],
    tces: [tceTcu("703764")],
    referencia: "2026-09-30",
  },
  contasObras: {},
  pix: [planoPix(1), planoPix(2)],
  pixTce: [{ ibge: "2510808", ano: 2025, pago: 2_000_000, pago_pessoal: 0, pago_juros: 0, pago_amortizacao: 0, pct_capital: 95 } as never],
  fundo: [],
  conciliacao: null,
  fornecedores: {
    concentracao: {
      cod_ibge: "2510808", municipio: "Patos", convenios: 30, n_fornecedores: 56, pago_pj: 61_600_000, pago_pf: 0,
      maior_cnpj: "05476456000146", maior_nome: "EMPRESA X", maior_pago: 40_000_000, maior_fatia: 0.65, hhi: 0.4,
    },
    inidoneos: [],
  },
  janelas: { elegiveis: 3, urgentes: [] },
  faltas: [],
});

/** Os campos do `Relatorio` em 09/10/2026. Campo novo faz este teste falhar: decida se o público o vê (`relatorioDoPublico`). */
const CAMPOS_DO_RELATORIO = [
  "achados", "cartoes", "controle", "convenios", "destaques", "emDia", "emendas", "escopo", "faltas", "fiscal", "fontes", "fornecedores", "hoje",
  "ibge", "indicadores", "janelas", "nome", "passos", "pix", "propostas", "tcePb", "versao",
];

test("C4a: o recorte do público tira do dado o fiscal, o controle, o TCE-PB, os fornecedores, o Pix e a análise (B2 e B3 da R3)", () => {
  const inteiro = relatorioSemNomes(montarRelatorio(entradaCompleta(), "2026-10-01"));
  // a entrada tem mesmo o que o público não pode ver (senão o teste não prova nada)
  const rotulos = inteiro.cartoes.map((c) => c.rotulo);
  for (const r of ["Pessoal / RCL ajustada", "CAUC", "Tomadas de contas especiais (TCU)", "Convênios em execução"]) assert.ok(rotulos.includes(r), r);
  for (const d of ["fiscal", "controle", "pix", "fornecedores", "convenios"]) assert.ok(inteiro.achados.some((a) => a.dimensao === d), `achado de ${d}`);
  assert.ok(inteiro.fiscal && inteiro.controle && inteiro.pix && inteiro.fornecedores);
  assert.ok(inteiro.convenios && inteiro.convenios.liminar.length + inteiro.convenios.contasAtrasadas.length + inteiro.convenios.contasNegativas.length > 0);

  const p = relatorioDoPublico(inteiro);
  assert.deepEqual(p.cartoes.map((c) => c.rotulo), ["Convênios em execução"]);
  for (const lista of [p.achados, p.destaques, p.emDia]) {
    for (const a of lista) assert.ok(DIMENSOES_DO_PUBLICO.includes(a.dimensao), `${a.dimensao}: ${a.titulo}`);
  }
  assert.equal(p.fiscal, null);
  assert.equal(p.controle, null);
  assert.equal(p.pix, null);
  assert.equal(p.tcePb, null);
  assert.equal(p.fornecedores, null);
  assert.deepEqual(p.passos, []);
  // dos convênios fica a situação (a tabela por grupo e os em execução); sai a análise
  assert.deepEqual(p.convenios?.porGrupo, inteiro.convenios?.porGrupo);
  assert.deepEqual(p.convenios?.emExecucao, inteiro.convenios?.emExecucao);
  for (const k of ["vigenciaVencida", "semMovimento", "contasAtrasadas", "contasNegativas", "nuncaAssinados", "liminar", "pc33"] as const) {
    assert.deepEqual(p.convenios?.[k], [], k);
  }
  assert.equal(p.convenios?.nuncaAssinadosVencidos, 0);
  // o que o cadastrado vê de resumo segue igual
  for (const k of ["ibge", "nome", "hoje", "escopo", "propostas", "emendas", "indicadores", "janelas"] as const) {
    assert.deepEqual(p[k], inteiro[k], k);
  }
  // onda 7: os destaques e as fontes (só do cadastro) saem; das faltas, só as das fontes que o público lê
  assert.deepEqual(p.destaques, []);
  assert.deepEqual(p.fontes, []);
  const comFaltas = relatorioDoPublico({ ...inteiro, faltas: ["painel fiscal", "indicadores do município", "TCE-PB", "convênios"] });
  assert.deepEqual(comFaltas.faltas, ["indicadores do município", "convênios"]);
  // nenhum nome de empresa sobra em lugar nenhum do recorte
  assert.ok(!JSON.stringify(p).includes("EMPRESA X"));
  assert.ok(!JSON.stringify(p).includes("05476456000146"));
  // não mexe no relatório recebido
  assert.ok(inteiro.fiscal);
});

test("C4a: o recorte é lista branca — campo novo do Relatorio, cartão novo ou dimensão nova nascem fora do nível 0", () => {
  const inteiro = montarRelatorio(entradaCompleta(), "2026-10-01");
  assert.deepEqual(Object.keys(inteiro).sort(), CAMPOS_DO_RELATORIO);
  const comCartaoNovo: Relatorio = { ...inteiro, cartoes: [...inteiro.cartoes, { rotulo: "Um cartão novo", valor: "1", nota: "", nivel: null }] };
  assert.ok(!relatorioDoPublico(comCartaoNovo).cartoes.some((c) => c.rotulo === "Um cartão novo"));
  assert.deepEqual(CARTOES_DO_PUBLICO, ["Convênios em execução"]);
  assert.deepEqual([...DIMENSOES_DO_PUBLICO].sort(), ["economia", "governanca", "social", "territorio"]);
});

test("C4a: do nível 1 em diante o relatório não perde nada; o 0 recebe o recorte", () => {
  const inteiro = montarRelatorio(entradaCompleta(), "2026-10-01");
  for (const n of [1, 2, 3] as const) assert.equal(relatorioDoNivel(inteiro, n), inteiro, `nível ${n}: o mesmo objeto`);
  assert.deepEqual(relatorioDoNivel(inteiro, 0), relatorioDoPublico(inteiro));
});

// ================================================================ onda 12, A (M1 e M7 da revisão de segurança da onda 11)

test("onda 12 (M1): o IBGE da URL só vale se é um dos 223 da PB, exatamente como na lista", () => {
  assert.equal(ibgeDaUrl("2510808"), "2510808", "Patos");
  assert.equal(ibgeDaUrl("2507507"), "2507507", "João Pessoa");
  assert.equal(MUNICIPIOS_PB.length, 223);
  for (const [ibge] of MUNICIPIOS_PB) assert.equal(ibgeDaUrl(ibge), ibge, ibge);
  // casava com o `^25\d{5}$` de antes, e não é município da PB: o 404 de sempre, sem ler o banco
  for (const v of ["2599999", "2500000", "2510809"]) assert.equal(ibgeDaUrl(v), null, v);
  for (const v of ["3550308", "251080", "25108080", " 2510808", "2510808 ", "", undefined, null]) assert.equal(ibgeDaUrl(v), null, String(v));
});

test("onda 12 (M7): os campos de análise do instrumento são colunas reais, e a lista pública é a de sempre menos eles", () => {
  const todas = COLUNAS_INSTRUMENTO.split(",");
  for (const c of CAMPOS_DE_ANALISE_DO_INSTRUMENTO) assert.ok(todas.includes(c), `${c} está no select de sempre`);
  const publicas = colunasDoPublico(COLUNAS_INSTRUMENTO).split(",");
  assert.deepEqual(publicas, todas.filter((c) => !(CAMPOS_DE_ANALISE_DO_INSTRUMENTO as readonly string[]).includes(c)), "mesma ordem, menos as de análise");
  assert.equal(todas.length - publicas.length, CAMPOS_DE_ANALISE_DO_INSTRUMENTO.length);
  // o que o nível 0 da entidade desenha (carteira, órgãos, cartão "Convênios em execução", "Quem é") continua pedido
  for (const c of ["nr_convenio", "municipio", "situacao", "orgao_sup", "objeto", "vl_global", "vl_desembolsado", "pct_fisico", "dt_assinatura", "dt_fim_vigencia"]) {
    assert.ok(publicas.includes(c), c);
  }
  for (const c of ["vl_saldo_conta", "dt_limite_contas", "situacao_contratacao", "pc33_regime", "pc33_nivel", "pc33_pior", "pc33_itens"]) assert.ok(!publicas.includes(c), c);
});

test("onda 12 (M7): o instrumento do público traz os campos de análise em null, e o recebido não muda", () => {
  const i = { ...instrumento({ nr_convenio: "989358", situacao_contratacao: "Liminar Judicial", dt_limite_contas: "2020-02-29" }), proponente: "MUNICIPIO DE PATOS" };
  const p = instrumentoDoPublico(i);
  for (const c of CAMPOS_DE_ANALISE_DO_INSTRUMENTO) assert.equal(p[c], null, c);
  assert.equal(p.proponente, "MUNICIPIO DE PATOS", "o resto do objeto (a identidade) fica");
  assert.equal(p.vl_global, i.vl_global);
  assert.equal(i.situacao_contratacao, "Liminar Judicial", "o recebido não muda");
  assert.equal(i.vl_saldo_conta, 100_000);
});

test("onda 12 (M7): a leitura do público é idempotente e não mexe na leitura que não é 'ok'", () => {
  const relatorio = montarRelatorio(entradaCompleta(), "2026-10-01");
  const ok = { estado: "ok" as const, relatorio, instrumentos: entradaCompleta().instrumentos ?? [] };
  const uma = leituraDoPublico(ok);
  assert.deepEqual(leituraDoPublico(uma), uma, "aplicar de novo não muda nada");
  assert.deepEqual(uma.relatorio, relatorioDoPublico(relatorio));
  assert.deepEqual(relatorioDoNivel(uma.relatorio, 0), relatorioDoNivel(relatorio, 0), "o que o nível 0 vê é o mesmo");
  assert.ok(relatorio.fiscal && ok.instrumentos.some((i) => i.situacao_contratacao), "a recebida não muda");
  for (const l of [{ estado: "nao_encontrado" as const }, { estado: "erro" as const }]) assert.equal(leituraDoPublico(l), l);
});

// ================================================================ onda 14, parte 2, C: "De onde vêm as emendas"

test("onda 14: só o administrador lê o bloco das emendas, e só na aba do dinheiro — o público, nunca", () => {
  for (const nivel of [0, 1, 2] as const) {
    for (const a of ABAS_MUNICIPIO) assert.equal(leEmendasDoMunicipio(a.id, nivel), false, `nível ${nivel}, aba ${a.id}`);
  }
  assert.deepEqual(ABAS_MUNICIPIO.filter((a) => leEmendasDoMunicipio(a.id, 3)).map((a) => a.id), ["dinheiro"]);
  // O nível 0 é o da página pública (`quemAPaginaAtende` com `aprovado: null`), e a aba do dinheiro abre para ele.
  assert.equal(podeAbaMunicipio("dinheiro", 0), true);
  assert.equal(leEmendasDoMunicipio(abaEscolhida("dinheiro", 0), 0), false);
});

const RAIZ_APP = path.join(import.meta.dirname, "..", "..", "app");
const PASTA_MUNICIPIO = path.join(RAIZ_APP, "mapa", "municipio", "[ibge]");

function fontesDoApp(dir: string): string[] {
  const saida: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) saida.push(...fontesDoApp(p));
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) saida.push(p);
  }
  return saida;
}

test("onda 14: a página do município só chama a leitura das emendas atrás da regra do administrador", () => {
  const pagina = fs.readFileSync(path.join(PASTA_MUNICIPIO, "page.tsx"), "utf8");
  assert.equal(pagina.match(/lerEmendasDoMunicipio\(/g)?.length, 1, "uma chamada só");
  assert.match(pagina, /leEmendasDoMunicipio\(aba, nivel\)\s*\?\s*lerEmendasDoMunicipio\(ibge\)/, "a chamada fica atrás da regra");
  // Nenhuma outra página nem componente do app lê as emendas do município.
  const chamam = fontesDoApp(RAIZ_APP)
    .filter((f) => /lerEmendasDoMunicipio\(/.test(fs.readFileSync(f, "utf8")))
    .map((f) => path.relative(RAIZ_APP, f).split(path.sep).join("/"));
  assert.deepEqual(chamam, ["mapa/municipio/[ibge]/page.tsx"]);
});

test("onda 14: o conteúdo só desenha o bloco no nível do administrador, e o relatório do público não o leva", () => {
  const conteudo = fs.readFileSync(path.join(PASTA_MUNICIPIO, "MunicipioConteudo.tsx"), "utf8");
  assert.equal(conteudo.match(/<EmendasDoMunicipio\b/g)?.length, 1, "um lugar só");
  assert.match(conteudo, /PODE\.interno\(nivel\) && emendas !== undefined && <EmendasDoMunicipio\b/);
  // O relatório para imprimir e o recorte do público não importam o bloco nem a leitura.
  for (const f of fontesDoApp(path.join(PASTA_MUNICIPIO, "relatorio"))) {
    const texto = fs.readFileSync(f, "utf8");
    assert.ok(!/EmendasDoMunicipio|lerEmendasDoMunicipio/.test(texto), f);
  }
  // A leitura é de administrador: fica na memória da instância, fora do cache comum (`cache-dados`).
  const leitura = fs.readFileSync(path.join(import.meta.dirname, "emendas.server.ts"), "utf8");
  assert.ok(!/cache-dados/.test(leitura.replace(/\/\*[\s\S]*?\*\//g, "")), "o emendas.server.ts não importa o cache comum");
});

const autorEmd = (codigo: string, nome: string, tipo: AutorEmendas["tipo"], coletivo = false) => ({ codigo, nome, tipo, coletivo, pessoa: null });
const linhaEmd = (x: Partial<DestinoEmendas>): DestinoEmendas => ({
  ibge: "2510808", autor_codigo: null, canal: "convenio", ente_tipo: "municipio", instrumentos: 1, emendas: 1, indicado: 0, valido: 0, pago: 0, caducado: 0, ...x,
});

test("onda 14: as emendas do município por autor e canal — só o destino municipal, em ordem de tipo e nome, sem ranking", () => {
  const destino = [
    linhaEmd({ autor_codigo: "4270", canal: "convenio", indicado: 1000, valido: 1000, pago: 500 }),
    linhaEmd({ autor_codigo: "4270", canal: "pix", indicado: 300, valido: "300" as unknown as number, pago: 300 }),
    linhaEmd({ autor_codigo: "4270", canal: "favorecido", ente_tipo: "fundo_municipal", pago: 50 }),
    linhaEmd({ autor_codigo: "3905", canal: "fns", ente_tipo: "fundo_municipal", indicado: 200, valido: 200, pago: 100 }),
    linhaEmd({ autor_codigo: "1111", canal: "convenio", indicado: 999 }), // só indicado: fica fora, contado
    linhaEmd({ autor_codigo: null, canal: "fns", ente_tipo: "fundo_municipal", indicado: 400, valido: 400, pago: 400 }),
    linhaEmd({ autor_codigo: "2222", canal: "favorecido", ente_tipo: "empresa", pago: 70 }), // sede no município: à parte
    linhaEmd({ autor_codigo: "2222", canal: "favorecido", ente_tipo: "osc", pago: 30 }),
    linhaEmd({ autor_codigo: "5555", canal: "convenio", ente_tipo: "estado", indicado: 999, valido: 999, pago: 999 }), // estado: fora
    linhaEmd({ autor_codigo: "9999", canal: "convenio", indicado: 10, valido: 10 }), // autor fora da lista: "Autor 9999"
  ];
  const autores = [
    autorEmd("3905", "BANCADA DE TESTE", "bancada", true),
    autorEmd("4270", "AUTORA DE TESTE", "individual"),
    autorEmd("1111", "AUTOR SEM VALOR", "individual"),
  ];
  const e = emendasNoMunicipio(destino, autores);
  assert.deepEqual(e.autores.map((a) => a.codigo), ["4270", "3905", "9999", null], "tipo e nome; o autor fora da lista e o FNS sem autor no fim");
  assert.deepEqual(e.autores[0].canais, [
    { canal: "convenio", valido: 1000, pago: 500 },
    { canal: "pix", valido: 300, pago: 300 },
    { canal: "favorecido", valido: null, pago: 50 },
  ]);
  assert.deepEqual(e.autores[1].canais, [{ canal: "fns", valido: 200, pago: 100 }]);
  assert.equal(e.autores[1].autor?.coletivo, true);
  assert.equal(e.autores[2].autor, null);
  assert.deepEqual(e.autores[3].canais, [{ canal: "fns", valido: 400, pago: 400 }]);
  assert.deepEqual(e.porCanal, [
    { canal: "convenio", autores: 2, valido: 1010, pago: 500 },
    { canal: "pix", autores: 1, valido: 300, pago: 300 },
    { canal: "fns", autores: 1, valido: 600, pago: 500 },
    { canal: "favorecido", autores: 1, valido: null, pago: 50 },
  ]);
  assert.equal(e.soIndicado, 1);
  assert.equal(e.entidadeComSede, 100);
  assert.ok(!e.autores.some((a) => a.codigo === "5555" || a.codigo === "2222"), "estado e entidade com sede não são destino municipal");
  // A ordem não depende do valor: dobrar o pago de um autor não muda a lista.
  const dobrado = emendasNoMunicipio(destino.map((d) => (d.autor_codigo === "3905" ? { ...d, pago: d.pago * 100 } : d)), autores);
  assert.deepEqual(dobrado.autores.map((a) => a.codigo), e.autores.map((a) => a.codigo));
});

test("onda 14: município sem emenda válida nem paga dá a lista vazia, sem quebrar", () => {
  const e = emendasNoMunicipio([], []);
  assert.deepEqual(e, { autores: [], porCanal: [], soIndicado: 0, entidadeComSede: 0 });
});
