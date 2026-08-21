"use client";

/**
 * Ambiente 02 — Apresentar (wireframe 1g).
 *
 * Quatro objetos, não um cadastro genérico de "parceiro": Problema, Capacidade,
 * Ativo e Organização. A separação é ontológica e vem da release v1.3 —
 * organização não é ativo, e proponente é função institucional, não capacidade.
 *
 * Nota do wireframe respeitada: cadastro longo é a maior barreira para OSC,
 * cooperativa e gestor municipal. Por isso todo campo aberto aceita áudio e a
 * completude fica visível em vez de bloquear o envio.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSessaoObrigatoria } from "../_lib/sessao";
import type { EixoTransformacao } from "../_lib/tipos";
import { Barra, Tag } from "../_componentes/primitivos";
import { Gravador } from "../_componentes/Gravador";

const BASE = "/plataforma/app";

type TipoObjeto = "problema" | "capacidade" | "ativo" | "organizacao";

interface Formato {
  id: TipoObjeto;
  nome: string;
  pergunta: string;
  bloco1: string;
  bloco1Dica: string;
  bloco3: string;
  bloco3Dica: string;
  bloco4: string;
  bloco4Sugestoes: string[];
}

const FORMATOS: Formato[] = [
  {
    id: "problema",
    nome: "Problema",
    pergunta: "Qual problema precisa virar projeto?",
    bloco1: "1 · Qual o problema e quem ele atinge",
    bloco1Dica: "Quem sofre o efeito, desde quando, e o que já foi tentado.",
    bloco3: "3 · Como o problema é demonstrável",
    bloco3Dica: "Dado, laudo, foto, série histórica, denúncia registrada.",
    bloco4: "4 · O que você já tem mobilizado",
    bloco4Sugestoes: ["área disponível", "associação local", "dado de campo", "apoio da prefeitura"],
  },
  {
    id: "capacidade",
    nome: "Capacidade",
    pergunta: "Que capacidade técnica você entrega?",
    bloco1: "1 · O que você faz e com que profundidade",
    bloco1Dica: "Escopo que você assume de ponta a ponta, e o que você não faz.",
    bloco3: "3 · Como sua capacidade é comprovável",
    bloco3Dica: "Portfólio, acervo técnico, responsabilidade técnica, publicações.",
    bloco4: "4 · O que você já tem instalado",
    bloco4Sugestoes: ["equipe própria", "laboratório", "software licenciado", "frota / equipamento"],
  },
  {
    id: "ativo",
    nome: "Ativo",
    pergunta: "Que ativo pode ser mobilizado?",
    bloco1: "1 · Qual o ativo e onde ele está",
    bloco1Dica: "Ativo é recurso físico ou infraestrutura — não é a organização que o detém.",
    bloco3: "3 · Como a disponibilidade é comprovável",
    bloco3Dica: "Matrícula, cessão, termo de uso, laudo de condição.",
    bloco4: "4 · Condições de uso",
    bloco4Sugestoes: ["uso compartilhado", "cessão temporária", "exige contrapartida", "sem restrição"],
  },
  {
    id: "organizacao",
    nome: "Organização",
    pergunta: "Que função institucional sua organização pode exercer?",
    bloco1: "1 · Quem é a organização e que função ela assume",
    bloco1Dica: "Proponente, operação territorial, interveniente, executor — função, não capacidade.",
    bloco3: "3 · Como a habilitação é comprovável",
    bloco3Dica: "Estatuto, CNPJ, certidões, histórico de convênios executados.",
    bloco4: "4 · O que a organização já tem instalado",
    bloco4Sugestoes: ["sede própria", "equipe fixa", "histórico de convênio", "base comunitária"],
  },
];

const EIXOS: { id: EixoTransformacao; nome: string }[] = [
  { id: "ambiental", nome: "Ambiental" },
  { id: "economico", nome: "Econômico" },
  { id: "social", nome: "Social" },
];

const DEPOIS = [
  "A PONTE diagnostica o que existe e o que falta",
  "Nasce um Projeto em Formação",
  "A coalizão é composta",
  "O capital compatível é acoplado",
];

/**
 * Gate: só monta o formulário depois que a sessão existe, para que o território
 * declarado no onboarding já nasça preenchido — sem efeito de sincronização.
 */
export function ApresentarClient() {
  const sessao = useSessaoObrigatoria();
  const params = useSearchParams();

  const tipoDaUrl = params.get("tipo");
  const textoDaUrl = params.get("texto") ?? "";

  if (!sessao) {
    return (
      <div className="pa-pagina">
        <p className="pa-mono">Carregando sessão do protótipo…</p>
      </div>
    );
  }

  return (
    <Formulario
      tipoInicial={FORMATOS.some((f) => f.id === tipoDaUrl) ? (tipoDaUrl as TipoObjeto) : "problema"}
      descricaoInicial={textoDaUrl}
      territorioInicial={sessao.territorio}
    />
  );
}

interface FormularioProps {
  tipoInicial: TipoObjeto;
  descricaoInicial: string;
  territorioInicial: string;
}

function Formulario({ tipoInicial, descricaoInicial, territorioInicial }: FormularioProps) {
  const [tipo, setTipo] = useState<TipoObjeto>(tipoInicial);
  const [descricao, setDescricao] = useState(descricaoInicial);
  const [temAudio, setTemAudio] = useState(false);
  const [territorio, setTerritorio] = useState(territorioInicial);
  const [eixos, setEixos] = useState<EixoTransformacao[]>([]);
  const [anexos, setAnexos] = useState<string[]>([]);
  const [mobilizado, setMobilizado] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [enviado, setEnviado] = useState<"nao" | "diagnostico" | "rascunho">("nao");

  const formato = useMemo(() => FORMATOS.find((f) => f.id === tipo) ?? FORMATOS[0], [tipo]);

  const blocos = [
    { ok: descricao.trim().length > 20 || temAudio, nome: formato.bloco1 },
    { ok: territorio.trim().length > 1, nome: "2 · Território" },
    { ok: anexos.length > 0, nome: formato.bloco3 },
    { ok: mobilizado.length > 0, nome: formato.bloco4 },
  ];
  const completude = Math.round((blocos.filter((b) => b.ok).length / blocos.length) * 100);
  const faltando = blocos.filter((b) => !b.ok).map((b) => b.nome);

  function alternarEixo(e: EixoTransformacao) {
    setEixos((atual) => (atual.includes(e) ? atual.filter((x) => x !== e) : [...atual, e]));
  }

  function alternarMobilizado(v: string) {
    setMobilizado((atual) => (atual.includes(v) ? atual.filter((x) => x !== v) : [...atual, v]));
  }

  function adicionarExtra() {
    const v = extra.trim();
    if (!v) return;
    setMobilizado((atual) => (atual.includes(v) ? atual : [...atual, v]));
    setExtra("");
  }

  if (enviado !== "nao") {
    return (
      <div className="pa-pagina-estreita">
        <div className="pa-cartao pa-pilha-larga">
          <p className="pa-kicker">Ambiente 02 · Apresentar</p>
          <h1 className="pa-titulo">
            {enviado === "diagnostico" ? "Nada foi enviado." : "Rascunho guardado só aqui."}
          </h1>
          <p>
            Este é um protótipo sem servidor de cadastro. O que você preencheu ficou apenas nesta
            aba e some quando ela fecha — nenhum dado saiu do seu navegador, nenhum anexo foi
            carregado. Na plataforma real, este botão criaria o objeto{" "}
            <strong>{formato.nome}</strong> e abriria o diagnóstico da PONTE.
          </p>

          <div className="pa-tracejado pa-pilha">
            <span className="pa-mono">O que você preencheu</span>
            <p>{descricao || "— sem descrição em texto —"}</p>
            <span className="pa-mono">
              {territorio || "sem território"} · completude {completude}%
              {eixos.length ? ` · ${eixos.join(", ")}` : ""}
            </span>
            {anexos.length > 0 && (
              <span className="pa-mono">Anexos escolhidos: {anexos.join(", ")}</span>
            )}
          </div>

          <div className="pa-linha">
            <button type="button" className="pa-btn" onClick={() => setEnviado("nao")}>
              Voltar ao formulário
            </button>
            <Link href={`${BASE}/compor`} className="pa-btn pa-btn-primario">
              Ver chamadas abertas
            </Link>
            <Link href="/plataforma#participacao" className="pa-btn">
              Cadastro de interesse real
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pa-pagina pa-pilha-larga">
      <div>
        <p className="pa-kicker">Ambiente 02 · Apresentar</p>
        <h1 className="pa-titulo">O que você quer colocar na infraestrutura?</h1>
      </div>

      <div className="pa-grade pa-grade-4" role="tablist" aria-label="Tipo de objeto">
        {FORMATOS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={tipo === f.id}
            className={`pa-tipo-opcao${tipo === f.id ? " pa-ativo" : ""}`}
            onClick={() => setTipo(f.id)}
          >
            <span className="pa-mono">Tipo</span>
            <strong>{f.nome}</strong>
          </button>
        ))}
      </div>

      <div className="pa-apresentar">
        <form
          className="pa-cartao pa-pilha-larga"
          onSubmit={(e) => {
            e.preventDefault();
            setEnviado("diagnostico");
          }}
        >
          <span className="pa-mono">
            Formulário · {formato.nome} · 4 blocos — nenhum deles bloqueia o envio
          </span>

          <div className="pa-campo">
            <label htmlFor="ap-descricao">{formato.bloco1}</label>
            <p className="pa-sub">{formato.bloco1Dica}</p>
            <textarea
              id="ap-descricao"
              className="pa-textarea"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={formato.pergunta}
              rows={4}
            />
            <Gravador
              rotulo={formato.bloco1}
              onGravacao={(g) => setTemAudio(Boolean(g))}
            />
          </div>

          <div className="pa-grade pa-grade-2">
            <div className="pa-campo">
              <label htmlFor="ap-territorio">2 · Território</label>
              <input
                id="ap-territorio"
                className="pa-input"
                value={territorio}
                onChange={(e) => setTerritorio(e.target.value)}
                placeholder="município / UF"
                autoComplete="off"
              />
            </div>
            <div className="pa-campo">
              <span className="pa-campo-rotulo">Eixos de transformação</span>
              <div className="pa-chips">
                {EIXOS.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="pa-chip"
                    aria-pressed={eixos.includes(e.id)}
                    onClick={() => alternarEixo(e.id)}
                  >
                    {e.nome}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pa-campo">
            <label htmlFor="ap-anexos">{formato.bloco3}</label>
            <p className="pa-sub">{formato.bloco3Dica}</p>
            <input
              id="ap-anexos"
              className="pa-input"
              type="file"
              multiple
              onChange={(e) =>
                setAnexos(Array.from(e.target.files ?? []).map((f) => f.name))
              }
            />
            {anexos.length > 0 && (
              <span className="pa-mono">
                {anexos.length} arquivo(s) escolhido(s) · nada é enviado neste protótipo
              </span>
            )}
          </div>

          <div className="pa-campo">
            <span className="pa-campo-rotulo">{formato.bloco4}</span>
            <div className="pa-chips">
              {[...formato.bloco4Sugestoes, ...mobilizado.filter((m) => !formato.bloco4Sugestoes.includes(m))].map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    className="pa-chip"
                    aria-pressed={mobilizado.includes(s)}
                    onClick={() => alternarMobilizado(s)}
                  >
                    {s}
                  </button>
                ),
              )}
            </div>
            <div className="pa-linha">
              <input
                className="pa-input"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarExtra();
                  }
                }}
                placeholder="adicionar outro item"
                aria-label="Adicionar outro item mobilizado"
              />
              <button type="button" className="pa-btn pa-btn-pequeno" onClick={adicionarExtra}>
                Adicionar
              </button>
            </div>
          </div>

          <div className="pa-linha pa-acoes">
            <button type="submit" className="pa-btn pa-btn-primario">
              Enviar para diagnóstico
            </button>
            <button type="button" className="pa-btn" onClick={() => setEnviado("rascunho")}>
              Salvar rascunho
            </button>
          </div>
        </form>

        <aside className="pa-pilha">
          <div className="pa-tracejado pa-pilha">
            <span className="pa-mono">O que acontece depois</span>
            <ol className="pa-lista-numerada">
              {DEPOIS.map((d, i) => (
                <li key={d}>
                  <span className="pa-mono">{i + 1}</span> {d}
                </li>
              ))}
            </ol>
          </div>

          <div className="pa-cartao pa-pilha">
            <span className="pa-mono">Completude do cadastro</span>
            <Barra valor={completude} rotulo="Completude do cadastro" />
            <span className="pa-sub">
              {faltando.length === 0
                ? "Todos os blocos preenchidos"
                : `Falta preencher: ${faltando.join(" · ")}`}
            </span>
          </div>

          <div className="pa-cartao-plano pa-pilha">
            <Gravador rotulo="Gravar o cadastro inteiro por áudio" />
            <span className="pa-mono">
              O áudio vale como resposta. Preencher os campos depois é trabalho da PONTE, não seu.
            </span>
          </div>

          {eixos.length > 0 && (
            <div className="pa-linha">
              {eixos.map((e) => (
                <Tag key={e} tom={e}>
                  {EIXOS.find((x) => x.id === e)?.nome}
                </Tag>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
