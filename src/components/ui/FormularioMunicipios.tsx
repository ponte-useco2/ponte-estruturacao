"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { submitReurbLead } from "@/app/actions-reurb";
import { CheckCircle2 } from "lucide-react";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function FormularioMunicipios() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function clientAction(formData: FormData) {
    setIsSubmitting(true);
    setErrorMsg("");

    const result = await submitReurbLead(formData);

    setIsSubmitting(false);

    if (result.success) {
      setIsSuccess(true);
    } else {
      setErrorMsg(
        result.error ||
          "Ocorreu um erro ao enviar sua solicitação. Tente novamente."
      );
    }
  }

  if (isSuccess) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-2xl text-center max-w-3xl mx-auto">
        <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-emerald-900 mb-2">
          Solicitação recebida!
        </h3>
        <p className="text-emerald-700 leading-relaxed">
          Obrigado. Nossa equipe vai preparar um diagnóstico preliminar do seu município
          com base em dados públicos (IPTU, CAR, IBGE) e entrará em contato em até
          15 dias com um relatório executivo.
        </p>
      </div>
    );
  }

  return (
    <form action={clientAction} className="max-w-3xl mx-auto space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}

      {/* Identificação */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6">
        <h3 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase">
          1. Identificação do responsável
        </h3>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label htmlFor="reurb-nome" className="text-sm font-medium text-slate-900">
              Nome completo
            </label>
            <input
              id="reurb-nome"
              required
              name="nome"
              type="text"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
              placeholder="Ex: Maria Silva"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="reurb-cargo" className="text-sm font-medium text-slate-900">
              Cargo
            </label>
            <select
              id="reurb-cargo"
              required
              name="cargo"
              defaultValue=""
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
            >
              <option value="" disabled>Selecione...</option>
              <option value="Prefeito(a)">Prefeito(a)</option>
              <option value="Vice-Prefeito(a)">Vice-Prefeito(a)</option>
              <option value="Secretário(a) de Planejamento">Secretário(a) de Planejamento</option>
              <option value="Secretário(a) de Fazenda/Finanças">Secretário(a) de Fazenda/Finanças</option>
              <option value="Secretário(a) de Habitação/Obras">Secretário(a) de Habitação/Obras</option>
              <option value="Procurador(a) Municipal">Procurador(a) Municipal</option>
              <option value="Equipe Técnica">Equipe Técnica</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label htmlFor="reurb-email" className="text-sm font-medium text-slate-900">
              E-mail institucional
            </label>
            <input
              id="reurb-email"
              required
              name="email"
              type="email"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
              placeholder="voce@prefeitura.gov.br"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="reurb-whatsapp" className="text-sm font-medium text-slate-900">
              WhatsApp
            </label>
            <input
              id="reurb-whatsapp"
              required
              name="whatsapp"
              type="tel"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>
      </div>

      {/* Município */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6">
        <h3 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase">
          2. Dados do município
        </h3>

        <div className="grid md:grid-cols-3 gap-5">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="reurb-municipio" className="text-sm font-medium text-slate-900">
              Município
            </label>
            <input
              id="reurb-municipio"
              required
              name="municipio"
              type="text"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
              placeholder="Ex: Mamanguape"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="reurb-uf" className="text-sm font-medium text-slate-900">
              UF
            </label>
            <select
              id="reurb-uf"
              required
              name="uf"
              defaultValue=""
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
            >
              <option value="" disabled>UF</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label htmlFor="reurb-populacao" className="text-sm font-medium text-slate-900">
              População estimada
            </label>
            <select
              id="reurb-populacao"
              required
              name="populacao"
              defaultValue=""
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
            >
              <option value="" disabled>Selecione a faixa...</option>
              <option value="Até 5 mil habitantes">Até 5 mil habitantes</option>
              <option value="5 a 10 mil">5 a 10 mil</option>
              <option value="10 a 20 mil">10 a 20 mil</option>
              <option value="20 a 50 mil">20 a 50 mil</option>
              <option value="Acima de 50 mil">Acima de 50 mil</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="reurb-imoveis" className="text-sm font-medium text-slate-900">
              Nº estimado de imóveis
            </label>
            <input
              id="reurb-imoveis"
              name="imoveis_estimados"
              type="text"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
              placeholder="Ex: 8.000 (se não souber, pode deixar em branco)"
            />
          </div>
        </div>
      </div>

      {/* Contexto REURB */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6">
        <h3 className="text-sm font-bold text-emerald-700 tracking-[0.08em] uppercase">
          3. Contexto da regularização
        </h3>

        <div className="space-y-2">
          <label htmlFor="reurb-situacao" className="text-sm font-medium text-slate-900">
            Situação atual do cadastro imobiliário
          </label>
          <select
            id="reurb-situacao"
            required
            name="situacao_cadastral"
            defaultValue=""
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
          >
            <option value="" disabled>Selecione...</option>
            <option value="Não temos cadastro estruturado">Não temos cadastro estruturado</option>
            <option value="Cadastro básico, desatualizado">Cadastro básico, desatualizado</option>
            <option value="Cadastro razoável, sem integração com cartório">
              Cadastro razoável, sem integração com cartório
            </option>
            <option value="Cadastro bom, mas sem processo REURB">
              Cadastro bom, mas sem processo REURB
            </option>
            <option value="REURB já iniciado, precisa de apoio técnico">
              REURB já iniciado, precisa de apoio técnico
            </option>
            <option value="Não sei informar">Não sei informar</option>
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label htmlFor="reurb-objetivo" className="text-sm font-medium text-slate-900">
              Qual o principal objetivo?
            </label>
            <select
              id="reurb-objetivo"
              required
              name="objetivo"
              defaultValue=""
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
            >
              <option value="" disabled>Selecione...</option>
              <option value="Regularização fundiária (REURB-S/E)">
                Regularização fundiária (REURB-S/E)
              </option>
              <option value="Ampliar base de IPTU">Ampliar base de IPTU</option>
              <option value="Captação de recursos federais (FNHIS, PAC, etc)">
                Captação de recursos federais (FNHIS, PAC, etc)
              </option>
              <option value="Defesa de patrimônio público">
                Defesa de patrimônio público
              </option>
              <option value="Conciliação IPTU x Cartório">
                Conciliação IPTU x Cartório
              </option>
              <option value="Projeto ESG / créditos de carbono (USECO2)">
                Projeto ESG / créditos de carbono (USECO2)
              </option>
              <option value="Não tenho certeza, quero entender melhor">
                Não tenho certeza, quero entender melhor
              </option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="reurb-prazo" className="text-sm font-medium text-slate-900">
              Prazo desejado para início
            </label>
            <select
              id="reurb-prazo"
              required
              name="prazo"
              defaultValue=""
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
            >
              <option value="" disabled>Selecione...</option>
              <option value="Imediato (até 60 dias)">Imediato (até 60 dias)</option>
              <option value="Curto prazo (até 6 meses)">Curto prazo (até 6 meses)</option>
              <option value="Este mandato (até 2028)">Este mandato (até 2028)</option>
              <option value="Ainda estudando">Ainda estudando</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="reurb-obs" className="text-sm font-medium text-slate-900">
            Observações (opcional)
          </label>
          <textarea
            id="reurb-obs"
            name="observacoes"
            rows={4}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all resize-none"
            placeholder="Conte algo relevante sobre a situação do seu município: áreas de conflito, foros patronais, prazos institucionais, prioridades da gestão..."
          />
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-sm text-emerald-900 leading-relaxed">
        Ao enviar, você recebe um <strong>diagnóstico preliminar gratuito em até 15 dias</strong>,
        usando dados públicos (IPTU, CAR, IBGE) do seu município. Sem compromisso.
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Enviando solicitação..." : "Solicitar diagnóstico gratuito"}
      </Button>
    </form>
  );
}
