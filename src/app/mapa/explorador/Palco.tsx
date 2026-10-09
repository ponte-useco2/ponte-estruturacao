"use client";

/**
 * O palco do explorador em camadas (C3a, 09/10/2026): empilha as camadas em profundidade e anima a troca. O conteúdo de
 * cada camada vem pronto do servidor (`Camadas.tsx`); aqui só a pilha, o movimento e o que a acessibilidade pede.
 *
 * Por que funciona sem perder o estado: o endereço é a pilha (`?uf=PB&ibge=…`), e cada clique é uma navegação do Next
 * para a mesma página com outros parâmetros. No Next 16.3 a chave do segmento da página ignora os parâmetros de busca
 * (`createRouterCacheKey(segmento, true)` no `layout-router`), então este componente continua montado entre as camadas
 * e o Framer Motion vê as camadas entrarem e saírem. O `loading.tsx` só aparece na primeira abertura; nas trocas, a
 * camada de cima fica na tela até a nova chegar (o ponto do `Carregando` pulsa no link clicado).
 *
 * O 3D é CSS (`perspective` no palco) com Framer Motion animando só `y`, `z` (transform) e opacidade — nada de layout,
 * filtro ou sombra animada; `will-change` só enquanto a camada se move. No máximo 3 camadas desenhadas (o servidor manda
 * só as 3 mais fundas); a que sai pelo fundo some em 0,15 s.
 *
 * A mesma descida sem 3D (vista plana): com "reduzir movimento" no sistema, num aparelho fraco (dica do navegador, ou a
 * primeira troca medida abaixo de ~30 quadros por segundo) ou a pedido (`?vista=plana`), só a camada do topo, sem
 * animação, com a trilha acima. Teclado: Tab e Enter descem pelos links da lista; Esc ou "Voltar" sobem. A cada troca, o
 * foco vai para o título da camada nova e a região viva diz a posição na descida e a trilha.
 */
import { AnimatePresence, MotionConfig, motion, useIsPresent, type Transition, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition, type MouseEvent, type ReactNode } from "react";
import {
  MAX_CAMADAS,
  URL_EXPLORADOR,
  aparelhoFraco,
  direcaoDaTroca,
  poseDaCamada,
  poseDaFrente,
  quadrosLentos,
  vistaEfetiva,
  type Direcao,
  type VistaExplorador,
} from "@/lib/oportunidades/explorador";
import { LinkMapa } from "../_componentes/LinkMapa";

export interface CamadaDoPalco {
  /** A chave estável da camada (`chaveDaCamada`): trocar a lente do município não troca a camada. */
  chave: string;
  /** O endereço da camada, para a camada de trás clicada voltar a ela. */
  href: string;
  /** "Município · Patos": a lombada que aparece na borda da camada quando ela está atrás. */
  lombada: string;
  conteudo: ReactNode;
}

/** A sessão lembra o aparelho lento medido: a próxima abertura já vem plana. */
const CHAVE_LENTO = "mp-explorador-lento";
const TRANSICAO: Transition = { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.45 };

type Custom = { distancia?: number; direcao: Direcao };

/**
 * Entra: a camada nova do topo vem da frente ao descer; ao subir, quem reaparece vem do fundo. Pousa: a pose pela
 * distância ao topo. Sai: ao subir, a do topo vai para a frente e some; ao descer, a mais antiga some pelo fundo.
 */
const VARIANTES: Variants = {
  entra: ({ distancia = 0, direcao }: Custom) => (distancia === 0 && direcao === "desce" ? poseDaFrente() : poseDaCamada(MAX_CAMADAS)),
  pousa: ({ distancia = 0 }: Custom) => poseDaCamada(distancia),
  sai: ({ direcao }: Custom) =>
    direcao === "sobe" ? { ...poseDaFrente(), transition: { ...TRANSICAO, duration: 0.3 } } : { ...poseDaCamada(MAX_CAMADAS), transition: { duration: 0.15 } },
};

/** Uma consulta de mídia, sem divergir da hidratação: no servidor (e na hidratação) vale `false`. */
function useMidia(consulta: string): boolean {
  const assinar = useCallback(
    (avisar: () => void) => {
      const m = window.matchMedia(consulta);
      m.addEventListener("change", avisar);
      return () => m.removeEventListener("change", avisar);
    },
    [consulta],
  );
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(consulta).matches,
    () => false,
  );
}

const semAssinatura = () => () => {};

/** A dica do aparelho: pouca memória ou poucos núcleos, ou a lentidão já medida nesta sessão. */
function dicaDeAparelhoFraco(): boolean {
  try {
    if (window.sessionStorage.getItem(CHAVE_LENTO) === "1") return true;
  } catch {
    // sessão bloqueada (janela anônima, armazenamento desligado): vale só a dica do navegador
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return aparelhoFraco({ memoriaGb: nav.deviceMemory ?? null, nucleos: nav.hardwareConcurrency ?? null });
}

/** Mede os quadros enquanto a camada do topo se move; se engasgar, a próxima troca já vem plana. */
function useMedidaDeQuadros(aoEngasgar: () => void) {
  const amostras = useRef<number[]>([]);
  const quadro = useRef<number | null>(null);
  const parar = useCallback(() => {
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    quadro.current = null;
  }, []);
  const comecar = useCallback(() => {
    parar();
    amostras.current = [];
    let ultimo = performance.now();
    const passo = (t: number) => {
      amostras.current.push(t - ultimo);
      ultimo = t;
      quadro.current = requestAnimationFrame(passo);
    };
    quadro.current = requestAnimationFrame(passo);
  }, [parar]);
  const terminar = useCallback(() => {
    if (quadro.current === null) return;
    parar();
    if (!quadrosLentos(amostras.current)) return;
    try {
      window.sessionStorage.setItem(CHAVE_LENTO, "1");
    } catch {
      // sem sessão, vale só para esta página
    }
    aoEngasgar();
  }, [parar, aoEngasgar]);
  useEffect(() => parar, [parar]);
  return { comecar, terminar };
}

function Camada({
  c,
  distancia,
  direcao,
  aoVoltar,
  medida,
}: {
  c: CamadaDoPalco;
  distancia: number;
  direcao: Direcao;
  aoVoltar: (href: string) => void;
  medida: { comecar: () => void; terminar: () => void };
}) {
  const presente = useIsPresent();
  const ref = useRef<HTMLElement>(null);
  // Atrás ou saindo: fora do teclado e do leitor de tela (a trilha é o caminho de volta); o clique do mouse volta a ela.
  const atras = distancia > 0 || !presente;
  const topo = distancia === 0 && presente;
  return (
    <motion.section
      ref={ref}
      className="mp-exp-camada"
      data-chave={c.chave}
      data-distancia={distancia}
      data-saindo={presente ? undefined : ""}
      aria-hidden={atras || undefined}
      title={distancia > 0 && presente ? `Voltar para ${c.lombada}` : undefined}
      onClick={distancia > 0 && presente ? () => aoVoltar(c.href) : undefined}
      custom={{ distancia, direcao } satisfies Custom}
      variants={VARIANTES}
      initial="entra"
      animate="pousa"
      exit="sai"
      onAnimationStart={() => {
        if (ref.current) ref.current.style.willChange = "transform, opacity";
        if (topo) medida.comecar();
      }}
      onAnimationComplete={() => {
        if (ref.current) ref.current.style.willChange = "";
        if (topo) medida.terminar();
      }}
    >
      {distancia > 0 && <p className="mp-exp-lombada">{c.lombada}</p>}
      <div className="mp-exp-camada-corpo" inert={atras || undefined}>
        {c.conteudo}
      </div>
    </motion.section>
  );
}

export function Palco({
  camadas,
  profundidade,
  anuncio,
  pai,
  vistaPedida,
  urlPlana,
  urlCamadas,
}: {
  /** As camadas desenhadas, da mais antiga à do topo (no máximo `MAX_CAMADAS`). */
  camadas: CamadaDoPalco[];
  /** Quantos níveis a pilha tem (a trilha), não quantas camadas estão desenhadas. */
  profundidade: number;
  /** O texto da região viva: posição na descida e trilha (`anuncioDaCamada`). */
  anuncio: string;
  /** Um nível acima: o "Voltar" e o Esc. Null no Brasil. */
  pai: { href: string; nome: string } | null;
  vistaPedida: VistaExplorador | null;
  urlPlana: string;
  urlCamadas: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const raizRef = useRef<HTMLDivElement>(null);
  const palcoRef = useRef<HTMLDivElement>(null);

  const reduzir = useMidia("(prefers-reduced-motion: reduce)");
  const dica = useSyncExternalStore(semAssinatura, dicaDeAparelhoFraco, () => false);
  const [lento, setLento] = useState(false);
  const fraco = dica || lento;
  const vista = vistaEfetiva(vistaPedida, reduzir, fraco);
  const aoEngasgar = useCallback(() => setLento(true), []);
  const medida = useMedidaDeQuadros(aoEngasgar);

  const topo = camadas[camadas.length - 1];

  // A direção da troca, ajustada no próprio render quando o topo muda (o padrão do React para "estado anterior").
  const [anterior, setAnterior] = useState({ chave: topo.chave, profundidade });
  const [direcao, setDirecao] = useState<Direcao>("desce");
  if (anterior.chave !== topo.chave) {
    setAnterior({ chave: topo.chave, profundidade });
    setDirecao(direcaoDaTroca(anterior.profundidade, profundidade));
  }

  const ir = useCallback((href: string) => iniciar(() => router.push(href, { scroll: false })), [router]);

  // O foco vai para o título da camada nova (não na primeira abertura: aí a página começa do topo, como as outras).
  const chaveFocada = useRef(topo.chave);
  useEffect(() => {
    if (chaveFocada.current === topo.chave) return;
    chaveFocada.current = topo.chave;
    const palco = palcoRef.current;
    if (!palco) return;
    // Quem desceu de um item no fim de uma lista longa volta a ver o palco do começo.
    if (palco.getBoundingClientRect().top < 0) palco.scrollIntoView({ block: "start" });
    palco.querySelector<HTMLElement>(`[data-chave="${CSS.escape(topo.chave)}"] [data-titulo-camada]`)?.focus({ preventScroll: true });
  }, [topo.chave]);

  // Esc sobe uma camada — só com o foco no explorador (ou em lugar nenhum): o Esc de um menu aberto é do menu.
  const destinoPai = pai?.href ?? null;
  useEffect(() => {
    if (!destinoPai) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const alvo = e.target instanceof Element ? e.target : null;
      const explorador = raizRef.current?.closest(".mp-exp") ?? raizRef.current;
      if (alvo && alvo !== document.body && !explorador?.contains(alvo)) return;
      if (alvo?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      ir(destinoPai);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [destinoPai, ir]);

  // O mapa é SVG com `<a href>` simples (como o MapaTerritorio desenha): o clique vira navegação do Next, para animar.
  // Ctrl, Shift, Cmd e o botão do meio seguem o navegador (abrir em outra aba).
  const aoClicar = (e: MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest("a");
    if (!(a instanceof SVGAElement)) return;
    const href = a.getAttribute("href");
    if (!href || !href.startsWith(URL_EXPLORADOR)) return;
    e.preventDefault();
    ir(href);
  };

  return (
    <div ref={raizRef} className="mp-exp-palco-raiz">
      <div className="mp-exp-barra mp-nao-imprimir">
        {pai && (
          <LinkMapa href={pai.href} scroll={false} className="pa-btn pa-btn-pequeno">
            <span aria-hidden="true">←</span> Voltar para {pai.nome}
          </LinkMapa>
        )}
        <LinkMapa href={vista === "camadas" ? urlPlana : urlCamadas} scroll={false} className="pa-btn pa-btn-pequeno">
          {vista === "camadas" ? "Ver como lista, sem 3D" : "Ver em camadas (3D)"}
        </LinkMapa>
        <span className="pa-mono">
          {pai ? "Esc sobe uma camada" : "Escolha uma UF para descer"}
          {vista === "plana" && !vistaPedida && (reduzir ? " · vista plana: o sistema pede menos movimento" : " · vista plana: o aparelho pareceu lento para o 3D")}
        </span>
        {pendente && (
          <span className="pa-mono" aria-hidden="true">
            <span className="mp-carregando mp-carregando-ativo" /> carregando a camada
          </span>
        )}
      </div>

      {/* A posição na descida a cada troca. Existe desde a primeira tela: o leitor só anuncia mudança em região que já estava lá. */}
      <p role="status" className="pa-sr">
        {pendente ? "Carregando a camada…" : anuncio}
      </p>

      <div ref={palcoRef} className="mp-exp-palco" data-vista={vista} data-pedida={vistaPedida ?? undefined} data-camadas={camadas.length} onClick={aoClicar}>
        {vista === "plana" ? (
          <section key={topo.chave} className="mp-exp-camada" data-chave={topo.chave} data-distancia={0}>
            <div className="mp-exp-camada-corpo">{topo.conteudo}</div>
          </section>
        ) : (
          <MotionConfig reducedMotion="user" transition={TRANSICAO}>
            <AnimatePresence initial={false} custom={{ direcao } satisfies Custom}>
              {camadas.map((c, i) => (
                <Camada key={c.chave} c={c} distancia={camadas.length - 1 - i} direcao={direcao} aoVoltar={ir} medida={medida} />
              ))}
            </AnimatePresence>
          </MotionConfig>
        )}
      </div>
    </div>
  );
}
