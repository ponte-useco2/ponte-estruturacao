"use client";

/**
 * Carteira Territorial da Serra do Teixeira — as seis superfícies.
 *
 * Reconstrução de `Radar-PARNA-Site-v3.dc.html` (handoff do Claude Design,
 * projeto PARNA_WEB_SITE_OPORTUNIDADES). O protótipo era uma SPA de uma tela
 * só com `sc-if` alternando seis blocos; aqui cada bloco virou um componente,
 * e o estado que os alterna vive neste arquivo.
 *
 * O que NÃO mora aqui: o motor da carteira e todo o conteúdo apurado, que
 * ficam em `dados.ts`. Este arquivo é composição e navegação.
 *
 * SOBRE A URL: o protótipo tinha as props `telaInicial` e `municipioInicial`
 * justamente para endereçar uma tela específica. Na web isso é query string —
 * e sem ela a ficha do prefeito não teria link. A escrita é por
 * `history.replaceState` e não pelo router: trocar de aba não é navegação nova
 * e não deveria empilhar entrada no histórico nem provocar ida ao servidor.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Printer } from "lucide-react";
import { Cartao, Chip, Selo, TituloSecao } from "./componentes";
import { estilosCarteira } from "./estilos";
import {
  ANATOMIA,
  CADEIA,
  CARTEIRA,
  CDR,
  CODEVASF_UF,
  CONCEDENTES,
  CORES_GATE,
  DILIGENCIAS,
  DILIG_KPIS,
  FILTROS,
  FRENTES,
  GATES,
  INDICACOES,
  PARLAMENTARES,
  PROSPECCAO,
  SERIE_COMISSAO,
  TESE,
  TOTAL_TXT,
  WHITESPACE,
  brl,
  corDosGates,
  fichaMunicipal,
  filtrarCarteira,
  municipiosOrdenados,
  tomDoEstado,
  type FichaMunicipal,
  type Filtro,
  type Oportunidade,
  type Tom,
} from "./dados";

// ============================ TIPOS ==============================

/** As seis superfícies, mais a lista que antecede a ficha municipal. */
export type Tela =
  | "cockpit"
  | "lista"
  | "municipio"
  | "carteira"
  | "articulacao"
  | "diligencias"
  | "inteligencia";

/**
 * Dias restantes até cada janela, contados no servidor.
 *
 * O protótipo trazia 91 e 122 escritos à mão, corretos no dia em que foi
 * desenhado. Numa tela cujo assunto é prazo, um contador que não anda é pior
 * que nenhum. O cálculo fica no servidor porque `new Date()` no cliente
 * divergiria do HTML renderizado e quebraria a hidratação.
 */
export interface Prazos {
  ate30Nov: number;
  ate31Dez: number;
}

interface Props {
  telaInicial: Tela;
  municipioInicial: string;
  prazos: Prazos;
  /**
   * Governa se a pendência do TransfereGov aparece na leitura multidimensional.
   * A ficha é projetada em reunião com o prefeito; quem conduz a reunião decide
   * se a pendência entra na tela naquela sala.
   */
  mostrarPendencias?: boolean;
}

const ABAS: Array<{ id: Tela; label: string }> = [
  { id: "cockpit", label: "Cockpit" },
  { id: "lista", label: "Municípios" },
  { id: "carteira", label: "Carteira" },
  { id: "articulacao", label: "Articulação" },
  { id: "diligencias", label: "Diligências" },
  { id: "inteligencia", label: "Inteligência" },
];

// ============================ RAIZ ==============================

export function CarteiraClient({
  telaInicial,
  municipioInicial,
  prazos,
  mostrarPendencias = true,
}: Props) {
  const [tela, setTela] = useState<Tela>(telaInicial);
  const [muniId, setMuniId] = useState(municipioInicial);
  const [filtro, setFiltro] = useState<Filtro>("Todas");

  // Espelha o estado na URL para que a tela tenha link. `replaceState` em vez
  // do router: é a mesma página em outro modo, não uma navegação.
  useEffect(() => {
    const p = new URLSearchParams();
    if (tela !== "cockpit") p.set("tela", tela);
    if (tela === "municipio") p.set("municipio", muniId);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [tela, muniId]);

  const abrirMunicipio = useCallback((id: string) => {
    setMuniId(id);
    setTela("municipio");
  }, []);

  const ficha = useMemo(
    () => fichaMunicipal(muniId, mostrarPendencias),
    [muniId, mostrarPendencias],
  );

  return (
    <div className="ct-root">
      <style>{estilosCarteira}</style>

      <header className="ct-topo no-print">
        <div className="ct-topo-in">
          <div className="ct-marca">
            <span className="ct-marca-nome">PONTE</span>
            <span className="ct-marca-ponto">.</span>
            <span className="ct-marca-sub">Carteira Territorial da Serra do Teixeira</span>
          </div>
          <div className="ct-topo-espaco" />
          <nav className="ct-nav" role="tablist" aria-label="Superfícies da carteira">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                className="ct-aba"
                // A ficha municipal é um detalhe de Municípios, não uma aba
                // própria — a aba segue marcada enquanto ela estiver aberta.
                aria-selected={a.id === tela || (a.id === "lista" && tela === "municipio")}
                aria-controls="ct-painel"
                onClick={() => setTela(a.id)}
              >
                {a.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="ct-main" id="ct-painel" role="tabpanel">
        {tela === "cockpit" && <Cockpit prazos={prazos} />}
        {tela === "lista" && <ListaMunicipios onAbrir={abrirMunicipio} />}
        {tela === "municipio" && (
          <Municipio ficha={ficha} onVoltar={() => setTela("lista")} />
        )}
        {tela === "carteira" && (
          <CarteiraExecutiva filtro={filtro} onFiltro={setFiltro} />
        )}
        {tela === "articulacao" && <Articulacao />}
        {tela === "diligencias" && <Diligencias />}
        {tela === "inteligencia" && <Inteligencia />}
      </main>

      <footer className="ct-rodape">
        <div className="ct-rodape-in">
          <span>PONTE · Estruturação de Projetos</span>
          <span>
            TransfereGov/SICONV, extração 18/08/2026 · CNUC 15195 · atualizado em 31/08/2026
          </span>
        </div>
      </footer>
    </div>
  );
}

// ============================ COCKPIT ==============================

function Cockpit({ prazos }: { prazos: Prazos }) {
  const kpis = [
    { v: String(CARTEIRA.length), l: "oportunidades estruturadas" },
    { v: TOTAL_TXT, l: "valor calibrado, não orçamento executivo" },
    { v: "12", l: "municípios cobertos" },
    { v: "7", l: "programas-base no Ciclo 1" },
  ];

  /**
   * O indicador principal deixou de ser "propostas submetidas".
   * A primeira linha declara zero acompanhadas de propósito: é o número que a
   * operação existe para mover, e escondê-lo esvaziaria a tela.
   */
  const kpisOperacao = [
    { v: `0 de ${CARTEIRA.length}`, l: "propostas ativamente acompanhadas — nenhuma submetida ainda" },
    { v: "15 dias", l: "SLA interno para responder diligência, contado da notificação" },
  ];

  const acoes: Array<{
    selo: string; tone: Tom; solido: boolean; t: string; d: string;
    prazo: string; prazoL: string; cor: string; borda: string;
  }> = [
    { selo: "Urgente", tone: "danger", solido: true, t: "Prazo de articulação da CDR para 2026 — confirmar", d: "A ata de 09/12/2025 registra indicação RP8 para Catingueira na ação 00SX. O calendário de 2026 ainda não foi confirmado.", prazo: "—", prazoL: "sem data", cor: "var(--ct-red-500)", borda: "rgba(226,86,75,.4)" },
    { selo: "24 propostas", tone: "warning", solido: false, t: "MIDR — submissão planejada até 31/10", d: "Duas janelas da ação 00SX fecham em 30/11. O orçamento SINAPI precisa estar pronto um mês antes.", prazo: String(prazos.ate30Nov), prazoL: "dias até 30/11", cor: "var(--ct-amber-500)", borda: "var(--ct-border-subtle)" },
    { selo: "52 propostas", tone: "blue", solido: false, t: "MAPA, INCRA e Codevasf — submissão planejada até 15/11", d: "Janelas fecham em 31/12. O gate de demanda territorial ainda está aberto em oito municípios.", prazo: String(prazos.ate31Dez), prazoL: "dias até 31/12", cor: "var(--ct-blue-400)", borda: "var(--ct-border-subtle)" },
    { selo: "38 propostas", tone: "violet", solido: false, t: "Históricas paradas em complementação desde 2024", d: "Recuperação potencial: complementação está fortemente associada à conversão. Nenhuma tem responsável designado.", prazo: "38", prazoL: "a triar", cor: "var(--ct-violet-500)", borda: "var(--ct-border-subtle)" },
  ];

  return (
    <div>
      <p className="ct-overline" style={{ marginBottom: 8 }}>
        Operação 2026 · atualizado em 31/08/2026
      </p>
      <h1 className="ct-h1" style={{ marginBottom: 12 }}>Serra do Teixeira</h1>
      <p className="ct-lede" style={{ marginBottom: 28 }}>
        Carteira estruturada a partir do comportamento real de 3.164 propostas históricas. A
        meta desta operação não é submeter mais: é fazer cada projeto sobreviver até o convênio.
      </p>

      <div className="ct-row-wrap" style={{ gap: 16, marginBottom: 16 }}>
        {kpis.map((k) => (
          <Cartao key={k.l} style={{ flex: "1 1 200px" }}>
            <div className="ct-kpi-n">{k.v}</div>
            <div className="ct-kpi-l">{k.l}</div>
          </Cartao>
        ))}
      </div>

      <div className="ct-row-wrap" style={{ gap: 16, marginBottom: 40 }}>
        {kpisOperacao.map((k) => (
          <div key={k.l} className="ct-kpi-op">
            <div className="ct-overline">Indicador principal</div>
            <div className="ct-kpi-op-n">{k.v}</div>
            <div className="ct-kpi-op-l">{k.l}</div>
          </div>
        ))}
      </div>

      <section style={{ marginBottom: 40 }}>
        <div style={{ marginBottom: 18 }}>
          <TituloSecao overline="O que exige ação" titulo="Fila de trabalho" />
        </div>
        <div className="ct-col-flex" style={{ gap: 10 }}>
          {acoes.map((a) => (
            <div key={a.t} className="ct-acao" style={{ border: `1px solid ${a.borda}` }}>
              <Selo tom={a.tone} solido={a.solido}>{a.selo}</Selo>
              <div className="ct-col" style={{ flex: "1 1 320px" }}>
                <div className="ct-acao-t">{a.t}</div>
                <div className="ct-acao-d">{a.d}</div>
              </div>
              <div className="ct-acao-prazo">
                <div className="ct-acao-prazo-n" style={{ color: a.cor }}>{a.prazo}</div>
                <div className="ct-col-l">{a.prazoL}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <div style={{ marginBottom: 18 }}>
          <TituloSecao
            overline="Três frentes"
            titulo="Mobilização, estruturação e execução"
            lede="A carteira só avança se as três correrem em paralelo. A terceira é a que o território historicamente abandona."
          />
        </div>
        <div className="ct-row-wrap" style={{ gap: 16 }}>
          {FRENTES.map((f) => (
            <div key={f.nome} className="ct-frente">
              <div className="ct-frente-topo">
                <span className="ct-frente-nome" style={{ color: f.cor }}>{f.nome}</span>
                <span className="ct-frente-n">{f.n}</span>
              </div>
              <ul className="ct-lista-itens">
                {f.itens.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div style={{ marginBottom: 18 }}>
          <TituloSecao
            overline="Rota antes de porta"
            titulo="Concedente importa mais que programa"
            lede="A trilha discricionária não é uniformemente ruim. Ela é ruim em alguns concedentes e boa em outros — medido no próprio território."
          />
        </div>
        <div className="ct-col-flex" style={{ gap: 8 }}>
          {CONCEDENTES.map((c) => (
            <div key={c.nome} className="ct-linha">
              <div className="ct-col" style={{ flex: "1 1 220px" }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{c.nome}</div>
                <div className="ct-col-l" style={{ fontSize: 12 }}>
                  {c.props} propostas · {c.conv} convênios · mediana convertida {c.mediana}
                </div>
              </div>
              <div style={{ flex: "0 0 130px" }}>
                <div className="ct-col-n" style={{ color: c.corSem }}>{c.semEmenda}</div>
                <div className="ct-col-l">sem emenda</div>
              </div>
              <div style={{ flex: "0 0 130px" }}>
                <div className="ct-col-n" style={{ color: "var(--ct-violet-500)" }}>{c.comEmenda}</div>
                <div className="ct-col-l">com emenda</div>
              </div>
              <div style={{ flex: "0 0 150px" }}>
                <Selo tom={c.tone}>{c.rec}</Selo>
              </div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 14, maxWidth: "66ch", fontSize: 13, color: "var(--ct-text-muted)", lineHeight: 1.6 }}>
          O Ministério das Cidades é a melhor rota discricionária do território e não está entre
          os sete programas da Carteira Executiva Ciclo 1. Está aberto como frente de prospecção
          em Inteligência.
        </p>
      </section>
    </div>
  );
}

// ============================ CARTEIRA EXECUTIVA ==============================

function CarteiraExecutiva({
  filtro,
  onFiltro,
}: {
  filtro: Filtro;
  onFiltro: (f: Filtro) => void;
}) {
  const visiveis = useMemo(() => filtrarCarteira(filtro), [filtro]);
  const soma = visiveis.reduce((s, p) => s + p.valorNum, 0);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <TituloSecao
          overline="Carteira Executiva 2026 · Ciclo 1"
          titulo={`${CARTEIRA.length} oportunidades estruturadas`}
          lede="Estruturadas, não prontas. Cada uma atravessa oito gates antes de virar submissão — e o valor calibrado só vira valor validado depois do orçamento."
        />
      </div>

      <div className="ct-row-wrap no-print" style={{ gap: 8, marginBottom: 20 }}>
        {FILTROS.map((f) => (
          <Chip key={f} selecionado={filtro === f} onSelect={() => onFiltro(f)}>
            {f}
          </Chip>
        ))}
      </div>

      <p aria-live="polite" style={{ marginBottom: 16, fontSize: 13, color: "var(--ct-text-muted)" }}>
        {visiveis.length} de {CARTEIRA.length} oportunidades · {brl(soma)} calibrados
      </p>

      <div className="ct-col-flex" style={{ gap: 12 }}>
        {visiveis.map((p) => <CartaoOportunidade key={p.id} p={p} />)}
      </div>
    </div>
  );
}

function CartaoOportunidade({ p }: { p: Oportunidade }) {
  return (
    <article className="ct-prop">
      <div className="ct-row-wrap" style={{ gap: 18, alignItems: "flex-start" }}>
        <div className="ct-col" style={{ flex: "1 1 340px" }}>
          <div className="ct-row-wrap" style={{ alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Selo tom={tomDoEstado(p.estado)} solido>{p.estado}</Selo>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ct-ink-200)" }}>{p.municipio}</span>
            <span style={{ fontSize: 11, color: "var(--ct-text-muted)" }}>{p.programaCurto}</span>
          </div>
          <h3 className="ct-prop-titulo">{p.titulo}</h3>
          <p className="ct-prop-objeto">{p.objeto}</p>
          <div className="ct-prop-meta">
            <span>Item: <strong>{p.item}</strong></span>
            <span>Meta única, 1 UN · prazo 1.096 dias</span>
            <span>Janela: <strong>{p.janela}</strong></span>
          </div>
        </div>

        <div style={{ flex: "0 0 230px" }}>
          <div className="ct-valor-box">
            <div className="ct-valor-rot">Valor calibrado</div>
            <div className="ct-valor-n">{p.valor}</div>
            <div className="ct-valor-rot ct-valor-sep">Valor validado</div>
            {/* Nenhuma das 76 tem orçamento SINAPI. O campo existe para não
                deixar o valor calibrado passar por executivo. */}
            <div className="ct-valor-validado">aguarda orçamento</div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--ct-text-muted)", lineHeight: 1.5 }}>
            Rota: {p.rota}
          </div>
        </div>
      </div>

      <div className="ct-gates">
        <div className="ct-row-wrap" style={{ gap: 10, alignItems: "center", marginBottom: 10 }}>
          <span className="ct-valor-rot">Gates</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: corDosGates(p.gatesOk) }}>
            {p.gatesOk} de 8 concluídos
          </span>
          <span style={{ flex: "1 1 60px" }} />
          <span style={{ fontSize: 12, color: "var(--ct-text-muted)" }}>
            Especificidade territorial {p.especificidade}
          </span>
        </div>
        <div className="ct-row-wrap" style={{ gap: 6 }}>
          {GATES.map((k) => {
            const c = CORES_GATE[p.gatesRaw[k]];
            return (
              <span
                key={k}
                className="ct-gate"
                style={{ background: c.bg, color: c.cor, border: `1px solid ${c.borda}` }}
              >
                {k}
              </span>
            );
          })}
        </div>
      </div>
    </article>
  );
}

// ============================ MUNICÍPIOS ==============================

function ListaMunicipios({ onAbrir }: { onAbrir: (id: string) => void }) {
  const munis = useMemo(() => municipiosOrdenados(), []);
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <TituloSecao
          overline="Os doze"
          titulo="Escolha o município"
          lede="A ficha municipal serve para o prefeito abrir sozinho, para projetar na reunião e para imprimir em uma folha."
        />
      </div>
      <div className="ct-row-wrap" style={{ gap: 12 }}>
        {munis.map((m) => (
          <button key={m.id} type="button" className="ct-muni-btn" onClick={() => onAbrir(m.id)}>
            <span className="ct-muni-nome">{m.nome}</span>
            <span className="ct-muni-meta">
              {m.nProp} oportunidades estruturadas · {m.valor}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Municipio({ ficha, onVoltar }: { ficha: FichaMunicipal; onVoltar: () => void }) {
  return (
    <div>
      <div className="ct-row-wrap no-print" style={{ gap: 10, alignItems: "center", marginBottom: 24 }}>
        <button type="button" className="ct-btn ct-btn-outline" onClick={onVoltar}>
          <ChevronLeft size={16} aria-hidden />
          Todos os municípios
        </button>
        <div style={{ flex: "1 1 20px" }} />
        <button type="button" className="ct-btn ct-btn-primario" onClick={() => window.print()}>
          <Printer size={16} aria-hidden />
          Imprimir uma página
        </button>
      </div>

      <section className="ct-hero" style={{ marginBottom: 28 }}>
        <p className="ct-hero-over">
          Entorno do Parque Nacional da Serra do Teixeira · atualizado em 31/08/2026
        </p>
        <h1 className="ct-hero-h1">{ficha.nome}</h1>
        <p className="ct-hero-frase">{ficha.frase}</p>
        <p className="ct-hero-decisao">Próxima decisão: {ficha.decisao}</p>
        <div className="ct-hero-stats">
          {ficha.heroStats.map((s) => (
            <div key={s.l}>
              <div className="ct-hero-stat-n">{s.v}</div>
              <div className="ct-hero-stat-l">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 18 }}>
          <TituloSecao
            overline="Leitura multidimensional"
            titulo="Onde este município é forte e onde não é"
          />
        </div>
        <div className="ct-row-wrap" style={{ gap: 10 }}>
          {ficha.dimensoes.map((d) => (
            <div key={d.k} className="ct-dim">
              <div className="ct-dim-k">{d.k}</div>
              <div className="ct-dim-v" style={{ color: d.cor }}>{d.v}</div>
            </div>
          ))}
        </div>
        {/*
          A pendência é nominal e vem da base do TransfereGov. Some da tela
          quando `mostrarPendencias` é falso — a leitura acima já sinaliza a
          situação sem expor o registro específico numa projeção em reunião.
        */}
        {ficha.pend ? (
          <p style={{ marginTop: 12, maxWidth: "66ch", fontSize: 13, color: "var(--ct-text-muted)", lineHeight: 1.6 }}>
            Registro no TransfereGov: {ficha.pend} Bloqueia a celebração, não o cadastro.
          </p>
        ) : null}
      </section>

      <section style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 18 }}>
          <TituloSecao overline="O que está sobre a mesa" titulo={ficha.tituloProp} />
        </div>
        <div className="ct-col-flex" style={{ gap: 10 }}>
          {ficha.propostas.map((p) => (
            <div key={p.id} className="ct-muni-prop">
              <div className="ct-row-wrap" style={{ gap: 14, alignItems: "flex-start" }}>
                <div className="ct-col" style={{ flex: "1 1 320px" }}>
                  <div style={{ marginBottom: 8 }}>
                    <Selo tom={p.estadoTone} solido>{p.estado}</Selo>
                  </div>
                  <h3 className="ct-muni-prop-t">{p.titulo}</h3>
                  <p className="ct-muni-prop-e">{p.evidencia}</p>
                </div>
                <div style={{ flex: "0 0 160px", textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em" }}>{p.valor}</div>
                  <div className="ct-col-l" style={{ fontSize: 12 }}>{p.programaCurto}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: p.gatesCor }}>{p.gatesTxt}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div style={{ marginBottom: 18 }}>
          <TituloSecao overline="Combinado nesta reunião" titulo={ficha.planoTitulo} />
        </div>
        <div className="ct-row-wrap" style={{ gap: 16 }}>
          {ficha.plano.map((b) => (
            <div key={b.bloco} className="ct-plano-card" style={{ borderColor: b.borda }}>
              <p className="ct-plano-bloco" style={{ color: b.cor }}>{b.bloco}</p>
              <ol className="ct-plano-itens">
                {b.itens.map((i) => <li key={i}>{i}</li>)}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================ ARTICULAÇÃO ==============================

function Articulacao() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <TituloSecao
          overline="Mapa de articulação"
          titulo="O que estamos pedindo, a quem"
          lede="Hugo Motta tem 33 convênios no território, mas o último é de 2019. De 2023 em diante a captação migrou para emenda de comissão."
        />
      </div>

      <div className="ct-row-wrap" style={{ gap: 16, marginBottom: 32 }}>
        {SERIE_COMISSAO.map((s) => (
          <Cartao key={s.ano} style={{ flex: "1 1 180px" }}>
            <div style={{ fontSize: 12, color: "var(--ct-text-muted)" }}>{s.ano}</div>
            <div style={{ marginTop: 2, fontSize: 28, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.1 }}>
              {s.v}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--ct-text-secondary)" }}>{s.l}</div>
          </Cartao>
        ))}
      </div>

      <section className="ct-peca" style={{ marginBottom: 32 }}>
        <p className="ct-peca-over">Peça de reunião</p>
        <h2 className="ct-h2-grande" style={{ margin: "6px 0 16px" }}>
          CDR — Carteira Serra do Teixeira
        </h2>
        <div className="ct-row-wrap" style={{ gap: "24px 40px", marginBottom: 16 }}>
          {CDR.map((c) => (
            <div key={c.l}>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.1 }}>{c.v}</div>
              <div style={{ fontSize: 12, color: "var(--ct-text-secondary)" }}>{c.l}</div>
            </div>
          ))}
        </div>
        <p style={{ maxWidth: "66ch", fontSize: 15, lineHeight: 1.6, color: "var(--ct-ink-100)", textWrap: "pretty" }}>
          A Paraíba tem assento: Efraim Filho é titular da Comissão de Desenvolvimento Regional e
          Turismo. A ata de 09/12/2025 registra Catingueira com R$ 570 mil de emenda RP8 da
          própria CDR, na ação 00SX — o mesmo caminho que os demais onze municípios ainda não
          percorreram.
        </p>
      </section>

      <h2 className="ct-h2" style={{ marginBottom: 14 }}>Objeto, ação, comissão, município</h2>
      <div className="ct-col-flex" style={{ gap: 8, marginBottom: 32 }}>
        {INDICACOES.map((i) => (
          <div key={i.objeto} className="ct-linha" style={{ padding: "16px 18px" }}>
            <div className="ct-col" style={{ flex: "1 1 260px" }}>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{i.objeto}</div>
              <div className="ct-col-l" style={{ fontSize: 12 }}>Ação {i.acao} · {i.comissao}</div>
            </div>
            <div style={{ flex: "0 0 160px", fontSize: 13, color: "var(--ct-text-secondary)" }}>{i.municipios}</div>
            <div style={{ flex: "0 0 110px", fontSize: 15, fontWeight: 600 }}>{i.valor}</div>
            <div style={{ flex: "0 0 150px" }}><Selo tom={i.tone}>{i.status}</Selo></div>
          </div>
        ))}
      </div>

      <h2 className="ct-h2" style={{ marginBottom: 14 }}>Quem converte no território</h2>
      <div className="ct-col-flex" style={{ gap: 8 }}>
        {PARLAMENTARES.map((p) => (
          <div key={p.nome} className="ct-linha" style={{ padding: "14px 18px" }}>
            <div className="ct-col" style={{ flex: "1 1 240px" }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{p.nome}</div>
              <div className="ct-col-l" style={{ fontSize: 12 }}>
                {p.tipo} · {p.mun} municípios · {p.periodo}
              </div>
            </div>
            <div style={{ flex: "0 0 130px", fontSize: 13, color: "var(--ct-text-secondary)" }}>
              {p.props} / {p.conv} convênios
            </div>
            <div style={{ flex: "0 0 120px", fontSize: 15, fontWeight: 600 }}>{p.valor}</div>
            <div style={{ flex: "0 0 120px" }}><Selo tom={p.tone}>{p.estado}</Selo></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================ DILIGÊNCIAS ==============================

function Diligencias() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <TituloSecao
          overline="Execução"
          titulo="Diligências e SLA"
          lede="O território não perde propostas por mérito. Perde por abandono: 225 ficaram em rascunho e 38 estão paradas em complementação desde 2024."
        />
      </div>

      <div className="ct-row-wrap" style={{ gap: 16, marginBottom: 28 }}>
        {DILIG_KPIS.map((k) => (
          <Cartao key={k.l} style={{ flex: "1 1 220px" }}>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.1, color: k.cor }}>
              {k.v}
            </div>
            <div className="ct-kpi-l">{k.l}</div>
          </Cartao>
        ))}
      </div>

      <h2 className="ct-h2" style={{ marginBottom: 14 }}>Fila aberta</h2>
      <div className="ct-col-flex" style={{ gap: 10, marginBottom: 32 }}>
        {DILIGENCIAS.map((d) => (
          <div key={d.t} className="ct-dilig" style={{ border: `1px solid ${d.borda}` }}>
            <div className="ct-dilig-dias">
              <div className="ct-dilig-n" style={{ color: d.cor }}>{d.dias}</div>
              <div className="ct-dilig-u">dias</div>
            </div>
            <div className="ct-col" style={{ flex: "1 1 300px" }}>
              <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>{d.t}</div>
              <div style={{ marginTop: 2, fontSize: 13, color: "var(--ct-text-secondary)", lineHeight: 1.5 }}>
                Documento pendente: {d.doc} · responsável: {d.resp}
              </div>
            </div>
            <div style={{ flex: "0 0 150px" }}>
              <Selo tom={d.tone} solido={d.solido}>{d.estado}</Selo>
            </div>
          </div>
        ))}
      </div>

      {/*
        A ressalva é parte do dado, não rodapé. 89,7% é associação medida sobre
        quem CHEGOU à complementação — há viés de seleção, e a tela diz isso em
        vez de deixar o número ser lido como probabilidade de aprovação.
      */}
      <div className="ct-ressalva">
        <div style={{ marginBottom: 12 }}><Selo tom="warning">Leitura com ressalva</Selo></div>
        <p style={{ marginBottom: 10, fontSize: 16, color: "var(--ct-ink-100)", textWrap: "pretty" }}>
          Historicamente, chegar à complementação está fortemente associado à conversão: 89,7% das
          propostas que passaram por PROPOSTA_EM_COMPLEMENTACAO viraram convênio, e 100% das que
          passaram por PLANO_TRABALHO_EM_COMPLEMENTACAO.
        </p>
        <p style={{ fontSize: 14, color: "var(--ct-text-secondary)" }}>
          Não é uma probabilidade de aprovação. Há viés de seleção: propostas mais promissoras são
          justamente as que chegam à fase em que o concedente pede complementação. A associação é
          operacionalmente útil sem precisar virar causalidade.
        </p>
      </div>
    </div>
  );
}

// ============================ INTELIGÊNCIA ==============================

function Inteligencia() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <TituloSecao
          overline="Inteligência"
          titulo="O que sustenta as decisões da frente"
          lede="Histórico, taxas, anatomia da proposta que converte, assimetrias federativas e metodologia. Os dados explicam as decisões; não ocupam o lugar delas."
        />
      </div>

      <section style={{ marginBottom: 36 }}>
        <h2 className="ct-h2" style={{ marginBottom: 6 }}>White space institucional</h2>
        <p className="ct-nota" style={{ marginBottom: 14 }}>
          Não é uma oportunidade comum, medida pelo histórico municipal. É uma assimetria regional
          ainda não explorada — e o score convencional pune exatamente isso.
        </p>
        <div className="ct-row-wrap" style={{ gap: 16, marginBottom: 14 }}>
          {WHITESPACE.map((w) => (
            <div key={w.k} className="ct-ws">
              <div style={{ fontSize: 12, color: "var(--ct-text-muted)" }}>{w.k}</div>
              <div style={{ marginTop: 4, fontSize: 17, fontWeight: 600, letterSpacing: "-.01em", color: w.cor }}>
                {w.v}
              </div>
            </div>
          ))}
        </div>
        <div className="ct-col-flex" style={{ gap: 6 }}>
          {CODEVASF_UF.map((u) => (
            <div
              key={u.uf}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                background: "var(--ct-card)", border: `1px solid ${u.borda}`,
                borderRadius: "var(--ct-r-sm)", padding: "11px 16px",
              }}
            >
              <span style={{ flex: "0 0 40px", fontSize: 14, fontWeight: 600 }}>{u.uf}</span>
              <span style={{ flex: "1 1 auto", minWidth: 60 }}>
                <span className="ct-barra-trilho">
                  <span className="ct-barra-preenchida" style={{ background: u.cor, width: u.barW }} />
                </span>
              </span>
              <span style={{ flex: "0 0 150px", fontSize: 13, color: "var(--ct-text-secondary)", textAlign: "right" }}>
                {u.mun} municípios atendidos
              </span>
              <span style={{ flex: "0 0 120px", fontSize: 13, fontWeight: 600, textAlign: "right" }}>{u.valor}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 className="ct-h2" style={{ marginBottom: 6 }}>Anatomia da proposta que converte</h2>
        <p className="ct-nota" style={{ marginBottom: 14 }}>
          Medido sobre 105 propostas paraibanas na trilha de emenda e 415 na voluntária. É o padrão
          que a Carteira Executiva replica.
        </p>
        <div className="ct-col-flex" style={{ gap: 6 }}>
          {ANATOMIA.map((a) => (
            <div key={a.k} className="ct-anat">
              <span style={{ flex: "1 1 220px", minWidth: 0, fontSize: 14, fontWeight: 500 }}>{a.k}</span>
              <span style={{ flex: "0 0 150px", fontSize: 13, color: "var(--ct-violet-500)" }}>{a.emenda}</span>
              <span style={{ flex: "0 0 150px", fontSize: 13, color: "var(--ct-blue-400)" }}>{a.voluntaria}</span>
              <span style={{ flex: "1 1 200px", fontSize: 12, color: "var(--ct-text-muted)" }}>{a.leitura}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 className="ct-h2" style={{ marginBottom: 6 }}>Rotas em prospecção</h2>
        <p className="ct-nota" style={{ marginBottom: 14 }}>
          A Carteira Executiva Ciclo 1 não é o universo final. Estas rotas ainda precisam virar
          objetos concretos.
        </p>
        <div className="ct-row-wrap" style={{ gap: 12 }}>
          {PROSPECCAO.map((p) => (
            <div key={p.t} className="ct-prospec">
              <div style={{ marginBottom: 10 }}><Selo tom="violet">{p.prioridade}</Selo></div>
              <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35, letterSpacing: "-.01em" }}>{p.t}</div>
              <p style={{ marginTop: 6, fontSize: 13, color: "var(--ct-text-secondary)", lineHeight: 1.55 }}>{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="ct-h2" style={{ marginBottom: 6 }}>O PARNA como diferencial de mérito</h2>
        <p style={{ marginBottom: 14, maxWidth: "66ch", fontSize: 15, color: "var(--ct-ink-100)", lineHeight: 1.6, textWrap: "pretty" }}>
          O parque não é um parágrafo de abertura repetido em 76 propostas. É uma cadeia causal que
          precisa aterrissar no objeto concreto de cada uma.
        </p>
        <div className="ct-row-wrap" style={{ gap: 8, alignItems: "center", marginBottom: 24 }}>
          {CADEIA.map((c) => <span key={c} className="ct-elo">{c}</span>)}
        </div>
        <div className="ct-row-wrap" style={{ gap: 12 }}>
          {TESE.map((t) => (
            <div key={t.t} className="ct-prospec" style={{ borderColor: "var(--ct-border-subtle)", padding: "18px 20px" }}>
              <div style={{ marginBottom: 8 }}><Selo tom={t.tone}>{t.selo}</Selo></div>
              <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>{t.t}</div>
              <p style={{ marginTop: 5, fontSize: 13, color: "var(--ct-text-secondary)", lineHeight: 1.55 }}>{t.d}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 18, maxWidth: "70ch", fontSize: 13, color: "var(--ct-text-muted)", lineHeight: 1.6 }}>
          Zona Franca Agroecológica da Serra do Teixeira é o nome da estratégia territorial, não um
          regime tributário. O total da carteira é valor calibrado, não orçamento executivo: cada
          valor precisa de orçamento SINAPI antes da submissão.
        </p>
      </section>
    </div>
  );
}
