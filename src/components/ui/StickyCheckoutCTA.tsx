"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Tag,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  validateCupom,
  type CupomValido,
} from "@/app/actions-checkout-centelha";
import {
  VALOR_PADRAO_CENTAVOS,
  formatBRL,
} from "@/config/centelha-cupons";

/**
 * Barra fixa no fundo da página com input de cupom + botão "Comprar agora".
 *
 * UX: sempre visível enquanto o usuário rola a landing. Em mobile, evita
 * que o cliente tenha que rolar até o fim pra encontrar o CTA. Em desktop,
 * funciona como dock secundário aos botões inline da seção Pricing.
 *
 * Quando o usuário aplica um cupom aqui, ele é passado como query param
 * pro checkout (?cupom=XXX) e pré-aplicado automaticamente lá.
 */
export function StickyCheckoutCTA() {
  const router = useRouter();
  const [codigoInput, setCodigoInput] = useState("");
  const [cupom, setCupom] = useState<CupomValido | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");

  const valorAtual = cupom?.valorFinalCentavos ?? VALOR_PADRAO_CENTAVOS;
  const temDesconto = valorAtual < VALOR_PADRAO_CENTAVOS;

  const handleAplicarCupom = async () => {
    const codigo = codigoInput.trim();
    if (!codigo) return;
    setIsChecking(true);
    setError("");
    const result = await validateCupom(codigo);
    setIsChecking(false);
    if (result.ok) {
      setCupom(result.cupom);
      setError("");
    } else {
      setCupom(null);
      const msg =
        result.reason === "exhausted"
          ? "Esgotado"
          : result.reason === "inactive"
            ? "Inativo"
            : "Inválido";
      setError(msg);
    }
  };

  const handleRemoverCupom = () => {
    setCupom(null);
    setCodigoInput("");
    setError("");
  };

  const handleComprar = () => {
    const params = cupom ? `?cupom=${encodeURIComponent(cupom.codigo)}` : "";
    router.push(`/centelha-3-pb/checkout${params}`);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_24px_rgba(15,23,42,0.08)]"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0px)",
      }}
    >
      <div className="max-w-5xl mx-auto px-3 md:px-6 py-3 md:py-4">
        <div className="flex flex-col sm:flex-row items-stretch gap-2 md:gap-3">
          {/* CUPOM (esquerda) */}
          <div className="flex items-center gap-2 sm:flex-1 sm:max-w-xs">
            {cupom ? (
              // Cupom aplicado — chip de sucesso
              <div className="flex items-center gap-2 w-full bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-emerald-900 truncate">
                    {cupom.codigo}
                  </div>
                  <div className="text-[10px] text-emerald-700">
                    {cupom.afiliadoNome
                      ? `via ${cupom.afiliadoNome}`
                      : "aplicado"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoverCupom}
                  className="text-emerald-700 text-xs font-semibold hover:text-emerald-900 underline shrink-0"
                  aria-label="Remover cupom"
                >
                  Remover
                </button>
              </div>
            ) : (
              // Input de cupom + botão Aplicar
              <div className="flex items-center gap-2 w-full">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={codigoInput}
                    onChange={(e) => {
                      setCodigoInput(e.target.value);
                      if (error) setError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAplicarCupom();
                      }
                    }}
                    placeholder="Tem cupom?"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all uppercase placeholder:normal-case placeholder:text-slate-400"
                    maxLength={32}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAplicarCupom}
                  disabled={!codigoInput.trim() || isChecking}
                  className="shrink-0 px-3 py-2.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isChecking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Aplicar"
                  )}
                </button>
              </div>
            )}
          </div>

          {/* DIVISOR */}
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-700 sm:hidden">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* BOTÃO COMPRAR (direita) */}
          <button
            type="button"
            onClick={handleComprar}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 font-semibold text-sm md:text-base shadow-md transition-all hover:-translate-y-0.5 whitespace-nowrap"
          >
            {temDesconto ? (
              <span className="flex items-center gap-2">
                <span className="text-emerald-200 line-through text-xs hidden sm:inline">
                  {formatBRL(VALOR_PADRAO_CENTAVOS)}
                </span>
                <span>Comprar — {formatBRL(valorAtual)}</span>
              </span>
            ) : (
              <span>Comprar agora — {formatBRL(valorAtual)}</span>
            )}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mensagem de erro (desktop) */}
        {error && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-rose-700 mt-1.5 px-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error === "Esgotado"
              ? "Código esgotado — todas as vagas foram usadas."
              : error === "Inativo"
                ? "Código não está mais ativo."
                : "Código não encontrado."}
          </div>
        )}
      </div>
    </div>
  );
}
