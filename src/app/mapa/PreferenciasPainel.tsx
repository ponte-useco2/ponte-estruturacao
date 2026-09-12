"use client";

/**
 * "O que você prefere acompanhar" — o seletor das preferências.
 *
 * Três regras vêm da decisão de privacidade de 11/09/2026, e a tela precisa
 * cumpri-las para o aviso continuar verdadeiro:
 *
 *  1. Nada vem marcado. Sem escolha, nada é guardado e nada é destacado.
 *  2. O efeito é imediato, sem botão "Salvar". Marcar é consentir; desmarcar é
 *     revogar, e revogar não pode depender de um segundo clique em outro lugar.
 *  3. A nota fica AQUI, ao lado do seletor, e não só na política.
 *
 * A forma veio da revisão de design de 12/09/2026:
 *  · fechado, o painel é UMA linha — as escolhas como etiquetas e "Alterar";
 *  · aberto, uma busca cobre as 32 opções de uma vez, o que já está marcado
 *    aparece numa fileira própria, e cada grupo mostra as opções de maior
 *    cobertura, recolhendo o resto atrás de "Mostrar os outros N";
 *  · a contagem de janelas fica em toda opção, e a ressalva explica por que
 *    tantos temas têm zero — senão o zero parece defeito.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Preferencias } from "@/lib/oportunidades/aderencia";
import type { OpcaoContada, OpcoesPreferencia } from "@/lib/oportunidades/opcoes";
import type { ResumoCatalogo } from "@/lib/oportunidades/central";

export type Eixo = "temas" | "orgaos" | "naturezas";

const GRUPOS: { eixo: Eixo; titulo: string }[] = [
  { eixo: "temas", titulo: "Temas" },
  { eixo: "orgaos", titulo: "Órgãos" },
  { eixo: "naturezas", titulo: "Quem pode se candidatar" },
];

/** Quantas opções cada coluna mostra antes de "Mostrar os outros N". */
const VISIVEIS_POR_COLUNA = 6;

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function PreferenciasPainel({
  preferencias,
  opcoes,
  resumo,
  salvando,
  onAlternar,
  onLimpar,
}: {
  preferencias: Preferencias;
  opcoes: OpcoesPreferencia;
  resumo: ResumoCatalogo | null;
  salvando: boolean;
  onAlternar: (eixo: Eixo, valor: string, marcado: boolean, rotulo: string) => void;
  onLimpar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [expandidas, setExpandidas] = useState<ReadonlySet<Eixo>>(() => new Set<Eixo>());

  const total = opcoes.temas.length + opcoes.orgaos.length + opcoes.naturezas.length;
  const marcadas = useMemo(
    () =>
      GRUPOS.flatMap(({ eixo }) =>
        preferencias[eixo]
          .map((valor) => {
            const o = opcoes[eixo].find((x) => x.valor === valor);
            return o ? { eixo, ...o } : null;
          })
          .filter((x): x is { eixo: Eixo } & OpcaoContada => x !== null),
      ),
    [preferencias, opcoes],
  );

  if (!aberto) {
    return (
      <button
        type="button"
        className="pa-cartao pa-mapa-prefs-linha"
        aria-expanded={false}
        onClick={() => setAberto(true)}
      >
        <span className="pa-mono">O que você prefere acompanhar</span>
        {marcadas.length === 0 ? (
          <span className="pa-mono">nada marcado — marcar destaca janelas, não esconde nenhuma</span>
        ) : (
          <span className="pa-linha pa-mapa-marcadas">
            {marcadas.map((m) => (
              <span key={`${m.eixo}-${m.valor}`} className="pa-tag pa-tag-aderente">
                {m.rotulo}
              </span>
            ))}
          </span>
        )}
        <span className="pa-espaco" />
        <span className="pa-mapa-prefs-alterar">Alterar ▾</span>
      </button>
    );
  }

  const filtro = semAcento(busca.trim());

  return (
    <section className="pa-cartao pa-pilha pa-mapa-prefs-abertas" aria-label="O que você prefere acompanhar">
      <div className="pa-linha">
        <h2 className="pa-mapa-prefs-titulo">O que você prefere acompanhar</h2>
        <span className="pa-mono">
          {marcadas.length} de {total} marcadas · vale na hora, não há salvar
        </span>
        <span className="pa-espaco" />
        {marcadas.length > 0 && (
          <button type="button" className="pa-btn pa-btn-pequeno" aria-disabled={salvando} onClick={onLimpar}>
            Desmarcar tudo
          </button>
        )}
        <button type="button" className="pa-btn pa-btn-pequeno" aria-expanded onClick={() => setAberto(false)}>
          Fechar ▴
        </button>
      </div>

      <div className="pa-mapa-prefs-topo">
        <div className="pa-pilha">
          <div className="pa-campo">
            <label className="pa-campo-rotulo" htmlFor="mapa-busca-pref">
              Buscar entre {opcoes.temas.length} temas, {opcoes.orgaos.length} órgãos e {opcoes.naturezas.length} tipos
              de instituição
            </label>
            <input
              id="mapa-busca-pref"
              className="pa-input"
              type="search"
              value={busca}
              placeholder="Digite para filtrar — ex.: turismo, cidades, consórcio"
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {marcadas.length > 0 && (
            <div className="pa-linha pa-mapa-marcadas">
              <span className="pa-mono">Marcadas</span>
              {marcadas.map((m) => (
                <button
                  key={`${m.eixo}-${m.valor}`}
                  type="button"
                  className="pa-tag pa-tag-aderente pa-mapa-marcada"
                  aria-disabled={salvando}
                  onClick={() => onAlternar(m.eixo, m.valor, false, m.rotulo)}
                >
                  {m.rotulo} · {m.janelas} <span aria-hidden="true">✕</span>
                  <span className="pa-sr">Remover {m.rotulo}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="pa-nota">
          Guardamos o que você marcar aqui, ligado à sua conta, só para destacar janelas. Desmarcar apaga.{" "}
          <Link href="/privacidade">Política de privacidade</Link>
        </p>
      </div>

      <div className="pa-grade pa-grade-3">
        {GRUPOS.map(({ eixo, titulo }) => {
          const lista: OpcaoContada[] = opcoes[eixo];
          const escolhidos = preferencias[eixo];

          // Subtema fica guardado atrás do pai: as verticais de fomento da Finep
          // — subvenção econômica, bioeconomia, descarbonização — só aparecem
          // com Inovação marcado. Sem isso a coluna teria 29 caixas de uma vez,
          // e as verticais só fazem sentido para quem já decidiu que quer
          // inovação. A BUSCA também as revela, para quem sabe o que procura
          // chegar lá sem marcar o pai antes.
          const disponiveis = filtro
            ? lista
            : lista.filter(
                (o) =>
                  o.pai === undefined ||
                  escolhidos.includes(o.pai) ||
                  // Vertical marcada continua à vista mesmo se o pai for
                  // desmarcado depois: escolha guardada que some da tela é
                  // estado invisível, e estado invisível ninguém desfaz.
                  escolhidos.includes(o.valor),
              );

          const casaram = filtro
            ? disponiveis.filter((o) => semAcento(o.rotulo).includes(filtro))
            : expandidas.has(eixo)
              ? disponiveis
              : disponiveis.slice(0, VISIVEIS_POR_COLUNA);
          const restantes = filtro ? 0 : disponiveis.length - casaram.length;

          return (
            <fieldset key={eixo} className="pa-fieldset pa-mapa-col">
              <legend className="pa-campo-rotulo">
                {titulo} <span className="pa-mono">{disponiveis.length}</span>
              </legend>

              {casaram.length === 0 && <span className="pa-mono">Nada com esse nome aqui.</span>}

              {casaram.map((o) => {
                const marcado = escolhidos.includes(o.valor);
                return (
                  <label
                    key={o.valor}
                    className={`pa-check pa-mapa-opcao${o.pai === undefined ? "" : " pa-mapa-subtema"}`}
                  >
                    <span className="pa-mapa-opcao-nome">
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={salvando}
                        onChange={() => onAlternar(eixo, o.valor, !marcado, o.rotulo)}
                      />
                      <span>{o.rotulo}</span>
                    </span>
                    {/* A contagem é do catálogo de hoje: opção com zero não vai
                        destacar nada, e é honesto mostrar isso antes da escolha. */}
                    <span className="pa-mono">
                      <span className="pa-sr">, </span>
                      {o.janelas}
                    </span>
                  </label>
                );
              })}

              {restantes > 0 && (
                <button
                  type="button"
                  className="pa-btn pa-btn-pequeno pa-mapa-mostrar-resto"
                  onClick={() => setExpandidas((a) => new Set([...a, eixo]))}
                >
                  Mostrar os outros {restantes}
                </button>
              )}
            </fieldset>
          );
        })}
      </div>

      {resumo && resumo.semTema > 0 && (
        <span className="pa-ressalva">
          {resumo.semTema} das {resumo.total} janelas não têm tema declarado na fonte. Marcar tema destaca o que
          combina — nunca esconde o resto.
        </span>
      )}
    </section>
  );
}
