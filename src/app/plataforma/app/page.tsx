import { HomeClient } from "./HomeClient";
import { lerOportunidades } from "./_lib/oportunidades.server";

/** Mesma rede de segurança do painel público: o JSON só muda quando o pipeline commita. */
export const revalidate = 3600;

export default async function PlataformaAppHome() {
  const payload = await lerOportunidades();

  // Contagem derivada de `dias_restantes`, que já vem calculado no contrato.
  // Nada é recalculado aqui — só filtrado.
  const fechando15 = payload
    ? payload.oportunidades.filter((o) => o.dias_restantes <= 15).length
    : null;

  return <HomeClient fechando15={fechando15} />;
}
