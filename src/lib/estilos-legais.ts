/**
 * Estilos das páginas legais (/privacidade e /termos).
 *
 * Documento de leitura longa: coluna estreita, serifada no corpo, hierarquia
 * discreta. Segue a paleta do painel de oportunidades (--op-*), que é a mais
 * próxima de "papel", com literais como fallback — estas páginas não carregam
 * o CSS do painel.
 *
 * Fora de @layer de propósito: o @layer base do Tailwind pinta parágrafos e
 * títulos, e regra sem camada vence regra em camada sem precisar de
 * !important.
 */
export const estilosLegais = `
  .lg-root {
    background: var(--op-bg, #FCFCFB);
    color: var(--op-soft, #4A4842);
    min-height: 100dvh;
    padding: 56px 20px 96px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 16px;
    line-height: 1.7;
  }
  .lg-wrap { max-width: 680px; margin: 0 auto; }
  .lg-marca {
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
    font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase;
    color: var(--op-clay, #C6613F); font-weight: 600; margin-bottom: 14px;
  }
  .lg-root h1 {
    font-weight: 600; font-size: 34px; line-height: 1.2;
    letter-spacing: -.015em; margin: 0 0 10px;
    color: var(--op-ink, #2E2C27);
  }
  .lg-atualizado {
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
    font-size: 13px; color: var(--op-grey, #8A897F); margin: 0 0 36px;
  }
  .lg-root h2 {
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
    font-size: 12px; font-weight: 600; letter-spacing: .09em;
    text-transform: uppercase; color: var(--op-ink, #2E2C27);
    margin: 42px 0 14px; padding-top: 18px;
    border-top: 1px solid var(--op-hair, #E4E3DC);
  }
  .lg-root h3 {
    font-size: 17px; font-weight: 600; color: var(--op-ink, #2E2C27);
    margin: 26px 0 8px;
  }
  .lg-root p { margin: 0 0 16px; }
  .lg-root ul { margin: 0 0 16px; padding-left: 22px; }
  .lg-root li { margin-bottom: 8px; }
  .lg-root strong { color: var(--op-ink, #2E2C27); font-weight: 600; }
  .lg-root a { color: var(--op-clay, #C6613F); }
  .lg-tabela {
    width: 100%; border-collapse: collapse; margin: 0 0 20px;
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
    font-size: 14px; line-height: 1.5;
  }
  .lg-tabela th {
    text-align: left; font-size: 10.5px; letter-spacing: .07em;
    text-transform: uppercase; color: var(--op-grey, #8A897F);
    font-weight: 600; padding: 0 12px 8px 0;
    border-bottom: 1px solid var(--op-hair, #E4E3DC);
  }
  .lg-tabela td {
    padding: 12px 12px 12px 0; vertical-align: top;
    border-bottom: 1px solid var(--op-hair, #E4E3DC);
  }
  .lg-nota {
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
    font-size: 14px; line-height: 1.6;
    border-left: 2px solid var(--op-clay, #C6613F);
    padding: 4px 0 4px 16px; margin: 24px 0;
    color: var(--op-soft, #4A4842);
  }
  .lg-voltar {
    display: inline-block; margin-top: 40px;
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
    font-size: 13.5px; color: var(--op-soft, #4A4842); text-decoration: none;
  }
  .lg-voltar:hover { color: var(--op-ink, #2E2C27); }
  @media (max-width: 560px) {
    .lg-root { padding: 36px 18px 72px; font-size: 15.5px; }
    .lg-root h1 { font-size: 27px; }
    .lg-tabela, .lg-tabela tbody, .lg-tabela tr, .lg-tabela td { display: block; }
    .lg-tabela thead { display: none; }
    .lg-tabela td { border: none; padding: 2px 0; }
    .lg-tabela tr {
      border-bottom: 1px solid var(--op-hair, #E4E3DC); padding: 14px 0;
    }
  }
`;
