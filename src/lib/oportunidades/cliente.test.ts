import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPLICACAO_SEM_CNPJ, EXPLICACAO_SEM_FICHA, podeVerEntidadePropria, podeVerInstrumento, podeVerInstrumentoPorCnpj, podeVerMunicipio, type MotivoSemCnpj, type MotivoSemFicha } from "./cliente.ts";

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

test("laudo do cliente: só instrumento da administração municipal do próprio município", () => {
  const acesso = podeVerMunicipio("aprovado", PREFEITURA, CONFIRMADO);
  assert.deepEqual(podeVerInstrumento(acesso, { cod_ibge: "2507507", tipo_agente: "municipio" }), { ok: true });
  // O Estado e as entidades têm o IBGE do município-sede, mas não são a prefeitura.
  assert.deepEqual(podeVerInstrumento(acesso, { cod_ibge: "2507507", tipo_agente: "estado" }), { ok: false, motivo: "outro_proponente" });
  assert.deepEqual(podeVerInstrumento(acesso, { cod_ibge: "2507507", tipo_agente: "osc" }), { ok: false, motivo: "outro_proponente" });
  assert.deepEqual(podeVerInstrumento(acesso, { cod_ibge: "2504009", tipo_agente: "municipio" }), { ok: false, motivo: "outro_municipio" });
  assert.deepEqual(podeVerInstrumento(acesso, { cod_ibge: null, tipo_agente: "municipio" }), { ok: false, motivo: "outro_municipio" });
});

test("laudo do cliente: sem acesso à ficha, sem laudo, com o mesmo motivo", () => {
  const semVinculo = podeVerMunicipio("aprovado", PREFEITURA, null);
  assert.deepEqual(podeVerInstrumento(semVinculo, { cod_ibge: "2507507", tipo_agente: "municipio" }), { ok: false, motivo: "aguardando_confirmacao" });
  const outraOrg = podeVerMunicipio("aprovado", { tipo: "osc", municipioIbge: "2507507" }, CONFIRMADO);
  assert.deepEqual(podeVerInstrumento(outraOrg, { cod_ibge: "2507507", tipo_agente: "municipio" }), { ok: false, motivo: "nao_municipio" });
  const pendente = podeVerMunicipio("pendente", PREFEITURA, CONFIRMADO);
  assert.deepEqual(podeVerInstrumento(pendente, { cod_ibge: "2507507", tipo_agente: "municipio" }), { ok: false, motivo: "nao_aprovado" });
});

test("cliente por CNPJ (oport_31): só com o CNPJ do cadastro confirmado, e cada recusa tem explicação", () => {
  const osc = { cnpj: "09112236000194" };
  const v = { cnpj: "09112236000194", confirmado_em: "2026-10-07T20:00:00Z" };
  assert.deepEqual(podeVerEntidadePropria("aprovado", osc, v), { ok: true, cnpj: "09112236000194" });
  const motivos: [Parameters<typeof podeVerEntidadePropria>, MotivoSemCnpj][] = [
    [["pendente", osc, v], "nao_aprovado"],
    [["aprovado", null, v], "sem_organizacao"],
    [["aprovado", { cnpj: null }, v], "sem_cnpj"],
    [["aprovado", { cnpj: "09.112.236/0001-94" }, v], "sem_cnpj"],
    [["aprovado", osc, null], "aguardando_confirmacao"],
    [["aprovado", { cnpj: "12671814000137" }, v], "cnpj_mudou"],
  ];
  for (const [args, motivo] of motivos) {
    assert.deepEqual(podeVerEntidadePropria(...args), { ok: false, motivo });
    assert.ok(EXPLICACAO_SEM_CNPJ[motivo].texto.length > 20);
  }
  const acesso = podeVerEntidadePropria("aprovado", osc, v);
  assert.equal(podeVerInstrumentoPorCnpj(acesso, { cnpj: "09112236000194" }), true);
  assert.equal(podeVerInstrumentoPorCnpj(acesso, { cnpj: "09084815000170" }), false, "instrumento de outro proponente");
  assert.equal(podeVerInstrumentoPorCnpj(acesso, { cnpj: null }), false);
  assert.equal(podeVerInstrumentoPorCnpj({ ok: false, motivo: "aguardando_confirmacao" }, { cnpj: "09112236000194" }), false);
});
