/**
 * Entrada do design system da Plataforma PONTE para o Claude Design.
 *
 * Reexporta os componentes reais do app logado — nada aqui reimplementa
 * componente. A única peça própria é `RaizPlataforma`, que faz o mesmo que a
 * moldura do app (`AppFrame`) faz com o `<div className="pa-root">`: é nela que
 * os tokens --pa-* são definidos. Fora dela, nenhum `var(--pa-*)` resolve.
 *
 * `AppFrame`, `Conversa` e `Gravador` ficam de fora de propósito: dependem do
 * roteador do Next e do modo de voz do protótipo.
 */
import type { ReactNode } from "react";

export { Tag, Barra, Rotulo, Nota, Eixos, Ciclo } from "../../src/app/plataforma/app/_componentes/primitivos";

/**
 * Raiz visual da plataforma. Define os tokens --pa-* (cores, fontes, raios) e a
 * tipografia base. Toda tela e todo componente precisam estar dentro dela.
 */
export function RaizPlataforma({ children }: { children: ReactNode }) {
  return <div className="pa-root">{children}</div>;
}
