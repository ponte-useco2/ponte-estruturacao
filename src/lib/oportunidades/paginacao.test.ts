import { test } from "node:test";
import assert from "node:assert/strict";
import { compararPor, lerPorChave, type RespostaPagina } from "./paginacao.ts";

type Linha = { nr: string; v?: number | null };

/** Banco de mentira: guarda as linhas ordenadas pela chave e responde como `.gt(chave).order(chave).limit(n)`. */
function banco(chaves: string[]) {
  const linhas = [...chaves].sort().map((nr) => ({ nr }));
  const pedidos: (string | null)[] = [];
  const consulta = async (depois: string | null, tamanho: number): Promise<RespostaPagina> => {
    pedidos.push(depois);
    const resto = depois === null ? linhas : linhas.filter((l) => l.nr > depois);
    return { data: resto.slice(0, tamanho), error: null };
  };
  return { consulta, pedidos };
}

const numeros = (n: number) => Array.from({ length: n }, (_, i) => String(100000 + i));

test("lerPorChave: lê todas as páginas, cada uma depois da última chave da anterior", async () => {
  const b = banco(numeros(7));
  const r = await lerPorChave<Linha>((l) => l.nr, b.consulta, { pagina: 3 });
  assert.ok("linhas" in r);
  assert.deepEqual(r.linhas.map((l) => l.nr), numeros(7));
  assert.equal(r.truncado, false);
  assert.deepEqual(b.pedidos, [null, "100002", "100005"]);
});

test("lerPorChave: página exata pede mais uma e termina na vazia", async () => {
  const b = banco(numeros(6));
  const r = await lerPorChave<Linha>((l) => l.nr, b.consulta, { pagina: 3 });
  assert.ok("linhas" in r);
  assert.equal(r.linhas.length, 6);
  assert.deepEqual(b.pedidos, [null, "100002", "100005"]);
});

test("lerPorChave: sem linhas devolve lista vazia numa chamada só", async () => {
  const b = banco([]);
  const r = await lerPorChave<Linha>((l) => l.nr, b.consulta);
  assert.deepEqual(r, { linhas: [], truncado: false });
  assert.equal(b.pedidos.length, 1);
});

test("lerPorChave: no teto para e marca truncado, como a paginação por faixa", async () => {
  const b = banco(numeros(10));
  const r = await lerPorChave<Linha>((l) => l.nr, b.consulta, { pagina: 3, teto: 6 });
  assert.ok("linhas" in r);
  assert.equal(r.linhas.length, 6);
  assert.equal(r.truncado, true);
});

test("lerPorChave: erro da API volta como erro, sem as linhas já lidas", async () => {
  let chamadas = 0;
  const r = await lerPorChave<Linha>(
    (l) => l.nr,
    async () => (++chamadas === 2 ? { data: null, error: { message: "tempo esgotado", code: "57014" } } : { data: [{ nr: "1" }, { nr: "2" }], error: null }),
    { pagina: 2 },
  );
  assert.deepEqual(r, { erro: { message: "tempo esgotado", code: "57014" } });
});

test("lerPorChave: consulta que ignora o filtro não prende num laço infinito", async () => {
  const r = await lerPorChave<Linha>((l) => l.nr, async () => ({ data: [{ nr: "1" }, { nr: "2" }], error: null }), { pagina: 2 });
  assert.ok("erro" in r);
  assert.match(r.erro.message, /não avançou/);
});

test("compararPor: crescente põe nulos no fim; decrescente, no começo (padrão do Postgres)", () => {
  const linhas: Linha[] = [{ nr: "a", v: 2 }, { nr: "b", v: null }, { nr: "c", v: 1 }];
  const cresc = [...linhas].sort(compararPor<Linha>([{ coluna: "v", ascendente: true }]));
  assert.deepEqual(cresc.map((l) => l.nr), ["c", "a", "b"]);
  const decr = [...linhas].sort(compararPor<Linha>([{ coluna: "v", ascendente: false }]));
  assert.deepEqual(decr.map((l) => l.nr), ["b", "a", "c"]);
});

test("compararPor: nulosPrimeiro explícito vale nos dois sentidos", () => {
  const linhas: Linha[] = [{ nr: "a", v: 2 }, { nr: "b", v: null }, { nr: "c", v: 1 }];
  const ascNulosAntes = [...linhas].sort(compararPor<Linha>([{ coluna: "v", ascendente: true, nulosPrimeiro: true }]));
  assert.deepEqual(ascNulosAntes.map((l) => l.nr), ["b", "c", "a"]);
  const descNulosDepois = [...linhas].sort(compararPor<Linha>([{ coluna: "v", ascendente: false, nulosPrimeiro: false }]));
  assert.deepEqual(descNulosDepois.map((l) => l.nr), ["a", "c", "b"]);
});

test("compararPor: desempata pelo critério seguinte; booleano decrescente põe true antes", () => {
  type L = { parado: boolean | null; aceite: string | null; nr: string };
  const linhas: L[] = [
    { parado: false, aceite: "2024-01-10", nr: "000003" },
    { parado: true, aceite: null, nr: "000002" },
    { parado: true, aceite: "2023-05-01", nr: "000004" },
    { parado: false, aceite: "2024-01-10", nr: "000001" },
  ];
  // A ordem de "nunca desembolsado" do painel, com o número no fim.
  const ordem = compararPor<L>([
    { coluna: "parado", ascendente: false },
    { coluna: "aceite", ascendente: true, nulosPrimeiro: false },
    { coluna: "nr", ascendente: true },
  ]);
  assert.deepEqual([...linhas].sort(ordem).map((l) => l.nr), ["000004", "000002", "000001", "000003"]);
});

test("compararPor: números comparam como números, não como texto", () => {
  const linhas = [{ nr: "x", v: 10 }, { nr: "y", v: 9 }, { nr: "z", v: 100 }];
  assert.deepEqual([...linhas].sort(compararPor([{ coluna: "v", ascendente: false }])).map((l) => l.nr), ["z", "x", "y"]);
});

test("compararPor: número de convênio com letras segue a ordem do banco (dígitos antes das maiúsculas)", () => {
  const linhas = [{ nr: "1AADQZ" }, { nr: "999999" }, { nr: "100000" }, { nr: "1AAAAA" }];
  assert.deepEqual([...linhas].sort(compararPor([{ coluna: "nr", ascendente: true }])).map((l) => l.nr), ["100000", "1AAAAA", "1AADQZ", "999999"]);
});
