import test from "node:test";
import assert from "node:assert/strict";
import {
  chaveOrgao,
  cnpjLegivel,
  etapaDo,
  funis,
  lerDiagnostico,
  motivoAcessoLivreVazio,
  nivelMaisAlto,
  nomeProponente,
  portaServe,
  tempoNaEtapa,
  vizinhanca,
  type EntradaDiagnostico,
  type InstrumentoLaudo,
  type Vizinho,
} from "./diagnostico.ts";
import { lerAcessoLivre, type Dossie, type ExigDetalhe, type ExigEvento } from "./laudo.ts";
import type { LinhaDesfecho, LinhaEtapa } from "./painel.ts";

const HOJE = "2026-09-28";

// ------------------------------------------------------------------ o 962210 como está no painel (execução 25, 26/09/2026)

const I962210: InstrumentoLaudo = {
  nr_convenio: "962210",
  id_proposta: "1988073",
  nr_proposta: "8161/2024",
  modalidade: "TERMO DE COMPROMISSO",
  situacao: "Proposta/Plano de Trabalho Aprovado",
  subsituacao: null,
  vivo: false,
  detalhe: true,
  uf: "PB",
  cod_ibge: "2507507",
  municipio: "JOÃO PESSOA",
  proponente: "ESTADO DA PARAIBA",
  cnpj: "08761124000100",
  tipo_agente: "estado",
  orgao_sup: "MINISTERIO DA CULTURA",
  orgao: "INSTITUTO DO PATRIMONIO HIST. E ART. NACIONAL",
  cod_programa: "2041120240005",
  programa: "NOVO PAC PATRIMÔNIO CULTURAL - PROJETOS",
  temas: ["cultura"],
  objeto: "Contratação de projetos técnicos para Estruturação dos Sítio Arqueológico Itacoatiaras do Rio Ingá - Ingá/PB",
  com_emenda: false,
  vl_global: 450000,
  vl_repasse: 450000,
  vl_contrapartida: 0,
  vl_empenhado: 450000,
  vl_desembolsado: null,
  vl_pago: null,
  vl_saldo_conta: 0,
  // Como o job gravava antes da onda 12: 999% sem desembolso. O laudo não usa este campo.
  pct_desembolsado: 9.99,
  pct_fisico: null,
  dt_assinatura: null,
  dt_inicio_vigencia: "2024-10-08",
  dt_fim_vigencia: "2025-10-03",
  dt_limite_contas: "2025-10-03",
  dt_suspensiva: null,
  dt_retirada_suspensiva: null,
  n_aditivos: 0,
  n_prorrogas: 0,
  dt_primeiro_desembolso: null,
  dt_ultimo_desembolso: null,
  dt_ultimo_pagamento: null,
  // oport_19, conferido no SICONV de 14/09/2026.
  situacao_contratacao: null,
  dt_fim_vigencia_original: "2025-10-03",
  dt_envio: "2024-05-29",
  dt_aprovacao: "2024-06-06",
  dt_conclusao: null,
  dt_ultimo_historico: "2024-06-21",
  ultimo_historico: "PLANO_TRABALHO_APROVADO",
};

function etapa(recorte: string, dimensao: "orgao" | "programa", chave: string, e: string, n: number, mediana: number, p90: number, emAberto = 0): LinhaEtapa {
  return { recorte, dimensao, chave, rotulo: chave, orgao_sup: "MINISTERIO DA CULTURA", etapa: e, n, mediana, p90, em_aberto: emAberto, idade_mediana_aberto: null };
}

const ETAPAS_MINC: LinhaEtapa[] = [
  etapa("PB", "orgao", "MINISTERIO DA CULTURA", "aprovacao_assinatura", 35, 14, 133, 2),
  etapa("BR", "orgao", "MINISTERIO DA CULTURA", "aprovacao_assinatura", 3146, 0, 51, 40),
  etapa("BR", "programa", "2041120240005", "aprovacao_assinatura", 90, 161, 328, 4),
  // Programa na PB com poucas medições: não serve de base.
  etapa("PB", "programa", "2041120240005", "aprovacao_assinatura", 2, 20, 30),
  etapa("PB", "orgao", "MINISTERIO DA CULTURA", "envio_aprovacao", 39, 61.4, 249),
];

function desfecho(uf: string, enviadas: number, assinadas: number, aguardando: number, abertas: number, negadas: number): LinhaDesfecho {
  return {
    cod_programa: "2041120240005",
    programa: "NOVO PAC PATRIMÔNIO CULTURAL - PROJETOS",
    orgao_sup: "MINISTERIO DA CULTURA",
    ano_envio: 2024,
    uf,
    enviadas,
    assinadas,
    reprovadas: negadas,
    reprovadas_lote: 0,
    impedimento: 0,
    impedimento_lote: 0,
    eliminadas: 0,
    abertas_concedente: abertas,
    limbo: 0,
    abertas_proponente: 0,
    aguardando_assinatura: aguardando,
    com_emenda: 0,
    assinadas_com_emenda: 0,
    valor_pedido: 0,
  };
}

function vizinho(nr: string, situacao: string | null, repasse: number, extra: Partial<Vizinho> = {}): Vizinho {
  const assinado = situacao !== null && !/Proposta\/Plano|Cancelado/.test(situacao);
  return {
    nr_convenio: nr,
    situacao,
    uf: "PB",
    municipio: "JOÃO PESSOA",
    proponente: "ESTADO DA PARAIBA",
    orgao_sup: "MINISTERIO DA SAUDE",
    programa: "Outro",
    dt_assinatura: assinado ? "2022-01-10" : null,
    dt_suspensiva: null,
    dt_retirada_suspensiva: null,
    dt_fim_vigencia: "2027-12-31",
    vl_repasse: repasse,
    vl_desembolsado: null,
    ...extra,
  };
}

/** A carteira do Estado da PB no painel de 26/09/2026, em forma reduzida. */
const CARTEIRA_ESTADO: Vizinho[] = [
  vizinho("962210", "Proposta/Plano de Trabalho Aprovado", 450000, { orgao_sup: "MINISTERIO DA CULTURA" }),
  ...Array.from({ length: 6 }, (_, k) => vizinho(`96000${k}`, "Proposta/Plano de Trabalho Aprovado", 1_700_000, k === 0 ? { orgao_sup: "MINISTERIO DA CULTURA" } : {})),
  vizinho("970001", "Proposta/Plano de Trabalho Complementado em Análise", 14_625_000),
  ...Array.from({ length: 15 }, (_, k) => vizinho(`90000${k}`, "Convênio Anulado", 2_200_000)),
  ...Array.from({ length: 6 }, (_, k) => vizinho(`91000${k}`, "Cancelado", 4_100_000)),
  ...Array.from({ length: 17 }, (_, k) => vizinho(`92000${k}`, "Em execução", 28_000_000)),
];

const PARES_PROGRAMA_PB: Vizinho[] = [
  vizinho("962210", "Proposta/Plano de Trabalho Aprovado", 450000, { orgao_sup: "MINISTERIO DA CULTURA" }),
  vizinho("962211", "Em execução", 300000, { orgao_sup: "MINISTERIO DA CULTURA", proponente: "MUNICIPIO X" }),
  vizinho("962212", "Em execução", 500000, { orgao_sup: "MINISTERIO DA CULTURA", proponente: "MUNICIPIO Y" }),
];

function entrada962210(extra: Partial<EntradaDiagnostico> = {}): EntradaDiagnostico {
  return {
    instrumento: I962210,
    etapas: ETAPAS_MINC,
    desfechos: [desfecho("BR", 102, 90, 4, 6, 2), desfecho("PB", 3, 2, 1, 0, 0)],
    pares: PARES_PROGRAMA_PB,
    carteira: CARTEIRA_ESTADO,
    emendas: [],
    fiscal: null,
    portas: [],
    faltas: [],
    ...extra,
  };
}

test("962210: esperando assinatura há 844 dias, contra 14 de mediana e 133 de P90 do MinC na PB", () => {
  const d = lerDiagnostico(entrada962210(), HOJE);
  assert.equal(d.etapa, "assinatura");
  assert.equal(d.vez, "concedente");
  assert.ok(d.tempo);
  assert.equal(d.tempo.etapa, "aprovacao_assinatura");
  assert.equal(d.tempo.dias, 844);
  assert.equal(d.tempo.base?.rotulo, "Ministério da Cultura na PB");
  assert.deepEqual([d.tempo.base?.mediana, d.tempo.base?.p90], [14, 133]);
  assert.equal(d.tempo.posicao, "passou_do_p90");
  // O programa na PB tem só 2 medições: fica de fora; entram o órgão na PB, o programa e o órgão no Brasil.
  assert.deepEqual(d.tempo.comparacoes.map((c) => c.rotulo), ["Ministério da Cultura na PB", "Programa no Brasil", "Ministério da Cultura no Brasil"]);
  assert.match(d.frase, /^Plano de trabalho aprovado em 06\/06\/2024 e não assinado: 844 dias até hoje\./);
  assert.match(d.frase, /último registro do histórico é «Plano de trabalho aprovado», em 21\/06\/2024/);
});

test("962210: vigência vencida sem assinatura é o risco crítico, e a estratégia começa por saber se ainda há instrumento", () => {
  const d = lerDiagnostico(entrada962210(), HOJE);
  assert.equal(d.vigencia.dias, -360);
  assert.equal(d.vigencia.nivel, "critico");
  assert.equal(d.riscos[0].nivel, "critico");
  assert.equal(d.riscos[0].titulo, "Vigência vencida sem assinatura");
  assert.ok(d.riscos.some((r) => r.titulo === "Mais demorado que 9 em cada 10 do órgão na PB" && r.nivel === "alto"));
  assert.equal(d.estrategia[0].titulo, "Confirmar com o concedente se o instrumento ainda pode ser assinado");
  assert.ok(d.inacao.some((x) => x.startsWith("R$ 450 mil de repasse aprovados")));
});

test("962210: o programa andou para os outros, e o funil nacional vem das propostas, não da busca", () => {
  const d = lerDiagnostico(entrada962210(), HOJE);
  const fora = d.riscos.find((r) => r.titulo === "Fora do padrão do programa");
  assert.ok(fora);
  assert.match(fora.fato, /Dos 3 instrumentos do programa na PB, 2 já foram assinados; só este segue/);
  assert.match(fora.fato, /das 102 propostas do programa enviadas desde 2019, 90 foram assinadas/);
  assert.deepEqual(
    d.programa?.funis.map((f) => [f.recorte, f.enviadas, f.assinadas, f.aguardando, f.negadas, f.abertas]),
    [
      ["BR", 102, 90, 4, 2, 6],
      ["PB", 3, 2, 1, 0, 0],
    ],
  );
});

test("962210: a carteira do Estado — outros esperando assinatura e o que já foi perdido", () => {
  const d = lerDiagnostico(entrada962210(), HOJE);
  const c = d.proponente?.carteira;
  assert.ok(c);
  // 6 aprovados e 1 complementado em análise: todos "aprovado, esperando assinatura". O próprio não conta.
  assert.equal(c.mesmaEtapa.n, 7);
  assert.equal(c.mesmaEtapaMesmoOrgao.n, 1);
  assert.equal(c.extintos.n, 21);
  assert.ok(d.riscos.some((r) => r.titulo === "O proponente tem outros instrumentos parados na mesma etapa"));
  assert.ok(d.estrategia.some((p) => p.titulo === "Tratar a carteira do proponente de uma vez" && /1 com o mesmo órgão/.test(p.porque)));
  assert.ok(d.inacao.some((x) => /já teve 21 instrumentos anulados, rescindidos ou cancelados/.test(x)));
});

test("962210: Estado não entra no painel fiscal, e o laudo diz por quê; sem desembolso é 0%, não 999%", () => {
  const d = lerDiagnostico(entrada962210(), HOJE);
  assert.equal(d.fiscal, null);
  // O CSV do CAUC dos estados parou em 03/11/2025: o laudo manda consultar o extrato, em vez de mostrar o retrato velho.
  assert.match(d.fiscalMotivo ?? "", /o Estado não entra nele\. O relatório do CAUC dos estados .* desde 03\/11\/2025/);
  assert.equal(d.dinheiro.pctDesembolsado, 0);
  assert.equal(d.dinheiro.semDesembolso, 450000);
});

test("com o programa aberto de novo e a vigência vencida, entra o plano B", () => {
  const porta = {
    id: "x",
    titulo: "Novo PAC Patrimônio Cultural - Projetos",
    financiador: "MinC",
    prazo: "2026-10-30",
    diasRestantes: 32,
    fonteNome: "Transferegov",
    fonteUrl: "https://example.org",
    codigos: ["2041120240005"],
    mesmoPrograma: true,
    mesmoOrgao: true,
    mesmoTema: true,
  };
  const doOrgao = { ...porta, id: "y", titulo: "Obras 2026", financiador: "MINISTERIO DA CULTURA", codigos: [], mesmoPrograma: false, diasRestantes: 3 };
  // Só o tema casa (o classificador marcou "cultura" numa janela de agricultura familiar): não entra.
  const soTema = { ...porta, id: "z", titulo: "Emendas MDA", financiador: "MDA", codigos: [], mesmoPrograma: false, mesmoOrgao: false, diasRestantes: 0 };
  const d = lerDiagnostico(entrada962210({ portas: [soTema, doOrgao, porta] }), HOJE);
  assert.deepEqual(d.portas.map((p) => p.id), ["x", "y"]); // o mesmo programa vem antes, mesmo com prazo maior
  assert.ok(d.estrategia.some((p) => p.titulo === "Plano B: o programa está com janela aberta" && /até 30\/10\/2026/.test(p.porque)));
  // Só com janela do mesmo órgão (o caso real do 962210: "Obras 2026", do MinC), o plano B aponta para ela.
  const soOrgao = lerDiagnostico(entrada962210({ portas: [soTema, doOrgao] }), HOJE);
  const b = soOrgao.estrategia.find((p) => p.titulo === "Plano B: o mesmo órgão tem janela aberta");
  assert.ok(b);
  assert.equal(b.porque, "«Obras 2026» (Ministério da Cultura) recebe propostas até 30/10/2026.");
});

test("leitura que falhou vem nula e o laudo sai sem ela", () => {
  const d = lerDiagnostico(entrada962210({ pares: null, carteira: null, emendas: null, portas: null, faltas: ["pares do programa"] }), HOJE);
  assert.equal(d.programa?.naUf, null);
  assert.equal(d.proponente, null);
  assert.deepEqual(d.emendas, []);
  assert.deepEqual(d.faltas, ["pares do programa"]);
  assert.equal(d.riscos[0].titulo, "Vigência vencida sem assinatura");
});

// ------------------------------------------------------------------ as outras etapas

function base(extra: Partial<InstrumentoLaudo>): InstrumentoLaudo {
  return {
    ...I962210,
    nr_convenio: "1",
    situacao: "Em execução",
    tipo_agente: "municipio",
    proponente: "MUNICIPIO DE SOUSA",
    cod_ibge: "2516201",
    dt_assinatura: "2023-01-10",
    dt_fim_vigencia: "2027-12-31",
    dt_fim_vigencia_original: "2027-12-31",
    vl_desembolsado: 0,
    ...extra,
  };
}

test("etapa pela situação do SICONV", () => {
  const e = (situacao: string | null, extra: Partial<Vizinho> = {}) =>
    etapaDo({ situacao, dt_assinatura: "2024-01-01", dt_suspensiva: null, dt_retirada_suspensiva: null, ...extra });
  assert.equal(e(null, { dt_assinatura: null }), "proposta");
  assert.equal(e("Proposta/Plano de Trabalho Complementado em Análise", { dt_assinatura: null }), "assinatura");
  assert.equal(e("Assinatura Pendente Registro TV Siafi"), "assinatura");
  assert.equal(e("Em execução", { dt_suspensiva: "2026-12-01" }), "suspensiva");
  assert.equal(e("Em execução", { dt_suspensiva: "2025-12-01", dt_retirada_suspensiva: "2025-06-01" }), "execucao");
  assert.equal(e("Aguardando Prestação de Contas"), "contas");
  assert.equal(e("Prestação de Contas Concluída"), "concluido");
  assert.equal(e("Convênio Anulado", { dt_suspensiva: "2024-06-01" }), "extinto");
});

test("suspensiva com dossiê: o diagnóstico só complementa (sem vigência, tempo e inação, que o laudo da suspensiva já trata)", () => {
  const i = base({
    nr_convenio: "980439",
    situacao_contratacao: "Cláusula Suspensiva",
    dt_assinatura: "2025-12-22",
    dt_suspensiva: "2026-10-10",
    dt_fim_vigencia: "2026-12-01",
    motivo_suspensao: "Projeto de Engenharia",
  });
  const entrada: EntradaDiagnostico = {
    ...entrada962210(),
    instrumento: i,
    etapas: [],
    carteira: null,
    pares: null,
    emendas: [{ nr_emenda: "60120002", parlamentar: "COM. AGRICULTURA E REFORMA AGRARIA", tipo_parlamentar: "COMISSAO", impositiva: false, valor: 396343.15 }],
  };
  const sem = lerDiagnostico(entrada, HOJE);
  assert.equal(sem.etapa, "suspensiva");
  assert.ok(sem.riscos.some((r) => r.titulo === "Pouca vigência pela frente"));
  assert.ok(sem.estrategia.some((p) => p.titulo === "Pedir a prorrogação do prazo da suspensiva"));

  const com = lerDiagnostico(entrada, HOJE, { comDossie: true });
  assert.ok(!com.riscos.some((r) => r.titulo === "Pouca vigência pela frente"));
  assert.ok(!com.estrategia.some((p) => /suspensiva/.test(p.titulo)));
  assert.deepEqual(com.inacao, []);
  const autor = com.estrategia.find((p) => p.titulo === "Envolver o autor da emenda");
  assert.ok(autor);
  assert.match(autor.porque, /emenda de comissão nº 60120002, de COM\. AGRICULTURA E REFORMA AGRARIA\./);

  // Emenda de relator-geral não tem autor a procurar; e, com o dinheiro todo desembolsado, o passo não cabe.
  const relator = lerDiagnostico(
    { ...entrada, emendas: [{ nr_emenda: "81000785", parlamentar: "RELATOR GERAL", tipo_parlamentar: "RELATOR GERAL", impositiva: false, valor: 1 }] },
    HOJE,
    { comDossie: true },
  );
  assert.ok(!relator.estrategia.some((p) => p.titulo === "Envolver o autor da emenda"));
  const pago = lerDiagnostico(
    { ...entrada, instrumento: { ...i, dt_suspensiva: null, vl_repasse: 100, vl_desembolsado: 100 } },
    HOJE,
  );
  assert.ok(!pago.estrategia.some((p) => p.titulo === "Envolver o autor da emenda"));
});

test("vigência a 30 dias ou menos é crítica; no dia, 'termina hoje'", () => {
  const i = base({ dt_fim_vigencia: "2026-09-30", dt_primeiro_desembolso: "2024-01-01", vl_repasse: 100, vl_desembolsado: 100 });
  const d = lerDiagnostico({ ...entrada962210(), instrumento: i, carteira: [] }, HOJE);
  const r = d.riscos.find((x) => x.titulo === "Vigência acabando");
  assert.ok(r);
  assert.equal(r.nivel, "critico");
  assert.equal(r.fato, "A vigência termina em 30/09/2026, daqui a 2 dias.");
  const hoje = lerDiagnostico({ ...entrada962210(), instrumento: { ...i, dt_fim_vigencia: HOJE }, carteira: [] }, HOJE);
  assert.equal(hoje.riscos.find((x) => x.titulo === "Vigência acabando")?.fato, "A vigência termina hoje, 28/09/2026.");
});

test("a mesma janela vinda duas vezes do catálogo aparece uma vez", () => {
  const p = {
    id: "a",
    titulo: "Fomento ao Setor Agropecuário - Emendas Individuais",
    financiador: "MAPA",
    prazo: "2026-09-30",
    diasRestantes: 2,
    fonteNome: "Transferegov",
    fonteUrl: "https://example.org",
    codigos: ["2200020260002"],
    mesmoPrograma: false,
    mesmoOrgao: true,
    mesmoTema: false,
  };
  const d = lerDiagnostico(entrada962210({ portas: [p, { ...p, id: "b" }] }), HOJE);
  assert.deepEqual(d.portas.map((x) => x.id), ["a"]);
});

test("execução: sem movimento há mais de um ano e dinheiro na frente da obra", () => {
  const i = base({
    vl_repasse: 1_000_000,
    vl_desembolsado: 900_000,
    vl_saldo_conta: 120_000,
    pct_fisico: 0.1,
    dt_primeiro_desembolso: "2023-03-01",
    dt_ultimo_desembolso: "2023-09-01",
    dt_ultimo_pagamento: "2025-01-15",
  });
  const d = lerDiagnostico({ ...entrada962210(), instrumento: i, etapas: [], pares: [], carteira: [] }, HOJE);
  assert.equal(d.etapa, "execucao");
  assert.equal(d.tempo?.etapa, "desembolso_conclusao");
  const parado = d.riscos.find((r) => r.titulo === "Sem movimento financeiro há mais de um ano");
  assert.ok(parado);
  assert.match(parado.fato, /15\/01\/2025, há 621 dias\. Há R\$ 120 mil em conta\./);
  assert.ok(d.riscos.some((r) => r.titulo === "Dinheiro na frente da obra"));
  assert.match(d.frase, /90% do repasse desembolsado; último pagamento em 15\/01\/2025/);
});

test("contas: prazo vencido, vez do proponente, e município bloqueado no painel fiscal", () => {
  const i = base({ situacao: "Aguardando Prestação de Contas", dt_limite_contas: "2026-06-30", dt_primeiro_desembolso: "2024-01-01" });
  const fiscal = {
    ibge: "2516201",
    municipio: "Sousa",
    conclusao: { decisao: "B" as const, nome: "Receber transferência voluntária", estado: "nao_atendido" as const, bloqueantes: ["G7"], alertas: [], sem_dado: [], documentais: [], versao: "x" },
    caucPendencias: ["1.1", "3.2.3"],
    referencia: "2026-09-28",
  };
  const d = lerDiagnostico({ ...entrada962210(), instrumento: i, etapas: [], pares: [], carteira: [], fiscal }, HOJE);
  assert.equal(d.etapa, "contas");
  assert.equal(d.vez, "proponente");
  assert.ok(d.riscos.some((r) => r.titulo === "Prazo de prestar contas vencido" && r.nivel === "alto"));
  // Prestação de contas não é etapa "viva" para o risco fiscal de receber transferência.
  assert.ok(!d.riscos.some((r) => /bloqueado para receber/.test(r.titulo)));
  assert.equal(d.estrategia[0].titulo, "Enviar a prestação de contas");
  assert.ok(d.inacao.some((x) => /inadimplência registrada no CAUC/.test(x)));
});

test("assinatura de município bloqueado: o risco e o passo fiscal aparecem, com os itens do CAUC", () => {
  const i = base({ situacao: "Proposta/Plano de Trabalho Aprovado", dt_assinatura: null, dt_aprovacao: "2026-08-01", dt_fim_vigencia: "2027-12-31" });
  const fiscal = {
    ibge: "2516201",
    municipio: "Sousa",
    conclusao: { decisao: "B" as const, nome: "Receber transferência voluntária", estado: "nao_atendido" as const, bloqueantes: ["G7"], alertas: [], sem_dado: [], documentais: [], versao: "x" },
    caucPendencias: ["1.1", "1.2", "3.2.3"],
    referencia: "2026-09-28",
  };
  const d = lerDiagnostico({ ...entrada962210(), instrumento: i, carteira: [], fiscal }, HOJE);
  const r = d.riscos.find((x) => x.titulo === "Município bloqueado para receber transferência voluntária");
  assert.ok(r);
  assert.match(r.fato, /«bloqueada» por G7\. O CAUC registra pendência nos itens 1\.1, 1\.2 e 3\.2\.3\./);
  assert.ok(d.estrategia.some((p) => p.titulo === "Resolver as pendências fiscais do município"));
  // 58 dias desde a aprovação: passou da mediana (14), não do P90 (133).
  assert.equal(d.tempo?.posicao, "passou_da_mediana");
  assert.equal(d.estrategia[0].titulo, "Cobrar a assinatura do concedente");
});

test("liminar judicial e extinto com suspensiva pendente", () => {
  const lim = lerDiagnostico({ ...entrada962210(), instrumento: base({ situacao_contratacao: "Sob Liminar Judicial e Cláusula Suspensiva" }), carteira: [] }, HOJE);
  assert.ok(lim.riscos.some((r) => r.titulo === "Contratação sob liminar judicial" && r.nivel === "alto"));
  assert.ok(lim.estrategia.some((p) => p.titulo === "Levantar o processo judicial"));

  const ext = lerDiagnostico(
    { ...entrada962210(), instrumento: base({ situacao: "Convênio Anulado", dt_suspensiva: "2025-01-01", vl_repasse: 800_000 }), carteira: [] },
    HOJE,
  );
  assert.equal(ext.etapa, "extinto");
  assert.equal(ext.tempo, null);
  assert.equal(ext.vigencia.nivel, null);
  assert.match(ext.frase, /Terminou com a cláusula suspensiva pendente\. Nenhum repasse foi desembolsado\./);
  assert.ok(ext.riscos.some((r) => r.titulo === "Instrumento extinto" && /R\$ 800 mil de repasse não chegaram, e a cláusula suspensiva nunca foi retirada/.test(r.fato)));
});

test("tempo na etapa sem data de início não compara", () => {
  const t = tempoNaEtapa({ ...I962210, dt_aprovacao: null, dt_envio: null }, "assinatura", ETAPAS_MINC, HOJE);
  assert.ok(t);
  assert.equal(t.etapa, "envio_assinatura");
  assert.equal(t.dias, null);
  assert.equal(t.posicao, null);
});

test("nome do proponente e chave do órgão para comparar", () => {
  assert.equal(nomeProponente(I962210), "Estado da Paraíba");
  assert.equal(nomeProponente({ proponente: "MUNICIPIO DE SOUSA" }), "Município de Sousa");
  assert.equal(nomeProponente({ proponente: null }, "O proponente"), "O proponente");
  assert.equal(chaveOrgao("Ministério  da Cultura"), chaveOrgao("MINISTERIO DA CULTURA"));
  // O texto da carteira usa o nome tratado.
  assert.ok(lerDiagnostico(entrada962210(), HOJE).inacao.some((x) => x.startsWith("Estado da Paraíba já teve 21")));
});

// ------------------------------------------------------------------ requisitos para celebração (coleta da assinatura)

function dossieAssinatura(eventos: ExigEvento[], detalhes: ExigDetalhe[]): Dossie {
  return {
    coletado_em: "2026-09-28T16:00:00+00:00",
    referencia: "2026-09-28",
    fonte: "transferegov_acesso_livre",
    recorte: "assinatura",
    instrumento: null,
    documentos: [],
    eventos,
    detalhes,
  };
}

/** O 962210 como a coleta de 28/09/2026 trouxe: um evento, requisitos atendidos, observação "Adimplente". */
const ACESSO_962210 = dossieAssinatura(
  [{ ordem: 0, evento: "Análise Registrada - Atendido", lado: "concedente", resultado: "atendido", responsavel: "FULANO DE TAL", ocorrido_em: "2024-10-17T15:56:15+00:00", id_situacao: "405933" }],
  [
    {
      id_situacao: "405933",
      analise: "Análise Registrada",
      responsavel: "FULANO DE TAL",
      atribuicao: "Gestor de Instrumento do Concedente",
      analisada_em: "2024-10-08",
      situacao: "Atendido",
      observacao: "Adimplente",
      solicitacao: null,
    },
  ],
);

test("coleta da assinatura: 'atendido' é a vez do concedente assinar, e a frase não fala de suspensiva", () => {
  const al = lerAcessoLivre(ACESSO_962210, HOJE);
  assert.equal(al.recorte, "assinatura");
  assert.equal(al.vez.lado, "concedente");
  assert.equal(al.vez.dias, 711);
  assert.match(al.vez.frase, /requisitos para celebração foram registrados como atendidos em 17\/10\/2024, por FULANO DE TAL/);
  assert.match(al.vez.frase, /A assinatura não está registrada\./);
  assert.doesNotMatch(al.vez.frase, /suspensiva/);
});

test("962210 com a coleta: requisitos parados há 711 dias e o passo de pedir a assinatura citando a análise", () => {
  const d = lerDiagnostico(entrada962210({ acessoLivre: lerAcessoLivre(ACESSO_962210, HOJE) }), HOJE);
  assert.equal(d.vez, "concedente");
  const parado = d.riscos.find((r) => r.titulo === "Requisitos para celebração parados");
  assert.ok(parado);
  assert.equal(parado.nivel, "alto");
  assert.match(parado.fato, /há 711 dias, desde 17\/10\/2024, contados até a coleta de 28\/09\/2026, com a vez do concedente/);
  // A vigência vencida vem primeiro; depois, a assinatura pedida com a análise na mão.
  assert.equal(d.estrategia[0].titulo, "Confirmar com o concedente se o instrumento ainda pode ser assinado");
  assert.equal(d.estrategia[1].titulo, "Pedir a assinatura, citando a análise dos requisitos");
  assert.match(d.estrategia[1].porque, /atendidos em 17\/10\/2024, por FULANO DE TAL, com a observação «Adimplente»\. 711 dias sem evento até a coleta de 28\/09\/2026\./);
});

test("pedido de complementação aberto: a vez é do proponente, mesmo com a situação 'aprovado'", () => {
  const al = lerAcessoLivre(
    dossieAssinatura(
      [
        { ordem: 0, evento: "Complementação Solicitada", lado: "concedente", resultado: "complementação solicitada", responsavel: "SICRANA", ocorrido_em: "2026-06-25T16:04:09+00:00", id_situacao: "900" },
        { ordem: 1, evento: "Enviado para Verificação", lado: "proponente", resultado: "enviado", responsavel: "BELTRANO", ocorrido_em: "2026-04-24T18:21:10+00:00", id_situacao: null },
      ],
      [{ id_situacao: "900", analise: null, responsavel: "SICRANA", atribuicao: null, analisada_em: null, situacao: null, observacao: null, solicitacao: "Apresentar documentação atualizada." }],
    ),
    HOJE,
  );
  assert.match(al.vez.frase, /Não há envio do proponente depois disso — 95 dias até a coleta/);
  const i = base({ situacao: "Proposta/Plano de Trabalho Aprovado", dt_assinatura: null, dt_aprovacao: "2026-06-23", dt_fim_vigencia: "2028-07-31" });
  const d = lerDiagnostico({ ...entrada962210(), instrumento: i, carteira: [], acessoLivre: al }, HOJE);
  assert.equal(d.vez, "proponente");
  assert.equal(d.estrategia[0].titulo, "Responder ao último pedido do concedente");
  assert.match(d.estrategia[0].porque, /Pedido de 25\/06\/2026, por SICRANA: «Apresentar documentação atualizada\.»\. 95 dias sem evento/);
  assert.ok(d.riscos.some((r) => r.titulo === "Requisitos para celebração parados" && r.nivel === "moderado"));
});

test("coleta vazia: nos termos do SIMEC/PAR o laudo diz onde o andamento está", () => {
  const vazia = lerAcessoLivre(dossieAssinatura([], []), HOJE);
  const par = base({ situacao: "Proposta/Plano de Trabalho Aprovado", dt_assinatura: null, programa: "Programa SIMEC/PAR4", modalidade: "TERMO DE COMPROMISSO" });
  const d = lerDiagnostico({ ...entrada962210(), instrumento: par, carteira: [], acessoLivre: vazia }, HOJE);
  assert.match(d.acessoLivreVazio ?? "", /acompanhamento desses termos é feito no SIMEC/);
  assert.equal(d.vez, "concedente"); // sem evento, vale a situação: aprovado espera a assinatura
  assert.equal(
    motivoAcessoLivreVazio({ programa: "Outro" }, vazia),
    "A tela de requisitos para celebração do Acesso Livre está vazia para este instrumento: nenhum documento enviado nem análise registrada até a coleta.",
  );
  assert.equal(motivoAcessoLivreVazio({ programa: "Programa SIMEC/PAR" }, null), null);
  assert.equal(lerDiagnostico(entrada962210({ acessoLivre: lerAcessoLivre(ACESSO_962210, HOJE) }), HOJE).acessoLivreVazio, null);
});

test("a coleta só vale antes da assinatura: num instrumento em execução ela é ignorada", () => {
  const d = lerDiagnostico({ ...entrada962210(), instrumento: base({}), carteira: [], acessoLivre: lerAcessoLivre(ACESSO_962210, HOJE) }, HOJE);
  assert.equal(d.acessoLivre, null);
  assert.ok(!d.riscos.some((r) => r.titulo === "Requisitos para celebração parados"));
});

test("CNPJ legível e nível mais alto dos riscos", () => {
  assert.equal(cnpjLegivel("08761124000100"), "08.761.124/0001-00");
  assert.equal(cnpjLegivel("123"), "123");
  assert.equal(cnpjLegivel(null), null);
  assert.equal(nivelMaisAlto([]), "informativo");
  assert.equal(nivelMaisAlto(lerDiagnostico(entrada962210(), HOJE).riscos), "critico");
});

test("vizinhança e funil somam do jeito certo", () => {
  const v = vizinhanca(CARTEIRA_ESTADO, I962210, "assinatura");
  assert.equal(v.total, 46);
  assert.deepEqual(
    v.porEtapa.map((c) => [c.etapa, c.n]),
    [
      ["assinatura", 8],
      ["execucao", 17],
      ["extinto", 21],
    ],
  );
  assert.deepEqual(funis([], "2041120240005", "PB"), []);
  assert.deepEqual(funis([desfecho("BR", 5, 5, 0, 0, 0)], null, "PB"), []);
});

test("fornecedores e o destino do dinheiro entram no laudo, com os riscos junto dos demais", () => {
  const i = base({
    vl_repasse: 1_000_000,
    vl_desembolsado: 500_000,
    dt_primeiro_desembolso: "2026-03-01",
    dt_ultimo_desembolso: "2026-06-01",
    dt_ultimo_pagamento: "2026-08-01",
    pago_pj: 400_000,
    pago_pf: 2_000,
    n_pagamentos_pf: 4,
    pago_convenente: null,
    empenhado_corrente: 100_000,
    empenhado_capital: 900_000,
    dt_primeiro_ingresso_contrapartida: "2026-02-01",
    dt_ultimo_ingresso_contrapartida: "2026-04-01",
    n_ingressos_contrapartida: 2,
    latitude: -6.88,
    longitude: -38.56,
  });
  const inidoneo = {
    cnpj: "09326532000198", nome: "LIVRAMENTO CONSTRUCOES", mei: false, pb_convenios: 3, pb_municipios: 2, pb_proponentes: 2, pb_orgaos: 1,
    pb_pago: 400_000, pb_n_pagamentos: 2, pb_primeiro_pagamento: "2026-07-01", pb_ultimo_pagamento: "2026-08-01", pb_contratos: 1,
    pb_contratado: 900_000, br_convenios: 3, br_ufs: 1, br_pago: 400_000, inidoneo_tcu: true, tcu_acordao: "821/2019-PL",
    tcu_inicio: "2021-03-01", tcu_data_final: "2029-03-01", tcu_link: null,
  };
  const linha = {
    cnpj: inidoneo.cnpj, nr_convenio: "1", cod_ibge: "2516201", municipio: "SOUSA", proponente: "MUNICIPIO DE SOUSA", tipo_agente: "municipio",
    orgao_sup: "MINISTERIO DAS CIDADES", cod_programa: null, pago: 400_000, n_pagamentos: 2, primeiro_pagamento: "2026-07-01",
    ultimo_pagamento: "2026-08-01", fatia: 1, n_contratos: 1, contratado: 900_000,
  };
  const d = lerDiagnostico(
    { ...entrada962210(), instrumento: i, etapas: [], pares: [], carteira: [], fornecedores: { linhas: [linha], fornecedores: [inidoneo], contratos: [], municipio: null } },
    HOJE,
  );
  assert.equal(d.fornecedores?.linhas.length, 1);
  // Pago dentro da sanção, sem contrato registrado: alto, na lista junto dos demais riscos.
  const tcu = d.riscos.find((r) => /LIVRAMENTO CONSTRUCOES/.test(r.titulo));
  assert.equal(tcu?.nivel, "alto");
  assert.match(tcu?.titulo ?? "", /pago durante a sanção do TCU/);
  assert.equal(d.dinheiro.empenhadoCapital, 900_000);
  assert.deepEqual(d.dinheiro.ingressos, { primeiro: "2026-02-01", ultimo: "2026-04-01", n: 2 });
  assert.deepEqual(d.coordenada, { latitude: -6.88, longitude: -38.56 });

  // Sem a leitura (fora da PB, ou o laudo do cliente), nada de fornecedor.
  const sem = lerDiagnostico({ ...entrada962210(), instrumento: i, etapas: [], pares: [], carteira: [] }, HOJE);
  assert.equal(sem.fornecedores, null);
  assert.ok(!sem.riscos.some((r) => /TCU/.test(r.titulo)));
});

test("janela de beneficiário específico só entra quando nomeia o município do proponente", () => {
  const caem = { canal: "beneficiario_especifico" as const, titulo: "Atendimento de demanda judicial - Processo nº 0001844-33.2008.4.01.3300 - Município de Caem/BA" };
  assert.equal(portaServe(caem, "CAMPINA GRANDE"), false);
  assert.equal(portaServe(caem, "CAÉM"), true);
  assert.equal(portaServe(caem, null), false);
  assert.equal(portaServe({ canal: "voluntaria", titulo: "Novo PAC - Periferia Viva" }, "CAMPINA GRANDE"), true);
  assert.equal(portaServe({ canal: null, titulo: "Qualquer" }, null), true);
});

test("concluído: a janela é a 'próxima porta', não plano B; e a voluntária vem antes da de emenda", () => {
  const comum = {
    financiador: "MINISTERIO DAS CIDADES", prazo: "2026-12-31", diasRestantes: 93, fonteNome: "Transferegov",
    fonteUrl: "https://example.org", codigos: [], mesmoPrograma: false, mesmoOrgao: true, mesmoTema: false,
  };
  const emenda = { ...comum, id: "e", titulo: "Emendas Cidades 2026", canal: "emenda_parlamentar" as const, diasRestantes: 10 };
  const voluntaria = { ...comum, id: "v", titulo: "Novo PAC - Periferia Viva", canal: "voluntaria" as const };
  const i = base({ situacao: "Prestação de Contas Concluída", dt_primeiro_desembolso: "2019-01-01" });
  const d = lerDiagnostico({ ...entrada962210(), instrumento: i, etapas: [], pares: [], carteira: [], portas: [emenda, voluntaria] }, HOJE);
  assert.equal(d.etapa, "concluido");
  const passo = d.estrategia.find((p) => p.titulo.startsWith("Próxima porta"));
  assert.ok(passo);
  assert.match(passo.porque, /Novo PAC - Periferia Viva/);
  assert.ok(!d.estrategia.some((p) => p.titulo.startsWith("Plano B")));
  // Só com a de emenda, ela entra, dizendo que depende de parlamentar.
  const soEmenda = lerDiagnostico({ ...entrada962210(), instrumento: i, etapas: [], pares: [], carteira: [], portas: [emenda] }, HOJE);
  assert.match(soEmenda.estrategia.find((p) => p.titulo.startsWith("Próxima porta"))?.porque ?? "", /depende da indicação de um parlamentar/);
});

test("prestação de contas em diligência (onda 13C.2): a vez passa ao convenente, com o passo de responder", () => {
  const i = base({ nr_convenio: "919058", situacao: "Prestação de Contas em Análise", dt_assinatura: "2021-12-31", dt_limite_contas: "2026-05-30" });
  const pc = {
    nr_convenio: "919058", n_eventos: 1, valor_comprovado: 8221565.33, valor_aprovado: null, valor_impugnado: null,
    dt_comprovacao: "2026-09-18T18:13:25+00:00", dt_ultimo_evento: "2026-09-18T18:13:25+00:00", ultimo_evento: "Comprovação",
    cumprimento: "integralmente", pct_fisico_declarado: 100, n_pareceres: 1, parecer_data: "2026-09-11", parecer_tipo: "Técnico",
    parecer_situacao: "Em Diligência", erro: null,
  };
  const entrada: EntradaDiagnostico = { ...entrada962210(), instrumento: i, etapas: [], carteira: null, pares: null, emendas: [] };
  const sem = lerDiagnostico(entrada, HOJE);
  assert.equal(sem.vez, "concedente");
  assert.ok(sem.estrategia.some((x) => x.titulo === "Acompanhar a análise da prestação de contas"));
  const com = lerDiagnostico({ ...entrada, contasObras: { prestacao: { convenio: pc, eventos: [], pareceres: [], referencia: "2026-09-30" }, obra: null } }, HOJE);
  assert.equal(com.vez, "proponente");
  const passo = com.estrategia.find((x) => x.titulo === "Responder à diligência da prestação de contas");
  assert.ok(passo);
  assert.equal(passo.porque, "O parecer técnico de 11/09/2026 está «Em Diligência»: o concedente pediu complemento, e a vez é do convenente.");
  assert.ok(com.riscos.some((r) => r.titulo === "Prestação de contas em diligência"));
});
