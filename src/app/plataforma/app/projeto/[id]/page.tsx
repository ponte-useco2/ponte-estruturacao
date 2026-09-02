import { notFound } from "next/navigation";
import { PROJETOS, projetoPor } from "../../_lib/fixtures";
import { FichaClient } from "./FichaClient";

/** Só existem os PJF ilustrativos — qualquer outro id é 404, não uma ficha vazia. */
export function generateStaticParams() {
  return PROJETOS.map((p) => ({ id: p.id }));
}

export default async function ProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projeto = projetoPor(decodeURIComponent(id));
  if (!projeto) notFound();
  return <FichaClient projeto={projeto} />;
}
