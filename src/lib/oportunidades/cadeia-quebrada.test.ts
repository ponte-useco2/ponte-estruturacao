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
