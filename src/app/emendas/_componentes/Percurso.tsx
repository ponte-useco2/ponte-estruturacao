/**
 * As peças da versão 2 do desenho (17/11/2026), comuns às telas do percurso: o glifo de cada forma de repasse, a
 * etiqueta do canal, a ajuda "?" (uma definição só, aberta em linha), a trilha, a barra de valor, a paginação e a linha
 * das datas. Componentes do servidor, sem JavaScript: a ajuda é um `<details>`, a paginação são links.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { fraseDasDatas, type ExecucaoPublica } from "@/lib/oportunidades/emendas-publico";
import {
  CANAL,
  DEFINICOES,
  largura,
  linkDoCaminho,
  metaDaDefinicao,
  paginasVisiveis,
  type CanalPublico,
  type ChaveDefinicao,
} from "@/lib/oportunidades/emendas-recorte";

export const COR_DO_CANAL: Readonly<Record<CanalPublico, string>> = {
  convenio: "var(--c-convenio)",
  especial: "var(--c-especial)",
  saude: "var(--c-saude)",
  direto: "var(--c-direto)",
};
export const PADRAO_DO_CANAL: Readonly<Record<CanalPublico, string>> = {
  convenio: "pad-convenio",
  especial: "pad-especial",
  saude: "",
  direto: "pad-direto",
};

/** O glifo da forma de repasse (o alto contraste distingue os canais por glifo, padrão e texto, não por cor). */
export function Glifo({ canal, tamanho = 18 }: { canal: CanalPublico; tamanho?: number }) {
  const comum = { width: tamanho, height: tamanho, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "aria-hidden": true, focusable: false } as const;
  if (canal === "convenio")
    return (
      <svg {...comum} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M9 15c1.5-2 2.5 1 4-1s2 1 3 0" />
      </svg>
    );
  if (canal === "especial")
    return (
      <svg {...comum} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h15M13 6l6 6-6 6" />
      </svg>
    );
  if (canal === "saude")
    return (
      <svg {...comum} strokeWidth={2.4} strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  return (
    <svg {...comum} strokeWidth={2}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9.5 10.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.6c0 2.4-5 1-5 3.4 0 1 1 1.5 2.5 1.5s2.5-.5 2.5-1.5" strokeWidth={1.6} />
    </svg>
  );
}

export function EtiquetaCanal({ canal, className = "t14", children }: { canal: CanalPublico; className?: string; children?: ReactNode }) {
  return (
    <span className={`etq-canal ${className}`} style={{ ["--cc" as string]: COR_DO_CANAL[canal] }}>
      <Glifo canal={canal} />
      {children ?? CANAL[canal].nome}
    </span>
  );
}

/** O "?" ao lado de um número: a definição única do glossário, com território, período, atualização e fonte. */
export function Ajuda({ chave, territorio, periodo, pequena = false }: { chave: ChaveDefinicao; territorio: string; periodo: string; pequena?: boolean }) {
  const d = DEFINICOES[chave];
  const caminho = linkDoCaminho(chave);
  return (
    <details className={`ajuda${pequena ? " pequena" : ""}`}>
      <summary aria-label={`O que significa: ${d.titulo}`}>?</summary>
      <div className="def t14">
        <strong>{d.titulo}.</strong> {d.texto}
        <span className="sub t12" style={{ marginTop: 6 }}>
          {metaDaDefinicao(chave, territorio, periodo)}
        </span>
        {caminho ? (
          <span className="sub t12" style={{ marginTop: 6 }}>
            <Link prefetch={false} href={caminho}>
              Ver no caminho do recurso
            </Link>
          </span>
        ) : null}
      </div>
    </details>
  );
}

export interface Elo {
  nome: string;
  href?: string;
}
/** A trilha (Início › Patos › Registros › Emenda): todos os passos são endereços do recorte. */
export function Trilha({ elos }: { elos: readonly Elo[] }) {
  return (
    <nav aria-label="Trilha" className="trilha envolve t14" style={{ paddingTop: 12, paddingBottom: 4 }}>
      <ol>
        {elos.map((e, i) => (
          <li key={`${i}-${e.nome}`}>
            {e.href && i < elos.length - 1 ? (
              <Link prefetch={false} href={e.href}>
                {e.nome}
              </Link>
            ) : (
              <span aria-current="page" style={{ fontWeight: 700 }}>
                {e.nome}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Uma barra que abre os registros que compõem o valor (o total da tela de registros é o mesmo). */
export function BarraLink({
  href,
  nome,
  sub,
  valor,
  nTxt,
  fracao,
  aria,
  zero,
  extraTrilho,
  cor,
  padrao = "",
  nomeNode,
}: {
  href: string;
  nome: string;
  sub?: ReactNode;
  valor: string;
  nTxt: string;
  fracao: number;
  aria: string;
  zero: boolean;
  extraTrilho?: ReactNode;
  cor?: string;
  padrao?: string;
  nomeNode?: ReactNode;
}) {
  return (
    <Link prefetch={false} className="barra-btn" href={href} aria-label={aria} style={cor ? { ["--cc" as string]: cor } : undefined}>
      <span>
        {nomeNode ?? <strong className="ab">{nome}</strong>}
        {sub ? <span className="sub t12">{sub}</span> : null}
      </span>
      <span className="trilho" aria-hidden="true">
        {extraTrilho}
        <span className={`cheio ${padrao}${zero ? " zero" : ""}`} style={{ width: `${largura(fracao, 1).toFixed(2)}%`, backgroundColor: cor }} />
      </span>
      <span className="num" style={{ textAlign: "right" }}>
        <strong>{valor}</strong>
        <span className="sub t12">{nTxt}</span>
      </span>
    </Link>
  );
}

export function BarraVazia({ nome, nomeNode }: { nome: string; nomeNode?: ReactNode }) {
  return (
    <div className="barra-btn">
      <span>{nomeNode ?? <strong>{nome}</strong>}</span>
      <span />
      <span className="t14" style={{ textAlign: "right", color: "var(--tinta-2)" }}>
        nenhum registro
      </span>
    </div>
  );
}

/** A paginação: links (funciona sem JavaScript), a atual com `aria-current`. */
export function Paginacao({ pagina, paginas, url, rotulo, faixa }: { pagina: number; paginas: number; url: (p: number) => string; rotulo: string; faixa: string }) {
  return (
    <nav aria-label={rotulo} className="linha-flex" style={{ justifyContent: "space-between", gap: "12px 24px" }}>
      <p className="t14 num">{faixa}</p>
      {paginas > 1 ? (
        <div className="linha-flex" style={{ gap: 8 }}>
          {pagina > 1 ? (
            <Link prefetch={false} className="btn t14" href={url(pagina - 1)}>
              ← Anterior
            </Link>
          ) : (
            <span className="btn t14" aria-disabled="true">
              ← Anterior
            </span>
          )}
          <div className="segs">
            {paginasVisiveis(pagina, paginas).map((p, i) =>
              p === null ? (
                <span key={`r${i}`} className="t14" aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", minWidth: 32, justifyContent: "center" }}>
                  …
                </span>
              ) : (
                <Link prefetch={false} key={p} className="pag t14 num" href={url(p)} aria-current={p === pagina ? "page" : undefined} aria-label={`Página ${p}`}>
                  {p}
                </Link>
              ),
            )}
          </div>
          {pagina < paginas ? (
            <Link prefetch={false} className="btn t14" href={url(pagina + 1)}>
              Próxima →
            </Link>
          ) : (
            <span className="btn t14" aria-disabled="true">
              Próxima →
            </span>
          )}
        </div>
      ) : null}
    </nav>
  );
}


/** As três datas, uma vez por tela, no rodapé da área de conteúdo (V2-ESPEC). */
export function Datas({ execucao }: { execucao: Pick<ExecucaoPublica, "dadoAte" | "concluidaEm"> }) {
  return (
    <p className="envolve datas t14 num">
      {fraseDasDatas(execucao)} Atualização semanal, às terças ·{" "}
      <Link prefetch={false} href="/emendas/metodo">
        método
      </Link>
    </p>
  );
}

/** Estados de erro e de dado ainda não publicado, no desenho da v2. */
export function Aviso({ titulo, texto, children }: { titulo: string; texto: string; children?: ReactNode }) {
  return (
    <section className="envolve" style={{ paddingTop: 48, paddingBottom: 64 }}>
      <div role="alert" className="painel pilha" style={{ padding: 24, gap: 12 }}>
        <h1 className="disp t36" style={{ fontWeight: 720 }}>
          {titulo}
        </h1>
        <p className="t16 tinta-2">{texto}</p>
        {children}
      </div>
    </section>
  );
}
export function Indisponivel({ endereco }: { endereco: string }) {
  return (
    <Aviso titulo="Não foi possível carregar os dados agora" texto="A consulta à base não respondeu. O restante do portal continua disponível.">
      <div>
        <a className="btn btn-pri t16" href={endereco}>
          Tentar de novo
        </a>
      </div>
    </Aviso>
  );
}
export function SemDado() {
  return <Aviso titulo="Dados ainda não publicados" texto="A primeira coleta das emendas ainda não foi concluída. Volte em alguns dias." />;
}
