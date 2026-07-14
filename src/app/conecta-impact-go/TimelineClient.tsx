"use client";

import { useMemo, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { logoutConectaImpact } from "./login/actions";
import {
  PREMISSAS,
  GANTT_BARS,
  PAYMENTS,
  FINAL_ALERTS,
} from "@/config/conecta-impact-timeline";
import { PHASES } from "@/config/conecta-impact-phases";
import type { Block, Phase } from "@/config/conecta-impact-timeline";

const ACCENT = "#0E7A5F";

// Gantt: intervalo total D0 (01/07/2026) → D365+30 (30/07/2027)
const T0 = Date.UTC(2026, 6, 1);
const T1 = Date.UTC(2027, 6, 31);

function pct(y: number, m: number, d: number): number {
  return ((Date.UTC(y, m - 1, d) - T0) / (T1 - T0)) * 100;
}

const MONTH_NAMES = [
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul",
];

// ---------------- BLOCK ----------------

const TONE_STYLE: Record<string, { bg: string; border: string; accent: string; titleColor: string }> = {
  default: { bg: "#FFFFFF", border: "#E3E0D5", accent: ACCENT, titleColor: "#3B4640" },
  antes: { bg: "#FFFFFF", border: "#D7E4DC", accent: "#0E7A5F", titleColor: "#0E5F4B" },
  durante: { bg: "#FFFFFF", border: "#EADFC4", accent: "#B97F10", titleColor: "#8A5F0C" },
  depois: { bg: "#FFFFFF", border: "#DDE0E4", accent: "#64748B", titleColor: "#4B5766" },
  alert: { bg: "#FBF2EA", border: "#EBCDB2", accent: "#B4530A", titleColor: "#8F430E" },
  marco: { bg: "#EFF3EE", border: "#D8E0D6", accent: ACCENT, titleColor: "#21281F" },
};

function BlockCard({ block }: { block: Block }) {
  const tone = TONE_STYLE[block.tone || "default"];
  const isMarco = block.tone === "marco";
  return (
    <div
      style={{
        flex: `1 1 ${block.basis || "100%"}`,
        minWidth: block.basis === "100%" ? undefined : block.basis,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 10,
        padding: "20px 22px",
      }}
    >
      <div
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: isMarco ? 16 : 13,
          fontWeight: 600,
          letterSpacing: isMarco ? "-0.005em" : 0,
          color: tone.titleColor,
          textTransform: isMarco ? "none" : "uppercase",
          marginBottom: 10,
          lineHeight: 1.3,
        }}
      >
        {block.title}
      </div>
      {block.intro && (
        <p style={{ fontSize: 13.5, color: "#3B4640", margin: "0 0 12px 0", lineHeight: 1.55 }}>
          {block.intro}
        </p>
      )}
      {block.items.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {block.items.map((it, i) => (
            <li key={i} style={{ fontSize: 13.5, color: "#3B4640", lineHeight: 1.55, marginBottom: 6 }}>
              <span style={{ display: "flex", gap: 8 }}>
                <span style={{ color: tone.accent, flexShrink: 0, marginTop: 2 }}>•</span>
                <span>{it.t}</span>
              </span>
              {it.subs && it.subs.length > 0 && (
                <ul style={{ margin: "4px 0 6px 22px", padding: 0, listStyle: "none" }}>
                  {it.subs.map((sub, j) => (
                    <li key={j} style={{ fontSize: 12.5, color: "#5A6259", lineHeight: 1.5, marginBottom: 2 }}>
                      — {sub}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------- OVERVIEW ----------------

function Overview() {
  const months = useMemo(
    () =>
      MONTH_NAMES.map((name, i) => {
        const y = i < 6 ? 2026 : 2027;
        const m = i < 6 ? 7 + i : i - 5;
        return { name, left: pct(y, m, 1).toFixed(2) + "%" };
      }),
    []
  );

  return (
    <div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT }}>
        Visão geral
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", margin: "8px 0 6px 0" }}>
        Linha do tempo revisada D0–D365
      </h1>
      <p style={{ fontSize: 15, color: "#5A6259", margin: "0 0 26px 0", maxWidth: 720, lineHeight: 1.6 }}>
        O cronograma só deve ser executado após assinatura do TO e liberação formal para movimentação do recurso. A software house entra cedo, mas com marcos técnicos progressivos.
      </p>

      {/* Premissas */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
        {PREMISSAS.map((pr, i) => (
          <div
            key={i}
            style={{
              background: "#FFFFFF",
              border: "1px solid #E3E0D5",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13.5,
            }}
          >
            <span style={{ color: "#7A8177" }}>{pr.label}</span>
            <span style={{ fontWeight: 600, marginLeft: 6 }}>{pr.value}</span>
          </div>
        ))}
      </div>

      {/* Gantt */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#21281F" }}>
          Cronograma Gantt
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E3E0D5", borderRadius: 10, padding: "22px 24px", overflowX: "auto" }}>
          {/* Header meses */}
          <div style={{ position: "relative", height: 22, marginLeft: 200, marginBottom: 8, borderBottom: "1px solid #E3E0D5" }}>
            {months.slice(0, 12).map((mo, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: mo.left,
                  top: 0,
                  fontSize: 11,
                  color: "#7A8177",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                }}
              >
                {mo.name}
              </div>
            ))}
          </div>

          {/* Bars */}
          {GANTT_BARS.map((bar, i) => {
            const left = pct(bar.s[0], bar.s[1], bar.s[2]);
            const width = Math.max(pct(bar.e[0], bar.e[1], bar.e[2]) - left, 0.8);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", height: 30, marginBottom: 4 }}>
                <div style={{ width: 200, fontSize: 12, color: "#3B4640", paddingRight: 12, flexShrink: 0 }}>
                  {bar.name}
                </div>
                <div style={{ flex: 1, position: "relative", height: 22, background: "#F6F5F0", borderRadius: 4 }}>
                  <div
                    title={bar.dates}
                    style={{
                      position: "absolute",
                      left: left.toFixed(2) + "%",
                      width: width.toFixed(2) + "%",
                      top: 4,
                      bottom: 4,
                      background: bar.color,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 8,
                      fontSize: 10,
                      fontWeight: 500,
                      color: "#FFFFFF",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {bar.dates}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagamentos */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#21281F" }}>
          Calendário de faturamento e pagamento
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E3E0D5", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1.4fr 1.4fr", background: "#F6F5F0", borderBottom: "1px solid #E3E0D5", padding: "10px 16px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7A8177" }}>
            <div>Item</div>
            <div>Valor</div>
            <div>Faturamento</div>
            <div>Pagamento</div>
          </div>
          {PAYMENTS.map((p, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1.8fr 1fr 1.4fr 1.4fr",
                padding: "12px 16px",
                fontSize: 13,
                color: "#3B4640",
                borderBottom: i === PAYMENTS.length - 1 ? "none" : "1px solid #F0EEE4",
              }}
            >
              <div style={{ fontWeight: 500 }}>{p.item}</div>
              <div>{p.valor}</div>
              <div style={{ color: "#5A6259" }}>{p.fat}</div>
              <div style={{ color: "#5A6259" }}>{p.pag}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alertas finais */}
      <div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#21281F" }}>
          Alertas finais
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {FINAL_ALERTS.map((al) => (
            <div
              key={al.n}
              style={{
                flex: "1 1 320px",
                background: "#FBF2EA",
                border: "1px solid #EBCDB2",
                borderRadius: 8,
                padding: "14px 16px",
                fontSize: 13.5,
                color: "#8F430E",
                display: "flex",
                gap: 10,
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "#B4530A", flexShrink: 0 }}>
                {al.n}.
              </span>
              <span>{al.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- FASE ----------------

function PhaseView({ phase }: { phase: Phase }) {
  return (
    <div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT }}>
        {phase.kicker}
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: "8px 0 14px 0", lineHeight: 1.15 }}>
        {phase.title}
      </h1>

      {phase.meta.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 26 }}>
          {phase.meta.map((m, i) => (
            <div
              key={i}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E3E0D5",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#7A8177" }}>{m.label}</span>
              <span style={{ fontWeight: 600, marginLeft: 6 }}>{m.value}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {phase.blocks.map((b, i) => (
          <BlockCard key={i} block={b} />
        ))}
      </div>
    </div>
  );
}

// ---------------- MAIN ----------------

export function TimelineClient() {
  const [tab, setTab] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = useMemo(
    () => [{ n: "00", short: "Visão geral" } as const, ...PHASES.map((p) => ({ n: p.n, short: p.short } as const))],
    []
  );

  const currentPhase = tab > 0 ? PHASES[tab - 1] : null;

  return (
    <>
      {/* Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Instrument+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          fontFamily: "'Instrument Sans', sans-serif",
          color: "#21281F",
          background: "#F6F5F0",
        }}
      >
        {/* Mobile toggle */}
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="lg:hidden"
          style={{
            position: "fixed",
            top: 12,
            left: 12,
            zIndex: 60,
            background: "#14231C",
            color: "#E7EFE8",
            border: "none",
            borderRadius: 8,
            padding: 8,
            cursor: "pointer",
          }}
        >
          {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* SIDEBAR */}
        <aside
          style={{
            width: 268,
            flexShrink: 0,
            background: "#14231C",
            color: "#E7EFE8",
            display: "flex",
            flexDirection: "column",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
          }}
          className={mobileNavOpen ? "block" : "hidden lg:flex"}
        >
          <div style={{ padding: "26px 22px 18px 22px", borderBottom: "1px solid #24382E" }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em" }}>
              ConectaImpact GO
            </div>
            <div style={{ fontSize: 12.5, color: "#9BB1A2", marginTop: 4 }}>
              Linha do tempo D0–D365 · 01/07/2026 → 30/06/2027
            </div>
          </div>

          <nav style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
            {navItems.map((it, i) => {
              const active = i === tab;
              return (
                <button
                  key={i}
                  onClick={() => {
                    setTab(i);
                    setMobileNavOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: active ? ACCENT : "transparent",
                    color: active ? "#FFFFFF" : "#C7D4C9",
                    border: "none",
                    textAlign: "left",
                    fontFamily: "'Instrument Sans', sans-serif",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "#1E3328";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: 11,
                      fontWeight: 600,
                      color: active ? "rgba(255,255,255,0.7)" : "#6E8577",
                      width: 20,
                      flexShrink: 0,
                    }}
                  >
                    {it.n}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.3 }}>
                    {it.short}
                  </span>
                </button>
              );
            })}
          </nav>

          <div style={{ marginTop: "auto", padding: "18px 22px", borderTop: "1px solid #24382E", fontSize: 12, color: "#9BB1A2", lineHeight: 1.5 }}>
            R$ 93.940 em contratações · conta exclusiva · 2 parcelas
          </div>

          <form action={logoutConectaImpact} style={{ padding: "0 18px 18px 18px" }}>
            <button
              type="submit"
              style={{
                width: "100%",
                background: "transparent",
                color: "#9BB1A2",
                border: "1px solid #24382E",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontFamily: "'Instrument Sans', sans-serif",
              }}
            >
              <LogOut size={12} /> Sair
            </button>
          </form>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ padding: "44px 52px 72px 52px", maxWidth: 1120 }} className="ci-main-pad">
            {tab === 0 && <Overview />}
            {currentPhase && <PhaseView phase={currentPhase} />}
          </div>
        </main>

        <style>{`
          @media (max-width: 1024px) {
            .ci-main-pad { padding: 60px 24px 40px 24px !important; }
          }
        `}</style>
      </div>
    </>
  );
}
