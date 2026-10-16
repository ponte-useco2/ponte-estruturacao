/**
 * Emendas estaduais da PB (E2, 16/10/2026): a lógica das telas, com um retrato sintético no formato das `epb_*`.
 * Deputados, credores e municípios fictícios; nenhum nome de servidor.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  URL_ASSEMBLEIA,
  VEZ_DEPOIS,
  anosDaAssembleia,
  anosDoDeputado,
  anosLidosTexto,
  deputadosDoRetrato,
  destinoDe,
  diasEntre,
  emendaDaUrl,
  emendasDoRetrato,
  emendasPbDaEntidade,
  emendasPbDoMunicipio,
  filaDoCiclo,
  grupoModalidade,
  mediana,
  pct,
  pessoaDoSlug,
  resumoDaFila,
  slugDaUrl,
  slugPessoa,
  urlDeputado,
  urlEmendaEpb,
  type CatalogoEpb,
  type DestinoEpb,
  type FichaEpb,
  type RetratoEpb,
} from "./emendas-pb.ts";

const HOJE = "2026-10-16";

function cat(emenda: string, pessoa: string, o: Partial<CatalogoEpb> = {}): CatalogoEpb {
  return {
    ano: Number(emenda.slice(5)),
    emenda,
    seq: 1,
    autor_publicado: `${pessoa} CIVIL`,
    pessoa,
    orgao: "SECRETARIA X",
    unidade: null,
    funcao: null,
    subfuncao: null,
    programa: null,
    acao: null,
    natureza: null,
    fonte_recurso: null,
    modalidade: "TRANSFERÊNCIAS A MUNICÍPIOS",
    elemento: null,
    valor_emenda: 100_000,
    empenhado: 100_000,
    liquidado: 100_000,
    pago: 100_000,
    ...o,
  };
}

function ficha(emenda: string, pessoa: string, o: Partial<FichaEpb> = {}): FichaEpb {
  return {
    ano: Number(emenda.slice(5)),
    emenda,
    prioridade: 1,
    deputado_publicado: pessoa,
    pessoa,
    autoria_divergente: false,
    no_catalogo: true,
    tipo: "IMPOSITIVA",
    secretaria: "SECRETARIA DE ESTADO DA SAÚDE",
    objeto: "Aquisição de equipamentos",
    retificacao_objeto: null,
    beneficiario_final: null,
    beneficiario_retido: false,
    tipo_entidade: null,
    valor: 100_000,
    passo: "paga",
    passo_em: null,
    devolvida: false,
    datas_fora_de_ordem: false,
    ...o,
  };
}

function dest(emenda: string, cnpj: string, ibge: string | null, o: Partial<DestinoEpb> = {}): DestinoEpb {
  return {
    ano: Number(emenda.slice(5)),
    emenda,
    credor_cnpj: cnpj,
    credor_nome: `CREDOR ${cnpj.slice(0, 4)}`,
    ibge,
    municipio: ibge === "2510808" ? "Patos" : ibge === "2507507" ? "João Pessoa" : null,
    orgao: "SECRETARIA X",
    empenhado: 100_000,
    liquidado: 100_000,
    pago: 100_000,
    notas: 1,
    primeira: "2025-06-10",
    ultima: "2025-06-10",
    ...o,
  };
}

const PREF_PATOS = "08939944000130";
const OSC_JP = "11111111000111";
const FORNECEDOR = "22222222000122";

/** DEP A: 3 emendas (município paga, entidade empenhada, direta no secretário da SEPLAG); DEP B: 1 paga em 2024. */
function retrato(): RetratoEpb {
  return {
    execucao: { id: 1, concluidaEm: "2026-10-16T14:55:43Z", dadoAte: "2026-10-16T14:52:57Z", referencia: HOJE, anosLidos: [2026, 2024, 2025] },
    catalogo: [
      cat("0001/2025", "DEP A"),
      cat("0002/2025", "DEP A", { modalidade: "TRANSFERÊNCIAS A INSTITUIÇÕES PRIVADAS SEM FINS LUCRATIVOS", empenhado: 80_000, pago: 20_000, liquidado: 20_000 }),
      cat("0003/2025", "DEP A", { modalidade: "APLICAÇÕES DIRETAS", empenhado: 0, pago: 0, liquidado: 0 }),
      cat("0010/2024", "DEP B", { valor_emenda: 50_000, empenhado: 50_000, pago: 50_000 }),
      // Uma emenda com duas classificações: a de maior valor dá a modalidade.
      cat("0011/2024", "DEP B", { seq: 1, valor_emenda: 10_000, empenhado: 0, pago: 0, modalidade: "APLICAÇÕES DIRETAS" }),
      cat("0011/2024", "DEP B", { seq: 2, valor_emenda: 30_000, empenhado: 30_000, pago: 30_000 }),
    ],
    fichas: [
      ficha("0001/2025", "DEP A"),
      ficha("0002/2025", "DEP A", { passo: "empenhada", passo_em: "2025-06-10", valor: 100_000 }),
      ficha("0003/2025", "DEP A", { passo: "sec_seplag", passo_em: "2025-02-20", devolvida: true }),
      ficha("0010/2024", "DEP B", { valor: 50_000 }),
      ficha("0011/2024", "DEP B", { valor: 40_000, passo: "empenhada", passo_em: "2024-05-01" }),
      // Só ficha (sem catálogo) e autoria divergente.
      ficha("0099/2026", "DEP B", { no_catalogo: false, passo: "envio", passo_em: "2026-10-01", autoria_divergente: true }),
    ],
    destinos: [
      dest("0001/2025", PREF_PATOS, "2510808"),
      dest("0002/2025", OSC_JP, "2507507", { empenhado: 80_000, pago: 20_000, liquidado: 20_000 }),
      dest("0010/2024", PREF_PATOS, "2510808", { empenhado: 50_000, pago: 50_000 }),
      dest("0011/2024", PREF_PATOS, "2510808", { empenhado: 30_000, pago: 30_000 }),
      // A aplicação direta de outro ano com fornecedor em Patos: não é destino de Patos.
      dest("0003/2025", FORNECEDOR, "2510808", { empenhado: 5_000, pago: 0 }),
    ],
    autores: [
      { pessoa: "DEP B", pessoa_fonte: "teste", grafias_catalogo: ["DEP B CIVIL"], grafias_ficha: ["DEP B"], emendas: 3, anos: [2024, 2026] },
      { pessoa: "DEP A", pessoa_fonte: "teste", grafias_catalogo: ["DEP A CIVIL"], grafias_ficha: ["DEP A"], emendas: 3, anos: [2025] },
      { pessoa: "DR. FULANO", pessoa_fonte: null, grafias_catalogo: [], grafias_ficha: ["DR. FULANO"], emendas: 0, anos: [] },
    ],
    pf: [{ ano: 2025, emenda: "0001/2025", empenhado: 7_000, pago: 7_000, notas: 2 }],
  };
}

test("endereços: slug da pessoa, ida e volta da emenda, formas inválidas", () => {
  assert.equal(slugPessoa("DR. ÉRICO"), "dr-erico");
  assert.equal(slugPessoa("Dra Jane Panta"), "dra-jane-panta");
  assert.equal(urlDeputado("DR. ERICO"), `${URL_ASSEMBLEIA}/dr-erico`);
  assert.equal(urlEmendaEpb("0075/2025"), `${URL_ASSEMBLEIA}/emenda/2025-0075`);
  assert.equal(emendaDaUrl("2025-0075"), "0075/2025");
  for (const x of ["2025-75", "0075/2025", "1999-0001", "", null, undefined, "2025-0075x"]) assert.equal(emendaDaUrl(x), null, String(x));
  assert.equal(slugDaUrl("dr-erico"), "dr-erico");
  for (const x of ["Dr-Erico", "-a", "a--b", "a b", "", null, "x".repeat(81)]) assert.equal(slugDaUrl(x), null, String(x));
  const r = retrato();
  assert.equal(pessoaDoSlug(r, "dr-fulano"), "DR. FULANO");
  assert.equal(pessoaDoSlug(r, "ninguem"), null);
});

test("os slugs dos 60 deputados da semente não colidem e não usam as rotas fixas", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const semente = path.resolve(import.meta.dirname, "..", "..", "..", "..", "emendas_pb", "seeds", "deputado_estadual.csv");
  if (!fs.existsSync(semente)) return; // no repositório publicado (o espelho de `web/`) a semente não existe
  const pessoas = [...new Set(fs.readFileSync(semente, "utf-8").trim().split(/\r?\n/).slice(1).map((l) => l.split(";")[2]))];
  const slugs = pessoas.map(slugPessoa);
  assert.equal(new Set(slugs).size, pessoas.length);
  for (const s of slugs) {
    assert.ok(slugDaUrl(s), s);
    assert.ok(!["fila", "emenda"].includes(s), s);
  }
});

test("modalidade: municípios, entidade, aplicação direta e o resto", () => {
  assert.equal(grupoModalidade("TRANSFERÊNCIAS A MUNICÍPIOS"), "municipios");
  assert.equal(grupoModalidade("TRANSFERÊNCIAS A INSTITUIÇÕES PRIVADAS SEM FINS LUCRATIVOS"), "entidades");
  assert.equal(grupoModalidade("APLICAÇÕES DIRETAS"), "direta");
  assert.equal(grupoModalidade("TRANSFERÊNCIAS A INSTITUIÇÕES PRIVADAS COM FINS LUCRATIVOS"), "outras");
  assert.equal(grupoModalidade("TRANSFERÊNCIAS À UNIÃO"), "outras");
  assert.equal(grupoModalidade(null), "outras");
});

test("a emenda junta catálogo, ficha e destino, sem somar catálogo com destino", () => {
  const e = new Map(emendasDoRetrato(retrato()).map((x) => [x.emenda, x]));
  assert.equal(e.size, 6, "união do catálogo e da ficha");
  const duas = e.get("0011/2024");
  assert.ok(duas);
  assert.deepEqual([duas.valorCatalogo, duas.valor, duas.empenhado, duas.modalidade], [40_000, 40_000, 30_000, "municipios"]);
  const soFicha = e.get("0099/2026");
  assert.ok(soFicha);
  assert.deepEqual([soFicha.noCatalogo, soFicha.temFicha, soFicha.valorCatalogo, soFicha.autoriaDivergente], [false, true, 0, true]);
  const um = e.get("0001/2025");
  assert.ok(um);
  // O catálogo (100 mil) e o destino (100 mil a PJ + 7 mil a PF) ficam lado a lado.
  assert.deepEqual([um.empenhado, um.destinoEmpenhado, um.pfEmpenhado], [100_000, 100_000, 7_000]);
});

test("deputados: por nome, com modalidade, municípios atendidos e o que está no caminho", () => {
  const ds = deputadosDoRetrato(retrato());
  assert.deepEqual(ds.map((d) => d.pessoa), ["DEP A", "DEP B", "DR. FULANO"]);
  const a = ds[0];
  assert.deepEqual([a.emendas, a.valor, a.empenhado, a.pago], [3, 300_000, 180_000, 120_000]);
  assert.deepEqual(a.porModalidade, { municipios: 100_000, entidades: 100_000, direta: 100_000, outras: 0 });
  // O fornecedor da aplicação direta em Patos não conta como município atendido.
  assert.deepEqual([a.municipios, a.entidades, a.noCaminho, a.devolvidas], [1, 1, 2, 1]);
  const b = ds[1];
  assert.deepEqual([b.emendas, b.anoMin, b.anoMax, b.municipios, b.noCaminho, b.divergentes], [3, 2024, 2026, 1, 2, 1]);
  const fora = ds[2];
  assert.deepEqual([fora.emendas, fora.fonte, fora.anoMin, fora.valor], [0, null, null, 0]);
});

test("fila: só o não pago, com os dias de hoje e a vez quando o dado diz", () => {
  const f = filaDoCiclo(retrato(), HOJE);
  assert.deepEqual(
    f.map((i) => [i.emenda, i.passo, i.dias, i.vez]),
    [
      ["0099/2026", "envio", 15, VEZ_DEPOIS.envio],
      ["0003/2025", "sec_seplag", diasEntre("2025-02-20", HOJE), "SEFAZ (cronograma)"],
      ["0002/2025", "empenhada", diasEntre("2025-06-10", HOJE), "Órgão executor (pagamento)"],
      ["0011/2024", "empenhada", diasEntre("2024-05-01", HOJE), "Órgão executor (pagamento)"],
    ],
  );
  const empenhada = f.find((i) => i.emenda === "0002/2025");
  assert.equal(empenhada?.faltaPagar, 60_000);
  assert.equal(f.find((i) => i.emenda === "0003/2025")?.devolvida, true);
  // Sem data no passo: sem dias e sem vez.
  const r = retrato();
  r.fichas = [ficha("0050/2025", "DEP A", { passo: "nenhum", passo_em: null })];
  assert.deepEqual(filaDoCiclo(r, HOJE).map((i) => [i.dias, i.vez]), [[null, null]]);
});

test("resumo da fila por passo, na ordem do caminho, com a mediana dos dias", () => {
  const res = resumoDaFila(filaDoCiclo(retrato(), HOJE));
  assert.deepEqual(res.map((x) => [x.passo, x.emendas]), [["envio", 1], ["sec_seplag", 1], ["empenhada", 2]]);
  assert.equal(mediana([1, 3, 10]), 3);
  assert.equal(mediana([1, 3]), 2);
  assert.equal(mediana([]), null);
});

test("ficha: o deputado ano a ano, com a Assembleia na mesma safra ao lado", () => {
  const emendas = emendasDoRetrato(retrato());
  const anos = anosDoDeputado(emendas, "DEP B");
  assert.deepEqual(anos.map((a) => [a.ano, a.emendas, a.valor, a.pago, a.pctPago, a.pctPagoAssembleia]), [
    [2024, 2, 90_000, 80_000, 88.9, 88.9],
    [2026, 1, 100_000, 0, 0, 0],
  ]);
  const a2025 = anosDoDeputado(emendas, "DEP A")[0];
  assert.deepEqual([a2025.pctPago, a2025.pctPagoAssembleia, a2025.noCaminho], [40, 40, 2]);
  assert.equal(pct(1, 0), null);
});

test("destino: municípios só pela transferência a municípios; credores com a modalidade; PF só somada", () => {
  const r = retrato();
  const emendas = emendasDoRetrato(r).filter((e) => e.pessoa === "DEP A");
  const d = destinoDe(r, emendas);
  assert.deepEqual(d.municipios.map((m) => [m.ibge, m.emendas, m.empenhado]), [["2510808", 1, 100_000]]);
  assert.deepEqual(
    d.credores.map((c) => [c.cnpj, c.modalidade, c.empenhado]),
    [
      [OSC_JP, "entidades", 80_000],
      [FORNECEDOR, "direta", 5_000],
      [PREF_PATOS, "municipios", 100_000],
    ].sort((x, y) => `CREDOR ${String(x[0]).slice(0, 4)}`.localeCompare(`CREDOR ${String(y[0]).slice(0, 4)}`, "pt-BR")),
  );
  assert.deepEqual(d.pf, { emendas: 1, empenhado: 7_000, pago: 7_000 });
  assert.equal(JSON.stringify(d.pf).includes("nome"), false);
});

test("município: prefeitura e fundo de um lado, entidades sediadas do outro, sem o fornecedor da aplicação direta", () => {
  const r = retrato();
  const patos = emendasPbDoMunicipio(r, "2510808");
  assert.deepEqual(patos.publico.emendas.map((e) => e.emenda), ["0010/2024", "0011/2024", "0001/2025"]);
  assert.deepEqual([patos.publico.empenhado, patos.publico.pago], [180_000, 180_000]);
  assert.deepEqual(patos.publico.porDeputado.map((x) => [x.pessoa, x.emendas]), [["DEP A", 1], ["DEP B", 2]]);
  assert.equal(patos.entidades.emendas.length, 0);
  const jp = emendasPbDoMunicipio(r, "2507507");
  assert.deepEqual([jp.publico.emendas.length, jp.entidades.emendas.map((e) => e.emenda)], [0, ["0002/2025"]]);
  // A entidade pelo CNPJ: o que ela recebeu como credora.
  const osc = emendasPbDaEntidade(r, OSC_JP);
  assert.deepEqual([osc.emendas.map((e) => [e.emenda, e.empenhadoAqui, e.pagoAqui]), osc.empenhado], [[["0002/2025", 80_000, 20_000]], 80_000]);
  assert.equal(emendasPbDaEntidade(r, "00000000000000").emendas.length, 0);
});

test("a Assembleia ano a ano, do mais novo ao mais velho, com o que falta pagar", () => {
  const anos = anosDaAssembleia(emendasDoRetrato(retrato()));
  assert.deepEqual(
    anos.map((a) => [a.ano, a.emendas, a.valor, a.pago, a.pctPago, a.naoPagas, a.valorNaoPago]),
    [
      [2026, 1, 100_000, 0, 0, 1, 100_000],
      [2025, 3, 300_000, 120_000, 40, 2, 180_000],
      [2024, 2, 90_000, 80_000, 88.9, 1, 10_000],
    ],
  );
});

test("os anos lidos, por extenso", () => {
  assert.equal(anosLidosTexto({ anosLidos: [2026, 2021, 2024] }), "2021 a 2026");
  assert.equal(anosLidosTexto({ anosLidos: [2025] }), "2025");
  assert.equal(anosLidosTexto({ anosLidos: [] }), "—");
});
