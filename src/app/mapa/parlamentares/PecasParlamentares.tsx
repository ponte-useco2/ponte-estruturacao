/**
 * Peças comuns à lista dos autores e à ficha do autor (onda 14, parte 2, B, 13/10/2026): o carimbo da data do dado,
 * a nota de método, a célula de dois valores (válido e pago) e a tela de "ainda não publicado". Só desenham o que
 * recebem; a leitura mora em `emendas.server.ts` (agente A).
 */
import type { ReactNode } from "react";
import { avisoFnsPendente, datasDaExecucao, type ExecucaoEmendas } from "@/lib/oportunidades/emendas";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { LinkMapa } from "../_componentes/LinkMapa";
import "./parlamentares.css";

export const n = (x: number) => x.toLocaleString("pt-BR");

/** Dinheiro na tabela: zero e ausente viram "—", para a coluna vazia não parecer um valor. */
export function dinheiro(v: number | null | undefined): string {
  return v !== null && v !== undefined && v > 0 ? moedaCurta(v) : "—";
}

/** A célula de dois valores: o válido em cima e o pago embaixo. Sem nenhum dos dois, "—". */
export function CelulaValidoPago({ valido, pago, rotulo }: { valido: number; pago: number; rotulo?: string }) {
  if (!(valido > 0) && !(pago > 0)) {
    return (
      <td className="mp-num" data-rotulo={rotulo}>
        —
      </td>
    );
  }
  return (
    <td className="mp-num" data-rotulo={rotulo}>
      <span className="mp-tabela-principal">{dinheiro(valido)}</span>
      <span className="mp-tabela-secundario">pago {dinheiro(pago)}</span>
    </td>
  );
}

/**
 * A data do dado, sempre à vista: o arquivo do Portal (Last-Modified do zip), o dia em que a rodada concluiu e, enquanto
 * a carga histórica do FNS corre, quantas propostas ainda estão sem o detalhe (contam no município, não no autor).
 */
export function CarimboDoDado({ execucao }: { execucao: ExecucaoEmendas }) {
  const datas = datasDaExecucao(execucao);
  const fns = avisoFnsPendente(execucao);
  return (
    <p className="pa-nota mp-parl-carimbo">
      Arquivo de emendas do Portal da Transparência de <strong>{datas.dadoAte}</strong>; rodada concluída em {datas.rodouEm}.{" "}
      {fns ? <strong>{fns}</strong> : "Todas as propostas da saúde fundo a fundo (FNS) já têm o detalhe do autor."}
    </p>
  );
}

/** As três regras de método que toda tela dos parlamentares repete, em lista curta. */
export function NotaDeMetodo({ titulo = "Como ler", id }: { titulo?: string; id: string }) {
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
      </h2>
      <ul className="pa-nota mp-parl-lista">
        <li>
          <strong>Catálogo e canal nunca se somam.</strong> O catálogo do Portal (empenhado e pago da emenda) e os canais (convênio, Pix,
          saúde fundo a fundo e pago ao favorecido) são o mesmo dinheiro visto de dois lugares. As colunas daqui são dos canais, que dizem
          o destino. O catálogo só aparece com a PB na localidade, porque a emenda “Múltiplo” ou “Nacional” traz o valor do Brasil
          inteiro.
        </li>
        <li>
          <strong>Coletivo não tem padrinho.</strong> Bancada, comissão e relator-geral são autoria coletiva: o dado aberto não diz quem
          indicou cada destino, e nenhuma pessoa é ligada a eles.
        </li>
        <li>
          <strong>Valor por habitante é soma ÷ soma.</strong> O valor dos municípios atendidos dividido pela população deles somada, e
          nunca a média das razões, que daria peso de cidade grande a uma obra única num município de 3 mil habitantes.
        </li>
        <li>
          <strong>Sem posição, sem nota.</strong> A lista vai por tipo e nome. Execução só se compara na mesma safra (o ano da emenda) e
          no mesmo canal, e depende também do município, da entidade e do órgão. O que chama a atenção é ponto para olhar, nunca
          irregularidade.
        </li>
      </ul>
    </section>
  );
}

/** As emendas ainda não chegaram ao banco (a primeira rodada não concluiu): diz isso e aponta a saúde das rodadas. */
export function SemEmendasPublicadas({ kicker, voltar }: { kicker: string; voltar?: { rotulo: string; href: string } }) {
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">{kicker}</p>
        <h1 className="pa-titulo">As emendas ainda não foram publicadas</h1>
        <p>
          O job das emendas parlamentares ainda não concluiu a primeira rodada, ou a tabela ainda não está no banco. Quando a rodada
          concluir, esta página mostra os autores, os canais e o destino na Paraíba.
        </p>
        <p className="pa-linha">
          <LinkMapa href="/mapa/painel/rodadas" className="pa-btn pa-btn-pequeno">
            Ver a saúde das rodadas
          </LinkMapa>
          {voltar && (
            <LinkMapa href={voltar.href} className="pa-btn pa-btn-pequeno">
              {voltar.rotulo}
            </LinkMapa>
          )}
        </p>
      </div>
    </div>
  );
}

/** Um cartão de número com rótulo e nota (o `pa-cartao` do Mapa). */
export function CartaoNumero({ titulo, numero, nota }: { titulo: string; numero: string; nota: ReactNode }) {
  return (
    <article className="pa-cartao">
      <h3 className="pa-mono">{titulo}</h3>
      <p className="pa-numero">{numero}</p>
      <p className="pa-nota">{nota}</p>
    </article>
  );
}
