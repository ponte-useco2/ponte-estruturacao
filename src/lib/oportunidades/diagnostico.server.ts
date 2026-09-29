/**
 * Leitura do laudo de qualquer instrumento (onda 12) — só servidor, só chave de serviço.
 *
 * Quem decide se a pessoa pode ver é a página (só administradores, como o laudo da suspensiva). As
 * tabelas `painel_*` e `fiscal_*` não aceitam `anon` nem `authenticated`.
 *
 * A linha do instrumento é o laudo: sem ela, não há página. Todo o resto é cruzamento e falha sozinho
 * — a leitura que cair entra em `faltas` e o laudo sai sem ela, dizendo o que faltou.
 *
 * Volume, no painel de 26/09/2026: pares do programa na UF e carteira do proponente cabem em uma ou
 * duas páginas de mil linhas (o Estado da PB tem ~150 instrumentos); o resto são dezenas de linhas.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { alcancaAssunto, montarCatalogo } from "./catalogo-v2";
import { lerCatalogo, lerCatalogoV2 } from "./catalogo.server";
import { codigosPorJanela } from "./codigos-transferegov";
import {
  COLUNAS_VIZINHO,
  chaveOrgao,
  portaRelevante,
  type EmendaOrigem,
  type EntradaDiagnostico,
  type InstrumentoLaudo,
  portaServe,
  type PortaAberta,
  type Vizinho,
} from "./diagnostico";
import { ehEsquemaAusente } from "./esquema";
import { lerResumoFiscal } from "./fiscal.server";
import { lerFornecedoresDoConvenio } from "./fornecedores.server";
import type { TipoAgente } from "./organizacao";
import type { LinhaDesfecho, LinhaEtapa } from "./painel";
import { todas } from "./padroes.server";

type Falha = { estado: "nao_ativado" } | { estado: "sem_execucao" } | { estado: "erro" };
type Resposta = { data: unknown; error: { message: string; code?: string } | null };

export interface ExecucaoPainel {
  id: number;
  dado_ate: string;
  referencia: string;
}

export type LeituraDiagnostico =
  | Falha
  | { estado: "nao_encontrado"; execucao: ExecucaoPainel }
  | { estado: "ok"; execucao: ExecucaoPainel; entrada: EntradaDiagnostico };

function falha(onde: string, erro: { message: string; code?: string }): Falha {
  if (ehEsquemaAusente(erro.code)) return { estado: "nao_ativado" };
  console.error(`${onde}:`, erro.message);
  return { estado: "erro" };
}

/** Uma consulta de complemento: erro vira `null` e uma linha em `faltas`, nunca a página inteira. */
async function parte<T>(faltas: string[], nome: string, consulta: () => PromiseLike<Resposta>): Promise<T[] | null> {
  const r = await consulta();
  if (r.error) {
    // Tabela ou coluna que ainda não existe (oport_19 não aplicada) é esperado: só registra a falta.
    if (!ehEsquemaAusente(r.error.code)) console.error(`laudo do instrumento (${nome}):`, r.error.message);
    faltas.push(nome);
    return null;
  }
  return (r.data ?? []) as T[];
}

async function paginas<T>(faltas: string[], nome: string, consulta: (inicio: number, fim: number) => PromiseLike<Resposta>): Promise<T[] | null> {
  const r = await todas<T>(`laudo do instrumento (${nome})`, consulta);
  if (Array.isArray(r)) return r;
  faltas.push(nome);
  return null;
}

/**
 * Janelas abertas em que o proponente pode entrar (tipo de proponente e UF), marcadas pelo que as liga
 * ao instrumento. Quem entra no laudo é decidido por `portaRelevante` (mesmo programa ou mesmo órgão).
 */
export async function portasAbertas(i: InstrumentoLaudo, hoje: string, faltas: string[]): Promise<PortaAberta[] | null> {
  try {
    const [v2, v1] = await Promise.all([lerCatalogoV2(), lerCatalogo()]);
    if (v2.estado !== "ok") {
      faltas.push("janelas abertas");
      return null;
    }
    const codigos = v1 ? codigosPorJanela(v2.payload, v1) : new Map<string, string[]>();
    const quem = { tipo: (i.tipo_agente ?? "outros") as TipoAgente, uf: i.uf, temas: [] };
    const catalogo = montarCatalogo(v2.payload, quem, hoje, codigos);
    const temas = i.temas ?? [];
    const orgao = chaveOrgao(i.orgao_sup);
    return catalogo.janelas
      .map((j) => ({
        id: j.id,
        titulo: j.titulo,
        financiador: j.financiador,
        prazo: j.prazo,
        diasRestantes: j.diasRestantes,
        fonteNome: j.fonteNome,
        fonteUrl: j.fonteUrl,
        codigos: j.codigos,
        mesmoPrograma: !!i.cod_programa && j.codigos.includes(i.cod_programa),
        mesmoOrgao: !!orgao && chaveOrgao(j.financiador) === orgao,
        mesmoTema: temas.length > 0 && alcancaAssunto(j.temas, temas),
        canal: j.canal,
      }))
      .filter((p) => portaRelevante(p) && portaServe(p, i.municipio));
  } catch (e) {
    console.error("laudo do instrumento (janelas abertas):", e instanceof Error ? e.message : e);
    faltas.push("janelas abertas");
    return null;
  }
}

/** O laudo do cliente (onda 12, parte 3): o que ele não mostra, não se lê. */
export interface OpcoesLeitura {
  /** Não lê as empresas do convênio (nomes de fornecedor são só de administrador). */
  semFornecedores?: boolean;
  /** Não lê o painel fiscal (o MVP fiscal é só de administrador). */
  semFiscal?: boolean;
  /**
   * Confere o instrumento antes de qualquer cruzamento. Recusado, a leitura volta "não encontrado":
   * quem não pode ver não fica sabendo se o número existe.
   */
  podeVer?: (i: InstrumentoLaudo) => boolean;
}

/** Tudo o que o laudo de um instrumento cruza, da última execução concluída do painel. */
export async function lerEntradaDiagnostico(
  numero: string,
  hoje: string,
  { semFornecedores = false, semFiscal = false, podeVer }: OpcoesLeitura = {},
): Promise<LeituraDiagnostico> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();

  const ultima = await db.rpc("painel_ultima_execucao");
  if (ultima.error) return falha("lerEntradaDiagnostico (execução)", ultima.error);
  const execucao = (ultima.data as ExecucaoPainel[] | null)?.[0];
  if (!execucao) return { estado: "sem_execucao" };

  const linha = await db.from("painel_instrumento").select("*").eq("execucao_id", execucao.id).eq("nr_convenio", numero).limit(1);
  if (linha.error) return falha("lerEntradaDiagnostico (instrumento)", linha.error);
  const i = (linha.data as InstrumentoLaudo[] | null)?.[0];
  if (!i || (podeVer && !podeVer(i))) return { estado: "nao_encontrado", execucao };

  const faltas: string[] = [];
  const recortes = i.uf && i.uf !== "BR" ? [i.uf, "BR"] : ["BR"];
  const nada = <T,>(): Promise<T[] | null> => Promise.resolve([]);

  const [etapasOrgao, etapasPrograma, desfechos, pares, carteira, emendas, fiscal, portas, fornecedores] = await Promise.all([
    i.orgao_sup
      ? parte<LinhaEtapa>(faltas, "tempos do órgão", () =>
          db.from("painel_etapa_tempo").select("*").eq("execucao_id", execucao.id).eq("dimensao", "orgao").eq("chave", i.orgao_sup as string).in("recorte", recortes).limit(100),
        )
      : nada<LinhaEtapa>(),
    i.cod_programa
      ? parte<LinhaEtapa>(faltas, "tempos do programa", () =>
          db.from("painel_etapa_tempo").select("*").eq("execucao_id", execucao.id).eq("dimensao", "programa").eq("chave", i.cod_programa as string).in("recorte", recortes).limit(100),
        )
      : nada<LinhaEtapa>(),
    i.cod_programa
      ? parte<LinhaDesfecho>(faltas, "funil do programa", () =>
          db.from("painel_programa_desfecho").select("*").eq("execucao_id", execucao.id).eq("cod_programa", i.cod_programa as string).in("uf", recortes).limit(500),
        )
      : nada<LinhaDesfecho>(),
    i.cod_programa && i.uf
      ? paginas<Vizinho>(faltas, "pares do programa", (a, b) =>
          db
            .from("painel_instrumento")
            .select(COLUNAS_VIZINHO)
            .eq("execucao_id", execucao.id)
            .eq("cod_programa", i.cod_programa as string)
            .eq("uf", i.uf as string)
            .order("nr_convenio")
            .range(a, b),
        )
      : Promise.resolve(null),
    i.cnpj
      ? paginas<Vizinho>(faltas, "carteira do proponente", (a, b) =>
          db.from("painel_instrumento").select(COLUNAS_VIZINHO).eq("execucao_id", execucao.id).eq("cnpj", i.cnpj as string).order("nr_convenio").range(a, b),
        )
      : Promise.resolve(null),
    parte<EmendaOrigem>(faltas, "emenda de origem", () =>
      db
        .from("painel_instrumento_emenda")
        .select("nr_emenda,parlamentar,tipo_parlamentar,impositiva,valor")
        .eq("execucao_id", execucao.id)
        .eq("nr_convenio", numero)
        .order("nr_emenda")
        .limit(100),
    ),
    !semFiscal && i.tipo_agente === "municipio" && i.uf === "PB" && i.cod_ibge ? lerResumoFiscal(i.cod_ibge) : Promise.resolve(null),
    portasAbertas(i, hoje, faltas),
    // Fornecedores só na PB (o job só grava os de lá), para administradores (onda 12, parte 3).
    i.uf === "PB" && !semFornecedores ? lerFornecedoresDoConvenio(db, execucao.id, i, faltas) : Promise.resolve(undefined),
  ]);

  return {
    estado: "ok",
    execucao,
    entrada: {
      instrumento: i,
      etapas: [...(etapasOrgao ?? []), ...(etapasPrograma ?? [])],
      desfechos: desfechos ?? [],
      pares,
      carteira,
      emendas,
      fiscal,
      portas,
      fornecedores,
      faltas,
    },
  };
}
