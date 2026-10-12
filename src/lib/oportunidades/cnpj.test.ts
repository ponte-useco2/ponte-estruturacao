import test from "node:test";
import assert from "node:assert/strict";
import { cnpjNoFormato, cnpjValidado, dvDoCnpjConfere } from "./cnpj.ts";
import { cnpjValido as cnpjValidoDaOrganizacao } from "./organizacao.ts";

/**
 * Os dois dígitos pela tabela de pesos escrita à mão (5 4 3 2 9 8 7 6 5 4 3 2 e 6 5 4 3 2 9 8 7 6 5 4 3 2), com o valor
 * ASCII − 48 de cada posição: uma conta independente da de `cnpj.ts`, que gera os pesos pelo resto da divisão.
 */
function dvsAMao(base12: string): string {
  const valor = (ch: string) => ch.charCodeAt(0) - 48;
  const dv = (s: string, pesos: number[]) => {
    const r = pesos.reduce((t, p, i) => t + valor(s[i]) * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(`${base12}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${d1}${d2}`;
}

test("CNPJ numérico: o válido passa, com ou sem máscara; o dígito trocado não", () => {
  assert.equal(cnpjValidado("09.084.815/0001-70"), "09084815000170");
  assert.equal(cnpjValidado("09084815000170"), "09084815000170");
  assert.equal(cnpjValidado("11.222.333/0001-81"), "11222333000181");
  assert.equal(cnpjValidado("09084815000171"), null, "o segundo dígito trocado");
  assert.equal(cnpjValidado("09084815000160"), null, "o primeiro dígito trocado");
  assert.equal(cnpjValidado("11222333000182"), null, "o mesmo que a busca unificada chama de inválido");
  assert.equal(cnpjValidado("00000000000000"), null, "14 zeros fecham a conta e não são CNPJ");
  assert.equal(cnpjValidado("11111111111111"), null);
  assert.equal(cnpjValidado("0908481500017"), null, "13 posições");
  assert.equal(cnpjValidado(undefined), null);
  assert.equal(cnpjValidado(""), null);
});

test("CNPJ alfanumérico (IN RFB 2.229/2024): o exemplo da Receita e um montado aqui passam; o dígito trocado não", () => {
  // O exemplo da Receita Federal para o CNPJ alfanumérico.
  assert.equal(cnpjValidado("12.ABC.345/01DE-35"), "12ABC34501DE35");
  assert.equal(dvsAMao("12ABC34501DE"), "35", "a conta à mão dá o mesmo dígito do exemplo");
  // Um montado aqui, com o dígito pela conta à mão: letras em várias posições, inclusive "O" e "A".
  const base = "PB2026ONDA12";
  const valido = `${base}${dvsAMao(base)}`;
  assert.equal(cnpjValidado(valido), valido);
  assert.equal(cnpjValidado(valido.toLowerCase()), valido, "a URL em minúsculas vira caixa alta");
  assert.equal(cnpjValidado(`${valido.slice(0, 2)}.${valido.slice(2, 5)}.${valido.slice(5, 8)}/${valido.slice(8, 12)}-${valido.slice(12)}`), valido, "com máscara");
  const outro = `${valido.slice(0, 13)}${(Number(valido[13]) + 1) % 10}`;
  assert.equal(cnpjValidado(outro), null, "o segundo dígito trocado");
  assert.equal(cnpjValidado("12ABC34501DE36"), null);
  assert.equal(cnpjValidado("12ABC34501DF35"), null, "uma letra da base trocada");
  assert.equal(cnpjValidado("12ABC34501DEXY"), null, "os dois verificadores são dígitos");
});

test("CNPJ: o formato sozinho não confere o dígito; o dígito sozinho exige o formato", () => {
  assert.equal(cnpjNoFormato("09.084.815/0001-71"), "09084815000171");
  assert.equal(cnpjNoFormato("12abc34501de35"), "12ABC34501DE35");
  assert.equal(cnpjNoFormato("12ABC34501DEXY"), null);
  assert.equal(dvDoCnpjConfere("09.084.815/0001-70"), false, "com máscara não é o formato da base");
  assert.equal(dvDoCnpjConfere("09084815000170"), true);
});

test("CNPJ numérico: a mesma resposta da conferência do cadastro da organização, em mil números", () => {
  // Gerador fixo (sem aleatório de verdade): o teste dá sempre o mesmo resultado.
  let semente = 20261012;
  const proximo = () => (semente = (semente * 1103515245 + 12345) % 2147483648);
  let validos = 0;
  for (let k = 0; k < 1000; k++) {
    const base = String(proximo()).padStart(10, "0").slice(-10) + String(proximo() % 100).padStart(2, "0");
    const certo = `${base}${dvsAMao(base)}`;
    const errado = `${base}${dvsAMao(base) === "00" ? "01" : "00"}`;
    for (const c of [certo, errado]) {
      assert.equal(cnpjValidado(c) !== null, cnpjValidoDaOrganizacao(c), c);
      if (cnpjValidado(c)) validos++;
    }
  }
  assert.ok(validos >= 1000, "todo número montado com o dígito certo passa");
});
