/**
 * Lista dos convênios em cláusula suspensiva da última coleta, do mais urgente ao menos.
 * O prazo da suspensiva manda na ordem (é ele que extingue o instrumento); o tempo parado desempata.
 */
import Link from "next/link";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { compararUrgencia, diaBrasilia, diasEntre, nivelPrazo, type Nivel } from "@/lib/oportunidades/laudo";
import type { LeituraSuspensivas, LinhaSuspensiva } from "@/lib/oportunidades/laudo.server";
import { tituloOrgao } from "@/lib/oportunidades/padroes";
import { moedaCurta } from "@/lib/oportunidades/radar";

type LeituraOk = Extract<LeituraSuspensivas, { estado: "ok" }>;
interface Filtro {
  prazo: string | null;
  orgao: string | null;
}

const FILTROS_PRAZO: { id: string | null; nome: string; niveis: Nivel[] | null }[] = [
  { id: null, nome: "Todos", niveis: null },
  { id: "urgente", nome: "Vencido ou em até 30 dias", niveis: ["critico"] },
  { id: "90", nome: "Em até 90 dias", niveis: ["critico", "alto"] },
];

const n = (x: number) => x.toLocaleString("pt-BR");
const dias = (x: number) => `${n(x)} ${Math.abs(x) === 1 ? "dia" : "dias"}`;
const urlLaudo = (nr: string) => `/mapa/instrumento/${encodeURIComponent(nr)}/laudo`;

function url(f: Filtro, troca: Partial<Filtro>): string {
  const p = new URLSearchParams();
  const alvo = { ...f, ...troca };
  if (alvo.prazo) p.set("prazo", alvo.prazo);
  if (alvo.orgao) p.set("orgao", alvo.orgao);
  const q = p.toString();
  return `/mapa/suspensivas${q ? `?${q}` : ""}`;
}

export function SuspensivasConteudo({ leitura, hoje, filtro }: { leitura: LeituraOk; hoje: string; filtro: Filtro }) {
  const referencia = diaBrasilia(leitura.referencia ?? leitura.coletadoEm ?? hoje);
  const todas = leitura.linhas;

  // Filtro validado contra o próprio dado: valor desconhecido na URL vira "todos", não lista vazia.
  const orgaos = contarOrgaos(todas);
  const orgao = filtro.orgao && orgaos.some(([o]) => o === filtro.orgao) ? filtro.orgao : null;
  const prazo = FILTROS_PRAZO.find((x) => x.id === filtro.prazo) ?? FILTROS_PRAZO[0];
  const f: Filtro = { prazo: prazo.id, orgao };

  const linhas = todas
    .filter((l) => !orgao || l.contexto?.orgao_sup === orgao)
    .filter((l) => !prazo.niveis || prazo.niveis.includes(nivelPrazo(urgencia(l), hoje)))
    .sort((a, b) => compararUrgencia(urgencia(a), urgencia(b), hoje));

  const parado = linhas.reduce((s, l) => s + Math.max(0, (l.contexto?.vl_repasse ?? 0) - (l.contexto?.vl_desembolsado ?? 0)), 0);
  const vencidos = linhas.filter((l) => l.contexto?.dt_suspensiva && !l.contexto.dt_retirada_suspensiva && l.contexto.dt_suspensiva < hoje).length;
  const esperas = linhas.filter((l) => l.parado_desde).map((l) => diasEntre(l.parado_desde as string, referencia)).sort((a, b) => a - b);
  const mediana = esperas.length ? esperas[Math.floor(esperas.length / 2)] : null;

  return (
    <div className="pa-pagina mp-radar mp-suspensivas">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Cláusulas suspensivas · Paraíba</p>
        <h1 className="pa-titulo">Convênios esperando a retirada da suspensiva</h1>
        <p className="pa-sub">
          Do prazo mais apertado ao mais folgado; no mesmo prazo, quem está parado há mais tempo vem antes. Cada linha abre o laudo do convênio.
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <Link href="/mapa/suspensivas/padroes" className="pa-btn pa-btn-pequeno">
            Padrões: destino, tempo e quem analisa
          </Link>
          <Link href={f.orgao ? `/mapa/suspensivas/checklist?orgao=${encodeURIComponent(f.orgao)}` : "/mapa/suspensivas/checklist"} className="pa-btn pa-btn-pequeno">
            Checklist preventivo
          </Link>
        </p>
      </div>

      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <article className="pa-cartao">
          <h2 className="pa-mono">Convênios</h2>
          <p className="pa-numero">{n(linhas.length)}</p>
          <p className="pa-nota">{linhas.length !== todas.length ? `de ${n(todas.length)} na coleta` : "na coleta"}</p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Repasse sem desembolso</h2>
          <p className="pa-numero">{moedaCurta(parado)}</p>
          <p className="pa-nota">{n(vencidos)} com o prazo da suspensiva já vencido</p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Parados há</h2>
          <p className="pa-numero">{mediana !== null ? dias(mediana) : "—"}</p>
          <p className="pa-nota">mediana, contada até a coleta de {formatarData(referencia)}</p>
        </article>
      </div>

      <div className="mp-filtros mp-radar-filtros mp-nao-imprimir">
        <nav aria-label="Prazo da suspensiva" className="pa-chips">
          <span className="pa-campo-rotulo mp-radar-filtro-rotulo">Prazo</span>
          {FILTROS_PRAZO.map((x) => (
            <Link
              key={x.nome}
              href={url(f, { prazo: x.id })}
              className={`pa-chip${x.id === f.prazo ? " pa-ativo" : ""}`}
              aria-current={x.id === f.prazo ? "true" : undefined}
            >
              {x.nome}
            </Link>
          ))}
        </nav>
        <nav aria-label="Órgão" className="pa-chips">
          <span className="pa-campo-rotulo mp-radar-filtro-rotulo">Órgão</span>
          <Link href={url(f, { orgao: null })} className={`pa-chip${!f.orgao ? " pa-ativo" : ""}`} aria-current={!f.orgao ? "true" : undefined}>
            Todos
          </Link>
          {orgaos.map(([o, q]) => (
            <Link
              key={o}
              href={url(f, { orgao: o })}
              className={`pa-chip${o === f.orgao ? " pa-ativo" : ""}`}
              aria-current={o === f.orgao ? "true" : undefined}
            >
              {tituloOrgao(o)} ({n(q)})
            </Link>
          ))}
        </nav>
      </div>

      <section aria-labelledby="suspensivas-lista" className="mp-radar-secao">
        <h2 id="suspensivas-lista" className="mp-radar-h2">
          {linhas.length === todas.length ? "Todos os convênios" : "Convênios no filtro"}
        </h2>
        {linhas.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhum convênio neste filtro. <Link href="/mapa/suspensivas">Ver todos</Link>
          </p>
        ) : (
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela mp-suspensivas-tabela">
              <thead>
                <tr>
                  <th scope="col">Convênio</th>
                  <th scope="col">Órgão</th>
                  <th scope="col" className="mp-num">
                    Repasse
                  </th>
                  <th scope="col">Prazo da suspensiva</th>
                  <th scope="col">A vez é do</th>
                  <th scope="col" className="mp-num">
                    Rodadas
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <Linha key={l.numero} l={l} hoje={hoje} referencia={referencia} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="pa-nota">
          Andamento: Acesso Livre do Transferegov, coleta de {leitura.coletadoEm ? formatarPublicacao(leitura.coletadoEm) : "data desconhecida"}. Valores e
          prazos: dados abertos do Transferegov, contados até {formatarData(hoje)}. “Rodadas” são os pedidos de complementação registrados pelo concedente.
        </p>
      </section>
    </div>
  );
}

function Linha({ l, hoje, referencia }: { l: LinhaSuspensiva; hoje: string; referencia: string }) {
  const c = l.contexto;
  const nivel = nivelPrazo(urgencia(l), hoje);
  const prazoDias = c?.dt_suspensiva ? diasEntre(hoje, c.dt_suspensiva) : null;
  const parado = l.parado_desde ? diasEntre(l.parado_desde, referencia) : null;
  return (
    <tr>
      <th scope="row">
        <Link href={urlLaudo(l.numero)} className="mp-tabela-principal">
          {c?.municipio ?? "Município não informado"} · nº {l.numero}
        </Link>
        <span className="mp-tabela-secundario">{c?.programa ?? "Programa não informado"}</span>
      </th>
      <td>{c?.orgao_sup ? tituloOrgao(c.orgao_sup) : "—"}</td>
      <td className="mp-num">{moedaCurta(c?.vl_repasse)}</td>
      <td>
        {c?.dt_retirada_suspensiva ? (
          <>retirada em {formatarData(c.dt_retirada_suspensiva)}</>
        ) : c?.dt_suspensiva ? (
          <>
            <span className={`mp-laudo-marca mp-laudo-${nivel}`}>{formatarData(c.dt_suspensiva)}</span>
            <span className="mp-tabela-secundario">
              {prazoDias === null ? "" : prazoDias < 0 ? `vencido há ${dias(-prazoDias)}` : prazoDias === 0 ? "vence hoje" : `faltam ${dias(prazoDias)}`}
            </span>
          </>
        ) : (
          "sem prazo informado"
        )}
      </td>
      <td>
        {l.vez_de === "concedente" ? "concedente" : l.vez_de === "proponente" ? "município" : "—"}
        {parado !== null && <span className="mp-tabela-secundario">há {dias(parado)}</span>}
      </td>
      <td className="mp-num">{n(l.rodadas_de_exigencia)}</td>
    </tr>
  );
}

function urgencia(l: LinhaSuspensiva) {
  return {
    dt_suspensiva: l.contexto?.dt_suspensiva ?? null,
    dt_retirada_suspensiva: l.contexto?.dt_retirada_suspensiva ?? null,
    parado_desde: l.parado_desde,
  };
}

function contarOrgaos(linhas: LinhaSuspensiva[]): [string, number][] {
  const m = new Map<string, number>();
  for (const l of linhas) if (l.contexto?.orgao_sup) m.set(l.contexto.orgao_sup, (m.get(l.contexto.orgao_sup) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
