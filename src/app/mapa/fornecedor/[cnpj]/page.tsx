import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cnpjLegivel, cnpjValido } from "@/lib/oportunidades/fornecedores";
import { lerDossieFornecedor } from "@/lib/oportunidades/fornecedores.server";
import { lerTceDoFornecedor } from "@/lib/oportunidades/tce.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { FornecedorConteudo } from "./FornecedorConteudo";
import { LinkMapa } from "../../_componentes/LinkMapa";

export const metadata: Metadata = {
  title: "Fornecedor · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Dossiê de uma empresa nos convênios da PB (onda 12, parte 3): onde recebeu, de quem, com que contratos,
 * em que prefeituras é o maior fornecedor e se está na lista de inidôneos do TCU. Só administradores.
 */
export default async function FornecedorPage({ params }: { params: Promise<{ cnpj: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const cnpj = cnpjValido(decodeURIComponent((await params).cnpj));
  if (!cnpj) notFound();
  const [leitura, tce] = await Promise.all([lerDossieFornecedor(cnpj), lerTceDoFornecedor(cnpj)]);

  if (leitura.estado === "nao_encontrado") {
    return (
      <div className="pa-pagina pa-pagina-estreita">
        <div className="pa-pilha">
          <p className="pa-kicker">Fornecedor · CNPJ {cnpjLegivel(cnpj)}</p>
          <h1 className="pa-titulo">Esta empresa não aparece nos convênios da PB</h1>
          <p>
            O painel de fornecedores cobre as empresas pagas ou contratadas nos convênios de proponente da Paraíba. Confira o CNPJ ou procure
            pelo nome.
          </p>
          <p className="pa-nota">
            <LinkMapa href={`/mapa/fornecedores?q=${encodeURIComponent(cnpj)}`}>Procurar na lista</LinkMapa>
          </p>
        </div>
      </div>
    );
  }
  if (leitura.estado !== "ok") return <DadoIndisponivel kicker={`Fornecedor · CNPJ ${cnpjLegivel(cnpj)}`} titulo="O dossiê está indisponível agora" />;
  return <FornecedorConteudo leitura={leitura} tce={tce} />;
}
