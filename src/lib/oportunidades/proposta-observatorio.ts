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
 *     CENTAVOS INTEIROS; valor que não é inteiro positivo é rejeitado, nunca arredondado em silêncio.
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
  /** Os temas da próxima conversa: a sala termina num convite, não num formulário. */
  conversa: string[];
  fontes: string[];
}

/** Endosso emprestado: a sala não diz que alguém aprovou, autorizou ou endossou a proposta. */
const ENDOSSO = /(^|[^\p{L}])(aprovad[oa]s?|aprovou|aprovação|endoss\p{L}*|chancel\p{L}*|autorizad[oa]s?|autorizou|apoiad[oa]s? (?:pel[oa]|por))(?![\p{L}])/iu;

/** Tempo verbal de coisa já feita: a síntese e as entregas falam do que o projeto VAI fazer. */
const JA_FEITO = /(^|[^\p{L}])(foi|foram|demonstrou|demonstrado|comprovou|comprovado|validou|validado|reduziu|já)(?![\p{L}])/iu;

/** O que impede os textos de apresentação de valer, em linguagem da página. Lista vazia = em ordem. */
export function pendenciasDaApresentacao(p: Proposta, a: Apresentacao): string[] {
  const pendencias: string[] = [];
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

  const textos = [
    a.problema.pergunta, a.problema.necessidade, a.solucao, a.expansao, a.novosProjetos, ...a.conversa,
    ...a.sintese.map((x) => `${x.verbo} ${x.texto}`), ...a.etapas.map((e) => e.entrega), ...a.reuso.map((r) => r.uso),
  ];
  if ([...textos, ...a.fontes, a.provaPreliminar.descricao, a.provaPreliminar.conferencia].some((t) => ENDOSSO.test(t))) {
    pendencias.push("Texto de apresentação atribui aprovação, autorização ou endosso: a proposta é da PONTE, para apreciação.");
  }
  if (a.conversa.length === 0) pendencias.push("Faltam os temas da próxima conversa.");
  if (textos.some((t) => !t.trim())) pendencias.push("Falta texto de apresentação.");
  if (textos.some((t) => /\d/.test(t))) {
    pendencias.push("Texto de apresentação com número: indicador, estatística ou meta só entra com fonte conferida.");
  }
  if (a.fontes.length === 0) pendencias.push("Faltam as fontes documentais.");
  if (a.estado === "redacao-provisoria") {
    pendencias.push("Os textos de apresentação estão em redação provisória.");
  }
  return pendencias;
}

/** "R$ 200 mil" quando o valor é múltiplo exato de mil reais; senão, o valor exato. Nunca arredonda. */
export function centavosResumidos(centavos: number): string {
  if (Number.isSafeInteger(centavos) && centavos > 0 && centavos % 100_000 === 0) {
    const mil = (centavos / 100_000).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `R$ ${mil} mil`;
  }
  return centavosEmReais(centavos);
}

// ------------------------------------------------------------------ utilidades

export function dataBr(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso;
}
