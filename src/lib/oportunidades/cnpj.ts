/**
 * O CNPJ e os dois dígitos verificadores, no formato numérico e no alfanumérico (onda 12, A, 12/10/2026; M1 da revisão
 * de segurança da onda 11). Função pura, sem import: serve à URL da página da entidade (`cnpjDaUrl`), ao explorador e a
 * quem mais precisar, sem entrar no ciclo `relatorio-municipio` → `busca` → `pagina-municipio`.
 *
 * Por quê: a página da entidade aceitava quaisquer 14 caracteres no formato e ia ao banco. Com a versão pública, um robô
 * que pedisse CNPJ inventado em laço fazia 4 leituras por pedido; com o dígito conferido antes, 99 de cada 100 CNPJ
 * inventados param na URL, sem ler nada.
 *
 * O CNPJ alfanumérico (IN RFB 2.229/2024, novos CNPJ a partir de julho de 2026): as 12 primeiras posições aceitam letras
 * maiúsculas e dígitos; os dois verificadores continuam numéricos. O cálculo é o módulo 11 de sempre, com pesos de 2 a 9
 * da direita para a esquerda, e o valor de cada posição é o código ASCII menos 48: "0" a "9" valem 0 a 9 (o CNPJ
 * numérico sai igual ao de sempre), "A" vale 17 e "Z" vale 42. O exemplo da Receita, 12.ABC.345/01DE-35, fecha a conta.
 *
 * Já existem outras duas conferências, que não cobrem o alfanumérico e não são deste arquivo: `cnpjValido` de
 * `organizacao.ts` (só dígitos, para o cadastro da organização, que o banco limita a 14 dígitos) e `cnpjValido` de
 * `fornecedores.ts` (só o formato, para o dossiê do fornecedor).
 */

/** 12 posições de letras maiúsculas e dígitos, e 2 dígitos verificadores. */
const FORMATO_CNPJ = /^[0-9A-Z]{12}\d{2}$/;

/**
 * O CNPJ como a base guarda (14 posições, sem máscara, em caixa alta), só pelo formato: não confere o dígito. Fora do
 * formato, null.
 */
export function cnpjNoFormato(v: string | null | undefined): string | null {
  const c = (v ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  return FORMATO_CNPJ.test(c) ? c : null;
}

/** Um dígito verificador: pesos de 2 a 9 da direita para a esquerda, valor = código ASCII − 48, módulo 11. */
function digitoVerificador(base: string): number {
  let soma = 0;
  for (let k = 0; k < base.length; k++) {
    const peso = ((base.length - 1 - k) % 8) + 2;
    soma += (base.charCodeAt(k) - 48) * peso;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Se os dois dígitos verificadores conferem (o CNPJ já no formato de `cnpjNoFormato`). Os 14 dígitos iguais fecham a
 * conta ("00000000000000") e não são CNPJ: a Receita não os emite, e `organizacao.ts` também os recusa.
 */
export function dvDoCnpjConfere(c: string): boolean {
  if (!FORMATO_CNPJ.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const d1 = digitoVerificador(c.slice(0, 12));
  const d2 = digitoVerificador(c.slice(0, 12) + String(d1));
  return c[12] === String(d1) && c[13] === String(d2);
}

/** O CNPJ válido (formato e dígitos), sem máscara e em caixa alta; senão null. */
export function cnpjValidado(v: string | null | undefined): string | null {
  const c = cnpjNoFormato(v);
  return c !== null && dvDoCnpjConfere(c) ? c : null;
}
