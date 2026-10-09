/**
 * Pix, o ciclo em curso (oport_30, 07/10/2026): os planos de transferência especial do exercício com o plano de
 * trabalho pendente, de quem é a vez e o prazo do comunicado. O job (`pix_fundo/ciclo.py`) grava todo dia; aqui
 * só se apresenta. Em 2026, 18 planos da PB (R$ 12,8 mi) ficaram impedidos pela vez do ente: é isso que o alerta
 * quer evitar no ciclo seguinte.
 *
 * O prazo vem do comunicado do Transferegov, cadastrado à mão (`pix_fundo/prazos_ciclo.json`); sem ele, o texto
 * diz que o prazo não foi cadastrado, nunca inventa um. Função pura, sem banco e sem relógio.
 */
import { formatarData } from "./central.ts";
import type { ClasseFila, QuemResolve } from "./fila.ts";
import { semDadoPessoal } from "./mascara.ts";
import type { AnalisePtPix } from "./pix-laudo.ts";
import { moedaCurta } from "./radar.ts";

export interface PlanoCicloPix {
  id_plano_acao: number;
  codigo_plano_acao: string | null;
  ano: number;
  ciclo: number | null;
  beneficiario: string | null;
  cnpj: string | null;
  cod_ibge: string | null;
  autor: string | null;
  valor: number;
  situacao_plano: string | null;
  situacao_pt: string | null;
  desde: string | null;
  vez: "ente" | "orgao" | "a_conferir";
  etapa: string | null;
  prazo: string | null;
  prazo_fonte: string | null;
  ultima_analise: AnalisePtPix | null;
}

export function diasAte(prazo: string | null, hoje: string): number | null {
  if (!prazo) return null;
  const d = (Date.parse(`${prazo.slice(0, 10)}T00:00:00Z`) - Date.parse(`${hoje.slice(0, 10)}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(d) ? Math.round(d) : null;
}

export interface PontoCiclo {
  nivel: "alto" | "moderado" | "informativo";
  classe: ClasseFila;
  /** Ausente quando a leitura não sabe de quem é a vez (situação a conferir). */
  quem?: QuemResolve;
  prazo: string | null;
  titulo: string;
  fato: string;
  acao: string | null;
}

const plano = (p: PlanoCicloPix) => `plano ${p.codigo_plano_acao ?? p.id_plano_acao}${p.autor ? `, emenda de ${p.autor}` : ""}, ${moedaCurta(p.valor)}`;

function textoPrazo(p: PlanoCicloPix, hoje: string): string {
  const d = diasAte(p.prazo, hoje);
  if (!p.prazo || d === null) return " O prazo do comunicado ainda não foi cadastrado: conferir no Transferegov.";
  const fonte = p.prazo_fonte ? ` (${p.prazo_fonte})` : "";
  if (d < 0) return ` O prazo do comunicado${fonte} era ${formatarData(p.prazo)}: venceu há ${-d === 1 ? "1 dia" : `${-d} dias`}.`;
  if (d === 0) return ` O prazo do comunicado${fonte} vence hoje, ${formatarData(p.prazo)}.`;
  return ` O prazo do comunicado${fonte} é ${formatarData(p.prazo)}: ${d === 1 ? "falta 1 dia" : `faltam ${d} dias`}.`;
}

function textoAnalise(a: AnalisePtPix | null): string {
  if (!a) return "";
  const quem = a.orgao ?? "o órgão";
  const quando = a.data ? ` em ${formatarData(a.data)}` : "";
  const parecer = a.parecer && a.parecer !== "Não se aplica" ? ` (${a.parecer.toLowerCase()})` : "";
  const limpo = semDadoPessoal(a.trecho);
  const trecho = limpo ? `: «${limpo.length > 280 ? `${limpo.slice(0, 279)}…` : limpo}»` : ".";
  return ` Última análise, ${quem}${quando}${parecer}${trecho}`;
}

/**
 * Um ponto por plano. A vez do município é ALTA (sem resposta no prazo, o plano fica impedido e o dinheiro não
 * vem); a do órgão é informação; situação que o job não conhece é moderada, para alguém conferir.
 */
export function pontoDoCiclo(p: PlanoCicloPix, hoje: string): PontoCiclo {
  const desde = p.desde ? ` desde ${formatarData(p.desde)}` : "";
  const situacao = p.situacao_pt ? `O plano de trabalho está em «${p.situacao_pt}»${desde}` : "Ainda não há plano de trabalho cadastrado";
  if (p.vez === "ente") {
    const ate = p.prazo ? ` até ${formatarData(p.prazo)}` : "";
    return {
      nivel: "alto",
      classe: "prazo",
      quem: "municipio",
      prazo: p.prazo,
      titulo: `Pix em curso: o município precisa ${p.etapa ?? "responder no Transferegov"} (${plano(p)})`,
      fato: `${situacao}.${textoPrazo(p, hoje)} Sem resposta no prazo, o plano fica impedido e o dinheiro não vem.${textoAnalise(p.ultima_analise)}`,
      acao: `${(p.etapa ?? "responder").charAt(0).toUpperCase()}${(p.etapa ?? "responder").slice(1)} no Transferegov${ate}.`,
    };
  }
  if (p.vez === "orgao") {
    return {
      nivel: "informativo",
      classe: "atencao",
      quem: "orgao",
      prazo: null,
      titulo: `Pix em curso: plano em análise no órgão federal (${plano(p)})`,
      fato: `${situacao}; a vez é do órgão.${textoAnalise(p.ultima_analise)} Se o órgão pedir complementação, a vez volta ao município.`,
      acao: null,
    };
  }
  return {
    nivel: "moderado",
    classe: "atencao",
    prazo: null,
    titulo: `Pix em curso: situação a conferir (${plano(p)})`,
    fato: `${p.etapa ?? "Situação que a leitura automática não conhece"}. Conferir no Transferegov de quem é a vez.`,
    acao: null,
  };
}

/** Os planos em curso, da vez do município primeiro e, nela, do prazo mais próximo. */
export function ordenarCiclo(planos: PlanoCicloPix[]): PlanoCicloPix[] {
  const ordem = { ente: 0, a_conferir: 1, orgao: 2 } as const;
  return [...planos].sort((a, b) => ordem[a.vez] - ordem[b.vez] || (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999") || b.valor - a.valor);
}
