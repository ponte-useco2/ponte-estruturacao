import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contarNaoLidas,
  contarPorTipo,
  descrever,
  filtrar,
  formatarData,
  formatarPublicacao,
  frescorDoDado,
  mensagemVazio,
  ordenarPorUrgencia,
  agruparPorPrazo,
  codigosDaChave,
  type ItemCentral,
} from "./central.ts";

function item(id: string, extra: Partial<ItemCentral> = {}): ItemCentral {
  return {
    id,
    tipo: "nova",
    chave: `proposta|Convênio|${id}`,
    programa: `Programa ${id}`,
    orgao: "Ministério",
    temas: [],
    natureza: "Convênio",
    canal: "proposta",
    fecha: "2026-10-30",
    publicado_em: "2026-09-10T16:33:31.551789",
    lida_em: null,
    arquivada_em: null,
    ...extra,
  };
}

const ids = (xs: ItemCentral[]) => xs.map((x) => x.id);
const agora = new Date("2026-09-11T12:00:00Z");

test("a janela que fecha antes vem antes, e não na ordem em que os dados chegaram", () => {
  // Regressão do protótipo: a de 14/09 aparecia abaixo de uma que fechava em 62 dias.
  const r = ordenarPorUrgencia([item("longe", { fecha: "2026-11-12" }), item("perto", { fecha: "2026-09-14" })]);
  assert.deepEqual(ids(r), ["perto", "longe"]);
});

test("prazo se aproximando passa na frente de janela nova, e a marca de 1 dia na frente da de 7", () => {
  const r = ordenarPorUrgencia([
    item("nova"),
    item("sete", { tipo: "fechando", limiar: 7 }),
    item("encerrada", { tipo: "encerrada" }),
    item("um", { tipo: "fechando", limiar: 1 }),
    item("tres", { tipo: "fechando", limiar: 3 }),
    item("prazo", { tipo: "prazo_alterado", antes: "2026-09-20", depois: "2026-10-20" }),
  ]);
  assert.deepEqual(ids(r), ["um", "tres", "sete", "prazo", "nova", "encerrada"]);
});

test("abas: não lidas exclui lidas e arquivadas; todas exclui arquivadas; arquivadas só arquivadas", () => {
  const xs = [
    item("aberta"),
    item("lida", { lida_em: "2026-09-11T10:00:00Z" }),
    item("arquivada", { arquivada_em: "2026-09-11T10:00:00Z" }),
  ];
  assert.deepEqual(ids(filtrar(xs, "nao_lidas", [])), ["aberta"]);
  assert.deepEqual(ids(filtrar(xs, "todas", [])), ["aberta", "lida"]);
  assert.deepEqual(ids(filtrar(xs, "arquivadas", [])), ["arquivada"]);
  assert.equal(contarNaoLidas(xs), 1);
});

test("a contagem do chip conta só o que está na aba aberta", () => {
  // Regressão do protótipo: os chips somavam também as arquivadas.
  const xs = [item("a"), item("b", { arquivada_em: "2026-09-11T10:00:00Z" })];
  assert.equal(contarPorTipo(xs, "todas").nova, 1);
  assert.equal(contarPorTipo(xs, "arquivadas").nova, 1);
});

test("filtro por tipo combina com a aba", () => {
  const xs = [item("n"), item("f", { tipo: "fechando", limiar: 3 })];
  assert.deepEqual(ids(filtrar(xs, "todas", ["fechando"])), ["f"]);
});

test("frescor: 35 horas é fresco, 36 é velho", () => {
  const menos = new Date(agora.getTime() - 35 * 36e5).toISOString().replace("Z", "");
  const limite = new Date(agora.getTime() - 36 * 36e5).toISOString().replace("Z", "");
  assert.equal(frescorDoDado(menos, agora).estado, "fresco");
  assert.equal(frescorDoDado(limite, agora).estado, "velho");
});

test("frescor: publicação sem data, ilegível ou do futuro não autoriza afirmar nada", () => {
  assert.equal(frescorDoDado(null, agora).estado, "desconhecido");
  assert.equal(frescorDoDado("ontem", agora).estado, "desconhecido");
  assert.equal(frescorDoDado("2026-09-12T12:00:00", agora).estado, "desconhecido");
});

test("o gerado_em sem fuso é lido como UTC, independente de onde o código roda", () => {
  const r = frescorDoDado("2026-09-11T00:00:00.588598", agora);
  if (r.estado === "desconhecido") assert.fail("a data deveria ser legível");
  assert.equal(r.estado, "fresco");
  assert.ok(Math.abs(r.horas - 12) < 0.01, "12 horas entre 00:00Z e 12:00Z");
});

test("a publicação é exibida no horário da Paraíba", () => {
  assert.equal(formatarPublicacao("2026-09-11T00:04:39.588598"), "10/09/2026 às 21:04");
});

test("vazio com dado velho nunca afirma que nada mudou", () => {
  const m = mensagemVazio({ aba: "nao_lidas", filtrando: false, frescor: { estado: "velho", horas: 50 }, publicadoEm: "2026-09-09T12:00:00" });
  assert.equal(m.afirmaCalmaria, false);
  assert.match(m.titulo, /Não foi possível verificar/);
  assert.match(m.texto, /09\/09\/2026/);
});

test("vazio com dado fresco pode afirmar, e diz quando o catálogo foi verificado", () => {
  const m = mensagemVazio({ aba: "nao_lidas", filtrando: false, frescor: { estado: "fresco", horas: 3 }, publicadoEm: "2026-09-11T00:04:39" });
  assert.equal(m.afirmaCalmaria, true);
  assert.match(m.texto, /10\/09\/2026 às 21:04/);
});

test("vazio por filtro ou em arquivadas não fala de frescor do catálogo", () => {
  const velho = { estado: "velho", horas: 90 } as const;
  assert.match(mensagemVazio({ aba: "todas", filtrando: true, frescor: velho, publicadoEm: null }).titulo, /filtros/);
  assert.match(mensagemVazio({ aba: "arquivadas", filtrando: false, frescor: velho, publicadoEm: null }).titulo, /arquivada/);
});

test("descrição usa data absoluta e concorda em número", () => {
  assert.equal(descrever(item("x", { tipo: "fechando", limiar: 1, fecha: "2026-09-14" })), "Faltam 1 dia ou menos · fecha em 14/09/2026");
  assert.equal(descrever(item("x", { tipo: "fechando", limiar: 3, fecha: "2026-09-14" })), "Faltam 3 dias ou menos · fecha em 14/09/2026");
  assert.equal(
    descrever(item("x", { tipo: "prazo_alterado", antes: "2026-09-30", depois: "2026-10-15", fecha: "2026-10-15" })),
    "Prazo mudou de 30/09/2026 para 15/10/2026",
  );
  assert.equal(formatarData("2026-09-14"), "14/09/2026");
});

const AGORA = new Date("2026-09-11T12:00:00Z");

test("agrupa por prazo em quatro cortes, com data absoluta no título", () => {
  const g = agruparPorPrazo(
    [
      item("a", { fecha: "2026-09-14" }),
      item("b", { fecha: "2026-09-30" }),
      item("c", { fecha: "2026-11-30" }),
      item("d", { fecha: "2027-03-01" }),
    ],
    AGORA,
  );
  assert.deepEqual(g.map((x) => x.id), ["ate7", "ate30", "ate90", "depois"]);
  assert.equal(g[0].titulo, "Fecha em até 7 dias · até 18/09/2026");
  assert.equal(g[3].titulo, "Fecha depois de 10/12/2026");
});

test("grupo sem item não aparece, e o mais longo nasce recolhido", () => {
  const g = agruparPorPrazo([item("a", { fecha: "2026-09-14" }), item("d", { fecha: "2027-03-01" })], AGORA);
  assert.deepEqual(g.map((x) => x.id), ["ate7", "depois"]);
  assert.equal(g[0].recolhido, false);
  assert.equal(g[1].recolhido, true);
});

test("o grupo conta as não lidas dele, não as da tela inteira", () => {
  const g = agruparPorPrazo(
    [
      item("a", { fecha: "2026-09-14" }),
      item("b", { fecha: "2026-09-15", lida_em: "2026-09-11T10:00:00Z" }),
      item("c", { fecha: "2027-01-01" }),
    ],
    AGORA,
  );
  assert.equal(g[0].itens.length, 2);
  assert.equal(g[0].naoLidas, 1);
});

test("a ordem recebida é preservada dentro do grupo", () => {
  const g = agruparPorPrazo([item("z", { fecha: "2026-09-13" }), item("a", { fecha: "2026-09-12" })], AGORA);
  assert.deepEqual(g[0].itens.map((i) => i.id), ["z", "a"]);
});

test("o código do programa sai da chave", () => {
  assert.deepEqual(codigosDaChave("emenda|Consórcio Público|09001,09002"), ["09001", "09002"]);
  assert.deepEqual(codigosDaChave("chave quebrada"), []);
});
