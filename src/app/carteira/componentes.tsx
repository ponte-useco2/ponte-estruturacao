/**
 * Primitivas do design system CTLC usadas pela Carteira Territorial.
 *
 * São reconstruções de `_ds/ctlc-design-system-<id>/components/core/` — Badge,
 * SectionHeading e Tag — reduzidas ao que esta tela consome. O bundle original
 * do design system é um IIFE que pendura componentes em `window` e busca
 * ícones por URL no unpkg; nada disso sobrevive a build de produção com CSP,
 * então o caminho é reimplementar a saída visual, não importar o protótipo.
 *
 * Sem "use client": não há estado nem efeito aqui. Quem consome é client, e
 * estes módulos entram no mesmo bundle por arrasto.
 */

import type { CSSProperties, ReactNode } from "react";
import type { Tom } from "./dados";

/**
 * Paleta dos selos, na definição do design system.
 *
 * `fg` faz papel duplo: é a cor do texto na versão vazada e a cor de FUNDO na
 * versão sólida — é assim que o Badge original alterna entre as duas, e é o
 * que mantém sólido e vazado do mesmo tom sem uma segunda paleta.
 */
const TONS: Record<Tom, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: "rgba(255,255,255,.08)", fg: "var(--ct-text-secondary)", bd: "var(--ct-border-default)" },
  brand: { bg: "rgba(36,31,95,.9)", fg: "var(--color-ct-ink-100)", bd: "var(--ct-indigo-700)" },
  blue: { bg: "var(--ct-tint-blue)", fg: "var(--ct-blue-400)", bd: "rgba(71,95,177,.5)" },
  violet: { bg: "var(--ct-tint-violet)", fg: "var(--ct-violet-500)", bd: "rgba(160,92,220,.5)" },
  success: { bg: "rgba(63,191,143,.14)", fg: "var(--ct-green-500)", bd: "rgba(63,191,143,.45)" },
  warning: { bg: "rgba(224,162,60,.14)", fg: "var(--ct-amber-500)", bd: "rgba(224,162,60,.45)" },
  danger: { bg: "rgba(226,86,75,.14)", fg: "var(--ct-red-500)", bd: "rgba(226,86,75,.45)" },
};

/** Marcador de status. Texto em versalete com entreletra larga. */
export function Selo({
  children,
  tom = "neutral",
  solido = false,
  style,
}: {
  children: ReactNode;
  tom?: Tom;
  solido?: boolean;
  style?: CSSProperties;
}) {
  const t = TONS[tom] ?? TONS.neutral;
  return (
    <span
      className="ct-selo"
      style={{
        background: solido ? t.fg : t.bg,
        color: solido ? "var(--ct-inset)" : t.fg,
        border: "1px solid " + (solido ? "transparent" : t.bd),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Abertura de seção: overline, título, régua-assinatura e lede opcional.
 *
 * A régua com o gradiente azul→violeta é o único adorno de marca da tela e o
 * design system a trata como assinatura, não como enfeite — por isso ela vem
 * ligada por padrão.
 */
export function TituloSecao({
  overline,
  titulo,
  lede,
  regua = true,
}: {
  overline?: string;
  titulo: ReactNode;
  lede?: string;
  regua?: boolean;
}) {
  return (
    <header className="ct-sh">
      {overline ? <span className="ct-overline">{overline}</span> : null}
      <h2 className="ct-sh-titulo">{titulo}</h2>
      {regua ? <span className="ct-sh-regra" aria-hidden /> : null}
      {lede ? <p className="ct-sh-lede">{lede}</p> : null}
    </header>
  );
}

/**
 * Chip de taxonomia selecionável.
 *
 * É `<button aria-pressed>` e não `<span onClick>` como no protótipo: o filtro
 * da Carteira precisa ser alcançável por teclado, e o estado precisa chegar a
 * leitor de tela. O CSS lê o mesmo `aria-pressed` para pintar o selecionado,
 * então marcação acessível e aparência não podem sair de sincronia.
 */
export function Chip({
  children,
  selecionado = false,
  onSelect,
}: {
  children: ReactNode;
  selecionado?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button type="button" className="ct-tag" aria-pressed={selecionado} onClick={onSelect}>
      {children}
    </button>
  );
}

/** Cartão neutro: a superfície elevada padrão do design system. */
export function Cartao({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="ct-card ct-col-flex" style={{ padding: 24, ...style }}>
      {children}
    </div>
  );
}
