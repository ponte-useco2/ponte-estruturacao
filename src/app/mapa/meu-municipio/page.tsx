import type { Metadata } from "next";
import Link from "next/link";
import { EXPLICACAO_SEM_FICHA } from "@/lib/oportunidades/cliente";
import { lerAcessoFicha } from "@/lib/oportunidades/cliente.server";
import { parametrosFicha } from "@/lib/oportunidades/painel";
import { lerFichaMunicipio } from "@/lib/oportunidades/painel.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { FichaConteudo } from "../painel/FichaMunicipio";

export const metadata: Metadata = {
  title: "Meu município · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * A ficha do município da própria prefeitura.
 *
 * O portão de login e aprovação é do layout de `/mapa`. Aqui entra o segundo portão: a
 * organização ativa precisa ser do tipo município e ter o vínculo confirmado por um
 * administrador (oport_12). O município vem do vínculo confirmado — da URL só os
 * filtros de período e movimentação. Não há parâmetro que escolha outro município.
 */
export default async function MeuMunicipioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { acesso, organizacao } = await lerAcessoFicha(visitante);
  if (!acesso.ok) {
    const e = EXPLICACAO_SEM_FICHA[acesso.motivo];
    return (
      <div className="pa-pagina pa-pagina-estreita">
        <div className="pa-pilha">
          <p className="pa-kicker">Meu município{organizacao ? ` · ${organizacao.nome}` : ""}</p>
          <h1 className="pa-titulo">{e.titulo}</h1>
          <p>{e.texto}</p>
          <p className="pa-nota">
            <Link href="/mapa/conta/organizacao">Ver o cadastro da organização</Link>
          </p>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  // A prefeitura vê o que é da prefeitura: `quem` não vem da URL.
  const f = parametrosFicha(acesso.ibge, { ...sp, quem: undefined });
  const leitura = f ? await lerFichaMunicipio({ ...f, quem: "prefeitura" }) : null;

  if (!f || !leitura || leitura.estado !== "ok") {
    return (
      <div className="pa-pagina pa-pagina-estreita">
        <div className="pa-pilha">
          <p className="pa-kicker">Meu município</p>
          <h1 className="pa-titulo">A ficha está indisponível agora</h1>
          <p>Os dados do município não puderam ser lidos. Tente de novo em alguns minutos.</p>
        </div>
      </div>
    );
  }

  return <FichaConteudo f={{ ...f, quem: "prefeitura" }} ficha={leitura} cliente />;
}
