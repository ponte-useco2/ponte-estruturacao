/**
 * "O caminho do recurso" (Ajuda do portal, 17/11/2026): os passos de uma emenda até o destino e o que cada forma de
 * repasse registra em cada passo, com "não se aplica" (o passo não existe naquele canal) e "não informado pela fonte"
 * (existe, mas a fonte que o portal lê não traz). É uma explicação, não um indicador: sem barra, sem cor de situação,
 * sem nota. Cada passo tem âncora; os "?" de previsto, empenhado, realizado e execução física apontam para cá.
 */
import type { ReactNode } from "react";
import { ANCORA_DO_CAMINHO, CANAIS_PUBLICOS, CANAL, NAO_INFORMADO, NAO_SE_APLICA, type CanalPublico } from "@/lib/oportunidades/emendas-recorte";

const nsa = <span className="aus">{NAO_SE_APLICA}</span>;
const nif = <span className="aus">{NAO_INFORMADO}</span>;

interface Passo {
  id: string;
  titulo: string;
  medida: string | null;
  texto: string;
  canais: Record<CanalPublico, ReactNode>;
}

const PASSOS: readonly Passo[] = [
  {
    id: ANCORA_DO_CAMINHO.previsto,
    titulo: "Indicação",
    medida: "previsto",
    texto: "A autoria (parlamentar, bancada, comissão ou relator) indica quanto da emenda vai para cada destino. No portal, esse valor é o previsto.",
    canais: {
      convenio: "O valor indicado para o convênio ou contrato de repasse, como o Transferegov registra.",
      especial: "O valor indicado para o plano de ação da transferência especial, no Transferegov.",
      saude: "O valor da proposta indicada no Fundo Nacional de Saúde.",
      direto: <>{nif}: o Portal da Transparência traz o que o favorecido recebeu, não a indicação por destino.</>,
    },
  },
  {
    id: ANCORA_DO_CAMINHO.empenhado,
    titulo: "Empenho",
    medida: "empenhado",
    texto: "O governo reserva o dinheiro no orçamento. No portal, esse valor é o empenhado, por destino, quando o canal registra.",
    canais: {
      convenio: "O empenho registrado no Transferegov para o convênio.",
      especial: "O empenho registrado no Transferegov para o plano de ação.",
      saude: <>{nif} por proposta: o empenho da emenda aparece só na execução orçamentária nacional, na ficha da emenda.</>,
      direto: <>{nif} por favorecido: o empenho da emenda aparece só na execução orçamentária nacional, na ficha da emenda.</>,
    },
  },
  {
    id: ANCORA_DO_CAMINHO.instrumento,
    titulo: "Instrumento",
    medida: null,
    texto: "O documento que liga o dinheiro ao destino e diz para que ele serve.",
    canais: {
      convenio: "O convênio ou contrato de repasse: número, concedente, vigência, valor global, repasse e contrapartida. Precisa ser assinado; a proposta não assinada até 31/12 do ano seguinte ao da emenda deixa de valer.",
      especial: "O plano de ação: número, área, custeio, investimento e fim da execução. Não há convênio.",
      saude: "A proposta no Fundo Nacional de Saúde: número e tipo de recurso.",
      direto: <>{nsa}: não há instrumento; o dinheiro vai direto ao favorecido.</>,
    },
  },
  {
    id: ANCORA_DO_CAMINHO.realizado,
    titulo: "Pagamento",
    medida: "realizado",
    texto: "O dinheiro sai da União. No portal, esse valor é o realizado, acumulado até a data de referência.",
    canais: {
      convenio: "O que a União desembolsou na conta do convênio.",
      especial: "O que foi pago ao estado ou ao município.",
      saude: "O que o fundo nacional pagou ao fundo de saúde.",
      direto: "O que o favorecido recebeu, com o ano do pagamento.",
    },
  },
  {
    id: ANCORA_DO_CAMINHO.fisico,
    titulo: "Execução física",
    medida: "execução física",
    texto: "Quanto da obra ou da entrega foi atestado. Pagamento não comprova a conclusão da obra nem a entrega do serviço.",
    canais: {
      convenio: "O percentual atestado no Transferegov, quando o convênio tem esse registro (nem todo convênio tem).",
      especial: nif,
      saude: nif,
      direto: <>{nsa}: não há instrumento a executar.</>,
    },
  },
  {
    id: ANCORA_DO_CAMINHO.contas,
    titulo: "Prestação de contas",
    medida: null,
    texto: "Quem recebeu mostra como usou o dinheiro, e o órgão que repassou analisa.",
    canais: {
      convenio: "A situação do convênio no Transferegov (\"Prestação de contas\", \"Concluído\") aparece na ficha de cada instrumento.",
      especial: <>{nif}: o portal não lê a prestação de contas do plano de ação.</>,
      saude: <>{nif}: a prestação de contas do fundo de saúde não está nas fontes do portal.</>,
      direto: <>{nif}: as fontes do portal não trazem prestação de contas do favorecido.</>,
    },
  },
];

export function CaminhoDoRecurso() {
  return (
    <section id="caminho-do-recurso" aria-labelledby="titulo-caminho" className="em-secao em-caminho" tabIndex={-1}>
      <h2 id="titulo-caminho">O caminho do recurso</h2>
      <p>
        Os passos de uma emenda até o destino, e o que cada forma de repasse registra em cada passo. Nem todo passo existe em toda forma de
        repasse (<span className="aus">{NAO_SE_APLICA}</span>), e nem toda fonte traz todo passo (<span className="aus">{NAO_INFORMADO}</span>).
        Esta lista explica as palavras do portal; ela não mede nem avalia nenhuma emenda.
      </p>
      <nav aria-label="Passos do caminho do recurso">
        <ol>
          {PASSOS.map((p) => (
            <li key={p.id}>
              <a href={`#${p.id}`}>{p.titulo}</a>
            </li>
          ))}
        </ol>
      </nav>
      <ol className="em-passos">
        {PASSOS.map((p, i) => (
          <li key={p.id}>
            <h3 id={p.id} tabIndex={-1}>
              {i + 1}. {p.titulo}
              {p.medida ? <span className="em-medida"> — no portal: {p.medida}</span> : null}
            </h3>
            <p>{p.texto}</p>
            <table className="em-tabela-caminho">
              <caption className="sr">O que cada forma de repasse registra no passo {p.titulo.toLowerCase()}</caption>
              <tbody>
                {CANAIS_PUBLICOS.map((c) => (
                  <tr key={c}>
                    <th scope="row">{CANAL[c].nome}</th>
                    <td>{p.canais[c]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ol>
    </section>
  );
}
