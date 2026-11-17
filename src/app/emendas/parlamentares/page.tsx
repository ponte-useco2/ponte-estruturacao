import type { Metadata } from "next";
import Link from "next/link";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import {
  COLUNAS_AUTORES,
  ROTULO_TIPO_AUTOR_PUBLICO,
  inteiro,
  moeda,
  separarAutores,
  urlParlamentarPublico,
  valoresDoAutor,
  type AutorPublico,
} from "@/lib/oportunidades/emendas-publico";
import { lerAutores } from "@/lib/oportunidades/emendas-publico.server";
import { TabelaFiltravel } from "../../mapa/_componentes/TabelaFiltravel";
import { Cabeca, Indisponivel, SemDadoPublicado } from "../_componentes/Pecas";

export const metadata: Metadata = {
  title: "Parlamentares, bancadas e comissões",
  description:
    "Os autores de emendas federais com destino à Paraíba, em ordem alfabética: deputados e senadores, e à parte a autoria coletiva (bancada, comissão e relator-geral), com o previsto e o pago de cada um.",
};

const ELOS = [{ rotulo: "Parlamentares" }] as const;

function linhas(autores: readonly AutorPublico[]): LinhaTabela[] {
  return autores.map((a) => ({
    chave: a.codigo,
    valores: valoresDoAutor(a),
    celulas: {
      nome: (
        <>
          <Link prefetch={false} href={urlParlamentarPublico(a.codigo)} className="mp-tabela-principal">
            {a.nome ?? `Autor ${a.codigo}`}
          </Link>
          <span className="em-secundario em-codigo">código {a.codigo}</span>
        </>
      ),
      tipo: ROTULO_TIPO_AUTOR_PUBLICO[a.tipo] ?? a.tipo,
      emendas: inteiro(a.emendas),
      municipios: inteiro(a.municipios),
      previsto: moeda(a.previsto),
      pago: moeda(a.pago),
    },
  }));
}

/**
 * Os autores (17/11/2026): os individuais em ordem alfabética e, à parte, a autoria coletiva (bancada, comissão e
 * relator-geral), que não tem "padrinho". Sem posição nem ranking: quem quiser ordena por valor.
 */
export default async function Parlamentares() {
  const l = await lerAutores();
  if (l.estado === "sem_dado") return <SemDadoPublicado elos={ELOS} titulo="Parlamentares, bancadas e comissões" />;
  if (l.estado !== "ok") return <Indisponivel elos={ELOS} titulo="Parlamentares, bancadas e comissões" endereco="/emendas/parlamentares" />;
  const { individuais, coletivos } = separarAutores(l.autores);

  return (
    <div className="pa-pilha-larga">
      <Cabeca elos={ELOS} kicker="Emendas federais na Paraíba" titulo="Parlamentares, bancadas e comissões" execucao={l.execucao}>
        <p className="pa-sub">
          Quem é autor de emenda federal com registro na Paraíba, em ordem alfabética. O nome é o publicado para o código do autor (o código
          é do mandato: a mesma pessoa pode ter dois, como deputado e depois como senador). Parlamentar, bancada e comissão são agentes
          públicos. Os valores são os dos caminhos do dinheiro com destino na Paraíba.
        </p>
      </Cabeca>

      <section className="em-secao" aria-labelledby="em-individuais">
        <h2 id="em-individuais">Deputados e senadores ({inteiro(individuais.length)})</h2>
        <TabelaFiltravel
          id="individuais"
          rotulo="Deputados e senadores autores de emendas com registro na Paraíba"
          colunas={COLUNAS_AUTORES}
          linhas={linhas(individuais)}
          descricaoOrdemPadrao="alfabética, pelo nome"
          csv={{ nome: "emendas-pb-autores-individuais" }}
          empilhar
        />
      </section>

      <section className="em-secao" aria-labelledby="em-coletivos">
        <h2 id="em-coletivos">Autoria coletiva: bancada, comissão e relator-geral ({inteiro(coletivos.length)})</h2>
        <p className="pa-nota">Na autoria coletiva, o dado aberto não identifica quem indicou cada destino.</p>
        <TabelaFiltravel
          id="coletivos"
          rotulo="Autoria coletiva com registro na Paraíba"
          colunas={COLUNAS_AUTORES}
          linhas={linhas(coletivos)}
          descricaoOrdemPadrao="alfabética, pelo nome"
          csv={{ nome: "emendas-pb-autoria-coletiva" }}
          empilhar
        />
      </section>
    </div>
  );
}
