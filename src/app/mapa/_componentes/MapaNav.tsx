"use client";

/**
 * As duas telas do Mapa.
 *
 * Cliente só porque a aba ativa depende do caminho. A contagem de não lidas vem
 * pronta do servidor — contar aqui exigiria outra ida ao banco a cada troca.
 */

import Link from "next/link";
import { Carregando } from "./Carregando";
import { usePathname, useSearchParams } from "next/navigation";
import { LAUDO_PELAS_SUSPENSIVAS, abaAtiva, naMinhaEntidade, noMeuMunicipio, type RegraAba } from "@/lib/oportunidades/abas";

interface Aba extends RegraAba {
  nome: string;
  admin: boolean;
  municipio: boolean;
  /** Só para organização que não é prefeitura e tem CNPJ (oport_31). */
  organizacao?: boolean;
}

const ABAS: readonly Aba[] = [
  // `exata`: sem ela, "/mapa" casaria como prefixo de "/mapa/avisos" e as duas
  // abas apareceriam ativas ao mesmo tempo.
  { href: "/mapa", nome: "Janelas", exata: true, admin: false, municipio: false },
  { href: "/mapa/avisos", nome: "Avisos", exata: false, admin: false, municipio: false },
  // A carteira (02/10/2026): os municípios e itens seguidos, o que mudou e a próxima ação.
  { href: "/mapa/carteira", nome: "Carteira", exata: false, admin: false, municipio: false },
  // As páginas abertas a partir da busca não têm aba própria: acendem a da busca.
  {
    href: "/mapa/busca",
    nome: "Busca",
    exata: false,
    admin: false,
    municipio: false,
    // Município e entidade não acendem a Busca (teste de 07/10/2026): ficam sem aba até o menu da F2; o próprio
    // município do cliente acende "Meu município".
    tambem: ["/mapa/instrumento/", "/mapa/proposta/"],
    // O laudo de qualquer instrumento acende a Busca; o aberto pela lista das suspensivas, não.
    exceto: [LAUDO_PELAS_SUSPENSIVAS],
  },
  // Só para quem está numa organização de município. A página confere o vínculo
  // confirmado e explica o que falta; a aba só evita mostrar a porta a quem não é prefeitura.
  // Com o vínculo confirmado, a página redireciona para a do município em abas, que também acende esta aba.
  // O laudo do Pix (/mapa/pix/…) serve às duas: o cliente chega pelo Meu município, o administrador pelo Painel.
  { href: "/mapa/meu-municipio", nome: "Meu município", exata: false, admin: false, municipio: true, tambem: ["/mapa/pix/"] },
  // A organização que não é prefeitura (OSC, órgão estadual, consórcio), com o CNPJ confirmado (oport_31).
  { href: "/mapa/minha-organizacao", nome: "Minha organização", exata: false, admin: false, municipio: false, organizacao: true },
  // Uso interno da PONTE. Esconder a aba é conveniência; quem protege é a página,
  // que confere o administrador no servidor antes de ler qualquer dado.
  { href: "/mapa/radar", nome: "Radar", exata: false, admin: true, municipio: false },
  { href: "/mapa/painel", nome: "Painel", exata: false, admin: true, municipio: false, tambem: ["/mapa/pix/"] },
  { href: "/mapa/fiscal", nome: "Fiscal", exata: false, admin: true, municipio: false },
  { href: "/mapa/suspensivas", nome: "Suspensivas", exata: false, admin: true, municipio: false, tambem: [LAUDO_PELAS_SUSPENSIVAS] },
  // O dossiê de cada empresa (/mapa/fornecedor/<cnpj>) acende a lista.
  { href: "/mapa/fornecedores", nome: "Fornecedores", exata: false, admin: true, municipio: false, tambem: ["/mapa/fornecedor/"] },
];

export function MapaNav({
  naoLidas,
  admin,
  municipio = false,
  meuIbge = null,
  organizacao = false,
  minhaEntidade = null,
}: {
  naoLidas: number | null;
  admin: boolean;
  /** A organização ativa é de município: mostra a aba "Meu município". */
  municipio?: boolean;
  /** O IBGE dessa organização: na página dele, a aba acesa é "Meu município", não a Busca. */
  meuIbge?: string | null;
  /** A organização ativa não é prefeitura e tem CNPJ: mostra "Minha organização". */
  organizacao?: boolean;
  /** O CNPJ dela: na página dessa entidade, a aba acesa é "Minha organização". */
  minhaEntidade?: string | null;
}) {
  const pathname = usePathname() ?? "/mapa";
  // De onde se chegou (`?de=suspensivas`): decide a aba acesa no laudo.
  const de = useSearchParams()?.get("de") ?? null;
  const noMeu = municipio && noMeuMunicipio(pathname, meuIbge);
  const naMinha = organizacao && naMinhaEntidade(pathname, minhaEntidade);

  return (
    <nav className="pa-abas" aria-label="Mapa de Oportunidades">
      {ABAS.filter((aba) => (admin || !aba.admin) && (municipio || !aba.municipio) && (organizacao || !aba.organizacao)).map((aba) => {
        const atual = noMeu ? aba.municipio : naMinha ? aba.organizacao === true : abaAtiva(aba, pathname, de);
        const contagem = aba.href === "/mapa/avisos" && naoLidas !== null && naoLidas > 0 ? naoLidas : null;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            className="pa-aba"
            aria-current={atual ? "page" : undefined}
            prefetch={false}
          >
            {aba.nome}
            <Carregando />
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
