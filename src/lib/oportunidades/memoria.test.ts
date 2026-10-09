import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { montarCatalogo } from "./catalogo-v2.ts";
import { codigosPorJanela } from "./codigos-transferegov.ts";
import { versaoSuportada, type Payload } from "./contrato.ts";
import { comoPayloadV2 } from "./contrato-v2.ts";
import { calcularDiff } from "./diff.ts";
import { abertasParaAvisos, retratoDaJanela } from "./favoritos.ts";
import { criarMemoria, criarPorVersao } from "./memoria.ts";
import { opcoesDePreferencia } from "./opcoes.ts";

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

// ================================================================ falta com validade curta (onda 8, B)

type LeituraFalsa = { estado: string; faltas: string[] };
const inteira = (l: LeituraFalsa) => l.estado === "nao_encontrado" || (l.estado === "ok" && l.faltas.length === 0);
const comFalta = (l: LeituraFalsa) => l.estado === "ok" && l.faltas.length > 0;

test("falta curta: a leitura com fonte faltando fica a validade curta, e depois é refeita", async () => {
  const r = relogio();
  const m = criarMemoria<LeituraFalsa>({ validadeMs: 600_000, maximo: 5, agora: r.agora, guardar: inteira, falta: { validadeMs: 60_000, e: comFalta } });
  let leituras = 0;
  const carregar = async () => (++leituras === 1 ? { estado: "ok", faltas: ["TCE-PB"] } : { estado: "ok", faltas: [] });
  const primeira = await m.obter("patos", carregar);
  assert.deepEqual(primeira.faltas, ["TCE-PB"]);
  r.andar(59_999);
  assert.equal(await m.obter("patos", carregar), primeira, "dentro de 1 minuto, o mesmo objeto, sem reler");
  assert.equal(leituras, 1, "a fonte fora do ar não multiplicou as leituras");
  r.andar(1);
  assert.deepEqual((await m.obter("patos", carregar)).faltas, [], "depois de 1 minuto, relê");
  assert.equal(leituras, 2);
  r.andar(599_999);
  await m.obter("patos", carregar);
  assert.equal(leituras, 2, "a leitura inteira fica a validade toda, como antes");
});

test("falta curta: erro, o que `falta.e` não reconhece e o que lança continuam sem ficar", async () => {
  const r = relogio();
  const m = criarMemoria<LeituraFalsa>({ validadeMs: 600_000, maximo: 5, agora: r.agora, guardar: inteira, falta: { validadeMs: 60_000, e: comFalta } });
  let leituras = 0;
  const erro = async () => (leituras++, { estado: "erro", faltas: [] });
  await m.obter("patos", erro);
  await m.obter("patos", erro);
  assert.equal(leituras, 2, "erro não é falta: relê a cada pedido, como antes");
  assert.equal(m.tamanho(), 0);
  await assert.rejects(m.obter("patos", async () => Promise.reject(new Error("fora do ar"))));
  assert.equal(m.tamanho(), 0);
  assert.deepEqual(await m.obter("patos", async () => ({ estado: "ok", faltas: [] })), { estado: "ok", faltas: [] }, "a chave não travou");
});

test("falta curta: sem a opção, nada muda; e a falta nunca fica mais que a validade inteira", async () => {
  const r = relogio();
  const sem = criarMemoria<LeituraFalsa>({ validadeMs: 600_000, maximo: 5, agora: r.agora, guardar: inteira });
  let leituras = 0;
  const falta = async () => (leituras++, { estado: "ok", faltas: ["Pix"] });
  await sem.obter("patos", falta);
  await sem.obter("patos", falta);
  assert.equal(leituras, 2, "sem `falta`, a leitura com falta não fica (o comportamento de antes)");

  const curta = criarMemoria<LeituraFalsa>({ validadeMs: 1000, maximo: 5, agora: r.agora, guardar: inteira, falta: { validadeMs: 60_000, e: comFalta } });
  leituras = 0;
  await curta.obter("patos", falta);
  r.andar(999);
  await curta.obter("patos", falta);
  assert.equal(leituras, 1);
  r.andar(1);
  await curta.obter("patos", falta);
  assert.equal(leituras, 2, "a falta venceu com a validade inteira (1 s), menor que a dela");
});

test("falta curta com camada: a falta não volta à camada no minuto, e dois pedidos dividem uma leitura", async () => {
  const r = relogio();
  const conta = { idas: 0 };
  // A camada de verdade (`cache-dados.ts`) recusa a falta; aqui ela só conta as idas e lê do banco.
  const camada = { obter: async (_c: string, carregar: () => Promise<LeituraFalsa>) => (conta.idas++, { valor: await carregar(), desde: r.agora() }) };
  const m = criarMemoria<LeituraFalsa>({
    validadeMs: 600_000,
    maximo: 5,
    agora: r.agora,
    guardar: inteira,
    falta: { validadeMs: 60_000, e: comFalta },
    compartilhada: camada,
  });
  const carregar = async () => ({ estado: "ok", faltas: ["fornecedores"] });
  const [a, b] = await Promise.all([m.obter("jp", carregar), m.obter("jp", carregar)]);
  assert.equal(a, b);
  await m.obter("jp", carregar);
  assert.equal(conta.idas, 1, "no minuto, nem a camada nem o banco");
  r.andar(60_000);
  await m.obter("jp", carregar);
  assert.equal(conta.idas, 2);
});

// ================================================================ uma leitura por versão (onda 8, B)

test("por versão: a mesma versão lê uma vez; versão nova lê de novo; dois pedidos dividem a leitura", async () => {
  const v = criarPorVersao<{ n: number }>();
  let leituras = 0;
  const carregar = async () => ({ n: ++leituras });
  const [a, b] = await Promise.all([v.obter("t1|100", carregar), v.obter("t1|100", carregar)]);
  assert.equal(a, b, "o mesmo objeto");
  assert.equal(await v.obter("t1|100", carregar), a);
  assert.equal(leituras, 1);
  assert.deepEqual(await v.obter("t2|100", carregar), { n: 2 }, "o arquivo mudou: lê de novo");
  assert.deepEqual(await v.obter("t1|100", carregar), { n: 3 }, "só a última versão fica");
});

test("por versão: o que `guardar` recusa e o que lança não ficam; a falha antiga não derruba a versão nova", async () => {
  const v = criarPorVersao<{ estado: string }>((x) => x.estado === "ok");
  let leituras = 0;
  await v.obter("t1", async () => (leituras++, { estado: "invalido" }));
  await v.obter("t1", async () => (leituras++, { estado: "ok" }));
  assert.equal(leituras, 2, "o inválido não ficou");
  await v.obter("t1", async () => assert.fail("o ok ficou"));

  await assert.rejects(v.obter("t2", async () => Promise.reject(new Error("EIO"))), /EIO/);
  assert.deepEqual(await v.obter("t2", async () => ({ estado: "ok" })), { estado: "ok" }, "o erro não ficou");

  let soltar: (x: { estado: string }) => void = () => {};
  const velha = v.obter("t3", () => new Promise((ok) => (soltar = ok)));
  const nova = await v.obter("t4", async () => ({ estado: "ok" }));
  soltar({ estado: "invalido" });
  await velha;
  assert.equal(await v.obter("t4", async () => assert.fail("a t4 ficou")), nova);
});

/** Congela o objeto inteiro: em módulo (modo estrito), qualquer alteração depois lança TypeError. */
function congelar<T>(x: T): T {
  if (x && typeof x === "object" && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) congelar(v);
  }
  return x;
}

test("por versão: o catálogo guardado é o mesmo objeto para todos — quem o lê no servidor não o altera", () => {
  // Os dois JSON de verdade (`src/dados`), congelados, passam pelas funções que os leem no servidor: as janelas
  // (`/mapa`), o relatório do município, o diagnóstico, seguir uma janela, os avisos e a sincronização da central.
  const dados = path.join(import.meta.dirname, "..", "..", "dados");
  const v1 = congelar(JSON.parse(fs.readFileSync(path.join(dados, "oportunidades.json"), "utf-8")) as Payload);
  const v2 = comoPayloadV2(congelar(JSON.parse(fs.readFileSync(path.join(dados, "oportunidades-v2.json"), "utf-8"))));
  assert.ok(v2, "o v2 está no contrato");
  assert.ok(versaoSuportada(v1.versao));
  const antes = JSON.stringify([v1, v2]);
  const hoje = v2.generated_at.slice(0, 10);

  const codigos = codigosPorJanela(v2, v1);
  const publico = montarCatalogo(v2, null, hoje, codigos);
  const pb = montarCatalogo(v2, { tipo: "municipio", uf: "PB", temas: [] }, hoje, codigos);
  assert.ok(publico.janelas.length > 0 && pb.janelas.length > 0, "o catálogo de verdade tem janelas abertas");
  abertasParaAvisos(v2, hoje);
  retratoDaJanela(v2, v2.opportunities[0].id, hoje);
  const base = calcularDiff(null, v1);
  calcularDiff({ ...base.proximoEstado, gerado_em: "2000-01-01T00:00:00Z" }, v1);
  opcoesDePreferencia(v1.oportunidades);

  assert.equal(JSON.stringify([v1, v2]), antes, "nada mudou");
});
