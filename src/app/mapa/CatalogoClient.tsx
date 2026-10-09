"use client";

/**
 * Janelas — o catálogo multifonte, já recortado pela entidade de quem olha.
 *
 * A tela só DESENHA. O que é aberto, o que a entidade pode pleitear, a ordem e o
 * alcance dos filtros vêm prontos de `catalogo-v2.ts`, que tem teste. Aqui não
 * se recalcula prazo, elegibilidade nem contagem.
 *
 * C4a (09/10/2026; achado 4.1 da auditoria R1): `publico`, o nível 0 da versão aberta. Declarar a entidade e os
 * avisos pedem cadastro: no nível 0, os links dizem "(pede cadastro)" e levam à entrada (`linkNoPublico`).
 */

import { useMemo, useRef, useState } from "react";
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
import { ROTULO_TEMA, TEMAS_RAIZ, subtemasDe, type Tema } from "@/lib/oportunidades/temas";
import { TRANSFEREGOV_CONSULTA } from "@/lib/oportunidades/transferegov";
import { MARCA_PEDE_CADASTRO, linkNoPublico } from "@/lib/oportunidades/publico";
import { vazioCatalogo } from "@/lib/oportunidades/vazios";
import { copiarTexto } from "@/lib/area-de-transferencia";
import { Tag } from "../_design/primitivos";
import { EstrelaSeguir } from "./_componentes/EstrelaSeguir";
import { LinkMapa } from "./_componentes/LinkMapa";

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
  janelasSeguidas = null,
  publico = false,
}: {
  vista: CatalogoVista;
  entidade: Entidade | null;
  seguindoTemas: boolean;
  /** Ids das janelas que a pessoa segue. Null sem a oport_15: os cartões ficam sem estrela. */
  janelasSeguidas?: string[] | null;
  /** C4a: o nível 0 (versão pública). */
  publico?: boolean;
}) {
  const declarar = linkNoPublico("/mapa/conta/organizacao", publico);
  const [filtros, setFiltros] = useState<FiltrosCatalogo>(SEM_FILTRO);
  const [anuncio, setAnuncio] = useState("");
  const buscaRef = useRef<HTMLInputElement>(null);
  const seguidas = useMemo(() => (janelasSeguidas ? new Set(janelasSeguidas) : null), [janelasSeguidas]);

  const visiveis = useMemo(() => filtrarJanelas(vista.janelas, filtros), [vista.janelas, filtros]);

  // Contagens sobre as janelas da ENTIDADE, não sobre as já filtradas: se a
  // contagem encolhesse a cada clique, o número deixaria de dizer o que a opção
  // alcança e passaria a dizer o que sobrou.
  const porAssunto = useMemo(() => contarPorAssunto(vista.janelas), [vista.janelas]);

  // Assunto sem janela nenhuma não vira chip: são 19 no primeiro nível, e uma
  // fileira de zeros é ruído que empurra os que importam para baixo.
  const raizes = TEMAS_RAIZ.filter((t) => (porAssunto.get(t.id) ?? 0) > 0);

  const outrosFiltros = filtros.fontes.length > 0 || filtros.canais.length > 0 || filtros.assuntos.length > 0;
  const filtrando = outrosFiltros || filtros.busca.trim() !== "";

  /**
   * Os botões do vazio somem com o vazio (a lista volta no lugar deles): sem levar o foco a algum lugar, ele cairia no
   * corpo da página. Vai para o campo de busca, que fica, e a contagem viva anuncia quantas janelas voltaram.
   */
  function mudarFiltrosDoVazio(novos: FiltrosCatalogo) {
    setFiltros(novos);
    buscaRef.current?.focus();
  }

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
              <LinkMapa href="/mapa/avisos">Escolha assuntos para acompanhar</LinkMapa> e as que combinam sobem na lista.
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
          <LinkMapa href={declarar.href} className="pa-btn pa-btn-pequeno">
            Declarar a entidade{declarar.pedeCadastro && ` ${MARCA_PEDE_CADASTRO}`}
          </LinkMapa>
        </aside>
      )}

      <div className="mp-filtros">
        <div className="pa-campo mp-busca">
          <label htmlFor="catalogo-busca" className="pa-campo-rotulo">
            Buscar
          </label>
          <input
            ref={buscaRef}
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

      {raizes.length > 1 && <JanelasPorTema raizes={raizes} porAssunto={porAssunto} marcados={filtros.assuntos} alternar={alternarAssunto} />}

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
        <VazioCatalogo
          vista={vista}
          filtros={filtros}
          outrosFiltros={outrosFiltros}
          tipo={entidade ? tipoNaFrase(entidade.tipo) : null}
          mudarFiltros={mudarFiltrosDoVazio}
          publico={publico}
        />
      ) : (
        <ul className="pa-pilha mp-janelas">
          {visiveis.map((j) => (
            // A âncora é o destino dos links "Meus itens" → janela, que não tem página própria.
            <li key={j.id} id={`janela-${j.id}`}>
              <JanelaCartao
                janela={j}
                mostrarMotivos={entidade !== null}
                anunciar={setAnuncio}
                seguindo={seguidas ? seguidas.has(j.id) : null}
              />
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

/**
 * Nenhuma janela na lista (B12b, onda 3 de UX, 08/10/2026; antes, uma frase sem saída). Diz o que se procurou ou o
 * recorte (`vazioCatalogo`), o motivo provável quando há fonte com problema e até três saídas: tirar os filtros (ou só
 * os que não são a busca), conferir o tipo declarado da entidade, e Avisos, onde a janela nova aparece quando entra
 * no catálogo. Os filtros são estado da tela, por isso botões, e não links.
 */
function VazioCatalogo({
  vista,
  filtros,
  outrosFiltros,
  tipo,
  mudarFiltros,
  publico,
}: {
  vista: CatalogoVista;
  filtros: FiltrosCatalogo;
  outrosFiltros: boolean;
  tipo: string | null;
  mudarFiltros: (novos: FiltrosCatalogo) => void;
  publico: boolean;
}) {
  const avisos = linkNoPublico("/mapa/avisos", publico);
  const termo = filtros.busca.trim();
  const filtrando = outrosFiltros || termo !== "";
  const { frase, motivo } = vazioCatalogo({
    busca: filtros.busca,
    outrosFiltros,
    tipo,
    abertasHoje: vista.universo.abertasHoje,
    fontesComProblema: vista.fontesComProblema.map((f) => f.nome),
  });
  return (
    <div className="pa-cartao pa-cartao-plano pa-pilha mp-vazio">
      <p>{frase}</p>
      {motivo && <p>{motivo}</p>}
      {filtrando ? (
        <p className="pa-linha">
          <button type="button" className="pa-btn pa-btn-pequeno" onClick={() => mudarFiltros(SEM_FILTRO)}>
            Tirar os filtros
          </button>
          {termo && outrosFiltros && (
            <button type="button" className="pa-btn pa-btn-pequeno" onClick={() => mudarFiltros({ ...SEM_FILTRO, busca: filtros.busca })}>
              Buscar “{termo}” sem os outros filtros
            </button>
          )}
        </p>
      ) : (
        tipo &&
        vista.universo.abertasHoje > 0 && (
          <p className="pa-linha">
            <LinkMapa href="/mapa/conta/organizacao" className="pa-btn pa-btn-pequeno">
              Conferir o tipo declarado da entidade
            </LinkMapa>
          </p>
        )
      )}
      <p className="pa-nota">
        A lista vem do catálogo gerado em {formatarPublicacao(vista.geradoEm)}, que é atualizado todo dia. Quando uma janela nova entra nele,
        ela aparece em{" "}
        <LinkMapa href={avisos.href}>
          Avisos{avisos.pedeCadastro && ` ${MARCA_PEDE_CADASTRO}`}
        </LinkMapa>
        , em “O que mudou no catálogo”.
      </p>
    </div>
  );
}

/**
 * As janelas abertas por tema, em barras. As mesmas contagens dos chips de assunto, em outra
 * forma: quem olha vê de relance onde há mais oportunidade. Clicar numa barra marca o assunto.
 * Uma janela com dois temas conta nos dois, então as barras não somam o total.
 */
function JanelasPorTema({
  raizes,
  porAssunto,
  marcados,
  alternar,
}: {
  raizes: Tema[];
  porAssunto: Map<string, number>;
  marcados: string[];
  alternar: (id: string) => void;
}) {
  const ordenadas = [...raizes].sort((a, b) => (porAssunto.get(b.id) ?? 0) - (porAssunto.get(a.id) ?? 0));
  const maior = Math.max(1, ...ordenadas.map((t) => porAssunto.get(t.id) ?? 0));
  return (
    <details className="pa-cartao mp-temas-grafico">
      <summary className="pa-mono">Janelas abertas por tema</summary>
      <p className="pa-nota">Uma janela com dois temas conta nos dois. Clique num tema para filtrar a lista.</p>
      <ul className="mp-barras-lista">
        {ordenadas.map((t) => {
          const qtd = porAssunto.get(t.id) ?? 0;
          return (
            <li key={t.id}>
              <button type="button" className="mp-barra-botao" aria-pressed={marcados.includes(t.id)} onClick={() => alternar(t.id)}>
                <span className="mp-barra-rotulo">{t.rotulo}</span>
                <span className="mp-barra" aria-hidden="true">
                  <span className="mp-barra-cheia" style={{ width: `${(qtd / maior) * 100}%` }} />
                </span>
                <span className="mp-num">
                  {qtd}
                  <span className="pa-sr"> {qtd === 1 ? "janela" : "janelas"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function JanelaCartao({
  janela: j,
  mostrarMotivos,
  anunciar,
  seguindo,
}: {
  janela: JanelaVista;
  mostrarMotivos: boolean;
  anunciar: (mensagem: string) => void;
  seguindo: boolean | null;
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
        {seguindo !== null && <EstrelaSeguir tipo="janela" chave={j.id} nome={`a janela ${j.titulo}`} seguindo={seguindo} />}
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
        ) : j.fonteId.startsWith("transferegov-") && j.fonteUrl.startsWith("https://") ? (
          // Especiais, fundo a fundo e parcerias: sem edital nem endereço por programa.
          // O botão leva ao módulo, onde o ente entra e procura pelo nome.
          <a className="pa-btn pa-btn-pequeno" href={j.fonteUrl} target="_blank" rel="noopener noreferrer">
            Abrir no Transferegov
            <span className="pa-sr"> — módulo {j.fonteNome.replace(/^TransfereGov · /, "")}, programa {j.titulo} (abre em nova aba)</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
