import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { authConfigurada, visitanteAtual } from "@/lib/supabase-auth";
import { CarteiraClient, type Prazos, type Tela } from "./CarteiraClient";
import { IDS_MUNICIPIO } from "./dados";

/**
 * Carteira Territorial da Serra do Teixeira — área reservada.
 *
 * `noindex`: a tela nomeia pendências de prefeituras específicas ("prestação
 * de contas rejeitada", "convênio rescindido") e mede a conversão de
 * parlamentares nominados. É material de trabalho da operação, não peça
 * pública — indexar uma rota que redireciona para login só produziria
 * resultado de busca levando a porta fechada.
 */
export const metadata: Metadata = {
  title: "Carteira Territorial da Serra do Teixeira | Ponte",
  description:
    "Operação da carteira executiva do entorno do PARNA da Serra do Teixeira. Acesso restrito.",
  robots: { index: false, follow: false },
};

/** O portão de acesso lê cookie de sessão: nada aqui pode ser pré-renderizado. */
export const dynamic = "force-dynamic";

/** Telas válidas — o que vier fora desta lista cai no cockpit. */
const TELAS: Tela[] = [
  "cockpit",
  "lista",
  "municipio",
  "carteira",
  "articulacao",
  "diligencias",
  "inteligencia",
];

/**
 * Dias inteiros entre hoje e uma data, no fuso de Brasília.
 *
 * O servidor da Vercel roda em UTC. Contado direto em UTC, o prazo vira o do
 * dia seguinte durante as três primeiras horas de cada dia brasileiro — numa
 * tela cujo assunto é prazo, isso é erro visível. Por isso a data de hoje sai
 * de um Intl com timeZone explícito, e a subtração acontece em dias inteiros
 * de calendário, sem hora.
 */
function diasAte(alvoISO: string): number {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [ay, am, ad] = alvoISO.split("-").map(Number);
  const [hy, hm, hd] = hoje.split("-").map(Number);

  const MS_DIA = 86400000;
  const delta = (Date.UTC(ay, am - 1, ad) - Date.UTC(hy, hm - 1, hd)) / MS_DIA;
  return Math.max(0, delta);
}

export default async function CarteiraPage({
  searchParams,
}: {
  searchParams: Promise<{ tela?: string; municipio?: string }>;
}) {
  // Sem Supabase configurado, a porta fecha. Nunca abre por omissão.
  if (!authConfigurada()) redirect("/oportunidades/entrar?erro=config");

  // `next` faz o visitante voltar para cá depois do Google, em vez de cair no
  // painel de Oportunidades. A rota de callback já valida o destino.
  const visitante = await visitanteAtual();
  if (!visitante) redirect("/oportunidades/entrar?next=/carteira");
  if (visitante.status !== "aprovado") redirect("/oportunidades/aguardando");

  const { tela, municipio } = await searchParams;

  const telaInicial: Tela =
    tela && (TELAS as string[]).includes(tela) ? (tela as Tela) : "cockpit";
  const municipioInicial =
    municipio && IDS_MUNICIPIO.includes(municipio) ? municipio : "teixeira";

  const prazos: Prazos = {
    ate30Nov: diasAte("2026-11-30"),
    ate31Dez: diasAte("2026-12-31"),
  };

  return (
    <CarteiraClient
      telaInicial={telaInicial}
      municipioInicial={municipioInicial}
      prazos={prazos}
    />
  );
}
