import test from "node:test";
import assert from "node:assert/strict";
import { descreverTce, moedaExata, porMunicipio, riscoTceTcu, secaoTceTcu, tituloDebito, type LinhaTcePainel, type TceTcu } from "./tce-tcu.ts";

// A TCE do convênio 700102 como o job grava (e-TCE, 30/09/2026).
const tce = (x: Partial<TceTcu> = {}): TceTcu => ({
  nr_convenio: "700102", codigo: 2591, numero: "518", ano: 2018, situacao: "Processo autuado",
  origem_recursos: "Transferências discricionárias", motivo: "Não comprovação da regular aplicação dos recursos repassados pela União",
  submotivo: "Irregularidade na documentação exigida para a prestação de contas", iniciativa: "Órgão repassador / instaurador",
  dt_instauracao: "2018-01-03", dt_inicio_prazo: "2009-12-01", dt_prestacao_contas: null, dt_atualizacao_debito: "2020-04-14",
  debito_original: 103439.36, debito_sem_juros: 191529.82, debito_com_juros: 274114.28, numero_processo: "015.499/2020-0",
  url_processo: "https://contas.tcu.gov.br/etcu/AcompanharProcesso?p4=64338280", numero_acordao: null, origem_acordao: null,
  parecer_controle_interno: "Irregularidade", analise_boa_fe: false, ...x,
});
const consulta = (n_tce: number | null, erro: string | null = null) => ({ nr_convenio: "700102", situacao_convenio: null, cod_ibge: null, n_tce, erro });

test("moeda exata, com centavos", () => {
  assert.equal(moedaExata(103439.36), "R$ 103.439,36");
});

test("seção: com TCE, sem TCE, sem consulta e fora do universo", () => {
  const com = secaoTceTcu({ consulta: consulta(1), tces: [tce()], referencia: "2026-10-07" })!;
  assert.equal(com.estado, "com_tce");
  assert.equal(com.frase, "Há uma Tomada de Contas Especial deste convênio no e-TCE do TCU (consulta em 07/10/2026).");
  assert.equal(com.debitoOriginal, 103439.36);
  const sem = secaoTceTcu({ consulta: consulta(0), tces: [], referencia: "2026-10-07" })!;
  assert.equal(sem.estado, "sem_tce");
  assert.match(sem.frase, /^Nenhuma Tomada de Contas Especial/);
  const erro = secaoTceTcu({ consulta: consulta(null, "FonteIndisponivel: x"), tces: [], referencia: "2026-10-07" })!;
  assert.equal(erro.estado, "nao_consultado");
  assert.match(erro.frase, /não respondeu/);
  assert.equal(secaoTceTcu({ consulta: null, tces: [], referencia: null })!.estado, "nao_consultado");
  assert.equal(secaoTceTcu(null), null);
});

test("uma TCE numa linha", () => {
  assert.equal(
    descreverTce(tce()),
    'TCE nº 518/2018 instaurada em 03/01/2018 por "não comprovação da regular aplicação dos recursos repassados pela União", ' +
      "débito original de R$ 103.439,36 (R$ 274.114,28 com juros em 14/04/2020).",
  );
  assert.equal(descreverTce(tce({ numero: null, dt_instauracao: null, motivo: null, debito_com_juros: 103439.36 })), "TCE de 2018, débito original de R$ 103.439,36.");
  // TCE antiga sem o débito original (736581, Campina Grande): vale o atualizado, e o texto diz isso.
  const antiga = tce({ numero: null, dt_instauracao: null, motivo: null, debito_original: null, debito_com_juros: 3562508.9, dt_atualizacao_debito: "2017-04-12" });
  assert.equal(descreverTce(antiga), "TCE de 2018, débito de R$ 3.562.508,90 com juros em 12/04/2017 (o original não é informado).");
  assert.equal(tituloDebito(antiga), "Débito de R$ 3.562.508,90 com juros");
  assert.equal(tituloDebito(tce()), "Débito original de R$ 103.439,36");
  assert.match(riscoTceTcu({ consulta: consulta(1), tces: [antiga], referencia: null })!.fato, /^Débito de R\$ 3\.562\.508,90 com juros; processo/);
});

test("risco crítico só com TCE, com o processo e sem cara de julgamento", () => {
  const r = riscoTceTcu({ consulta: consulta(2), tces: [tce(), tce({ codigo: 9, numero: "30", debito_original: 10, debito_com_juros: 10, numero_processo: "032.242/2018-2" })], referencia: null })!;
  assert.equal(r.nivel, "critico");
  assert.equal(r.titulo, "2 Tomadas de Contas Especiais no TCU");
  assert.match(r.fato, /^Débito original de R\$ 103\.449,36, R\$ 274\.124,28 com juros; processo 015\.499\/2020-0, 032\.242\/2018-2 no TCU\./);
  assert.match(r.fato, /não é julgamento/);
  assert.equal(riscoTceTcu({ consulta: consulta(0), tces: [], referencia: null }), null);
  assert.equal(riscoTceTcu(undefined), null);
});

test("painel: por município, do maior débito com juros", () => {
  const l = (nr: string, municipio: string, com: number): LinhaTcePainel => ({
    ...tce({ nr_convenio: nr, debito_original: com / 2, debito_com_juros: com }), municipio, proponente: null, orgao_sup: null, situacao_convenio: null,
  });
  const m = porMunicipio([l("1", "SOUSA", 100), l("1", "SOUSA", 50), l("2", "PATOS", 400), l("3", "SOUSA", 10)]);
  assert.deepEqual(m.map((x) => [x.municipio, x.convenios, x.tces, x.debitoComJuros, x.temOriginal]), [["PATOS", 1, 1, 400, true], ["SOUSA", 2, 3, 160, true]]);
  const so = porMunicipio([{ ...l("9", "IMACULADA", 661), debito_original: null }]);
  assert.equal(so[0].temOriginal, false);
});
