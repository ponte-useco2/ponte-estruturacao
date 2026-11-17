import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  ROTULO_FORMA,
  ROTULO_TIPO_AUTOR_PUBLICO,
  codigoAutorPublicoDaUrl,
  contagem,
  descreverConsulta,
  lerConsulta,
  parametrosDoEndereco,
  porFuncao,
  serieAnual,
  totalDePaginas,
  totalDoAgregado,
  urlComConsulta,
  type CanalEmenda,
} from "@/lib/oportunidades/emendas-publico";
import { lerAutor, lerAutores } from "@/lib/oportunidades/emendas-publico.server";
import { Cabeca, CartoesDaSoma, Indisponivel, SemDadoPublicado, SerieAnual, TabelaDeSoma } from "../../_componentes/Pecas";
import { TabelaDasLinhas } from "../../_componentes/TabelaDasLinhas";

type Props = {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** O título leva o nome publicado (da lista dos autores, guardada em cache). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = codigoAutorPublicoDaUrl((await params).codigo);
  if (!c) return { title: "Autor não encontrado", robots: { index: false, follow: true } };
  const l = await lerAutores();
  const a = l.estado === "ok" ? l.autores.find((x) => x.codigo === c) : undefined;
  return { title: a?.nome ? `${a.nome} (autor ${c})` : `Autor ${c}` };
}

/**
 * A ficha de um autor (17/11/2026): o que é, a série por ano e forma de repasse, as funções de governo e as linhas dele
 * (com filtro em cada coluna, paginação e o arquivo do recorte). Agente público: o nome é o publicado para o código.
 */
export default async function FichaDoAutor({ params, searchParams }: Props) {
  const codigo = codigoAutorPublicoDaUrl((await params).codigo);
  if (!codigo) notFound();
  const consulta = lerConsulta(parametrosDoEndereco(await searchParams));
  const caminho = `/emendas/parlamentares/${codigo}`;
  const l = await lerAutor(codigo, consulta);
  if (l.estado === "nao_encontrado") notFound();
  const elos = [{ rotulo: "Parlamentares", href: "/emendas/parlamentares" }, { rotulo: l.estado === "ok" ? (l.autor.nome ?? `Autor ${codigo}`) : `Autor ${codigo}` }];
  if (l.estado === "sem_dado") return <SemDadoPublicado elos={elos} titulo={`Autor ${codigo}`} />;
  if (l.estado !== "ok") return <Indisponivel elos={elos} titulo={`Autor ${codigo}`} endereco={urlComConsulta(caminho, consulta)} />;

  const paginas = totalDePaginas(l.total);
  if (consulta.pagina > paginas) redirect(urlComConsulta(caminho, { ...consulta, pagina: paginas }));
  const a = l.autor;
  const serie = serieAnual(l.agregado, "canal");
  const funcoes = porFuncao(l.agregado);
  const recorte = descreverConsulta(consulta);

  return (
    <div className="pa-pilha-larga">
      <Cabeca elos={elos} kicker={`Autor de emendas · código ${codigo}`} titulo={a.nome ?? `Autor ${codigo}`} execucao={l.execucao}>
        <p className="pa-sub">
          {ROTULO_TIPO_AUTOR_PUBLICO[a.tipo] ?? a.tipo}.{" "}
          {a.coletivo
            ? "Autoria coletiva: o dado aberto não identifica quem indicou cada destino."
            : "Agente público; o nome é o publicado para o código do autor (o código é do mandato)."}{" "}
          {a.ano_min !== null && `Emendas com registro na Paraíba de ${a.ano_min} a ${a.ano_max}. `}
          A execução depende também do município, da entidade e do órgão que repassa.
        </p>
      </Cabeca>

      <CartoesDaSoma soma={totalDoAgregado(l.agregado)} />

      <section className="em-secao" aria-labelledby="em-autor-serie">
        <h2 id="em-autor-serie">Por ano e forma de repasse</h2>
        <SerieAnual
          id="em-autor-serie"
          titulo="Emendas do autor por ano e forma de repasse"
          anos={serie.anos}
          chaves={serie.chaves}
          rotulo={(k) => ROTULO_FORMA[k as CanalEmenda] ?? k}
          semAno={serie.semAno}
        />
      </section>

      {funcoes.length > 0 && (
        <section className="em-secao" aria-labelledby="em-autor-funcao">
          <h2 id="em-autor-funcao">Por função de governo</h2>
          <TabelaDeSoma rotuloId="em-autor-funcao" cabeca="Função de governo" linhas={funcoes.map((f) => ({ chave: f.funcao, rotulo: f.funcao, soma: f.soma }))} />
        </section>
      )}

      <section className="em-secao" aria-labelledby="em-autor-linhas">
        <h2 id="em-autor-linhas">As emendas ({contagem(l.total, "registro", "registros")})</h2>
        {recorte.length > 0 && <p className="em-data">Recorte: {recorte.join("; ")}.</p>}
        <TabelaDasLinhas
          caminho={caminho}
          consulta={consulta}
          fixo={{ autor: codigo }}
          linhas={l.linhas}
          total={l.total}
          funcoes={funcoes.map((f) => f.funcao)}
          rotulo={`Emendas de ${a.nome ?? `autor ${codigo}`} com destino à Paraíba`}
        />
      </section>
    </div>
  );
}
