/**
 * Normas: portarias, instruções normativas e decretos que mudam as regras das transferências,
 * escolhidos pela equipe da PONTE. Só leitura; o cadastro fica em /oportunidades/admin.
 */
import { formatarData } from "@/lib/oportunidades/central";
import type { LeituraNormas } from "@/lib/oportunidades/favoritos.server";
import { ROTULO_TEMA } from "@/lib/oportunidades/temas";

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
        <p className="pa-cartao pa-cartao-plano">Não foi possível ler as normas agora. Tente de novo em alguns minutos.</p>
      ) : leitura.normas.length === 0 ? (
        <p className="pa-cartao pa-cartao-plano">Nenhuma norma publicada no mural ainda.</p>
      ) : (
        <ul className="pa-pilha mp-normas">
          {leitura.normas.map((n) => (
            <li key={n.id}>
              <article className="pa-cartao pa-pilha">
                <p className="pa-mono">
                  {n.orgao ? `${n.orgao} · ` : ""}publicada em {formatarData(n.publicada_em)}
                </p>
                <h2 className="pa-oportunidade-titulo">
                  <a href={n.link} target="_blank" rel="noopener noreferrer">
                    {n.titulo}
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
