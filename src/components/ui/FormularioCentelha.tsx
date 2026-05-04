"use client";

import { useEffect, useState } from "react";
import {
  Send,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PoliticaPrivacidadeCentelha } from "@/components/ui/PoliticaPrivacidadeCentelha";
import { submitCentelhaLead } from "@/app/actions-centelha";
import { getTrackingRefFromUrlAndStore } from "@/lib/tracking";

type Step1Data = {
  nome: string;
  email: string;
  whatsapp: string;
  municipio: string;
};

/**
 * Formulário Centelha 3 PB em 2 etapas (progressive disclosure).
 *
 * Etapa 1 (4 campos): identidade — baixa fricção.
 * Etapa 2 (8 campos + LGPD): detalhes do projeto — só depois do compromisso inicial.
 *
 * Os dados da Etapa 1 são guardados em state e re-emitidos como inputs hidden
 * no <form> da Etapa 2 — submit final manda tudo junto via FormData.
 */
export function FormularioCentelha() {
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Data>({
    nome: "",
    email: "",
    whatsapp: "",
    municipio: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [trackingRef, setTrackingRef] = useState<string | null>(null);

  // Captura ?ref= ou ?utm_source= da URL e persiste em sessionStorage (24h)
  useEffect(() => {
    setTrackingRef(getTrackingRefFromUrlAndStore());
  }, []);

  const scrollToFormTop = () => {
    document
      .getElementById("diagnostico-centelha")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleStep1Submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStep1Data({
      nome: (fd.get("nome") as string) || "",
      email: (fd.get("email") as string) || "",
      whatsapp: (fd.get("whatsapp") as string) || "",
      municipio: (fd.get("municipio") as string) || "",
    });
    setStep(2);
    setTimeout(scrollToFormTop, 50);
  };

  const handleBack = () => {
    setStep(1);
    setTimeout(scrollToFormTop, 50);
  };

  const handleStep2Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const result = await submitCentelhaLead(formData);

    setIsSubmitting(false);

    if (result.success) {
      setIsSuccess(true);
    } else {
      setErrorMsg(
        result.error
          ? `Não conseguimos registrar agora (${result.error}). Tente novamente em instantes ou nos chame no WhatsApp.`
          : "Não conseguimos registrar agora. Tente novamente em instantes ou nos chame no WhatsApp."
      );
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 md:p-12 text-center max-w-2xl mx-auto">
        <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-5" />
        <h3 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-3">
          Ideia Recebida com Sucesso!
        </h3>
        <p className="text-emerald-800 mb-8 leading-relaxed">
          Nossa equipe fará uma validação inicial de aderência da sua proposta
          ao edital. Entraremos em contato em breve com os próximos passos.
        </p>
        <a
          href="https://wa.me/5583996428315?text=Ol%C3%A1!%20Preenchi%20o%20formul%C3%A1rio%20do%20Centelha%203%20PB%20e%20gostaria%20de%20agendar%20uma%20conversa."
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-14 items-center justify-center rounded-xl bg-emerald-600 px-8 text-lg font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
        >
          Agendar conversa no WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <ProgressIndicator step={step} />

      {step === 1 ? (
        <form
          key="step1"
          onSubmit={handleStep1Submit}
          className="bg-white rounded-2xl border border-slate-200 p-6 md:p-10"
        >
          <div className="text-center mb-8">
            <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
              Vamos começar — em 30 segundos
            </h3>
            <p className="text-slate-600">
              Só precisamos saber quem você é. Detalhes do projeto na próxima
              etapa.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <div className="space-y-2">
              <label
                htmlFor="cn-nome"
                className="text-sm font-semibold text-slate-900"
              >
                Nome Completo
              </label>
              <input
                id="cn-nome"
                type="text"
                name="nome"
                required
                defaultValue={step1Data.nome}
                placeholder="Seu nome ou do proponente principal"
                autoFocus
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="cn-email"
                className="text-sm font-semibold text-slate-900"
              >
                E-mail
              </label>
              <input
                id="cn-email"
                type="email"
                name="email"
                required
                defaultValue={step1Data.email}
                placeholder="seu.melhor@email.com"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mb-8">
            <div className="space-y-2">
              <label
                htmlFor="cn-whatsapp"
                className="text-sm font-semibold text-slate-900"
              >
                WhatsApp
              </label>
              <input
                id="cn-whatsapp"
                type="tel"
                name="whatsapp"
                required
                defaultValue={step1Data.whatsapp}
                placeholder="(XX) 9XXXX-XXXX"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="cn-municipio"
                className="text-sm font-semibold text-slate-900"
              >
                Município (PB)
              </label>
              <input
                id="cn-municipio"
                type="text"
                name="municipio"
                required
                defaultValue={step1Data.municipio}
                placeholder="Sua cidade atual"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
              />
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
          >
            Continuar para detalhes do projeto
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </form>
      ) : (
        <form
          key="step2"
          onSubmit={handleStep2Submit}
          className="bg-white rounded-2xl border border-slate-200 p-6 md:p-10"
        >
          {/* Hidden inputs com dados da Etapa 1 */}
          <input type="hidden" name="nome" value={step1Data.nome} />
          <input type="hidden" name="email" value={step1Data.email} />
          <input type="hidden" name="whatsapp" value={step1Data.whatsapp} />
          <input type="hidden" name="municipio" value={step1Data.municipio} />
          <input type="hidden" name="deseja_analise" value="Sim" />
          {/* Tracking de afiliado (ex: ?ref=marcio) */}
          {trackingRef && (
            <input type="hidden" name="ref" value={trackingRef} />
          )}

          {errorMsg && (
            <div
              role="alert"
              className="flex gap-3 items-start p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Card de boas-vindas */}
          <div className="flex gap-3 items-start p-4 mb-8 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">
                Olá, {step1Data.nome.split(" ")[0] || "tudo certo"}!
              </p>
              <p className="text-xs text-slate-600">
                Agora conta um pouco sobre o seu projeto. Levam mais 1–2
                minutos.
              </p>
            </div>
            <button
              type="button"
              onClick={handleBack}
              className="bg-transparent border-0 text-emerald-700 hover:text-emerald-900 cursor-pointer text-xs font-semibold inline-flex items-center gap-1 px-2 py-1"
            >
              <ArrowLeft className="w-3 h-3" /> Editar
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <div className="space-y-2">
              <label
                htmlFor="cn-projeto"
                className="text-sm font-semibold text-slate-900"
              >
                Nome do projeto ou ideia
              </label>
              <input
                id="cn-projeto"
                type="text"
                name="nome_projeto"
                required
                placeholder="Sua ideia ou nome provisório"
                autoFocus
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="cn-area"
                className="text-sm font-semibold text-slate-900"
              >
                Área de atuação
              </label>
              <input
                id="cn-area"
                type="text"
                name="area_solucao"
                required
                placeholder="Ex: Agritech, Saúde, Edtech..."
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2 mb-5">
            <span className="text-sm font-semibold text-slate-900 block">
              Estágio Atual da Solução
            </span>
            <div className="flex flex-col gap-2">
              {[
                { v: "Apenas Ideia", label: "Apenas Ideia / Conceito no Papel" },
                {
                  v: "Protótipo",
                  label: "Protótipo (Laboratório ou Conceitual)",
                },
                {
                  v: "MVP",
                  label: "MVP / Produto rodando com primeiros clientes",
                },
              ].map((opt, i) => (
                <label
                  key={opt.v}
                  className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-slate-400 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="estagio"
                    value={opt.v}
                    required={i === 0}
                    className="w-4 h-4 text-emerald-600 accent-emerald-600"
                  />
                  <span className="text-sm text-slate-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2 mb-5">
            <label
              htmlFor="cn-cnpj"
              className="text-sm font-semibold text-slate-900"
            >
              Você já tem CNPJ ou pretende abrir?
            </label>
            <select
              id="cn-cnpj"
              name="cnpj_status"
              required
              defaultValue=""
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white"
            >
              <option value="" disabled>
                Selecione uma opção
              </option>
              <option value="Já tenho CNPJ">Já tenho CNPJ</option>
              <option value="Ainda não tenho CNPJ">Ainda não tenho CNPJ</option>
              <option value="Sou MEI">Sou MEI</option>
              <option value="Não sei qual enquadramento usar">
                Não sei qual enquadramento usar
              </option>
            </select>
          </div>

          <div className="space-y-2 mb-5">
            <label
              htmlFor="cn-problema"
              className="text-sm font-semibold text-slate-900"
            >
              Qual problema sua solução resolve?
            </label>
            <textarea
              id="cn-problema"
              name="problema"
              rows={3}
              required
              placeholder="Descreva brevemente a dor que você está curando..."
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all resize-none"
            />
          </div>

          <div className="space-y-2 mb-5">
            <label
              htmlFor="cn-link"
              className="text-sm font-semibold text-slate-900"
            >
              Link de resumo, pitch ou vídeo{" "}
              <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              id="cn-link"
              type="url"
              name="link_pitch"
              placeholder="Cole aqui um link com acesso aberto (Drive, YouTube...)"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>

          <div className="space-y-2 mb-8">
            <label
              htmlFor="cn-participou"
              className="text-sm font-semibold text-slate-900"
            >
              Já participou do Centelha 1 ou 2?
            </label>
            <select
              id="cn-participou"
              name="participou_antes"
              required
              defaultValue=""
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white"
            >
              <option value="" disabled>
                Selecione
              </option>
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </div>

          {/* LGPD */}
          <div className="flex items-start gap-3 mb-8">
            <input
              id="cn-lgpd"
              type="checkbox"
              name="lgpd_consentimento"
              required
              className="w-5 h-5 mt-0.5 cursor-pointer accent-emerald-600 shrink-0"
            />
            <label
              htmlFor="cn-lgpd"
              className="text-sm text-slate-600 leading-relaxed cursor-pointer"
            >
              Concordo com a{" "}
              <button
                type="button"
                onClick={() => setIsPrivacyOpen(true)}
                className="bg-transparent border-0 p-0 text-emerald-700 underline cursor-pointer font-inherit"
              >
                Política de Privacidade
              </button>{" "}
              e consinto com o tratamento dos meus dados para fins de contato e
              avaliação do projeto, conforme as diretrizes da LGPD.
            </label>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-6"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
            >
              {isSubmitting ? (
                <>
                  Enviando seu pré-diagnóstico…
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                </>
              ) : (
                <>
                  Solicitar Pré-Diagnóstico <Send className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>

          {isPrivacyOpen && (
            <PoliticaPrivacidadeCentelha
              onClose={() => setIsPrivacyOpen(false)}
            />
          )}
        </form>
      )}
    </div>
  );
}

function ProgressIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-8 select-none" aria-hidden="true">
      <div className="flex items-center justify-center gap-0 mb-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${
            step >= 1
              ? "bg-emerald-600 border-emerald-600 text-white scale-105"
              : "bg-white border-slate-200 text-slate-400"
          }`}
        >
          {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : "1"}
        </div>
        <div
          className={`w-20 h-0.5 mx-3 transition-colors ${
            step >= 2 ? "bg-emerald-600" : "bg-slate-200"
          }`}
        />
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${
            step >= 2
              ? "bg-emerald-600 border-emerald-600 text-white scale-105"
              : "bg-white border-slate-200 text-slate-400"
          }`}
        >
          2
        </div>
      </div>
      <div className="flex items-center justify-center gap-20 text-xs text-slate-500">
        <span
          className={`w-24 text-center transition-colors ${
            step === 1 ? "text-emerald-700 font-semibold" : ""
          }`}
        >
          Contato
        </span>
        <span
          className={`w-24 text-center transition-colors ${
            step === 2 ? "text-emerald-700 font-semibold" : ""
          }`}
        >
          Detalhes do projeto
        </span>
      </div>
    </div>
  );
}
