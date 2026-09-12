/**
 * Elegibilidade e aderência — porte de `funding_intelligence/matching.py`.
 *
 * NO RADAR, isto roda uma vez, em tempo de geração, contra
 * `config/portfolios.json` — quatro carteiras que descrevem a própria Ponte. O
 * resultado vai impresso no arquivo, em `matching.ponte_score`. É o que faz do
 * catálogo um produto de um cliente só.
 *
 * AQUI, roda em tempo de leitura, contra a organização de quem está olhando.
 * É esse giro que permite servir aos doze tipos de agente: a mesma janela é
 * elegível para um município e não é para uma empresa, e a resposta depende de
 * quem pergunta, não de quem gerou o arquivo.
 *
 * O campo `matching` do v2 é IGNORADO de propósito. Ele responde "a Ponte se
 * encaixa?", que não é a pergunta de nenhum assinante — nem da própria Ponte
 * quando ela for cliente de si mesma, porque aí ela terá organização declarada
 * como qualquer outro.
 *
 * OS PESOS SÃO OS MESMOS DO RADAR (40 / 20 / 40), de caso pensado. Se os dois
 * lados discordarem do que é aderente, a mesma janela aparece destacada num
 * lugar e apagada no outro, e ninguém descobre por quê.
 */
import { TEMAS, paiDe, temaDeCadeia } from "./temas.ts";
import type { TipoAgente } from "./organizacao";

/** O mínimo que uma janela precisa expor para ser avaliada. */
export interface JanelaElegivel {
  tiposElegiveis: string[];
  geografia: string[];
  /** Ids estáveis de `temas.ts`, já normalizados — ver `temasNormalizados`. */
  temas: string[];
}

/** Quem pergunta. A geografia vem da entidade; os temas, da pessoa. */
export interface Perguntante {
  tipo: TipoAgente;
  uf: string | null;
  /** Preferência PESSOAL de acompanhamento — ver a decisão em oport_6. */
  temas: string[];
}

export const PESO_ELEGIBILIDADE = 40;
export const PESO_GEOGRAFIA = 20;
export const PESO_TEMA_POR_ACERTO = 15;
export const PESO_TEMA_MAXIMO = 40;

/** Abaixo disto o radar não considera relevante. Mesmo corte, mesma razão. */
export const CORTE_RELEVANTE = 40;

/**
 * O portão duro: sem sobreposição de tipo de proponente, não há pontuação que
 * compense. Uma empresa não vira município por combinar em tema.
 *
 * Janela sem `organization_types` seria portão indefinido. No catálogo de
 * 10/09/2026 isso não acontece em nenhuma das 171 — mas se acontecer, o certo é
 * NÃO barrar: uma janela sem elegibilidade declarada é dado incompleto, e
 * esconder por dado incompleto é pior do que mostrar com ressalva.
 */
export function elegivel(janela: JanelaElegivel, quem: Perguntante): boolean {
  if (janela.tiposElegiveis.length === 0) return true;
  return janela.tiposElegiveis.includes(quem.tipo);
}

export interface Aderencia {
  elegivel: boolean;
  pontuacao: number;
  /** Em linguagem de gente, na ordem em que a tela mostra. */
  motivos: string[];
}

/**
 * "BR" na janela significa abrangência nacional: vale para qualquer UF, e
 * também para quem não declarou a sua.
 */
function alcancaGeografia(janela: JanelaElegivel, quem: Perguntante): boolean {
  if (janela.geografia.includes("BR")) return true;
  if (quem.uf === null) return false;
  return janela.geografia.includes(quem.uf);
}

export function avaliar(janela: JanelaElegivel, quem: Perguntante): Aderencia {
  if (!elegivel(janela, quem)) {
    return { elegivel: false, pontuacao: 0, motivos: [] };
  }

  const motivos: string[] = [];
  let pontuacao = PESO_ELEGIBILIDADE;

  // O tipo entra como motivo sempre que a janela de fato o nomeia. Quando ela
  // não nomeia ninguém, passou pelo portão por omissão — e dizer "proponente
  // compatível" aí seria afirmar mais do que o dado sustenta.
  if (janela.tiposElegiveis.includes(quem.tipo)) {
    motivos.push("aceita o seu tipo de proponente");
  }

  if (alcancaGeografia(janela, quem)) {
    pontuacao += PESO_GEOGRAFIA;
    motivos.push(janela.geografia.includes("BR") ? "abrangência nacional" : "território compatível");
  }

  // Conta FAMÍLIAS de assunto, não etiquetas. Uma família é um assunto de
  // primeiro nível mais os seus subtemas.
  //
  // O alcance é hierárquico: quem segue Inovação alcança a janela marcada só
  // como `bioeconomia`. Mas pai e filho são o mesmo conceito em duas
  // granularidades, e contá-los em separado inflaria a nota. O caso real que
  // pegou isso: `cnpq-24-2026` vem marcada com `inovacao` E `biotecnologia`, e
  // quem segue Inovação ganhava dois acertos pela mesma ideia — 90 em vez de 75.
  //
  // Irmãos NÃO se alcançam: seguir `bioeconomia` não traz `descarbonizacao`,
  // mesmo sendo as duas filhas de Inovação.
  //
  // Para assunto sem hierarquia, família é o próprio assunto e alcance é
  // igualdade — e a conta fica idêntica à interseção de `matching.py`. É o que
  // mantém a paridade com o radar onde o radar tem opinião.
  const familias = new Set<string>();
  for (const t of janela.temas) {
    const pai = paiDe(t);
    const alcancada = quem.temas.includes(t) || (pai !== null && quem.temas.includes(pai));
    if (alcancada) familias.add(pai ?? t);
  }
  const acertos = familias.size;
  if (acertos > 0) {
    pontuacao += Math.min(PESO_TEMA_MAXIMO, PESO_TEMA_POR_ACERTO * acertos);
    motivos.push(`combina em ${acertos === 1 ? "1 assunto" : `${acertos} assuntos`}`);
  }

  return { elegivel: true, pontuacao, motivos };
}

export function relevante(a: Aderencia): boolean {
  return a.elegivel && a.pontuacao >= CORTE_RELEVANTE;
}

/**
 * Descarta o que o v2 chama de tema e não é: o TÍTULO DA CHAMADA, slugificado.
 *
 * Exemplos reais do catálogo de 10/09/2026:
 *   5a_chamada_publica_conjunta_finep_e_conselho_noruegues_de_pesquisa_rcn
 *   finep_mais_inovacao_brasil_rodada_2_semicondutores
 *   carta_convite_mcti_finep_fndct_promocao_da_autonomia_tecnologica_na_area_da_defesa
 *
 * O corte é por número de segmentos, e o valor não foi escolhido a dedo: a
 * distribuição dos 49 temas distintos do catálogo de 10/09/2026 tem um VÃO
 * LIMPO em 6. De 1 a 5 segmentos são 38 temas, todos assunto de verdade — o
 * maior é `meio_ambiente_agua_e_clima`. De 7 a 13 são 11 temas, todos título de
 * chamada. Nenhum tem exatamente 6.
 *
 * É rede de segurança, não o portão principal: `temaDeCadeia` já devolve null
 * para o que nenhum radical conhece, e quase todo título cai aí. Isto evita o
 * caso restante — um título longo que POR ACASO começa com um radical
 * conhecido e seria lido como assunto.
 */
const MAX_SEGMENTOS_DE_ASSUNTO = 5;

export function ehTituloDisfarcadoDeTema(cadeia: string): boolean {
  return cadeia.split("_").length > MAX_SEGMENTOS_DE_ASSUNTO;
}

/**
 * Normaliza os temas do v2 para os ids estáveis de `temas.ts`.
 *
 * COBERTURA, medida no catálogo de 10/09/2026, depois da ampliação para dois
 * níveis: dos 49 temas distintos do v2, `temas.ts` alcança 36 — 129 das 142
 * ocorrências. As 13 restantes são títulos de chamada, descartados acima. Antes
 * da ampliação eram 7 temas e 40 ocorrências; o vocabulário tinha sido feito só
 * para o Transferegov.
 */
export function temasNormalizados(temasDoV2: string[] | undefined): string[] {
  if (!temasDoV2?.length) return [];

  const ids = new Set<string>();
  for (const bruto of temasDoV2) {
    if (ehTituloDisfarcadoDeTema(bruto)) continue;
    const id = temaDeCadeia(bruto);
    if (id) ids.add(id);
  }
  // Na ordem de `TEMAS`, não na do arquivo: a tela precisa de ordem estável.
  return TEMAS.filter((t) => ids.has(t.id)).map((t) => t.id);
}

/**
 * Da oportunidade do contrato v2 para o que o motor avalia. O único ponto de
 * contato entre os dois: os temas chegam crus e saem normalizados aqui, para
 * nenhum chamador esquecer de normalizar.
 */
export function janelaDoV2(o: {
  eligibility: { organization_types: string[]; geography: string[] };
  themes: string[];
}): JanelaElegivel {
  return {
    tiposElegiveis: o.eligibility.organization_types,
    geografia: o.eligibility.geography,
    temas: temasNormalizados(o.themes),
  };
}
