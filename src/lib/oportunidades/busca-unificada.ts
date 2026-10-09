/**
 * Busca unificada (C2, onda 4 de UX, 08/10/2026): um campo só que acha os cinco tipos do Mapa — municípios, entidades,
 * organizações da sociedade civil, convênios e propostas — pelo nome, pelo CNPJ ou pelo número. Antes, cada tipo tinha
 * a sua aba e o município e a entidade não tinham busca pelo nome (inventário B0, §5: de 5 a 6 cliques até a página do
 * próprio município para quem não tem vínculo).
 *
 * Onde cada grupo procura (o porquê está nas medições de `ux-onda4/C2-busca-unificada.md`). A UF do formulário muda
 * só convênios e propostas, e o rótulo do campo diz isso; os outros três grupos têm alcance fixo, dito em cada um:
 *   · Municípios: os 223 da PB (lista fixa) e os de fora com sinal no painel, pelo nome (B12), sempre no Brasil.
 *   · Entidades: pelo nome ou pelo município, as da PB (a lista dos proponentes com convênio, 498 em 08/10/2026, que
 *     fica 10 minutos na memória); pelo CNPJ completo, qualquer UF. Fora da PB, a lista pelo nome custa até 3,6 s por UF (SP, fria):
 *     não entra; o grupo diz e oferece o CNPJ e o proponente dos convênios.
 *   · Organizações: o cadastro do Mapa das OSC (Ipea), que só cobre a PB.
 *   · Convênios e propostas: na UF escolhida; sem UF, na PB, onde a base é completa e a resposta leva dezenas de ms.
 *     No Brasil inteiro, com texto, as mesmas funções levaram de 4 a 15 s (acima dos 8 s da API): a tela não as
 *     dispara sozinha e oferece o link para a lista do Brasil, dizendo quanto demora.
 *
 * Aqui fica o que é puro: o que a pessoa digitou, onde cada grupo procura, o casamento das entidades pelo nome, o corte
 * nos 5 primeiros com o "Ver todos (N)", a frase da região viva e o vazio. Sem banco.
 */
import { dobrar, numeroValido, termosDaBusca, urlBusca, type ParametrosBusca } from "./busca.ts";
import { palavraMaisLonga, pareceMunicipio, type SaidaBusca } from "./busca-municipio.ts";
import { cnpjValido } from "./organizacao.ts";
import { ROTULO_ESPECIE, especieDe, urlEntidade, type EspecieEntidade } from "./pagina-entidade.ts";
import { NOME_UF, urlUf } from "./pagina-uf.ts";

/** Quantos itens cada grupo mostra antes do "Ver todos (N)". */
export const LIMITE_GRUPO = 5;
/** Quantas entidades o "Ver todas" abre no lugar; acima disso, a tela pede mais do nome. */
export const MAXIMO_ENTIDADES_ABERTAS = 50;

// ============================ O QUE A PESSOA DIGITOU ============================

/**
 * A entrada, para decidir se vai direto a uma página:
 *   · `cnpj` — 14 dígitos (com ou sem máscara) com os dígitos verificadores certos;
 *   · `cnpj_invalido` — 14 dígitos que não fecham a conta (a tela avisa e procura como texto);
 *   · `numero` — uma palavra só, de 3 a 20 letras e dígitos, com pelo menos um dígito (há convênio "7AACFT"), com ou
 *     sem "nº" na frente: pode ser o número de um convênio;
 *   · `texto` — o resto; `vazia` — nada digitado.
 */
export type Entrada =
  | { tipo: "vazia" }
  | { tipo: "texto" }
  | { tipo: "cnpj"; cnpj: string }
  | { tipo: "cnpj_invalido"; digitos: string }
  | { tipo: "numero"; numero: string };

export function classificarEntrada(q: string): Entrada {
  const t = q.trim();
  if (!t) return { tipo: "vazia" };
  if (/^[\d.\/\-\s]+$/.test(t)) {
    const d = t.replace(/\D/g, "");
    if (d.length === 14) return cnpjValido(d) ? { tipo: "cnpj", cnpj: d } : { tipo: "cnpj_invalido", digitos: d };
  }
  const numero = t.replace(/^n\s*[º°o.]{1,2}\s*(?=\d)/i, "");
  if (numero.length >= 3 && numeroValido(numero) && /\d/.test(numero)) return { tipo: "numero", numero };
  return { tipo: "texto" };
}

/** O formulário da unificada manda `direto=1`: só quem digitou no campo vai direto à página (ver `page.tsx`). */
export function pedeDireto(sp: Record<string, string | string[] | undefined>): boolean {
  const v = Array.isArray(sp.direto) ? sp.direto[0] : sp.direto;
  return v === "1";
}

// ============================ ONDE CADA GRUPO PROCURA ============================

export interface EscopoUnificado {
  /** A UF dos convênios e propostas: a escolhida, ou a PB. */
  uf: string;
  ehPb: boolean;
  /** Sem UF escolhida: a PB é o padrão, e cada grupo oferece o Brasil inteiro. */
  padrao: boolean;
  /** "na Paraíba", "em SP". */
  onde: string;
}

export function escopoUnificado(p: Pick<ParametrosBusca, "uf">): EscopoUnificado {
  const uf = p.uf && p.uf !== "PB" ? p.uf : "PB";
  return { uf, ehPb: uf === "PB", padrao: !p.uf || p.uf === "PB", onde: uf === "PB" ? "na Paraíba" : `em ${uf}` };
}

/** O que a tela diz sobre o tempo e o recorte, logo abaixo do formulário (sem esconder o Brasil inteiro). */
export function avisoDoEscopo(e: EscopoUnificado): string {
  if (e.padrao) {
    return "Convênios e propostas: na Paraíba, onde a resposta vem na hora. No Brasil inteiro, essa busca leva de 4 a 15 segundos, e a das propostas costuma passar do limite e não voltar; por isso não sai sozinha, e os dois grupos têm o link “no Brasil inteiro”.";
  }
  return `Convênios e propostas ${e.onde} (${NOME_UF[e.uf] ?? e.uf}): fora da Paraíba a resposta pode levar alguns segundos, e esses dois grupos aparecem quando chegam. Municípios, entidades e organizações não mudam com a UF.`;
}

/** Onde cada grupo procura, dito no próprio grupo. */
export function alcanceDoGrupo(id: IdGrupo, e: EscopoUnificado): string {
  switch (id) {
    case "municipios":
      return "Os 223 da Paraíba e os de outras UFs que aparecem no painel, pelo nome.";
    case "entidades":
      return "Prefeituras, fundos, órgãos e OSC com convênio: da Paraíba pelo nome ou pelo município; de qualquer UF pelo CNPJ completo.";
    case "organizacoes":
      return "Da Paraíba, no Mapa das OSC (Ipea), com ou sem convênio, pelo nome ou CNPJ.";
    case "convenios":
      return e.ehPb ? "Na Paraíba, todos desde 2008." : `${NOME_UF[e.uf] ?? e.uf} (${e.uf}): os em execução ou prestando contas.`;
    case "propostas":
      return e.ehPb ? "Na Paraíba, desde 2019." : `${NOME_UF[e.uf] ?? e.uf} (${e.uf}): as recentes.`;
  }
}

// ============================ OS GRUPOS ============================

export type IdGrupo = "municipios" | "entidades" | "organizacoes" | "convenios" | "propostas";

export const GRUPOS_UNIFICADOS: readonly { id: IdGrupo; titulo: string; um: string; varios: string; todos: string }[] = [
  { id: "municipios", titulo: "Municípios", um: "município", varios: "municípios", todos: "todos os municípios" },
  { id: "entidades", titulo: "Entidades", um: "entidade", varios: "entidades", todos: "todas as entidades" },
  { id: "organizacoes", titulo: "Organizações da sociedade civil", um: "organização", varios: "organizações", todos: "todas as organizações" },
  { id: "convenios", titulo: "Convênios", um: "convênio", varios: "convênios", todos: "todos os convênios" },
  { id: "propostas", titulo: "Propostas", um: "proposta", varios: "propostas", todos: "todas as propostas" },
];

const grupoDe = (id: IdGrupo) => GRUPOS_UNIFICADOS.find((g) => g.id === id) as (typeof GRUPOS_UNIFICADOS)[number];

/**
 * Um grupo lido. Cada grupo falha sozinho: `erro` não derruba os outros. `fora` é o grupo que não se aplica a esta
 * busca (o município com número no termo), com o motivo dito na tela.
 *   · `itens`: o que a tela pode mostrar (os 5 primeiros vêm à vista, o resto no "Ver todos");
 *   · `total`: a contagem exata;
 *   · `mais`: há outros além do total (a peneira dos municípios de fora da PB para em 60);
 *   · `aviso`: uma parte do grupo não pôde ser lida (os municípios de fora da PB), dita na tela.
 */
export type GrupoLido<T> =
  | { estado: "ok"; itens: T[]; total: number; mais?: boolean; aviso?: string }
  | { estado: "fora"; motivo: string }
  | { estado: "erro" };

/** Os primeiros à vista e o resto. */
export function cortar<T>(itens: readonly T[], limite = LIMITE_GRUPO): { primeiros: T[]; resto: T[] } {
  return { primeiros: itens.slice(0, limite), resto: itens.slice(limite) };
}

/** O rótulo do "Ver todos (N)", com o tipo dentro (sem `title`: o texto visível diz aonde vai). */
export function rotuloVerTodos(id: IdGrupo, total: number): string {
  return `Ver ${grupoDe(id).todos} (${total.toLocaleString("pt-BR")})`;
}

/**
 * O endereço do "Ver todos (N)": a aba daquele tipo, com o mesmo termo e a mesma UF, para a lista dar o mesmo N.
 * Municípios e entidades não têm aba: abrem no lugar (null).
 */
export function urlVerTodos(p: ParametrosBusca, id: IdGrupo): string | null {
  const e = escopoUnificado(p);
  if (id === "organizacoes") return urlBusca(p, { aba: "organizacoes" });
  if (id === "convenios") return urlBusca(p, { aba: "instrumentos", uf: e.uf });
  if (id === "propostas") return urlBusca(p, { aba: "propostas", uf: e.uf });
  return null;
}

/**
 * O endereço de cada chip "O que buscar". Da unificada com termo para Convênios ou Propostas, a UF vai junto (a PB,
 * quando é o padrão): a lista mostra o mesmo recorte do grupo, e não cai sem querer no Brasil inteiro, de 4 a 15 s.
 */
export function urlDoChip(p: ParametrosBusca, aba: ParametrosBusca["aba"]): string {
  const levaUf = p.aba === "tudo" && p.q && (aba === "instrumentos" || aba === "propostas");
  return urlBusca(p, levaUf ? { aba, uf: escopoUnificado(p).uf } : { aba });
}

/** A lista do Brasil inteiro (a aba sem UF), que a unificada não dispara sozinha. */
export function urlBrasilInteiro(p: ParametrosBusca, id: "convenios" | "propostas"): string {
  return urlBusca(p, { aba: id === "convenios" ? "instrumentos" : "propostas", uf: null });
}

/** O que o grupo vazio diz: o que foi procurado e onde. */
export function textoGrupoVazio(id: IdGrupo, p: ParametrosBusca, entrada: Entrada): string {
  const e = escopoUnificado(p);
  switch (id) {
    case "municipios":
      return pareceMunicipio(p.q) ? "Nenhum município com esse nome." : MOTIVO_MUNICIPIO_FORA;
    case "entidades":
      return entrada.tipo === "cnpj"
        ? "Nenhuma entidade com esse CNPJ nos convênios, nas propostas nem no Mapa das OSC."
        : "Nenhuma entidade da Paraíba com convênio com esse nome ou nesse município.";
    case "organizacoes":
      return "Nenhuma organização da Paraíba com esse nome ou CNPJ no Mapa das OSC.";
    case "convenios":
      return `Nenhum convênio ${e.onde} com esses termos.`;
    case "propostas":
      return `Nenhuma proposta ${e.onde} com esses termos.`;
  }
}

/** Por que o grupo dos municípios não procurou (`pareceMunicipio` da B12). */
export const MOTIVO_MUNICIPIO_FORA = "Não procurado: o nome de município se procura sem número, com 3 letras ou mais e até 6 palavras.";

/** A nota das entidades fora da PB: pelo nome só as da PB; das outras UFs, o CNPJ ou o proponente dos convênios. */
export function notaEntidadesFora(e: EscopoUnificado): string | null {
  return e.ehPb ? null : `As entidades de ${e.uf} se acham pelo CNPJ completo, ou pelo proponente de um dos convênios abaixo.`;
}

// ============================ ENTIDADES PELO NOME ============================

/** Uma linha de `painel_territorio_proponente` (a mesma da página da UF). */
export interface ProponenteBusca {
  cnpj: string;
  proponente: string | null;
  tipo_agente: string | null;
  cod_ibge: string | null;
  municipio: string | null;
  instrumentos: number;
  em_execucao: number;
}

export interface EntidadeAchada {
  cnpj: string;
  nome: string;
  especie: EspecieEntidade;
  /** "Prefeitura", "Fundo municipal", "Organização da sociedade civil"… */
  rotulo: string;
  municipio: string | null;
  uf: string | null;
  /** Convênios na base; null quando a entidade veio do CNPJ (a contagem fica na página dela). */
  instrumentos: number | null;
  emExecucao: number | null;
  href: string;
}

// O mesmo padrão do job (`definicoes.REGEX_CPF`) e de `nomeFornecedor`: CPF com ou sem pontuação, fora de sequência maior.
const CPF = /(^|[^0-9])[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}(?=[^0-9]|$)/g;

/** Segunda trava de privacidade: o nome de um proponente (MEI, empresário individual) pode trazer o CPF. */
export function semCpf(nome: string): string {
  return nome.replace(CPF, "$1***").trim();
}

/** A entidade como a tela mostra, a partir de qualquer fonte (a lista da PB, o CNPJ nos convênios, o Mapa das OSC). */
export function entidadeAchada(e: {
  cnpj: string;
  nome: string | null;
  tipo_agente?: string | null;
  especie?: EspecieEntidade;
  municipio: string | null;
  uf: string | null;
  instrumentos?: number | null;
  emExecucao?: number | null;
}): EntidadeAchada {
  const especie = e.especie ?? especieDe(e.nome, e.tipo_agente ?? null);
  return {
    cnpj: e.cnpj,
    nome: semCpf(e.nome ?? "") || `CNPJ ${e.cnpj}`,
    especie,
    rotulo: ROTULO_ESPECIE[especie],
    municipio: e.municipio,
    uf: e.uf,
    instrumentos: e.instrumentos ?? null,
    emExecucao: e.emExecucao ?? null,
    href: urlEntidade(e.cnpj),
  };
}

/**
 * As entidades da lista em que cada termo aparece no nome ou no município (o mesmo `termosDaBusca` dos convênios: sem
 * acento, sem caixa, pedaço de palavra vale), ou cujo CNPJ começa pelo número digitado (8 dígitos ou mais: a raiz).
 * O município entra porque o SICONV grava fundos sem a cidade no nome: o de Patos é só "FUNDO MUNICIPAL DE SAUDE"
 * (execução 43, 09/10/2026), e "patos" pelo nome achava só a prefeitura.
 * Ordem: o nome que começa pelo que se digitou (3); cada termo no começo de uma palavra do nome (2); do nome ou do
 * município (1); pedaço no meio de palavra (0, "patos" em "sapatos"). Dentro do grau, quem tem mais convênios, depois
 * o nome.
 */
export function casarEntidades(q: string, lista: readonly ProponenteBusca[], uf = "PB"): EntidadeAchada[] {
  const termos = termosDaBusca(q);
  if (!termos.length) return [];
  const frase = termos.join(" ");
  const comecam = (palavras: string[]) => termos.every((t) => palavras.some((w) => w.startsWith(t)));
  const achadas: { e: EntidadeAchada; grau: number }[] = [];
  for (const l of lista) {
    const nome = dobrar(l.proponente ?? "");
    const comMunicipio = `${nome} ${dobrar(l.municipio ?? "")}`;
    const porCnpj = termos.length === 1 && /^\d{8,14}$/.test(termos[0]) && l.cnpj.startsWith(termos[0]);
    if (!porCnpj && !termos.every((t) => comMunicipio.includes(t))) continue;
    const grau =
      porCnpj || nome.startsWith(frase)
        ? 3
        : comecam(nome.split(/[^a-z0-9]+/))
          ? 2
          : comecam(comMunicipio.split(/[^a-z0-9]+/))
            ? 1
            : 0;
    achadas.push({
      e: entidadeAchada({
        cnpj: l.cnpj,
        nome: l.proponente,
        tipo_agente: l.tipo_agente,
        municipio: l.municipio,
        uf,
        instrumentos: Number(l.instrumentos),
        emExecucao: Number(l.em_execucao),
      }),
      grau,
    });
  }
  return achadas
    .sort((a, b) => b.grau - a.grau || (b.e.instrumentos ?? 0) - (a.e.instrumentos ?? 0) || a.e.nome.localeCompare(b.e.nome, "pt-BR"))
    .map((a) => a.e);
}

// ============================ A REGIÃO VIVA E O VAZIO ============================

/** Só o que a frase precisa de cada grupo. */
export type Contado = { estado: "ok"; total: number } | { estado: "fora" } | { estado: "erro" };

const juntar = (partes: string[]) => (partes.length <= 1 ? partes.join("") : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`);

/**
 * A frase da região viva (`role="status"`), quando os cinco grupos chegaram: o total e o que veio de cada tipo, e o que
 * não pôde ser lido. "57 resultados para “patos”: 1 município, 6 entidades, 30 organizações, 12 convênios e 8 propostas."
 */
export function resumoUnificado(q: string, grupos: Record<IdGrupo, Contado>): string {
  const ok = GRUPOS_UNIFICADOS.filter((g) => grupos[g.id].estado === "ok");
  const falhos = GRUPOS_UNIFICADOS.filter((g) => grupos[g.id].estado === "erro");
  const total = ok.reduce((s, g) => s + (grupos[g.id] as { total: number }).total, 0);
  // Os tipos sem nada ficam fora da frase: cada grupo, na tela, já diz o seu zero.
  const partes = ok.flatMap((g) => {
    const n = (grupos[g.id] as { total: number }).total;
    return n > 0 ? [`${n.toLocaleString("pt-BR")} ${n === 1 ? g.um : g.varios}`] : [];
  });
  let frase =
    total === 0
      ? `Nada encontrado para “${q}”${ok.length ? ` em ${juntar(ok.map((g) => g.varios))}` : ""}.`
      : `${total.toLocaleString("pt-BR")} ${total === 1 ? "resultado" : "resultados"} para “${q}”: ${juntar(partes)}.`;
  if (falhos.length) frase += ` Não puderam ser lidos agora: ${juntar(falhos.map((g) => g.varios))}.`;
  return frase;
}

/** Os cinco grupos sem nada (os que não se aplicam contam como vazios); com algum erro, não é "nada encontrado". */
export function tudoVazio(grupos: Record<IdGrupo, Contado>): boolean {
  const lista = Object.values(grupos);
  return lista.every((g) => g.estado !== "erro") && lista.every((g) => g.estado !== "ok" || g.total === 0);
}

/**
 * O vazio da unificada, no padrão da B12: diz o que foi procurado e onde, e o que tentar, do mais perto ao mais longe —
 * o CNPJ errado, uma palavra só, a Paraíba (vindo de outra UF), o Brasil inteiro (vindo da PB), o número, os municípios
 * da PB e as janelas.
 */
export function vazioUnificado(p: ParametrosBusca, entrada: Entrada): { titulo: string; texto: string; saidas: SaidaBusca[] } {
  const e = escopoUnificado(p);
  const saidas: SaidaBusca[] = [];
  if (entrada.tipo === "cnpj_invalido") {
    saidas.push({ texto: "Confira o CNPJ: os 14 dígitos digitados não fecham com os dígitos verificadores.", href: null });
  }
  const palavra = palavraMaisLonga(p.q);
  if (palavra) saidas.push({ texto: `Buscar só “${palavra}”`, href: urlBusca(p, { q: palavra }) });
  if (!e.padrao) saidas.push({ texto: `Procurar “${p.q}” na Paraíba`, href: urlBusca(p, { uf: null }) });
  if (e.padrao) {
    saidas.push({ texto: `Procurar “${p.q}” nos convênios do Brasil inteiro`, href: urlBrasilInteiro(p, "convenios"), nota: "(leva alguns segundos)" });
    saidas.push({ texto: `Procurar “${p.q}” nas propostas do Brasil inteiro`, href: urlBrasilInteiro(p, "propostas"), nota: "(sem a UF, costuma passar do limite de tempo e não voltar: se puder, escolha a UF)" });
  }
  // Os 9.320 convênios da PB na execução 43 (09/10/2026) têm número de 6 posições; 221 deles com letra.
  if (entrada.tipo === "numero") saidas.push({ texto: "Confira o número digitado: o do convênio tem 6 posições (ex.: 956541).", href: null });
  saidas.push({ texto: "Ver os municípios da Paraíba", href: urlUf("PB", "municipios"), nota: "ou escreva na busca só o nome do município, como “Sousa”" });
  saidas.push({ texto: "Ver as janelas abertas", href: "/mapa" });
  return {
    titulo: `Nada encontrado para “${p.q}”`,
    texto: `Nenhum município, entidade, organização, convênio ou proposta com esse nome, CNPJ ou número (convênios e propostas ${e.onde}).`,
    saidas,
  };
}
