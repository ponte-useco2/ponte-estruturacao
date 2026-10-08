import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { urlDoMunicipio } from "@/lib/oportunidades/busca";
import { EXPLICACAO_SEM_FICHA } from "@/lib/oportunidades/cliente";
import { lerAcessoFicha } from "@/lib/oportunidades/cliente.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { LinkMapa } from "../_componentes/LinkMapa";

export const metadata: Metadata = {
  title: "Meu município · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * A porta da prefeitura para o próprio município.
 *
 * O portão de login e aprovação é do layout de `/mapa`. Aqui entra o segundo portão: a organização ativa precisa
 * ser do tipo município e ter o vínculo confirmado por um administrador (oport_12). Desde a F1c (07/10/2026), com
 * o vínculo confirmado, redireciona para a página do município em abas, que reconhece o cliente e abre o nível
 * dele (laudos dos próprios convênios, simulador); fora da PB, para os investimentos. O município vem do vínculo
 * confirmado, nunca da URL. Sem o vínculo, explica o que falta.
 */
export default async function MeuMunicipioPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { acesso, organizacao } = await lerAcessoFicha(visitante);
  if (acesso.ok) redirect(urlDoMunicipio(acesso.ibge));

  const e = EXPLICACAO_SEM_FICHA[acesso.motivo];
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">Meu município{organizacao ? ` · ${organizacao.nome}` : ""}</p>
        <h1 className="pa-titulo">{e.titulo}</h1>
        <p>{e.texto}</p>
        <p className="pa-nota">
          <LinkMapa href="/mapa/conta/organizacao">Ver o cadastro da organização</LinkMapa>
        </p>
      </div>
    </div>
  );
}
