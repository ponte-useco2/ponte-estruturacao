import test from "node:test";
import assert from "node:assert/strict";
import { diasAte, ordenarCiclo, pontoDoCiclo, type PlanoCicloPix } from "./pix-ciclo.ts";

const sp = (t: string) => t.replace(/ /g, " ");

function p(extra: Partial<PlanoCicloPix> = {}): PlanoCicloPix {
  return {
    id_plano_acao: 1, codigo_plano_acao: "09032027-000001", ano: 2027, ciclo: 1, beneficiario: "MUNICIPIO DE SAPE", cnpj: "08917080000156",
    cod_ibge: "2515302", autor: "Fulano", valor: 250000, situacao_plano: "CIENTE", situacao_pt: "Em Complementação", desde: "2027-04-02",
    vez: "ente", etapa: "complementar o plano de trabalho", prazo: "2027-05-10", prazo_fonte: "Comunicado nº 4/2027",
    ultima_analise: { orgao: "Ministério da Saúde", situacao: "Concluída", parecer: "Solicitar Complementação", data: "2027-04-01",
      valor_reprovado: null, trecho: "Falta a planilha orçamentária.", fora_da_area: false },
    ...extra,
  };
}

test("dias até o prazo", () => {
  assert.equal(diasAte("2027-05-10", "2027-04-20"), 20);
  assert.equal(diasAte("2027-05-10", "2027-05-12"), -2);
  assert.equal(diasAte(null, "2027-05-12"), null);
});

test("vez do município: alto, com o prazo, a ação e o último parecer", () => {
  const x = pontoDoCiclo(p(), "2027-04-20");
  assert.equal(x.nivel, "alto");
  assert.equal(sp(x.titulo), "Pix em curso: o município precisa complementar o plano de trabalho (plano 09032027-000001, emenda de Fulano, R$ 250 mil)");
  assert.equal(x.acao, "Complementar o plano de trabalho no Transferegov até 10/05/2027.");
  assert.match(x.fato, /^O plano de trabalho está em «Em Complementação» desde 02\/04\/2027\. O prazo do comunicado \(Comunicado nº 4\/2027\) é 10\/05\/2027: faltam 20 dias\./);
  assert.match(x.fato, /Última análise, Ministério da Saúde em 01\/04\/2027 \(solicitar complementação\): «Falta a planilha orçamentária\.»$/);
  assert.match(pontoDoCiclo(p(), "2027-05-12").fato, /era 10\/05\/2027: venceu há 2 dias\./);
  assert.match(pontoDoCiclo(p(), "2027-05-10").fato, /vence hoje, 10\/05\/2027\./);
});

test("sem prazo cadastrado o texto diz isso, sem inventar data", () => {
  const x = pontoDoCiclo(p({ prazo: null, prazo_fonte: null, ultima_analise: null, situacao_pt: null, etapa: "cadastrar e enviar o plano de trabalho" }), "2027-04-20");
  assert.match(x.fato, /^Ainda não há plano de trabalho cadastrado\. O prazo do comunicado ainda não foi cadastrado/);
  assert.equal(x.acao, "Cadastrar e enviar o plano de trabalho no Transferegov.");
});

test("vez do órgão é informação; situação desconhecida é a conferir", () => {
  const o = pontoDoCiclo(p({ vez: "orgao", situacao_pt: "Enviado para Análise", etapa: "analisar o plano de trabalho", prazo: null, ultima_analise: null }), "2027-04-20");
  assert.equal(o.nivel, "informativo");
  assert.equal(o.acao, null);
  assert.match(o.fato, /a vez é do órgão\. Se o órgão pedir complementação, a vez volta ao município\.$/);
  assert.equal(pontoDoCiclo(p({ vez: "a_conferir", etapa: "situação nova no Transferegov: X" }), "2027-04-20").nivel, "moderado");
});

test("ordem: vez do município primeiro, do prazo mais próximo", () => {
  const r = ordenarCiclo([p({ id_plano_acao: 1, vez: "orgao", prazo: null }), p({ id_plano_acao: 2, prazo: "2027-06-01" }), p({ id_plano_acao: 3, prazo: "2027-05-01" }), p({ id_plano_acao: 4, prazo: null })]);
  assert.deepEqual(r.map((x) => x.id_plano_acao), [3, 2, 4, 1]);
});
