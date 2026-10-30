import type { Metadata } from "next";
import { BotaoGoogle } from "@/app/oportunidades/entrar/BotaoGoogle";
import { hojeBrasilia, SALA_PABLO } from "@/lib/oportunidades/sala-escrita";
import { lerSalaQueGrava } from "@/lib/oportunidades/sala-escrita.server";
import { SalaPablo } from "./SalaPablo";
import "./sala-pablo.css";

/**
 * Sala do Pablo (30/10/2026): acompanhamento da parceria PONTE × Pablo Forlan, com escrita (oport_59). Desenho do
 * protótipo da sessão de Grafos (PONTE Graph Builder). Diferente das outras salas, NÃO usa a senha compartilhada
 * (`SALA_SENHA_<SLUG>`): cada pessoa entra com o Google e precisa estar em `sala_membro`, porque cada mudança guarda
 * quem fez. A pasta própria (`sala/pablo/`) tem precedência sobre `sala/[sala]/`.
 *
 * Sem login ou sem ser membro, a página não diz o que há dentro nem de quem é a sala.
 */
export const metadata: Metadata = {
  title: "Sala de trabalho · PONTE",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const l = await lerSalaQueGrava(SALA_PABLO);

  if (!l.logado) {
    return (
      <div className="spb-porta">
        <h1>Sala de trabalho</h1>
        <p className="pa-sub">Entre com a conta Google convidada para esta sala.</p>
        <BotaoGoogle proximo="/sala/pablo" />
      </div>
    );
  }
  if (!l.membro || !l.dados) {
    return (
      <div className="spb-porta">
        <h1>Sala de trabalho</h1>
        <p className="pa-sub">
          {l.falha
            ? "Não foi possível abrir a sala agora. Recarregue a página em alguns minutos."
            : "Esta conta não tem acesso a esta sala. Se você foi convidado, entre com a conta do convite."}
        </p>
      </div>
    );
  }
  // Envio de arquivo desligável (`SALA_PABLO_ARQUIVOS=desligado`) enquanto o titular decide sobre o CPF de signatário em PDF.
  return <SalaPablo dados={l.dados} eu={l.membro} hoje={hojeBrasilia()} arquivos={process.env.SALA_PABLO_ARQUIVOS !== "desligado"} />;
}
