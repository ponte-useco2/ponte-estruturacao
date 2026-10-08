/**
 * Um termo do glossário no meio do texto (B7, 08/10/2026): a palavra ganha sublinhado pontilhado e, ao ser acionada,
 * abre a explicação curta e o link para a entrada inteira em `/mapa/glossario`.
 *
 * Sem JavaScript: é o atributo HTML `popover` com `popovertarget` num `<button>`. O navegador cuida do resto, e do
 * mesmo jeito para mouse, toque e teclado: Enter ou espaço abrem, Esc e o clique fora fecham, o Tab segue do botão
 * para dentro do balão. Nunca só `title`, que não aparece no toque nem no foco (achado H11 da auditoria de 08/10).
 * Para o leitor de tela é um botão de abrir e fechar: o estado expandido/recolhido o navegador expõe sozinho pelo
 * `popovertarget` (HTML-AAM), e o `aria-controls` diz qual painel ele abre. Não há `aria-expanded` escrito à mão de
 * propósito: sem JavaScript ele ficaria parado em "false" com o balão aberto e mentiria. Tudo é `<span>` porque o
 * termo vive dentro de parágrafos e células, onde `<div>` quebraria o HTML; o balão sai na camada superior, então não
 * é cortado por tabela com rolagem.
 *
 * O `id` vem do `useId` (vale também em componente de servidor) e dá nome à âncora do CSS: onde o navegador tem
 * posicionamento por âncora, o balão aparece junto da palavra; onde não tem, aparece centrado na tela.
 *
 * Slug desconhecido não quebra a página: mostra só o texto. Mas o tipo `SlugTermo` já barra o erro na compilação.
 */
import Link from "next/link";
import { useId, type CSSProperties, type ReactNode } from "react";
import { termoPorSlug, urlTermo, type SlugTermo } from "@/lib/oportunidades/glossario";
import "./termo.css";

export function Termo({ slug, children }: { slug: SlugTermo; children?: ReactNode }) {
  const id = useId();
  const t = termoPorSlug(slug);
  if (!t) return <>{children}</>;
  const painel = `termo${id.replace(/[^A-Za-z0-9_-]/g, "")}`;
  // A âncora é herdada pelo botão (anchor-name) e pelo balão (position-anchor): um nome por termo na página.
  const ancora = { "--mp-termo-ancora": `--${painel}` } as CSSProperties;
  return (
    <span className="mp-termo" style={ancora}>
      <button type="button" className="mp-termo-botao" popoverTarget={painel} aria-controls={painel}>
        {children ?? t.termo}
      </button>
      <span id={painel} popover="auto" className="mp-termo-painel">
        <span className="mp-termo-cabeca">
          <strong className="mp-termo-nome">{t.termo}</strong>
          <button type="button" className="mp-termo-fechar" popoverTarget={painel} popoverTargetAction="hide" aria-label="Fechar a explicação">
            <span aria-hidden="true">×</span>
          </button>
        </span>
        <span className="mp-termo-curta">{t.curta}</span>
        <Link href={urlTermo(t.slug)} className="mp-termo-link" prefetch={false}>
          Ver no glossário
        </Link>
      </span>
    </span>
  );
}
