import { Suspense } from "react";
import { OportunidadesClient } from "./OportunidadesClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Oportunidades — janelas abertas de convênio | Ponte",
  description:
    "Painel público das janelas de proposta e emenda abertas no Transferegov. Onde ainda dá pra entrar com proposta de convênio, e quanto tempo falta.",
  alternates: { canonical: "https://ponteprojetos.com.br/oportunidades" },
  openGraph: {
    title: "Oportunidades — janelas abertas de convênio",
    description:
      "Onde ainda dá pra entrar com proposta de convênio, e quanto tempo falta. Dados do Transferegov, atualizado diariamente.",
    url: "https://ponteprojetos.com.br/oportunidades",
    siteName: "Ponte Projetos",
    locale: "pt_BR",
    type: "website",
  },
};

// Estático: shell HTML fica no CDN. JSON é buscado em runtime pelo client.
export default function OportunidadesPage() {
  return (
    <Suspense fallback={null}>
      <OportunidadesClient />
    </Suspense>
  );
}
