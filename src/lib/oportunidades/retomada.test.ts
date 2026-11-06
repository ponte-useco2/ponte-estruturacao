import test from "node:test";
import assert from "node:assert/strict";
import { pontosRetomada, processosComSaldo, secaoRetomada, situacoesDoResumo, valoresDaObraRetomada, type ObraRetomada } from "./retomada.ts";

const HOJE = "2026-11-05";

const obra = (x: Partial<ObraRetomada>): ObraRetomada => ({
  obrid: 1,
  ibge: "2511004",
  municipio: "Pedra Branca",
  nome: "Escola A",
  ente_cnpj: "08884836000163",
  ente_nome: "PREFEITURA",
  situacao_obra: "Em Execução",
  situacao_cadastro: "Execução",
  situacao_pedido: "Deferido",
  situacao_repactuacao: "Obra aprovada",
  vez_util: null,
  dt_ultimo_passo: "2026-06-01",
  n_diligencias: 0,
  termo: "T1",
  termo_vigencia: "2027-12-31",
  termo_situacao: "Vigente",
  tipo_projeto: "Escola 6 Salas",
  valor_pactuado: 1000,
  valor_repassado: 500,
  dt_ultimo_repasse: "2026-05-01",
  saldo_processo: null,
  saldo_data: null,
  saldo_banco: null,
  processo: null,
  processo_cnpj: null,
  pct_executado: 40,
  dt_vistoria: "2026-09-01",
  dt_os: null,
  dt_inicio_execucao: null,
  ...x,
});

test("o saldo é do processo: duas obras com o mesmo extrato somam uma vez", () => {
  const ps = processosComSaldo(
    [
      obra({ obrid: 1, processo: "P1", processo_cnpj: "1", saldo_processo: 50_000, saldo_data: "2026-09-25" }),
      obra({ obrid: 2, processo: "P1", processo_cnpj: "1", saldo_processo: 50_000, saldo_data: "2026-09-25" }),
      obra({ obrid: 3, processo: "P2", processo_cnpj: "1", saldo_processo: 500, saldo_data: "2026-09-25" }),
    ],
    HOJE,
  );
  assert.equal(ps.length, 1, "o saldo abaixo do piso de R$ 1.000 fica fora");
  assert.equal(ps[0].saldo, 50_000);
  assert.equal(ps[0].obras.length, 2);
  assert.equal(secaoRetomada([obra({ processo: "P1", processo_cnpj: "1", saldo_processo: 50_000 }), obra({ obrid: 2, processo: "P1", processo_cnpj: "1", saldo_processo: 50_000 })], null, HOJE).saldo, 50_000);
});

test("saldo recente sem obra em andamento é alto; extrato antigo e processo misto são só informação", () => {
  const s = secaoRetomada(
    [
      obra({ obrid: 1, nome: "Quadra", situacao_obra: "Obra Cancelada", processo: "P1", processo_cnpj: "1", saldo_processo: 80_000, saldo_data: "2026-09-25" }),
      obra({ obrid: 2, nome: "Creche", situacao_obra: "Paralisada", processo: "P2", processo_cnpj: "1", saldo_processo: 9_000, saldo_data: "2019-01-31" }),
      obra({ obrid: 3, nome: "Escola", situacao_obra: "Paralisada", processo: "P3", processo_cnpj: "1", saldo_processo: 7_000, saldo_data: "2026-09-25" }),
      obra({ obrid: 4, nome: "Escola 2", situacao_obra: "Em Execução", processo: "P3", processo_cnpj: "1", saldo_processo: 7_000, saldo_data: "2026-09-25" }),
    ],
    "2026-11-01",
    HOJE,
  );
  const p = pontosRetomada(s, HOJE);
  const alto = p.find((x) => x.nivel === "alto" && /saldo/.test(x.titulo));
  assert.ok(alto);
  assert.match(alto.fato, /R\$ 80\.000,00/);
  assert.match(alto.fato, /Quadra/);
  assert.equal(alto.classe, "cobranca");
  assert.ok(p.some((x) => x.nivel === "informativo" && /extrato antigo/.test(x.titulo)));
  assert.ok(p.some((x) => x.nivel === "informativo" && /obra parada e obra em andamento/.test(x.titulo)));
});

test("cadastro 'Inacabada' de antes da retomada não para a obra; saldo depois da obra concluída é moderado", () => {
  const p = pontosRetomada(
    secaoRetomada(
      [
        obra({ obrid: 1, nome: "Em obra", situacao_obra: "Em Execução", situacao_cadastro: "Inacabada - PC Técnica Concluída", processo: "P1", processo_cnpj: "1", saldo_processo: 50_000, saldo_data: "2026-06-13" }),
        obra({ obrid: 2, nome: "Quadra", situacao_obra: "Concluída", situacao_repactuacao: "Obra desvinculada", processo: "P2", processo_cnpj: "1", saldo_processo: 3_198.37, saldo_data: "2026-09-26" }),
      ],
      null,
      HOJE,
    ),
    HOJE,
  );
  assert.ok(!p.some((x) => x.nivel === "alto"), "nenhum saldo alto: uma obra anda e a outra está concluída");
  const m = p.find((x) => /concluída/.test(x.titulo));
  assert.equal(m?.nivel, "moderado");
  assert.match(m?.fato ?? "", /R\$ 3\.198,37.*Quadra \(concluída\)/);
});

test("vigência: vence em até 90 dias com prazo; vencida com obra em andamento; concluída não conta", () => {
  const p = pontosRetomada(
    secaoRetomada(
      [
        obra({ obrid: 1, termo_vigencia: "2026-12-20" }),
        obra({ obrid: 2, termo_vigencia: "2026-10-01" }),
        obra({ obrid: 3, situacao_obra: "Concluída", termo_vigencia: "2026-01-01" }),
      ],
      null,
      HOJE,
    ),
    HOJE,
  );
  const perto = p.find((x) => /90 dias/.test(x.titulo));
  assert.equal(perto?.prazo, "2026-12-20");
  assert.match(p.find((x) => /vencida/.test(x.titulo))?.titulo ?? "", /1 obra\)/);
});

test("a vez do município só com o pedido aberto; FNDE ou nulo não gera ponto", () => {
  const p = pontosRetomada(secaoRetomada([obra({ vez_util: "Ente", dt_ultimo_passo: "2026-10-01" }), obra({ obrid: 2, vez_util: "FNDE" })], null, HOJE), HOJE);
  const d = p.filter((x) => /diligência/.test(x.titulo));
  assert.equal(d.length, 1);
  assert.match(d[0].titulo, /1 obra\)/);
});

test("licitação longa depois do deferimento e vistoria antiga", () => {
  const p = pontosRetomada(
    secaoRetomada(
      [
        obra({ obrid: 1, situacao_obra: "Em Licitação", dt_ultimo_passo: "2025-12-01", dt_vistoria: null }),
        obra({ obrid: 2, situacao_obra: "Em Licitação", dt_ultimo_passo: "2026-09-01" }),
        // com ordem de serviço, a licitação já acabou
        obra({ obrid: 4, situacao_obra: "Em Licitação", dt_ultimo_passo: "2024-04-04", dt_os: "2026-03-27" }),
        obra({ obrid: 3, situacao_obra: "Em Execução", dt_vistoria: "2024-05-01" }),
      ],
      null,
      HOJE,
    ),
    HOJE,
  );
  assert.match(p.find((x) => /licitação/.test(x.titulo))?.titulo ?? "", /1 obra\)/);
  // a obra em licitação não tem canteiro: não entra na vistoria
  assert.match(p.find((x) => /vistoria/.test(x.titulo))?.fato ?? "", /em 01\/05\/2024\.$/);
});

test("sem ponto alto nem moderado: em dia; sem obra: nada", () => {
  assert.deepEqual(pontosRetomada(secaoRetomada([], null, HOJE), HOJE), []);
  const p = pontosRetomada(secaoRetomada([obra({}), obra({ obrid: 2, situacao_repactuacao: "Obra desvinculada", situacao_obra: "Obra Cancelada" })], null, HOJE), HOJE);
  assert.ok(p.some((x) => x.nivel === "em_dia"));
  assert.ok(p.some((x) => x.nivel === "informativo" && /desvinculada/.test(x.titulo)));
});

test("ausência fica nula: soma sem valor não vira zero", () => {
  const s = secaoRetomada([obra({ valor_pactuado: null, valor_repassado: null })], null, HOJE);
  assert.equal(s.pactuado, null);
  assert.equal(valoresDaObraRetomada(obra({ pct_executado: null })).executado, null);
});

test("situações do resumo da UF em ordem alfabética", () => {
  assert.deepEqual(
    situacoesDoResumo({ por_situacao: { Paralisada: { obras: 3, pactuado: 10, repassado: 1 }, Concluída: { obras: 23, pactuado: 5, repassado: 5 } } }).map((x) => x.situacao),
    ["Concluída", "Paralisada"],
  );
});
