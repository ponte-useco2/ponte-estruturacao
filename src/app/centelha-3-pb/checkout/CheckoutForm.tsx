"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  Tag,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  validateCupom,
  criarCobrancaCentelha,
  type CupomValido,
} from "@/app/actions-checkout-centelha";
import {
  VALOR_PADRAO_CENTAVOS,
  formatBRL,
  descricaoCupom,
} from "@/config/centelha-cupons";

type CupomState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "valid"; cupom: CupomValido }
  | { status: "invalid"; reason: string };

export function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [codigoInput, setCodigoInput] = useState("");
  const [cupomState, setCupomState] = useState<CupomState>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const cupomPreaplicadoRef = useRef(false);

  // Pré-aplica cupom via query param (?cupom=XXX) — vindo da StickyCheckoutCTA
  useEffect(() => {
    if (cupomPreaplicadoRef.current) return;
    const cupomParam = searchParams.get("cupom");
    if (!cupomParam) return;
    cupomPreaplicadoRef.current = true;

    const codigo = cupomParam.trim().toUpperCase();

    // Todos os setStates dentro do callback async — evita warning
    // react-hooks/set-state-in-effect (setState direto no body do effect)
    validateCupom(codigo).then((result) => {
      setCodigoInput(codigo);
      if (result.ok) {
        setCupomState({ status: "valid", cupom: result.cupom });
      } else {
        const reason =
          result.reason === "exhausted"
            ? "Esse código já foi usado todas as vezes permitidas."
            : result.reason === "inactive"
              ? "Esse código não está mais ativo."
              : "Código não encontrado.";
        setCupomState({ status: "invalid", reason });
      }
    });
  }, [searchParams]);

  const valorAtualCentavos =
    cupomState.status === "valid"
      ? cupomState.cupom.valorFinalCentavos
      : VALOR_PADRAO_CENTAVOS;

  const temDesconto = valorAtualCentavos < VALOR_PADRAO_CENTAVOS;

  const handleAplicarCupom = async () => {
    const codigo = codigoInput.trim();
    if (!codigo) return;
    setCupomState({ status: "checking" });
    const result = await validateCupom(codigo);
    if (result.ok) {
      setCupomState({ status: "valid", cupom: result.cupom });
    } else {
      const reason =
        result.reason === "exhausted"
          ? "Esse código já foi usado todas as vezes permitidas."
          : result.reason === "inactive"
            ? "Esse código não está mais ativo."
            : "Código não encontrado.";
      setCupomState({ status: "invalid", reason });
    }
  };

  const handleRemoverCupom = () => {
    setCodigoInput("");
    setCupomState({ status: "idle" });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);

    // Anexa o cupom validado (se houver) — o servidor vai re-validar e consumir
    if (cupomState.status === "valid") {
      formData.set("codigo_cupom", cupomState.cupom.codigo);
    } else {
      formData.delete("codigo_cupom");
    }

    const result = await criarCobrancaCentelha(formData);

    if (result.success && result.invoiceUrl) {
      // Redireciona pra fatura Asaas
      router.push(result.invoiceUrl);
      // Mantém isSubmitting=true até o redirect acontecer
    } else {
      setIsSubmitting(false);
      setErrorMsg(
        result.error ?? "Não conseguimos gerar sua cobrança. Tente novamente."
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {/* CARD DO VALOR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-bold text-emerald-700 uppercase tracking-wide mb-1">
              Investimento — Etapa 1
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
              Estruturação Técnica Centelha 3 PB
            </h2>
          </div>
          <div className="text-right">
            {temDesconto && (
              <div className="text-sm text-slate-400 line-through">
                {formatBRL(VALOR_PADRAO_CENTAVOS)}
              </div>
            )}
            <div className="text-3xl md:text-4xl font-extrabold text-emerald-700">
              {formatBRL(valorAtualCentavos)}
            </div>
          </div>
        </div>

        {/* Indicador de cupom ativo */}
        {cupomState.status === "valid" && (
          <div className="mt-5 flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-emerald-900">
                Código aplicado: {cupomState.cupom.codigo}
              </p>
              <p className="text-emerald-800">
                {descricaoCupom({
                  tipo: cupomState.cupom.tipo,
                  afiliadoNome: cupomState.cupom.afiliadoNome,
                })}
              </p>
              {cupomState.cupom.vagasRestantes !== null &&
                cupomState.cupom.vagasRestantes <= 3 && (
                  <p className="text-xs text-emerald-700 mt-1">
                    Restam {cupomState.cupom.vagasRestantes}{" "}
                    {cupomState.cupom.vagasRestantes === 1 ? "vaga" : "vagas"}
                  </p>
                )}
            </div>
            <button
              type="button"
              onClick={handleRemoverCupom}
              className="text-emerald-700 text-xs font-semibold hover:text-emerald-900 underline shrink-0"
            >
              Remover
            </button>
          </div>
        )}
      </div>

      {/* INPUT DE CUPOM */}
      {cupomState.status !== "valid" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
          <label
            htmlFor="cupom"
            className="text-sm font-semibold text-slate-900 mb-2 block flex items-center gap-2"
          >
            <Tag className="w-4 h-4 text-emerald-700" />
            Tem um código? <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <div className="flex gap-2">
            <input
              id="cupom"
              type="text"
              value={codigoInput}
              onChange={(e) => {
                setCodigoInput(e.target.value);
                if (cupomState.status === "invalid") {
                  setCupomState({ status: "idle" });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAplicarCupom();
                }
              }}
              placeholder="Ex: PEDRO, LUZERO..."
              className="flex-1 px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all uppercase"
              maxLength={32}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAplicarCupom}
              disabled={!codigoInput.trim() || cupomState.status === "checking"}
              className="shrink-0"
            >
              {cupomState.status === "checking" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Aplicar"
              )}
            </Button>
          </div>

          {cupomState.status === "invalid" && (
            <div className="mt-3 flex gap-2 items-start text-sm text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{cupomState.reason}</span>
            </div>
          )}
        </div>
      )}

      {/* DADOS DO CLIENTE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-5">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-emerald-700" />
          Seus dados para emissão da cobrança
        </h3>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label htmlFor="ckt-nome" className="text-sm font-semibold text-slate-900">
              Nome Completo
            </label>
            <input
              id="ckt-nome"
              type="text"
              name="nome"
              required
              placeholder="Nome do titular"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="ckt-cpf" className="text-sm font-semibold text-slate-900">
              CPF
            </label>
            <input
              id="ckt-cpf"
              type="text"
              name="cpf"
              required
              placeholder="000.000.000-00"
              inputMode="numeric"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label htmlFor="ckt-email" className="text-sm font-semibold text-slate-900">
              E-mail
            </label>
            <input
              id="ckt-email"
              type="email"
              name="email"
              required
              placeholder="seu.melhor@email.com"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="ckt-whatsapp" className="text-sm font-semibold text-slate-900">
              WhatsApp
            </label>
            <input
              id="ckt-whatsapp"
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
            <label htmlFor="ckt-municipio" className="text-sm font-semibold text-slate-900">
              Município (PB)
            </label>
            <input
              id="ckt-municipio"
              type="text"
              name="municipio"
              placeholder="Sua cidade"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="ckt-projeto"
              className="text-sm font-semibold text-slate-900"
            >
              Nome do projeto{" "}
              <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              id="ckt-projeto"
              type="text"
              name="nome_projeto"
              placeholder="Sua ideia"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* ERROR */}
      {errorMsg && (
        <div
          role="alert"
          className="flex gap-3 items-start p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SUBMIT */}
      <div className="space-y-3">
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
        >
          {isSubmitting ? (
            <>
              Gerando cobrança…
              <Loader2 className="w-5 h-5 ml-2 animate-spin" />
            </>
          ) : (
            <>
              Continuar para pagamento — {formatBRL(valorAtualCentavos)}
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Pagamento seguro via Asaas — Pix ou Cartão
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed text-center max-w-md mx-auto">
        Ao continuar, você concorda com a{" "}
        <a href="#privacidade" className="text-emerald-700 underline">
          Política de Privacidade
        </a>
        . A Etapa 1 é uma contratação privada, sem vínculo com recursos
        públicos do edital.
      </p>
    </form>
  );
}
atação privada, sem vínculo com recursos
        públicos do edital.
      </p>
    </form>
  );
}
