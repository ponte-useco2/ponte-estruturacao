"use client";

/**
 * As duas telas do Mapa.
 *
 * Cliente só porque a aba ativa depende do caminho. A contagem de não lidas vem
 * pronta do servidor — contar aqui exigiria outra ida ao banco a cada troca.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Aba {
  href: string;
  nome: string;
  exata: boolean;
  admin: boolean;
  municipio: boolean;
  /** Outras rotas que acendem esta aba. */
  tambem?: readonly string[];
}

const ABAS: readonly Aba[] = [
  // `exata`: sem ela, "/mapa" casaria como prefixo de "/mapa/avisos" e as duas
  // abas apareceriam ativas ao mesmo tempo.
  { href: "/mapa", nome: "Janelas", exata: true, admin: false, municipio: false },
  { href: "/mapa/avisos", nome: "Avisos", exata: false, admin: false, municipio: false },
  // As páginas abertas a partir da busca não têm aba própria: acendem a da busca.
  {
    href: "/mapa/busca",
    nome: "Busca",
    exata: false,
    admin: false,
    municipio: false,
    tambem: ["/mapa/instrumento/", "/mapa/proposta/", "/mapa/municipio/"],
  },
  // Só para quem está numa organização de município. A página confere o vínculo
  // confirmado e explica o que falta; a aba só evita mostrar a porta a quem não é prefeitura.
  { href: "/mapa/meu-municipio", nome: "Meu município", exata: false, admin: false, municipio: true },
  // Uso interno da PONTE. Esconder a aba é conveniência; quem protege é a página,
  // que confere o administrador no servidor antes de ler qualquer dado.
  { href: "/mapa/radar", nome: "Radar", exata: false, admin: true, municipio: false },
  { href: "/mapa/painel", nome: "Painel", exata: false, admin: true, municipio: false },
  { href: "/mapa/fiscal", nome: "Fiscal", exata: false, admin: true, municipio: false },
  { href: "/mapa/suspensivas", nome: "Suspensivas", exata: false, admin: true, municipio: false },
];

export function MapaNav({
  naoLidas,
  admin,
  municipio = false,
}: {
  naoLidas: number | null;
  admin: boolean;
  /** A organização ativa é de município: mostra a aba "Meu município". */
  municipio?: boolean;
}) {
  const pathname = usePathname() ?? "/mapa";

  return (
    <nav className="pa-abas" aria-label="Mapa de Oportunidades">
      {ABAS.filter((aba) => (admin || !aba.admin) && (municipio || !aba.municipio)).map((aba) => {
        const atual = aba.exata
          ? pathname === aba.href
          : pathname.startsWith(aba.href) || (aba.tambem ?? []).some((p) => pathname.startsWith(p));
        const contagem = aba.href === "/mapa/avisos" && naoLidas !== null && naoLidas > 0 ? naoLidas : null;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            className="pa-aba"
            aria-current={atual ? "page" : undefined}
          >
            {aba.nome}
            {contagem !== null && (
              <>
                <span className="mp-aba-contagem" aria-hidden="true">
                  {contagem > 99 ? "99+" : contagem}
                </span>
                {/* O número visível é decoração; o que o leitor de tela ouve é a frase. */}
                <span className="pa-sr">, {contagem} não {contagem === 1 ? "lido" : "lidos"}</span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
