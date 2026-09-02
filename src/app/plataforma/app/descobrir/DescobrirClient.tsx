"use client";

/**
 * Ambiente 01 — Descobrir (wireframe 1f).
 *
 * Único ambiente com dado real: `/dados/oportunidades.json`, publicado pelo
 * pipeline. Fronteira do Contrato de Dados v1.0, respeitada aqui:
 *  - não fala com o Transferegov;
 *  - não recalcula `urgente`, `nova`, `aderente` nem `dias_restantes`;
 *  - se `origem.defasada`, o aviso é obrigatório e não pode ser fechado;
 *  - datas com parse manual, sem shift de fuso.
 *
 * A nota do wireframe: cada cartão precisa dizer POR QUE apareceu, senão o
 * ambiente vira uma lista de editais — o oposto da tese da página. É o que faz
 * o painel "Ver aderência".
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSessaoObrigatoria } from "../_lib/sessao";
import { PROJETOS, perfilPor } from "../_lib/fixtures";
import type { Oportunidade, PayloadOportunidades } from "../_lib/tipos";
import { formatBR, formatISOTimestamp, rotuloDias } from "../_lib/datas";
import { Tag } from "../_componentes/primitivos";
import { Gravador } from "../_componentes/Gravador";

type Ordem = "fecha" | "abre";

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "");
}

/**
 * Casamento derivado NO PROTÓTIPO entre tema da oportunidade e tema do PJF.
 * Não é o campo `aderente` do contrato — é um cálculo local, e a UI diz isso.
 * Prefixo de 4+ letras porque o pipeline entrega temas truncados ("inovac").
 */
function pjfRelacionado(o: Oportunidade): string | null {
  const temas = o.temas.map(normalizar).filter((t) => t.length >= 4);
  if (!temas.length) return null;
  for (const p of PROJETOS) {
    const alvo = p.temas.map(normalizar);
    const bate = temas.some((t) =>
      alvo.some((a) => a.startsWith(t.slice(0, 4)) || t.startsWith(a.slice(0, 4))),
    );
    if (bate) return p.id;
  }
  return null;
}

function Aderencia({ o, pjf }: { o: Oportunidade; pjf: string | null }) {
  const motivos: string[] = [];
  if (o.aderente) motivos.push("O pipeline marcou esta janela como aderente ao perfil da carteira.");
  if (o.urgente) motivos.push(`Prazo curto: ${rotuloDias(o.dias_restantes)} até o fechamento.`);
  if (o.nova) motivos.push("Entrou no repositório desde a última publicação do pipeline.");
  if (pjf) {
    motivos.push(
      `Tema em comum com ${pjf} (${o.temas.join(", ")}). Casamento calculado neste protótipo, não é campo do contrato.`,
    );
  }
  if (!motivos.length) {
    motivos.push("Apareceu apenas pelos filtros aplicados — nenhum marcador do contrato bateu.");
  }

  return (
    <div className="pa-tracejado pa-aderencia">
      <span className="pa-mono">Por que esta janela apareceu</span>
      <ul>
        {motivos.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      <span className="pa-mono">
        Natureza exigida: {o.natureza}
        {o.modalidade ? ` · Modalidade: ${o.modalidade}` : ""}
        {o.codigos.length ? ` · Código: ${o.codigos.join(", ")}` : ""}
      </span>
    </div>
  );
}

export function DescobrirClient({ payload }: { payload: PayloadOportunidades | null }) {
  const sessao = useSessaoObrigatoria();
  const params = useSearchParams();

  const [busca, setBusca] = useState("");
  const [naturezas, setNaturezas] = useState<string[]>([]);
  const [canais, setCanais] = useState<string[]>([]);
  const [orgao, setOrgao] = useState("");
  const [prazo, setPrazo] = useState<number | null>(() => {
    const p = params.get("prazo");
    return p === "15" || p === "45" ? Number(p) : null;
  });
  const [marcadores, setMarcadores] = useState<string[]>([]);
  const [soSalvas, setSoSalvas] = useState(false);
  const [salvas, setSalvas] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<Ordem>("fecha");
  const [aberta, setAberta] = useState<string | null>(null);
  // No mobile os filtros nascem recolhidos: o wireframe 1l mostra a lista
  // primeiro e "FILTROS" como disclosure. No desktop o CSS ignora isso.
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const lista = useMemo(() => {
    if (!payload) return [];
    const termo = normalizar(busca);
    const filtrada = payload.oportunidades.filter((o) => {
      if (termo && !normalizar(`${o.programa} ${o.orgao} ${o.codigos.join(" ")}`).includes(termo))
        return false;
      if (naturezas.length && !naturezas.includes(o.natureza)) return false;
      if (canais.length && !canais.includes(o.canal)) return false;
      if (orgao && o.orgao !== orgao) return false;
      if (prazo !== null && o.dias_restantes > prazo) return false;
      if (marcadores.includes("aderente") && !o.aderente) return false;
      if (marcadores.includes("nova") && !o.nova) return false;
      if (marcadores.includes("urgente") && !o.urgente) return false;
      if (soSalvas && !salvas.includes(o.id)) return false;
      return true;
    });
    return [...filtrada].sort((a, b) =>
      ordem === "fecha"
        ? a.dias_restantes - b.dias_restantes
        : (b.abre ?? "").localeCompare(a.abre ?? ""),
    );
  }, [payload, busca, naturezas, canais, orgao, prazo, marcadores, soSalvas, salvas, ordem]);

  function alternar(atual: string[], set: (v: string[]) => void, valor: string) {
    set(atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor]);
  }

  const filtrosAtivos =
    (busca ? 1 : 0) +
    naturezas.length +
    canais.length +
    (orgao ? 1 : 0) +
    (prazo !== null ? 1 : 0) +
    marcadores.length +
    (soSalvas ? 1 : 0);

  function limpar() {
    setBusca("");
    setNaturezas([]);
    setCanais([]);
    setOrgao("");
    setPrazo(null);
    setMarcadores([]);
    setSoSalvas(false);
  }

  if (!sessao) {
    return (
      <div className="pa-pagina">
        <p className="pa-mono">Carregando sessão do protótipo…</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="pa-pagina">
        <div className="pa-cartao pa-pilha">
          <p className="pa-kicker">Ambiente 01 · Descobrir</p>
          <h1 className="pa-titulo">Dados de oportunidades indisponíveis</h1>
          <p>
            O arquivo <code>/dados/oportunidades.json</code> não pôde ser lido, ou a versão do
            contrato de dados mudou de major. O app não consulta o Transferegov diretamente — por
            contrato — então não há como preencher esta tela sem o arquivo do pipeline.
          </p>
          <Link href="/oportunidades" className="pa-btn">
            Abrir o painel público de oportunidades
          </Link>
        </div>
      </div>
    );
  }

  const perfil = perfilPor(sessao.perfil);

  return (
    <div className="pa-pagina pa-descobrir">
      <aside className="pa-filtros" aria-label="Filtros de oportunidades">
        <button
          type="button"
          className="pa-filtros-toggle"
          aria-expanded={filtrosAbertos}
          aria-controls="painel-filtros"
          onClick={() => setFiltrosAbertos((v) => !v)}
        >
          Filtros
          {filtrosAtivos > 0 && <span className="pa-chip-contagem">{filtrosAtivos} ativos</span>}
          <span aria-hidden="true">{filtrosAbertos ? "▴" : "▾"}</span>
        </button>

        <div className="pa-filtros-corpo" id="painel-filtros" data-aberto={filtrosAbertos}>
        <div className="pa-campo">
          <label htmlFor="d-busca">Filtros</label>
          <input
            id="d-busca"
            className="pa-input"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="buscar programa, órgão, código…"
            type="search"
          />
        </div>

        <fieldset className="pa-fieldset">
          <legend className="pa-mono">Natureza jurídica</legend>
          {payload.filtros.naturezas.map((n) => (
            <label key={n} className="pa-check">
              <input
                type="checkbox"
                checked={naturezas.includes(n)}
                onChange={() => alternar(naturezas, setNaturezas, n)}
              />
              <span>{n}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="pa-fieldset">
          <legend className="pa-mono">Canal</legend>
          <div className="pa-chips">
            {payload.filtros.canais.map((c) => (
              <button
                key={c}
                type="button"
                className="pa-chip"
                aria-pressed={canais.includes(c)}
                onClick={() => alternar(canais, setCanais, c)}
              >
                {c === "proposta" ? "Proposta" : "Emenda"}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="pa-campo">
          <label htmlFor="d-orgao">Órgão</label>
          <select
            id="d-orgao"
            className="pa-select"
            value={orgao}
            onChange={(e) => setOrgao(e.target.value)}
          >
            <option value="">Todos</option>
            {payload.filtros.orgaos.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>

        <fieldset className="pa-fieldset">
          <legend className="pa-mono">Prazo</legend>
          <div className="pa-chips">
            {[15, 45].map((d) => (
              <button
                key={d}
                type="button"
                className="pa-chip"
                aria-pressed={prazo === d}
                onClick={() => setPrazo(prazo === d ? null : d)}
              >
                Fecha em ≤{d} dias
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="pa-fieldset">
          <legend className="pa-mono">Marcadores</legend>
          <div className="pa-chips">
            {(
              [
                ["aderente", "Aderente", payload.resumo.aderentes],
                ["nova", "Nova", payload.resumo.novas],
                ["urgente", "Urgente", payload.resumo.urgentes],
              ] as const
            ).map(([id, rotulo, total]) => (
              <button
                key={id}
                type="button"
                className="pa-chip"
                aria-pressed={marcadores.includes(id)}
                onClick={() => alternar(marcadores, setMarcadores, id)}
              >
                {rotulo} <span className="pa-chip-contagem">{total}</span>
              </button>
            ))}
            <button
              type="button"
              className="pa-chip"
              aria-pressed={soSalvas}
              onClick={() => setSoSalvas((v) => !v)}
            >
              Salvas <span className="pa-chip-contagem">{salvas.length}</span>
            </button>
          </div>
        </fieldset>

        <button type="button" className="pa-btn pa-btn-pequeno" onClick={limpar}>
          Limpar filtros
        </button>
        </div>
      </aside>

      <section className="pa-pilha">
        <div className="pa-pagina-cabeca">
          <div>
            <p className="pa-kicker">Ambiente 01 · Descobrir</p>
            <h1 className="pa-titulo">
              {lista.length} {lista.length === 1 ? "janela aberta" : "janelas abertas"}
            </h1>
            <p className="pa-sub">
              {lista.length === payload.oportunidades.length
                ? `Todas as janelas do arquivo · UF ${payload.uf}`
                : `Filtrado de ${payload.oportunidades.length} janelas · UF ${payload.uf}`}
            </p>
          </div>
          <div className="pa-campo">
            <label htmlFor="d-ordem">Ordenar</label>
            <select
              id="d-ordem"
              className="pa-select"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Ordem)}
            >
              <option value="fecha">Fecha primeiro</option>
              <option value="abre">Abriu mais recentemente</option>
            </select>
          </div>
        </div>

        {payload.origem.defasada && (
          <p className="pa-origem" role="note">
            <Tag tom="proto">Aviso de origem</Tag>
            <span className="pa-mono">
              {payload.origem.modulo} · atualizado em{" "}
              {formatISOTimestamp(payload.origem.atualizada_em)} · defasagem de{" "}
              {payload.origem.defasagem_dias} dias · a PONTE não consulta o repositório em tempo real
            </span>
          </p>
        )}

        {lista.length === 0 && (
          <div className="pa-cartao">
            <p>
              Nenhuma janela bate com esses filtros. Limpar os marcadores costuma ser o primeiro
              passo — <strong>Nova</strong> depende de o pipeline ter rodado depois da última
              publicação e pode estar zerado.
            </p>
          </div>
        )}

        <ul className="pa-pilha">
          {lista.map((o) => {
            const pjf = pjfRelacionado(o);
            const expandida = aberta === o.id;
            return (
              <li key={o.id} className="pa-cartao pa-oportunidade">
                <div className="pa-oportunidade-corpo">
                  <div className="pa-linha">
                    {o.urgente && <Tag tom="urgente">Urgente</Tag>}
                    {o.nova && <Tag tom="nova">Nova</Tag>}
                    {o.aderente && <Tag tom="aderente">Aderente</Tag>}
                    {pjf && <Tag tom="proto">Liga ao {pjf}</Tag>}
                  </div>
                  <h2 className="pa-oportunidade-titulo">{o.programa}</h2>
                  <span className="pa-mono">
                    {o.orgao}
                    {o.modalidade ? ` · ${o.modalidade}` : ""} · {o.natureza}
                  </span>
                  {o.temas.length > 0 && (
                    <div className="pa-linha">
                      {o.temas.map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pa-oportunidade-lado">
                  <span className="pa-mono">Fecha {formatBR(o.fecha)}</span>
                  <span className="pa-numero">{rotuloDias(o.dias_restantes)}</span>
                  <span className="pa-mono">
                    {o.propostas_recebidas > 0
                      ? `${o.propostas_recebidas} propostas recebidas`
                      : "—"}
                  </span>
                  <button
                    type="button"
                    className="pa-btn pa-btn-pequeno pa-btn-primario"
                    aria-expanded={expandida}
                    onClick={() => setAberta(expandida ? null : o.id)}
                  >
                    {expandida ? "Fechar aderência" : "Ver aderência"}
                  </button>
                  <button
                    type="button"
                    className="pa-btn pa-btn-pequeno"
                    aria-pressed={salvas.includes(o.id)}
                    onClick={() => alternar(salvas, setSalvas, o.id)}
                  >
                    {salvas.includes(o.id) ? "Salva ●" : "Salvar ○"}
                  </button>
                </div>

                {expandida && (
                  <div className="pa-oportunidade-detalhe">
                    <Aderencia o={o} pjf={pjf} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="pa-cartao-plano pa-linha">
          <Gravador rotulo="Diga o que você precisa financiar" variante="compacto" />
          <p>
            <strong>Não quer filtrar?</strong> Diga em áudio o que você precisa financiar. Neste
            protótipo o áudio fica no seu navegador e a lista continua sendo filtrada por você — a
            leitura por voz depende de um serviço que ainda não está ligado.
          </p>
        </div>

        <p className="pa-nota">
          Sua carteira é lida como <strong>{perfil.nome}</strong>. O marcador{" "}
          <strong>Aderente</strong> vem do pipeline; <strong>Liga ao PJF</strong> é casamento de
          tema calculado neste protótipo. Salvar mantém a janela apenas nesta sessão.
        </p>
      </section>
    </div>
  );
}
