import { TimelineClient } from "./TimelineClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ConectaImpact GO · Linha do Tempo D0–D365",
  description: "Dashboard operacional privado — cronograma revisado ConectaImpact GO.",
  robots: { index: false, follow: false },
};

// Rota protegida pelo middleware.ts — sem cookie válido, redireciona pra /conecta-impact-go/login
export default function ConectaImpactGoPage() {
  return <TimelineClient />;
}
