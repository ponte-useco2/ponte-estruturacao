"use client";

/**
 * Modo conversa por áudio (wireframe 1m).
 *
 * Disponível em qualquer tela: painel lateral no desktop, tela cheia no mobile.
 * A tela atual continua visível atrás no desktop — de propósito, porque a
 * conversa é sobre o que a pessoa está vendo.
 *
 * As quatro regras do modo áudio estão implementadas, não só escritas:
 *  1. o gravador aceita áudio como resposta (componente <Gravador/>);
 *  2. toda resposta da PONTE sai em texto com transcrição recolhida, nunca ausente;
 *  3. áudio enviado dentro de um projeto entraria na trilha de decisões — aqui a
 *     UI declara isso e não grava nada no servidor;
 *  4. confirmação com efeito jurídico (manifestar capacidade) NÃO se resolve por
 *     voz: a conversa só oferece um link para a tela da chamada, onde existe
 *     botão explícito com a ressalva contratual à vista.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gravador, type Gravacao } from "./Gravador";
import { CONVERSA_INICIAL, type MensagemConversa } from "../_lib/fixtures";
import { duracaoMMSS } from "../_lib/datas";
import { useFala } from "../_lib/fala";

interface Props {
  aberta: boolean;
  onFechar: () => void;
}

interface MensagemUsuario {
  autor: "voce";
  audioUrl: string;
  segundos: number;
}

type Item = MensagemConversa | MensagemUsuario;

function ehDoUsuario(m: Item): m is MensagemUsuario {
  return m.autor === "voce";
}

/**
 * Respostas fixas. Não há LLM nem STT ligado a este protótipo — o roteiro
 * existe para demonstrar a forma da conversa, e a UI diz que é roteiro.
 */
const ROTEIRO: Record<string, MensagemConversa> = {
  "Quais vagas combinam comigo?": {
    autor: "ponte",
    texto:
      "Pelo seu cadastro, a CP-014 (Engenharia de Drenagem) é a mais aderente: 78%. Ela é do PJF-0027, no Vale do Mamanguape. Quer abrir a vaga?",
    duracao: "0:22",
    transcricao:
      "Pelo seu cadastro, a CP-014 (Engenharia de Drenagem) é a mais aderente: 78%. Ela é do PJF-0027, no Vale do Mamanguape. Quer abrir a vaga?",
    acoes: ["Abrir CP-014", "O que fecha nos próximos 15 dias?"],
  },
  "O que fecha nos próximos 15 dias?": {
    autor: "ponte",
    texto:
      "As janelas que fecham em 15 dias ou menos estão no ambiente Descobrir, filtro de prazo. Os dados vêm do Transferegov e têm defasagem declarada — o aviso de origem aparece na lista.",
    duracao: "0:19",
    transcricao:
      "As janelas que fecham em 15 dias ou menos estão no ambiente Descobrir, filtro de prazo. Os dados vêm do Transferegov e têm defasagem declarada — o aviso de origem aparece na lista.",
    acoes: ["Abrir Descobrir", "Quais vagas combinam comigo?"],
  },
  "Falar com pessoa": {
    autor: "ponte",
    texto:
      "Neste protótipo não há fila de atendimento humano ligada. Na plataforma real, este botão abriria um canal com a equipe PONTE responsável pelo seu território.",
    duracao: "0:15",
    transcricao:
      "Neste protótipo não há fila de atendimento humano ligada. Na plataforma real, este botão abriria um canal com a equipe PONTE responsável pelo seu território.",
  },
};

const RESPOSTA_AUDIO: MensagemConversa = {
  autor: "ponte",
  texto:
    "Recebi seu áudio. Neste protótipo eu não transcrevo nem interpreto o que foi dito — isso exige um serviço de transcrição no servidor, que ainda não está ligado. Seu áudio ficou só neste navegador.",
  duracao: "0:17",
  transcricao:
    "Recebi seu áudio. Neste protótipo eu não transcrevo nem interpreto o que foi dito — isso exige um serviço de transcrição no servidor, que ainda não está ligado. Seu áudio ficou só neste navegador.",
  acoes: ["Quais vagas combinam comigo?", "O que fecha nos próximos 15 dias?"],
};

const LINKS: Record<string, { href: string; rotulo: string }> = {
  "Abrir CP-014": { href: "/plataforma/app/compor?cp=CP-014", rotulo: "Abrir CP-014" },
  "Abrir Descobrir": { href: "/plataforma/app/descobrir", rotulo: "Abrir Descobrir" },
};

function Bolha({ m }: { m: MensagemConversa }) {
  const [aberta, setAberta] = useState(false);
  const { disponivel, falando, falar, parar } = useFala();
  return (
    <div className="pa-bolha pa-bolha-ponte">
      <p className="pa-bolha-texto">{m.texto}</p>
      <div className="pa-bolha-acoes">
        {disponivel ? (
          <button
            type="button"
            className="pa-btn pa-btn-pequeno"
            onClick={() => (falando ? parar() : falar(m.texto))}
          >
            {falando ? "Parar ■" : "Ouvir ▶"}
          </button>
        ) : (
          <span className="pa-mono">Leitura em voz alta indisponível neste navegador</span>
        )}
        {m.duracao && <span className="pa-mono">PONTE · {m.duracao}</span>}
      </div>
      {m.transcricao && (
        <>
          <button
            type="button"
            className="pa-bolha-transcricao"
            onClick={() => setAberta((v) => !v)}
            aria-expanded={aberta}
          >
            {aberta ? "Ocultar transcrição ▴" : "Ver transcrição ▾"}
          </button>
          {aberta && <p className="pa-bolha-transc-texto">{m.transcricao}</p>}
        </>
      )}
    </div>
  );
}

export function Conversa({ aberta, onFechar }: Props) {
  const [itens, setItens] = useState<Item[]>(CONVERSA_INICIAL);
  const [regrasAbertas, setRegrasAbertas] = useState(false);
  const fimRef = useRef<HTMLDivElement | null>(null);
  const painelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (aberta) fimRef.current?.scrollIntoView({ block: "end" });
  }, [aberta, itens]);

  // ESC fecha, como nos modais da página pública.
  useEffect(() => {
    if (!aberta) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberta, onFechar]);

  useEffect(() => {
    if (aberta) painelRef.current?.focus();
  }, [aberta]);

  const responder = useCallback((chave: string) => {
    const resposta = ROTEIRO[chave];
    if (resposta) setItens((atual) => [...atual, resposta]);
  }, []);

  const aoGravar = useCallback((g: Gravacao | null) => {
    if (!g) return;
    setItens((atual) => [
      ...atual,
      { autor: "voce", audioUrl: g.url, segundos: g.segundos },
      RESPOSTA_AUDIO,
    ]);
  }, []);

  if (!aberta) return null;

  return (
    <div className="pa-conversa-camada">
      <button
        type="button"
        className="pa-conversa-fundo"
        onClick={onFechar}
        aria-label="Fechar modo conversa"
      />
      <aside
        className="pa-conversa"
        role="dialog"
        aria-modal="true"
        aria-label="Modo conversa com a PONTE"
        tabIndex={-1}
        ref={painelRef}
      >
        <header className="pa-conversa-topo">
          <span className="pa-marca-selo" aria-hidden="true">
            P
          </span>
          <div>
            <strong>PONTE — modo conversa</strong>
            <span className="pa-mono">Responde em áudio e em texto · transcrição sempre presente</span>
          </div>
          <button
            type="button"
            className="pa-icone-botao"
            onClick={onFechar}
            aria-label="Fechar modo conversa"
          >
            ×
          </button>
        </header>

        <div className="pa-conversa-fita">
          <p className="pa-mono pa-conversa-marco">
            Roteiro de demonstração · seus áudios não saem deste navegador
          </p>

          {itens.map((m, i) =>
            ehDoUsuario(m) ? (
              <div key={`v-${i}`} className="pa-bolha pa-bolha-voce">
                <audio className="pa-audio" src={m.audioUrl} controls preload="metadata" />
                <span className="pa-mono">Você · {duracaoMMSS(m.segundos)} · não enviado</span>
              </div>
            ) : (
              <Bolha key={`p-${i}`} m={m} />
            ),
          )}

          {(() => {
            const ultima = itens[itens.length - 1];
            if (ehDoUsuario(ultima) || !ultima.acoes?.length) return null;
            return (
              <div className="pa-chips">
                {ultima.acoes.map((a) => {
                  const link = LINKS[a];
                  return link ? (
                    <Link key={a} href={link.href} className="pa-chip" onClick={onFechar}>
                      {link.rotulo}
                    </Link>
                  ) : (
                    <button key={a} type="button" className="pa-chip" onClick={() => responder(a)}>
                      {a}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          <div ref={fimRef} />
        </div>

        <div className="pa-conversa-pe">
          <Gravador rotulo="Conte o que você precisa" onGravacao={aoGravar} />

          <button
            type="button"
            className="pa-conversa-regras-botao"
            aria-expanded={regrasAbertas}
            onClick={() => setRegrasAbertas((v) => !v)}
          >
            Regras do modo áudio {regrasAbertas ? "▴" : "▾"}
          </button>
          {regrasAbertas && (
            <ol className="pa-conversa-regras">
              <li>
                Todo campo de texto longo do app tem gravador. O áudio vale como resposta, não como
                anexo secundário.
              </li>
              <li>
                Toda resposta da PONTE sai em áudio e em texto. A transcrição fica recolhida, nunca
                ausente.
              </li>
              <li>
                Áudio enviado dentro de um projeto entra na trilha de decisões com autor e data.
              </li>
              <li>
                Confirmações que geram efeito jurídico — manifestar capacidade, aceitar papel —
                pedem toque explícito, não só voz.
              </li>
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
