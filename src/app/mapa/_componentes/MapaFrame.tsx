import type { ReactNode } from "react";
import Link from "next/link";
import { ContaMenu } from "./ContaMenu";
import { MapaNav } from "./MapaNav";
import { lerContexto } from "@/lib/oportunidades/organizacao.server";
import { contarNaoLidas } from "@/lib/oportunidades/notificacoes.server";

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
 * É componente de SERVIDOR. Desde 12/09/2026 o Mapa tem duas telas — Janelas
 * e Avisos —, e as abas dependem do caminho; por isso só elas (`MapaNav`) e o
 * menu de conta são cliente.
 */
export async function MapaFrame({
  children,
  email,
  nome,
}: {
  children: ReactNode;
  email: string;
  nome: string | null;
}) {
  // A moldura lê o contexto de organização porque é ela que mostra qual está
  // ativa e oferece a troca. A página lê de novo, para saber se convida a
  // declarar: são duas responsabilidades distintas, e a leitura é barata.
  const [{ ativa, todas }, naoLidas] = await Promise.all([lerContexto(), contarNaoLidas()]);

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

          <ContaMenu email={email} nome={nome} organizacoes={todas} ativa={ativa} />
        </div>

        <MapaNav naoLidas={naoLidas} />
      </header>

      <main className="pa-main">{children}</main>

      <footer className="mp-rodape">
        <div className="mp-rodape-inner">
          <p className="pa-mono">Acesso restrito · fontes oficiais de fomento</p>
          <div className="pa-espaco" />
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos</Link>
        </div>
      </footer>
    </div>
  );
}
