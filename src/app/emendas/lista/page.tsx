import { permanentRedirect } from "next/navigation";
import { parametrosDoEndereco } from "@/lib/oportunidades/emendas-publico";
import { anoAtualBrasilia, recorteDaListaAntiga, urlRegistros } from "@/lib/oportunidades/emendas-recorte";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * A lista da versão 1 (`/emendas/lista?q=…&t.emendas.*`) virou a tela de registros da versão 2 (17/11/2026): o endereço
 * velho leva, com redirecionamento permanente, ao recorte equivalente no dicionário novo (CONTRATO §11) — a busca, a
 * forma de repasse, o tipo e a ordem por valor passam; a lista velha não tinha período, então vai a série toda.
 */
export default async function ListaAntiga({ searchParams }: Props) {
  const sp = parametrosDoEndereco(await searchParams);
  permanentRedirect(urlRegistros(recorteDaListaAntiga(sp, anoAtualBrasilia())));
}
