import type { Metadata } from "next";
import { after } from "next/server";
import { diaBrasilia } from "@/lib/oportunidades/datas";
import { nivelDoTopo, pilhaDaUrl, profundidade } from "@/lib/oportunidades/explorador";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { visitanteAtual } from "@/lib/supabase-auth";
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
 * Desde 10/11/2026 (D1 A43, decisão do titular): aberto a todo aprovado (nível 1) e com porta no menu; o que cada camada
 * mostra segue o nível de quem olha, porque as leituras são as das páginas de nível. Até então era só administrador. O estado é o endereço (`?uf=PB&ibge=…&cnpj=…&instrumento=…`, ver `lib/oportunidades/explorador.ts`),
 * então dá para compartilhar, recarregar e voltar pelo navegador. Cada troca de camada é uma navegação para esta mesma
 * página com outros parâmetros; o palco (`Palco.tsx`) continua montado e anima a troca.
 */
export default async function ExploradorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

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
