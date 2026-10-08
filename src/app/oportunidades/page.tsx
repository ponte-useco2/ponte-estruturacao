import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { OportunidadesClient, type Payload } from "./OportunidadesClient";
import { lerPayload } from "./dados.server";
import { visitanteAtual, authConfigurada } from "@/lib/supabase-auth";
import { registrarEvento } from "./eventos";

/**
 * `noindex`: a página virou área reservada. Manter metadados de indexação
 * numa rota que redireciona para login só produz resultado de busca que leva
 * a uma porta fechada — pior para quem clica do que não aparecer.
 */
export const metadata: Metadata = {
  title: "Oportunidades — janelas abertas de convênio | Ponte",
  description:
    "Painel das janelas de proposta e emenda abertas no Transferegov. Acesso mediante cadastro.",
  robots: { index: false, follow: false },
};

/**
 * Dinâmica, não mais estática.
 *
 * A página lia o JSON em build time e servia HTML pronto — ótimo para SEO e
 * velocidade, incompatível com controle de acesso: uma página pré-renderizada
 * é a mesma para todo mundo, inclusive para quem não entrou.
 *
 * O custo é baixo: o "banco de dados" é um arquivo JSON lido do disco.
 */
export const dynamic = "force-dynamic";

export default async function OportunidadesPage() {
  // Sem Supabase configurado, a porta fecha. Nunca abre por omissão.
  if (!authConfigurada()) redirect("/oportunidades/entrar?erro=config");

  const visitante = await visitanteAtual();
  if (!visitante) redirect("/oportunidades/entrar");
  if (visitante.status !== "aprovado") redirect("/oportunidades/aguardando");

  const payloadInicial: Payload | null = await lerPayload();

  // Registro da entrada. Sem `await` bloqueante seria mais rápido, mas em
  // serverless a função pode ser encerrada antes da gravação terminar — e um
  // registro de auditoria que às vezes não grava não é registro de auditoria.
  await registrarEvento("entrada", { versao: payloadInicial?.versao ?? null });

  return (
    <>
      {/*
        A porta para o Mapa (B11, 08/10/2026; inventário B0, item 2.1): o login sem `next` cai aqui, e nenhum link do
        site levava ao /mapa. Só quem passou pelo portão acima (aprovado) vê esta faixa. Fica fora do
        `OportunidadesClient` para aparecer já no primeiro HTML, antes do painel carregar.
      */}
      <nav className="op-mapa-faixa" aria-label="Mapa de Oportunidades">
        <div className="op-mapa-faixa-wrap">
          <p>O Mapa de Oportunidades reúne as janelas de várias fontes, os avisos do que mudou e as páginas do Brasil, dos estados e dos municípios.</p>
          <Link href="/mapa" prefetch={false} className="op-mapa-faixa-btn">
            Abrir o Mapa de Oportunidades
          </Link>
        </div>
      </nav>
      <Suspense fallback={null}>
        <OportunidadesClient payloadInicial={payloadInicial} />
      </Suspense>
      <style>{ESTILO_FAIXA}</style>
    </>
  );
}

/** A faixa com a porta do Mapa. Tokens da plataforma (--color-pl-*), com literais de reserva, como `estilos-entrada.ts`. */
const ESTILO_FAIXA = `
  .op-mapa-faixa {
    background: var(--color-pl-brand-soft, #dbe8e2);
    border-bottom: 1px solid var(--color-pl-border, #d4ded9);
    color: var(--color-pl-text, #13201d);
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  }
  .op-mapa-faixa-wrap {
    max-width: 1080px; margin: 0 auto; padding: 12px 30px;
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px 20px;
  }
  .op-mapa-faixa p { margin: 0; flex: 1 1 320px; font-size: 14px; line-height: 1.5; }
  .op-mapa-faixa-btn {
    display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px;
    background: var(--color-pl-brand-2, #1e5446); color: #fff; border-radius: 8px;
    font-size: 14px; font-weight: 600; text-decoration: none;
  }
  .op-mapa-faixa-btn:hover { background: var(--color-pl-brand, #0f2d26); }
  .op-mapa-faixa-btn:focus-visible { outline: 2px solid var(--color-pl-brand, #0f2d26); outline-offset: 2px; }
  @media (max-width: 640px) {
    .op-mapa-faixa-wrap { padding: 12px 16px; }
  }
`;
