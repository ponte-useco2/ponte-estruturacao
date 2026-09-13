"use client";

/**
 * As duas telas do Mapa.
 *
 * Cliente só porque a aba ativa depende do caminho. A contagem de não lidas vem
 * pronta do servidor — contar aqui exigiria outra ida ao banco a cada troca.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  // `exata`: sem ela, "/mapa" casaria como prefixo de "/mapa/avisos" e as duas
  // abas apareceriam ativas ao mesmo tempo.
  { href: "/mapa", nome: "Janelas", exata: true },
  { href: "/mapa/avisos", nome: "Avisos", exata: false },
] as const;

export function MapaNav({ naoLidas }: { naoLidas: number | null }) {
  const pathname = usePathname() ?? "/mapa";

  return (
    <nav className="pa-abas" aria-label="Mapa de Oportunidades">
      {ABAS.map((aba) => {
        const atual = aba.exata ? pathname === aba.href : pathname.startsWith(aba.href);
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
