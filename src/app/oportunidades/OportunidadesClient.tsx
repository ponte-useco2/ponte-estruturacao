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

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ============================ TIPOS ==============================

const CONTRATO_MAJOR = 1;

type Canal = "proposta" | "emenda";

interface Oportunidade {
  id: string;
  programa: string;
  orgao: string;
  natureza: string;
  canal: Canal;
  modalidade?: string;
  situacao?: string;
  abre?: string;
  fecha: string;
  dias_restantes: number;
  urgente: boolean;
  nova: boolean;
  aderente: boolean;
  temas: string[];
  codigos: string[];
  propostas_recebidas: number;
}

interface PropostaRecente {
  data: string;
  programa: string;
  proponente: string;
  municipio: string;
  uf: string;
  natureza: string;
  situacao: string;
  valor_global: number | null;
  objeto: string;
  mesma_uf: boolean;
}

interface Payload {
  versao: string;
  gerado_em: string;
  uf: string;
  origem: {
    repositorio: string;
    modulo: string;
    atualizada_em: string | null;
    defasagem_dias: number | null;
    defasada: boolean;
  };
  resumo: {
    abertas: number;
    urgentes: number;
    aderentes: number;
    novas: number;
    propostas_recentes: number;
    encerradas: number;
  };
  filtros: {
    naturezas: string[];
    canais: Canal[];
    orgaos: string[];
  };
  oportunidades: Oportunidade[];
  propostas_recentes: PropostaRecente[];
  encerradas: string[];
}

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
  return { natureza: g("natureza"), canal: g("canal"), orgao: g("orgao") };
}
function stateToQS(f: { natureza: string[]; canal: string[]; orgao: string[] }): string {
  const p = new URLSearchParams();
  if (f.natureza.length) p.set("natureza", f.natureza.join(","));
  if (f.canal.length) p.set("canal", f.canal.join(","));
  if (f.orgao.length) p.set("orgao", f.orgao.join(","));
  const s = p.toString();
  return s ? "?" + s : "";
}

// ============================ ESTILOS ==============================

function Estilos() {
  return (
    <style>{`
      :root {
        --op-bg: #FCFCFB;
        --op-wash: #F9F9F7;
        --op-ink: #2E2C27;
        --op-soft: #6B6A63;
        --op-grey: #B4B3A8;
        --op-hair: #E4E3DC;
        --op-clay: #C6613F;
        --op-verde: #5C7A5C;
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
        font-family: Georgia, "Times New Roman", serif;
        font-weight: 600; font-size: 34px; line-height: 1.2;
        color: var(--op-ink); margin: 0 0 8px; letter-spacing: -.01em;
      }
      .op-sub { font-size: 15px; margin: 0; max-width: 640px; color: var(--op-soft); }
      .op-kpis { display: flex; gap: 40px; margin-top: 28px; flex-wrap: wrap; }
      .op-kpi .op-n { font-family: Georgia, serif; font-size: 32px; color: var(--op-ink); line-height: 1; }
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
      .op-filtros { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; align-items: center; }
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
      .op-dias { font-family: Georgia, serif; color: var(--op-ink); }
      .op-dias.urg { color: var(--op-clay); font-weight: 700; }
      .op-dias-sub { display: block; font-size: 11.5px; color: var(--op-grey); font-family: -apple-system, sans-serif; margin-top: 3px; font-weight: 400; }
      .op-propostas { font-variant-numeric: tabular-nums; text-align: right; padding-right: 20px !important; }
      .op-aviso {
        background: #FDF5EF; border-left: 4px solid var(--op-clay);
        padding: 14px 18px; margin: 24px 0 0; border-radius: 2px;
      }
      .op-aviso strong { color: var(--op-clay); }
      .op-vazio { padding: 24px 0; color: var(--op-grey); font-style: italic; font-size: 14px; }
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

export function OportunidadesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [payload, setPayload] = useState<Payload | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "incompatible">("loading");

  const [filtroNatureza, setFiltroNatureza] = useState<string[]>([]);
  const [filtroCanal, setFiltroCanal] = useState<string[]>([]);
  const [filtroOrgao, setFiltroOrgao] = useState<string[]>([]);
  const [mostrarMaisOrgaos, setMostrarMaisOrgaos] = useState(false);

  // Ler filtros da URL na montagem (deep link)
  useEffect(() => {
    const st = paramsToState(searchParams);
    setFiltroNatureza(st.natureza);
    setFiltroCanal(st.canal);
    setFiltroOrgao(st.orgao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza URL sempre que filtros mudam (replace, sem entrada nova no histórico)
  useEffect(() => {
    if (status !== "ok") return;
    const qs = stateToQS({ natureza: filtroNatureza, canal: filtroCanal, orgao: filtroOrgao });
    router.replace("/oportunidades" + qs, { scroll: false });
  }, [filtroNatureza, filtroCanal, filtroOrgao, status, router]);

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
    carregar();
  }, [carregar]);

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

  const aplicar = (o: Oportunidade): boolean => {
    if (filtroNatureza.length && !filtroNatureza.includes(o.natureza)) return false;
    if (filtroCanal.length && !filtroCanal.includes(o.canal)) return false;
    if (filtroOrgao.length && !filtroOrgao.includes(o.orgao)) return false;
    return true;
  };

  const opsFiltradas = payload.oportunidades.filter(aplicar);
  const opsUrgentes = opsFiltradas.filter((o) => o.urgente);
  const opsNovas = opsFiltradas.filter((o) => o.nova);
  const opsAderentes = opsFiltradas.filter((o) => o.aderente);

  const propsFiltradas = payload.propostas_recentes.filter((p) => {
    if (filtroNatureza.length && !filtroNatureza.includes(p.natureza)) return false;
    return true;
  });

  const temFiltro = filtroNatureza.length + filtroCanal.length + filtroOrgao.length > 0;
  const limparFiltros = () => {
    setFiltroNatureza([]);
    setFiltroCanal([]);
    setFiltroOrgao([]);
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
              <Secao titulo="Fecham em até 15 dias" ops={opsUrgentes} temFiltro={temFiltro} />
              <Secao titulo="Novas desde a última rodada" ops={opsNovas} temFiltro={temFiltro} />
              <Secao titulo="Aderentes à carteira" ops={opsAderentes} temFiltro={temFiltro} />
              <Secao titulo="Todas as janelas abertas" ops={opsFiltradas} temFiltro={temFiltro} />
              <SecaoPropostas propostas={propsFiltradas} temFiltro={temFiltro} />
              <SecaoEncerradas encerradas={payload.encerradas} />
            </>
          )}

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
}: {
  titulo: string;
  ops: Oportunidade[];
  temFiltro: boolean;
}) {
  if (ops.length === 0 && !temFiltro) return null;
  return (
    <section className="op-secao">
      <h2 className="op-h2">{titulo}</h2>
      {ops.length === 0 ? (
        <div className="op-vazio">Nenhum programa neste filtro.</div>
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
              <OportunidadeRow key={o.id + o.canal} o={o} />
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

function OportunidadeRow({ o }: { o: Oportunidade }) {
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
        <span>{o.programa}</span>
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
        {o.orgao}
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
      </td>
      <td className="op-col-propostas op-propostas">{o.propostas_recebidas}</td>
    </tr>
  );
}

function SecaoPropostas({
  propostas,
  temFiltro,
}: {
  propostas: PropostaRecente[];
  temFiltro: boolean;
}) {
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
