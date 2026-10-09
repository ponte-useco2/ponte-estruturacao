import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { urlProposta } from "@/lib/oportunidades/busca";
import { lerProposta } from "@/lib/oportunidades/busca.server";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { tituloProposta } from "@/lib/oportunidades/titulo-pagina";
import { recorteDaBase } from "@/lib/oportunidades/vazios";
import { visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { PropostaConteudo } from "./PropostaConteudo";
import { LinkMapa } from "../../_componentes/LinkMapa";

const BUSCA_PROPOSTAS = "/mapa/busca?aba=propostas";

/**
 * Onda 7, C (09/10/2026; N01 da auditoria R1, WCAG 2.4.2): o título diz o id da proposta ("Proposta 1234567"). Era o
 * mesmo para toda proposta, e o leitor de tela não anunciava a troca de uma para outra. Só o id do endereço, já
 * validado: nada do banco (o número que a pessoa conhece pediria a leitura), nada que a página não mostre.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: tituloProposta(id), robots: { index: false, follow: false } };
}

/** Uma proposta pelo id do SICONV — para qualquer usuário aprovado. */
export default async function PropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();
  const [leitura, seguidas] = await Promise.all([lerProposta(id), lerSeguidas()]);

  if (leitura.estado === "nao_encontrado") {
    return (
      <div className="pa-pagina pa-pagina-estreita">
        <div className="pa-pilha">
          <p className="pa-kicker">Proposta {id}</p>
          <h1 className="pa-titulo">Esta proposta não está na busca</h1>
          {/* B12b: o recorte de `recorteDaBase`, o mesmo dos investimentos do município. */}
          <p>A busca traz {recorteDaBase(null).propostas}. Rascunhos que nunca foram enviados não entram.</p>
          <p className="pa-nota">
            <LinkMapa href={BUSCA_PROPOSTAS}>Buscar propostas</LinkMapa>
          </p>
        </div>
      </div>
    );
  }
  if (leitura.estado !== "ok") {
    // B12b: sem a leitura não se sabe o proponente nem o município (o nível acima na trilha); a volta é a busca das propostas.
    return (
      <DadoIndisponivel
        kicker={`Proposta ${id}`}
        titulo="A proposta está indisponível agora"
        endereco={urlProposta(id)}
        voltarPara={{ rotulo: "Buscar propostas", href: BUSCA_PROPOSTAS }}
      />
    );
  }
  return (
    <PropostaConteudo
      leitura={leitura}
      seguindo={seguidas ? seguidas.has(chaveSeguida("proposta", leitura.proposta.id_proposta)) : null}
    />
  );
}
