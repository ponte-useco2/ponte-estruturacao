/**
 * O portão público do Mapa (C4a, 09/10/2026): quem entra no `/mapa` sem cadastro aprovado, em quais rotas e com qual
 * nível. Funções puras, com teste; o layout, a moldura, o menu e as páginas só chamam o que está aqui.
 *
 * Tudo atrás de uma chave de ambiente DESLIGADA por padrão, `MAPA_PUBLICO`, que só liga quando vale exatamente "1".
 * Desligada, o portão é o de antes de C4a, caso a caso (o teste compara com uma cópia da lógica antiga): sem Supabase
 * configurado, vai para a entrada com `erro=config`; o anônimo, para a entrada com o `next`; o cadastro não aprovado,
 * para a sala de espera; o aprovado entra. A abertura em si não está aprovada: depende do teste com pessoas, das
 * auditorias finais e da combinação com a sessão dona do proxy, do Header e da página de entrada.
 *
 * Ligada, quem não tem cadastro aprovado (o anônimo, e também o cadastro pendente ou bloqueado, que não pode ver menos
 * do que o anônimo) entra com o nível 0 da decisão D1 (06/10/2026), e só nas rotas da lista branca `ROTAS_PUBLICAS`.
 * Rota fora da lista continua pedindo login, inclusive rota nova: lista branca, nunca negra. As ações do servidor e as
 * rotas de CSV não passam por aqui: cada uma confere o aprovado por conta própria, e continua conferindo.
 */
import { destinoSeguro } from "./destino.ts";
import type { NivelAcesso } from "./pagina-municipio.ts";

// ================================================================ a chave

/** Só "1" liga. "true", " 1", "01", vazio ou ausente: desligada — configuração ambígua fecha a porta, nunca abre. */
export function chaveLigada(valor: string | null | undefined): boolean {
  return valor === "1";
}

/**
 * A chave como está no ambiente do servidor. `MAPA_PUBLICO` não tem o prefixo `NEXT_PUBLIC_`: no navegador ela não
 * existe, e a função devolveria false. Quem decide é sempre o servidor (o layout e as páginas).
 */
export function chaveDoAmbiente(): boolean {
  return chaveLigada(process.env.MAPA_PUBLICO);
}

// ================================================================ a lista branca

/** O nível de quem não tem cadastro aprovado (D1: 0 público · 1 cadastrado · 2 cliente · 3 administrador). */
export const NIVEL_DO_PUBLICO: NivelAcesso = 0;

/**
 * As rotas que o público vê, cada uma com o porquê (D1). O padrão casa o caminho inteiro, sem a query: nada debaixo
 * de uma rota entra junto — o laudo (`/instrumento/<n>/laudo`), o relatório para imprimir (`/<nível>/relatorio`), o
 * CSV e as organizações do município ficam de fora. Cada página da lista atende quem chega com nível 0 (ela mesma
 * confere, com `quemAPaginaAtende`); rota nova só entra aqui junto com a página que sabe atender o público.
 *
 * Ficam de fora, por decisão do titular ainda em aberto (revisão R3 de 09/10/2026, seção 6): a busca, a página da
 * proposta e a lista das OSC do município. A D1 não cita nenhuma das três, e a busca é a porta da raspagem em volume
 * (Brasil inteiro, paginação funda) e da procura por nome.
 */
export const ROTAS_PUBLICAS: readonly { rota: string; padrao: RegExp; porque: string }[] = [
  { rota: "/mapa", padrao: /^\/mapa$/, porque: "as janelas abertas (D1: o público vê as janelas)" },
  { rota: "/mapa/brasil", padrao: /^\/mapa\/brasil$/, porque: "o Brasil em resumo (D1)" },
  { rota: "/mapa/uf/[sigla]", padrao: /^\/mapa\/uf\/[A-Za-z]{2}$/, porque: "a UF em resumo (D1)" },
  { rota: "/mapa/municipio/[ibge]", padrao: /^\/mapa\/municipio\/\d{7}$/, porque: "o resumo e os indicadores do município (D1)" },
  {
    rota: "/mapa/municipio/[ibge]/investimentos",
    padrao: /^\/mapa\/municipio\/\d{7}\/investimentos$/,
    porque: "os totais e a lista dos instrumentos do município, sem análise (D1: a situação dos instrumentos)",
  },
  // O CNPJ pode vir com máscara ("12.345.678%2F0001-90"; a página redireciona para os 14 caracteres): letras, números,
  // ponto, hífen e o "%" da barra codificada, com ao menos uma letra ou um número (".." não é CNPJ).
  {
    rota: "/mapa/entidade/[cnpj]",
    padrao: /^\/mapa\/entidade\/(?=[^/]*[0-9A-Za-z])[0-9A-Za-z.%-]{1,64}$/,
    porque: "a entidade e a lista dos instrumentos dela (D1)",
  },
  { rota: "/mapa/instrumento/[numero]", padrao: /^\/mapa\/instrumento\/[0-9A-Za-z]{1,20}$/, porque: "a situação do instrumento (D1)" },
  // Sem dado nenhum (o conteúdo é o de `glossario.ts`), e as páginas abertas apontam para ele pelo `<Termo>`.
  { rota: "/mapa/glossario", padrao: /^\/mapa\/glossario$/, porque: "a explicação dos termos que as páginas abertas usam, sem dado" },
];

/**
 * Se o caminho (com ou sem query) é de uma rota aberta ao público. O caminho passa antes por `destinoSeguro`: o que
 * não serve de destino interno (vazio, `//x`, barra invertida, caractere de controle) não é público. Sem o cabeçalho do
 * caminho, o layout recebe null e a resposta é "não": a falta de informação fecha a porta.
 */
export function rotaPublica(caminho: string | null | undefined): boolean {
  const seguro = destinoSeguro(caminho, "");
  if (!seguro) return false;
  const so = seguro.split(/[?#]/, 1)[0];
  return ROTAS_PUBLICAS.some((r) => r.padrao.test(so));
}

// ================================================================ a sessão e o caminho de volta

/** Quem olha a versão pública: sem sessão, ou com sessão cujo cadastro não está aprovado (pendente ou bloqueado). */
export type SessaoPublica = "anonimo" | "nao_aprovado";

export function sessaoDoPublico(visitante: { status: string } | null): SessaoPublica {
  return visitante ? "nao_aprovado" : "anonimo";
}

/** Para onde voltar depois de entrar: o pedido, se é seguro e do Mapa; senão a raiz do Mapa. A regra do layout de antes. */
export function voltaParaOMapa(caminho: string | null | undefined): string {
  const pedido = destinoSeguro(caminho, "/mapa");
  return pedido.startsWith("/mapa") ? pedido : "/mapa";
}

/** A entrada com o caminho de volta. */
export function urlEntrar(caminho: string | null | undefined): string {
  return `/oportunidades/entrar?next=${encodeURIComponent(voltaParaOMapa(caminho))}`;
}

export const URL_AGUARDANDO = "/oportunidades/aguardando";

/** A porta de fora para quem não tem cadastro aprovado: o anônimo vai à entrada (e volta depois); o resto, à sala de espera. */
function foraDoMapa(sessao: SessaoPublica, caminho: string | null | undefined): string {
  return sessao === "anonimo" ? urlEntrar(caminho) : URL_AGUARDANDO;
}

/**
 * Para onde vai quem está na versão pública e chega a uma rota fora da lista; null quando a rota é pública. A conta do
 * público (`ContaPublica`, na moldura) usa esta regra porque, na navegação dentro do Mapa, o layout não roda de novo:
 * só a página nova. É a mesma regra do layout (o teste confere as duas).
 */
export function destinoDoPublico(sessao: SessaoPublica, caminho: string | null | undefined): string | null {
  return rotaPublica(caminho) ? null : foraDoMapa(sessao, caminho);
}

// ================================================================ o layout e as páginas

export type AcessoDoLayout<V> =
  | { tipo: "redirecionar"; destino: string }
  | { tipo: "aprovado"; visitante: V }
  | { tipo: "publico"; sessao: SessaoPublica };

/**
 * A decisão do layout do `/mapa`. `caminho` é o que o proxy guarda no cabeçalho (caminho e query); `visitante`, o de
 * `visitanteAtual()` (null sem sessão). Sem Supabase configurado a porta fecha, com a chave ligada ou não: sem banco
 * não há página para mostrar, e a regra do projeto é nunca abrir por omissão.
 */
export function acessoDoLayout<V extends { status: string }>(e: {
  configurado: boolean;
  visitante: V | null;
  chave: boolean;
  caminho: string | null | undefined;
}): AcessoDoLayout<V> {
  if (!e.configurado) {
    return { tipo: "redirecionar", destino: `/oportunidades/entrar?erro=config&next=${encodeURIComponent(voltaParaOMapa(e.caminho))}` };
  }
  if (e.visitante?.status === "aprovado") return { tipo: "aprovado", visitante: e.visitante };
  const sessao = sessaoDoPublico(e.visitante);
  if (e.chave && rotaPublica(e.caminho)) return { tipo: "publico", sessao };
  return { tipo: "redirecionar", destino: foraDoMapa(sessao, e.caminho) };
}

/**
 * Quem a página de nível 0 atende. Layout e página renderizam em paralelo, e na navegação dentro do Mapa só a página
 * roda: por isso a página confere de novo, com a mesma chave e a mesma lista. `caminho` é o da própria página.
 *   - o aprovado: `{ aprovado }`, e o nível é o de sempre;
 *   - o resto, com a chave ligada e a rota na lista: `{ aprovado: null, sessao }`, nível 0;
 *   - senão, null — a página devolve null, como fazia antes de C4a.
 */
export function quemAPaginaAtende<V extends { status: string }>(
  visitante: V | null,
  chave: boolean,
  caminho: string,
): { aprovado: V; sessao: null } | { aprovado: null; sessao: SessaoPublica } | null {
  if (visitante?.status === "aprovado") return { aprovado: visitante, sessao: null };
  if (!chave || !rotaPublica(caminho)) return null;
  return { aprovado: null, sessao: sessaoDoPublico(visitante) };
}

// ================================================================ os links das páginas abertas

/** A marca do link que, no nível 0, leva a rota fechada: quem clica sabe antes que vai pedir cadastro. */
export const MARCA_PEDE_CADASTRO = "(pede cadastro)";

/**
 * Um link numa página aberta ao público (C4a, 09/10/2026; achado 4.1 da auditoria R1). Para o cadastrado (`publico`
 * false), o link de sempre. Para o público, rota da lista branca segue como está; rota fechada vai à entrada, com a
 * volta para o destino, e leva a marca "(pede cadastro)" — sem ela, o público cairia no login sem entender por quê.
 * Link externo (fora de `/`) não passa por aqui.
 */
export function linkNoPublico(destino: string, publico: boolean): { href: string; pedeCadastro: boolean } {
  if (!publico || rotaPublica(destino)) return { href: destino, pedeCadastro: false };
  return { href: urlEntrar(destino), pedeCadastro: true };
}

// ================================================================ a porta e o convite

/** A porta que a moldura mostra no lugar do menu da conta. */
export function portaDoPublico(sessao: SessaoPublica, caminho: string | null | undefined): { href: string; rotulo: string } {
  return sessao === "anonimo"
    ? { href: urlEntrar(caminho), rotulo: "Entrar" }
    : { href: URL_AGUARDANDO, rotulo: "Situação do cadastro" };
}

/** A linha que a página aberta ao público leva para o papel (C5 da revisão R3), no lugar do convite. */
export const NOTA_DA_IMPRESSAO_PUBLICA =
  "Versão pública do Mapa de Oportunidades da PONTE. O relatório completo, com o fiscal, o controle e os dados para baixar, pede cadastro.";

/** "a", "a e b", "a, b e c". */
export function emLista(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/**
 * As abas que só o cadastro abre, entre aspas e em lista ("“Tempos e funil” e “Relatório e dados”"). Lê o `minimo`
 * das próprias listas de abas (`ABAS_MUNICIPIO`, `ABAS_UF`…), para o convite nunca divergir do que a página esconde.
 */
export function abasSoComCadastro(abas: readonly { nome: string; minimo: NivelAcesso }[]): string {
  return emLista(abas.filter((a) => a.minimo > NIVEL_DO_PUBLICO).map((a) => `“${a.nome}”`));
}

/**
 * O convite do topo da página aberta ao público. `acao` é o que o cadastro permite ali, no infinitivo ("ver também as
 * abas …", "seguir este convênio …"). O anônimo vai à entrada e volta para a mesma página; o cadastro não aprovado,
 * à sala de espera, que diz em que pé está.
 */
export function convitePublico(sessao: SessaoPublica, caminho: string, acao: string): { texto: string; href: string; rotulo: string } {
  if (sessao === "anonimo") {
    return {
      texto: `Esta é a versão pública do Mapa. Entre para ${acao}. O acesso é gratuito e passa por aprovação.`,
      href: urlEntrar(caminho),
      rotulo: "Entrar",
    };
  }
  return {
    texto: `Esta é a versão pública do Mapa: o seu cadastro ainda não foi aprovado. Com ele aprovado, você vai poder ${acao}.`,
    href: URL_AGUARDANDO,
    rotulo: "Ver a situação do cadastro",
  };
}
