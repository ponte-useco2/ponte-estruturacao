/**
 * O explorador em camadas (C3a, 09/10/2026; protótipo da onda 5, rota `/mapa/explorador`, só administrador): o Mapa
 * navegado como uma descida — Brasil › UF › município › entidade › instrumento —, cada nível um plano que se empilha em
 * profundidade, com o de cima em foco e os de trás recuados. É um spike para provar a experiência; as páginas de cada
 * nível continuam sendo a referência, e cada camada leva à sua página completa e ao seu relatório.
 *
 * Aqui fica o que é puro (com teste em `explorador.test.ts`):
 *   · a pilha ↔ o endereço (`?uf=PB&ibge=2510808&cnpj=…&instrumento=…`): o endereço é o estado, para dar para
 *     compartilhar, recarregar e voltar pelo navegador. Um nível só vale com o de cima: sem UF não há município, e só a
 *     Paraíba (a UF com o dado completo) desce ao município neste protótipo;
 *   · os rótulos de cada nível, a trilha e o texto que o leitor de tela ouve a cada troca;
 *   · o limite de camadas desenhadas (3: as mais antigas viram só um elo da trilha) e a pose de cada uma no 3D;
 *   · a vista: em camadas (3D) ou plana (lista com a trilha, sem animação), pelo pedido no endereço, pelo "reduzir
 *     movimento" do sistema ou por aparelho fraco.
 * Sem banco.
 */
import { numeroValido, rotuloModalidade, urlInstrumento, urlLaudo } from "./busca.ts";
import { cnpjLegivel } from "./fornecedores.ts";
import { MUNICIPIOS_PB, REGIOES_IMEDIATAS_PB, regiaoDoMunicipioPb } from "./municipios-pb.ts";
import { URL_RELATORIO_BRASIL, urlBrasil } from "./pagina-brasil.ts";
import { cnpjDaUrl, urlEntidade, urlRelatorioEntidade, type EntidadeNoMunicipio, type LenteEntidade } from "./pagina-entidade.ts";
import { urlMunicipio } from "./pagina-municipio.ts";
import { NOME_UF, siglaDaUrl, urlRelatorioUf, urlUf } from "./pagina-uf.ts";
import type { Elo } from "./trilha.ts";

// ================================================================ níveis e rótulos

export type NivelExplorador = "brasil" | "uf" | "municipio" | "entidade" | "instrumento";

/** A ordem da descida. A posição de cada nível é a que o leitor de tela ouve ("camada 3 de 5"). */
export const NIVEIS: readonly NivelExplorador[] = ["brasil", "uf", "municipio", "entidade", "instrumento"];

export const ROTULO_NIVEL: Record<NivelExplorador, string> = {
  brasil: "País",
  uf: "Estado",
  municipio: "Município",
  entidade: "Entidade",
  instrumento: "Instrumento",
};

/**
 * As duas lentes do município no explorador: o poder público (a prefeitura, os fundos, os consórcios e o estado no
 * município) e a sociedade civil (as OSC com instrumento e o total do Mapa das OSC). Empresas e Sistema S não são
 * nenhuma das duas: o explorador diz quantos são e manda à página completa.
 */
export type LenteExplorador = "publico" | "sociedade";

export const ROTULO_LENTE_EXPLORADOR: Record<LenteExplorador, string> = {
  publico: "Poder público",
  sociedade: "Sociedade civil",
};

/** Em camadas (3D) ou plana (a lista com a trilha, sem animação). */
export type VistaExplorador = "camadas" | "plana";

/** No máximo 3 camadas desenhadas ao mesmo tempo: a do topo e duas atrás. As mais antigas viram só um elo da trilha. */
export const MAX_CAMADAS = 3;

export const URL_EXPLORADOR = "/mapa/explorador";

/** A UF que desce ao município: a única com o dado completo e com a malha municipal (a lista fixa dos 223). */
export const UF_DA_DESCIDA = "PB";

// ================================================================ a pilha e o endereço

export interface PilhaExplorador {
  /** A sigla da UF, em maiúsculas; null no topo (o Brasil). */
  uf: string | null;
  /** O código do IBGE de um dos 223 municípios da PB. */
  ibge: string | null;
  /** O CNPJ da entidade, como a base guarda (14 posições, sem máscara). */
  cnpj: string | null;
  /** O número do instrumento (convênio, contrato de repasse, termo de fomento…). */
  instrumento: string | null;
  /** A lente da camada do município. Só vale com município; fora dele é sempre a de entrada ("publico"). */
  lente: LenteExplorador;
  /** A vista pedida no endereço; null deixa o aparelho decidir (`vistaEfetiva`). */
  vista: VistaExplorador | null;
}

export const PILHA_VAZIA: PilhaExplorador = { uf: null, ibge: null, cnpj: null, instrumento: null, lente: "publico", vista: null };

const IBGES_DA_DESCIDA = new Set(MUNICIPIOS_PB.map(([ibge]) => ibge));
const NOME_DO_IBGE = new Map(MUNICIPIOS_PB.map(([ibge, nome]) => [ibge, nome]));

const primeiro = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * A pilha a partir do endereço. Cada nível só vale com o de cima e no formato certo; o primeiro que falhar corta a
 * descida ali (nada abaixo dele vale). A UF aceita minúsculas; o município, só os 223 da PB; o CNPJ, com ou sem máscara.
 * A pertença (a entidade é deste município? o instrumento é desta entidade?) depende do banco e fica com o servidor.
 */
export function pilhaDaUrl(sp: Record<string, string | string[] | undefined>): PilhaExplorador {
  const uf = siglaDaUrl(primeiro(sp.uf));
  const ibgeBruto = (primeiro(sp.ibge) ?? "").trim();
  const ibge = uf === UF_DA_DESCIDA && IBGES_DA_DESCIDA.has(ibgeBruto) ? ibgeBruto : null;
  const cnpj = ibge ? cnpjDaUrl(primeiro(sp.cnpj)) : null;
  const nr = primeiro(sp.instrumento)?.trim();
  const instrumento = cnpj && numeroValido(nr) ? nr : null;
  const lente: LenteExplorador = ibge && primeiro(sp.lente) === "sociedade" ? "sociedade" : "publico";
  const v = primeiro(sp.vista);
  const vista: VistaExplorador | null = v === "camadas" || v === "plana" ? v : null;
  return { uf, ibge, cnpj, instrumento, lente, vista };
}

/**
 * O endereço da pilha, sempre na mesma ordem (uf, ibge, cnpj, instrumento, lente, vista): o mesmo estado dá o mesmo
 * endereço. Um nível sem o de cima não entra; a lente de entrada e a vista automática não aparecem.
 */
export function urlExplorador(p: Partial<PilhaExplorador>): string {
  const q = new URLSearchParams();
  if (p.uf) {
    q.set("uf", p.uf);
    if (p.ibge) {
      q.set("ibge", p.ibge);
      if (p.cnpj) {
        q.set("cnpj", p.cnpj);
        if (p.instrumento) q.set("instrumento", p.instrumento);
      }
      if (p.lente === "sociedade") q.set("lente", "sociedade");
    }
  }
  if (p.vista) q.set("vista", p.vista);
  const s = q.toString();
  return s ? `${URL_EXPLORADOR}?${s}` : URL_EXPLORADOR;
}

/** Os níveis da pilha, do Brasil até o mais fundo (o topo da pilha é o último). */
export function niveisDaPilha(p: PilhaExplorador): NivelExplorador[] {
  const n: NivelExplorador[] = ["brasil"];
  if (!p.uf) return n;
  n.push("uf");
  if (!p.ibge) return n;
  n.push("municipio");
  if (!p.cnpj) return n;
  n.push("entidade");
  if (p.instrumento) n.push("instrumento");
  return n;
}

export const profundidade = (p: PilhaExplorador) => niveisDaPilha(p).length;

/** O nível do topo: a camada em foco. */
export function nivelDoTopo(p: PilhaExplorador): NivelExplorador {
  const n = niveisDaPilha(p);
  return n[n.length - 1];
}

/** A pilha cortada num nível: o que estava abaixo some. A lente fica enquanto o município fica; a vista fica sempre. */
export function pilhaAte(p: PilhaExplorador, nivel: NivelExplorador): PilhaExplorador {
  const i = NIVEIS.indexOf(nivel);
  return {
    uf: i >= 1 ? p.uf : null,
    ibge: i >= 2 ? p.ibge : null,
    cnpj: i >= 3 ? p.cnpj : null,
    instrumento: i >= 4 ? p.instrumento : null,
    lente: i >= 2 ? p.lente : "publico",
    vista: p.vista,
  };
}

/** O endereço de um nível da pilha (o elo da trilha, a camada de trás clicada). */
export const urlDoNivel = (p: PilhaExplorador, nivel: NivelExplorador) => urlExplorador(pilhaAte(p, nivel));

/** Um nível acima do topo (o "Voltar" e o Esc); null no Brasil, que não tem acima. */
export function urlPai(p: PilhaExplorador): string | null {
  const n = niveisDaPilha(p);
  return n.length > 1 ? urlDoNivel(p, n[n.length - 2]) : null;
}

/**
 * Um passo para baixo, a partir de um nível: do Brasil à UF, da UF ao município, do município à entidade (a lente
 * vai junto, para a volta reabrir a mesma) e da entidade ao instrumento.
 */
export function urlFilho(p: PilhaExplorador, de: NivelExplorador, valor: string): string {
  const base = pilhaAte(p, de);
  switch (de) {
    case "brasil":
      return urlExplorador({ ...base, uf: valor });
    case "uf":
      return urlExplorador({ ...base, ibge: valor });
    case "municipio":
      return urlExplorador({ ...base, cnpj: valor });
    case "entidade":
      return urlExplorador({ ...base, instrumento: valor });
    default:
      return urlExplorador(base);
  }
}

/** A lente do município trocada (as abas da camada do município): volta ao município, sem entidade abaixo. */
export const urlDaLente = (p: PilhaExplorador, lente: LenteExplorador) => urlExplorador({ ...pilhaAte(p, "municipio"), lente });

/** A mesma pilha noutra vista (o botão "Ver como lista" / "Ver em camadas"). */
export const urlDaVista = (p: PilhaExplorador, vista: VistaExplorador | null) => urlExplorador({ ...p, vista });

/** A chave estável de uma camada (a `key` do React): trocar a lente não troca a camada, trocar o município troca. */
export function chaveDaCamada(p: PilhaExplorador, nivel: NivelExplorador): string {
  switch (nivel) {
    case "brasil":
      return "brasil";
    case "uf":
      return `uf:${p.uf}`;
    case "municipio":
      return `municipio:${p.ibge}`;
    case "entidade":
      return `entidade:${p.cnpj}`;
    case "instrumento":
      return `instrumento:${p.instrumento}`;
  }
}

/** Os níveis com camada desenhada: os `max` mais fundos. Os de cima ficam só na trilha. */
export function niveisDesenhados(p: PilhaExplorador, max = MAX_CAMADAS): NivelExplorador[] {
  return niveisDaPilha(p).slice(-Math.max(1, max));
}

// ================================================================ nomes, trilha e anúncio

/** O que só o banco sabe dizer: o nome da entidade e a modalidade do instrumento. Sem eles, o elo usa o código. */
export interface NomesDaPilha {
  entidade?: string | null;
  modalidade?: string | null;
}

/** O nome do município da descida, como o IBGE escreve (com acento), pela lista fixa dos 223. */
export const nomeDoMunicipio = (ibge: string | null | undefined) => (ibge ? (NOME_DO_IBGE.get(ibge) ?? `IBGE ${ibge}`) : null);

/** O nome de cada nível da pilha, na tela e na trilha. */
export function nomeDoNivel(p: PilhaExplorador, nivel: NivelExplorador, nomes: NomesDaPilha = {}): string {
  switch (nivel) {
    case "brasil":
      return "Brasil";
    case "uf":
      return (p.uf && NOME_UF[p.uf]) || (p.uf ?? "Estado");
    case "municipio":
      return nomeDoMunicipio(p.ibge) ?? "Município";
    case "entidade":
      return (nomes.entidade ?? "").trim() || `CNPJ ${cnpjLegivel(p.cnpj) ?? p.cnpj ?? ""}`.trim();
    case "instrumento": {
      // "Convênio nº 942082", ou a modalidade dele (como o elo do instrumento em `trilha.ts`)
      const m = rotuloModalidade(nomes.modalidade) ?? "instrumento";
      return `${m.charAt(0).toUpperCase()}${m.slice(1)} nº ${p.instrumento ?? ""}`;
    }
  }
}

/** A trilha do explorador: um elo por nível, cada um levando àquela camada; o último é a camada aberta, sem link. */
export function elosDoExplorador(p: PilhaExplorador, nomes: NomesDaPilha = {}): Elo[] {
  const niveis = niveisDaPilha(p);
  return niveis.map((nivel, i) => ({ rotulo: nomeDoNivel(p, nivel, nomes), href: i === niveis.length - 1 ? null : urlDoNivel(p, nivel) }));
}

/**
 * O que a região viva diz a cada troca de camada: a posição na descida e a trilha até ali, sem o "›" (que o leitor
 * de tela leria). O título da camada nova recebe o foco e diz o nome; aqui fica o contexto.
 */
export function anuncioDaCamada(p: PilhaExplorador, nomes: NomesDaPilha = {}): string {
  const niveis = niveisDaPilha(p);
  const topo = niveis[niveis.length - 1];
  const posicao = `Camada ${niveis.length} de ${NIVEIS.length}, ${ROTULO_NIVEL[topo].toLowerCase()}: ${nomeDoNivel(p, topo, nomes)}.`;
  if (niveis.length === 1) return posicao;
  return `${posicao} Trilha: ${niveis.map((n) => nomeDoNivel(p, n, nomes)).join(", ")}.`;
}

/** O que leva para fora do explorador: a página completa do nível e o relatório dele (o laudo, no instrumento). */
export interface PaginasDoNivel {
  completa: { rotulo: string; href: string };
  relatorio: { rotulo: string; href: string };
}

export function paginasDoNivel(p: PilhaExplorador, nivel: NivelExplorador): PaginasDoNivel {
  switch (nivel) {
    case "brasil":
      return { completa: { rotulo: "Página do Brasil", href: urlBrasil() }, relatorio: { rotulo: "Relatório do Brasil", href: URL_RELATORIO_BRASIL } };
    case "uf": {
      const uf = p.uf ?? UF_DA_DESCIDA;
      return { completa: { rotulo: "Página do estado", href: urlUf(uf) }, relatorio: { rotulo: "Relatório do estado", href: urlRelatorioUf(uf) } };
    }
    case "municipio": {
      const ibge = p.ibge ?? "";
      return {
        completa: { rotulo: "Página do município", href: urlMunicipio(ibge) },
        relatorio: { rotulo: "Relatório do município", href: `/mapa/municipio/${encodeURIComponent(ibge)}/relatorio` },
      };
    }
    case "entidade": {
      const cnpj = p.cnpj ?? "";
      return { completa: { rotulo: "Página da entidade", href: urlEntidade(cnpj) }, relatorio: { rotulo: "Relatório da entidade", href: urlRelatorioEntidade(cnpj) } };
    }
    case "instrumento": {
      const nr = p.instrumento ?? "";
      return { completa: { rotulo: "Página do instrumento", href: urlInstrumento(nr) }, relatorio: { rotulo: "Laudo do instrumento", href: urlLaudo(nr) } };
    }
  }
}

// ================================================================ conteúdo das camadas

/** Os 223 municípios da descida por região imediata, como a lista neutra da UF: alfabética, sem ordem de problema. */
export interface RegiaoDaDescida {
  imediata: string;
  intermediaria: string;
  municipios: { ibge: string; nome: string }[];
}

/**
 * As regiões imediatas da PB na ordem da legenda do mapa (as intermediárias em ordem alfabética e, dentro de cada uma,
 * as imediatas), cada uma com os seus municípios em ordem alfabética. Pela lista fixa: não depende do banco.
 */
export function regioesDaDescida(): RegiaoDaDescida[] {
  return REGIOES_IMEDIATAS_PB.map((r) => ({
    imediata: r.imediata,
    intermediaria: r.intermediaria,
    municipios: r.ibges
      .split(" ")
      .map((ibge) => ({ ibge, nome: NOME_DO_IBGE.get(ibge) ?? ibge }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  })).sort((a, b) => a.intermediaria.localeCompare(b.intermediaria, "pt-BR") || a.imediata.localeCompare(b.imediata, "pt-BR"));
}

/** A região imediata de um município da descida, para o subtítulo da camada. */
export const regiaoDaDescida = (ibge: string | null | undefined) => regiaoDoMunicipioPb(ibge);

export interface LentesDoMunicipio {
  /** O poder público, em dois grupos: o municipal e o estado no município (os rótulos de `ROTULO_LENTE`). */
  publico: { lente: LenteEntidade; entidades: EntidadeNoMunicipio[] }[];
  sociedade: EntidadeNoMunicipio[];
  /** Empresas, Sistema S e outros: só contados (ficam na página completa). */
  outros: number;
}

/** As lentes do explorador a partir dos grupos de "Quem recebe no município" (`quemRecebe`), na mesma ordem dele. */
export function lentesDoExplorador(grupos: readonly { lente: LenteEntidade; entidades: EntidadeNoMunicipio[] }[]): LentesDoMunicipio {
  return {
    publico: grupos.filter((g) => g.lente === "municipal" || g.lente === "estado"),
    sociedade: grupos.find((g) => g.lente === "sociedade")?.entidades ?? [],
    outros: grupos.find((g) => g.lente === "outros")?.entidades.length ?? 0,
  };
}

/** Quantas entidades a lente tem (o número na aba da lente). */
export function totalDaLente(l: LentesDoMunicipio, lente: LenteExplorador): number {
  return lente === "sociedade" ? l.sociedade.length : l.publico.reduce((s, g) => s + g.entidades.length, 0);
}

// ================================================================ o 3D: poses e direção

export type Direcao = "desce" | "sobe";

/** Para onde a pilha andou: sobe quando ficou mais rasa; desce quando ficou mais funda ou trocou de lado no mesmo nível. */
export function direcaoDaTroca(profundidadeAntes: number, profundidadeDepois: number): Direcao {
  return profundidadeDepois < profundidadeAntes ? "sobe" : "desce";
}

/**
 * Só transform (translação em Y e em Z) e opacidade: nada de layout, filtro ou sombra animada. Tipo (e não interface)
 * para servir direto de alvo do Framer Motion, que pede assinatura de índice.
 */
export type Pose = {
  y: number;
  z: number;
  opacity: number;
};

/**
 * O passo do recuo, em px: com a perspectiva de 1200 px do palco (explorador.css), a borda de cada camada de trás
 * aparece uns 35 px acima da da frente — o bastante para a lombada ("Município · Patos"). Um passo só, também no
 * celular: um passo menor ali obrigaria a trocar a pose depois da hidratação, e as camadas se mexeriam sozinhas ao abrir.
 */
export const PASSO_DO_RECUO = { y: 34, z: 110 } as const;

const OPACIDADE_POR_DISTANCIA = [1, 0.72, 0.45];

/**
 * A pose de uma camada pela distância ao topo (0 é a de cima). As de trás sobem e recuam um passo por camada e ficam
 * mais apagadas; a partir de `MAX_CAMADAS` a camada some (opacidade 0), que é por onde as mais antigas saem.
 */
export function poseDaCamada(distancia: number): Pose {
  const d = Math.max(0, distancia);
  return { y: -PASSO_DO_RECUO.y * d, z: -PASSO_DO_RECUO.z * d, opacity: d < MAX_CAMADAS ? (OPACIDADE_POR_DISTANCIA[d] ?? 0) : 0 };
}

/** De onde a camada nova chega ao descer (e para onde a do topo sai ao subir): da frente, perto de quem olha. */
export function poseDaFrente(): Pose {
  return { y: PASSO_DO_RECUO.y * 1.5, z: PASSO_DO_RECUO.z * 1.5, opacity: 0 };
}

// ================================================================ a vista

/**
 * Aparelho fraco pelas dicas do navegador: até 2 GB de memória (`navigator.deviceMemory`, só no Chrome) ou até 2
 * núcleos. Sem a dica, não presume nada: quem decide é a medição dos quadros na primeira troca (`quadrosLentos`).
 */
export function aparelhoFraco(d: { memoriaGb?: number | null; nucleos?: number | null }): boolean {
  return (typeof d.memoriaGb === "number" && d.memoriaGb > 0 && d.memoriaGb <= 2) || (typeof d.nucleos === "number" && d.nucleos > 0 && d.nucleos <= 2);
}

/**
 * Se a animação engasgou: a mediana dos intervalos entre quadros acima de `limiteMs` (34 ms, abaixo de ~30 quadros por
 * segundo). Com menos de 5 amostras, não decide (a troca foi curta demais para medir).
 */
export function quadrosLentos(intervalosMs: readonly number[], limiteMs = 34): boolean {
  const xs = intervalosMs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (xs.length < 5) return false;
  const meio = Math.floor(xs.length / 2);
  const mediana = xs.length % 2 ? xs[meio] : (xs[meio - 1] + xs[meio]) / 2;
  return mediana > limiteMs;
}

/** A vista que vale: a pedida no endereço vence; sem pedido, "reduzir movimento" ou aparelho fraco levam à plana. */
export function vistaEfetiva(pedida: VistaExplorador | null, reduzirMovimento: boolean, fraco: boolean): VistaExplorador {
  if (pedida) return pedida;
  return reduzirMovimento || fraco ? "plana" : "camadas";
}
