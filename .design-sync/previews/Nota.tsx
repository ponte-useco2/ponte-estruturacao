import { Nota } from "ponte-app";

/** Nota curta ao lado de um controle, explicando o que acontece com o dado. */
export const AoLadoDoControle = () => (
  <div style={{ maxWidth: 420 }}>
    <Nota>Guardamos o que você marcar aqui, ligado à sua conta, só para destacar janelas. Desmarcar apaga.</Nota>
  </div>
);

/** Nota de procedência, abaixo de uma lista. */
export const Procedencia = () => (
  <div style={{ maxWidth: 420 }}>
    <Nota>Catálogo processado em 10/09/2026 às 21:04. Dados do Transferegov, publicados uma vez por dia.</Nota>
  </div>
);
