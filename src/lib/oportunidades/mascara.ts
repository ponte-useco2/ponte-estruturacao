/**
 * Segunda trava para texto livre de órgão (parecer, motivo): sem CPF, sem e-mail e sem telefone.
 *
 * O job já mascara (`pix_fundo/laudo.py`, `sem_dado_pessoal`; `exigencias/leitura.py`, `_MASCARAS`), mas a
 * linha gravada antes da correção, ou um formato que escape da primeira trava, chega à tela por aqui.
 * Servidor fica com nome, cargo e atribuição; contato, nunca (09/10/2026, revisão R3 da onda 6: 5 planos
 * do Pix com e-mail e 14 com telefone no trecho do parecer).
 */

// CPF com ou sem pontuação, fora de sequência maior (o mesmo de `semCpf` da busca unificada).
const CPF = /(^|[^0-9])[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}(?=[^0-9]|$)/g;
const EMAIL = /[\w.+-]+@[\w.-]+\.\w{2,}/g;
// Com DDD (entre parênteses ou não) e celular sem DDD; o CPF sai antes, para não virar meio telefone.
const TELEFONE = /\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g;
const CELULAR = /\b9\d{4}[\s-]\d{4}\b/g;

export function semDadoPessoal(texto: string): string;
export function semDadoPessoal(texto: string | null): string | null;
export function semDadoPessoal(texto: string | null): string | null {
  if (!texto) return texto;
  return texto
    .replace(CPF, "$1***")
    .replace(EMAIL, "[e-mail]")
    .replace(TELEFONE, "[telefone]")
    .replace(CELULAR, "[telefone]");
}
