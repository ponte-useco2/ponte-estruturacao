"use client";

/**
 * Sessão do protótipo — sem login real.
 *
 * Decisão deliberada: `sessionStorage`, não `localStorage`. O perfil declarado
 * some quando a aba fecha, o que mantém o protótipo coerente com o aviso de
 * privacidade da página pública (que promete não persistir dado pessoal no
 * navegador). Nada aqui identifica pessoa: perfil, interesse, um primeiro nome
 * opcional, território e setor.
 *
 * A leitura é exposta por `useSyncExternalStore` em vez de `useEffect` +
 * `setState`: o sessionStorage é uma fonte externa, e o React já sabe ler fonte
 * externa sem render em cascata. O snapshot de servidor é `null`, então a
 * hidratação bate com o HTML que o servidor produziu.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { PerfilId, Sessao } from "./tipos";
import { PERFIS } from "./fixtures";

const CHAVE = "ponte.plataforma.prototipo.sessao";

interface Contexto {
  /** `null` = ainda no servidor/hidratando, ou nenhum perfil declarado. */
  sessao: Sessao | null;
  /** false enquanto o componente ainda não montou no cliente. */
  carregada: boolean;
  salvar: (parcial: Partial<Sessao>) => void;
  limpar: () => void;
}

const SessaoContext = createContext<Contexto | null>(null);

function ehPerfil(v: unknown): v is PerfilId {
  return typeof v === "string" && PERFIS.some((p) => p.id === v);
}

function ler(): Sessao | null {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE);
    if (!bruto) return null;
    const d = JSON.parse(bruto) as Partial<Sessao>;
    if (!ehPerfil(d.perfil)) return null;
    return {
      perfil: d.perfil,
      interesse: typeof d.interesse === "string" ? d.interesse : "",
      nome: typeof d.nome === "string" ? d.nome : "",
      territorio: typeof d.territorio === "string" ? d.territorio : "",
      setor: typeof d.setor === "string" ? d.setor : "",
      concluido: d.concluido === true,
    };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ store
// Cache de módulo: `getSnapshot` precisa devolver a MESMA referência enquanto
// nada mudar, senão o React entra em loop de renderização.

let cache: Sessao | null = null;
let lido = false;
const ouvintes = new Set<() => void>();

function inscrever(cb: () => void) {
  ouvintes.add(cb);
  return () => {
    ouvintes.delete(cb);
  };
}

function snapshot(): Sessao | null {
  if (!lido) {
    cache = ler();
    lido = true;
  }
  return cache;
}

const snapshotServidor = (): Sessao | null => null;

function publicar(proxima: Sessao | null) {
  cache = proxima;
  lido = true;
  ouvintes.forEach((f) => f());
}

const semInscricao = () => () => {};
const montado = () => true;
const naoMontado = () => false;

// ------------------------------------------------------------------ provider

export function SessaoProvider({ children }: { children: ReactNode }) {
  const sessao = useSyncExternalStore(inscrever, snapshot, snapshotServidor);
  const carregada = useSyncExternalStore(semInscricao, montado, naoMontado);

  const salvar = useCallback((parcial: Partial<Sessao>) => {
    const base: Sessao = snapshot() ?? {
      perfil: "empresa",
      interesse: "",
      nome: "",
      territorio: "",
      setor: "",
      concluido: false,
    };
    const proxima = { ...base, ...parcial };
    try {
      window.sessionStorage.setItem(CHAVE, JSON.stringify(proxima));
    } catch {
      /* modo privado / storage bloqueado: o app segue só em memória */
    }
    publicar(proxima);
  }, []);

  const limpar = useCallback(() => {
    try {
      window.sessionStorage.removeItem(CHAVE);
    } catch {
      /* idem */
    }
    publicar(null);
  }, []);

  const valor = useMemo(
    () => ({ sessao, carregada, salvar, limpar }),
    [sessao, carregada, salvar, limpar],
  );

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}

export function useSessao(): Contexto {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error("useSessao precisa estar dentro de <SessaoProvider>.");
  return ctx;
}

/**
 * Usada pelas telas internas: manda pro onboarding quem ainda não declarou
 * perfil. Devolve `null` enquanto carrega ou redireciona, para a tela poder
 * exibir um esqueleto em vez de renderizar com dados vazios.
 */
export function useSessaoObrigatoria(): Sessao | null {
  const { sessao, carregada } = useSessao();
  const router = useRouter();

  const precisaOnboarding = carregada && (!sessao || !sessao.concluido);
  useEffect(() => {
    if (precisaOnboarding) router.replace("/plataforma/app/onboarding");
  }, [precisaOnboarding, router]);

  return sessao?.concluido ? sessao : null;
}
