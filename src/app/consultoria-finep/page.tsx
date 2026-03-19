import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { FadeIn } from "@/components/ui/FadeIn";
import { Zap, Timer, FileX, Link2, CheckCircle2, ArrowRight } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Consultoria Especializada FINEP | Ponte Projetos",
  description: "Sua empresa tem a solução. A gente constrói o projeto que a FINEP quer ler. Consultoria especializada em captação para o Edital de Inovação.",
};

export default function ConsultoriaFinepPage() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />

      <main className="flex-1 pb-24">
        {/* HERO */}
        <Section className="pt-20 md:pt-32 pb-20 border-b border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-emerald-50 rounded-full blur-3xl opacity-50 -z-10" />
          
          <div className="max-w-4xl mx-auto text-center">
            <FadeIn direction="up">
              <div className="inline-flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase mb-8">
                Consultoria especializada em captação — FINEP · Edital de Inovação
              </div>
            </FadeIn>
            
            <FadeIn direction="up" delay={0.1}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-8">
                Sua empresa tem a solução.<br />
                <span className="text-emerald-700">A gente constrói o projeto que a FINEP quer ler.</span>
              </h1>
            </FadeIn>
            
            <FadeIn direction="up" delay={0.2}>
              <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed">
                Empresas de software, IA e tecnologia têm ideias inovadoras — mas projetos mal estruturados ficam de fora dos editais. A Ponte transforma sua tecnologia em uma proposta técnica sólida, estratégica e aprovável.
              </p>
            </FadeIn>
            
            <FadeIn direction="up" delay={0.3} className="flex flex-wrap items-center justify-center gap-3">
              {[
                "Software & IA",
                "Desenvolvimento de produto",
                "Startups e Scale-ups",
                "Chamadas FINEP",
                "TECNOVA · Inovação Empresarial"
              ].map((tag, idx) => (
                <span key={idx} className="bg-slate-50 text-slate-600 text-sm px-4 py-1.5 rounded-full border border-slate-200 font-medium">
                  {tag}
                </span>
              ))}
            </FadeIn>
          </div>
        </Section>

        {/* CENÁRIO */}
        <Section className="py-20 bg-slate-50 border-b border-slate-200">
          <div className="max-w-5xl mx-auto">
            <FadeIn direction="up" className="mb-12">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                Você reconhece esse cenário?
              </h2>
            </FadeIn>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Zap, text: "Você tem uma tecnologia real e um time competente — mas não sabe como enquadrá-los tecnicamente nos critérios da FINEP." },
                { icon: Timer, text: "O edital está aberto e o prazo aperta. Fazer o projeto internamente significaria parar o desenvolvimento do produto." },
                { icon: FileX, text: "Já submeteu antes e não foi aprovado — sem feedback claro sobre onde o projeto foi fraco." },
                { icon: Link2, text: "Orçamento, metas, cronograma e indicadores parecem um labirinto. Qualquer inconsistência descredencia a proposta." }
              ].map((item, idx) => (
                <FadeIn direction="up" delay={idx * 0.1} key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center mb-5">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {item.text}
                  </p>
                </FadeIn>
              ))}
            </div>
          </div>
        </Section>

        {/* ENTREGAS */}
        <Section className="py-20 border-b border-slate-200">
          <div className="max-w-4xl mx-auto">
            <FadeIn direction="up" className="mb-12">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                O que a Ponte entrega por você
              </h2>
            </FadeIn>

            <div className="space-y-4">
              {[
                { title: "Diagnóstico de aderência à chamada", desc: "Avaliamos se sua solução se encaixa nos critérios técnicos e estratégicos do edital antes de qualquer investimento de tempo." },
                { title: "Enquadramento estratégico da proposta", desc: "Posicionamos sua tecnologia (software, IA, plataforma) dentro da linguagem e das prioridades da FINEP — sem distorcer o que você faz." },
                { title: "Estruturação do plano de trabalho", desc: "Definimos fases, atividades, entregas e responsáveis com coerência executora — nada que a banca avaliadora possa questionar." },
                { title: "Redação técnica completa do projeto", desc: "Escrevemos cada seção — problema, solução, inovação, risco tecnológico, mercado, impacto — com linguagem de edital e argumentação robusta." },
                { title: "Orçamento, indicadores e cronograma integrados", desc: "Construímos as peças financeiras e de monitoramento em absoluta consistência com o plano de trabalho — o principal ponto de reprovação em propostas." },
                { title: "Revisão final e apoio na submissão", desc: "Checagem de conformidade documental, formatação e suporte técnico até o envio da proposta pelo sistema da FINEP." }
              ].map((item, idx) => (
                <FadeIn direction="up" delay={idx * 0.1} key={idx} className="flex gap-4 items-start p-5 bg-white border border-slate-200 rounded-2xl hover:border-emerald-200 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-emerald-700">0{idx + 1}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </Section>

        {/* DIFERENCIAIS */}
        <Section isDark className="py-20">
          <div className="max-w-5xl mx-auto">
            <FadeIn direction="right" className="mb-12">
              <h2 className="text-sm font-bold text-emerald-400 tracking-[0.08em] uppercase mb-4">
                Por que a Ponte?
              </h2>
            </FadeIn>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { num: "+10 anos", label: "de atuação em elaboração de projetos para editais públicos de inovação" },
                { num: "FINEP · FAP · TECNOVA", label: "expertise declarada nos principais mecanismos de fomento à inovação no Brasil" },
                { num: "Ecossistema nordestino", label: "inserção ativa em parques tecnológicos, ICTs e aceleradoras de referência" },
                { num: "Frameworks validados", label: "método próprio de estruturação: da narrativa ao orçamento, tudo conectado" }
              ].map((item, idx) => (
                <FadeIn direction="up" delay={idx * 0.1} key={idx} className="bg-slate-800 border border-slate-700 p-6 rounded-2xl">
                  <div className="text-2xl font-bold text-emerald-400 mb-2">{item.num}</div>
                  <div className="text-sm text-slate-300 leading-relaxed">{item.label}</div>
                </FadeIn>
              ))}
            </div>
          </div>
        </Section>

        {/* PASSO A PASSO */}
        <Section className="py-20 border-b border-slate-200">
          <div className="max-w-4xl mx-auto">
            <FadeIn direction="up" className="mb-12">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                Como funciona a parceria
              </h2>
            </FadeIn>

            <div className="relative pl-4 md:pl-0">
              <div className="absolute left-[27px] md:left-[39px] top-6 bottom-6 w-0.5 bg-slate-100 -z-10" />
              <div className="space-y-8">
                {[
                  { title: "Reunião de diagnóstico", desc: "Entendemos sua solução, seu estágio de maturidade tecnológica e a chamada-alvo. Sem custo." },
                  { title: "Proposta de trabalho", desc: "Apresentamos escopo, metodologia, cronograma de elaboração e honorários com transparência." },
                  { title: "Imersão técnica na sua empresa", desc: "Coletamos informações institucionais, tecnológicas e financeiras para construir a proposta com fidelidade." },
                  { title: "Elaboração e iterações", desc: "Redigimos, revisamos com você e ajustamos até a proposta estar sólida e aprovável." },
                  { title: "Entrega e submissão", desc: "Projeto final revisado, documentação organizada e apoio técnico até o envio." }
                ].map((step, idx) => (
                  <FadeIn direction="up" delay={idx * 0.15} key={idx} className="flex gap-5 md:gap-8 items-start group">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center shrink-0 shadow-sm text-sm md:text-base font-bold text-emerald-700 group-hover:border-emerald-300 transition-colors">
                      {idx + 1}
                    </div>
                    <div className="pt-1 md:pt-2">
                      <h3 className="text-base md:text-lg font-bold mb-1">{step.title}</h3>
                      <p className="text-sm md:text-base text-slate-600 leading-relaxed">{step.desc}</p>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* QUOTE E CTA */}
        <Section className="py-20">
          <div className="max-w-4xl mx-auto space-y-16">
            <FadeIn direction="up">
              <div className="bg-emerald-50 border-l-4 border-emerald-600 rounded-r-2xl p-8 md:p-10">
                <p className="text-lg md:text-xl text-emerald-900 leading-relaxed font-medium italic">
                  &quot;Inovação não aprovada é custo. Inovação com projeto bem estruturado é investimento com retorno real. A Ponte existe para que sua empresa não perca acesso ao capital que já está disponível para financiar o que você já faz.&quot;
                </p>
              </div>
            </FadeIn>

            <FadeIn direction="up" delay={0.2} className="bg-white border border-slate-200 rounded-3xl p-10 md:p-16 text-center shadow-lg shadow-slate-100/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -z-10" />
              <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -z-10" />
              
              <h2 className="text-2xl md:text-3xl font-extrabold mb-4 text-slate-900">
                Sua chamada FINEP está aberta.<br />O projeto, ainda não.
              </h2>
              <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                Fale com a Ponte agora e descubra se sua solução tem aderência à chamada — sem compromisso e sem custo de diagnóstico.
              </p>
              
              <a 
                href="https://wa.me/5583996428315?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20como%20iniciar%20uma%20parceria%20com%20a%20Ponte%20Projetos%20para%20elaborar%20um%20projeto%20FINEP" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex h-14 items-center justify-center rounded-xl bg-emerald-600 px-8 text-lg font-semibold text-white shadow-md shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
              >
                Quero iniciar o diagnóstico
                <ArrowRight className="ml-2 w-5 h-5" />
              </a>

              <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
                {[
                  "Diagnóstico sem custo",
                  "Elaboração técnica completa",
                  "Confidencialidade garantida"
                ].map((tag, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {tag}
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
