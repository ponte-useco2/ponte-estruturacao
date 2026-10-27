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
 */
import { AnimatePresence, m, useMotionValue, type PanInfo } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { tiposDaTransicao } from "@/lib/oportunidades/descida";
import { ESCALA_MINIMA, acaoDoClique, atrasoDaRegiao, limitesDoArraste, posicaoNoMapa, proximaEscala } from "@/lib/oportunidades/mapa-vivo";
import { MOLA } from "@/lib/oportunidades/molas";
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
    (href: string) => router.push(href, { transitionTypes: tiposDaTransicao(window.location.pathname, href) }),
    [router],
  );

  const clicou = (a: AreaViva) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (arrastou.current) {
      e.preventDefault();
      arrastou.current = false;
      return;
    }
    const acao = acaoDoClique(e, selecionada, a.id);
    if (acao === "navegar") return;
    e.preventDefault();
    if (acao === "entrar" && a.href) entrar(a.href);
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
            <svg viewBox={viewBox} {...atributosSvg}>
              {areas.map((a) => {
                const forma = (
                  <path
                    d={a.d}
                    className={`mp-mapa-g${a.grupo} mp-vivo-area${a.id === selecionada ? " mp-vivo-escolhida" : ""}`}
                    style={{ animationDelay: `${atrasoDaRegiao(ordemDasRegioes[a.grupo] ?? 0)}ms` }}
                  />
                );
                return a.href ? (
                  <LinkArea key={a.id} href={a.href} tabIndex={tabIndexDasAreas} onClick={clicou(a)} onPointerEnter={() => setSobre(a.id)}>
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
                <p className="mp-vivo-previa-acoes">
                  <LinkMapa href={escolhida.href} className="pa-btn pa-btn-pequeno">
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
    </Movimento>
  );
}
