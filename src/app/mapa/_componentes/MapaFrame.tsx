import type { ReactNode } from "react";
import Link from "next/link";
import { ContaMenu } from "./ContaMenu";

/**
 * Moldura do Mapa de Oportunidades — o produto, não o protótipo.
 *
 * O Mapa nasceu como aba dentro de `/plataforma/app`, cuja moldura imprime
 * "Protótipo · Dados de projeto são ilustrativos · sem login real · sessão
 * apagada ao fechar a aba". Sobre o Mapa as três afirmações eram falsas: ele é
 * a única superfície com login real, RLS, dado oficial e cron. A faixa saiu
 * junto com o que a sustentava — `SessaoProvider` e o perfil de fixtures, o FAB
 * de voz e o `Conversa`, que responde com texto roteirizado.
 *
 * É componente de SERVIDOR: sem abas, nada aqui depende de `usePathname`. Só o
 * menu de conta é cliente, porque abre, fecha e encerra sessão.
 */
export function MapaFrame({
  children,
  email,
  nome,
}: {
  children: ReactNode;
  email: string;
  nome: string | null;
}) {
  return (
    // `pa-root` é a raiz do design system: declara os alias de token e o reset.
    // `mp-root` ajusta o que é desta moldura — ver mapa.css.
    <div className="pa-root mp-root">
      <header className="pa-top">
        <div className="pa-top-inner">
          <Link href="/mapa" className="pa-marca">
            <span className="pa-marca-selo" aria-hidden="true">
              P
            </span>
            <span className="pa-marca-nome">
              PONTE <strong>Mapa de Oportunidades</strong>
            </span>
          </Link>

          <div className="pa-espaco" />

          <ContaMenu email={email} nome={nome} />
        </div>
      </header>

      <main className="pa-main">{children}</main>

      <footer className="mp-rodape">
        <div className="mp-rodape-inner">
          <p className="pa-mono">Acesso restrito · janelas do Transferegov</p>
          <div className="pa-espaco" />
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos</Link>
        </div>
      </footer>
    </div>
  );
}
