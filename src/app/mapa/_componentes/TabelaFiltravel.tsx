"use client";

/**
 * A tabela com filtro e ordem em cada coluna (onda 15, A, 13/10/2026): a regra permanente do titular para toda tabela
 * que LISTA coisas. A lógica (ler e gravar o endereço, filtrar, ordenar, o CSV) é pura e tem teste, em
 * `lib/oportunidades/tabela-filtro.ts`; aqui só se liga aquilo à tela.
 *
 * Como a tela usa: monta no servidor as `colunas` e as `linhas` (cada linha com os `valores` crus, que filtram, ordenam e
 * vão ao CSV, e as `celulas` desenhadas) e passa tudo para cá. Componente do navegador não recebe função; por isso nada
 * aqui pede `valor(linha)`. A célula que a tela não mandar sai do valor cru (`textoDoValor`: número em pt-BR, data
 * DD/MM/AAAA, "—" no vazio). A primeira coluna vira o cabeçalho da linha (`<th scope="row">`), como no resto do Mapa.
 *
 * - **O estado mora no endereço** (`?t.<id>.<coluna>=…`, formato no topo de `tabela-filtro.ts`) e fica também na
 *   memória do componente, que é quem desenha: a tabela muda na hora, sem ida ao servidor. A escrita no endereço usa o
 *   `window.history.replaceState` nativo, que o Next 16 integra ao roteador (o `useSearchParams` acompanha). O
 *   `router.replace` pedido no plano fazia, a cada troca, uma nova renderização da página no servidor (conferir a sessão,
 *   ler o banco, mandar as 383 linhas de novo) e só atualizava o `useSearchParams` na volta: o campo ficava atrasado
 *   enquanto se digitava. O texto e o número vão ao endereço 350 ms depois da última tecla (o Safari recusa mais de 100
 *   trocas de endereço em 30 s); caixa, data, ordem e "Limpar" vão na hora.
 * - **Mudança de fora** (o menu leva à mesma página sem filtro, por exemplo) chega pelo `useSearchParams`: o que não for
 *   a escrita desta tabela ainda em voo, nem a que ainda espera os 350 ms, substitui o estado e recomeça os campos.
 * - **Cabeçalho:** o título de cada coluna que ordena é um `<button>` dentro do `<th>`; o clique vai de crescente a
 *   decrescente e de volta à ordem padrão. Só a coluna ordenada leva `aria-sort` (o padrão do APG da W3C), e a tabela
 *   diz, por `aria-describedby`, que os títulos com botão ordenam.
 * - **Barra:** "Filtrar e ordenar (N)" abre o painel (botão com `aria-expanded`, o mesmo padrão de "mostrar e
 *   esconder"), "Limpar filtros", "Baixar CSV (filtrado)" e "Mostrando N de M", numa região viva educada que espera a
 *   digitação parar para falar. Com o painel fechado, os filtros ativos ficam à vista, cada um com o botão de tirar.
 * - **Painel:** um campo por coluna (texto; de/até para número e data; caixas para categoria) e a ordem num seletor,
 *   numa grade que, no celular, vira uma coluna só: nenhum campo empurra a página para o lado. Esc e "Fechar o painel"
 *   devolvem o foco ao botão que abriu.
 * - **CSV:** sai no navegador (Blob), só com as linhas que estão à vista e na ordem da tela, pelas regras de `paraCsv`.
 *
 * Telas públicas: `ordenavel: false` nas colunas de valor (sem ranking) e as linhas já em ordem alfabética, ou a
 * `ordemPadrao` numa coluna de nome.
 *
 * Integração da onda 15 (13/10/2026), para a fase 2:
 * - **Coluna oculta** (`oculta: true`): fica fora da tabela desenhada, mas aparece no painel, filtra, ordena e vai ao
 *   CSV. A primeira coluna VISÍVEL é o cabeçalho da linha.
 * - **Empilhar** (`empilhar`): a classe `mp-tabela-empilha` e o `data-rotulo` (o título da coluna) em cada célula, o
 *   padrão das tabelas de registro no celular (H07, `mapa.css`).
 * - **Impressão:** com filtro ou ordem escolhida, o papel diz qual ("Filtro aplicado: …"), porque sai só o filtrado.
 */
import { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  aplicar,
  chaveDoEstado,
  csvDaTabela,
  descreverFiltro,
  descreverOrdem,
  filtroAtivo,
  filtrosAtivos,
  formatarNumeroBr,
  gravarEstado,
  lerEstado,
  lerNumeroBr,
  nomeDoCsv,
  normalizarTexto,
  opcoesDaCategoria,
  proximaOrdem,
  textoDoValor,
  type ColunaTabela,
  type EstadoTabela,
  type FiltroColuna,
  type LinhaTabela,
  type Ordem,
} from "@/lib/oportunidades/tabela-filtro";
import { TabelaRolagem } from "./TabelaRolagem";

export interface PropsTabelaFiltravel {
  /** O prefixo no endereço (`?t.<id>.…`): só letras minúsculas, dígitos e hífen; único na página. */
  id: string;
  /** O nome acessível da tabela (e da região que rola). */
  rotulo: string;
  colunas: ColunaTabela[];
  /** Na ordem padrão da tela: o empate de qualquer ordem volta a ela. */
  linhas: LinhaTabela[];
  /** A ordem quando o endereço não diz nenhuma. Sem ela, a ordem em que as linhas chegaram. */
  ordemPadrao?: Ordem | null;
  /** Como a ordem padrão se diz, quando ela é a de chegada: "por grupo, tipo e nome". */
  descricaoOrdemPadrao?: string;
  /** Com ele, o botão "Baixar CSV (filtrado)" e o nome do arquivo. */
  csv?: { nome: string };
  /** No celular, cada linha vira um bloco com o rótulo de cada célula (`mp-tabela-empilha`). */
  empilhar?: boolean;
}

/** Espera entre a última tecla e a escrita no endereço, e entre a última mudança e a fala da região viva. */
const ESPERA_ENDERECO_MS = 350;
const ESPERA_ANUNCIO_MS = 400;

const fmt = (x: number) => x.toLocaleString("pt-BR");

function semFiltro(filtros: EstadoTabela["filtros"], coluna: string): EstadoTabela["filtros"] {
  const resto = { ...filtros };
  delete resto[coluna];
  return resto;
}

const mesmaOrdem = (a: Ordem | null | undefined, b: Ordem | null | undefined) =>
  !!a && !!b && a.coluna === b.coluna && a.sentido === b.sentido;

type Mudanca = (fn: (e: EstadoTabela) => EstadoTabela, opcoes?: { adiar?: boolean; recomecar?: boolean }) => void;

export function TabelaFiltravel({ id, rotulo, colunas, linhas, ordemPadrao = null, descricaoOrdemPadrao, csv, empilhar = false }: PropsTabelaFiltravel) {
  const sp = useSearchParams();
  const textoUrl = sp?.toString() ?? "";

  const [estado, setEstado] = useState<EstadoTabela>(() => lerEstado(id, colunas, new URLSearchParams(textoUrl)));
  /** Sobe para recomeçar os campos do painel (os rascunhos de número) quando o estado muda por fora deles. */
  const [versao, setVersao] = useState(0);
  const [urlVista, setUrlVista] = useState(textoUrl);
  /** As escritas desta tabela que o roteador ainda não devolveu pelo `useSearchParams`, na ordem. */
  const [emVoo, setEmVoo] = useState<string[]>([]);
  /** Há escrita esperando a digitação parar. */
  const [pendente, setPendente] = useState(false);
  const [aberto, setAberto] = useState(false);

  // O endereço mudou. Se é a volta de uma escrita nossa, só tira da fila; se é de fora (e nada nosso está em voo ou
  // esperando), ele manda: o estado vira o do endereço e os campos recomeçam. Ajuste de estado durante a renderização,
  // o padrão do React para "estado que depende de mudança de propriedade".
  if (textoUrl !== urlVista) {
    setUrlVista(textoUrl);
    const daUrl = lerEstado(id, colunas, new URLSearchParams(textoUrl));
    const chave = chaveDoEstado(id, daUrl);
    const k = emVoo.indexOf(chave);
    if (k >= 0) setEmVoo(emVoo.slice(k + 1));
    else if (emVoo.length > 0) setEmVoo([]);
    else if (!pendente && chave !== chaveDoEstado(id, estado)) {
      setEstado(daUrl);
      setVersao((v) => v + 1);
    }
  }

  const atual = useRef(estado);
  useEffect(() => {
    atual.current = estado;
  }, [estado]);

  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const r = relogio;
    return () => {
      if (r.current) clearTimeout(r.current);
    };
  }, []);

  /** Escreve no endereço o estado mais novo (não o de quando a escrita foi pedida). */
  const escreverAgora = useCallback(() => {
    if (relogio.current) {
      clearTimeout(relogio.current);
      relogio.current = null;
    }
    setPendente(false);
    const destino = gravarNoEndereco(id, atual.current);
    if (destino === null) return;
    const chave = chaveDoEstado(id, atual.current);
    setEmVoo((fila) => [...fila, chave].slice(-20));
    // `null` de propósito: com o estado interno do Next, o remendo dele não sincronizaria o `useSearchParams`.
    window.history.replaceState(null, "", destino);
  }, [id]);

  const mudar = useCallback<Mudanca>(
    (fn, opcoes = {}) => {
      const novo = fn(atual.current);
      atual.current = novo;
      setEstado(novo);
      if (opcoes.recomecar) setVersao((v) => v + 1);
      if (opcoes.adiar) {
        if (relogio.current) clearTimeout(relogio.current);
        setPendente(true);
        relogio.current = setTimeout(escreverAgora, ESPERA_ENDERECO_MS);
      } else escreverAgora();
    },
    [escreverAgora],
  );

  const botaoPainel = useRef<HTMLButtonElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  // Link com filtro ou ordem desta tabela, e a tabela dentro de um grupo fechado (`<details>`, como as propostas da
  // entidade e os documentos do laudo): o grupo abre, senão o link levava a um filtro invisível (integração da onda 15,
  // pedido do lote B). Só na chegada: fechar o grupo depois é escolha de quem lê.
  useEffect(() => {
    if (filtrosAtivos(atual.current) === 0 && !atual.current.ordem) return;
    const grupo = raiz.current?.closest("details");
    if (grupo && !grupo.open) grupo.open = true;
  }, []);
  const base = useId();
  const idPainel = `${base}-painel`;
  const idDica = `${base}-dica`;

  const ordemEfetiva = estado.ordem ?? ordemPadrao;
  // O campo responde na hora; a tabela (centenas de linhas) se redesenha logo depois, sem travar a digitação.
  const estadoAdiado = useDeferredValue(estado);
  const ordemAdiada = estadoAdiado.ordem ?? ordemPadrao;
  const visiveis = useMemo(
    () => aplicar(colunas, linhas, { filtros: estadoAdiado.filtros, ordem: ordemAdiada }),
    [colunas, linhas, estadoAdiado.filtros, ordemAdiada],
  );
  const nFiltros = filtrosAtivos(estado);
  const porId = useMemo(() => new Map(colunas.map((c) => [c.id, c])), [colunas]);
  const desenhadas = useMemo(() => colunas.filter((c) => !c.oculta), [colunas]);
  const algumaOrdena = desenhadas.some((c) => c.ordenavel !== false);

  // "Mostrando N de M" e a ordem, na região viva: muda na tela e fala quando a digitação para.
  const colunaDaOrdem = ordemEfetiva ? porId.get(ordemEfetiva.coluna) : undefined;
  const textoOrdem =
    colunaDaOrdem && ordemEfetiva && colunaDaOrdem.ordenavel !== false
      ? `Ordem: ${descreverOrdem(colunaDaOrdem, ordemEfetiva.sentido)}${estado.ordem ? "" : " (a padrão)"}.`
      : descricaoOrdemPadrao
        ? `Ordem padrão: ${descricaoOrdemPadrao}.`
        : "Ordem padrão.";
  const textoContagem = `Mostrando ${fmt(visiveis.length)} de ${fmt(linhas.length)}. ${textoOrdem}`;
  const [contagem, setContagem] = useState(textoContagem);
  useEffect(() => {
    if (contagem === textoContagem) return;
    const t = setTimeout(() => setContagem(textoContagem), ESPERA_ANUNCIO_MS);
    return () => clearTimeout(t);
  }, [contagem, textoContagem]);

  const devolverFoco = () => botaoPainel.current?.focus();

  // Sem `useCallback` manual (integração da onda 15): o React Compiler já memoriza, e a memorização à mão o fazia
  // desistir do componente inteiro ("Existing memoization could not be preserved").
  const limpar = () => {
    // O botão some quando não há filtro: o foco vai antes para o botão do painel, que fica.
    botaoPainel.current?.focus();
    mudar((e) => ({ ...e, filtros: {} }), { recomecar: true });
  };

  const ordenarPor = (coluna: string) => mudar((e) => ({ ...e, ordem: proximaOrdem(e.ordem, coluna, ordemPadrao) }));

  const baixarCsv = () => {
    if (!csv) return;
    const blob = new Blob([csvDaTabela(colunas, visiveis)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeDoCsv(csv.nome);
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Um instante antes de soltar: há navegador que só começa a baixar depois do clique.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const ativos = Object.entries(estado.filtros).flatMap(([c, f]) => {
    const coluna = porId.get(c);
    return coluna && filtroAtivo(f) ? [{ coluna, f }] : [];
  });

  return (
    <div className="mp-tf" ref={raiz}>
      <div className="mp-tf-barra mp-nao-imprimir">
        <button
          ref={botaoPainel}
          type="button"
          className="pa-btn mp-tf-abrir"
          aria-expanded={aberto}
          aria-controls={idPainel}
          onClick={() => setAberto((x) => !x)}
        >
          Filtrar e ordenar{nFiltros > 0 ? ` (${nFiltros})` : ""}
        </button>
        {nFiltros > 0 && (
          <button type="button" className="pa-btn" onClick={limpar}>
            Limpar filtros
          </button>
        )}
        {csv && (
          <button type="button" className="pa-btn" onClick={baixarCsv} disabled={visiveis.length === 0}>
            Baixar CSV (filtrado)
          </button>
        )}
        <p className="mp-tf-contagem" role="status" aria-live="polite">
          {contagem}
        </p>
      </div>

      <div id={idPainel} className="mp-tf-painel mp-nao-imprimir" hidden={!aberto}>
        {aberto && (
          <Painel
            key={versao}
            rotulo={rotulo}
            colunas={colunas}
            linhas={linhas}
            estado={estado}
            ordemPadrao={ordemPadrao}
            descricaoOrdemPadrao={descricaoOrdemPadrao}
            mudar={mudar}
            fechar={() => {
              setAberto(false);
              devolverFoco();
            }}
          />
        )}
      </div>

      {!aberto && ativos.length > 0 && (
        <ul className="mp-tf-ativos mp-nao-imprimir" aria-label="Filtros ativos">
          {ativos.map(({ coluna, f }) => (
            <li key={coluna.id}>
              <button
                type="button"
                className="pa-chip mp-tf-chip"
                onClick={() => {
                  devolverFoco();
                  mudar((e) => ({ ...e, filtros: semFiltro(e.filtros, coluna.id) }), { recomecar: true });
                }}
              >
                {descreverFiltro(coluna, f)}
                <span aria-hidden="true"> ×</span>
                <span className="pa-sr">, tirar este filtro</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(ativos.length > 0 || estado.ordem) && (
        <p className="mp-so-imprimir mp-tf-impresso">
          {ativos.length > 0 ? `Filtro aplicado: ${ativos.map(({ coluna, f }) => descreverFiltro(coluna, f)).join("; ")}. ` : ""}
          {textoContagem}
        </p>
      )}
      {algumaOrdena && (
        <p id={idDica} className="pa-sr">
          Os títulos com botão ordenam a tabela: o primeiro clique ordena de forma crescente, o segundo decrescente e o terceiro volta à
          ordem padrão.
        </p>
      )}
      <TabelaRolagem rotulo={rotulo}>
        <table
          className={`mp-tabela mp-tf-tabela${empilhar ? " mp-tabela-empilha" : ""}`}
          aria-label={rotulo}
          aria-describedby={algumaOrdena ? idDica : undefined}
        >
          <thead>
            <tr>
              {desenhadas.map((c) => {
                const ordena = c.ordenavel !== false;
                const sentido = ordena && ordemEfetiva?.coluna === c.id ? ordemEfetiva.sentido : null;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    className={c.alinhar === "direita" ? "mp-num" : undefined}
                    aria-sort={sentido ? (sentido === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {ordena ? (
                      <button type="button" className="mp-ordenar mp-tf-ordenar" onClick={() => ordenarPor(c.id)}>
                        {c.titulo}
                        <span aria-hidden="true" className={`mp-ordenar-seta${sentido ? " mp-ordenar-ativa" : ""}`}>
                          {sentido === "asc" ? "▲" : sentido === "desc" ? "▼" : "↕"}
                        </span>
                      </button>
                    ) : (
                      c.titulo
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <CorpoDaTabela colunas={desenhadas} linhas={visiveis} vazia={linhas.length === 0} comFiltro={nFiltros > 0} limpar={limpar} empilhar={empilhar} />
        </table>
      </TabelaRolagem>
    </div>
  );
}

/**
 * As linhas. À parte e memorizado: enquanto se digita, a renderização urgente (a do campo) não refaz as centenas de
 * linhas; só a adiada, com o resultado novo.
 */
const CorpoDaTabela = memo(function CorpoDaTabela({
  colunas,
  linhas,
  vazia,
  comFiltro,
  limpar,
  empilhar,
}: {
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  vazia: boolean;
  comFiltro: boolean;
  limpar: () => void;
  empilhar: boolean;
}) {
  return (
    <tbody>
      {linhas.length === 0 ? (
        <tr>
          <td colSpan={colunas.length} className="mp-tf-vazio">
            {vazia ? "Nenhuma linha nesta tabela." : "Nenhuma linha com estes filtros."}
            {comFiltro && (
              <>
                {" "}
                <button type="button" className="pa-btn pa-btn-pequeno" onClick={limpar}>
                  Limpar filtros
                </button>
              </>
            )}
          </td>
        </tr>
      ) : (
        linhas.map((l) => (
          <tr key={l.chave}>
            {colunas.map((c, i) => {
              const celula = l.celulas[c.id] !== undefined ? l.celulas[c.id] : textoDoValor(c, l.valores[c.id]);
              const classe = c.alinhar === "direita" ? "mp-num" : undefined;
              // A 1ª coluna que é código, número ou data (o número do convênio, por exemplo) não ganha a largura e o
              // negrito do nome: `mp-th-celula`, a classe do Mapa para esse caso (integração da onda 15, pedido do lote B).
              const leve = c.textoNoCsv || c.tipo === "numero" || c.tipo === "data";
              return i === 0 ? (
                <th key={c.id} scope="row" className={[classe, leve ? "mp-th-celula" : undefined].filter(Boolean).join(" ") || undefined}>
                  {celula}
                </th>
              ) : (
                <td key={c.id} className={classe} data-rotulo={empilhar ? c.titulo : undefined}>
                  {celula}
                </td>
              );
            })}
          </tr>
        ))
      )}
    </tbody>
  );
});

/** O endereço com o estado desta tabela, ou null se ele já está lá (a comparação é pela forma normalizada). */
function gravarNoEndereco(id: string, estado: EstadoTabela): string | null {
  const agora = new URLSearchParams(window.location.search);
  const novo = gravarEstado(id, estado, agora).toString();
  if (novo === agora.toString()) return null;
  return `${window.location.pathname}${novo ? `?${novo}` : ""}${window.location.hash}`;
}

// ================================================================ o painel

function Painel({
  rotulo,
  colunas,
  linhas,
  estado,
  ordemPadrao,
  descricaoOrdemPadrao,
  mudar,
  fechar,
}: {
  rotulo: string;
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  estado: EstadoTabela;
  ordemPadrao: Ordem | null;
  descricaoOrdemPadrao?: string;
  mudar: Mudanca;
  fechar: () => void;
}) {
  const base = useId();
  const filtraveis = colunas.filter((c) => c.filtravel !== false);
  const ordenaveis = colunas.filter((c) => c.ordenavel !== false);

  const mudarFiltro = (coluna: string, f: FiltroColuna | null, adiar = false) =>
    mudar((e) => ({ ...e, filtros: f && filtroAtivo(f) ? { ...e.filtros, [coluna]: f } : semFiltro(e.filtros, coluna) }), { adiar });

  const aoTeclar = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      fechar();
    }
  };

  const colunaPadrao = ordemPadrao ? colunas.find((c) => c.id === ordemPadrao.coluna) : undefined;
  const rotuloPadrao = colunaPadrao && ordemPadrao
    ? `Padrão: ${descreverOrdem(colunaPadrao, ordemPadrao.sentido)}`
    : descricaoOrdemPadrao
      ? `Padrão: ${descricaoOrdemPadrao}`
      : "Padrão";

  return (
    <div role="group" aria-label={`Filtrar e ordenar: ${rotulo}`} onKeyDown={aoTeclar}>
      {ordenaveis.length > 0 && (
        <div className="mp-tf-campo mp-tf-ordem">
          <label htmlFor={`${base}-ordem`} className="mp-tf-rotulo">
            Ordenar por
          </label>
          <select
            id={`${base}-ordem`}
            className="pa-select"
            value={estado.ordem ? `${estado.ordem.coluna}.${estado.ordem.sentido}` : ""}
            onChange={(ev) => {
              const [coluna, sentido] = ev.target.value.split(".");
              const escolhida: Ordem | null = coluna && (sentido === "asc" || sentido === "desc") ? { coluna, sentido } : null;
              mudar((e) => ({ ...e, ordem: mesmaOrdem(escolhida, ordemPadrao) ? null : escolhida }));
            }}
          >
            <option value="">{rotuloPadrao}</option>
            {ordenaveis.flatMap((c) =>
              (["asc", "desc"] as const).map((s) => (
                <option key={`${c.id}.${s}`} value={`${c.id}.${s}`}>
                  {descreverOrdem(c, s)}
                </option>
              )),
            )}
          </select>
        </div>
      )}
      <p className="mp-tf-dica">
        Os filtros valem juntos e a tabela muda enquanto você digita. Texto: as palavras em qualquer ordem, sem acento. Número como na tela
        (1.234,5, 350 mil ou 1,2 mi) e data, com os limites incluídos.
      </p>
      <div className="mp-tf-campos">
        {filtraveis.map((c) => {
          const idCampo = `${base}-${c.id}`;
          const f = estado.filtros[c.id];
          switch (c.tipo) {
            case "texto":
              return (
                <CampoTexto
                  key={c.id}
                  id={idCampo}
                  coluna={c}
                  valor={f?.tipo === "texto" ? f.contem : ""}
                  aoMudar={(t) => mudarFiltro(c.id, { tipo: "texto", contem: t }, true)}
                />
              );
            case "numero":
              return (
                <CampoNumero
                  key={c.id}
                  id={idCampo}
                  coluna={c}
                  inicial={f?.tipo === "numero" ? f : { de: null, ate: null }}
                  aoMudar={(de, ate) => mudarFiltro(c.id, { tipo: "numero", de, ate }, true)}
                />
              );
            case "data":
              return (
                <CampoData
                  key={c.id}
                  coluna={c}
                  valor={f?.tipo === "data" ? f : { de: null, ate: null }}
                  aoMudar={(de, ate) => mudarFiltro(c.id, { tipo: "data", de, ate })}
                />
              );
            case "categoria":
              return (
                <CampoCategoria
                  key={c.id}
                  id={idCampo}
                  coluna={c}
                  linhas={linhas}
                  escolhidas={f?.tipo === "categoria" ? f.valores : []}
                  aoMudar={(valores) => mudarFiltro(c.id, { tipo: "categoria", valores })}
                />
              );
            default:
              return null;
          }
        })}
      </div>
      <p className="mp-tf-rodape">
        <button type="button" className="pa-btn" onClick={fechar}>
          Fechar o painel
        </button>
      </p>
    </div>
  );
}

function CampoTexto({ id, coluna, valor, aoMudar }: { id: string; coluna: ColunaTabela; valor: string; aoMudar: (t: string) => void }) {
  return (
    <div className="mp-tf-campo">
      <label htmlFor={id} className="mp-tf-rotulo">
        {coluna.titulo}
      </label>
      {/* `type="text"`, e não `search`: no `search`, o Esc apaga o campo, e aqui ele fecha o painel. */}
      <input
        id={id}
        type="text"
        className="pa-input"
        value={valor}
        placeholder="contém…"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        onChange={(ev) => aoMudar(ev.target.value)}
      />
    </div>
  );
}

/**
 * De e até, com o rascunho do que se digita: "1.234," ainda não é número, e o campo não pode reescrever o que a pessoa
 * está digitando. Só o que se lê vai ao estado; o que não se lê fica marcado no campo e não muda a tabela.
 */
function CampoNumero({
  id,
  coluna,
  inicial,
  aoMudar,
}: {
  id: string;
  coluna: ColunaTabela;
  inicial: { de: number | null; ate: number | null };
  aoMudar: (de: number | null, ate: number | null) => void;
}) {
  const [de, setDe] = useState(inicial.de === null ? "" : formatarNumeroBr(inicial.de));
  const [ate, setAte] = useState(inicial.ate === null ? "" : formatarNumeroBr(inicial.ate));
  const ler = (t: string): number | null | undefined => (t.trim() === "" ? null : (lerNumeroBr(t) ?? undefined));
  const deLido = ler(de);
  const ateLido = ler(ate);
  const enviar = (deT: string, ateT: string) => {
    const d = ler(deT);
    const a = ler(ateT);
    if (d !== undefined && a !== undefined) aoMudar(d, a);
  };
  const idErro = `${id}-erro`;
  const invalido = deLido === undefined || ateLido === undefined;
  return (
    <fieldset className="mp-tf-campo">
      <legend className="mp-tf-rotulo">{coluna.titulo}</legend>
      <div className="mp-tf-intervalo">
        <label>
          <span>de</span>
          <input
            type="text"
            inputMode="decimal"
            className="pa-input"
            value={de}
            autoComplete="off"
            aria-invalid={deLido === undefined || undefined}
            aria-describedby={deLido === undefined ? idErro : undefined}
            onChange={(ev) => {
              setDe(ev.target.value);
              enviar(ev.target.value, ate);
            }}
          />
        </label>
        <label>
          <span>até</span>
          <input
            type="text"
            inputMode="decimal"
            className="pa-input"
            value={ate}
            autoComplete="off"
            aria-invalid={ateLido === undefined || undefined}
            aria-describedby={ateLido === undefined ? idErro : undefined}
            onChange={(ev) => {
              setAte(ev.target.value);
              enviar(de, ev.target.value);
            }}
          />
        </label>
      </div>
      {invalido && (
        <p id={idErro} className="mp-tf-erro">
          Número não reconhecido. Use 1.234,5, 350 mil ou 1,2 mi.
        </p>
      )}
    </fieldset>
  );
}

function CampoData({
  coluna,
  valor,
  aoMudar,
}: {
  coluna: ColunaTabela;
  valor: { de: string | null; ate: string | null };
  aoMudar: (de: string | null, ate: string | null) => void;
}) {
  // O campo de data só entrega a data inteira e válida, ou vazio: dá para seguir o estado direto, sem rascunho.
  return (
    <fieldset className="mp-tf-campo">
      <legend className="mp-tf-rotulo">{coluna.titulo}</legend>
      <div className="mp-tf-intervalo">
        <label>
          <span>de</span>
          <input
            type="date"
            className="pa-input"
            value={valor.de ?? ""}
            onChange={(ev) => aoMudar(ev.target.value || null, valor.ate)}
          />
        </label>
        <label>
          <span>até</span>
          <input
            type="date"
            className="pa-input"
            value={valor.ate ?? ""}
            onChange={(ev) => aoMudar(valor.de, ev.target.value || null)}
          />
        </label>
      </div>
    </fieldset>
  );
}

function CampoCategoria({
  id,
  coluna,
  linhas,
  escolhidas,
  aoMudar,
}: {
  id: string;
  coluna: ColunaTabela;
  linhas: LinhaTabela[];
  escolhidas: string[];
  aoMudar: (valores: string[]) => void;
}) {
  const opcoes = useMemo(() => {
    const conta = new Map<string, number>();
    for (const l of linhas) {
      const v = l.valores[coluna.id];
      if (v === null || v === undefined) continue;
      const s = String(v).trim();
      if (s) conta.set(s, (conta.get(s) ?? 0) + 1);
    }
    return opcoesDaCategoria(coluna.id, linhas).map((o) => ({ valor: o, linhas: conta.get(o) ?? 0 }));
  }, [coluna.id, linhas]);
  const marcadas = new Set(escolhidas.map(normalizarTexto));
  const conhecidas = new Set(opcoes.map((o) => normalizarTexto(o.valor)));
  // O que veio no endereço e não está em nenhuma linha também aparece, marcado, para poder ser desmarcado.
  const soNoEndereco = escolhidas.filter((v) => !conhecidas.has(normalizarTexto(v)));
  const todas = [...opcoes, ...soNoEndereco.map((v) => ({ valor: v, linhas: 0 }))];

  const alternar = (valor: string, marcar: boolean) => {
    const alvo = normalizarTexto(valor);
    const resto = escolhidas.filter((v) => normalizarTexto(v) !== alvo);
    aoMudar(marcar ? [...resto, valor] : resto);
  };

  return (
    <fieldset className="mp-tf-campo">
      <legend className="mp-tf-rotulo">{coluna.titulo}</legend>
      {todas.length === 0 ? (
        <p className="mp-tf-dica">Nenhuma opção nesta tabela.</p>
      ) : (
        <ul className="mp-tf-opcoes">
          {todas.map((o, i) => (
            <li key={o.valor}>
              <label className="pa-check" htmlFor={`${id}-${i}`}>
                <input
                  id={`${id}-${i}`}
                  type="checkbox"
                  checked={marcadas.has(normalizarTexto(o.valor))}
                  onChange={(ev) => alternar(o.valor, ev.target.checked)}
                />
                <span>
                  {o.valor} <span className="pa-chip-contagem">{fmt(o.linhas)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
