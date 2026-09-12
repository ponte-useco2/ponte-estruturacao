"use client";

/**
 * "O que você prefere acompanhar" — o seletor das preferências.
 *
 * Três regras que vêm da decisão de privacidade de 11/09/2026, e que a tela
 * precisa cumprir para o aviso continuar verdadeiro:
 *
 *  1. Nada vem marcado. Sem escolha, nada é guardado e nada é destacado.
 *  2. O efeito é imediato, sem botão "Salvar". Marcar é consentir; desmarcar é
 *     revogar, e revogar não pode depender de um segundo clique em outro lugar.
 *  3. A nota fica AQUI, ao lado do seletor, e não só na política. Quem marca
 *     precisa saber o que acontece antes de marcar.
 *
 * O painel começa fechado: são dezenas de opções, e a lista de avisos é o que a
 * pessoa veio ver.
 */
import Link from "next/link";
import type { Preferencias } from "@/lib/oportunidades/aderencia";
import type { OpcaoContada, OpcoesPreferencia } from "@/lib/oportunidades/opcoes";

export type Eixo = "temas" | "orgaos" | "naturezas";

const GRUPOS: { eixo: Eixo; titulo: string }[] = [
  { eixo: "temas", titulo: "Temas" },
  { eixo: "orgaos", titulo: "Órgãos" },
  { eixo: "naturezas", titulo: "Quem pode se candidatar" },
];

export function PreferenciasPainel({
  preferencias,
  opcoes,
  salvando,
  onAlternar,
  onLimpar,
}: {
  preferencias: Preferencias;
  opcoes: OpcoesPreferencia;
  salvando: boolean;
  onAlternar: (eixo: Eixo, valor: string, marcado: boolean, rotulo: string) => void;
  onLimpar: () => void;
}) {
  const marcados = preferencias.temas.length + preferencias.orgaos.length + preferencias.naturezas.length;

  return (
    <details className="pa-cartao pa-mapa-prefs">
      <summary>
        <span>O que você prefere acompanhar</span>
        <span className="pa-chip-contagem">
          {marcados === 0 ? "nada marcado" : `${marcados} marcado${marcados > 1 ? "s" : ""}`}
        </span>
      </summary>

      <div className="pa-pilha">
        <p className="pa-nota">
          Guardamos o que você marcar aqui, ligado à sua conta, só para destacar janelas. Desmarcar apaga.{" "}
          <Link href="/privacidade">Política de privacidade</Link>
        </p>

        {GRUPOS.map(({ eixo, titulo }) => {
          const lista: OpcaoContada[] = opcoes[eixo];
          if (lista.length === 0) return null;
          const escolhidos = preferencias[eixo];

          return (
            <fieldset key={eixo} className="pa-fieldset">
              <legend className="pa-mono">{titulo}</legend>
              <div className="pa-chips">
                {lista.map((o) => {
                  const marcado = escolhidos.includes(o.valor);
                  return (
                    <label key={o.valor} className={`pa-chip${marcado ? " pa-ativo" : ""}`}>
                      <input
                        type="checkbox"
                        className="pa-sr"
                        checked={marcado}
                        disabled={salvando}
                        onChange={() => onAlternar(eixo, o.valor, !marcado, o.rotulo)}
                      />
                      {o.rotulo}
                      {/* A contagem é do catálogo de hoje: opção com zero não vai
                          destacar nada, e é honesto mostrar isso antes da escolha. */}
                      <span className="pa-chip-contagem">
                        <span className="pa-sr">, </span>
                        {o.janelas}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        {marcados > 0 && (
          <div className="pa-linha">
            <button type="button" className="pa-btn pa-btn-pequeno" aria-disabled={salvando} onClick={onLimpar}>
              Desmarcar tudo
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
