/**
 * O ciclo em curso do Pix no painel (oport_30): os planos da UF do exercício com o plano de trabalho pendente, da
 * vez do município primeiro e do prazo mais próximo. É a lista de quem procurar antes que o plano fique impedido.
 *
 * Onda 15, fase 2, lote C (13/10/2026): a lista é a `TabelaFiltravel`, com filtro e ordem em cada coluna (a regra do
 * titular; tela de administrador, toda coluna ordena). As células são as de antes. As colunas ocultas levam o que a
 * célula junta: o autor (debaixo do plano), os dias para o prazo e a data da última análise. A "Última análise" visível é
 * o texto da célula (órgão e parecer); a data dela fica na coluna oculta. A ordem padrão é a de `ordenarCiclo`.
 */
import type { ReactNode } from "react";
import { formatarData } from "@/lib/oportunidades/central";
import { dataBrasilia } from "@/lib/oportunidades/datas";
import { diasAte, ordenarCiclo, type PlanoCicloPix } from "@/lib/oportunidades/pix-ciclo";
import type { LeituraCicloPix } from "@/lib/oportunidades/pix-ciclo.server";
import { urlLaudoPix } from "@/lib/oportunidades/pix-laudo";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { ColunaTabela, LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../_componentes/TabelaFiltravel";

const VEZ: Record<string, string> = { ente: "município", orgao: "órgão federal", a_conferir: "a conferir" };

/** As colunas do ciclo (onda 15, fase 2, lote C, 13/10/2026). O `id` da tabela é único na página do Pix. */
const TABELA_CICLO = "ciclo";
const COLUNAS_CICLO: ColunaTabela[] = [
  { id: "ente", titulo: "Ente", tipo: "texto" },
  { id: "plano", titulo: "Plano", tipo: "texto", textoNoCsv: true },
  { id: "autor", titulo: "Autor da emenda", tipo: "texto", oculta: true },
  { id: "vez", titulo: "Vez", tipo: "categoria" },
  { id: "etapa", titulo: "Etapa", tipo: "categoria" },
  { id: "desde", titulo: "Desde", tipo: "data" },
  { id: "prazo", titulo: "Prazo", tipo: "data" },
  { id: "dias-prazo", titulo: "Dias para o prazo", tipo: "numero", oculta: true },
  { id: "analise", titulo: "Última análise", tipo: "texto" },
  { id: "analise-data", titulo: "Data da última análise", tipo: "data", oculta: true },
  { id: "valor", titulo: "Valor", tipo: "numero", alinhar: "direita" },
];

/** O texto da última análise, como a célula sempre escreveu: "órgão · parecer". */
function textoAnalise(p: PlanoCicloPix): string | null {
  const a = p.ultima_analise;
  return a ? `${a.orgao ?? "órgão"}${a.parecer ? ` · ${a.parecer.toLowerCase()}` : ""}` : null;
}

function linhaCiclo(p: PlanoCicloPix, hoje: string): LinhaTabela {
  const d = diasAte(p.prazo, hoje);
  const analise = textoAnalise(p);
  const celulas: Record<string, ReactNode> = {
    ente: p.beneficiario ?? "—",
    plano: (
      <>
        <LinkMapa href={urlLaudoPix(p.id_plano_acao)}>{p.codigo_plano_acao ?? p.id_plano_acao}</LinkMapa>
        {p.autor ? <span className="mp-laudo-miudo"> · {p.autor}</span> : null}
      </>
    ),
    desde: p.desde ? formatarData(p.desde) : "—",
    prazo: (
      <>
        {p.prazo ? formatarData(p.prazo) : "não cadastrado"}
        {d !== null && <span className="mp-laudo-miudo">{d < 0 ? ` · venceu há ${-d} d` : ` · ${d} d`}</span>}
      </>
    ),
    analise: analise ?? "—",
    valor: moedaCurta(p.valor),
  };
  return {
    chave: String(p.id_plano_acao),
    valores: {
      ente: p.beneficiario,
      plano: p.codigo_plano_acao ?? String(p.id_plano_acao),
      autor: p.autor,
      vez: VEZ[p.vez] ?? p.vez,
      etapa: p.etapa,
      desde: p.desde,
      prazo: p.prazo,
      "dias-prazo": d,
      analise,
      "analise-data": p.ultima_analise?.data ?? null,
      valor: p.valor,
    },
    celulas,
  };
}

export function CicloPix({ leitura, hoje }: { leitura: LeituraCicloPix | null; hoje: string }) {
  return (
    <section aria-labelledby="pix-ciclo" className="mp-radar-secao">
      <h2 id="pix-ciclo" className="mp-radar-h2">
        Ciclo em curso
      </h2>
      <Conteudo leitura={leitura} hoje={hoje} />
    </section>
  );
}

function Conteudo({ leitura, hoje }: { leitura: LeituraCicloPix | null; hoje: string }) {
  if (!leitura || leitura.estado === "nao_ativado" || leitura.estado === "sem_execucao") {
    return <p className="pa-nota">A coleta diária do ciclo ainda não foi feita: a lista aparece depois da primeira.</p>;
  }
  if (leitura.estado === "erro") {
    return <p className="pa-nota">O ciclo em curso não pôde ser lido agora. Costuma ser passageiro: recarregue a página em alguns minutos.</p>;
  }
  const c = leitura.contagens;
  const planos = ordenarCiclo(leitura.planos);
  const ente = planos.filter((p) => p.vez === "ente");
  const anos = Array.isArray(c.ciclo_anos) ? (c.ciclo_anos as number[]).join(" e ") : "do exercício";
  // A4x (08/10/2026): o `dado_ate` da coleta é carimbo com hora; o dia é o de Brasília, e não o de UTC.
  return (
    <>
      <p className="pa-nota">
        Coleta diária de {dataBrasilia(leitura.dado_ate)}: {String(c.ciclo_planos_uf ?? "—")} planos de {anos}{" "}
        na UF; {planos.length === 0 ? "nenhum com o plano de trabalho pendente." : `${planos.length} pendentes, ${ente.length} com a vez do município.`}{" "}
        {Number(c.ciclo_prazos_cadastrados ?? 0) === 0
          ? "Nenhum prazo de comunicado cadastrado: os prazos aparecem quando o comunicado do ciclo for cadastrado."
          : `${String(c.ciclo_prazos_cadastrados)} prazos de comunicado cadastrados.`}
      </p>
      {planos.length > 0 && (
        <TabelaFiltravel
          id={TABELA_CICLO}
          rotulo="Ciclo em curso do Pix"
          colunas={COLUNAS_CICLO}
          linhas={planos.map((p) => linhaCiclo(p, hoje))}
          descricaoOrdemPadrao="a vez do município primeiro, depois o prazo mais próximo"
          csv={{ nome: "pix-ciclo-em-curso" }}
        />
      )}
    </>
  );
}
