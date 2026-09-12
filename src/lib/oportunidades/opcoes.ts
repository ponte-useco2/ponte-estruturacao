/**
 * As opções que a pessoa pode marcar, tiradas do catálogo publicado.
 *
 * Por que do catálogo, e não de uma lista fixa: órgão e natureza mudam com o
 * tempo, e oferecer uma opção que não existe em janela nenhuma é prometer um
 * destaque que nunca vai aparecer.
 *
 * Os temas são a exceção: a lista é fixa (`temas.ts`) e aparece inteira, mesmo
 * a que hoje não tem nenhuma janela. A contagem ao lado é o que impede a
 * escolha às cegas — no catálogo de 11/09/2026, só 40 das 150 janelas tinham
 * algum tema, e esconder isso seria vender relevância que o dado não tem.
 */
import type { Oportunidade } from "./contrato";
import { TEMAS, temasDaJanela } from "./temas.ts";

export interface OpcaoContada {
  valor: string;
  rotulo: string;
  janelas: number;
}

export interface OpcoesPreferencia {
  temas: OpcaoContada[];
  orgaos: OpcaoContada[];
  naturezas: OpcaoContada[];
}

type JanelaComEixos = Pick<Oportunidade, "temas" | "orgao" | "natureza">;

function contar(valores: (string | undefined)[]): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const v of valores) {
    if (!v) continue;
    contagem.set(v, (contagem.get(v) ?? 0) + 1);
  }
  return contagem;
}

/** Mais janelas primeiro; empate resolvido pelo nome, para a ordem ser estável. */
function ordenar(contagem: Map<string, number>): OpcaoContada[] {
  return [...contagem.entries()]
    .map(([valor, janelas]) => ({ valor, rotulo: valor, janelas }))
    .sort((a, b) => b.janelas - a.janelas || a.valor.localeCompare(b.valor, "pt-BR"));
}

export function opcoesDePreferencia(janelas: JanelaComEixos[]): OpcoesPreferencia {
  const porTema = contar(janelas.flatMap((j) => temasDaJanela(j.temas)));

  return {
    temas: TEMAS.map((t) => ({ valor: t.id, rotulo: t.rotulo, janelas: porTema.get(t.id) ?? 0 })),
    orgaos: ordenar(contar(janelas.map((j) => j.orgao))),
    naturezas: ordenar(contar(janelas.map((j) => j.natureza))),
  };
}
