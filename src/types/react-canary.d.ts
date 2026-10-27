// O `<ViewTransition>` do React (onda 16, M0, 27/10/2026): o App Router do Next 16 usa o React canary, que já exporta o
// componente; os tipos dele moram em `@types/react/canary`. Sem esta referência, o `import { ViewTransition } from
// "react"` não compila, embora rode.
/// <reference types="react/canary" />
export {};
