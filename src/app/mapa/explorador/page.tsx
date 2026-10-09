import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { diaBrasilia } from "@/lib/oportunidades/datas";
import { nivelDoTopo, pilhaDaUrl, profundidade } from "@/lib/oportunidades/explorador";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { lerExplorador } from "./camadas.server";
import { ExploradorConteudo } from "./ExploradorConteudo";

export const metadata: Metadata = {
  title: "Explorador (protótipo) · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * O explorador em camadas (C3a, 09/10/2026; protótipo da onda 5): o Mapa navegado como uma descida em profundidade —
 * Brasil › UF › município › entidade › instrumento. Spike para provar a experiência; não substitui as páginas de nível.
 *
 * Só administrador: quem não é vai para /mapa sem saber que a página existe (como o radar). Fora do menu: chega-se
 * pelo endereço. O estado é o endereço (`?uf=PB&ibge=…&cnpj=…&instrumento=…`, ver `lib/oportunidades/explorador.ts`),
 * então dá para compartilhar, recarregar e voltar pelo navegador. Cada troca de camada é uma navegação para esta mesma
 * página com outros parâmetros; o palco (`Palco.tsx`) continua montado e anima a troca.
 */
export default async function ExploradorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const l = await lerExplorador(pilhaDaUrl(await searchParams), diaBrasilia(new Date().toISOString()));
  const p = l.pilha;
  // Sem CNPJ nem número de instrumento no registro: a camada, a profundidade, o território e a vista bastam para medir.
  after(() =>
    registrarUso(visitante, "mapa_explorador", {
      camada: nivelDoTopo(p),
      profundidade: profundidade(p),
      uf: p.uf ?? "BR",
      ibge: p.ibge ?? undefined,
      vista: p.vista ?? "automatica",
    }),
  );
  return <ExploradorConteudo l={l} />;
}
