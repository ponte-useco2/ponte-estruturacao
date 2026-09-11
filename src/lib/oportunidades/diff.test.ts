import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { calcularDiff, chaveJanela, type EstadoProcessado, type TipoMudanca } from "./diff.ts";
import type { Oportunidade, Payload } from "./contrato";

function janela(codigo: string, extra: Partial<Oportunidade> = {}): Oportunidade {
  return {
    id: `id-${codigo}`,
    programa: `Programa ${codigo}`,
    orgao: "Ministério",
    natureza: "Convênio",
    canal: "proposta",
    situacao: "DISPONIBILIZADO",
    fecha: "2026-09-30",
    dias_restantes: 20,
    urgente: false,
    nova: false,
    aderente: false,
    temas: [],
    codigos: [codigo],
    propostas_recebidas: 0,
    ...extra,
  };
}

function publicacao(gerado_em: string, oportunidades: Oportunidade[]): Payload {
  return {
    versao: "1.1",
    gerado_em,
    uf: "PB",
    origem: { repositorio: "", modulo: "", atualizada_em: null, defasagem_dias: null, defasada: false },
    resumo: { abertas: oportunidades.length, urgentes: 0, aderentes: 0, novas: 0, propostas_recentes: 0, encerradas: 0 },
    filtros: { naturezas: [], canais: [], orgaos: [] },
    oportunidades,
    propostas_recentes: [],
    encerradas: [],
  };
}

function base(p: Payload): EstadoProcessado {
  return calcularDiff(null, p).proximoEstado;
}

const tipos = (r: { mudancas: { tipo: TipoMudanca }[] }) => r.mudancas.map((m) => m.tipo);

test("primeira execução vira linha de base e não notifica ninguém", () => {
  const r = calcularDiff(null, publicacao("2026-09-01T12:00:00", [janela("A"), janela("B")]));
  assert.equal(r.linhaDeBase, true);
  assert.deepEqual(r.mudancas, []);
});

test("janela que não existia é nova", () => {
  const estado = base(publicacao("2026-09-01T12:00:00", [janela("A")]));
  const r = calcularDiff(estado, publicacao("2026-09-02T12:00:00", [janela("A"), janela("B")]));
  assert.deepEqual(tipos(r), ["nova"]);
  assert.equal(r.mudancas[0].programa, "Programa B");
});

test("prorrogação não vira encerrada mais nova, mesmo com o id do contrato mudando", () => {
  const antes = janela("A", { id: "a-0930", fecha: "2026-09-30", dias_restantes: 20 });
  const depois = janela("A", { id: "a-1015", fecha: "2026-10-15", dias_restantes: 35 });
  assert.notEqual(antes.id, depois.id, "o cenário só prova algo se o id mudar");

  const r = calcularDiff(base(publicacao("2026-09-10T12:00:00", [antes])), publicacao("2026-09-11T12:00:00", [depois]));
  assert.deepEqual(tipos(r), ["prazo_alterado"]);
  assert.equal(r.mudancas[0].antes, "2026-09-30");
  assert.equal(r.mudancas[0].depois, "2026-10-15");
});

test("cruzar 7, 3 e 1 dia ao longo de 21 publicações gera exatamente três avisos", () => {
  const dia = (i: number) => `2026-09-${String(i + 1).padStart(2, "0")}T12:00:00`;
  let estado = base(publicacao(dia(0), [janela("A", { fecha: "2026-09-22", dias_restantes: 21 })]));
  const cruzados: number[] = [];
  for (let i = 1; i <= 21; i++) {
    const r = calcularDiff(estado, publicacao(dia(i), [janela("A", { fecha: "2026-09-22", dias_restantes: 21 - i })]));
    for (const m of r.mudancas) if (m.tipo === "fechando") cruzados.push(m.limiar!);
    estado = r.proximoEstado;
  }
  assert.deepEqual(cruzados, [7, 3, 1]);
});

test("salto de vários dias numa só publicação gera um aviso por marca cruzada", () => {
  const estado = base(publicacao("2026-09-01T12:00:00", [janela("A", { dias_restantes: 8 })]));
  const r = calcularDiff(estado, publicacao("2026-09-07T12:00:00", [janela("A", { dias_restantes: 2 })]));
  assert.deepEqual(r.mudancas.map((m) => m.limiar), [7, 3]);
});

test("janela nova que já chega perto do prazo gera só 'nova'", () => {
  const estado = base(publicacao("2026-09-01T12:00:00", [janela("A")]));
  const r = calcularDiff(estado, publicacao("2026-09-02T12:00:00", [janela("A"), janela("B", { dias_restantes: 2 })]));
  assert.deepEqual(tipos(r), ["nova"]);
});

test("situação diferente da publicação anterior é situacao_mudou", () => {
  const estado = base(publicacao("2026-09-01T12:00:00", [janela("A", { situacao: "DISPONIBILIZADO" })]));
  const r = calcularDiff(estado, publicacao("2026-09-02T12:00:00", [janela("A", { situacao: "EM ANÁLISE" })]));
  assert.deepEqual(tipos(r), ["situacao_mudou"]);
  assert.equal(r.mudancas[0].depois, "EM ANÁLISE");
});

test("reprocessar a mesma publicação não gera nada", () => {
  const p1 = publicacao("2026-09-02T12:00:00", [janela("A"), janela("B")]);
  const r1 = calcularDiff(base(publicacao("2026-09-01T12:00:00", [janela("A")])), p1);
  assert.deepEqual(tipos(r1), ["nova"]);
  const r2 = calcularDiff(r1.proximoEstado, p1);
  assert.deepEqual(r2.mudancas, []);
});

test("publicação mais antiga que o estado não gera nada nem retrocede o estado", () => {
  const p0 = publicacao("2026-09-01T12:00:00", [janela("A")]);
  const estado = calcularDiff(base(p0), publicacao("2026-09-02T12:00:00", [janela("B")])).proximoEstado;
  const r = calcularDiff(estado, p0);
  assert.deepEqual(r.mudancas, []);
  assert.equal(r.proximoEstado, estado);
});

test("sair no prazo é encerrada; sair antes do prazo é removida e deixa a publicação suspeita", () => {
  const estado = base(publicacao("2026-09-06T12:00:00", [
    janela("A", { fecha: "2026-09-05" }),
    janela("B", { fecha: "2026-09-30" }),
  ]));
  const r = calcularDiff(estado, publicacao("2026-09-07T12:00:00", []));
  assert.deepEqual(tipos(r), ["encerrada", "removida"]);
  assert.match(r.suspeita ?? "", /1 janela/);
});

test("encerramento em lote no prazo não é suspeito", () => {
  const vencidas = ["A", "B", "C", "D", "E"].map((c) => janela(c, { fecha: "2026-09-06", dias_restantes: 0 }));
  const r = calcularDiff(base(publicacao("2026-09-06T12:00:00", vencidas)), publicacao("2026-09-07T12:00:00", []));
  assert.equal(r.mudancas.filter((m) => m.tipo === "encerrada").length, 5);
  assert.equal(r.suspeita, null);
});

test("janela que saiu e voltou é reaberta, não nova", () => {
  const t0 = base(publicacao("2026-09-01T12:00:00", [janela("A", { fecha: "2026-09-01" })]));
  const t1 = calcularDiff(t0, publicacao("2026-09-02T12:00:00", [])).proximoEstado;
  const r = calcularDiff(t1, publicacao("2026-09-03T12:00:00", [janela("A", { fecha: "2026-09-20" })]));
  assert.deepEqual(tipos(r), ["reaberta"]);
});

test("a chave ignora a ordem dos códigos", () => {
  const comum = { canal: "proposta" as const, natureza: "Convênio" };
  assert.equal(chaveJanela({ ...comum, codigos: ["2", "1"] }), chaveJanela({ ...comum, codigos: ["1", "2"] }));
});

test("chave duplicada na mesma publicação falha alto em vez de sumir com uma janela", () => {
  const p = publicacao("2026-09-01T12:00:00", [janela("A", { id: "x" }), janela("A", { id: "y" })]);
  assert.throws(() => calcularDiff(null, p), /duplicada/);
});

// ---------------------------------------------------------------------------
// Dados reais. Faixa FIXA: o HEAD do site importado por subtree em 10/09/2026.
// Commits são imutáveis, então os números abaixo não mudam com o tempo — e
// foram conferidos à parte, contra o mesmo histórico, antes deste teste existir.
// ---------------------------------------------------------------------------

const RAIZ = fileURLToPath(new URL("../../../../", import.meta.url));
const ATE = "06bacbb";

function historicoReal(): Payload[] | null {
  try {
    const git = (args: string[], input?: string) =>
      execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", input, maxBuffer: 1 << 26, stdio: ["pipe", "pipe", "ignore"] });
    const commits = git(["rev-list", ATE]).trim().split(/\r?\n/);
    const saida = git(["cat-file", "--batch-check"], commits.map((c) => `${c}:src/dados/oportunidades.json`).join("\n") + "\n");
    const blobs = [...new Set(saida.split(/\r?\n/).map((l) => l.split(" ")).filter((p) => p[1] === "blob").map((p) => p[0]))];
    return blobs
      .map((b) => JSON.parse(git(["cat-file", "-p", b])) as Payload)
      .sort((a, b) => (a.gerado_em < b.gerado_em ? -1 : 1));
  } catch {
    return null;
  }
}

const historico = historicoReal();

test(
  "dados reais: a chave não colide, prorrogação não vira nova, e o encerramento em lote de 07/09 não é suspeito",
  { skip: historico === null ? "histórico git indisponível" : false },
  () => {
    const h = historico!;
    assert.equal(h.length, 12);

    let estado = calcularDiff(null, h[0]).proximoEstado;
    let prorrogacoes = 0;
    for (const p of h.slice(1)) {
      const r = calcularDiff(estado, p);

      const porChave = new Map<string, Set<TipoMudanca>>();
      for (const m of r.mudancas) {
        if (!porChave.has(m.chave)) porChave.set(m.chave, new Set());
        porChave.get(m.chave)!.add(m.tipo);
      }
      for (const [chave, t] of porChave) {
        if (!t.has("prazo_alterado")) continue;
        prorrogacoes++;
        assert.ok(!t.has("nova") && !t.has("encerrada"), `prorrogação virou nova/encerrada: ${chave}`);
      }

      if (p.gerado_em.startsWith("2026-09-07")) {
        const n = (tipo: TipoMudanca) => r.mudancas.filter((m) => m.tipo === tipo).length;
        assert.equal(n("encerrada"), 15, "as 15 janelas de 07/09 fecharam no prazo");
        assert.equal(n("removida"), 0);
        assert.equal(r.suspeita, null, "encerramento em lote no prazo não é defeito de dado");
      }
      estado = r.proximoEstado;
    }
    assert.equal(prorrogacoes, 4, "o histórico tem 4 prorrogações que o id do contrato transformaria em encerrada + nova");
  },
);
