/**
 * O cache de dados compartilhado entre as instâncias do servidor (onda 7, A, 09/10/2026): a parte pura — as chaves, a
 * validade e a regra do que se guarda. A parte que fala com o cache do Next (`unstable_cache`, que na Vercel é o
 * Runtime Cache da região) mora em `cache-dados.server.ts`; a memória da instância (`memoria.ts`) continua na frente.
 *
 * Por quê: a memória de 10 minutos é por instância (R2 de 09/10/2026, §1 item 5 e §4.2). Cada instância nova da
 * Vercel começa vazia, guarda no máximo 30 municípios e 30 entidades, e o público, sem cache comum, levaria a página
 * do município a ~50 pedidos ao banco por visita. Com o cache compartilhado, cada chave é lida do banco uma vez a cada
 * 10 minutos para todas as instâncias da região.
 *
 * Regras (as mesmas da memória, e mais duas):
 *   - **validade de 10 minutos**, a de hoje: quem tem cadastro vê o mesmo conteúdo, com a mesma frescura;
 *   - **só leitura sem sessão**: o que se guarda é lido com a chave de serviço, sem cookie, e o recorte por nível
 *     (`relatorioSemNomes`, `relatorioDoNivel`) é aplicado depois, a cada pedido, sobre o que voltou do cache;
 *   - **falha não se guarda**: leitura com fonte faltando, erro ou "não ativado" voltam ao chamador sem ficar;
 *   - **o que não volta igual do JSON não se guarda**: o cache guarda texto JSON, e `Map`, `Set`, `Date`, `NaN` ou
 *     `Infinity` voltariam outra coisa (um `NaN` que volta `null` derruba um `toLocaleString`);
 *   - **item de até 2 MB**, medido como o Next mede: o que passa fica de fora (a página segue, lida do banco).
 *
 * A chave leva a implantação (a publicação da Vercel): o Runtime Cache sobrevive às publicações, e uma publicação nova
 * não pode ler objeto no formato da antiga. É o mesmo efeito da memória de hoje, que começa vazia a cada publicação.
 */
import type { CamadaCompartilhada } from "./memoria.ts";

/** A validade de hoje (`memoria.ts`, 06/10/2026): as fontes mudam uma vez por dia; 10 minutos não escondem nada. */
export const VALIDADE_DADOS_S = 600;
export const VALIDADE_DADOS_MS = VALIDADE_DADOS_S * 1000;

/**
 * A falta com validade curta (onda 8, B, 09/10/2026; R2 de 09/10, §5.1 item 6): a leitura com uma fonte fora do ar fica
 * 1 minuto na memória da instância (`criarMemoria`, opção `falta`), e não zero, para que a fonte fora do ar não faça cada
 * visita reler o pacote inteiro. Nunca vai ao cache compartilhado: a regra dele (`leituraGuardavel`) continua a recusá-la.
 * 1 minuto cabe no "tente de novo em alguns minutos" que a página já diz quando uma fonte falha.
 */
export const VALIDADE_FALTA_MS = 60 * 1000;

/**
 * A falta do relatório (município e entidade): a leitura chegou inteira, mas com uma fonte em `faltas`. É o complemento
 * exato de `leituraGuardavel` entre as leituras "ok"; erro, "não ativado" e "sem execução" não são falta e não ficam.
 */
export function leituraComFalta(l: { estado: string; relatorio?: { faltas: readonly string[] } }): boolean {
  return l.estado === "ok" && (l.relatorio?.faltas.length ?? 0) > 0;
}

/** Sobe quando o formato do envelope muda. */
export const VERSAO_CACHE = "1";

/** A etiqueta de tudo o que este cache guarda: um `revalidateTag` nela limpa o cache do Mapa inteiro. */
export const ETIQUETA_DADOS = "mapa-dados";

/**
 * O limite do Next para um item do cache de dados (`incremental-cache/index.js`: "items over 2MB can not be cached"),
 * contado como ele conta: o tamanho em caracteres do JSON do registro inteiro. Com uma folga para o que a Vercel põe
 * em volta. Maior que isso, o Next só avisa e não guarda (em desenvolvimento, lança): aqui nem se tenta.
 */
export const LIMITE_ITEM = 2 * 1024 * 1024;
export const FOLGA_ITEM = 16 * 1024;

/** A partir daqui o servidor registra o tamanho no log, para ver em produção quem chega perto do limite. */
export const AVISO_ITEM = 1024 * 1024;

/** As etiquetas de um leitor: a geral e a dele ("mapa-dados-municipio"). Sem vírgula, que a Vercel não aceita. */
export function etiquetasDoLeitor(leitor: string): string[] {
  return [ETIQUETA_DADOS, `${ETIQUETA_DADOS}-${leitor.replace(/[^0-9A-Za-z_-]/g, "_")}`];
}

/**
 * A publicação em que o servidor roda: o id da implantação da Vercel, ou o commit, ou "local" (desenvolvimento e
 * testes). Recebe o ambiente para ficar pura.
 */
export function implantacaoDe(env: Record<string, string | undefined>): string {
  return env.VERCEL_DEPLOYMENT_ID || env.VERCEL_GIT_COMMIT_SHA || "local";
}

/**
 * A chave no cache compartilhado: a versão do envelope, a publicação, o leitor e a chave do leitor — a mesma da
 * memória da instância, que já separa as leituras (IBGE, CNPJ, UF, o dia de Brasília, a execução do painel quando ela
 * já está à mão, a leitura pública ou a completa). Nada de quem visita entra nela, porque nada de quem visita entra
 * na leitura.
 */
export function chaveDoCache(leitor: string, chave: string, implantacao: string): string {
  return [ETIQUETA_DADOS, `v${VERSAO_CACHE}`, implantacao, leitor, chave].join("|");
}

/**
 * O primeiro ponto do valor que não volta igual do JSON, como caminho ("$.janelas", "$.relatorio.achados[3].peso"), ou
 * null quando volta igual. Campo `undefined` em objeto pode (some no JSON e volta `undefined` ao ler); em lista, não
 * (volta `null`).
 */
export function perdaNoJson(valor: unknown, caminho = "$"): string | null {
  if (valor === null || typeof valor === "string" || typeof valor === "boolean") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? null : caminho;
  if (typeof valor !== "object") return caminho; // undefined solto, função, bigint, symbol
  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i++) {
      if (valor[i] === undefined) return `${caminho}[${i}]`;
      const p = perdaNoJson(valor[i], `${caminho}[${i}]`);
      if (p) return p;
    }
    return null;
  }
  const proto = Object.getPrototypeOf(valor);
  if (proto !== Object.prototype && proto !== null) return caminho; // Map, Set, Date, classe
  for (const [k, v] of Object.entries(valor)) {
    if (v === undefined) continue;
    const p = perdaNoJson(v, `${caminho}.${k}`);
    if (p) return p;
  }
  return null;
}

/** O que o cache guarda: o valor e quando ele foi lido do banco, para a memória da instância contar a validade dali. */
export interface Envelope {
  v: string;
  desde: number;
  valor: unknown;
}

/** O tamanho do item como o Next o mede antes de guardar (`JSON.stringify` do registro com o corpo já em texto). */
export function tamanhoNoCache(corpo: string): number {
  return JSON.stringify({ kind: "FETCH", data: { headers: {}, body: corpo, status: 200, url: "" }, revalidate: VALIDADE_DADOS_S }).length;
}

export type Guarda =
  | { guardar: true; envelope: Envelope; tamanho: number }
  | { guardar: false; motivo: "falha" }
  | { guardar: false; motivo: "perda"; onde: string }
  | { guardar: false; motivo: "grande"; tamanho: number };

/**
 * Se a leitura vai para o cache compartilhado. `guardavel` é a regra do leitor (a de `leituraGuardavel`, ou "ok e sem
 * faltas"); `paraGuardar`, quando há, troca o que não cabe no JSON (o `Map` das janelas do Brasil) por algo que cabe.
 */
export function decidirGuarda<T>(valor: T, o: { guardavel: (v: T) => boolean; desde: number; paraGuardar?: (v: T) => unknown; limite?: number }): Guarda {
  if (!o.guardavel(valor)) return { guardar: false, motivo: "falha" };
  const guardado = o.paraGuardar ? o.paraGuardar(valor) : valor;
  const onde = perdaNoJson(guardado);
  if (onde) return { guardar: false, motivo: "perda", onde };
  const envelope: Envelope = { v: VERSAO_CACHE, desde: o.desde, valor: guardado };
  const tamanho = tamanhoNoCache(JSON.stringify(envelope));
  if (tamanho > (o.limite ?? LIMITE_ITEM - FOLGA_ITEM)) return { guardar: false, motivo: "grande", tamanho };
  return { guardar: true, envelope, tamanho };
}

/** O envelope que voltou do cache, ou null se não é um (chave de outro formato): a leitura vai ao banco. */
export function abrirEnvelope(x: unknown): Envelope | null {
  if (!x || typeof x !== "object") return null;
  const e = x as Partial<Envelope>;
  if (e.v !== VERSAO_CACHE || typeof e.desde !== "number" || !Number.isFinite(e.desde) || !("valor" in e)) return null;
  return e as Envelope;
}

// ================================================================ a camada (o caminho de uma leitura)

/**
 * O formato do `unstable_cache` do Next: embrulha uma função sem argumentos com as partes da chave, a validade (em
 * segundos) e as etiquetas. Fica injetado para o caminho ser testado sem o Next (`cache-dados.test.ts`).
 */
export type Cachear = (ler: () => Promise<unknown>, partes: string[], opcoes: { revalidate: number; tags: string[] }) => () => Promise<unknown>;

/** O erro que leva para fora do cache a leitura que não se guarda: lançado dentro, apanhado fora, nunca guardado. */
const NAO_GUARDAR = "naoGuardarNoCacheDeDados";

function ehNaoGuardar(e: unknown): boolean {
  return typeof e === "object" && e !== null && NAO_GUARDAR in e;
}

/**
 * A camada compartilhada de um leitor, para a `criarMemoria` (`compartilhada`). O caminho de uma leitura:
 *   1. o cache tem a chave dentro da validade: o valor dele, com o `desde` de quando foi lido do banco;
 *   2. não tem: lê do banco; se a leitura se guarda (`decidirGuarda`), o cache a guarda; senão, a função lança dentro
 *      do cache (que não guarda o que lança) e a leitura volta ao chamador por fora;
 *   3. tem, mas vencida: o Next devolveria o vencido e releria ao fundo. Aqui vale a releitura — a mesma, sem pedir
 *      duas vezes ao banco —, para a validade de 10 minutos ser de ponta a ponta, como a da memória de hoje;
 *   4. o próprio cache falha (fora do Next, nos testes, ou fora do ar): lê do banco, como se ele não existisse.
 * Erro da leitura do banco sobe ao chamador, como antes.
 */
export function criarCamadaCompartilhada<T>(o: {
  leitor: string;
  cachear: Cachear;
  implantacao: string;
  guardavel: (valor: T) => boolean;
  paraGuardar?: (valor: T) => unknown;
  doGuardado?: (guardado: unknown) => T;
  agora?: () => number;
  avisar?: (mensagem: string) => void;
}): CamadaCompartilhada<T> {
  const agora = o.agora ?? Date.now;
  const avisar = o.avisar ?? ((m: string) => console.warn(m));
  return {
    async obter(chave, carregar) {
      const leitura: { carga: Promise<T> | null; desde: number } = { carga: null, desde: 0 };
      const carregarUmaVez = (): Promise<T> => {
        if (!leitura.carga) {
          leitura.carga = carregar().then((valor) => {
            leitura.desde = agora();
            return valor;
          });
        }
        return leitura.carga;
      };
      const doBanco = async () => ({ valor: await carregarUmaVez(), desde: leitura.desde });

      const ler = o.cachear(
        async () => {
          const valor = await carregarUmaVez();
          const g = decidirGuarda(valor, { guardavel: o.guardavel, desde: leitura.desde, paraGuardar: o.paraGuardar });
          if (!g.guardar) {
            if (g.motivo === "perda") avisar(`cache de dados (${o.leitor} ${chave}): não guardado, ${g.onde} não volta igual do JSON`);
            if (g.motivo === "grande") avisar(`cache de dados (${o.leitor} ${chave}): não guardado, ${g.tamanho} caracteres passam do limite do item`);
            throw Object.assign(new Error(`cache de dados: não guardar (${g.motivo})`), { [NAO_GUARDAR]: true });
          }
          if (g.tamanho > AVISO_ITEM) avisar(`cache de dados (${o.leitor} ${chave}): ${g.tamanho} caracteres guardados`);
          return g.envelope;
        },
        [chaveDoCache(o.leitor, chave, o.implantacao)],
        { revalidate: VALIDADE_DADOS_S, tags: etiquetasDoLeitor(o.leitor) },
      );

      let guardado: unknown;
      try {
        guardado = await ler();
      } catch (e) {
        // A leitura do banco correu: o valor dela (não guardado), ou o erro dela, que sobe como sempre.
        if (leitura.carga) return doBanco();
        if (!ehNaoGuardar(e)) avisar(`cache de dados (${o.leitor} ${chave}): lido sem o cache, ${e instanceof Error ? e.message : String(e)}`);
        return doBanco();
      }
      // A função rodou: era falta (2) ou item vencido relido ao fundo (3). Nos dois casos, a leitura nova.
      if (leitura.carga) return doBanco();
      const envelope = abrirEnvelope(guardado);
      if (!envelope) {
        avisar(`cache de dados (${o.leitor} ${chave}): item em outro formato, lido do banco`);
        return doBanco();
      }
      return { valor: o.doGuardado ? o.doGuardado(envelope.valor) : (envelope.valor as T), desde: envelope.desde };
    },
  };
}
