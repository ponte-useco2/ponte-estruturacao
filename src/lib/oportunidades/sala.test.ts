/**
 * Teste da sala do cliente (14/10/2026): a senha, o cookie assinado e a lista dos programas abertos a OSC.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DIAS_DE_ACESSO, acessoValido, emitirAcesso, nomeDoCookie, salaPorSlug, senhaConfere, senhaDaSala } from "./sala.ts";
import { contarPorCanal, diasEntre, hojeEmBrasilia, limparTitulo, programasParaOsc, type LinhaRadarPrograma } from "./sala-programas.ts";

const SALA = salaPorSlug("ilha-tech")!;
const SENHA = "caju verde mar";
const AGORA = Date.parse("2026-10-14T13:00:00Z");

test("só as salas cadastradas existem", () => {
  assert.equal(SALA.variavel, "SALA_SENHA_ILHA_TECH");
  assert.equal(salaPorSlug("outra"), null);
  assert.equal(salaPorSlug("__proto__"), null, "nada herdado do Object vira sala");
  assert.equal(nomeDoCookie(SALA), "sala_ilha_tech");
});

test("sem a variável, ou com senha curta, a sala fica fechada", () => {
  assert.equal(senhaDaSala(SALA, {}), null);
  assert.equal(senhaDaSala(SALA, { SALA_SENHA_ILHA_TECH: "   " }), null);
  assert.equal(senhaDaSala(SALA, { SALA_SENHA_ILHA_TECH: "curta" }), null);
  assert.equal(senhaDaSala(SALA, { SALA_SENHA_ILHA_TECH: ` ${SENHA} ` }), SENHA);
});

test("a senha confere com espaços nas pontas e não confere com outra", () => {
  assert.ok(senhaConfere(SENHA, SENHA));
  assert.ok(senhaConfere(`  ${SENHA}\n`, SENHA));
  assert.ok(!senhaConfere("caju verde", SENHA));
  assert.ok(!senhaConfere("", SENHA));
  assert.ok(!senhaConfere("Caju Verde Mar", SENHA), "maiúscula conta");
});

test("o acesso emitido vale até expirar, só nesta sala e só com esta senha", () => {
  const valor = emitirAcesso(SALA, SENHA, AGORA);
  assert.ok(acessoValido(valor, SALA, SENHA, AGORA + 1000));
  assert.ok(acessoValido(valor, SALA, SENHA, AGORA + (DIAS_DE_ACESSO - 1) * 86_400_000));
  assert.ok(!acessoValido(valor, SALA, SENHA, AGORA + DIAS_DE_ACESSO * 86_400_000 + 1), "venceu");
  assert.ok(!acessoValido(valor, SALA, "outra senha longa", AGORA), "trocar a senha derruba os cookies");
  const outraSala = { slug: "outra", titulo: "x", variavel: "X" };
  assert.ok(!acessoValido(valor, outraSala, SENHA, AGORA), "o cookie de uma sala não abre outra");
});

test("cookie adulterado, vazio ou estranho não abre", () => {
  const valor = emitirAcesso(SALA, SENHA, AGORA);
  const [expira, assinatura] = valor.split(".");
  assert.ok(!acessoValido(`${Number(expira) + 86_400_000}.${assinatura}`, SALA, SENHA, AGORA), "estender a validade quebra a assinatura");
  assert.ok(!acessoValido(`${expira}.${assinatura.slice(0, -1)}A`, SALA, SENHA, AGORA));
  for (const lixo of [undefined, null, "", "abc", `${expira}`, `${expira}.`, `x.${assinatura}`, `${expira}.${assinatura}.x`]) {
    assert.ok(!acessoValido(lixo, SALA, SENHA, AGORA), String(lixo));
  }
});

function linha(c: Partial<LinhaRadarPrograma>): LinhaRadarPrograma {
  return { cod_programa: "1", programa: "P", orgao: "MINISTÉRIO X", canal: "voluntaria", abre: "2026-10-01", fecha: "2026-10-30",
           naturezas: ["Organização da Sociedade Civil"], ...c };
}

test("programas abertos a OSC: um por código, fechando hoje ou depois, por data de fechamento", () => {
  const lista = programasParaOsc([
    linha({ cod_programa: "A", fecha: "2026-11-30", canal: "emenda_parlamentar" }),
    linha({ cod_programa: "A", fecha: "2026-11-30", canal: "emenda_parlamentar" }),
    linha({ cod_programa: "B", fecha: "2026-10-14", programa: "  Fecha   hoje " }),
    linha({ cod_programa: "C", fecha: "2026-10-13" }),
    linha({ cod_programa: "D", naturezas: ["Administração Pública Municipal"] }),
    linha({ cod_programa: "E", fecha: "5008-12-15" }),
    linha({ cod_programa: "F", fecha: null }),
    linha({ cod_programa: "G", canal: "estranho", fecha: "2026-10-20" }),
  ], "2026-10-14");
  assert.deepEqual(lista.map((p) => p.codigo), ["B", "G", "A"]);
  assert.equal(lista[0].programa, "Fecha hoje");
  assert.equal(lista[0].diasRestantes, 0);
  assert.equal(lista[2].diasRestantes, 47);
  assert.equal(lista[1].canal, "outro");
  assert.deepEqual(contarPorCanal(lista), { voluntaria: 1, emenda_parlamentar: 1, beneficiario_especifico: 0, outro: 1 });
});

test("título com a codificação estragada na origem: só os padrões sem dúvida voltam", () => {
  assert.equal(limparTitulo("5812 - Promo??o e Defesa dos Direitos"), "5812 - Promoção e Defesa dos Direitos");
  assert.equal(limparTitulo("COMBATE E SUPERA??O DO RACISMO"), "COMBATE E SUPERAÇÃO DO RACISMO");
  assert.equal(limparTitulo("Pessoa com Defici?ncia"), "Pessoa com Deficiência");
  assert.equal(limparTitulo("Dúvida? Sim"), "Dúvida? Sim", "interrogação de verdade fica");
  assert.equal(limparTitulo(null), "");
});

test("datas: dias entre e hoje em Brasília", () => {
  assert.equal(diasEntre("2026-10-14", "2026-11-02"), 19);
  assert.equal(diasEntre("2026-10-14", "2026-10-13"), -1);
  assert.equal(hojeEmBrasilia(new Date("2026-10-15T02:30:00Z")), "2026-10-14", "23h30 de Brasília ainda é 14/10");
  assert.equal(hojeEmBrasilia(new Date("2026-10-15T03:30:00Z")), "2026-10-15");
});
