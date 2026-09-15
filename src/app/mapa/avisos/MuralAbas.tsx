/**
 * As três partes do mural de avisos. Cada uma tem URL própria (`?mural=`), para o link
 * de um aviso de item seguido poder ser mandado a alguém e o voltar do navegador funcionar.
 */
import Link from "next/link";

export type Mural = "catalogo" | "itens" | "normas";

export function muralDe(valor: string | string[] | undefined): Mural {
  return valor === "itens" || valor === "normas" ? valor : "catalogo";
}

const PARTES: readonly { id: Mural; rotulo: string; href: string }[] = [
  { id: "catalogo", rotulo: "O que mudou no catálogo", href: "/mapa/avisos" },
  { id: "itens", rotulo: "Meus itens", href: "/mapa/avisos?mural=itens" },
  { id: "normas", rotulo: "Normas", href: "/mapa/avisos?mural=normas" },
];

export function MuralAbas({
  atual,
  naoLidas,
}: {
  atual: Mural;
  naoLidas: Partial<Record<Mural, number | null>>;
}) {
  return (
    <div className="pa-pagina mp-mural">
      <nav aria-label="Partes do mural de avisos" className="pa-chips">
        {PARTES.map((p) => {
          const n = naoLidas[p.id];
          return (
            <Link
              key={p.id}
              href={p.href}
              className={`pa-chip${atual === p.id ? " pa-ativo" : ""}`}
              aria-current={atual === p.id ? "page" : undefined}
            >
              {p.rotulo}
              {n ? (
                <span className="pa-chip-contagem">
                  <span className="pa-sr">, </span>
                  {n > 99 ? "99+" : n}
                  <span className="pa-sr"> não {n === 1 ? "lido" : "lidos"}</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
