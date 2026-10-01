import test from "node:test";
import assert from "node:assert/strict";
import { obrasParadas, riscosContasObras, secaoContasObras, type EntradaContasObras, type ObraConvenio, type PcConvenio } from "./contas-obras.ts";

// Ouro Velho (943029) e Sumé (919058) como a coleta de 30/09/2026 os trouxe; o nome do servidor é fictício.
const pc = (x: Partial<PcConvenio> = {}): PcConvenio => ({
  nr_convenio: "943029", n_eventos: 3, valor_comprovado: 1693289.14, valor_aprovado: 883107.73, valor_impugnado: 810181.41,
  dt_comprovacao: "2025-05-14T13:05:41+00:00", dt_ultimo_evento: "2026-07-10T18:57:19+00:00", ultimo_evento: "Impugnação",
  cumprimento: "integralmente", pct_fisico_declarado: 100, n_pareceres: 0, parecer_data: null, parecer_tipo: null, parecer_situacao: null,
  erro: null, ...x,
});
const eventos = [
  { ordem: 1, evento: "Impugnação", situacao: "Enviada", data_hora: "2026-07-10T18:57:19+00:00", valor: 810181.41 },
  { ordem: 3, evento: "Comprovação", situacao: "Enviada", data_hora: "2025-05-14T13:05:41+00:00", valor: 1693289.14 },
];
const obra = (x: Partial<ObraConvenio> = {}): ObraConvenio => ({
  nr_convenio: "947793", codigo: "ok", mensagem: null, n_lotes: 1, ultima_medicao: 4, dias_sem_medicao: 474, atrasado: true, paralisado: false,
  valor_total: 8100000, realizado_convenente: 8100000, realizado_concedente: 6654062.59, pct_convenente: 100, pct_concedente: 82.15, ...x,
});

test("prestação: frase com o que foi comprovado, aprovado e impugnado", () => {
  const s = secaoContasObras({ prestacao: { convenio: pc(), eventos, pareceres: [], referencia: "2026-09-30" }, obra: null })!;
  assert.equal(
    s.prestacao!.frase,
    "No SIAFI: R$ 1.693.289,14 comprovados em 14/05/2025; R$ 883.107,73 aprovados; R$ 810.181,41 impugnados. O último evento é impugnação, em 10/07/2026.",
  );
  assert.deepEqual(s.prestacao!.eventos.map((e) => e.evento), ["Comprovação", "Impugnação"]);   // em ordem de data
  assert.equal(s.prestacao!.cumprimento, "O convenente declarou o objeto cumprido integralmente, com 100% de execução física.");
  assert.equal(s.obra, null);
  assert.equal(secaoContasObras({ prestacao: { convenio: pc({ n_eventos: 0 }), eventos: [], pareceres: [], referencia: null }, obra: null })!.prestacao!.frase,
    "Nenhum evento de prestação de contas registrado no SIAFI até a coleta.");
  assert.equal(secaoContasObras({ prestacao: null, obra: null }), null);
  assert.equal(secaoContasObras(undefined), null);
});

test("prestação: o cliente não vê o nome do servidor", () => {
  const parecer = { ordem: 1, data: "2026-09-11", tipo: "Técnico", situacao: "Em Diligência", emitido_por: "Órgão Concedente", responsavel: "FULANO DE TAL",
    atribuicao: "Técnico do Concedente", funcao: "Servidor", texto: "Análise técnica.", n_anexos: 1, detalhado: true };
  const e: EntradaContasObras = { prestacao: { convenio: pc(), eventos, pareceres: [parecer], referencia: null }, obra: null };
  assert.equal(secaoContasObras(e)!.prestacao!.pareceres[0].responsavel, "FULANO DE TAL");
  assert.equal(secaoContasObras(e, { semNomes: true })!.prestacao!.pareceres[0].responsavel, null);
});

test("riscos: impugnação alta e diligência moderada", () => {
  const r = riscosContasObras({ prestacao: { convenio: pc(), eventos, pareceres: [], referencia: null }, obra: null });
  assert.equal(r.length, 1);
  assert.equal(r[0].nivel, "alto");
  assert.equal(r[0].titulo, "R$ 810.181,41 impugnados na prestação de contas");
  assert.match(r[0].fato, /^O concedente registrou no SIAFI a impugnação de R\$ 810\.181,41 em 10\/07\/2026, e a aprovação de R\$ 883\.107,73/);
  assert.match(r[0].fato, /sem isso, vira Tomada de Contas Especial\.$/);
  const comTce = riscosContasObras({ prestacao: { convenio: pc(), eventos, pareceres: [], referencia: null }, obra: null }, { comTce: true });
  assert.match(comTce[0].fato, /já virou Tomada de Contas Especial no TCU\.$/);
  const d = riscosContasObras({
    prestacao: { convenio: pc({ valor_impugnado: null, parecer_situacao: "Em Diligência", parecer_tipo: "Técnico", parecer_data: "2026-09-11" }), eventos: [], pareceres: [], referencia: null },
    obra: null,
  });
  assert.deepEqual(d.map((x) => [x.nivel, x.titulo]), [["moderado", "Prestação de contas em diligência"]]);
  assert.match(d[0].fato, /parecer técnico de 11\/09\/2026 está "Em Diligência"/);
});

test("obra: frases por código e riscos de medição e de atestado", () => {
  const e = (o: ObraConvenio): EntradaContasObras => ({ prestacao: null, obra: { convenio: o, referencia: "2026-09-30" } });
  const s = secaoContasObras(e(obra()))!;
  // Pocinhos: a obra inteira atestada pelo convenente; o que está parado é o aceite da mandatária.
  assert.equal(s.obra!.frase, "No acompanhamento de obras: 4ª medição, com a obra inteira atestada pelo convenente; a última medição foi há 474 dias.");
  assert.equal(s.obra!.atestado, "Do valor da obra, o convenente atestou 100%; a concedente ou mandatária, 82,2%.");
  assert.match(secaoContasObras(e(obra({ codigo: "err005" })))!.obra!.frase, /licitação não foi aceita no módulo VRPL/);
  assert.match(secaoContasObras(e(obra({ codigo: "err007" })))!.obra!.frase, /não segue o fluxo VRPL\/AIO/);

  assert.deepEqual(riscosContasObras(e(obra())).map((r) => [r.nivel, r.titulo]), [["moderado", "Obra atestada por inteiro, aceite da concedente pendente"]]);
  assert.deepEqual(riscosContasObras(e(obra({ pct_concedente: 98 }))), []);   // aceite quase todo: nada a apontar
  // Obra pela metade, atrasada: o tempo sem medição é o risco.
  const meio = { pct_convenente: 50, pct_concedente: 45, realizado_convenente: 4050000, realizado_concedente: 3645000 };
  assert.equal(secaoContasObras(e(obra(meio)))!.obra!.frase, "No acompanhamento de obras: 4ª medição, 474 dias sem medição, marcada como atrasada.");
  assert.deepEqual(riscosContasObras(e(obra(meio))).map((r) => [r.nivel, r.titulo]), [["alto", "Obra sem medição há 474 dias"]]);
  assert.deepEqual(riscosContasObras(e(obra({ ...meio, dias_sem_medicao: 120 }))).map((r) => r.nivel), ["moderado"]);
  assert.deepEqual(riscosContasObras(e(obra({ ...meio, dias_sem_medicao: 60 }))), []);
  assert.deepEqual(riscosContasObras(e(obra({ paralisado: true }))).map((r) => r.titulo), ["Obra paralisada"]);
  const atestado = riscosContasObras(e(obra({ atrasado: false, pct_convenente: 90, pct_concedente: 68 })));
  assert.deepEqual(atestado.map((r) => [r.nivel, r.titulo]), [["moderado", "Executado atestado pelo convenente acima do da concedente"]]);
  assert.deepEqual(riscosContasObras(e(obra({ codigo: "err005", atrasado: null, dias_sem_medicao: null }))), []);
});

test("painel: obras paradas, paralisadas primeiro", () => {
  const l = (nr: string, x: Partial<ObraConvenio>) => ({ ...obra({ nr_convenio: nr, ...x }), municipio: null, proponente: null });
  const meio = { pct_convenente: 50 };
  const r = obrasParadas([l("1", { ...meio, dias_sem_medicao: 100 }), l("2", { paralisado: true, dias_sem_medicao: 10 }), l("3", { ...meio, dias_sem_medicao: 500 }),
    l("4", { ...meio, dias_sem_medicao: 50 }), l("5", { codigo: "err005" }), l("6", { dias_sem_medicao: 474 })]);   // 6: completa, não é obra parada
  assert.deepEqual(r.map((x) => x.nr_convenio), ["2", "3", "1"]);
});
