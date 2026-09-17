/**
 * Um município no Painel de Capacidade Fiscal: decisões A, B e C, o quadro de verificações e, em
 * cada uma, a evidência (valores, cálculo, período), a base legal, a fonte e o histórico.
 */
import Link from "next/link";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import {
  AVISO_FIXO,
  DECISOES,
  MARCA_ESTADO,
  NOME_CURTO,
  ROTULO_ESTADO,
  TOM_ESTADO,
  conclusaoDe,
  fonteDaEvidencia,
  hashCurto,
  linhasDaEvidencia,
  ordenarVerificacoes,
  urlMunicipioFiscal,
  urlSimularFiscal,
  type EstadoFiscal,
  type FonteEvidencia,
  type HistoricoFiscal,
  type VerificacaoFiscal,
} from "@/lib/oportunidades/fiscal";
import type { LeituraMunicipioFiscal } from "@/lib/oportunidades/fiscal.server";
import { urlFicha } from "@/lib/oportunidades/painel";
import { Tag } from "../../../_design/primitivos";
import { EstadoDecisao } from "../FiscalConteudo";

type LeituraOk = Extract<LeituraMunicipioFiscal, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");

function Estado({ estado }: { estado: EstadoFiscal }) {
  return (
    <Tag tom={TOM_ESTADO[estado]}>
      <span aria-hidden="true">{MARCA_ESTADO[estado]} </span>
      {ROTULO_ESTADO[estado]}
    </Tag>
  );
}

function Lista({ rotulo, codigos }: { rotulo: string; codigos: string[] }) {
  if (!codigos.length) return null;
  return (
    <p className="mp-fiscal-lista">
      <span className="pa-mono">{rotulo}</span> {codigos.map((c) => NOME_CURTO[c] ?? c).join(" · ")}
    </p>
  );
}

export function FiscalMunicipioConteudo({ leitura }: { leitura: LeituraOk }) {
  const m = leitura.municipio;
  const verificacoes = ordenarVerificacoes(leitura.verificacoes);
  const automaticas = verificacoes.filter((v) => !v.documental);
  const documentais = verificacoes.filter((v) => v.documental);
  const historicoPor = new Map<string, HistoricoFiscal[]>();
  for (const h of leitura.historico) historicoPor.set(h.codigo, [...(historicoPor.get(h.codigo) ?? []), h]);

  return (
    <div className="pa-pagina mp-radar mp-painel mp-fiscal">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">
          <Link href="/mapa/fiscal">Capacidade fiscal · Paraíba</Link>
        </p>
        <h1 className="pa-titulo">{m.nome}/PB</h1>
        <p className="pa-sub">
          IBGE {m.ibge}
          {m.populacao ? ` · ${n(m.populacao)} habitantes` : ""} · lido em <strong>{formatarPublicacao(leitura.execucao.concluida_em)}</strong>
        </p>
        <p className="pa-chips">
          <Link href={urlSimularFiscal(m.ibge)} className="pa-chip">
            Simular um projeto →
          </Link>
          <Link href={urlFicha({ ibge: m.ibge })} className="pa-chip">
            Ficha no painel de execução →
          </Link>
          <Link href={`/mapa/municipio/${m.ibge}/investimentos`} className="pa-chip">
            Investimentos federais →
          </Link>
        </p>
        <p className="mp-fiscal-aviso">{AVISO_FIXO}</p>
      </div>

      <section aria-labelledby="fiscal-decisoes" className="mp-radar-secao">
        <h2 id="fiscal-decisoes" className="mp-radar-h2">
          Decisões
        </h2>
        <div className="pa-grade pa-grade-3 mp-painel-cartoes">
          {DECISOES.map((d) => {
            const c = conclusaoDe(m, d.id);
            return (
              <article key={d.id} className={`pa-cartao mp-painel-cartao mp-fiscal-decisao mp-fiscal-${c?.estado ?? "nao_verificavel"}`}>
                <h3 className="pa-mono">
                  {d.id} · {d.nome}
                </h3>
                {c ? (
                  <>
                    <p>
                      <EstadoDecisao estado={c.estado} />
                    </p>
                    <Lista rotulo="Bloqueia" codigos={c.bloqueantes} />
                    <Lista rotulo="Alertas" codigos={c.alertas} />
                    <Lista rotulo="Sem dado" codigos={c.sem_dado} />
                    <Lista rotulo="Depende de documento" codigos={c.documentais} />
                  </>
                ) : (
                  <p className="pa-nota">Sem conclusão gravada.</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="fiscal-verificacoes" className="mp-radar-secao">
        <h2 id="fiscal-verificacoes" className="mp-radar-h2">
          Verificações
        </h2>
        <ul className="pa-pilha mp-fiscal-verificacoes">
          {automaticas.map((v) => (
            <li key={v.codigo}>
              <Verificacao v={v} historico={historicoPor.get(v.codigo) ?? []} fontesUf={leitura.fontesUf} />
            </li>
          ))}
        </ul>
      </section>

      {documentais.length > 0 && (
        <section aria-labelledby="fiscal-documentais" className="mp-radar-secao">
          <h2 id="fiscal-documentais" className="mp-radar-h2">
            Dependem de documento do município
          </h2>
          <p className="pa-nota">Não são examinadas automaticamente e não entram no estado das decisões.</p>
          <ul className="mp-fiscal-documentais">
            {documentais.map((v) => (
              <li key={v.codigo}>
                <strong>{v.nome}</strong> — {v.base_legal}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="pa-nota mp-procedencia">
        Regras na versão {verificacoes[0]?.versao ?? "—"}. Endereço desta página: {urlMunicipioFiscal(m.ibge)}.
      </p>
    </div>
  );
}

function Fonte({ f }: { f: FonteEvidencia }) {
  const urls = f.urls ?? [];
  return (
    <div className="mp-fiscal-fonte">
      <p>
        <span className="pa-mono">Fonte</span> {f.sistema ?? "—"}
        {f.coletado_em ? ` · lida em ${formatarPublicacao(f.coletado_em)}` : ""}
        {urls.length > 1 ? ` · ${urls.length} consultas` : ""}
      </p>
      {f.erro && <p className="pa-ressalva">A leitura falhou: {f.erro}</p>}
      {urls.length > 0 && (
        <ul className="mp-fiscal-urls">
          {urls.slice(0, 4).map((u, i) => (
            <li key={`${u}-${i}`}>
              <a href={u} target="_blank" rel="noopener noreferrer" className="mp-fiscal-url">
                {u}
              </a>{" "}
              <span className="pa-mono" title={f.sha256?.[i]}>
                sha256 {hashCurto(f.sha256?.[i])}
              </span>
            </li>
          ))}
          {urls.length > 4 && <li className="pa-nota">e mais {urls.length - 4}.</li>}
        </ul>
      )}
    </div>
  );
}

function Verificacao({
  v,
  historico,
  fontesUf,
}: {
  v: VerificacaoFiscal;
  historico: HistoricoFiscal[];
  fontesUf: (FonteEvidencia & { chave: string })[];
}) {
  const linhas = linhasDaEvidencia(v);
  // CAUC e SIOPE são lidos uma vez para a UF: a evidência do município aponta para a leitura comum.
  const propria = fonteDaEvidencia(v);
  const fonte = propria ?? (v.codigo.startsWith("G7") ? fontesUf.find((f) => f.chave === "cauc") : v.codigo === "G11" ? fontesUf.find((f) => f.chave.startsWith("siope")) : undefined);

  return (
    <article className={`pa-cartao mp-fiscal-verificacao mp-fiscal-${v.estado}`}>
      <div className="pa-linha mp-fiscal-verificacao-cabeca">
        <h3 className="pa-oportunidade-titulo">{v.nome}</h3>
        <Estado estado={v.estado} />
        <span className="pa-mono">{v.decisoes.map((d) => `decisão ${d}`).join(" · ")}</span>
      </div>
      <p>{v.resumo}</p>
      <details className="mp-fiscal-detalhe">
        <summary>Evidência, base legal e histórico</summary>
        {linhas.length > 0 && (
          <dl className="mp-fiscal-evidencia">
            {linhas.map((l) => (
              <div key={l.rotulo}>
                <dt>{l.rotulo}</dt>
                <dd>{l.valor}</dd>
              </div>
            ))}
          </dl>
        )}
        <p>
          <span className="pa-mono">Base legal</span> {v.base_legal}
        </p>
        {fonte && <Fonte f={fonte} />}
        <div>
          <span className="pa-mono">Histórico</span>
          {historico.length === 0 ? (
            <p className="pa-nota">Sem registro anterior.</p>
          ) : (
            <ol className="mp-fiscal-historico">
              {historico.map((h) => (
                <li key={h.desde}>
                  <Estado estado={h.estado} /> {formatarData(h.desde)}
                  {h.visto_ate !== h.desde ? ` a ${formatarData(h.visto_ate)}` : ""} — {h.resumo}
                </li>
              ))}
            </ol>
          )}
        </div>
      </details>
    </article>
  );
}
