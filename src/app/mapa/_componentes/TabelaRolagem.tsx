/**
 * A caixa que rola as tabelas largas de lado (onda 2 de UX, B9, 08/10/2026; auditoria B1+B2, A08 e A09).
 *
 * A `<div className="mp-tabela-rolagem">` de antes rolava, mas não recebia foco: numa tabela só de números, sem link,
 * quem usa o teclado não alcançava as colunas da direita no Safari e no Firefox, que não tornam a caixa focável por
 * conta própria. Agora ela entra no Tab (`tabIndex={0}`), as setas rolam a tabela, o foco aparece (mapa.css) e o
 * leitor de tela anuncia uma região com o nome da tabela:
 * - `rotuloId`: o id do título que já está na tela (h2/h3), por `aria-labelledby` — o preferido, não repete texto;
 * - `rotulo`: o texto, por `aria-label`, quando o título não tem id ou é um componente.
 * Sem estado e sem JavaScript: serve a Server e a Client Component. As classes extras (`className`) somam-se a
 * `mp-tabela-rolagem`, que continua sendo a do CSS.
 */
import type { ReactNode } from "react";

type Nome =
  | {
      /** O texto que nomeia a tabela (vira `aria-label`). */
      rotulo: string;
      rotuloId?: never;
    }
  | {
      /** O id do título visível que nomeia a tabela (vira `aria-labelledby`). */
      rotuloId: string;
      rotulo?: never;
    };

export function TabelaRolagem({ rotulo, rotuloId, className, children }: Nome & { className?: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={rotuloId ? undefined : rotulo}
      aria-labelledby={rotuloId}
      tabIndex={0}
      className={className ? `mp-tabela-rolagem ${className}` : "mp-tabela-rolagem"}
    >
      {children}
    </div>
  );
}
