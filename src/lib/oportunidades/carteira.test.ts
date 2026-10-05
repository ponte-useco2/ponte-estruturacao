import test from "node:test";
import assert from "node:assert/strict";
import {
  consequenciaDoAviso,
  dataDaReferencia,
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
  assert.deepEqual(r.map((x) => x.nivel), ["alto", "alto", "alto", "alto", "alto", "moderado"], "CAUC, TCE, contas atrasadas, rejeitadas, pessoal e saldo");
  assert.match(r[4].fato, /54,54% da RCL ajustada/);
  assert.equal(r[0].acao, "Regularizar os itens 1.5, 3.2.3, 4.2 do CAUC");
  assert.match(r[0].fato, /pendências em 1\.5, 3\.2\.3, 4\.2 \(dado de 01\/10\/2026\).*LRF, art\. 25/);
  assert.equal(r[1].acao, "Acompanhar as 2 TCE no TCU e reunir a defesa ou o recolhimento");
  assert.match(r[1].fato, /TCE não é julgamento/);
  assert.equal(r[2].acao, "Enviar a prestação de contas atrasada");
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
  const k = montarCarteira({ seguidos, avisos, admin: false }, HOJE);
  assert.equal(k.naoLidas, 3);
  assert.deepEqual(k.comMudanca.map((i) => [i.chave, i.pior]), [["2510808", "alto"], ["942082", "moderado"]]);
  const patos = k.porTipo.municipio[0];
  assert.deepEqual(patos.mudancas.map((m) => m.id), ["b", "a"]);
  assert.equal(patos.url, "/mapa/municipio/2510808/investimentos");
  assert.equal(montarCarteira({ seguidos, avisos, admin: true }, HOJE).porTipo.municipio[0].url, "/mapa/municipio/2510808/relatorio");
  assert.equal(patos.recomendacoes.length, 3, "a carteira mostra três");
  assert.equal(patos.restantes, 3, "e diz quantos pontos ficaram na página do município");
  assert.deepEqual(patos.numeros.map((n) => `${n.rotulo}=${n.valor}`), ["Transferência voluntária=bloqueada", "CAUC=1.5, 3.2.3, 4.2", "Em execução=13", "TCE no TCU=2"]);
  assert.equal(patos.dadoDe, "2026-10-01");
  const conv = k.porTipo.instrumento[0];
  assert.deepEqual(conv.mudancas.map((m) => [m.id, m.lida]), [["d", false], ["c", true]]);
  assert.equal(conv.numeros.find((n) => n.rotulo === "Físico")?.valor, "50%");
  assert.equal(k.porTipo.janela[0].recomendacoes[0].acao, "Decidir se vale preparar a proposta até 01/12/2026");
  assert.equal(montarCarteira({ seguidos: [], avisos: [], admin: false }, HOJE).vazia, true);
});

test("data da referência do retrato", () => {
  assert.equal(dataDaReferencia("painel:2026-10-01T23:00:00Z"), "2026-10-01");
  assert.equal(dataDaReferencia(null), null);
  assert.equal(dataDaReferencia("sem data"), null);
});
