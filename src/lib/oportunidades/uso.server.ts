/**
 * Registro de uso do Mapa (MVP da carteira, 02/10/2026) — é o que mede o experimento de assinatura: se a pessoa
 * volta sem ser lembrada, que tarefa repete, que análise abre.
 *
 * Mesma tabela e mesma regra do registro do painel antigo (`app/oportunidades/eventos.ts`): quem (id e e-mail),
 * o quê (tipo), detalhe mínimo e quando. Endereço IP e aparelho NÃO são gravados. Só para quem está aprovado.
 * Falha de registro nunca derruba a página: vai para o log do servidor e a navegação segue.
 *
 * Quem visita entra como parâmetro, lido ANTES do `after()`: numa página (Server Component) o Next 16 não
 * deixa ler cookies dentro do `after`, e a leitura antiga (`visitanteAtual()` lá dentro) falhava em silêncio.
 * De 02 a 06/10/2026 nenhuma visita foi gravada por isso; só seguir e deixar de seguir, que são ações.
 */
import { clienteServidor, type Visitante } from "@/lib/supabase-auth";

export type UsoMapa =
  | "mapa_carteira"
  | "mapa_municipio"
  | "mapa_entidade"
  | "mapa_entidade_relatorio"
  | "mapa_organizacoes"
  | "mapa_uf"
  | "mapa_uf_relatorio"
  | "mapa_brasil"
  | "mapa_brasil_relatorio"
  | "mapa_relatorio_municipio"
  | "mapa_laudo_instrumento"
  | "mapa_glossario"
  | "mapa_seguir"
  | "mapa_deixar_de_seguir"
  /** C2 (08/10/2026): a busca unificada. Só o tipo da entrada e a UF, nunca o termo digitado. */
  | "mapa_busca"
  /**
   * C3a (09/10/2026): o protótipo do explorador em camadas (só administrador). A camada aberta, a profundidade, a UF, o
   * município e a vista: o que diz se a descida é usada e até onde vai. A `oport_evento` não restringe o tipo (só chave
   * primária e a do usuário, conferido pelo MCP em 09/10/2026): não precisa de migração.
   */
  | "mapa_explorador";

const TIPOS: readonly UsoMapa[] = ["mapa_carteira", "mapa_municipio", "mapa_entidade", "mapa_entidade_relatorio", "mapa_organizacoes", "mapa_uf", "mapa_uf_relatorio", "mapa_brasil", "mapa_brasil_relatorio", "mapa_relatorio_municipio", "mapa_laudo_instrumento", "mapa_glossario", "mapa_seguir", "mapa_deixar_de_seguir", "mapa_busca", "mapa_explorador"];

/** Só texto curto e número: o detalhe diz o que interessou, não guarda conteúdo. */
export function detalheLimpo(detalhe: Record<string, unknown>): Record<string, string | number | boolean> {
  const limpo: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(detalhe).slice(0, 8)) {
    if (typeof v === "string") limpo[k.slice(0, 40)] = v.slice(0, 80);
    else if (typeof v === "number" && Number.isFinite(v)) limpo[k.slice(0, 40)] = v;
    else if (typeof v === "boolean") limpo[k.slice(0, 40)] = v;
  }
  return limpo;
}

export async function registrarUso(
  visitante: Pick<Visitante, "id" | "email" | "status"> | null,
  tipo: UsoMapa,
  detalhe: Record<string, unknown> = {},
): Promise<void> {
  if (!TIPOS.includes(tipo)) return;
  if (!visitante || visitante.status !== "aprovado") return;
  try {
    const { error } = await clienteServidor().from("oport_evento").insert({
      user_id: visitante.id,
      email: visitante.email,
      tipo,
      detalhe: detalheLimpo(detalhe),
    });
    if (error) console.error("oport_evento (mapa):", error.message);
  } catch (e) {
    console.error("oport_evento (mapa):", e instanceof Error ? e.message : e);
  }
}
