import test from "node:test";
import assert from "node:assert/strict";
import { ORIGEM, REPOSITORIO, WORKFLOWS, dispararWorkflows, urlDisparo } from "./agendamento.ts";

type Pedido = { url: string; init: RequestInit };

function buscarFalso(respostas: (number | Error)[]) {
  const pedidos: Pedido[] = [];
  const buscar = async (url: string, init: RequestInit) => {
    pedidos.push({ url, init });
    const r = respostas[pedidos.length - 1];
    if (r instanceof Error) throw r;
    return { status: r, text: async () => (r >= 300 ? `{"message":"erro ${r}"}` : "") };
  };
  return { buscar, pedidos };
}

test("dispara os dois workflows na main com a origem do agendador", async () => {
  const { buscar, pedidos } = buscarFalso([204, 204]);
  const r = await dispararWorkflows("tok", buscar);
  assert.deepEqual(
    r.map((x) => [x.workflow, x.ok, x.status]),
    [
      ["fiscal.yml", true, 204],
      ["radar-propostas.yml", true, 204],
    ],
  );
  assert.equal(pedidos.length, WORKFLOWS.length);
  assert.equal(pedidos[0].url, `https://api.github.com/repos/${REPOSITORIO}/actions/workflows/fiscal.yml/dispatches`);
  assert.equal(pedidos[1].url, urlDisparo("radar-propostas.yml"));
  for (const p of pedidos) {
    assert.equal(p.init.method, "POST");
    assert.deepEqual(JSON.parse(String(p.init.body)), { ref: "main", inputs: { origem: ORIGEM } });
    assert.equal((p.init.headers as Record<string, string>).Authorization, "Bearer tok");
  }
});

test("200 (com detalhes da execução) também é sucesso", async () => {
  const { buscar } = buscarFalso([200, 204]);
  assert.ok((await dispararWorkflows("tok", buscar)).every((x) => x.ok));
});

test("a falha de um não impede o outro, e o erro não carrega o token", async () => {
  const { buscar } = buscarFalso([401, 204]);
  const [fiscal, radar] = await dispararWorkflows("segredo-que-nao-pode-vazar", buscar);
  assert.equal(fiscal.ok, false);
  assert.equal(fiscal.status, 401);
  assert.match(fiscal.erro ?? "", /erro 401/);
  assert.equal(radar.ok, true);
  assert.ok(!JSON.stringify([fiscal, radar]).includes("segredo-que-nao-pode-vazar"));
});

test("404 (workflow ou token sem acesso) e 422 (input desconhecido) aparecem como falha", async () => {
  const { buscar } = buscarFalso([404, 422]);
  const r = await dispararWorkflows("tok", buscar);
  assert.deepEqual(
    r.map((x) => [x.ok, x.status]),
    [
      [false, 404],
      [false, 422],
    ],
  );
});

test("falha de rede vira status 0 com a mensagem", async () => {
  const { buscar } = buscarFalso([new Error("fetch failed"), 204]);
  const [fiscal, radar] = await dispararWorkflows("tok", buscar);
  assert.deepEqual([fiscal.ok, fiscal.status, fiscal.erro], [false, 0, "fetch failed"]);
  assert.equal(radar.ok, true);
});
