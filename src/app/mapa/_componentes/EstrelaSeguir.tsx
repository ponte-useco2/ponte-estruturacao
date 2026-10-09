"use client";

/**
 * A estrela de seguir um item — janela, convênio, proposta, município, entidade — e o aviso que confirma a mudança.
 *
 * Muda na hora e volta se o servidor recusar, dizendo por quê: fingir que seguiu sem ter gravado deixaria a pessoa
 * esperando um aviso que nunca viria.
 *
 * B8 (teste de 08/10/2026): na carteira a pessoa apertou a estrela de outro item (compacta, sem nome à vista),
 * seguiu outra janela sem querer e não tinha como voltar atrás. Por isso o item está no nome acessível e na dica
 * (title), a marca não depende só de cor (☆/★ e o texto) e cada mudança confirma com o nome do item e um
 * "Desfazer" por uns 10 s. Os textos saem de `rotuloEstrela` (favoritos.ts), onde são testados.
 *
 * O aviso mora num estado do módulo, e não dentro da estrela: na carteira e em Meus itens, deixar de seguir revalida
 * a página e o item SAI da lista — a estrela desmonta, e o "Desfazer" sumiria com ela. Essas telas montam um
 * <AvisoSeguir />, que sobrevive à lista; onde não há um, a própria estrela mostra o aviso.
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition, type FocusEvent, type KeyboardEvent, type MouseEvent, type Ref } from "react";
import { rotuloEstrela, type TipoItem } from "@/lib/oportunidades/favoritos";
import { deixarDeSeguir, seguir } from "../acoes";
import { largarAVez, tomarAVez } from "./aviso-da-vez";
import "./estrela.css";

/** Quanto o aviso fica à vista. O relógio para enquanto o ponteiro ou o foco estão nele. */
const DURACAO_AVISO = 10_000;
/** Até quanto depois do clique a estrela que sumiu com o foco ainda passa o foco ao aviso. */
const JANELA_FOCO = 15_000;

interface Aviso {
  /** Muda a cada mudança: a mesma frase duas vezes seguidas é outro aviso. */
  id: number;
  /** A estrela que fez a mudança (`useId`): sem <AvisoSeguir /> na página, é ela que mostra o aviso. */
  origem: string;
  tipo: TipoItem;
  chave: string;
  nome: string;
  /** O estado do item depois da mudança. */
  seguindo: boolean;
  texto: string;
  /** Depois de desfazer, o botão vira "Fechar": ida e volta sem fim confunde mais do que ajuda. */
  podeDesfazer: boolean;
  desfazendo: boolean;
}

type NovoAviso = Omit<Aviso, "id" | "desfazendo">;

/* ---------------------------------------------------------------------------------------------------------------
   O estado do módulo. Só muda em evento (clique, relógio, montagem), nunca na renderização: no servidor fica vazio.
   --------------------------------------------------------------------------------------------------------------- */

let aviso: Aviso | null = null;
let sequencia = 0;
let regioes = 0;
let relogio: ReturnType<typeof setTimeout> | null = null;
let focarAviso: (() => void) | null = null;
/** O último clique numa estrela: a que desmonta logo depois, com o foco, foi tirada da lista pela revalidação. */
let ultimoClique: { origem: string; quando: number } | null = null;
/** A estrela que sumiu com o foco antes de o aviso dela chegar. */
let focoPerdido: string | null = null;
const ouvintes = new Set<() => void>();
const ouvintesItem = new Set<(tipo: TipoItem, chave: string, seguindo: boolean) => void>();

function emitir() {
  for (const f of ouvintes) f();
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

const haRegiao = () => regioes > 0;
const semRegiao = () => false;
const semAviso = () => null;

function pausar() {
  if (relogio) clearTimeout(relogio);
  relogio = null;
}

function fechar() {
  pausar();
  aviso = null;
  largarAVez(fechar);
  emitir();
}

function armar() {
  pausar();
  const id = aviso?.id;
  if (id === undefined) return;
  relogio = setTimeout(() => {
    if (aviso?.id === id) fechar();
  }, DURACAO_AVISO);
}

function publicar(novo: NovoAviso) {
  // Onda 8, C (09/10/2026; N20 da auditoria R1): um aviso por vez no pé da janela. O de "Marcar como lidas", se estava
  // à vista, fecha (`aviso-da-vez.ts`).
  tomarAVez(fechar);
  aviso = { ...novo, id: ++sequencia, desfazendo: false };
  armar();
  emitir();
  const perdido = focoPerdido;
  focoPerdido = null;
  if (perdido === novo.origem) focarAviso?.();
}

/** Avisa as estrelas do item: a carteira mostra o mesmo item duas vezes, e o "Desfazer" muda o estado de fora. */
function mudou(tipo: TipoItem, chave: string, seguindo: boolean) {
  for (const f of ouvintesItem) f(tipo, chave, seguindo);
}

async function desfazer() {
  const a = aviso;
  if (!a || !a.podeDesfazer || a.desfazendo) return;
  aviso = { ...a, desfazendo: true };
  emitir();
  const r = a.seguindo ? await deixarDeSeguir(a.tipo, a.chave) : await seguir(a.tipo, a.chave);
  if (r.ok) mudou(a.tipo, a.chave, !a.seguindo);
  publicar({
    origem: a.origem,
    tipo: a.tipo,
    chave: a.chave,
    nome: a.nome,
    seguindo: r.ok ? !a.seguindo : a.seguindo,
    // A janela que já saiu do catálogo não volta a ser seguida (`seguir` relê o catálogo): o servidor diz isso.
    texto: r.ok ? rotuloEstrela(a.tipo, a.nome, !a.seguindo).desfeito : `Não foi possível desfazer. ${r.erro ?? "Tente de novo."}`,
    podeDesfazer: !r.ok,
  });
}

/* ---------------------------------------------------------------------------------------------------------------
   O aviso à vista. A região viva fica sempre no DOM, vazia sem aviso: só o texto muda, para o leitor de tela ler.
   Tudo em <span>: a estrela mora dentro de <p> e de <th>.
   --------------------------------------------------------------------------------------------------------------- */

function CaixaDoAviso({ a, refBotao }: { a: Aviso | null; refBotao?: Ref<HTMLButtonElement> }) {
  function retomarAoSairPonteiro(e: MouseEvent<HTMLSpanElement>) {
    if (!e.currentTarget.contains(document.activeElement)) armar();
  }
  function retomarAoSairFoco(e: FocusEvent<HTMLSpanElement>) {
    const dentro = e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget);
    if (!dentro && !e.currentTarget.matches(":hover")) armar();
  }
  function teclado(e: KeyboardEvent<HTMLSpanElement>) {
    if (e.key === "Escape" && a) fechar();
  }
  return (
    <span
      className={`mp-seguir-aviso${a ? " mp-seguir-aviso-ativo" : ""}`}
      onMouseEnter={pausar}
      onMouseLeave={retomarAoSairPonteiro}
      onFocus={pausar}
      onBlur={retomarAoSairFoco}
      onKeyDown={teclado}
    >
      <span className="mp-seguir-aviso-texto" role="status" aria-live="polite" aria-atomic="true">
        {a?.texto ?? ""}
      </span>
      {a && (
        <button
          ref={refBotao}
          type="button"
          className="pa-btn pa-btn-pequeno"
          aria-disabled={a.desfazendo}
          onClick={a.podeDesfazer ? desfazer : fechar}
        >
          {a.podeDesfazer ? (
            <>
              Desfazer<span className="pa-sr">: {rotuloEstrela(a.tipo, a.nome, a.seguindo).desfazer}</span>
            </>
          ) : (
            "Fechar"
          )}
        </button>
      )}
    </span>
  );
}

/**
 * O aviso da estrela para as telas em que o item sai da lista ao deixar de ser seguido (carteira, Meus itens).
 * Fixo no rodapé da janela; com ele montado, as estrelas da página não mostram aviso próprio. Um por página.
 */
export function AvisoSeguir() {
  const a = useSyncExternalStore(assinar, () => aviso, semAviso);
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    regioes += 1;
    // Depois de o aviso novo aparecer: o botão só existe na renderização seguinte.
    focarAviso = () => requestAnimationFrame(() => botao.current?.focus());
    emitir();
    return () => {
      regioes -= 1;
      focarAviso = null;
      emitir();
    };
  }, []);
  return <CaixaDoAviso a={a} refBotao={botao} />;
}

export function EstrelaSeguir({
  tipo,
  chave,
  nome,
  seguindo: inicial,
  compacta = false,
}: {
  tipo: TipoItem;
  chave: string;
  /** O item como as frases o dizem: "o convênio nº 956541", "a janela X" (ou só "X": o tipo entra na frente). */
  nome: string;
  seguindo: boolean;
  /**
   * Só a estrela, para linhas de tabela apertadas: o texto e o item ficam no leitor de tela e na dica. O que a
   * estrela cheia faz passa a depender do title, que o toque não mostra; prefira a estrela com texto.
   */
  compacta?: boolean;
}) {
  const origem = useId();
  const [seguindo, setSeguindo] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const temRegiao = useSyncExternalStore(assinar, haRegiao, semRegiao);
  const meuAviso = useSyncExternalStore(assinar, () => (aviso?.origem === origem ? aviso : null), semAviso);
  const rotulo = rotuloEstrela(tipo, nome, seguindo);

  // O "Desfazer" do aviso e a outra estrela do mesmo item mudam o estado desta.
  useEffect(() => {
    const ouvir = (t: TipoItem, c: string, s: boolean) => {
      if (t === tipo && c === chave) setSeguindo(s);
    };
    ouvintesItem.add(ouvir);
    return () => {
      ouvintesItem.delete(ouvir);
    };
  }, [tipo, chave]);

  // Deixar de seguir na carteira tira o item da lista, e com ele esta estrela: o foco cairia no <body>.
  // Vai para o "Desfazer" do aviso da página, como no mural depois de arquivar.
  useEffect(
    () => () => {
      const recente = ultimoClique?.origem === origem && Date.now() - ultimoClique.quando < JANELA_FOCO;
      const ativo = document.activeElement;
      if (!recente || (ativo && ativo !== document.body)) return;
      if (aviso?.origem === origem) focarAviso?.();
      else focoPerdido = origem;
    },
    [origem],
  );

  function alternar() {
    if (salvando) return;
    const proximo = !seguindo;
    ultimoClique = { origem, quando: Date.now() };
    setSeguindo(proximo);
    setErro(null);
    iniciar(async () => {
      const r = proximo ? await seguir(tipo, chave) : await deixarDeSeguir(tipo, chave);
      if (!r.ok) {
        setSeguindo(!proximo);
        setErro(r.erro ?? "Não foi possível salvar.");
        return;
      }
      mudou(tipo, chave, proximo);
      publicar({ origem, tipo, chave, nome, seguindo: proximo, texto: rotuloEstrela(tipo, nome, proximo).confirmacao, podeDesfazer: true });
    });
  }

  return (
    <span className="mp-estrela-caixa">
      <button
        type="button"
        className={`mp-estrela${seguindo ? " mp-estrela-ativa" : ""}${compacta ? " mp-estrela-compacta" : ""}`}
        aria-pressed={seguindo}
        aria-disabled={salvando}
        // A dica diz o que o clique faz, com o item: "Deixar de seguir a janela X". Não é o único lugar que diz:
        // o title não aparece no toque nem no foco, e por isso as telas usam a estrela com texto onde dá.
        title={rotulo.acao}
        onClick={alternar}
      >
        <span aria-hidden="true">{rotulo.icone}</span>
        {/* O nome é o texto à vista e o item em texto oculto ("Seguindo a janela X"): começa pelo que se vê, para
            quem comanda por voz (WCAG 2.5.3). O estado vai em aria-pressed. */}
        <span className={compacta ? "pa-sr" : undefined}>{rotulo.visivel}</span>
        <span className="pa-sr"> {rotulo.item}</span>
      </button>
      <span className="pa-sr" role="status">
        {erro ?? ""}
      </span>
      {erro && (
        <span className="mp-estrela-erro" aria-hidden="true">
          {erro}
        </span>
      )}
      {!temRegiao && <CaixaDoAviso a={meuAviso} />}
    </span>
  );
}
