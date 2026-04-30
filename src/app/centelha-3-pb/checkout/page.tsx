import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { FadeIn } from "@/components/ui/FadeIn";
import { CheckoutForm } from "./CheckoutForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout — Centelha 3 PB | Ponte Projetos",
  description:
    "Contratação direta da Etapa 1 do programa de estruturação de propostas Centelha 3 PB. Pagamento via Pix ou Cartão.",
  robots: {
    index: false, // não indexar página de checkout
    follow: false,
  },
};

export default function CheckoutPage() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />

      <main className="flex-1 pb-24">
        <Section className="pt-16 md:pt-24 pb-12 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <FadeIn direction="up">
              <Link
                href="/centelha-3-pb"
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-700 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar à página
              </Link>

              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide mb-5">
                  Contratação Direta
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 leading-tight">
                  Finalize sua contratação
                </h1>
                <p className="text-slate-600 max-w-xl mx-auto">
                  Revise os dados, aplique seu código (se tiver) e finalize o
                  pagamento por Pix ou Cartão.
                </p>
              </div>
            </FadeIn>

            <FadeIn direction="up" delay={0.15}>
              <CheckoutForm />
            </FadeIn>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
