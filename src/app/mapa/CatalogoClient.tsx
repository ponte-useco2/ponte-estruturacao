"use client";

/**
 * Janelas — o catálogo multifonte, já recortado pela entidade de quem olha.
 *
 * A tela só DESENHA. O que é aberto, o que a entidade pode pleitear, a ordem e o
 * alcance dos filtros vêm prontos de `catalogo-v2.ts`, que tem teste. Aqui não
 * se recalcula prazo, elegibilidade nem contagem.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  SEM_FILTRO,
  contarPorAssunto,
  contarPorCanal,
  filtrarJanelas,
  type CatalogoVista,
  type FiltrosCatalogo,
  type JanelaVista,
} from "@/lib/oportunidades/catalogo-v2";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { CONDICAO_CANAL, ORDEM_CANAL, ROTULO_CANAL, type CanalV2 } from "@/lib/oportunidades/contrato-v2";
import { ROTULO_TEMA, TEMAS_RAIZ, subtemasDe } from "@/lib/oportunidades/temas";
import { TRANSFEREGOV_CONSULTA } from "@/lib/oportunidades/transferegov";
import { copiarTexto } from "@/lib/area-de-transferencia";
import { Tag } from "../_design/primitivos";

interface Entidade {
  nome: string;
  tipo: string;
  uf: string | null;
}

function prazoPorExtenso(j: JanelaVista): string {
  if (j.prazo === null || j.diasRestantes === null) return "Sem prazo informado pela fonte";
  const data = formatarData(j.prazo);
  if (j.diasRestantes === 0) return `Fecha hoje · ${data}`;
  if (j.diasRestantes === 1) return `Falta 1 dia · fecha em ${data}`;
  return `Faltam ${j.diasRestantes} dias · fecha em ${data}`;
}

/**
 * O tipo de agente no meio de uma frase. `toLowerCase()` puro transformava
 * "ICT" em "ict", e "Outro" virava "para outro".
 */
function tipoNaFrase(tipo: string): string {
  if (tipo === "Outro") return "outros proponentes";
  if (/^[A-ZÀ-Ý]{2,}$/.test(tipo)) return tipo;
  return tipo.charAt(0).toLowerCase() + tipo.slice(1);
}

function alternar<T extends string>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

export function CatalogoClient({
  vista,
  entidade,
  seguindoTemas,
}: {
  vista: CatalogoVista;
  entidade: Entidade | null;
  seguindoTemas: boolean;
}) {
  const [filtros, setFiltros] = useState<FiltrosCatalogo>(SEM_FILTRO);
  const [anuncio, setAnuncio] = useState("");

  const visiveis = useMemo(() => filtrarJanelas(vista.janelas, filtros), [vista.janelas, filtros]);

  // Contagens sobre as janelas da ENTIDADE, não sobre as já filtradas: se a
  // contagem encolhesse a cada clique, o número deixaria de dizer o que a opção
  // alcança e passaria a dizer o que sobrou.
  const porAssunto = useMemo(() => contarPorAssunto(vista.janelas), [vista.janelas]);

  // Assunto sem janela nenhuma não vira chip: são 19 no primeiro nível, e uma
  // fileira de zeros é ruído que empurra os que importam para baixo.
  const raizes = TEMAS_RAIZ.filter((t) => (porAssunto.get(t.id) ?? 0) > 0);

  const filtrando =
    filtros.fontes.length > 0 ||
    filtros.canais.length > 0 ||
    filtros.assuntos.length > 0 ||
    filtros.busca.trim() !== "";

  function alternarAssunto(id: string) {
    setFiltros((f) => {
      if (f.assuntos.includes(id)) {
        // Desmarcar o pai leva os filhos junto. Filho escolhido que continuasse
        // valendo depois de o subfiltro sumir da tela seria filtro invisível —
        // e filtro invisível ninguém desfaz.
        const filhos = new Set(subtemasDe(id).map((t) => t.id));
        return { ...f, assuntos: f.assuntos.filter((a) => a !== id && !filhos.has(a)) };
      }
      return { ...f, assuntos: [...f.assuntos, id] };
    });
  }

  const porCanal = useMemo(() => contarPorCanal(vista.janelas), [vista.janelas]);
  const canaisPresentes = ORDEM_CANAL.filter((c) => (porCanal.get(c) ?? 0) > 0);

  // Até 13/09/2026 o título era "O que [entidade] pode pleitear". Deixou de ser
  // verdade quando ficou claro que, das janelas do Transferegov, as de emenda e
  // as de beneficiário específico aceitam o TIPO de proponente mas não recebem
  // proposta de qualquer um. O canal agora está em cada cartão, com a condição.
  const titulo = entidade ? `Janelas abertas para ${tipoNaFrase(entidade.tipo)}` : "Janelas abertas";

  return (
    <div className="pa-pagina mp-catalogo">
      <div className="pa-pagina-cabeca">
        <div className="pa-pilha">
          <p className="pa-kicker">Janelas abertas</p>
          <h1 className="pa-titulo">{titulo}</h1>
          <p className="pa-sub">
            {entidade && vista.paraEntidade ? (
              <>
                {vista.paraEntidade.elegiveis} {vista.paraEntidade.elegiveis === 1 ? "janela aceita" : "janelas aceitam"}{" "}
                {tipoNaFrase(entidade.tipo)}
                {vista.paraEntidade.urgentes > 0 && <> · {vista.paraEntidade.urgentes} fecham em até 15 dias</>}
                {/* Regra 2 do contrato: o universo é dito como universo. */}
                {" "}· de {vista.universo.abertasHoje} abertas hoje em todo o catálogo
              </>
            ) : (
              <>
                {vista.universo.abertasHoje} abertas hoje, de {vista.universo.monitoradas} monitoradas em{" "}
                {vista.fontes.length} fontes
              </>
            )}
          </p>
          {/* Uma vez, e não em cada cartão: repetida dezenas de vezes, a mesma
              frase deixa de ser lida. */}
          {entidade && !seguindoTemas && (
            <p className="pa-nota">
              A ordem hoje considera prazo, tipo e território.{" "}
              <Link href="/mapa/avisos">Escolha assuntos para acompanhar</Link> e as que combinam sobem na lista.
            </p>
          )}
        </div>
      </div>

      {/* Regra 1 do contrato: fonte com problema é NOMEADA. */}
      {vista.fontesComProblema.length > 0 && (
        <div className="pa-cartao mp-fontes-faixa">
          <p className="pa-mono">Cobertura incompleta</p>
          {vista.fontesComProblema.map((f) => (
            <p key={f.id}>
              {/* O horário é o da ÚLTIMA LEITURA BOA, não o do início da falha:
                  "com falha desde 21:04" diria que falhou às 21:04, quando foi
                  justamente a última vez que funcionou. */}
              <strong>{f.nome}</strong> está {f.rotuloStatus}.{" "}
              {f.ultimoSucesso && <>A última leitura boa foi em {formatarPublicacao(f.ultimoSucesso)}. </>}
              As janelas dela podem estar desatualizadas ou faltando.
            </p>
          ))}
        </div>
      )}

      {entidade === null && (
        <aside className="pa-cartao pa-cartao-plano mp-convite">
          <p>
            Você está vendo todas as janelas abertas. Declare que tipo de agente é a sua entidade e o Mapa
            mostra só as que ela pode pleitear.
          </p>
          <span className="pa-espaco" />
          <Link href="/mapa/conta/organizacao" className="pa-btn pa-btn-pequeno">
            Declarar a entidade
          </Link>
        </aside>
      )}

      <div className="mp-filtros">
        <div className="pa-campo mp-busca">
          <label htmlFor="catalogo-busca" className="pa-campo-rotulo">
            Buscar
          </label>
          <input
            id="catalogo-busca"
            type="search"
            className="pa-input"
            placeholder="Programa ou órgão"
            value={filtros.busca}
            onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
          />
        </div>

        <fieldset className="pa-fieldset">
          <legend className="pa-mono">Fonte</legend>
          <div className="pa-chips">
            {vista.fontes.map((f) => (
              <button
                key={f.id}
                type="button"
                className="pa-chip"
                aria-pressed={filtros.fontes.includes(f.id)}
                onClick={() => setFiltros((x) => ({ ...x, fontes: alternar(x.fontes, f.id) }))}
              >
                {f.nome}
                {f.status !== "healthy" && (
                  <>
                    <span className="mp-fonte-alerta" aria-hidden="true" />
                    <span className="pa-sr">, {f.rotuloStatus}</span>
                  </>
                )}
                <span className="pa-chip-contagem">
                  <span className="pa-sr">, </span>
                  {f.abertas}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {canaisPresentes.length > 1 && (
          <fieldset className="pa-fieldset">
            <legend className="pa-mono">Como propor</legend>
            <div className="pa-chips">
              {canaisPresentes.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="pa-chip"
                  aria-pressed={filtros.canais.includes(c)}
                  // A condição vai no título do botão E no cartão: aqui ajuda a
                  // escolher, lá ajuda a não se enganar depois de escolhido.
                  title={CONDICAO_CANAL[c]}
                  onClick={() => setFiltros((x) => ({ ...x, canais: alternar<CanalV2>(x.canais, c) }))}
                >
                  {ROTULO_CANAL[c]}
                  <span className="pa-chip-contagem">
                    <span className="pa-sr">, </span>
                    {porCanal.get(c) ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {raizes.length > 0 && (
          <fieldset className="pa-fieldset">
            <legend className="pa-mono">Assunto</legend>
            <div className="pa-chips">
              {raizes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="pa-chip"
                  aria-pressed={filtros.assuntos.includes(t.id)}
                  onClick={() => alternarAssunto(t.id)}
                >
                  {t.rotulo}
                  <span className="pa-chip-contagem">
                    <span className="pa-sr">, </span>
                    {porAssunto.get(t.id) ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {/* O subfiltro aparece só com o pai marcado, e REFINA — ver
                `assuntosEfetivos`. Quem abre o subfiltro quer estreitar. */}
            {filtros.assuntos
              .filter((pai) => subtemasDe(pai).some((t) => (porAssunto.get(t.id) ?? 0) > 0))
              .map((pai) => (
                <div
                  key={pai}
                  className="mp-subfiltro"
                  role="group"
                  aria-label={`Especificar ${ROTULO_TEMA[pai]}`}
                >
                  <p className="pa-mono">Dentro de {ROTULO_TEMA[pai]}</p>
                  <div className="pa-chips">
                    {subtemasDe(pai)
                      .filter((t) => (porAssunto.get(t.id) ?? 0) > 0)
                      .map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="pa-chip"
                          aria-pressed={filtros.assuntos.includes(t.id)}
                          onClick={() => alternarAssunto(t.id)}
                        >
                          {t.rotulo}
                          <span className="pa-chip-contagem">
                            <span className="pa-sr">, </span>
                            {porAssunto.get(t.id) ?? 0}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
          </fieldset>
        )}
      </div>

      {/* Uma região só para as cópias de código: dividir a da contagem faria o
          leitor de tela ouvir "Código copiado" no lugar de "12 janelas". */}
      <p className="pa-sr" role="status" aria-atomic="true">
        {anuncio}
      </p>

      <div className="pa-linha mp-resultado">
        {/* Região viva sempre presente: só o texto muda, para ser lida. */}
        <p role="status" aria-atomic="true" className="pa-mono">
          {visiveis.length} {visiveis.length === 1 ? "janela" : "janelas"}
          {filtrando && ` de ${vista.janelas.length}`}
        </p>
        <span className="pa-espaco" />
        {filtrando && (
          <button type="button" className="pa-btn pa-btn-pequeno" onClick={() => setFiltros(SEM_FILTRO)}>
            Limpar filtros
          </button>
        )}
      </div>

      {visiveis.length === 0 ? (
        <div className="pa-cartao pa-cartao-plano mp-vazio">
          <p>
            {filtrando
              ? "Nenhuma janela com esses filtros."
              : entidade
                ? `Nenhuma janela aberta hoje aceita ${entidade.tipo.toLowerCase()}.`
                : "Nenhuma janela aberta hoje."}
          </p>
        </div>
      ) : (
        <ul className="pa-pilha mp-janelas">
          {visiveis.map((j) => (
            <li key={j.id}>
              <JanelaCartao janela={j} mostrarMotivos={entidade !== null} anunciar={setAnuncio} />
            </li>
          ))}
        </ul>
      )}

      <p className="pa-nota mp-procedencia">
        Catálogo gerado em {formatarPublicacao(vista.geradoEm)}. Prazos contados a partir de{" "}
        {formatarData(vista.hoje)}, no horário da Paraíba.
      </p>
    </div>
  );
}

function JanelaCartao({
  janela: j,
  mostrarMotivos,
  anunciar,
}: {
  janela: JanelaVista;
  mostrarMotivos: boolean;
  anunciar: (mensagem: string) => void;
}) {
  const edital = j.documentos[0];
  const combinaTema = j.aderencia?.motivos.some((m) => m.startsWith("combina")) ?? false;
  const [copia, setCopia] = useState<"copiado" | "falhou" | null>(null);
  const codigoRef = useRef<HTMLElement>(null);

  /**
   * Copiar e abrir são dois botões, não um. Até 14/09/2026 era um só, que copiava
   * e abria a consulta em seguida; quando o navegador recusou a cópia, a aba do
   * Transferegov abriu mesmo assim, por cima do aviso de falha, e a pessoa chegou
   * ao formulário vazio sem saber por quê. Separados, o resultado da cópia fica à
   * vista antes de sair da página.
   */
  async function copiar() {
    const codigo = j.codigos[0];
    if (await copiarTexto(codigo)) {
      setCopia("copiado");
      anunciar(`Código ${codigo} copiado. Abra a consulta do Transferegov, cole em Código do Programa e clique em Consultar.`);
      return;
    }
    // Sem cópia, o código fica SELECIONADO no cartão: um Ctrl+C resolve. Dizer que
    // copiou sem ter copiado seria mentira.
    const alvo = codigoRef.current;
    const selecao = window.getSelection();
    if (alvo && selecao) {
      const trecho = document.createRange();
      trecho.selectNodeContents(alvo);
      selecao.removeAllRanges();
      selecao.addRange(trecho);
    }
    setCopia("falhou");
    anunciar(`O navegador bloqueou a cópia. O código ${codigo} ficou selecionado no cartão: use Ctrl+C.`);
  }

  return (
    <article className="pa-cartao mp-janela">
      <div className="mp-janela-corpo">
        <div className="pa-linha mp-janela-etiquetas">
          <Tag>{j.fonteNome}</Tag>
          {j.canal !== null ? <Tag tom="forte">{ROTULO_CANAL[j.canal]}</Tag> : <Tag>{j.instrumento}</Tag>}
          {combinaTema && <Tag tom="aderente">Combina com o que você acompanha</Tag>}
        </div>

        <h2 className="pa-oportunidade-titulo mp-janela-titulo">{j.titulo}</h2>
        <p className="mp-janela-financiador">{j.financiador}</p>
        {j.canal !== null && <p className="mp-janela-condicao">{CONDICAO_CANAL[j.canal]}</p>}

        {j.codigos.length > 0 && (
          <p className="mp-janela-codigo">
            <span className="pa-mono">{j.codigos.length === 1 ? "Código do programa" : "Códigos do programa"}</span>
            {j.codigos.map((c, i) => (
              <code key={c} ref={i === 0 ? codigoRef : undefined} className="pa-mapa-codigo">
                {c}
              </code>
            ))}
          </p>
        )}

        {j.temas.length > 0 && (
          <p className="pa-mono mp-janela-temas">{j.temas.map((t) => ROTULO_TEMA[t] ?? t).join(" · ")}</p>
        )}

        {mostrarMotivos && j.aderencia && j.aderencia.motivos.length > 0 && (
          <p className="mp-janela-motivos">
            <span className="pa-mono">Por que aparece</span> {j.aderencia.motivos.join(" · ")}
          </p>
        )}

        {j.fonteDefasada && (
          <p className="pa-ressalva">Dado da última leitura boa da fonte, que está fora do ar.</p>
        )}
      </div>

      <div className="mp-janela-lado">
        <p className={j.urgente ? "mp-prazo mp-prazo-urgente" : "mp-prazo"}>{prazoPorExtenso(j)}</p>
        {edital ? (
          <a
            className="pa-btn pa-btn-pequeno"
            href={edital.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver edital
            <span className="pa-sr"> de {j.titulo} (abre em nova aba)</span>
          </a>
        ) : j.fonteId === "transferegov" && j.codigos.length > 0 ? (
          // Janela do Transferegov não traz documento, e o Transferegov não tem
          // endereço por programa: a consulta SEMPRE abre vazia, e o código é colado
          // lá. O código vem do v1 (`codigos-transferegov.ts`).
          <>
            <button type="button" className="pa-btn pa-btn-pequeno" onClick={copiar}>
              {copia === "copiado" ? "Código copiado ✓" : "Copiar código"}
              <span className="pa-sr"> do programa {j.titulo}</span>
            </button>
            <a className="pa-btn pa-btn-pequeno" href={TRANSFEREGOV_CONSULTA} target="_blank" rel="noopener noreferrer">
              Abrir consulta
              <span className="pa-sr"> do Transferegov (abre em nova aba)</span>
            </a>
            {copia !== null && (
              <p className="pa-mono mp-janela-copiado">
                {copia === "falhou"
                  ? "O navegador bloqueou a cópia. O código ficou selecionado: aperte Ctrl+C."
                  : `${j.codigos.length > 1 ? "Copiado o 1º código. " : ""}Na consulta, cole em “Código do Programa” e clique em Consultar.`}
              </p>
            )}
          </>
        ) : j.fonteId === "transferegov" ? (
          // Sem código (v1 ausente ou sem par): fica a consulta, e a busca é pelo
          // nome. Antes de 14/09/2026 era o único caminho.
          <a
            className="pa-btn pa-btn-pequeno"
            href={TRANSFEREGOV_CONSULTA}
            target="_blank"
            rel="noopener noreferrer"
          >
            Consultar no Transferegov
            <span className="pa-sr"> — procure pelo programa {j.titulo} (abre em nova aba)</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
