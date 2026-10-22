/** As tabelas com filtro das listas do painel (onda 15, fase 3, F3.1a, 20/10/2026). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  TABELA_FICHA,
  TABELA_FICHA_MUDANCAS,
  TABELA_FICHA_PROPOSTAS,
  VISOES_CONVENIO,
  colunasDaVisao,
  colunasMudancas,
  colunasPropostas,
  ondeParou,
  pct100,
  valoresDaMudanca,
  valoresDaProposta,
  valoresDoConvenioPainel,
} from "./painel-tabelas.ts";
import type { MudancaPainel, PropostaPainel } from "./painel.ts";
import type { ConvenioPainel } from "./painel.server.ts";
import type { ColunaTabela } from "./tabela-filtro.ts";

const ID = /^[a-z0-9-]+$/;

function convenio(x: Partial<ConvenioPainel> = {}): ConvenioPainel {
  return {
    nr_convenio: "900001", uf: "PB", municipio: "Patos", cod_ibge: "2510808", proponente: "MUNICIPIO DE PATOS", tipo_agente: "municipio",
    orgao_sup: "MINISTERIO DAS CIDADES", programa: "Programa X", objeto: "Pavimentação", situacao: "Em execução", dt_assinatura: "2024-03-01",
    repasse: 1_000_000, empenhado: 900_000, desembolsado: 300_000, saldo_conta: 50_000, rendimento_implicito: 1_234, dt_ultimo_pagamento: null,
    dias_sem_movimento: 400, n_extensoes: 2, suspensiva_prazo: "2026-11-30", suspensiva_dias: 40, exige_titularidade: true, exige_projeto: true,
    exige_licenca: false, exige_sustentabilidade: null, exige_termo_referencia: false, grupo_suspensiva: null, etapa_licitacao: null,
    dt_aceite: null, aceite_parado: false, dt_fim_vigencia: "2027-01-15", dias_para_fim: 85, pct_desembolsado: 0.3, contas_lado: null,
    dias_apos_limite: null, dias_com_concedente: null, nunca_pagou: true, dt_ultima_movimentacao: "2025-09-01", dias_sem_movimentacao: 412,
    ultima_movimentacao_tipo: null, n_aditivos_vigencia: 1, motivo_aditivo: null, pct_fisico: 0, financeiro_sem_fisico: true, ...x,
  };
}

function conferir(nome: string, colunas: ColunaTabela[], valores: Record<string, unknown>) {
  assert.equal(new Set(colunas.map((c) => c.id)).size, colunas.length, `${nome}: ids únicos`);
  for (const c of colunas) {
    assert.match(c.id, ID, `${nome}.${c.id}`);
    assert.notEqual(c.id, "o", `${nome}: nenhuma coluna se chama "o"`);
    assert.notEqual(c.ordenavel, false, `${nome}.${c.id}: tela de administrador, toda coluna ordena`);
    assert.notEqual(c.filtravel, false, `${nome}.${c.id}: toda coluna filtra`);
    assert.ok(c.id in valores, `${nome}.${c.id}: o valor cru existe`);
  }
}

test("ids das tabelas da ficha: válidos e únicos", () => {
  const ids = [...Object.values(TABELA_FICHA), TABELA_FICHA_MUDANCAS, ...Object.values(TABELA_FICHA_PROPOSTAS)];
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, ID);
});

test("as seis visões: cada coluna tem o valor cru; a primeira é a nota do convênio; o número vai oculto e como texto no CSV", () => {
  for (const v of VISOES_CONVENIO) {
    for (const comMunicipio of [false, true]) {
      const colunas = colunasDaVisao(v, { comMunicipio });
      conferir(`${v}${comMunicipio ? "+municipio" : ""}`, colunas, valoresDoConvenioPainel(convenio(), v));
      assert.equal(colunas[0].id, "proponente");
      const nr = colunas.find((c) => c.id === "convenio");
      assert.ok(nr?.oculta && nr.textoNoCsv, `${v}: nº do convênio oculto e texto no CSV`);
      assert.equal(colunas.some((c) => c.id === "municipio"), comMunicipio, `${v}: o município só no painel`);
      // As visíveis vêm antes das ocultas (o desenho é o de antes; as ocultas só filtram).
      const primeiraOculta = colunas.findIndex((c) => c.oculta);
      assert.ok(colunas.slice(primeiraOculta).every((c) => c.oculta), `${v}: ocultas no fim`);
    }
  }
});

test("os valores crus: percentual de 0 a 100, exigências em palavras, a desembolsar nunca negativo, onde parou", () => {
  const c = convenio();
  assert.deepEqual(
    [valoresDoConvenioPainel(c, "suspensiva").exigencias, valoresDoConvenioPainel(c, "suspensiva").prazo],
    ["Projeto de engenharia · Titularidade da área", "2026-11-30"],
    "na ordem das etiquetas da tela",
  );
  assert.equal(valoresDoConvenioPainel(convenio({ exige_titularidade: false, exige_projeto: false }), "suspensiva").exigencias, null);
  assert.deepEqual([valoresDoConvenioPainel(c, "fisico")["desembolsado-pct"], valoresDoConvenioPainel(c, "fisico")["fisico-pct"]], [30, 0]);
  assert.equal(valoresDoConvenioPainel(convenio({ desembolsado: 2_000_000 }), "vigencia")["a-desembolsar"], 0);
  assert.equal(valoresDoConvenioPainel(c, "vigencia")["a-desembolsar"], 700_000);
  assert.equal(pct100(null), null);
  assert.equal(pct100(0.375), 38);
  assert.equal(ondeParou({ etapa_licitacao: null, grupo_suspensiva: null }), null);
  assert.equal(valoresDoConvenioPainel(c, "contas").lado, null);
  assert.equal(valoresDoConvenioPainel(convenio({ contas_lado: "concedente" }), "contas").lado, "Esperando análise do concedente");
});

test("as mudanças e as propostas: cada coluna tem o valor cru; a data do dado é o dia", () => {
  const m: MudancaPainel = {
    dado_ate_anterior: "2026-10-15T12:00:00Z", dado_ate: "2026-10-16T12:00:00Z", alvo: "proposta", tipo: "desfecho", chave: "123",
    numero: "1/2026", uf: "PB", cod_ibge: "2510808", municipio: "Patos", proponente: "X", tipo_agente: "municipio", orgao_sup: "MS",
    programa: "P", objeto: "O", antes: null, depois: null, valor: 10,
  };
  for (const opcoes of [{}, { comData: true }, { comMunicipio: true, comData: true }]) conferir("mudancas", colunasMudancas(opcoes), valoresDaMudanca(m));
  assert.deepEqual([valoresDaMudanca(m).dia, valoresDaMudanca(m).alvo, valoresDaMudanca(m).numero], ["2026-10-16", "Proposta", "1/2026"]);

  const p: PropostaPainel = {
    id_proposta: "77", nr_proposta: "1/2026", proponente: "X", tipo_agente: "municipio", orgao_sup: "MS", cod_programa: "(sem programa)",
    programa: null, objeto: null, valor_repasse: 100, com_emenda: false, dt_envio: "2026-02-01", ano_envio: 2026, desfecho: "assinada",
    em_lote: false, limbo: false, situacao: null, dt_ultimo_evento: "2026-05-01T10:00:00Z", dias_sem_evento: 120, dt_assinatura: "2026-05-01",
    nr_convenio: "900002",
  };
  for (const q of ["movimento", "assinatura"] as const) conferir(`propostas-${q}`, colunasPropostas(q), valoresDaProposta(p, q));
  assert.equal(valoresDaProposta(p, "assinatura")["cod-programa"], null, "o '(sem programa)' do banco vira vazio");
  assert.equal(valoresDaProposta(p, "movimento").movimento, "2026-05-01");
  assert.equal(valoresDaProposta(p, "assinatura").situacao, "Assinada");
});

test("a ficha usa as tabelas com filtro, sem caixa de rolagem dupla, e lê até 300 linhas por lista", () => {
  const raiz = path.resolve(import.meta.dirname, "..", "..", "app", "mapa", "painel");
  const ficha = fs.readFileSync(path.join(raiz, "FichaMunicipio.tsx"), "utf-8");
  for (const peca of ["TabelaSuspensiva", "TabelaNunca", "TabelaVigencia", "TabelaContas", "TabelaSaldo", "TabelaFisico", "TabelaMudancas", "TabelaPropostas"]) {
    assert.equal(new RegExp(`<${peca}\\b`).test(ficha), false, `a ficha não desenha mais <${peca}>`);
  }
  assert.match(ficha, /<TabelaDaVisao\b/);
  assert.match(ficha, /<TabelaDasMudancas\b/);
  assert.equal((ficha.match(/<TabelaDasPropostas\b/g) ?? []).length, 3);
  assert.equal((ficha.match(/semRolagem/g) ?? []).length, 3, "as três listas de propostas sem a caixa que rola por fora");
  const servidor = fs.readFileSync(path.resolve(import.meta.dirname, "painel.server.ts"), "utf-8");
  for (const limite of ["LIMITE_FICHA_CONVENIOS", "LIMITE_FICHA_PROPOSTAS", "LIMITE_FICHA_RECENTES", "LIMITE_FICHA_MUDANCAS"]) {
    assert.match(servidor, new RegExp(`export const ${limite} = 300;`), limite);
  }
});

test("F3.2, o painel: toda coluna que filtra ou ordena no banco tem campo; as exceções são as calculadas", async () => {
  const { camposDoConvenio, colunasNoBanco, TABELA_PAINEL, TABELA_PAINEL_VENCIDOS } = await import("./painel-tabelas.ts");
  const campos = camposDoConvenio(2);
  for (const v of VISOES_CONVENIO) {
    for (const c of colunasNoBanco(v)) {
      if (c.filtravel === false && c.ordenavel === false) continue;
      assert.ok(campos[c.id], `${v}.${c.id}: tem campo no banco`);
    }
    assert.ok(colunasNoBanco(v).some((c) => c.id === "municipio"), `${v}: o município entra no painel`);
  }
  const vig = colunasNoBanco("vigencia").find((c) => c.id === "a-desembolsar");
  assert.deepEqual([vig?.filtravel, vig?.ordenavel], [false, false], "calculada na tela: sem filtro e sem ordem");
  assert.equal(colunasNoBanco("contas").find((c) => c.id === "situacao")?.tipo, "texto");
  assert.equal(new Set([...Object.values(TABELA_PAINEL), TABELA_PAINEL_VENCIDOS]).size, 7);
});

test("F3.2: exigências e 'onde parou' no banco; o texto que não acha nada não deixa passar nada", async () => {
  const { camposDoConvenio } = await import("./painel-tabelas.ts");
  const campos = camposDoConvenio(0);
  const ex = campos.exigencias.especial!;
  assert.equal(ex({ tipo: "texto", contem: "licença" }), "exige_licenca.eq.true");
  assert.equal(ex({ tipo: "texto", contem: "plano" }), "exige_sustentabilidade.eq.true");
  assert.equal(ex({ tipo: "texto", contem: "xyz" }), "nr_convenio.is.null");
  assert.equal(ex({ tipo: "texto", contem: "  " }), null);
  const op = campos["onde-parou"].especial!;
  assert.equal(op({ tipo: "categoria", valores: ["nada disso"] }), "nr_convenio.is.null");
  assert.equal(op({ tipo: "categoria", valores: [] }), null);
  assert.equal(campos.parado.ajuste, 0);
  assert.equal(camposDoConvenio(5)["sem-movimento"].ajuste, 5, "os dias da tela contam até hoje");
});

test("F3.2: o estado das tabelas no endereço e o CSV de uma tabela com o mesmo filtro", async () => {
  const { estadosDaVisao, urlCsvDaTabela, parametrosDaPagina } = await import("./painel-tabelas.ts");
  const q = parametrosDaPagina({ visao: "suspensiva", "t.painel-suspensiva.repasse": "1000000..", "t.painel-suspensiva-vencidos.o": "repasse.desc", uf: ["PB"] });
  const e = estadosDaVisao("suspensiva", q);
  assert.deepEqual(e.lista?.filtros.repasse, { tipo: "numero", de: 1_000_000, ate: null });
  assert.deepEqual(e.vencidos?.ordem, { coluna: "repasse", sentido: "desc" });
  assert.deepEqual(estadosDaVisao("mudancas", q), {}, "visão sem tabela de convênio");
  const url = urlCsvDaTabela("/mapa/painel/exportar?visao=suspensiva&uf=PB", "painel-suspensiva", e.lista!);
  const lida = new URL(url, "http://x").searchParams;
  assert.deepEqual([lida.get("visao"), lida.get("uf"), lida.get("tabela"), lida.get("t.painel-suspensiva.repasse")], ["suspensiva", "PB", "painel-suspensiva", "1000000.."]);
});

test("F3.2: o painel usa a lista com o filtro no banco, e as peças antigas das visões saíram", () => {
  const raiz = path.resolve(import.meta.dirname, "..", "..", "app", "mapa", "painel");
  const painel = fs.readFileSync(path.join(raiz, "PainelConteudo.tsx"), "utf-8");
  assert.equal((painel.match(/<ListaDaVisao\b/g) ?? []).length, 6);
  const pecas = fs.readFileSync(path.join(raiz, "Pecas.tsx"), "utf-8");
  for (const peca of ["TabelaSuspensiva", "TabelaNunca", "TabelaVigencia", "TabelaContas", "TabelaSaldo", "TabelaFisico"]) {
    assert.equal(new RegExp(`function ${peca}\b`).test(pecas), false, peca);
  }
  const pagina = fs.readFileSync(path.join(raiz, "page.tsx"), "utf-8");
  assert.ok(pagina.indexOf("ehAdministrador(") < pagina.indexOf("await lerPainel"), "confere o administrador antes de ler");
});

test("F3.3, municípios com sinais: cada coluna tem o valor cru e o campo no banco; os sinais acesos por palavra", async () => {
  const { COLUNAS_MUNICIPIOS, CAMPOS_MUNICIPIO, valoresDoMunicipioPainel, estadosDaVisao, parametrosDaPagina } = await import("./painel-tabelas.ts");
  const m = {
    cod_ibge: "2510808", uf: "PB", municipio: "Patos", n_sinais: 2, sinal_saldo: true, n_saldo: 3, valor_saldo: 500_000, sinal_suspensiva: false,
    n_suspensiva: 0, valor_suspensiva: 0, sinal_contas_atrasadas: true, n_contas_atrasadas: 4, sinal_contas_negativas: false, n_contas_negativas: 0,
    sinal_sem_desembolso: false, n_sem_desembolso: 0, valor_sem_desembolso: 0,
  };
  const v = valoresDoMunicipioPainel(m);
  for (const c of COLUNAS_MUNICIPIOS) {
    assert.ok(c.id in v, c.id);
    assert.ok(CAMPOS_MUNICIPIO[c.id], `${c.id}: tem campo no banco`);
  }
  assert.deepEqual([v.quais, v.saldo, v.suspensivas], ["Saldo parado · Contas atrasadas", 500_000, null]);
  const quais = CAMPOS_MUNICIPIO.quais.especial!;
  assert.equal(quais({ tipo: "texto", contem: "contas" }), "sinal_contas_atrasadas.eq.true,sinal_contas_negativas.eq.true");
  assert.equal(quais({ tipo: "texto", contem: "nada" }), "cod_ibge.is.null");
  assert.deepEqual(estadosDaVisao("municipios", parametrosDaPagina({ "t.painel-municipios.sinais": "3.." })).lista?.filtros.sinais, { tipo: "numero", de: 3, ate: null });
});
