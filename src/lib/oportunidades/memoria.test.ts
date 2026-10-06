import { test } from "node:test";
import assert from "node:assert/strict";
import { criarMemoria } from "./memoria.ts";

function relogio(inicio = 0) {
  let t = inicio;
  return { agora: () => t, andar: (ms: number) => (t += ms) };
}

test("memória: dentro da validade não lê de novo; depois dela, lê", async () => {
  const r = relogio();
  const m = criarMemoria<string>({ validadeMs: 1000, maximo: 5, agora: r.agora });
  let leituras = 0;
  const carregar = async () => `valor ${++leituras}`;
  assert.equal(await m.obter("patos", carregar), "valor 1");
  r.andar(999);
  assert.equal(await m.obter("patos", carregar), "valor 1");
  r.andar(1);
  assert.equal(await m.obter("patos", carregar), "valor 2", "venceu: lê de novo");
  assert.equal(leituras, 2);
});

test("memória: dois pedidos ao mesmo tempo dividem uma leitura", async () => {
  const m = criarMemoria<number>({ validadeMs: 1000, maximo: 5 });
  let leituras = 0;
  let soltar: (v: number) => void = () => {};
  const carregar = () => {
    leituras++;
    return new Promise<number>((ok) => (soltar = ok));
  };
  const a = m.obter("patos", carregar);
  const b = m.obter("patos", carregar);
  soltar(7);
  assert.deepEqual(await Promise.all([a, b]), [7, 7]);
  assert.equal(leituras, 1);
});

test("memória: o que `guardar` recusa volta ao chamador e não fica", async () => {
  const m = criarMemoria<{ estado: string }>({ validadeMs: 1000, maximo: 5, guardar: (v) => v.estado === "ok" });
  let leituras = 0;
  const carregar = async () => (++leituras === 1 ? { estado: "erro" } : { estado: "ok" });
  assert.equal((await m.obter("patos", carregar)).estado, "erro");
  assert.equal(m.tamanho(), 0);
  assert.equal((await m.obter("patos", carregar)).estado, "ok", "o erro não ficou guardado");
  assert.equal(m.tamanho(), 1);
});

test("memória: falha não fica guardada nem trava a chave", async () => {
  const m = criarMemoria<string>({ validadeMs: 1000, maximo: 5 });
  await assert.rejects(m.obter("patos", async () => Promise.reject(new Error("fora do ar"))));
  assert.equal(await m.obter("patos", async () => "voltou"), "voltou");
});

test("memória: acima do máximo sai a chave usada há mais tempo", async () => {
  const m = criarMemoria<string>({ validadeMs: 10_000, maximo: 2 });
  await m.obter("a", async () => "A");
  await m.obter("b", async () => "B");
  await m.obter("a", async () => "nunca"); // usar "a" de novo deixa "b" como a mais antiga
  await m.obter("c", async () => "C");
  assert.equal(m.tamanho(), 2);
  assert.equal(await m.obter("a", async () => "relido"), "A", "a ficou");
  assert.equal(await m.obter("b", async () => "relido"), "relido", "b saiu");
});
