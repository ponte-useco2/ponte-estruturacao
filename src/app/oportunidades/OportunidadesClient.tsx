"use client";

/**
 * Painel de Oportunidades — janelas abertas de convênio (Transferegov).
 *
 * Fronteira de responsabilidade (Contrato de Dados v1.0):
 *  - Este arquivo lê `/dados/oportunidades.json` e renderiza.
 *  - NÃO fala com Transferegov, NÃO recalcula urgente/dias/totais, NÃO deduplica por nome.
 *  - Datas exibidas com parse manual (evita shift de fuso via new Date("YYYY-MM-DD")).
 *  - Se `origem.defasada === true`, o aviso é obrigatório.
 *  - Se `versao` major diferir do suportado, exibe "Formato não suportado".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ============================ TIPOS ==============================

/**
 * Os tipos do contrato vêm de `@/lib/oportunidades/contrato`, leitura única
 * de docs/CONTRATO-DADOS-OPORTUNIDADES.md. Este painel e o ambiente Descobrir
 * do app logado consomem a MESMA definição — antes eram duas cópias, e a
 * divergência já tinha começado: os campos 1.1 entraram aqui e não lá.
 *
 * Os helpers locais (parseISODate, formatBR, norm, realcar…) seguem neste
 * arquivo por ora; portá-los é diff separado, para que uma regressão de
 * formatação não se confunda com a unificação de tipos.
 */
import {
  CONTRATO_MAJOR,
  type Oportunidade,
  type Payload,
  type PropostaRecente,
} from "@/lib/oportunidades/contrato";

/** Re-export: `page.tsx` importa `Payload` deste módulo. */
export type { Payload };

// ============================ HELPERS ==============================

/**
 * Consulta pública de programas do Transferegov (Acesso Livre, sessão guest).
 * O sistema legado não tem URL única por programa (POST + sessão), então o
 * melhor fluxo possível é: copiar o código pro clipboard + abrir a consulta —
 * o usuário cola no campo "Código do Programa" e clica Consultar.
 */
const TRANSFEREGOV_CONSULTA_URL =
  "https://discricionarias.transferegov.sistema.gov.br/voluntarias/ForwardAction.do?modulo=programa&path=/ConsultarPrograma/ConsultarPrograma.do&Usr=guest&Pwd=guest";

/** Parse manual de YYYY-MM-DD. Evita shift de fuso (new Date("YYYY-MM-DD") interpreta como UTC). */
function parseISODate(iso: string): { d: number; m: number; y: number } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { y: parseInt(m[1], 10), m: parseInt(m[2], 10), d: parseInt(m[3], 10) };
}

function formatBR(iso: string): string {
  const p = parseISODate(iso);
  if (!p) return iso;
  const dd = String(p.d).padStart(2, "0");
  const mm = String(p.m).padStart(2, "0");
  return `${dd}/${mm}/${p.y}`;
}

function formatISOTimestamp(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]} às ${m[4]}h${m[5]}`;
}

function formatBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function paramsToState(sp: URLSearchParams) {
  const g = (k: string) => sp.getAll(k).flatMap((v) => v.split(",")).filter(Boolean);
  return {
    natureza: g("natureza"),
    canal: g("canal"),
    orgao: g("orgao"),
    q: sp.get("q") ?? "",
  };
}
function stateToQS(f: {
  natureza: string[];
  canal: string[];
  orgao: string[];
  q: string;
}): string {
  const p = new URLSearchParams();
  if (f.natureza.length) p.set("natureza", f.natureza.join(","));
  if (f.canal.length) p.set("canal", f.canal.join(","));
  if (f.orgao.length) p.set("orgao", f.orgao.join(","));
  if (f.q.trim()) p.set("q", f.q.trim());
  const s = p.toString();
  return s ? "?" + s : "";
}

/** Normaliza para busca: minúsculas, sem acento. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Divide o texto nos trechos que casam com o termo, para realce visual. */
function realcar(texto: string, termo: string): React.ReactNode {
  const t = termo.trim();
  if (!t) return texto;
  const alvo = norm(texto);
  const busca = norm(t);
  const partes: React.ReactNode[] = [];
  let i = 0;
  let achou = alvo.indexOf(busca);
  if (achou === -1) return texto;
  let k = 0;
  while (achou !== -1) {
    if (achou > i) partes.push(texto.slice(i, achou));
    partes.push(
      <mark key={k++} className="op-realce">
        {texto.slice(achou, achou + t.length)}
      </mark>
    );
    i = achou + t.length;
    achou = alvo.indexOf(busca, i);
  }
  if (i < texto.length) partes.push(texto.slice(i));
  return partes;
}

// ============================ ESTILOS ==============================

function Estilos() {
  return (
    <style>{`
      /* ------------------------------------------------------------------
         Os --op-* são ALIAS sobre os tokens da plataforma (--color-pl-*,
         definidos em src/app/globals.css a partir do :root de
         public/plataforma.html). Não são uma segunda paleta convivendo:
         nenhum valor de cor nasce aqui.

         Isto é a troca de variáveis; o port do arquivo para Tailwind é
         diff separado — migração visual e feature nova não compartilham
         commit, senão uma regressão não tem culpado identificável.

         PENDENTE DO PORT: quatro hexes ainda hardcoded em regras abaixo
         (#E1E1DF, #F4EFE6, #FDF5EF, #C9C7BF) e a Georgia em --op-display.
         ------------------------------------------------------------------ */
      :root {
        --op-bg: var(--color-pl-bg);
        --op-wash: var(--color-pl-surface-2);
        --op-ink: var(--color-pl-text);
        --op-soft: var(--color-pl-muted);
        --op-grey: var(--color-pl-muted-2);
        --op-hair: var(--color-pl-border);
        --op-clay: var(--color-pl-danger);
        --op-verde: var(--color-pl-brand-2);

        /* Georgia estava hardcoded em 4 regras. Promovida a variável com o
           valor INALTERADO — zero mudança visual agora, e o port vira troca
           de um valor só: var(--font-pl-display). */
        --op-display: Georgia, "Times New Roman", serif;
      }
      .op-root {
        background: var(--op-bg);
        color: var(--op-soft);
        font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        line-height: 1.55;
        min-height: 100vh;
      }
      .op-topo { background: var(--op-wash); border-bottom: 1px solid #E1E1DF; }
      .op-wrap { max-width: 1080px; margin: 0 auto; padding: 44px 30px 36px; }
      .op-sup { font-size: 12.5px; letter-spacing: .03em; margin: 0 0 12px; color: var(--op-soft); }
      .op-h1 {
        font-family: var(--op-display);
        font-weight: 600; font-size: 34px; line-height: 1.2;
        color: var(--op-ink); margin: 0 0 8px; letter-spacing: -.01em;
      }
      .op-sub { font-size: 15px; margin: 0; max-width: 640px; color: var(--op-soft); }
      .op-kpis { display: flex; gap: 40px; margin-top: 28px; flex-wrap: wrap; }
      .op-kpi .op-n { font-family: var(--op-display); font-size: 32px; color: var(--op-ink); line-height: 1; }
      .op-kpi .op-l {
        font-size: 12px; letter-spacing: .05em; text-transform: uppercase;
        margin-top: 5px; color: var(--op-grey);
      }
      .op-kpi.alerta .op-n { color: var(--op-clay); }
      .op-conteudo { padding: 36px 30px 60px; }
      .op-h2 {
        font-size: 12.5px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase;
        color: var(--op-ink); margin: 0 0 16px;
      }
      .op-secao { margin-top: 44px; }
      /* ---- Barra de controle: gruda no topo ao rolar ---- */
      .op-controles {
        position: sticky; top: 0; z-index: 20;
        background: rgba(252,252,251,.88);
        backdrop-filter: saturate(180%) blur(12px);
        -webkit-backdrop-filter: saturate(180%) blur(12px);
        margin: 0 -30px; padding: 16px 30px 12px;
        border-bottom: 1px solid transparent;
        transition: border-color 160ms ease, box-shadow 160ms ease;
      }
      .op-controles[data-grudado="true"] {
        border-bottom-color: var(--op-hair);
        box-shadow: 0 1px 12px rgba(46,44,39,.05);
      }
      .op-busca-linha { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
      .op-busca {
        position: relative; flex: 1 1 320px; min-width: 220px; max-width: 460px;
      }
      .op-busca input {
        width: 100%; font: inherit; font-size: 14px;
        padding: 10px 34px 10px 36px;
        border: 1px solid var(--op-hair); border-radius: 15px;
        background: #FFFFFF; color: var(--op-ink);
        transition: border-color 140ms ease, box-shadow 140ms ease;
      }
      .op-busca input::placeholder { color: var(--op-grey); }
      .op-busca input:focus {
        outline: none; border-color: var(--op-soft);
        box-shadow: 0 0 0 3px rgba(107,106,99,.10);
      }
      .op-busca-icone {
        position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
        color: var(--op-grey); pointer-events: none; line-height: 0;
      }
      .op-busca-limpar {
        position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
        background: none; border: none; cursor: pointer; color: var(--op-grey);
        padding: 4px; line-height: 0; border-radius: 50%;
      }
      .op-busca-limpar:hover { color: var(--op-ink); }
      .op-busca-limpar:focus-visible { outline: 2px solid var(--op-ink); outline-offset: 1px; }
      .op-contador {
        font-size: 13px; color: var(--op-soft); font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .op-contador strong { color: var(--op-ink); font-weight: 600; }

      .op-filtros { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 0; align-items: center; }
      .op-filtro-grupo { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
      .op-filtro-titulo {
        font-size: 11px; text-transform: uppercase; letter-spacing: .08em;
        color: var(--op-grey); margin-right: 8px;
      }
      .op-chip {
        font: inherit; font-size: 13px; padding: 8px 14px;
        border: 1px solid var(--op-hair); background: transparent; color: var(--op-soft);
        border-radius: 15px; cursor: pointer;
        transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
        min-height: 36px; min-width: 44px;
      }
      .op-chip:hover { border-color: var(--op-grey); color: var(--op-ink); }
      .op-chip:focus-visible { outline: 2px solid var(--op-ink); outline-offset: 2px; }
      .op-chip[aria-pressed="true"] { background: var(--op-ink); color: var(--op-bg); border-color: var(--op-ink); }
      .op-chip-count { color: var(--op-grey); margin-left: 4px; font-size: 12px; }
      .op-chip[aria-pressed="true"] .op-chip-count { color: rgba(255,255,255,0.7); }
      .op-limpar {
        background: none; border: none; color: var(--op-clay);
        font: inherit; font-size: 13px; cursor: pointer; padding: 6px 10px;
        text-decoration: underline;
      }
      .op-secao-header {
        display: flex; align-items: baseline; justify-content: space-between;
        gap: 16px; flex-wrap: wrap; margin-bottom: 16px;
      }
      .op-secao-header .op-h2 { margin: 0; }
      .op-seg {
        display: inline-flex; border: 1px solid var(--op-hair); border-radius: 15px;
        overflow: hidden;
      }
      .op-seg-btn {
        font: inherit; font-size: 12px; padding: 6px 12px;
        background: transparent; color: var(--op-soft); border: none;
        cursor: pointer; transition: background 120ms ease, color 120ms ease;
        min-height: 30px;
      }
      .op-seg-btn + .op-seg-btn { border-left: 1px solid var(--op-hair); }
      .op-seg-btn:hover { color: var(--op-ink); }
      .op-seg-btn:focus-visible { outline: 2px solid var(--op-ink); outline-offset: -2px; }
      .op-seg-btn[aria-pressed="true"] { background: var(--op-ink); color: var(--op-bg); }
      .op-tabela { width: 100%; border-collapse: collapse; font-size: 13.5px; }
      .op-tabela th {
        text-align: left; font-size: 11px; letter-spacing: .07em; text-transform: uppercase;
        color: var(--op-grey); font-weight: 600; padding: 0 10px 8px 0;
        border-bottom: 1px solid var(--op-hair); vertical-align: bottom;
      }
      .op-tabela td {
        padding: 12px 10px 12px 0; border-bottom: 1px solid var(--op-hair); vertical-align: top;
      }
      .op-tabela tbody tr { transition: background 120ms ease; animation: op-slide-in 150ms ease-out both; }
      .op-tabela tbody tr:hover { background: var(--op-wash); }
      @keyframes op-slide-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .op-prog { color: var(--op-ink); font-weight: 600; max-width: 330px; }
      .op-prog-meta { display: block; font-size: 11.5px; color: var(--op-grey); margin-top: 4px; font-weight: 400; }
      .op-prog-ader { display: block; font-size: 12px; color: var(--op-verde); margin-top: 4px; font-weight: 500; }
      .op-prog-novo {
        display: inline-block; font-size: 10.5px; font-weight: 700;
        color: var(--op-ink); text-transform: uppercase; letter-spacing: .08em;
        border: 1px solid var(--op-ink); padding: 1px 6px; margin-left: 8px; vertical-align: 1px;
      }
      .op-orgao { max-width: 200px; }
      .op-dias {
        font-family: var(--op-display); color: var(--op-ink);
        font-variant-numeric: tabular-nums; letter-spacing: -.01em;
      }
      .op-dias.urg { color: var(--op-clay); font-weight: 700; }
      .op-dias-sub {
        display: block; font-size: 11.5px; color: var(--op-grey);
        font-family: -apple-system, sans-serif; margin-top: 3px; font-weight: 400;
        font-variant-numeric: tabular-nums;
      }
      /* Termômetro: quanto da janela ainda resta. Puramente visual — usa o
         dias_restantes que já vem calculado do pipeline, nada é recalculado. */
      .op-termometro {
        display: block; height: 2px; width: 62px; margin-top: 6px;
        background: var(--op-hair); border-radius: 2px; overflow: hidden;
      }
      .op-termometro span {
        display: block; height: 100%; border-radius: 2px;
        background: var(--op-grey); transition: width 200ms ease;
      }
      .op-termometro.urg span { background: var(--op-clay); }
      /* Realce do termo buscado */
      .op-realce {
        background: #F4EFE6; color: var(--op-ink);
        border-radius: 2px; padding: 0 1px; font-weight: 700;
      }
      .op-propostas { font-variant-numeric: tabular-nums; text-align: right; padding-right: 20px !important; }
      .op-prop-sub {
        display: block; font-size: 10.5px; color: var(--op-grey);
        margin-top: 3px; letter-spacing: .01em; white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .op-aviso {
        background: #FDF5EF; border-left: 4px solid var(--op-clay);
        padding: 14px 18px; margin: 24px 0 0; border-radius: 2px;
      }
      .op-aviso strong { color: var(--op-clay); }
      .op-vazio { padding: 24px 0; color: var(--op-grey); font-style: italic; font-size: 14px; }
      .op-cta {
        margin-top: 56px; background: var(--op-ink); color: var(--op-bg);
        border-radius: 4px; padding: 34px 38px;
      }
      .op-cta h2 {
        font-family: var(--op-display); font-weight: 600;
        font-size: 22px; line-height: 1.3; margin: 0 0 10px; color: var(--op-bg);
        letter-spacing: -.01em; text-transform: none;
      }
      .op-cta p { font-size: 14.5px; margin: 0 0 22px; color: #C9C7BF; max-width: 620px; line-height: 1.6; }
      .op-cta-btn {
        display: inline-block; background: var(--op-bg); color: var(--op-ink);
        padding: 11px 22px; border-radius: 3px; font-size: 14px; font-weight: 600;
        text-decoration: none; transition: opacity 120ms ease;
      }
      .op-cta-btn:hover { opacity: .85; }
      .op-cta-alt {
        display: inline-block; margin-left: 18px; font-size: 13.5px;
        color: #C9C7BF; text-decoration: underline;
      }
      .op-cta-alt:hover { color: var(--op-bg); }
      @media (max-width: 767px) {
        .op-cta { padding: 26px 22px; }
        .op-cta h2 { font-size: 19px; }
        .op-cta-alt { display: block; margin: 14px 0 0; }
      }
      .op-rodape {
        margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--op-hair);
        font-size: 12.5px; color: var(--op-grey); line-height: 1.6;
      }
      .op-rodape a { color: var(--op-soft); }
      .op-skel { display: block; background: var(--op-hair); border-radius: 3px; animation: op-pulse 1200ms ease-in-out infinite; }
      @keyframes op-pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 0.8 } }
      .op-erro { text-align: center; padding: 60px 20px; color: var(--op-soft); }
      .op-erro-btn {
        margin-top: 16px; padding: 10px 20px; background: var(--op-ink); color: var(--op-bg);
        border: none; border-radius: 4px; font-size: 14px; cursor: pointer;
      }
      .op-prog-meta-extra { display: none; }
      @media (max-width: 1024px) {
        .op-col-canal, .op-col-propostas { display: none; }
        .op-prog-meta-extra { display: block; }
      }
      @media (max-width: 767px) {
        .op-wrap { padding: 28px 18px 24px; }
        .op-conteudo { padding: 24px 18px 40px; }
        .op-h1 { font-size: 26px; }
        .op-kpis { gap: 24px; }
        .op-kpi .op-n { font-size: 26px; }
        .op-filtros { flex-wrap: nowrap; overflow-x: auto; scroll-snap-type: x proximity; padding-bottom: 4px; }
        .op-filtro-grupo { flex-shrink: 0; scroll-snap-align: start; }
        .op-tabela thead { display: none; }
        .op-tabela, .op-tabela tbody, .op-tabela tr, .op-tabela td { display: block; width: 100%; }
        .op-tabela tr {
          background: var(--op-wash); border: 1px solid var(--op-hair);
          border-radius: 4px; padding: 14px; margin-bottom: 12px; position: relative;
        }
        .op-tabela td { border-bottom: none; padding: 4px 0; }
        .op-tabela td.op-prog { max-width: 100%; padding-right: 90px; }
        .op-tabela td.op-fecha {
          position: absolute; top: 14px; right: 14px; padding: 0; text-align: right;
        }
        .op-orgao { max-width: 100%; font-size: 12.5px; color: var(--op-grey); }
        .op-orgao::before, .op-natureza::before {
          content: attr(data-lbl); display: block; font-size: 10.5px;
          text-transform: uppercase; letter-spacing: .08em; color: var(--op-grey);
          margin-top: 8px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .op-tabela tbody tr { animation: none; }
        .op-chip { transition: none; }
        .op-skel { animation: none; opacity: 0.6; }
      }
    `}</style>
  );
}

function Esqueleto() {
  return (
    <>
      <Estilos />
      <div className="op-root">
        <div className="op-topo">
          <div className="op-wrap">
            <div className="op-skel" style={{ height: 14, width: 220, marginBottom: 12 }} />
            <div className="op-skel" style={{ height: 34, width: "70%", marginBottom: 8 }} />
            <div className="op-skel" style={{ height: 18, width: "50%" }} />
            <div className="op-kpis" style={{ marginTop: 28 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="op-kpi">
                  <div className="op-skel" style={{ height: 32, width: 60 }} />
                  <div className="op-skel" style={{ height: 12, width: 90, marginTop: 8 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="op-conteudo" style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div className="op-filtros">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="op-skel" style={{ height: 32, width: 120, borderRadius: 15 }} />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="op-skel" style={{ height: 60, marginBottom: 6 }} />
          ))}
        </div>
      </div>
    </>
  );
}

// ============================ MAIN ==============================

export function OportunidadesClient({
  payloadInicial,
}: {
  payloadInicial: Payload | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Se o servidor já leu o JSON, começamos renderizados — sem esqueleto, sem fetch.
  const [payload, setPayload] = useState<Payload | null>(payloadInicial);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "incompatible">(
    payloadInicial ? "ok" : "loading"
  );

  const [filtroNatureza, setFiltroNatureza] = useState<string[]>([]);
  const [filtroCanal, setFiltroCanal] = useState<string[]>([]);
  const [filtroOrgao, setFiltroOrgao] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [mostrarMaisOrgaos, setMostrarMaisOrgaos] = useState(false);
  const [grudado, setGrudado] = useState(false);
  const controlesRef = useRef<HTMLDivElement | null>(null);

  // Sombra sutil na barra de controles quando ela gruda no topo
  useEffect(() => {
    const el = controlesRef.current;
    if (!el) return;
    const onScroll = () => {
      setGrudado(el.getBoundingClientRect().top <= 0.5);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [status]);

  // Atalho: "/" foca a busca (padrão de painéis densos)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA");
      if (e.key === "/" && !digitando) {
        e.preventDefault();
        document.getElementById("op-campo-busca")?.focus();
      }
      if (e.key === "Escape" && digitando) {
        (alvo as HTMLInputElement).blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ler filtros da URL na montagem (deep link)
  useEffect(() => {
    const st = paramsToState(searchParams);
    setFiltroNatureza(st.natureza);
    setFiltroCanal(st.canal);
    setFiltroOrgao(st.orgao);
    setBusca(st.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza URL sempre que filtros mudam (replace, sem entrada nova no histórico)
  useEffect(() => {
    if (status !== "ok") return;
    const qs = stateToQS({
      natureza: filtroNatureza,
      canal: filtroCanal,
      orgao: filtroOrgao,
      q: busca,
    });
    const t = setTimeout(() => {
      router.replace("/oportunidades" + qs, { scroll: false });
    }, 250); // debounce: não escreve na URL a cada tecla
    return () => clearTimeout(t);
  }, [filtroNatureza, filtroCanal, filtroOrgao, busca, status, router]);

  const carregar = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await fetch("/dados/oportunidades.json", { cache: "default" });
      if (!r.ok) throw new Error(String(r.status));
      const d: Payload = await r.json();
      const [major] = String(d.versao ?? "").split(".");
      if (parseInt(major, 10) !== CONTRATO_MAJOR) {
        setStatus("incompatible");
        return;
      }
      setPayload(d);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // Payload já veio do servidor — não refaz a busca.
    if (payloadInicial) return;
    carregar();
  }, [carregar, payloadInicial]);

  if (status === "loading") return <Esqueleto />;

  if (status === "error") {
    return (
      <>
        <Estilos />
        <div className="op-root">
          <div className="op-conteudo op-erro">
            <p>Não foi possível carregar as oportunidades agora.</p>
            <button className="op-erro-btn" onClick={() => carregar()}>Tentar de novo</button>
          </div>
        </div>
      </>
    );
  }

  if (status === "incompatible" || !payload) {
    return (
      <>
        <Estilos />
        <div className="op-root">
          <div className="op-conteudo op-erro">
            <p>Formato de dados não suportado.</p>
            <p style={{ fontSize: 13, marginTop: 8, color: "var(--op-grey)" }}>
              Contate <a href="mailto:diretoria.ponte.projetos@gmail.com">diretoria.ponte.projetos@gmail.com</a>.
            </p>
          </div>
        </div>
      </>
    );
  }

  const buscaNorm = norm(busca.trim());

  const aplicar = (o: Oportunidade): boolean => {
    if (filtroNatureza.length && !filtroNatureza.includes(o.natureza)) return false;
    if (filtroCanal.length && !filtroCanal.includes(o.canal)) return false;
    if (filtroOrgao.length && !filtroOrgao.includes(o.orgao)) return false;
    if (buscaNorm) {
      // Busca em programa, órgão, temas e códigos — E com os demais filtros
      const alvo = norm(
        [o.programa, o.orgao, o.temas.join(" "), o.codigos.join(" "), o.modalidade ?? ""].join(" ")
      );
      if (!alvo.includes(buscaNorm)) return false;
    }
    return true;
  };

  const opsFiltradas = payload.oportunidades.filter(aplicar);
  const opsUrgentes = opsFiltradas.filter((o) => o.urgente);
  const opsNovas = opsFiltradas.filter((o) => o.nova);
  const opsAderentes = opsFiltradas.filter((o) => o.aderente);

  // Totais sem filtro — distinguem "seção vazia por natureza" (some inteira)
  // de "seção esvaziada pelo filtro" (mantém título). Spec §7.
  const totalUrgentes = payload.oportunidades.filter((o) => o.urgente).length;
  const totalNovas = payload.oportunidades.filter((o) => o.nova).length;
  const totalAderentes = payload.oportunidades.filter((o) => o.aderente).length;

  const propsFiltradas = payload.propostas_recentes.filter((p) => {
    if (filtroNatureza.length && !filtroNatureza.includes(p.natureza)) return false;
    if (buscaNorm) {
      const alvo = norm([p.programa, p.proponente, p.municipio, p.objeto].join(" "));
      if (!alvo.includes(buscaNorm)) return false;
    }
    return true;
  });

  const temFiltro =
    filtroNatureza.length + filtroCanal.length + filtroOrgao.length > 0 || !!buscaNorm;
  const limparFiltros = () => {
    setFiltroNatureza([]);
    setFiltroCanal([]);
    setFiltroOrgao([]);
    setBusca("");
  };
  const toggleChip = (grupo: string[], setter: (v: string[]) => void, val: string) => {
    setter(grupo.includes(val) ? grupo.filter((x) => x !== val) : [...grupo, val]);
  };

  // Contagem por chip (a partir do array bruto, não recontar depois de filtro)
  const cntNat: Record<string, number> = {};
  const cntCanal: Record<string, number> = { proposta: 0, emenda: 0 };
  const cntOrg: Record<string, number> = {};
  for (const o of payload.oportunidades) {
    cntNat[o.natureza] = (cntNat[o.natureza] || 0) + 1;
    cntCanal[o.canal] = (cntCanal[o.canal] || 0) + 1;
    cntOrg[o.orgao] = (cntOrg[o.orgao] || 0) + 1;
  }

  const orgaosVisiveis = mostrarMaisOrgaos ? payload.filtros.orgaos : payload.filtros.orgaos.slice(0, 5);
  const orgaosOcultos = payload.filtros.orgaos.length - 5;

  const r = payload.resumo;
  const zeroGlobal = r.abertas === 0;

  const tituloAberturas =
    r.abertas === 0
      ? "Nenhuma janela aberta para a Paraíba hoje."
      : `${r.abertas} janela${r.abertas === 1 ? "" : "s"} aberta${r.abertas === 1 ? "" : "s"}${
          r.urgentes > 0 ? `, ${r.urgentes} fechando em duas semanas` : ""
        }.`;

  return (
    <>
      <Estilos />
      <div className="op-root">
        <header className="op-topo">
          <div className="op-wrap">
            <p className="op-sup">Painel público · gerado em {formatISOTimestamp(payload.gerado_em)}</p>
            <h1 className="op-h1">{tituloAberturas}</h1>
            <p className="op-sub">
              Janelas de proposta e emenda abertas para a Paraíba, extraídas do módulo de
              Transferências Discricionárias do Transferegov.br. Escaneie em 10 segundos: fecha
              alguma coisa hoje?
            </p>

            <div className="op-kpis" role="list">
              <div className={`op-kpi${r.urgentes > 0 ? " alerta" : ""}`} role="listitem">
                <div className="op-n">{r.urgentes}</div>
                <div className="op-l">Fechando ≤ 15 dias</div>
              </div>
              <div className="op-kpi" role="listitem">
                <div className="op-n">{r.abertas}</div>
                <div className="op-l">Abertas hoje</div>
              </div>
              <div className="op-kpi" role="listitem">
                <div className="op-n">{r.aderentes}</div>
                <div className="op-l">Aderentes à carteira</div>
              </div>
              <div className="op-kpi" role="listitem">
                <div className="op-n">{r.novas}</div>
                <div className="op-l">Novas desde ontem</div>
              </div>
              <div className="op-kpi" role="listitem">
                <div className="op-n">{r.propostas_recentes}</div>
                <div className="op-l">Propostas recentes</div>
              </div>
            </div>

            {payload.origem.defasada && (
              <div className="op-aviso" role="status">
                <strong>Coleta atrasada na origem.</strong>{" "}
                A última atualização do repositório é de{" "}
                {payload.origem.atualizada_em
                  ? formatBR(payload.origem.atualizada_em.slice(0, 10))
                  : "data desconhecida"}{" "}
                — {payload.origem.defasagem_dias} dia
                {payload.origem.defasagem_dias === 1 ? "" : "s"} atrás. Ausência de novidades pode
                significar que ninguém coletou, não que nada aconteceu.
              </div>
            )}
          </div>
        </header>

        <main className="op-conteudo" style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div className="op-controles" ref={controlesRef} data-grudado={grudado}>
            <div className="op-busca-linha">
              <div className="op-busca">
                <span className="op-busca-icone" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                </span>
                <input
                  id="op-campo-busca"
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar programa, órgão, tema ou código…"
                  aria-label="Buscar entre as oportunidades"
                  autoComplete="off"
                  spellCheck={false}
                />
                {busca && (
                  <button
                    className="op-busca-limpar"
                    onClick={() => setBusca("")}
                    aria-label="Limpar busca"
                    type="button"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              <span className="op-contador">
                {temFiltro ? (
                  <>
                    <strong>{opsFiltradas.length}</strong> de {payload.oportunidades.length} janelas
                  </>
                ) : (
                  <>
                    <strong>{payload.oportunidades.length}</strong> janelas abertas
                  </>
                )}
              </span>
            </div>

            <div className="op-filtros" role="group" aria-label="Filtros de oportunidades">
            <div className="op-filtro-grupo">
              <span className="op-filtro-titulo">Quem pode</span>
              {payload.filtros.naturezas.map((n) => {
                const pressed = filtroNatureza.includes(n);
                const c = cntNat[n] || 0;
                return (
                  <button
                    key={n}
                    className="op-chip"
                    aria-pressed={pressed}
                    aria-label={`${n}, ${c} programas`}
                    onClick={() => toggleChip(filtroNatureza, setFiltroNatureza, n)}
                  >
                    {n} <span className="op-chip-count">({c})</span>
                  </button>
                );
              })}
            </div>

            <div className="op-filtro-grupo">
              <span className="op-filtro-titulo">Canal</span>
              {payload.filtros.canais.map((c) => {
                const pressed = filtroCanal.includes(c);
                const n = cntCanal[c] || 0;
                return (
                  <button
                    key={c}
                    className="op-chip"
                    aria-pressed={pressed}
                    aria-label={`${c}, ${n} programas`}
                    onClick={() => toggleChip(filtroCanal, setFiltroCanal, c)}
                  >
                    {c === "proposta" ? "Proposta" : "Emenda"}{" "}
                    <span className="op-chip-count">({n})</span>
                  </button>
                );
              })}
            </div>

            <div className="op-filtro-grupo">
              <span className="op-filtro-titulo">Órgão</span>
              {orgaosVisiveis.map((o) => {
                const pressed = filtroOrgao.includes(o);
                const n = cntOrg[o] || 0;
                const nomeCurto = o.length > 32 ? o.slice(0, 30) + "…" : o;
                return (
                  <button
                    key={o}
                    className="op-chip"
                    aria-pressed={pressed}
                    aria-label={`${o}, ${n} programas`}
                    title={o}
                    onClick={() => toggleChip(filtroOrgao, setFiltroOrgao, o)}
                  >
                    {nomeCurto} <span className="op-chip-count">({n})</span>
                  </button>
                );
              })}
              {orgaosOcultos > 0 && (
                <button
                  className="op-chip"
                  onClick={() => setMostrarMaisOrgaos(!mostrarMaisOrgaos)}
                  aria-expanded={mostrarMaisOrgaos}
                >
                  {mostrarMaisOrgaos ? "− menos" : `+ ${orgaosOcultos} órgãos`}
                </button>
              )}
            </div>

            {temFiltro && (
              <button className="op-limpar" onClick={limparFiltros}>
                Limpar filtros
              </button>
            )}
            </div>
          </div>

          <div aria-live="polite" style={{ position: "absolute", left: -9999 }}>
            {opsFiltradas.length} oportunidade{opsFiltradas.length === 1 ? "" : "s"} exibida
            {opsFiltradas.length === 1 ? "" : "s"}
          </div>

          {zeroGlobal && (
            <div className="op-vazio" style={{ paddingTop: 40 }}>
              Nenhuma janela aberta para a Paraíba hoje.
            </div>
          )}

          {!zeroGlobal && (
            <>
              <Secao
                titulo="Fecham em até 15 dias"
                ops={opsUrgentes}
                temFiltro={temFiltro}
                termo={busca}
                totalSemFiltro={totalUrgentes}
              />
              <Secao
                titulo="Novas desde a última rodada"
                ops={opsNovas}
                temFiltro={temFiltro}
                termo={busca}
                totalSemFiltro={totalNovas}
              />
              <Secao
                titulo="Aderentes à carteira"
                ops={opsAderentes}
                temFiltro={temFiltro}
                termo={busca}
                totalSemFiltro={totalAderentes}
              />
              <Secao
                titulo="Todas as janelas abertas"
                ops={opsFiltradas}
                temFiltro={temFiltro}
                termo={busca}
                totalSemFiltro={payload.oportunidades.length}
                headerExtra={
                  <div className="op-seg" role="group" aria-label="Filtrar por canal">
                    <button
                      className="op-seg-btn"
                      aria-pressed={filtroCanal.length === 0}
                      onClick={() => setFiltroCanal([])}
                    >
                      Todas ({cntCanal.proposta + cntCanal.emenda})
                    </button>
                    <button
                      className="op-seg-btn"
                      aria-pressed={filtroCanal.length === 1 && filtroCanal[0] === "proposta"}
                      onClick={() => setFiltroCanal(["proposta"])}
                    >
                      Proposta ({cntCanal.proposta})
                    </button>
                    <button
                      className="op-seg-btn"
                      aria-pressed={filtroCanal.length === 1 && filtroCanal[0] === "emenda"}
                      onClick={() => setFiltroCanal(["emenda"])}
                    >
                      Emenda ({cntCanal.emenda})
                    </button>
                  </div>
                }
              />
              <SecaoPropostas
                propostas={propsFiltradas}
                temFiltro={temFiltro}
                totalSemFiltro={payload.propostas_recentes.length}
              />
              <SecaoEncerradas encerradas={payload.encerradas} />
            </>
          )}

          {/* CTA — a página informa; aqui ela converte. */}
          <aside className="op-cta">
            <h2>Achou uma janela que serve pro seu município ou OSC?</h2>
            <p>
              O prazo é só o começo. Depois vem enquadramento na rubrica certa, plano de
              trabalho, contrapartida, documentação de habilitação e o rito do Transferegov —
              onde a maioria das propostas cai. A Ponte estrutura isso com você.
            </p>
            <a className="op-cta-btn" href="/#diagnostico">
              Solicitar diagnóstico
            </a>
            <a
              className="op-cta-alt"
              href="https://wa.me/5583996428315?text=Ol%C3%A1!%20Vi%20uma%20oportunidade%20no%20painel%20da%20Ponte%20e%20queria%20conversar."
              target="_blank"
              rel="noopener noreferrer"
            >
              ou chamar no WhatsApp
            </a>
          </aside>

          <footer className="op-rodape">
            Fonte:{" "}
            <a href={payload.origem.repositorio} target="_blank" rel="noopener noreferrer">
              repositório de dados abertos do Transferegov.br
            </a>
            , módulo {payload.origem.modulo}. Última extração{" "}
            {payload.origem.atualizada_em
              ? formatBR(payload.origem.atualizada_em.slice(0, 10))
              : "sem data"}
            .<br />
            Painel operado pela <a href="/">Ponte Projetos</a> · UF: {payload.uf} · Contrato de
            dados v{payload.versao}.
          </footer>
        </main>
      </div>
    </>
  );
}

function Secao({
  titulo,
  ops,
  temFiltro,
  headerExtra,
  termo = "",
  totalSemFiltro,
}: {
  titulo: string;
  ops: Oportunidade[];
  temFiltro: boolean;
  headerExtra?: React.ReactNode;
  termo?: string;
  /** Quantos itens a seção teria sem nenhum filtro. Distingue "vazia por
   *  natureza" (some inteira) de "vazia por filtro" (mantém o título). */
  totalSemFiltro: number;
}) {
  // Vazia por natureza — nunca teve conteúdo. Some, mesmo com filtro ativo.
  if (totalSemFiltro === 0) return null;
  if (ops.length === 0 && !temFiltro) return null;
  return (
    <section className="op-secao">
      <div className="op-secao-header">
        <h2 className="op-h2">{titulo}</h2>
        {headerExtra}
      </div>
      {ops.length === 0 ? (
        <div className="op-vazio">
          {termo
            ? `Nenhum programa casa com “${termo}” neste recorte.`
            : "Nenhum programa neste filtro."}
        </div>
      ) : (
        <table className="op-tabela">
          <caption style={{ position: "absolute", left: -9999 }}>{titulo}</caption>
          <thead>
            <tr>
              <th scope="col">Programa</th>
              <th scope="col">Órgão</th>
              <th scope="col">Quem pode</th>
              <th scope="col" className="op-col-canal">Canal</th>
              <th scope="col">Fecha</th>
              <th scope="col" className="op-col-propostas" style={{ textAlign: "right" }}>
                Propostas
              </th>
            </tr>
          </thead>
          <tbody>
            {ops.map((o) => (
              <OportunidadeRow key={o.id + o.canal} o={o} termo={termo} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * Link "Consultar no Transferegov": copia o código pro clipboard e abre a
 * consulta pública em nova aba. O sistema legado não suporta deep link por
 * programa, então o usuário cola o código no campo e clica Consultar.
 */
function LinkTransferegov({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);

  const abrir = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      // clipboard bloqueado — segue sem copiar
    }
    window.open(TRANSFEREGOV_CONSULTA_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={abrir}
      title={`Abre a consulta pública do Transferegov e copia o código ${codigo} — cole no campo "Código do Programa" e clique Consultar`}
      aria-label={`Consultar programa ${codigo} no Transferegov (código será copiado)`}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        font: "inherit",
        fontSize: 11.5,
        color: copiado ? "var(--op-verde)" : "var(--op-soft)",
        textDecoration: "underline",
        cursor: "pointer",
        display: "inline-block",
        marginTop: 4,
      }}
    >
      {copiado ? "código copiado — cole lá ✓" : "Consultar no Transferegov ↗"}
    </button>
  );
}

/** Só há breakdown se o payload for 1.1+ e houver ao menos uma proposta. */
function temBreakdown(o: Oportunidade): boolean {
  return (
    o.propostas_enviadas !== undefined &&
    o.propostas_em_elaboracao !== undefined &&
    o.propostas_recebidas > 0
  );
}

/** Situações exatas do SICONV, para o title da célula. */
function detalheSituacoes(o: Oportunidade): string {
  const s = o.propostas_por_situacao;
  if (!s || Object.keys(s).length === 0) return "";
  return Object.entries(s)
    .sort((a, b) => b[1] - a[1])
    .map(([situacao, n]) => `${n} ${situacao}`)
    .join(" · ");
}

function OportunidadeRow({ o, termo = "" }: { o: Oportunidade; termo?: string }) {
  // Termômetro: proporção do que resta numa janela de referência de 180 dias.
  // Só leitura visual do dias_restantes que já vem do pipeline — nada recalculado.
  const proporcao = Math.max(4, Math.min(100, (o.dias_restantes / 180) * 100));
  const meta = [
    o.codigos.length > 1 ? `${o.codigos.length} códigos` : o.codigos[0],
    o.modalidade,
    o.situacao,
  ]
    .filter(Boolean)
    .join(" · ");
  const codigoTitle = o.codigos.length > 1 ? o.codigos.join(", ") : undefined;

  return (
    <tr id={`op-${o.id}`}>
      <td className="op-prog">
        <span>{realcar(o.programa, termo)}</span>
        {o.nova && (
          <span className="op-prog-novo" aria-label="novo desde a última rodada">
            novo
          </span>
        )}
        <span className="op-prog-meta" title={codigoTitle}>
          {meta}
        </span>
        {o.aderente && o.temas.length > 0 && (
          <span className="op-prog-ader">aderente · {o.temas.join(", ")}</span>
        )}
        <span className="op-prog-meta op-prog-meta-extra">
          Canal: {o.canal === "proposta" ? "Proposta" : "Emenda"} · {o.propostas_recebidas} propostas recebidas
        </span>
        <LinkTransferegov codigo={o.codigos[0]} />
      </td>
      <td className="op-orgao" data-lbl="Órgão">
        {realcar(o.orgao, termo)}
      </td>
      <td className="op-natureza" data-lbl="Quem pode">
        {o.natureza}
      </td>
      <td className="op-col-canal">{o.canal === "proposta" ? "Proposta" : "Emenda"}</td>
      <td className="op-fecha">
        <span className={"op-dias" + (o.urgente ? " urg" : "")}>{formatBR(o.fecha)}</span>
        <span className="op-dias-sub">
          {o.dias_restantes} dia{o.dias_restantes === 1 ? "" : "s"}
        </span>
        <span
          className={"op-termometro" + (o.urgente ? " urg" : "")}
          aria-hidden="true"
          title={`${o.dias_restantes} dias até o fechamento`}
        >
          <span style={{ width: `${proporcao}%` }} />
        </span>
      </td>
      <td className="op-col-propostas op-propostas">
        {o.propostas_recebidas}
        {temBreakdown(o) && (
          <span className="op-prop-sub" title={detalheSituacoes(o)}>
            {o.propostas_enviadas} env · {o.propostas_em_elaboracao} elab
          </span>
        )}
      </td>
    </tr>
  );
}

function SecaoPropostas({
  propostas,
  temFiltro,
  totalSemFiltro,
}: {
  propostas: PropostaRecente[];
  temFiltro: boolean;
  totalSemFiltro: number;
}) {
  if (totalSemFiltro === 0) return null; // vazia por natureza — some
  if (propostas.length === 0 && !temFiltro) return null;
  return (
    <section className="op-secao">
      <h2 className="op-h2">Propostas recebidas recentemente</h2>
      {propostas.length === 0 ? (
        <div className="op-vazio">Nenhuma proposta recente neste filtro.</div>
      ) : (
        <table className="op-tabela">
          <caption style={{ position: "absolute", left: -9999 }}>Propostas recentes</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Proponente</th>
              <th scope="col">Programa</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            {propostas.map((p, i) => (
              <tr key={i} style={p.mesma_uf ? { background: "#FDF5EF" } : undefined}>
                <td>{formatBR(p.data)}</td>
                <td className="op-prog">
                  {p.proponente}
                  <span className="op-prog-meta">
                    {p.municipio}/{p.uf} · {p.situacao}
                  </span>
                </td>
                <td>
                  {p.programa}
                  <span className="op-prog-meta">{p.objeto}</span>
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                  {formatBRL(p.valor_global)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function SecaoEncerradas({ encerradas }: { encerradas: string[] }) {
  if (encerradas.length === 0) return null;
  return (
    <section className="op-secao">
      <h2 className="op-h2">Encerradas desde a última rodada</h2>
      <div style={{ fontSize: 13, color: "var(--op-grey)" }}>
        {encerradas.length} código{encerradas.length === 1 ? "" : "s"} fechou desde ontem:{" "}
        <code style={{ fontFamily: "monospace", fontSize: 12 }}>{encerradas.join(", ")}</code>
      </div>
    </section>
  );
}
