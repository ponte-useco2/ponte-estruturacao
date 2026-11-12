import type { ReactNode } from "react";

/**
 * Link para fora do portal (D1 A53, 12/11/2026; antes vivia em `cadeia-quebrada/PecasCadeia.tsx`, e as telas da Câmara
 * de João Pessoa usavam `<a>` cru, sem marca de saída): abre em outra aba, sem levar o endereço de quem clicou, e o
 * leitor de tela ouve que abre em nova aba, como nos links do catálogo e dos avisos.
 */
export function LinkFora({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="pa-sr"> (abre em nova aba)</span>
    </a>
  );
}
