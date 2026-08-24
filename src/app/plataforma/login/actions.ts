"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Login da área reservada da Plataforma PONTE (/plataforma/app).
 *
 * DIFERENÇA DELIBERADA em relação a /hub-bananeiras/login: aqui NÃO existe
 * credencial padrão no código. O repositório é público; um default hardcoded
 * é uma senha publicada — o `hub*2026` do HUB está legível para qualquer um
 * que abra o arquivo no GitHub.
 *
 * Sem as variáveis de ambiente definidas, este login recusa todo mundo. É
 * ruidoso e trava o desenvolvimento local até alguém configurar — que é
 * exatamente o comportamento desejado para uma porta.
 *
 * Defina na Vercel (Project Settings › Environment Variables):
 *   PLATAFORMA_USER          usuário
 *   PLATAFORMA_PASS          senha
 *   PLATAFORMA_AUTH_SECRET   valor gravado no cookie; string longa e aleatória
 *
 * PLATAFORMA_AUTH_SECRET não é a senha: é o que o cookie carrega e o que o
 * proxy compara. Mantê-los distintos evita que um cookie vazado revele a
 * credencial de entrada.
 */

const AUTH_USER = process.env.PLATAFORMA_USER;
const AUTH_PASS = process.env.PLATAFORMA_PASS;
const AUTH_SECRET = process.env.PLATAFORMA_AUTH_SECRET;

const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 horas

/**
 * Comparação em tempo constante. Um `===` de string sai no primeiro caractere
 * diferente, e essa diferença de microssegundos é mensurável pela rede —
 * permite descobrir a senha caractere a caractere.
 *
 * O hash não é para sigilo: é para igualar o comprimento das entradas, já que
 * timingSafeEqual exige buffers do mesmo tamanho e recusar por tamanho
 * diferente já vazaria o comprimento da senha.
 */
function iguais(a: string, b: string): boolean {
  const ha = Buffer.from(a, "utf8");
  const hb = Buffer.from(b, "utf8");
  const n = Math.max(ha.length, hb.length, 1);
  const pa = Buffer.alloc(n);
  const pb = Buffer.alloc(n);
  ha.copy(pa);
  hb.copy(pb);
  return timingSafeEqual(pa, pb) && ha.length === hb.length;
}

/**
 * Freio de força bruta. Em serverless a memória é por instância, então isto
 * NÃO é um limite global — um atacante distribuído contorna trocando de
 * instância. Serve para encarecer o caso comum (um script, um IP), não como
 * garantia. Limite de verdade exigiria estado compartilhado (Supabase/Redis).
 */
const tentativas = new Map<string, { n: number; ate: number }>();
const TETO = 8;
const JANELA = 10 * 60 * 1000;

function bloqueado(chave: string): boolean {
  const t = tentativas.get(chave);
  if (!t) return false;
  if (Date.now() > t.ate) {
    tentativas.delete(chave);
    return false;
  }
  return t.n >= TETO;
}

function registrarFalha(chave: string): void {
  const t = tentativas.get(chave);
  if (!t || Date.now() > t.ate) {
    tentativas.set(chave, { n: 1, ate: Date.now() + JANELA });
    return;
  }
  t.n += 1;
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

export async function loginPlataforma(formData: FormData): Promise<LoginResult> {
  // Configuração ausente → porta fechada. Nunca "aberta por omissão".
  if (!AUTH_USER || !AUTH_PASS || !AUTH_SECRET) {
    return {
      success: false,
      error:
        "Acesso indisponível: as credenciais desta área ainda não foram configuradas no servidor.",
    };
  }

  const usuario = ((formData.get("usuario") as string) || "").trim().toLowerCase();
  const senha = (formData.get("senha") as string) || "";
  const armadilha = ((formData.get("empresa") as string) || "").trim();

  // Honeypot: campo escondido por CSS, invisível a quem enxerga a página.
  // Bot que preenche todos os inputs cai aqui. Responde como credencial
  // errada — dizer "detectamos um bot" ensina o autor a contornar.
  if (armadilha) {
    await new Promise((r) => setTimeout(r, 700));
    return { success: false, error: "Usuário ou senha incorretos." };
  }

  const chave = usuario || "anon";
  if (bloqueado(chave)) {
    return {
      success: false,
      error: "Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.",
    };
  }

  // Atraso fixo: encarece a enumeração e uniformiza o tempo de resposta
  // entre acerto e erro.
  await new Promise((r) => setTimeout(r, 500));

  const okUsuario = iguais(usuario, AUTH_USER.trim().toLowerCase());
  const okSenha = iguais(senha, AUTH_PASS);

  // Avalia os dois antes de decidir — sair cedo no usuário revelaria quais
  // nomes existem.
  if (!okUsuario || !okSenha) {
    registrarFalha(chave);
    return { success: false, error: "Usuário ou senha incorretos." };
  }

  tentativas.delete(chave);

  // Destino guardado pelo proxy. Só aceitamos caminhos internos desta área:
  // um `next` livre viraria open redirect — o atacante manda o link do nosso
  // login com ?next=//site-dele e a vítima acha que o desvio foi nosso.
  const pedido = ((formData.get("next") as string) || "").trim();
  const destino =
    pedido.startsWith("/plataforma/app") && !pedido.startsWith("//")
      ? pedido
      : "/plataforma/app/onboarding";

  const jar = await cookies();
  jar.set("plataforma_auth", AUTH_SECRET, {
    httpOnly: true, // JavaScript da página não lê — reduz o estrago de um XSS
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  redirect(destino);
}

export async function logoutPlataforma(): Promise<void> {
  const jar = await cookies();
  jar.delete("plataforma_auth");
  redirect("/plataforma/login");
}
