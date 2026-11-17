import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  AVISO_DE_DOMINIO,
  AVISO_FIXO,
  COOKIES_ANTIGOS,
  COOKIE_MOVIMENTO,
  COOKIE_TEMA,
  COOKIE_TEXTO,
  COOKIE_TITULOS,
  TEMAS,
  TEXTO_MAX,
  TEXTO_MIN,
  lerPreferencias,
} from "@/lib/oportunidades/emendas-publico";
import { ConteudoDoPortal, NavPortal } from "./_componentes/Navegador";
import "../_design/estilos.css";
import "../_design/componentes.css";
import "../mapa/mapa.css";
import "../mapa/_componentes/trilha.css";
import "./emendas.css";
import "./percurso.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ponteprojetos.com.br";

/** A busca do cabeçalho: código da emenda (12 dígitos) ou nome de município (página `/emendas/buscar`). */
function BuscaDoPortal({ id }: { id: string }) {
  return (
    <form role="search" action="/emendas/buscar" method="get" className="busca-portal">
      <label htmlFor={id} className="t12" style={{ fontWeight: 700 }}>
        Buscar emenda ou município
      </label>
      <span className="linha-flex" style={{ gap: 6, flexWrap: "nowrap" }}>
        <input id={id} name="q" type="search" className="campo t14" autoComplete="off" maxLength={80} placeholder="2024 5007 0002 ou Patos" />
        <button className="btn t14" type="submit">
          Buscar
        </button>
      </span>
    </form>
  );
}

/** Os tipos da identidade da v2 (Inter já vem do layout raiz, em `--font-inter`). */
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"], variable: "--fonte-disp", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--fonte-mono", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Emendas federais na Paraíba | PONTE",
    template: "%s · Emendas federais na Paraíba | PONTE",
  },
  description:
    "Portal independente, só de leitura, das emendas parlamentares federais com destino à Paraíba: o que chegou a cada município, por onde chegou, para quê, quem indicou, e os registros que compõem cada valor, com dados abertos em CSV e JSON.",
  alternates: { canonical: `${SITE_URL}/emendas` },
};

/**
 * O portal público das emendas federais com destino à Paraíba (versão 2 do desenho, 17/11/2026;
 * `Site-Ponte/transparencia-emendas/IMPLEMENTACAO-V2.md`). Fora do `/mapa` e do portão dele: sem login, sem cadastro.
 *
 * A identidade do protótipo: a faixa de independência, a barra com a marca e o menu, o painel de acessibilidade (tema,
 * tamanho do texto e movimento) e o rodapé escuro. As preferências vêm de cookie, lidas aqui no servidor: funcionam sem
 * JavaScript (o painel é um `<details>` com links para `/emendas/preferencias`). Ler o cookie deixa o segmento dinâmico;
 * o dado não é relido a cada visita (o cache de `emendas-publico.server.ts` guarda por execução).
 */
export default async function EmendasLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const pref = lerPreferencias({
    tema: jar.get(COOKIE_TEMA)?.value,
    texto: jar.get(COOKIE_TEXTO)?.value,
    movimento: jar.get(COOKIE_MOVIMENTO)?.value,
    titulos: jar.get(COOKIE_TITULOS)?.value,
    contrasteAntigo: jar.get(COOKIES_ANTIGOS[0])?.value,
    fonteAntiga: jar.get(COOKIES_ANTIGOS[1])?.value,
  });
  const pedir = (q: string) => `/emendas/preferencias?${q}`;
  return (
    <div
      className={`ef ${bricolage.variable} ${plexMono.variable}`}
      data-tema={pref.tema}
      data-movimento={pref.movimento}
      data-titulos={pref.titulos}
      style={{ ["--escala" as string]: String(pref.texto / 100) }}
    >
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <div className="faixa t12 invertido">
        <span>Portal independente mantido pela PONTE · não é um site do governo · dados públicos oficiais, sem cadastro</span>
      </div>
      <header className="cabecalho">
        <div className="cabecalho-dentro">
          <Link prefetch={false} className="logo" href="/emendas" aria-label="Emendas federais na Paraíba, início">
            <span className="disp logo-ponte">PONTE</span>
            <span className="disp t18" style={{ fontWeight: 680, lineHeight: 1.1, fontVariationSettings: "'wdth' 86" }}>
              Emendas federais
              <br />
              na Paraíba
            </span>
          </Link>
          <div className="nav-largo">
            <NavPortal />
          </div>
          <div className="nav-largo">
            <BuscaDoPortal id="busca-cabecalho" />
          </div>
          <details className="menu-celular">
            <summary className="btn">Menu</summary>
            <div className="painel-menu">
              <BuscaDoPortal id="busca-menu" />
              <NavPortal />
            </div>
          </details>
          <details className="acessibilidade">
            <summary className="btn">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="7" r="1.4" />
                <path d="M7 10.5l5 1 5-1" />
                <path d="M12 11.5v3.5l-2.5 4.5" />
                <path d="M12 15l2.5 4.5" />
              </svg>
              Acessibilidade
            </summary>
            <div id="painel-a11y" role="region" aria-label="Opções de acessibilidade" className="painel-a11y">
              <div className="painel-a11y-dentro">
                <div role="group" aria-label="Tamanho do texto" className="grupo-a11y">
                  <span className="t14" style={{ fontWeight: 600 }}>
                    Texto
                  </span>
                  <div className="segs">
                    <a className="seg" href={pedir("texto=menos")} rel="nofollow" aria-label="Diminuir o texto" aria-disabled={pref.texto <= TEXTO_MIN || undefined}>
                      A−
                    </a>
                    <a className="seg t14 num" href={pedir("texto=normal")} rel="nofollow" aria-label={`Tamanho do texto: ${pref.texto}%. Voltar a 100%`} style={{ minWidth: 64 }}>
                      {pref.texto}%
                    </a>
                    <a className="seg" href={pedir("texto=mais")} rel="nofollow" aria-label="Aumentar o texto" aria-disabled={pref.texto >= TEXTO_MAX || undefined}>
                      A+
                    </a>
                  </div>
                </div>
                <div role="group" aria-label="Tema" className="grupo-a11y">
                  <span className="t14" style={{ fontWeight: 600 }}>
                    Tema
                  </span>
                  <div className="segs">
                    {TEMAS.map((t) => (
                      <a key={t.id} className="seg t14" href={pedir(`tema=${t.id}`)} rel="nofollow" aria-current={pref.tema === t.id ? "true" : undefined}>
                        {t.rotulo}
                      </a>
                    ))}
                  </div>
                </div>
                <div role="group" aria-label="Movimento" className="grupo-a11y">
                  <span className="t14" style={{ fontWeight: 600 }}>
                    Movimento
                  </span>
                  <div className="segs">
                    <a className="seg t14" href={pedir("movimento=normal")} rel="nofollow" aria-current={pref.movimento === "normal" ? "true" : undefined}>
                      Normal
                    </a>
                    <a className="seg t14" href={pedir("movimento=reduzido")} rel="nofollow" aria-current={pref.movimento === "reduzido" ? "true" : undefined}>
                      Reduzido
                    </a>
                  </div>
                </div>
                <div role="group" aria-label="Títulos" className="grupo-a11y">
                  <span className="t14" style={{ fontWeight: 600 }}>
                    Títulos
                  </span>
                  <div className="segs">
                    <a className="seg t14" href={pedir("titulos=padrao")} rel="nofollow" aria-current={pref.titulos === "padrao" ? "true" : undefined}>
                      Fonte do portal
                    </a>
                    <a className="seg t14" href={pedir("titulos=simples")} rel="nofollow" aria-current={pref.titulos === "simples" ? "true" : undefined}>
                      Títulos em fonte simples
                    </a>
                  </div>
                </div>
                <a className="btn t14" href={pedir("restaurar=1")} rel="nofollow">
                  Restaurar padrão
                </a>
                <Link prefetch={false} className="t14" href="/emendas/acessibilidade">
                  Guia de acessibilidade
                </Link>
                <Link prefetch={false} className="t14" href="/emendas/mapa-do-site">
                  Mapa do site
                </Link>
              </div>
            </div>
          </details>
        </div>
      </header>

      <main id="conteudo" tabIndex={-1}>
        <ConteudoDoPortal>{children}</ConteudoDoPortal>
      </main>

      <footer className="rodape">
        <div className="rodape-dentro">
          <div className="pilha" style={{ gap: 12 }}>
            <span className="disp logo-rodape">PONTE</span>
            <p className="t14" style={{ maxWidth: "52ch" }}>
              {AVISO_FIXO}
            </p>
            <p className="t14" style={{ maxWidth: "52ch" }}>
              Sem cadastro. Sem perfil político do visitante. Os cookies deste portal guardam só as preferências de acessibilidade.
            </p>
            <p className="t14" style={{ maxWidth: "52ch", fontWeight: 600 }}>
              {AVISO_DE_DOMINIO}
            </p>
          </div>
          <nav aria-label="Rodapé" className="t14">
            <Link prefetch={false} href="/emendas/dados">
              Dados abertos (CC BY 4.0)
            </Link>
            <Link prefetch={false} href="/emendas/metodo">
              Método e PNTP
            </Link>
            <Link prefetch={false} href="/emendas/perguntas">
              Perguntas frequentes
            </Link>
            <Link prefetch={false} href="/emendas/mapa-do-site">
              Mapa do site
            </Link>
            <Link prefetch={false} href="/emendas/acessibilidade">
              Acessibilidade
            </Link>
            <Link prefetch={false} href="/privacidade">
              Política de privacidade
            </Link>
            <Link prefetch={false} href="/">
              Site da PONTE
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
