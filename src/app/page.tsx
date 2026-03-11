import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Target,
  BarChart,
  ShieldCheck,
  Compass,
  Building2,
  Lightbulb,
  HeartHandshake
} from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/ui/FadeIn";
import { DiagnosticoForm } from "@/components/ui/DiagnosticoForm";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />

      <main className="flex-1">
        {/* ========================================================= */}
        {/* BLOCO 1 - HOME (HERO) */}
        {/* ========================================================= */}
        <Section id="inicio" className="relative overflow-hidden pt-24 md:pt-32 pb-32">
          {/* Elemento decorativo abstrato */}
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-slate-50 rounded-full blur-3xl opacity-50 -z-10" />

          <div className="max-w-4xl">
            <FadeIn delay={0.1} direction="up">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1] mb-8">
                Transformamos projetos complexos em propostas financiáveis, aprováveis e executáveis.
              </h1>
            </FadeIn>
            <FadeIn delay={0.2} direction="up">
              <p className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl leading-relaxed">
                Apoiamos startups, PMEs, instituições e iniciativas públicas na estruturação estratégica de projetos de inovação, transformação digital, ESG e captação de recursos — com coerência entre narrativa, orçamento, cronograma, indicadores e execução.
              </p>
            </FadeIn>
            <FadeIn delay={0.3} direction="up" className="flex flex-col sm:flex-row gap-4">
              <Link href="#diagnostico" className="inline-flex h-14 items-center justify-center rounded bg-slate-900 px-8 text-lg font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50">
                Solicitar diagnóstico
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link href="#servicos" className="inline-flex h-14 items-center justify-center rounded border border-slate-300 bg-transparent px-8 text-lg font-medium text-slate-900 transition-all hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50">
                Conhecer serviços
              </Link>
            </FadeIn>
          </div>
        </Section>

        {/* BLOCO 2 e 4 - O PROBLEMA E DIFERENCIAL */}
        <Section isDark className="py-24">
          <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-center">
            <FadeIn direction="right">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Nem toda boa ideia vira um bom projeto.</h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-6">
                Muitas propostas fracassam não por falta de potencial, mas por falta de estrutura. Objetivos genéricos, orçamento desconectado, cronograma frágil, indicadores sem lógica e narrativa mal alinhada comprometem a aprovação e dificultam a execução.
              </p>
              <p className="text-lg text-slate-900 font-semibold">
                Nosso trabalho é reduzir esse ruído e transformamos complexidade em clareza estratégica.
              </p>
            </FadeIn>

            <FadeIn direction="left" delay={0.2} className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-100 relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Target className="w-24 h-24 text-slate-900" />
              </div>
              <h3 className="text-2xl font-bold mb-4 relative z-10">Nosso diferencial não é apenas escrever projetos. É estruturar lógica.</h3>
              <p className="text-slate-600 leading-relaxed relative z-10">
                Atuamos na interseção entre estratégia, inovação, financiamento e execução. Isso significa olhar o projeto não apenas como texto, mas como arquitetura de decisão: proposta de valor, aderência, risco, viabilidade operacional, indicadores e capacidade real de entrega.
              </p>
            </FadeIn>
          </div>
        </Section>

        {/* BLOCO 3 - ONDE ATUAMOS (RESUMO) */}
        <Section className="py-24">
          <FadeIn direction="up" className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Onde atuamos</h2>
            <p className="text-lg text-slate-600">
              Transformamos intenção em projeto robusto através de frentes claras de atuação.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FadeIn direction="up" delay={0.1} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center mb-6 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Estruturação de projetos</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Transformação de ideias e demandas em propostas tecnicamente consistentes e aderentes ao objetivo de financiamento ou implementação.
              </p>
            </FadeIn>

            <FadeIn direction="up" delay={0.2} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center mb-6 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Diagnóstico de aderência</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Leitura crítica da oportunidade, do edital ou da demanda para identificar viabilidade, lacunas e riscos antes da submissão.
              </p>
            </FadeIn>

            <FadeIn direction="up" delay={0.3} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center mb-6 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Revisão estratégica</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Análise de coerência entre problema, solução, metas, orçamento, cronograma e capacidade executora.
              </p>
            </FadeIn>

            <FadeIn direction="up" delay={0.4} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center mb-6 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <BarChart className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Acompanhamento e execução</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Apoio à governança, monitoramento e consistência entre o que foi proposto e o que precisa ser entregue.
              </p>
            </FadeIn>
          </div>
        </Section>

        {/* BLOCO 5 e 6 - PARA QUEM É E PROVA DE REPERTÓRIO */}
        <Section isDark className="py-24 border-y border-slate-100">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <FadeIn direction="right">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Para quem trabalhamos</h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-8">
                Atendemos organizações que precisam transformar intenção em projeto robusto.
              </p>
              <ul className="space-y-4">
                {[
                  "Startups e negócios inovadores",
                  "PMEs em transformação digital",
                  "Instituições e ecossistemas de inovação",
                  "Organizações com interface com o setor público",
                  "Iniciativas com agenda ESG, impacto e desenvolvimento territorial"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-blue-800 shrink-0 mt-0.5" />
                    <span className="text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </FadeIn>
            <FadeIn direction="left" delay={0.2} className="bg-slate-900 text-white p-10 md:p-12 rounded-3xl shadow-xl">
              <h3 className="text-2xl font-bold mb-6">Experiência em projetos de alta complexidade</h3>
              <p className="text-slate-300 leading-relaxed text-lg">
                Atuação em iniciativas ligadas a inovação, editais, transformação digital, saúde, ESG, desenvolvimento territorial, economia circular e estruturação de propostas para captação e implementação.
              </p>
            </FadeIn>
          </div>
        </Section>

        {/* ========================================================= */}
        {/* PÁGINA "SERVIÇOS" */}
        {/* ========================================================= */}
        <Section id="servicos" className="py-24 md:py-32">
          <FadeIn direction="up" className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Serviços</h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Cada projeto exige um nível diferente de intervenção. Por isso, organizamos nossa atuação em frentes que ajudam desde o enquadramento inicial até a estruturação e o acompanhamento da execução.
            </p>
          </FadeIn>

          <div className="space-y-12">
            {[
              {
                title: "Diagnóstico Estratégico de Projeto",
                forWho: "Para quem tem uma ideia, oportunidade, edital ou demanda, mas ainda não sabe se o projeto está maduro, aderente ou bem posicionado.",
                deliverables: ["leitura estratégica da demanda", "avaliação preliminar de aderência", "identificação de lacunas críticas", "mapeamento inicial de riscos", "recomendação de próximo passo"],
                result: "Mais clareza sobre viabilidade, escopo e prioridade antes de entrar em redação ou submissão.",
                cta: "Quero avaliar meu projeto"
              },
              {
                title: "Estruturação Completa de Projeto",
                forWho: "Para organizações que precisam transformar uma ideia ou demanda em proposta consistente, apresentável e executável.",
                deliverables: ["modelagem do problema e da solução", "construção da narrativa técnica e estratégica", "definição de objetivos, metas e indicadores", "organização do cronograma", "estruturação de orçamento e coerência entre entregas e recursos", "revisão global de consistência"],
                result: "Um projeto mais robusto, com lógica de avaliação, clareza executiva e melhor capacidade de defesa.",
                cta: "Conhecer escopo"
              },
              {
                title: "Revisão Crítica de Propostas",
                forWho: "Para quem já possui texto, formulário, pitch ou rascunho e precisa elevar a qualidade antes da submissão.",
                deliverables: ["revisão estratégica", "análise de coerência interna", "identificação de fragilidades argumentativas", "ajuste de posicionamento", "recomendações de fortalecimento técnico e narrativo"],
                result: "Menos inconsistências, maior clareza e melhor alinhamento com o que o avaliador ou parceiro espera encontrar.",
                cta: "Solicitar revisão"
              },
              {
                title: "Acompanhamento de Execução e Governança",
                forWho: "Para projetos que já foram aprovados ou iniciados, mas precisam de mais consistência na execução, monitoramento e governança.",
                deliverables: ["apoio à organização da execução", "alinhamento entre plano e operação", "estruturação de indicadores", "lógica de acompanhamento", "suporte à consistência documental e gerencial"],
                result: "Mais controle, previsibilidade e capacidade de demonstrar avanço com coerência.",
                cta: "Conversar sobre acompanhamento"
              }
            ].map((service, idx) => (
              <FadeIn direction="up" delay={idx * 0.1} key={idx} className="bg-white rounded-2xl border border-slate-200 p-8 md:p-12 shadow-sm flex flex-col md:flex-row gap-12">
                <div className="md:w-1/3">
                  <h3 className="text-2xl font-bold mb-4">{service.title}</h3>
                  <div className="mb-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Para quem é</span>
                    <p className="text-slate-600 text-sm leading-relaxed">{service.forWho}</p>
                  </div>
                  <Link href="#diagnostico" className="inline-flex h-12 items-center justify-center rounded border border-slate-300 bg-transparent px-6 text-base font-medium text-slate-900 transition-all hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50">
                    {service.cta}
                  </Link>
                </div>
                <div className="md:w-2/3 grid sm:grid-cols-2 gap-8 border-t md:border-t-0 md:border-l border-slate-100 pt-8 md:pt-0 md:pl-12">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 block">O que entregamos</span>
                    <ul className="space-y-3">
                      {service.deliverables.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-1.5 shrink-0" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 block">Resultado esperado</span>
                    <p className="text-slate-700 font-medium leading-relaxed">{service.result}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* O que não fazemos */}
          <div className="mt-20 bg-slate-50 rounded-2xl p-8 md:p-12 border border-slate-100 text-center">
            <h3 className="text-xl font-bold mb-8">O que não fazemos</h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
              {[
                "não prometemos aprovação",
                "não tratamos projeto como mera redação",
                "não substituímos assessoria jurídica especializada",
                "não operamos com soluções genéricas"
              ].map((item, idx) => (
                <div key={idx} className="text-sm text-slate-600 font-medium px-4">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ========================================================= */}
        {/* PÁGINA "COMO TRABALHAMOS" */}
        {/* ========================================================= */}
        <Section id="metodo" isDark className="py-24 md:py-32 border-t border-slate-200">
          <FadeIn direction="up" className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Como trabalhamos</h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Nosso trabalho parte de uma premissa simples: projeto forte não nasce de improviso. Ele nasce de enquadramento correto, lógica clara e coerência entre intenção, desenho técnico e capacidade de execução.
            </p>
          </FadeIn>

          <div className="max-w-4xl mx-auto z-10 relative">
            <div className="absolute left-[39px] md:left-[51px] top-4 md:top-6 bottom-4 md:bottom-6 w-0.5 bg-slate-200 -z-10" />

            <div className="space-y-12">
              {[
                { step: "1", title: "Diagnóstico e enquadramento", desc: "Entendemos o contexto, a oportunidade, a maturidade da proposta e o problema real a ser resolvido." },
                { step: "2", title: "Arquitetura estratégica", desc: "Definimos a espinha dorsal do projeto: objetivo, proposta de valor, lógica da solução, público, resultados esperados, critérios de viabilidade e aderência." },
                { step: "3", title: "Estruturação técnica", desc: "Transformamos a arquitetura em proposta consistente, conectando narrativa, metas, cronograma, orçamento, indicadores e entregas." },
                { step: "4", title: "Revisão crítica", desc: "Testamos coerência, clareza, pontos fracos, riscos e eventuais desconexões antes da submissão, apresentação ou implementação." },
                { step: "5", title: "Direcionamento de avanço", desc: "A depender do escopo, apoiamos os próximos passos: submissão, defesa, ajustes, governança ou acompanhamento da execução." }
              ].map((etapa, idx) => (
                <FadeIn direction="up" delay={idx * 0.15} key={idx} className="flex gap-6 md:gap-8 items-start group">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-white border border-slate-200 rounded-full flex items-center justify-center shrink-0 shadow-sm text-xl md:text-2xl font-bold font-heading text-slate-900 group-hover:border-slate-400 transition-colors">
                    {etapa.step}
                  </div>
                  <div className="pt-2 md:pt-4">
                    <h3 className="text-xl md:text-2xl font-bold mb-3">{etapa.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{etapa.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>

          {/* Princípios */}
          <div className="mt-24 max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <FadeIn direction="right">
              <h3 className="text-2xl md:text-3xl font-bold mb-8">Como pensamos</h3>
              <ul className="space-y-6">
                {[
                  "clareza antes de volume",
                  "coerência antes de estética",
                  "estratégia antes de redação",
                  "execução como parte do projeto, não como etapa secundária",
                  "personalização conforme contexto, maturidade e objetivo"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-4 border-b border-slate-200 pb-4">
                    <span className="text-sm font-bold text-slate-400">0{idx + 1}</span>
                    <span className="font-medium text-slate-800">{item}</span>
                  </li>
                ))}
              </ul>
            </FadeIn>
            <FadeIn direction="left" delay={0.2} className="bg-white p-10 md:p-12 rounded-3xl shadow-lg border border-slate-100">
              <p className="text-xl leading-relaxed text-slate-900 font-medium">
                &quot;Cada projeto é tratado como um argumento estratégico. Não basta parecer bom: ele precisa fazer sentido para quem avalia, para quem executa e para quem investe tempo ou recurso na iniciativa.&quot;
              </p>
            </FadeIn>
          </div>
        </Section>

        {/* ========================================================= */}
        {/* PÁGINA "CASOS / EXPERIÊNCIAS / SETORES" */}
        {/* ========================================================= */}
        <Section id="experiencia" className="py-24 md:py-32">
          <FadeIn direction="up" className="max-w-3xl mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Experiência e setores de atuação</h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Atuamos em projetos de natureza diversa, sempre com foco em estruturação estratégica, coerência técnica e viabilidade de execução.
            </p>
          </FadeIn>

          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 mb-20">
            {/* Setores e Tipos */}
            <div className="lg:col-span-4 space-y-12">
              <div>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  Setores com os quais dialogamos
                </h3>
                <ul className="space-y-3">
                  {[
                    "startups e negócios inovadores",
                    "indústria e serviços",
                    "saúde",
                    "turismo",
                    "setor público e ecossistemas institucionais",
                    "economia criativa",
                    "sustentabilidade e bioeconomia"
                  ].map((item, idx) => (
                    <li key={idx} className="text-slate-600 text-sm font-medium pl-4 border-l-2 border-slate-200">{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <Lightbulb className="w-5 h-5 text-slate-400" />
                  Tipos de projeto
                </h3>
                <ul className="space-y-3">
                  {[
                    "projetos de inovação e tecnologia",
                    "estruturação para editais e programas de fomento",
                    "transformação digital em PMEs e organizações",
                    "projetos com interface público-privada",
                    "iniciativas ESG, impacto e desenvolvimento territorial",
                    "propostas para saúde, economia circular, governança e sustentabilidade"
                  ].map((item, idx) => (
                    <li key={idx} className="text-slate-600 text-sm font-medium pl-4 border-l-2 border-slate-200">{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Cases Ocultos */}
            <div className="lg:col-span-8 grid sm:grid-cols-2 gap-6 items-start">
              {[
                { title: "Projeto de inovação com necessidade de enquadramento", desc: "Demanda centrada em transformar uma solução promissora em proposta mais consistente para captação, com reforço de narrativa, lógica de execução e aderência." },
                { title: "Estruturação de proposta com foco em coerência", desc: "Projeto com potencial técnico, mas com desconexões entre objetivos, entregas, cronograma e orçamento. O trabalho concentrou-se em reorganizar a lógica da proposta e elevar sua defensabilidade." },
                { title: "Apoio a projeto com interface institucional", desc: "Atuação em proposta que exigia diálogo entre inovação, gestão, viabilidade e linguagem compatível com atores públicos e parceiros estratégicos.", className: "sm:col-span-2" }
              ].map((caso, idx) => (
                <FadeIn direction="up" delay={idx * 0.15} key={idx} className={`bg-slate-50 border border-slate-200 p-8 rounded-2xl ${caso.className || ""}`}>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">Experiência {idx + 1}</span>
                  <h4 className="text-lg font-bold mb-3">{caso.title}</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">{caso.desc}</p>
                </FadeIn>
              ))}

              <div className="sm:col-span-2 bg-slate-900 p-8 md:p-10 rounded-2xl text-white mt-4 flex gap-6 items-center">
                <HeartHandshake className="w-12 h-12 text-slate-400 shrink-0 hidden sm:block" />
                <p className="text-sm md:text-base leading-relaxed text-slate-300">
                  <strong className="text-white">Diferencial de repertório:</strong> Mais do que atuar em um único nicho, desenvolvemos capacidade de leitura estratégica em contextos complexos — especialmente quando a proposta precisa conciliar inovação, linguagem técnica, financiamento, governança e execução.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* ========================================================= */}
        {/* PÁGINA "CONTATO / DIAGNÓSTICO" */}
        {/* ========================================================= */}
        <Section id="diagnostico" isDark className="py-24 md:py-32">
          <div className="grid lg:grid-cols-12 gap-16">
            <FadeIn direction="right" className="lg:col-span-5">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Solicite um diagnóstico inicial</h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-12">
                Se você tem uma ideia, proposta, edital ou projeto em andamento, o primeiro passo não é escrever mais. É entender o nível de maturidade, coerência e viabilidade da demanda.
              </p>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 mb-8">
                <h3 className="text-lg font-bold mb-6">Podemos ajudar melhor quando você já sabe pelo menos parte disso:</h3>
                <ul className="space-y-4">
                  {[
                    "qual problema o projeto pretende resolver",
                    "em que estágio a proposta está",
                    "se existe edital, parceiro, investidor ou demanda concreta",
                    "qual resultado você espera alcançar",
                    "qual o prazo de decisão ou submissão"
                  ].map((item, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-slate-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-900 p-8 rounded-2xl text-white">
                <p className="text-sm text-slate-300 mb-6">
                  Quanto mais claro o contexto, mais objetivo e útil tende a ser o diagnóstico inicial.
                  <br /><br />
                  Prefere iniciar por conversa direta?
                </p>
                <a href="https://wa.me/5583996428315?text=Ol%C3%A1%2C%20gostaria%20de%20solicitar%20um%20diagn%C3%B3stico%20inicial%20para%20o%20meu%20projeto." target="_blank" rel="noopener noreferrer" className="inline-flex w-full h-12 items-center justify-center rounded border border-slate-700 bg-transparent px-6 text-base font-medium text-white transition-all hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50">
                  Falar no WhatsApp
                </a>
              </div>
            </FadeIn>

            <FadeIn direction="left" delay={0.2} className="lg:col-span-7 bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-100">
              <DiagnosticoForm />
            </FadeIn>
          </div>
        </Section>

        {/* CTA FINAL DO DOCUMENTO (Bloco 7 inserido no final de home ou após Experiência) */}
        {/* Adicionei ele como uma ponte pro formulário se necessário, mas o header e todos os CTAs fluem pra ele. */}
      </main>

      <Footer />
    </div>
  );
}
