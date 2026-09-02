"use client";

/**
 * Home do Shell C (wireframe 1c).
 *
 * Uma caixa de pergunta no centro, "meus projetos" logo abaixo, e os ambientes
 * como consequência — não como moldura. A mesma caixa aceita texto ou áudio,
 * que é o ponto do shell: quem não navega por menu consegue começar mesmo assim.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSessaoObrigatoria } from "./_lib/sessao";
import { CHAMADAS, PENDENCIAS, PROJETOS, perfilPor } from "./_lib/fixtures";
import { Barra } from "./_componentes/primitivos";
import { Gravador } from "./_componentes/Gravador";

const BASE = "/plataforma/app";

/** Atalhos da caixa central — cada um pré-seleciona o tipo de objeto em Apresentar. */
const PARTIDAS = [
  { rotulo: "tenho um desafio tecnológico", tipo: "problema" },
  { rotulo: "tenho uma capacidade técnica", tipo: "capacidade" },
  { rotulo: "tenho um problema no território", tipo: "problema" },
  { rotulo: "tenho capital para alocar", tipo: "organizacao" },
];

interface Props {
  /** Janelas que fecham em ≤15 dias, vindas do JSON real. `null` = payload indisponível. */
  fechando15: number | null;
}

export function HomeClient({ fechando15 }: Props) {
  const sessao = useSessaoObrigatoria();
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("problema");

  if (!sessao) {
    return (
      <div className="pa-pagina">
        <p className="pa-mono">Carregando sessão do protótipo…</p>
      </div>
    );
  }

  const perfil = perfilPor(sessao.perfil);

  function diagnosticar() {
    const q = new URLSearchParams({ tipo });
    if (texto.trim()) q.set("texto", texto.trim());
    router.push(`${BASE}/apresentar?${q.toString()}`);
  }

  return (
    <div className="pa-pagina pa-pilha-larga">
      <section className="pa-pergunta">
        <p className="pa-kicker">Começamos pelo problema, não pelo edital</p>
        <h1 className="pa-pergunta-titulo">O que precisa virar projeto?</h1>

        <div className="pa-caixa-pergunta">
          <label htmlFor="home-descricao" className="pa-sr">
            Descreva o problema, a capacidade que você tem ou o território
          </label>
          <textarea
            id="home-descricao"
            className="pa-textarea"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="descreva o problema, a capacidade que você tem ou o território…"
            rows={3}
          />
          <div className="pa-linha">
            <Gravador rotulo="Descreva por áudio" variante="compacto" />
            <span className="pa-mono pa-esconde-mobile">ou fale — o áudio vale como resposta</span>
            <div className="pa-espaco" />
            <button type="button" className="pa-btn pa-btn-primario" onClick={diagnosticar}>
              Diagnosticar
            </button>
          </div>
        </div>

        <div className="pa-chips pa-chips-centro">
          {PARTIDAS.map((p) => (
            <button
              key={p.rotulo}
              type="button"
              className="pa-chip"
              aria-pressed={tipo === p.tipo && texto === p.rotulo}
              onClick={() => {
                setTipo(p.tipo);
                setTexto(p.rotulo);
              }}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="pa-sr">Meus projetos</h2>
        <div className="pa-grade pa-grade-3">
          {PROJETOS.map((p) => (
            <Link key={p.id} href={`${BASE}/projeto/${p.id}`} className="pa-cartao pa-cartao-link">
              <span className="pa-mono">Meu projeto · {p.id}</span>
              <strong className="pa-cartao-titulo">{p.titulo}</strong>
              <Barra valor={p.progresso} rotulo={`Composição de ${p.id}`} />
              <span className="pa-mono">
                {p.funcoes.filter((f) => f.confirmada).length}/{p.funcoes.length} funções ·{" "}
                {p.funcoes
                  .filter((f) => !f.confirmada)
                  .map((f) => f.chamada)
                  .join(", ") || "coalizão completa"}
              </span>
            </Link>
          ))}

          <Link href={`${BASE}/apresentar`} className="pa-tracejado pa-cartao-novo">
            <span className="pa-mono">+ Apresentar algo novo</span>
          </Link>
        </div>
      </section>

      <section className="pa-cartao pa-atalhos">
        <span className="pa-mono">Atalhos</span>
        <Link href={`${BASE}/compor`} className="pa-chip">
          {CHAMADAS.length} chamadas esperam sua capacidade
        </Link>
        <Link href={`${BASE}/descobrir?prazo=15`} className="pa-chip">
          {fechando15 === null ? "Janelas abertas" : `${fechando15} janelas fecham em ≤15 dias`}
        </Link>
        <Link href={`${BASE}/construir`} className="pa-chip">
          {PENDENCIAS.evidenciasPendentes} evidências pendentes
        </Link>
        <Link href={`${BASE}/grafo`} className="pa-chip">
          Ver o Grafo
        </Link>
      </section>

      <p className="pa-nota">
        Painel montado para o perfil <strong>{perfil.nome}</strong>. Trocar o perfil no menu
        Ambientes muda quais chamadas e quais janelas aparecem primeiro.{" "}
        {fechando15 === null &&
          "A contagem de janelas não pôde ser lida do arquivo de oportunidades — o ambiente Descobrir explica o motivo."}
      </p>
    </div>
  );
}
