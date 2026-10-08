import { lerAcessoCliente } from "@/lib/oportunidades/cliente.server";
import { nivelNaEntidade } from "@/lib/oportunidades/pagina-entidade";
import type { NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import type { IdentidadeEntidade } from "@/lib/oportunidades/relatorio-municipio.server";
import { ehAdministrador, type Visitante } from "@/lib/supabase-auth";

/**
 * O nível de quem abre a entidade (decisão D1). Saiu da página para um lugar só (C1c, 08/10/2026): a página em abas e
 * o relatório para imprimir precisam dar exatamente o mesmo acesso. O cliente entra pelo município (prefeitura
 * confirmada, oport_12) ou pelo CNPJ (as outras organizações, oport_31); o administrador não precisa da leitura.
 */
export async function nivelDoVisitanteNaEntidade(visitante: Pick<Visitante, "email" | "status">, entidade: IdentidadeEntidade): Promise<NivelAcesso> {
  const administrador = ehAdministrador(visitante.email);
  const acesso = administrador ? null : await lerAcessoCliente(visitante);
  return nivelNaEntidade(
    {
      aprovado: visitante.status === "aprovado",
      administrador,
      ibgeConfirmado: acesso?.municipio.ok ? acesso.municipio.ibge : null,
      cnpjConfirmado: acesso?.cnpj.ok ? acesso.cnpj.cnpj : null,
    },
    entidade,
  );
}
