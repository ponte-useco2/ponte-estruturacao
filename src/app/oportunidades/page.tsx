import { Suspense } from "react";
import fs from "node:fs/promises";
import path from "node:path";
import { OportunidadesClient, type Payload } from "./OportunidadesClient";
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

/**
 * Revalidação de 1h como rede de segurança. Na prática o JSON só muda quando
 * a GitHub Action commita — o que já dispara rebuild completo na Vercel.
 */
export const revalidate = 3600;

/**
 * Lê o payload no servidor, em build time. Ganho sobre o fetch no cliente:
 * o conteúdo vai no HTML (indexável pelo Google, sem depender de execução de
 * JS) e não há flash de esqueleto.
 *
 * A fronteira do contrato continua respeitada: nenhum contato com Transferegov,
 * apenas leitura de um JSON estático já publicado pelo pipeline.
 *
 * Se a leitura falhar, devolve null e o client faz fetch como fallback.
 */
async function lerPayload(): Promise<Payload | null> {
  try {
    const arquivo = path.join(process.cwd(), "public", "dados", "oportunidades.json");
    const bruto = await fs.readFile(arquivo, "utf-8");
    const d = JSON.parse(bruto) as Payload;
    // Contrato: major diferente = incompatível. Devolve null e o client avisa.
    const [major] = String(d.versao ?? "").split(".");
    if (parseInt(major, 10) !== 1) return null;
    return d;
  } catch {
    return null;
  }
}

export default async function OportunidadesPage() {
  const payloadInicial = await lerPayload();
  return (
    <Suspense fallback={null}>
      <OportunidadesClient payloadInicial={payloadInicial} />
    </Suspense>
  );
}
