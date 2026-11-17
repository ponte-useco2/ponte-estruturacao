import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AVISO_DE_DOMINIO } from "@/lib/oportunidades/emendas-publico";
import { Cabeca } from "../_componentes/Pecas";

export const metadata: Metadata = {
  title: "Perguntas frequentes",
  description: "Perguntas frequentes sobre o portal das emendas parlamentares federais com destino à Paraíba: o que é, de onde vem o dado e como ler os números.",
};

const ELOS = [{ rotulo: "Perguntas frequentes" }] as const;

const PERGUNTAS: readonly { pergunta: string; resposta: ReactNode }[] = [
  {
    pergunta: "O que é este portal?",
    resposta: (
      <p>
        Uma leitura organizada, só de consulta, das emendas parlamentares federais com destino à Paraíba, a partir de dados públicos oficiais
        (Portal da Transparência, Transferegov e Fundo Nacional de Saúde). É mantido pela PONTE Estruturação de Projetos de Impacto.
      </p>
    ),
  },
  {
    pergunta: "Este portal substitui o portal de transparência do meu município?",
    resposta: (
      <p>
        Não. Cada município, o estado e a União têm o próprio portal e a obrigação de divulgar as emendas que recebem. Este portal serve de
        referência e de conferência, e não é avaliado pelo Programa Nacional de Transparência Pública (usa a matriz dele só como régua de
        qualidade).
      </p>
    ),
  },
  {
    pergunta: "O que é uma emenda parlamentar?",
    resposta: (
      <p>
        É a parte do Orçamento da União que deputados, senadores, bancadas e comissões indicam para um destino: um município, um fundo, o
        estado ou uma entidade. Pode ser individual (com finalidade definida ou por transferência especial), de bancada, de comissão ou de
        relator-geral.
      </p>
    ),
  },
  {
    pergunta: "Por que a mesma emenda aparece em várias linhas?",
    resposta: (
      <p>
        Porque uma emenda pode ir para vários destinos e por caminhos diferentes. Cada linha é uma emenda, uma forma de repasse e um
        instrumento (um convênio, um plano de ação, uma proposta do Fundo Nacional de Saúde ou um favorecido). As somas contam cada real uma
        vez.
      </p>
    ),
  },
  {
    pergunta: "Qual a diferença entre previsto e realizado?",
    resposta: (
      <p>
        Previsto é o que o autor indicou para aquele destino. Realizado é o que foi pago (no convênio, o desembolsado na parte da emenda).
        O pagamento direto ao favorecido só tem o realizado. O previsto também inclui indicações que não foram adiante; a coluna Situação
        mostra em que pé cada uma está.
      </p>
    ),
  },
  {
    pergunta: "O que quer dizer “transferência especial”?",
    resposta: (
      <p>
        É a emenda individual que vai direto ao caixa do município ou do estado, sem convênio, conhecida como “emenda Pix”. O portal mostra o
        plano de ação, a área e o que foi pago.
      </p>
    ),
  },
  {
    pergunta: "Por que algumas emendas aparecem com valores diferentes do Portal da Transparência?",
    resposta: (
      <p>
        O Portal mostra a execução orçamentária da emenda inteira, que pode ser de vários estados (“Nacional” ou “Múltiplo”). Aqui entra só a
        parte com destino na Paraíba. Na ficha de cada emenda, a execução orçamentária do Portal aparece à parte, só nas linhas com a Paraíba.
      </p>
    ),
  },
  {
    pergunta: "O que é “Proposta não assinada até 31/12 do ano seguinte”?",
    resposta: (
      <p>
        É a proposta de convênio com emenda que não foi assinada até 31 de dezembro do ano seguinte ao da emenda. É um fato do calendário,
        sem juízo sobre quem deu causa.
      </p>
    ),
  },
  {
    pergunta: "Por que não aparece o nome de algumas empresas ou pessoas?",
    resposta: (
      <p>
        Pessoa física aparece só somada, por emenda e ano, sem nome e sem documento. O microempreendedor individual tem o nome da pessoa na
        razão social; por isso aparece como “Microempreendedor individual (nome omitido)”, com o CNPJ e os valores.
      </p>
    ),
  },
  {
    pergunta: "Com que frequência o dado é atualizado?",
    resposta: <p>Toda semana. Cada página e cada arquivo dizem a data do dado.</p>,
  },
  {
    pergunta: "Posso baixar os dados?",
    resposta: (
      <p>
        Sim, sem cadastro, em CSV e JSON: um arquivo por ano da emenda, o arquivo completo ou o recorte que você filtrou. Ver <Link href="/emendas/dados">Dados abertos</Link>, com o
        dicionário, a licença e como citar.
      </p>
    ),
  },
  {
    pergunta: "Encontrei um erro. O que faço?",
    resposta: (
      <p>
        Confira primeiro na fonte oficial (cada ficha tem o link). Se a diferença for daqui, escreva para diretoria.ponte.projetos@gmail.com
        com o código da emenda e o que está diferente.
      </p>
    ),
  },
];

/** As perguntas frequentes (2.7; 17/11/2026). */
export default function Perguntas() {
  return (
    <div className="pa-pilha-larga">
      <Cabeca elos={ELOS} kicker="Emendas federais na Paraíba" titulo="Perguntas frequentes" />
      <aside aria-label="Endereço oficial do portal" className="pa-cartao">
        <p>
          <strong>{AVISO_DE_DOMINIO}</strong>
        </p>
      </aside>
      <div className="em-texto">
        {PERGUNTAS.map((p, i) => (
          <section key={p.pergunta} aria-labelledby={`em-p-${i}`} className="em-secao">
            <h2 id={`em-p-${i}`}>{p.pergunta}</h2>
            {p.resposta}
          </section>
        ))}
      </div>
    </div>
  );
}
