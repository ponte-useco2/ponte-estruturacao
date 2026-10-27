"use client";

/**
 * As empresas que receberam no convênio (onda 16, M2), **só para o administrador** (a página decide; D1). Cada cartão
 * abre ali mesmo o detalhe dos pagamentos àquela empresa: o cartão cresce com animação de layout (`layout`) e o
 * detalhe entra e sai com `AnimatePresence`. Do detalhe, "Abrir o fornecedor" desce à página dele (camada 6).
 *
 * O painel guarda, por empresa e convênio, o total pago, o número de pagamentos, o primeiro e o último: é isso que o
 * detalhe mostra (não há a ordem bancária uma a uma). A faixa do tempo vai do primeiro ao último pagamento à empresa,
 * dentro da janela de pagamentos do convênio inteiro.
 */
import { AnimatePresence, m } from "framer-motion";
import { useState } from "react";
import { MOLA, atrasoDaCascata } from "@/lib/oportunidades/molas";
import { LinkMapa } from "../_componentes/LinkMapa";
import { Movimento } from "./Movimento";

export interface EmpresaVista {
  cnpj: string;
  cnpjLegivel: string;
  nome: string;
  href: string;
  pago: string;
  fatia: number | null;
  nPagamentos: number;
  primeiro: string | null;
  ultimo: string | null;
  /** Posição do primeiro e do último pagamento na janela do convênio, de 0 a 1. */
  janela: [number, number] | null;
  contratado: string | null;
  nContratos: number;
}

export function EmpresasDaExecucao({ empresas }: { empresas: readonly EmpresaVista[] }) {
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <Movimento recursos="completo">
      <ul className="mp-empresas">
        {empresas.map((e, i) => {
          const aberto = aberta === e.cnpj;
          const idDetalhe = `mp-empresa-${e.cnpj}`;
          return (
            <m.li
              key={e.cnpj}
              layout="position"
              className={aberto ? "mp-empresa mp-empresa-aberta" : "mp-empresa"}
              data-mp-mov=""
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...MOLA.suave, delay: atrasoDaCascata(i) }}
            >
              <m.button
                type="button"
                className="mp-empresa-cabeca"
                aria-expanded={aberto}
                aria-controls={idDetalhe}
                onClick={() => setAberta(aberto ? null : e.cnpj)}
                whileTap={{ scale: 0.985 }}
              >
                <span className="mp-empresa-nome">
                  <strong>{e.nome}</strong>
                  <span className="pa-mono">{e.cnpjLegivel}</span>
                </span>
                <span className="mp-empresa-valor">
                  <strong>{e.pago}</strong>
                  {e.fatia !== null && <span className="pa-mono">{Math.round(e.fatia * 100)}% do pago a empresas</span>}
                </span>
                <span className="mp-empresa-seta" aria-hidden="true">
                  {aberto ? "−" : "+"}
                </span>
              </m.button>
              <AnimatePresence initial={false}>
                {aberto && (
                  <m.div
                    key="detalhe"
                    id={idDetalhe}
                    className="mp-empresa-detalhe"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={MOLA.suave}
                  >
                    <dl className="mp-instrumento-prazos">
                      <div>
                        <dt className="pa-mono">Pagamentos</dt>
                        <dd>{e.nPagamentos.toLocaleString("pt-BR")}</dd>
                      </div>
                      <div>
                        <dt className="pa-mono">Primeiro e último</dt>
                        <dd>{e.primeiro && e.ultimo ? `${e.primeiro} a ${e.ultimo}` : "—"}</dd>
                      </div>
                      <div>
                        <dt className="pa-mono">Contratos</dt>
                        <dd>{e.contratado ? `${e.nContratos.toLocaleString("pt-BR")} · ${e.contratado}` : e.nContratos.toLocaleString("pt-BR")}</dd>
                      </div>
                    </dl>
                    {e.janela && (
                      <div className="mp-empresa-janela" aria-hidden="true">
                        <m.span
                          className="mp-empresa-janela-faixa"
                          style={{ left: `${e.janela[0] * 100}%`, width: `${Math.max(1.5, (e.janela[1] - e.janela[0]) * 100)}%`, originX: 0 }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ ...MOLA.barra, delay: 0.1 }}
                        />
                      </div>
                    )}
                    <p className="pa-nota">
                      <LinkMapa href={e.href}>Abrir o fornecedor</LinkMapa> · todos os convênios, contratos e sanções da empresa
                    </p>
                  </m.div>
                )}
              </AnimatePresence>
            </m.li>
          );
        })}
      </ul>
    </Movimento>
  );
}
