/**
 * Peças do painel usadas pelas visões e pela ficha do município: cartão, lista e a tabela das mudanças. Só desenham o
 * que recebem. As tabelas de convênio de cada visão estão em `TabelasConvenio.tsx` (onda 15, fase 3, F3.2).
 */
import type { ReactNode } from "react";
import {
  definicaoMudanca,
  descreverMudanca,
  diaDoDado,
  urlFicha,
  type MudancaPainel,
} from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { Tag } from "../../_design/primitivos";
import { CopiarNumero } from "./CopiarNumero";
import { LinkMapa } from "../_componentes/LinkMapa";
import { TabelaRolagem } from "../_componentes/TabelaRolagem";

export const n = (x: number) => x.toLocaleString("pt-BR");

export function Cartao({
  rotulo,
  quantidade,
  valor,
  legenda,
  nota,
  tom,
}: {
  rotulo: string;
  quantidade: number;
  valor?: number | null;
  legenda?: string;
  nota?: ReactNode;
  tom?: "urgente";
}) {
  return (
    <article className={`pa-cartao mp-painel-cartao${tom === "urgente" ? " mp-painel-cartao-urgente" : ""}`}>
      <h3 className="pa-mono">{rotulo}</h3>
      <p className="pa-numero">{n(quantidade)}</p>
      {valor !== undefined && (
        <p className="mp-painel-valor">
          {moedaCurta(valor)}
          {legenda ? ` ${legenda}` : ""}
        </p>
      )}
      {nota && <p className="pa-nota">{nota}</p>}
    </article>
  );
}

export function Lista({
  titulo,
  vazio,
  children,
  csv,
  semRolagem = false,
}: {
  titulo: string;
  /**
   * O que aparece quando a lista não tem linha. B14b (08/10/2026): pode levar links (`Saidas`), para dizer o
   * recorte e como mudá-lo; o texto vai dentro de um parágrafo, então só cabe conteúdo em linha.
   */
  vazio: ReactNode;
  children: ReactNode;
  /** Endereço do CSV com todos os convênios da lista, não só os mostrados. */
  csv?: string;
  /**
   * Onda 15, fase 2, lote C (13/10/2026): o filho já traz a própria caixa que rola (a `TabelaFiltravel`, que tem a
   * `TabelaRolagem` dentro e a barra de filtro acima dela). Sem isto, a tabela ficaria em duas caixas de rolagem.
   */
  semRolagem?: boolean;
}) {
  return (
    <div className="mp-radar-recorte">
      <div className="mp-painel-lista-cabeca">
        <h3 className="mp-radar-h3">{titulo}</h3>
        {csv && children ? <BotaoCsv href={csv} /> : null}
      </div>
      {children ? (
        semRolagem ? (
          children
        ) : (
          <TabelaRolagem rotulo={titulo}>{children}</TabelaRolagem>
        )
      ) : (
        <p className="pa-cartao pa-cartao-plano">{vazio}</p>
      )}
    </div>
  );
}

/** Uma saída de estado vazio: o link que muda o recorte, com verbo no rótulo ("Ver o Brasil inteiro"). */
export interface Saida {
  rotulo: string;
  href: string;
}

/**
 * As saídas de um estado vazio das telas do administrador, em linha e separadas por " · " (B14b, 08/10/2026).
 * Antes o vazio dizia "Nenhum … neste recorte" sem dizer qual nem como mudar (B12, seção 5). Vai no fim do
 * parágrafo do vazio; sem saída, não desenha nada. Links repetidos (mesmo destino) aparecem uma vez.
 */
export function Saidas({ saidas }: { saidas: Saida[] }) {
  const unicas = saidas.filter((s, k) => saidas.findIndex((x) => x.href === s.href) === k);
  if (!unicas.length) return null;
  return (
    <>
      {" "}
      {unicas.map((s, k) => (
        <span key={s.href}>
          {k > 0 && " · "}
          <LinkMapa href={s.href}>{s.rotulo}</LinkMapa>
        </span>
      ))}
    </>
  );
}

/** Link comum para a rota de exportação: o navegador baixa o arquivo. */
// B14b (08/10/2026): o rótulo padrão diz o que baixa; o CSV traz todos os convênios da lista, não só os mostrados.
export function BotaoCsv({ href, rotulo = "Baixar todos os convênios (CSV)" }: { href: string; rotulo?: string }) {
  return (
    <a href={href} className="pa-btn pa-btn-pequeno mp-painel-csv" download>
      {rotulo}
    </a>
  );
}

/**
 * O sinal de urgência do painel: a marca ▲ e a palavra, dentro do `mp-painel-urgente` (onda 8, C, 09/10/2026; N09 da
 * auditoria R1, WCAG 1.4.1 e 1.3.1). Antes, "mais lento que o Brasil", "parado há mais de um ano", o prazo curto e o
 * físico zerado eram só o vermelho e o negrito: quem não distingue a cor, o papel em preto e branco e o leitor de tela
 * perdiam o destaque. A marca fica fora da leitura em voz alta; a palavra é lida. Na célula de número, a palavra desce
 * para a linha de baixo (mapa.css), e o número continua alinhado com os outros.
 */
export function Urgente({ palavra }: { palavra: string }) {
  return (
    <span className="mp-urgente-marca">
      <span aria-hidden="true">▲ </span>
      {palavra}
    </span>
  );
}

/** A palavra do sinal de prazo (suspensiva e vigência): "vencido" depois do dia, "prazo curto" até ele. */
export function palavraDoPrazo(dias: number | null | undefined): string {
  return (dias ?? 0) < 0 ? "vencido" : "prazo curto";
}

const TOM_GRUPO = { avanco: "aderente", alerta: "urgente", registro: "neutro" } as const;

/** O que mudou, uma linha por evento. Com `comData`, a coluna do dia (períodos de mais de um dia). */
export function TabelaMudancas({ linhas, naFicha, comData }: { linhas: MudancaPainel[]; naFicha?: boolean; comData?: boolean }) {
  return (
    <table className="mp-tabela mp-painel-mudancas">
      <thead>
        <tr>
          <th scope="col">Quem</th>
          <th scope="col">O que mudou</th>
          <th scope="col">Programa e objeto</th>
          <th scope="col" className="mp-num">Valor</th>
          {comData && <th scope="col">Dado de</th>}
        </tr>
      </thead>
      <tbody>
        {linhas.map((m) => {
          const def = definicaoMudanca(m.tipo);
          const lugar = `${m.municipio ?? "—"}/${m.uf ?? "—"}`;
          const frase = descreverMudanca(m);
          return (
            <tr key={`${m.dado_ate}-${m.tipo}-${m.chave}`}>
              <th scope="row">
                <span className="mp-tabela-principal">{m.proponente ?? "—"}</span>
                <span className="mp-tabela-secundario">
                  {!naFicha && m.cod_ibge ? <LinkMapa href={urlFicha({ ibge: m.cod_ibge })}>{lugar}</LinkMapa> : lugar} ·{" "}
                  {m.alvo === "proposta" ? "proposta" : "convênio"} nº {m.numero ?? m.chave}{" "}
                  {m.numero && <CopiarNumero numero={m.numero} />}
                </span>
              </th>
              <td>
                <Tag tom={TOM_GRUPO[def.grupo]}>{def.rotulo}</Tag>
                {frase && <span className="mp-tabela-secundario">{frase}</span>}
              </td>
              <td>
                <span className="mp-tabela-principal mp-painel-programa">{m.programa ?? "—"}</span>
                <span className="mp-tabela-secundario">{m.orgao_sup ?? "—"}</span>
                {m.objeto && <span className="mp-tabela-secundario mp-painel-objeto">{m.objeto}</span>}
              </td>
              <td className="mp-num">{moedaCurta(m.valor)}</td>
              {comData && <td>{diaDoDado(m.dado_ate)}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
