/**
 * A trilha "Onde você está" (B11, 08/10/2026; achados H08 e A14 da auditoria B1+B2): um componente só, em todas as
 * páginas da descida — Brasil, UF, município, entidade, as subpáginas do município, o convênio, a proposta e o laudo.
 * Os elos vêm prontos de `lib/oportunidades/trilha.ts` (com teste); aqui só se desenha.
 *
 * - Lista ordenada (`<ol>`) dentro de um `<nav>` com nome: o leitor de tela anuncia "navegação, Onde você está, lista,
 *   5 itens" e diz a posição de cada elo. O separador "›" é do CSS e fica fora da leitura (mapa.css, auditoria A01).
 * - O último elo é a página aberta: texto com `aria-current="page"`, sem link.
 * - Os links são `LinkMapa` (sem pré-carga e com o `Carregando` dentro).
 * - A classe `mp-mun-trilha` vai na lista para reaproveitar o desenho do mapa.css (fileira, cor, separador, elo atual
 *   em negrito, link sublinhado); o `trilha.css` só acrescenta o que a lista pede e o alvo de toque de 44 px no celular.
 *
 * Sem "use client": vale em componente de servidor e de cliente.
 */
import type { Elo } from "@/lib/oportunidades/trilha";
import { LinkMapa } from "./LinkMapa";
import "./trilha.css";

export function Trilha({ elos }: { elos: readonly Elo[] }) {
  if (!elos.length) return null;
  const ultimo = elos.length - 1;
  return (
    <nav aria-label="Onde você está" className="mp-trilha">
      <ol className="mp-mun-trilha">
        {elos.map((e, i) => (
          <li key={`${i}-${e.rotulo}`}>
            {i === ultimo ? <span aria-current="page">{e.rotulo}</span> : e.href ? <LinkMapa href={e.href}>{e.rotulo}</LinkMapa> : <span>{e.rotulo}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
