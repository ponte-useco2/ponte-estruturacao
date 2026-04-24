import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { FadeIn } from "@/components/ui/FadeIn";
import { FormularioMunicipios } from "@/components/ui/FormularioMunicipios";
import {
  ArrowRight,
  AlertTriangle,
  Users2,
  FileWarning,
  TrendingDown,
  Layers,
  Scale,
  HandCoins,
  Wrench,
  MapPinned,
  Database,
  FolderSearch,
  Handshake,
  CircleDollarSign,
  ShieldCheck,
  Home,
  Wallet,
  CheckCircle2,
  Clock,
  Target,
  ClipboardList,
  Sparkles,
  Leaf,
  BarChart3,
  FileDown,
  Quote,
} from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "REURB para Municípios | Regularização Fundiária — Ponte Projetos",
  description:
    "Soluções integradas de regularização fundiária (REURB), captação de recursos federais e segurança jurídica para municípios com menos de 20 mil habitantes.",
  openGraph: {
    title: "REURB para Municípios | Regularização Fundiária — Ponte Projetos",
    description:
      "Transforme irregularidade fundiária em receita e segurança jurídica. Plataforma USE-REURB + expertise jurídica + captação de recursos federais.",
    type: "website",
  },
};

export default function ReurbPage() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />

      <main className="flex-1 pb-24">
        {/* ======================= HERO ======================= */}
        <Section
          id="hero"
          className="pt-20 md:pt-28 pb-20 border-b border-slate-200 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-emerald-50 rounded-full blur-3xl opacity-60 -z-10" />

          <div className="max-w-5xl mx-auto">
            <FadeIn direction="up">
              <div className="inline-flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase mb-8">
                REURB · Municípios com menos de 20 mil habitantes
              </div>
            </FadeIn>

            <FadeIn direction="up" delay={0.1}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-8">
                Regularização Fundiária,{" "}
                <span className="text-emerald-700">
                  Segurança Jurídica e Desenvolvimento Local.
                </span>
              </h1>
            </FadeIn>

            <FadeIn direction="up" delay={0.2}>
              <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-3xl leading-relaxed">
                Soluções integradas para municípios com menos de 20 mil habitantes.
                Tecnologia geoespacial própria, expertise jurídica fundiária e
                captação de recursos federais — com metas contratuais e entregas
                em 90, 180 e 360 dias.
              </p>
            </FadeIn>

            <FadeIn direction="up" delay={0.3} className="flex flex-col sm:flex-row gap-4">
              <Link
                href="#diagnostico"
                className="inline-flex h-14 items-center justify-center rounded-xl bg-emerald-600 px-8 text-lg font-semibold text-white shadow-md shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
              >
                Solicitar diagnóstico gratuito
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                href="#use-reurb"
                className="inline-flex h-14 items-center justify-center rounded-xl border border-slate-300 bg-white px-8 text-lg font-medium text-slate-900 transition-all hover:bg-slate-50"
              >
                Conhecer a plataforma USE-REURB
              </Link>
            </FadeIn>
          </div>
        </Section>

        {/* ======================= 01 DESAFIO (stats + gargalos) ======================= */}
        <Section id="desafio" isDark className="py-20 border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up" className="mb-10 max-w-3xl">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                01 · O desafio dos pequenos municípios
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                Território, potencial e patrimônio. O que falta é estrutura para
                transformar isso em receita e política pública.
              </h3>
              <p className="text-lg text-slate-600 leading-relaxed">
                Municípios com menos de 20 mil habitantes vivem um paradoxo:
                possuem riqueza fundiária, mas não dispõem da capacidade técnica
                para convertê-la em desenvolvimento.
              </p>
            </FadeIn>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
              {[
                { num: "70%", label: "dos municípios brasileiros têm menos de 20 mil habitantes" },
                { num: "<15%", label: "da receita vem de arrecadação própria" },
                { num: "80%", label: "dos imóveis sem registro regular" },
                { num: "R$ 0", label: "captados de fundos federais, na média" },
              ].map((stat, idx) => (
                <FadeIn
                  direction="up"
                  delay={idx * 0.08}
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7"
                >
                  <div className="text-3xl md:text-4xl font-extrabold text-emerald-700 mb-2">
                    {stat.num}
                  </div>
                  <div className="text-sm text-slate-600 leading-relaxed">
                    {stat.label}
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Gargalos */}
            <FadeIn direction="up" className="mb-8">
              <h4 className="text-sm font-bold text-slate-500 tracking-[0.08em] uppercase">
                Os três gargalos críticos
              </h4>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: MapPinned,
                  title: "Irregularidade fundiária massiva",
                  desc:
                    "A maioria dos imóveis urbanos e rurais não possui registro adequado — impedindo cobrança justa de IPTU, financiamentos habitacionais e acesso a programas federais como MCMV.",
                },
                {
                  icon: Users2,
                  title: "Ausência de capacidade técnica",
                  desc:
                    "Equipes enxutas, sem geógrafos, advogados fundiários ou analistas de SIG. Cadastro desatualizado e dependência total de consultorias externas.",
                },
                {
                  icon: TrendingDown,
                  title: "Perda de receita e oportunidades",
                  desc:
                    "Sem cadastro confiável, o município não cobra IPTU justo, não acessa convênios federais, não defende seu patrimônio e afasta investimento privado.",
                },
              ].map((item, idx) => (
                <FadeIn
                  direction="up"
                  delay={idx * 0.1}
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7"
                >
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center mb-5">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h5 className="text-base font-bold text-slate-900 mb-2">
                    {item.title}
                  </h5>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </FadeIn>
              ))}
            </div>
          </div>
        </Section>

        {/* ======================= 02 PILARES + FLUXO ======================= */}
        <Section id="pilares" className="py-20 border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up" className="mb-12 max-w-3xl">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                02 · A Ponte Estruturação de Projetos
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                Não entregamos relatório. Entregamos imóveis regularizados,
                receita nova e projetos aprovados.
              </h3>
              <p className="text-lg text-slate-600 leading-relaxed">
                Combinamos tecnologia geoespacial própria, expertise jurídica
                fundiária e capacidade de captação de recursos — com
                responsabilidade contratual pelos resultados.
              </p>
            </FadeIn>

            <FadeIn direction="up" className="mb-6">
              <h4 className="text-sm font-bold text-slate-500 tracking-[0.08em] uppercase">
                Nossos pilares de atuação
              </h4>
            </FadeIn>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
              {[
                {
                  icon: Layers,
                  title: "Tecnologia",
                  desc:
                    "Plataforma USE-REURB com 14 fontes de dados integradas, 37 endpoints e 31 camadas geoespaciais em tempo real.",
                },
                {
                  icon: Scale,
                  title: "Jurídico",
                  desc:
                    "Defesa patrimonial, análise de laudêmios, processos de REURB-S/E e regularização junto a cartórios.",
                },
                {
                  icon: HandCoins,
                  title: "Recursos",
                  desc:
                    "Elaboração de projetos para captação via FINEP, FNHIS, FPM vinculado e convênios estaduais.",
                },
                {
                  icon: Wrench,
                  title: "Execução",
                  desc:
                    "Equipe de campo, conciliação cadastral, metas contratuais com resultados em 90, 180 e 360 dias.",
                },
              ].map((item, idx) => (
                <FadeIn
                  direction="up"
                  delay={idx * 0.1}
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7 hover:border-emerald-200 transition-colors"
                >
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center mb-5">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h5 className="text-base font-bold text-slate-900 mb-2">
                    {item.title}
                  </h5>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </FadeIn>
              ))}
            </div>

            {/* Fluxo */}
            <FadeIn direction="up" className="mb-8">
              <h4 className="text-sm font-bold text-slate-500 tracking-[0.08em] uppercase">
                Nosso fluxo de trabalho
              </h4>
            </FadeIn>

            <div className="relative">
              <div className="hidden md:block absolute top-8 left-8 right-8 h-px bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-200 -z-10" />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                {[
                  { icon: FolderSearch, title: "Diagnóstico", desc: "Levantamento completo" },
                  { icon: Database, title: "Cruzamento", desc: "Dados IPTU × Cartório" },
                  { icon: Home, title: "REURB", desc: "Regularização urb. e rural" },
                  { icon: CircleDollarSign, title: "Captação", desc: "Recursos federais" },
                  { icon: BarChart3, title: "Gestão", desc: "Monitoramento contínuo" },
                ].map((step, idx) => (
                  <FadeIn
                    direction="up"
                    delay={idx * 0.08}
                    key={idx}
                    className="text-center"
                  >
                    <div className="w-16 h-16 mx-auto bg-white border-2 border-emerald-200 rounded-full flex items-center justify-center mb-4 shadow-sm">
                      <step.icon className="w-7 h-7 text-emerald-700" />
                    </div>
                    <div className="text-sm font-bold text-slate-900 mb-1">
                      {step.title}
                    </div>
                    <div className="text-xs text-slate-500 leading-relaxed">
                      {step.desc}
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>

            <FadeIn direction="up" delay={0.3} className="mt-16">
              <div className="bg-emerald-50 border-l-4 border-emerald-600 rounded-r-2xl p-6 md:p-8 max-w-4xl">
                <p className="text-base md:text-lg text-emerald-900 leading-relaxed">
                  <strong>Resultado para o Prefeito:</strong> ao contratar a Ponte,
                  o município ganha um parceiro que assume responsabilidade
                  contratual pelos resultados. Não vendemos relatórios —
                  entregamos imóveis regularizados, receita nova e projetos
                  aprovados.
                </p>
              </div>
            </FadeIn>
          </div>
        </Section>

        {/* ======================= 03 REURB ======================= */}
        <Section id="reurb" isDark className="py-20 border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up" className="mb-12 max-w-3xl">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                03 · REURB · O motor do desenvolvimento
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                A Lei 13.465/2017 é o instrumento mais poderoso que um pequeno
                município possui — quando bem executada.
              </h3>
              <p className="text-lg text-slate-600 leading-relaxed">
                A Regularização Fundiária Urbana, bem conduzida, gera um círculo
                virtuoso: mais IPTU, crédito habitacional, valorização imobiliária
                e segurança jurídica.
              </p>
            </FadeIn>

            {/* Modalidades */}
            <div className="grid md:grid-cols-2 gap-6 mb-16">
              <FadeIn direction="right" className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold mb-4">
                  REURB-S · Social
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">
                  Para famílias de baixa renda (até 5 SM)
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  A Prefeitura conduz o processo sem custo para o morador.
                  Gratuidade de registros em cartório. Foco em dignidade e
                  acesso a crédito habitacional.
                </p>
              </FadeIn>

              <FadeIn direction="left" delay={0.1} className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
                <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold mb-4">
                  REURB-E · Específica
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">
                  Para demais ocupantes
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  O beneficiário arca com os custos, mas a Prefeitura facilita o
                  processo administrativo. Gera receita direta ao município.
                </p>
              </FadeIn>
            </div>

            {/* Impactos */}
            <FadeIn direction="up" className="mb-6">
              <h4 className="text-sm font-bold text-slate-500 tracking-[0.08em] uppercase">
                Impactos diretos da REURB
              </h4>
            </FadeIn>

            <div className="space-y-4">
              {[
                {
                  icon: Wallet,
                  title: "Ampliação da base de IPTU",
                  desc:
                    "Imóveis regularizados integram o cadastro fiscal. Estimativa: +30–50% na base tributável em 24 meses.",
                },
                {
                  icon: HandCoins,
                  title: "Acesso a crédito habitacional",
                  desc:
                    "Famílias com título podem acessar financiamento bancário, FGTS e programas habitacionais federais.",
                },
                {
                  icon: Home,
                  title: "Valorização imobiliária",
                  desc:
                    "Imóveis valorizam 30–60% após regularização, aquecendo a economia local e gerando ITBI nas transferências futuras.",
                },
                {
                  icon: ShieldCheck,
                  title: "Segurança jurídica",
                  desc:
                    "Elimina conflitos de posse, reduz ações judiciais e protege tanto o cidadão quanto o patrimônio público municipal.",
                },
              ].map((item, idx) => (
                <FadeIn
                  direction="up"
                  delay={idx * 0.08}
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 flex gap-4 items-start"
                >
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-slate-900 mb-1">
                      {item.title}
                    </h5>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </Section>

        {/* ======================= 04 RECURSOS ======================= */}
        <Section id="recursos" className="py-20 border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up" className="mb-12 max-w-3xl">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                04 · Fontes de recursos federais e estaduais
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                O recurso já existe no orçamento federal. O que falta é projeto
                que a banca queira aprovar.
              </h3>
              <p className="text-lg text-slate-600 leading-relaxed">
                A Ponte elabora os projetos desde a concepção até a prestação
                de contas — submissão em Transferegov, Plataforma +Brasil e
                portais estaduais.
              </p>
            </FadeIn>

            {/* Tabela */}
            <FadeIn direction="up" className="overflow-x-auto rounded-2xl border border-slate-200 mb-16">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 uppercase text-xs tracking-wide">
                      Fonte
                    </th>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 uppercase text-xs tracking-wide">
                      Programa
                    </th>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 uppercase text-xs tracking-wide">
                      Aplicação
                    </th>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 uppercase text-xs tracking-wide">
                      Valor de referência
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {[
                    ["Federal", "FNHIS", "Regularização fundiária e melhoria habitacional", "R$ 500 mil – R$ 2 mi"],
                    ["Federal", "FINEP/FNDCT", "Inovação em gestão territorial (P&D)", "R$ 1 – 5 mi"],
                    ["Federal", "Minha Casa Minha Vida", "Habitação de interesse social (HIS)", "Variável por unidade"],
                    ["Federal", "PAC Seleções", "Infraestrutura urbana em áreas regularizadas", "R$ 1 – 10 mi"],
                    ["Estadual", "Convênios REURB", "Apoio técnico e financeiro para regularização", "R$ 200 – 800 mil"],
                    ["Próprio", "IPTU ampliado", "Receita própria com novos imóveis no cadastro", "+30–50% da base atual"],
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-900">{row[0]}</td>
                      <td className="px-5 py-4 font-medium text-slate-700">{row[1]}</td>
                      <td className="px-5 py-4 text-slate-600">{row[2]}</td>
                      <td className="px-5 py-4 text-emerald-700 font-semibold">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FadeIn>

            {/* Como atuamos */}
            <FadeIn direction="up" className="mb-6">
              <h4 className="text-sm font-bold text-slate-500 tracking-[0.08em] uppercase">
                Como a Ponte atua na captação
              </h4>
            </FadeIn>

            <div className="space-y-4">
              {[
                { title: "Diagnóstico de elegibilidade", desc: "Mapeamos quais programas o município pode acessar com base na situação cadastral e fundiária atual." },
                { title: "Elaboração de projetos", desc: "Propostas completas: plano de valores, estudos de viabilidade, cronograma físico-financeiro e toda documentação exigida." },
                { title: "Submissão e acompanhamento", desc: "Submissão nos portais oficiais (Transferegov, +Brasil) e acompanhamento até a liberação dos recursos." },
                { title: "Execução e prestação de contas", desc: "Apoio na execução e prestação de contas para evitar devolução de recursos." },
              ].map((item, idx) => (
                <FadeIn
                  direction="up"
                  delay={idx * 0.08}
                  key={idx}
                  className="flex gap-4 items-start p-5 bg-white border border-slate-200 rounded-2xl hover:border-emerald-200 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-emerald-700">0{idx + 1}</span>
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-slate-900 mb-1">{item.title}</h5>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </Section>

        {/* ======================= 05 SEGURANÇA JURÍDICA ======================= */}
        <Section id="seguranca" isDark className="py-20 border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up" className="mb-12 max-w-3xl">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                05 · Segurança jurídica e defesa patrimonial
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                Sem cadastro confiável, o patrimônio público fica vulnerável a
                invasões, grilagem e perdas judiciais.
              </h3>
            </FadeIn>

            {/* Case Mamanguape */}
            <FadeIn direction="up" className="mb-16">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-8 md:p-12 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="inline-flex items-center gap-2 bg-emerald-400/10 text-emerald-300 border border-emerald-400/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-5">
                  <Sparkles className="w-3 h-3" />
                  Case · Mamanguape (PB)
                </div>
                <h4 className="text-2xl md:text-3xl font-bold mb-4 max-w-2xl">
                  10.052 imóveis do IPTU cruzados com 1.913 laudêmios. 66,7% de
                  conciliação automática.
                </h4>
                <p className="text-slate-300 leading-relaxed max-w-3xl mb-8">
                  Em Mamanguape/PB, aplicamos o USE-REURB para conciliar a base
                  cadastral da Prefeitura com os registros de cartório,
                  identificando pendências de foros patronais históricos (Cia de
                  Tecidos Rio Tinto, Irmãos Lundgren) que travavam a regularização
                  de milhares de imóveis.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { num: "10.052", label: "Imóveis IPTU" },
                    { num: "1.913", label: "Laudêmios cruzados" },
                    { num: "66,7%", label: "Conciliação automática" },
                    { num: "95–98%", label: "Precisão dos matches" },
                  ].map((stat, idx) => (
                    <div
                      key={idx}
                      className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm"
                    >
                      <div className="text-2xl md:text-3xl font-extrabold text-emerald-400 mb-1">
                        {stat.num}
                      </div>
                      <div className="text-xs text-slate-300">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* Entregas */}
            <FadeIn direction="up" className="mb-6">
              <h4 className="text-sm font-bold text-slate-500 tracking-[0.08em] uppercase">
                O que a Ponte entrega em segurança jurídica
              </h4>
            </FadeIn>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  icon: Database,
                  title: "Conciliação cadastral IPTU × Cartório",
                  desc:
                    "Cruzamento automatizado entre base de IPTU e registros (laudêmios, matrículas, certidões).",
                },
                {
                  icon: AlertTriangle,
                  title: "Mapeamento de riscos jurídicos",
                  desc:
                    "Classificação por nível de risco: execuções fiscais ativas, processos judiciais, APPs, terras indígenas.",
                },
                {
                  icon: Scale,
                  title: "Defesa em ações judiciais",
                  desc:
                    "Suporte técnico para defesa do patrimônio em usucapião, reintegração de posse e execuções fiscais. Laudos georreferenciados com valor probatório.",
                },
                {
                  icon: FileWarning,
                  title: "Regularização de laudêmios e foros",
                  desc:
                    "Identificação e resolução de pendências com foros patronais, desbloqueando milhares de imóveis para REURB.",
                },
              ].map((item, idx) => (
                <FadeIn
                  direction="up"
                  delay={idx * 0.08}
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7"
                >
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center mb-5">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h5 className="text-base font-bold text-slate-900 mb-2">
                    {item.title}
                  </h5>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </FadeIn>
              ))}
            </div>

            <FadeIn direction="up" delay={0.2} className="mt-16 max-w-4xl">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 flex gap-5 items-start">
                <Quote className="w-10 h-10 text-emerald-500 shrink-0" />
                <p className="text-lg md:text-xl text-slate-700 italic leading-relaxed">
                  Um município sem cadastro fundiário confiável é como uma
                  empresa sem balanço patrimonial: não sabe o que tem, não sabe
                  o que deve, e não consegue planejar o futuro.
                </p>
              </div>
            </FadeIn>
          </div>
        </Section>

        {/* ======================= 06 IMPACTO SOCIOECONÔMICO ======================= */}
        <Section id="impacto" className="py-20 border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up" className="mb-12 max-w-3xl">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                06 · Impacto socioeconômico para o cidadão
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                O efeito multiplicador da regularização: para cada R$ 1
                investido, estima-se R$ 3–5 de movimentação econômica local.
              </h3>
            </FadeIn>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  icon: ClipboardList,
                  title: "Políticas públicas perenes",
                  desc:
                    "Com cadastro regularizado, o município implementa plano diretor, zoneamento, programas habitacionais e infraestrutura — ancorados em dados concretos, que sobrevivem à troca de gestão.",
                },
                {
                  icon: Users2,
                  title: "Geração de empregos",
                  desc:
                    "Topografia, engenharia, cartoraria, advocacia, construção civil e comércio de materiais. Estima-se 15–30 empregos diretos por ciclo de REURB em municípios pequenos.",
                },
                {
                  icon: TrendingDown,
                  title: "Economia local aquecida",
                  desc:
                    "Imóveis regularizados podem ser vendidos, alugados e financiados. O crédito habitacional injetado movimenta construção, comércio e serviços — multiplicador de R$ 3–5 por R$ 1 investido.",
                },
                {
                  icon: Handshake,
                  title: "Dignidade e cidadania",
                  desc:
                    "O título de propriedade é mais que um documento: é a garantia de que a família não será despejada, pode deixar herança e participa plenamente da vida econômica do município.",
                },
              ].map((item, idx) => (
                <FadeIn
                  direction="up"
                  delay={idx * 0.08}
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7 hover:border-emerald-200 transition-colors"
                >
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center mb-5">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h5 className="text-base font-bold text-slate-900 mb-2">
                    {item.title}
                  </h5>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </FadeIn>
              ))}
            </div>
          </div>
        </Section>

        {/* ======================= 07 CRONOGRAMA ======================= */}
        <Section id="cronograma" isDark className="py-20 border-b border-slate-200">
          <div className="max-w-5xl mx-auto">
            <FadeIn direction="up" className="mb-12 max-w-3xl">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                07 · Cronograma e metas contratuais
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                Não entregamos relatório. Entregamos metas contratuais com prazos
                definidos.
              </h3>
              <p className="text-lg text-slate-600 leading-relaxed">
                Cada fase tem entregas mensuráveis e verificáveis pelo município.
              </p>
            </FadeIn>

            {/* Timeline */}
            <div className="relative pl-4 md:pl-0 mb-16">
              <div className="absolute left-[27px] md:left-[39px] top-6 bottom-6 w-0.5 bg-emerald-100 -z-10" />
              <div className="space-y-8">
                {[
                  {
                    fase: "0–90 dias",
                    title: "Diagnóstico e setup",
                    desc: "Levantamento cadastral completo, cruzamento IPTU × Cartório, implantação USE-REURB, identificação de 100% dos imóveis irregulares.",
                  },
                  {
                    fase: "90–180 dias",
                    title: "Regularização · Fase 1",
                    desc: "REURB-S iniciada nas áreas prioritárias, 30% dos imóveis com processo aberto, primeiros projetos de captação submetidos.",
                  },
                  {
                    fase: "180–270 dias",
                    title: "Execução plena",
                    desc: "60% dos imóveis em processo de regularização, primeiros títulos emitidos, recursos federais em liberação.",
                  },
                  {
                    fase: "270–360 dias",
                    title: "Consolidação",
                    desc: "80% dos imóveis regularizados ou em fase final, cadastro atualizado, nova base de IPTU operacional, equipe local capacitada.",
                  },
                  {
                    fase: "Após 360 dias",
                    title: "Gestão contínua",
                    desc: "Monitoramento trimestral, atualização cadastral contínua, suporte para novos programas e manutenção do sistema USE-REURB.",
                  },
                ].map((step, idx) => (
                  <FadeIn
                    direction="up"
                    delay={idx * 0.1}
                    key={idx}
                    className="flex gap-5 md:gap-8 items-start group"
                  >
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-white border-2 border-emerald-200 rounded-full flex items-center justify-center shrink-0 shadow-sm group-hover:border-emerald-400 transition-colors">
                      <span className="text-sm md:text-base font-bold text-emerald-700">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="pt-1 md:pt-2 flex-1">
                      <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
                        {step.fase}
                      </div>
                      <h5 className="text-base md:text-lg font-bold mb-1 text-slate-900">
                        {step.title}
                      </h5>
                      <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>

            {/* Metas mínimas */}
            <FadeIn direction="up" className="mb-6">
              <h4 className="text-sm font-bold text-slate-500 tracking-[0.08em] uppercase">
                Metas mínimas garantidas
              </h4>
            </FadeIn>

            <FadeIn direction="up" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 uppercase text-xs tracking-wide">
                      Prazo
                    </th>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 uppercase text-xs tracking-wide">
                      Meta
                    </th>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 uppercase text-xs tracking-wide">
                      Indicador
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ["90 dias", "100% dos imóveis mapeados", "Nº de imóveis no sistema"],
                    ["180 dias", "30% com REURB iniciada", "Processos administrativos abertos"],
                    ["360 dias", "80% regularizados", "Títulos emitidos + processos em curso"],
                    ["360 dias", "1+ projeto federal aprovado", "Valor captado em R$"],
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-emerald-700">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {row[0]}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-900">{row[1]}</td>
                      <td className="px-5 py-4 text-slate-600">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FadeIn>
          </div>
        </Section>

        {/* ======================= 08 USE-REURB ======================= */}
        <Section id="use-reurb" className="py-20 border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up" className="mb-12 max-w-3xl">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                08 · Tecnologia USE-REURB
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                A plataforma geoespacial desenhada para a realidade dos
                municípios brasileiros.
              </h3>
              <p className="text-lg text-slate-600 leading-relaxed">
                Diferente de softwares genéricos, o USE-REURB foi construído
                para o problema real: integrar dados fragmentados de cartório,
                IPTU, cadastro ambiental, judicial e IBGE em uma única camada
                geoespacial rastreável.
              </p>
            </FadeIn>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
              {[
                { num: "14", label: "Fontes de dados integradas" },
                { num: "37", label: "Endpoints de API ativas" },
                { num: "31+", label: "Camadas no mapa interativo" },
                { num: "4", label: "Municípios já operando" },
              ].map((stat, idx) => (
                <FadeIn
                  direction="up"
                  delay={idx * 0.08}
                  key={idx}
                  className="bg-slate-900 text-white rounded-2xl p-6 md:p-7"
                >
                  <div className="text-3xl md:text-4xl font-extrabold text-emerald-400 mb-2">
                    {stat.num}
                  </div>
                  <div className="text-sm text-slate-300 leading-relaxed">
                    {stat.label}
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Camadas */}
            <FadeIn direction="up" className="mb-6">
              <h4 className="text-sm font-bold text-slate-500 tracking-[0.08em] uppercase">
                Camadas de dados integradas
              </h4>
            </FadeIn>

            <FadeIn direction="up" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white mb-16">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 uppercase text-xs tracking-wide">
                      Categoria
                    </th>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 uppercase text-xs tracking-wide">
                      Dados
                    </th>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 uppercase text-xs tracking-wide">
                      Fonte
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ["Cadastral", "IPTU, Inscrições, Logradouros", "Prefeitura"],
                    ["Cartório", "Laudêmios, Matrículas, Certidões", "CRI / SPU"],
                    ["Ambiental", "CAR, APPs, Reserva Legal, Hidrografia", "SICAR / ANA"],
                    ["Judicial", "Processos, Execuções Fiscais", "TJPB / TJPE"],
                    ["Geodésico", "Marcos geodésicos, CNEFE", "IBGE"],
                    ["Edificações", "Google Open Buildings (IA)", "Google Research"],
                    ["Territorial", "Limite municipal, Sub-bacias, Setores", "IBGE / ANA"],
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {row[0]}
                      </td>
                      <td className="px-5 py-4 text-slate-700">{row[1]}</td>
                      <td className="px-5 py-4 text-emerald-700 font-medium">
                        {row[2]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FadeIn>

            {/* Precisão */}
            <FadeIn direction="up" className="bg-emerald-50 border-l-4 border-emerald-600 rounded-r-2xl p-6 md:p-8 max-w-4xl">
              <div className="flex items-start gap-4">
                <Target className="w-8 h-8 text-emerald-700 shrink-0 mt-1" />
                <div>
                  <h5 className="text-base md:text-lg font-bold text-emerald-900 mb-3">
                    Precisão auditável, não &quot;caixa-preta&quot;
                  </h5>
                  <p className="text-sm md:text-base text-emerald-900 leading-relaxed">
                    O USE-REURB usa <strong>fuzzy matching</strong> para
                    conciliação cadastral: <strong>66,7%</strong> de acerto
                    automático (score &gt; 85) com{" "}
                    <strong>95–98%</strong> de precisão nos matches. Apenas{" "}
                    <strong>19,2%</strong> dos registros exigem revisão
                    humana. A classificação de risco usa{" "}
                    <strong>regras determinísticas</strong> — não machine
                    learning — garantindo rastreabilidade total das decisões
                    para auditoria e processos judiciais.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </Section>

        {/* ======================= 09 USECO2 ======================= */}
        <Section id="useco2" isDark className="py-20 border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up" className="mb-12 max-w-3xl">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                09 · USECO2 · ESG como motor de desenvolvimento
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                ESG não é selo. É mecanismo de fortalecimento institucional —
                eficiência, credibilidade e nova receita.
              </h3>
              <p className="text-lg text-slate-600 leading-relaxed">
                A <strong>USECO2</strong> é parceira estratégica da Ponte para
                incorporar práticas Ambientais, Sociais e de Governança à
                gestão municipal.
              </p>
            </FadeIn>

            {/* E S G */}
            <div className="grid md:grid-cols-3 gap-6 mb-16">
              {[
                {
                  letter: "E",
                  title: "Ambiental",
                  icon: Leaf,
                  desc: "Reflorestamento, energia limpa, gestão de resíduos, créditos de carbono, justiça climática.",
                  color: "emerald",
                },
                {
                  letter: "S",
                  title: "Social",
                  icon: Users2,
                  desc: "Regularização fundiária, habitação digna, empregos locais, participação cidadã, inclusão.",
                  color: "sky",
                },
                {
                  letter: "G",
                  title: "Governança",
                  icon: ShieldCheck,
                  desc: "Transparência, métricas de resultado, prestação de contas, modernização administrativa.",
                  color: "indigo",
                },
              ].map((item, idx) => (
                <FadeIn
                  direction="up"
                  delay={idx * 0.1}
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 text-center"
                >
                  <div className="text-6xl font-extrabold text-emerald-600 mb-2">
                    {item.letter}
                  </div>
                  <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold mb-4">
                    <item.icon className="w-3 h-3" />
                    {item.title}
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </FadeIn>
              ))}
            </div>

            {/* Entregas USECO2 */}
            <FadeIn direction="up" className="mb-6">
              <h4 className="text-sm font-bold text-slate-500 tracking-[0.08em] uppercase">
                O que a USECO2 entrega ao município
              </h4>
            </FadeIn>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  title: "Eficiência nos serviços públicos",
                  desc: "Projetos ESG que reduzem custos operacionais: economia de energia, gestão inteligente de resíduos, modernização administrativa.",
                },
                {
                  title: "Novas fontes de receita com carbono",
                  desc: "Reflorestamento, energia limpa e gestão de resíduos transformam ações ambientais em créditos de carbono comercializáveis.",
                },
                {
                  title: "Acesso a fundos climáticos",
                  desc: "Posicionamento para acessar editais, financiamentos e fundos climáticos nacionais e internacionais que exigem comprometimento ESG.",
                },
                {
                  title: "Governança e credibilidade",
                  desc: "Transparência, métricas e participação cidadã que fortalecem a confiança da população e atraem parcerias.",
                },
              ].map((item, idx) => (
                <FadeIn
                  direction="up"
                  delay={idx * 0.08}
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7 flex gap-4 items-start"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-emerald-700">
                      0{idx + 1}
                    </span>
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-slate-900 mb-1">
                      {item.title}
                    </h5>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>

            <FadeIn direction="up" delay={0.3} className="mt-16">
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-3xl p-8 md:p-10 text-center">
                <p className="text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
                  <strong>PONTE + USECO2</strong>: regularização fundiária + ESG
                  = cidade eficiente, justa e economicamente sustentável. O
                  município ganha segurança jurídica, novas receitas e
                  legitimidade para políticas públicas perenes.
                </p>
              </div>
            </FadeIn>
          </div>
        </Section>

        {/* ======================= 10 PRÓXIMOS PASSOS ======================= */}
        <Section id="proximos-passos" className="py-20 border-b border-slate-200">
          <div className="max-w-5xl mx-auto">
            <FadeIn direction="up" className="mb-12 max-w-3xl">
              <h2 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase mb-4">
                10 · Como iniciar a parceria
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                O processo foi desenhado para respeitar o ritmo e as limitações
                administrativas dos pequenos municípios.
              </h3>
            </FadeIn>

            <div className="space-y-4">
              {[
                {
                  title: "Reunião inicial",
                  desc:
                    "Apresentação do USE-REURB ao prefeito e equipe técnica. Demonstração ao vivo com dados públicos do município. Sem custo e sem compromisso.",
                },
                {
                  title: "Diagnóstico gratuito",
                  desc:
                    "Levantamento preliminar da situação fundiária com dados públicos (IPTU, CAR, IBGE). Relatório executivo em 15 dias.",
                },
                {
                  title: "Proposta comercial",
                  desc:
                    "Com base no diagnóstico, apresentamos proposta com escopo, cronograma, metas contratuais e investimento. Modelos flexíveis: por imóvel, por fase ou global.",
                },
                {
                  title: "Contratação e início",
                  desc:
                    "Assinatura via processo licitatório (dispensa para valores até R$ 100 mil ou inexigibilidade por notória especialização). Início imediato da Fase 1.",
                },
              ].map((step, idx) => (
                <FadeIn
                  direction="up"
                  delay={idx * 0.1}
                  key={idx}
                  className="flex gap-5 items-start p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-200 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-emerald-700">
                      0{idx + 1}
                    </span>
                  </div>
                  <div>
                    <h5 className="text-lg font-bold text-slate-900 mb-1">
                      {step.title}
                    </h5>
                    <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* PDF download */}
            <FadeIn direction="up" delay={0.4} className="mt-12">
              <a
                href="/portfolio-ponte-municipios.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-white border border-slate-300 hover:border-emerald-400 text-slate-900 px-6 py-4 rounded-xl transition-colors group"
              >
                <FileDown className="w-5 h-5 text-emerald-600 group-hover:text-emerald-700" />
                <div className="text-left">
                  <div className="text-sm font-bold">Baixar portfólio institucional (PDF)</div>
                  <div className="text-xs text-slate-500">
                    Versão impressa para reunião de gabinete — 12 páginas
                  </div>
                </div>
              </a>
            </FadeIn>
          </div>
        </Section>

        {/* ======================= DIAGNÓSTICO (FORM) ======================= */}
        <Section id="diagnostico" isDark className="py-20">
          <div className="max-w-4xl mx-auto">
            <FadeIn direction="up" className="mb-10 text-center">
              <div className="inline-flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase mb-6">
                Diagnóstico gratuito
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-5 leading-tight">
                Conheça a situação fundiária do seu município em 15 dias.
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Relatório executivo usando dados públicos (IPTU, CAR, IBGE), sem
                custo e sem compromisso. Preencha os dados abaixo e nossa equipe
                entrará em contato.
              </p>
            </FadeIn>

            <FadeIn direction="up" delay={0.15}>
              <FormularioMunicipios />
            </FadeIn>

            <FadeIn direction="up" delay={0.25} className="flex flex-wrap items-center justify-center gap-4 mt-10">
              {[
                "Diagnóstico sem custo",
                "Relatório em 15 dias",
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
      </main>

      <Footer />
    </div>
  );
}
