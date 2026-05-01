import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { FadeIn } from "@/components/ui/FadeIn";
import { FormularioCentelha } from "@/components/ui/FormularioCentelha";
import { StickyCheckoutCTA } from "@/components/ui/StickyCheckoutCTA";
import {
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Target,
  Lightbulb,
  TrendingUp,
  Users,
  Leaf,
  Briefcase,
  FileCheck,
  ClipboardCheck,
  FileSignature,
  PenTool,
  Rocket,
  XCircle,
  AlertOctagon,
  AlertTriangle,
  Layers,
  LayoutTemplate,
  Send,
  CheckCircle2,
  Info,
} from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";
import Script from "next/script";
import { centelhaEdital } from "@/config/centelha-edital";

const CANONICAL_URL = "https://ponteprojetos.com.br/centelha-3-pb";
const OG_IMAGE = "https://ponteprojetos.com.br/og-centelha-3-pb.jpg";

export const metadata: Metadata = {
  title: "Consultoria Independente para Centelha 3 PB | Ponte Projetos",
  description:
    "Pré-diagnóstico, estruturação e apoio à submissão de projetos para o Centelha 3 PB. Consultoria independente com foco em aderência ao edital, inovação, mercado, equipe, impacto e consistência da proposta.",
  alternates: {
    canonical: CANONICAL_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: "Consultoria Independente para Centelha 3 PB | Ponte Projetos",
    description:
      "Pré-diagnóstico e estruturação estratégica de propostas para o Centelha 3 PB, com foco nos critérios do edital: inovação, mercado, equipe, impacto, cronograma e orçamento.",
    url: CANONICAL_URL,
    siteName: "Ponte Projetos",
    locale: "pt_BR",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Ponte Projetos — Consultoria independente para estruturação de propostas no Centelha 3 PB",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Consultoria Independente para Centelha 3 PB | Ponte Projetos",
    description:
      "Estruture sua proposta com foco em inovação, mercado, equipe, impacto e consistência avaliativa.",
    images: [OG_IMAGE],
  },
};

// JSON-LD: ProfessionalService
const professionalServiceSchema = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Ponte Projetos",
  legalName: "Ponte Estruturação de Projetos de Impacto Inova Simples (I.S.)",
  description:
    "Consultoria independente para pré-diagnóstico, estruturação e apoio à submissão de propostas de inovação em editais públicos.",
  url: CANONICAL_URL,
  taxID: "64.318.188/0001-01",
  address: {
    "@type": "PostalAddress",
    streetAddress: "R. Cassimiro de Abreu, 56, Sala 5",
    addressLocality: "João Pessoa",
    addressRegion: "PB",
    postalCode: "58033-330",
    addressCountry: "BR",
  },
  telephone: "+55 83 9642-8315",
  email: "diretoria.ponte.projetos@gmail.com",
  areaServed: {
    "@type": "State",
    name: "Paraíba",
  },
  serviceType: "Consultoria em projetos de inovação e editais públicos",
  provider: {
    "@type": "Organization",
    name: "Ponte Projetos",
    url: "https://ponteprojetos.com.br",
  },
};

// JSON-LD: FAQPage (apenas as 3 perguntas mais estratégicas — as que aparecem visíveis no FAQ)
const faqPageSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "A consultoria garante aprovação no Centelha 3 PB?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Não. A consultoria não garante aprovação. O serviço consiste em pré-diagnóstico, estruturação estratégica, organização documental e apoio à submissão, buscando reduzir riscos de inconsistência conforme os critérios do edital. A decisão final cabe exclusivamente à banca avaliadora e às regras oficiais do programa.",
      },
    },
    {
      "@type": "Question",
      name: "A Ponte Projetos tem vínculo com a FAPESQ, Finep, CNPq ou Programa Centelha?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Não. A Ponte Projetos atua como consultoria independente, sem vínculo institucional com FAPESQ, Finep, CNPq, Fundação CERTI ou Programa Centelha.",
      },
    },
    {
      "@type": "Question",
      name: "A Etapa 1 pode ser paga com recursos do edital?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Não. A Etapa 1 é uma contratação privada anterior à eventual aprovação do projeto e não deve ser tratada como despesa reembolsável pelo edital.",
      },
    },
  ],
};

// JSON-LD: BreadcrumbList
const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Início",
      item: "https://ponteprojetos.com.br",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Jornada Centelha 3 PB",
      item: CANONICAL_URL,
    },
  ],
};

const evaluationCriteria = [
  {
    icon: Lightbulb,
    title: "Solução e grau de inovação",
    desc: "Organizamos problema, solução, estágio de desenvolvimento, grau de inovação e diferenciais técnicos com foco na maior nota.",
  },
  {
    icon: TrendingUp,
    title: "Mercado e potencial de escala",
    desc: "Estruturamos segmento de clientes, proposta de valor, concorrência, modelo de monetização e potencial de escala.",
  },
  {
    icon: Users,
    title: "Equipe e domínio tecnológico",
    desc: "Auxiliamos a evidenciar a capacidade técnica e de gestão da equipe, critério crucial de viabilidade de execução.",
  },
  {
    icon: Leaf,
    title: "Impacto socioambiental positivo",
    desc: "Conectando o projeto a impactos mensuráveis, indicadores verificáveis e aderência às prioridades do edital.",
  },
  {
    icon: Briefcase,
    title: "Consistência da proposta",
    desc: "Garantimos o alinhamento central entre modelo de negócio, cronograma e orçamento, blindando a proposta contra notas eliminatórias.",
  },
  {
    icon: FileCheck,
    title: "Cronograma físico e orçamento defensáveis",
    desc: "Revisamos a alocação de recursos e as etapas de desenvolvimento para garantir coerência técnica e respeito às rubricas do edital.",
  },
];

const methodSteps = [
  {
    icon: ClipboardCheck,
    title: "Pré-diagnóstico de aderência",
    desc: "Avaliamos rapidamente o potencial da sua ideia e o alinhamento com os eixos do Centelha 3 PB.",
  },
  {
    icon: FileSignature,
    title: "Contratação da estruturação",
    desc: "Assinatura do contrato de prestação de serviços e pagamento da taxa de setup para início dos trabalhos.",
    highlight: true,
  },
  {
    icon: PenTool,
    title: "Construção da proposta",
    desc: "Desenvolvimento técnico de todos os itens do formulário: inovação, mercado, equipe, cronograma e orçamento.",
  },
  {
    icon: Rocket,
    title: "Revisão e acompanhamento",
    desc: "Revisão final, apoio à submissão e acompanhamento estratégico até a divulgação dos resultados.",
  },
];

const risks = [
  "Solução descrita de forma genérica.",
  "Grau de inovação mal demonstrado.",
  "Mercado sem evidência.",
  "Equipe sem domínio tecnológico claro.",
  "Impacto socioambiental tratado como acessório.",
  "Cronograma e orçamento inconsistentes.",
  "Anexos fracos, ilegíveis ou desalinhados.",
  "Proposta escrita como apresentação comercial, não como peça avaliativa.",
];

const deliverables = [
  { icon: Target, title: "Diagnóstico de aderência ao edital" },
  { icon: AlertTriangle, title: "Mapa de riscos da proposta" },
  { icon: Layers, title: "Estruturação da solução e diferenciais" },
  { icon: PenTool, title: "Redação orientada aos critérios da banca" },
  {
    icon: LayoutTemplate,
    title: "Organização de mercado, impacto, equipe e orçamento",
  },
  { icon: Send, title: "Apoio à submissão da proposta" },
];

const faqs = [
  {
    q: "A Ponte tem vínculo com a FAPESQ, Programa Centelha ou banca avaliadora?",
    a: "Não. A atuação é independente, privada e consultiva.",
  },
  {
    q: "A consultoria garante aprovação?",
    a: "Não. A decisão é exclusiva da banca avaliadora, conforme critérios oficiais do edital.",
  },
  {
    q: "Posso submeter sozinho?",
    a: "Sim. A consultoria é opcional e voltada a quem deseja reduzir riscos de inconsistência, fragilidade de mercado, orçamento incoerente ou baixa clareza da inovação.",
  },
  {
    q: "A Etapa 1 pode ser paga com recurso do edital?",
    a: "Não. A Etapa 1 é anterior à contratação pública do projeto e não deve ser apresentada como despesa reembolsável.",
  },
  {
    q: "O valor pós-aprovação pode entrar no projeto?",
    a: "Sim. A etapa de Acompanhamento Técnico Pós-Aprovação pode ser contratada como prestação de serviço técnico especializado e inserida no orçamento do projeto, condicionada à aprovação dessa rubrica pela banca avaliadora.",
  },
  {
    q: "Posso participar como pessoa física?",
    a: "Sim. Você pode submeter sua ideia como pessoa física nas fases iniciais. Caso seu projeto seja aprovado para contratação, você deverá constituir a empresa (CNPJ) no estado da Paraíba para o recebimento da subvenção.",
  },
  {
    q: "Minha empresa precisa estar constituída?",
    a: "Não é necessário ter empresa aberta para iniciar a submissão. Se você já tem uma empresa, ela deve estar sediada na Paraíba e ter faturamento anual bruto de até R$ 4,8 milhões (microempresa ou EPP).",
  },
  {
    q: "MEI pode contratar?",
    a: "Sim. Microempreendedores Individuais (MEI) são elegíveis para participar do edital, desde que o objeto da empresa seja compatível com o desenvolvimento do projeto de inovação.",
  },
  {
    q: "Servidor público pode participar?",
    a: "Sim, porém deve observar rigorosamente a legislação própria (como dedicação exclusiva) e as restrições quanto ao acúmulo de bolsas, caso aplique para a cota de R$ 50.000,00.",
  },
  {
    q: "O que acontece se a documentação estiver incompleta?",
    a: "O envio incompleto de anexos, documentos fora do padrão ou ausência de informações obrigatórias gera a eliminação automática do projeto na fase de triagem. Nossa assessoria minimiza esse risco com dupla checagem documental.",
  },
];

export default function CentelhaPage() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      {/* JSON-LD Schemas */}
      <Script
        id="schema-professional-service"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(professionalServiceSchema),
        }}
      />
      <Script
        id="schema-faq-page"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema) }}
      />
      <Script
        id="schema-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <Header />

      <main className="flex-1 pb-40 sm:pb-32">
        {/* ======================= HERO ======================= */}
        <Section
          id="hero"
          isDark
          className="pt-20 md:pt-32 pb-24 border-b border-slate-800 relative overflow-hidden bg-slate-900 text-white"
        >
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-3xl -z-10" />

          <div className="max-w-4xl mx-auto text-center">
            <FadeIn direction="up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/20 rounded-full mb-6">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white tracking-wider uppercase">
                  Método Espelho de Banca
                </span>
              </div>
            </FadeIn>

            <FadeIn direction="up" delay={0.1}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
                Consultoria independente para o{" "}
                <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                  Centelha 3 PB
                </span>
              </h1>
            </FadeIn>

            <FadeIn direction="up" delay={0.2}>
              <p className="text-lg md:text-xl text-slate-300 mb-6 max-w-2xl mx-auto leading-relaxed">
                Sua ideia inovadora estruturada como proposta competitiva.
                Diagnóstico, estratégia e estruturação com foco nos critérios
                oficiais de avaliação: solução, mercado, equipe, impacto e
                consistência da proposta.
              </p>
            </FadeIn>

            <FadeIn direction="up" delay={0.3}>
              <div className="inline-flex items-center gap-2 mb-8 text-sm text-slate-300">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>
                  Experiência em estruturação de projetos de inovação e
                  captação de recursos não reembolsáveis.
                </span>
              </div>
            </FadeIn>

            <FadeIn direction="up" delay={0.4}>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="#diagnostico-centelha"
                  className="inline-flex h-14 items-center justify-center rounded-xl bg-emerald-600 px-8 text-base md:text-lg font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
                >
                  Solicitar Pré-Diagnóstico
                  <ChevronRight className="ml-2 w-5 h-5" />
                </Link>
                <Link
                  href="#metodo-centelha"
                  className="inline-flex h-14 items-center justify-center rounded-xl border border-white/20 bg-transparent px-8 text-base md:text-lg font-medium text-white transition-all hover:bg-white/5"
                >
                  Ver como funciona
                </Link>
              </div>
            </FadeIn>
          </div>
        </Section>

        {/* ======================= OPORTUNIDADE OFICIAL ======================= */}
        <Section className="py-20 border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
              <FadeIn direction="right">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                  Oportunidade Oficial
                </h2>
                <p className="text-lg text-slate-600 mb-5 leading-relaxed">
                  O Centelha 3 PB oferece recursos de subvenção econômica e
                  bolsas para apoiar a transformação de ideias inovadoras em
                  negócios com potencial de mercado.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Um dos maiores gargalos das boas ideias não é a falta de
                  tecnologia, mas a ausência de recursos e estratégia para
                  inserção no mercado. O edital provê o fomento; nossa
                  consultoria, a consistência.
                </p>
              </FadeIn>

              <FadeIn direction="left" delay={0.2}>
                <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-10 shadow-md relative">
                  <div className="absolute -top-3 -right-3 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg">
                    Apenas {centelhaEdital.funnel.finalContractsCount} projetos
                  </div>

                  <h3 className="text-xl font-bold mb-5 flex items-center gap-3 text-slate-900">
                    <Target className="w-6 h-6 text-emerald-600" /> Edital{" "}
                    {centelhaEdital.edition.year}
                  </h3>

                  <div className="mb-6 p-5 bg-emerald-50/50 rounded-xl border border-emerald-100 border-l-4 border-l-emerald-600">
                    <div className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2">
                      {centelhaEdital.funding.maxValueLabel}{" "}
                      <span className="text-base font-normal text-slate-500">
                        por projeto
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 leading-relaxed">
                      {centelhaEdital.funding.maxValueDescription}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">
                        {centelhaEdital.schedule.phase1.label}:
                      </span>
                      <span className="text-slate-900 font-semibold">
                        {centelhaEdital.schedule.phase1.window}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">
                        {centelhaEdital.schedule.phase2Classified.label}:
                      </span>
                      <span className="text-slate-900 font-semibold">
                        {centelhaEdital.schedule.phase2Classified.window}
                      </span>
                    </div>
                    <div className="h-px bg-slate-200 my-1" />
                    <div className="flex justify-between">
                      <span className="text-slate-600">Fase 2 (Ideias):</span>
                      <span className="text-slate-900 font-semibold">
                        {centelhaEdital.funnel.classifiedIdeasLabel}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Fase 2 (Projetos):</span>
                      <span className="text-slate-900 font-semibold">
                        {centelhaEdital.funnel.classifiedProjectsLabel}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Contratação Final:</span>
                      <span className="text-slate-900 font-semibold">
                        {centelhaEdital.funnel.finalContractsLabel}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-center text-xs text-slate-500">
                    *Valores e vagas máximas conforme edital oficial do{" "}
                    {centelhaEdital.edition.label}.
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        </Section>

        {/* ======================= CRITÉRIOS DA BANCA ======================= */}
        <Section
          id="metodo-centelha"
          isDark
          className="py-20 border-b border-slate-200"
        >
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up" className="text-center mb-12 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Avaliamos o que a Banca Avalia
              </h2>
              <p className="text-slate-600">
                O <strong>Método Espelho de Banca</strong> estrutura sua
                proposta exatamente sobre os eixos oficiais de pontuação da Fase
                1 e Fase 2 do Centelha 3 PB.
              </p>
            </FadeIn>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {evaluationCriteria.map((item, idx) => (
                <FadeIn
                  key={idx}
                  direction="up"
                  delay={idx * 0.08}
                  className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7 shadow-sm"
                >
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center mb-5">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mb-2">
                    {item.title}
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </FadeIn>
              ))}
            </div>
          </div>
        </Section>

        {/* ======================= MÉTODO (4 ETAPAS) ======================= */}
        <Section className="py-20 border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up" className="text-center mb-12 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Como funciona
              </h2>
              <p className="text-lg text-slate-600">
                Um fluxo de trabalho otimizado para transformar sua ideia em uma
                proposta competitiva em 4 etapas claras.
              </p>
            </FadeIn>

            <div className="relative">
              <div className="hidden md:block absolute top-12 left-[12%] right-[12%] h-0.5 bg-slate-200 -z-10" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                {methodSteps.map((step, idx) => (
                  <FadeIn
                    key={idx}
                    direction="up"
                    delay={idx * 0.1}
                    className={`bg-white border rounded-2xl p-6 md:p-8 text-center relative shadow-sm ${
                      step.highlight
                        ? "border-emerald-400 border-2 shadow-emerald-100"
                        : "border-slate-200"
                    }`}
                  >
                    {step.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                        Marco Principal
                      </div>
                    )}

                    <div
                      className={`absolute top-6 left-6 text-3xl font-black leading-none ${
                        step.highlight
                          ? "text-emerald-100"
                          : "text-slate-100"
                      }`}
                    >
                      0{idx + 1}
                    </div>

                    <div
                      className={`w-16 h-16 mx-auto mb-5 rounded-full bg-white flex items-center justify-center border-2 ${
                        step.highlight
                          ? "border-emerald-500"
                          : "border-slate-200"
                      } ${step.highlight ? "mt-4" : ""}`}
                    >
                      <step.icon
                        className={`w-7 h-7 ${
                          step.highlight ? "text-emerald-600" : "text-slate-700"
                        }`}
                      />
                    </div>

                    <h4
                      className={`text-base md:text-lg font-bold mb-2 ${
                        step.highlight ? "text-emerald-700" : "text-slate-900"
                      }`}
                    >
                      {step.title}
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {step.desc}
                    </p>
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ======================= RISCOS ======================= */}
        <Section className="py-20">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up">
              <div className="bg-white border border-red-100 rounded-3xl p-8 md:p-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/[0.03] rounded-full blur-3xl -z-10" />

                <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                  <div>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-50 border border-red-200 rounded-full mb-5">
                      <AlertOctagon className="w-4 h-4 text-red-600" />
                      <span className="text-xs font-bold text-red-700 tracking-wider uppercase">
                        Atenção ao Risco
                      </span>
                    </div>

                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 leading-tight">
                      Por que boas ideias{" "}
                      <span className="text-red-600">perdem pontos</span> no
                      Centelha?
                    </h2>
                    <p className="text-lg text-slate-600 leading-relaxed">
                      O edital é rigoroso. A desclassificação ocorre
                      frequentemente por preenchimento incompleto ou falha na
                      adequação aos critérios da banca. Não basta ser inovador;
                      é preciso ser claro e defensável.
                    </p>
                  </div>

                  <ul className="space-y-3">
                    {risks.map((risk, idx) => (
                      <FadeIn
                        key={idx}
                        direction="up"
                        delay={idx * 0.05}
                        className="flex gap-3 items-start p-4 bg-slate-50 border border-slate-200 border-l-[3px] border-l-red-500 rounded-lg"
                      >
                        <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">{risk}</span>
                      </FadeIn>
                    ))}
                  </ul>
                </div>

                <div className="mt-12 pt-10 border-t border-red-100 text-center">
                  <p className="text-lg md:text-xl font-medium text-slate-900 mb-6">
                    O objetivo do pré-diagnóstico é identificar esses riscos
                    antes da submissão.
                  </p>
                  <Link
                    href="#diagnostico-centelha"
                    className="inline-flex h-14 items-center justify-center rounded-xl bg-emerald-600 px-8 text-lg font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
                  >
                    Solicitar Pré-Diagnóstico
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </div>
              </div>
            </FadeIn>
          </div>
        </Section>

        {/* ======================= ENTREGÁVEIS ======================= */}
        <Section isDark className="py-20 border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up" className="text-center mb-12 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                O que você recebe na Etapa 1
              </h2>
              <p className="text-slate-600">
                Entregáveis claros e organizados para garantir que sua ideia vá
                para a banca com a melhor estrutura possível.
              </p>
            </FadeIn>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {deliverables.map((item, idx) => (
                <FadeIn
                  key={idx}
                  direction="up"
                  delay={idx * 0.08}
                  className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-4 shadow-sm"
                >
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 leading-snug m-0">
                    {item.title}
                  </h4>
                </FadeIn>
              ))}
            </div>

            <FadeIn direction="up" className="text-center mt-12">
              <Link
                href="#diagnostico-centelha"
                className="inline-flex h-14 items-center justify-center rounded-xl bg-emerald-600 px-8 text-lg font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
              >
                Solicitar Pré-Diagnóstico
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </FadeIn>
          </div>
        </Section>

        {/* ======================= PRICING (DUAS ETAPAS) ======================= */}
        <Section className="py-20 border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up" className="text-center mb-12 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Investimento para Competir com{" "}
                <span className="bg-gradient-to-r from-emerald-600 to-slate-900 bg-clip-text text-transparent">
                  Consistência
                </span>
              </h2>
              <p className="text-slate-600">
                Nossa metodologia é dividida em duas etapas para garantir máxima
                transparência e alinhar nosso sucesso ao seu.
              </p>
            </FadeIn>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Etapa 1 */}
              <FadeIn
                direction="up"
                delay={0.1}
                className="bg-white border border-slate-200 rounded-2xl p-8 md:p-10 flex flex-col relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-400" />

                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Etapa 1
                </div>
                <h4 className="text-2xl font-bold text-slate-900 mb-6">
                  Estruturação Técnica
                </h4>

                <div className="mb-8">
                  <span className="text-4xl font-extrabold text-slate-900">
                    {centelhaEdital.pricing.stage1.price}
                  </span>
                  <span className="text-slate-400">
                    {centelhaEdital.pricing.stage1.priceCents}
                  </span>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    A Etapa 1 é uma contratação privada de pré-diagnóstico,
                    estruturação e preparação estratégica da proposta, sem
                    vínculo com recursos públicos do edital. Eventuais serviços
                    posteriores à aprovação deverão observar as regras do
                    edital, o Termo de Outorga, a legislação aplicável e a
                    emissão fiscal correspondente.
                  </p>
                </div>

                <ul className="space-y-3 mb-10 flex-1">
                  {[
                    "Diagnóstico técnico e mercadológico da ideia.",
                    "Estruturação estratégica da proposta.",
                    "Redação alinhada aos critérios de avaliação da banca.",
                    "Apoio à organização e submissão da proposta na plataforma, mediante autorização e fornecimento das informações pelo proponente.",
                  ].map((item, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <CheckCircle2 className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto space-y-3">
                  <Link
                    href="/centelha-3-pb/checkout"
                    className="inline-flex w-full h-14 items-center justify-center rounded-xl bg-emerald-600 px-6 text-base font-semibold text-white shadow-md transition-all hover:bg-emerald-700"
                  >
                    Comprar agora — R$ 2.700
                  </Link>
                  <Link
                    href="#diagnostico-centelha"
                    className="inline-flex w-full h-12 items-center justify-center text-sm text-slate-600 hover:text-emerald-700 underline transition-colors"
                  >
                    Quero conversar antes — pré-diagnóstico gratuito
                  </Link>
                </div>
              </FadeIn>

              {/* Etapa 2 */}
              <FadeIn
                direction="up"
                delay={0.2}
                className="bg-white border border-emerald-300 rounded-2xl p-8 md:p-10 flex flex-col relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-700" />
                <div className="absolute top-5 right-5 bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-bold">
                  Contratação condicionada à aprovação
                </div>

                <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">
                  Etapa 2
                </div>
                <h4 className="text-2xl font-bold text-slate-900 mb-6">
                  Acompanhamento Técnico Pós-Aprovação
                </h4>

                <div className="mb-8">
                  <span className="text-4xl font-extrabold text-slate-900">
                    {centelhaEdital.pricing.stage2.price}
                  </span>
                  <span className="text-slate-400">
                    {centelhaEdital.pricing.stage2.priceCents}
                  </span>
                  <p className="text-sm text-emerald-700 mt-2 font-medium leading-relaxed">
                    A Etapa 2 somente é contratada em caso de avanço/aprovação,
                    mediante novo instrumento, escopo próprio e emissão fiscal
                    específica, sem promessa de contratação, aprovação ou
                    liberação de recursos.
                  </p>
                </div>

                <ul className="space-y-3 flex-1">
                  {[
                    "Apoio técnico à execução do projeto.",
                    "Elaboração e revisão do plano de negócio.",
                    "Gestão de cronograma e orçamento aprovado.",
                    "Prestação de contas gerencial e acompanhamento estratégico.",
                    "Observância estrita às regras da FAPESQ.",
                  ].map((item, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </FadeIn>
            </div>

            <FadeIn direction="up" delay={0.3} className="mt-10">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-base font-semibold text-slate-900 mb-1">
                    Importante
                  </h5>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    A contratação da consultoria não garante aprovação. O uso
                    de recursos do projeto dependerá da aderência ao edital, da
                    aprovação do orçamento e das regras do Termo de Outorga da
                    FAPESQ.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </Section>

        {/* ======================= FAQ ======================= */}
        <Section isDark className="py-20 border-b border-slate-200">
          <div className="max-w-3xl mx-auto">
            <FadeIn direction="up" className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 inline-flex items-center gap-3">
                <Info className="w-7 h-7 text-emerald-600" /> FAQ Jurídico-Comercial
              </h2>
              <p className="text-slate-600">
                Transparência e segurança sobre o funcionamento da consultoria e
                regras do edital.
              </p>
            </FadeIn>

            <FadeIn direction="up" delay={0.15} className="space-y-3">
              {faqs.map((faq, idx) => (
                <details
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden group"
                >
                  <summary className="px-5 py-4 md:px-6 md:py-5 cursor-pointer list-none flex justify-between items-center gap-4 hover:bg-slate-50 transition-colors">
                    <h4 className="text-base font-semibold text-slate-900 m-0 group-open:text-emerald-700 transition-colors">
                      {faq.q}
                    </h4>
                    <span className="text-emerald-600 transition-transform group-open:rotate-180 shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-5 pb-5 md:px-6 md:pb-6 border-t border-slate-200 pt-4">
                    <p className="text-sm md:text-base text-slate-600 leading-relaxed m-0">
                      {faq.a}
                    </p>
                  </div>
                </details>
              ))}
            </FadeIn>
          </div>
        </Section>

        {/* ======================= DIAGNÓSTICO (FORM) ======================= */}
        <Section
          id="diagnostico-centelha"
          className="py-20 bg-slate-50 border-b border-slate-200"
        >
          <div className="max-w-4xl mx-auto">
            <FadeIn direction="up" className="text-center mb-10">
              <div className="inline-flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide mb-5">
                Pré-Diagnóstico Centelha 3 PB
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 leading-tight">
                Dê o Primeiro Passo
              </h2>
              <p className="text-lg text-slate-600 max-w-xl mx-auto">
                Responda este pré-diagnóstico (2–3 minutos) para avaliarmos a
                aderência da sua ideia ao edital Centelha 3 PB.
              </p>
            </FadeIn>

            <FadeIn direction="up" delay={0.15}>
              <FormularioCentelha />
            </FadeIn>

            <FadeIn
              direction="up"
              delay={0.25}
              className="flex flex-wrap items-center justify-center gap-4 mt-10"
            >
              {[
                "Sem custo",
                "Sem compromisso",
                "Confidencialidade garantida",
              ].map((tag, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-sm text-slate-600 font-medium"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {tag}
                </div>
              ))}
            </FadeIn>
          </div>
        </Section>

        {/* ======================= COMPLIANCE NOTICE ======================= */}
        <Section className="py-12">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm text-slate-500 leading-relaxed">
              Serviço independente de consultoria estratégica.{" "}
              <strong className="text-slate-700">
                Não há vínculo institucional
              </strong>{" "}
              com FAPESQ, Finep, CNPq, Fundação CERTI ou Programa Centelha. A
              contratação não garante aprovação. A aprovação depende
              exclusivamente das regras do edital, da avaliação da banca e da
              conformidade documental do proponente.
            </p>
          </div>
        </Section>
      </main>

      <StickyCheckoutCTA />
      <Footer />
    </div>
  );
}
