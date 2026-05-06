"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { criarCobrancaRoree } from "@/app/actions-checkout-roree";
import {
  VALOR_FASE_ROREE,
  LABEL_FASE_ROREE,
  formatBRL,
  type FaseRoree,
} from "@/config/centelha-roree";

function maskCpf(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1-$2");
}

export function CheckoutFormRoree() {
  const searchParams = useSearchParams();
  const faseParam = searchParams.get("fase") === "2" ? 2 : 1;
  const [fase, setFase] = useState<FaseRoree>(faseParam as FaseRoree);
  const [cpf, setCpf] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setFase(faseParam as FaseRoree);
  }, [faseParam]);

  const valorCentavos = VALOR_FASE_ROREE[fase];
  const labelFase = LABEL_FASE_ROREE[fase];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    formData.set("fase", String(fase));

    const result = await criarCobrancaRoree(formData);

    if (result.success && result.invoiceUrl) {
      // Redireciona pro Asaas
      window.location.href = result.invoiceUrl;
      return;
    }

    setIsSubmitting(false);
    setErrorMsg(
      result.error ||
        "Não conseguimos gerar a cobrança agora. Tente novamente em alguns instantes."
    );
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <input type="hidden" name="fase" value={fase} />

      {/* CARD DO VALOR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <p className="text-sm font-bold text-emerald-700 uppercase tracking-wide mb-1">
              Você está contratando
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">
              {labelFase}
            </h2>
          </div>
          <div className="text-right">
            <div className="text-3xl md:text-4xl font-extrabold text-emerald-700">
              {formatBRL(valorCentavos)}
            </div>
            <div className="text-xs text-slate-500 mt-1">à vista</div>
          </div>
        </div>

        {/* Toggle Fase 1 / Fase 2 */}
        <div className="bg-slate-50 rounded-xl p-2 flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => setFase(1)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
              fase === 1
                ? "bg-emerald-600 text-white shadow"
                : "bg-transparent text-slate-700 hover:bg-white"
            }`}
          >
            Fase 1 — R$ 500
          </button>
          <button
            type="button"
            onClick={() => setFase(2)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
              fase === 2
                ? "bg-emerald-600 text-white shadow"
                : "bg-transparent text-slate-700 hover:bg-white"
            }`}
          >
            Fase 2 — R$ 1.000
          </button>
        </div>
      </div>

      {/* DADOS PESSOAIS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-5">
        <h3 className="text-lg font-bold text-slate-900 mb-1">
          Seus dados de contratação
        </h3>

        {errorMsg && (
          <div
            role="alert"
            className="flex gap-3 items-start p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label
              htmlFor="ck-nome"
              className="text-sm font-semibold text-slate-900"
            >
              Nome completo *
            </label>
            <input
              id="ck-nome"
              type="text"
              name="nome"
              required
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="ck-cpf"
              className="text-sm font-semibold text-slate-900"
            >
              CPF *
            </label>
            <input
              id="ck-cpf"
              type="text"
              name="cpf"
              required
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label
              htmlFor="ck-email"
              className="text-sm font-semibold text-slate-900"
            >
              E-mail *
            </label>
            <input
              id="ck-email"
              type="email"
              name="email"
              required
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="ck-whatsapp"
              className="text-sm font-semibold text-slate-900"
            >
              WhatsApp *
            </label>
            <input
              id="ck-whatsapp"
              type="tel"
              name="whatsapp"
              required
              placeholder="(XX) 9XXXX-XXXX"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label
              htmlFor="ck-municipio"
              className="text-sm font-semibold text-slate-900"
            >
              Município (PB)
            </label>
            <input
              id="ck-municipio"
              type="text"
              name="municipio"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="ck-projeto"
              className="text-sm font-semibold text-slate-900"
            >
              Nome do projeto
            </label>
            <input
              id="ck-projeto"
              type="text"
              name="nome_projeto"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-4">
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
        >
          {isSubmitting ? (
            <>
              Gerando cobrança...
              <Loader2 className="w-5 h-5 ml-2 animate-spin" />
            </>
          ) : (
            <>
              Continuar para pagamento — {formatBRL(valorCentavos)}
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Pagamento seguro via Asaas
          <span className="text-slate-300">·</span>
          <CreditCard className="w-4 h-4 text-emerald-600" />
          Pix ou Cartão (até 6x)
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed text-center max-w-md mx-auto">
        Ao continuar, você concorda com os termos da parceria Ponte × Roree.
        A contratação é privada, sem vínculo com recursos públicos do edital.
        A aprovação no Centelha depende exclusivamente da banca FAPESQ.
      </p>
    </form>
  );
}
