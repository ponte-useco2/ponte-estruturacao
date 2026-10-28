"use client";

/**
 * O mapa vivo (onda 16, M1, 27/10/2026): o mesmo SVG do `MapaTerritorio`, com movimento e a prévia antes de descer.
 *
 * - **Entrada orquestrada:** as áreas surgem por região (a cor da legenda), uma região depois da outra; a legenda vem
 *   por último (CSS, `mp-vivo-*` em `movimento.css`: 223 áreas animadas pelo navegador, sem 223 componentes de
 *   movimento).
 * - **Marcador e prévia (`layoutId`, D16-1):** ao passar o mouse, um marcador cai com mola no centro da área. No
 *   clique, o marcador se transforma no cartão de prévia (nome, números e "Entrar"). O segundo clique na mesma área, ou
 *   o "Entrar", desce com a transição da descida. Teclado e Ctrl/Cmd+clique navegam direto (`acaoDoClique`).
 * - **Celular (D16-2):** sem mouse não há marcador; o toque abre a prévia como folha que sobe de baixo e desce
 *   arrastada para fechar. Botões +/− ampliam o mapa (1 a 4×) e, ampliado, ele se arrasta com o dedo.
 * - **Esc** fecha a prévia. Com movimento reduzido, tudo aparece no lugar, sem deslocamento.
 * - **Morph para o contorno (onda 18, 28/10/2026):** com `morfa`, ao descer (2º clique ou "Entrar") a área se solta do
 *   mapa: uma peça com o mesmo desenho a cobre, deixa o buraco no mapa e, quando a página chega, voa até o contorno no
 *   alto dela (`NOME_DO_MORPH`, transição nativa, sem pré-carga). Teclado, Ctrl+clique e movimento reduzido descem sem
 *   a peça.
 * - **Filtro por tema (onda 17, 28/10/2026):** com `temas`, uma fila de temas acima do mapa. O tema escolhido acende as
 *   áreas com instrumento vivo nele e apaga as outras, em onda por região; a cor continua a da região. A prévia ganha a
 *   linha do tema, e o tema vai para o endereço (`?tema=`). No Brasil (`temaDesce`), o tema desce junto para a UF.
 */
import { AnimatePresence, m, useMotionValue, type PanInfo } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TIPO_DESCER, tiposDaTransicao } from "@/lib/oportunidades/descida";
import {
  ESCALA_MINIMA,
  NOME_DO_MORPH,
  acaoDoClique,
  atrasoDaRegiao,
  caixaDoCaminho,
  caixaNaTela,
  limitesDoArraste,
  posicaoNoMapa,
  proximaEscala,
  tiposComMorph,
  type NivelDoMorph,
} from "@/lib/oportunidades/mapa-vivo";
import { MOLA } from "@/lib/oportunidades/molas";
import {
  PARAMETRO_TEMA,
  enderecoComTema,
  hrefComTema,
  lerTema,
  linhaDoTema,
  opcoesDeTema,
  resumoDoTema,
  rotuloDoTema,
  somaNoTema,
  type TemasPorArea,
} from "@/lib/oportunidades/tema-no-mapa";
import { LinkArea, LinkMapa } from "../_componentes/LinkMapa";
import { Movimento } from "./Movimento";

export interface AreaViva {
  id: string;
  d: string;
  x: number;
  y: number;
  nome: string;
  href: string | null;
  grupo: number;
  /** Os números da prévia ("12 instrumentos · 3 em execução"), quando a página tem. */
  detalhe: string | null;
}

/** O filtro por tema do mapa (onda 17): as somas por área e o nome da área no singular e no plural. */
export interface TemasDoMapa {
  porArea: TemasPorArea;
  unidade: { um: string; varios: string };
  /**
   * No Brasil: o tema escolhido vai junto no link das UFs que têm o mapa por tema, já na aba dele (`aba`), e a descida
   * continua filtrada.
   */
  temaDesce?: { aba: string; areas: readonly string[] };
}

/** A peça que se solta do mapa no morph (onda 18): o desenho da área, na caixa do contorno, em pixels da tela. */
interface Peca {
  id: string;
  d: string;
  caixa: string;
  estilo: CSSProperties;
}

const semMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A peça de uma área: o mesmo `d`, a caixa quadrada do contorno de destino posta na tela pela matriz do SVG. */
function pecaDaArea(svg: SVGSVGElement | null, a: { id: string; d: string }): Peca | null {
  const caminho = svg?.querySelector<SVGPathElement>(`path[data-area="${CSS.escape(a.id)}"]`);
  const matriz = caminho?.getScreenCTM();
  const caixa = caixaDoCaminho(a.d);
  if (!caminho || !matriz || !caixa) return null;
  const tela = caixaNaTela(caixa, matriz);
  if (!tela) return null;
  const cor = getComputedStyle(caminho).fill;
  return { id: a.id, d: a.d, caixa, estilo: { ...tela, fill: cor, viewTransitionName: NOME_DO_MORPH } };
}

const TOQUE = "(pointer: coarse)";
const assinarToque = (f: () => void) => {
  const q = window.matchMedia(TOQUE);
  q.addEventListener("change", f);
  return () => q.removeEventListener("change", f);
};

export function MapaVivo({
  viewBox,
  areas,
  ordemDasRegioes,
  atributosSvg,
  tabIndexDasAreas,
  rotulos,
  depois,
  temas,
  morfa,
}: {
  viewBox: string;
  /** Na ordem do DOM (a do Tab, no modo navegável). */
  areas: readonly AreaViva[];
  /** A ordem de entrada de cada grupo de cor (a ordem da legenda). */
  ordemDasRegioes: readonly number[];
  atributosSvg: Readonly<Record<string, string | boolean | undefined>>;
  tabIndexDasAreas: number | undefined;
  /** As siglas no centro de cada área (o mapa do Brasil). */
  rotulos: boolean;
  /** A legenda e a nota (a `figcaption` do servidor). */
  depois: ReactNode;
  /** O filtro por tema (onda 17); sem ele, o mapa é o de sempre. */
  temas?: TemasDoMapa;
  /** O morph para o contorno da página de destino (onda 18); sem ele, a descida é a de sempre. */
  morfa?: NivelDoMorph;
}) {
  const router = useRouter();
  const [sobre, setSobre] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [escala, setEscala] = useState(ESCALA_MINIMA);
  const [tamanho, setTamanho] = useState({ largura: 0, altura: 0 });
  const toque = useSyncExternalStore(
    assinarToque,
    () => window.matchMedia(TOQUE).matches,
    () => false,
  );
  const palco = useRef<HTMLDivElement>(null);
  const arrastou = useRef(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const grupoLayout = useId();
  const porId = new Map(areas.map((a) => [a.id, a]));
  const escolhida = selecionada ? (porId.get(selecionada) ?? null) : null;
  const opcoes = useMemo(() => (temas ? opcoesDeTema(temas.porArea) : []), [temas]);
  // O tema do endereço entra já no primeiro desenho (o servidor lê o mesmo endereço: sem diferença de hidratação).
  const busca = useSearchParams();
  const [tema, setTema] = useState<string | null>(() => lerTema(busca.get(PARAMETRO_TEMA), opcoes));
  const somaDa = (id: string) => (temas && tema ? somaNoTema(temas.porArea, id, tema) : null);
  const foraDoTema = (id: string) => tema !== null && somaDa(id) === null;
  const hrefDa = (a: AreaViva) => (a.href ? hrefComTema(a.href, a.id, tema, temas?.temaDesce) : null);
  const desenho = useRef<SVGSVGElement>(null);
  const [peca, setPeca] = useState<Peca | null>(null);

  // Se a página não chegar (erro, ou o clique foi para outro lugar), a peça não fica presa por cima do mapa.
  useEffect(() => {
    if (!peca) return;
    const t = window.setTimeout(() => setPeca(null), 12_000);
    return () => window.clearTimeout(t);
  }, [peca]);

  const escolherTema = (novo: string | null) => {
    setTema(novo);
    const atual = window.location.pathname + window.location.search + window.location.hash;
    const proximo = enderecoComTema(atual, novo);
    if (proximo !== atual) window.history.replaceState(window.history.state, "", proximo);
  };
  const marcada = !toque && sobre && sobre !== selecionada ? (porId.get(sobre) ?? null) : null;

  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTamanho({ largura: e.contentRect.width, altura: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!selecionada) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setSelecionada(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [selecionada]);

  const entrar = useCallback(
    (a: AreaViva, href: string) => {
      const tipos = tiposDaTransicao(window.location.pathname, href);
      const p = morfa && tipos?.includes(TIPO_DESCER) && !semMovimento() ? pecaDaArea(desenho.current, a) : null;
      if (p) setPeca(p);
      router.push(href, { transitionTypes: p ? tiposComMorph(tipos, morfa, TIPO_DESCER) : tipos });
    },
    [router, morfa],
  );

  /** O "Entrar" da prévia: link de verdade (Ctrl+clique abre outra aba), mas o clique simples desce com a peça. */
  const entrarPelaPrevia = (a: AreaViva, href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    entrar(a, href);
  };

  const clicou = (a: AreaViva) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (arrastou.current) {
      e.preventDefault();
      arrastou.current = false;
      return;
    }
    const acao = acaoDoClique(e, selecionada, a.id);
    if (acao === "navegar") return;
    e.preventDefault();
    const href = hrefDa(a);
    if (acao === "entrar" && href) entrar(a, href);
    else setSelecionada(a.id);
  };

  const ampliar = (sentido: 1 | -1) => {
    const nova = proximaEscala(escala, sentido);
    setEscala(nova);
    if (nova === ESCALA_MINIMA) {
      x.set(0);
      y.set(0);
    }
  };

  const fecharArrastando = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) setSelecionada(null);
  };

  const limites = limitesDoArraste(escala, tamanho.largura, tamanho.altura);
  const posMarcador = marcada ? posicaoNoMapa(viewBox, marcada.x, marcada.y) : null;

  return (
    <Movimento recursos="completo">
      <div className={escala > 1 ? "mp-vivo mp-vivo-ampliado" : "mp-vivo"}>
        {temas && opcoes.length > 1 && (
          <FiltroDeTema
            opcoes={opcoes}
            tema={tema}
            escolher={escolherTema}
            resumo={tema ? resumoDoTema(rotuloDoTema(tema), areas.filter((a) => somaDa(a.id)).length, areas.length, temas.unidade) : null}
          />
        )}
        <div ref={palco} className="mp-vivo-palco" onPointerLeave={() => setSobre(null)}>
          <m.div
            className="mp-vivo-camera"
            style={{ x, y }}
            animate={{ scale: escala }}
            transition={MOLA.suave}
            drag={toque && escala > 1}
            dragConstraints={limites}
            dragElastic={0.08}
            onDragStart={() => (arrastou.current = true)}
          >
            <svg ref={desenho} viewBox={viewBox} {...atributosSvg}>
              {areas.map((a) => {
                const forma = (
                  <path
                    d={a.d}
                    data-area={a.id}
                    className={`mp-mapa-g${a.grupo} mp-vivo-area${a.id === selecionada ? " mp-vivo-escolhida" : ""}${foraDoTema(a.id) ? " mp-vivo-fora-tema" : ""}${peca?.id === a.id ? " mp-vivo-saindo" : ""}`}
                    style={{ animationDelay: `${atrasoDaRegiao(ordemDasRegioes[a.grupo] ?? 0)}ms`, ["--mp-atraso-tema" as string]: `${(ordemDasRegioes[a.grupo] ?? 0) * 40}ms` }}
                  />
                );
                return a.href ? (
                  <LinkArea key={a.id} href={hrefDa(a) ?? a.href} tabIndex={tabIndexDasAreas} onClick={clicou(a)} onPointerEnter={() => setSobre(a.id)}>
                    <title>{a.nome}</title>
                    {forma}
                  </LinkArea>
                ) : (
                  <g key={a.id} aria-hidden={tabIndexDasAreas === undefined ? true : undefined}>
                    <title>{a.nome}</title>
                    {forma}
                  </g>
                );
              })}
              {rotulos &&
                areas.map((a) => (
                  <text key={`r-${a.id}`} x={a.x} y={a.y} className="mp-mapa-rotulo" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                    {a.id}
                  </text>
                ))}
            </svg>
            <AnimatePresence>
              {marcada && posMarcador && (
                <m.span
                  key={marcada.id}
                  layoutId={`mp-previa-${grupoLayout}`}
                  className="mp-vivo-marcador"
                  style={posMarcador}
                  initial={{ opacity: 0, y: -14, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={MOLA.pin}
                  aria-hidden="true"
                />
              )}
            </AnimatePresence>
          </m.div>
          {toque && (
            <div className="mp-vivo-zoom" role="group" aria-label="Ampliar o mapa">
              <button type="button" className="pa-btn pa-btn-pequeno" onClick={() => ampliar(1)} aria-label="Ampliar">
                +
              </button>
              <button type="button" className="pa-btn pa-btn-pequeno" onClick={() => ampliar(-1)} aria-label="Reduzir" disabled={escala <= ESCALA_MINIMA}>
                −
              </button>
            </div>
          )}
          <AnimatePresence>
            {escolhida && escolhida.href && (
              <m.aside
                key={escolhida.id}
                layoutId={toque ? undefined : `mp-previa-${grupoLayout}`}
                className={toque ? "mp-vivo-previa mp-vivo-folha" : "mp-vivo-previa"}
                aria-label={`Prévia: ${escolhida.nome}`}
                initial={toque ? { y: "110%" } : { opacity: 0, scale: 0.9 }}
                animate={toque ? { y: 0 } : { opacity: 1, scale: 1 }}
                exit={toque ? { y: "110%", transition: { duration: 0.2, ease: "easeIn" } } : { opacity: 0, scale: 0.95, transition: { duration: 0.15, ease: "easeOut" } }}
                transition={MOLA.suave}
                drag={toque ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={fecharArrastando}
              >
                {toque && <span className="mp-vivo-alca" aria-hidden="true" />}
                <p className="mp-vivo-previa-nome">
                  <strong>{escolhida.nome}</strong>
                </p>
                {escolhida.detalhe && <p className="mp-vivo-previa-detalhe">{escolhida.detalhe}</p>}
                {tema && <p className="mp-vivo-previa-tema">{linhaDoTema(rotuloDoTema(tema), somaDa(escolhida.id))}</p>}
                <p className="mp-vivo-previa-acoes">
                  <LinkMapa
                    href={hrefDa(escolhida) ?? escolhida.href}
                    className="pa-btn pa-btn-pequeno"
                    onClick={entrarPelaPrevia(escolhida, hrefDa(escolhida) ?? escolhida.href)}
                  >
                    Entrar
                  </LinkMapa>
                  <button type="button" className="pa-btn pa-btn-pequeno mp-vivo-fechar" onClick={() => setSelecionada(null)}>
                    Fechar
                  </button>
                </p>
                {!toque && <p className="mp-vivo-previa-dica">Clique de novo na área para entrar.</p>}
              </m.aside>
            )}
          </AnimatePresence>
        </div>
        <div className="mp-vivo-depois">{depois}</div>
      </div>
      {peca &&
        createPortal(
          <svg className="mp-vivo-peca" style={peca.estilo} viewBox={peca.caixa} aria-hidden="true" focusable="false">
            <path d={peca.d} />
          </svg>,
          document.body,
        )}
    </Movimento>
  );
}

/**
 * A fila de temas acima do mapa (onda 17): "Todos os temas" e os temas por alcance, com a pílula que desliza até o
 * escolhido (`layoutId`, como em "Montar o relatório"). No celular, a fila rola para o lado. A frase de baixo diz
 * quantas áreas têm o tema e é anunciada ao leitor de tela.
 */
function FiltroDeTema({
  opcoes,
  tema,
  escolher,
  resumo,
}: {
  opcoes: readonly { id: string; rotulo: string }[];
  tema: string | null;
  escolher: (tema: string | null) => void;
  resumo: string | null;
}) {
  const grupo = useId();
  const fila = useRef<HTMLDivElement>(null);
  const botoes = [{ id: null as string | null, rotulo: "Todos os temas" }, ...opcoes];

  // No celular a fila rola para o lado: o tema escolhido (também o que veio do endereço) fica à vista, sem mexer na
  // rolagem da página.
  useEffect(() => {
    const f = fila.current;
    const ativo = f?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!f || !ativo || f.scrollWidth <= f.clientWidth) return;
    const alvo = ativo.offsetLeft - f.offsetLeft - (f.clientWidth - ativo.offsetWidth) / 2;
    f.scrollTo({ left: Math.max(0, alvo), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [tema]);

  return (
    <div className="mp-tema mp-nao-imprimir">
      <div ref={fila} className="mp-tema-fila" role="group" aria-label="Filtrar o mapa por tema do programa">
        {botoes.map((b) => {
          const ativo = b.id === tema;
          return (
            <button key={b.id ?? "todos"} type="button" className="mp-tema-botao" aria-pressed={ativo} onClick={() => escolher(ativo ? null : b.id)}>
              {ativo && <m.span layoutId={`mp-tema-pilula-${grupo}`} className="mp-tema-pilula" transition={MOLA.firme} aria-hidden="true" />}
              <span className="mp-tema-rotulo">{b.rotulo}</span>
            </button>
          );
        })}
      </div>
      <p className="mp-tema-resumo" role="status">
        <AnimatePresence mode="wait" initial={false}>
          <m.span key={resumo ?? "todos"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
            {resumo ?? "Escolha um tema para acender só as áreas com instrumento vivo nele."}
          </m.span>
        </AnimatePresence>
      </p>
    </div>
  );
}
