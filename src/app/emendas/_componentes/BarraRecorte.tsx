/**
 * A barra do recorte (versão 2): o município (com "Trocar") e o período, que é o ANO DA EMENDA (ajuste B). As opções são
 * links; "Personalizado" é um formulário GET (`ano_de`, `ano_ate`) que a página converte no `periodo` canônico. Sem
 * JavaScript.
 */
import Link from "next/link";
import {
  ANO_INICIAL_PERCURSO,
  mesmoPeriodo,
  periodosDoSeletor,
  type Periodo,
} from "@/lib/oportunidades/emendas-recorte";

export function SeletorPeriodo({
  periodo,
  anoMax,
  urlDoPeriodo,
  acao,
  ocultos,
}: {
  periodo: Periodo;
  anoMax: number;
  urlDoPeriodo: (p: Periodo) => string;
  acao: string;
  ocultos: readonly [string, string][];
}) {
  const opcoes = periodosDoSeletor(anoMax);
  const personalizado = !opcoes.some((o) => mesmoPeriodo(o.periodo, periodo));
  const anos: number[] = [];
  for (let a = ANO_INICIAL_PERCURSO; a <= anoMax; a += 1) anos.push(a);
  return (
    <div className="linha-flex" style={{ gap: "8px 12px" }}>
      <span className="t14" style={{ fontWeight: 700 }}>
        Período: ano da emenda
      </span>
      <div role="group" aria-label="Período: ano da emenda" className="segs">
        {opcoes.map((o) => (
          <Link prefetch={false} key={o.id} className="seg t14" href={urlDoPeriodo(o.periodo)} aria-current={mesmoPeriodo(o.periodo, periodo) ? "true" : undefined}>
            {o.rotulo}
          </Link>
        ))}
      </div>
      <details className="personalizado-caixa" open={personalizado || undefined}>
        <summary className={`seg t14${personalizado ? " ativo" : ""}`} aria-current={personalizado ? "true" : undefined} style={{ marginLeft: 0 }}>
          Personalizado
        </summary>
        <form action={acao} method="get" className="personalizado" style={{ marginTop: 8 }}>
          {ocultos.map(([k, v]) => (
            <input key={`${k}=${v}`} type="hidden" name={k} value={v} />
          ))}
          <label className="t14" htmlFor="per-de">
            De
          </label>
          <select id="per-de" name="ano_de" className="campo t14 num" defaultValue={String(periodo.de)}>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <label className="t14" htmlFor="per-ate">
            até
          </label>
          <select id="per-ate" name="ano_ate" className="campo t14 num" defaultValue={String(periodo.ate)}>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button className="btn t14" type="submit">
            Aplicar
          </button>
        </form>
      </details>
    </div>
  );
}

export function BarraRecorte({
  municipio,
  trocarHref,
  children,
}: {
  municipio: { ibge: string; nome: string } | null;
  trocarHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="envolve barra-recorte" role="group" aria-label="Recorte">
      <div className="linha-flex" style={{ gap: "8px 12px" }}>
        <span className="t14" style={{ fontWeight: 700 }}>
          Município
        </span>
        <span className="t16">{municipio ? municipio.nome : "Paraíba (todos os municípios e o Estado)"}</span>
        <Link prefetch={false} className="btn t14" href={trocarHref}>
          Trocar
        </Link>
      </div>
      {children}
    </div>
  );
}
