import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { FadeIn } from "@/components/ui/FadeIn";
import { CheckCircle2, MessageCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pagamento confirmado — Centelha 3 PB | Ponte Projetos",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ObrigadoPage() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />

      <main className="flex-1 pb-24">
        <Section className="pt-16 md:pt-24 pb-20 bg-slate-50">
          <div className="max-w-2xl mx-auto text-center">
            <FadeIn direction="up">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-6">
                <CheckCircle2 className="w-12 h-12 text-emerald-700" />
              </div>

              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
                Pagamento confirmado!
              </h1>

              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                Recebemos sua contratação da Etapa 1 do Centelha 3 PB. Nossa
                equipe vai entrar em contato em até <strong>24 horas úteis</strong>{" "}
                pelo WhatsApp e e-mail para iniciar o pré-diagnóstico.
              </p>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 text-left mb-8">
                <h3 className="text-base font-bold text-slate-900 mb-4">
                  Próximos passos
                </h3>
                <ol className="space-y-3 text-sm text-slate-600">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs">
                      1
                    </span>
                    Você receberá um e-mail de confirmação do Asaas com o
                    comprovante.
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs">
                      2
                    </span>
                    Em até 24h úteis, agendamos uma reunião de imersão para
                    coletar informações da sua ideia.
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs">
                      3
                    </span>
                    Iniciamos a estruturação da proposta com base nos critérios
                    do edital.
                  </li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="https://wa.me/5583996428315?text=Ol%C3%A1!%20Acabei%20de%20contratar%20a%20Etapa%201%20do%20Centelha%203%20PB."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 px-6 text-base font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Falar no WhatsApp agora
                </a>
                <Link
                  href="/centelha-3-pb"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-base font-medium text-slate-900 transition-all hover:bg-slate-50"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar à página
                </Link>
              </div>
            </FadeIn>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
