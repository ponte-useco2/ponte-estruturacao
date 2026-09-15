import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPLICACAO_SEM_FICHA, podeVerMunicipio, type MotivoSemFicha } from "./cliente.ts";

const PREFEITURA = { tipo: "municipio", municipioIbge: "2507507" };
const CONFIRMADO = { municipio_ibge: "2507507", confirmado_em: "2026-09-15T12:00:00Z" };

test("aprovado, prefeitura com IBGE e vínculo confirmado para o mesmo município: vê", () => {
  assert.deepEqual(podeVerMunicipio("aprovado", PREFEITURA, CONFIRMADO), { ok: true, ibge: "2507507" });
});

test("cada falta tem o seu motivo, na ordem em que a pessoa resolve", () => {
  const casos: [Parameters<typeof podeVerMunicipio>, MotivoSemFicha][] = [
    [["pendente", PREFEITURA, CONFIRMADO], "nao_aprovado"],
    [["bloqueado", PREFEITURA, CONFIRMADO], "nao_aprovado"],
    [[null, PREFEITURA, CONFIRMADO], "nao_aprovado"],
    [["aprovado", null, CONFIRMADO], "sem_organizacao"],
    [["aprovado", { tipo: "osc", municipioIbge: "2507507" }, CONFIRMADO], "nao_municipio"],
    [["aprovado", { tipo: "municipio", municipioIbge: null }, CONFIRMADO], "sem_ibge"],
    [["aprovado", { tipo: "municipio", municipioIbge: "25075" }, CONFIRMADO], "sem_ibge"],
    [["aprovado", PREFEITURA, null], "aguardando_confirmacao"],
    [["aprovado", { tipo: "municipio", municipioIbge: "2504009" }, CONFIRMADO], "municipio_mudou"],
  ];
  for (const [args, motivo] of casos) {
    assert.deepEqual(podeVerMunicipio(...args), { ok: false, motivo }, JSON.stringify(args));
  }
});

test("o município liberado é o confirmado, não um que chegue de fora", () => {
  const r = podeVerMunicipio("aprovado", PREFEITURA, CONFIRMADO);
  assert.ok(r.ok && r.ibge === CONFIRMADO.municipio_ibge);
});

test("toda recusa tem explicação", () => {
  const motivos: MotivoSemFicha[] = ["nao_aprovado", "sem_organizacao", "nao_municipio", "sem_ibge", "aguardando_confirmacao", "municipio_mudou"];
  assert.ok(motivos.every((m) => EXPLICACAO_SEM_FICHA[m].titulo && EXPLICACAO_SEM_FICHA[m].texto));
});
