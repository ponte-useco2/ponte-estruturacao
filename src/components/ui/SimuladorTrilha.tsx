"use client";

import { useState } from "react";
import { submitSbceLead } from "@/app/actions-sbce";

type Dim = "reg" | "mat" | "ev" | "gov" | "bem" | "exec";

interface Casa {
  n: number;
  nome: string;
  dim: Dim;
  max: number;
  q: string;
  qh: string;
  o: [string, number, string][];
}

const DIMS: Record<Dim, { nome: string; cor: string }> = {
  reg: { nome: "Clareza regulatória", cor: "#0e7490" },
  mat: { nome: "Materialidade econômica", cor: "#059669" },
  ev: { nome: "Rastreabilidade de evidências", cor: "#b45309" },
  gov: { nome: "Governança decisória", cor: "#475569" },
  bem: { nome: "Impacto / bem comum", cor: "#7c3aed" },
  exec: { nome: "Prontidão de execução", cor: "#064e3b" },
};

const CASAS: Casa[] = [
  { n: 1, nome: "Você está no jogo?", dim: "reg", max: 6.67, q: "Sua empresa pode ser afetada por uma obrigação regulatória, ambiental, social, territorial ou reputacional?", qh: "Ponto de partida da trilha: testa se você reconhece que sua operação tem exposição a alguma obrigação ou risco externo. Só avança quem admite que o tema toca o negócio.", o: [["Reconhecemos a exposição (custo, licença, contrato, crédito ou reputação)", 1, "Você já enxerga que o tema pode mexer com dinheiro, licença de operar, contratos, acesso a crédito ou imagem. É a postura de quem está no jogo."], ["Tratamos como “assunto de ESG”, separado do negócio", 0.5, "O tema existe, mas vive numa caixa à parte, sem conversar com as decisões de negócio. Consciência parcial."], ["“Isso não é conosco” — sem evidência", 0, "A empresa descarta o tema sem ter verificado se há exposição. O maior risco: negar sem evidência."]] },
  { n: 2, nome: "Qual problema isto realmente é?", dim: "reg", max: 6.67, q: "Você aceita reenquadrar o problema além da categoria óbvia (ex.: de “inventário” para “prova auditável”)?", qh: "Percepção 360°: ver o problema além do rótulo aparente. No SBCE, o erro comum é tratar como “inventário de carbono”; o certo é “infraestrutura de prova auditável”.", o: [["Sim — distinguimos obrigação, oportunidade, risco e impacto", 1, "Você separa as quatro camadas do tema e não o reduz a uma só. É a leitura madura."], ["Ainda tratamos como modismo, marketing ou exigência isolada", 0.5, "O tema é visto como tendência passageira ou caixinha a marcar, não como questão estrutural."], ["Resolveríamos com um fornecedor genérico, sem entender a causa", 0, "A tentação de comprar solução pronta antes de entender o problema — costuma resolver a categoria errada."]] },
  { n: 3, nome: "O que é fato, não desejo?", dim: "reg", max: 6.66, q: "Existe uma verdade dura (lei, contrato, licença, dado, auditoria) que nenhuma narrativa flexibiliza?", qh: "Núcleo inegociável: o fato objetivo que não muda com discurso. Quem decide sobre fato, e não sobre desejo, erra menos.", o: [["Sim — temos documento, norma, contrato ou dado objetivo", 1, "Você consegue apontar a fonte dura que sustenta o tema. Base sólida para decidir."], ["Temos percepção, mas não documento", 0.5, "Há intuição correta, mas falta o documento que a comprova. Risco de decidir sobre opinião."], ["Confundimos narrativa institucional com evidência", 0, "A empresa toma o discurso oficial como se fosse prova. Autoengano comum."]] },
  { n: 4, nome: "Isso muda decisão de negócio?", dim: "mat", max: 20, q: "Quando foi a última vez que esse tema entrou numa decisão de orçamento, contrato ou crédito de vocês?", qh: "Materialidade: o tema só importa quando muda uma decisão econômica concreta. Perguntamos pelo passado real (não pela intenção) porque comportamento diz mais que boa vontade.", o: [["Nos últimos 12 meses, com decisão concreta", 1, "O tema já alterou uma decisão real e recente. Sinal forte de materialidade."], ["Há mais de um ano, ou só em discussão", 0.5, "Houve impacto, mas distante no tempo, ou ainda no campo da conversa."], ["Nunca entrou numa decisão econômica", 0, "O tema nunca mudou nada concreto — pode ser importante no discurso, mas ainda não é material."]] },
  { n: 5, nome: "Você consegue provar?", dim: "ev", max: 20, q: "Se um auditor pedisse hoje a fonte de um número do seu inventário, em quanto tempo você a encontraria?", qh: "O coração do método: a dor real não está em calcular o número, está em provar o número. Usamos o teste do auditor porque é o que acontece numa verificação.", o: [["Em minutos — cada número tem fonte e responsável", 1, "Rastreabilidade madura: a evidência está organizada e ligada a cada dado. Pronto para auditoria."], ["Em dias — os dados existem, mas dispersos", 0.5, "Os dados existem, mas espalhados em planilhas, e-mails e PDFs. Reconstruir dá trabalho e gera risco."], ["Não saberia dizer / não temos lastro", 0, "Há afirmações sem documento que as sustente. O ponto mais frágil numa verificação."]] },
  { n: 6, nome: "Quem sente, quem paga, quem veta?", dim: "gov", max: 15, q: "Você mapeou patrocinador, dono do orçamento, dono do dado, jurídico, financeiro e o veto técnico?", qh: "Toda solução morre quando ignora o comitê de decisão. Sem esse mapa, a proposta vai para a pessoa errada.", o: [["Sim — o comitê de decisão está mapeado", 1, "Você sabe quem patrocina, quem paga e quem pode barrar. Caminho claro para decidir."], ["Uma área gosta, mas não decide", 0.5, "Há entusiasmo numa área (ex.: ESG), mas ela não controla orçamento nem decisão. Dor sem poder."], ["A proposta foi para quem não tem poder", 0, "O tema é conduzido por quem não consegue transformá-lo em decisão ou verba."]] },
  { n: 7, nome: "Quem paga o custo invisível da sua decisão?", dim: "bem", max: 15, q: "Você consegue citar uma decisão concreta dos últimos 12 meses que mudou por causa do impacto sobre terceiros?", qh: "A casa mais importante. O bem comum entra não como sermão, mas como custo sistêmico não contabilizado: quem absorve o impacto das suas decisões. Transformar isso em critério separa legitimidade de mera conformidade.", o: [["Sim — temos um exemplo concreto", 1, "Sua empresa já mudou uma decisão real por causa do impacto sobre terceiros. Legitimidade na prática."], ["Reconhecemos o impacto, mas não mudamos decisão", 0.5, "Você enxerga o impacto, mas ele ainda não vira critério de decisão. Falta a ponte entre consciência e ação."], ["Nunca medimos o impacto sobre terceiros", 0, "O custo invisível das decisões nunca foi medido — o ponto cego que separa conformidade de legitimidade."]] },
  { n: 8, nome: "Qual jogada o linear não faria?", dim: "exec", max: 2, q: "Você tem uma tese contraintuitiva falsificável — e sabe como testá-la?", qh: "Tese contraintuitiva: o movimento que o pensamento óbvio não faria, e que pode ser testado. Boa tese é não-óbvia E testável.", o: [["Sim — jogada não-óbvia e testável", 1, "Você tem uma aposta que foge do consenso e sabe como provar se ela é verdadeira."], ["Tese interessante, mas não testável", 0.5, "A ideia é boa, mas não há como verificar se funciona — fica no campo da opinião."], ["Queremos construir primeiro e aprender depois", 0, "A tentação de partir para a obra antes de testar a hipótese. Caro e arriscado."]] },
  { n: 9, nome: "Qual é a cunha?", dim: "exec", max: 2, q: "Há uma oferta pequena, clara e comprável que abre a conversa sem acionar todos os vetos?", qh: "A cunha é a menor oferta capaz de comprar uma conversa séria sem acionar todos os vetos (TI, compras, jurídico).", o: [["Sim — existe uma oferta-cunha", 1, "Você tem um primeiro passo pequeno e comprável que destrava a relação."], ["A oferta é grande, abstrata ou cara demais para o 1º passo", 0.5, "A primeira oferta exige decisão grande demais — afasta em vez de abrir."], ["Tentamos vender transformação completa antes de confiança", 0, "Vender o projeto inteiro antes da primeira confiança costuma travar tudo."]] },
  { n: 10, nome: "Alguém paga agora?", dim: "exec", max: 2, q: "Existe verba aprovada ou dono nomeado para o tema neste exercício?", qh: "A lei E do método: evidência antes da obra. O único juiz da urgência real é o dinheiro. Interesse intelectual não é demanda.", o: [["Sim — há verba ou dono nomeado", 1, "Existe compromisso real: orçamento aprovado ou um responsável com nome. Demanda verdadeira."], ["Em discussão, sem definição", 0.5, "O tema está na pauta, mas ninguém comprometeu verba nem assumiu a responsabilidade ainda."], ["Não há verba nem dono", 0, "Há interesse, talvez elogio, mas nenhum compromisso concreto. Ainda não é demanda."]] },
  { n: 11, nome: "Como isso vira rotina?", dim: "exec", max: 2, q: "Há responsáveis, calendário, evidências e indicadores que integram risco, impacto e decisão?", qh: "Aqui o projeto sai da consultoria e vira operação. Sem governança, o melhor relatório vira peça de gaveta.", o: [["Sim — há governança operacional", 1, "O tema virou rotina com dono, prazo e indicadores. Operação legítima e sustentável."], ["Há um relatório bonito, mas sem dono", 0.5, "Existe um documento bem feito, mas ninguém o opera no dia a dia."], ["Terceirizamos a consciência e voltamos ao modo antigo", 0, "Contratou-se alguém para “cuidar disso” e a empresa voltou a operar como antes."]] },
  { n: 12, nome: "O que merece ser construído?", dim: "exec", max: 2, q: "O workflow foi observado, o comprador pagou e a recorrência apareceu — antes de falar em software?", qh: "A última casa governa a decisão de construir. Construir por entusiasmo técnico, antes da evidência, é o erro que o método existe para evitar.", o: [["Sim — recorrência valida a construção", 1, "O uso real se repetiu e o cliente pagou — agora a automação cria valor de verdade."], ["O serviço é bom, mas sem repetição suficiente", 0.5, "O serviço funciona, mas ainda não há repetição que justifique investir em produto."], ["Queremos construir por entusiasmo técnico", 0, "A vontade de construir vem da empolgação com a tecnologia, não da evidência de demanda."]] },
];

const FASES: { nome: string; sub: string; casas: number[] }[] = [
  { nome: "Consciência", sub: "Você está no jogo e entende qual é o problema?", casas: [1, 2, 3] },
  { nome: "Materialidade & Prova", sub: "Isso muda decisão de negócio — e você consegue provar?", casas: [4, 5, 6] },
  { nome: "Legitimidade & Tese", sub: "Quem absorve o custo invisível, e qual a jogada legítima?", casas: [7, 8, 9] },
  { nome: "Compromisso & Construção", sub: "Alguém paga agora, e o que merece ser construído?", casas: [10, 11, 12] },
];

const DIM_MAX: Record<Dim, number> = (() => {
  const m: Record<Dim, number> = { reg: 0, mat: 0, ev: 0, gov: 0, bem: 0, exec: 0 };
  CASAS.forEach((c) => (m[c.dim] += c.max));
  return m;
})();
const byN = (n: number) => CASAS.find((c) => c.n === n)!;

interface Resultado {
  total: number;
  cls: string;
  cor: string;
  dims: Record<Dim, number>;
  weak: string;
  rec: number;
}

const NIVEIS: [string, string][] = [
  ["Nível 0", "Jogo aberto — sensibilização"],
  ["Nível 1", "Pré-diagnóstico de risco e legitimidade"],
  ["Nível 2", "Diagnóstico especializado por planta"],
  ["Nível 3", "Plano de operação legítima"],
  ["Nível 4", "Núcleo tecnológico / SaaS"],
];

function band(s: number): [string, string] {
  if (s <= 25) return ["Fora do jogo", "#b91c1c"];
  if (s <= 45) return ["Consciência inicial", "#b45309"];
  if (s <= 65) return ["Risco mapeado", "#0e7490"];
  if (s <= 80) return ["Pronto para plano", "#059669"];
  return ["Operação legítima auditável", "#064e3b"];
}
function recLevel(s: number) { return s <= 25 ? 0 : s <= 45 ? 1 : s <= 65 ? 2 : s <= 80 ? 3 : 4; }
function nextStep(rec: number): { t: string; d: string } {
  const t = [
    ["Nível 0 — Jogo aberto.", "Comece pela sensibilização: entenda se e como o tema afeta seu negócio. Ainda não compre diagnóstico — primeiro reconheça a exposição."],
    ["Nível 1 — Pré-Diagnóstico.", "Há consciência inicial, mas falta lastro. Um pré-diagnóstico de baixo ticket revela exposição, maturidade de evidência e lacunas — sem o custo de um diagnóstico completo."],
    ["Nível 2 — Diagnóstico especializado.", "O risco está mapeado; agora vale profundidade. Um diagnóstico por planta entrega relatório defensável, matriz de evidência e plano de decisão."],
    ["Nível 3 — Plano de operação legítima.", "Você está pronto para transformar diagnóstico em rotina: responsáveis, calendário, evidências e indicadores."],
    ["Nível 4 — Núcleo tecnológico.", "Operação legítima e auditável: workflow observado, recorrência e evidência mostram onde a automação cria valor. Só agora se fala em ferramenta ou SaaS."],
  ];
  return { t: t[rec][0], d: t[rec][1] };
}
function moatMsg(bemPct: number): string {
  if (bemPct >= 0.8) return "Você trata o custo invisível da sua operação como critério de decisão — não como marketing. É isso que separa uma empresa que cumpre regra de uma que opera com legitimidade.";
  if (bemPct >= 0.4) return "Você reconhece o impacto da sua operação, mas ainda não o mede. A casa 7 — “quem paga o custo invisível da sua decisão?” — é onde a maioria trava. Transformar externalidade em critério mensurável é o que faz a decisão virar legítima, e não apenas conforme.";
  return "A casa 7 — “quem paga o custo invisível da sua decisão?” — é a que você menos respondeu bem, e a mais importante. Sem ela, há apenas conformidade. Com ela, há legitimidade.";
}

export function SimuladorTrilha() {
  const [fase, setFase] = useState(0);
  const [ans, setAns] = useState<Record<number, number>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<Resultado | null>(null);
  const [warn, setWarn] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const answered = Object.keys(ans).length;
  const faseDone = (i: number) => FASES[i].casas.every((n) => ans[n] !== undefined);

  function toggleHelp(id: string) {
    setOpen((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }
  function pick(n: number, v: number) { setAns((p) => ({ ...p, [n]: v })); setWarn(false); }
  function next() { if (!faseDone(fase)) { setWarn(true); return; } if (fase < 3) setFase(fase + 1); }
  function prev() { if (fase > 0) setFase(fase - 1); }

  function calcular() {
    if (answered < 12) { setWarn(true); return; }
    const dims: Record<Dim, number> = { reg: 0, mat: 0, ev: 0, gov: 0, bem: 0, exec: 0 };
    CASAS.forEach((c) => (dims[c.dim] += ans[c.n] * c.max));
    const total = Math.round(Object.values(dims).reduce((a, b) => a + b, 0));
    let weak = "", wmin = 2;
    (Object.keys(dims) as Dim[]).forEach((k) => { const p = dims[k] / DIM_MAX[k]; if (p < wmin) { wmin = p; weak = DIMS[k].nome; } });
    const [cls, cor] = band(total);
    setResult({ total, cls, cor, dims, weak, rec: recLevel(total) });
  }

  async function clientAction(formData: FormData) {
    setSubmitting(true); setErrorMsg("");
    const res = await submitSbceLead(formData);
    setSubmitting(false);
    if (res.success) setSuccess(true);
    else setErrorMsg(res.error || "Ocorreu um erro ao enviar. Tente novamente.");
  }

  // ----------------- RESULTADO -----------------
  if (result) {
    const ns = nextStep(result.rec);
    const bemPct = result.dims.bem / DIM_MAX.bem;
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-slate-900 text-white p-8 text-center">
          <div className="text-emerald-300 text-sm">Índice PONTE de Decisão Legítima</div>
          <div className="text-6xl font-extrabold leading-none my-1">{result.total}</div>
          <div className="text-emerald-300 text-sm">de 100</div>
          <div className="inline-block mt-3 px-5 py-2 rounded-full text-base font-bold text-white" style={{ background: result.cor }}>{result.cls}</div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Suas seis dimensões</h3>
          {(Object.keys(DIMS) as Dim[]).map((k) => {
            const v = result.dims[k]; const pct = Math.round((v / DIM_MAX[k]) * 100);
            return (
              <div key={k} className="my-3">
                <div className="flex justify-between text-sm mb-1"><span className="text-slate-600">{DIMS[k].nome}</span><span className="font-bold text-slate-800">{Math.round(v)} / {Math.round(DIM_MAX[k])}</span></div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: DIMS[k].cor }} /></div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6">
          <h3 className="text-lg font-bold text-emerald-900 mb-2">Seu próximo movimento legítimo</h3>
          <p className="text-slate-700"><strong>{ns.t}</strong> {ns.d}</p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-6">
          <h3 className="text-base font-bold text-slate-900 mb-3">A escada da Trilha — onde você entra agora</h3>
          {NIVEIS.map((nv, i) => {
            const r = i === result.rec;
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl my-1.5 border ${r ? "bg-emerald-50 border-emerald-500" : "bg-white border-slate-200"}`}>
                <span className={`text-xs font-bold w-16 shrink-0 ${r ? "text-emerald-700" : "text-slate-500"}`}>{nv[0]}</span>
                <span className={`text-sm ${r ? "text-slate-900 font-bold" : "text-slate-500"}`}>{nv[1]}</span>
                {r && <span className="ml-auto bg-emerald-600 text-white text-[10.5px] font-bold px-2.5 py-0.5 rounded-full">você entra aqui</span>}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
          <h3 className="text-sm font-bold text-amber-700 mb-1.5">A casa que mais importa — e que quase ninguém responde bem</h3>
          <p className="text-sm text-amber-900/90">{moatMsg(bemPct)}</p>
        </div>

        {/* CONVERSÃO */}
        <div className="rounded-2xl bg-slate-900 text-white p-6">
          <h3 className="text-xl font-bold mb-2">Sua maior lacuna agora tem nome.</h3>
          <p className="text-slate-300 text-sm">Você acabou de construir um retrato defensável da sua prontidão. Deixar a maior lacuna aberta é o risco que se materializa quando o relato começa, <span className="text-amber-400 font-bold">em 2027</span> — e a multa pode chegar a <span className="text-amber-400 font-bold">3–4% do faturamento</span>.</p>

          {success ? (
            <div className="mt-4 rounded-xl bg-emerald-900/40 border border-emerald-700 p-4 text-emerald-100 text-sm">
              Recebemos seus dados. Nossa equipe vai preparar uma leitura inicial e entrar em contato. Obrigado!
            </div>
          ) : !showForm ? (
            <div className="flex flex-wrap gap-3 items-center mt-4">
              <button type="button" onClick={() => setShowForm(true)} className="inline-flex h-12 items-center rounded-xl bg-amber-500 px-6 font-semibold text-amber-950 hover:bg-amber-400 transition">Quero aprofundar meu diagnóstico</button>
              <button type="button" onClick={() => { /* recusa neutra */ }} className="text-slate-300 text-sm font-semibold hover:text-white px-2">Agora não — quero só guardar meu resultado</button>
            </div>
          ) : (
            <form action={clientAction} className="mt-4 rounded-xl bg-slate-800/60 p-4 space-y-3">
              {errorMsg && <div className="rounded-lg bg-red-900/40 border border-red-700 p-3 text-red-100 text-sm">{errorMsg}</div>}
              <input type="hidden" name="indice" value={result.total} />
              <input type="hidden" name="classificacao" value={result.cls} />
              <input type="hidden" name="dimensao_fraca" value={result.weak} />
              <div><label className="block text-xs text-emerald-200 mb-1">Nome</label><input name="nome" required className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white text-sm" /></div>
              <div><label className="block text-xs text-emerald-200 mb-1">Empresa</label><input name="empresa" required className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white text-sm" /></div>
              <div><label className="block text-xs text-emerald-200 mb-1">E-mail corporativo</label><input name="email" type="email" required className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white text-sm" /></div>
              <div><label className="block text-xs text-emerald-200 mb-1">Setor</label>
                <select name="setor" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white text-sm">
                  <option value="">Selecione…</option><option>Cimento</option><option>Papel e celulose</option><option>Ferro e aço</option><option>Alumínio</option><option>Petróleo e gás / refino</option><option>Transporte aéreo</option><option>Química</option><option>Mineração</option><option>Outro</option>
                </select>
              </div>
              <div><label className="block text-xs text-emerald-200 mb-1">Porte</label>
                <select name="porte" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white text-sm">
                  <option value="">Selecione…</option><option>Grande</option><option>Média</option><option>Pequena</option>
                </select>
              </div>
              <label className="flex gap-2 items-start text-slate-200 text-xs cursor-pointer">
                <input type="checkbox" name="consentimento" value="Sim" className="mt-0.5" />
                <span>Quero receber meu diagnóstico por e-mail e, se fizer sentido, conversar com a Ponte sobre o próximo passo.</span>
              </label>
              <p className="text-[11px] text-slate-400">Usamos seus dados apenas para isso. Você pode pedir a exclusão a qualquer momento.</p>
              <button type="submit" disabled={submitting} className="inline-flex h-11 items-center rounded-xl bg-emerald-600 px-6 font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50">{submitting ? "Enviando…" : "Receber meu diagnóstico"}</button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 italic pt-2">Trilha PONTE de Decisão Legítima — Nível 0. Autoavaliação de prontidão, não o produto final.</p>
      </div>
    );
  }

  // ----------------- JOGO -----------------
  const fa = FASES[fase];
  return (
    <div>
      <div className="mb-4">
        <div className="flex justify-between items-center text-xs text-slate-500 mb-1.5"><span>{answered} de 12 casas</span><span className="font-bold text-slate-700">Fase {fase + 1} de 4</span></div>
        <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${(answered / 12) * 100}%` }} /></div>
        <div className="flex gap-1.5 mt-2">{[0, 1, 2, 3].map((i) => <div key={i} className={`flex-1 h-1.5 rounded ${faseDone(i) ? "bg-emerald-500" : i === fase ? "bg-amber-500" : "bg-slate-200"}`} />)}</div>
      </div>

      <div className="mb-4">
        <span className="inline-block bg-slate-900 text-white text-[11px] font-bold tracking-wide px-3 py-1 rounded-full uppercase">Fase {fase + 1} de 4 · {fa.nome}</span>
        <h2 className="text-2xl font-bold text-slate-900 mt-2">{fa.nome}</h2>
        <p className="text-slate-500 text-sm">{fa.sub}</p>
      </div>

      {fa.casas.map((n) => {
        const c = byN(n);
        const qid = `q${c.n}`;
        return (
          <div key={c.n} className={`rounded-2xl bg-white border p-5 my-4 ${c.n === 7 ? "border-amber-300 ring-2 ring-amber-300" : "border-slate-200"}`}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ background: DIMS[c.dim].cor }}>{c.n}</div>
              <h3 className="text-base font-bold text-slate-900">{c.nome}{c.n === 7 && <span className="ml-2 bg-amber-500 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full align-middle">a casa que importa</span>}</h3>
              <span className="ml-auto text-[11px] font-bold uppercase tracking-wide text-slate-400 text-right">{DIMS[c.dim].nome}</span>
            </div>

            <div className="relative pr-8 my-2">
              <p className="text-sm text-slate-500">{c.q}</p>
              <button type="button" onClick={() => toggleHelp(qid)} aria-label="Explicação da pergunta" className={`absolute top-0 right-0 w-5 h-5 rounded-full border text-xs font-bold leading-none ${open.has(qid) ? "bg-teal-600 text-white border-teal-600" : "bg-white text-teal-700 border-slate-300"}`}>{open.has(qid) ? "×" : "?"}</button>
            </div>
            {open.has(qid) && <div className="mb-3 rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-xs text-slate-700 leading-relaxed">{c.qh}</div>}

            <div className="space-y-2">
              {c.o.map((o, i) => {
                const oid = `o${c.n}-${i}`; const sel = ans[c.n] === o[1];
                return (
                  <div key={i} className="relative">
                    <button type="button" onClick={() => pick(c.n, o[1])} className={`w-full text-left flex items-start gap-2.5 pl-3 pr-9 py-2.5 rounded-lg border text-sm transition ${sel ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-teal-400 hover:bg-slate-50"}`}>
                      <span className={`mt-0.5 w-3.5 h-3.5 rounded-full border shrink-0 ${sel ? "border-emerald-600 bg-emerald-600" : "border-slate-400"}`} />
                      <span className="text-slate-700">{o[0]}</span>
                    </button>
                    <button type="button" onClick={() => toggleHelp(oid)} aria-label="Explicação da resposta" className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full border text-xs font-bold leading-none z-10 ${open.has(oid) ? "bg-teal-600 text-white border-teal-600" : "bg-white text-teal-700 border-slate-300"}`}>{open.has(oid) ? "×" : "?"}</button>
                    {open.has(oid) && <div className="mt-1.5 rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-xs text-slate-700 leading-relaxed">{o[2]}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {warn && <p className="text-center text-red-600 text-sm font-bold mt-2">Responda as 3 casas desta fase para avançar.</p>}

      <div className="flex justify-between items-center gap-3 mt-5">
        <button type="button" onClick={prev} disabled={fase === 0} className="text-slate-500 font-bold px-4 py-3 disabled:opacity-40 hover:text-slate-900">← Voltar</button>
        {fase < 3
          ? <button type="button" onClick={next} className="inline-flex h-12 items-center rounded-xl bg-slate-900 px-7 font-bold text-white hover:bg-slate-800 transition">Próxima fase →</button>
          : <button type="button" onClick={calcular} className="inline-flex h-12 items-center rounded-xl bg-emerald-600 px-7 font-bold text-white hover:bg-emerald-700 transition">Calcular meu Índice</button>}
      </div>
    </div>
  );
}
