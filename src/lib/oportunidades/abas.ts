/**
 * O menu do Mapa (`MapaNav`): as abas, quem vê cada uma e qual fica acesa para um caminho. Funções puras, fora do
 * componente, para ter teste.
 *
 * O instrumento e a proposta, abertos a partir da busca, acendem a Busca. O laudo mora debaixo de /mapa/instrumento e,
 * desde a onda 12, vale para qualquer instrumento: acende a Busca, a não ser que se chegue a ele pela lista das
 * suspensivas — os links de lá levam `?de=suspensivas`, e aí acende a aba Suspensivas.
 *
 * O território (B11, 08/10/2026; achado H04 da auditoria B1+B2): Brasil, UF, município e entidade não tinham porta
 * no menu — só se chegava a eles pela trilha de uma página aberta pela busca, e nenhuma aba acendia. Agora a aba
 * "Território" leva ao Brasil e acende nas quatro. A página do próprio município (ou da própria entidade) continua
 * sendo do "Meu município" (ou da "Minha organização"), e só dela.
 */

/** Uma rota que só conta quando se chega a ela vindo de uma origem (`?de=<origem>`). */
export interface PelaOrigem {
  rota: RegExp;
  de: string;
}

type Casamento = string | RegExp | PelaOrigem;

export interface RegraAba {
  href: string;
  /** Só o caminho exato: "/mapa" não pode casar como prefixo de "/mapa/avisos". */
  exata: boolean;
  /** Outras rotas que acendem esta aba. Texto é prefixo. */
  tambem?: readonly Casamento[];
  /** Rotas que, mesmo casando, não acendem esta aba. */
  exceto?: readonly Casamento[];
}

export const ROTA_LAUDO = /^\/mapa\/instrumento\/[^/]+\/laudo(?:\/|$)/;
export const ORIGEM_SUSPENSIVAS = "suspensivas";
export const LAUDO_PELAS_SUSPENSIVAS: PelaOrigem = { rota: ROTA_LAUDO, de: ORIGEM_SUSPENSIVAS };

function casa(c: Casamento, caminho: string, de: string | null): boolean {
  if (typeof c === "string") return caminho.startsWith(c);
  if (c instanceof RegExp) return c.test(caminho);
  return c.de === de && c.rota.test(caminho);
}

/**
 * A página do próprio município (`/mapa/municipio/<ibge>` da organização ativa, e as rotas debaixo dela) acende
 * "Meu município" e nenhuma outra aba (F1c, 07/10/2026). A página de outro município acende o "Território" (B11).
 */
export function noMeuMunicipio(caminho: string, meuIbge: string | null | undefined): boolean {
  if (!meuIbge) return false;
  const base = `/mapa/municipio/${meuIbge}`;
  return caminho === base || caminho.startsWith(`${base}/`);
}

/** A página da própria entidade (oport_31: organização com o CNPJ confirmado) acende "Minha organização". */
export function naMinhaEntidade(caminho: string, cnpj: string | null | undefined): boolean {
  if (!cnpj) return false;
  const base = `/mapa/entidade/${cnpj}`;
  return caminho === base || caminho.startsWith(`${base}/`);
}

/** `de`: o parâmetro `de` da URL, quando houver. */
export function abaAtiva(aba: RegraAba, caminho: string, de: string | null = null): boolean {
  if (aba.exata) return caminho === aba.href;
  if ((aba.exceto ?? []).some((c) => casa(c, caminho, de))) return false;
  return caminho.startsWith(aba.href) || (aba.tambem ?? []).some((c) => casa(c, caminho, de));
}

// ================================================================ o menu

/** Uma aba do menu: para onde leva, o nome, quem vê e quando acende. */
export interface AbaMenu extends RegraAba {
  nome: string;
  /** Só para o administrador. */
  admin: boolean;
  /** "Meu município": só para a organização de município com IBGE; acende sozinha na página do próprio município. */
  municipio: boolean;
  /** "Minha organização": só para a organização que não é prefeitura e tem CNPJ (oport_31); acende sozinha na página dela. */
  organizacao?: boolean;
}

/**
 * O resto da descida abaixo do Brasil (que é o próprio destino da aba): UF, município e entidade, com as rotas debaixo
 * de cada um (organizações, investimentos, relatório). O painel do município (/mapa/painel/municipio/…) não casa: é
 * do Painel.
 */
export const ROTAS_DO_TERRITORIO = ["/mapa/uf/", "/mapa/municipio/", "/mapa/entidade/"] as const;

export const ABAS_MENU: readonly AbaMenu[] = [
  // `exata`: sem ela, "/mapa" casaria como prefixo de "/mapa/avisos" e as duas abas apareceriam ativas ao mesmo tempo.
  { href: "/mapa", nome: "Janelas", exata: true, admin: false, municipio: false },
  { href: "/mapa/avisos", nome: "Avisos", exata: false, admin: false, municipio: false },
  // A carteira (02/10/2026): os municípios e itens seguidos, o que mudou e a próxima ação.
  { href: "/mapa/carteira", nome: "Carteira", exata: false, admin: false, municipio: false },
  // O convênio e a proposta não têm aba própria: acendem a da busca. O laudo de qualquer instrumento também; o
  // aberto pela lista das suspensivas, não.
  {
    href: "/mapa/busca",
    nome: "Busca",
    exata: false,
    admin: false,
    municipio: false,
    tambem: ["/mapa/instrumento/", "/mapa/proposta/"],
    exceto: [LAUDO_PELAS_SUSPENSIVAS],
  },
  // A porta do território (B11, 08/10/2026): leva ao topo da descida, o Brasil, e acende em toda ela. O nome é
  // "Território", e não "Brasil e estados", porque a aba também fica acesa no município e na entidade: é a palavra que
  // o próprio Mapa usa para a descida ("o território soma: Brasil › UF › município › entidade").
  { href: "/mapa/brasil", nome: "Território", exata: false, admin: false, municipio: false, tambem: ROTAS_DO_TERRITORIO },
  // Só para quem está numa organização de município. A página confere o vínculo confirmado e explica o que falta; a
  // aba só evita mostrar a porta a quem não é prefeitura. Com o vínculo confirmado, a página redireciona para a do
  // município em abas, que também acende esta aba (e não o Território). O laudo do Pix (/mapa/pix/…) serve às duas:
  // o cliente chega pelo Meu município, o administrador pelo Painel.
  { href: "/mapa/meu-municipio", nome: "Meu município", exata: false, admin: false, municipio: true, tambem: ["/mapa/pix/"] },
  // A organização que não é prefeitura (OSC, órgão estadual, consórcio), com o CNPJ confirmado (oport_31).
  { href: "/mapa/minha-organizacao", nome: "Minha organização", exata: false, admin: false, municipio: false, organizacao: true },
  // Uso interno da PONTE. Esconder a aba é conveniência; quem protege é a página, que confere o administrador no
  // servidor antes de ler qualquer dado.
  { href: "/mapa/radar", nome: "Radar", exata: false, admin: true, municipio: false },
  { href: "/mapa/painel", nome: "Painel", exata: false, admin: true, municipio: false, tambem: ["/mapa/pix/"] },
  { href: "/mapa/fiscal", nome: "Fiscal", exata: false, admin: true, municipio: false },
  { href: "/mapa/suspensivas", nome: "Suspensivas", exata: false, admin: true, municipio: false, tambem: [LAUDO_PELAS_SUSPENSIVAS] },
  // O dossiê de cada empresa (/mapa/fornecedor/<cnpj>) acende a lista.
  { href: "/mapa/fornecedores", nome: "Fornecedores", exata: false, admin: true, municipio: false, tambem: ["/mapa/fornecedor/"] },
];

/** Quem está olhando o menu: administrador, organização de município com IBGE, organização com CNPJ. */
export interface PerfilMenu {
  admin: boolean;
  municipio: boolean;
  organizacao: boolean;
}

/** As abas que o perfil vê, na ordem do menu. */
export function abasDoMenu(p: PerfilMenu, abas: readonly AbaMenu[] = ABAS_MENU): AbaMenu[] {
  return abas.filter((a) => (p.admin || !a.admin) && (p.municipio || !a.municipio) && (p.organizacao || !a.organizacao));
}

/**
 * A aba acesa (o `href` dela), ou null quando a página não é de nenhuma — uma por vez, sempre (B11; achado da B2: o
 * administrador com prefeitura via duas abas com `aria-current` no laudo do Pix).
 *
 * Primeiro a página do próprio cliente: o município do "Meu município", a entidade da "Minha organização". Depois, a
 * primeira aba do menu que casa com o caminho. `abas` são as que o perfil vê (`abasDoMenu`); `meuIbge` e
 * `minhaEntidade` só valem quando a aba do dono está entre elas.
 */
export function abaAcesa(
  abas: readonly AbaMenu[],
  caminho: string,
  de: string | null = null,
  dono: { meuIbge?: string | null; minhaEntidade?: string | null } = {},
): string | null {
  const doMunicipio = abas.find((a) => a.municipio);
  if (doMunicipio && noMeuMunicipio(caminho, dono.meuIbge)) return doMunicipio.href;
  const daOrganizacao = abas.find((a) => a.organizacao);
  if (daOrganizacao && naMinhaEntidade(caminho, dono.minhaEntidade)) return daOrganizacao.href;
  return abas.find((a) => abaAtiva(a, caminho, de))?.href ?? null;
}
