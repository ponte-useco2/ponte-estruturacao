/**
 * Segunda trava para texto livre de órgão (parecer, motivo): sem CPF, sem e-mail e sem telefone.
 *
 * O job já mascara (`pix_fundo/laudo.py`, `sem_dado_pessoal`; `exigencias/leitura.py`, `_MASCARAS`, com as mesmas
 * regras e os mesmos casos de teste), mas a
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
// Fixo sem DDD ("3218-0000"; N3 da R3, onda 7, 09/10/2026): começa de 2 a 5 e só vale com hífen, para não
// pegar SEI nem empenho ("19037514"). Fica de fora o que encosta em letra, ponto, cifrão ou hífen (processo,
// CNPJ, valor, número composto) e o que começa por 20, que é ano ("2024-2027", "Parecer 2024-0012").
const FIXO = /(?<![A-Za-z0-9_.$-])(?!20\d{2}-)[2-5]\d{3}-\d{4}(?![A-Za-z0-9_-]|\.\d)/g;
// O fixo de Brasília começa por 20, como o ano: só sai depois de "telefone", "fone", "contato", "ramal" ou
// "fax", ele e os que seguem em lista. Na medição de 09/10, 1 detalhe de exigência tinha um assim, e os 12
// "20xx-xxxx" dos documentos eram intervalos de anos, que ficam.
// O separador da lista só entra quando vem outro número (onda 12, B, 12/10/2026): antes, o "[^0-9]{0,8}" do fim
// comia o começo da palavra seguinte, e em "Contato: 2022-8800; Telefone 2030-1234" o segundo ficava à mostra.
const CONTATO_20 = /\b(?:tel|fone|contato|ramal|fax|whats)[^0-9]{0,30}(?:20\d{2}-\d{4}(?![A-Za-z0-9_-]|\.\d)(?:[^0-9]{0,8}(?=\d))?)+/gi;
const NUMERO_20 = /(?<!\d)(?!20\d{2}-(?:19|20)\d{2}(?!\d))20\d{2}-\d{4}(?!\d)/g;
// Fixo sem DDD com espaço ou ponto ("Fone: 3218 0000", "Tel. 3218.0000"; M9 da revisão C da onda 11; onda 12, B,
// 12/10/2026): sem hífen, só depois de palavra de contato, ele e os que seguem em lista, como no CONTATO_20. Sem a
// palavra fica ("lote 3218 0000"), e a palavra tem de ser inteira ("Telhas", "Hotel" e "faxina" não contam). O 20xx
// entra (Brasília), menos o par de anos ("2023 2026"). O espaço é o mesmo branco do TELEFONE: vale o sem quebra
// (U+00A0) e a quebra de linha, que a página mostra como espaço. As repetições têm limite e cada volta consome
// dígitos: sem expressão regular lenta.
const CONTATO_FIXO =
  /\b(?:tel(?:efone|efax)?s?|fones?|contatos?|celular(?:es)?|ramal|ramais|fax|whats(?:app)?)\b[^0-9]{0,30}(?:(?<![A-Za-z_$])[2-5]\d{3}[\s.]\d{4}(?![A-Za-z0-9_-]|\.\d)(?:[^0-9]{0,8}(?=\d))?)+/gi;
const NUMERO_FIXO = /(?<!\d)(?!20\d{2}[\s.](?:19|20)\d{2}(?!\d))[2-5]\d{3}[\s.]\d{4}(?!\d)/g;

export function semDadoPessoal(texto: string): string;
export function semDadoPessoal(texto: string | null): string | null;
export function semDadoPessoal(texto: string | null): string | null {
  if (!texto) return texto;
  return texto
    .replace(CPF, "$1***")
    .replace(EMAIL, "[e-mail]")
    .replace(TELEFONE, "[telefone]")
    .replace(CELULAR, "[telefone]")
    .replace(FIXO, "[telefone]")
    .replace(CONTATO_20, (trecho) => trecho.replace(NUMERO_20, "[telefone]"))
    .replace(CONTATO_FIXO, (trecho) => trecho.replace(NUMERO_FIXO, "[telefone]"));
}
