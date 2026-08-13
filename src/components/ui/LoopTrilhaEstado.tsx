"use client";

import { useState } from "react";

/**
 * Rodada demonstrativa do loop central da Trilha do Estado.
 *
 * O caso é `caso-acordao-controle` (competência `triar-intencao-cognitiva`,
 * `intencao_correta: doing`, reviravolta com `invalida_desenho: false`).
 * Texto autoral do projeto — a vinheta passou pelo portão de originalidade.
 *
 * Nada aqui é enviado a servidor: a demonstração roda inteira no navegador.
 */

type Jogo = "doing" | "asking" | "learning";
type Acao = "rodape" | "reescrever" | "ranquear" | "devolver";
type Adapt = "manter" | "trocar" | "ignorar";

type Tom = "acerto" | "portao" | "parcial";

interface Opcao<T extends string> {
  id: T;
  rotulo: string;
  apoio: string;
  tom: Tom;
  titulo: string;
  consequencia: string;
}

const TRIAGEM: Opcao<Jogo>[] = [
  {
    id: "doing",
    rotulo: "Doing — executar o que o processo exige",
    apoio: "Há uma obrigação com data. Nenhuma escolha de política está aberta.",
    tom: "acerto",
    titulo: "Triagem correta — e por um motivo que quase ninguém enxerga",
    consequencia:
      "O que denuncia o jogo não é o assunto: é quem fixou o prazo. Os 15 dias úteis vêm do Tribunal de Contas, não de uma deliberação sobre o acolhimento institucional. Ninguém no órgão está decidindo manter, ampliar ou encerrar o serviço — o que está em jogo é a rejeição das contas. Diagnosticar Doing não significa fazer pouco: significa executar a peça que o processo exige, dizer com precisão o que ela é e o que não é, e não deixar o rótulo do acórdão definir o rótulo do produto.",
  },
  {
    id: "asking",
    rotulo: "Asking — informar uma decisão em aberto",
    apoio: "O acórdão pede “avaliação de eficácia”; então é uma pergunta avaliativa.",
    tom: "portao",
    titulo: "O erro caro — e ele é executado com competência técnica",
    consequencia:
      "Você diagnosticou Asking porque a palavra “avaliação” aparece no acórdão. A consequência não é um relatório ruim: é um relatório bem-feito respondendo à pergunta errada. Em 15 dias você entrega, sobre prestação de contas física e despesa liquidada, um documento intitulado “avaliação de eficácia” que não avalia eficácia nenhuma. Ele fica no processo, é citado no ciclo seguinte, e a Secretaria passa a ter no histórico a afirmação de que o programa foi avaliado.",
  },
  {
    id: "learning",
    rotulo: "Learning — instrumentar para responder depois",
    apoio: "Falta desfecho medido; o certo seria montar a capacidade de avaliar.",
    tom: "portao",
    titulo: "Diagnóstico plausível, jogo errado",
    consequencia:
      "A leitura acerta a lacuna — não há desfecho medido — e erra o tempo. Learning é o jogo quando existe janela de instrumentação antes da operação. Aqui há uma obrigação processual com data de terceiro: propor cronograma de coleta e não entregar a peça devida deixa o acórdão sem resposta no prazo. O diagnóstico de avaliabilidade não é o produto — é a segunda parte dele.",
  },
];

const ACAO: Opcao<Acao>[] = [
  {
    id: "reescrever",
    rotulo: "Trocar o produto: nota em duas partes — o que há, e o que falta para responder",
    apoio: "Descritivo do que os registros sustentam + diagnóstico de avaliabilidade com cronograma.",
    tom: "acerto",
    titulo: "Ação compatível com o limite",
    consequencia:
      "O objeto afetado era o artefato analítico, e é ele que muda. A primeira parte descreve o programa com o que existe: acolhidos e desligamentos em 2023, tempo médio de permanência, cobertura por unidade, custo por vaga-mês. A segunda enumera o que falta para responder à pergunta do acórdão — desfecho pós-desligamento, identificador que acompanhe a pessoa, grupo de comparação — e propõe cronograma e requisitos de registro. Expõe a lacuna, e é a única versão que sobrevive à leitura do relator no ano seguinte.",
  },
  {
    id: "rodape",
    rotulo: "Entregar a avaliação de eficácia com ressalva metodológica destacada",
    apoio: "A limitação fica registrada, em nota de rodapé e no sumário executivo.",
    tom: "portao",
    titulo: "Portão de ação: o rodapé não é ação",
    consequencia:
      "Você identificou o limite corretamente e agiu de forma incompatível com ele. O documento continua se chamando avaliação de eficácia, continua sendo lido como avaliação de eficácia e continua entrando no processo como avaliação de eficácia. Reconhecer por escrito que o dado não sustenta a conclusão, e mesmo assim publicar a conclusão, é a forma mais comum de conformidade superficial — e a mais difícil de detectar, porque parece rigor.",
  },
  {
    id: "ranquear",
    rotulo: "Comparar unidades de melhor e pior desempenho com o cadastro e a despesa",
    apoio: "Cumpre a recomendação integralmente, no prazo, com o que já existe.",
    tom: "portao",
    titulo: "Cumprimento aparente, prova documental contra a própria Secretaria",
    consequencia:
      "Sem desfecho medido e sem contrafactual, a comparação entre unidades mede composição do público atendido, não qualidade do serviço: a unidade que acolhe os casos mais graves aparece como a pior. O ranking é publicado, vira base de decisão sobre repasse e lotação, e passa a existir no processo como se fosse avaliação. É o mesmo erro do ranking setorial tratado como propriedade dos dados.",
  },
  {
    id: "devolver",
    rotulo: "Devolver a demanda: sem desfecho medido, nada pode ser respondido",
    apoio: "Recusar a entrega é mais honesto do que produzir com dado insuficiente.",
    tom: "parcial",
    titulo: "Mudou mais do que o limite exigia",
    consequencia:
      "A escada inferencial tem três degraus, e você pulou do primeiro ao último: os registros não sustentam “o programa é eficaz”, mas sustentam cobertura, permanência e custo — e sustentam o inventário do que falta. Descartar tudo porque parte não se sustenta é o niilismo pós-desilusão, e ele custa caro: o acórdão fica sem resposta no prazo, e o ciclo seguinte começa sem o cronograma que tornaria a pergunta respondível.",
  },
];

const REVIRAVOLTA: Opcao<Adapt>[] = [
  {
    id: "manter",
    rotulo: "Manter o desenho — e mostrar, item por item, por que ele já respondia a isso",
    apoio: "A parte (ii) sai de anexo e vira o núcleo, com instrumento, responsável e data.",
    tom: "acerto",
    titulo: "Nível 4 — defesa competente da manutenção",
    consequencia:
      "A condição imposta pelo relator não é exigência nova: é a aceitação da segunda parte do produto. Nível 4 diz isso com todas as letras e mostra o que muda de fato — o cronograma deixa de ser anexo e passa a ter instrumento, responsável e data para cada dado a coletar, porque agora é objeto de compromisso formal. E nomeia a mudança de jogo que a prorrogação abre: com 90 dias e autorização para coleta primária, existe um Learning legítimo — instrumentar o programa para os ciclos futuros. Que não é o mesmo que avaliar eficácia agora.",
  },
  {
    id: "trocar",
    rotulo: "Trocar para avaliação de impacto, agora que há prazo e coleta primária",
    apoio: "Com 105 dias úteis, o desenho robusto passa a ser viável.",
    tom: "parcial",
    titulo: "Nível 1 — o movimento reflexo",
    consequencia:
      "Prazo maior não cria a linha de base que nunca existiu. Os anos anteriores não registraram desfecho pós-desligamento, e 90 dias úteis não produzem retroativamente o que não foi coletado. Trocar de método diante de qualquer informação nova é o padrão que o eixo de adaptação existe para separar do julgamento: nem toda reviravolta invalida o desenho.",
  },
  {
    id: "ignorar",
    rotulo: "Seguir com a nota descritiva como estava, dentro do prazo original",
    apoio: "O desenho continua válido; a prorrogação é opcional.",
    tom: "portao",
    titulo: "Nível 0 — a condição virou obrigação",
    consequencia:
      "O desenho de fato continua válido, e é por isso que este erro é sutil: a informação nova não é sobre o método, é sobre o compromisso. Ao aceitar a prorrogação, a Secretaria passa a dever ao Tribunal um cronograma de avaliação com coleta primária. Entregar a nota original é descumprir uma condição que agora está no processo.",
  },
];

const CONTEXTO: [string, string][] = [
  ["Órgão", "Secretaria de Assistência Social do Município"],
  ["Quem pede", "Diretora de Proteção Social Especial"],
  ["Quem decide", "Secretário Municipal de Assistência Social"],
  ["Prazo", "15 dias úteis — fixado pelo Tribunal de Contas"],
  ["Equipe", "2 analistas em gestão pública, 1 pesquisador sênior"],
];

const DADOS = [
  "Relatório anual de prestação de contas físicas",
  "Cadastro de beneficiários municipais",
  "Despesas liquidadas de 2023",
];

const TOM_CLASSE: Record<Tom, { caixa: string; tag: string; rotulo: string }> = {
  acerto: {
    caixa: "bg-emerald-50 border-emerald-300",
    tag: "bg-emerald-700 text-white",
    rotulo: "sustenta",
  },
  portao: {
    caixa: "bg-amber-50 border-amber-300",
    tag: "bg-amber-600 text-white",
    rotulo: "portão",
  },
  parcial: {
    caixa: "bg-sky-50 border-sky-300",
    tag: "bg-sky-700 text-white",
    rotulo: "parcial",
  },
};

function Carimbo({ tipo, children }: { tipo: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span className="rounded border border-slate-400 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-600">
        {tipo}
      </span>
      <span className="text-xs text-slate-500">{children}</span>
    </span>
  );
}

function Escolha<T extends string>({
  opcoes,
  escolhida,
  onEscolher,
}: {
  opcoes: Opcao<T>[];
  escolhida: T | null;
  onEscolher: (id: T) => void;
}) {
  return (
    <div className="space-y-2.5">
      {opcoes.map((o) => {
        const sel = escolhida === o.id;
        const inerte = escolhida !== null && !sel;
        return (
          <button
            key={o.id}
            type="button"
            disabled={escolhida !== null}
            onClick={() => onEscolher(o.id)}
            className={`w-full rounded-xl border p-4 text-left transition ${
              sel
                ? "border-slate-900 bg-slate-900 text-white"
                : inerte
                  ? "border-slate-200 bg-white opacity-45"
                  : "border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-50"
            }`}
          >
            <span
              className={`block text-sm font-bold ${sel ? "text-white" : "text-slate-900"}`}
            >
              {o.rotulo}
            </span>
            <span
              className={`mt-1 block text-xs leading-relaxed ${
                sel ? "text-slate-300" : "text-slate-500"
              }`}
            >
              {o.apoio}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Devolutiva<T extends string>({ opcao }: { opcao: Opcao<T> }) {
  const t = TOM_CLASSE[opcao.tom];
  return (
    <div className={`mt-4 rounded-xl border p-5 ${t.caixa}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${t.tag}`}
        >
          {t.rotulo}
        </span>
        <span className="text-sm font-bold text-slate-900">{opcao.titulo}</span>
      </div>
      <p className="text-sm leading-relaxed text-slate-700">{opcao.consequencia}</p>
    </div>
  );
}

function Passo({
  n,
  total,
  titulo,
  children,
}: {
  n: number;
  total: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 border-t border-slate-200 pt-8">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        Passo {n} de {total}
      </div>
      <h3 className="mb-4 text-xl font-bold text-slate-900">{titulo}</h3>
      {children}
    </div>
  );
}

export function LoopTrilhaEstado() {
  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [acao, setAcao] = useState<Acao | null>(null);
  const [adapt, setAdapt] = useState<Adapt | null>(null);

  const oJogo = TRIAGEM.find((o) => o.id === jogo) ?? null;
  const oAcao = ACAO.find((o) => o.id === acao) ?? null;
  const oAdapt = REVIRAVOLTA.find((o) => o.id === adapt) ?? null;

  function reiniciar() {
    setJogo(null);
    setAcao(null);
    setAdapt(null);
  }

  const triagemPassou = jogo === "doing";
  const acaoPassou = acao === "reescrever";
  const nivelAdapt = adapt === "manter" ? 4 : adapt === "trocar" ? 1 : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 md:p-8">
      {/* ---------- A VINHETA ---------- */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
          Caso · triar intenção cognitiva
        </span>
        <Carimbo tipo="demo">rodada de demonstração, sem correção por IA</Carimbo>
      </div>

      <p className="text-base leading-relaxed text-slate-800">
        O Tribunal de Contas do Estado recomendou formalmente, no acórdão anual, que a
        Secretaria realize uma <em>avaliação aprofundada da eficácia</em> do programa de
        acolhimento institucional, sob risco de rejeição de contas. O Secretário quer um
        relatório formal rápido para atender à recomendação dentro do prazo estipulado.
      </p>

      <div className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
        <dl className="space-y-2.5">
          {CONTEXTO.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {k}
              </dt>
              <dd className="text-sm text-slate-700">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Dados disponíveis
          </div>
          <ul className="mt-2 space-y-1.5">
            {DADOS.map((d) => (
              <li key={d} className="flex gap-2 text-sm text-slate-700">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {d}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs italic leading-relaxed text-slate-500">
            Nenhum desses registros acompanha a pessoa depois do desligamento.
          </p>
        </div>
      </div>

      {/* ---------- PASSO 1 · TRIAGEM ---------- */}
      <Passo n={1} total={4} titulo="Que jogo está sendo jogado?">
        <p className="mb-4 text-sm leading-relaxed text-slate-600">
          Antes de escolher o método, diagnostique a situação. Errar aqui invalida tudo
          o que vem depois — por isso o portão de triagem limita a nota a 49, por melhor
          que seja a execução.
        </p>
        <Escolha opcoes={TRIAGEM} escolhida={jogo} onEscolher={setJogo} />
        {oJogo && <Devolutiva opcao={oJogo} />}
      </Passo>

      {/* ---------- PASSO 2 · AÇÃO ---------- */}
      {jogo && (
        <Passo n={2} total={4} titulo="O limite apareceu. O que você faz com ele?">
          <div className="mb-4 rounded-xl border-l-2 border-slate-900 bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Limite identificado
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              O cadastro registra entrada e permanência, não desfecho. Para afirmar
              eficácia seria preciso um desfecho medido depois do acolhimento e algum
              grupo de comparação. Nenhum dos dois existe — e nenhum ofício a outro órgão
              cabe em 15 dias úteis.
            </p>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            Reconhecer o limite não é o que se avalia aqui. O que se avalia é se a ação
            que você toma é compatível com ele.
          </p>
          <Escolha opcoes={ACAO} escolhida={acao} onEscolher={setAcao} />
          {oAcao && <Devolutiva opcao={oAcao} />}
        </Passo>
      )}

      {/* ---------- PASSO 3 · REVIRAVOLTA ---------- */}
      {acao && (
        <Passo n={3} total={4} titulo="Reviravolta">
          <div className="mb-4 rounded-xl border border-slate-900 bg-slate-900 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Informação nova, no meio do enquadramento
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-100">
              O relator do Tribunal aceita prorrogar o prazo por mais 90 dias úteis —
              desde que a Secretaria apresente um cronograma de avaliação com coleta de
              dados primários.
            </p>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            Nem toda reviravolta invalida o desenho. Defender a manutenção contra a
            informação nova, quando ela de fato não invalida, é o nível mais alto do eixo
            de adaptação — e é o que separa julgamento de reflexo.
          </p>
          <Escolha opcoes={REVIRAVOLTA} escolhida={adapt} onEscolher={setAdapt} />
          {oAdapt && <Devolutiva opcao={oAdapt} />}
        </Passo>
      )}

      {/* ---------- PASSO 4 · AS QUATRO LEITURAS ---------- */}
      {adapt && (
        <Passo n={4} total={4} titulo="Quatro leituras — nunca somadas">
          <p className="mb-5 text-sm leading-relaxed text-slate-600">
            Uma média esconderia exatamente a diferença que o curso existe para ensinar.
            Quem tem artefato 90 e adaptação 1 decorou o método; quem tem 65 e 4 tem
            julgamento.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className={`rounded-xl border p-4 ${
                triagemPassou
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-amber-300 bg-amber-50"
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Triagem
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                {triagemPassou ? "Portão aberto" : "Portão fechado"}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {triagemPassou
                  ? "O jogo foi diagnosticado corretamente. A cadeia a jusante vale."
                  : "Jogo diagnosticado errado: a nota final fica limitada a 49, independentemente da qualidade do que vier depois."}
              </p>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                acaoPassou
                  ? "border-emerald-300 bg-emerald-50"
                  : acao === "devolver"
                    ? "border-sky-300 bg-sky-50"
                    : "border-amber-300 bg-amber-50"
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Ação
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                {acaoPassou
                  ? "Compatível"
                  : acao === "devolver"
                    ? "Superadaptada"
                    : "Portão fechado"}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {acaoPassou
                  ? "O artefato afetado foi localizado e mudou na medida do limite."
                  : acao === "devolver"
                    ? "Perfil E: alterou mais do que o limite exigia. Mudar sem necessidade não é acerto — preserve o uso que sobrevive."
                    : "O limite foi reconhecido e a ação seguiu incompatível com ele."}
              </p>
            </div>

            <div className="rounded-xl border border-slate-300 bg-white p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Artefato
              </div>
              <div className="mt-1 text-lg font-bold text-slate-400">não avaliado</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Esta rodada é de escolha; o produto é de <strong>produção escrita</strong>.
                No curso, a nota de artefato sai de uma rubrica de seis dimensões e toda
                nota cita as palavras que você escreveu — sem citação, a nota é inválida.
              </p>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                nivelAdapt === 4
                  ? "border-emerald-300 bg-emerald-50"
                  : nivelAdapt === 1
                    ? "border-sky-300 bg-sky-50"
                    : "border-amber-300 bg-amber-50"
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Adaptação
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                Nível {nivelAdapt} <span className="text-sm font-normal text-slate-500">de 4</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {nivelAdapt === 4
                  ? "Enfrentou a informação nova em vez de contorná-la, e mostrou o que muda de fato."
                  : nivelAdapt === 1
                    ? "Trocou de método sem que a informação nova invalidasse o desenho."
                    : "Não incorporou uma condição que passou a ser obrigação."}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm leading-relaxed text-slate-700">
              <strong className="text-slate-900">O que acabou de ser medido.</strong> Não
              se você sabe dizer que uma métrica tem limitações — mas se você muda o que
              faria quando uma limitação torna inválida a decisão que estava prestes a
              tomar. Evidência → relevância → localização do objeto → ação compatível.
            </p>
            <button
              type="button"
              onClick={reiniciar}
              className="mt-4 inline-flex h-11 items-center rounded-xl bg-slate-900 px-6 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Jogar de novo com outra escolha
            </button>
          </div>
        </Passo>
      )}
    </div>
  );
}
