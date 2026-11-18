import type { Metadata } from "next";
import Link from "next/link";
import { AUTOAVALIACAO_PNTP, FONTES_OFICIAIS, ROTULO_SITUACAO_PNTP, datasDasFontes } from "@/lib/oportunidades/emendas-publico";
import { lerExecucaoPublica } from "@/lib/oportunidades/emendas-publico.server";
import { LinkFora } from "../../mapa/_componentes/LinkFora";
import { TabelaRolagem } from "../../mapa/_componentes/TabelaRolagem";
import { Cabeca } from "../_componentes/Pecas";

export const metadata: Metadata = {
  title: "Método e PNTP",
  description:
    "De onde vem cada dado do portal das emendas federais na Paraíba, com que frequência é atualizado, as definições, as limitações e a autoavaliação pela matriz do PNTP 2026, sem selo.",
};

const ELOS = [{ rotulo: "Método e PNTP" }] as const;

/**
 * O método (17/11/2026): as fontes, a periodicidade, as definições, as limitações e a autoavaliação item por item pela
 * matriz do PNTP 2026 (critério, o que o portal faz, atende/em parte/não se aplica), sem selo.
 */
export default async function Metodo() {
  const l = await lerExecucaoPublica();
  const e = l.estado === "ok" ? l.execucao : null;
  const datas = e ? datasDasFontes(e) : [];
  const fonteDe = (k: string) => datas.find((d) => d.chave === k)?.texto ?? "data não informada";
  return (
    <div className="pa-pilha-larga">
      <Cabeca elos={ELOS} kicker="Emendas federais na Paraíba" titulo="Método e autoavaliação pelo PNTP" execucao={e}>
        <p className="pa-sub">De onde vem cada número, o que cada palavra quer dizer, o que o portal não mostra e como ele se compara à matriz do PNTP.</p>
      </Cabeca>

      <section className="em-secao" aria-labelledby="em-fontes">
        <h2 id="em-fontes">Fontes e periodicidade</h2>
        <div className="em-texto">
          <ul>
            <li>
              <strong>Portal da Transparência (CGU)</strong> — o arquivo de emendas parlamentares (o catálogo: autor, tipo, número, localidade,
              função, ação e a execução orçamentária) e os pagamentos a favorecidos ({fonteDe("portal")}).{" "}
              <LinkFora href={FONTES_OFICIAIS.portalDownload}>Arquivo oficial</LinkFora>.
            </li>
            <li>
              <strong>Transferegov</strong> — os convênios e contratos de repasse (SICONV) com emenda: número, concedente, objeto, vigência,
              situação, repasse e desembolso ({fonteDe("convenio")}); e as transferências especiais: o plano de ação, a área e o pago (
              {fonteDe("especial")}).
            </li>
            <li>
              <strong>Fundo Nacional de Saúde</strong> — as propostas fundo a fundo com emenda: o tipo da proposta, o recurso, a situação e os
              pagamentos ({fonteDe("fns")}).
            </li>
            <li>
              <strong>Periodicidade:</strong> a PONTE relê as fontes toda semana. A data de cada fonte aparece nas páginas e nos arquivos.
            </li>
          </ul>
        </div>
      </section>

      <section className="em-secao" aria-labelledby="em-definicoes">
        <h2 id="em-definicoes">Definições</h2>
        <div className="em-texto">
          <ul>
            <li>
              <strong>Emenda:</strong> identificada pelo código de 12 dígitos do Portal (ano, código do autor e número), nunca pelo nome.
            </li>
            <li>
              <strong>Linha (registro):</strong> a emenda × a forma de repasse × o instrumento (o convênio, o plano de ação, a proposta do FNS
              ou o favorecido de um ano). A mesma emenda pode ter várias linhas.
            </li>
            <li>
              <strong>Forma de repasse:</strong> convênio ou contrato de repasse; transferência especial (o “Pix”); fundo a fundo da saúde;
              pagamento direto ao favorecido (o que o Portal registra como pago a um CNPJ, quando nenhum dos outros caminhos já o mostra).
            </li>
            <li>
              <strong>Previsto:</strong> o valor indicado pelo autor para aquele destino. O pagamento direto ao favorecido não tem previsto: o
              Portal só traz o pago. O previsto inclui o que não foi adiante (proposta anulada, rejeitada ou não assinada): use o filtro de
              situação para separar.
            </li>
            <li>
              <strong>Realizado (pago):</strong> no convênio, o desembolsado na parte da emenda (a parte da emenda no repasse); na transferência
              especial, o pago; no FNS, o pago na parte da emenda; no pagamento direto, o recebido no ano.
            </li>
            <li>
              <strong>Execução orçamentária (catálogo):</strong> empenhado, liquidado, pago e restos a pagar do Portal. Pago total = pago no
              exercício + restos a pagar pagos. Os restos a pagar inscritos não se somam (cada reinscrição repete o mesmo saldo). É o mesmo
              dinheiro visto do orçamento: nunca se soma aos valores por forma de repasse.
            </li>
            <li>
              <strong>Emenda “Nacional” ou “Múltiplo”:</strong> o catálogo traz o valor do Brasil inteiro; o portal mostra só as linhas com a
              Paraíba na localidade e, do resto, só o nome da localidade.
            </li>
            <li>
              <strong>Cada real uma vez:</strong> quando o pagamento direto e outra forma de repasse mostram o mesmo dinheiro (o repasse de
              um convênio, por exemplo), a linha do pagamento direto fica fora das somas e da lista.
            </li>
            <li>
              <strong>Proposta não assinada até 31/12 do ano seguinte:</strong> a proposta de convênio com emenda que nunca foi assinada até
              31 de dezembro do ano seguinte ao da emenda. É um fato do calendário, não um juízo.
            </li>
            <li>
              <strong>Tipo da emenda:</strong> o texto do Portal. Sem ele (emenda que não está no arquivo do Portal, quase toda antes de
              2019), o tipo vem do autor e da forma de repasse, e a linha diz isso.
            </li>
            <li>
              <strong>Autoria coletiva:</strong> bancada, comissão e relator-geral. O dado aberto não diz quem indicou cada destino.
            </li>
          </ul>
        </div>
      </section>

      <section className="em-secao" aria-labelledby="em-limites">
        <h2 id="em-limites">Limitações</h2>
        <div className="em-texto">
          <ul>
            <li>O portal mostra só emendas federais. As estaduais e as municipais (critério 17.2) ficam para uma etapa seguinte.</li>
            <li>
              O arquivo de emendas do Portal começa em 2014. Os convênios com emenda de 2010 a 2013 aparecem pelo Transferegov, sem a
              execução orçamentária do catálogo.
            </li>
            <li>
              Linhas do Portal sem o código de 12 dígitos (emendas antigas, “S/N”) não entram, porque não há como ligá-las aos caminhos do
              dinheiro.
            </li>
            <li>
              Propostas do FNS ainda sem o detalhe do autor aparecem no município, sem código de emenda
              {e && e.fnsPendentes > 0 ? ` (${e.fnsPendentes.toLocaleString("pt-BR")} na leitura atual)` : ""}.
            </li>
            <li>
              O convênio e o plano de ação da transferência especial abrem direto no Transferegov, e a proposta do FNS na consulta do
              Fundo Nacional de Saúde. Quando o número não abre direto, o portal leva à consulta pública e escreve o número ao lado. A
              emenda abre no Portal da Transparência.
            </li>
            <li>
              Pessoa física aparece só somada, por emenda e ano. O nome do microempreendedor individual é omitido (a razão social traz o nome
              da pessoa); o CNPJ e os valores ficam. O empresário individual cuja razão social não começa pelo número do CNPJ não é
              reconhecido pela regra: a base não traz a natureza jurídica do favorecido.
            </li>
            <li>A data de cada fonte é a da última leitura da PONTE; a fonte pode ter mudado depois.</li>
          </ul>
        </div>
      </section>

      <section className="em-secao" aria-labelledby="em-pntp">
        <h2 id="em-pntp">Autoavaliação pela matriz do PNTP 2026</h2>
        <p className="pa-nota">
          O Programa Nacional de Transparência Pública (Atricon e tribunais de contas) avalia os portais dos entes públicos. A PONTE não é
          ente público: este portal não é avaliado pelo programa e não tem selo. A matriz 2026 é a régua de qualidade que o portal escolheu, e
          a autoavaliação abaixo é da PONTE. <LinkFora href={FONTES_OFICIAIS.pntp}>Sobre o PNTP</LinkFora>.
        </p>
        <TabelaRolagem rotuloId="em-pntp">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Critério</th>
                <th scope="col">O que pede</th>
                <th scope="col">O que o portal faz</th>
                <th scope="col">Autoavaliação</th>
              </tr>
            </thead>
            <tbody>
              {AUTOAVALIACAO_PNTP.map((i) => (
                <tr key={i.criterio}>
                  <th scope="row">{i.criterio}</th>
                  <td>{i.exige}</td>
                  <td>{i.faz}</td>
                  <td>{ROTULO_SITUACAO_PNTP[i.situacao]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
        <p className="em-data">
          Também: <Link href="/emendas/perguntas">perguntas frequentes</Link>, <Link href="/emendas/acessibilidade">acessibilidade</Link> e{" "}
          <Link href="/privacidade">política de privacidade</Link>.
        </p>
      </section>
    </div>
  );
}
