import test from "node:test";
import assert from "node:assert/strict";
import {
  chaveCondicao,
  agruparLinha,
  compararUrgencia,
  diaBrasilia,
  diasEntre,
  lerCondicoes,
  lerLaudo,
  nivelPrazo,
  vezDepois,
  type ContextoLaudo,
  type Dossie,
  type ExigDocumento,
  type ExigEvento,
} from "./laudo.ts";

// ------------------------------------------------------------------ montagem

let ordem = 0;
function ev(ocorrido_em: string, evento: string, extra: Partial<ExigEvento> = {}): ExigEvento {
  const lado = /Enviado/.test(evento) ? "proponente" : "concedente";
  const resultado = /Complementa/.test(evento)
    ? "complementação solicitada"
    : /Enviado/.test(evento)
      ? "enviado"
      : /Não Atendido/.test(evento)
        ? "não atendido"
        : /Atendido/.test(evento)
          ? "atendido"
          : null;
  return { ordem: ordem++, evento, lado, resultado, responsavel: null, ocorrido_em, id_situacao: null, ...extra };
}

function dossie(eventos: ExigEvento[], extra: Partial<Dossie> = {}): Dossie {
  return { coletado_em: "2026-09-17T23:49:42Z", referencia: "2026-09-17", fonte: "transferegov_acesso_livre", instrumento: null, documentos: [], eventos, detalhes: [], ...extra };
}

const CONTEXTO: ContextoLaudo = {
  vl_repasse: 1_000_000,
  vl_desembolsado: null,
  dt_assinatura: "2025-12-29",
  dt_suspensiva: "2027-06-30",
  dt_retirada_suspensiva: null,
  dt_fim_vigencia: "2028-12-31",
  orgao_sup: "MINISTERIO DO ESPORTE",
};
const HOJE = "2026-09-18";

/** O convênio 979063 como a coleta o trouxe: seis idas e vindas, e a última palavra foi "atendido". */
function joaoPessoa979063(): Dossie {
  return dossie(
    [
      ev("2025-09-16T17:45:25Z", "Complementação Solicitada", { responsavel: "ANDERSON", id_situacao: "1" }),
      ev("2025-09-19T14:26:18Z", "Enviado para Verificação", { responsavel: "HELDER" }),
      ev("2025-09-19T14:54:54Z", "Complementação Solicitada", { responsavel: "ANDERSON", id_situacao: "2" }),
      ev("2025-12-22T20:12:48Z", "Enviado para Verificação", { responsavel: "HELDER" }),
      ev("2026-02-04T13:53:11Z", "Análise Registrada - Atendido", { responsavel: "HELLEN", id_situacao: "3" }),
    ],
    {
      detalhes: [
        { id_situacao: "1", analise: "Complementação Solicitada", responsavel: null, atribuicao: null, analisada_em: null, situacao: null, observacao: null, solicitacao: "Anexar a LOA." },
        { id_situacao: "2", analise: "Complementação Solicitada", responsavel: null, atribuicao: null, analisada_em: null, situacao: null, observacao: null, solicitacao: "Reenviar a declaração da área gestora." },
        {
          id_situacao: "3",
          analise: "Análise Registrada",
          responsavel: "HELLEN",
          atribuicao: "Gestor de Instrumento do Concedente",
          analisada_em: "2025-12-24",
          situacao: "Atendido",
          observacao: "Documentação atendida, conforme Parecer nº 1553/2025.",
          solicitacao: null,
        },
      ],
    },
  );
}

// ------------------------------------------------------------------ datas

test("diaBrasilia converte o instante para o dia de Brasília", () => {
  assert.equal(diaBrasilia("2026-02-04T13:53:11+00:00"), "2026-02-04");
  // 23h30 em Brasília ainda é o mesmo dia, embora já seja o dia seguinte em UTC.
  assert.equal(diaBrasilia("2026-02-05T02:30:00Z"), "2026-02-04");
  assert.equal(diaBrasilia("2026-02-04"), "2026-02-04");
});

test("diasEntre conta dias de calendário", () => {
  assert.equal(diasEntre("2026-01-01", "2026-01-31"), 30);
  assert.equal(diasEntre("2026-02-04", "2026-09-17"), 225);
  assert.equal(diasEntre("2026-09-18", "2026-09-10"), -8);
});

test("vezDepois espelha a leitura do job em Python", () => {
  assert.equal(vezDepois("complementação solicitada"), "proponente");
  assert.equal(vezDepois("não atendido"), "proponente");
  assert.equal(vezDepois("enviado"), "concedente");
  assert.equal(vezDepois("atendido"), "concedente");
  assert.equal(vezDepois(null), null);
});

// ------------------------------------------------------------------ 979063

test("a vez é do concedente quando a última análise foi atendida, contada até a coleta", () => {
  const l = lerLaudo(joaoPessoa979063(), CONTEXTO, HOJE);
  assert.equal(l.vez.lado, "concedente");
  assert.equal(l.vez.desde, "2026-02-04");
  assert.equal(l.vez.dias, 225);
  assert.match(l.vez.frase, /atendida em 04\/02\/2026, por HELLEN/);
  assert.match(l.vez.frase, /225 dias até a coleta de 17\/09\/2026/);
  assert.match(l.vez.frase, /retirada da cláusula suspensiva não está registrada/);
});

test("a linha do tempo sai em ordem crescente, com o texto do concedente e a vez depois de cada evento", () => {
  const l = lerLaudo(joaoPessoa979063(), CONTEXTO, HOJE);
  assert.deepEqual(
    l.linha.map((x) => [x.dia, x.vezDepois]),
    [
      ["2025-09-16", "proponente"],
      ["2025-09-19", "concedente"],
      ["2025-09-19", "proponente"],
      ["2025-12-22", "concedente"],
      ["2026-02-04", "concedente"],
    ],
  );
  assert.equal(l.linha[2].texto, "Reenviar a declaração da área gestora.");
  assert.equal(l.linha[2].tipoTexto, "solicitacao");
  assert.equal(l.linha[4].tipoTexto, "observacao");
});

test("a data da análise que difere do registro vira atraso de registro", () => {
  const u = lerLaudo(joaoPessoa979063(), CONTEXTO, HOJE).linha[4];
  assert.equal(u.analisadaEm, "2025-12-24");
  assert.equal(u.atrasoRegistro, 42);
});

test("o tempo com cada lado soma os intervalos entre eventos, até a coleta", () => {
  const t = lerLaudo(joaoPessoa979063(), CONTEXTO, HOJE).tempoPorLado;
  assert.deepEqual(t, { proponente: 97, concedente: 269, total: 366 });
});

test("a maior espera é a que segue aberta até a coleta", () => {
  const m = lerLaudo(joaoPessoa979063(), CONTEXTO, HOJE).maiorEspera;
  assert.deepEqual(m, { lado: "concedente", dias: 225, de: "2026-02-04", ate: "2026-09-17" });
});

test("as causas trazem tempo por lado, a maior espera, as rodadas e o atraso de registro", () => {
  const c = lerLaudo(joaoPessoa979063(), CONTEXTO, HOJE).causas.join("\n");
  assert.match(c, /269 dias com a vez do concedente e 97 dias com a do município/);
  assert.match(c, /maior intervalo sem movimento foi de 225 dias.*até a coleta, e segue aberto/);
  assert.match(c, /pediu complementação 2 vezes; o município enviou documentação 2 vezes/);
  assert.match(c, /análise de 24\/12\/2025 registrada em 04\/02\/2026, 42 dias depois/);
});

test("com a última análise atendida, a estratégia é pedir a retirada citando o texto do concedente", () => {
  const p = lerLaudo(joaoPessoa979063(), CONTEXTO, HOJE).estrategia;
  assert.equal(p[0].titulo, "Pedir formalmente a retirada da cláusula suspensiva");
  assert.match(p[0].porque, /de 04\/02\/2026, por HELLEN/);
  assert.match(p[0].porque, /«Documentação atendida, conforme Parecer nº 1553\/2025\.»/);
});

test("parado há mais de 180 dias é risco alto", () => {
  const r = lerLaudo(joaoPessoa979063(), CONTEXTO, HOJE).riscos;
  const parado = r.find((x) => x.titulo === "Processo parado");
  assert.equal(parado?.nivel, "alto");
  assert.match(parado?.fato ?? "", /há 225 dias, desde 04\/02\/2026, com a vez do concedente/);
});

// ------------------------------------------------------------------ Cabedelo

/** Cabedelo, 963081: um único evento, observação "Adimplente", nenhum documento, prazo vencido. */
function cabedelo963081(): { d: Dossie; c: ContextoLaudo } {
  return {
    d: dossie([ev("2024-10-10T17:48:19Z", "Análise Registrada - Atendido", { responsavel: "GUILHERME", id_situacao: "9" })], {
      detalhes: [{ id_situacao: "9", analise: "Análise Registrada", responsavel: "GUILHERME", atribuicao: null, analisada_em: null, situacao: "Atendido", observacao: "Adimplente", solicitacao: null }],
    }),
    c: { ...CONTEXTO, vl_repasse: 295_834.31, dt_assinatura: "2024-10-03", dt_suspensiva: "2025-10-01", dt_fim_vigencia: "2027-10-03" },
  };
}

test("prazo da suspensiva vencido é crítico e abre a estratégia", () => {
  const { d, c } = cabedelo963081();
  const l = lerLaudo(d, c, HOJE);
  assert.equal(l.prazo.nivel, "critico");
  assert.equal(l.prazo.dias, -352);
  assert.match(l.prazo.frase, /venceu em 01\/10\/2025, há 352 dias, sem retirada registrada/);
  assert.equal(l.riscos[0].titulo, "Prazo da suspensiva vencido");
  assert.match(l.estrategia[0].titulo, /^Confirmar se o instrumento segue vigente/);
});

test("'Atendido' não vira 'documentação aprovada': o laudo cita o que o concedente escreveu", () => {
  const { d, c } = cabedelo963081();
  const l = lerLaudo(d, c, HOJE);
  const retirada = l.estrategia.find((p) => p.titulo.startsWith("Pedir formalmente a retirada"));
  assert.match(retirada?.porque ?? "", /com a observação «Adimplente»/);
  assert.doesNotMatch(JSON.stringify(l), /documentação (foi )?aprovada/i);
  assert.equal(l.documentos.total, 0);
});

test("o custo da inação nomeia o valor parado e a extinção", () => {
  const { d, c } = cabedelo963081();
  const i = lerLaudo(d, c, HOJE).inacao.join("\n");
  assert.match(i, /R\$ 296 mil de repasse seguem sem desembolso — nada foi liberado desde a assinatura, em 03\/10\/2024/);
  assert.match(i, /sujeito à extinção/);
});

// ------------------------------------------------------------------ outros estados

test("complementação pendente: a vez é do município e a estratégia é responder ao pedido", () => {
  const d = dossie([ev("2026-06-01T12:00:00Z", "Complementação Solicitada", { responsavel: "SOFIA", id_situacao: "5" })], {
    detalhes: [{ id_situacao: "5", analise: null, responsavel: null, atribuicao: null, analisada_em: null, situacao: null, observacao: null, solicitacao: "Anexar a certidão do TRT." }],
  });
  const l = lerLaudo(d, CONTEXTO, HOJE);
  assert.equal(l.vez.lado, "proponente");
  assert.match(l.vez.frase, /Não há envio do município depois disso/);
  const resposta = l.estrategia.find((p) => p.titulo === "Responder ao último pedido do concedente");
  assert.match(resposta?.porque ?? "", /por SOFIA: «Anexar a certidão do TRT\.»/);
});

test("envio sem análise: a vez é do concedente e a estratégia é cobrar a análise", () => {
  const l = lerLaudo(dossie([ev("2026-08-01T12:00:00Z", "Enviado para Verificação")]), CONTEXTO, HOJE);
  assert.equal(l.vez.lado, "concedente");
  assert.equal(l.estrategia.at(-1)?.titulo, "Cobrar a análise do último envio");
});

test("com a suspensiva retirada, o laudo só manda acompanhar o desembolso", () => {
  const l = lerLaudo(joaoPessoa979063(), { ...CONTEXTO, dt_retirada_suspensiva: "2026-09-10" }, HOJE);
  assert.deepEqual(l.riscos, []);
  assert.deepEqual(l.inacao, []);
  assert.deepEqual(l.estrategia.map((p) => p.titulo), ["Acompanhar o desembolso"]);
  assert.match(l.prazo.frase, /retirada em 10\/09\/2026/);
});

test("documentos vencidos pedem renovação antes de cobrar a retirada", () => {
  const vencido: ExigDocumento = { ordem: 0, grupo: "Outros", arquivo: "trt.pdf", descricao: "CERTIDÃO TRT", requisito: "CERTIDÃO TRT", enviado_em: "2025-10-01T12:00:00Z", validade: "2026-01-01" };
  const valido: ExigDocumento = { ...vencido, ordem: 1, arquivo: "tj.pdf", descricao: "CERTIDÃO TJ", validade: "2027-01-01" };
  const d = { ...joaoPessoa979063(), documentos: [vencido, valido] };
  const l = lerLaudo(d, CONTEXTO, HOJE);
  assert.equal(l.documentos.vencidos.length, 1);
  const titulos = l.estrategia.map((p) => p.titulo);
  assert.ok(titulos.indexOf("Renovar e reanexar os documentos vencidos") < titulos.indexOf("Pedir formalmente a retirada da cláusula suspensiva"));
  assert.ok(l.riscos.some((r) => r.titulo === "Documentos com validade vencida" && /1 de 2 documentos/.test(r.fato)));
});

test("cinco ou mais rodadas de exigência pedem reunião técnica com o órgão", () => {
  const evs = [0, 1, 2, 3, 4].map((k) => ev(`2026-0${k + 1}-10T12:00:00Z`, "Complementação Solicitada"));
  const l = lerLaudo(dossie(evs), CONTEXTO, HOJE);
  assert.ok(l.estrategia.some((p) => p.titulo === "Pedir reunião técnica com o MINISTERIO DO ESPORTE"));
  assert.ok(l.riscos.some((r) => r.titulo === "Muitas rodadas de exigência"));
});

test("vigência curta é risco e vira pedido de prorrogação junto com a retirada", () => {
  const l = lerLaudo(joaoPessoa979063(), { ...CONTEXTO, dt_fim_vigencia: "2026-12-31" }, HOJE);
  assert.ok(l.riscos.some((r) => r.titulo === "Pouca vigência para executar" && /sobram 104 dias/.test(r.fato)));
  assert.ok(l.estrategia.some((p) => p.titulo === "Pedir a prorrogação da vigência junto com a retirada"));
});

test("prazo da suspensiva a 90 dias ou menos pede prorrogação logo no primeiro passo", () => {
  const l = lerLaudo(joaoPessoa979063(), { ...CONTEXTO, dt_suspensiva: "2026-09-29" }, HOJE);
  assert.equal(l.prazo.nivel, "critico");
  assert.equal(l.prazo.dias, 11);
  assert.equal(l.estrategia[0].titulo, "Pedir a prorrogação do prazo da suspensiva");
});

test("sem nenhum evento o laudo diz isso e não inventa de quem é a vez", () => {
  const l = lerLaudo(dossie([]), CONTEXTO, HOJE);
  assert.equal(l.vez.lado, null);
  assert.match(l.vez.frase, /não registra nenhuma análise/);
  assert.deepEqual(l.tempoPorLado, { concedente: 0, proponente: 0, total: 0 });
  assert.equal(l.maiorEspera, null);
});

test("rótulo desconhecido não entra na conta de tempo de nenhum lado", () => {
  const d = dossie([ev("2026-01-01T12:00:00Z", "Enviado para Verificação"), { ...ev("2026-03-01T12:00:00Z", "Evento Novo"), resultado: null }]);
  const l = lerLaudo(d, CONTEXTO, HOJE);
  assert.equal(l.tempoPorLado.concedente, 59);
  assert.equal(l.tempoPorLado.total, 59 + diasEntre("2026-03-01", "2026-09-17"));
  assert.match(l.vez.frase, /rótulo que o laudo não sabe ler/);
});

test("analistas do concedente são contados com o que cada um decidiu", () => {
  const a = lerLaudo(joaoPessoa979063(), CONTEXTO, HOJE).analistas;
  assert.deepEqual(
    a.map((x) => [x.nome, x.atos, x.exigencias, x.atendimentos]),
    [
      ["ANDERSON", 2, 2, 0],
      ["HELLEN", 1, 0, 1],
    ],
  );
  assert.equal(a[1].atribuicao, "Gestor de Instrumento do Concedente");
});

// ------------------------------------------------------------------ urgência

test("nivelPrazo usa os mesmos limiares do laudo", () => {
  const sem = { dt_retirada_suspensiva: null };
  assert.equal(nivelPrazo({ ...sem, dt_suspensiva: "2025-10-01" }, HOJE), "critico");
  assert.equal(nivelPrazo({ ...sem, dt_suspensiva: "2026-10-18" }, HOJE), "critico");
  assert.equal(nivelPrazo({ ...sem, dt_suspensiva: "2026-12-17" }, HOJE), "alto");
  assert.equal(nivelPrazo({ ...sem, dt_suspensiva: "2027-06-30" }, HOJE), "moderado");
  assert.equal(nivelPrazo({ ...sem, dt_suspensiva: null }, HOJE), "informativo");
  assert.equal(nivelPrazo({ dt_suspensiva: "2025-10-01", dt_retirada_suspensiva: "2025-09-01" }, HOJE), "informativo");
});

test("a lista põe o prazo mais apertado no topo e desempata pelo tempo parado", () => {
  const itens = [
    { id: "folga-parado-ha-muito", dt_suspensiva: "2027-06-30", dt_retirada_suspensiva: null, parado_desde: "2022-01-01T12:00:00Z" },
    { id: "vence-em-11-dias", dt_suspensiva: "2026-09-29", dt_retirada_suspensiva: null, parado_desde: "2026-09-01T12:00:00Z" },
    { id: "vencido", dt_suspensiva: "2025-10-01", dt_retirada_suspensiva: null, parado_desde: "2024-10-10T12:00:00Z" },
    { id: "folga-parado-ha-pouco", dt_suspensiva: "2027-06-30", dt_retirada_suspensiva: null, parado_desde: "2026-08-01T12:00:00Z" },
    { id: "folga-sem-evento", dt_suspensiva: "2027-06-30", dt_retirada_suspensiva: null, parado_desde: null },
  ];
  assert.deepEqual(
    itens.sort((a, b) => compararUrgencia(a, b, HOJE)).map((x) => x.id),
    ["vencido", "vence-em-11-dias", "folga-parado-ha-muito", "folga-parado-ha-pouco", "folga-sem-evento"],
  );
});

// ------------------------------------------------------------------ condições do termo

test("a chave da condição é a palavra mais longa, sem acento", () => {
  assert.equal(chaveCondicao("Projeto de Engenharia"), "engenharia");
  assert.equal(chaveCondicao("Titularidade de Área"), "titularidade");
  assert.equal(chaveCondicao("Licenciamento Ambiental Prévio"), "licenciamento");
  assert.equal(chaveCondicao("Termo de Referência"), "referencia");
  assert.equal(chaveCondicao("de a"), null);
});

test("lerCondicoes reconhece os itens padrão, junta o último do ' e ' e marca o que o concedente mencionou", () => {
  const detalhes = [{ id_situacao: "1", analise: null, responsavel: null, atribuicao: null, analisada_em: null, situacao: null, observacao: null, solicitacao: "Enviar a licença de LICENCIAMENTO ambiental." }];
  const c = lerCondicoes("Titularidade de Área, Projeto de Engenharia e Licenciamento Ambiental Prévio", detalhes);
  assert.deepEqual(c, [
    { texto: "Titularidade de Área", mencionada: false, livre: false },
    { texto: "Projeto de Engenharia", mencionada: false, livre: false },
    { texto: "Licenciamento Ambiental Prévio", mencionada: true, livre: false },
  ]);
  assert.deepEqual(lerCondicoes(null, detalhes), []);
  assert.deepEqual(lerCondicoes("  ", detalhes), []);
});

/** Os textos reais mais difíceis dos 288, e o que o laudo deve ler em cada um. */
const MOTIVOS_REAIS: [string, string[]][] = [
  ["Titularidade de Área, Projeto de Engenharia, Licenciamento Ambiental Prévio e Plano de Sustentabilidade",
    ["Titularidade de Área", "Projeto de Engenharia", "Licenciamento Ambiental Prévio", "Plano de Sustentabilidade"]],
  ["Titularidade de Área, Projeto de Engenharia, Licenciamento Ambiental Prévio e Plano de sustentabilidade.",
    ["Titularidade de Área", "Projeto de Engenharia", "Licenciamento Ambiental Prévio", "Plano de Sustentabilidade"]],
  ["Titularidade de Área, Projeto de Engenharia, Licenciamento Ambiental Prévio e Plano de SUATENTABILIDADE",
    ["Titularidade de Área", "Projeto de Engenharia", "Licenciamento Ambiental Prévio", "Plano de Sustentabilidade"]],
  ["Projeto de engenhariatitularidade de áreaManifestação ambientalPlano de sustentabilidade",
    ["Projeto de Engenharia", "Titularidade de Área", "Manifestação ambiental", "Plano de Sustentabilidade"]],
  ["Titularidade de Área, Projeto de Engenharia, Licenciamento Ambiental Prévio e IV - Declaração sobre a sustentabilidade do objeto; e V - Declaração do Conselho Municipal.",
    ["Titularidade de Área", "Projeto de Engenharia", "Licenciamento Ambiental Prévio", "Declaração de sustentabilidade do objeto", "Declaração do Conselho Municipal"]],
  ["Termo de Referência e Nos termos do Processo SEI nº 72031.011426/2025-07",
    ["Termo de Referência", "Nos termos do Processo SEI nº 72031.011426/2025-07"]],
  ["Titularidade de Área, Projeto de Engenharia, Licenciamento Ambiental Prévio e CLÁUSULA TERCEIRA - DA CONDIÇÃO SUSPENSIVA",
    ["Titularidade de Área", "Projeto de Engenharia", "Licenciamento Ambiental Prévio", "CLÁUSULA TERCEIRA - DA CONDIÇÃO SUSPENSIVA"]],
  ["Titularidade de Área, Projeto de Engenharia, Licenciamento Ambiental Prévio e Plano de SustentabilidadeCONTRATAÇÃO SOB LIMINAR - Processo: 0000179-67.2026.4.05.8205, Juiz Federal da 14ª vara da Paraíba, vinculado ao TRF 5ª Região",
    ["Titularidade de Área", "Projeto de Engenharia", "Licenciamento Ambiental Prévio", "Plano de Sustentabilidade",
     "CONTRATAÇÃO SOB LIMINAR - Processo: 0000179-67.2026.4.05.8205, Juiz Federal da 14ª vara da Paraíba, vinculado ao TRF 5ª Região"]],
  ["Titularidade de Área, Projeto de Engenharia, Licenciamento Ambiental Prévio e CMDR",
    ["Titularidade de Área", "Projeto de Engenharia", "Licenciamento Ambiental Prévio", "CMDR"]],
  ["Projeto de Engenharia", ["Projeto de Engenharia"]],
];

for (const [motivo, esperado] of MOTIVOS_REAIS) {
  test(`motivo real: ${motivo.slice(0, 60)}…`, () => {
    assert.deepEqual(lerCondicoes(motivo, []).map((c) => c.texto), esperado);
  });
}

test("o que sobra fora da lista padrão é marcado como livre", () => {
  const c = lerCondicoes("Titularidade de Área e CMDR", []);
  assert.deepEqual(c.map((x) => [x.texto, x.livre]), [["Titularidade de Área", false], ["CMDR", true]]);
});

test("Cabedelo: 'atendido' com a condição do termo sem menção vira risco alto e muda a estratégia", () => {
  const { d, c } = cabedelo963081();
  const l = lerLaudo(d, { ...c, motivo_suspensao: "Projeto de Engenharia" }, HOJE);
  assert.deepEqual(l.condicoes, [{ texto: "Projeto de Engenharia", mencionada: false, livre: false }]);

  const risco = l.riscos.find((r) => r.titulo === "Condição do termo sem registro de análise");
  assert.equal(risco?.nivel, "alto");
  assert.match(risco?.fato ?? "", /O termo exige «Projeto de Engenharia», e nenhum texto do concedente na aba de requisitos a menciona/);

  const titulos = l.estrategia.map((p) => p.titulo);
  const descobrir = titulos.indexOf("Descobrir onde está a análise das condições do termo");
  const retirada = titulos.indexOf("Pedir formalmente a retirada da cláusula suspensiva");
  assert.ok(descobrir >= 0 && descobrir < retirada, "descobrir a análise vem antes de pedir a retirada");
  assert.match(l.estrategia[retirada].porque, /comprovar o cumprimento de «Projeto de Engenharia»/);

  assert.match(l.causas[0], /O termo condiciona a liberação a «Projeto de Engenharia»\. Nenhum texto do concedente na aba de requisitos menciona essa condição\./);
});

test("condição mencionada pelo concedente não vira risco", () => {
  const d = joaoPessoa979063();
  d.detalhes[0] = { ...d.detalhes[0], solicitacao: "Anexar o Termo de Referência revisado." };
  const l = lerLaudo(d, { ...CONTEXTO, motivo_suspensao: "Termo de Referência" }, HOJE);
  assert.deepEqual(l.condicoes, [{ texto: "Termo de Referência", mencionada: true, livre: false }]);
  assert.ok(!l.riscos.some((r) => r.titulo === "Condição do termo sem registro de análise"));
  assert.ok(!l.estrategia.some((p) => p.titulo.startsWith("Descobrir onde está")));
  assert.equal(l.causas[0], "O termo condiciona a liberação a «Termo de Referência».");
});

test("condições parcialmente mencionadas: a causa nomeia só as que faltam", () => {
  const d = joaoPessoa979063();
  d.detalhes[0] = { ...d.detalhes[0], solicitacao: "Enviar a certidão de titularidade da área." };
  const l = lerLaudo(d, { ...CONTEXTO, motivo_suspensao: "Titularidade de Área, Projeto de Engenharia" }, HOJE);
  assert.match(l.causas[0], /não mencionam «Projeto de Engenharia»\.$/);
});

test("sem motivo, ou com a suspensiva retirada, não há condições", () => {
  assert.deepEqual(lerLaudo(joaoPessoa979063(), CONTEXTO, HOJE).condicoes, []);
  const retirada = lerLaudo(joaoPessoa979063(), { ...CONTEXTO, motivo_suspensao: "Projeto de Engenharia", dt_retirada_suspensiva: "2026-09-10" }, HOJE);
  assert.deepEqual(retirada.condicoes, []);
});

// ------------------------------------------------------------------ linha agrupada

test("pedidos seguidos da mesma pessoa, sem texto, viram um bloco; o que tem texto fica sozinho", () => {
  const evs = [
    ...[1, 2, 3].map((d) => ev(`2025-11-0${d}T12:00:00Z`, "Complementação Solicitada", { responsavel: "CARLOS", id_situacao: `c${d}` })),
    ev("2025-11-05T12:00:00Z", "Complementação Solicitada", { responsavel: "CARLOS", id_situacao: "c5" }),
    ev("2025-11-06T12:00:00Z", "Complementação Solicitada", { responsavel: "VICTOR", id_situacao: "v6" }),
    ev("2025-11-07T12:00:00Z", "Enviado para Verificação", { responsavel: "PREFEITA" }),
  ];
  const detalhes = [{ id_situacao: "c5", analise: null, responsavel: null, atribuicao: null, analisada_em: null, situacao: null, observacao: null, solicitacao: "Regularizar os precatórios." }];
  const blocos = agruparLinha(lerLaudo(dossie(evs, { detalhes }), CONTEXTO, HOJE).linha);
  assert.deepEqual(blocos.map((b) => [b.itens.length, b.itens[0].responsavel, b.ultimo]), [
    [3, "CARLOS", false],
    [1, "CARLOS", false],   // tem texto: não entra no bloco anterior
    [1, "VICTOR", false],   // outra pessoa
    [1, "PREFEITA", true],
  ]);
});

test("evento com painel de detalhe mas sem texto é marcado como não colhido", () => {
  const l = lerLaudo(joaoPessoa979063(), CONTEXTO, HOJE).linha;
  assert.equal(l[1].temDetalhe, false);   // envio do município: não tem painel
  assert.equal(l[0].temDetalhe, true);
});
