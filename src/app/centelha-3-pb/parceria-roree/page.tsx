import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { FadeIn } from "@/components/ui/FadeIn";
import { FormularioRoree } from "@/components/ui/FormularioRoree";
import {
  ArrowRight,
  ShieldCheck,
  Lightbulb,
  TrendingUp,
  CheckCircle2,
  Clock,
  Banknote,
  HandshakeIcon,
  Users,
  AlertTriangle,
  Target,
  CircleDollarSign,
} from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";

const CANONICAL_URL =
  "https://ponteprojetos.com.br/centelha-3-pb/parceria-roree";

export const metadata: Metadata = {
  title: "Centelha 3 PB · Parceria Ponte × Roree | Entre com R$ 500",
  description:
    "Modelo de risco compartilhado pra inovadores da Paraíba: pague apenas R$ 1.500 pré-aprovação e os R$ 20k+ só se o Centelha aprovar seu projeto.",
  alternates: { canonical: CANONICAL_URL },
  robots: {
    index: false, // privado, distribuído por link direto
    follow: false,
  },
  openGraph: {
    title: "Centelha 3 PB · Parceria Ponte × Roree",
    description:
      "Entre com R$ 500. Só pague o resto se aprovar. Risco compartilhado entre você, Ponte e Roree pra projetos de inovação na Paraíba.",
    url: CANONICAL_URL,
    siteName: "Ponte Projetos",
    locale: "pt_BR",
    type: "website",
  },
};

export default function ParceriaRoreePage() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />

      <main className="flex-1">
        {/* HERO */}
        <Section className="pt-12 md:pt-20 pb-12 bg-gradient-to-b from-emerald-50 via-white to-white">
          <div className="max-w-4xl mx-auto text-center">
            <FadeIn direction="up">
              <div className="inline-flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide mb-5">
                <HandshakeIcon className="w-3.5 h-3.5 mr-1.5" />
                Parceria Ponte × Roree
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-5 leading-tight">
                Entre com{" "}
                <span className="text-emerald-700">R$ 500</span>.
                <br className="hidden md:block" />
                {" "}Só pague o resto{" "}
                <span className="underline decoration-emerald-500 decoration-4 underline-offset-4">
                  se aprovar
                </span>.
              </h1>
              <p className="text-lg md:text-xl text-slate-700 max-w-3xl mx-auto leading-relaxed mb-8">
                Estruturação técnica completa pro{" "}
                <strong>Centelha 3 PB</strong> com risco compartilhado: você
                paga só R$ 1.500 pra estruturar a proposta. Se o projeto for
                aprovado pela FAPESQ (até R$ 135k), o restante sai do próprio
                edital.
              </p>
            </FadeIn>

            <FadeIn direction="up" delay={0.15}>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
                <a
                  href="#diagnostico"
                  className="inline-flex h-14 items-center justify-center rounded-xl bg-emerald-600 px-8 text-lg font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
                >
                  Fazer pré-diagnóstico (gratuito)
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
                <a
                  href="#como-funciona"
                  className="inline-flex h-14 items-center justify-center rounded-xl border border-slate-300 bg-white px-8 text-lg font-semibold text-slate-900 transition-all hover:bg-slate-50"
                >
                  Como funciona
                </a>
              </div>
            </FadeIn>

            {/* Números rápidos */}
            <FadeIn direction="up" delay={0.3}>
              <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-2xl md:text-3xl font-extrabold text-emerald-700">
                    R$ 500
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Fase 1 — Diagnóstico
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-2xl md:text-3xl font-extrabold text-emerald-700">
                    R$ 1.000
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Fase 2 — Estruturação
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-2xl md:text-3xl font-extrabold text-emerald-700">
                    R$ 135k
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Subvenção possível
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </Section>

        {/* COMO FUNCIONA */}
        <Section id="como-funciona" className="py-16 md:py-24">
          <div className="max-w-5xl mx-auto">
            <FadeIn direction="up">
              <div className="text-center mb-12">
                <div className="inline-block text-xs font-bold text-emerald-700 uppercase tracking-wide mb-3">
                  Como funciona
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
                  3 momentos. Risco distribuído.
                </h2>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                  Entrada baixa, escopo claro e o pagamento das etapas finais
                  só vem se o edital aprovar — saindo direto do recurso público.
                </p>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Passo 1 */}
              <FadeIn direction="up" delay={0.1}>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-emerald-100 text-emerald-700 w-10 h-10 rounded-full flex items-center justify-center font-bold">
                      1
                    </div>
                    <Banknote className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    Fase 1 — R$ 500
                  </h3>
                  <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                    Diagnóstico estratégico da sua ideia: aderência ao edital,
                    pontos fortes, lacunas e plano de ação. Entrega em até{" "}
                    <strong>5 dias úteis</strong>.
                  </p>
                  <div className="text-xs text-slate-500 border-t border-slate-100 pt-3 mt-3">
                    Se descobrirmos que sua ideia não tem chance, paramos aqui.
                    Você economiza tempo e dinheiro.
                  </div>
                </div>
              </FadeIn>

              {/* Passo 2 */}
              <FadeIn direction="up" delay={0.2}>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-emerald-100 text-emerald-700 w-10 h-10 rounded-full flex items-center justify-center font-bold">
                      2
                    </div>
                    <Lightbulb className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    Fase 2 — R$ 1.000
                  </h3>
                  <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                    Estruturação técnica completa: redação da proposta,
                    modelo de negócio, projeção financeira, plano de equipe,
                    cronograma, indicadores. Em até <strong>15 dias úteis</strong>.
                  </p>
                  <div className="text-xs text-slate-500 border-t border-slate-100 pt-3 mt-3">
                    Você submete a proposta finalizada na plataforma Centelha
                    dentro do prazo (25/05/2026).
                  </div>
                </div>
              </FadeIn>

              {/* Passo 3 */}
              <FadeIn direction="up" delay={0.3}>
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-emerald-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">
                      3
                    </div>
                    <TrendingUp className="w-6 h-6 text-emerald-700" />
                  </div>
                  <h3 className="text-xl font-bold text-emerald-900 mb-2">
                    Aprovou? R$ 10k + R$ 10k
                  </h3>
                  <p className="text-sm text-emerald-900 mb-3 leading-relaxed">
                    Se o Centelha aprovar, recebe até <strong>R$ 135k</strong> da
                    FAPESQ. Desse recurso, R$ 10k vai pra Roree (dev de
                    sistemas) e R$ 10k pra Ponte (gestão e prestação de contas).
                  </p>
                  <div className="text-xs text-emerald-800 border-t border-emerald-200 pt-3 mt-3 font-medium">
                    ✓ Não aprovou? Você pagou só R$ 1.500. Fim.
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </Section>

        {/* PRA QUEM É */}
        <Section className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <FadeIn direction="up">
              <div className="text-center mb-10">
                <div className="inline-block text-xs font-bold text-emerald-700 uppercase tracking-wide mb-3">
                  Pra quem é
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
                  Aceitamos só 10 projetos por ciclo
                </h2>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                  Pra manter o modelo viável, filtramos rigorosamente. Sua
                  ideia precisa atender estes critérios:
                </p>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {[
                {
                  icon: ShieldCheck,
                  title: "Sediado na Paraíba",
                  desc: "Pessoa física, MEI, ME, EPP ou Inova Simples (I.S.)",
                },
                {
                  icon: Users,
                  title: "Equipe mínima de 3 pessoas",
                  desc: "Cadastradas na plataforma do Centelha",
                },
                {
                  icon: Target,
                  title: "Componente claro de inovação",
                  desc: "Tecnologia, processo, modelo ou impacto novo",
                },
                {
                  icon: CircleDollarSign,
                  title: "Faturamento até R$ 4,8M/ano",
                  desc: "Empresas de pequeno porte (Simples Nacional)",
                },
              ].map((item, i) => (
                <FadeIn direction="up" delay={0.1 + i * 0.05} key={i}>
                  <div className="flex gap-4 items-start bg-white p-5 rounded-xl border border-slate-200">
                    <div className="bg-emerald-100 text-emerald-700 w-11 h-11 rounded-lg flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 mb-0.5">
                        {item.title}
                      </div>
                      <div className="text-sm text-slate-600">{item.desc}</div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>

            <FadeIn direction="up" delay={0.4}>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 max-w-3xl mx-auto">
                <div className="flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <strong>Por que filtramos?</strong> Como nossa receita real
                    só vem se sua proposta for aprovada, precisamos selecionar
                    projetos com chance real de passar. Quem não atende esses
                    critérios pode contratar via{" "}
                    <Link
                      href="/centelha-3-pb"
                      className="underline font-medium hover:text-amber-700"
                    >
                      modelo padrão
                    </Link>
                    {" "}(R$ 2.700, sem risco compartilhado).
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </Section>

        {/* O QUE ENTREGAMOS */}
        <Section className="py-16 md:py-24">
          <div className="max-w-5xl mx-auto">
            <FadeIn direction="up">
              <div className="text-center mb-12">
                <div className="inline-block text-xs font-bold text-emerald-700 uppercase tracking-wide mb-3">
                  O que está incluído
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
                  Nas Fases 1 e 2 você recebe
                </h2>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-2 gap-3 max-w-3xl mx-auto">
              {[
                "Diagnóstico de aderência ao edital (em até 5 dias)",
                "Análise de inovação, mercado e impacto",
                "Modelo de negócio defensável e mensurável",
                "Projeção financeira aderente ao orçamento Centelha",
                "Plano de equipe com papéis e responsabilidades",
                "Cronograma de execução pós-aprovação",
                "Indicadores de impacto socioeconômico (números reais)",
                "Redação técnica completa da proposta",
                "Revisão final antes da submissão",
                "Apoio direto via WhatsApp em todo o processo",
              ].map((item, i) => (
                <FadeIn direction="up" delay={0.05 * i} key={i}>
                  <div className="flex gap-3 items-start py-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-slate-800">{item}</span>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </Section>

        {/* TIMELINE / URGÊNCIA */}
        <Section className="py-16 md:py-20 bg-slate-900 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <FadeIn direction="up">
              <Clock className="w-12 h-12 text-emerald-400 mx-auto mb-5" />
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
                Prazo do edital: <span className="text-emerald-400">25/05/2026</span>
              </h2>
              <p className="text-lg text-slate-300 mb-3 leading-relaxed">
                A estruturação completa leva 2 a 3 semanas. Quanto antes começar,
                mais tempo pra revisar e ajustar antes de submeter.
              </p>
              <p className="text-base text-slate-400 mb-8">
                Faça o pré-diagnóstico agora — ele é gratuito e te dá uma
                resposta objetiva em até 24h úteis.
              </p>
              <a
                href="#diagnostico"
                className="inline-flex h-14 items-center justify-center rounded-xl bg-emerald-500 px-10 text-lg font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-emerald-400"
              >
                Quero fazer o pré-diagnóstico
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
            </FadeIn>
          </div>
        </Section>

        {/* FORMULÁRIO */}
        <Section id="diagnostico" className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <FadeIn direction="up">
              <div className="text-center mb-10">
                <div className="inline-block text-xs font-bold text-emerald-700 uppercase tracking-wide mb-3">
                  Pré-diagnóstico gratuito
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
                  Conte sua ideia em 3 minutos
                </h2>
                <p className="text-lg text-slate-600">
                  Em até 24h úteis te avisamos pelo WhatsApp se sua proposta
                  está apta pra Fase 1 (R$ 500). Sem cobrança nessa etapa.
                </p>
              </div>
            </FadeIn>

            <FadeIn direction="up" delay={0.15}>
              <FormularioRoree />
            </FadeIn>
          </div>
        </Section>

        {/* DISCLAIMER COMPLIANCE */}
        <Section className="py-12">
          <div className="max-w-4xl mx-auto">
            <FadeIn direction="up">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 text-sm text-slate-600 leading-relaxed">
                <p className="mb-3">
                  <strong className="text-slate-900">
                    Sem garantia de aprovação:
                  </strong>{" "}
                  a contratação dos serviços não garante a aprovação do projeto
                  pela FAPESQ. A aprovação depende exclusivamente das regras do
                  Edital Centelha 3 PB, da avaliação da banca examinadora e da
                  conformidade documental do proponente.
                </p>
                <p>
                  <strong className="text-slate-900">Independência:</strong>{" "}
                  Ponte e Roree são empresas privadas independentes, sem
                  vínculo institucional com FAPESQ, Finep, CNPq, Fundação CERTI
                  ou Programa Centelha. Os serviços são contratuais e privados.
                </p>
              </div>
            </FadeIn>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
