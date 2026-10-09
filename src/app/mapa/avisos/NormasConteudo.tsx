/**
 * Normas: portarias, instruções normativas e decretos que mudam as regras das transferências,
 * escolhidos pela equipe da PONTE. Só leitura; o cadastro fica em /oportunidades/admin.
 */
import { formatarData } from "@/lib/oportunidades/central";
import type { LeituraNormas } from "@/lib/oportunidades/favoritos.server";
import { ROTULO_TEMA } from "@/lib/oportunidades/temas";
import { LinkMapa } from "../_componentes/LinkMapa";

export function NormasConteudo({ leitura }: { leitura: LeituraNormas }) {
  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Mural de avisos</p>
        <h1 className="pa-titulo">Normas</h1>
        <p className="pa-sub">
          Portarias, instruções normativas e decretos que mudam as regras das transferências, escolhidos pela equipe da PONTE.
          Cada um leva ao texto oficial.
        </p>
      </div>

      {leitura.estado === "nao_ativado" ? (
        <p className="pa-cartao pa-cartao-plano">O mural de normas ainda não foi ativado.</p>
      ) : leitura.estado === "erro" ? (
        // B12b (onda 3 de UX, 08/10/2026): o "Tente de novo" virou link para o próprio mural.
        <div className="pa-cartao pa-cartao-plano pa-pilha">
          <p>Não foi possível ler as normas agora. Costuma ser passageiro: tente de novo em alguns minutos.</p>
          <p className="pa-linha">
            <LinkMapa href="/mapa/avisos?mural=normas" className="pa-btn pa-btn-pequeno">
              Tentar de novo
            </LinkMapa>
          </p>
        </div>
      ) : leitura.normas.length === 0 ? (
        // B12b: o mural vazio diz o que vai aparecer aqui e para onde ir enquanto isso.
        <div className="pa-cartao pa-cartao-plano pa-pilha">
          <p>Nenhuma norma publicada no mural ainda.</p>
          <p>
            Quando a equipe da PONTE publicar uma portaria, instrução normativa ou decreto que mude as regras das transferências, a norma aparece
            aqui, com o link para o texto oficial.
          </p>
          <p className="pa-linha">
            <LinkMapa href="/mapa" className="pa-btn pa-btn-pequeno">
              Ver as janelas abertas
            </LinkMapa>
            <LinkMapa href="/mapa/avisos" className="pa-btn pa-btn-pequeno">
              Ver o que mudou no catálogo
            </LinkMapa>
          </p>
        </div>
      ) : (
        <ul className="pa-pilha mp-normas">
          {leitura.normas.map((n) => (
            <li key={n.id}>
              <article className="pa-cartao pa-pilha">
                <p className="pa-mono">
                  {n.orgao ? `${n.orgao} · ` : ""}publicada em {formatarData(n.publicada_em)}
                </p>
                {/* Onda 8, C (09/10/2026; N24 da auditoria R1): o título é link e tem a cara de link (mapa.css,
                    `.mp-norma-link`), com o ↗ à vista; o leitor de tela segue ouvindo que abre em nova aba. */}
                <h2 className="pa-oportunidade-titulo">
                  <a href={n.link} target="_blank" rel="noopener noreferrer" className="mp-norma-link">
                    {n.titulo}
                    <span className="mp-norma-seta" aria-hidden="true">
                      ↗
                    </span>
                    <span className="pa-sr"> (abre o texto oficial em nova aba)</span>
                  </a>
                </h2>
                {n.resumo && <p>{n.resumo}</p>}
                {n.temas.some((t) => ROTULO_TEMA[t]) && (
                  <p className="pa-chips">
                    {n.temas
                      .filter((t) => ROTULO_TEMA[t])
                      .map((t) => (
                        <span key={t} className="pa-tag">
                          {ROTULO_TEMA[t]}
                        </span>
                      ))}
                  </p>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
