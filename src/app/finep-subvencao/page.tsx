import Link from "next/link";
import { FormularioFinep } from "@/components/ui/FormularioFinep";
import { RODADA_FINEP_SUBVENCAO, finepSubvencaoAberta } from "@/lib/oportunidades/finep-prazo";

/** Relida a cada hora: o fim do prazo fecha a página sem precisar de publicação nova (A1-01, 29/10/2026). */
export const revalidate = 3600;

export const metadata = {
  title: "Subvenção Econômica Regional - FINEP | Ponte Projetos",
  description: "Preencha o formulário de Levantamento de Informações e Verificação de Elegibilidade para a Subvenção Econômica Regional FINEP.",
};

export default function FinepPage() {
  const aberta = finepSubvencaoAberta();
  return (
    <div className="min-h-screen bg-slate-50 py-12 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto mb-10 text-center">
          <div className="inline-flex items-center justify-center bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide mb-6">
            FINEP – Mais Inovação Brasil
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-6 font-display">
            Formulário de Subvenção Econômica Regional
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Levantamento de Informações e Verificação de Elegibilidade ({RODADA_FINEP_SUBVENCAO}).<br/>
            <span className="font-semibold text-rose-600 mt-2 block">
              {aberta ? "PRAZO FINAL PARA SUBMISSÃO: 07 de abril de 2026 até às 18h" : "Prazo encerrado em 07 de abril de 2026, às 18h"}
            </span>
          </p>
        </div>

{aberta ? (
          <>
                <div className="max-w-4xl mx-auto mb-8 bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-xl">
          <p className="text-amber-800 text-sm">
            <strong className="block mb-1">ℹ️ Como usar este formulário:</strong>
            Responda cada questão em ordem. Campos alertados com vermelho são eliminatórios ou alertam sobre características críticas para a submissão. Após preenchimento, o sistema calculará as restrições (se existirem). Clique em &quot;Enviar Formulário FINEP&quot; ao final para o nosso time revisar a sua elegibilidade.
          </p>
        </div>

        <FormularioFinep />
          </>
        ) : (
          <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-xl p-6 md:p-8 text-slate-700">
            <h2 className="text-xl font-bold text-slate-900 mb-3">Esta rodada não recebe mais formulários</h2>
            <p className="mb-3 leading-relaxed">
              A {RODADA_FINEP_SUBVENCAO} da Subvenção Econômica Regional da FINEP encerrou em 07 de abril de 2026, às 18h. O
              formulário saiu do ar para ninguém preencher um pedido que já não pode ser submetido.
            </p>
            <p className="leading-relaxed">
              Para uma próxima chamada da FINEP ou outra fonte de fomento à inovação, fale com a PONTE pela página de{" "}
              <Link href="/consultoria-finep" className="font-semibold text-indigo-700 underline">
                consultoria FINEP
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
