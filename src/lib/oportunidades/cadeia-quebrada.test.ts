import test from "node:test";
import assert from "node:assert/strict";
import { divergenciasDoManifesto, montarCadeia, semReferenciaInterna, type ExecucaoCq, type LinhaCq } from "./cadeia-quebrada.ts";

const ex = (contagens: Record<string, unknown> = {}): ExecucaoCq => ({
  id: 1,
  concluida_em: "2026-10-29T21:00:00Z",
  dado_ate: "2026-10-29T00:00:00Z",
  sha256_pacote: "cf5500cd17d59bd45db5adef73024238477edc4e0b2a9ef0d7db89e6673657e0",
  versao_pacote: "1",
  gerado_em: "2026-10-29T20:58:58",
  regra_versao: "1.1",
  regra_fecha: "ato contratual do próprio órgão pagador com o CNPJ",
  limiar_precisao: "90% estrito",
  contagens,
  cobertura: { notas_empenho: { orgaos: ["CEHAP", "EMPAER", "FAPESQ", "SECTIES", "UEPB"] }, sancoes: { fornecedores_consultados: 4365 } },
  regra_alcance: {
    versao: "1.1",
    regras: {
      federal: { classe: "não alcança", motivo: "impedimento/suspensão federal só vale na União", base_legal: "Lei 14.133/2021, art. 156, §4º" },
      inidoneidade: { classe: "alcança", motivo: "declaração de inidoneidade vale para todos os entes", base_legal: "Lei 14.133/2021, art. 156, §5º" },
      rompimento: { classe: "sai", motivo: "a cadeia funcionou", base_legal: "ato de rompimento" },
    },
  },
});

const l = (conjunto: string, ordem: number, situacao: string, pares: number, pago: number | string | null, fecha = false, orgao: string | null = null): LinhaCq => ({
  conjunto,
  ordem,
  orgao,
  situacao,
  confianca: fecha ? "alta" : null,
  soma_como_fecha: fecha,
  pares,
  pago,
});

const LINHAS = [
  l("notas", 2, "nome em ato do próprio órgão, sem CNPJ (a conferir)", 213, "146019335.0"),
  l("notas", 1, "fecha: CNPJ em ato do próprio órgão", 305, 210997859.07, true),
  l("notas", 3, "nada no Diário: ponto para olhar", 506, 53089926.79),
  l("notas_orgao", 1, "fecha: CNPJ em ato do próprio órgão", 91, 1, true, "CEHAP"),
  l("emendas", 1, "CNPJ em ato contratual do Diário", 278, 113298574.93),
  l("emendas", 2, "credor público (prefeitura, consórcio, estatal): transferência, fora", 233, 357893839.11),
  l("sancoes_classe", 1, "alcança", 1, null),
  l("sancoes_classe", 2, "não alcança", 335, null),
  l("sancoes_classe", 3, "sai", 2, null),
];

test("montarCadeia: três blocos em ordem, só a linha marcada soma como fecha, sem os recortes por órgão", () => {
  const c = montarCadeia(ex(), LINHAS);
  // A linha que fecha primeiro; o resto do maior número de pares ao menor.
  assert.deepEqual(c.notas.linhas.map((x) => x.pares), [305, 506, 213]);
  assert.equal(c.notas.pares, 1024);
  assert.equal(c.notasFecham, 305, "o 'nome… (a conferir)' não soma como fecha");
  assert.equal(c.notas.linhas[2].pago, 146019335, "o numeric do PostgREST pode vir como texto");
  assert.equal(c.emendas.pares, 511);
  assert.equal(c.sancoes.pares, 338);
  assert.equal(c.orgaosNotas, 5);
  assert.equal(c.fornecedoresConsultados, 4365);
  // Nenhum nome de órgão nos blocos da página (o recorte por órgão fica fora).
  assert.doesNotMatch(JSON.stringify([c.notas, c.emendas, c.sancoes]), /CEHAP/);
  // A regra em ordem: alcança, não alcança, sai.
  assert.deepEqual(c.regras.map((r) => r.classe), ["alcança", "não alcança", "sai"]);
  assert.ok(Math.abs(c.notas.linhas.reduce((s, x) => s + x.fatia, 0) - 1) < 1e-9);
});

test("divergenciasDoManifesto: confere as contagens da página com as do manifesto gravado", () => {
  const certo = ex({ notas_pares: 1024, notas_fecham: 305, emendas_pares: 511, sancoes_brutos: 338 });
  assert.deepEqual(divergenciasDoManifesto(certo, montarCadeia(certo, LINHAS)), []);
  const errado = ex({ notas_pares: 1359, notas_fecham: 305, emendas_pares: 511, sancoes_brutos: 338 });
  assert.deepEqual(divergenciasDoManifesto(errado, montarCadeia(errado, LINHAS)), ["notas_pares: manifesto 1359, página 1024"]);
});

test("montarCadeia sem linhas: blocos vazios, sem divisão por zero", () => {
  const c = montarCadeia({ ...ex(), cobertura: {}, regra_alcance: {} }, []);
  assert.equal(c.notas.pares, 0);
  assert.deepEqual(c.notas.linhas, []);
  assert.equal(c.orgaosNotas, 0);
  assert.equal(c.fornecedoresConsultados, null);
  assert.deepEqual(c.regras, []);
});

test("semReferenciaInterna tira o código do plano do texto do pacote", () => {
  assert.equal(semReferenciaInterna("ato contratual do próprio órgão, de 3 anos antes do 1º empenho ao último (PUB-04b: 20/20)"), "ato contratual do próprio órgão, de 3 anos antes do 1º empenho ao último");
  assert.equal(semReferenciaInterna(null), "");
});

test("descida (30/10/2026): rótulo sem nome de órgão, endereços de cada nível e origem dos dados", async () => {
  const m = await import("./cadeia-quebrada.ts");
  assert.equal(m.rotuloSituacao("CNPJ nos chamamentos da CEHAP (site, fora do Diário)"), "CNPJ em chamamento publicado só no site do órgão (fora do Diário)");
  assert.equal(m.rotuloSituacao("nada no Diário: ponto para olhar"), "nada no Diário: ponto para olhar");
  assert.equal(m.rotuloSituacao("CNPJ em ato contratual do Diário"), "CNPJ em ato contratual do Diário (qualquer órgão; precisão não medida)");
  assert.equal(m.urlSituacao("notas", "nada no Diário: ponto para olhar"), "/mapa/cadeia-quebrada/notas?s=nada+no+Di%C3%A1rio%3A+ponto+para+olhar");
  assert.match(m.urlSituacao("notas", "x", "UEPB"), /\?s=x&o=UEPB$/);
  assert.equal(m.urlCnpjCadeia("12721072000107"), "/mapa/cadeia-quebrada/cnpj/12721072000107");
  assert.equal(m.cnpjDaUrl("12.721.072/0001-07"), "12721072000107");
  assert.equal(m.cnpjDaUrl("123"), null);
  assert.equal(m.cnpjLegivelCq("12721072000107"), "12.721.072/0001-07");
  assert.equal(m.blocoDaUrl("notas"), "notas");
  assert.equal(m.blocoDaUrl("outro"), null);
  assert.equal(m.situacaoDosCasos("sancoes", "alcança"), "sanção alcança");
  assert.equal(m.situacaoDosCasos("notas", "x"), "x");
  assert.match(m.urlDaLei("Lei 14.133/2021, art. 156, §4º") ?? "", /planalto\.gov\.br.*l14133/);
  assert.match(m.urlDaLei("Lei 8.429/1992, art. 12") ?? "", /l8429/);
  assert.equal(m.urlDaLei("ato de rompimento"), null);
  assert.ok(m.origensDoCnpj("12721072000107").every((o) => o.url.startsWith("https://")));
  assert.ok(Object.values(m.FONTES_CQ).every((f) => f.url.startsWith("https://")));
});

test("casosPorOrgao soma por órgão e ordena pelo valor; motivosDaClasse segue a regra da geração", async () => {
  const m = await import("./cadeia-quebrada.ts");
  const caso = (orgao: string | null, pago: number) => ({ ordem: 1, teste: "notas_empenho", situacao: "s", cnpj: "1".repeat(14), orgao, pago, notas: 1, anos: [], link_diario: null, tipo_ato: null, data_ato: null, motivo: null, sancao: null });
  assert.deepEqual(m.casosPorOrgao([caso("UEPB", 10), caso("CEHAP", 50), caso("UEPB", 45), caso(null, 1)]), [
    { chave: "UEPB", pares: 2, pago: 55 },
    { chave: "CEHAP", pares: 1, pago: 50 },
    { chave: "órgão não informado", pares: 1, pago: 1 },
  ]);
  const motivos = [
    l("sancoes_motivo", 1, "declaração de inidoneidade vale para todos os entes", 1, null),
    l("sancoes_motivo", 2, "impedimento/suspensão federal só vale na União", 54, null),
  ];
  assert.deepEqual(m.motivosDaClasse(ex(), motivos, "não alcança"), [{ chave: "impedimento/suspensão federal só vale na União", pares: 54, pago: null }]);
  assert.deepEqual(m.motivosDaClasse(ex(), motivos, "alcança").map((x) => x.pares), [1]);
});
