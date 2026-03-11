"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { submitLead } from "@/app/actions";

export function DiagnosticoForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function clientAction(formData: FormData) {
    setIsSubmitting(true);
    setErrorMsg("");
    
    const result = await submitLead(formData);
    
    setIsSubmitting(false);
    
    if (result.success) {
      setIsSuccess(true);
    } else {
      setErrorMsg(result.error || "Ocorreu um erro ao enviar seu diagnóstico. Tente novamente.");
    }
  }

  if (isSuccess) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-2xl text-center">
        <h3 className="text-xl font-bold text-emerald-900 mb-2">Diagnóstico Recebido!</h3>
        <p className="text-emerald-700">Obrigado pelo seu interesse. Nossa equipe de diretoria analisará suas informações e entrará em contato em breve.</p>
      </div>
    );
  }

  return (
    <form action={clientAction} className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">Nome</label>
          <input required name="nome" type="text" className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all" placeholder="Seu nome" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">E-mail</label>
          <input required name="email" type="email" className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all" placeholder="voce@empresa.com" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">WhatsApp</label>
          <input required name="whatsapp" type="tel" className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all" placeholder="(00) 00000-0000" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">Organização</label>
          <input required name="organizacao" type="text" className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all" placeholder="Nome da empresa" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">Cidade/Estado</label>
          <input required name="cidade" type="text" className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all" placeholder="Sua localização" />
        </div>
        <div className="space-y-2">
          <label htmlFor="tipo-org" className="text-sm font-medium text-slate-900">Tipo de organização</label>
          <select required name="tipo_org" id="tipo-org" title="Tipo de organização" className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white">
            <option value="Startup / Inovação">Startup / Inovação</option>
            <option value="PME">PME</option>
            <option value="Instituição / Parceiro">Instituição / Parceiro</option>
            <option value="Órgão Público">Órgão Público</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="estagio-proj" className="text-sm font-medium text-slate-900">Em que estágio o projeto está?</label>
        <select required name="estagio_proj" id="estagio-proj" title="Estágio do projeto" className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white">
          <option value="É apenas uma ideia inicial">É apenas uma ideia inicial</option>
          <option value="Já temos estrutura, mas precisa de enquadramento">Já temos estrutura, mas precisa de enquadramento</option>
          <option value="Em redação/rascunho avançado, precisa revisão">Em redação/rascunho avançado, precisa revisão</option>
          <option value="Projeto aprovado/em execução precisando de governança">Projeto aprovado/em execução precisando de governança</option>
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">Qual o objetivo principal?</label>
          <input required name="objetivo" type="text" className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all" placeholder="Ex: Captação de recurso" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">Existe prazo ou edital associado?</label>
          <input required name="prazo_edital" type="text" className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all" placeholder="Ex: Sim, Finep até dia 20" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-900">Descreva resumidamente sua demanda</label>
        <textarea required name="demanda_resumo" rows={4} className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all resize-none" placeholder="Contexto do problema de forma breve..." />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Enviando diagnóstico..." : "Enviar solicitação de diagnóstico"}
      </Button>
    </form>
  );
}
