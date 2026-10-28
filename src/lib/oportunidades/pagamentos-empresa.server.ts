/**
 * A leitura dos pagamentos um a um às empresas de um convênio (onda 19, 28/10/2026; oport_52) — só servidor, só chave de
 * serviço, e só para o administrador (a página confere antes de chamar; D1).
 *
 * Duas páginas de mil ao mesmo tempo: em 28/10/2026 o convênio da PB com mais pagamentos a empresas tinha 1.592 (e só
 * dois passavam de mil). Antes da oport_52 no banco, a tabela não existe: a leitura volta `null` sem erro, e a tela
 * fica como era (só as somas por empresa).
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import type { PagamentoEmpresa } from "./pagamentos-empresa";

const PAGINAS = 2;

export async function lerPagamentosDoConvenio(nr: string, execucaoId: number): Promise<PagamentoEmpresa[] | null> {
  if (!authConfigurada()) return null;
  const db = clienteServidor();
  const paginas = await Promise.all(
    Array.from({ length: PAGINAS }, (_, i) =>
      db
        .from("painel_pagamento")
        .select("cnpj,nr_mov_fin,data,valor,documento,nr_documento")
        .eq("execucao_id", execucaoId)
        .eq("nr_convenio", nr)
        .order("cnpj")
        .order("data", { nullsFirst: false })
        .order("nr_mov_fin")
        .range(i * 1000, i * 1000 + 999),
    ),
  );
  const linhas: PagamentoEmpresa[] = [];
  for (const r of paginas) {
    if (r.error) {
      if (!ehEsquemaAusente(r.error.code)) console.error("lerPagamentosDoConvenio:", r.error.message);
      return null;
    }
    linhas.push(...((r.data ?? []) as PagamentoEmpresa[]));
  }
  return linhas;
}
