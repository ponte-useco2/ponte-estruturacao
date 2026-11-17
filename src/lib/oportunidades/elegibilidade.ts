/**
 * Elegibilidade e aderência — porte de `funding_intelligence/matching.py`.
 *
 * NO RADAR, isto roda uma vez, em tempo de geração, contra
 * `config/portfolios.json` — quatro carteiras que descrevem a própria Ponte. O
 * resultado vai impresso no arquivo, em `matching.ponte_score`. É o que faz do
 * catálogo um produto de um cliente só.
 *
 * AQUI, roda em tempo de leitura, contra a organização de quem está olhando.
 * É esse giro que permite servir aos quinze tipos de agente: a mesma janela é
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
import { canalDaOportunidade, type CanalV2, type OportunidadeV2 } from "./contrato-v2.ts";
import type { TipoAgente } from "./organizacao";

/** O mínimo que uma janela precisa expor para ser avaliada. */
export interface JanelaElegivel {
  tiposElegiveis: string[];
  /**
   * Contrato 2.2: quem entra só como parceira (participa, não propõe nem recebe).
   * Não abre o portão de proponente: dá à entidade o papel de parceira, à parte.
   */
  tiposParceiros?: string[];
  /**
   * Diagnóstico externo de 17/11/2026 (A01): na bolsa, quem se candidata e recebe é a pessoa; a instituição só entra
   * como vínculo dela. Como a parceira, não abre o portão de proponente. Ver `janelaDoV2`.
   */
  tiposVinculo?: string[];
  geografia: string[];
  /** Ids estáveis de `temas.ts`, já normalizados — ver `temasNormalizados`. */
  temas: string[];
  /**
   * Diagnóstico externo de 17/11/2026 (A02): a fonte, o canal e o título decidem o que se pode afirmar do território.
   * Sem eles, vale só a geografia, como antes.
   */
  fonte?: string;
  canal?: CanalV2 | null;
  titulo?: string;
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

/**
 * O papel de quem pergunta na janela. `parceira` é a porta que o contrato 2.2
 * abriu: a empresa no PPSUS, no PDIL de 2024 e na Chamada CNPq 30/2025 não propõe,
 * mas entra junto, com termo e contrapartida. Sem ele, o portão por tipo
 * escondia dela a porta que ela tem.
 */
export type Papel = "proponente" | "parceira" | "vinculo";

/**
 * Diagnóstico externo de 17/11/2026 (A02). O que se pode afirmar do território:
 *   confirmado      fonte de edital com geografia nacional ou da UF da entidade;
 *   nao_verificado  Transferegov: a UF consta porque o SICONV liberou o programa a ela (a quase todas, em geral),
 *                   não porque o objeto seja dela;
 *   incompativel    o título restringe a outro território (outro município, a RIDE do DF, o exterior).
 */
export type Territorio = "confirmado" | "nao_verificado" | "incompativel";

export interface Aderencia {
  elegivel: boolean;
  /** Null quando o tipo não entra de jeito nenhum. */
  papel: Papel | null;
  pontuacao: number;
  /** Em linguagem de gente, na ordem em que a tela mostra. */
  motivos: string[];
  /** A02. Null quando a geografia não alcança a entidade ou quando o tipo já a barrou. */
  territorio: Territorio | null;
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

/** O artigo da UF por extenso: "a Paraíba", "o Rio Grande do Norte", "São Paulo". */
const ARTIGO_DA_UF: Record<string, "a" | "o"> = {
  BA: "a", PB: "a",
  AC: "o", AP: "o", AM: "o", CE: "o", DF: "o", ES: "o", MA: "o", PA: "o", PR: "o", PI: "o", RJ: "o", RN: "o", RS: "o", TO: "o",
};

/** A sigla no meio da frase, com a preposição certa: "para a PB", "do RN", "de SP". */
export function ufNaFrase(uf: string, preposicao: "para" | "de"): string {
  const artigo = ARTIGO_DA_UF[uf];
  if (preposicao === "para") return artigo ? `para ${artigo} ${uf}` : `para ${uf}`;
  return artigo ? `d${artigo} ${uf}` : `de ${uf}`;
}

/** As fontes do Transferegov: o repositório do SICONV e os módulos novos (especiais, fundo a fundo, parcerias). */
export function ehDoTransferegov(fonte: string | undefined): boolean {
  return fonte === "transferegov" || (fonte?.startsWith("transferegov-") ?? false);
}

/** As UFs que a RIDE do Distrito Federal e Entorno abrange. */
const UFS_DA_RIDE = ["DF", "GO", "MG"];

/**
 * Diagnóstico externo de 17/11/2026 (A02). O motivo quando o título do programa do Transferegov restringe o objeto a
 * outro território; null quando não restringe ou quando não dá para afirmar (entidade sem UF). Os três padrões são os
 * do localizador do SICONV no catálogo de 16/11/2026: "Município de Caem/BA" (5600020260001), "(RIDE)"
 * (2220320260025) e "- Exterior –" (2220320260041). O exterior é um trecho entre traços, para "Comércio Exterior" não
 * cair aqui.
 */
export function foraDoTerritorio(janela: JanelaElegivel, quem: Perguntante): string | null {
  if (!ehDoTransferegov(janela.fonte) || !janela.titulo) return null;
  const titulo = janela.titulo;
  if (/[-–—]\s*(?:no\s+)?exterior\s*(?:[-–—(]|$)/iu.test(titulo)) return "fora do território: o objeto é no exterior";
  if (quem.uf === null) return null;
  const municipio = /[Mm]unic[íi]pio\s+d[eoa]s?\s+([^/–—]+?)\s*\/\s*([A-Z]{2})\b/u.exec(titulo.normalize("NFC"));
  if (municipio && municipio[2] !== quem.uf) {
    return `fora do território: o título restringe ao Município de ${municipio[1].trim()}/${municipio[2]}`;
  }
  if ((/\bRIDE\b/u.test(titulo) || /distrito federal e entorno/iu.test(titulo)) && !UFS_DA_RIDE.includes(quem.uf)) {
    return "fora do território: o título restringe à RIDE do Distrito Federal e Entorno";
  }
  return null;
}

/** Fora da lista: nem elegível, nem papel, nem pontos — e a tela conta à parte, como "fora do território". */
function barradaPeloTerritorio(motivo: string): Aderencia {
  return { elegivel: false, papel: null, pontuacao: 0, motivos: [motivo], territorio: "incompativel" };
}

export function avaliar(janela: JanelaElegivel, quem: Perguntante): Aderencia {
  if (!elegivel(janela, quem)) {
    // Parceira não é elegível como proponente e não ganha pontuação: a lista das
    // janelas da entidade continua sendo só a que ela pode propor. A tela mostra
    // as de parceira num bloco próprio, com o motivo dito.
    const parceira = janela.tiposParceiros?.includes(quem.tipo) ?? false;
    // A01: a instituição de vínculo da bolsa segue o mesmo desenho da parceira, num bloco próprio.
    const vinculo = !parceira && (janela.tiposVinculo?.includes(quem.tipo) ?? false);
    if (!parceira && !vinculo) return { elegivel: false, papel: null, pontuacao: 0, motivos: [], territorio: null };
    const fora = foraDoTerritorio(janela, quem);
    if (fora) return barradaPeloTerritorio(fora);
    return parceira
      ? { elegivel: false, papel: "parceira", pontuacao: 0, motivos: ["entra como parceira, não como proponente"], territorio: null }
      : {
          elegivel: false,
          papel: "vinculo",
          pontuacao: 0,
          motivos: ["a bolsa é do pesquisador; a sua entidade entra como instituição de vínculo"],
          territorio: null,
        };
  }

  const fora = foraDoTerritorio(janela, quem);
  if (fora) return barradaPeloTerritorio(fora);

  const motivos: string[] = [];
  let pontuacao = PESO_ELEGIBILIDADE;
  let territorio: Territorio | null = null;

  // O tipo entra como motivo sempre que a janela de fato o nomeia. Quando ela
  // não nomeia ninguém, passou pelo portão por omissão — e dizer "proponente
  // compatível" aí seria afirmar mais do que o dado sustenta.
  if (janela.tiposElegiveis.includes(quem.tipo)) {
    motivos.push("aceita o seu tipo de proponente");
  }

  // A02: os pontos continuam os do radar (a UF está na geografia), mas no Transferegov o texto diz só o que o dado
  // sustenta: o SICONV liberou o programa à UF, e isso não diz onde o objeto pode ser.
  if (alcancaGeografia(janela, quem)) {
    pontuacao += PESO_GEOGRAFIA;
    const nacional = janela.geografia.includes("BR");
    if (ehDoTransferegov(janela.fonte)) {
      territorio = "nao_verificado";
      const liberado =
        !nacional && quem.uf !== null ? `liberado ${ufNaFrase(quem.uf, "para")}` : "liberado para todo o país";
      motivos.push(`${liberado} no Transferegov; o território do objeto não foi verificado`);
    } else {
      territorio = "confirmado";
      motivos.push(nacional ? "abrangência nacional" : "território compatível");
    }
  }
  if (janela.canal === "beneficiario_especifico") motivos.push("só o proponente indicado pelo concedente");

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

  return { elegivel: true, papel: "proponente", pontuacao, motivos, territorio };
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

/** Quem se candidata à bolsa em nome próprio. Os demais tipos de uma bolsa são a instituição de vínculo. */
const TIPOS_PESSOA = ["pesquisador", "pessoa_fisica"];

/**
 * O instrumento `auxilio_pesquisa` só existe a partir do contrato 2.2. Antes, o radar marcava como `bolsa` também o
 * auxílio a projeto — o fixture de 10/09/2026 traz assim a `cnpq-24-2026` ("Apoio à Pesquisa..."), que no catálogo
 * de 16/11/2026 é `auxilio_pesquisa`. Num arquivo mais antigo, "bolsa" não basta para separar a pessoa da instituição.
 */
export function bolsaSeparaPessoa(versaoDoContrato: string | undefined): boolean {
  const [maior, menor] = String(versaoDoContrato ?? "").split(".").map((n) => Number.parseInt(n, 10));
  return maior > 2 || (maior === 2 && menor >= 2);
}

/**
 * Da oportunidade do contrato v2 para o que o motor avalia. O único ponto de
 * contato entre os dois: os temas chegam crus e saem normalizados aqui, para
 * nenhum chamador esquecer de normalizar.
 *
 * Diagnóstico externo de 17/11/2026 (A01): na bolsa com pesquisador ou pessoa física entre os tipos, os tipos
 * institucionais viram `tiposVinculo` — na `cnpq-33-2026` (Bolsas de Produtividade) o radar copiou os tipos da
 * instituição de vínculo, e empresa e OSC apareciam como proponentes. Vale só com a `versaoDoContrato` do arquivo
 * (`payload.version`) a partir de 2.2: ver `bolsaSeparaPessoa`. Sem a versão, a regra não se aplica.
 */
export function janelaDoV2(
  o: Pick<OportunidadeV2, "eligibility" | "themes"> &
    Partial<Pick<OportunidadeV2, "id" | "title" | "source" | "channel" | "instrument">>,
  versaoDoContrato?: string,
): JanelaElegivel {
  const tipos = o.eligibility.organization_types;
  const daPessoa =
    o.instrument?.type === "bolsa" && bolsaSeparaPessoa(versaoDoContrato) && tipos.some((t) => TIPOS_PESSOA.includes(t));
  return {
    tiposElegiveis: daPessoa ? tipos.filter((t) => TIPOS_PESSOA.includes(t)) : tipos,
    tiposParceiros: o.eligibility.partner_types ?? [],
    tiposVinculo: daPessoa ? tipos.filter((t) => !TIPOS_PESSOA.includes(t)) : [],
    geografia: o.eligibility.geography,
    temas: temasNormalizados(o.themes),
    fonte: o.source?.id,
    canal: o.id !== undefined && o.source !== undefined ? canalDaOportunidade({ id: o.id, source: o.source, channel: o.channel }) : (o.channel ?? null),
    titulo: o.title,
  };
}
