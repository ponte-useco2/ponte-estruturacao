/**
 * O relatório do Brasil para imprimir (C1b, onda 3 de UX, 08/10/2026; proposta da B11, 9.5), no modelo do relatório do
 * município: a página do Brasil numa peça só, em A4. O cabeçalho com a trilha, a data do dado, as ações e o aviso; as
 * partes na ordem das abas (os números e o mapa, as 27 UFs em ordem alfabética, o dinheiro federal, os tempos e o
 * funil); e, no fim, as fontes com a data de cada uma, como se conta e a assinatura.
 *
 * Os blocos são os mesmos da página (`BrasilConteudo`), com `noRelatorio`: sem os botões que levariam de volta a ela.
 * Cada parte só entra se o nível abre a aba dela (`partesDoRelatorioBrasil`): o relatório nunca mostra o que a página
 * esconde. As UFs nunca são classificadas: a tabela é a da página, em ordem alfabética, sem destaque.
 */
import { formatarData } from "@/lib/oportunidades/central";
import { URL_CSV_BRASIL, anoDeReferencia, partesDoRelatorioBrasil, urlBrasil } from "@/lib/oportunidades/pagina-brasil";
import type { LeituraBrasilOk } from "@/lib/oportunidades/pagina-brasil.server";
import type { NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import { trilha } from "@/lib/oportunidades/trilha";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { Trilha } from "../../_componentes/Trilha";
import { BotaoImprimir } from "../../fiscal/[ibge]/simular/BotaoImprimir";
import { DinheiroDoBrasil, Estados, FontesDoBrasil, Resumo, Tempos } from "../BrasilConteudo";

const AVISO =
  "Leitura automática de fontes públicas pela PONTE, cada uma com a sua data (ver o fim). Fora da Paraíba a base guarda só os " +
  "instrumentos vivos: é por eles que as 27 UFs aparecem lado a lado, em ordem alfabética. Não substitui as fontes oficiais.";

const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");

export function RelatorioBrasilConteudo({ l, nivel, hoje }: { l: LeituraBrasilOk; nivel: NivelAcesso; hoje: string }) {
  const ano = anoDeReferencia(l.execucao, hoje);
  const partes = new Set(partesDoRelatorioBrasil(nivel));
  // B11: o elo do Brasil volta à aba de onde o relatório se abre ("Relatório e dados"), como o do município e o da UF.
  const elos = trilha({}, "Relatório completo").map((e, i) => (i === 0 ? { ...e, href: urlBrasil("relatorio") } : e));
  return (
    <div className="pa-pagina mp-radar mp-laudo mp-rel">
      <div className="pa-pilha mp-radar-cabeca">
        <Trilha elos={elos} />
        <p className="pa-kicker">Relatório completo do Brasil · 27 UFs</p>
        <h1 className="pa-titulo">Brasil</h1>
        <p className="pa-sub">
          Instrumentos vivos, propostas, Pix, fundo a fundo e tempos das 27 UFs · Transferegov até {data(l.execucao.dado_ate)} · relatório de {data(hoje)}
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          <a href={URL_CSV_BRASIL} className="pa-btn pa-btn-pequeno">
            Baixar as 27 UFs (CSV)
          </a>
          <LinkMapa href={urlBrasil()} className="pa-btn pa-btn-pequeno">
            Abrir a página do Brasil
          </LinkMapa>
        </p>
        <p className="mp-fiscal-aviso">{AVISO}</p>
      </div>

      {partes.has("resumo") && <Resumo l={l} ano={ano} noRelatorio />}
      {partes.has("estados") && <Estados l={l} ano={ano} noRelatorio />}
      {partes.has("dinheiro") && <DinheiroDoBrasil l={l} nivel={nivel} />}
      {partes.has("tempos") && <Tempos l={l} />}
      <FontesDoBrasil l={l} ano={ano} />
    </div>
  );
}
