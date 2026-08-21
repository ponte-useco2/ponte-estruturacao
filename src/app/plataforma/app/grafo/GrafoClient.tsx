"use client";

/**
 * O Grafo (wireframe 1k).
 *
 * Nota do wireframe respeitada em duas decisões:
 *  - o grafo só é legível com filtro por tipo de nó, então o filtro vem antes
 *    do desenho e desligar um tipo apaga também as arestas que dependem dele;
 *  - para quem não lê bem, a leitura em áudio do nó selecionado substitui o
 *    diagrama — aqui é a Web Speech API do próprio navegador, não promessa.
 *
 * Os nós são botões de verdade dentro do SVG: navegáveis por Tab e acionáveis
 * por Enter/Espaço, como o grafo da página pública já é.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSessaoObrigatoria } from "../_lib/sessao";
import { ARESTAS_GRAFO, NOS_GRAFO, TIPOS_NO, relacoesDoNo } from "../_lib/fixtures";
import type { TipoNo } from "../_lib/tipos";
import { useFala } from "../_lib/fala";
import { Tag } from "../_componentes/primitivos";

const BASE = "/plataforma/app";

/** Área de desenho em coordenadas de viewBox; as posições das fixtures são %. */
const L = 1000;
const A = 620;
/** Margem vertical para o nó de topo e o de base não encostarem na borda. */
const MARGEM = 26;
const paraY = (pct: number) => MARGEM + (pct / 100) * (A - MARGEM * 2);

export function GrafoClient() {
  const sessao = useSessaoObrigatoria();
  const [ligados, setLigados] = useState<TipoNo[]>(() => TIPOS_NO.map((t) => t.id));
  const [selecionado, setSelecionado] = useState<string>("n-projeto");
  const { disponivel, falando, falar, parar } = useFala();

  const nos = useMemo(() => NOS_GRAFO.filter((n) => ligados.includes(n.tipo)), [ligados]);
  const visiveis = useMemo(() => new Set(nos.map((n) => n.id)), [nos]);
  const arestas = useMemo(
    () => ARESTAS_GRAFO.filter((a) => visiveis.has(a.de) && visiveis.has(a.para)),
    [visiveis],
  );

  const no = NOS_GRAFO.find((n) => n.id === selecionado);
  const relacoes = no ? relacoesDoNo(no.id) : [];
  const rotuloTipo = (t: TipoNo) => TIPOS_NO.find((x) => x.id === t)?.rotulo ?? t;

  function alternarTipo(t: TipoNo) {
    setLigados((atual) => (atual.includes(t) ? atual.filter((x) => x !== t) : [...atual, t]));
  }

  function ouvir() {
    if (!no) return;
    if (falando) {
      parar();
      return;
    }
    const texto = [
      `${rotuloTipo(no.tipo)}: ${no.rotulo}.`,
      no.detalhe,
      relacoes.length
        ? `Relações: ${relacoes.map((r) => `${r.relacao} ${r.outro.rotulo}`).join("; ")}.`
        : "Sem relações registradas.",
    ].join(" ");
    falar(texto);
  }

  if (!sessao) {
    return (
      <div className="pa-pagina">
        <p className="pa-mono">Carregando sessão do protótipo…</p>
      </div>
    );
  }

  return (
    <div className="pa-pagina pa-grafo">
      <section className="pa-pilha">
        <div>
          <p className="pa-kicker">O grafo de formação de projetos</p>
          <h1 className="pa-titulo">Cada projeto deixa inteligência para o próximo</h1>
          <p className="pa-sub">
            Arestas são relações registradas durante a execução — território, problema, ativos,
            organizações, capacidades, capital, projeto, execução, evidência e resultado.
          </p>
        </div>

        <div className="pa-chips">
          <span className="pa-mono">Mostrar:</span>
          {TIPOS_NO.map((t) => (
            <button
              key={t.id}
              type="button"
              className="pa-chip"
              aria-pressed={ligados.includes(t.id)}
              onClick={() => alternarTipo(t.id)}
            >
              {t.rotulo}
            </button>
          ))}
          <button
            type="button"
            className="pa-btn pa-btn-pequeno"
            onClick={() => setLigados(TIPOS_NO.map((t) => t.id))}
          >
            Mostrar tudo
          </button>
        </div>

        <div className="pa-grafo-tela">
          <svg
            viewBox={`0 0 ${L} ${A}`}
            role="group"
            aria-label="Diagrama de relações do Projeto em Formação PJF-0027"
            className="pa-grafo-svg"
          >
            <g>
              {arestas.map((a) => {
                const de = NOS_GRAFO.find((n) => n.id === a.de);
                const para = NOS_GRAFO.find((n) => n.id === a.para);
                if (!de || !para) return null;
                const ativa = a.de === selecionado || a.para === selecionado;
                return (
                  <line
                    key={`${a.de}-${a.para}`}
                    x1={(de.x / 100) * L}
                    y1={paraY(de.y)}
                    x2={(para.x / 100) * L}
                    y2={paraY(para.y)}
                    className={ativa ? "pa-aresta pa-aresta-ativa" : "pa-aresta"}
                  />
                );
              })}
            </g>

            {nos.map((n) => {
              const ativo = n.id === selecionado;
              const cx = (n.x / 100) * L;
              const cy = paraY(n.y);
              const largura = Math.max(120, n.rotulo.length * 8.4);
              return (
                <g
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={ativo}
                  aria-label={`${rotuloTipo(n.tipo)}: ${n.rotulo}`}
                  className={`pa-no${ativo ? " pa-no-ativo" : ""}`}
                  onClick={() => setSelecionado(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelecionado(n.id);
                    }
                  }}
                >
                  <rect
                    x={cx - largura / 2}
                    y={cy - 19}
                    width={largura}
                    height={38}
                    rx={19}
                  />
                  <text x={cx} y={cy + 5} textAnchor="middle">
                    {n.rotulo}
                  </text>
                </g>
              );
            })}
          </svg>

          {nos.length === 0 && (
            <p className="pa-mono pa-grafo-vazio">
              Nenhum tipo de nó ligado — o grafo fica ilegível assim, por isso a tela some junto.
            </p>
          )}
        </div>

        <span className="pa-mono">
          {nos.length} nós · {arestas.length} relações visíveis · use Tab para percorrer os nós
        </span>
      </section>

      <aside className="pa-pilha">
        {no ? (
          <>
            <div className="pa-cartao pa-pilha">
              <span className="pa-mono">Nó selecionado</span>
              <Tag tom="forte">{rotuloTipo(no.tipo)}</Tag>
              <h2 className="pa-cartao-titulo">{no.rotulo}</h2>
              <p>{no.detalhe}</p>
              {no.id === "n-projeto" && (
                <Link href={`${BASE}/projeto/PJF-0027`} className="pa-btn pa-btn-pequeno">
                  Abrir ficha do PJF-0027
                </Link>
              )}
            </div>

            <div className="pa-cartao pa-pilha">
              <span className="pa-mono">Relações ({relacoes.length})</span>
              <ul className="pa-pilha">
                {relacoes.map((r) => (
                  <li key={`${r.relacao}-${r.outro.id}`}>
                    <button
                      type="button"
                      className="pa-relacao"
                      onClick={() => setSelecionado(r.outro.id)}
                    >
                      <span className="pa-mono">{r.relacao}</span> {r.outro.rotulo}
                    </button>
                  </li>
                ))}
                {relacoes.length === 0 && <li className="pa-mono">Sem relações registradas.</li>}
              </ul>
            </div>

            <div className="pa-cartao-plano pa-pilha">
              {disponivel ? (
                <button type="button" className="pa-btn" onClick={ouvir}>
                  {falando ? "Parar leitura" : "Ouvir a explicação deste nó"}
                </button>
              ) : (
                <span className="pa-mono">
                  Este navegador não oferece leitura em voz alta — o texto acima é a versão completa.
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="pa-tracejado pa-vazio">
            <span className="pa-mono">Selecione um nó</span>
          </div>
        )}

        <div className="pa-tracejado pa-pilha">
          <span className="pa-mono">Visão de futuro</span>
          <p>
            Com histórico suficiente, essas relações poderão sustentar modelos de aderência,
            composição e desempenho. Ainda não sustentam — este grafo tem um projeto.
          </p>
        </div>
      </aside>
    </div>
  );
}
