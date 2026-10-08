/**
 * Mapa 2D de navegação (U2, 08/10/2026): a malha do IBGE em SVG, cada área um link para a página dela (UF ou
 * município). Cor só por região (decisão do titular: nunca cor de problema). Server Component, sem JavaScript: o
 * nome aparece no `title` (dica do navegador), e a tabela continua sendo a forma completa de navegar. Links simples
 * (`<a>`): nada de pré-carga.
 *
 * Teclado e leitor de tela (onda 2 de UX, B9, 08/10/2026; auditoria B1+B2, A02 e A15). Antes, o `role="img"` tirava
 * os links da árvore de acessibilidade, mas eles continuavam no Tab: 223 paradas sem nome na PB, na ordem da malha.
 * Agora há três modos, escolhidos pelo número de áreas com link (ou pela prop `navegavel`):
 * - **navegável** (até `LIMITE_NAVEGAVEL`, como as 27 UFs): o SVG é um grupo com o nome do mapa; cada área é um link
 *   com o nome no `<title>`, e a ordem do Tab é a alfabética do nome (a mesma da tabela das 27 UFs), não a da malha.
 *   Um "Pular o mapa" aparece no foco, antes da primeira área.
 * - **decorativo** (acima disso, como os 223 municípios da PB): o SVG sai da árvore de acessibilidade (`aria-hidden`)
 *   e os links saem do Tab (`tabIndex={-1}`); mouse e toque continuam abrindo a página. A legenda diz, em texto
 *   visível, onde está a lista com os mesmos links (`alternativa`).
 * - **imagem** (nenhuma área com link): uma figura com nome, como era.
 * O realce de foco e de passagem do mouse troca o preenchimento da área (mapa.css, A03).
 */
import type { ReactNode } from "react";
import type { AreaMapa, Malha } from "@/lib/oportunidades/pagina-brasil";

/**
 * Até quantas áreas com link o mapa entra no Tab. 27 paradas (as UFs), com "Pular o mapa" e em ordem alfabética,
 * são um caminho razoável; 223 (os municípios da PB) não são: a lista agrupada por região, logo abaixo, é o caminho.
 */
const LIMITE_NAVEGAVEL = 30;

const TEXTO_ALTERNATIVA = "Pelo teclado ou com leitor de tela, use a lista logo abaixo do mapa: ela tem os mesmos links.";

/** Um id estável a partir do título, para o "Pular o mapa" (o título já distingue os mapas de uma página). */
function idDoMapa(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `mp-mapa-${base || "territorio"}`;
}

export function MapaTerritorio({
  malha,
  areas,
  legenda,
  titulo,
  rotulos = false,
  navegavel,
  alternativa,
}: {
  malha: Malha;
  areas: ReadonlyMap<string, AreaMapa>;
  legenda: { grupo: number; rotulo: string }[];
  titulo: string;
  /** Escreve o id da área no centro dela (as siglas no mapa do Brasil). */
  rotulos?: boolean;
  /**
   * Força o modo: `true` põe as áreas no Tab, em ordem alfabética; `false` tira o mapa do Tab e do leitor de tela.
   * Sem a prop, decide pelo número de áreas com link (`LIMITE_NAVEGAVEL`).
   */
  navegavel?: boolean;
  /** No modo decorativo, o texto visível que diz onde estão os mesmos links (padrão: "a lista logo abaixo do mapa"). */
  alternativa?: ReactNode;
}) {
  const nomeDe = (id: string) => areas.get(id)?.nome ?? id;
  const comLink = malha.areas.filter((a) => areas.get(a.id)?.href);
  const modo = comLink.length === 0 ? "imagem" : (navegavel ?? comLink.length <= LIMITE_NAVEGAVEL) ? "navegavel" : "decorativo";
  const id = idDoMapa(titulo);

  // A ordem do DOM é a ordem do Tab e a de pintura. No modo navegável, as áreas sem link vêm antes (não entram no Tab)
  // e as com link em ordem alfabética; as áreas não se sobrepõem, então a troca não muda o desenho.
  const ordem =
    modo === "navegavel"
      ? [
          ...malha.areas.filter((a) => !areas.get(a.id)?.href),
          ...comLink.slice().sort((x, y) => nomeDe(x.id).localeCompare(nomeDe(y.id), "pt-BR")),
        ]
      : malha.areas;

  const atributosSvg =
    modo === "navegavel"
      ? ({ role: "group", "aria-label": titulo } as const)
      : modo === "decorativo"
        ? ({ "aria-hidden": true, focusable: "false" } as const)
        : ({ role: "img", "aria-label": titulo } as const);

  return (
    <figure className="mp-mapa">
      {modo === "navegavel" && (
        <a href={`#${id}-depois`} className="mp-mapa-pular">
          Pular o mapa
        </a>
      )}
      <svg viewBox={malha.viewBox} {...atributosSvg}>
        {ordem.map((a) => {
          const info = areas.get(a.id);
          const forma = <path d={a.d} className={`mp-mapa-g${info?.grupo ?? 0}`} />;
          // O nome vem do `<title>` (nome acessível do link no SVG); um `aria-label` igual faria o leitor de tela
          // repetir o nome como descrição.
          return info?.href ? (
            <a key={a.id} href={info.href} tabIndex={modo === "decorativo" ? -1 : undefined}>
              <title>{info.nome}</title>
              {forma}
            </a>
          ) : (
            <g key={a.id} aria-hidden={modo === "navegavel" ? true : undefined}>
              <title>{info?.nome ?? a.id}</title>
              {forma}
            </g>
          );
        })}
        {rotulos &&
          malha.areas.map((a) => (
            <text key={`r-${a.id}`} x={a.x} y={a.y} className="mp-mapa-rotulo" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
              {a.id}
            </text>
          ))}
      </svg>
      <figcaption id={modo === "navegavel" ? `${id}-depois` : undefined} tabIndex={modo === "navegavel" ? -1 : undefined}>
        <ul className="mp-mapa-legenda">
          {legenda.map((l) => (
            <li key={l.rotulo}>
              <span className={`mp-mapa-amostra mp-mapa-g${l.grupo}`} aria-hidden="true" />
              {l.rotulo}
            </li>
          ))}
        </ul>
        <span className="pa-nota">
          Malha: {malha.fonte}.
          {/* No papel não há toque nem teclado: a fonte fica, o resto sai (relatórios da onda 3, 08/10/2026). */}
          <span className="mp-nao-imprimir">
            {" "}Toque ou clique numa área para abrir a página dela.
            {modo === "navegavel" && " Pelo teclado, as áreas vêm em ordem alfabética."}
            {modo === "decorativo" && <> {alternativa ?? TEXTO_ALTERNATIVA}</>}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}
