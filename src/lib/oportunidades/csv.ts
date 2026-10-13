/**
 * O CSV do site, para abrir no Excel em português. Saiu de `painel.ts` na integração da onda 15 (13/10/2026): a tabela
 * filtrável gera o CSV no navegador, e importar `painel.ts` levava ~48 KB de código do painel para o pacote do
 * navegador. `painel.ts` reexporta daqui, e quem já importava de lá não muda.
 */

export interface ColunaCsv<T> {
  titulo: string;
  valor: (linha: T) => string | number | boolean | null | undefined;
  /**
   * Identificador que o Excel estragaria ao abrir: "1/2024" vira data (jan/24) e um código de
   * 13 dígitos vira 2,63E+12. Sai como ="…", que o Excel abre como texto intacto.
   */
  texto?: boolean;
}

/** Só dígito, ponto, barra e hífen entram no ="…": nada ali pode fechar a aspa e virar fórmula. */
const IDENTIFICADOR_SEGURO = /^\d[\d./-]*$/;

/**
 * CSV para abrir no Excel em português: BOM UTF-8, separador ponto e vírgula, fim de
 * linha CRLF, número com vírgula decimal e data AAAA-MM-DD virando DD/MM/AAAA.
 * Comportamento conferido no Excel pt-BR em 18/09/2026, abrindo o arquivo como o duplo clique.
 */
export function paraCsv<T>(colunas: ColunaCsv<T>[], linhas: T[]): string {
  const celula = (v: string | number | boolean | null | undefined, texto = false): string => {
    if (v === null || v === undefined) return "";
    if (texto && typeof v === "string" && IDENTIFICADOR_SEGURO.test(v)) return `"=""${v}"""`;
    let s: string;
    if (typeof v === "boolean") s = v ? "sim" : "não";
    // Duas casas no máximo: conta de ponto flutuante gerava "395,80999999999995" no rendimento.
    else if (typeof v === "number") s = Number.isFinite(v) ? String(Math.round(v * 100) / 100 || 0).replace(".", ",") : "";
    else s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : v;
    // Texto começando com sinal ganha um espaço na frente: o Excel deixa de ler fórmula
    // ("- Aquisição…" dava #NOME?) e, ao contrário do apóstrofo, o espaço não aparece.
    // Tabulação e \r no começo também (a lista da OWASP; M7 da R3, onda 7, 09/10/2026): há
    // programa que apara esses caracteres e lê a fórmula que vem depois.
    // Número negativo não é texto: segue sem espaço e sem aspas.
    const sinal = typeof v === "string" && /^[=+\-@\t\r]/.test(s);
    if (sinal) s = ` ${s}`;
    // Aspas quando o texto tem separador, aspas ou quebra de linha, e no texto com sinal.
    const precisaAspas = sinal || /[;"\r\n]/.test(s);
    return precisaAspas ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => celula(c.valor(l), c.texto)).join(";"));
  return "﻿" + [cabecalho, ...corpo].join("\r\n") + "\r\n";
}
