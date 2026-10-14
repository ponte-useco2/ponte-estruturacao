import type { Metadata } from "next";
import "../_design/estilos.css";
import "../_design/componentes.css";
import "../mapa/mapa.css";
import "./sala.css";

/**
 * Sala do cliente (14/10/2026): material de reunião com senha simples (`lib/oportunidades/sala.ts`). Usa o desenho do
 * Mapa (as tabelas com filtro em cada coluna vêm de lá), com uma moldura própria e sem o menu: quem entra é convidado,
 * não usuário do Mapa.
 *
 * `noindex`, e o título não diz de quem é a sala: o nome do cliente só aparece depois da senha.
 */
export const metadata: Metadata = {
  title: "Sala de trabalho · PONTE",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function SalaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pa-root mp-root sl-root">
      <header className="pa-top">
        <div className="pa-top-inner">
          <span className="pa-marca">
            <span className="pa-marca-selo" aria-hidden="true">
              P
            </span>
            <span className="pa-marca-nome">
              PONTE <strong>Sala de trabalho</strong>
            </span>
          </span>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1} className="pa-main">
        {children}
      </main>
      <footer className="mp-rodape">
        <div className="mp-rodape-inner">
          <p className="pa-mono">PONTE Estruturação de Projetos de Impacto · acesso por convite</p>
        </div>
      </footer>
    </div>
  );
}
