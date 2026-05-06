import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { FadeIn } from "@/components/ui/FadeIn";
import { CheckoutFormRoree } from "./CheckoutFormRoree";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout — Parceria Roree | Centelha 3 PB | Ponte Projetos",
  description:
    "Contratação direta da Fase 1 (R$ 500) ou Fase 2 (R$ 1.000) do programa Centelha 3 PB via parceria Ponte × Roree.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutRoreePage() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />

      <main className="flex-1 pb-24">
        <Section className="pt-16 md:pt-24 pb-12 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <FadeIn direction="up">
              <Link
                href="/centelha-3-pb/parceria-roree"
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-700 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar à página
              </Link>

              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide mb-5">
                  Parceria Ponte × Roree
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 leading-tight">
                  Finalize sua contratação
                </h1>
                <p className="text-slate-600 max-w-xl mx-auto">
                  Pagamento por Pix ou Cartão (até 6x sem juros) via Asaas.
                </p>
              </div>
            </FadeIn>

            <FadeIn direction="up" delay={0.15}>
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Carregando checkout...
                  </div>
                }
              >
                <CheckoutFormRoree />
              </Suspense>
            </FadeIn>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
