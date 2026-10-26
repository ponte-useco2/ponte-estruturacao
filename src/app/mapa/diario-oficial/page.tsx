import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ASSINATURA_DOE,
  BASE_DOE,
  DIARIO_OFICIAL_PB,
  PECAS_DOE,
  pecaDoe,
  urlObservatorioDoe,
  urlPecaDoe,
} from "@/lib/oportunidades/observatorio-doe";
import { tituloDaPagina } from "@/lib/oportunidades/titulo-pagina";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { LinkMapa } from "../_componentes/LinkMapa";

export const metadata: Metadata = {
  title: tituloDaPagina("Observatório do Diário Oficial da PB"),
  robots: { index: false, follow: false },
};

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/**
 * O Observatório do Diário Oficial da PB (26/10/2026): as peças de due diligence lidas no Diário, uma por aba
 * (`?peca=`). Só administradores: a página confere no servidor, e a rota de cada peça confere de novo (o iframe pede
 * a peça à parte). O iframe tem sandbox sem `allow-same-origin`: o script da peça roda sem a origem do portal, sem
 * cookie nem sessão. Os links das peças abrem em outra aba.
 */
export default async function ObservatorioDoePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const sp = await searchParams;
  const peca = pecaDoe(typeof sp.peca === "string" ? sp.peca : null) ?? PECAS_DOE[0];
  return (
    <div className="pa-pagina mp-radar mp-doe">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Paraíba · Diário Oficial do Estado · uso interno</p>
        <h1 className="pa-titulo">Observatório do Diário Oficial da PB</h1>
        <p className="pa-sub">
          Due diligence de órgãos do Estado lida no{" "}
          <a href={DIARIO_OFICIAL_PB} target="_blank" rel="noopener noreferrer">
            Diário Oficial do Estado da Paraíba
          </a>
          , cruzada com o sistema financeiro do Estado, o PNCP e o TCE-PB. Base do Diário até {dataBr(BASE_DOE)}.
        </p>
      </div>

      <p className="pa-nota mp-doe-aviso" role="note">
        <strong>Pontos a verificar, não conclusões.</strong> &ldquo;Sócio em comum&rdquo;, concentração de credores e os
        demais achados indicam onde olhar: cada um pede a conferência no ato original antes de qualquer uso. Nada aqui
        afirma irregularidade.
      </p>

      <nav aria-label="Peças do observatório" className="mp-mun-abas mp-nao-imprimir">
        {PECAS_DOE.map((p) => (
          <LinkMapa key={p.id} href={urlObservatorioDoe(p.id)} aria-current={p.id === peca.id ? "page" : undefined} scroll={false}>
            {p.nome}
          </LinkMapa>
        ))}
      </nav>

      <h2 className="mp-radar-h3">{peca.titulo}</h2>
      <p className="pa-nota">
        {peca.resumo}{" "}
        <a href={urlPecaDoe(peca.id)} target="_blank" rel="noopener noreferrer">
          Abrir a peça inteira em outra aba
        </a>
        .
      </p>
      <iframe
        key={peca.id}
        className="mp-doe-peca"
        src={urlPecaDoe(peca.id)}
        title={`Peça do observatório: ${peca.titulo}`}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        loading="lazy"
      />

      <h2 className="mp-radar-h3">Método</h2>
      <ul className="pa-nota mp-doe-metodo">
        <li>
          Fonte principal: os atos publicados no Diário Oficial do Estado até {dataBr(BASE_DOE)}, cada um com o link para
          a página do Diário. Orçamento, empenhos e credores vêm da API de Dados Abertos do Estado (SIAF); licitações, do
          PNCP e das centrais de compras; convênios, do Transferegov; contas, do TCE-PB.
        </li>
        <li>
          Privacidade: sem CPF e sem nome de pessoa física. Credor pessoa física aparece só somado; empresa e entidade, com
          nome e CNPJ, como o Estado publica.
        </li>
        <li>
          Leitura automática: o texto do Diário é lido por regras, e erro de leitura acontece. Na dúvida, vale o ato
          publicado. A peça marca quando o valor em número e o por extenso de um ato não batem.
        </li>
        <li>As peças são regeradas fora do portal e copiadas para cá; a data da base muda a cada cópia.</li>
      </ul>
      <p className="pa-nota">{ASSINATURA_DOE}</p>
    </div>
  );
}
