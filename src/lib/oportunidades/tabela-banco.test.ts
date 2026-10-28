/** O filtro das tabelas que vai à consulta (onda 15, fase 3, F3.2, 20/10/2026). */
import test from "node:test";
import assert from "node:assert/strict";
import { filtrarNoBanco, ordenarNoBanco, padraoContem, type CamposBanco, type ConsultaFiltravel } from "./tabela-banco.ts";
import type { EstadoTabela } from "./tabela-filtro.ts";

/** Uma consulta falsa que só anota as chamadas, na ordem. */
class Anotada implements ConsultaFiltravel<Anotada> {
  chamadas: string[] = [];
  private anota(s: string) {
    this.chamadas.push(s);
    return this;
  }
  filter(c: string, op: string, v: unknown) { return this.anota(`${c} ${op} ${String(v)}`); }
  gte(c: string, v: unknown) { return this.anota(`${c} >= ${String(v)}`); }
  lte(c: string, v: unknown) { return this.anota(`${c} <= ${String(v)}`); }
  in(c: string, v: readonly unknown[]) { return this.anota(`${c} in (${v.join("|")})`); }
  or(f: string) { return this.anota(`or ${f}`); }
  order(c: string, o: { ascending: boolean; nullsFirst?: boolean }) { return this.anota(`order ${c} ${o.ascending ? "asc" : "desc"}${o.nullsFirst === false ? " nulls last" : ""}`); }
}

const CAMPOS: CamposBanco = {
  nome: { coluna: "proponente", busca: "busca_proponente" },
  numero: { coluna: "nr_convenio" },
  cidade: { coluna: "municipio", curinga: true },
  pct: { coluna: "pct_desembolsado", escala: 100 },
  dias: { coluna: "dias_sem_movimento", ajuste: 3 },
  valor: { coluna: "repasse" },
  data: { coluna: "dt_assinatura" },
  lado: { coluna: "contas_lado", valores: { "Esperando análise do concedente": "concedente" } },
  orgao: { coluna: "orgao_sup" },
  especial: { coluna: "x", especial: (f) => (f.tipo === "texto" ? `a.eq.${f.contem}` : null) },
};

const estado = (filtros: EstadoTabela["filtros"], ordem: EstadoTabela["ordem"] = null): EstadoTabela => ({ filtros, ordem });

test("texto: um `like` por palavra na coluna sem acento; sem ela, `ilike`; curingas escapados", () => {
  assert.equal(padraoContem(String.raw`50%_a\b`), String.raw`%50\%\_a\\b%`);
  const q = filtrarNoBanco(
    new Anotada(),
    estado({ nome: { tipo: "texto", contem: "  Patos   SAÚDE " }, numero: { tipo: "texto", contem: "9001" } }),
    CAMPOS,
  );
  assert.deepEqual(q.chamadas, ["busca_proponente like %patos%", "busca_proponente like %saude%", "nr_convenio ilike %9001%"]);
});

test("número: escala com a meia unidade do arredondamento; ajuste dos dias; data e categoria", () => {
  const q = filtrarNoBanco(
    new Anotada(),
    estado({
      pct: { tipo: "numero", de: 30, ate: 50 },
      dias: { tipo: "numero", de: 368, ate: null },
      valor: { tipo: "numero", de: null, ate: 1_000_000 },
      data: { tipo: "data", de: "2024-01-01", ate: "2024-12-31" },
      lado: { tipo: "categoria", valores: ["esperando ANALISE do concedente"] },
      orgao: { tipo: "categoria", valores: ["MINISTERIO DA SAUDE", "MINISTERIO DAS CIDADES"] },
    }),
    CAMPOS,
  );
  assert.deepEqual(q.chamadas, [
    "pct_desembolsado >= 0.295",
    "pct_desembolsado <= 0.505",
    "dias_sem_movimento >= 365",
    "repasse <= 1000000",
    "dt_assinatura >= 2024-01-01",
    "dt_assinatura <= 2024-12-31",
    "contas_lado in (concedente)",
    "orgao_sup in (MINISTERIO DA SAUDE|MINISTERIO DAS CIDADES)",
  ]);
});

test("coluna sem campo e filtro vazio são ignorados; o especial vira `or`", () => {
  const q = filtrarNoBanco(
    new Anotada(),
    estado({ calculada: { tipo: "numero", de: 1, ate: 2 }, orgao: { tipo: "categoria", valores: [] }, especial: { tipo: "texto", contem: "z" } }),
    CAMPOS,
  );
  assert.deepEqual(q.chamadas, ["or a.eq.z"]);
});

test("ordem: a escolhida (vazio no fim) e a padrão como desempate, sem repetir a coluna", () => {
  const padrao = [{ coluna: "repasse", ascendente: false }, { coluna: "nr_convenio", ascendente: true }];
  assert.deepEqual(ordenarNoBanco(new Anotada(), estado({}, { coluna: "valor", sentido: "asc" }), CAMPOS, padrao).chamadas, [
    "order repasse asc nulls last",
    "order nr_convenio asc",
  ]);
  assert.deepEqual(ordenarNoBanco(new Anotada(), estado({}, { coluna: "data", sentido: "desc" }), CAMPOS, padrao).chamadas, [
    "order dt_assinatura desc nulls last",
    "order repasse desc",
    "order nr_convenio asc",
  ]);
  assert.deepEqual(ordenarNoBanco(new Anotada(), estado({}, { coluna: "especial", sentido: "asc" }), CAMPOS, padrao).chamadas, [
    "order repasse desc",
    "order nr_convenio asc",
  ], "o banco não ordena pelo especial: fica a padrão");
});

test("texto curto com curinga: vogal e c viram `_` (acha o nome com acento)", () => {
  const q = filtrarNoBanco(new Anotada(), estado({ cidade: { tipo: "texto", contem: "João Pessoa" } }), CAMPOS);
  assert.deepEqual(q.chamadas, ["municipio ilike %j___%", "municipio ilike %p_ss__%"]);
});

test("F3.5a: data sobre carimbo de tempo, o `até` vale o dia inteiro (antes do dia seguinte, com a virada do mês e do ano)", async () => {
  const { diaSeguinte } = await import("./tabela-banco.ts");
  assert.deepEqual([diaSeguinte("2026-10-31"), diaSeguinte("2026-12-31"), diaSeguinte("2028-02-28")], ["2026-11-01", "2027-01-01", "2028-02-29"]);
  const q = filtrarNoBanco(new Anotada(), estado({ dia: { tipo: "data", de: "2026-10-16", ate: "2026-10-16" } }), {
    dia: { coluna: "dado_ate", fimDoDia: true },
  });
  assert.deepEqual(q.chamadas, ["dado_ate >= 2026-10-16", "dado_ate lt 2026-10-17"]);
});
