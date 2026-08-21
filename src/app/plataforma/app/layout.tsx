import type { Metadata } from "next";
import { AppFrame } from "./_componentes/AppFrame";
import "./estilos.css";
import "./componentes.css";

/**
 * `noindex`: o app é um protótipo com dados ilustrativos. Quem indexa
 * /plataforma é a apresentação pública, não esta camada.
 */
export const metadata: Metadata = {
  title: "Plataforma PONTE — protótipo do app",
  description:
    "Protótipo navegável do app da Plataforma PONTE: descobrir capital, apresentar problema ou capacidade, compor coalizão e construir com evidência.",
  robots: { index: false, follow: false },
};

export default function PlataformaAppLayout({ children }: { children: React.ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
