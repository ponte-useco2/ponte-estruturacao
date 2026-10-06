/**
 * O nível de acesso de quem abre a página de um município (F1, decisão D1 de 06/10/2026). O cliente é o
 * aprovado cuja organização ativa é a prefeitura daquele IBGE, com o vínculo confirmado por um administrador:
 * o mesmo portão do "Meu município" (`lerAcessoFicha`).
 */
import { ehAdministrador, type Visitante } from "@/lib/supabase-auth";
import { lerAcessoFicha } from "./cliente.server";
import { nivelDeAcesso, type NivelAcesso } from "./pagina-municipio";

export async function nivelNoMunicipio(visitante: Visitante | null, ibge: string): Promise<NivelAcesso> {
  if (!visitante || visitante.status !== "aprovado") return 0;
  if (ehAdministrador(visitante.email)) return 3;
  const { acesso } = await lerAcessoFicha(visitante);
  return nivelDeAcesso({ aprovado: true, administrador: false, clienteDoMunicipio: acesso.ok && acesso.ibge === ibge });
}
