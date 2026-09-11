# Notas da sincronização com o Claude Design

Projeto: "Plataforma PONTE" (`af23091f-4b71-4927-b4c5-51c4ea987258`). Primeira sincronização em 11/09/2026.

## Como este repositório difere do esperado

- **Forma `package`, sem Storybook.** `web/` é o site Next.js, não uma biblioteca: não existe `dist/`.
- **Entrada própria.** `.design-sync/fonte/plataforma.tsx` reexporta os primitivos reais de
  `src/app/plataforma/app/_componentes/primitivos.tsx` e define `RaizPlataforma`, a `div.pa-root` que o
  `AppFrame` usa. Rodar o conversor com `--entry ./.design-sync/fonte/plataforma.tsx`: sem ela, ele procura
  `node_modules/ponte-app/package.json` e falha com ENOENT.
- **Fora do pacote, de propósito:** `AppFrame`, `Conversa` e `Gravador` dependem de `next/link`,
  `next/navigation`, `sessionStorage` e do modo de voz. A moldura e as classes `pa-*` entram documentadas no
  `conventions.md`.
- **Estilos gerados.** O `buildCmd` (`node .design-sync/gerar-estilos.mjs`) monta
  `.design-sync/.cache/gerado/plataforma.css` com o bloco `@theme static` da plataforma (em `globals.css`),
  `estilos.css` e `componentes.css`. Rodar antes do conversor, sempre.
- **Fontes.** No app vêm de `next/font`; aqui, `@import` do Google Fonts (Inter e Plus Jakarta Sans).
  `[FONT_REMOTE]` é esperado.
- **Sem o preflight do Tailwind.** `estilos.css` tem resets próprios dentro de `.pa-root`; pequenas diferenças de
  margem em elemento sem classe são esperadas.
- **Diretrizes.** `web/docs/*.md` são contratos de dados e especificações internas, não diretrizes de design, e
  não devem subir. `guidelinesGlob` aponta para `.design-sync/diretrizes/`, que fica vazio até existir diretriz
  de design de verdade.
- **Props escritas à mão.** A extração automática não acha `.d.ts` (não há build de tipos), então todas as props
  saíam como `[key: string]: unknown`. `dtsPropsFor` descreve as 7.
- **Instalação.** `npm ci` não foi rodado na primeira sincronização: `node_modules` já batia com o lockfile
  (react 19.2.3). Playwright 1.62.1 em `.ds-sync/` (fixa o chromium 1234, já presente em
  `%LOCALAPPDATA%\ms-playwright`); instalar com `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. O npm bloqueia scripts
  de instalação (`install-scripts`), e o esbuild funciona mesmo assim.

## Como re-sincronizar

A partir de `web/`, depois de copiar de novo os scripts para `.ds-sync/` e baixar o `_ds_sync.json` do projeto para
`.design-sync/.cache/remote-sync.json`:

```sh
node .design-sync/gerar-estilos.mjs
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
  --entry ./.design-sync/fonte/plataforma.tsx --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json
```

## Linhas esperadas no build (não são problema novo)

- `! guidelinesGlob: .design-sync/diretrizes not found — skipped` — de propósito; ver "Diretrizes" acima.
- `[FONT_REMOTE] "Inter", "Plus Jakarta Sans"` — fontes do Google Fonts.

## Known render warns

- Nenhum aviso de render na primeira sincronização (7/7 limpos). Os cartões de prévia têm bastante espaço vazio
  abaixo do conteúdo: a raiz `.pa-root` tem `min-height: 100dvh`, e o provider envolve cada célula nela. É
  cosmético e fiel ao app; não é falha.

## Re-sync risks

- `dtsPropsFor` é cópia manual das props de `primitivos.tsx`. Mudou a assinatura lá, muda aqui.
- `componentSrcMap` enumera os 7 componentes: componente novo em `primitivos.tsx` não entra sozinho — precisa
  entrar em `fonte/plataforma.tsx`, no mapa e em `dtsPropsFor`.
- `RaizPlataforma` espelha a `div.pa-root` do `AppFrame`. Se a raiz mudar de classe, muda aqui.
- As fontes dependem do Google Fonts em tempo de execução.
- `gerar-estilos.mjs` falha de propósito se `globals.css` deixar de ter exatamente um `@theme static` com
  `--color-pl-*`, ou se os CSS ganharem `url()` relativo.
