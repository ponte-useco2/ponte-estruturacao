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
import { urlUf } from "@/lib/oportunidades/pagina-uf";
import type { FonteOsc, ResumoOscMunicipio } from "@/lib/oportunidades/osc";
import type { EntidadeNoMunicipio, LenteEntidade } from "@/lib/oportunidades/pagina-entidade";
import type { Relatorio } from "@/lib/oportunidades/relatorio-municipio";
import { Carregando } from "../../_componentes/Carregando";
import { EstrelaSeguir } from "../../_componentes/EstrelaSeguir";
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

const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");

function Cabeca({ r, nivel, seguindo }: { r: Relatorio; nivel: NivelAcesso; seguindo: boolean }) {
  const g = r.indicadores?.grupo ?? null;
  const pop = r.indicadores?.municipio.find((x) => x.id === "populacao_estimada") ?? r.indicadores?.municipio.find((x) => x.id === "populacao_censo");
  return (
    <div className="pa-pilha mp-radar-cabeca">
      <nav aria-label="Onde você está" className="mp-mun-trilha">
        <span>Brasil</span>
        <Link href={urlUf("PB")} prefetch={false}>
          Paraíba
        </Link>
        {g?.regiao_imediata && <span>Região imediata de {g.regiao_imediata}</span>}
        <span aria-current="page">{r.nome}</span>
      </nav>
      <h1 className="pa-titulo">{r.nome}</h1>
      <p className="pa-sub mp-mun-chips">
        <span>IBGE {r.ibge}</span>
        {pop && (
          <span>
            {pop.texto} ({pop.ano})
          </span>
        )}
        {g?.porte && <span>porte {g.porte} na PB</span>}
        {g?.regic && <span>{rotuloRegic(g.regic)}</span>}
        <span>posição de {data(r.hoje)}</span>
      </p>
      <p className="mp-nao-imprimir mp-laudo-acoes">
        <EstrelaSeguir tipo="municipio" chave={r.ibge} nome={`o município ${r.nome}`} seguindo={seguindo} />
        <BotaoImprimir />
        {PODE.interno(nivel) && (
          <Link href={`/mapa/painel/municipio/${r.ibge}`} className="pa-btn pa-btn-pequeno" prefetch={false}>
            Ficha no painel
          </Link>
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
            <Link href={`/mapa/municipio/${r.ibge}/investimentos`} className="pa-btn pa-btn-pequeno" prefetch={false}>
              Por tema, modalidade e tipo
            </Link>
            {PODE.laudo(nivel) && (
              <Link href={`/mapa/pix/ente/${r.ibge}`} className="pa-btn pa-btn-pequeno" prefetch={false}>
                Laudo do Pix
              </Link>
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
              <Link href={urlMunicipioFiscal(r.ibge)} className="pa-btn pa-btn-pequeno" prefetch={false}>
                Painel fiscal completo
              </Link>
              <Link href={`/mapa/fiscal/${r.ibge}/simular`} className="pa-btn pa-btn-pequeno" prefetch={false}>
                Simulador de crédito
              </Link>
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
              <Link href={`/mapa/painel/tce/${r.ibge}`} className="pa-btn pa-btn-pequeno" prefetch={false}>
                Despesas no TCE-PB
              </Link>
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
              <Link href={`/mapa/municipio/${r.ibge}/relatorio`} className="pa-btn" prefetch={false}>
                Abrir o relatório para imprimir
              </Link>
              <a href={`/mapa/municipio/${r.ibge}/relatorio/csv`} className="pa-btn pa-btn-pequeno">
                Achados em CSV
              </a>
            </Mais>
          </Secao>
          <BlocoFontes r={r} />
        </>
      )}
    </div>
  );
}
