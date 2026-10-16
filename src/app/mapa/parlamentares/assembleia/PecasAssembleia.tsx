/**
 * Peças comuns às telas das emendas estaduais (E2, 16/10/2026): o aviso, a data do dado, a nota de método e a tela de
 * "ainda não publicado". Só desenham o que recebem; a leitura mora em `emendas-pb.server.ts`.
 */
import { anosLidosTexto, type ExecucaoEpb } from "@/lib/oportunidades/emendas-pb";
import { dataHoraBrasilia } from "@/lib/oportunidades/rodadas";
import { LinkMapa } from "../../_componentes/LinkMapa";
import "../parlamentares.css";

export const AVISO_ASSEMBLEIA =
  "Uso interno da PONTE, só administrador até a revisão jurídica. Deputado estadual é agente público, com o nome como a API " +
  "publica e a pessoa pela tabela curada da PONTE. Os servidores do caminho (quem enviou, quem deu o parecer) aparecem só aqui. " +
  "Nenhuma pessoa física credora aparece: ela é só somada.";

/** A data do dado, sempre à vista: a leitura da API (que não informa a data do próprio dado) e os anos lidos. */
export function CarimboEpb({ execucao }: { execucao: ExecucaoEpb }) {
  return (
    <p className="pa-nota mp-parl-carimbo">
      API de dados abertos do Governo da Paraíba lida em <strong>{dataHoraBrasilia(execucao.dadoAte ?? execucao.concluidaEm)}</strong>{" "}
      (emendas de {anosLidosTexto(execucao)}). A rodada é semanal, às terças; a API não informa a data do próprio dado.
    </p>
  );
}

/** As regras de leitura que toda tela das emendas estaduais repete. */
export function NotaDeMetodoEpb({ id }: { id: string }) {
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        Como ler
      </h2>
      <ul className="pa-nota mp-parl-lista">
        <li>
          <strong>Catálogo e empenho nunca se somam.</strong> O catálogo (valor, empenhado e pago da emenda, na execução orçamentária) e o
          empenho (credor e município) são o mesmo dinheiro visto de dois lugares. O destino vem do empenho; a execução, do catálogo.
        </li>
        <li>
          <strong>O destino depende da modalidade.</strong> Na transferência a municípios, o credor é a prefeitura ou o fundo, e o município
          dele é o atendido. Na transferência a entidade sem fins lucrativos, o município é a sede da entidade. Na aplicação direta, o
          credor é fornecedor do Estado, e o município dele não é destino da emenda.
        </li>
        <li>
          <strong>O caminho.</strong> Envio à SEPLAG → parecer técnico → secretário da SEPLAG → cronograma da SEFAZ → secretário da SEFAZ →
          empenho pelo órgão executor → pagamento. “Empenhada” quer dizer empenhada e ainda não paga por inteiro. A “vez” só aparece
          quando o dado diz: há a data do último passo e o seguinte está vazio.
        </li>
        <li>
          <strong>Devolução</strong> é a palavra “devol…” num parecer do caminho: a emenda voltou em algum passo, e o texto do parecer
          está na página da emenda.
        </li>
        <li>
          <strong>Sem posição, sem nota.</strong> A lista abre por nome. Execução só se compara na mesma safra (o ano da emenda) e depende
          também do município, da entidade, da secretaria e da SEFAZ. O que chama a atenção é ponto para olhar, nunca irregularidade.
        </li>
      </ul>
    </section>
  );
}

/** As emendas estaduais ainda não chegaram ao banco. */
export function SemEpbPublicadas({ kicker }: { kicker: string }) {
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">{kicker}</p>
        <h1 className="pa-titulo">As emendas estaduais ainda não foram publicadas</h1>
        <p>
          O job das emendas da Assembleia ainda não concluiu a primeira rodada, ou a tabela ainda não está no banco. Quando a rodada
          concluir, esta página mostra os deputados, o caminho de cada emenda e o destino na Paraíba.
        </p>
        <p className="pa-linha">
          <LinkMapa href="/mapa/painel/rodadas" className="pa-btn pa-btn-pequeno">
            Ver a saúde das rodadas
          </LinkMapa>
          <LinkMapa href="/mapa/parlamentares" className="pa-btn pa-btn-pequeno">
            Ver as emendas federais
          </LinkMapa>
        </p>
      </div>
    </div>
  );
}
