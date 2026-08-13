import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { LoopTrilhaEstado } from "@/components/ui/LoopTrilhaEstado";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Trilha do Estado | Julgamento aplicado para decisão pública — Ponte Projetos",
  description:
    "Um curso que não ensina um acervo, e sim uma competência: diagnosticar qual jogo está sendo jogado antes de escolher o movimento. Repetição espaçada para fatos, casos com portões para julgamento. Jogue uma rodada real.",
  openGraph: {
    title: "Trilha do Estado | Julgamento aplicado para decisão pública",
    description:
      "Não avaliamos se você sabe dizer que uma métrica tem limitações. Avaliamos se você muda o que faria quando ela invalida a decisão que ia tomar.",
    type: "website",
  },
};

const MOTORES: { tipo: string; motor: string; avaliacao: string; nota: string }[] = [
  {
    tipo: "Fato",
    motor: "Repetição espaçada (FSRS)",
    avaliacao: "Recuperação ativa, agendada pela sua curva de esquecimento",
    nota: "Cada cartão carrega documento, página e trecho literal. Item sem proveniência não entra — a restrição do banco impede.",
  },
  {
    tipo: "Procedimento",
    motor: "Tarefa executável",
    avaliacao: "Execução verificável — calcular, decompor, montar",
    nota: "Sobre material real: atos normativos, prestações de conta, casos de captação. Não sobre exemplos inventados.",
  },
  {
    tipo: "Julgamento",
    motor: "Casos por competência",
    avaliacao: "Produção escrita, rubrica de seis dimensões e reviravolta",
    nota: "O caso é sorteado entre os que você ainda não viu. É onde um curso de reconhecimento para, e este começa.",
  },
];

const CADEIA = [
  "evidências carimbadas",
  "pergunta decisória",
  "operacionalização declarada",
  "análise",
  "limite identificado",
  "artefato afetado",
  "ação tomada",
  "custo reconhecido",
];

const CARIMBOS: [string, string][] = [
  ["oficial", "vem de fonte primária publicada, com citação"],
  ["derivado", "resultado de cálculo nosso sobre dado de terceiro"],
  ["limitado", "vale, mas só dentro de um escopo declarado"],
  ["demo", "serve para ilustrar o mecanismo, não para sustentar decisão"],
  ["requer_fonte", "afirmação em uso interno que ainda não pode ser publicada"],
  ["anomalia", "o dado existe e está errado; fica registrado como erro"],
];

const INVALIDACOES: { valor: string; status: string; motivo: string }[] = [
  {
    valor: "“27% dos casos”",
    status: "invalidado",
    motivo:
      "número sem fonte localizável. Substituído pelo valor validado — 14% — depois da reconstrução.",
  },
  {
    valor: "“157 dias”",
    status: "invalidado",
    motivo:
      "número real, extraído do documento certo, respondendo à pergunta errada: era contador de visualizações, não prazo de entrega.",
  },
  {
    valor: "“taxa histórica de 71%”",
    status: "limitado",
    motivo:
      "vale para a coorte de 2017 no SICONV, e só. Sem esse escopo, vira âncora para uma decisão que ele não sustenta.",
  },
];

export default function TrilhaDoEstadoPage() {
  return (
    <div className="flex min-h-screen flex-col pt-20">
      <Header />
      <main className="flex-1">
        {/* ---------------- HERO ---------------- */}
        <Section className="relative overflow-hidden pt-16 pb-16 md:pt-24">
          <div className="absolute top-0 right-0 -z-10 h-[700px] w-[700px] -translate-y-16 translate-x-1/3 rounded-full bg-slate-100 opacity-70 blur-3xl" />
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold tracking-wide text-slate-600 uppercase">
              Em construção · Camada I
            </div>
            <h1 className="mb-6 text-4xl leading-[1.1] font-extrabold tracking-tight text-slate-900 md:text-5xl">
              Trilha do Estado
            </h1>
            <p className="mb-6 text-xl leading-relaxed text-slate-700">
              O Estado brasileiro vive a transição entre duas arquiteturas: a
              burocrático-punitiva, que pergunta <em>quem errou?</em>, e a ágil e informada
              por evidências, que pergunta <em>o que funciona?</em>
            </p>
            <p className="mb-8 text-lg leading-relaxed text-slate-600">
              Quem trabalha nessa transição não erra por falta de método. Erra por aplicar
              o método certo à situação errada. A competência que este curso ensina não é
              executar uma avaliação — é{" "}
              <strong className="text-slate-900">
                diagnosticar qual jogo está sendo jogado antes de escolher o movimento
              </strong>
              , e agir de acordo com o que se diagnosticou.
            </p>
            <blockquote className="border-l-2 border-slate-900 pl-6 text-lg leading-relaxed text-slate-800 italic">
              Não avaliamos se o aprendiz sabe dizer que uma métrica tem limitações.
              Avaliamos se ele muda o que faria quando uma limitação torna inválida a
              decisão que estava prestes a tomar.
            </blockquote>
          </div>
        </Section>

        {/* ---------------- OS TRÊS MOTORES ---------------- */}
        <Section isDark className="py-20 md:py-24">
          <div className="mb-12 max-w-3xl">
            <h2 className="mb-4 text-3xl font-bold text-slate-900 md:text-4xl">
              Três tipos de conhecimento, três motores
            </h2>
            <p className="text-lg text-slate-600">
              Tratar tudo como flashcard é o erro que produz gente que sabe recitar e não
              sabe decidir. O tipo de conhecimento define o motor — e define o que conta
              como acerto.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {MOTORES.map((m) => (
              <div
                key={m.tipo}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                  {m.tipo}
                </div>
                <h3 className="mt-1 mb-3 text-lg font-bold text-slate-900">{m.motor}</h3>
                <p className="mb-4 text-sm leading-relaxed text-slate-600">{m.avaliacao}</p>
                <p className="border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
                  {m.nota}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------- A RODADA ---------------- */}
        <Section id="rodada" className="py-20 md:py-24">
          <div className="mb-10 max-w-3xl">
            <div className="mb-4 inline-flex items-center rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold tracking-wide text-white uppercase">
              Jogue uma rodada
            </div>
            <h2 className="mb-4 text-3xl font-bold text-slate-900 md:text-4xl">
              Um caso real do banco, com os portões ligados
            </h2>
            <p className="text-lg leading-relaxed text-slate-600">
              O caso abaixo está no banco do curso. A vinheta, a justificativa da triagem e
              o espelho da reviravolta são os do arquivo — nada foi suavizado para a
              demonstração. Suas escolhas não são enviadas nem armazenadas; tudo roda no seu
              navegador.
            </p>
          </div>
          <div className="max-w-3xl">
            <LoopTrilhaEstado />
          </div>
        </Section>

        {/* ---------------- O CONTRATO E OS PORTÕES ---------------- */}
        <Section isDark className="py-20 md:py-24">
          <div className="mb-12 max-w-3xl">
            <h2 className="mb-4 text-3xl font-bold text-slate-900 md:text-4xl">
              O contrato de avaliação
            </h2>
            <p className="text-lg leading-relaxed text-slate-600">
              Uma resposta boa não é a que chega à conclusão certa. É a que percorre a
              cadeia inteira, na ordem — e a ordem é avaliável, porque declarar a
              operacionalização <em>depois</em> de ver o resultado é outra coisa com o
              mesmo nome.
            </p>
          </div>

          <div className="mb-12 flex flex-wrap items-center gap-x-2 gap-y-3">
            {CADEIA.map((elo, i) => (
              <span key={elo} className="flex items-center gap-2">
                <span className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                  {elo}
                </span>
                {i < CADEIA.length - 1 && (
                  <span className="text-slate-400" aria-hidden>
                    →
                  </span>
                )}
              </span>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                Portão de triagem
              </div>
              <h3 className="mt-1 mb-3 text-lg font-bold text-slate-900">
                Errar o jogo limita a nota a 49
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Não porque seja severo, mas porque diagnóstico errado invalida a cadeia
                inteira a jusante. Uma revisão sistemática impecável que chega depois da
                reunião não é um acerto parcial — é um erro caro executado com competência.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                Portão de ação
              </div>
              <h3 className="mt-1 mb-3 text-lg font-bold text-slate-900">
                O rodapé não é ação
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Reconhecer o limite e seguir como se ele não existisse fecha o portão. E a
                simetria é obrigatória: o que se avalia é{" "}
                <strong className="text-slate-900">compatibilidade, não mudança</strong> —
                mudar tudo por segurança, quando o limite não pedia, também é erro.
              </p>
            </div>
          </div>

          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-slate-500">
            As quatro leituras — triagem, ação, artefato, adaptação — nunca são somadas. A
            média esconderia a diferença que o curso existe para ensinar.
          </p>
        </Section>

        {/* ---------------- CARIMBOS ---------------- */}
        <Section className="py-20 md:py-24">
          <div className="mb-10 max-w-3xl">
            <h2 className="mb-4 text-3xl font-bold text-slate-900 md:text-4xl">
              Todo número sai carimbado
            </h2>
            <p className="text-lg leading-relaxed text-slate-600">
              Corpus bruto gera exploração. Corpus validado gera evidência pedagógica. Fonte
              original gera citação. O carimbo viaja com o dado até a tela do aluno, porque
              a proveniência é parte do que se ensina — não um detalhe de bastidor.
            </p>
          </div>

          <div className="mb-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CARIMBOS.map(([tipo, sentido]) => (
              <div
                key={tipo}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <span className="mt-0.5 shrink-0 rounded border border-slate-400 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-slate-600 uppercase">
                  {tipo}
                </span>
                <span className="text-sm leading-relaxed text-slate-600">{sentido}</span>
              </div>
            ))}
          </div>

          <div className="max-w-3xl">
            <h3 className="mb-3 text-xl font-bold text-slate-900">
              E os erros de trabalho não se apagam — carimbam-se
            </h3>
            <p className="mb-6 leading-relaxed text-slate-600">
              O registro de invalidação é controle de versão epistemológico. Estes três são
              da construção do próprio curso, e continuam no repositório justamente porque
              apagá-los ensinaria a coisa errada.
            </p>
            <div className="space-y-3">
              {INVALIDACOES.map((r) => (
                <div
                  key={r.valor}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {r.valor}
                    </span>
                    <span className="rounded border border-slate-400 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-slate-600 uppercase">
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">{r.motivo}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-slate-500">
              O segundo é o modo de falha mais interessante que a construção encontrou:
              fusão de metadado com pergunta. Um número real, extraído do documento certo,
              que responde a outra pergunta. Nenhuma checagem de fonte o pegaria — a fonte
              estava certa.
            </p>
          </div>
        </Section>

        {/* ---------------- ESTADO ---------------- */}
        <Section isDark className="py-20 md:py-24">
          <div className="max-w-3xl">
            <h2 className="mb-4 text-3xl font-bold text-slate-900 md:text-4xl">
              Onde o curso está hoje
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-slate-600">
              Um curso sobre proveniência que mentisse sobre o próprio estado não teria como
              ser levado a sério. Então: ele está em construção, e estes são os números.
            </p>

            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-3xl font-extrabold text-slate-900">108</div>
                <div className="mt-1 text-sm text-slate-600">
                  documentos únicos no acervo de origem
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  142 arquivos, deduplicados por hash
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-3xl font-extrabold text-slate-900">33</div>
                <div className="mt-1 text-sm text-slate-600">
                  casos de julgamento escritos
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  seis competências, 21% de triagem deliberadamente ambígua
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-3xl font-extrabold text-slate-900">0</div>
                <div className="mt-1 text-sm text-slate-600">
                  casos aprovados para publicação
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  o portão exige revisão humana, e ela ainda não foi feita
                </div>
              </div>
            </div>

            <p className="leading-relaxed text-slate-600">
              Nenhum item vai ao ar sem nome e data de quem aprovou — é restrição de banco,
              não processo que se esquece. Os portões automáticos têm vãos conhecidos e
              documentados, e a revisão humana existe para cobri-los. É por isso que o
              número acima é zero, e é por isso que ele está publicado.
            </p>
          </div>
        </Section>

        {/* ---------------- CTA ---------------- */}
        <Section className="py-20 md:py-24">
          <div className="max-w-3xl rounded-2xl bg-slate-900 p-8 md:p-12">
            <h2 className="mb-4 text-2xl font-bold text-white md:text-3xl">
              Quer a mesma arquitetura no seu domínio?
            </h2>
            <p className="mb-8 leading-relaxed text-slate-300">
              A Trilha do Estado é uma instância de um método — trilhas com repetição
              espaçada para o que é fato, casos com portões para o que é julgamento, e
              proveniência obrigatória do começo ao fim. Ele se aplica a captação de
              recursos, a análise regulatória e a qualquer domínio em que a competência real
              seja decidir sob restrição, e não recitar procedimento.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="mailto:diretoria.ponte.projetos@gmail.com?subject=Trilha%20do%20Estado"
                className="inline-flex h-12 items-center rounded-xl bg-white px-6 font-bold text-slate-900 transition hover:bg-slate-100"
              >
                Falar com a Ponte
              </a>
              <Link
                href="#rodada"
                className="inline-flex h-12 items-center rounded-xl border border-slate-700 px-6 font-bold text-slate-200 transition hover:bg-slate-800"
              >
                Voltar para a rodada
              </Link>
            </div>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
