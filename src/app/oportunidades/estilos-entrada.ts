/**
 * Estilos das telas de entrada e espera da /oportunidades.
 *
 * Ficam num módulo compartilhado porque as duas telas são a mesma peça em
 * momentos diferentes — duplicar o CSS faria as duas divergirem na primeira
 * vez que alguém mexesse numa só.
 *
 * Tokens espelham o painel (--op-*), com literais como fallback: estas telas
 * não carregam o CSS do painel e não podem depender dele.
 */
export const estilosEntrada = `
  .op-entrar-root {
    min-height: 100dvh;
    background: var(--op-bg, #FCFCFB);
    color: var(--op-ink, #2E2C27);
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
    display: flex; align-items: center; justify-content: center;
    padding: 40px 20px; line-height: 1.6;
  }
  .op-entrar-wrap { width: 100%; max-width: 460px; }
  .op-entrar-marca {
    font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase;
    color: var(--op-clay, #C6613F); margin-bottom: 14px; font-weight: 600;
  }
  .op-entrar-titulo {
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 600; font-size: 32px; line-height: 1.18;
    letter-spacing: -.015em; margin: 0 0 10px;
    color: var(--op-ink, #2E2C27);
  }
  .op-entrar-sub {
    font-size: 15px; color: var(--op-soft, #6B6A63); margin: 0 0 28px;
  }
  .op-entrar-card {
    background: #fff; border: 1px solid var(--op-hair, #E4E3DC);
    border-radius: 12px; padding: 24px;
  }
  .op-entrar-btn {
    width: 100%; display: flex; align-items: center; justify-content: center;
    gap: 10px; padding: 12px 20px;
    background: #fff; color: #2E2C27;
    border: 1px solid #D6D5CC; border-radius: 8px;
    font: inherit; font-size: 15px; font-weight: 600;
    cursor: pointer; transition: background 140ms ease, border-color 140ms ease;
  }
  .op-entrar-btn:hover:not(:disabled) { background: #F7F7F4; border-color: #B4B3A8; }
  .op-entrar-btn:disabled { opacity: .6; cursor: not-allowed; }
  .op-entrar-btn:focus-visible { outline: 2px solid #C6613F; outline-offset: 2px; }
  .op-entrar-erro {
    background: rgba(198,97,63,.08); border: 1px solid #C6613F; color: #A44C2E;
    border-radius: 8px; padding: 10px 14px; font-size: 13.5px; margin-bottom: 16px;
  }
  .op-entrar-nota {
    font-size: 13px; color: var(--op-soft, #6B6A63); margin: 16px 0 0;
  }
  .op-entrar-lgpd {
    margin-top: 22px; font-size: 13px; color: var(--op-soft, #6B6A63);
    border-top: 1px solid var(--op-hair, #E4E3DC); padding-top: 16px;
  }
  .op-entrar-lgpd summary {
    cursor: pointer; font-weight: 600; color: var(--op-ink, #2E2C27);
    list-style: revert;
  }
  .op-entrar-lgpd summary:focus-visible { outline: 2px solid #C6613F; outline-offset: 3px; }
  .op-entrar-lgpd p { margin: 12px 0 0; line-height: 1.55; }
  .op-entrar-lgpd a { color: #C6613F; }
  .op-entrar-voltar {
    display: inline-block; margin-top: 22px; font-size: 13px;
    color: var(--op-soft, #6B6A63); text-decoration: none;
  }
  .op-entrar-voltar:hover { color: var(--op-ink, #2E2C27); }
  .op-espera-passos {
    list-style: none; padding: 0; margin: 18px 0 0;
    font-size: 14px; color: var(--op-soft, #6B6A63);
  }
  .op-espera-passos li {
    padding: 8px 0 8px 26px; position: relative;
    border-top: 1px solid var(--op-hair, #E4E3DC);
  }
  .op-espera-passos li::before {
    content: "○"; position: absolute; left: 4px; color: #B4B3A8;
  }
  .op-espera-passos li.feito::before { content: "●"; color: #5C7A5C; }
  .op-espera-passos li.feito { color: var(--op-ink, #2E2C27); }
  @media (max-width: 480px) { .op-entrar-titulo { font-size: 26px; } }
`;
