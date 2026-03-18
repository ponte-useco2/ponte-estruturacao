"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, UploadCloud, X, AlertTriangle, CheckCircle2, Calculator } from "lucide-react";
import { Button } from "./Button";
import { submitFinepForm } from "@/app/actions-finep";

type FormDataState = {
  razao_social: string;
  cnpj: string;
  email_contato: string;
  responsavel_contato: string;
  data_levantamento: string;
  consultor_ponte: string;
  
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  regiao_projeto: string;
  q6: string;
  
  rob_2025: string;
  q8: string;
  q9: string;
  
  q13: string;
  q14: string;
  q15: string;
  q16: string;
  q17: string;

  q18: string;
  q20: string;
  q21: string;
  q23: string;
  q24: string;

  certidoes: Record<string, boolean>;
  q34: string;
  q35: string;

  descricao_inovacao: string;
  missoes: string[];
  trl_atual: number;
  trl_final: number;
  merito: Record<string, number>;

  v_total: string;
  v_finep: string;
  q51: string;

  itens_despesa: string[];
  observacoes: Record<string, string>;
};

const initialState: FormDataState = {
  razao_social: "", cnpj: "", email_contato: "", responsavel_contato: "", data_levantamento: "", consultor_ponte: "",
  q1: "", q2: "", q3: "", q4: "", regiao_projeto: "", q6: "",
  rob_2025: "", q8: "", q9: "",
  q13: "", q14: "", q15: "", q16: "", q17: "",
  q18: "", q20: "", q21: "", q23: "", q24: "",
  certidoes: {}, q34: "", q35: "",
  descricao_inovacao: "", missoes: [], trl_atual: 0, trl_final: 0, merito: {},
  v_total: "", v_finep: "", q51: "", itens_despesa: [], observacoes: {}
};

export function FormularioFinep() {
  const [data, setData] = useState<FormDataState>(initialState);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({ b1: true, b2: true, b3: true, b4: true, b5: true, b6: true, b7: true });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const handleChange = (field: keyof FormDataState, value: string | number | boolean | string[] | Record<string, boolean> | Record<string, number> | Record<string, string>) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (questionId: string, inputFiles: FileList | null) => {
    if (!inputFiles) return;
    const newFiles = Array.from(inputFiles);
    setFiles(prev => ({ ...prev, [questionId]: [...(prev[questionId] || []), ...newFiles] }));
  };

  const removeFile = (questionId: string, index: number) => {
    setFiles(prev => {
      const updated = [...(prev[questionId] || [])];
      updated.splice(index, 1);
      return { ...prev, [questionId]: updated };
    });
  };

  // Eligibility Checks
  const ineligibilities: string[] = [];
  if (data.q1 === "nao") ineligibilities.push("Empresa sem sede no Brasil.");
  if (data.q2 === "nao") ineligibilities.push("Organizações sem fins lucrativos não são elegíveis.");
  if (data.q3 === "nao") ineligibilities.push("MEI, EI e ESI são vedados.");
  if (data.q4 === "nao") ineligibilities.push("Atividade consta na lista de exclusão.");
  if (data.regiao_projeto === "sul") ineligibilities.push("Regiões Sul e Sudeste não contempladas.");
  if (data.q6 === "nao") ineligibilities.push("P&D centralizado exclusivamente no exterior.");
  
  // Helpers para Moeda
  const formatCurrency = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (!digits) return "";
    const number = parseInt(digits, 10) / 100;
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
  };
  const parseCurrency = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(/\./g, "").replace(",", "."));
  };

  const robNum = parseCurrency(data.rob_2025 as string);
  if (robNum > 90000000) ineligibilities.push("ROB superior a 90 milhões.");
  if (data.q8 === "nao") ineligibilities.push("Grupo econômico supera limite de receita.");
  
  if (data.trl_atual > 0 && data.trl_atual < 3) ineligibilities.push("TRL atual abaixo de 3.");

  // Calculators
  let porte = "";
  let minCpPercent = 0;
  
  if (robNum > 0) {
    if (robNum <= 4800000) { porte = "Micro/EPP"; minCpPercent = 5; }
    else if (robNum <= 16000000) { porte = "Pequena"; minCpPercent = 10; }
    else if (robNum <= 90000000) { porte = "Média I"; minCpPercent = 20; }
  }

  const vTotalNum = parseCurrency(data.v_total as string);
  const vFinepNum = parseCurrency(data.v_finep as string);
  const cpRequired = vTotalNum * (minCpPercent / 100);
  const maxFinep = vTotalNum - cpRequired;
  const cpActual = vTotalNum - vFinepNum;

  // Restrição de Contrapartida
  if (vTotalNum > 0 && vFinepNum > maxFinep) {
    ineligibilities.push(`A contrapartida informada (R$ ${(cpActual).toLocaleString('pt-BR', {minimumFractionDigits: 2})}) é menor que o mínimo exigido de ${minCpPercent}% (R$ ${cpRequired.toLocaleString('pt-BR', {minimumFractionDigits: 2})}). O Valor máximo solicitado à FINEP deve ser R$ ${maxFinep.toLocaleString('pt-BR', {minimumFractionDigits: 2})}.`);
  }
  if (vTotalNum > 0 && vFinepNum < 0) {
    ineligibilities.push(`O valor solicitado à FINEP não pode ser negativo.`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("data", JSON.stringify({
      ...data,
      porte_empresa: porte,
      diagnostico_status: ineligibilities.length > 0 ? "Inelegível" : "Pendente Análise",
      diagnostico_pendencias: ineligibilities
    }));

    // Append all files
    Object.keys(files).forEach((qId) => {
      files[qId].forEach((file, index) => {
        formData.append(`file_${qId}_${index}`, file);
      });
    });

    try {
      const result = await submitFinepForm(formData);
      
      setIsSubmitting(false);
      if (result.success) {
        setIsSuccess(true);
      } else {
        setErrorMsg(result.error || "Ocorreu um erro ao enviar o formulário.");
      }
    } catch (err: any) {
      console.error(err);
      setIsSubmitting(false);
      setErrorMsg("Erro de comunicação com o servidor. Tente novamente.");
    }
  }

  if (isSuccess) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-2xl text-center max-w-4xl mx-auto shadow-sm">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-emerald-900 mb-2">Formulário Enviado com Sucesso!</h3>
        <p className="text-emerald-700">Seus dados e documentos foram registrados. Em breve, a equipe da Ponte Estruturação de Projetos entrará em contato.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex items-start gap-3">
           <AlertTriangle className="w-5 h-5 flex-shrink-0" />
           <p>{errorMsg}</p>
        </div>
      )}

      {/* Identificação */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Identificação do Cliente</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="razao_social" className="text-xs font-semibold text-slate-600">Razão Social</label>
            <input id="razao_social" required value={data.razao_social} onChange={e => handleChange("razao_social", e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-800 outline-none text-sm" />
          </div>
          <div className="space-y-1">
            <label htmlFor="cnpj" className="text-xs font-semibold text-slate-600">CNPJ</label>
            <input id="cnpj" required value={data.cnpj} onChange={e => handleChange("cnpj", e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-800 outline-none text-sm" placeholder="00.000.000/0001-00"/>
          </div>
          <div className="space-y-1">
            <label htmlFor="email_contato" className="text-xs font-semibold text-slate-600">E-mail de Contato</label>
            <input id="email_contato" required value={data.email_contato} onChange={e => handleChange("email_contato", e.target.value)} type="email" className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-800 outline-none text-sm" placeholder="seu-email@exemplo.com" />
          </div>
          <div className="space-y-1">
            <label htmlFor="responsavel_contato" className="text-xs font-semibold text-slate-600">Responsável pelo contato</label>
            <input id="responsavel_contato" required value={data.responsavel_contato} onChange={e => handleChange("responsavel_contato", e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-800 outline-none text-sm" />
          </div>
          <div className="space-y-1">
            <label htmlFor="data_levantamento" className="text-xs font-semibold text-slate-600">Data do levantamento</label>
            <input id="data_levantamento" type="date" value={data.data_levantamento} onChange={e => handleChange("data_levantamento", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-800 outline-none text-sm" />
          </div>
        </div>
      </div>

      {/* BLOCO 1 - Elegibilidade */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center cursor-pointer select-none" onClick={() => toggleBlock('b1')}>
          <h2 className="font-bold">BLOCO 1 – Elegibilidade Básica</h2>
          {expandedBlocks.b1 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        
        {expandedBlocks.b1 && (
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-2">1.1 Natureza Jurídica</h3>
              
              <QuestionRadio num="1" text="A empresa é uma pessoa jurídica brasileira com CNPJ ativo e sede no território nacional?" explanation="A FINEP só financia empresas nacionais formalmente constituídas." field="q1" data={data} onChange={handleChange} />
              
              <QuestionRadio num="2" text="A empresa exerce atividade econômica organizada COM finalidade lucrativa?" explanation="A subvenção econômica é exclusiva para empresas com fins lucrativos. ONGs, associações, etc, são vedadas." field="q2" data={data} onChange={handleChange} />

              <QuestionRadio num="3" text="A empresa possui natureza jurídica válida para o edital? (Ou seja, NÃO é EI, MEI ou ESI)." explanation="Empresário Individual (EI), MEI e Empresa Simples de Inovação (ESI) são explicitamente excluídos do edital." field="q3" data={data} onChange={handleChange} labels={["Sim, formato válido", "Não (Somos EI/MEI/ESI)"]} />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-2">1.2 Atividade e Localização</h3>
              
              <QuestionRadio num="4" text="A atividade principal da empresa é permitida pelo edital? (Verifique se ela NÃO consta na Lista de Exclusão da FINEP)." field="q4" data={data} onChange={handleChange} labels={["Sim, é permitida", "Não, está na lista de exclusão"]} />

              <div className="space-y-2">
                <p className="text-sm font-semibold"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs mr-2">5</span>O projeto será executado (majoritariamente) em qual região?</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["Nordeste", "Centro-Oeste", "Norte", "Sul/Sudeste"].map(r => (
                    <button type="button" key={r} onClick={() => handleChange('regiao_projeto', r.toLowerCase().split('/')[0])} className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${data.regiao_projeto === r.toLowerCase().split('/')[0] ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <QuestionRadio num="6" text="A principal atividade de P&D do grupo econômico, na área específica do projeto, está localizada no Brasil?" field="q6" data={data} onChange={handleChange} />
            </div>
          </div>
        )}
      </div>

      {/* BLOCO 2 - Receita */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center cursor-pointer select-none" onClick={() => toggleBlock('b2')}>
          <h2 className="font-bold">BLOCO 2 – Porte e ROB</h2>
          {expandedBlocks.b2 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {expandedBlocks.b2 && (
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs mr-2">7</span>Qual a Receita Operacional Bruta (ROB) da empresa em 2025 (ou 2024)?</p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">R$</span>
                <input type="number" value={data.rob_2025} onChange={e => handleChange('rob_2025', e.target.value)} className="w-48 px-3 py-2 border rounded-lg outline-none focus:border-slate-800" placeholder="0,00" />
                {porte && <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200">{porte}</span>}
              </div>
            </div>

            <QuestionRadio num="8" text="O ROB CONSOLIDADO do grupo econômico também está dentro do limite (R$ 90 mi)?" field="q8" data={data} onChange={handleChange} labels={["Sim / Não possui grupo", "Não (acima do limite)"]} />

            <div className="bg-slate-50 p-4 border rounded-xl border-slate-200 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">💰 Calculadora de Contrapartida</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm">Valor estimado do projeto: R$</span>
                <input type="number" value={data.v_total} onChange={e => handleChange('v_total', e.target.value)} className="w-48 px-3 py-2 border rounded-lg outline-none focus:border-slate-800 text-sm" placeholder="1000000" />
                {vTotalNum > 0 && minCpPercent > 0 && (
                  <span className="text-sm font-bold text-slate-800 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-100">
                    Sua contrapartida mínima ({minCpPercent}%): R$ {cpRequired.toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
            </div>

            <QuestionRadio num="9" text="A empresa tem capacidade de aporte para a contrapartida?" field="q9" data={data} onChange={handleChange} labels={["Sim, tem capacidade", "Não, precisará de financiamento"]} />
          </div>
        )}
      </div>

      {/* BLOCO 3 - Qualificação */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center cursor-pointer select-none" onClick={() => toggleBlock('b3')}>
          <h2 className="font-bold">BLOCO 3 – Qualificação Anterior / Histórico</h2>
          {expandedBlocks.b3 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {expandedBlocks.b3 && (
          <div className="p-6 space-y-6">
            <QuestionRadio num="13" text="A empresa apresentou ROB >= R$ 100.000,00?" field="q13" data={data} onChange={handleChange} />
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
              Se respondeu <strong>NÃO</strong> acima, a empresa precisa atender a pelo menos UM dos requisitos abaixo. Faça os uploads caso atenda.
            </div>

            <div className="space-y-4">
              <QuestionRadio num="14" text="Apoio financeiro da FINEP?" field="q14" data={data} onChange={handleChange} />
              {data.q14 === 'sim' && <FileUpload id="up14" title="Comprovante FINEP" files={files.q14} onFileChange={(f: FileList | null) => handleFileChange("q14", f)} onRemove={i => removeFile("q14", i)} />}

              <QuestionRadio num="15" text="Apoio SUDENE, SUDECO ou SUDAM?" field="q15" data={data} onChange={handleChange} />
              {data.q15 === 'sim' && <FileUpload id="up15" title="Comprovante SUDENE/SUDECO/SUDAM" files={files.q15} onFileChange={(f: FileList | null) => handleFileChange("q15", f)} onRemove={i => removeFile("q15", i)} />}

              <QuestionRadio num="16" text="Concluiu programa SEBRAE?" field="q16" data={data} onChange={handleChange} />
              {data.q16 === 'sim' && <FileUpload id="up16" title="Certificado SEBRAE" files={files.q16} onFileChange={(f: FileList | null) => handleFileChange("q16", f)} onRemove={i => removeFile("q16", i)} />}

              <QuestionRadio num="17" text="Aceleração/Investimento reconhecido?" field="q17" data={data} onChange={handleChange} />
              {data.q17 === 'sim' && <FileUpload id="up17" title="Comprovante de Investimento" files={files.q17} onFileChange={(f: FileList | null) => handleFileChange("q17", f)} onRemove={i => removeFile("q17", i)} />}
            </div>
          </div>
        )}
      </div>

      {/* BLOCO 4 - Documentos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center cursor-pointer select-none" onClick={() => toggleBlock('b4')}>
          <h2 className="font-bold">BLOCO 4 – Documentação Obrigatória</h2>
          {expandedBlocks.b4 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {expandedBlocks.b4 && (
          <div className="p-6 space-y-6">
            <div className="space-y-6 border-b pb-6">
              <QuestionRadio num="18" text="Possui Estatuto ou Contrato Social arquivado?" field="q18" data={data} onChange={handleChange} />
              {data.q18 === 'sim' && <FileUpload id="up18" title="Contrato Social" files={files.q18} onFileChange={(f: FileList | null) => handleFileChange("q18", f)} onRemove={i => removeFile("q18", i)} />}
            </div>
            <div className="space-y-6 border-b pb-6">
              <QuestionRadio num="20" text="Balanço Patrimonial 2025 assinado?" field="q20" data={data} onChange={handleChange} />
              {data.q20 === 'sim' && <FileUpload id="up20" title="Balanço 2025" files={files.q20} onFileChange={(f: FileList | null) => handleFileChange("q20", f)} onRemove={i => removeFile("q20", i)} />}
            </div>
            <div className="space-y-6 border-b pb-6">
              <QuestionRadio num="21" text="DRE 2025 assinada?" field="q21" data={data} onChange={handleChange} />
              {data.q21 === 'sim' && <FileUpload id="up21" title="DRE 2025" files={files.q21} onFileChange={(f: FileList | null) => handleFileChange("q21", f)} onRemove={i => removeFile("q21", i)} />}
            </div>
            
            <QuestionRadio num="23" text="Empresa tem condições de produzir o vídeo do projeto?" field="q23" data={data} onChange={handleChange} />
            <QuestionRadio num="24" text="Cadastro FINEP atualizado e emiti" field="q24" data={data} onChange={handleChange} />
          </div>
        )}
      </div>

      {/* BLOCO 5 - Regularidade */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center cursor-pointer select-none" onClick={() => toggleBlock('b5')}>
          <h2 className="font-bold">BLOCO 5 – Regularidade</h2>
          {expandedBlocks.b5 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {expandedBlocks.b5 && (
          <div className="p-6 space-y-6">
            <div className="space-y-4 border-b pb-6">
              <h3 className="text-sm font-bold text-slate-700">Certidões Obrigatórias</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {[
                   {id: "cnd_federal", label: "CND Federal e INSS"},
                   {id: "fgts", label: "CRF do FGTS"},
                   {id: "cnd_trabalhista", label: "CND Trabalhista"},
                   {id: "cadin", label: "Consulta CADIN"}
                 ].map(cert => (
                   <label key={cert.id} className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                      <input type="checkbox" className="w-4 h-4 text-slate-800 rounded border-slate-300 focus:ring-slate-800" 
                        checked={!!data.certidoes[cert.id]} 
                        onChange={e => setData(prev => ({...prev, certidoes: {...prev.certidoes, [cert.id]: e.target.checked}}))} 
                      />
                      <span className="text-sm font-medium">{cert.label} obtida</span>
                   </label>
                 ))}
              </div>
              <FileUpload id="up_cert" title="Upload das Certidões (PDF)" files={files.certidoes} onFileChange={(f: FileList | null) => handleFileChange("certidoes", f)} onRemove={i => removeFile("certidoes", i)} />
            </div>
            
            <QuestionRadio num="34" text="A empresa NÃO figura como PROPONENTE em outra proposta nesta seleção?" field="q34" data={data} onChange={handleChange} labels={["Sim (apenas esta)", "Não (há outras)"]}/>
            <QuestionRadio num="35" text="A empresa NÃO possui contratos com FINEP em inadimplência?" field="q35" data={data} onChange={handleChange} labels={["Sim (sem pendências)", "Não (há pendências)"]}/>
          </div>
        )}
      </div>

      {/* BLOCO 6 - Aspectos Técnicos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center cursor-pointer select-none" onClick={() => toggleBlock('b6')}>
          <h2 className="font-bold">BLOCO 6 – Aspectos Técnicos e Mérito</h2>
          {expandedBlocks.b6 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {expandedBlocks.b6 && (
          <div className="p-6 space-y-6">
            <div className="space-y-2">
               <p className="text-sm font-semibold"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs mr-2">36</span>Descreva brevemente o produto ou processo inovador</p>
               <textarea rows={4} value={data.descricao_inovacao} onChange={e => handleChange('descricao_inovacao', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-800 outline-none resize-none text-sm" placeholder="A inovação consiste em..."></textarea>
            </div>

            <div className="space-y-3">
               <p className="text-sm font-semibold"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs mr-2">37</span>Em qual(is) Missão(ões) da Nova Indústria Brasil o projeto se enquadra?</p>
               <div className="flex flex-col gap-2 pl-8">
                 {["Missão I: Cadeias agroindustriais", "Missão II: Saúde", "Missão III: Infraestrutura", "Missão IV: Transformação digital", "Missão V: Bioeconomia", "Missão VI: Defesa nacional"].map((missao, idx) => (
                   <label key={idx} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 text-slate-800 rounded focus:ring-slate-800 border-slate-300" 
                        checked={data.missoes.includes(missao)}
                        onChange={(e) => {
                          const newMissoes = e.target.checked ? [...data.missoes, missao] : data.missoes.filter(m => m !== missao);
                          handleChange('missoes', newMissoes);
                        }}
                      />
                      <span className="text-sm">{missao}</span>
                   </label>
                 ))}
               </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
               <p className="text-sm font-semibold"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs mr-2">38</span>TRL (Nível de Maturidade Tecnológica) - de 3 a 9</p>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pl-8">
                 <div className="space-y-2">
                   <label htmlFor="trl_atual" className="text-xs font-bold text-slate-500">TRL Atual</label>
                   <select id="trl_atual" value={data.trl_atual} onChange={e => handleChange('trl_atual', parseInt(e.target.value))} className="w-full p-2 border rounded-lg text-sm outline-none focus:border-slate-800">
                     <option value={0}>Selecione...</option>
                     {[1,2,3,4,5,6,7,8,9].map(t => <option key={t} value={t}>TRL {t}</option>)}
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label htmlFor="trl_final" className="text-xs font-bold text-slate-500">TRL Final Esperado</label>
                   <select id="trl_final" value={data.trl_final} onChange={e => handleChange('trl_final', parseInt(e.target.value))} className="w-full p-2 border rounded-lg text-sm outline-none focus:border-slate-800">
                     <option value={0}>Selecione...</option>
                     {[1,2,3,4,5,6,7,8,9].map(t => <option key={t} value={t}>TRL {t}</option>)}
                   </select>
                 </div>
               </div>
               {data.trl_atual > 0 && data.trl_atual < 3 && <p className="text-xs text-red-600 pl-8 font-semibold">TRL 1 e 2 são inelegíveis.</p>}
            </div>
          </div>
        )}
      </div>

      {/* BLOCO 7 - Valores e Orçamento */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center cursor-pointer select-none" onClick={() => toggleBlock('b7')}>
          <h2 className="font-bold">BLOCO 7 – Valores e Orçamento</h2>
          {expandedBlocks.b7 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {expandedBlocks.b7 && (
          <div className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6 border-b pb-6">
               <div className="space-y-2">
                 <p className="text-sm font-semibold"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs mr-2">49</span>Valor Estimado do Projeto</p>
                 <div className="flex items-center gap-2">
                   <span className="font-medium text-slate-500">R$</span>
                   <input type="text" value={data.v_total} onChange={e => handleChange('v_total', formatCurrency(e.target.value))} className="w-full px-3 py-2 border rounded-lg outline-none focus:border-slate-800 text-sm" placeholder="1.500.000,00" />
                 </div>
               </div>
               <div className="space-y-2">
                 <p className="text-sm font-semibold"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs mr-2">50</span>Valor Solicitado à FINEP</p>
                 <div className="flex items-center gap-2">
                   <span className="font-medium text-slate-500">R$</span>
                   <input type="text" value={data.v_finep} onChange={e => handleChange('v_finep', formatCurrency(e.target.value))} className={`w-full px-3 py-2 border rounded-lg outline-none text-sm transition-colors ${vTotalNum > 0 && vFinepNum > maxFinep ? 'border-red-300 focus:border-red-500 bg-red-50 text-red-700' : 'focus:border-slate-800'}`} placeholder="1.200.000,00" />
                 </div>
                 {vTotalNum > 0 && vFinepNum > maxFinep && (
                   <p className="text-xs text-red-600 font-semibold mt-1">O limite solicitado para esta Contrapartida é R$ {maxFinep.toLocaleString('pt-BR', {minimumFractionDigits: 2})}.</p>
                 )}
               </div>
            </div>

            {vTotalNum > 0 && (
               <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5 flex flex-col gap-3">
                 <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                   <Calculator className="w-5 h-5 text-indigo-600" />
                   Calculadora de Contrapartida
                 </h4>
                 <div className="text-sm text-indigo-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                   <div className="bg-white p-3 rounded shadow-sm border border-indigo-100/50">
                     <span className="block text-indigo-500 text-xs font-semibold mb-1">Porte da Empresa</span>
                     <span className="font-bold text-base">{porte || "Não definido"} ({minCpPercent}%)</span>
                   </div>
                   <div className="bg-white p-3 rounded shadow-sm border border-indigo-100/50">
                     <span className="block text-indigo-500 text-xs font-semibold mb-1">Contrapartida Mínima</span>
                     <span className="font-bold text-base text-rose-600">
                       R$ {cpRequired.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                     </span>
                   </div>
                   <div className="bg-white p-3 rounded shadow-sm border border-indigo-100/50">
                     <span className="block text-indigo-500 text-xs font-semibold mb-1">Máximo Solicitado FINEP</span>
                     <span className="font-bold text-base text-emerald-600">
                       R$ {maxFinep.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                     </span>
                   </div>
                 </div>
                 <p className="text-xs text-indigo-600 mt-1">A contrapartida é a diferença entre o Valor Estimado e o Valor Solicitado à FINEP. O valor solicitado não pode ultrapassar o limite máximo permitido pelo seu porte.</p>
               </div>
             )}

            <QuestionRadio num="51" text="Possui recursos próprios ou precisará de financiamento da FINEP?" field="q51" data={data} onChange={handleChange} labels={["Recursos próprios", "Precisará de financiamento"]}/>

            <div className="space-y-3 pt-4 border-t">
               <p className="text-sm font-semibold"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs mr-2">52</span>Itens de Despesa</p>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-8">
                 {[
                   "Pessoal técnico", "Bolsas de pesquisa", "Materiais de consumo", 
                   "Equipamentos", "Consultoria (ICTs)", "Prototipagem", 
                   "Certificação/testes", "Patenteamento", "Viagens", "Obras/construção (não apoiável)"
                 ].map((item, idx) => (
                   <label key={idx} className={`flex items-center gap-3 cursor-pointer ${item.includes('Obras') ? 'text-rose-600' : ''}`}>
                      <input type="checkbox" className={`w-4 h-4 rounded text-slate-800 border-slate-300 focus:ring-slate-800 ${item.includes('Obras') ? 'accent-rose-600 text-rose-600' : ''}`} 
                        checked={data.itens_despesa.includes(item)}
                        onChange={(e) => {
                          const newItens = e.target.checked ? [...data.itens_despesa, item] : data.itens_despesa.filter(i => i !== item);
                          handleChange('itens_despesa', newItens);
                        }}
                      />
                      <span className="text-sm">{item}</span>
                   </label>
                 ))}
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Ineligibilities Panel */}
      {ineligibilities.length > 0 && (
         <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
            <h3 className="text-red-800 font-bold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5"/>
              Atenção: A proposta possui pendências eliminatórias.
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-red-700">
              {ineligibilities.map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
         </div>
      )}

      {/* Submit */}
      <div className="pt-4">
        <Button disabled={isSubmitting} size="lg" className="w-full text-base h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all">
          {isSubmitting ? "Enviando e processando..." : "Enviar Formulário FINEP"}
        </Button>
      </div>
    </form>
  );
}

// Subcomponents

type QuestionRadioProps = {
  num: string;
  text: string;
  explanation?: string;
  field: keyof FormDataState;
  data: FormDataState;
  onChange: (field: keyof FormDataState, value: string) => void;
  labels?: [string, string];
};

function QuestionRadio({ num, text, explanation, field, data, onChange, labels = ["Sim", "Não"] }: QuestionRadioProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="bg-slate-100 text-slate-700 px-2 flex-shrink-0 py-0.5 rounded text-xs font-semibold mt-0.5">{num}</span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{text}</p>
          {explanation && <p className="text-xs text-slate-500 italic">{explanation}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 pl-8 mt-2">
        <label className={`px-4 py-2 border rounded-full text-sm font-medium cursor-pointer transition-colors ${data[field] === 'sim' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
          <input type="radio" className="hidden" name={field} checked={data[field] === 'sim'} onChange={() => onChange(field, 'sim')} />
          {labels[0]}
        </label>
        <label className={`px-4 py-2 border rounded-full text-sm font-medium cursor-pointer transition-colors ${data[field] === 'nao' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
          <input type="radio" className="hidden" name={field} checked={data[field] === 'nao'} onChange={() => onChange(field, 'nao')} />
          {labels[1]}
        </label>
      </div>
    </div>
  );
}

type FileUploadProps = {
  id: string;
  title: string;
  files?: File[];
  onFileChange: (files: FileList | null) => void;
  onRemove: (index: number) => void;
};

function FileUpload({ id, title, files = [], onFileChange, onRemove }: FileUploadProps) {
  return (
    <div className="pl-8 pt-2">
      <p className="text-xs font-bold text-slate-700 mb-2">📎 {title}</p>
      <div className="relative border-2 border-dashed border-slate-300 bg-slate-50 rounded-lg p-4 text-center hover:bg-slate-100 hover:border-slate-400 transition-colors">
        <input type="file" title="Upload file" multiple id={id} onChange={(e) => onFileChange(e.target.files)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
          <UploadCloud className="text-slate-400 w-6 h-6" />
          <span className="text-sm text-slate-500">Clique ou arraste os arquivos aqui</span>
        </div>
      </div>
      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((f: File, i: number) => (
            <div key={i} className="flex items-center gap-2 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-full">
              <span className="max-w-[150px] truncate">{f.name}</span>
              <button aria-label="Remover arquivo" type="button" onClick={() => onRemove(i)} className="text-slate-300 hover:text-rose-400 transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
