"use client";

/**
 * O menu do Mapa: as abas do topo.
 *
 * Cliente só porque a aba ativa depende do caminho. A contagem de não lidas vem
 * pronta do servidor — contar aqui exigiria outra ida ao banco a cada troca.
 *
 * As abas, quem vê cada uma e qual acende moram em `lib/oportunidades/abas.ts`, com teste (B11, 08/10/2026: lá
 * entrou a aba "Território" e a regra de uma aba acesa por vez). Aqui só se desenha.
 */

import { usePathname, useSearchParams } from "next/navigation";
import { abaAcesa, abasDoMenu } from "@/lib/oportunidades/abas";
import { LinkMapa } from "./LinkMapa";

export function MapaNav({
  naoLidas,
  admin,
  municipio = false,
  meuIbge = null,
  organizacao = false,
  minhaEntidade = null,
  publico = false,
}: {
  naoLidas: number | null;
  admin: boolean;
  /** A organização ativa é de município: mostra a aba "Meu município". */
  municipio?: boolean;
  /** O IBGE dessa organização: na página dele, a aba acesa é "Meu município", não o Território. */
  meuIbge?: string | null;
  /** A organização ativa não é prefeitura e tem CNPJ: mostra "Minha organização". */
  organizacao?: boolean;
  /** O CNPJ dela: na página dessa entidade, a aba acesa é "Minha organização". */
  minhaEntidade?: string | null;
  /** C4a (09/10/2026): a versão pública, só as abas cujo destino é público (hoje, Janelas e Território). Ver `abas.ts`. */
  publico?: boolean;
}) {
  const pathname = usePathname() ?? "/mapa";
  // De onde se chegou (`?de=suspensivas`): decide a aba acesa no laudo.
  const de = useSearchParams()?.get("de") ?? null;
  const abas = abasDoMenu({ admin, municipio, organizacao, publico });
  const acesa = abaAcesa(abas, pathname, de, { meuIbge: municipio ? meuIbge : null, minhaEntidade: organizacao ? minhaEntidade : null });

  return (
    <nav className="pa-abas" aria-label="Mapa de Oportunidades">
      {abas.map((aba) => {
        const contagem = aba.href === "/mapa/avisos" && naoLidas !== null && naoLidas > 0 ? naoLidas : null;
        return (
          <LinkMapa key={aba.href} href={aba.href} className="pa-aba" aria-current={aba.href === acesa ? "page" : undefined}>
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
          </LinkMapa>
        );
      })}
    </nav>
  );
}
