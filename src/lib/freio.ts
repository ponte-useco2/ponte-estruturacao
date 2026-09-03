import { headers } from "next/headers";

/**
 * Freio de requisições para as entradas públicas.
 *
 * O QUE ISTO É, HONESTAMENTE
 * Estado em memória, por instância serverless. NÃO é limite global: um
 * atacante distribuído contorna trocando de instância, e a Vercel pode criar
 * instâncias novas a qualquer momento. Serve para encarecer o caso comum — um
 * script, um IP, um laço — que é exatamente o que esgota uma cota de 500
 * e-mails por dia.
 *
 * O limite real exige estado compartilhado (tabela no Supabase ou Redis). Está
 * registrado como pendência; este módulo existe para que "nenhum freio" deixe
 * de ser verdade hoje, não para fingir que o problema acabou.
 *
 * O MAPA TEM TETO — DE PROPÓSITO
 * A versão anterior deste padrão, em auth-area.ts, crescia sem limite e era
 * chaveada pela entrada do atacante: quem escolhia as chaves escolhia o consumo
 * de memória. Aqui há teto e expurgo, então o pior caso é limitado.
 */

interface Registro {
  n: number;
  ate: number;
}

const registros = new Map<string, Registro>();

/** Teto de chaves vivas. Acima disto, expurga vencidas e, se preciso, as mais antigas. */
const TETO_CHAVES = 5000;

function expurgar(agora: number): void {
  for (const [k, v] of registros) {
    if (agora > v.ate) registros.delete(k);
  }
  if (registros.size <= TETO_CHAVES) return;

  // Ainda cheio depois do expurgo: descarta as de vencimento mais próximo.
  const porVencimento = [...registros.entries()].sort((a, b) => a[1].ate - b[1].ate);
  const excesso = registros.size - TETO_CHAVES;
  for (let i = 0; i < excesso; i++) registros.delete(porVencimento[i][0]);
}

export interface OpcoesFreio {
  /** Quantas tentativas cabem na janela. */
  limite: number;
  /** Tamanho da janela, em milissegundos. */
  janelaMs: number;
}

/**
 * Consome uma tentativa. Devolve `true` se pode seguir, `false` se estourou.
 */
export function consumir(chave: string, { limite, janelaMs }: OpcoesFreio): boolean {
  const agora = Date.now();

  if (registros.size > TETO_CHAVES) expurgar(agora);

  const atual = registros.get(chave);
  if (!atual || agora > atual.ate) {
    registros.set(chave, { n: 1, ate: agora + janelaMs });
    return true;
  }

  if (atual.n >= limite) return false;

  atual.n += 1;
  return true;
}

/**
 * Identificador do solicitante, para uso como chave do freio.
 *
 * Vem do `x-forwarded-for` que a Vercel preenche. É falsificável por quem
 * controla o cabeçalho antes da borda, e vários usuários atrás do mesmo NAT
 * compartilham o valor — por isso os limites são generosos o bastante para não
 * atrapalhar uso legítimo de uma prefeitura inteira saindo por um IP só.
 *
 * NOTA DE LGPD: o valor é usado apenas como chave em memória, com prazo de
 * minutos. Não é gravado em banco nem em log — segue valendo a decisão de
 * `oportunidades/eventos.ts` de não armazenar IP.
 */
export async function origemDoPedido(prefixo: string): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "sem-ip";
  return `${prefixo}:${ip}`;
}
