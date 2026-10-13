import test from "node:test";
import assert from "node:assert/strict";
import {
  COLUNAS_ENVIOS_PB,
  COLUNAS_PARADOS,
  COLUNAS_RECORTE_PROGRAMA,
  TABELAS_RADAR,
  colunasDisputa,
  enderecoDaOrdemAntiga,
  instanteBrasilia,
  janela24hTocaFimDeSemana,
  moedaCurta,
  parametrosRadar,
  rotuloTipo,
  urlRadar,
  valoresDaDisputa,
  valoresDoEnvio,
  valoresDoParado,
  valoresDoRecorte,
  variacao,
} from "./radar.ts";
import { aplicar, csvDaTabela, idValido, lerEstado, type ColunaTabela, type LinhaTabela } from "./tabela-filtro.ts";

test("variação com base: delta e percentual", () => {
  const v = variacao(1178, 2466);
  assert.equal(v.delta, -1288);
  assert.equal(v.percentual, -52);
  assert.equal(v.sentido, "caiu");
  assert.equal(v.texto, "−1288 (−52%)");
});

test("variação sem base não inventa percentual", () => {
  const v = variacao(7, 0);
  assert.equal(v.percentual, null);
  assert.equal(v.texto, "+7 (antes: 0)");
});

test("variação igual", () => {
  assert.equal(variacao(5, 5).texto, "igual ao período anterior");
});

test("parâmetros válidos passam; inválidos caem no padrão", () => {
  assert.deepEqual(parametrosRadar({ uf: "pb", dias: "7", categoria: "revisada" }), {
    uf: "PB",
    dias: 7,
    categoria: "revisada",
    canal: null,
    tipo: null,
    ordemAntiga: null,
  });
  assert.deepEqual(parametrosRadar({ uf: "XX", dias: "5", categoria: "drop", ordem: "programa.inventada.asc" }), {
    uf: null,
    dias: 30,
    categoria: "nova",
    canal: null,
    tipo: null,
    ordemAntiga: null,
  });
  assert.deepEqual(parametrosRadar({}), { uf: null, dias: 30, categoria: "nova", canal: null, tipo: null, ordemAntiga: null });
  const filtrado = parametrosRadar({ canal: "emenda_parlamentar", tipo: "osc" });
  assert.deepEqual([filtrado.canal, filtrado.tipo], ["emenda_parlamentar", "osc"]);
  const inventado = parametrosRadar({ canal: "pix", tipo: "prefeitura" });
  assert.deepEqual([inventado.canal, inventado.tipo], [null, null], "valor fora da lista não chega ao banco");
  // O `?ordem=` de antes da onda 15 só é lido para redirecionar (onda 15, fase 2, lote D, 13/10/2026).
  assert.deepEqual(parametrosRadar({ ordem: "programa.valor.asc" }).ordemAntiga, { tabela: "programa", coluna: "valor", sentido: "asc" });
  assert.deepEqual(parametrosRadar({ ordem: "pb.valor.seja-o-que-for" }).ordemAntiga, { tabela: "pb", coluna: "valor", sentido: "desc" });
  assert.equal(parametrosRadar({ ordem: "constructor.valor.asc" }).ordemAntiga, null, "nome de propriedade do objeto não passa");
});

test("a URL omite o que é padrão", () => {
  const base = { uf: null, dias: 30 as const, categoria: "nova" as const, canal: null, tipo: null, ordemAntiga: null };
  assert.equal(urlRadar(base, {}), "/mapa/radar");
  assert.equal(urlRadar(base, { uf: "PB" }), "/mapa/radar?uf=PB");
  assert.equal(urlRadar({ ...base, uf: "PB" }, { dias: 7 }), "/mapa/radar?uf=PB&dias=7");
  assert.equal(urlRadar({ ...base, uf: "PB" }, { uf: null }), "/mapa/radar");
  assert.equal(urlRadar(base, { ordemAntiga: { tabela: "disputa", coluna: "valor", sentido: "asc" } }), "/mapa/radar", "o ?ordem= antigo nunca sai daqui");
  assert.equal(urlRadar(base, { canal: "voluntaria", tipo: "municipio" }), "/mapa/radar?canal=voluntaria&tipo=municipio");
  assert.equal(urlRadar({ ...base, canal: "voluntaria" }, { canal: null }), "/mapa/radar", "o chip Todos tira o filtro");
});

test("janela de 24h que toca o fim de semana, no horário de Brasília", () => {
  // O caso real: o último dado era de sábado, 12/09/2026, 22h51 em Brasília.
  assert.equal(janela24hTocaFimDeSemana("2026-09-12T22:51:08-03:00"), true);
  // Quarta 10/09, 15h: a janela vai de terça a quarta.
  assert.equal(janela24hTocaFimDeSemana("2026-09-09T15:00:00-03:00"), false);
  // Segunda 14/09, 02h: a janela começa no domingo.
  assert.equal(janela24hTocaFimDeSemana("2026-09-14T02:00:00-03:00"), true);
  // Sexta 22h em Brasília já é sábado em UTC — e não pode contar como fim de semana.
  assert.equal(janela24hTocaFimDeSemana("2026-09-11T22:00:00-03:00"), false);
});

test("moeda curta", () => {
  assert.equal(moedaCurta(1_250_000), "R$ 1,3 mi");
  assert.equal(moedaCurta(350_000), "R$ 350 mil");
  assert.equal(moedaCurta(2_100_000_000), "R$ 2,1 bi");
  assert.equal(moedaCurta(10_943_345_439_000), "R$ 10,9 tri", "o PIB do Brasil, em mil R$ × 1000");
  assert.equal(moedaCurta(900), "R$ 900");
  assert.equal(moedaCurta(null), "—");
});

test("tipo de proponente desconhecido vira Outro", () => {
  assert.equal(rotuloTipo("municipio"), "Município");
  assert.equal(rotuloTipo("qualquer"), "Outro");
});

// ============================ tabelas (onda 15, fase 2, lote D, 13/10/2026) ============================

const P_BASE = { uf: null, dias: 30 as const, categoria: "nova" as const, canal: null, tipo: null, ordemAntiga: null };

function conferirColunas(nome: string, colunas: ColunaTabela[], primeira: string) {
  const ids = colunas.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, `${nome}: ids únicos`);
  for (const id of ids) assert.ok(idValido(id), `${nome}: ${id}`);
  assert.ok(colunas.every((c) => c.ordenavel !== false && c.filtravel !== false), `${nome}: tela de administrador, toda coluna filtra e ordena`);
  assert.equal(colunas.find((c) => !c.oculta)?.id, primeira, `${nome}: a primeira coluna visível é o cabeçalho da linha`);
}

test("tabelas do radar: ids válidos e únicos, prefixos válidos, toda coluna filtra e ordena", () => {
  for (const id of Object.values(TABELAS_RADAR)) assert.ok(idValido(id), id);
  conferirColunas("programa", COLUNAS_RECORTE_PROGRAMA, "programa");
  conferirColunas("disputa Brasil", colunasDisputa(true), "programa");
  conferirColunas("disputa UF", colunasDisputa(false), "programa");
  conferirColunas("pb", COLUNAS_ENVIOS_PB, "proponente");
  conferirColunas("parados", COLUNAS_PARADOS, "municipio");
  assert.ok(colunasDisputa(true).some((c) => c.id === "ufs"), "no Brasil, a coluna UFs");
  assert.ok(!colunasDisputa(false).some((c) => c.id === "ufs"), "numa UF, sem ela");
  for (const [colunas, valores] of [
    [COLUNAS_RECORTE_PROGRAMA, valoresDoRecorte({ chave: "1", rotulo: "P", atual: 1, anterior: 0, valor_atual: 1 })],
    [colunasDisputa(true), valoresDaDisputa(DISPUTA)],
    [COLUNAS_ENVIOS_PB, valoresDoEnvio(ENVIO)],
    [COLUNAS_PARADOS, valoresDoParado(PARADO)],
  ] as const) {
    assert.deepEqual(Object.keys(valores).sort(), colunas.map((c) => c.id).sort(), "um valor por coluna");
  }
});

const DISPUTA = {
  cod_programa: "3600020260001",
  programa: "Pavimentação",
  orgao: "Ministério das Cidades",
  canal: "emenda_parlamentar",
  abre: "2026-09-01",
  fecha: "2026-10-30",
  dias_restantes: 17,
  ufs: 12,
  novas_desde_abertura: 40,
  novas_30d: 31,
  valor_pedido: "1250000.50",
};

const ENVIO = {
  id_proposta: "123456",
  cod_ibge: "2510808",
  cod_programa: "3600020260001",
  categoria: "em_revisao" as const,
  ocorrido_em: "2026-10-13T02:30:00+00:00",
  proponente: "Município de Patos",
  municipio: "Patos",
  tipo_agente: "municipio",
  programa: "Pavimentação",
  canal: "voluntaria",
  valor_repasse: 350000,
};

const PARADO = { cod_ibge: "2500106", municipio: "Água Branca", novas_30d: 0, em_revisao_30d: 2, revisadas_30d: 0, ultimo_envio: "2026-08-01T13:00:00Z" };

test("valores crus: rótulos humanos nas categorias, número como número, a hora de Brasília no instante", () => {
  const d = valoresDaDisputa(DISPUTA);
  assert.equal(d.canal, "Emenda parlamentar");
  assert.equal(d.valor, 1250000.5, "o numeric que chega como texto vira número");
  assert.equal(d.codigo, "3600020260001");
  assert.equal(valoresDaDisputa({ ...DISPUTA, orgao: "  ", valor_pedido: null }).orgao, null);
  const e = valoresDoEnvio(ENVIO);
  assert.equal(e.quando, "2026-10-12T23:30", "23h30 de 12/10 em Brasília, e não 13/10 de UTC");
  assert.equal(e.categoria, "Em revisão");
  assert.equal(e.tipo, "Município");
  assert.equal(e.canal, "Proposta voluntária");
  assert.equal(valoresDoEnvio({ ...ENVIO, canal: null, tipo_agente: null }).canal, null);
  const r = valoresDoRecorte({ chave: "36000", rotulo: null, atual: 7, anterior: 0, valor_atual: 10 });
  assert.deepEqual([r.programa, r.variacao, r["variacao-pct"]], ["36000", 7, null], "sem base, sem percentual");
  assert.equal(valoresDoParado(PARADO)["ultimo-envio"], "2026-08-01T10:00");
  assert.equal(valoresDoParado({ ...PARADO, ultimo_envio: null })["ultimo-envio"], null);
});

test("instante em Brasília: data pura passa, lixo vira null", () => {
  assert.equal(instanteBrasilia("2026-10-12"), "2026-10-12");
  assert.equal(instanteBrasilia("2026-10-12T15:00:00-03:00"), "2026-10-12T15:00");
  assert.equal(instanteBrasilia("ontem"), null);
  assert.equal(instanteBrasilia(null), null);
});

test("lista da PB: o filtro de data vê o dia de Brasília; o CSV leva a hora", () => {
  const linhas: LinhaTabela[] = [ENVIO, { ...ENVIO, id_proposta: "2", ocorrido_em: "2026-10-13T12:00:00Z", municipio: "Sousa" }].map((e, i) => ({
    chave: String(i),
    valores: valoresDoEnvio(e),
    celulas: {},
  }));
  const dia12 = aplicar(COLUNAS_ENVIOS_PB, linhas, lerEstado("pb", COLUNAS_ENVIOS_PB, new URLSearchParams("t.pb.quando=2026-10-12..2026-10-12")));
  assert.deepEqual(dia12.map((l) => l.valores.municipio), ["Patos"]);
  const sousa = aplicar(COLUNAS_ENVIOS_PB, linhas, lerEstado("pb", COLUNAS_ENVIOS_PB, new URLSearchParams("t.pb.municipio=sousa")));
  assert.deepEqual(sousa.map((l) => l.valores.proposta), ["2"], "a coluna oculta do município filtra");
  const csv = csvDaTabela(COLUNAS_ENVIOS_PB, linhas);
  assert.match(csv, /2026-10-12T23:30/);
  assert.match(csv, /"=""123456"""/, "o número da proposta sai como texto");
});

test("o ?ordem= antigo redireciona para a ordem da tabela nova, com o mesmo recorte", () => {
  const p = parametrosRadar({ uf: "PB", dias: "7", ordem: "disputa.desde_abertura.asc" });
  const destino = enderecoDaOrdemAntiga(p);
  assert.equal(destino, "/mapa/radar?uf=PB&dias=7&t.disputa.o=desde-abertura.asc");
  const sp = new URLSearchParams(destino.split("?")[1]);
  assert.deepEqual(lerEstado("disputa", colunasDisputa(false), sp).ordem, { coluna: "desde-abertura", sentido: "asc" }, "a tabela nova lê a ordem");
  assert.equal(enderecoDaOrdemAntiga(parametrosRadar({ ordem: "parados.ultimo_envio.desc" })), "/mapa/radar?t.parados.o=ultimo-envio.desc");
  assert.equal(enderecoDaOrdemAntiga(parametrosRadar({ ordem: "programa.rotulo.asc" })), "/mapa/radar?t.programa.o=programa.asc");
  // "Por canal" virou resumo, sem ordem: o link antigo cai no recorte, sem a ordem.
  assert.equal(enderecoDaOrdemAntiga(parametrosRadar({ canal: "voluntaria", ordem: "canal.valor.desc" })), "/mapa/radar?canal=voluntaria");
  assert.equal(enderecoDaOrdemAntiga(P_BASE), "/mapa/radar");
  for (const [tabela, colunas] of [
    ["programa", COLUNAS_RECORTE_PROGRAMA],
    ["disputa", colunasDisputa(true)],
    ["pb", COLUNAS_ENVIOS_PB],
    ["parados", COLUNAS_PARADOS],
  ] as const) {
    // Toda coluna antiga cai numa coluna nova que existe.
    const antigas: Record<string, string[]> = {
      programa: ["rotulo", "atual", "anterior", "variacao", "valor"],
      disputa: ["programa", "canal", "desde_abertura", "trinta_dias", "valor", "faltam", "ufs"],
      pb: ["quando", "proponente", "categoria", "programa", "canal", "valor"],
      parados: ["municipio", "em_revisao", "revisadas", "ultimo_envio"],
    };
    for (const antiga of antigas[tabela]) {
      const url = enderecoDaOrdemAntiga(parametrosRadar({ ordem: `${tabela}.${antiga}.desc` }));
      const ordem = lerEstado(tabela, colunas, new URLSearchParams(url.split("?")[1] ?? "")).ordem;
      assert.ok(ordem && ordem.sentido === "desc", `${tabela}.${antiga} → ${url}`);
    }
  }
});
