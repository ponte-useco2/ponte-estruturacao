/**
 * A descida em 3D entre as páginas de nível (onda 16, M0, 27/10/2026; opção (c) da folha C3b).
 *
 * Fica em volta do conteúdo, dentro do `<main>` da moldura. A moldura é do layout e não renderiza de novo na
 * navegação, então a transição é de atualização (`update`): o React tira uma foto do conteúdo antes e outra depois, e o
 * CSS (`transicoes.css`) anima as duas conforme o tipo que o link levou. `mp-descer` faz a página afundar enquanto a
 * próxima chega da frente; `mp-subir` faz o contrário. Sem tipo (troca de aba, janelas, busca, voltar do navegador), não
 * anima nada (`default: "none"`), como sempre foi.
 *
 * O cabeçalho fica fora da foto: ele é a âncora parada enquanto o conteúdo se move. Sem "use client": o
 * `<ViewTransition>` vale no servidor.
 *
 * Onda 19: o voltar e o avançar do navegador, que não levam tipo, ganham a direção pelo `VoltaDoNavegador`.
 */
import { ViewTransition, type ReactNode } from "react";
import { TIPO_DESCER, TIPO_SUBIR } from "@/lib/oportunidades/descida";
import { VoltaDoNavegador } from "./VoltaDoNavegador";
import "./transicoes.css";
import "./movimento.css";

const POR_TIPO = { [TIPO_DESCER]: "mp-descer", [TIPO_SUBIR]: "mp-subir", default: "none" } as const;

export function Descida({ children }: { children: ReactNode }) {
  return (
    <>
      <VoltaDoNavegador />
      <ViewTransition update={POR_TIPO} enter="none" exit="none" default="none">
        {children}
      </ViewTransition>
    </>
  );
}

/**
 * O esqueleto que sai (onda 16, M0): quando o dado chega e o `loading.tsx` dá lugar à página, o esqueleto se apaga em
 * 0,15 s em vez de sumir de uma vez. A página nova aparece já no lugar, sem deslocamento.
 */
export function SaidaDoEsqueleto({ children }: { children: ReactNode }) {
  return (
    <ViewTransition exit="mp-esqueleto-sai" enter="none" update="none" default="none">
      {children}
    </ViewTransition>
  );
}
