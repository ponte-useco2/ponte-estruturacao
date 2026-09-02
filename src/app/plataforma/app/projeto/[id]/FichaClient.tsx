"use client";

/**
 * Ficha do Projeto em Formação (wireframe 1h) — a unidade central.
 *
 * É a mesma peça da página pública, agora acionável: as vagas abertas viram
 * entrada para o ambiente Compor, e a aba "Trilha de decisões" é o que a camada
 * de accountability exige. O bloco escuro da coalizão mede funções críticas
 * cobertas (3/5), não "capacidades" genéricas.
 */

import { useState } from "react";
import Link from "next/link";
import { useSessaoObrigatoria } from "../../_lib/sessao";
import { perfilPor } from "../../_lib/fixtures";
import type { Projeto } from "../../_lib/tipos";
import { useFala } from "../../_lib/fala";
import { Barra, Ciclo, Eixos, Tag } from "../../_componentes/primitivos";
import { Gravador } from "../../_componentes/Gravador";

const BASE = "/plataforma/app";

const ABAS = [
  "Visão geral",
  "Coalizão",
  "Capital",
  "Grafo do projeto",
  "Evidências",
  "Trilha de decisões",
] as const;
type Aba = (typeof ABAS)[number];

export function FichaClient({ projeto }: { projeto: Projeto }) {
  const sessao = useSessaoObrigatoria();
  const [aba, setAba] = useState<Aba>("Visão geral");
  const [acompanhando, setAcompanhando] = useState(false);
  const { disponivel, falando, falar, parar } = useFala();

  const confirmadas = projeto.funcoes.filter((f) => f.confirmada);
  const abertas = projeto.funcoes.filter((f) => !f.confirmada);

  if (!sessao) {
    return (
      <div className="pa-pagina">
        <p className="pa-mono">Carregando sessão do protótipo…</p>
      </div>
    );
  }

  const perfil = perfilPor(sessao.perfil);

  function ouvirResumo() {
    if (falando) {
      parar();
      return;
    }
    falar(
      [
        `${projeto.id}, ${projeto.status}.`,
        projeto.titulo + ".",
        `Território: ${projeto.territorio}.`,
        `Problema demonstrado: ${projeto.problema}`,
        `Solução em estruturação: ${projeto.solucao}`,
        `Coalizão: ${confirmadas.length} de ${projeto.funcoes.length} funções críticas cobertas, ${projeto.progresso} por cento.`,
        abertas.length
          ? `Funções ainda abertas: ${abertas.map((f) => `${f.nome}, chamada ${f.chamada}`).join("; ")}.`
          : "Coalizão completa.",
      ].join(" "),
    );
  }

  return (
    <div className="pa-pagina pa-pilha-larga">
      <header className="pa-cartao pa-pilha">
        <div className="pa-linha">
          <Tag tom="forte">{projeto.id}</Tag>
          <Tag>{projeto.statusCurto}</Tag>
          <div className="pa-espaco" />
          <span className="pa-mono">Seu papel: observador · perfil {perfil.curto}</span>
          <button
            type="button"
            className="pa-btn pa-btn-pequeno"
            aria-pressed={acompanhando}
            onClick={() => setAcompanhando((v) => !v)}
          >
            {acompanhando ? "Acompanhando ●" : "Acompanhar"}
          </button>
          {abertas.length > 0 && (
            <Link
              href={`${BASE}/compor?cp=${abertas[0].chamada}`}
              className="pa-btn pa-btn-pequeno pa-btn-primario"
            >
              Tenho uma capacidade faltante
            </Link>
          )}
        </div>

        <h1 className="pa-ficha-titulo">{projeto.titulo}</h1>

        <div className="pa-linha">
          <span className="pa-mono">Território: {projeto.territorio}</span>
          <Eixos eixos={projeto.eixos} />
        </div>
      </header>

      <div className="pa-abas" role="tablist" aria-label="Seções da ficha do projeto">
        {ABAS.map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            className="pa-aba"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
          >
            {a}
          </button>
        ))}
      </div>

      {aba === "Visão geral" && (
        <div className="pa-pilha-larga">
          <div className="pa-grade pa-grade-2">
            <div className="pa-cartao">
              <span className="pa-mono">Problema demonstrado</span>
              <p>{projeto.problema}</p>
            </div>
            <div className="pa-cartao">
              <span className="pa-mono">Solução em estruturação</span>
              <p>{projeto.solucao}</p>
            </div>
            <div className="pa-cartao">
              <span className="pa-mono">Organizações mobilizadas</span>
              <p>{projeto.organizacoes}</p>
            </div>
            <div className="pa-cartao">
              <span className="pa-mono">Capital potencial</span>
              <p>{projeto.capital}</p>
            </div>
          </div>

          <section className="pa-escuro pa-pilha">
            <div className="pa-linha">
              <div>
                <span className="pa-mono">Status da coalizão</span>
                <h2 className="pa-cartao-titulo">
                  {confirmadas.length}/{projeto.funcoes.length} funções críticas cobertas
                </h2>
              </div>
              <div className="pa-espaco" />
              <span className="pa-numero" style={{ fontFamily: "var(--pa-mono)" }}>
                {projeto.progresso}%
              </span>
            </div>

            <Barra valor={projeto.progresso} rotulo={`Composição do ${projeto.id}`} />

            <div className="pa-funcoes">
              {projeto.funcoes.map((f) =>
                f.confirmada ? (
                  <div key={f.nome} className="pa-funcao pa-funcao-ok">
                    <span className="pa-mono">✓ Confirmado</span>
                    <strong>{f.nome}</strong>
                    <span className="pa-mono">{f.ator}</span>
                  </div>
                ) : (
                  <Link
                    key={f.nome}
                    href={`${BASE}/compor?cp=${f.chamada}`}
                    className="pa-funcao pa-funcao-vaga"
                  >
                    <span className="pa-mono">○ Chamada {f.chamada}</span>
                    <strong>{f.nome}</strong>
                    <span className="pa-mono">Ver vaga →</span>
                  </Link>
                ),
              )}
            </div>

            <span className="pa-mono">
              {abertas.length > 0
                ? `${abertas.length} funções técnicas ainda precisam ser compostas antes da submissão`
                : "Coalizão completa — projeto pronto para submissão"}
            </span>
          </section>

          <div className="pa-grade pa-grade-2">
            <div className="pa-cartao pa-pilha">
              <span className="pa-mono">Ciclo do projeto</span>
              <Ciclo ate={projeto.cicloAte} />
            </div>
            <div className="pa-cartao-plano pa-pilha">
              {disponivel ? (
                <button type="button" className="pa-btn" onClick={ouvirResumo}>
                  {falando ? "Parar leitura" : "Ouvir o resumo do projeto"}
                </button>
              ) : (
                <span className="pa-mono">
                  Leitura em voz alta indisponível neste navegador — o resumo completo está acima.
                </span>
              )}
              <Gravador rotulo="Comentar o projeto por áudio" variante="compacto" />
            </div>
          </div>
        </div>
      )}

      {aba === "Coalizão" && (
        <div className="pa-pilha">
          <ul className="pa-pilha">
            {projeto.funcoes.map((f) => (
              <li key={f.nome} className="pa-cartao pa-linha">
                <Tag tom={f.confirmada ? "aderente" : "neutro"}>
                  {f.confirmada ? "Confirmado" : "Chamada aberta"}
                </Tag>
                <strong>{f.nome}</strong>
                <div className="pa-espaco" />
                {f.confirmada ? (
                  <span className="pa-mono">{f.ator}</span>
                ) : (
                  <Link href={`${BASE}/compor?cp=${f.chamada}`} className="pa-btn pa-btn-pequeno">
                    Ver {f.chamada}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="pa-nota">
            Proponente é função institucional, não capacidade técnica. É por isso que a barra mede
            funções críticas cobertas — não número de organizações envolvidas.
          </p>
        </div>
      )}

      {aba === "Capital" && (
        <div className="pa-pilha">
          <div className="pa-cartao pa-pilha">
            <span className="pa-mono">Capital potencial</span>
            <p>{projeto.capital}</p>
            <span className="pa-mono">
              Nenhum recurso contratado. Instrumentos sob análise de aderência.
            </span>
          </div>
          <div className="pa-cartao pa-pilha">
            <span className="pa-mono">Ativos mobilizáveis</span>
            <p>{projeto.ativos}</p>
          </div>
          <Link href={`${BASE}/descobrir`} className="pa-btn pa-btn-primario">
            Ver janelas de capital abertas
          </Link>
        </div>
      )}

      {aba === "Grafo do projeto" && (
        <div className="pa-pilha">
          <div className="pa-cartao pa-pilha">
            <span className="pa-mono">Relações registradas</span>
            <p>
              Território, problema, ativos, organizações, capacidades, capital, execução, evidência
              e resultado deste projeto formam o mesmo grafo que alimenta os próximos.
            </p>
            <Link href={`${BASE}/grafo`} className="pa-btn pa-btn-primario">
              Abrir o Grafo
            </Link>
          </div>
        </div>
      )}

      {aba === "Evidências" && (
        <div className="pa-pilha">
          <ul className="pa-pilha">
            {projeto.entregas.map((e) => (
              <li key={e.codigo} className="pa-cartao pa-linha">
                <Tag>{e.codigo}</Tag>
                <div style={{ flex: "1 1 260px" }}>
                  <strong>{e.titulo}</strong>
                  <span className="pa-mono">Responsável: {e.responsavel}</span>
                </div>
                <span className={`pa-mono${e.estado === "pendente" ? " pa-pendente" : ""}`}>
                  {e.estado === "aprovada" && `${e.evidencias ?? 0} evidências aprovadas`}
                  {e.estado === "pendente" && `Pendente · vence ${e.vence}`}
                  {e.estado === "andamento" && e.detalhe}
                </span>
              </li>
            ))}
          </ul>
          <Link href={`${BASE}/construir?pjf=${projeto.id}`} className="pa-btn pa-btn-primario">
            Abrir o workspace de execução
          </Link>
          <p className="pa-ressalva">
            Toda evidência registra autor, data, entrega vinculada e fica disponível para escrutínio
            institucional quando cabível.
          </p>
        </div>
      )}

      {aba === "Trilha de decisões" && (
        <div className="pa-pilha">
          <ol className="pa-linha-tempo">
            {projeto.decisoes.map((d) => (
              <li key={`${d.data}-${d.texto}`}>
                <Tag>{d.data}</Tag>
                <div>
                  <strong>{d.texto}</strong>
                </div>
              </li>
            ))}
          </ol>
          <p className="pa-nota">
            A trilha existe porque decisão de composição e acoplamento de capital precisam ser
            auditáveis depois. Neste protótipo ela é fixa; na plataforma real cada linha carrega
            autor, data e o registro que a originou.
          </p>
        </div>
      )}
    </div>
  );
}
