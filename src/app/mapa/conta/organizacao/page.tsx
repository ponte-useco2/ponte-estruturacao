import type { Metadata } from "next";
import { OrganizacaoForm } from "./OrganizacaoForm";
import { podeVerEntidadePropria, podeVerMunicipio, type AcessoCnpj, type AcessoFicha } from "@/lib/oportunidades/cliente";
import { lerVinculo, lerVinculoCnpj } from "@/lib/oportunidades/cliente.server";
import { lerContexto } from "@/lib/oportunidades/organizacao.server";
import { ROTULO_AGENTE, ROTULO_PAPEL, type Organizacao } from "@/lib/oportunidades/organizacao";
import { visitanteAtual } from "@/lib/supabase-auth";
import { LinkMapa } from "../../_componentes/LinkMapa";

export const metadata: Metadata = {
  title: "Organização · Mapa de Oportunidades",
  robots: { index: false, follow: false },
};

/**
 * Declarar a entidade.
 *
 * O portão de acesso é do layout de `/mapa`, e a página repete a guarda (R3, 09/10/2026): com a versão pública
 * ligada (C4a), a navegação dentro do Mapa não passa pelo layout, e o formulário apareceria vazio ao público
 * por um instante, até a `ContaPublica` levar à entrada.
 *
 * Não é obrigatório e não bloqueia o Mapa, de propósito: o filtro por
 * elegibilidade só entra com o catálogo v2. Forçar hoje um cadastro cujo
 * benefício ainda não existe seria cobrar adiantado.
 */
export default async function OrganizacaoPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  const { todas } = await lerContexto();
  // A situação do vínculo que libera a página própria: o município (prefeitura, "Meu município") ou o CNPJ (as outras
  // organizações, "Minha organização"). D1 A44 (12/11/2026): antes só a prefeitura via a situação aqui, e a falha de
  // leitura passava por "em conferência" (o mesmo de A28).
  const situacoes = new Map<string, AcessoFicha | AcessoCnpj>(
    await Promise.all(
      todas.map(async (o: Organizacao) =>
        o.tipo === "municipio"
          ? ([o.id, podeVerMunicipio("aprovado", o, await lerVinculo(o.id))] as const)
          : ([o.id, podeVerEntidadePropria("aprovado", o, await lerVinculoCnpj(o.id))] as const),
      ),
    ),
  );
  const rotuloVinculo = (o: Organizacao) => {
    const s = situacoes.get(o.id);
    if (!s) return null;
    if (o.tipo === "municipio") {
      if (s.ok) return <LinkMapa href="/mapa/meu-municipio">município confirmado · ver a página do município</LinkMapa>;
      const motivo = (s as AcessoFicha & { ok: false }).motivo;
      if (motivo === "sem_ibge") return "sem município no cadastro";
      if (motivo === "leitura_falhou") return "vínculo não lido agora";
      if (motivo === "municipio_mudou") return "o município mudou depois da confirmação";
      return "município em conferência pela PONTE";
    }
    if (s.ok) return <LinkMapa href="/mapa/minha-organizacao">CNPJ confirmado · ver a página da organização</LinkMapa>;
    const motivo = (s as AcessoCnpj & { ok: false }).motivo;
    if (motivo === "sem_cnpj") return "sem CNPJ no cadastro";
    if (motivo === "leitura_falhou") return "vínculo não lido agora";
    if (motivo === "cnpj_mudou") return "o CNPJ mudou depois da confirmação";
    return "CNPJ em conferência pela PONTE";
  };

  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha" style={{ marginBottom: "1.4rem" }}>
        <p className="pa-kicker">Conta</p>
        <h1 className="pa-titulo">Quem é a entidade</h1>
        <p className="pa-sub">
          Declarar a entidade é opcional e não bloqueia nada no Mapa. O tipo (prefeitura, OSC, empresa, instituição de
          pesquisa) é o que liga a conta à página da própria organização: a prefeitura confirmada vê o «Meu município», e a OSC
          entra pelo CNPJ. O catálogo ainda não filtra as janelas pelo tipo declarado; o radar de saúde já diz em que papel cada
          tipo entra.
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
                <span className="pa-mono">{ROTULO_PAPEL[o.papel]}</span>
                {situacoes.has(o.id) && <span className="pa-mono">{rotuloVinculo(o)}</span>}
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
        <LinkMapa href="/mapa">Voltar ao Mapa</LinkMapa>
      </p>
    </div>
  );
}
