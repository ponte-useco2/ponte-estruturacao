/**
 * Estilos do Formulário de Perfil Institucional.
 *
 * POR QUE CSS EM STRING, E NÃO TAILWIND: esta página é uma superfície escura,
 * na paleta do design system do CTLC (preto #121212, índigo, azul, violeta) e
 * em Poppins. O site institucional é branco, slate-900, Inter/Plus Jakarta.
 * São identidades deliberadamente distintas — a mesma separação que
 * /oportunidades já faz com os tokens --op-*. Manter o CSS num arquivo só,
 * com prefixo próprio, evita que a paleta escura vaze para o resto do site e
 * que um ajuste no tema claro quebre esta página.
 *
 * Como o style é injetado sem @layer, ele ganha das regras base do globals.css
 * (body com bg-white, h1..h6 em slate-900), que vivem dentro de @layer base.
 * Camada nomeada sempre perde para regra sem camada.
 *
 * POR QUE OS TOKENS TÊM OS NOMES DO DESIGN SYSTEM: a revisão do desenho passou
 * a escrever var(--surface-card), var(--fs-h1), var(--shadow-sm) em vez de
 * literais. Repetir esses nomes aqui, no escopo de .pfi-root, deixa cada regra
 * conferível linha a linha contra tokens/*.css do handoff. Os valores abaixo
 * são cópia dos arquivos colors/typography/spacing/elevation/motion.css. Como
 * vivem em .pfi-root, não vazam para o site: um --surface-card global não
 * existe fora daqui.
 *
 * O que NÃO veio do handoff e foi acrescentado:
 *   · faixa mobile (< 720px) — o desenho é uma prancheta de desktop, e grade
 *     de 2–3 colunas em 375px não se preenche;
 *   · folha de impressão — o protótipo só escondia .noprint, e imprimir texto
 *     claro sobre fundo que o navegador não imprime daria papel em branco;
 *   · anel de foco na caixa de seleção — o Checkbox do design system esconde o
 *     input nativo e não devolve indicação de foco, o que deixaria quem navega
 *     por teclado sem saber onde está.
 */
export const estilos = `
.pfi-root {
  /* ---- colors.css ---- */
  --ink-1000: #0a0a0b;
  --ink-900: #121212;
  --ink-800: #1c1c1f;
  --ink-400: #6b6b74;
  --ink-300: #9a9aa4;
  --ink-50: #f4f4f8;
  --ink-0: #ffffff;
  --indigo-700: #241f5f;
  --blue-600: #475fb1;
  --blue-500: #6178c2;
  --blue-400: #8b9dd6;
  --violet-600: #a05cdc;
  --violet-500: #b47ce4;
  --violet-400: #c8a1ed;
  --red-500: #e2564b;
  --surface-canvas: var(--ink-900);
  --surface-card: var(--ink-800);
  --surface-inset: var(--ink-1000);
  --surface-tint-blue: rgba(71,95,177,.14);
  --surface-tint-violet: rgba(160,92,220,.14);
  --text-primary: var(--ink-50);
  --text-secondary: var(--ink-300);
  --text-muted: var(--ink-400);
  --text-link: var(--blue-400);
  --text-link-hover: var(--violet-500);
  --text-accent: var(--violet-500);
  --border-subtle: rgba(255,255,255,.07);
  --border-default: rgba(255,255,255,.13);
  --border-strong: rgba(255,255,255,.22);

  /* ---- typography.css ---- */
  --fs-h1: 32px;
  --fs-body-l: 18px;
  --fs-body-s: 14px;
  --fs-caption: 12px;
  --fs-overline: 11px;
  --lh-snug: 1.2;
  --lh-body: 1.6;
  --fw-regular: 400;
  --fw-medium: 500;
  --fw-semibold: 600;
  --fw-bold: 700;
  --ls-heading: -0.012em;
  --ls-overline: 0.14em;
  --ls-button: 0.01em;

  /* ---- spacing.css ---- */
  --space-2: 8px;
  --space-3: 12px;
  --control-h-sm: 32px;
  --control-h-md: 44px;

  /* ---- elevation.css ---- */
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --shadow-sm: 0 2px 8px rgba(0,0,0,.45);
  --ring-focus: 0 0 0 3px rgba(160,92,220,.45);
  --gradient-brand: linear-gradient(135deg,#241f5f 0%,#475fb1 58%,#a05cdc 100%);
  --gradient-rule: linear-gradient(90deg,#475fb1 0%,#a05cdc 100%);
  --blur-panel: blur(14px);

  /* ---- motion.css ---- */
  --dur-fast: 140ms;
  --dur-base: 220ms;
  --ease-standard: cubic-bezier(.2,.8,.2,1);
  --transition-control:
    background-color var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-fast) var(--ease-standard),
    transform var(--dur-fast) var(--ease-standard);
  --lift-hover: translateY(-2px);
  --press-scale: 0.985;

  min-height: 100vh;
  background: var(--surface-canvas);
  color: var(--text-primary);
  padding: 0 0 96px;
  font-family: var(--font-poppins), Poppins, system-ui, sans-serif;
  line-height: normal;
}

/* O root cobre a viewport, mas o overscroll do navegador mostra o body.
   Sem isto, puxar a página para baixo revela uma faixa branca.
   Literal, e não var(--surface-canvas): os tokens vivem em .pfi-root, e um
   var() que não resolve invalida a declaração — o body ficaria transparente. */
body:has(.pfi-root) { background: #121212; }

.pfi-root a { color: var(--text-link); text-decoration: underline; }
.pfi-root a:hover { color: var(--text-link-hover); }
.pfi-root *, .pfi-root *::before, .pfi-root *::after { box-sizing: border-box; }

/* ---------------------------------------------------------------- topo --- */

.pfi-topo {
  position: sticky; top: 0; z-index: 20;
  background: rgba(18,18,18,.88);
  backdrop-filter: var(--blur-panel);
  border-bottom: 1px solid var(--border-default);
}
.pfi-topo-interno {
  max-width: 920px; margin: 0 auto; padding: 14px 24px;
  display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
}

/* Seletor com o tipo junto (a.pfi-marca) porque a regra .pfi-root a acima é
   mais específica do que uma classe sozinha — sem isso a marca sai
   sublinhada, em azul de link. */
.pfi-root a.pfi-marca {
  font-weight: var(--fw-bold); letter-spacing: -.01em; font-size: 17px;
  line-height: 1; color: var(--text-primary); text-decoration: none;
}
.pfi-root a.pfi-marca:hover { color: var(--text-primary); }
.pfi-root a.pfi-marca span { color: var(--violet-600); }

.pfi-topo-titulo { font-size: 13px; color: var(--text-secondary); flex: 1; min-width: 160px; }
.pfi-pct {
  font-size: var(--fs-caption); font-weight: var(--fw-semibold); letter-spacing: .06em;
  color: var(--violet-400); font-variant-numeric: tabular-nums;
}
.pfi-topo-acoes { display: flex; gap: 8px; }

.pfi-trilho { height: 2px; background: var(--border-subtle); }
.pfi-barra {
  height: 2px; background: var(--gradient-brand);
  transition: width var(--dur-base) var(--ease-standard);
}

/* ------------------------------------------------------------- botões --- */
/* Espelha Button.jsx do design system: SIZES.sm + VARIANTS.
   O componente original resolve hover/press com estado em React; aqui é
   :hover/:active, mesmo resultado visual sem estado. */

.pfi-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: var(--control-h-sm); padding: 0 14px;
  font-family: var(--font-poppins), Poppins, system-ui, sans-serif;
  font-size: var(--fs-body-s); font-weight: var(--fw-semibold);
  letter-spacing: var(--ls-button); line-height: 1;
  text-decoration: none; white-space: nowrap;
  border-radius: var(--radius-sm); cursor: pointer;
  transition: var(--transition-control);
}
.pfi-btn-primario {
  background: var(--blue-600); color: var(--ink-0); border: 1px solid var(--blue-600);
}
.pfi-btn-primario:hover {
  background: var(--blue-500); border-color: var(--blue-500);
  transform: var(--lift-hover); box-shadow: var(--shadow-sm);
}
.pfi-btn-contorno {
  background: transparent; color: var(--text-primary); border: 1px solid var(--border-strong);
}
/* Sem box-shadow: no design system a sombra de hover é suprimida em outline e
   ghost, que não têm superfície própria para levantar. */
.pfi-btn-contorno:hover {
  background: var(--surface-tint-blue); border-color: var(--blue-500);
  transform: var(--lift-hover);
}
.pfi-btn-fantasma {
  background: transparent; color: var(--text-secondary); border: 1px solid transparent;
}
.pfi-btn-fantasma:hover {
  background: var(--surface-tint-violet); color: var(--text-primary);
  transform: var(--lift-hover);
}
.pfi-btn:active { transform: scale(var(--press-scale)); }
.pfi-btn:focus-visible { outline: 2px solid var(--violet-600); outline-offset: 2px; }

/* -------------------------------------------------------------- corpo --- */

.pfi-corpo {
  max-width: 920px; margin: 0 auto; padding: 0 24px;
  display: flex; flex-direction: column; gap: 28px;
}
.pfi-abertura { padding: 56px 0 4px; display: flex; flex-direction: column; gap: 14px; }
.pfi-nota { margin: 0; font-size: 13px; color: var(--text-muted); }

/* ----------------------------------------------------- SectionHeading --- */
/* Sobrescrita, título, filete e lede. O componente do design system usa o
   mesmo --fs-h1 (32px) em qualquer nível: o h1 da página e os h2 dos blocos
   saem do mesmo tamanho, e a hierarquia fica por conta da sobrescrita. */

.pfi-cabecalho {
  display: flex; flex-direction: column; gap: var(--space-3); align-items: flex-start;
}
.pfi-sobrescrita {
  font-size: var(--fs-overline); font-weight: var(--fw-semibold);
  letter-spacing: var(--ls-overline); text-transform: uppercase;
  color: var(--text-accent);
}
.pfi-cabecalho-titulo {
  margin: 0; font-family: inherit;
  font-size: var(--fs-h1); font-weight: var(--fw-semibold);
  line-height: var(--lh-snug); letter-spacing: var(--ls-heading);
  color: var(--text-primary);
}
.pfi-regua { width: 64px; height: 3px; border-radius: 2px; background: var(--gradient-rule); }
.pfi-lede {
  margin: 0; max-width: 56ch;
  font-weight: var(--fw-regular); font-size: var(--fs-body-l); line-height: var(--lh-body);
  color: var(--text-secondary); text-wrap: pretty;
}

/* --------------------------------------------------------------- card --- */

.pfi-card {
  display: flex; flex-direction: column;
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 28px;
  color: var(--text-primary);
}
.pfi-card-corpo { display: flex; flex-direction: column; gap: 20px; }

/* -------------------------------------------------------------- campos --- */

.pfi-grade { display: grid; gap: 16px; }
.pfi-grade-2 { grid-template-columns: 1fr 1fr; }
.pfi-grade-3 { grid-template-columns: 1fr 1fr 1fr; }
.pfi-cheia { grid-column: 1 / -1; }

.pfi-campo { display: flex; flex-direction: column; gap: var(--space-2); width: 100%; }
.pfi-rotulo {
  font-size: var(--fs-body-s); font-weight: var(--fw-medium); color: var(--text-primary);
}
/* Apoio ACIMA da caixa (textarea). O desenho usa 12.5px aqui, fora da escala. */
.pfi-ajuda { font-size: 12.5px; color: var(--text-muted); line-height: 1.55; }
/* Apoio ABAIXO da caixa (campo de uma linha) — o hint do Input. */
.pfi-dica {
  font-weight: var(--fw-regular); font-size: var(--fs-caption); line-height: 1.4;
  color: var(--text-muted);
}

/* Caixa do campo de uma linha: altura fixa de controle, o input mora dentro. */
.pfi-caixa {
  display: flex; align-items: center; gap: var(--space-2);
  height: var(--control-h-md); padding: 0 14px;
  background: var(--surface-inset);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  transition: var(--transition-control);
}
.pfi-caixa:focus-within { border-color: var(--violet-600); box-shadow: var(--ring-focus); }
.pfi-root .pfi-caixa input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-family: var(--font-poppins), Poppins, system-ui, sans-serif;
  font-size: var(--fs-body-s); color: var(--text-primary);
}

.pfi-root textarea {
  width: 100%;
  background: var(--surface-inset);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-poppins), Poppins, system-ui, sans-serif;
  font-size: var(--fs-body-s);
  padding: 11px 13px;
  outline: none;
  resize: vertical;
  line-height: 1.6;
  overflow: hidden;
}
.pfi-root textarea:focus { border-color: var(--violet-600); box-shadow: var(--ring-focus); }
.pfi-root ::placeholder { color: var(--text-muted); }

/* --------------------------------------------------------- marcadores --- */
/* Espelha Checkbox.jsx: o input nativo é escondido e a caixa é um quadrado de
   20px desenhado à mão, para poder receber a cor da marca quando marcado. */

.pfi-marca-item {
  display: flex; gap: var(--space-3); align-items: center; cursor: pointer;
}
.pfi-marca-item.pfi-com-descricao { align-items: flex-start; }

.pfi-root .pfi-marca-item input[type="checkbox"] {
  position: absolute; opacity: 0; width: 0; height: 0; margin: 0;
}
.pfi-marca-caixa {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; flex: 0 0 auto;
  border-radius: var(--radius-xs);
  background: var(--surface-inset);
  border: 1px solid var(--border-strong);
  color: var(--ink-1000);
  transition: var(--transition-control);
}
.pfi-com-descricao .pfi-marca-caixa { margin-top: 2px; }
.pfi-marca-item input:checked ~ .pfi-marca-caixa {
  background: var(--violet-600); border-color: var(--violet-600);
}
/* Acréscimo ao design system: com o input nativo escondido, sem isto o foco
   por teclado não apareceria em lugar nenhum. */
.pfi-marca-item input:focus-visible ~ .pfi-marca-caixa {
  box-shadow: var(--ring-focus); border-color: var(--violet-600);
}
.pfi-marca-texto { display: flex; flex-direction: column; gap: 2px; }
.pfi-marca-rotulo {
  font-size: var(--fs-body-s); font-weight: var(--fw-regular); color: var(--text-primary);
}
.pfi-marca-descricao {
  font-weight: var(--fw-regular); font-size: var(--fs-caption); line-height: 1.4;
  color: var(--text-muted);
}

.pfi-marcadores { display: flex; flex-direction: column; gap: var(--space-3); }
.pfi-marcadores-separador { border-top: 1px solid var(--border-subtle); padding-top: 18px; }
.pfi-grupo-rotulo {
  font-size: var(--fs-body-s); font-weight: var(--fw-medium); color: var(--text-primary);
}
.pfi-marcadores-grade { display: grid; gap: var(--space-3) 20px; }

.pfi-checklist { display: flex; flex-direction: column; gap: 14px; }

/* -------------------------------------------------------- declarações --- */

.pfi-declaracoes {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 18px;
  display: flex; flex-direction: column; gap: 16px;
  background: var(--surface-tint-blue);
}

/* ------------------------------------------------------------ rodapé --- */

.pfi-rodape {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 16px; padding: 24px 0 0; border-top: 1px solid var(--border-subtle);
}
.pfi-rodape p {
  margin: 0; font-size: var(--fs-body-s); color: var(--text-secondary);
  max-width: 52ch; line-height: var(--lh-body);
}
.pfi-rodape strong { font-weight: var(--fw-semibold); color: var(--text-primary); }

/* ------------------------------------------------------------ mobile --- */
/* Acréscimo ao desenho: a prancheta original é de desktop. Abaixo de 720px
   as grades viram coluna única — dois campos lado a lado em 375px produzem
   caixas de ~150px, estreitas demais para "Endereço completo da sede". */

@media (max-width: 720px) {
  .pfi-grade-2, .pfi-grade-3, .pfi-marcadores-grade { grid-template-columns: 1fr; }
  .pfi-cabecalho-titulo { font-size: 26px; }
  .pfi-lede { font-size: 16px; }
  .pfi-abertura { padding: 36px 0 4px; }
  .pfi-card { padding: 20px; }
  .pfi-corpo { padding: 0 16px; gap: 20px; }
  .pfi-topo-interno { padding: 12px 16px; gap: 12px; }
  .pfi-topo-titulo { order: 3; flex-basis: 100%; }
  .pfi-topo-acoes { margin-left: auto; }
  .pfi-rodape { flex-direction: column; align-items: flex-start; }
}

/* --------------------------------------------------------- impressão --- */
/* O protótipo só escondia os controles. Fundo escuro não é impresso por
   padrão, então o texto claro sairia invisível: aqui a página inteira vira
   tinta escura sobre papel, os campos viram linhas e as caixas de seleção
   ganham traço escuro — senão a borda em branco translúcido some no papel. */

@media print {
  .pfi-noprint { display: none !important; }

  body:has(.pfi-root) { background: #fff; }
  .pfi-root {
    background: #fff; color: #121212; padding: 0 0 24px;
    --text-primary: #121212;
    --text-secondary: #4a4a55;
    --text-muted: #6b6b74;
    --surface-card: #fff;
    --surface-inset: #fff;
    --border-subtle: rgba(18,18,18,.12);
    --border-default: rgba(18,18,18,.28);
    --border-strong: rgba(18,18,18,.45);
  }
  .pfi-corpo { max-width: none; padding: 0; gap: 18px; }
  .pfi-abertura { padding: 0 0 4px; }
  .pfi-cabecalho-titulo { font-size: 22px; }
  .pfi-lede { font-size: 14px; }
  .pfi-card {
    box-shadow: none; border: 1px solid rgba(18,18,18,.18);
    padding: 16px;
    break-inside: avoid; page-break-inside: avoid;
  }
  .pfi-card-corpo { gap: 14px; }
  .pfi-caixa {
    height: auto; min-height: 26px; padding: 2px 0;
    border: none; border-bottom: 1px solid rgba(18,18,18,.28); border-radius: 0;
  }
  .pfi-root textarea {
    border: none; border-bottom: 1px solid rgba(18,18,18,.28);
    border-radius: 0; padding: 4px 0; overflow: visible;
  }
  /* No papel some a diferença entre exemplo e resposta: "00/00/0000" impresso
     numa linha em branco parece data preenchida. Campo vazio imprime vazio. */
  .pfi-root ::placeholder { color: transparent; }
  /* Marcado e não marcado passam a se distinguir só pelo tique, que é o modo
     como uma caixa de seleção impressa deve mesmo ser lida. */
  .pfi-marca-item input:checked ~ .pfi-marca-caixa {
    background: #fff; border-color: rgba(18,18,18,.45); color: #121212;
  }
  .pfi-declaracoes { background: rgba(71,95,177,.06); }
  .pfi-rodape { border-top: 1px solid rgba(18,18,18,.12); }
}
`;
