/**
 * Sala do cliente (14/10/2026): uma página do site com senha simples, para a PONTE mostrar a um cliente o material de
 * uma reunião. Lógica pura e testada; a página é `app/sala/[sala]/page.tsx` e a entrada, `app/sala/[sala]/entrar`.
 *
 * O que a senha protege, honestamente: a sala só mostra fatos públicos, cada um com a fonte (decisão do titular,
 * 14/10/2026: o briefing completo, com a leitura da PONTE, fica fora do site). A senha evita que a página apareça para
 * quem não foi convidado; não é cofre. Por isso:
 *   · a senha mora numa variável de ambiente da Vercel, uma por sala (`SALA_SENHA_<SLUG>`), que o titular define e
 *     troca no painel. Sem a variável, a sala fica fechada: nunca abre por omissão;
 *   · quem acerta recebe um cookie só da sala, assinado com a própria senha (HMAC-SHA256) e com validade. Trocar a senha
 *     invalida todos os cookies de uma vez;
 *   · a comparação da senha e da assinatura é em tempo constante.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface DefinicaoSala {
  /** Endereço: `/sala/<slug>`. Só letras minúsculas, dígitos e hífen. */
  slug: string;
  titulo: string;
  /** Nome da variável de ambiente com a senha. */
  variavel: string;
}

export const SALAS: Record<string, DefinicaoSala> = {
  "ilha-tech": { slug: "ilha-tech", titulo: "Associação Ilha Tech", variavel: "SALA_SENHA_ILHA_TECH" },
};

/** Validade do acesso depois de acertar a senha. */
export const DIAS_DE_ACESSO = 30;
const MS_DIA = 86_400_000;

export function salaPorSlug(slug: string): DefinicaoSala | null {
  return Object.hasOwn(SALAS, slug) ? SALAS[slug] : null;
}

export function nomeDoCookie(sala: DefinicaoSala): string {
  return `sala_${sala.slug.replace(/-/g, "_")}`;
}

/** A senha da sala no ambiente, ou null (sala fechada). Senha curta demais também fecha: menos de 8 caracteres. */
export function senhaDaSala(sala: DefinicaoSala, ambiente: Record<string, string | undefined>): string | null {
  const senha = (ambiente[sala.variavel] ?? "").trim();
  return senha.length >= 8 ? senha : null;
}

function iguais(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A senha digitada confere? Compara os resumos SHA-256, sempre do mesmo tamanho, em tempo constante. */
export function senhaConfere(digitada: string, senha: string): boolean {
  const resumo = (s: string) => createHash("sha256").update(s.normalize("NFC"), "utf8").digest();
  return iguais(resumo(digitada.trim()), resumo(senha));
}

function assinatura(sala: DefinicaoSala, senha: string, expira: number): string {
  return createHmac("sha256", senha).update(`${sala.slug}.${expira}`).digest("base64url");
}

/** O valor do cookie de quem acertou a senha: `<expira em ms>.<assinatura>`. */
export function emitirAcesso(sala: DefinicaoSala, senha: string, agora: number, dias = DIAS_DE_ACESSO): string {
  const expira = agora + dias * MS_DIA;
  return `${expira}.${assinatura(sala, senha, expira)}`;
}

/** O cookie vale para esta sala, com esta senha, agora? (`agora` só se passa no teste.) */
export function acessoValido(valor: string | undefined | null, sala: DefinicaoSala, senha: string, agora: number = Date.now()): boolean {
  if (!valor) return false;
  const m = /^(\d{10,16})\.([A-Za-z0-9_-]{20,})$/.exec(valor);
  if (!m) return false;
  const expira = Number(m[1]);
  if (!Number.isSafeInteger(expira) || expira <= agora) return false;
  return iguais(Buffer.from(m[2]), Buffer.from(assinatura(sala, senha, expira)));
}
