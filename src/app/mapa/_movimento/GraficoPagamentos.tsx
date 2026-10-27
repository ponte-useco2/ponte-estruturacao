"use client";

/**
 * Os pagamentos do convênio mês a mês (onda 16, M2): colunas que crescem em cascata com mola e uma dica que segue a
 * coluna escolhida (passar o mouse, tocar ou o foco do teclado). A dica entra e sai com `AnimatePresence`.
 *
 * Acessível sem o desenho: cada coluna é um botão com o mês e o valor no nome, e a tabela com os mesmos números fica
 * para o leitor de tela (`pa-sr`). A altura final vem do servidor no estilo; o movimento é só `scaleY`, de 0 a 1, então
 * no papel a coluna aparece parada na altura certa.
 */
import { AnimatePresence, m } from "framer-motion";
import { useState } from "react";
import { MOLA, atrasoDaCascata } from "@/lib/oportunidades/molas";
import type { PagamentoDoMes } from "@/lib/oportunidades/pagina-instrumento";
import { Movimento } from "./Movimento";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const lancamentos = (n: number) => (n > 0 ? ` · ${n.toLocaleString("pt-BR")} ${n > 1 ? "lançamentos" : "lançamento"}` : "");

export function GraficoPagamentos({ meses, titulo }: { meses: readonly PagamentoDoMes[]; titulo: string }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const maximo = Math.max(0, ...meses.map((x) => x.valor));
  if (!meses.length || maximo <= 0) return null;
  const escolhido = ativo === null ? null : (meses[ativo] ?? null);
  return (
    <Movimento>
      <figure className="mp-graf">
        <figcaption className="pa-mono mp-graf-titulo">{titulo}</figcaption>
        <div className="mp-graf-area" onPointerLeave={() => setAtivo(null)}>
          <AnimatePresence>
            {escolhido && (
              <m.p
                key="dica"
                className="mp-graf-dica"
                aria-hidden="true"
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={MOLA.firme}
              >
                <strong>{escolhido.rotulo}</strong> · {moeda(escolhido.valor)}
                {lancamentos(escolhido.lancamentos)}
              </m.p>
            )}
          </AnimatePresence>
          <div className="mp-graf-colunas" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0.55rem, 1fr))` }}>
            {meses.map((x, i) => (
              <button
                key={x.mes}
                type="button"
                className="mp-graf-coluna"
                aria-label={`${x.rotulo}: ${moeda(x.valor)}${lancamentos(x.lancamentos)}`}
                onPointerEnter={() => setAtivo(i)}
                onFocus={() => setAtivo(i)}
                onBlur={() => setAtivo(null)}
                onClick={() => setAtivo(ativo === i ? null : i)}
              >
                <m.span
                  className={x.valor === 0 ? "mp-graf-barra mp-graf-vazio" : "mp-graf-barra"}
                  data-mp-mov=""
                  style={{ height: `${x.valor > 0 ? Math.max(2, (x.valor / maximo) * 100) : 0}%`, originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ ...MOLA.barra, delay: atrasoDaCascata(i, 0.025, 24) }}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="pa-mono mp-graf-eixo" aria-hidden="true">
          <span>{meses[0].rotulo}</span>
          <span>{meses[meses.length - 1].rotulo}</span>
        </div>
        <table className="pa-sr">
          <caption>{titulo}</caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Pago</th>
              <th scope="col">Lançamentos</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((x) => (
              <tr key={x.mes}>
                <th scope="row">{x.rotulo}</th>
                <td>{moeda(x.valor)}</td>
                <td>{x.lancamentos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </Movimento>
  );
}
