import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EXPLICACAO_SEM_FICHA } from "@/lib/oportunidades/cliente";
import { lerAcessoFicha } from "@/lib/oportunidades/cliente.server";
import { chaveEnteValida, podeVerPlanoPix, urlEntePix } from "@/lib/oportunidades/pix-laudo";
import { lerLaudoEntePix } from "@/lib/oportunidades/pix-laudo.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { EntePixConteudo } from "./EntePixConteudo";
import { LinkMapa } from "../../../_componentes/LinkMapa";

export const metadata: Metadata = {
  title: "Pix do ente · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

const VOLTA_ADMIN = { rotulo: "Voltar ao painel do Pix", href: "/mapa/painel/pix?aba=especiais&uf=PB" };
const VOLTA_CLIENTE = { rotulo: "Voltar ao Meu município", href: "/mapa/meu-municipio" };

/**
 * Os planos de ação do Pix de um ente da PB, um por linha, com o pior ponto e o estado dos itens (onda 13A).
 * O ente vem pelo CNPJ (a lista do painel) ou pelo IBGE (o "Meu município"). Mesmo portão do laudo do
 * plano: administrador vê qualquer ente; o cliente, só o próprio município.
 */
export default async function EntePixPage({ params }: { params: Promise<{ chave: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { chave } = await params;
  const k = chaveEnteValida(chave);
  if (!k) notFound();

  const admin = ehAdministrador(visitante.email);
  let podeVer: Parameters<typeof lerLaudoEntePix>[1];
  if (!admin) {
    const { acesso } = await lerAcessoFicha(visitante);
    if (!acesso.ok) {
      const e = EXPLICACAO_SEM_FICHA[acesso.motivo];
      return <Aviso titulo={e.titulo} texto={e.texto} volta={VOLTA_CLIENTE} />;
    }
    podeVer = (p) => podeVerPlanoPix(acesso, p);
  }

  const leitura = await lerLaudoEntePix(k, podeVer);
  // B14b (08/10/2026): a volta depende de quem vê. O administrador não tem "Meu município": volta ao painel do Pix.
  const volta = admin ? VOLTA_ADMIN : VOLTA_CLIENTE;
  if (leitura.estado === "nao_encontrado") {
    return admin ? (
      <Aviso
        titulo="Nenhum plano do Pix para este ente"
        texto="O laudo cobre os planos de ação das transferências especiais de beneficiários da Paraíba, na última leitura semanal."
        volta={volta}
      />
    ) : (
      <Aviso titulo="Este laudo não está disponível para a sua organização" texto="O laudo do Pix mostra os planos de ação do seu município." volta={volta} />
    );
  }
  if (leitura.estado !== "ok") {
    return <DadoIndisponivel kicker="Pix do ente" titulo="O laudo do Pix está indisponível agora" endereco={urlEntePix(chave)} voltarPara={volta} />;
  }
  return <EntePixConteudo leitura={leitura} chave={chave} cliente={!admin} />;
}

function Aviso({ titulo, texto, volta }: { titulo: string; texto: string; volta: { rotulo: string; href: string } }) {
  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Pix do ente</p>
        <h1 className="pa-titulo">{titulo}</h1>
        <p className="pa-sub">{texto}</p>
        <p className="pa-sub">
          <LinkMapa href={volta.href}>{volta.rotulo}</LinkMapa>
        </p>
      </div>
    </div>
  );
}
