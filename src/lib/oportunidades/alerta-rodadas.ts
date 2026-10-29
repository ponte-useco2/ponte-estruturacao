/**
 * Os dois avisos de operação que não dependem do resumo diário (A4-01 e A4-02 da investigação do portal, 29/10/2026).
 *
 * Até aqui, o único alerta ia dentro do e-mail "o que mudou", que só sai quando o painel termina e há mudança: uma
 * rodada que falhava, ou que nem começava (a cobrança do GitHub parou cinco workflows entre 08 e 22/10), passava em
 * silêncio. Agora:
 *   - **falha** (A4-01): o último passo de cada workflow agendado, com `if: failure()`, chama `/api/rodadas/falha`, e os
 *     administradores recebem o nome do workflow e o link da execução;
 *   - **saúde diária** (A4-02): um cron da Vercel chama `/api/rodadas/saude` uma vez por dia, e o e-mail sai sempre,
 *     em dia ou não. O silêncio passa a querer dizer que o próprio aviso falhou.
 *
 * Aqui só a montagem (pura, com teste). O que chega do workflow é conferido antes de entrar no e-mail: nome curto e só
 * com letras, números e pontuação simples; link só de execução do repositório do monorepo.
 */
import { escapar, fraseNaoLidas, fraseRodadasNoPe, linhaRodada, tituloRodadas, urlRodadas, type BlocoRodadas } from "./resumo-diario.ts";

export interface EmailOperacao {
  assunto: string;
  texto: string;
  html: string;
}

/** O repositório cujos workflows podem avisar. Outro endereço no corpo é recusado. */
export const REPOSITORIO_RODADAS = "siteponte/ponte-oportunidades";

const URL_EXECUCAO = new RegExp(`^https://github\\.com/${REPOSITORIO_RODADAS.replace("/", "\\/")}/actions/runs/\\d{1,20}(/attempts/\\d{1,4})?$`);
const NOME_SEGURO = /^[\p{L}\p{N} ._()\-/]{1,80}$/u;

export interface FalhaRodada {
  workflow: string;
  job: string;
  execucao: string;
  /** `schedule`, `workflow_dispatch`, `push`…: quem disparou. */
  evento: string;
}

/** O corpo que o passo do workflow manda, conferido; `null` quando algo não passa. */
export function lerFalhaRodada(corpo: unknown): FalhaRodada | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  const texto = (k: string) => (typeof c[k] === "string" ? (c[k] as string).trim() : "");
  const f = { workflow: texto("workflow"), job: texto("job"), execucao: texto("execucao"), evento: texto("evento") || "não informado" };
  if (!NOME_SEGURO.test(f.workflow) || !NOME_SEGURO.test(f.job) || !NOME_SEGURO.test(f.evento)) return null;
  if (!URL_EXECUCAO.test(f.execucao)) return null;
  return f;
}

/** O e-mail da falha: curto, com o link da execução e o da tela das rodadas. `quando` é a hora de Brasília já escrita. */
export function montarAlertaFalha(f: FalhaRodada, quando: string, urlBase: string): EmailOperacao {
  const assunto = `[PONTE] Rodada com falha · ${f.workflow}`;
  const rodadas = urlRodadas(urlBase);
  const texto = [
    `A rodada "${f.workflow}" (job ${f.job}) terminou com falha em ${quando}.`,
    `Disparo: ${f.evento}.`,
    "",
    `Execução no GitHub: ${f.execucao}`,
    `Saúde das rodadas: ${rodadas}`,
    "",
    "O dado da rodada anterior continua no ar: uma rodada que falha não apaga o que já estava publicado.",
  ].join("\n");
  const html = [
    `<p style="margin:0 0 12px">A rodada <strong>${escapar(f.workflow)}</strong> (job ${escapar(f.job)}) terminou com <strong style="color:#b91c1c">falha</strong> em ${escapar(quando)}. Disparo: ${escapar(f.evento)}.</p>`,
    `<p style="margin:0 0 12px"><a href="${escapar(f.execucao)}">Abrir a execução no GitHub</a> · <a href="${escapar(rodadas)}">Saúde das rodadas</a></p>`,
    `<p style="margin:0;color:#475569;font-size:13px">O dado da rodada anterior continua no ar: uma rodada que falha não apaga o que já estava publicado.</p>`,
  ].join("\n");
  return { assunto, texto, html };
}

/**
 * O e-mail diário da saúde das rodadas. Sai sempre: "em dia" também é notícia, porque o silêncio deixa de ser ambíguo.
 * `dia` é a data de Brasília já escrita (DD/MM/AAAA).
 */
export function montarSaudeDiaria(b: BlocoRodadas, dia: string, urlBase: string): EmailOperacao {
  const rodadas = urlRodadas(urlBase);
  if (b.tipo === "com_problema") {
    const titulo = tituloRodadas(b);
    const naoLidas = fraseNaoLidas(b.naoLidas);
    const linhas = b.problemas.map(linhaRodada);
    return {
      assunto: `[PONTE] Rodadas em ${dia}: ${titulo}`,
      texto: [`${titulo}:`, ...linhas, ...(naoLidas ? ["", naoLidas] : []), "", `Saúde das rodadas: ${rodadas}`].join("\n"),
      html: [
        `<p style="margin:0 0 8px"><strong>${escapar(titulo)}</strong></p>`,
        `<ul style="margin:0 0 12px;padding-left:18px">${linhas.map((l) => `<li>${escapar(l)}</li>`).join("")}</ul>`,
        naoLidas ? `<p style="margin:0 0 12px;color:#475569">${escapar(naoLidas)}</p>` : "",
        `<p style="margin:0"><a href="${escapar(rodadas)}">Saúde das rodadas</a></p>`,
      ].join("\n"),
    };
  }
  const frase = fraseRodadasNoPe(b);
  const resumo = b.tipo === "falhou" ? "leitura falhou" : b.naoLidas.length ? "em dia, com rodada não lida" : "em dia";
  return {
    assunto: `[PONTE] Rodadas em ${dia}: ${resumo}`,
    texto: [frase, "", `Saúde das rodadas: ${rodadas}`].join("\n"),
    html: [`<p style="margin:0 0 12px">${escapar(frase)}</p>`, `<p style="margin:0"><a href="${escapar(rodadas)}">Saúde das rodadas</a></p>`].join("\n"),
  };
}
