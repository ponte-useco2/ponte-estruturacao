"use client";

/**
 * Menu de conta do Mapa — sessão REAL.
 *
 * Substitui o `MenuPerfil` do protótipo, que lia um perfil fictício de
 * `_lib/fixtures` e cujo "sair" apenas limpava estado local em memória. Aqui o
 * que aparece vem do Supabase e o que sai, sai de verdade: `signOut` derruba o
 * cookie de sessão antes de navegar. Desde a onda 8, C (09/10/2026), o cookie da
 * organização ativa (`mapa_org`) sai junto (`esquecerOrganizacaoAoSair`).
 *
 * B12 (onda 2 de UX, 08/10/2026; achado A13 da auditoria B1+B2): é um disclosure, não um menu. O botão dizia
 * `aria-haspopup`, mas o painel é uma lista de links e botões que se percorre com Tab, sem setas: agora só
 * `aria-expanded` e `aria-controls`, e o painel fica no DOM, escondido (`hidden`), para o `aria-controls` sempre
 * apontar para algo. Esc fecha e devolve o foco ao botão (antes o painel desmontava com o foco dentro, que caía no
 * <body>). A organização ativa é texto com "(ativa)", não um botão desabilitado, que saía da ordem do Tab e calava
 * o `aria-current`.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ROTULO_AGENTE, type Organizacao } from "@/lib/oportunidades/organizacao";
import { destinoDoPublico, portaDoPublico, type SessaoPublica } from "@/lib/oportunidades/publico";
import { trocarOrganizacao } from "../conta/organizacao/acoes";
import { LinkMapa } from "./LinkMapa";
import { esquecerOrganizacaoAoSair } from "./esquecer-ao-sair";

function inicial(nome: string | null, email: string): string {
  const base = (nome ?? email).trim();
  return (base[0] ?? "?").toUpperCase();
}

/**
 * A conta de quem olha a versão pública (C4a, 09/10/2026; só existe com a chave `MAPA_PUBLICO` ligada): no lugar do
 * menu da conta, a porta — "Entrar" para o anônimo, com a volta para a página em que ele está; "Situação do cadastro"
 * para quem entrou e ainda não foi aprovado. As regras moram em `publico.ts`, com teste.
 *
 * É também a guarda da navegação dentro do Mapa. Trocar de página por link não roda o layout de novo, só a página
 * nova; se ela está fora da lista branca, a própria página (que confere o aprovado) não mostra nada, e esta guarda leva
 * à entrada ou à sala de espera, o mesmo destino que o layout daria num acesso direto. `replace`: o "voltar" do
 * navegador leva à página pública de antes, e não à que pede login.
 */
export function ContaPublica({ sessao }: { sessao: SessaoPublica }) {
  const pathname = usePathname() ?? "/mapa";
  const query = useSearchParams()?.toString() ?? "";
  const caminho = query ? `${pathname}?${query}` : pathname;
  const router = useRouter();
  const fora = destinoDoPublico(sessao, caminho);

  useEffect(() => {
    if (fora) router.replace(fora);
  }, [fora, router]);

  const porta = portaDoPublico(sessao, caminho);
  // 44 px de alvo, o mínimo do Mapa no celular (auditoria R1, 4.1; `pa-btn-pequeno` tinha 32).
  return (
    <LinkMapa href={porta.href} className="pa-btn pa-btn-primario" style={{ minHeight: 44 }}>
      {porta.rotulo}
    </LinkMapa>
  );
}

export function ContaMenu({
  email,
  nome,
  organizacoes,
  ativa,
}: {
  email: string;
  nome: string | null;
  organizacoes: Organizacao[];
  ativa: Organizacao | null;
}) {
  const pathname = usePathname() ?? "/mapa";

  // Guarda em QUAL rota o menu foi aberto: navegar muda o pathname e o menu
  // fecha sozinho, sem efeito que sincronize estado depois da renderização.
  // Padrão herdado do MenuPerfil do protótipo, que resolveu bem o problema.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === pathname;

  const [saindo, setSaindo] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  const painelId = useId();

  useEffect(() => {
    if (!aberto) return;
    const onClique = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setAbertoEm(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // O foco que estava no painel (ou no botão) volta ao botão; o que estava fora da conta fica onde está.
      const dentro = wrapRef.current?.contains(document.activeElement) ?? false;
      setAbertoEm(null);
      if (dentro) botaoRef.current?.focus();
    };
    document.addEventListener("mousedown", onClique);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClique);
      document.removeEventListener("keydown", onKey);
    };
  }, [aberto]);

  const sair = useCallback(async () => {
    if (saindo) return;
    setSaindo(true);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anon) {
      await createBrowserClient(url, anon).auth.signOut();
    }

    // Onda 8, C (09/10/2026; privacidade): o cookie da organização ativa sai junto com a sessão. Depois do `signOut`,
    // para o Next não ler a página inteira de novo (ver sair.ts); com erro ou demora, a saída segue (esquecer-ao-sair.ts).
    await esquecerOrganizacaoAoSair();

    // `window.location` e não `router.push`: a sessão vive em cookie lido pelo
    // servidor, e só uma navegação de documento inteiro garante que a próxima
    // resposta já venha sem ela. Com navegação de cliente, o cache do roteador
    // poderia servir uma tela ainda logada. Mesmo critério do `SairBotao` da
    // sala de espera, que já saía assim.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- sair precisa descartar o cache do roteador, não só navegar
    window.location.href = "/oportunidades/entrar";
  }, [saindo]);

  return (
    <div className="pa-menu-wrap pa-perfil-wrap" ref={wrapRef}>
      <button
        ref={botaoRef}
        type="button"
        className="pa-perfil-chip"
        aria-expanded={aberto}
        aria-controls={painelId}
        onClick={() => setAbertoEm(aberto ? null : pathname)}
        title={email}
        // Nome explícito, e não o conteúdo: no celular `pa-esconde-mobile` é
        // `display: none !important`, e o que sobra dentro do botão é a inicial
        // marcada como `aria-hidden`. Sem este rótulo, quem usa leitor de tela
        // no telefone ouve "botão" e mais nada. O mesmo vale para o chip de
        // perfil do protótipo, de onde este componente veio.
        aria-label={ativa ? `Conta e organização: ${ativa.nome}` : `Conta: ${email}`}
      >
        <span aria-hidden="true">{inicial(nome, email)}</span>
        {/* A entidade ativa vence o nome da pessoa no chip: quem cuida de várias
            precisa saber, de relance, em qual está trabalhando. O rótulo separa a
            organização da conta do município que a página está mostrando (revisão
            de 02/10/2026: lendo outro município, o cabeçalho parecia falar dele). */}
        <span className="pa-esconde-mobile mp-conta-nome">
          {ativa && <span className="mp-conta-rotulo">Sua organização</span>}
          <span className="mp-conta-entidade">{ativa?.nome ?? nome ?? email}</span>
        </span>
      </button>

      {/* Sempre no DOM, escondido quando fechado: `.pa-menu` não declara `display`, e o `hidden` vale. */}
      <div className="pa-menu" id={painelId} hidden={!aberto}>
        <p className="pa-mono pa-menu-grupo">Conta</p>
        <p className="mp-conta-email">{email}</p>

        <div className="pa-menu-sep" />
        <p className="pa-mono pa-menu-grupo">Organização</p>

        {organizacoes.length === 0 ? (
          <LinkMapa href="/mapa/conta/organizacao">Declarar a entidade</LinkMapa>
        ) : (
          <>
            {organizacoes.map((o) =>
              o.id === ativa?.id ? (
                // A ativa é texto: não há o que trocar, e o "(ativa)" à vista diz o que o realce diz.
                <p key={o.id} className="mp-org-botao" aria-current="true">
                  <span>{o.nome} (ativa)</span>
                  <span className="pa-espaco" />
                  <span className="mp-org-tipo">{ROTULO_AGENTE[o.tipo]}</span>
                </p>
              ) : (
                // Um formulário por entidade, e não um select: trocar é ação de
                // servidor (grava cookie e revalida), e assim funciona antes de
                // o JavaScript carregar.
                <form key={o.id} action={trocarOrganizacao} className="mp-org-troca">
                  <input type="hidden" name="organizacao_id" value={o.id} />
                  <button type="submit" className="mp-org-botao">
                    <span>
                      {o.nome}
                      <span className="pa-sr"> (trocar para esta)</span>
                    </span>
                    <span className="pa-espaco" />
                    <span className="mp-org-tipo">{ROTULO_AGENTE[o.tipo]}</span>
                  </button>
                </form>
              ),
            )}
            <LinkMapa href="/mapa/conta/organizacao">Acrescentar outra</LinkMapa>
          </>
        )}

        <div className="pa-menu-sep" />
        <Link prefetch={false} href="/privacidade">Aviso de privacidade</Link>
        <Link prefetch={false} href="/termos">Termos de uso</Link>

        <div className="pa-menu-sep" />
        <button type="button" className="pa-menu-sair" onClick={sair} disabled={saindo}>
          {saindo ? "Saindo…" : "Sair"}
        </button>
      </div>
    </div>
  );
}
