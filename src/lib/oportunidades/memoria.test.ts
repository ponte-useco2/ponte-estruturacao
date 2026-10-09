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

// ================================================================ segunda camada (onda 7, A)

/** Uma camada compartilhada de mentira: guarda por chave o valor e o `desde`, e conta as idas a ela e ao banco. */
function camadaFalsa<T>(r: { agora: () => number }) {
  const guardados = new Map<string, { valor: T; desde: number }>();
  const conta = { idas: 0, banco: 0 };
  return {
    conta,
    guardados,
    camada: {
      async obter(chave: string, carregar: () => Promise<T>) {
        conta.idas++;
        const g = guardados.get(chave);
        if (g) return g;
        conta.banco++;
        const x = { valor: await carregar(), desde: r.agora() };
        guardados.set(chave, x);
        return x;
      },
    },
  };
}

test("memória com camada: a falta vai à camada, e a memória da instância poupa a segunda ida", async () => {
  const r = relogio();
  const c = camadaFalsa<string>(r);
  const m = criarMemoria<string>({ validadeMs: 1000, maximo: 5, agora: r.agora, compartilhada: c.camada });
  assert.equal(await m.obter("patos", async () => "lido"), "lido");
  assert.equal(await m.obter("patos", async () => "nunca"), "lido");
  assert.deepEqual(c.conta, { idas: 1, banco: 1 });
});

test("memória com camada: a validade conta de quando o valor foi lido do banco, não de quando chegou", async () => {
  const r = relogio(10_000);
  const c = camadaFalsa<string>(r);
  c.guardados.set("patos", { valor: "de outra instância", desde: 10_000 - 900 }); // lido há 900 ms
  const m = criarMemoria<string>({ validadeMs: 1000, maximo: 5, agora: r.agora, compartilhada: c.camada });
  assert.equal(await m.obter("patos", async () => "nunca"), "de outra instância");
  r.andar(99);
  await m.obter("patos", async () => "nunca");
  assert.equal(c.conta.idas, 1, "aos 999 ms de vida, ainda da memória");
  r.andar(1);
  await m.obter("patos", async () => "nunca");
  assert.equal(c.conta.idas, 2, "aos 1.000 ms venceu aqui também: volta à camada");
});

test("memória com camada: o que vem vencido não fica, e `desde` no futuro não estica a validade", async () => {
  const r = relogio(10_000);
  const c = camadaFalsa<string>(r);
  c.guardados.set("velho", { valor: "velho", desde: 10_000 - 5000 });
  c.guardados.set("futuro", { valor: "futuro", desde: 10_000 + 60_000 });
  const m = criarMemoria<string>({ validadeMs: 1000, maximo: 5, agora: r.agora, compartilhada: c.camada });
  assert.equal(await m.obter("velho", async () => "nunca"), "velho", "volta ao chamador");
  assert.equal(m.tamanho(), 0, "o vencido não ficou");
  await m.obter("futuro", async () => "nunca");
  assert.equal(m.tamanho(), 1);
  r.andar(999);
  await m.obter("futuro", async () => "nunca");
  assert.equal(c.conta.idas, 2, "aos 999 ms, ainda da memória");
  r.andar(1);
  await m.obter("futuro", async () => "nunca");
  assert.equal(c.conta.idas, 3, "o do futuro venceu em 1.000 ms, como qualquer outro");
});

test("memória com camada: `guardar` vale também para o que vem da camada, e dois pedidos dividem uma ida", async () => {
  const r = relogio();
  const c = camadaFalsa<{ estado: string }>(r);
  const m = criarMemoria<{ estado: string }>({ validadeMs: 1000, maximo: 5, agora: r.agora, guardar: (v) => v.estado === "ok", compartilhada: c.camada });
  c.guardados.set("erro", { valor: { estado: "erro" }, desde: 0 });
  await m.obter("erro", async () => ({ estado: "nunca" }));
  assert.equal(m.tamanho(), 0);
  const [a, b] = await Promise.all([m.obter("patos", async () => ({ estado: "ok" })), m.obter("patos", async () => ({ estado: "nunca" }))]);
  assert.equal(a, b);
  assert.equal(c.conta.banco, 1);
});

test("memória com camada: falha da camada não fica nem trava a chave", async () => {
  let falhar = true;
  const m = criarMemoria<string>({
    validadeMs: 1000,
    maximo: 5,
    compartilhada: {
      obter: async (_chave, carregar) => {
        if (falhar) throw new Error("fora do ar");
        return { valor: await carregar(), desde: Date.now() };
      },
    },
  });
  await assert.rejects(m.obter("patos", async () => "x"));
  falhar = false;
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
