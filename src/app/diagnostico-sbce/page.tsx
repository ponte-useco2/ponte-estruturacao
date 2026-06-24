import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { SimuladorTrilha } from "@/components/ui/SimuladorTrilha";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trilha PONTE de Decisão Legítima | Diagnóstico SBCE — Ponte Projetos",
  description:
    "Autoavaliação executiva de prontidão para o SBCE (mercado regulado de carbono). 12 casas, 4 fases e um Índice de Decisão Legítima — gratuito e sem armazenar seus dados.",
  openGraph: {
    title: "Trilha PONTE de Decisão Legítima | Diagnóstico SBCE",
    description:
      "Descubra, em minutos, onde sua empresa está diante do SBCE e qual o próximo movimento legítimo.",
    type: "website",
  },
};

export default function DiagnosticoSbcePage() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />
      <main className="flex-1 pb-24">
        <Section id="trilha" className="pt-16 md:pt-24 pb-20 relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-emerald-50 rounded-full blur-3xl opacity-60 -z-10" />
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase mb-6">
              Nível 0 · Autoavaliação gratuita
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-5">
              Trilha PONTE de{" "}
              <span className="text-emerald-700">Decisão Legítima</span>
            </h1>
            <p className="text-lg text-slate-600 mb-4 leading-relaxed">
              Um jogo executivo para transformar obrigação, risco e impacto em decisões
              verificáveis. Quatro fases, doze casas, um Índice de Decisão Legítima ao final.
            </p>
            <p className="text-sm text-slate-500 mb-10">
              <span className="font-semibold text-slate-700">A lei do método:</span> não construir
              primeiro; provar onde há disposição real de pagamento. Esta autoavaliação não acusa —
              ela conduz, fase por fase. Suas respostas não são enviadas nem armazenadas.
            </p>
            <SimuladorTrilha />
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
