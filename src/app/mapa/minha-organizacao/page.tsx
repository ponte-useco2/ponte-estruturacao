import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EXPLICACAO_SEM_CNPJ } from "@/lib/oportunidades/cliente";
import { lerAcessoCliente } from "@/lib/oportunidades/cliente.server";
import { urlEntidade } from "@/lib/oportunidades/pagina-entidade";
import { visitanteAtual } from "@/lib/supabase-auth";

export const metadata: Metadata = {
  title: "Minha organização · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * A porta da organização que não é prefeitura (OSC, órgão estadual, consórcio) para a própria entidade (oport_31).
 * Com o CNPJ confirmado por um administrador, redireciona para a página da entidade, que reconhece o cliente e abre
 * o laudo dos próprios instrumentos. O CNPJ vem do vínculo confirmado, nunca da URL. Prefeitura vai para o "Meu
 * município". Sem o vínculo, explica o que falta.
 */
export default async function MinhaOrganizacaoPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { cnpj, organizacao } = await lerAcessoCliente(visitante);
  if (organizacao?.tipo === "municipio") redirect("/mapa/meu-municipio");
  if (cnpj.ok) redirect(urlEntidade(cnpj.cnpj));

  const e = EXPLICACAO_SEM_CNPJ[cnpj.motivo];
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">Minha organização{organizacao ? ` · ${organizacao.nome}` : ""}</p>
        <h1 className="pa-titulo">{e.titulo}</h1>
        <p>{e.texto}</p>
        <p className="pa-nota">
          <Link prefetch={false} href="/mapa/conta/organizacao">
            Ver o cadastro da organização
          </Link>
        </p>
      </div>
    </div>
  );
}
