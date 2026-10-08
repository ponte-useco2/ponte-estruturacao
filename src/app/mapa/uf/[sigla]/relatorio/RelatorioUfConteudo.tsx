/**
 * O relatório da UF para imprimir (C1a, onda 3 de UX, 08/10/2026; proposta da B11, 9.5): a página do estado numa
 * peça só, em A4, no modelo do relatório do município — trilha, ações, aviso, as seções na ordem das abas, as fontes e
 * a assinatura da PONTE. As seções são as mesmas da página (exportadas de `UfConteudo`), e o papel usa as regras de
 * impressão que a página já tem (`mp-laudo`, `mp-rel` no mapa.css).
 *
 * Só os municípios mudam no papel: na PB, os 223 vêm somados pelas 15 regiões imediatas, com o mapa (decisão da C1a).
 * A lista inteira tomaria umas cinco páginas a mais e dobraria o relatório; município a município ela já está no CSV,
 * na aba "Municípios" e no relatório de cada município. A soma segue a ordem da lista da página, nunca a do número:
 * para quem não é administrador, nada aqui ordena municípios por problema.
 */
import { formatarData } from "@/lib/oportunidades/central";
import { gruposDeCor } from "@/lib/oportunidades/pagina-brasil";
import type { NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import { NOME_UF, intermediariasDaUf, municipiosSomadosPorRegiao, naUf, urlUf, type RegiaoSomada } from "@/lib/oportunidades/pagina-uf";
import type { LeituraUfOk } from "@/lib/oportunidades/pagina-uf.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { trilha } from "@/lib/oportunidades/trilha";
import { LinkMapa } from "../../../_componentes/LinkMapa";
import { TabelaRolagem } from "../../../_componentes/TabelaRolagem";
import { Termo } from "../../../_componentes/Termo";
import { Trilha } from "../../../_componentes/Trilha";
import { BotaoImprimir } from "../../../fiscal/[ibge]/simular/BotaoImprimir";
import { Secao } from "../../../municipio/[ibge]/relatorio/RelatorioConteudo";
import { AtalhosAdmin, AvisoCobertura, Dinheiro, Estado, FontesUf, MapaDaUf, Resumo, Tempos } from "../UfConteudo";

const AVISO =
  "Leitura automática de fontes públicas pela PONTE, cada uma com a sua data (ver o fim). Os números dizem o que a base guarda, não fazem juízo " +
  "sobre nenhum ente e não substituem certidão, parecer do concedente, decisão do Tribunal de Contas nem orientação jurídica.";
const AVISO_INTERNO = `Uso interno da PONTE: a tabela das regiões traz o fiscal e os sinais do painel. ${AVISO}`;

const n = (x: number | null | undefined) => (x === null || x === undefined ? "—" : x.toLocaleString("pt-BR"));
const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");

/** Uma linha da tabela das regiões; o total vai em `<tfoot>`, em negrito. */
function Celulas({ r, admin, forte }: { r: RegiaoSomada; admin: boolean; forte?: boolean }) {
  const c = (v: string) => (forte ? <strong>{v}</strong> : v);
  return (
    <>
      <td className="mp-rel-num">{c(n(r.municipios))}</td>
      <td className="mp-rel-num">{c(n(r.populacao))}</td>
      <td className="mp-rel-num">{c(n(r.instrumentos))}</td>
      <td className="mp-rel-num">{c(n(r.emExecucao))}</td>
      <td className="mp-rel-num">{c(moedaCurta(r.valorExecucao))}</td>
      <td className="mp-rel-num">{c(n(r.oscAtivas))}</td>
      {admin && <td className="mp-rel-num">{c(n(r.bloqueados))}</td>}
      {admin && <td className="mp-rel-num">{c(n(r.sinais))}</td>}
    </>
  );
}

/**
 * "Os municípios" no papel (C1a). PB: o mapa e as 15 regiões imediatas somadas, cada uma com a cor da intermediária
 * (a mesma do mapa e da aba), e o total. Fora da PB a base não tem as regiões: uma frase com o total e o CSV.
 */
function MunicipiosNoPapel({ l, nivel }: { l: LeituraUfOk; nivel: NivelAcesso }) {
  const csv = `/mapa/uf/${l.sigla.toLowerCase()}/csv`;
  if (!l.municipios) {
    return (
      <Secao id="uf-municipios" titulo="Os municípios">
        <p className="pa-nota">A lista dos municípios não pôde ser lida agora.</p>
      </Secao>
    );
  }
  const { regioes, total } = municipiosSomadosPorRegiao(l.municipios);

  if (!l.completa) {
    return (
      <Secao
        id="uf-municipios"
        titulo="Os municípios"
        nota={
          <>
            Os municípios {naUf(l.sigla)} com <Termo slug="instrumento-vivo">instrumento vivo</Termo> na base. Fora da Paraíba a base não tem as regiões nem o
            porte dos municípios.
          </>
        }
      >
        <p>
          {n(total.municipios)} {total.municipios === 1 ? "município" : "municípios"}, com {n(total.instrumentos)} instrumentos na base; {n(total.emExecucao)}{" "}
          estão em execução e somam {moedaCurta(total.valorExecucao)}.
        </p>
        <p className="pa-nota">
          A lista, município a município, está no <a href={csv}>CSV dos municípios</a> e na{" "}
          <LinkMapa href={urlUf(l.sigla, "municipios")}>aba Municípios da página do estado</LinkMapa>.
        </p>
      </Secao>
    );
  }

  // o fiscal e os sinais do painel só existem para a Paraíba, e só o administrador os vê
  const admin = nivel >= 3;
  const cor = gruposDeCor(intermediariasDaUf(l.municipios));
  return (
    <Secao
      id="uf-municipios"
      titulo="Os municípios"
      nota={
        <>
          Os {n(total.municipios)} municípios somados por <Termo slug="regiao-imediata">região imediata</Termo> do IBGE, na ordem da lista da página: as{" "}
          <Termo slug="regiao-intermediaria">regiões intermediárias</Termo> em ordem alfabética e, dentro de cada uma, as imediatas. A cor é a da intermediária,
          a mesma do mapa. Instrumentos: todos os da base desde 2008; OSC: as <Termo slug="osc-ativa">ativas</Termo> no Mapa das OSC.
          {admin &&
            " Administrador: «Bloqueadas no fiscal» conta os municípios com a transferência voluntária bloqueada no painel fiscal; «Sinais» soma os sinais do painel de execução."}
        </>
      }
    >
      <MapaDaUf
        municipios={l.municipios}
        alternativa={
          <>
            Pelo teclado ou com leitor de tela, a lista com os mesmos links está na{" "}
            <LinkMapa href={urlUf(l.sigla, "municipios")}>aba Municípios da página do estado</LinkMapa>.
          </>
        }
      />
      <TabelaRolagem rotulo="Os municípios somados por região imediata">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Região imediata</th>
              <th scope="col">Municípios</th>
              <th scope="col">População</th>
              <th scope="col">Instrumentos</th>
              <th scope="col">Em execução</th>
              <th scope="col">Valor em execução</th>
              <th scope="col">OSC ativas</th>
              {/* rótulos curtos: o cabeçalho não quebra linha, e a nota da seção diz o que cada coluna conta */}
              {admin && <th scope="col">Bloqueadas no fiscal</th>}
              {admin && <th scope="col">Sinais</th>}
            </tr>
          </thead>
          <tbody>
            {regioes.map((r) => (
              <tr key={r.regiao}>
                <th scope="row">
                  {r.intermediaria && (
                    <>
                      <span className={`mp-mapa-amostra mp-mapa-g${cor.get(r.intermediaria) ?? 0}`} aria-hidden="true" />{" "}
                    </>
                  )}
                  {r.regiao}
                  {r.intermediaria && <span className="mp-tabela-secundario">região intermediária de {r.intermediaria}</span>}
                </th>
                <Celulas r={r} admin={admin} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total do estado</th>
              <Celulas r={total} admin={admin} forte />
            </tr>
          </tfoot>
        </table>
      </TabelaRolagem>
      <p className="pa-nota">
        Município a município, a lista está no <a href={csv}>CSV dos municípios</a> e na{" "}
        <LinkMapa href={urlUf(l.sigla, "municipios")}>aba Municípios da página do estado</LinkMapa>; cada município tem o seu relatório completo.
      </p>
    </Secao>
  );
}

export function RelatorioUfConteudo({ l, nivel, hoje }: { l: LeituraUfOk; nivel: NivelAcesso; hoje: string }) {
  const nome = NOME_UF[l.sigla];
  const admin = nivel >= 3 && l.completa;
  // B11: o estado volta à aba de onde o relatório se abre ("Relatório e dados"), como o município no relatório dele.
  const elos = trilha({ uf: l.sigla }, "Relatório completo").map((e) => (e.href === urlUf(l.sigla) ? { ...e, href: urlUf(l.sigla, "relatorio") } : e));
  return (
    <div className="pa-pagina mp-radar mp-laudo mp-rel">
      <div className="pa-pilha mp-radar-cabeca">
        <Trilha elos={elos} />
        <p className="pa-kicker">
          Relatório completo do estado · {l.sigla} · {l.completa ? "dado completo" : "cobertura parcial"}
        </p>
        <h1 className="pa-titulo">{nome}</h1>
        <p className="pa-sub">
          Resumo, municípios, o estado como proponente, dinheiro federal, tempos e funil · Transferegov até {data(l.execucao.dado_ate)} · relatório de{" "}
          {data(hoje)}
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          <a href={`/mapa/uf/${l.sigla.toLowerCase()}/csv`} className="pa-btn pa-btn-pequeno">
            Baixar os municípios (CSV)
          </a>
          <LinkMapa href={urlUf(l.sigla)} className="pa-btn pa-btn-pequeno">
            Abrir a página do estado
          </LinkMapa>
          <AtalhosAdmin l={l} nivel={nivel} />
        </p>
        <p className="mp-fiscal-aviso">{admin ? AVISO_INTERNO : AVISO}</p>
        <AvisoCobertura l={l} />
      </div>

      <Resumo l={l} peca />
      <MunicipiosNoPapel l={l} nivel={nivel} />
      <Estado l={l} />
      <Dinheiro l={l} nivel={nivel} />
      <Tempos l={l} />
      <FontesUf l={l} administrador={admin} />
    </div>
  );
}
