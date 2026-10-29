import test from "node:test";
import assert from "node:assert/strict";
import {
  consequenciaDoAviso,
  dataDaReferencia,
  janelaAberta,
  montarCarteira,
  recomendacoesInstrumento,
  recomendacoesJanela,
  recomendacoesMunicipio,
  type SeguidoCarteira,
} from "./carteira.ts";
import type { AvisoItem } from "./favoritos.ts";

const HOJE = "2026-10-02";
const aviso = (x: Partial<AvisoItem>): AvisoItem => ({
  id: "1", tipo: "municipio", chave: "2510808", evento: "cauc", titulo: null, antes: null, depois: null, criado_em: "2026-10-02T12:00:00Z", lida_em: null, arquivada_em: null, ...x,
});
const c = (x: Partial<AvisoItem>) => consequenciaDoAviso(aviso(x), HOJE);

// O retrato de Patos na rodada de 01/10 (fiscal, painel e TCU), como a oport_28 grava.
const PATOS: Record<string, unknown> = {
  em_execucao: 13, em_suspensiva: 0, contas_atrasadas: 1, contas_rejeitadas: 1, saldo_parado: 1, sem_desembolso: 0, tce_tcu: 2,
  fiscal_a: "atendido", fiscal_b: "nao_atendido", fiscal_c: "nao_atendido", cauc: "1.5, 3.2.3, 4.2", pessoal_pct: 54.54,
};

test("consequência: piora que trava recurso é alta, melhora é informação", () => {
  assert.deepEqual(c({ evento: "cauc", antes: "1.5, 4.2", depois: "1.5, 3.2.3, 4.2" }), { nivel: "alto", melhora: false });
  assert.deepEqual(c({ evento: "cauc", antes: "1.5, 4.2", depois: "4.2" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(c({ evento: "fiscal_b", antes: "atendido", depois: "nao_atendido" }), { nivel: "alto", melhora: false });
  assert.deepEqual(c({ evento: "fiscal_b", antes: "atendido", depois: "atencao" }), { nivel: "moderado", melhora: false });
  assert.deepEqual(c({ evento: "fiscal_b", antes: "nao_atendido", depois: "atencao" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(c({ evento: "tce_tcu", antes: "2", depois: "3" }), { nivel: "alto", melhora: false });
  assert.deepEqual(c({ evento: "contas_atrasadas", antes: "2", depois: "1" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(c({ evento: "pessoal_pct", antes: "53.9", depois: "54.5" }), { nivel: "alto", melhora: false });
  assert.deepEqual(c({ evento: "pessoal_pct", antes: "55", depois: "54.6" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(c({ tipo: "proposta", evento: "desfecho", antes: "aberta_concedente", depois: "assinada" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(c({ tipo: "proposta", evento: "desfecho", antes: "aberta_concedente", depois: "reprovada" }), { nivel: "alto", melhora: false });
  assert.deepEqual(c({ tipo: "janela", evento: "fechando", antes: "2026-10-04", depois: "3" }), { nivel: "alto", melhora: null });
  assert.deepEqual(c({ tipo: "janela", evento: "fechando", antes: "2026-09-20", depois: "1" }), { nivel: "informativo", melhora: null });
  assert.deepEqual(c({ tipo: "instrumento", evento: "situacao", antes: "Em execução", depois: "Prestação de Contas Rejeitada" }), { nivel: "alto", melhora: false });
});

test("município: recomendações do que destrava mais, com o fato e a data", () => {
  const r = recomendacoesMunicipio(PATOS, "2026-10-01");
  // F1b: a fila única — o que trava dinheiro novo (CAUC, pessoal), depois o que pode virar cobrança (TCE, contas, saldo)
  assert.deepEqual(r.map((x) => [x.classe, x.nivel]), [
    ["bloqueio", "alto"], ["bloqueio", "alto"], ["cobranca", "alto"], ["cobranca", "alto"], ["cobranca", "alto"], ["cobranca", "moderado"],
  ], "CAUC, pessoal, TCE, contas atrasadas, rejeitadas e saldo");
  assert.match(r[1].fato, /54,54% da RCL ajustada/);
  assert.equal(r[0].acao, "Regularizar os itens 1.5, 3.2.3, 4.2 do CAUC");
  assert.match(r[0].fato, /pendências em 1\.5, 3\.2\.3, 4\.2 \(dado de 01\/10\/2026\).*LRF, art\. 25/);
  assert.equal(r[2].acao, "Acompanhar as 2 tomadas de contas especiais no TCU e reunir a defesa ou o recolhimento");
  assert.match(r[2].fato, /Tomada de contas especial não é julgamento: quem decide é o TCU/);
  assert.equal(r[3].acao, "Enviar a prestação de contas atrasada");
  // sem CAUC, a decisão B não atendida aponta o painel fiscal; sem nada, nada a fazer
  assert.equal(recomendacoesMunicipio({ fiscal_b: "nao_atendido", cauc: "" }, null)[0].acao, "Ver no painel fiscal o que bloqueia a transferência voluntária");
  assert.deepEqual(recomendacoesMunicipio({ em_execucao: 3, cauc: "", fiscal_b: "atendido", tce_tcu: 0 }, null), []);
});

test("convênio: prazo contado até hoje decide a ação", () => {
  const vencida = recomendacoesInstrumento({ situacao: "Em execução", dt_fim_vigencia: "2026-09-30" }, HOJE, "2026-10-01");
  assert.equal(vencida[0].nivel, "alto");
  assert.match(vencida[0].fato, /terminou em 30\/09\/2026/);
  // o 942082 de Patos, real em 01/10: vencido, mas com aditivo em andamento — não manda "pedir a prorrogação"
  const comAditivo = recomendacoesInstrumento({ situacao: "Em execução", subsituacao: "Em aditivação", dt_fim_vigencia: "2026-09-30" }, HOJE, "2026-10-01");
  assert.equal(comAditivo[0].acao, "Acompanhar a aprovação do aditivo; sem ele, preparar a prestação de contas e a devolução do saldo");
  assert.match(comAditivo[0].fato, /aditivo em andamento \("Em aditivação"\)/);
  assert.equal(recomendacoesInstrumento({ situacao: "Em execução", dt_fim_vigencia: "2026-11-15" }, HOJE, null)[0].nivel, "moderado");
  assert.deepEqual(recomendacoesInstrumento({ situacao: "Em execução", dt_fim_vigencia: "2027-12-31" }, HOJE, null), []);
  const pc = recomendacoesInstrumento({ situacao: "Aguardando Prestação de Contas", dt_limite_contas: "2020-02-29" }, HOJE, null);
  assert.equal(pc[0].acao, "Enviar a prestação de contas");
  assert.match(pc[0].fato, /venceu em 29\/02\/2020, há 2\.407 dias/, "milhar com ponto");
});

test("janela aberta no retrato: com prazo à frente ou sem prazo; vencida ou fechada, não", () => {
  assert.equal(janelaAberta({ aberta: true, prazo: "2026-11-30" }, HOJE), true);
  assert.equal(janelaAberta({ aberta: true, prazo: null }, HOJE), true, "fluxo contínuo: aberta sem prazo e sem recomendação");
  assert.deepEqual(recomendacoesJanela({ aberta: true, prazo: null }, HOJE), []);
  assert.equal(janelaAberta({ aberta: true, prazo: "2020-01-01" }, HOJE), false);
  assert.equal(janelaAberta({ aberta: false, prazo: "2026-11-30" }, HOJE), false);
  assert.equal(janelaAberta({}, HOJE), false);
});

test("janela aberta pede a decisão de preparar; fechada não pede nada", () => {
  assert.equal(recomendacoesJanela({ aberta: true, prazo: "2026-10-06" }, HOJE)[0].nivel, "alto");
  assert.equal(recomendacoesJanela({ aberta: true, prazo: "2026-11-30" }, HOJE)[0].nivel, "moderado");
  assert.deepEqual(recomendacoesJanela({ aberta: false, prazo: "2026-10-06" }, HOJE), []);
});

test("carteira: agrupa por item, põe o pior primeiro, ignora arquivado e abre o município conforme o papel", () => {
  const seguidos: SeguidoCarteira[] = [
    { tipo: "municipio", chave: "2510808", titulo: "Patos", estado: PATOS, referencia: "painel:2026-10-01T23:00:00Z", criado_em: "2026-10-02T10:00:00Z" },
    { tipo: "instrumento", chave: "942082", titulo: "Máquinas agrícolas", estado: { situacao: "Em execução", dt_fim_vigencia: "2026-09-30", pct_fisico: 0.5 }, referencia: "painel:2026-10-01T23:00:00Z", criado_em: "2026-10-02T10:00:00Z" },
    { tipo: "janela", chave: "x", titulo: "Chamada X", estado: { aberta: true, prazo: "2026-12-01" }, referencia: "g", criado_em: "2026-10-02T10:00:00Z" },
  ];
  const avisos: AvisoItem[] = [
    aviso({ id: "a", evento: "em_execucao", antes: "12", depois: "13" }),
    aviso({ id: "b", evento: "cauc", antes: "1.5, 4.2", depois: "1.5, 3.2.3, 4.2" }),
    aviso({ id: "c", tipo: "instrumento", chave: "942082", evento: "vl_desembolsado", antes: "900", depois: "958", lida_em: "2026-10-02T11:00:00Z" }),
    aviso({ id: "d", tipo: "instrumento", chave: "942082", evento: "dt_limite_contas", antes: null, depois: "2026-11-29" }),
    aviso({ id: "e", evento: "tce_tcu", antes: "1", depois: "2", arquivada_em: "2026-10-02T11:00:00Z" }),
  ];
  const k = montarCarteira({ seguidos, avisos }, HOJE);
  assert.equal(k.naoLidas, 3);
  assert.deepEqual(k.comMudanca.map((i) => [i.chave, i.pior]), [["2510808", "alto"], ["942082", "moderado"]]);
  const patos = k.porTipo.municipio[0];
  assert.deepEqual(patos.mudancas.map((m) => m.id), ["b", "a"]);
  assert.equal(patos.url, "/mapa/municipio/2510808");
  assert.equal(patos.recomendacoes.length, 3, "a carteira mostra três");
  assert.equal(patos.restantes, 3, "e diz quantos pontos ficaram na página do município");
  assert.deepEqual(patos.numeros.map((n) => `${n.rotulo}=${n.valor}`), ["Transferência voluntária=bloqueada", "CAUC=1.5, 3.2.3, 4.2", "Em execução=13", "Tomadas de contas especiais (TCU)=2"]);
  assert.equal(patos.dadoDe, "2026-10-01");
  const conv = k.porTipo.instrumento[0];
  assert.deepEqual(conv.mudancas.map((m) => [m.id, m.lida]), [["d", false], ["c", true]]);
  assert.equal(conv.numeros.find((n) => n.rotulo === "Físico")?.valor, "50%");
  assert.equal(k.porTipo.janela[0].recomendacoes[0].acao, "Decidir se vale preparar a proposta até 01/12/2026");
  assert.equal(montarCarteira({ seguidos: [], avisos: [] }, HOJE).vazia, true);
});

test("data da referência do retrato", () => {
  assert.equal(dataDaReferencia("painel:2026-10-01T23:00:00Z"), "2026-10-01");
  assert.equal(dataDaReferencia("painel:2026-10-08T01:34:18Z"), "2026-10-07", "o arquivo de 07/10, 22h34 em Brasília");
  assert.equal(dataDaReferencia("2026-10-07T19:00:43+00:00"), "2026-10-07");
  assert.equal(dataDaReferencia(null), null);
  assert.equal(dataDaReferencia("sem data"), null);
});

test("Pix em curso (oport_30): plano à espera do município é alto, na classe dos prazos (depois de bloqueio e cobrança)", () => {
  assert.deepEqual(c({ evento: "pix_vez_ente", antes: "0", depois: "1" }), { nivel: "alto", melhora: false });
  assert.deepEqual(c({ evento: "pix_vez_ente", antes: "1", depois: "0" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(c({ evento: "pix_vez_orgao", antes: "0", depois: "2" }), { nivel: "informativo", melhora: null });
  assert.deepEqual(c({ evento: "pix_prazo_ente", antes: null, depois: "2027-05-10" }), { nivel: "moderado", melhora: null });
  const r = recomendacoesMunicipio({ ...PATOS, pix_vez_ente: 2, pix_vez_orgao: 0, pix_prazo_ente: "2027-05-10" }, "2027-04-20");
  const pix = r.find((x) => x.acao.startsWith("Responder no Transferegov"));
  assert.equal(pix?.acao, "Responder no Transferegov aos 2 planos do Pix que esperam o município até 10/05/2027");
  assert.equal(pix?.classe, "prazo");
  assert.equal(r.indexOf(pix as (typeof r)[number]), r.length - 1, "em Patos, depois de bloqueios e cobranças");
  assert.match(pix?.fato ?? "", /^2 planos de transferência especial do exercício com a vez do município/);
  const semPrazo = recomendacoesMunicipio({ pix_vez_ente: 1, pix_prazo_ente: null }, null);
  assert.equal(semPrazo[0].acao, "Responder no Transferegov ao plano do Pix que espera o município");
  assert.match(semPrazo[0].fato, /O prazo do comunicado ainda não foi cadastrado/);
  assert.equal(recomendacoesMunicipio({ pix_vez_ente: 0, pix_vez_orgao: 3 }, null).length, 0, "vez do órgão não pede ação do município");
});

test("F1b: convênio e janela também saem com a classe da fila (vencido cobra; o que vence tem prazo)", () => {
  const vencida = recomendacoesInstrumento({ situacao: "Em execução", dt_fim_vigencia: "2026-09-30" }, HOJE, null);
  assert.equal(vencida[0].classe, "cobranca");
  const acabando = recomendacoesInstrumento({ situacao: "Em execução", dt_fim_vigencia: "2026-11-15" }, HOJE, null);
  assert.deepEqual([acabando[0].classe, acabando[0].prazo], ["prazo", "2026-11-15"]);
  const pc = recomendacoesInstrumento({ situacao: "Aguardando Prestação de Contas", dt_limite_contas: "2026-10-20" }, HOJE, null);
  assert.deepEqual([pc[0].classe, pc[0].prazo], ["prazo", "2026-10-20"]);
  assert.deepEqual(recomendacoesJanela({ aberta: true, prazo: "2026-11-30" }, HOJE).map((x) => [x.classe, x.prazo]), [["prazo", "2026-11-30"]]);
});

test("oport_31: a entidade na carteira usa os números e as recomendações do município, sem o fiscal", () => {
  const e = { instrumentos: 89, em_execucao: 10, em_suspensiva: 0, contas_atrasadas: 2, contas_rejeitadas: 0, saldo_parado: 0, sem_desembolso: 0, tce_tcu: 1, propostas: 0 };
  const k = montarCarteira(
    { seguidos: [{ tipo: "entidade", chave: "09112236000194", titulo: null, estado: e, referencia: "painel:2026-10-07T01:50:00Z", criado_em: "2026-10-08T10:00:00Z" }], avisos: [] },
    HOJE,
  );
  const x = k.porTipo.entidade[0];
  assert.equal(x.titulo, "Entidade 09112236000194");
  assert.equal(x.url, "/mapa/entidade/09112236000194");
  assert.deepEqual(x.numeros.slice(0, 2).map((n) => [n.rotulo, n.valor]), [["Instrumentos", "89"], ["Em execução", "10"]]);
  assert.ok(!x.numeros.some((n) => n.rotulo === "CAUC" || n.rotulo === "Transferência voluntária"), "sem fiscal");
  const tce = x.recomendacoes.find((r) => /tomada de contas especial/.test(r.acao));
  assert.match(tce?.fato ?? "", /para convênios da entidade/);
  assert.ok(x.recomendacoes.some((r) => /prestações de contas atrasadas/.test(r.acao)));
});

test("E4 (oport_43): a emenda estadual na carteira — passo, vez e dinheiro; andar e pagar são melhora; devolução pede atenção", () => {
  const e = (x: Partial<AvisoItem>) => c({ tipo: "emenda_estadual", chave: "2025-0075", ...x });
  assert.deepEqual(e({ evento: "epb_passo", antes: "sec_seplag", depois: "empenhada" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(e({ evento: "epb_passo", antes: "empenhada", depois: "seplag" }), { nivel: "informativo", melhora: null });
  assert.deepEqual(e({ evento: "epb_pago", antes: "0", depois: "100000" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(e({ evento: "epb_devolvida", antes: "false", depois: "true" }), { nivel: "moderado", melhora: false });
  assert.deepEqual(e({ evento: "epb_devolvida", antes: "true", depois: "false" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(e({ evento: "fora_do_recorte" }), { nivel: "moderado", melhora: null });

  const estado = { epb_passo: "sec_sefaz", epb_empenhado: 0, epb_pago: 0, epb_devolvida: true, epb_credores: 0 };
  const k = montarCarteira(
    {
      seguidos: [
        { tipo: "emenda_estadual", chave: "2025-0075", titulo: "Emenda 0075/2025 · Aquisição de equipamentos", estado, referencia: "epb:2026-10-16T14:52:57Z", criado_em: "2026-10-16T15:00:00Z" },
      ],
      avisos: [aviso({ tipo: "emenda_estadual", chave: "2025-0075", evento: "epb_passo", antes: "cronograma_sefaz", depois: "sec_sefaz" })],
    },
    HOJE,
  );
  const x = k.porTipo.emenda_estadual[0];
  assert.equal(x.url, "/mapa/parlamentares/assembleia/emenda/2025-0075");
  assert.equal(x.dadoDe, "2026-10-16");
  assert.deepEqual(
    x.numeros.map((n) => [n.rotulo, n.valor]),
    [["Passo", "Aprovada pelo secretário da SEFAZ"], ["Vez", "Órgão executor (empenho)"], ["Empenhado", "R$ 0"], ["Pago", "R$ 0"]],
    "sem credor, a contagem não aparece",
  );
  assert.equal(x.recomendacoes.length, 1);
  assert.match(x.recomendacoes[0].fato, /rodada de 16\/10\/2026/);
  assert.equal(x.mudancas[0].rotulo, "A emenda andou no caminho");
  assert.equal(x.mudancas[0].melhora, true);
  assert.deepEqual(k.comMudanca.map((i) => i.chave), ["2025-0075"]);
});

test("J4 (oport_45): a emenda municipal na carteira — etapa, dinheiro e TCE-PB; pagar é melhora; corte e estorno pedem atenção", () => {
  const e = (x: Partial<AvisoItem>) => c({ tipo: "emenda_municipal", chave: "2026-0171", ...x });
  assert.deepEqual(e({ evento: "ejp_empenhado", antes: "0", depois: "44110" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(e({ evento: "ejp_pago", antes: "0", depois: "44110" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(e({ evento: "ejp_pago", antes: "44110", depois: "0" }), { nivel: "moderado", melhora: false }, "estorno");
  assert.deepEqual(e({ evento: "ejp_atual", antes: "50000", depois: "40000" }), { nivel: "moderado", melhora: false }, "corte");
  assert.deepEqual(e({ evento: "ejp_atual", antes: "40000", depois: "50000" }), { nivel: "informativo", melhora: null }, "acréscimo não é andar");
  assert.deepEqual(e({ evento: "ejp_empenhos_tce", antes: "0", depois: "1" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(e({ evento: "ejp_unidade", antes: "FMS", depois: "FUNJOPE" }), { nivel: "informativo", melhora: null });
  assert.deepEqual(e({ evento: "fora_do_recorte" }), { nivel: "moderado", melhora: null });

  const estado = { ejp_atual: 50000, ejp_empenhado: 44110, ejp_liquidado: 44110, ejp_pago: 0, ejp_unidade: "FUNDO MUNICIPAL DE SAÚDE", ejp_empenhos_tce: 0 };
  const k = montarCarteira(
    {
      seguidos: [
        { tipo: "emenda_municipal", chave: "2026-0171", titulo: "Emenda 171/2026 · Equipamentos hospitalares", estado, referencia: "ejp:2026-10-19T18:47:48Z", criado_em: "2026-10-20T12:00:00Z" },
      ],
      avisos: [aviso({ tipo: "emenda_municipal", chave: "2026-0171", evento: "ejp_liquidado", antes: "0", depois: "44110" })],
    },
    HOJE,
  );
  const x = k.porTipo.emenda_municipal[0];
  assert.equal(x.url, "/mapa/parlamentares/camara-jp/emenda/2026-0171");
  assert.deepEqual(
    x.numeros.map((n) => [n.rotulo, n.valor]),
    [["Etapa", "Liquidada, falta pagar"], ["Valor atual", "R$ 50 mil"], ["Empenhado", "R$ 44 mil"], ["Pago", "R$ 0"], ["Unidade", "FUNDO MUNICIPAL DE SAÚDE"]],
    "sem empenho no TCE-PB, a contagem não aparece",
  );
  assert.equal(x.recomendacoes.length, 1, "empenhada no painel sem empenho do TCE-PB: conferir");
  assert.match(x.recomendacoes[0].fato, /nenhum empenho do TCE-PB cita a emenda/);
  assert.equal(x.mudancas[0].rotulo, "Nova liquidação da emenda");
  assert.equal(x.mudancas[0].melhora, true);
  const comTce = montarCarteira({ seguidos: [{ tipo: "emenda_municipal", chave: "2026-0171", titulo: "Emenda 171/2026", estado: { ...estado, ejp_empenhos_tce: 1 }, referencia: null, criado_em: "2026-10-20T12:00:00Z" }], avisos: [] }, HOJE);
  assert.equal(comTce.porTipo.emenda_municipal[0].recomendacoes.length, 0);
});

test("P3 da primeira infância (oport_53): parcela e pagamento são avanço; creche parada é alta e vira recomendação", () => {
  assert.deepEqual(c({ evento: "creche_liberado", antes: "0", depois: "500000" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(c({ evento: "creche_pagando", antes: "0", depois: "1" }), { nivel: "informativo", melhora: true });
  assert.deepEqual(c({ evento: "creche_parada_180", antes: "0", depois: "1" }), { nivel: "alto", melhora: false });
  assert.deepEqual(c({ evento: "creche_parada_180", antes: "2", depois: "1" }), { nivel: "informativo", melhora: true });
  const r = recomendacoesMunicipio({ cauc: "", creche_parada_180: 2 }, "2026-10-27");
  assert.equal(r[0].acao, "Pagar a obra das 2 creches paradas ou tratar com o concedente");
  assert.match(r[0].fato, /2 termos de creche com a parcela em conta e nenhum pagamento há mais de 180 dias.*27\/10\/2026/);
  assert.deepEqual(recomendacoesMunicipio({ cauc: "", creche_parada_180: 0, creche_liberado: 500000, creche_pagando: 1 }, null), []);
});

test("oport_53: o retrato do município ganha os campos de creche; os outros ramos e as permissões ficam como na oport_32", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.resolve(import.meta.dirname, "..", "..", "..", "supabase", "migrations");
  const nova = fs.readFileSync(path.join(dir, "oport_53_seguir_primeira_infancia.sql"), "utf-8");
  const velha = fs.readFileSync(path.join(dir, "oport_32_osc.sql"), "utf-8");
  for (const campo of ["creche_liberado", "creche_pagando", "creche_parada_180"]) assert.ok(nova.includes(`'${campo}'`), campo);
  assert.match(nova, /\|\| coalesce\(px\.retrato, '\{\}'::jsonb\) \|\| cr\.retrato/);
  // o ramo da entidade é o mesmo da oport_32
  const entidade = (s: string) => s.slice(s.indexOf("-- Entidade (E2)"), s.indexOf("revoke execute on function public.oport_estado_painel"));
  assert.equal(entidade(nova).replace(/\r/g, ""), entidade(velha).replace(/\r/g, ""));
  assert.match(nova, /grant execute on function public\.oport_estado_painel\(text, text, bigint\) to service_role;/);
  assert.equal(/to (anon|authenticated)\b/.test(nova), false);
});
