"use client";

/**
 * Shell B — abas horizontais por contexto.
 *
 * Substituiu o Shell C ("home por pergunta") em 21/08, por decisão do cliente.
 * O herói por pergunta NÃO foi descartado: ele continua sendo `HomeClient`, e
 * virou o destino da primeira aba, "Início". A diferença é que ele deixou de
 * ser a moldura e passou a ser um destino entre outros.
 *
 * Por que B e não C:
 *  · os contadores de sub-aba do wireframe 1b espelham `resumo` do contrato de
 *    oportunidades, que o front é proibido de recalcular — só B tem encaixe
 *    nativo para eles;
 *  · Descobrir (filtros 212px + lista), Construir (1fr 300px) e Grafo
 *    (1fr 288px) precisam de largura cheia;
 *  · abas horizontais são o mesmo modelo mental da tab bar do mobile (1l), em
 *    vez de exigirem metamorfose entre breakpoints.
 *
 * Custo assumido do Shell B, documentado no wireframe: Grafo e cadastro saem
 * do primeiro nível. Mitigado aqui — Grafo é a 6ª aba, e "meus dados" mudou-se
 * para o menu do chip de perfil.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SessaoProvider, useSessao } from "../_lib/sessao";
import { perfilPor } from "../_lib/fixtures";
import { Conversa } from "./Conversa";

const BASE = "/plataforma/app";

/** Os 4 ambientes — usados nas abas e na tab bar do mobile. */
const AMBIENTES = [
  { num: "01", nome: "Descobrir", href: `${BASE}/descobrir` },
  { num: "02", nome: "Apresentar", href: `${BASE}/apresentar` },
  { num: "03", nome: "Compor", href: `${BASE}/compor` },
  { num: "04", nome: "Construir", href: `${BASE}/construir` },
];

/** Abas de primeiro nível. Início é o herói do 1c; Grafo fecha a fila. */
const ABAS = [
  { nome: "Início", href: BASE, exata: true },
  ...AMBIENTES.map((a) => ({ nome: a.nome, href: a.href, num: a.num, exata: false })),
  { nome: "Grafo", href: `${BASE}/grafo`, exata: false },
] as const;

function ehAtual(pathname: string, href: string, exata: boolean): boolean {
  return exata ? pathname === href : pathname.startsWith(href);
}

/**
 * Menu do chip de perfil. Recebe o que o dropdown "Ambientes ▾" do Shell C
 * carregava e as abas não comportam: meus dados, trocar perfil, sair.
 */
function MenuPerfil({ pathname }: { pathname: string }) {
  // Guarda em QUAL rota o menu foi aberto. Navegar muda o pathname e o menu
  // fecha sozinho, sem efeito que sincronize estado depois da renderização.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === pathname;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { sessao, limpar } = useSessao();
  const router = useRouter();
  const perfil = perfilPor(sessao?.perfil);

  useEffect(() => {
    if (!aberto) return;
    const onClique = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setAbertoEm(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbertoEm(null);
    };
    document.addEventListener("mousedown", onClique);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClique);
      document.removeEventListener("keydown", onKey);
    };
  }, [aberto]);

  const sair = useCallback(() => {
    limpar();
    router.push("/plataforma");
  }, [limpar, router]);

  return (
    <div className="pa-menu-wrap pa-perfil-wrap" ref={wrapRef}>
      <button
        type="button"
        className="pa-perfil-chip"
        aria-expanded={aberto}
        aria-haspopup="true"
        onClick={() => setAbertoEm(aberto ? null : pathname)}
        title={`Perfil declarado: ${perfil.nome}`}
      >
        <span aria-hidden="true">{perfil.numero}</span>
        <span className="pa-esconde-mobile">{perfil.curto}</span>
      </button>

      {aberto && (
        <div className="pa-menu">
          <p className="pa-mono pa-menu-grupo">Meus dados</p>
          <Link href={BASE} aria-current={pathname === BASE ? "page" : undefined}>
            Meus projetos
          </Link>
          <Link
            href={`${BASE}/grafo`}
            aria-current={pathname.startsWith(`${BASE}/grafo`) ? "page" : undefined}
          >
            O Grafo
          </Link>

          <div className="pa-menu-sep" />
          <Link href={`${BASE}/onboarding`}>Trocar perfil</Link>
          <button type="button" className="pa-menu-sair" onClick={sair}>
            Sair do protótipo
          </button>
        </div>
      )}
    </div>
  );
}

function Moldura({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? BASE;
  const { sessao } = useSessao();
  const [conversa, setConversa] = useState(false);
  const noOnboarding = pathname.startsWith(`${BASE}/onboarding`);

  return (
    <div className="pa-root">
      <p className="pa-aviso-proto">
        <strong>Protótipo</strong>
        <span>
          Dados de projeto são ilustrativos · sem login real · sessão apagada ao fechar a aba ·
        </span>
        <Link href="/plataforma">voltar à apresentação</Link>
      </p>

      <header className="pa-top">
        {/* Linha 1 — identidade e ações */}
        <div className="pa-top-inner">
          <Link href={BASE} className="pa-marca">
            <span className="pa-marca-selo" aria-hidden="true">
              P
            </span>
            <span className="pa-marca-nome">
              PONTE <strong>Projetos</strong>
            </span>
          </Link>

          <div className="pa-espaco" />

          {!noOnboarding && (
            <>
              <button
                type="button"
                className={`pa-icone-botao pa-esconde-mobile${conversa ? " pa-ativo" : ""}`}
                onClick={() => setConversa(true)}
                aria-label="Abrir modo conversa por áudio"
              >
                voz
              </button>

              {sessao?.concluido && <MenuPerfil pathname={pathname} />}
            </>
          )}
        </div>

        {/* Linha 2 — abas de primeiro nível */}
        {!noOnboarding && (
          <nav className="pa-abas" aria-label="Ambientes">
            {ABAS.map((aba) => {
              const atual = ehAtual(pathname, aba.href, aba.exata);
              return (
                <Link
                  key={aba.href}
                  href={aba.href}
                  className="pa-aba"
                  aria-current={atual ? "page" : undefined}
                >
                  {"num" in aba && <span className="pa-aba-num">{aba.num}</span>}
                  {aba.nome}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="pa-main">{children}</main>

      {!noOnboarding && (
        <>
          {/* Tab bar do mobile (1l) — só os 4 ambientes, alvos ≥44px. */}
          <nav className="pa-bottom" aria-label="Ambientes">
            {AMBIENTES.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                aria-current={pathname.startsWith(a.href) ? "page" : undefined}
              >
                <span className="pa-bottom-num">{a.num}</span>
                {a.nome}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            className="pa-fab"
            onClick={() => setConversa(true)}
            aria-label="Abrir modo conversa por áudio"
          >
            voz
          </button>

          <Conversa aberta={conversa} onFechar={() => setConversa(false)} />
        </>
      )}
    </div>
  );
}

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <SessaoProvider>
      <Moldura>{children}</Moldura>
    </SessaoProvider>
  );
}
