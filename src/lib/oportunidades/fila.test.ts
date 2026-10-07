import test from "node:test";
import assert from "node:assert/strict";
import { compararFila, grupos, type ItemFila } from "./fila.ts";

const it = (id: string, x: Partial<ItemFila>) => ({ id, nivel: "alto", ...x });

test("fila: bloqueio, cobrança, prazo, atenção; em dia por último, qualquer que seja o nível", () => {
  const xs = [
    it("atencao-critico", { classe: "atencao", nivel: "critico" }),
    it("prazo", { classe: "prazo", nivel: "alto", prazo: "2026-10-20" }),
    it("em-dia", { classe: "bloqueio", nivel: "em_dia" }),
    it("cobranca", { classe: "cobranca", nivel: "alto" }),
    it("bloqueio-moderado", { classe: "bloqueio", nivel: "moderado" }),
  ];
  assert.deepEqual([...xs].sort(compararFila).map((x) => x.id), ["bloqueio-moderado", "cobranca", "prazo", "atencao-critico", "em-dia"]);
});

test("fila: dentro da classe, o prazo mais próximo (vencido primeiro), depois o nível e o peso", () => {
  const xs = [
    it("sem-prazo-critico", { classe: "prazo", nivel: "critico" }),
    it("depois", { classe: "prazo", prazo: "2026-11-30" }),
    it("vencido", { classe: "prazo", prazo: "2026-09-30" }),
    it("antes", { classe: "prazo", prazo: "2026-10-15" }),
  ];
  assert.deepEqual([...xs].sort(compararFila).map((x) => x.id), ["vencido", "antes", "depois", "sem-prazo-critico"]);
  const ys = [it("peso-3", { classe: "cobranca", peso: 3 }), it("moderado", { classe: "cobranca", nivel: "moderado", peso: 0 }), it("peso-1", { classe: "cobranca", peso: 1 })];
  assert.deepEqual([...ys].sort(compararFila).map((x) => x.id), ["peso-1", "peso-3", "moderado"]);
});

test("grupos: na ordem da fila, sem o que está em dia; sem classe conta como atenção", () => {
  const g = grupos([it("a", {}), it("b", { classe: "cobranca" }), it("c", { classe: "bloqueio" }), it("d", { nivel: "em_dia", classe: "bloqueio" })]);
  assert.deepEqual(g.map((x) => [x.classe, x.itens.map((y) => y.id)]), [["bloqueio", ["c"]], ["cobranca", ["b"]], ["atencao", ["a"]]]);
});
