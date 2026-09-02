/**
 * Estilos da Carteira Territorial da Serra do Teixeira.
 *
 * Segue o padrão de `/oportunidades`: uma string de CSS injetada num <style>
 * dentro do componente, com os tokens como ALIAS sobre os --color-ct-*
 * declarados em @theme static no src/app/globals.css. Nenhum valor de cor
 * nasce aqui — os literais no comentário à direita são só referência de
 * leitura.
 *
 * POR QUE FORA DE @layer: o @layer base do Tailwind pinta `p` de slate-600 e
 * os headings de slate-900, que é a identidade do site institucional. Regra
 * sem camada vence regra em camada sem precisar de !important, então basta
 * este arquivo não estar em @layer para a superfície escura se impor dentro
 * de .ct-root — e só dentro dela.
 */
export const estilosCarteira = `
.ct-root {
  /* --- Alias sobre os tokens CTLC (globals.css) --- */
  --ct-canvas: var(--color-ct-ink-900);          /* #121212 */
  --ct-card: var(--color-ct-ink-800);            /* #1c1c1f */
  --ct-inset: var(--color-ct-ink-1000);          /* #0a0a0b */
  --ct-text-primary: var(--color-ct-ink-50);     /* #f4f4f8 */
  --ct-text-secondary: var(--color-ct-ink-300);  /* #9a9aa4 */
  --ct-text-muted: var(--color-ct-ink-400);      /* #6b6b74 */
  --ct-ink-100: var(--color-ct-ink-100);         /* #e8e8ee */
  --ct-ink-200: var(--color-ct-ink-200);         /* #c9c9d1 */
  --ct-indigo-700: var(--color-ct-indigo-700);   /* #241f5f */
  --ct-blue-600: var(--color-ct-blue-600);       /* #475fb1 */
  --ct-blue-500: var(--color-ct-blue-500);       /* #6178c2 */
  --ct-blue-400: var(--color-ct-blue-400);       /* #8b9dd6 */
  --ct-violet-600: var(--color-ct-violet-600);   /* #a05cdc */
  --ct-violet-500: var(--color-ct-violet-500);   /* #b47ce4 */
  --ct-green-500: var(--color-ct-green-500);     /* #3fbf8f */
  --ct-amber-500: var(--color-ct-amber-500);     /* #e0a23c */
  --ct-red-500: var(--color-ct-red-500);         /* #e2564b */

  /* Traço, tinta e sombra derivados da rampa neutra sobre canvas quase preto */
  --ct-border-subtle: rgba(255,255,255,.07);
  --ct-border-default: rgba(255,255,255,.13);
  --ct-border-strong: rgba(255,255,255,.22);
  --ct-tint-blue: rgba(71,95,177,.14);
  --ct-tint-violet: rgba(160,92,220,.14);
  --ct-shadow-sm: 0 2px 8px rgba(0,0,0,.45);
  --ct-gradient-brand: linear-gradient(135deg, var(--ct-indigo-700) 0%, var(--ct-blue-600) 58%, var(--ct-violet-600) 100%);
  --ct-gradient-rule: linear-gradient(90deg, var(--ct-blue-600) 0%, var(--ct-violet-600) 100%);

  --ct-r-sm: 8px;
  --ct-r-md: 12px;
  --ct-r-xl: 24px;
  --ct-max: 1180px;
  --ct-ease: cubic-bezier(.2,.8,.2,1);

  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--ct-canvas);
  color: var(--ct-text-primary);
  font-family: var(--font-ct-sans);
  font-size: 16px;
  line-height: 1.6;
}

.ct-root *, .ct-root *::before, .ct-root *::after { box-sizing: border-box; }

/* Reset de elemento em :where() para especificidade ZERO: sem isso
   \`.ct-root h3\` (0,1,1) venceria \`.ct-prop-titulo\` (0,1,0). */
:where(.ct-root h1, .ct-root h2, .ct-root h3, .ct-root p, .ct-root ul, .ct-root ol) {
  margin: 0;
  color: inherit;
  font-family: inherit;
  letter-spacing: inherit;
  line-height: inherit;
}
:where(.ct-root button) { font: inherit; color: inherit; background: none; border: 0; }
.ct-root a { color: var(--ct-blue-400); text-decoration: none; }
.ct-root a:hover { color: var(--ct-violet-500); }

/* ============================ CABEÇALHO ============================ */

.ct-topo {
  position: sticky; top: 0; z-index: 20;
  background: rgba(18,18,18,.88);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--ct-border-subtle);
}
.ct-topo-in {
  max-width: var(--ct-max); margin: 0 auto; padding: 12px 20px 0;
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px;
}
.ct-marca { display: flex; align-items: baseline; gap: 10px; padding-bottom: 10px; }
.ct-marca-nome { font-weight: 700; font-size: 18px; letter-spacing: .14em; }
.ct-marca-ponto { color: var(--ct-violet-600); font-size: 18px; font-weight: 700; line-height: 1; }
.ct-marca-sub { color: var(--ct-text-muted); font-size: 12px; font-weight: 500; letter-spacing: .04em; }
.ct-topo-espaco { flex: 1 1 40px; }

.ct-nav { display: flex; gap: 2px; overflow-x: auto; max-width: 100%; }
.ct-aba {
  position: relative; padding: 10px 12px 14px;
  font-size: 14px; font-weight: 500; color: var(--ct-ink-200);
  cursor: pointer; white-space: nowrap;
  transition: color 140ms var(--ct-ease);
}
.ct-aba:hover { color: var(--ct-text-primary); }
.ct-aba[aria-selected="true"] { color: var(--ct-text-primary); }
.ct-aba[aria-selected="true"]::after {
  content: ""; position: absolute; left: 10px; right: 10px; bottom: 0;
  height: 2px; background: var(--ct-violet-600); border-radius: 2px;
}

.ct-main { flex: 1 1 auto; width: 100%; max-width: var(--ct-max); margin: 0 auto; padding: 32px 20px 96px; }

.ct-rodape { border-top: 1px solid var(--ct-border-subtle); padding: 28px 20px 44px; }
.ct-rodape-in {
  max-width: var(--ct-max); margin: 0 auto;
  display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between;
  font-size: 12px; color: var(--ct-text-muted);
}

/* ============================ PRIMITIVAS ============================ */

.ct-overline {
  font-size: 11px; font-weight: 600; letter-spacing: .14em;
  text-transform: uppercase; color: var(--ct-violet-500);
}
.ct-h1 { font-size: 40px; line-height: 1.08; font-weight: 700; letter-spacing: -.025em; max-width: 20ch; }
.ct-lede { max-width: 58ch; color: var(--ct-text-secondary); font-size: 17px; text-wrap: pretty; }

/* SectionHeading do design system: overline, título, régua-assinatura, lede. */
.ct-sh { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.ct-sh-titulo { font-size: 32px; font-weight: 600; line-height: 1.2; letter-spacing: -.012em; }
.ct-sh-regra { width: 64px; height: 3px; border-radius: 2px; background: var(--ct-gradient-rule); }
.ct-sh-lede { max-width: 56ch; font-size: 18px; line-height: 1.6; color: var(--ct-text-secondary); text-wrap: pretty; }

.ct-card {
  background: var(--ct-card); border: 1px solid var(--ct-border-subtle);
  border-radius: var(--ct-r-md); box-shadow: var(--ct-shadow-sm);
}
.ct-plano-card, .ct-frente, .ct-dim, .ct-ws, .ct-prospec {
  background: var(--ct-card); border: 1px solid var(--ct-border-subtle);
  border-radius: var(--ct-r-md);
}

/* Badge: altura 22, pílula, versalete largo. Cores vêm por style inline. */
.ct-selo {
  display: inline-flex; align-items: center; gap: 6px;
  height: 22px; padding: 0 10px; border-radius: 999px;
  font-size: 11px; font-weight: 600; letter-spacing: .14em;
  text-transform: uppercase; white-space: nowrap;
}

/* Tag: chip de taxonomia, selecionável. */
.ct-tag {
  display: inline-flex; align-items: center; height: 30px; padding: 0 14px;
  border-radius: 999px; background: transparent; color: var(--ct-text-secondary);
  border: 1px solid var(--ct-border-default);
  font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap;
  transition: background-color 140ms var(--ct-ease), color 140ms var(--ct-ease), border-color 140ms var(--ct-ease);
}
.ct-tag:hover { background: var(--ct-tint-violet); color: var(--ct-text-primary); }
.ct-tag[aria-pressed="true"] {
  background: var(--ct-violet-600); color: var(--ct-inset); border-color: var(--ct-violet-600);
}

.ct-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; padding: 0 14px; border-radius: var(--ct-r-sm);
  font-size: 14px; font-weight: 600; letter-spacing: .01em; line-height: 1;
  cursor: pointer; white-space: nowrap;
  transition: background-color 140ms var(--ct-ease), border-color 140ms var(--ct-ease), transform 140ms var(--ct-ease);
}
.ct-btn:active { transform: scale(.985); }
.ct-btn-outline { background: transparent; color: var(--ct-text-primary); border: 1px solid var(--ct-border-strong); }
.ct-btn-outline:hover { background: var(--ct-tint-blue); border-color: var(--ct-blue-500); }
.ct-btn-primario { background: var(--ct-blue-600); color: var(--color-ct-ink-0); border: 1px solid var(--ct-blue-600); }
.ct-btn-primario:hover { background: var(--ct-blue-500); border-color: var(--ct-blue-500); transform: translateY(-2px); }

/* Linha genérica: usada por concedentes, indicações, parlamentares, ações. */
.ct-linha {
  display: flex; flex-wrap: wrap; gap: 16px; align-items: center;
  background: var(--ct-card); border: 1px solid var(--ct-border-subtle);
  border-radius: var(--ct-r-md); padding: 16px 20px;
}
.ct-col { min-width: 0; }
.ct-col-n { font-size: 20px; font-weight: 600; }
.ct-col-l { font-size: 11px; color: var(--ct-text-muted); }
.ct-pilha { display: flex; flex-direction: column; }

/* ============================ COCKPIT ============================ */

.ct-kpi-n { font-size: 32px; font-weight: 600; letter-spacing: -.02em; line-height: 1.1; }
.ct-kpi-l { margin-top: 6px; font-size: 13px; color: var(--ct-text-secondary); line-height: 1.4; }

.ct-kpi-op {
  flex: 1 1 260px; background: var(--ct-tint-violet);
  border: 1px solid rgba(160,92,220,.35); border-radius: var(--ct-r-md); padding: 20px 22px;
}
.ct-kpi-op-n { margin-top: 6px; font-size: 30px; font-weight: 600; letter-spacing: -.02em; line-height: 1.1; }
.ct-kpi-op-l { margin-top: 2px; font-size: 13px; color: var(--ct-ink-100); line-height: 1.45; }

.ct-acao { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; background: var(--ct-card); border-radius: var(--ct-r-md); padding: 18px 20px; box-shadow: var(--ct-shadow-sm); }
.ct-acao-t { font-size: 17px; font-weight: 600; line-height: 1.35; letter-spacing: -.01em; }
.ct-acao-d { margin-top: 3px; font-size: 13px; color: var(--ct-text-secondary); line-height: 1.5; }
.ct-acao-prazo { flex: 0 0 130px; text-align: right; }
.ct-acao-prazo-n { font-size: 22px; font-weight: 600; line-height: 1.1; }

.ct-frente { flex: 1 1 300px; padding: 22px; }
.ct-frente-topo { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.ct-frente-nome { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; }
.ct-frente-n { font-size: 22px; font-weight: 600; letter-spacing: -.02em; }
.ct-lista-itens { padding-left: 16px; font-size: 14px; color: var(--ct-text-secondary); line-height: 1.7; }

/* ============================ CARTEIRA ============================ */

.ct-prop {
  background: var(--ct-card); border: 1px solid var(--ct-border-subtle);
  border-radius: var(--ct-r-md); padding: 20px 22px; box-shadow: var(--ct-shadow-sm);
}
.ct-prop-titulo { font-size: 19px; font-weight: 600; line-height: 1.3; letter-spacing: -.015em; margin-bottom: 8px; }
.ct-prop-objeto { font-size: 14px; color: var(--ct-text-secondary); line-height: 1.55; max-width: 66ch; margin-bottom: 10px; }
.ct-prop-meta { display: flex; flex-wrap: wrap; gap: 6px 20px; font-size: 13px; color: var(--ct-text-secondary); }
.ct-prop-meta strong { font-weight: 400; color: var(--ct-text-primary); }

.ct-valor-box {
  background: var(--ct-inset); border: 1px solid var(--ct-border-subtle);
  border-radius: var(--ct-r-sm); padding: 14px 16px;
}
.ct-valor-rot { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--ct-text-muted); }
.ct-valor-n { font-size: 26px; font-weight: 600; letter-spacing: -.02em; line-height: 1.15; }
.ct-valor-sep { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--ct-border-subtle); }
.ct-valor-validado { font-size: 15px; font-weight: 500; color: var(--ct-amber-500); }

.ct-gates { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--ct-border-subtle); }
.ct-gate {
  display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 11px;
  border-radius: 999px; font-size: 12px; font-weight: 500;
}

/* ============================ MUNICÍPIOS ============================ */

.ct-muni-btn {
  flex: 1 1 250px; text-align: left; padding: 18px;
  background: var(--ct-card); border: 1px solid var(--ct-border-subtle);
  border-radius: var(--ct-r-md); color: var(--ct-text-primary); cursor: pointer;
  box-shadow: var(--ct-shadow-sm);
  transition: transform 140ms var(--ct-ease), border-color 140ms var(--ct-ease);
}
.ct-muni-btn:hover { border-color: var(--ct-border-strong); transform: translateY(-2px); }
.ct-muni-nome { display: block; font-size: 17px; font-weight: 600; letter-spacing: -.01em; }
.ct-muni-meta { display: block; margin-top: 6px; font-size: 12px; color: var(--ct-text-muted); line-height: 1.5; }

.ct-hero { border-radius: var(--ct-r-xl); padding: 36px 32px; background: var(--ct-gradient-brand); }
.ct-hero-over { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.72); }
.ct-hero-h1 { margin: 10px 0 16px; font-size: 48px; line-height: 1.02; font-weight: 700; letter-spacing: -.025em; color: #fff; }
.ct-hero-frase { max-width: 44ch; font-size: 21px; line-height: 1.4; color: #fff; text-wrap: pretty; }
.ct-hero-decisao { margin-top: 12px; max-width: 46ch; font-size: 16px; line-height: 1.5; color: rgba(255,255,255,.85); }
.ct-hero-stats { display: flex; flex-wrap: wrap; gap: 28px; margin-top: 26px; }
.ct-hero-stat-n { font-size: 26px; font-weight: 600; line-height: 1.1; color: #fff; letter-spacing: -.02em; }
.ct-hero-stat-l { font-size: 12px; color: rgba(255,255,255,.72); }

.ct-dim { flex: 1 1 220px; padding: 16px 18px; }
.ct-dim-k { font-size: 12px; color: var(--ct-text-muted); }
.ct-dim-v { margin-top: 4px; font-size: 18px; font-weight: 600; letter-spacing: -.01em; }

.ct-muni-prop { background: var(--ct-card); border: 1px solid var(--ct-border-subtle); border-radius: var(--ct-r-md); padding: 18px 20px; }
.ct-muni-prop-t { margin-bottom: 6px; font-size: 18px; font-weight: 600; line-height: 1.35; letter-spacing: -.01em; }
.ct-muni-prop-e { font-size: 13px; color: var(--ct-text-secondary); line-height: 1.55; max-width: 62ch; }

.ct-plano-card { flex: 1 1 280px; padding: 22px; }
.ct-plano-bloco { margin-bottom: 12px; font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; }
.ct-plano-itens { padding-left: 18px; font-size: 15px; line-height: 1.65; color: var(--ct-ink-100); }

/* ============================ ARTICULAÇÃO / INTELIGÊNCIA ============================ */

.ct-peca {
  background: var(--ct-tint-blue); border: 1px solid rgba(71,95,177,.35);
  border-radius: var(--ct-r-md); padding: 26px;
}
.ct-peca-over { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--ct-blue-400); }
.ct-h2 { font-size: 21px; font-weight: 600; letter-spacing: -.01em; }
.ct-h2-grande { font-size: 26px; font-weight: 600; letter-spacing: -.02em; }
.ct-nota { max-width: 62ch; font-size: 14px; color: var(--ct-text-secondary); }

.ct-ws { flex: 1 1 200px; padding: 18px; }
.ct-barra-trilho { display: block; height: 6px; border-radius: 3px; background: rgba(255,255,255,.07); overflow: hidden; }
.ct-barra-preenchida { display: block; height: 6px; border-radius: 3px; }

.ct-anat { display: flex; flex-wrap: wrap; gap: 14px; align-items: baseline; background: var(--ct-card); border: 1px solid var(--ct-border-subtle); border-radius: var(--ct-r-sm); padding: 13px 16px; }
.ct-prospec { flex: 1 1 300px; padding: 20px; border-color: rgba(160,92,220,.35); }
.ct-elo { background: var(--ct-card); border: 1px solid var(--ct-border-subtle); border-radius: var(--ct-r-sm); padding: 10px 14px; font-size: 14px; }

.ct-dilig { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; background: var(--ct-card); border-radius: var(--ct-r-md); padding: 18px 20px; }
.ct-dilig-dias { flex: 0 0 62px; text-align: center; }
.ct-dilig-n { font-size: 26px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
.ct-dilig-u { font-size: 10px; color: var(--ct-text-muted); letter-spacing: .06em; text-transform: uppercase; }

.ct-ressalva { background: var(--ct-card); border: 1px solid var(--ct-border-subtle); border-radius: var(--ct-r-md); padding: 24px; }
.ct-ressalva p { max-width: 66ch; line-height: 1.6; }

/* ============================ UTILITÁRIAS ============================ */

.ct-col-flex { display: flex; flex-direction: column; }
.ct-row-wrap { display: flex; flex-wrap: wrap; }

/* ============================ TELAS ESTREITAS ============================ */
/*
   A ficha municipal é feita para o prefeito abrir no próprio celular — o
   protótipo a apresenta numa moldura de 390 px. Abaixo de 640 px as colunas
   de largura fixa passam a ocupar a linha inteira: sem isso, as três colunas
   de 130 px dos concedentes espremem o nome em duas letras por linha.
*/
@media (max-width: 640px) {
  .ct-main { padding: 24px 16px 72px; }
  .ct-h1 { font-size: 30px; }
  .ct-hero { padding: 26px 20px; }
  .ct-hero-h1 { font-size: 34px; }
  .ct-hero-frase { font-size: 18px; }
  .ct-sh-titulo { font-size: 24px; }
  .ct-h2-grande { font-size: 21px; }
  .ct-acao-prazo, .ct-linha > [class*="ct-col"], .ct-linha > div { flex-basis: 100%; text-align: left; }
  .ct-acao-prazo { text-align: left; }
  .ct-marca-sub { display: none; }
}

/* ============================ IMPRESSÃO ============================ */
/*
   "Imprimir uma página" é um recurso declarado da ficha municipal, e uma
   superfície quase preta não sobrevive à impressão: o navegador descarta o
   fundo por padrão e sobra texto quase branco em papel branco — folha vazia.
   Por isso a impressão reescreve os tokens para tinta sobre papel, em vez de
   apenas esconder o cromo. O gradiente do hero vira régua, não bloco chapado.
*/
@media print {
  .no-print { display: none !important; }
  .ct-root {
    --ct-canvas: #fff;
    --ct-card: #fff;
    --ct-inset: #fff;
    --ct-text-primary: #121212;
    --ct-text-secondary: #44444c;
    --ct-text-muted: #6b6b74;
    --ct-ink-100: #1c1c1f;
    --ct-ink-200: #1c1c1f;
    --ct-border-subtle: rgba(18,18,18,.16);
    --ct-border-default: rgba(18,18,18,.24);
    --ct-shadow-sm: none;
    min-height: 0;
  }
  .ct-hero {
    background: #fff; color: var(--ct-text-primary);
    border-top: 4px solid var(--ct-violet-600); border-radius: 0;
    padding: 0 0 18px;
  }
  .ct-hero-h1, .ct-hero-frase, .ct-hero-stat-n { color: var(--ct-text-primary); }
  .ct-hero-over, .ct-hero-decisao, .ct-hero-stat-l { color: var(--ct-text-secondary); }
  /*
     O selo sólido pinta o fundo com a cor do tom e o texto quase branco. O
     navegador descarta fundo na impressão por padrão, então sobraria texto
     branco em papel branco. Na folha ele vira contorno — o rótulo já carrega
     o estado por escrito, e é ele que precisa sobreviver, não a cor.
     \`!important\` porque as cores do selo vêm por style inline.
  */
  .ct-selo {
    background: transparent !important;
    color: var(--ct-text-primary) !important;
    border: 1px solid var(--ct-border-default) !important;
  }
  .ct-prop, .ct-muni-prop, .ct-plano-card, .ct-dim, .ct-linha, .ct-card { break-inside: avoid; }
  .ct-rodape { border-top: 1px solid var(--ct-border-subtle); padding: 12px 0 0; }
}
`;
