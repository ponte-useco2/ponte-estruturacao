"use client";

/**
 * Mapa de Oportunidades — a central de notificações do app logado.
 *
 * Mora aqui, e não na /oportunidades, porque o app logado já lê o catálogo, usa
 * o mesmo portão de aprovação e é declarado no contrato como a evolução do
 * painel. Por isso fala a língua visual do app (--pa-*, Plus Jakarta), e não a da
 * página pública — que, de quebra, tem um texto fraco que reprova no contraste.
 *
 * O que decide o que a tela pode afirmar — ordem, contagem, vazio — está em
 * lib/oportunidades/central.ts, coberto por teste. Este arquivo cuida de
 * interação e acessibilidade, onde a revisão do protótipo achou os problemas
 * mais graves: foco perdido depois de ação em massa, anúncio que o leitor de tela
 * não lia, e a barra de ações aparecendo do nada e empurrando a lista.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TipoMudanca } from "@/lib/oportunidades/diff";
import {
  HORAS_DADO_VELHO,
  ROTULO_TIPO,
  contarNaoLidas,
  contarPorTipo,
  descrever,
  filtrar,
  formatarData,
  formatarPublicacao,
  frescorDoDado,
  mensagemVazio,
  ordenarPorUrgencia,
  type Aba,
  type ItemCentral,
} from "@/lib/oportunidades/central";
import type { LeituraCentral, TentativaFalha } from "@/lib/oportunidades/notificacoes.server";
import { Tag } from "../../_design/primitivos";
import { TRANSFEREGOV_CONSULTA } from "@/lib/oportunidades/transferegov";
import { copiarTexto } from "@/lib/area-de-transferencia";
import { subtemasDe } from "@/lib/oportunidades/temas";
import { motivoDaCombinacao, type Preferencias } from "@/lib/oportunidades/aderencia";
import type { OpcoesPreferencia } from "@/lib/oportunidades/opcoes";
import { PreferenciasPainel, type Eixo } from "../PreferenciasPainel";
import {
  agruparPorPrazo,
  codigosDaChave,
  indiceDivisor,
  type ResumoCatalogo,
} from "@/lib/oportunidades/central";
import {
  alternarPreferencia,
  arquivar,
  desarquivar,
  limparPreferencias,
  marcarLidas,
  marcarNaoLidas,
  type ResultadoAcao,
} from "../acoes";

type Acao = "lida" | "naoLida" | "arquivar" | "desarquivar";

const EXECUTAR: Record<Acao, (ids: string[]) => Promise<ResultadoAcao>> = {
  lida: marcarLidas,
  naoLida: marcarNaoLidas,
  arquivar,
  desarquivar,
};

const INVERSA: Record<Acao, Acao> = {
  lida: "naoLida",
  naoLida: "lida",
  arquivar: "desarquivar",
  desarquivar: "arquivar",
};

/**
 * Só os itens em que a ação muda algo. É o que torna o desfazer exato: ele
 * reverte essas linhas, e não as que já estavam no estado final antes.
 */
const AFETA: Record<Acao, (i: ItemCentral) => boolean> = {
  lida: (i) => !i.lida_em,
  naoLida: (i) => Boolean(i.lida_em),
  arquivar: (i) => !i.arquivada_em,
  desarquivar: (i) => Boolean(i.arquivada_em),
};

function textoFeito(acao: Acao, n: number): string {
  const s = n === 1 ? "" : "s";
  const textos: Record<Acao, string> = {
    lida: `${n} marcada${s} como lida${s}.`,
    naoLida: `${n} marcada${s} como não lida${s}.`,
    arquivar: `${n} arquivada${s}.`,
    desarquivar: `${n} desarquivada${s}.`,
  };
  return textos[acao];
}

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "nao_lidas", rotulo: "Não lidas" },
  { id: "todas", rotulo: "Todas" },
  { id: "arquivadas", rotulo: "Arquivadas" },
];

type Tom = NonNullable<Parameters<typeof Tag>[0]["tom"]>;

/** A cor de perigo é só para prazo correndo. No protótipo ela marcava também "não lida" e diluía a urgência. */
const TOM: Record<TipoMudanca, Tom> = {
  fechando: "urgente",
  prazo_alterado: "proto",
  removida: "proto",
  nova: "nova",
  reaberta: "nova",
  situacao_mudou: "neutro",
  encerrada: "neutro",
};

const ROTULO_PRAZO: Record<TipoMudanca, string> = {
  fechando: "Fecha",
  prazo_alterado: "Fecha",
  removida: "Prazo era",
  nova: "Fecha",
  reaberta: "Fecha",
  situacao_mudou: "Fecha",
  encerrada: "Fechou em",
};

const TIPOS_EM_ORDEM = Object.keys(ROTULO_TIPO) as TipoMudanca[];


export function MapaClient({
  central,
  pendente,
  agoraIso,
  preferencias,
  opcoes,
  resumoCatalogo,
  visitaAnterior,
  tentativas,
}: {
  central: LeituraCentral;
  pendente: boolean;
  agoraIso: string;
  preferencias: Preferencias;
  opcoes: OpcoesPreferencia;
  resumoCatalogo: ResumoCatalogo | null;
  visitaAnterior: string | null;
  tentativas: TentativaFalha[];
}) {
  if (central.status === "nao_ativada") return <NaoAtivada />;
  if (central.status === "erro") return <ErroLeitura />;
  return (
    <Central
      itens={central.itens}
      truncada={central.truncada}
      ultimaProcessada={central.ultimaProcessada}
      pendente={pendente}
      agoraIso={agoraIso}
      preferencias={preferencias}
      opcoes={opcoes}
      resumoCatalogo={resumoCatalogo}
      visitaAnterior={visitaAnterior}
      tentativas={tentativas}
    />
  );
}

function NaoAtivada() {
  return (
    <div className="pa-pagina">
      <div className="pa-cartao pa-pilha">
        <p className="pa-kicker">Mapa de Oportunidades</p>
        <h1 className="pa-titulo">A central de notificações ainda não foi ativada</h1>
        <p>
          As tabelas que guardam o que mudou no catálogo ainda não existem no banco. Até lá nada é
          registrado — e esta tela não vai fingir que está tudo em dia.
        </p>
        <p>As janelas abertas continuam disponíveis no painel de oportunidades.</p>
        <div className="pa-linha">
          <Link href="/oportunidades" className="pa-btn">
            Ver as janelas abertas
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErroLeitura() {
  const router = useRouter();
  return (
    <div className="pa-pagina">
      <div className="pa-cartao pa-pilha">
        <p className="pa-kicker">Mapa de Oportunidades</p>
        <h1 className="pa-titulo">Não foi possível carregar as notificações</h1>
        <p>A falha foi na leitura. Nada foi apagado, e o que estava marcado continua marcado.</p>
        <div className="pa-linha">
          <button type="button" className="pa-btn" onClick={() => router.refresh()}>
            Tentar de novo
          </button>
        </div>
      </div>
    </div>
  );
}

function Central({
  itens,
  truncada,
  ultimaProcessada,
  pendente,
  agoraIso,
  preferencias,
  opcoes,
  resumoCatalogo,
  visitaAnterior,
  tentativas,
}: {
  itens: ItemCentral[];
  truncada: boolean;
  ultimaProcessada: string | null;
  pendente: boolean;
  agoraIso: string;
  preferencias: Preferencias;
  opcoes: OpcoesPreferencia;
  resumoCatalogo: ResumoCatalogo | null;
  visitaAnterior: string | null;
  tentativas: TentativaFalha[];
}) {
  const [aba, setAba] = useState<Aba>("nao_lidas");
  const [tipos, setTipos] = useState<TipoMudanca[]>([]);
  const [selecionadas, setSelecionadas] = useState<ReadonlySet<string>>(() => new Set());
  const [desfazer, setDesfazer] = useState<{ acao: Acao; ids: string[]; texto: string } | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  // A escolha aparece na hora e a lista se reorganiza junto; se o servidor
  // recusar, volta ao que era e a tela diz que não salvou. Fingir que salvou
  // seria o "sucesso aparente" que o brief proíbe.
  const [prefs, setPrefs] = useState<Preferencias>(preferencias);
  // Detalhe abre no lugar, um por vez: abrir em página nova tiraria a pessoa da
  // fila que ela veio ver.
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [gruposAbertos, setGruposAbertos] = useState<ReadonlySet<string>>(() => new Set());
  // "Ver só essas" do destaque de prazo: recorte, não alarme novo.
  const [soCurto, setSoCurto] = useState(false);
  const [salvando, iniciarTransicao] = useTransition();

  /**
   * Marcar Inovação REVELA dez verticais na coluna de temas. Quem enxerga vê
   * a lista crescer; quem usa leitor de tela não veria nada — o anúncio é o que
   * torna a revelação perceptível para os dois. Achado na auditoria de
   * acessibilidade de 12/09/2026, no mesmo dia em que o subfiltro entrou.
   */
  function anuncioDePreferencia(eixo: Eixo, valor: string, rotulo: string, marcado: boolean): string {
    const base = `${rotulo} ${marcado ? "marcado" : "desmarcado"}.`;
    if (eixo !== "temas") return base;

    const filhos = subtemasDe(valor).length;
    if (filhos === 0) return base;

    return marcado
      ? `${base} ${filhos} assuntos específicos de ${rotulo} ficaram disponíveis na lista.`
      : `${base} Os ${filhos} assuntos específicos de ${rotulo} saíram da lista.`;
  }

  function alternarPreferenciaLocal(eixo: Eixo, valor: string, marcado: boolean, rotulo: string) {
    const anterior = prefs;
    const conjunto = new Set(prefs[eixo]);
    if (marcado) conjunto.add(valor);
    else conjunto.delete(valor);
    setPrefs({ ...prefs, [eixo]: [...conjunto] });
    setErro(null);

    iniciarTransicao(async () => {
      const r = await alternarPreferencia(eixo, valor, marcado);
      if (!r.ok) {
        setPrefs(anterior);
        setErro(r.erro ?? "Não foi possível salvar.");
        return;
      }
      setAnuncio(anuncioDePreferencia(eixo, valor, rotulo, marcado));
    });
  }

  function limparPreferenciasLocal() {
    const anterior = prefs;
    setPrefs({ temas: [], orgaos: [], naturezas: [] });
    setErro(null);

    iniciarTransicao(async () => {
      const r = await limparPreferencias();
      if (!r.ok) {
        setPrefs(anterior);
        setErro(r.erro ?? "Não foi possível salvar.");
        return;
      }
      setAnuncio("Preferências apagadas.");
    });
  }

  const refTodas = useRef<HTMLInputElement>(null);
  const refDesfazer = useRef<HTMLButtonElement>(null);
  const refTitulo = useRef<HTMLHeadingElement>(null);

  const frescor = useMemo(() => frescorDoDado(ultimaProcessada, new Date(agoraIso)), [ultimaProcessada, agoraIso]);
  const limiteCurto = useMemo(() => {
    const d = new Date(agoraIso);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [agoraIso]);

  const visiveis = useMemo(() => {
    const base = ordenarPorUrgencia(filtrar(itens, aba, tipos));
    return soCurto ? base.filter((i) => i.fecha <= limiteCurto) : base;
  }, [itens, aba, tipos, soCurto, limiteCurto]);

  const grupos = useMemo(() => agruparPorPrazo(visiveis, new Date(agoraIso)), [visiveis, agoraIso]);
  const porTipo = useMemo(() => contarPorTipo(itens, aba), [itens, aba]);
  const porAba: Record<Aba, number> = {
    nao_lidas: contarNaoLidas(itens),
    todas: filtrar(itens, "todas", []).length,
    arquivadas: filtrar(itens, "arquivadas", []).length,
  };

  // A seleção vale só para o que está na tela: o que saiu dela, por ação ou por
  // filtro, deixa de contar — sem precisar de efeito que sincronize estado.
  const selecionadasVisiveis = visiveis.filter((i) => selecionadas.has(i.id));
  const todas = visiveis.length > 0 && selecionadasVisiveis.length === visiveis.length;
  const algumas = selecionadasVisiveis.length > 0 && !todas;
  const nenhuma = selecionadasVisiveis.length === 0;

  useEffect(() => {
    if (refTodas.current) refTodas.current.indeterminate = algumas;
  }, [algumas]);

  // Depois de uma ação em massa, o foco vai para "Desfazer". É o próximo passo
  // provável, e sem isto o foco caía no <body> quando a seleção sumia da tela.
  useEffect(() => {
    if (desfazer) refDesfazer.current?.focus();
  }, [desfazer]);

  function focarRetorno() {
    const caixa = refTodas.current;
    (caixa && !caixa.disabled ? caixa : refTitulo.current)?.focus();
  }

  function limparSelecao(motivo: string) {
    if (selecionadas.size === 0) return;
    setSelecionadas(new Set());
    setAnuncio(motivo);
  }

  function trocarAba(nova: Aba) {
    setAba(nova);
    limparSelecao("Seleção limpa ao trocar de aba.");
  }

  function alternarTipo(t: TipoMudanca) {
    setTipos((atual) => (atual.includes(t) ? atual.filter((x) => x !== t) : [...atual, t]));
    limparSelecao("Seleção limpa ao mudar o filtro.");
  }

  async function copiarCodigo(codigos: string[]) {
    // `copiarTexto`, e não `navigator.clipboard` direto: a API assíncrona sozinha
    // foi recusada pelo navegador nas Janelas em 14/09/2026.
    if (await copiarTexto(codigos.join(" "))) {
      setAnuncio(codigos.length === 1 ? "Código copiado." : "Códigos copiados.");
    } else {
      // Sem permissão de área de transferência o código continua na tela para
      // selecionar à mão — dizer que copiou sem ter copiado seria mentira.
      setAnuncio("Não consegui copiar. O código está aí ao lado, dá para selecionar.");
    }
  }

  function alternarSelecao(id: string) {
    setSelecionadas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(id)) proxima.delete(id);
      else proxima.add(id);
      return proxima;
    });
  }

  function alternarTodas() {
    setSelecionadas(todas ? new Set() : new Set(visiveis.map((i) => i.id)));
  }

  function aplicar(acao: Acao, ids: string[], desfazendo: boolean) {
    setErro(null);
    iniciarTransicao(async () => {
      const r = await EXECUTAR[acao](ids);
      if (!r.ok) {
        const mensagem = r.erro ?? "Não foi possível salvar.";
        setErro(mensagem);
        setAnuncio(mensagem);
        return;
      }
      setSelecionadas(new Set());
      const texto = textoFeito(acao, ids.length);
      if (desfazendo) {
        setDesfazer(null);
        setAnuncio(`Desfeito. ${texto}`);
        focarRetorno();
      } else {
        // Sem prazo para sumir: um aviso de desfazer que expira sozinho é um
        // limite de tempo que nem todo mundo consegue cumprir.
        setDesfazer({ acao, ids, texto });
        setAnuncio(texto);
      }
    });
  }

  function agir(acao: Acao, alvo: ItemCentral[]) {
    if (salvando) return;
    const ids = alvo.filter(AFETA[acao]).map((i) => i.id);
    if (ids.length === 0) {
      setAnuncio("Nada a alterar nessa seleção.");
      return;
    }
    aplicar(acao, ids, false);
  }

  function fecharDesfazer() {
    setDesfazer(null);
    focarRetorno();
  }

  function botaoLote(acao: Acao, rotulo: string) {
    // `aria-disabled`, e não `disabled`: o botão continua na ordem de tabulação e
    // o leitor de tela diz por que não pode ser usado, em vez de ele sumir.
    const inativo = nenhuma || salvando || !selecionadasVisiveis.some(AFETA[acao]);
    return (
      <button
        type="button"
        className="pa-btn pa-btn-pequeno"
        aria-disabled={inativo}
        onClick={() => {
          if (!inativo) agir(acao, selecionadasVisiveis);
        }}
      >
        {rotulo}
      </button>
    );
  }

  const vazio = mensagemVazio({ aba, filtrando: tipos.length > 0, frescor, publicadoEm: ultimaProcessada });
  const tiposNaAba = TIPOS_EM_ORDEM.filter((t) => (porTipo[t] ?? 0) > 0 || tipos.includes(t));

  const rotuloSelecionar =
    visiveis.length === 0
      ? "Nada para selecionar"
      : visiveis.length === 1
        ? "Selecionar a visível"
        : `Selecionar as ${visiveis.length} visíveis`;

  const rotuloSelecionadas = nenhuma
    ? "Nenhuma selecionada"
    : selecionadasVisiveis.length === 1
      ? "1 selecionada"
      : `${selecionadasVisiveis.length} selecionadas`;

  return (
    <div className="pa-pagina pa-mapa">
      {/* Sempre presente, e só o texto muda: região viva que entra no DOM já com
          conteúdo costuma não ser lida. */}
      <p className="pa-sr" role="status" aria-atomic="true">
        {anuncio}
      </p>

      <div className="pa-pagina-cabeca">
        <div className="pa-pilha">
          <p className="pa-kicker">Mapa de Oportunidades</p>
          <h1 className="pa-titulo" ref={refTitulo} tabIndex={-1}>
            O que mudou no catálogo
          </h1>
          <p className="pa-sub">
            {porAba.nao_lidas === 1 ? "1 notificação não lida" : `${porAba.nao_lidas} notificações não lidas`}
            {ultimaProcessada ? ` · catálogo processado em ${formatarPublicacao(ultimaProcessada)}` : ""}
            {resumoCatalogo ? ` · ${resumoCatalogo.total} janelas abertas` : ""}
          </p>
        </div>

        {/* Único destaque em cor de perigo na tela: o resumo do primeiro grupo de
            prazo. Não é alarme novo — é o mesmo dado, dito uma vez. */}
        {resumoCatalogo && resumoCatalogo.fecham7 > 0 && (
          <aside className="pa-cartao pa-mapa-urgente">
            <span className="pa-mono">Prazo correndo</span>
            <strong>
              {resumoCatalogo.fecham7} {resumoCatalogo.fecham7 === 1 ? "janela fecha" : "janelas fecham"} até{" "}
              {formatarData(resumoCatalogo.ate)}
            </strong>
            <button
              type="button"
              className="pa-mapa-urgente-link"
              aria-pressed={soCurto}
              onClick={() => {
                setSoCurto((v) => !v);
                limparSelecao(soCurto ? "Recorte de prazo removido." : "Mostrando só o que fecha nesta semana.");
              }}
            >
              {soCurto ? "Mostrar todos os prazos" : "Ver só essas"}
            </button>
          </aside>
        )}
      </div>

      {pendente && (
        <p className="pa-origem">
          <Tag tom="proto">Atualizando</Tag>
          <span>
            Há uma publicação nova do catálogo sendo processada agora. Recarregue a página em instantes
            para ver o que mudou.
          </span>
        </p>
      )}

      {!pendente && frescor.estado === "velho" && (
        <p className="pa-origem">
          <Tag tom="proto">Dado antigo</Tag>
          <span>
            Não conseguimos ler o catálogo desde {formatarPublicacao(ultimaProcessada ?? "")}, há mais de{" "}
            {HORAS_DADO_VELHO} horas. Janelas podem ter aberto, mudado de prazo ou fechado sem aparecer aqui.
            {tentativas.length > 0 && (
              <>
                {" "}
                {tentativas.length === 1 ? "A tentativa de " : "As tentativas de "}
                {tentativas.map((t) => formatarPublicacao(t.quando)).join(" e ")}
                {tentativas.length === 1 ? " falhou." : " falharam."}
              </>
            )}
          </span>
        </p>
      )}

      {truncada && (
        <p className="pa-nota">Mostrando as 500 notificações mais recentes. As anteriores continuam guardadas.</p>
      )}

      {erro && (
        <p className="pa-origem" role="alert">
          <Tag tom="proto">Não salvou</Tag>
          <span>{erro}</span>
        </p>
      )}

      <PreferenciasPainel
        preferencias={prefs}
        opcoes={opcoes}
        resumo={resumoCatalogo}
        salvando={salvando}
        onAlternar={alternarPreferenciaLocal}
        onLimpar={limparPreferenciasLocal}
      />

      <div className="pa-mapa-controles">
        <fieldset className="pa-fieldset">
          <legend className="pa-mono">Mostrar</legend>
          {/* Escolha exclusiva é rádio, não botão com aria-pressed: o leitor de tela
              anuncia a opção marcada, e as setas do teclado já funcionam. */}
          <div className="pa-chips">
            {ABAS.map((a) => (
              <label key={a.id} className={`pa-chip${aba === a.id ? " pa-ativo" : ""}`}>
                <input
                  type="radio"
                  name="mapa-aba"
                  value={a.id}
                  className="pa-sr"
                  checked={aba === a.id}
                  onChange={() => trocarAba(a.id)}
                />
                {a.rotulo}
                <span className="pa-chip-contagem">
                  <span className="pa-sr">, </span>
                  {porAba[a.id]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {tiposNaAba.length > 0 && (
          <fieldset className="pa-fieldset">
            <legend className="pa-mono">Tipo</legend>
            <div className="pa-chips">
              {tiposNaAba.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="pa-chip"
                  aria-pressed={tipos.includes(t)}
                  onClick={() => alternarTipo(t)}
                >
                  {ROTULO_TIPO[t]}
                  <span className="pa-chip-contagem">
                    <span className="pa-sr">, </span>
                    {porTipo[t] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      {/* Altura reservada enquanto houver lista: aparecer só com seleção empurrava
          a lista para baixo do cursor. Com a fila vazia ela some — a linha "Nada
          para selecionar" ocupava 56 px para não dizer nada. */}
      {visiveis.length > 0 && (
      <div className="pa-cartao-plano pa-mapa-lote">
        <label className="pa-check pa-mapa-selecao">
          <input
            ref={refTodas}
            type="checkbox"
            checked={todas}
            disabled={visiveis.length === 0}
            onChange={alternarTodas}
          />
          <span>{rotuloSelecionar}</span>
        </label>
        <span className="pa-mono">{rotuloSelecionadas}</span>
        <span className="pa-espaco" />
        {aba === "arquivadas" ? (
          botaoLote("desarquivar", "Desarquivar")
        ) : (
          <>
            {botaoLote("lida", "Marcar como lidas")}
            {aba === "todas" && botaoLote("naoLida", "Marcar como não lidas")}
            {botaoLote("arquivar", "Arquivar")}
          </>
        )}
      </div>
      )}

      {desfazer && (
        <div className="pa-escuro pa-mapa-desfazer">
          <span>{desfazer.texto}</span>
          <span className="pa-espaco" />
          <button
            ref={refDesfazer}
            type="button"
            className="pa-btn pa-btn-pequeno"
            aria-disabled={salvando}
            onClick={() => {
              if (!salvando) aplicar(INVERSA[desfazer.acao], desfazer.ids, true);
            }}
          >
            Desfazer
          </button>
          <button type="button" className="pa-btn pa-btn-pequeno" onClick={fecharDesfazer}>
            Fechar aviso
          </button>
        </div>
      )}

      {visiveis.length === 0 ? (
        <div className="pa-cartao pa-pilha">
          <h2 className="pa-mapa-vazio-titulo">{vazio.titulo}</h2>
          <p>{vazio.texto}</p>
          {/* O vazio deixa de ser beco: as janelas abertas continuam lá, e a tela
              oferece as saídas que existem. */}
          {resumoCatalogo && (
            <p className="pa-mono">
              As {resumoCatalogo.total} janelas abertas continuam no painel — o que acabou foi a fila de avisos.
            </p>
          )}
          <div className="pa-linha">
            {resumoCatalogo && resumoCatalogo.fecham7 > 0 && !soCurto && (
              <button type="button" className="pa-btn pa-btn-pequeno" onClick={() => setSoCurto(true)}>
                Ver as {resumoCatalogo.fecham7} que fecham até {formatarData(resumoCatalogo.ate)}
              </button>
            )}
            {aba !== "todas" && (
              <button type="button" className="pa-btn pa-btn-pequeno" onClick={() => trocarAba("todas")}>
                Ver todas
              </button>
            )}
            {aba !== "arquivadas" && (
              <button type="button" className="pa-btn pa-btn-pequeno" onClick={() => trocarAba("arquivadas")}>
                Ver arquivadas
              </button>
            )}
            <Link href="/oportunidades" className="pa-btn pa-btn-pequeno">
              Ver as janelas abertas
            </Link>
          </div>
        </div>
      ) : (
        grupos.map((g) => {
          const recolhido = g.recolhido && !gruposAbertos.has(g.id);
          if (recolhido) {
            return (
              <div key={g.id} className="pa-tracejado pa-linha pa-mapa-grupo-recolhido">
                <h2 className="pa-mapa-grupo-titulo">{g.titulo}</h2>
                <span className="pa-mono">
                  {g.itens.length} {g.itens.length === 1 ? "aviso" : "avisos"} · {g.naoLidas} não lidas
                </span>
                <span className="pa-espaco" />
                <button
                  type="button"
                  className="pa-btn pa-btn-pequeno"
                  onClick={() => setGruposAbertos((a) => new Set([...a, g.id]))}
                >
                  Mostrar grupo
                </button>
              </div>
            );
          }

          return (
            <section key={g.id} className="pa-mapa-grupo" aria-label={g.titulo}>
              <div className="pa-linha pa-mapa-grupo-cabeca">
                <h2 className="pa-mapa-grupo-titulo">{g.titulo}</h2>
                <span className="pa-mono">
                  {g.itens.length} {g.itens.length === 1 ? "aviso" : "avisos"}
                </span>
                <span className="pa-espaco" />
                <span className="pa-mono">{g.naoLidas} não lidas</span>
              </div>

              <ul className="pa-pilha" aria-label={g.titulo}>
                {g.itens.map((i, indice) => {
                  const divisor = indice === indiceDivisor(g.itens, visitaAnterior);
                  const naoLida = !i.lida_em;
                  // O destaque diz POR QUE combina. Selo sem motivo vira enfeite.
                  const combinacao = motivoDaCombinacao(i, prefs);
                  const urgente = g.id === "ate7";
                  const aberto = detalhe === i.id;
                  const codigos = codigosDaChave(i.chave);
                  const acaoLinha: Acao = aba === "arquivadas" ? "desarquivar" : naoLida ? "lida" : "naoLida";
                  const rotuloLinha =
                    aba === "arquivadas" ? "Desarquivar" : naoLida ? "Marcar como lida" : "Marcar como não lida";
                  return (
                    <li key={i.id}>
                      {/* A divisória só existe quando ajuda: com item novo acima e
                          item anterior à visita abaixo. */}
                      {divisor && visitaAnterior && (
                        <div className="pa-linha pa-mapa-divisor">
                          <span className="pa-mapa-divisor-traco pa-mapa-divisor-forte" />
                          <span className="pa-mono">↑ desde a sua última visita · {formatarPublicacao(visitaAnterior)}</span>
                          <span className="pa-mapa-divisor-traco" />
                        </div>
                      )}
                      <article className={`pa-cartao pa-mapa-item${naoLida ? " pa-mapa-nao-lida" : ""}`}>
                        <label className="pa-check pa-mapa-selecao">
                          <input
                            type="checkbox"
                            checked={selecionadas.has(i.id)}
                            onChange={() => alternarSelecao(i.id)}
                          />
                          <span className="pa-sr">Selecionar: {i.programa}</span>
                        </label>

                        <div className="pa-mapa-item-corpo">
                          <div className="pa-linha">
                            <Tag tom={TOM[i.tipo]}>{ROTULO_TIPO[i.tipo]}</Tag>
                            {/* Ponto na cor da marca MAIS rótulo: não lida não pode
                                depender de peso de fonte nem de cor sozinha. */}
                            {naoLida && (
                              <span className="pa-linha pa-mapa-nao-lida-rotulo">
                                <span className="pa-mapa-marca-nao-lida" />
                                <span className="pa-mono">não lida</span>
                              </span>
                            )}
                          </div>

                          <h3 className="pa-oportunidade-titulo">{i.programa}</h3>

                          <div className="pa-linha pa-mapa-meta">
                            <span className="pa-mono">{i.orgao}</span>
                            {i.publicado_em && (
                              <span className="pa-mono">publicado {formatarPublicacao(i.publicado_em)}</span>
                            )}
                            {combinacao && (
                              <span className="pa-tag pa-tag-aderente pa-mapa-combina">Combina: {combinacao}</span>
                            )}
                          </div>

                          <p className="pa-mapa-descricao">{descrever(i)}</p>

                          {aberto && (
                            <div className="pa-cartao-plano pa-mapa-detalhe">
                              <div className="pa-linha">
                                <span className="pa-campo-rotulo">
                                  {codigos.length === 1 ? "Código do programa" : "Códigos do programa"}
                                </span>
                                <code className="pa-mapa-codigo">{codigos.join(" · ") || "—"}</code>
                                {codigos.length > 0 && (
                                  <button
                                    type="button"
                                    className="pa-btn pa-btn-pequeno"
                                    onClick={() => copiarCodigo(codigos)}
                                  >
                                    Copiar código
                                  </button>
                                )}
                                <a
                                  className="pa-btn pa-btn-pequeno"
                                  href={TRANSFEREGOV_CONSULTA}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Abrir consulta no Transferegov
                                </a>
                              </div>
                              <span className="pa-mono">
                                O Transferegov não tem endereço por programa: a consulta abre e o código é colado lá.
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pa-oportunidade-lado">
                          <strong className={urgente ? "pa-mapa-prazo-urgente" : "pa-mapa-prazo"}>
                            {ROTULO_PRAZO[i.tipo]} {formatarData(i.fecha)}
                          </strong>
                          <div className="pa-linha">
                            <button
                              type="button"
                              className="pa-btn pa-btn-pequeno"
                              aria-expanded={aberto}
                              onClick={() => setDetalhe(aberto ? null : i.id)}
                            >
                              {aberto ? "Fechar" : "Detalhes"}
                            </button>
                            <button
                              type="button"
                              className="pa-btn pa-btn-pequeno"
                              aria-disabled={salvando}
                              aria-label={`${rotuloLinha}: ${i.programa}`}
                              onClick={() => {
                                if (!salvando) agir(acaoLinha, [i]);
                              }}
                            >
                              {rotuloLinha}
                            </button>
                          </div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
