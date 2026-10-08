/**
 * A página do município em abas (F1a, decisões de 06/10/2026): um endereço no lugar das telas espalhadas. Cada
 * aba junta os blocos do relatório que já existem (RelatorioConteudo); aqui só se escolhe o que entra em cada
 * uma e o que o nível de acesso alcança. A aba "o que trava" é a fila do município (F1b, `fila.ts`): a mesma ordem
 * do "Em uma página" do relatório e da carteira.
 */
import Link from "next/link";
import { formatarData } from "@/lib/oportunidades/central";
import { rotuloRegic } from "@/lib/oportunidades/indicadores-municipio";
import { urlMunicipioFiscal } from "@/lib/oportunidades/fiscal";
import { ABAS_MUNICIPIO, PODE, destinoConvenio, urlMunicipio, type AbaMunicipio, type NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import type { FonteOsc, ResumoOscMunicipio } from "@/lib/oportunidades/osc";
import type { EntidadeNoMunicipio, LenteEntidade } from "@/lib/oportunidades/pagina-entidade";
import type { Relatorio } from "@/lib/oportunidades/relatorio-municipio";
import { trilha } from "@/lib/oportunidades/trilha";
import { Carregando } from "../../_componentes/Carregando";
import { EstrelaSeguir } from "../../_componentes/EstrelaSeguir";
import { Termo } from "../../_componentes/Termo";
import { Trilha } from "../../_componentes/Trilha";
import { QuemRecebe } from "./QuemRecebe";
import { BotaoImprimir } from "../../fiscal/[ibge]/simular/BotaoImprimir";
import {
  BlocoControle,
  BlocoConvenios,
  BlocoEmendas,
  BlocoFila,
  BlocoFiscal,
  BlocoFontes,
  BlocoFornecedores,
  BlocoJanelas,
  BlocoMunicipio,
  BlocoPix,
  BlocoPropostas,
  BlocoTcePb,
  BlocoTramita,
  BlocosIndicadoresMunicipio,
  Cartoes,
  EmOrdem,
  Secao,
} from "./relatorio/RelatorioConteudo";
import { LinkMapa } from "../../_componentes/LinkMapa";

const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");

function Cabeca({ r, nivel, seguindo }: { r: Relatorio; nivel: NivelAcesso; seguindo: boolean }) {
  const g = r.indicadores?.grupo ?? null;
  const pop = r.indicadores?.municipio.find((x) => x.id === "populacao_estimada") ?? r.indicadores?.municipio.find((x) => x.id === "populacao_censo");
  return (
    <div className="pa-pilha mp-radar-cabeca">
      <Trilha elos={trilha({ uf: "PB", regiaoImediata: g?.regiao_imediata, municipio: { ibge: r.ibge, nome: r.nome } })} />
      <h1 className="pa-titulo">{r.nome}</h1>
      <p className="pa-sub mp-mun-chips">
        <span>IBGE {r.ibge}</span>
        {pop && (
          <span>
            {pop.texto} ({pop.ano})
          </span>
        )}
        {g?.porte && (
          <span>
            <Termo slug="tercil">porte {g.porte} na PB</Termo>
          </span>
        )}
        {g?.regic && <span>{rotuloRegic(g.regic)}</span>}
        <span>dados lidos em {data(r.hoje)}</span>
      </p>
      <p className="mp-nao-imprimir mp-laudo-acoes">
        <EstrelaSeguir tipo="municipio" chave={r.ibge} nome={`o município ${r.nome}`} seguindo={seguindo} />
        <BotaoImprimir />
        {PODE.interno(nivel) && (
          <LinkMapa href={`/mapa/painel/municipio/${r.ibge}`} className="pa-btn pa-btn-pequeno">
            Abrir a ficha no painel
          </LinkMapa>
        )}
      </p>
    </div>
  );
}

function Abas({ ibge, aba, nivel }: { ibge: string; aba: AbaMunicipio; nivel: NivelAcesso }) {
  return (
    <nav aria-label="Partes do município" className="mp-mun-abas mp-nao-imprimir">
      {ABAS_MUNICIPIO.filter((a) => nivel >= a.minimo).map((a) => (
        <Link key={a.id} href={urlMunicipio(ibge, a.id)} aria-current={a.id === aba ? "page" : undefined} scroll={false} prefetch={false}>
          {a.nome}
          <Carregando />
        </Link>
      ))}
    </nav>
  );
}

function Mais({ children }: { children: React.ReactNode }) {
  return <p className="mp-nao-imprimir mp-laudo-acoes">{children}</p>;
}

export function MunicipioConteudo({
  r,
  aba,
  nivel,
  seguindo,
  entidades,
  osc,
}: {
  r: Relatorio;
  aba: AbaMunicipio;
  nivel: NivelAcesso;
  seguindo: boolean;
  /** "Quem recebe no município" (E1): lido só na aba do dinheiro; null quando a leitura falhou. */
  entidades?: { lente: LenteEntidade; entidades: EntidadeNoMunicipio[] }[] | null;
  /** O resumo do Mapa das OSC (E3), também só na aba do dinheiro. */
  osc?: { resumo: ResumoOscMunicipio; fonte: FonteOsc } | null;
}) {
  const destino = destinoConvenio(nivel);
  const nomeAba = ABAS_MUNICIPIO.find((a) => a.id === aba)?.nome ?? "";
  return (
    <div className="pa-pagina mp-radar mp-laudo mp-rel mp-mun">
      <Cabeca r={r} nivel={nivel} seguindo={seguindo} />
      <Abas ibge={r.ibge} aba={aba} nivel={nivel} />
      <p className="mp-so-imprimir pa-kicker">{nomeAba}</p>

      {aba === "trava" && (
        <>
          <BlocoFila r={r} destino={destino} linkIndicadores={urlMunicipio(r.ibge, "indicadores")} />
          <BlocoJanelas r={r} />
        </>
      )}

      {aba === "resumo" && (
        <>
          <Secao id="mun-resumo" titulo="Em números">
            <Cartoes r={r} />
            <EmOrdem r={r} />
          </Secao>
          <BlocoMunicipio r={r} />
        </>
      )}

      {aba === "dinheiro" && (
        <>
          {entidades !== undefined && <QuemRecebe grupos={entidades} municipio={r.nome} ibge={r.ibge} osc={osc} />}
          <BlocoConvenios r={r} destino={destino} />
          <Mais>
            <LinkMapa href={`/mapa/municipio/${r.ibge}/investimentos`} className="pa-btn pa-btn-pequeno">
              Ver os investimentos por tema, modalidade e tipo
            </LinkMapa>
            {PODE.laudo(nivel) && (
              <LinkMapa href={`/mapa/pix/ente/${r.ibge}`} className="pa-btn pa-btn-pequeno">
                Abrir o laudo do Pix
              </LinkMapa>
            )}
          </Mais>
          <BlocoPropostas r={r} destino={destino} />
          <BlocoEmendas r={r} />
          <BlocoPix r={r} destino={destino} />
          <BlocoTcePb r={r} />
          <BlocoFornecedores r={r} destino={destino} />
        </>
      )}

      {aba === "contas" && (
        <>
          <BlocoFiscal r={r} destino={destino} />
          {PODE.interno(nivel) && (
            <Mais>
              <LinkMapa href={urlMunicipioFiscal(r.ibge)} className="pa-btn pa-btn-pequeno">
                Abrir o painel fiscal completo
              </LinkMapa>
              <LinkMapa href={`/mapa/fiscal/${r.ibge}/simular`} className="pa-btn pa-btn-pequeno">
                Abrir o simulador de crédito
              </LinkMapa>
            </Mais>
          )}
          {!r.fiscal && <p>O painel fiscal ainda não tem este município.</p>}
        </>
      )}

      {aba === "controle" && (
        <>
          <BlocoControle r={r} destino={destino} />
          <BlocoTramita />
          {PODE.interno(nivel) && (
            <Mais>
              <LinkMapa href={`/mapa/painel/tce/${r.ibge}`} className="pa-btn pa-btn-pequeno">
                Ver as despesas no TCE-PB
              </LinkMapa>
            </Mais>
          )}
        </>
      )}

      {aba === "indicadores" &&
        (r.indicadores ? <BlocosIndicadoresMunicipio r={r} destino={destino} /> : <p>Os indicadores do município ainda não foram lidos.</p>)}

      {aba === "relatorio" && (
        <>
          <Secao id="mun-relatorio" titulo="O relatório completo" nota="Todas as abas numa peça só, com a fonte de cada número, para imprimir ou anexar.">
            <Mais>
              <LinkMapa href={`/mapa/municipio/${r.ibge}/relatorio`} className="pa-btn">
                Abrir o relatório para imprimir
              </LinkMapa>
              <a href={`/mapa/municipio/${r.ibge}/relatorio/csv`} className="pa-btn pa-btn-pequeno">
                Baixar os pontos do relatório (CSV)
              </a>
            </Mais>
          </Secao>
          <BlocoFontes r={r} />
        </>
      )}
    </div>
  );
}
