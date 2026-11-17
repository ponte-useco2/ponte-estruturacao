import type { Metadata } from "next";
import Link from "next/link";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import {
  COLUNAS_MUNICIPIOS,
  contagem,
  inteiro,
  parametrosDoEndereco,
  moeda,
  municipiosComRegistro,
  separarMunicipios,
  urlMunicipioPublico,
  valoresDoMunicipio,
  type MunicipioPublico,
} from "@/lib/oportunidades/emendas-publico";
import { redirect } from "next/navigation";
import { normalizarTexto } from "@/lib/oportunidades/tabela-filtro";
import { lerMunicipios } from "@/lib/oportunidades/emendas-publico.server";
import {
  ANO_INICIAL_PERCURSO,
  anoAtualBrasilia,
  ibgeValido,
  lerPeriodo,
  mudar,
  periodoDoEndereco,
  recorteVazio,
  urlMunicipio,
  urlRegistros,
} from "@/lib/oportunidades/emendas-recorte";
import { TabelaFiltravel } from "../../mapa/_componentes/TabelaFiltravel";
import { Cabeca, Indisponivel, SemDadoPublicado } from "../_componentes/Pecas";

export const metadata: Metadata = {
  title: "Municípios",
  description:
    "Os 223 municípios da Paraíba em ordem alfabética, com as emendas federais que cada um recebeu (prefeitura, fundos municipais, OSC e outras entidades com sede nele), e o governo do estado à parte.",
};

const ELOS = [{ rotulo: "Municípios" }] as const;

function linhas(municipios: readonly MunicipioPublico[]): LinhaTabela[] {
  return municipios.map((m) => ({
    chave: m.ibge ?? m.nome,
    valores: valoresDoMunicipio(m),
    celulas: {
      nome: m.ibge ? (
        <Link prefetch={false} href={urlMunicipioPublico(m.ibge)} className="mp-tabela-principal">
          {m.nome}
        </Link>
      ) : (
        m.nome
      ),
      emendas: inteiro(m.emendas),
      linhas: inteiro(m.linhas),
      previsto: moeda(m.previsto),
      pago: moeda(m.pago),
      entidades: moeda(m.entidades_pago),
    },
  }));
}

/**
 * Os 223 municípios (17/11/2026), em ordem alfabética, sem ranking padrão: os sem nenhum registro aparecem com zero. O
 * governo do estado e os fundos estaduais vêm à parte (sem município: a sede não é o destino), e o que não tem município
 * identificado também.
 */
export default async function Municipios({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = parametrosDoEndereco(await searchParams);
  const anoMax = anoAtualBrasilia();
  const l = await lerMunicipios();
  // O formulário do início (GET): com o IBGE (escolhido na lista) ou só com o nome (sem JavaScript), vai ao município.
  const pedido = ibgeValido(sp.get("municipio"));
  const nome = normalizarTexto(sp.get("nome") ?? "");
  const periodo = lerPeriodo(periodoDoEndereco(sp), anoMax);
  if (pedido) redirect(urlMunicipio(pedido, periodo));
  let naoAchado: string | null = null;
  if (nome && l.estado === "ok") {
    const achados = l.municipios.filter((m) => m.grupo === "municipio" && m.ibge && normalizarTexto(m.nome) === nome);
    const parecidos = achados.length ? achados : l.municipios.filter((m) => m.grupo === "municipio" && m.ibge && normalizarTexto(m.nome).includes(nome));
    if (parecidos.length === 1 && parecidos[0].ibge) redirect(urlMunicipio(parecidos[0].ibge, periodo));
    naoAchado = sp.get("nome");
  }
  if (l.estado === "sem_dado") return <SemDadoPublicado elos={ELOS} titulo="Municípios" />;
  if (l.estado !== "ok") return <Indisponivel elos={ELOS} titulo="Municípios" endereco="/emendas/municipios" />;
  const { municipios, estado, semMunicipio } = separarMunicipios(l.municipios);
  const com = municipiosComRegistro(l.municipios);

  return (
    <div className="pa-pilha-larga">
      <Cabeca elos={ELOS} kicker="Emendas federais na Paraíba" titulo="Municípios" execucao={l.execucao}>
        {naoAchado ? (
          <p className="pa-sub" role="status">
            Nenhum município da Paraíba com o nome “{naoAchado.slice(0, 80)}”, ou mais de um parecido: escolha na lista abaixo.
          </p>
        ) : null}
        <p className="pa-sub">
          Os {inteiro(municipios.length)} municípios da Paraíba, em ordem alfabética: {inteiro(com)} com algum registro de emenda federal.
          Cada valor soma o que foi para a prefeitura, para os fundos municipais e para entidades com sede no município (OSC, empresas,
          consórcios); a coluna “Pago a entidades” mostra essa última parte à parte.
        </p>
      </Cabeca>

      <section className="em-secao" aria-labelledby="em-municipios">
        <h2 id="em-municipios">Os municípios</h2>
        <TabelaFiltravel
          id="municipios"
          rotulo="Municípios da Paraíba e as emendas federais"
          colunas={COLUNAS_MUNICIPIOS}
          linhas={linhas(municipios)}
          descricaoOrdemPadrao="alfabética, pelo nome do município"
          csv={{ nome: "emendas-pb-municipios" }}
          empilhar
        />
      </section>

      <section className="em-secao" aria-labelledby="em-estado">
        <h2 id="em-estado">Estado e registros sem município</h2>
        <ul className="em-lista">
          {estado ? (
            <li>
              <strong>{estado.nome}</strong>: {contagem(estado.emendas, "emenda", "emendas")}, {contagem(estado.linhas, "registro", "registros")},
              pago {moeda(estado.pago)}.{" "}
              <Link prefetch={false} href={urlRegistros(mudar(recorteVazio({ de: ANO_INICIAL_PERCURSO, ate: anoMax }), { destinatario: ["estado"] }))}>
                Ver as linhas
              </Link>
            </li>
          ) : (
            <li>Não consta registro para o governo do estado nem para os fundos estaduais.</li>
          )}
          {semMunicipio && (
            <li>
              <strong>{semMunicipio.nome}</strong>: {contagem(semMunicipio.linhas, "registro", "registros")}, pago {moeda(semMunicipio.pago)}
              (a fonte não informa o município do destino).
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
