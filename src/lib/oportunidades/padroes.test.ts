import test from "node:test";
import assert from "node:assert/strict";
import {
  chaveRequisito,
  concentracao,
  destino,
  lerHistorico,
  montarChecklist,
  perfilAnalistas,
  porCondicao,
  porRequisito,
  quantil,
  tituloOrgao,
  venceNaNatureza,
  type AtualSuspensiva,
  type DetalheComNumero,
  type DocumentoComNumero,
  type EventoComNumero,
  type HistoricoSuspensiva,
} from "./padroes.ts";

const HOJE = "2026-09-18";

// ------------------------------------------------------------------ utilidades

test("quantil interpola como o percentile_cont do Postgres", () => {
  assert.equal(quantil([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantil([4, 1, 3, 2], 0.75), 3.25);
  assert.equal(quantil([5], 0.5), 5);
  assert.equal(quantil([], 0.5), null);
});

test("concentração devolve a moda e a fatia dela, ignorando vazios", () => {
  assert.deepEqual(concentracao(["A", "A", "B", null]), { valor: "A", fatia: 2 / 3 });
  assert.deepEqual(concentracao([null, null]), { valor: null, fatia: 0 });
});

test("chaveRequisito junta caixa, acento, espaço e ponto final", () => {
  const k = chaveRequisito("CERTIDÃO TJ");
  assert.equal(chaveRequisito("Certidão  TJ."), k);
  assert.equal(chaveRequisito("CERTIDAO TJ"), k);
  assert.equal(chaveRequisito("  "), null);
});

// ------------------------------------------------------------------ histórico

function h(extra: Partial<HistoricoSuspensiva>): HistoricoSuspensiva {
  return {
    nr_convenio: "1",
    orgao_sup: "MINISTERIO DO TURISMO",
    programa: "P",
    situacao: "Em execução",
    dt_assinatura: "2022-01-01",
    dt_suspensiva: null,
    dt_retirada_suspensiva: null,
    vl_repasse: 100,
    vl_desembolsado: 0,
    ...extra,
  };
}

test("destino: saiu pela retirada; morreu anulado ou rescindido; segue em execução; encerrou no resto", () => {
  assert.equal(destino(h({ dt_retirada_suspensiva: "2023-01-01" })), "saiu");
  assert.equal(destino(h({ dt_suspensiva: "2023-01-01", situacao: "Convênio Anulado" })), "morreu");
  assert.equal(destino(h({ dt_suspensiva: "2023-01-01", situacao: "Convênio Rescindido" })), "morreu");
  assert.equal(destino(h({ dt_suspensiva: "2027-01-01", situacao: "Em execução" })), "segue");
  assert.equal(destino(h({ dt_suspensiva: "2023-01-01", situacao: "Aguardando Prestação de Contas" })), "encerrou");
  assert.equal(destino(h({})), null); // nunca teve suspensiva
});

test("lerHistorico conta a coorte, mede o tempo só de quem saiu e a fatia perdida", () => {
  const hs = [
    h({ nr_convenio: "a", dt_retirada_suspensiva: "2022-04-11" }), // 100 dias
    h({ nr_convenio: "b", dt_retirada_suspensiva: "2022-07-20" }), // 200 dias
    h({ nr_convenio: "c", dt_suspensiva: "2022-10-01", situacao: "Convênio Anulado", vl_repasse: 500 }),
    h({ nr_convenio: "d", dt_suspensiva: "2027-01-01", situacao: "Em execução" }),
    h({ nr_convenio: "e", dt_assinatura: "2015-01-01", dt_retirada_suspensiva: "2020-01-01" }), // fora da coorte
    h({ nr_convenio: "f", orgao_sup: "MINISTERIO DA SAUDE", dt_retirada_suspensiva: "2022-01-31" }), // 30 dias
  ];
  const r = lerHistorico(hs);
  assert.equal(r.total.total, 5);
  assert.deepEqual(r.total.destinos.morreu, { n: 1, valor: 500 });
  assert.equal(r.total.mediana, 100);
  assert.equal(r.total.pctPerdido, 1 / 4); // 1 morreu entre 4 terminados

  const turismo = r.orgaos.find((o) => o.orgao === "MINISTERIO DO TURISMO");
  assert.equal(turismo?.total, 4);
  assert.equal(turismo?.mediana, 150);
  assert.equal(turismo?.pctPerdido, 1 / 3);
  assert.equal(r.orgaos[0].orgao, "MINISTERIO DO TURISMO", "o órgão com mais casos vem primeiro");
});

// ------------------------------------------------------------------ agora

function a(extra: Partial<AtualSuspensiva>): AtualSuspensiva {
  return {
    numero: "1",
    orgao_sup: "MINISTERIO DO TURISMO",
    programa: "Infraestrutura turística",
    motivo_suspensao: "Titularidade de Área, Projeto de Engenharia e Licenciamento Ambiental Prévio",
    dt_assinatura: "2025-12-18",
    dt_suspensiva: "2027-06-30",
    vl_repasse: 1000,
    parado_desde: "2026-01-01T12:00:00Z",
    rodadas_de_exigencia: 1,
    ...extra,
  };
}

test("porCondicao conta cada condição do termo, junta o texto livre e marca prazo apertado", () => {
  const r = porCondicao(
    [
      a({ numero: "1" }),
      a({ numero: "2", motivo_suspensao: "Projeto de Engenharia e CMDR", dt_suspensiva: "2026-10-01" }),
      a({ numero: "3", motivo_suspensao: null }),
    ],
    HOJE,
  );
  const pe = r.find((x) => x.condicao === "Projeto de Engenharia");
  assert.equal(pe?.convenios, 2);
  assert.equal(pe?.valor, 2000);
  assert.equal(pe?.prazoApertado, 1);
  assert.equal(pe?.medianaEmSuspensiva, 274);
  assert.equal(r.find((x) => x.condicao.startsWith("Outras"))?.convenios, 1);
  assert.equal(r[0].condicao, "Projeto de Engenharia", "a condição mais frequente vem primeiro");
});

function ev(numero: string, ocorrido_em: string, responsavel: string, resultado: string, extra: Partial<EventoComNumero> = {}): EventoComNumero {
  const lado = resultado === "enviado" ? "proponente" : "concedente";
  return { numero, ordem: 0, evento: resultado, lado, resultado, responsavel, ocorrido_em, id_situacao: null, ...extra };
}

test("perfil do analista: carteira, o que decide, maior lote e última palavra", () => {
  const eventos = [
    ev("1", "2025-12-15T12:00:00Z", "CLEITON", "complementação solicitada"),
    ev("2", "2025-12-15T13:00:00Z", "CLEITON", "complementação solicitada"),
    ev("3", "2025-12-15T14:00:00Z", "CLEITON", "atendido", { id_situacao: "9" }),
    ev("1", "2026-01-10T12:00:00Z", "PREFEITO", "enviado"),
    ev("4", "2026-02-01T12:00:00Z", "RAYANE", "atendido"),
  ];
  const detalhes: DetalheComNumero[] = [
    { numero: "3", id_situacao: "9", analise: null, responsavel: null, atribuicao: "Gestor de Instrumento do Concedente", analisada_em: null, situacao: null, observacao: null, solicitacao: null },
  ];
  const contexto = new Map([
    ["1", { orgao_sup: "INTEGRACAO", programa: "00SX", vl_repasse: 100 }],
    ["2", { orgao_sup: "INTEGRACAO", programa: "00SX", vl_repasse: 200 }],
    ["3", { orgao_sup: "INTEGRACAO", programa: "OUTRO", vl_repasse: 300 }],
    ["4", { orgao_sup: "AGRICULTURA", programa: "FOMENTO", vl_repasse: 400 }],
  ]);
  const [cleiton, rayane] = perfilAnalistas(eventos, detalhes, contexto, "2026-09-17");
  assert.equal(cleiton.nome, "CLEITON");
  assert.deepEqual(cleiton.orgao, { valor: "INTEGRACAO", fatia: 1 });
  assert.equal(cleiton.programa.valor, "00SX");
  assert.deepEqual([cleiton.exigencias, cleiton.atendimentos], [2, 1]);
  assert.deepEqual(cleiton.maiorLote, { dia: "2025-12-15", convenios: 3 });
  assert.equal(cleiton.atribuicao, "Gestor de Instrumento do Concedente");
  // No convênio 1, a última palavra foi do prefeito: Cleiton fica com a dos convênios 2 e 3.
  assert.equal(cleiton.ultimaPalavra.convenios, 2);
  assert.equal(cleiton.ultimaPalavra.valor, 500);
  assert.equal(rayane.ultimaPalavra.medianaDias, 228);
  assert.ok(!perfilAnalistas(eventos, detalhes, contexto, "2026-09-17").some((p) => p.nome === "PREFEITO"), "só o lado do concedente");
});

function doc(numero: string, requisito: string, validade: string | null = null): DocumentoComNumero {
  return { numero, ordem: 0, grupo: "Outros", arquivo: "x.pdf", descricao: requisito, requisito, enviado_em: null, validade };
}

test("porRequisito junta grafias, conta convênios e mostra a grafia mais usada", () => {
  const r = porRequisito(
    [doc("1", "CERTIDÃO TJ", "2026-01-01"), doc("2", "Certidão TJ", "2027-01-01"), doc("3", "CERTIDAO TJ."), doc("3", "LOA")],
    HOJE,
  );
  assert.deepEqual(r[0], { requisito: "CERTIDÃO TJ", convenios: 3, documentos: 3, comValidade: 2, vencidos: 1 });
  assert.deepEqual(r[1], { requisito: "LOA", convenios: 1, documentos: 1, comValidade: 0, vencidos: 0 });
});

test("checklist do órgão: condições, documentos com validade e as palavras do concedente", () => {
  const atuais = [a({ numero: "1" }), a({ numero: "2" }), a({ numero: "9", orgao_sup: "OUTRO" })];
  const docs = [doc("1", "CERTIDÃO TJ", "2026-01-01"), doc("2", "CERTIDÃO TJ"), doc("2", "LOA"), doc("9", "SÓ DO OUTRO")];
  const pedido = "Anexar a certidão do TJ atualizada.";
  const detalhes: DetalheComNumero[] = ["1", "2", "2"].map((numero, k) => ({
    numero, id_situacao: String(k), analise: null, responsavel: null, atribuicao: null, analisada_em: null, situacao: null, observacao: null,
    solicitacao: k === 2 ? "Enviar o QDD." : pedido,
  }));
  const historico = lerHistorico([h({ dt_retirada_suspensiva: "2022-04-11" })]).orgaos;

  const c = montarChecklist("MINISTERIO DO TURISMO", HOJE, atuais, docs, detalhes, historico);
  assert.equal(c.base, 2);
  assert.deepEqual(c.condicoes.map((x) => [x.texto, x.fatia]), [
    ["Licenciamento Ambiental Prévio", 1],
    ["Projeto de Engenharia", 1],
    ["Titularidade de Área", 1],
  ]);
  assert.deepEqual(c.documentos.map((d) => [d.requisito, d.convenios, d.vence]), [["CERTIDÃO TJ", 2, true], ["LOA", 1, false]]);
  // A certidão vence pela natureza, mesmo sem validade preenchida no anexo do convênio 2.
  assert.ok(!c.documentos.some((d) => d.requisito === "SÓ DO OUTRO"), "documento de outro órgão não entra");
  assert.deepEqual(c.palavras[0], { texto: pedido, vezes: 2, convenios: 2 });
  assert.equal(c.historico?.mediana, 100);
});

test("checklist de órgão sem casos não inventa nada", () => {
  const c = montarChecklist("NINGUEM", HOJE, [a({})], [], [], []);
  assert.equal(c.base, 0);
  assert.deepEqual([c.condicoes, c.documentos, c.palavras, c.historico], [[], [], [], null]);
});

test("tituloOrgao põe o acento que o SICONV esquece e deixa os conectivos em minúscula", () => {
  assert.equal(tituloOrgao("MINISTERIO DA SAUDE"), "Ministério da Saúde");
  assert.equal(tituloOrgao("MINISTÉRIO DA INTEGRAÇÃO E DO DESENVOLVIMENTO REGIONAL"), "Ministério da Integração e do Desenvolvimento Regional");
  assert.equal(tituloOrgao("MINISTERIO DA JUSTICA E SEGURANCA PUBLICA"), "Ministério da Justiça e Segurança Pública");
});

test("o lote do analista conta pelo dia de Brasília, não pelo de UTC", () => {
  const eventos = [
    ev("1", "2025-12-15T12:00:00Z", "ANA", "complementação solicitada"),
    ev("2", "2025-12-16T01:30:00Z", "ANA", "complementação solicitada"), // 22h30 do dia 15 em Brasília
  ];
  const [ana] = perfilAnalistas(eventos, [], new Map(), "2026-09-17");
  assert.deepEqual(ana.maiorLote, { dia: "2025-12-15", convenios: 2 });
});

test("vence pela natureza do documento, não pelo campo de validade quase sempre vazio", () => {
  for (const r of ["CERTIDÃO TJ", "Certidão TRT", "DECLARAÇÃO DE EXISTÊNCIA DE ÁREA GESTORA", "CAUC", "PROTOCOLO TCE", "Comprovante de residência", "EXTRATO CAUC"]) {
    assert.equal(venceNaNatureza(r), true, r);
  }
  for (const r of ["LOA", "QDD", "KIT PREFEITO", "PROJETO BÁSICO"]) assert.equal(venceNaNatureza(r), false, r);
});
