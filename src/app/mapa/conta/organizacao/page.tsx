import type { Metadata } from "next";
import Link from "next/link";
import { OrganizacaoForm } from "./OrganizacaoForm";
import { lerContexto } from "@/lib/oportunidades/organizacao.server";
import { ROTULO_AGENTE } from "@/lib/oportunidades/organizacao";

export const metadata: Metadata = {
  title: "Organização · Mapa de Oportunidades",
  robots: { index: false, follow: false },
};

/**
 * Declarar a entidade.
 *
 * O portão de acesso é do layout de `/mapa`; aqui não se repete.
 *
 * Não é obrigatório e não bloqueia o Mapa, de propósito: o filtro por
 * elegibilidade só entra com o catálogo v2. Forçar hoje um cadastro cujo
 * benefício ainda não existe seria cobrar adiantado.
 */
export default async function OrganizacaoPage() {
  const { todas } = await lerContexto();

  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha" style={{ marginBottom: "1.4rem" }}>
        <p className="pa-kicker">Conta</p>
        <h1 className="pa-titulo">Quem é a entidade</h1>
        <p className="pa-sub">
          O Mapa hoje mostra todas as janelas do Transferegov na Paraíba. Quando o catálogo
          multifonte entrar — Finep, CNPq e FAPESQ, além do Transferegov —, é o tipo declarado aqui
          que separa o que a entidade pode pleitear do que não pode.
        </p>
      </div>

      {todas.length > 0 && (
        <div className="pa-cartao pa-cartao-plano" style={{ marginBottom: "1.4rem" }}>
          <p className="pa-mono">Já cadastradas</p>
          <ul className="pa-pilha" style={{ marginTop: "0.4rem" }}>
            {todas.map((o) => (
              <li key={o.id} className="pa-linha">
                <strong>{o.nome}</strong>
                <span className="pa-tag">{ROTULO_AGENTE[o.tipo]}</span>
                {o.uf && <span className="pa-mono">{o.uf}</span>}
                <span className="pa-mono">{o.papel}</span>
              </li>
            ))}
          </ul>
          <p className="pa-nota" style={{ marginTop: "0.6rem" }}>
            Uma pessoa pode cuidar de várias entidades — é o caso de consultoria e de gabinete. O
            formulário abaixo acrescenta mais uma.
          </p>
        </div>
      )}

      <OrganizacaoForm />

      <p className="pa-nota" style={{ marginTop: "1.4rem" }}>
        <Link href="/mapa">Voltar ao Mapa</Link>
      </p>
    </div>
  );
}
