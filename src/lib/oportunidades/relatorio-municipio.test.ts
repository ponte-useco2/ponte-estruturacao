import test from "node:test";
import assert from "node:assert/strict";
import type { MunicipioFiscal, VerificacaoFiscal } from "./fiscal.ts";
import type { PlanoLaudoPix } from "./pix-laudo.ts";
import type { TceTcu } from "./tce-tcu.ts";
import { paraCsv } from "./painel.ts";
import {
  COLUNAS_CSV_ACHADOS,
  acimaDoLimite,
  filaDoMunicipio,
  montarRelatorio,
  relatorioSemNomes,
  rotuloPeriodo,
  type EntradaRelatorio,
  type InstrumentoRelatorio,
  type PontoSerie,
} from "./relatorio-municipio.ts";

const HOJE = "2026-10-01";

// A despesa com pessoal de Patos no RGF, como o Siconfi devolveu em 01/10/2026 (série da onda 14).
const PCTS: [number, number, number][] = [
  [2021, 1, 64.51], [2021, 2, 64.93], [2021, 3, 64.49], [2022, 1, 59.01], [2022, 2, 54.52], [2022, 3, 57.16],
  [2023, 1, 60.92], [2023, 2, 61.58], [2023, 3, 58.37], [2024, 1, 52.71], [2024, 2, 51.32], [2024, 3, 52.36],
  [2025, 1, 55.33], [2025, 2, 56.29], [2025, 3, 55.75], [2026, 1, 54.13], [2026, 2, 54.54],
];
const SERIE: PontoSerie[] = PCTS.map(([exercicio, periodo, dtp_pct]) => ({
  exercicio, periodicidade: "Q", periodo, dtp_pct, limite_maximo_pct: 54, limite_prudencial_pct: 51.3,
}));

const municipio: MunicipioFiscal = {
  ibge: "2510808", nome: "Patos", populacao: 103165, tce: "135",
  estados: { G2: "nao_atendido", G7: "nao_atendido", G1: "atendido", G11: "atendido", G12: "atendido", G6: "atendido" },
  conclusoes: [
    { decisao: "A", nome: "Regularidade", estado: "nao_atendido", bloqueantes: ["G7"], alertas: [], sem_dado: [], documentais: [], versao: "x" },
    { decisao: "B", nome: "Transferência voluntária", estado: "nao_atendido", bloqueantes: ["G2", "G7"], alertas: [], sem_dado: [], documentais: [], versao: "x" },
    { decisao: "C", nome: "Operação de crédito", estado: "nao_atendido", bloqueantes: ["G2", "G7"], alertas: [], sem_dado: [], documentais: [], versao: "x" },
  ] as MunicipioFiscal["conclusoes"],
  indicadores: { pessoal_pct: 54.54, cauc_pendencias: ["1.5", "4.2"] },
};
const v = (codigo: string, estado: string, resumo: string) => ({ codigo, nome: codigo, estado, resumo, decisoes: [], evidencia: {}, base_legal: "", documental: false, versao: "x" }) as unknown as VerificacaoFiscal;
const verificacoes = [
  v("G1", "atendido", "Todas as declarações entregues."),
  v("G11", "atendido", "25,60% em educação em 2025."),
  v("G12", "atendido", "26,09% em saúde em 2025."),
  v("G6", "atendido", "DCL de 27,6% da RCL."),
  v("G2", "nao_atendido", "54,54% da RCL ajustada."),
];

const inst = (x: Partial<InstrumentoRelatorio>): InstrumentoRelatorio => ({
  nr_convenio: "900000", modalidade: "Convênio", situacao: "Em execução", subsituacao: null, orgao_sup: "MINISTERIO DA AGRICULTURA", programa: null,
  objeto: null, vl_global: 1_000_000, vl_repasse: 950_000, vl_desembolsado: 500_000, vl_pago: 400_000, vl_saldo_conta: 100_000, pct_fisico: 0.5,
  dt_assinatura: "2024-06-01", dt_fim_vigencia: "2027-12-31", dt_limite_contas: null, dt_primeiro_desembolso: "2025-01-10",
  dt_ultimo_desembolso: "2026-08-01", dt_ultimo_pagamento: "2026-08-20", situacao_contratacao: null, ...x,
});

const tce = (nr: string, original: number, juros: number): TceTcu => ({
  nr_convenio: nr, codigo: 1, numero: "1", ano: 2024, situacao: "Processo autuado", origem_recursos: null, motivo: null, submotivo: null, iniciativa: null,
  dt_instauracao: "2024-01-01", dt_inicio_prazo: null, dt_prestacao_contas: null, dt_atualizacao_debito: null, debito_original: original,
  debito_sem_juros: null, debito_com_juros: juros, numero_processo: `0${nr}/2024-0`, url_processo: null, numero_acordao: null, origem_acordao: null,
  parecer_controle_interno: null, analise_boa_fe: null,
});

const planoPix = (id: number): PlanoLaudoPix => ({
  id_plano_acao: id, codigo_plano_acao: null, ano: 2024, beneficiario: "Patos", cnpj: "09084815000170", cod_ibge: "2510808", autor: null, codigo_emenda: null,
  situacao: null, valor: 1_400_000, custeio: 0, investimento: 1_400_000, pago: 1_337_500, dt_primeira_ob: null, fim_execucao: null, limite_execucao: null,
  area: null, objeto: null, saldo: null, dt_saldo: null, pior: "alto", n_critico: 0, n_alto: 1, n_moderado: 0, n_pendente: 0, versao: null,
  itens: [{ item: "C1", titulo: "Relatório de gestão não entregue", dispositivo: "IN 93, art. 3º", estado: "nao_atendido", nivel: "alto", fato: "x" }],
});

function patos(x: Partial<EntradaRelatorio> = {}): EntradaRelatorio {
  return {
    ibge: "2510808",
    nome: "Patos",
    fiscal: { municipio, verificacoes, referencia: "2026-09-30" },
    serie: { anos: [2021, 2022, 2023, 2024, 2025, 2026], periodos: SERIE },
    instrumentos: [
      inst({ nr_convenio: "942082", objeto: "Máquinas agrícolas", dt_fim_vigencia: "2026-09-30", vl_desembolsado: 958_000, vl_pago: 146_000, vl_saldo_conta: 935_000 }),
      inst({ nr_convenio: "990001", vl_global: 66_000_000, vl_desembolsado: 31_000_000 }),
      inst({ nr_convenio: "826152", situacao: "Aguardando Prestação de Contas", orgao_sup: "MINISTERIO DAS COMUNICACOES", dt_limite_contas: "2020-02-29" }),
      inst({ nr_convenio: "736216", situacao: "Prestação de Contas Concluída", orgao_sup: "MINISTERIO DO DESENVOLVIMENTO SOCIAL" }),
      inst({ nr_convenio: "703764", situacao: "Prestação de Contas Rejeitada", orgao_sup: "MINISTERIO DO TURISMO" }),
      inst({ nr_convenio: "989358", situacao_contratacao: "Liminar Judicial", dt_fim_vigencia: "2027-06-30" }),
      inst({ nr_convenio: "991000", situacao: "Proposta/Plano de Trabalho Aprovado", vl_global: 300_000, dt_fim_vigencia: "2027-01-31", vl_desembolsado: null }),
    ],
    referenciaPainel: "2026-09-29",
    emendas: [
      { nr_convenio: "990001", parlamentar: "FULANO DE TAL", tipo_parlamentar: "Deputado Federal", valor: 500_000 },
      { nr_convenio: "942082", parlamentar: "FULANO DE TAL", tipo_parlamentar: "Deputado Federal", valor: 300_000 },
    ],
    propostas: [
      { id_proposta: "1", ano_envio: 2019, desfecho: "aberta_concedente", orgao_sup: null, programa: null, valor_repasse: 200_000, dias_sem_evento: 2000, dt_ultimo_evento: null, limbo: true },
      { id_proposta: "2", ano_envio: 2024, desfecho: "aberta_concedente", orgao_sup: null, programa: null, valor_repasse: 200_000, dias_sem_evento: 400, dt_ultimo_evento: null },
      { id_proposta: "3", ano_envio: 2025, desfecho: "assinada", orgao_sup: null, programa: null, valor_repasse: 500_000, dias_sem_evento: null, dt_ultimo_evento: null },
      { id_proposta: "4", ano_envio: 2018, desfecho: "aberta_concedente", orgao_sup: null, programa: null, valor_repasse: 1, dias_sem_evento: 3000, dt_ultimo_evento: null },
    ],
    tcu: {
      consultas: [{ nr_convenio: "703764", situacao_convenio: null, cod_ibge: "2510808", n_tce: 1, erro: null }],
      tces: [tce("703764", 300_000, 900_000), tce("736216", 102_000, 230_000)],
      referencia: "2026-09-30",
    },
    contasObras: {},
    pix: Array.from({ length: 8 }, (_, k) => planoPix(k + 1)),
    pixTce: [{ ibge: "2510808", ano: 2025, pago: 2_000_000, pago_pessoal: 0, pago_juros: 0, pago_amortizacao: 0, pct_capital: 95 } as never],
    fundo: [],
    conciliacao: null,
    fornecedores: { concentracao: { cod_ibge: "2510808", municipio: "Patos", convenios: 30, n_fornecedores: 56, pago_pj: 61_600_000, pago_pf: 0, maior_cnpj: null, maior_nome: null, maior_pago: null, maior_fatia: 0.2, hhi: 0.08 }, inidoneos: [] },
    janelas: { elegiveis: 3, urgentes: [] },
    faltas: [],
    ...x,
  };
}

test("série: conta os quadrimestres seguidos acima do limite a partir do mais recente", () => {
  const r = acimaDoLimite(SERIE);
  assert.equal(r.seguidos, 5);
  assert.equal(rotuloPeriodo(r.desde!), "1º quadrimestre de 2025");
  assert.deepEqual(acimaDoLimite(SERIE.slice(0, 12)), { seguidos: 0, desde: null }, "em 2024 voltou abaixo de 54%");
  assert.equal(rotuloPeriodo({ exercicio: 2025, periodicidade: "S", periodo: 2 }), "2º semestre de 2025");
});

test("Patos: os críticos do v1 de 30/09 (transferência travada e as duas TCE)", () => {
  const r = montarRelatorio(patos(), HOJE);
  const criticos = r.achados.filter((a) => a.nivel === "critico").map((a) => a.titulo);
  assert.deepEqual(criticos, ["Transferência voluntária e crédito travados", "2 Tomadas de Contas Especiais no TCU"]);
  const travada = r.achados[0];
  assert.match(travada.fato, /por Pessoal e CAUC\. O CAUC registra pendência nos itens 1\.5 e 4\.2\./);
  assert.match(travada.fato, /art\. 25, § 3º/);
  // F1b: o que trava dinheiro novo vem antes da cobrança, qualquer que seja o nível
  assert.deepEqual(r.achados.slice(0, 3).map((a) => [a.classe, a.titulo.slice(0, 35)]), [
    ["bloqueio", "Transferência voluntária e crédito "],
    ["bloqueio", "Despesa com pessoal acima do limite"],
    ["cobranca", "2 Tomadas de Contas Especiais no TC"],
  ]);
  const tces = r.achados[2];
  assert.match(tces.fato, /O SICONV mostra 736216 como «Prestação de Contas Concluída»/);
  assert.deepEqual(tces.numeros, ["703764", "736216"]);
  // a rejeição que já virou TCE não aparece duas vezes
  assert.ok(!r.achados.some((a) => a.titulo === "Prestação de Contas Rejeitada"));
});

test("Patos: pessoal acima do teto há cinco quadrimestres, com a transição da LC 178", () => {
  const r = montarRelatorio(patos(), HOJE);
  const pessoal = r.achados.find((a) => a.titulo.startsWith("Despesa com pessoal acima do limite"))!;
  assert.equal(pessoal.titulo, "Despesa com pessoal acima do limite há 5 quadrimestres");
  assert.equal(pessoal.nivel, "alto");
  assert.match(pessoal.fato, /^54,54% da RCL ajustada no 2º quadrimestre de 2026, para um limite de 54,00%; acima dele desde o 1º quadrimestre de 2025\./);
  assert.match(pessoal.fato, /No fim de 2021 estava em 64,49%: vale conferir o regime de transição da LC 178\/2021 \(art\. 15\)\./);
});

test("Patos: convênios, prestação atrasada desde 2020, liminar e Pix sem relatório", () => {
  const r = montarRelatorio(patos(), HOJE);
  const t = (inicio: string) => r.achados.find((a) => a.titulo.startsWith(inicio));
  assert.equal(t("Prestação de contas atrasada")?.nivel, "alto");
  assert.match(t("Prestação de contas atrasada")!.fato, /826152 \(MINISTERIO DAS COMUNICACOES\).*venceu em 29\/02\/2020/);
  assert.match(t("Convênio com a vigência vencida")!.fato, /942082.*com R\$ 935 mil em conta/);
  assert.equal(t("Convênio assinado sob liminar")?.nivel, "alto");
  const pix = t("Pix, a conferir: relatório de gestão não entregue")!;
  assert.equal(pix.titulo, "Pix, a conferir: relatório de gestão não entregue (8 planos)");
  assert.match(pix.fato, /somando R\$ 10,7 mi/);
  assert.equal(pix.acao, "Entregar os relatórios de gestão do Pix no Transferegov.");
  assert.equal(t("1 convênio aprovado espera assinatura")?.nivel, "moderado");
  const paradas = t("2 propostas paradas")!;
  assert.match(paradas.fato, /Enviadas de 2019 a 2024, sem evento há mais de um ano; 1 delas não teve nenhum evento desde o envio\./, "a de 2018 fica fora do recorte desde 2019");
});

test("Patos: o que está em ordem e os quatro números do topo", () => {
  const r = montarRelatorio(patos(), HOJE);
  const emDia = r.emDia.map((a) => a.titulo);
  assert.ok(emDia.includes("Declarações ao Siconfi entregues, Mínimo de educação aplicado, Mínimo de saúde aplicado e Dívida consolidada abaixo do limite"));
  assert.ok(emDia.includes("Pix gasto em capital, sem pessoal nem dívida"));
  assert.ok(emDia.includes("Fornecedores sem concentração e nenhum inidôneo no TCU"));
  assert.deepEqual(r.cartoes.map((c) => [c.rotulo, c.valor]), [
    ["Pessoal / RCL ajustada", "54,54%"],
    ["CAUC", "2 pendências"],
    ["Convênios em execução", "R$ 68,0 mi"],
    ["TCE no TCU", "2"],
  ]);
  assert.match(r.cartoes[0].nota, /Acima dele desde o 1º quadrimestre de 2025\./);
});

test("o que fazer primeiro: o que destrava mais vem antes, e só o que é do município", () => {
  const r = montarRelatorio(patos(), HOJE);
  assert.equal(r.passos[0].titulo, "Regularizar os itens 1.5 e 4.2 do CAUC: sem isso, cada convênio novo depende de exceção ou de decisão judicial.");
  assert.ok(r.passos.length <= 5);
  assert.ok(r.destaques.every((a) => a.nivel !== "em_dia" && a.nivel !== "informativo"));
  assert.ok(r.destaques.length <= 6);
});

test("fonte que falhou não vira achado nem 'em dia': a seção some e a falta aparece", () => {
  const r = montarRelatorio(patos({ fiscal: null, serie: null, tcu: null, faltas: ["painel fiscal", "e-TCE do TCU"] }), HOJE);
  assert.equal(r.fiscal, null);
  assert.ok(!r.achados.some((a) => a.dimensao === "fiscal"));
  assert.ok(!r.cartoes.some((c) => c.rotulo === "CAUC" || c.rotulo === "Pessoal / RCL ajustada"));
  assert.deepEqual(r.faltas, ["painel fiscal", "e-TCE do TCU"]);
});

test("município sem problema: nenhum crítico, e o 'em dia' diz o que foi conferido", () => {
  const limpo = patos({
    fiscal: {
      municipio: { ...municipio, conclusoes: municipio.conclusoes.map((c) => ({ ...c, estado: "atendido" as const, bloqueantes: [] })), indicadores: { pessoal_pct: 45, cauc_pendencias: [] } },
      verificacoes,
      referencia: "2026-09-30",
    },
    serie: { anos: [2026], periodos: [{ exercicio: 2026, periodicidade: "Q", periodo: 2, dtp_pct: 45, limite_maximo_pct: 54, limite_prudencial_pct: 51.3 }] },
    instrumentos: [inst({})],
    tcu: { consultas: [{ nr_convenio: "900000", situacao_convenio: null, cod_ibge: "2510808", n_tce: 0, erro: null }], tces: [], referencia: "2026-09-30" },
    pix: [],
    propostas: [],
  });
  const r = montarRelatorio(limpo, HOJE);
  assert.ok(!r.achados.some((a) => a.nivel === "critico" || a.nivel === "alto"), JSON.stringify(r.achados.filter((a) => a.nivel === "critico" || a.nivel === "alto")));
  assert.ok(r.emDia.some((a) => a.titulo === "Apto a receber transferência voluntária"));
  assert.ok(r.emDia.some((a) => a.titulo === "Nenhuma TCE no TCU"));
  assert.ok(r.emDia.some((a) => a.titulo === "Despesa com pessoal abaixo do prudencial"));
  assert.equal(r.cartoes.find((c) => c.rotulo === "CAUC")?.valor, "sem pendência");
});

test("CSV: um achado por linha, com nível e dimensão por extenso", () => {
  const r = montarRelatorio(patos(), HOJE);
  const linhas = paraCsv(COLUNAS_CSV_ACHADOS, r.achados).replace(/^﻿/, "").split("\r\n");
  assert.equal(linhas[0], "Nível;Dimensão;Achado;Fato;O que fazer;Convênios");
  assert.match(linhas[1], /^crítico;Capacidade fiscal;Transferência voluntária e crédito travados;/);
  assert.ok(linhas.some((l) => l.endsWith(";703764 736216")));
  assert.equal(linhas.filter(Boolean).length, r.achados.length + 1);
});

test("camada 2: indicador-chave alto ou moderado vira achado da dimensão, sem passar à frente do fiscal", () => {
  const catalogo = [
    { id: "homicidios_taxa", dimensao: "seguranca", nome: "Homicídios", unidade: "por 100 mil hab.", casas: 2, direcao: "menor", chave: true },
    { id: "ideb_ai_municipal", dimensao: "educacao", nome: "IDEB, anos iniciais", unidade: "pontos", casas: 1, direcao: "maior", chave: true },
    { id: "pntp_prefeitura", dimensao: "governanca", nome: "Transparência da prefeitura", unidade: "pontos de 0 a 100", casas: 2, direcao: "maior", chave: true },
  ] as const;
  const l = (indicador: string, ano: string, valor: number) => ({ indicador, ano, valor, fonte: "F", url: null, nota: null, posicao_pb: null, total_pb: null, mediana_porte: null, mediana_regiao: null });
  const q = (indicador: string, ano: string, v: [number, number, number], br?: number) => [
    { indicador, ano, recorte: "q1_pb" as const, valor: v[0] }, { indicador, ano, recorte: "mediana_pb" as const, valor: v[1] },
    { indicador, ano, recorte: "q3_pb" as const, valor: v[2] }, ...(br !== undefined ? [{ indicador, ano, recorte: "BR" as const, valor: br }] : []),
  ];
  const r = montarRelatorio(patos({
    indicadores: {
      catalogo: [...catalogo],
      linhas: [l("homicidios_taxa", "2022-2024", 36.19), l("ideb_ai_municipal", "2025", 6.8), l("pntp_prefeitura", "2025", 50)],
      referencias: [...q("homicidios_taxa", "2022-2024", [8, 15, 25], 21.5), ...q("ideb_ai_municipal", "2025", [5.2, 5.8, 6.3]), ...q("pntp_prefeitura", "2025", [60, 75, 90])],
      grupo: null,
      coletadoEm: "2026-10-05T12:00:00Z",
    },
  }), HOJE);
  const social = r.achados.filter((a) => a.dimensao === "social");
  assert.deepEqual(social.map((a) => [a.nivel, a.titulo]), [
    ["alto", "Homicídios: entre os 25% piores da PB e pior que o Brasil"],
    ["em_dia", "Social: 1 indicador-chave na mediana da PB ou melhor"],
  ]);
  assert.match(social[0].fato, /^36,19 por 100 mil hab\. \(2022-2024\)\. mediana dos municípios da PB 15,00; Brasil 21,50\. Fonte: F\.$/);
  const gov = r.achados.find((a) => a.dimensao === "governanca");
  assert.equal(gov?.nivel, "moderado");
  assert.equal(gov?.titulo, "Transparência da prefeitura: entre os 25% piores da PB");
  // os críticos do fiscal e do controle seguem na frente; indicador não vira passo
  assert.equal(r.destaques[0].nivel, "critico");
  assert.ok(r.passos.every((p) => !p.porque.includes("homicídios")));
  assert.equal(r.indicadores?.contagem.alto, 1);
  assert.ok(r.fontes.some((f) => f.fonte.startsWith("Indicadores do município") && f.data === "2026-10-05T12:00:00Z"));
});

test("camada 2 ausente: o relatório da camada 1 sai igual, sem seção de indicadores", () => {
  const r = montarRelatorio(patos(), HOJE);
  assert.equal(r.indicadores, null);
  assert.ok(!r.achados.some((a) => ["social", "economia", "territorio", "governanca"].includes(a.dimensao)));
});

test("sem nomes (D1): fornecedor sai do relatório de quem não é administrador; o resto fica igual", () => {
  const fornecedores = {
    concentracao: { cod_ibge: "2510808", municipio: "Patos", convenios: 30, n_fornecedores: 56, pago_pj: 61_600_000, pago_pf: 0,
                    maior_cnpj: "12345678000199", maior_nome: "CONSTRUTORA EXEMPLO LTDA", maior_pago: 40_000_000, maior_fatia: 0.65, hhi: 0.45 },
    inidoneos: [{ cnpj: "98765432000111", nome: "EMPRESA INIDONEA SA", pago: 1_200_000 }],
  };
  const r = montarRelatorio(patos({ fornecedores }), HOJE);
  const s = relatorioSemNomes(r);
  const texto = JSON.stringify(s);
  assert.ok(!texto.includes("CONSTRUTORA EXEMPLO") && !texto.includes("EMPRESA INIDONEA") && !texto.includes("98765432000111") && !texto.includes("12345678000199"));
  const inidoneo = s.achados.find((a) => a.titulo.includes("inidôneos do TCU"));
  assert.match(inidoneo!.fato, /^Somam R\$ 1,2 mi pagos nos convênios do município\. O nome de cada empresa fica no painel interno/);
  assert.match(s.achados.find((a) => a.titulo === "Um fornecedor com mais da metade do pago")!.fato, /^Uma empresa recebeu 65% do pago/);
  assert.equal(s.destaques.length, r.destaques.length);
  assert.deepEqual(s.achados.filter((a) => a.dimensao !== "fornecedores"), r.achados.filter((a) => a.dimensao !== "fornecedores"), "só a dimensão de fornecedores muda");
  assert.ok(JSON.stringify(r).includes("CONSTRUTORA EXEMPLO"), "o original, do administrador, não é alterado");
});

test("Pix impedido (oport_29): os dois últimos anos viram pontos; pela vez do município é moderado, pela do órgão é informação", () => {
  const impedido = (id: number, ano: number, grupo: string, valor: number, im: Record<string, unknown> = {}): PlanoLaudoPix => ({
    ...planoPix(id), ano, situacao: "IMPEDIDO", valor, pago: 0, itens: [],
    analise_pt: { analises: [], total_analises: 0, impedimento: { motivo: null, grupo, gemeo: null, reindicacao: null, ...im } },
  });
  const r = montarRelatorio(patos({
    pix: [
      planoPix(1),
      impedido(2, 2026, "falta_complementacao", 300000),
      impedido(3, 2025, "falta_analise", 500000, { gemeo: { codigo: "x", situacao: "CIENTE", pago: 500000 } }),
      impedido(4, 2025, "falta_analise", 200000, { reindicacao: { ano: 2026, planos: 1, valor: 200000, nao_impedidos: 1, pago: 0 } }),
      impedido(5, 2023, "falta_analise", 900000),
    ],
  }), HOJE);
  const pix = r.achados.filter((a) => a.titulo.startsWith("Pix impedido"));
  const sp = (t: string) => t.replace(/\u00a0/g, " "); // moedaCurta usa espaço não separável
  assert.deepEqual(pix.map((a) => [sp(a.titulo), a.nivel]), [
    ["Pix impedido em 2026: o ente não complementou o plano de trabalho no prazo (1 plano, R$ 300 mil perdidos)", "moderado"],
    ["Pix impedido em 2025: o órgão federal não analisou o plano no prazo (2 planos, R$ 200 mil perdidos)", "informativo"],
  ]);
  assert.match(sp(pix[1].fato), /1 voltou no mesmo ano, reapresentado num ciclo seguinte \(R\$ 500 mil\); a perda líquida foi de R\$ 200 mil\. Em 2026, 1 teve o município indicado de novo pelo mesmo autor\./);
  assert.ok(pix[0].acao?.startsWith("Acompanhar os prazos do próximo ciclo"));
  assert.equal(pix[1].acao, null);
});

test("Pix em curso (oport_30): plano à espera do município é alto, na classe dos prazos, e entra nos destaques de quem não tem bloqueio", () => {
  const limpo = {
    fiscal: {
      municipio: { ...municipio, conclusoes: municipio.conclusoes.map((c) => ({ ...c, estado: "atendido" as const, bloqueantes: [] })), indicadores: { pessoal_pct: 45, cauc_pendencias: [] } },
      verificacoes,
      referencia: "2026-09-30",
    },
    serie: { anos: [2026], periodos: [{ exercicio: 2026, periodicidade: "Q" as const, periodo: 2, dtp_pct: 45, limite_maximo_pct: 54, limite_prudencial_pct: 51.3 }] },
    instrumentos: [inst({})],
    tcu: { consultas: [{ nr_convenio: "900000", situacao_convenio: null, cod_ibge: "2510808", n_tce: 0, erro: null }], tces: [], referencia: "2026-09-30" },
    propostas: [],
  };
  const r = montarRelatorio(patos({
    ...limpo,
    pixCiclo: [{
      id_plano_acao: 9, codigo_plano_acao: "09032026-000009", ano: 2026, ciclo: 1, beneficiario: "Patos", cnpj: "09084815000170", cod_ibge: "2510808",
      autor: "Fulano", valor: 400000, situacao_plano: "CIENTE", situacao_pt: "Em Complementação", desde: "2026-09-20", vez: "ente",
      etapa: "complementar o plano de trabalho", prazo: "2026-10-15", prazo_fonte: "Comunicado nº 20/2026", ultima_analise: null,
    }],
  }), HOJE);
  const a = r.achados.find((x) => x.titulo.startsWith("Pix em curso"));
  assert.ok(a);
  assert.equal(a.nivel, "alto");
  assert.equal(a.classe, "prazo");
  assert.equal(a.quem, "municipio");
  assert.equal(a.prazo, "2026-10-15");
  assert.match(a.fato, /faltam 14 dias/);
  assert.ok(r.destaques.some((x) => x.titulo.startsWith("Pix em curso")), "vai para o que mais pesa");
});

test("aba «o que trava» (F1b): Patos em classes, com quem resolve; a mesma ordem do «Em uma página»; indicadores fora", () => {
  const catalogo = [{ id: "homicidios_taxa", dimensao: "seguranca", nome: "Homicídios", unidade: "por 100 mil hab.", casas: 2, direcao: "menor", chave: true }] as const;
  const r = montarRelatorio(patos({
    indicadores: {
      catalogo: [...catalogo],
      linhas: [{ indicador: "homicidios_taxa", ano: "2022-2024", valor: 36.19, fonte: "F", url: null, nota: null, posicao_pb: null, total_pb: null, mediana_porte: null, mediana_regiao: null }],
      referencias: [
        { indicador: "homicidios_taxa", ano: "2022-2024", recorte: "q1_pb", valor: 8 },
        { indicador: "homicidios_taxa", ano: "2022-2024", recorte: "mediana_pb", valor: 15 },
        { indicador: "homicidios_taxa", ano: "2022-2024", recorte: "q3_pb", valor: 25 },
        { indicador: "homicidios_taxa", ano: "2022-2024", recorte: "BR", valor: 21.5 },
      ],
      grupo: null,
      coletadoEm: "2026-10-05T12:00:00Z",
    },
  }), HOJE);
  const f = filaDoMunicipio(r);
  const classes = f.grupos.map((g) => g.classe);
  assert.deepEqual(classes, [...classes].sort((a, b) => ["bloqueio", "cobranca", "prazo", "atencao"].indexOf(a) - ["bloqueio", "cobranca", "prazo", "atencao"].indexOf(b)));
  assert.equal(classes[0], "bloqueio");
  assert.deepEqual(f.grupos[0].itens.map((a) => a.titulo.slice(0, 35)), ["Transferência voluntária e crédito ", "Despesa com pessoal acima do limite"]);
  const cobranca = f.grupos.find((g) => g.classe === "cobranca");
  assert.equal(cobranca?.itens[0].quem, "tribunal", "a TCE se resolve no TCU");
  assert.ok(f.grupos.every((g) => g.itens.every((a) => a.nivel !== "em_dia" && a.nivel !== "informativo" && a.dimensao !== "social")));
  assert.equal(f.indicadores, 1, "o homicídio fica na aba dos indicadores");
  // o «Em uma página» é o começo da mesma fila (os indicadores entram nele, mas não mudam a ordem do resto)
  const fila = f.grupos.flatMap((g) => g.itens.map((a) => a.titulo));
  const topo = r.destaques.filter((a) => a.dimensao !== "social").map((a) => a.titulo);
  assert.deepEqual(fila.slice(0, topo.length), topo);
});
