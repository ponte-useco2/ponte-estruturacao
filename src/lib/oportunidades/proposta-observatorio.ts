/**
 * Proposta do Observatório de Mobilidade Urbana de João Pessoa (16/11/2026). Lógica pura e testada; o conteúdo mora em
 * `app/sala/_salas/observatorio-mobilidade/dados.ts` e a página, em `Conteudo.tsx` e `Folha.tsx` (as duas leem o mesmo
 * objeto, sem segunda redação).
 *
 * Proposta da PONTE, para apreciação. Entidade executora prevista: Associação Ilha Tech (correção estratégica do
 * titular, 16/11/2026: não há aprovação institucional prévia da Ilha Tech, e a sala não atribui endosso a terceiros).
 *
 * TRÊS REGRAS DESTE MÓDULO (orientação do titular, 16/11/2026):
 *
 *  1. O tipo carrega o que ainda não se sabe. Um valor em elaboração não vira zero, nem estimativa, nem texto plausível:
 *     vira `{ estado: "em-elaboracao" }`, e a página diz "em elaboração" com todas as letras. Dinheiro é sempre em
 *     CENTAVOS INTEIROS; valor que não é inteiro positivo é rejeitado, nunca arredondado em silêncio. Estimativa só
 *     entra IDENTIFICADA: no campo próprio, com a natureza declarada (`Estimativa`), nunca como número solto no texto.
 *
 *  2. Nada de endosso emprestado. A proposta é da PONTE, para apreciação; a Ilha Tech aparece como entidade executora
 *     prevista, nunca como quem aprovou. Nenhum texto de apresentação diz que alguém aprovou, autorizou ou endossou
 *     (trava em `pendenciasDaApresentacao`). `prontidaoTecnica` é verificação interna de completude, não etapa de
 *     aprovação, e não aparece como processo na sala.
 *
 *  3. Três graus de evidência que nunca se misturam: `demonstrado` (resultado computacional já obtido), `previsto`
 *     (atividade a executar no projeto) e `hipotese` (expansão sem compromisso). A prova computacional preliminar não
 *     comprova rota acessível nem tempo real de caminhada: isso é `previsto`, e a página diz isso em texto.
 */

export type CodigoProduto = "P1" | "P2" | "P3" | "P4";
export const CODIGOS_PRODUTO: readonly CodigoProduto[] = ["P1", "P2", "P3", "P4"];

export type GrauDeEvidencia = "demonstrado" | "previsto" | "hipotese";

/** Dinheiro que pode ainda não existir. `centavos` é inteiro: R$ 1,00 = 100. */
export type Valor =
  | { estado: "definido"; centavos: number }
  | { estado: "em-elaboracao"; nota?: string };

/** Quantidade que pode ainda não existir (horas, meses, diárias, unidades…). */
export type Quantidade =
  | { estado: "definida"; valor: number }
  | { estado: "em-elaboracao"; nota?: string };

/**
 * Uma linha da composição do orçamento: o que se faz, em que unidade, quanto, por quanto, e para qual produto. O total da
 * linha é quantidade × valor unitário e tem de dar centavos inteiros.
 */
export interface ItemDeComposicao {
  atividade: string;
  /** Unidade de medida da quantidade: "hora", "mês", "diária", "unidade"… */
  unidade: string;
  quantidade: Quantidade;
  valorUnitario: Valor;
  /** A que produtos a linha serve. Pelo menos um. */
  produtos: CodigoProduto[];
}

export interface Produto {
  codigo: CodigoProduto;
  nome: string;
  /** A evidência objetiva de conclusão: o que torna o produto verificável. */
  evidencia: string;
}

/** A proposta é apresentada para apreciação: não é contrato, não é aprovação de ninguém. */
export type SituacaoDaProposta = "para-apreciacao";

export interface Proposta {
  /** Identifica o conteúdo. Toda mudança de texto ou número muda a versão. */
  versao: string;
  preparadaEm: string;
  titulo: string;
  /** Quem propõe: a autoria é da PONTE. */
  autoria: string;
  /** A entidade prevista para executar o projeto. Previsão, não aprovação nem endosso dela. */
  executoraPrevista: string;
  situacao: SituacaoDaProposta;
  objetoCurto: string;
  objetoCompleto: string;
  produtos: Produto[];
  investimentoPretendidoCentavos: number;
  /**
   * A distribuição inicial do investimento em envelopes (coordenação, 16/11/2026). É estimativa interna, referência para
   * a futura pesquisa de preços: não é a composição (que segue em elaboração) nem orçamento aprovado.
   */
  envelopes: { estimativa: Estimativa; itens: EnvelopeDoDemonstrador[] };
  composicao: ItemDeComposicao[];
  prazoMeses: number;
  evidencias: { grau: GrauDeEvidencia; texto: string }[];
}

/**
 * Teto de caracteres do objeto curto. É PARÂMETRO INTERNO, não limite normativo: o limite do campo no sistema em que a
 * emenda for indicada precisa ser confirmado antes da submissão, e então este número muda para o oficial.
 */
export const LIMITE_OBJETO_CURTO = 500;

/** A prova computacional preliminar não é prova de campo. Vai junto de toda evidência `demonstrado`. */
export const RESSALVA_PROVA_PRELIMINAR =
  "A prova computacional preliminar não comprova rotas acessíveis nem tempos reais de caminhada: isso é objeto da " +
  "pesquisa de campo prevista no projeto.";

// ------------------------------------------------------------------ dinheiro

const centavosValidos = (c: unknown): c is number => typeof c === "number" && Number.isSafeInteger(c) && c > 0;

/** R$ 200.000,00, por aritmética inteira (sem `toLocaleString`, que depende do ICU da máquina). */
export function centavosEmReais(centavos: number): string {
  if (!Number.isSafeInteger(centavos)) throw new RangeError(`centavos não inteiros: ${centavos}`);
  const sinal = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const resto = (abs % 100).toString().padStart(2, "0");
  return `${sinal}R$ ${reais},${resto}`;
}

// ------------------------------------------------------------------ estimativas indicativas

/**
 * A natureza de um valor indicativo (coordenação, 16/11/2026). A estimativa interna é referência para a futura pesquisa
 * de preços: não é custo cotado, orçamento aprovado nem compromisso financeiro. As outras três naturezas existem para
 * quando houver documento, e nenhuma é presumida: valor que muda de natureza traz junto o documento que a sustenta.
 */
export type NaturezaDoValor = "estimativa-interna" | "cotacao-recebida" | "referencia-validada" | "orcamento-consolidado";
export const NATUREZAS_DO_VALOR: readonly NaturezaDoValor[] = [
  "estimativa-interna",
  "cotacao-recebida",
  "referencia-validada",
  "orcamento-consolidado",
];
export const ROTULO_NATUREZA: Record<NaturezaDoValor, string> = {
  "estimativa-interna": "Estimativa interna",
  "cotacao-recebida": "Cotação recebida",
  "referencia-validada": "Referência validada",
  "orcamento-consolidado": "Orçamento consolidado",
};

/** A natureza e a origem de um conjunto de valores. Fora da estimativa interna, o documento é obrigatório. */
export interface Estimativa {
  natureza: NaturezaDoValor;
  /** Quem definiu os valores, e quando. */
  origem: string;
  /** A cotação, a referência ou o orçamento que sustenta o valor. Só a estimativa interna dispensa. */
  documento?: string;
}

/** Um envelope da distribuição inicial do demonstrador. Referência interna, não linha da composição. */
export interface EnvelopeDoDemonstrador {
  rotulo: string;
  centavos: number;
}

/** Vai junto dos envelopes do demonstrador, na página (palavras da coordenação, 16/11/2026). */
export const AVISO_ENVELOPES = "Referências internas para a futura pesquisa de preços, não custos cotados.";

/** Vai junto dos valores da carteira, na página. */
export const AVISO_VALORES =
  "Os valores são estimativas internas, indicativas: não são cotações nem compromissos financeiros.";

/**
 * Vai junto dos módulos de cada projeto. A primeira frase é da coordenação (16/11/2026), restrita aos módulos
 * potencialmente autônomos: módulo cuja entrega exige outro não é declarado independente (coordenação, 16/11/2026).
 */
export const AVISO_MODULOS =
  "Os módulos potencialmente autônomos poderão ser estruturados como projetos independentes, quando tecnicamente e " +
  "juridicamente cabível, desde que a infraestrutura necessária do demonstrador esteja disponível. Os dependentes " +
  "exigem, antes, a entrega do módulo indicado.";

/** O que impede a estimativa de valer: natureza fora da lista, origem vazia, ou falta do documento que ela exige. */
export function pendenciasDaEstimativa(e: Estimativa, onde: string): string[] {
  const pendencias: string[] = [];
  if (!NATUREZAS_DO_VALOR.includes(e.natureza)) {
    pendencias.push(`${onde}: natureza do valor inválida (${String(e.natureza)}).`);
  } else if (e.natureza !== "estimativa-interna" && !e.documento?.trim()) {
    pendencias.push(`${onde}: valor como "${ROTULO_NATUREZA[e.natureza]}" precisa do documento que o sustenta.`);
  }
  if (!e.origem.trim()) pendencias.push(`${onde}: falta dizer quem definiu os valores.`);
  return pendencias;
}

/** A soma dos envelopes, conferida com o investimento pretendido ao centavo. */
export function lerEnvelopes(p: Proposta): { somaCentavos: number; confere: boolean; pendencias: string[] } {
  const { estimativa, itens } = p.envelopes;
  if (itens.length === 0) return { somaCentavos: 0, confere: false, pendencias: [] };
  const pendencias = pendenciasDaEstimativa(estimativa, "Envelopes do demonstrador");
  let somaCentavos = 0;
  let validos = true;
  for (const x of itens) {
    if (!x.rotulo.trim()) pendencias.push("Envelope do demonstrador sem nome.");
    if (centavosValidos(x.centavos)) somaCentavos += x.centavos;
    else {
      validos = false;
      pendencias.push(`O envelope "${x.rotulo}" tem valor inválido (centavos inteiros e positivos).`);
    }
  }
  // Com o investimento inválido, a prontidão já acusa; aqui não há com o que conferir.
  const investimentoOk = centavosValidos(p.investimentoPretendidoCentavos);
  const confere = validos && investimentoOk && somaCentavos === p.investimentoPretendidoCentavos;
  if (validos && investimentoOk && !confere) {
    pendencias.push(
      `Os envelopes somam ${centavosEmReais(somaCentavos)}; o investimento pretendido é ` +
        `${centavosEmReais(p.investimentoPretendidoCentavos)}.`,
    );
  }
  return { somaCentavos, confere, pendencias };
}

/** O total de uma linha, ou o motivo de não haver. */
export type TotalDoItem =
  | { estado: "definido"; centavos: number }
  | { estado: "em-elaboracao" }
  | { estado: "invalido"; motivo: string };

export function totalDoItem(item: ItemDeComposicao): TotalDoItem {
  const q = item.quantidade;
  const v = item.valorUnitario;
  if (q.estado === "definida" && !(typeof q.valor === "number" && Number.isFinite(q.valor) && q.valor > 0)) {
    return { estado: "invalido", motivo: `quantidade inválida em "${item.atividade}"` };
  }
  if (v.estado === "definido" && !centavosValidos(v.centavos)) {
    return { estado: "invalido", motivo: `valor unitário inválido em "${item.atividade}" (centavos inteiros e positivos)` };
  }
  if (q.estado !== "definida" || v.estado !== "definido") return { estado: "em-elaboracao" };
  const total = q.valor * v.centavos;
  if (!Number.isSafeInteger(total)) {
    return { estado: "invalido", motivo: `quantidade × valor unitário não dá centavos inteiros em "${item.atividade}"` };
  }
  return { estado: "definido", centavos: total };
}

export interface LeituraDaComposicao {
  /** Soma só das linhas definidas e válidas. O que está em elaboração não entra como zero: fica contado à parte. */
  definidoCentavos: number;
  emElaboracao: number;
  invalidos: string[];
  /** Os produtos a que alguma linha está ligada. Linha de vários produtos conta em todos: é vínculo, não rateio. */
  produtosAtendidos: Set<CodigoProduto>;
}

export function lerComposicao(itens: ItemDeComposicao[]): LeituraDaComposicao {
  let definidoCentavos = 0;
  let emElaboracao = 0;
  const invalidos: string[] = [];
  const produtosAtendidos = new Set<CodigoProduto>();
  for (const item of itens) {
    if (!item.atividade.trim()) invalidos.push("linha da composição sem atividade");
    if (!item.unidade.trim()) invalidos.push(`unidade vazia em "${item.atividade}"`);
    if (item.produtos.length === 0) invalidos.push(`"${item.atividade}" não está ligada a nenhum produto`);
    for (const p of item.produtos) {
      if (CODIGOS_PRODUTO.includes(p)) produtosAtendidos.add(p);
      else invalidos.push(`"${item.atividade}" aponta para produto inexistente (${String(p)})`);
    }
    const t = totalDoItem(item);
    if (t.estado === "definido") definidoCentavos += t.centavos;
    else if (t.estado === "em-elaboracao") emElaboracao += 1;
    else invalidos.push(t.motivo);
  }
  return { definidoCentavos, emElaboracao, invalidos, produtosAtendidos };
}

// ------------------------------------------------------------------ prontidão técnica

/**
 * O conteúdo está completo e coerente? Verificação interna (orçamento fechado, produtos com evidência, objeto curto
 * dentro do limite). Não é etapa de aprovação e não aparece como processo na sala.
 */
export function prontidaoTecnica(p: Proposta): { pronta: boolean; pendencias: string[] } {
  const pendencias: string[] = [];

  // Objeto
  if (!p.objetoCurto.trim()) pendencias.push("Falta o objeto curto.");
  else if (p.objetoCurto.length > LIMITE_OBJETO_CURTO) {
    pendencias.push(`O objeto curto tem ${p.objetoCurto.length} caracteres; o teto é ${LIMITE_OBJETO_CURTO}.`);
  }
  if (!p.objetoCompleto.trim()) pendencias.push("Falta o objeto completo.");

  // Produtos: exatamente P1 a P4, cada um uma vez, cada um com evidência.
  const codigos = p.produtos.map((x) => x.codigo);
  const exatos = codigos.length === 4 && CODIGOS_PRODUTO.every((c) => codigos.filter((x) => x === c).length === 1);
  if (!exatos) pendencias.push("A proposta precisa dos quatro produtos, P1 a P4, cada um uma vez.");
  for (const x of p.produtos) {
    if (!x.nome.trim()) pendencias.push(`${x.codigo} está sem nome.`);
    if (!x.evidencia.trim()) pendencias.push(`${x.codigo} está sem evidência objetiva de conclusão.`);
  }

  // Investimento e prazo
  const investimentoOk = centavosValidos(p.investimentoPretendidoCentavos);
  if (!investimentoOk) pendencias.push("O investimento pretendido é inválido (centavos inteiros e positivos).");
  if (!(Number.isSafeInteger(p.prazoMeses) && p.prazoMeses > 0)) pendencias.push("O prazo em meses é inválido.");

  // Envelopes: referência interna; se existem, fecham com o investimento ao centavo. Não substituem a composição.
  pendencias.push(...lerEnvelopes(p).pendencias);

  // Composição do orçamento
  if (p.composicao.length === 0) {
    pendencias.push("A composição do orçamento ainda não foi informada.");
  } else {
    const c = lerComposicao(p.composicao);
    for (const motivo of c.invalidos) pendencias.push(`Composição: ${motivo}.`);
    if (c.emElaboracao > 0) {
      pendencias.push(`${c.emElaboracao} linha(s) da composição em elaboração.`);
    } else if (c.invalidos.length === 0 && investimentoOk && c.definidoCentavos !== p.investimentoPretendidoCentavos) {
      pendencias.push(
        `A composição soma ${centavosEmReais(c.definidoCentavos)}; o investimento pretendido é ` +
          `${centavosEmReais(p.investimentoPretendidoCentavos)}.`,
      );
    }
    for (const codigo of CODIGOS_PRODUTO) {
      if (!c.produtosAtendidos.has(codigo)) pendencias.push(`Nenhuma linha da composição serve a ${codigo}.`);
    }
  }

  return { pronta: pendencias.length === 0, pendencias };
}

// ------------------------------------------------------------------ natureza da proposta

/** A identificação discreta da natureza preliminar, a mesma na página e na folha. */
export function seloDeEstado(p: Proposta): string {
  return `Proposta para apreciação · versão preliminar ${p.versao}`;
}

/** Quem propõe e quem executaria, numa frase, sem atribuir aprovação a ninguém. */
export function naturezaDaProposta(p: Proposta): string {
  return `Proposta elaborada pela ${p.autoria}, para apreciação. Entidade executora prevista: ${p.executoraPrevista}.`;
}

// ------------------------------------------------------------------ evidências

/** As evidências de um grau, na ordem em que foram escritas. A página mostra cada grau num bloco próprio. */
export function evidenciasDe(p: Proposta, grau: GrauDeEvidencia): string[] {
  return p.evidencias.filter((e) => e.grau === grau).map((e) => e.texto);
}

/** Os rótulos dos três graus, escritos como as perguntas que a sala tem de responder. */
export const ROTULO_GRAU: Record<GrauDeEvidencia, string> = {
  demonstrado: "O que já foi demonstrado",
  previsto: "O que esta pesquisa vai verificar",
  hipotese: "O que é hipótese de expansão",
};

// ------------------------------------------------------------------ textos de apresentação

/** Uma etapa da sequência dados → modelos → validação → resultados, ligada ao produto que a entrega. */
export interface EtapaDoObjeto {
  produto: CodigoProduto;
  rotulo: string;
  /** Cópia LITERAL de um trecho do objeto completo: a atividade (ou metodologia) não diz nada que o objeto não diga. */
  trecho: string;
  /** A entrega tangível do produto, em uma frase, sem meta numérica. Redação provisória a validar. */
  entrega: string;
}

/** Uma linha da síntese de abertura: o que os R$ 200 mil desenvolvem, testam e validam, e com quais produtos. */
export interface ItemDaSintese {
  verbo: string;
  texto: string;
  produtos: CodigoProduto[];
}

/**
 * A natureza do ativo, que decide a condição de reuso (titular, 16/11/2026). As três condições são as palavras dele e
 * não ganham critério novo aqui: detalhar "condições técnicas e de uso" ou "condições pertinentes" é decisão de quem
 * conduzir o projeto.
 */
export type TipoDeAtivo = "tecnologico" | "metodologico" | "registro";

export const TIPOS_DE_ATIVO: { tipo: TipoDeAtivo; titulo: string; condicao: string }[] = [
  { tipo: "tecnologico", titulo: "Ativos tecnológicos", condicao: "Reutilizáveis quando as condições técnicas e de uso permitirem." },
  { tipo: "metodologico", titulo: "Ativos metodológicos", condicao: "Poderão orientar futuros projetos." },
  { tipo: "registro", titulo: "Registros e evidências", condicao: "Reutilização sujeita às condições pertinentes." },
];

/** Vai junto da lista de ativos, na página e na folha. */
export const AVISO_ATIVOS = "Todos são entregas previstas nesta proposta, não resultados já produzidos.";

/** Um ativo que o projeto entrega e que o Observatório maior pode reaproveitar. */
export interface AtivoReutilizavel {
  tipo: TipoDeAtivo;
  /** O nome do ativo, que tem de constar LITERALMENTE da evidência de aceite do produto: nada além do que está previsto. */
  ativo: string;
  produto: CodigoProduto;
  /** Como pode ser reaproveitado. É possibilidade, não compromisso. */
  uso: string;
}

/**
 * A investigação preliminar de acessibilidade. Foi conduzida pela coordenação em outra sessão, e a responsabilidade pela
 * evidência técnica é dela (correção de escopo do titular, 16/11/2026). A sala só mostra resultado como `demonstrado`
 * quando ele chega `verificada`, com a fonte: as travas amarram as duas coisas.
 */
export const ROTULO_PROVA: Record<ProvaPreliminar["estado"], string> = {
  "nao-recebida": "Não apresentada nesta versão",
  verificada: "Recebida verificada, com a fonte",
};

export interface ProvaPreliminar {
  estado: "nao-recebida" | "verificada";
  /** O que é a investigação, como a coordenação a descreve. */
  descricao: string;
  /** Em que pé está, em linguagem da página. */
  conferencia: string;
}

/** Uma camada do esquema metodológico: o que o núcleo relaciona. Conceitual, nunca geografia real. */
export interface CamadaDoEsquema {
  id: "territorio" | "caminhos" | "servicos" | "barreiras";
  rotulo: string;
  texto: string;
  produtos: CodigoProduto[];
}

/**
 * A autonomia de um módulo em relação aos OUTROS MÓDULOS da carteira. A base comum de todos é o demonstrador: a carteira
 * só existe depois dele. "Potencialmente autônomo" não promete nada: diz só que a entrega não exige outro módulo.
 */
export type AutonomiaDoModulo = "potencialmente-autonomo" | "dependente";

export const ROTULO_AUTONOMIA: Record<AutonomiaDoModulo, string> = {
  "potencialmente-autonomo": "Potencialmente autônomo",
  dependente: "Dependente",
};

/**
 * O que as duas classes querem dizer, dito na página, junto dos números da carteira. A autonomia é em relação aos
 * demais módulos da carteira, nunca em relação ao demonstrador (coordenação, 16/11/2026).
 */
export const DEFINICAO_AUTONOMIA =
  "Potencialmente autônomo: autônomo em relação aos demais módulos da carteira, mas pressupõe a infraestrutura " +
  "necessária do demonstrador. Dependente: começa depois da entrega do módulo indicado.";

/**
 * O que o "a partir de" NÃO é (coordenação, 16/11/2026): o valor de entrada vale para a expansão modular sobre a base
 * técnica do demonstrador e não é alternativa ao investimento inaugural. A versão inaugural reduzida fica como
 * possibilidade futura, sem custo atribuído antes do dimensionamento: a frase não pode levar outro valor.
 */
export function avisoDaEntrada(investimentoInaugural: string): string {
  return (
    "O valor de entrada se refere à expansão modular, condicionada à base técnica do demonstrador: não é alternativa " +
    `ao investimento inaugural de ${investimentoInaugural}. Uma versão inaugural reduzida poderá ser estruturada no ` +
    "futuro; o custo dela só será definido depois do dimensionamento."
  );
}

/** Uma parte de um projeto da carteira: título, entregas mensuráveis, valor indicativo e de que módulo depende. */
export interface ModuloDoProjeto {
  titulo: string;
  /**
   * Entregas mensuráveis: cada uma é um produto verificável (documentado, com ficha técnica, reproduzível ou com
   * critério declarado), sem número, sem falar como coisa feita e sem presumir dado ou resultado que ainda não existe.
   */
  entregas: string[];
  centavos: number;
  autonomia: AutonomiaDoModulo;
  /** Os módulos do MESMO projeto cuja entrega este exige, pelo título, sempre anteriores a ele. Vazio quando autônomo. */
  dependeDe: string[];
}

/**
 * Um projeto candidato da carteira macro. É HIPÓTESE DE EXPANSÃO: sem financiamento ou apoio institucional presumido.
 * O valor é indicativo, com a natureza declarada (`estimativa`), e o total é a soma exata dos módulos (estratégia
 * financeira preliminar da coordenação, 16/11/2026). O problema público é a pergunta que a cidade precisa responder,
 * não afirmação de fato sobre João Pessoa. Os componentes aproveitáveis só podem ser ativos que o demonstrador entrega
 * (trava em `pendenciasDaApresentacao`).
 */
export interface ProjetoCandidato {
  nome: string;
  problema: string;
  capacidade: string;
  componentes: string[];
  dependencias: string[];
  /** O total indicativo, como a coordenação o definiu: a soma dos módulos tem de dar exatamente ele. */
  totalIndicativoCentavos: number;
  /** As partes do projeto. Só as potencialmente autônomas poderão virar projetos independentes, quando cabível. */
  modulos: ModuloDoProjeto[];
  estimativa: Estimativa;
}

export const AVISO_CARTEIRA =
  "Os seis projetos são hipóteses de expansão: nenhum tem financiamento ou apoio institucional definido.";

/** As somas da carteira e do programa, sempre a partir dos módulos. O que é declarado só serve para conferir. */
export interface LeituraDosValores {
  projetos: { nome: string; somaCentavos: number; confere: boolean }[];
  carteiraCentavos: number;
  /** O demonstrador mais a carteira. */
  programaCentavos: number;
}

export function lerValoresDoPrograma(p: Proposta, a: Apresentacao): LeituraDosValores {
  const projetos = a.carteira.projetos.map((pr) => {
    const somaCentavos = pr.modulos.reduce((t, m) => t + (centavosValidos(m.centavos) ? m.centavos : 0), 0);
    const validos = pr.modulos.length > 0 && pr.modulos.every((m) => centavosValidos(m.centavos));
    return { nome: pr.nome, somaCentavos, confere: validos && somaCentavos === pr.totalIndicativoCentavos };
  });
  const carteiraCentavos = projetos.reduce((t, x) => t + x.somaCentavos, 0);
  return { projetos, carteiraCentavos, programaCentavos: p.investimentoPretendidoCentavos + carteiraCentavos };
}

/** O que o card mostra sem abrir nada: quantos módulos, o menor e a porta de entrada (o menor autônomo). */
export interface LeituraDosModulos {
  quantidade: number;
  autonomos: number;
  /** O menor valor entre os módulos com valor válido. */
  menorCentavos: number | null;
  /** O menor valor entre os módulos potencialmente autônomos: por onde o projeto pode começar. */
  entradaCentavos: number | null;
}

export function lerModulos(pr: ProjetoCandidato): LeituraDosModulos {
  const validos = pr.modulos.filter((m) => centavosValidos(m.centavos));
  const menor = (ms: ModuloDoProjeto[]) => (ms.length > 0 ? Math.min(...ms.map((m) => m.centavos)) : null);
  return {
    quantidade: pr.modulos.length,
    autonomos: pr.modulos.filter((m) => m.autonomia === "potencialmente-autonomo").length,
    menorCentavos: menor(validos),
    entradaCentavos: menor(validos.filter((m) => m.autonomia === "potencialmente-autonomo")),
  };
}

/**
 * Os números da abertura da carteira: projetos, módulos e o investimento modular mínimo. O "a partir de" é o menor
 * módulo POTENCIALMENTE AUTÔNOMO: um módulo dependente nunca é a porta de entrada, porque não pode começar sozinho.
 */
export function entradaDaCarteira(a: Apresentacao): {
  projetos: number;
  modulos: number;
  autonomos: number;
  aPartirDeCentavos: number | null;
} {
  const lidos = a.carteira.projetos.map(lerModulos);
  const entradas = lidos.map((x) => x.entradaCentavos).filter((c): c is number => c !== null);
  return {
    projetos: a.carteira.projetos.length,
    modulos: lidos.reduce((t, x) => t + x.quantidade, 0),
    autonomos: lidos.reduce((t, x) => t + x.autonomos, 0),
    aPartirDeCentavos: entradas.length > 0 ? Math.min(...entradas) : null,
  };
}

/**
 * As condições de reaproveitamento dos componentes de um projeto, pela natureza de cada ativo: as condições são as do
 * titular (`TIPOS_DE_ATIVO`), e cada ativo leva o produto do demonstrador que o entrega. Nada de critério novo.
 */
export function condicoesDeReaproveitamento(
  pr: ProjetoCandidato,
  reuso: AtivoReutilizavel[],
): { titulo: string; condicao: string; ativos: { ativo: string; produto: CodigoProduto }[] }[] {
  return TIPOS_DE_ATIVO.map((t) => ({
    titulo: t.titulo,
    condicao: t.condicao,
    ativos: pr.componentes
      .map((c) => reuso.find((r) => r.ativo === c))
      .filter((r): r is AtivoReutilizavel => r !== undefined && r.tipo === t.tipo)
      .map((r) => ({ ativo: r.ativo, produto: r.produto })),
  })).filter((g) => g.ativos.length > 0);
}

/** De onde vêm os valores indicativos, para a seção de fontes da página (a folha não leva valores da carteira). */
export function fontesDosValores(p: Proposta, a: Apresentacao): string[] {
  const grupos = new Map<string, string[]>();
  const juntar = (e: Estimativa, parte: string) => {
    const natureza = ROTULO_NATUREZA[e.natureza] ?? String(e.natureza);
    const chave = `${natureza}. ${e.origem}${e.documento ? ` Documento: ${e.documento}` : ""}`;
    const partes = grupos.get(chave) ?? [];
    if (!partes.includes(parte)) partes.push(parte);
    grupos.set(chave, partes);
  };
  if (p.envelopes.itens.length > 0) juntar(p.envelopes.estimativa, "envelopes do demonstrador");
  for (const pr of a.carteira.projetos) juntar(pr.estimativa, "projetos e módulos da carteira");
  return [...grupos].map(([chave, partes]) => `Valores indicativos (${emSequencia(partes)}): ${chave}`);
}

/**
 * Os textos com que a sala se apresenta e que a orientação de 16/11/2026 não traz. São redação da PONTE, montada a
 * partir do objeto definido na orientação. Travas: os trechos das etapas são cópia literal do objeto; os ativos
 * constam da evidência de conclusão; nenhum texto tem algarismo (o que barra estatística sem fonte e meta numérica
 * inventada); síntese, entregas e usos não falam de resultado como já obtido; nenhum texto atribui aprovação ou
 * endosso a terceiros.
 */
export interface Apresentacao {
  estado: "redacao-provisoria" | "validada";
  /** O que os R$ 200 mil financiam: desenvolver, testar, validar. */
  sintese: ItemDaSintese[];
  problema: { pergunta: string; necessidade: string };
  solucao: string;
  etapas: EtapaDoObjeto[];
  provaPreliminar: ProvaPreliminar;
  reuso: AtivoReutilizavel[];
  /** Os projetos seguintes: hipotéticos, sem compromisso nesta proposta. */
  novosProjetos: string;
  /** A expansão além desta etapa. É hipótese, sem compromisso nesta proposta. */
  expansao: string;
  /** O esquema metodológico conceitual: territórios, caminhos, serviços e barreiras. */
  esquema: { camadas: CamadaDoEsquema[]; ressalva: string };
  /** A carteira macro: um observatório, múltiplas capacidades. */
  carteira: {
    abertura: string;
    projetos: ProjetoCandidato[];
    fonte: string;
    /** Os totais como a coordenação os definiu. A página mostra as somas dos módulos; estes números só conferem. */
    totalIndicativoCentavos: number;
    programaIndicativoCentavos: number;
  };
  /** O encerramento: uma próxima decisão possível, nunca um compromisso já assumido por alguém. */
  proximaDecisao: { texto: string; temas: TemaDaDecisao[] };
  fontes: string[];
}

/** Um tema da próxima decisão: a frente (o demonstrador ou o programa maior) e o que se decide nela. */
export interface TemaDaDecisao {
  rotulo: string;
  texto: string;
}

/**
 * Recurso dado como assegurado: dinheiro dito financiado, custeado, garantido, reservado, captado, disponível.
 * Mencionar instrumentos ou potenciais fontes de financiamento é outra coisa e passa ("identificar potenciais fontes de
 * financiamento"): a trava separa a menção da afirmação de que o recurso existe (orientação do titular, 16/11/2026).
 * Estimativa identificada também passa: ela não mora no texto, mora no campo próprio, com a natureza (`Estimativa`).
 */
const RECURSO_ASSEGURADO =
  /(^|[^\p{L}])(financiad[oa]s?|custead[oa]s?|patrocinad[oa]s?|(?:recursos?|verbas?|orçamentos?|financiamentos?|dinheiro)\s+(?:já\s+)?(?:garantid|assegurad|aprovad|reservad|captad|liberad|empenhad|contratad|comprometid|dispon[ií]ve)\p{L}*|com\s+(?:recursos?|financiamentos?|verbas?)\s+d[oae]s?)(?![\p{L}])/iu;

/**
 * Valor solto no texto: sem natureza nem origem, não é estimativa identificada. Valor entra só pelo campo próprio
 * (envelopes, módulos), e a página o mostra com a natureza. O único valor que um texto pode citar é o da própria
 * proposta (`semOValorDaProposta`). A regra impede financiamento presumido, não estimativa explicitamente identificada
 * (coordenação, 16/11/2026).
 */
const VALOR_SOLTO = /R\$/;

/**
 * Interlocutores da proposta. Identificá-los é legítimo: a trava não proíbe o nome, proíbe atribuir-lhe aprovação,
 * apoio ou compromisso que nenhum fato documenta (orientação do titular, 16/11/2026). Que os nomes fiquem fora do
 * conteúdo desta versão é decisão de conteúdo, conferida em teste, e não desta regra.
 */
const INTERLOCUTORES = /(^|[^\p{L}])(Ruy|Thiago|Lucena|Dantas)(?![\p{L}])/u;

/** Atribuir a alguém: aprovou, apoia, endossou, autorizou, assumiu, comprometeu-se, garantiu, vai levar adiante… */
const ATRIBUICAO =
  /(^|[^\p{L}])(aprov\p{L}*|apoi\p{L}*|endoss\p{L}*|chancel\p{L}*|autoriz\p{L}*|assum\p{L}*|compromet\p{L}*|compromisso\p{L}*|garant\p{L}*|patrocin\p{L}*|acolheu|aceitou|concordou|decidiu|vai|vão|irá|irão)(?![\p{L}])/iu;

/**
 * A frase nomeia um interlocutor e lhe atribui aprovação, apoio ou compromisso. Na dúvida, acusa: até a negação
 * ("sem compromisso de Fulano") acusa, para a frase ser reescrita sem pôr palavra na boca de ninguém.
 */
function atribuiAInterlocutor(texto: string): boolean {
  return texto.split(/(?<=[.!?;:])\s+/u).some((frase) => INTERLOCUTORES.test(frase) && ATRIBUICAO.test(frase));
}

/** Endosso emprestado: a sala não diz que alguém aprovou, autorizou ou endossou a proposta. */
const ENDOSSO = /(^|[^\p{L}])(aprovad[oa]s?|aprovou|aprovação|endoss\p{L}*|chancel\p{L}*|autorizad[oa]s?|autorizou|apoiad[oa]s? (?:pel[oa]|por))(?![\p{L}])/iu;

/** Tempo verbal de coisa já feita: a síntese e as entregas falam do que o projeto VAI fazer. */
const JA_FEITO = /(^|[^\p{L}])(foi|foram|demonstrou|demonstrado|comprovou|comprovado|validou|validado|reduziu|já)(?![\p{L}])/iu;

/** O que impede os textos de apresentação de valer, em linguagem da página. Lista vazia = em ordem. */
export function pendenciasDaApresentacao(p: Proposta, a: Apresentacao): string[] {
  const pendencias: string[] = [];
  // O valor da própria proposta ("R$ 200 mil") pode ser citado; qualquer outro número ou valor continua barrado.
  const valorDaProposta = centavosResumidos(p.investimentoPretendidoCentavos);
  const semOValorDaProposta = (t: string) => t.split(valorDaProposta).join("");
  const codigos = a.etapas.map((e) => e.produto).join(",");
  if (codigos !== CODIGOS_PRODUTO.join(",")) pendencias.push("As etapas precisam seguir P1 a P4, uma por produto.");
  for (const e of a.etapas) {
    if (!e.rotulo.trim() || !e.trecho.trim() || !e.entrega.trim()) pendencias.push(`A etapa de ${e.produto} está incompleta.`);
    else if (!p.objetoCompleto.includes(e.trecho)) {
      pendencias.push(`A etapa de ${e.produto} diz algo que o objeto completo não diz ("${e.trecho.slice(0, 40)}…").`);
    }
    if (JA_FEITO.test(e.entrega)) pendencias.push(`A entrega de ${e.produto} fala como se já estivesse feita.`);
  }

  // Síntese: cobre os quatro produtos e não apresenta resultado futuro como realizado.
  const naSintese = new Set(a.sintese.flatMap((x) => x.produtos));
  if (a.sintese.length === 0 || CODIGOS_PRODUTO.some((c) => !naSintese.has(c))) {
    pendencias.push("A síntese de abertura precisa cobrir os quatro produtos.");
  }
  for (const x of a.sintese) {
    if (!x.verbo.trim() || !x.texto.trim()) pendencias.push("A síntese de abertura tem item incompleto.");
    if (JA_FEITO.test(`${x.verbo} ${x.texto}`)) pendencias.push(`A síntese ("${x.verbo}") fala como se já estivesse feita.`);
  }

  // Reuso: só o que a evidência de aceite já prevê.
  for (const r of a.reuso) {
    const evid = p.produtos.find((x) => x.codigo === r.produto)?.evidencia ?? "";
    if (!evid.toLowerCase().includes(r.ativo.toLowerCase())) {
      pendencias.push(`O ativo "${r.ativo}" não consta da evidência de aceite de ${r.produto}.`);
    }
    if (!r.uso.trim()) pendencias.push(`Falta dizer como "${r.ativo}" pode ser reaproveitado.`);
    if (JA_FEITO.test(r.uso)) pendencias.push(`O uso de "${r.ativo}" fala como se já estivesse feito.`);
    if (!TIPOS_DE_ATIVO.some((t) => t.tipo === r.tipo)) pendencias.push(`O ativo "${r.ativo}" está sem natureza válida.`);
  }
  if (a.reuso.length === 0) pendencias.push("Faltam os ativos reutilizáveis.");
  for (const t of TIPOS_DE_ATIVO) {
    if (!a.reuso.some((r) => r.tipo === t.tipo)) pendencias.push(`Nenhum ativo em "${t.titulo}".`);
  }

  // A prova preliminar e o quadro "já demonstrado" andam juntos: um não muda sem o outro.
  const demonstrado = evidenciasDe(p, "demonstrado").length;
  if (demonstrado > 0 && a.provaPreliminar.estado !== "verificada") {
    pendencias.push('Há resultado em "já demonstrado" sem evidência técnica recebida verificada, com a fonte.');
  }
  if (a.provaPreliminar.estado === "verificada" && demonstrado === 0) {
    pendencias.push("A investigação preliminar consta como verificada, mas nenhum resultado foi registrado.");
  }
  if (a.provaPreliminar.estado !== "verificada") {
    pendencias.push("Nenhum resultado técnico verificado foi recebido nesta sala: nada aparece como comprovado.");
  }

  // Esquema: as quatro camadas, nessa ordem, e a ressalva de que é conceitual.
  const camadas = a.esquema.camadas.map((c) => c.id).join(",");
  if (camadas !== "territorio,caminhos,servicos,barreiras") {
    pendencias.push("O esquema precisa das camadas território, caminhos, serviços e barreiras, nessa ordem.");
  }
  if (!/conceitual/i.test(a.esquema.ressalva) || !/não representa/i.test(a.esquema.ressalva)) {
    pendencias.push("O esquema precisa dizer que é conceitual e que não representa o território real.");
  }

  // Carteira: seis projetos completos, componentes que o demonstrador entrega, valores identificados que fecham,
  // nada de recurso presumido.
  const ativos = new Set(a.reuso.map((r) => r.ativo));
  const valores = lerValoresDoPrograma(p, a);
  if (a.carteira.projetos.length !== 6) pendencias.push("A carteira precisa dos seis projetos candidatos.");
  if (!a.carteira.fonte.trim()) pendencias.push("A carteira precisa dizer de onde vêm os projetos.");
  for (const pr of a.carteira.projetos) {
    if (!pr.nome.trim() || !pr.problema.trim() || !pr.capacidade.trim()) pendencias.push(`"${pr.nome}" está incompleto.`);
    if (pr.componentes.length === 0) pendencias.push(`"${pr.nome}" não aproveita nenhum componente do demonstrador.`);
    if (pr.dependencias.length === 0) pendencias.push(`"${pr.nome}" está sem dependências.`);
    for (const c of pr.componentes) {
      if (!ativos.has(c)) pendencias.push(`"${pr.nome}" aproveita "${c}", que o demonstrador não entrega.`);
    }
    pendencias.push(...pendenciasDaEstimativa(pr.estimativa, `"${pr.nome}"`));
    if (pr.modulos.length === 0) pendencias.push(`"${pr.nome}" está sem módulos.`);
    const titulos = pr.modulos.map((m) => m.titulo);
    if (new Set(titulos).size !== titulos.length) pendencias.push(`"${pr.nome}" tem módulos com o mesmo título.`);
    pr.modulos.forEach((m, j) => {
      const entregas = Array.isArray(m.entregas) ? m.entregas : [];
      if (!m.titulo.trim() || entregas.length === 0 || entregas.some((e) => !e.trim())) {
        pendencias.push(`"${pr.nome}" tem módulo sem título ou sem entregas.`);
      }
      if (!centavosValidos(m.centavos)) {
        pendencias.push(`"${pr.nome}": o módulo "${m.titulo}" tem valor inválido (centavos inteiros e positivos).`);
      }
      // Autonomia declarada e coerente: o dependente diz de quem; o autônomo não depende de ninguém; a dependência é de
      // módulo do mesmo projeto e anterior a este (a ordem dos módulos é uma ordem de execução possível).
      const dependeDe = Array.isArray(m.dependeDe) ? m.dependeDe : [];
      if (m.autonomia !== "potencialmente-autonomo" && m.autonomia !== "dependente") {
        pendencias.push(`"${pr.nome}": o módulo "${m.titulo}" está sem autonomia válida (potencialmente autônomo ou dependente).`);
      } else if (m.autonomia === "dependente" && dependeDe.length === 0) {
        pendencias.push(`"${pr.nome}": o módulo "${m.titulo}" é dependente e não diz de qual módulo.`);
      } else if (m.autonomia === "potencialmente-autonomo" && dependeDe.length > 0) {
        pendencias.push(`"${pr.nome}": o módulo "${m.titulo}" é potencialmente autônomo, mas depende de outro módulo.`);
      }
      for (const d of dependeDe) {
        const k = titulos.indexOf(d);
        if (k < 0) pendencias.push(`"${pr.nome}": o módulo "${m.titulo}" depende de "${d}", que não é módulo do projeto.`);
        else if (k >= j) pendencias.push(`"${pr.nome}": o módulo "${m.titulo}" depende de "${d}", que não vem antes dele.`);
      }
    });
    // A porta de entrada: o card mostra o menor módulo, e ele tem de poder começar sozinho.
    const leituraModulos = lerModulos(pr);
    if (leituraModulos.menorCentavos !== null && leituraModulos.entradaCentavos !== leituraModulos.menorCentavos) {
      pendencias.push(`"${pr.nome}": o menor módulo depende de outro; a porta de entrada tem de ser potencialmente autônoma.`);
    }
    const lido = valores.projetos.find((x) => x.nome === pr.nome);
    const modulosValidos = pr.modulos.length > 0 && pr.modulos.every((m) => centavosValidos(m.centavos));
    if (!centavosValidos(pr.totalIndicativoCentavos)) pendencias.push(`"${pr.nome}": o total indicado é inválido.`);
    else if (lido && modulosValidos && !lido.confere) {
      pendencias.push(
        `"${pr.nome}": os módulos somam ${centavosEmReais(lido.somaCentavos)}; o total indicado é ` +
          `${centavosEmReais(pr.totalIndicativoCentavos)}.`,
      );
    }
    const doProjeto = [
      pr.nome, pr.problema, pr.capacidade, ...pr.dependencias, ...pr.modulos.flatMap((m) => [m.titulo, ...m.entregas]),
    ];
    if (doProjeto.some((t) => VALOR_SOLTO.test(t))) {
      pendencias.push(`"${pr.nome}" traz valor no texto: valor só entra como estimativa identificada, no campo próprio.`);
    }
    if (doProjeto.some((t) => RECURSO_ASSEGURADO.test(t))) {
      pendencias.push(`"${pr.nome}" presume recurso assegurado: é hipótese de expansão.`);
    }
    if (doProjeto.some((t) => JA_FEITO.test(t))) pendencias.push(`"${pr.nome}" fala como se já estivesse feito.`);
  }
  if (valores.projetos.every((x) => x.confere)) {
    if (valores.carteiraCentavos !== a.carteira.totalIndicativoCentavos) {
      pendencias.push(
        `A carteira soma ${centavosEmReais(valores.carteiraCentavos)}; o total indicado é ` +
          `${centavosEmReais(a.carteira.totalIndicativoCentavos)}.`,
      );
    }
    if (valores.programaCentavos !== a.carteira.programaIndicativoCentavos) {
      pendencias.push(
        `O programa soma ${centavosEmReais(valores.programaCentavos)}; o total indicado é ` +
          `${centavosEmReais(a.carteira.programaIndicativoCentavos)}.`,
      );
    }
  }

  const textos = [
    a.problema.pergunta, a.problema.necessidade, a.solucao, a.expansao, a.novosProjetos,
    a.proximaDecisao.texto, ...a.proximaDecisao.temas.flatMap((t) => [t.rotulo, t.texto]), a.esquema.ressalva,
    a.carteira.abertura,
    ...a.esquema.camadas.flatMap((c) => [c.rotulo, c.texto]),
    ...a.carteira.projetos.flatMap((pr) => [
      pr.nome, pr.problema, pr.capacidade, ...pr.dependencias, ...pr.modulos.flatMap((m) => [m.titulo, ...m.entregas]),
    ]),
    ...a.sintese.map((x) => `${x.verbo} ${x.texto}`), ...a.etapas.map((e) => e.entrega), ...a.reuso.map((r) => r.uso),
  ];
  const todos = [...textos, ...a.fontes, a.carteira.fonte, a.provaPreliminar.descricao, a.provaPreliminar.conferencia];
  if (todos.some((t) => ENDOSSO.test(t))) {
    pendencias.push("Texto de apresentação atribui aprovação, autorização ou endosso: a proposta é da PONTE, para apreciação.");
  }
  if (a.proximaDecisao.temas.length === 0) pendencias.push("Faltam os temas da próxima decisão.");
  if (todos.some(atribuiAInterlocutor)) {
    pendencias.push(
      "Texto de apresentação atribui aprovação, apoio ou compromisso a interlocutor: citar é permitido; atribuir sem " +
        "fato documentado, não.",
    );
  }
  if (textos.some((t) => VALOR_SOLTO.test(semOValorDaProposta(t)))) {
    pendencias.push(
      "Texto de apresentação com valor solto: valor só entra como estimativa identificada, com a natureza, no campo " +
        "próprio.",
    );
  }
  if (textos.some((t) => RECURSO_ASSEGURADO.test(semOValorDaProposta(t)))) {
    pendencias.push(
      "Texto de apresentação dá recurso como assegurado: mencionar fontes potenciais é permitido; afirmar que o " +
        "recurso existe, não.",
    );
  }
  if (textos.some((t) => !t.trim())) pendencias.push("Falta texto de apresentação.");
  if (textos.some((t) => /\d/.test(semOValorDaProposta(t)))) {
    pendencias.push("Texto de apresentação com número: indicador, estatística ou meta só entra com fonte conferida.");
  }
  if (a.fontes.length === 0) pendencias.push("Faltam as fontes documentais.");
  if (a.estado === "redacao-provisoria") {
    pendencias.push("Os textos de apresentação estão em redação provisória.");
  }
  return pendencias;
}

/** Parte o texto em volta do valor da proposta, para a página manter "R$ 200 mil" inteiro numa linha. */
export function emVoltaDoValor(texto: string, valor: string): { trecho: string; valor: boolean }[] {
  return texto
    .split(valor)
    .flatMap((trecho, i) => (i === 0 ? [{ trecho, valor: false }] : [{ trecho: valor, valor: true }, { trecho, valor: false }]))
    .filter((x) => x.trecho !== "");
}

/** "R$ 200 mil" quando o valor é múltiplo exato de mil reais; senão, o valor exato. Nunca arredonda. */
export function centavosResumidos(centavos: number): string {
  if (Number.isSafeInteger(centavos) && centavos > 0 && centavos % 100_000 === 0) {
    const mil = (centavos / 100_000).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `R$ ${mil} mil`;
  }
  return centavosEmReais(centavos);
}

/**
 * Para os totais da carteira e do programa: "R$ 2,17 milhões" a partir de um milhão, quando o valor é múltiplo exato de
 * dez mil reais; abaixo disso, ou sem a exatidão, o mesmo que `centavosResumidos`. Nunca arredonda.
 */
export function centavosEmEscala(centavos: number): string {
  const MILHAO = 100_000_000;
  if (!(Number.isSafeInteger(centavos) && centavos >= MILHAO && centavos % 1_000_000 === 0)) return centavosResumidos(centavos);
  const inteiro = Math.floor(centavos / MILHAO);
  const decimais = ((centavos % MILHAO) / 1_000_000).toString().padStart(2, "0").replace(/0+$/, "");
  const numero = `${inteiro.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${decimais ? `,${decimais}` : ""}`;
  return `R$ ${numero} ${inteiro === 1 ? "milhão" : "milhões"}`;
}

/** "a", "a e b", "a, b e c". */
export function emSequencia(itens: string[]): string {
  return itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

const POR_EXTENSO = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];

/** "três módulos", "um módulo"; de onze em diante, em algarismos. */
export function quantidadePorExtenso(n: number, singular: string, plural: string): string {
  const numero = Number.isSafeInteger(n) && n >= 0 && n < POR_EXTENSO.length ? POR_EXTENSO[n] : String(n);
  return `${numero} ${n === 1 ? singular : plural}`;
}

// ------------------------------------------------------------------ utilidades

export function dataBr(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso;
}
