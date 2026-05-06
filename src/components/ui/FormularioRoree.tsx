"use client";

import { useState } from "react";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PoliticaPrivacidadeCentelha } from "@/components/ui/PoliticaPrivacidadeCentelha";
import { submitRoreeLead } from "@/app/actions-roree";

/**
 * Formulário de pré-diagnóstico do funil PARCERIA ROREE.
 *
 * Diferenças em relação ao FormularioCentelha tradicional:
 *   - Etapa única (mais direto, lead já decidiu via landing ROREE)
 *   - Campo equipe_qtd (validação dos critérios duros: ≥3 pessoas)
 *   - Sem pergunta sobre Centelha 1/2 ou cupom (não aplicável aqui)
 *   - Submete pra submitRoreeLead (tipo_org = "Centelha 3 PB - ROREE")
 *
 * Após submit: tela de sucesso explicando que o pré-diagnóstico passa
 * por filtro IA + análise humana antes de liberar o checkout (R$ 500).
 */
export function FormularioRoree() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const result = await submitRoreeLead(formData);

    setIsSubmitting(false);

    if (result.success) {
      setIsSuccess(true);
    } else {
      setErrorMsg(
        result.error
          ? `Não conseguimos registrar agora (${result.error}). Tente novamente em instantes.`
          : "Não conseguimos registrar agora. Tente novamente em instantes."
      );
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 md:p-12 text-center max-w-2xl mx-auto">
        <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-5" />
        <h3 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-3">
          Pré-diagnóstico recebido!
        </h3>
        <p className="text-emerald-800 mb-4 leading-relaxed">
          Sua proposta vai passar por uma análise rápida de aderência
          (framework com IA + revisão humana).
        </p>
        <p className="text-emerald-800 mb-8 leading-relaxed">
          <strong>Em até 24h úteis</strong> nossa equipe te avisa pelo WhatsApp
          se sua ideia foi aprovada pra Fase 1 e te enviamos o link pra
          contratar com R$ 500.
        </p>
        <a
          href="https://wa.me/5583996428315?text=Ol%C3%A1!%20Preenchi%20o%20pr%C3%A9-diagn%C3%B3stico%20do%20Centelha%203%20PB%20pela%20parceria%20ROREE%20e%20queria%20conversar."
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-14 items-center justify-center rounded-xl bg-emerald-600 px-8 text-lg font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
        >
          Falar agora no WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200 p-6 md:p-10"
      >
        <div className="text-center mb-8">
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
            Pré-diagnóstico (gratuito)
          </h3>
          <p className="text-slate-600">
            ~3 minutos. Em 24h úteis avaliamos a aderência da sua proposta e te
            enviamos o link pra contratar a Fase 1 (R$ 500).
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="flex gap-3 items-start p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* IDENTIDADE */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
          <div className="space-y-2">
            <label
              htmlFor="rr-nome"
              className="text-sm font-semibold text-slate-900"
            >
              Nome completo *
            </label>
            <input
              id="rr-nome"
              type="text"
              name="nome"
              required
              placeholder="Seu nome ou do proponente principal"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="rr-email"
              className="text-sm font-semibold text-slate-900"
            >
              E-mail *
            </label>
            <input
              id="rr-email"
              type="email"
              name="email"
              required
              placeholder="seu.melhor@email.com"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-5">
          <div className="space-y-2">
            <label
              htmlFor="rr-whatsapp"
              className="text-sm font-semibold text-slate-900"
            >
              WhatsApp *
            </label>
            <input
              id="rr-whatsapp"
              type="tel"
              name="whatsapp"
              required
              placeholder="(XX) 9XXXX-XXXX"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="rr-municipio"
              className="text-sm font-semibold text-slate-900"
            >
              Município (PB) *
            </label>
            <input
              id="rr-municipio"
              type="text"
              name="municipio"
              required
              placeholder="Cidade onde você atua"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
        </div>

        {/* PROJETO */}
        <div className="space-y-2 mb-5">
          <label
            htmlFor="rr-projeto"
            className="text-sm font-semibold text-slate-900"
          >
            Nome do projeto *
          </label>
          <input
            id="rr-projeto"
            type="text"
            name="nome_projeto"
            required
            placeholder="Como você chama a sua ideia?"
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-5">
          <div className="space-y-2">
            <label
              htmlFor="rr-area"
              className="text-sm font-semibold text-slate-900"
            >
              Área da solução *
            </label>
            <select
              id="rr-area"
              name="area_solucao"
              required
              defaultValue=""
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white"
            >
              <option value="" disabled>
                Selecione...
              </option>
              <option>Tecnologia / Software</option>
              <option>Agronegócio / AgTech</option>
              <option>Saúde / HealthTech</option>
              <option>Educação / EdTech</option>
              <option>Energia / Sustentabilidade</option>
              <option>Indústria / Manufatura</option>
              <option>Serviços</option>
              <option>Comércio / E-commerce</option>
              <option>Outro</option>
            </select>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="rr-estagio"
              className="text-sm font-semibold text-slate-900"
            >
              Estágio do projeto *
            </label>
            <select
              id="rr-estagio"
              name="estagio"
              required
              defaultValue=""
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white"
            >
              <option value="" disabled>
                Selecione...
              </option>
              <option>Apenas Ideia</option>
              <option>Protótipo / MVP em desenvolvimento</option>
              <option>MVP funcional</option>
              <option>Em operação inicial</option>
            </select>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          <label
            htmlFor="rr-equipe"
            className="text-sm font-semibold text-slate-900"
          >
            Quantas pessoas têm na sua equipe? *
          </label>
          <select
            id="rr-equipe"
            name="equipe_qtd"
            required
            defaultValue=""
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white"
          >
            <option value="" disabled>
              Selecione...
            </option>
            <option value="1">Sou só eu (1 pessoa)</option>
            <option value="2">2 pessoas</option>
            <option value="3">3 pessoas</option>
            <option value="4">4 pessoas</option>
            <option value="5+">5 ou mais</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            ⓘ O Centelha exige equipe mínima de 3 pessoas cadastradas. Se for
            menos, te ajudamos a estruturar antes da Fase 1.
          </p>
        </div>

        <div className="space-y-2 mb-5">
          <label
            htmlFor="rr-problema"
            className="text-sm font-semibold text-slate-900"
          >
            Em 1-2 frases: que problema sua solução resolve? *
          </label>
          <textarea
            id="rr-problema"
            name="problema"
            required
            rows={3}
            placeholder="Ex: Pais de crianças com TEA esperam até 18 meses pra avaliação no SUS. Nossa plataforma..."
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all resize-none"
          />
        </div>

        <div className="space-y-2 mb-6">
          <label
            htmlFor="rr-link"
            className="text-sm font-semibold text-slate-900"
          >
            Tem algum link com mais detalhes? (opcional)
          </label>
          <input
            id="rr-link"
            type="text"
            name="link_pitch"
            placeholder="Pitch deck, site, vídeo... cola a URL aqui"
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
          />
        </div>

        {/* LGPD */}
        <div className="flex gap-3 items-start mb-6 p-4 bg-slate-50 rounded-lg">
          <input
            id="rr-lgpd"
            type="checkbox"
            name="lgpd"
            required
            className="mt-1 w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <label htmlFor="rr-lgpd" className="text-sm text-slate-700">
            Concordo com a{" "}
            <button
              type="button"
              onClick={() => setIsPrivacyOpen(true)}
              className="text-emerald-700 underline font-medium"
            >
              Política de Privacidade
            </button>{" "}
            e autorizo o uso dos meus dados para análise da minha proposta no
            âmbito da parceria PONTE × ROREE.
          </label>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
        >
          {isSubmitting ? (
            <>
              Enviando...
              <Loader2 className="w-5 h-5 ml-2 animate-spin" />
            </>
          ) : (
            <>
              Enviar pré-diagnóstico
              <Send className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>

        <p className="text-xs text-slate-500 text-center mt-4 leading-relaxed">
          Enviar o pré-diagnóstico é gratuito. Você só paga a Fase 1 (R$ 500)
          se sua ideia for aprovada na nossa análise — e só paga as etapas
          finais (R$ 10k + R$ 10k) se o Centelha aprovar seu projeto.
        </p>
      </form>

      {isPrivacyOpen && (
        <PoliticaPrivacidadeCentelha
          onClose={() => setIsPrivacyOpen(false)}
        />
      )}
    </div>
  );
}
