import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Autenticação das áreas reservadas do site.
 *
 * Existe porque a mesma lógica estava triplicada — e as três cópias tinham a
 * mesma falha: credencial padrão embutida no código. Como o repositório é
 * público, essas senhas estavam legíveis para qualquer pessoa que abrisse o
 * arquivo no GitHub, e permanecem no histórico do git. Foram trocadas; não
 * basta removê-las do código, porque quem clonou antes já as tem.
 *
 * Regra desta camada: sem variável de ambiente, ninguém entra. Configuração
 * ausente fecha a porta. Um default é conveniente no desenvolvimento e é uma
 * senha publicada em produção — e não há como saber, do lado de dentro, em
 * qual dos dois você está confiando.
 */

export interface AreaProtegida {
  /** Prefixo aceito no `next`, para o retorno não virar open redirect. */
  prefixo: string;
  /** Cookie de sessão da área. */
  cookie: string;
  /** Destino quando não há `next` válido. */
  destinoPadrao: string;
  /** Nomes das env vars — usuário, senha e valor do cookie, nessa ordem. */
  vars: readonly [string, string, string];
  /** Duração da sessão em segundos. */
  duracao: number;
}

export interface ResultadoAuth {
  ok: boolean;
  erro?: string;
  destino?: string;
}

/**
 * Comparação em tempo constante.
 *
 * Um `===` de string retorna no primeiro caractere diferente. Essa diferença
 * de tempo é mensurável pela rede e permite descobrir a senha caractere a
 * caractere, sem nunca acertá-la por inteiro.
 *
 * O preenchimento até o mesmo tamanho é necessário porque timingSafeEqual
 * exige buffers iguais — e recusar antes, por tamanho diferente, já vazaria
 * o comprimento da senha.
 */
function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  const n = Math.max(ba.length, bb.length, 1);
  const pa = Buffer.alloc(n);
  const pb = Buffer.alloc(n);
  ba.copy(pa);
  bb.copy(pb);
  return timingSafeEqual(pa, pb) && ba.length === bb.length;
}

/**
 * Freio de força bruta.
 *
 * A memória é por instância serverless: NÃO é limite global, e um atacante
 * distribuído contorna trocando de instância. Serve para encarecer o caso
 * comum — um script, um IP —, não como garantia. Limite real exigiria estado
 * compartilhado (Supabase ou Redis).
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

export async function autenticarArea(
  formData: FormData,
  area: AreaProtegida
): Promise<ResultadoAuth> {
  const [varUser, varPass, varSecret] = area.vars;
  const AUTH_USER = process.env[varUser];
  const AUTH_PASS = process.env[varPass];
  const AUTH_SECRET = process.env[varSecret];

  // Porta fechada por omissão. Nunca aberta.
  if (!AUTH_USER || !AUTH_PASS || !AUTH_SECRET) {
    return {
      ok: false,
      erro:
        "Acesso indisponível: as credenciais desta área ainda não foram " +
        "configuradas no servidor. Avise a equipe da PONTE.",
    };
  }

  const usuario = ((formData.get("usuario") as string) || "").trim().toLowerCase();
  const senha = (formData.get("senha") as string) || "";
  const armadilha = ((formData.get("empresa") as string) || "").trim();

  // Honeypot: campo fora da tela, invisível a quem enxerga a página e ignorado
  // por leitor de tela. Bot que preenche todos os inputs cai aqui. A resposta
  // é a mesma de credencial errada — dizer "detectamos um bot" só ensina o
  // autor a contornar.
  if (armadilha) {
    await new Promise((r) => setTimeout(r, 700));
    return { ok: false, erro: "Usuário ou senha incorretos." };
  }

  const chave = `${area.cookie}:${usuario || "anon"}`;
  if (bloqueado(chave)) {
    return {
      ok: false,
      erro: "Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.",
    };
  }

  // Atraso fixo: encarece a enumeração e uniformiza o tempo entre acerto e erro.
  await new Promise((r) => setTimeout(r, 500));

  // Avalia os dois antes de decidir. Sair cedo no usuário revelaria quais
  // nomes existem.
  const okUsuario = iguais(usuario, AUTH_USER.trim().toLowerCase());
  const okSenha = iguais(senha, AUTH_PASS);

  if (!okUsuario || !okSenha) {
    registrarFalha(chave);
    return { ok: false, erro: "Usuário ou senha incorretos." };
  }

  tentativas.delete(chave);

  // `next` só pode apontar para dentro da própria área. Um valor livre viraria
  // open redirect: o atacante divulga o link do NOSSO login com ?next=//site-dele
  // e a vítima atribui o desvio a nós.
  const pedido = ((formData.get("next") as string) || "").trim();
  const destino =
    pedido.startsWith(area.prefixo) &&
    !pedido.startsWith("//") &&
    !pedido.includes("://")
      ? pedido
      : area.destinoPadrao;

  const jar = await cookies();
  jar.set(area.cookie, AUTH_SECRET, {
    httpOnly: true, // JavaScript da página não lê — reduz o estrago de um XSS
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: area.duracao,
  });

  return { ok: true, destino };
}
