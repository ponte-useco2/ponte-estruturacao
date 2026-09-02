"use client";

/**
 * Ambiente 04 — Construir (wireframe 1j).
 *
 * Workspace de execução: entregas, evidências, trilha de decisões e coalizão
 * ativa. A regra que o wireframe deixa explícita e que a UI repete: toda
 * evidência registra autor, data e entrega vinculada, e fica disponível para
 * escrutínio institucional quando cabível.
 *
 * Entrega não é resultado, e resultado não é transformação — a coluna da
 * direita mantém essa distinção à vista, que é a mesma da página pública.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSessaoObrigatoria } from "../_lib/sessao";
import { PROJETOS } from "../_lib/fixtures";
import type { Entrega, Projeto } from "../_lib/tipos";
import { Barra, Tag } from "../_componentes/primitivos";
import { Gravador } from "../_componentes/Gravador";

const BASE = "/plataforma/app";

const ABAS = ["Entregas", "Cronograma", "Orçamento", "Responsabilidades"] as const;
type Aba = (typeof ABAS)[number];

function EstadoEntrega({ e }: { e: Entrega }) {
  if (e.estado === "aprovada") {
    return (
      <>
        <span className="pa-mono">{e.detalhe}</span>
        <span className="pa-mono">{e.evidencias ?? 0} evidências no acervo</span>
      </>
    );
  }
  if (e.estado === "pendente") {
    return (
      <>
        <span className="pa-mono pa-pendente">
          Evidência pendente{e.vence ? ` · vence ${e.vence}` : ""}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="pa-mono">{e.detalhe}</span>
      <Barra valor={e.progresso ?? 0} rotulo={`Progresso da entrega ${e.codigo}`} />
    </>
  );
}

function EnvioEvidencia({ entrega, projeto }: { entrega: Entrega; projeto: Projeto }) {
  const [arquivos, setArquivos] = useState<string[]>([]);
  const [descricao, setDescricao] = useState("");
  const [temAudio, setTemAudio] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const podeEnviar = arquivos.length > 0 && (descricao.trim().length > 0 || temAudio);

  if (enviado) {
    return (
      <div className="pa-cartao pa-pilha">
        <span className="pa-mono">Evidência não enviada</span>
        <p>
          Protótipo sem servidor de arquivos: nada saiu do seu navegador. Na plataforma real, este
          envio criaria um registro com <strong>autor, data e entrega vinculada</strong> ({entrega.codigo}{" "}
          do {projeto.id}) e entraria na trilha de decisões.
        </p>
        <button type="button" className="pa-btn" onClick={() => setEnviado(false)}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="pa-cartao pa-pilha">
      <span className="pa-mono">
        Enviar evidência · {entrega.codigo} — {entrega.titulo}
      </span>

      <div className="pa-campo">
        <label htmlFor="ev-arquivo">Arquivo, foto ou documento</label>
        <input
          id="ev-arquivo"
          className="pa-input"
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={(e) => setArquivos(Array.from(e.target.files ?? []).map((f) => f.name))}
        />
        {arquivos.length > 0 && <span className="pa-mono">{arquivos.join(" · ")}</span>}
      </div>

      <div className="pa-campo">
        <label htmlFor="ev-descricao">O que esta evidência comprova</label>
        <textarea
          id="ev-descricao"
          className="pa-textarea"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          placeholder="Descreva o que o arquivo demonstra — ou grave em áudio."
        />
        <Gravador
          rotulo="Descrever a evidência por áudio"
          onGravacao={(g) => setTemAudio(Boolean(g))}
        />
      </div>

      <button
        type="button"
        className="pa-btn pa-btn-primario"
        disabled={!podeEnviar}
        onClick={() => setEnviado(true)}
      >
        Anexar evidência
      </button>

      <p className="pa-ressalva">
        Toda evidência registra autor, data, entrega vinculada e fica disponível para escrutínio
        institucional quando cabível.
      </p>
    </div>
  );
}

export function ConstruirClient() {
  const sessao = useSessaoObrigatoria();
  const params = useSearchParams();

  const idDaUrl = params.get("pjf");
  const [projetoId, setProjetoId] = useState(
    () => PROJETOS.find((p) => p.id === idDaUrl)?.id ?? PROJETOS[0].id,
  );
  const [aba, setAba] = useState<Aba>("Entregas");
  const [entregaAtiva, setEntregaAtiva] = useState<string | null>(null);

  const projeto = useMemo(
    () => PROJETOS.find((p) => p.id === projetoId) ?? PROJETOS[0],
    [projetoId],
  );

  const alvo =
    projeto.entregas.find((e) => e.codigo === entregaAtiva) ??
    projeto.entregas.find((e) => e.estado === "pendente") ??
    projeto.entregas[0];

  if (!sessao) {
    return (
      <div className="pa-pagina">
        <p className="pa-mono">Carregando sessão do protótipo…</p>
      </div>
    );
  }

  return (
    <div className="pa-pagina pa-pilha-larga">
      <header className="pa-linha">
        <Tag tom="forte">{projeto.id}</Tag>
        <Tag tom={projeto.emExecucao ? "aderente" : "neutro"}>
          {projeto.emExecucao ? "Em execução" : projeto.status}
        </Tag>
        <h1 className="pa-titulo">Workspace</h1>
        <div className="pa-espaco" />
        <div className="pa-campo">
          <label htmlFor="cn-projeto" className="pa-sr">
            Projeto
          </label>
          <select
            id="cn-projeto"
            className="pa-select"
            value={projetoId}
            onChange={(e) => {
              setProjetoId(e.target.value);
              setEntregaAtiva(null);
            }}
          >
            {PROJETOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.titulo}
              </option>
            ))}
          </select>
        </div>
      </header>
      <span className="pa-mono">Governança · Orçamento · Contratos · Prestação de contas</span>

      <div className="pa-construir">
        <section>
          <div className="pa-abas" role="tablist" aria-label="Seções do workspace">
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

          {aba === "Entregas" && (
            <div className="pa-pilha">
              <ul className="pa-pilha">
                {projeto.entregas.map((e) => (
                  <li key={e.codigo} className="pa-cartao pa-entrega">
                    <div className="pa-pilha">
                      <div className="pa-linha">
                        <Tag>{e.codigo}</Tag>
                        <span className="pa-mono">Responsável: {e.responsavel}</span>
                      </div>
                      <strong className="pa-cartao-titulo">{e.titulo}</strong>
                    </div>
                    <div className="pa-pilha pa-entrega-lado">
                      <EstadoEntrega e={e} />
                      {e.estado !== "aprovada" && (
                        <button
                          type="button"
                          className="pa-btn pa-btn-pequeno"
                          onClick={() => setEntregaAtiva(e.codigo)}
                          aria-pressed={alvo?.codigo === e.codigo}
                        >
                          Enviar evidência
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {alvo && <EnvioEvidencia entrega={alvo} projeto={projeto} />}
            </div>
          )}

          {aba === "Cronograma" && (
            <div className="pa-cartao pa-pilha">
              <span className="pa-mono">Cronograma derivado das entregas</span>
              <ol className="pa-linha-tempo">
                {projeto.entregas.map((e) => (
                  <li key={e.codigo}>
                    <Tag>{e.codigo}</Tag>
                    <div>
                      <strong>{e.titulo}</strong>
                      <span className="pa-mono">
                        {e.estado === "aprovada"
                          ? e.detalhe
                          : e.vence
                            ? `Vence ${e.vence}`
                            : e.detalhe}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="pa-nota">
                Este protótipo não modela marcos contratuais nem dependências entre entregas. O
                cronograma real nasce do instrumento assinado, não da tela.
              </p>
            </div>
          )}

          {aba === "Orçamento" && (
            <div className="pa-cartao pa-pilha">
              <span className="pa-mono">Composição orçamentária — estrutura, sem valores</span>
              <ul className="pa-pilha">
                {projeto.funcoes.map((f) => (
                  <li key={f.nome} className="pa-tracejado pa-linha">
                    <strong>{f.nome}</strong>
                    <div className="pa-espaco" />
                    <span className="pa-mono">
                      {f.confirmada ? `${f.ator} · rubrica a formalizar` : `${f.chamada} · função aberta`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="pa-nota">
                Valores não aparecem de propósito. Condições econômicas se formalizam em instrumento
                próprio — inventar números aqui contradiria a ressalva que a plataforma exibe em toda
                chamada de composição.
              </p>
            </div>
          )}

          {aba === "Responsabilidades" && (
            <div className="pa-cartao pa-pilha">
              <span className="pa-mono">Quem responde por quê</span>
              <ul className="pa-pilha">
                {projeto.funcoes.map((f) => (
                  <li key={f.nome} className="pa-tracejado pa-linha">
                    <Tag tom={f.confirmada ? "aderente" : "neutro"}>
                      {f.confirmada ? "Confirmado" : "Chamada aberta"}
                    </Tag>
                    <strong>{f.nome}</strong>
                    <div className="pa-espaco" />
                    {f.confirmada ? (
                      <span className="pa-mono">{f.ator}</span>
                    ) : (
                      <Link href={`${BASE}/compor?cp=${f.chamada}`} className="pa-mono">
                        {f.chamada} →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <p className="pa-nota">
                Proponente é função institucional, não capacidade técnica. É por isso que a coalizão
                mede <strong>funções críticas cobertas</strong>, não número de parceiros.
              </p>
            </div>
          )}
        </section>

        <aside className="pa-pilha">
          <div className="pa-cartao pa-pilha">
            <span className="pa-mono">Do problema à transformação</span>
            <ul className="pa-pilha">
              <li>✓ Entrega — o que foi produzido</li>
              <li>○ Resultado — o que mudou</li>
              <li>○ Transformação — mudança demonstrada no contexto</li>
            </ul>
          </div>

          <div className="pa-cartao pa-pilha">
            <span className="pa-mono">Trilha de decisões</span>
            <ul className="pa-pilha">
              {projeto.decisoes.slice(0, 3).map((d) => (
                <li key={d.data} className="pa-mono">
                  {d.data} · {d.texto}
                </li>
              ))}
            </ul>
            <Link href={`${BASE}/projeto/${projeto.id}?aba=Trilha`} className="pa-mono">
              Ver tudo →
            </Link>
          </div>

          <div className="pa-cartao pa-pilha">
            <span className="pa-mono">
              Coalizão ativa · {projeto.funcoes.filter((f) => f.confirmada).length} atores
              confirmados
            </span>
            <div className="pa-avatares" aria-hidden="true">
              {projeto.funcoes.map((f) => (
                <span key={f.nome} className={f.confirmada ? "pa-avatar" : "pa-avatar pa-vago"} />
              ))}
            </div>
            <span className="pa-mono">
              {projeto.funcoes.filter((f) => !f.confirmada).length} funções ainda abertas
            </span>
          </div>

          <div className="pa-cartao-plano">
            <Gravador rotulo="Relatar andamento por áudio" />
          </div>
        </aside>
      </div>
    </div>
  );
}
