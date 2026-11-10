import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { explicacaoSemCliente } from "@/lib/oportunidades/cliente";
import { lerAcessoCliente } from "@/lib/oportunidades/cliente.server";
import { podeVerPlanoPixDoCliente, urlLaudoPix } from "@/lib/oportunidades/pix-laudo";
import { lerLaudoPlanoPix } from "@/lib/oportunidades/pix-laudo.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { PlanoPixConteudo } from "./PlanoPixConteudo";
import { LinkMapa } from "../../../_componentes/LinkMapa";

export const metadata: Metadata = {
  title: "Laudo do Pix · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

const VOLTA_ADMIN = { rotulo: "Voltar ao painel do Pix", href: "/mapa/painel/pix?aba=especiais&uf=PB" };
const VOLTA_CLIENTE = { rotulo: "Voltar ao Meu município", href: "/mapa/meu-municipio" };

/**
 * Laudo de um plano de ação das transferências especiais da PB (onda 13A).
 *
 *   · administrador: qualquer plano da PB;
 *   · cliente: os planos do município confirmado (prefeitura, oport_12) ou do CNPJ confirmado (as outras
 *     organizações, oport_31; D1 A25, 09/11/2026). O plano de outro ente é "não disponível", sem dizer se
 *     existe. O conteúdo é o mesmo — o laudo do Pix não tem nome de servidor nem de fornecedor —, sem os
 *     atalhos de administrador.
 * A mesma página é o relatório para imprimir.
 */
export default async function LaudoPixPage({ params }: { params: Promise<{ id: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();

  const admin = ehAdministrador(visitante.email);
  let podeVer: Parameters<typeof lerLaudoPlanoPix>[1];
  if (!admin) {
    const { municipio, cnpj, organizacao } = await lerAcessoCliente(visitante);
    if (!municipio.ok && !cnpj.ok) {
      const e = explicacaoSemCliente(organizacao, municipio, cnpj);
      return <SemLaudo kicker={organizacao?.nome ?? "Laudo do Pix"} titulo={e.titulo} texto={e.texto} volta={VOLTA_CLIENTE} />;
    }
    podeVer = (p) => podeVerPlanoPixDoCliente(municipio, cnpj, p);
  }

  // B14b (08/10/2026): a volta depende de quem vê. O administrador não tem "Meu município": volta ao painel do Pix.
  const volta = admin ? VOLTA_ADMIN : VOLTA_CLIENTE;
  const leitura = await lerLaudoPlanoPix(Number(id), podeVer);
  if (leitura.estado === "nao_encontrado") {
    return admin ? (
      <SemLaudo
        kicker={`Laudo do Pix · plano ${id}`}
        titulo="Este plano não está no laudo"
        texto="O laudo cobre os planos de ação das transferências especiais de beneficiários da Paraíba, na última leitura semanal da API."
        volta={volta}
      />
    ) : (
      <SemLaudo
        kicker="Laudo do Pix"
        titulo="Este laudo não está disponível para a sua organização"
        texto="O laudo do Pix mostra os planos de ação da sua organização: os do município confirmado, no caso da prefeitura, ou os do CNPJ confirmado."
        volta={volta}
      />
    );
  }
  if (leitura.estado !== "ok") {
    return <DadoIndisponivel kicker="Laudo do Pix" titulo="O laudo do Pix está indisponível agora" endereco={urlLaudoPix(id)} voltarPara={volta} />;
  }
  return <PlanoPixConteudo leitura={leitura} cliente={!admin} />;
}

function SemLaudo({ kicker, titulo, texto, volta }: { kicker: string; titulo: string; texto: string; volta: { rotulo: string; href: string } }) {
  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">{kicker}</p>
        <h1 className="pa-titulo">{titulo}</h1>
        <p className="pa-sub">{texto}</p>
        <p className="pa-sub">
          <LinkMapa href={volta.href}>{volta.rotulo}</LinkMapa>
        </p>
      </div>
    </div>
  );
}
