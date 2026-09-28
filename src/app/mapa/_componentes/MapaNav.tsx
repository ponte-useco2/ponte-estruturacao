"use client";

/**
 * As duas telas do Mapa.
 *
 * Cliente só porque a aba ativa depende do caminho. A contagem de não lidas vem
 * pronta do servidor — contar aqui exigiria outra ida ao banco a cada troca.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LAUDO_PELAS_SUSPENSIVAS, abaAtiva, type RegraAba } from "@/lib/oportunidades/abas";

interface Aba extends RegraAba {
  nome: string;
  admin: boolean;
  municipio: boolean;
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
    // O laudo de qualquer instrumento acende a Busca; o aberto pela lista das suspensivas, não.
    exceto: [LAUDO_PELAS_SUSPENSIVAS],
  },
  // Só para quem está numa organização de município. A página confere o vínculo
  // confirmado e explica o que falta; a aba só evita mostrar a porta a quem não é prefeitura.
  { href: "/mapa/meu-municipio", nome: "Meu município", exata: false, admin: false, municipio: true },
  // Uso interno da PONTE. Esconder a aba é conveniência; quem protege é a página,
  // que confere o administrador no servidor antes de ler qualquer dado.
  { href: "/mapa/radar", nome: "Radar", exata: false, admin: true, municipio: false },
  { href: "/mapa/painel", nome: "Painel", exata: false, admin: true, municipio: false },
  { href: "/mapa/fiscal", nome: "Fiscal", exata: false, admin: true, municipio: false },
  { href: "/mapa/suspensivas", nome: "Suspensivas", exata: false, admin: true, municipio: false, tambem: [LAUDO_PELAS_SUSPENSIVAS] },
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
  // De onde se chegou (`?de=suspensivas`): decide a aba acesa no laudo.
  const de = useSearchParams()?.get("de") ?? null;

  return (
    <nav className="pa-abas" aria-label="Mapa de Oportunidades">
      {ABAS.filter((aba) => (admin || !aba.admin) && (municipio || !aba.municipio)).map((aba) => {
        const atual = abaAtiva(aba, pathname, de);
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
