"use client";

/**
 * Marca como lidas as mudanças mostradas. A carteira recarrega e elas saem de "O que mudou".
 *
 * B12 (onda 2 de UX, 08/10/2026; achados H09 e A20 da auditoria B1+B2): o gesto não tinha volta, e o mesmo gesto em
 * Avisos tem. Agora confirma com "N avisos marcados como lidos." e um "Desfazer" (`marcarItensNaoLidos`), por uns 10 s,
 * com o mesmo aviso fixo no pé da janela que a estrela usa na carteira. As regiões vivas existem desde o começo, vazias:
 * o leitor de tela só anuncia mudança em região que já estava na tela.
 *
 * O aviso mora num estado do módulo, como o da estrela (`EstrelaSeguir`): marcar tira o item de "O que mudou", e o
 * botão dele some junto; o "Marcar tudo como lido" do topo também some quando não sobra nada para ler. Quem mostra o
 * aviso é a primeira instância montada, a do topo, que fica na página mesmo sem nada para marcar.
 */
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from "react";
import { marcarItensLidos, marcarItensNaoLidos } from "../acoes";
import { largarAVez, tomarAVez } from "../_componentes/aviso-da-vez";
import "../_componentes/estrela.css";
import "./marcar-lidas.css";

/** Quanto o aviso fica à vista. O relógio para enquanto o ponteiro ou o foco estão nele. */
const DURACAO_AVISO = 10_000;

interface Aviso {
  id: number;
  ids: string[];
  texto: string;
  /** Depois de desfazer, o botão vira "Fechar": ida e volta sem fim confunde mais do que ajuda. */
  podeDesfazer: boolean;
  desfazendo: boolean;
}

/** "1 aviso marcado como lido.", "3 avisos marcados como não lidos." — as mesmas frases de Avisos. */
function textoMarcados(n: number, lidos: boolean): string {
  const avisos = n === 1 ? "1 aviso" : `${n} avisos`;
  const verbo = n === 1 ? (lidos ? "marcado como lido" : "marcado como não lido") : lidos ? "marcados como lidos" : "marcados como não lidos";
  return `${avisos} ${verbo}.`;
}

/* ---------------------------------------------------------------------------------------------------------------
   O estado do módulo. Só muda em evento (clique, relógio, montagem), nunca na renderização: no servidor fica vazio.
   --------------------------------------------------------------------------------------------------------------- */

let aviso: Aviso | null = null;
let sequencia = 0;
let relogio: ReturnType<typeof setTimeout> | null = null;
/** As instâncias montadas, na ordem em que montaram: a primeira mostra o aviso. */
let montadas: string[] = [];
let focarAviso: (() => void) | null = null;
const ouvintes = new Set<() => void>();

function emitir() {
  for (const f of ouvintes) f();
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

const semAviso = () => null;
const naoDono = () => false;

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

function publicar(novo: Omit<Aviso, "id" | "desfazendo">) {
  // Onda 8, C (09/10/2026; N20 da auditoria R1): um aviso por vez no pé da janela. O da estrela, se estava à vista,
  // fecha, e este aparece sozinho no lugar dele (`aviso-da-vez.ts`).
  tomarAVez(fechar);
  aviso = { ...novo, id: ++sequencia, desfazendo: false };
  armar();
  emitir();
}

async function desfazer(recarregar: () => void) {
  const a = aviso;
  if (!a || !a.podeDesfazer || a.desfazendo) return;
  aviso = { ...a, desfazendo: true };
  emitir();
  const r = await marcarItensNaoLidos(a.ids);
  if (r.ok) recarregar();
  publicar({
    ids: a.ids,
    texto: r.ok ? `Desfeito: ${textoMarcados(a.ids.length, false)}` : `Não foi possível desfazer. ${r.erro ?? "Tente de novo."}`,
    podeDesfazer: !r.ok,
  });
}

/* ---------------------------------------------------------------------------------------------------------------
   O aviso à vista: a mesma caixa da estrela (estrela.css). Sem aviso, só a região viva fica no DOM, sem caixa.
   --------------------------------------------------------------------------------------------------------------- */

function CaixaDoAviso({ a, refBotao, aoDesfazer }: { a: Aviso | null; refBotao: Ref<HTMLButtonElement>; aoDesfazer: () => void }) {
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
        <button ref={refBotao} type="button" className="pa-btn pa-btn-pequeno" aria-disabled={a.desfazendo} onClick={a.podeDesfazer ? aoDesfazer : fechar}>
          {a.podeDesfazer ? (
            <>
              Desfazer<span className="pa-sr">: voltar {a.ids.length === 1 ? "o aviso" : `os ${a.ids.length} avisos`} a não lidos</span>
            </>
          ) : (
            "Fechar"
          )}
        </button>
      )}
    </span>
  );
}

export function MarcarLidas({ ids, rotulo = "Marcar como lidas" }: { ids: string[]; rotulo?: string }) {
  const router = useRouter();
  const eu = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const dono = useSyncExternalStore(assinar, () => montadas[0] === eu, naoDono);
  const a = useSyncExternalStore(assinar, () => aviso, semAviso);
  const botaoAviso = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    montadas = [...montadas, eu];
    emitir();
    return () => {
      montadas = montadas.filter((x) => x !== eu);
      // Saiu da carteira: o aviso não reaparece na próxima visita.
      if (montadas.length === 0) {
        pausar();
        aviso = null;
        largarAVez(fechar);
      }
      emitir();
    };
  }, [eu]);

  // O botão some com a lista (item lido sai de "O que mudou"): o foco iria para o <body>. Vai para o "Desfazer".
  useEffect(() => {
    if (!dono) return;
    focarAviso = () => requestAnimationFrame(() => botaoAviso.current?.focus());
    return () => {
      focarAviso = null;
    };
  }, [dono]);

  function marcar() {
    if (salvando) return;
    setErro(null);
    iniciar(async () => {
      const r = await marcarItensLidos(ids);
      if (!r.ok) {
        setErro(r.erro ?? "Não foi possível marcar.");
        return;
      }
      publicar({ ids, texto: textoMarcados(ids.length, true), podeDesfazer: true });
      focarAviso?.();
      router.refresh();
    });
  }

  return (
    // Sem nada para marcar, a do topo fica só com as regiões vivas, sem ocupar lugar na linha dos botões.
    <span className={ids.length ? "mp-cart-marcar" : "mp-cart-marcar-vazio"}>
      {ids.length > 0 && (
        <button type="button" className="pa-btn pa-btn-pequeno" disabled={salvando} onClick={marcar}>
          {salvando ? "Marcando…" : rotulo}
        </button>
      )}
      <span className="pa-sr" role="status">
        {erro ?? ""}
      </span>
      {erro && (
        <span className="pa-nota" aria-hidden="true">
          {erro}
        </span>
      )}
      {dono && <CaixaDoAviso a={a} refBotao={botaoAviso} aoDesfazer={() => void desfazer(() => router.refresh())} />}
    </span>
  );
}
