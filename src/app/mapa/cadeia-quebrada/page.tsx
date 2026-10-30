import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { lerCadeiaQuebrada } from "@/lib/oportunidades/cadeia-quebrada.server";
import { nivelSemCliente } from "@/lib/oportunidades/pagina-municipio";
import { chaveDoAmbiente, quemAPaginaAtende } from "@/lib/oportunidades/publico";
import { tituloDaPagina } from "@/lib/oportunidades/titulo-pagina";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../busca/BuscaConteudo";
import { CadeiaConteudo } from "./CadeiaConteudo";

export const metadata: Metadata = {
  title: tituloDaPagina("Cadeia do gasto no Diário Oficial"),
  robots: { index: false, follow: false },
};

/**
 * A cadeia quebrada do gasto, fase 1 (PUB-11, 29/10/2026): se o pagamento do Estado a uma empresa tem o ato contratual
 * publicado no Diário Oficial da PB, se o CNPJ que recebeu emenda estadual aparece em ato do Diário, e se as sanções do
 * CEIS/CNEP alcançam o contratante. Só agregados, sem nome de empresa, ente ou pessoa.
 *
 * Quem vê (decisão do titular, 29/10/2026): quem está logado e aprovado (nível ≥ 1); o público vai ao `/mapa`. A análise
 * é da sessão DOE-PB; aqui só o pacote conferido (`cadeia/carregar.py`, oport_56).
 */
export default async function CadeiaQuebradaPage() {
  const acesso = quemAPaginaAtende(await visitanteAtual(), chaveDoAmbiente(), "/mapa/cadeia-quebrada");
  if (!acesso) return null;
  const nivel = nivelSemCliente({ aprovado: acesso.aprovado !== null, administrador: ehAdministrador(acesso.aprovado?.email) });
  if (nivel < 1) redirect("/mapa");

  const leitura = await lerCadeiaQuebrada();
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Cadeia do gasto"
        titulo={leitura.estado === "sem_execucao" ? "A primeira geração ainda não foi carregada" : "A página da cadeia do gasto está indisponível agora"}
        endereco="/mapa/cadeia-quebrada"
        voltarPara={{ rotulo: "Abrir a página da Paraíba", href: "/mapa/uf/pb" }}
        publico={false}
      />
    );
  }
  return <CadeiaConteudo ex={leitura.execucao} c={leitura.cadeia} />;
}
