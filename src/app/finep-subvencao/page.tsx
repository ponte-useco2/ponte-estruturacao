import { FormularioFinep } from "@/components/ui/FormularioFinep";

export const metadata = {
  title: "Subvenção Econômica Regional - FINEP | Ponte Projetos",
  description: "Preencha o formulário de Levantamento de Informações e Verificação de Elegibilidade para a Subvenção Econômica Regional FINEP.",
};

export default function FinepPage() {
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
            Preencha o formulário de Levantamento de Informações e Verificação de Elegibilidade (Rodada 2).<br/>
            <span className="font-semibold text-rose-600 mt-2 block">
              PRAZO FINAL PARA SUBMISSÃO: 07 de abril de 2026 até às 18h
            </span>
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-8 bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-xl">
          <p className="text-amber-800 text-sm">
            <strong className="block mb-1">ℹ️ Como usar este formulário:</strong>
            Responda cada questão em ordem. Campos alertados com vermelho são eliminatórios ou alertam sobre características críticas para a submissão. Após preenchimento, o sistema calculará as restrições (se existirem). Clique em &quot;Enviar Formulário FINEP&quot; ao final para o nosso time revisar a sua elegibilidade.
          </p>
        </div>

        <FormularioFinep />
      </div>
    </div>
  );
}
