import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { urlMunicipioFiscal, urlSimularFiscal } from "@/lib/oportunidades/fiscal";
import { lerFiscalMunicipio } from "@/lib/oportunidades/fiscal.server";
import { lerAcessoFicha } from "@/lib/oportunidades/cliente.server";
import { ibgeDaUrl, urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { FiscalIndisponivel } from "../../FiscalConteudo";
import { SimuladorConteudo } from "./SimuladorConteudo";
import { LinkMapa } from "../../../_componentes/LinkMapa";

export const metadata: Metadata = {
  title: "Simular um projeto · Capacidade fiscal · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Simulador de operação de crédito e diagnóstico por projeto (onda 9). Formulário GET: cada simulação tem URL
 * própria, e a mesma página imprime.
 *
 * Quem vê (D1 A11, decisão do titular de 09/11/2026): o administrador, para qualquer município; e o cliente da
 * prefeitura com o IBGE confirmado (`PODE.simulador`, nível 2), só para o próprio município. O simulador não tem
 * nome de pessoa nem dado de terceiro: é o dado fiscal público do próprio ente mais as hipóteses que a pessoa digita.
 * O município do cliente vem do vínculo confirmado, nunca da URL: outro IBGE devolve ao Mapa.
 */
export default async function SimularPage({
  params,
  searchParams,
}: {
  params: Promise<{ ibge: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { ibge } = await params;
  // D1 A09 (09/11/2026): um dos 223 da PB, como na página do município.
  if (!ibgeDaUrl(ibge)) notFound();
  const admin = ehAdministrador(visitante.email);
  if (!admin) {
    const { acesso } = await lerAcessoFicha(visitante);
    if (!acesso.ok || acesso.ibge !== ibge) redirect("/mapa");
  }
  const sp = await searchParams;
  const leitura = await lerFiscalMunicipio(ibge);
  if (leitura.estado === "nao_encontrado") {
    return (
      <div className="pa-pagina pa-pagina-estreita">
        <div className="pa-pilha">
          <p className="pa-kicker">Capacidade fiscal · IBGE {ibge}</p>
          <h1 className="pa-titulo">Este código não está entre os 223 municípios da Paraíba</h1>
          <p>
            <LinkMapa href="/mapa/fiscal">Voltar à lista dos 223 municípios</LinkMapa>
          </p>
        </div>
      </div>
    );
  }
  if (leitura.estado !== "ok") {
    // B14b (08/10/2026): "Tentar de novo" refaz a mesma simulação (a URL guarda o formulário); a volta é o município.
    const consulta = new URLSearchParams(
      Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map((x): [string, string] => [k, x])),
    ).toString();
    return (
      <FiscalIndisponivel
        estado={leitura.estado}
        interno={admin}
        endereco={`${urlSimularFiscal(ibge)}${consulta ? `?${consulta}` : ""}`}
        voltarPara={
          admin
            ? { rotulo: "Voltar à capacidade fiscal do município", href: urlMunicipioFiscal(ibge) }
            : { rotulo: "Voltar às contas públicas do município", href: urlMunicipio(ibge, "contas") }
        }
      />
    );
  }
  return <SimuladorConteudo leitura={leitura} sp={sp} cliente={!admin} />;
}
