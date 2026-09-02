"use client";

/**
 * Ambiente 03 — Compor (wireframe 1i).
 *
 * A ressalva contratual é a mesma da página pública e é obrigatória em qualquer
 * tela que ofereça manifestar capacidade.
 *
 * Regra 4 do modo áudio implementada aqui: manifestar capacidade gera efeito
 * jurídico, então exige toque explícito — marcar a ciência da ressalva e depois
 * confirmar. Voz resolve entrada de informação; não resolve consentimento.
 *
 * "Indicar alguém" existe porque transforma quem não é candidato em nó útil do
 * grafo, em vez de fazer a pessoa sair da tela sem nada.
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessaoObrigatoria } from "../_lib/sessao";
import { CHAMADAS, RESSALVA_MANIFESTACAO, chamadaPor, projetoPor } from "../_lib/fixtures";
import type { Chamada } from "../_lib/tipos";
import { Barra, Tag } from "../_componentes/primitivos";
import { Gravador } from "../_componentes/Gravador";

const BASE = "/plataforma/app";

function Detalhe({ chamada, onFechar }: { chamada: Chamada; onFechar: () => void }) {
  const projeto = projetoPor(chamada.projetoId);
  const [comoEntrega, setComoEntrega] = useState("");
  const [anexos, setAnexos] = useState<string[]>([]);
  const [ciente, setCiente] = useState(false);
  const [resultado, setResultado] = useState<"nenhum" | "manifestado" | "indicado" | "salvo">(
    "nenhum",
  );

  return (
    <article className="pa-cartao pa-pilha-larga pa-chamada">
      <header className="pa-linha">
        <div style={{ flex: "1 1 320px" }}>
          <p className="pa-kicker">Chamada de composição · {chamada.codigo}</p>
          <h2 className="pa-titulo">{chamada.titulo}</h2>
        </div>
        <button type="button" className="pa-icone-botao" onClick={onFechar} aria-label="Fechar chamada">
          ×
        </button>
      </header>

      <div className="pa-tracejado pa-linha">
        <span className="pa-mono">Vinculada ao</span>
        <Tag tom="forte">{chamada.projetoId}</Tag>
        <span className="pa-mono">{projeto ? `${projeto.titulo} · ${projeto.territorio}` : ""}</span>
        <div className="pa-espaco" />
        <Link href={`${BASE}/projeto/${chamada.projetoId}`} className="pa-mono">
          Ver projeto →
        </Link>
      </div>

      <dl className="pa-definicoes">
        <div>
          <dt>Papel no projeto</dt>
          <dd>{chamada.papel}</dd>
        </div>
        <div>
          <dt>Entregas esperadas</dt>
          <dd>{chamada.entregas}</dd>
        </div>
        <div>
          <dt>Experiência requerida</dt>
          <dd>{chamada.experiencia}</dd>
        </div>
        <div>
          <dt>Forma de participação</dt>
          <dd>{chamada.participacao}</dd>
        </div>
      </dl>

      <section className="pa-cartao-plano pa-pilha">
        <span className="pa-mono">Sua manifestação</span>

        <div className="pa-linha">
          <span className="pa-mono" style={{ flex: "none" }}>
            Aderência calculada
          </span>
          <div style={{ flex: 1, minWidth: 120 }}>
            <Barra valor={chamada.aderencia} rotulo={`Aderência à ${chamada.codigo}`} />
          </div>
          <span className="pa-mono">{chamada.aderencia}%</span>
        </div>
        <span className="pa-mono">
          {chamada.cobre.length
            ? `Seu cadastro já cobre: ${chamada.cobre.join(" · ")}`
            : "Seu cadastro ainda não cobre nada desta chamada — a aderência é baixa de propósito"}
        </span>

        <div className="pa-campo">
          <label htmlFor="cp-entrega">Como você entregaria esse escopo</label>
          <textarea
            id="cp-entrega"
            className="pa-textarea"
            value={comoEntrega}
            onChange={(e) => setComoEntrega(e.target.value)}
            rows={3}
            placeholder="Método, prazo, equipe, o que você precisaria do resto da coalizão…"
          />
          <Gravador rotulo="Explicar por áudio como você entregaria" />
        </div>

        <div className="pa-campo">
          <label htmlFor="cp-anexos">Anexar portfólio, ART, CV ou acervo</label>
          <input
            id="cp-anexos"
            className="pa-input"
            type="file"
            multiple
            onChange={(e) => setAnexos(Array.from(e.target.files ?? []).map((f) => f.name))}
          />
          {anexos.length > 0 && (
            <span className="pa-mono">
              {anexos.join(" · ")} — escolhidos neste navegador, não enviados
            </span>
          )}
        </div>
      </section>

      <p className="pa-ressalva">{RESSALVA_MANIFESTACAO}</p>

      {resultado === "nenhum" ? (
        <>
          <label className="pa-check">
            <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} />
            <span>
              Li a ressalva acima e entendo que manifestar capacidade não garante contratação nem
              financiamento.
            </span>
          </label>

          <div className="pa-linha pa-acoes">
            <button
              type="button"
              className="pa-btn pa-btn-primario"
              disabled={!ciente}
              onClick={() => setResultado("manifestado")}
            >
              Tenho essa capacidade
            </button>
            <button type="button" className="pa-btn" onClick={() => setResultado("indicado")}>
              Indicar alguém
            </button>
            <button type="button" className="pa-btn" onClick={() => setResultado("salvo")}>
              Salvar chamada
            </button>
          </div>
          {!ciente && (
            <span className="pa-mono">
              Confirmação com efeito jurídico exige toque explícito — por isso o botão só libera
              depois da ciência, mesmo que você tenha respondido por áudio.
            </span>
          )}
        </>
      ) : (
        <div className="pa-tracejado pa-pilha">
          <span className="pa-mono">
            {resultado === "manifestado" && "Manifestação registrada só nesta sessão"}
            {resultado === "indicado" && "Indicação registrada só nesta sessão"}
            {resultado === "salvo" && "Chamada salva só nesta sessão"}
          </span>
          <p>
            Protótipo: nada foi enviado à PONTE. Na plataforma real, esta ação entraria na trilha de
            decisões do {chamada.projetoId} com autor e data, e a equipe de estruturação avaliaria a
            aderência antes de compor a função.
          </p>
          <div className="pa-linha">
            <button type="button" className="pa-btn" onClick={() => setResultado("nenhum")}>
              Desfazer
            </button>
            <Link href="/plataforma#participacao" className="pa-btn pa-btn-primario">
              Registrar interesse de verdade
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}

export function ComporClient() {
  const sessao = useSessaoObrigatoria();
  const router = useRouter();
  const params = useSearchParams();
  const codigo = params.get("cp");
  const selecionada = codigo ? chamadaPor(codigo) : undefined;

  const abrir = useCallback(
    (cp: string | null) => {
      router.replace(cp ? `${BASE}/compor?cp=${cp}` : `${BASE}/compor`, { scroll: false });
    },
    [router],
  );

  if (!sessao) {
    return (
      <div className="pa-pagina">
        <p className="pa-mono">Carregando sessão do protótipo…</p>
      </div>
    );
  }

  return (
    <div className="pa-pagina pa-compor">
      <section className="pa-pilha">
        <div>
          <p className="pa-kicker">Ambiente 03 · Compor</p>
          <h1 className="pa-titulo">{CHAMADAS.length} chamadas de composição abertas</h1>
          <p className="pa-sub">
            Cada chamada é uma função crítica que falta a um Projeto em Formação — não uma vaga
            genérica.
          </p>
        </div>

        <ul className="pa-pilha">
          {CHAMADAS.map((c) => {
            const ativa = selecionada?.codigo === c.codigo;
            return (
              <li key={c.codigo}>
                <button
                  type="button"
                  className={`pa-chamada-item${ativa ? " pa-ativo" : ""}`}
                  aria-current={ativa ? "true" : undefined}
                  onClick={() => abrir(ativa ? null : c.codigo)}
                >
                  <div className="pa-linha">
                    <Tag tom="forte">{c.codigo}</Tag>
                    <Tag>{c.projetoId}</Tag>
                    <div className="pa-espaco" />
                    <span className="pa-mono">Aderência {c.aderencia}%</span>
                  </div>
                  <strong className="pa-cartao-titulo">{c.titulo}</strong>
                  <Barra valor={c.aderencia} rotulo={`Aderência à ${c.codigo}`} />
                  <span className="pa-mono">{c.papel}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="pa-nota">
          A aderência é calculada neste protótipo a partir do perfil declarado no onboarding. Na
          plataforma real ela viria do cruzamento entre a capacidade cadastrada e a função exigida
          pelo projeto.
        </p>
      </section>

      <div className="pa-compor-detalhe">
        {selecionada ? (
          /* `key` remonta o painel ao trocar de chamada: consentimento e anexos
             não podem ser herdados de outra vaga. */
          <Detalhe key={selecionada.codigo} chamada={selecionada} onFechar={() => abrir(null)} />
        ) : (
          <div className="pa-tracejado pa-vazio">
            <span className="pa-mono">Selecione uma chamada para ver o escopo completo</span>
          </div>
        )}
      </div>
    </div>
  );
}
