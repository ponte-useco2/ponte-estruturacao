/**
 * A lista das organizações da sociedade civil ativas de um município (E3, 07/10/2026). As filiais vêm agrupadas pela
 * raiz do CNPJ; quem tem instrumento federal na base vem primeiro. Cada nome leva à página da entidade — com a
 * carteira, quando há, ou só com o cadastro do Mapa. Inaptas, suspensas e baixadas aparecem só como número.
 */
import Link from "next/link";
import { parametrosBusca, urlBusca } from "@/lib/oportunidades/busca";
import { cnpjLegivel } from "@/lib/oportunidades/fornecedores";
import {
  areasDaLista,
  fantasiaUtil,
  listaDoMunicipio,
  nomeOsc,
  rotuloArea,
  versaoLegivel,
} from "@/lib/oportunidades/osc";
import type { OscDoMunicipio } from "@/lib/oportunidades/osc.server";
import { urlEntidade } from "@/lib/oportunidades/pagina-entidade";
import { urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
import { trilha } from "@/lib/oportunidades/trilha";
import { Carregando } from "../../../_componentes/Carregando";
import { Termo } from "../../../_componentes/Termo";
import { LinkMapa } from "../../../_componentes/LinkMapa";
import { Trilha } from "../../../_componentes/Trilha";
import { TabelaFiltravel } from "../../../_componentes/TabelaFiltravel";
import { COLUNAS_OSC_MUNICIPIO, OSC_NA_TELA, TABELA_OSC_MUNICIPIO, valoresDaOsc } from "@/lib/oportunidades/osc-tabela";
import { ESTADO_VAZIO, aplicar, gravarEstado, type EstadoTabela, type LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import type { GrupoOsc } from "@/lib/oportunidades/osc";

const n = (x: number) => x.toLocaleString("pt-BR");

/** O endereço da lista com os filtros. Exportado para a página montar o "Tentar de novo" do indisponível (B12b). */
export function urlOrganizacoes(ibge: string, f: { area?: string | null; q?: string; p?: number }): string {
  const s = new URLSearchParams();
  if (f.area) s.set("area", f.area);
  if (f.q) s.set("q", f.q);
  if (f.p && f.p > 1) s.set("p", String(f.p));
  const qs = s.toString();
  return `/mapa/municipio/${ibge}/organizacoes${qs ? `?${qs}` : ""}`;
}

export function OrganizacoesConteudo({
  ibge,
  osc,
  instrumentos,
  area,
  q,
  estado = ESTADO_VAZIO,
}: {
  ibge: string;
  osc: OscDoMunicipio;
  instrumentos: ReadonlyMap<string, number>;
  area: string | null;
  q: string;
  /** F3.3: o estado da tabela, aplicado aqui no servidor sobre a lista inteira. */
  estado?: EstadoTabela;
}) {
  const r = osc.resumo;
  const municipio = osc.ativas[0]?.municipio ?? `IBGE ${ibge}`;
  const lista = listaDoMunicipio(osc.ativas, instrumentos, { area, q, pagina: 1 }, true);
  const areas = areasDaLista(osc.ativas);
  // Todas as linhas com os valores crus; o filtro e a ordem da tabela, em memória; à tela vão as primeiras.
  const todas: LinhaTabela[] = lista.grupos.map((g) => ({ chave: g.principal.cnpj, valores: valoresDaOsc(g), celulas: celulasDaOsc(g) }));
  const filtradas = aplicar(COLUNAS_OSC_MUNICIPIO, todas, estado);
  const naTela = filtradas.slice(0, OSC_NA_TELA);
  const naturezas = [...new Set(todas.map((l) => String(l.valores.natureza ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const consulta = gravarEstado(TABELA_OSC_MUNICIPIO, estado, new URLSearchParams(urlOrganizacoes(ibge, { area, q }).split("?")[1] ?? "")).toString();
  const fora = r.inaptas + r.suspensas + r.baixadas;
  return (
    <div className="pa-pagina mp-radar mp-mun">
      <div className="pa-pilha mp-radar-cabeca">
        {/* O município volta à aba de onde a lista se abre ("Dinheiro federal", bloco "Quem recebe no município"). */}
        <Trilha elos={trilha({ uf: "PB", municipio: { ibge, nome: municipio, aba: "dinheiro" } }, "Organizações da sociedade civil")} />
        <h1 className="pa-titulo">Organizações da sociedade civil em {municipio}</h1>
        <p className="pa-sub">
          {n(r.ativas)} <Termo slug="osc-ativa">{r.ativas === 1 ? "organização ativa" : "organizações ativas"}</Termo> ({n(r.matrizes)} matrizes e{" "}
          {n(r.filiais)} filiais) no <Termo slug="mapa-das-osc">Mapa das OSC</Termo> do Ipea, versão de {versaoLegivel(osc.fonte.versao)}.
          {fora > 0 && ` Outras ${n(fora)} estão inaptas, suspensas ou baixadas na Receita e não entram na lista.`} Primeiro as que têm{" "}
          <Termo slug="convenio">instrumento federal</Termo> na base; as filiais aparecem junto da matriz.
        </p>
      </div>

      <nav aria-label="Área de atuação" className="pa-chips mp-radar-filtros">
        <LinkMapa href={urlOrganizacoes(ibge, { q })} className={`pa-chip${!area ? " pa-ativo" : ""}`} aria-current={!area ? "page" : undefined}>
          Todas ({n(r.ativas)})
        </LinkMapa>
        {areas.map((a) => (
          <LinkMapa
            key={a.area}
            href={urlOrganizacoes(ibge, { area: a.area, q })}
            className={`pa-chip${area === a.area ? " pa-ativo" : ""}`}
            aria-current={area === a.area ? "page" : undefined}
          >
            {rotuloArea(a.area)} ({n(a.n)})
          </LinkMapa>
        ))}
      </nav>

      <form method="get" action={`/mapa/municipio/${ibge}/organizacoes`} className="mp-filtros mp-busca-form" role="search">
        {area && <input type="hidden" name="area" value={area} />}
        <div className="mp-busca-termo">
          <label htmlFor="osc-q" className="pa-campo-rotulo">
            Buscar pelo nome ou CNPJ
          </label>
          <input id="osc-q" name="q" type="search" defaultValue={q} className="pa-input" autoComplete="off" />
        </div>
        <button type="submit" className="pa-btn pa-btn-pequeno">
          Buscar
        </button>
      </form>

      <section aria-labelledby="osc-lista" className="mp-radar-secao">
        <h2 id="osc-lista" className="mp-radar-h2" aria-live="polite">
          {lista.organizacoes
            ? `${n(lista.organizacoes)} ${lista.organizacoes === 1 ? "organização" : "organizações"}`
            : q
              ? `Nenhuma organização com “${q}”`
              : area
                ? "Nenhuma organização"
                : "Nenhuma organização ativa"}
          {lista.linhas < lista.organizacoes ? ` em ${n(lista.linhas)} ${lista.linhas === 1 ? "linha" : "linhas"} (as filiais vão na linha da matriz)` : ""}
          {area ? ` · ${rotuloArea(area)}` : ""}
        </h2>
        {lista.organizacoes === 0 && (
          <SemOrganizacao ibge={ibge} municipio={osc.ativas.length ? municipio : null} ativas={r.ativas} area={area} q={q} versao={versaoLegivel(osc.fonte.versao)} />
        )}
        {lista.grupos.length > 0 && (
          <TabelaFiltravel
            id={TABELA_OSC_MUNICIPIO}
            rotulo={`Organizações da sociedade civil em ${municipio}`}
            colunas={COLUNAS_OSC_MUNICIPIO}
            linhas={naTela}
            descricaoOrdemPadrao="primeiro as que têm instrumento federal, depois pelo nome"
            empilhar
            servidor={{
              total: filtradas.length,
              opcoes: { natureza: naturezas.map((valor) => ({ valor, linhas: todas.filter((l) => l.valores.natureza === valor).length })) },
              csvHref: `/mapa/municipio/${ibge}/organizacoes/exportar${consulta ? `?${consulta}` : ""}`,
            }}
          />
        )}
        <p className="pa-nota">
          Fonte: Mapa das Organizações da Sociedade Civil (Ipea), arquivo de divulgação da versão de {versaoLegivel(osc.fonte.versao)}, com o
          cadastro da Receita Federal; instrumentos federais pelo Transferegov. A área de atuação é a classificação do Ipea. Endereço, dirigentes e
          contatos não entram no Mapa de Oportunidades.
        </p>
      </section>
    </div>
  );
}

/**
 * A lista vazia (B12b, onda 3 de UX, 08/10/2026; antes, só o título "Nenhuma organização com esses filtros", sem saída).
 * Com filtro: onde se procurou e até três saídas — tirar os filtros, o mesmo nome em todas as áreas e o nome na Paraíba
 * inteira, pela busca. Sem filtro: o cadastro do Ipea não tem organização ativa aqui, e a volta é o município.
 */
function SemOrganizacao({
  ibge,
  municipio,
  ativas,
  area,
  q,
  versao,
}: {
  ibge: string;
  /** Null quando o cadastro não tem nenhuma ativa: o nome viria dela. */
  municipio: string | null;
  ativas: number;
  area: string | null;
  q: string;
  versao: string;
}) {
  const aqui = municipio ? `em ${municipio}` : "neste município";
  if (!area && !q) {
    return (
      <div className="pa-cartao pa-cartao-plano pa-pilha">
        <p>O Mapa das OSC (Ipea), versão de {versao}, não tem organização ativa {aqui}.</p>
        <p className="pa-linha">
          <LinkMapa href={urlMunicipio(ibge, "dinheiro")} className="pa-btn pa-btn-pequeno">
            Voltar ao município
          </LinkMapa>
        </p>
      </div>
    );
  }
  const das = `${n(ativas)} ${ativas === 1 ? "organização ativa" : "organizações ativas"} ${aqui}`;
  return (
    <div className="pa-cartao pa-cartao-plano pa-pilha">
      <p>
        {q
          ? `A procura olhou o nome, o nome fantasia e o CNPJ ${area ? `das organizações ativas ${aqui} na área ${rotuloArea(area)}` : `das ${das}`}.`
          : `${ativas === 1 ? `A única organização ativa ${aqui} não tem` : `Nenhuma das ${das} tem`} a área ${rotuloArea(area ?? "")} na classificação do Ipea.`}
      </p>
      <p className="pa-linha">
        <LinkMapa href={urlOrganizacoes(ibge, {})} className="pa-btn pa-btn-pequeno">
          Tirar os filtros
        </LinkMapa>
        {q && area && (
          <LinkMapa href={urlOrganizacoes(ibge, { q })} className="pa-btn pa-btn-pequeno">
            Procurar “{q}” em todas as áreas
          </LinkMapa>
        )}
        {q && (
          <LinkMapa href={urlBusca(parametrosBusca({}), { aba: "organizacoes", q })} className="pa-btn pa-btn-pequeno">
            Procurar “{q}” na Paraíba inteira
          </LinkMapa>
        )}
      </p>
    </div>
  );
}

/** As células da linha de uma organização (o desenho de antes: nome com link, nome fantasia, CNPJ e filiais). */
function celulasDaOsc(g: GrupoOsc & { instrumentos: number }) {
  return {
    organizacao: (
      <>
        <Link href={urlEntidade(g.principal.cnpj)} prefetch={false}>
          {nomeOsc(g.principal)}
          <Carregando />
        </Link>
        {g.principal.razao_social && fantasiaUtil(g.principal) && <span className="pa-nota"> ({fantasiaUtil(g.principal)})</span>}
        <br />
        <span className="pa-nota pa-mono">{cnpjLegivel(g.principal.cnpj)}</span>
        {g.filiais > 0 && (
          <span className="pa-nota">
            {" "}
            · e mais {n(g.filiais)} {g.filiais === 1 ? "filial" : "filiais"} aqui
          </span>
        )}
        {g.matrizFora && g.principal.matriz === false && <span className="pa-nota"> · filial (a matriz fica fora desta lista)</span>}
      </>
    ),
    fundacao: g.principal.dt_fundacao?.slice(0, 4) ?? "—",
    instrumentos: g.instrumentos ? n(g.instrumentos) : "—",
  };
}
