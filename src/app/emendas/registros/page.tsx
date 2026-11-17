import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { parametrosDoEndereco, type LinhaPublica } from "@/lib/oportunidades/emendas-publico";
import { lerRegistros } from "@/lib/oportunidades/emendas-publico.server";
import {
  CANAL,
  COLUNAS_REGISTROS,
  NOME_DESTINATARIO,
  NOME_TIPO,
  ancoraDaLinha,
  anoAtualBrasilia,
  colunaNumerica,
  coberturas,
  comp,
  consultaDoRecorte,
  emendasDoPeriodo,
  fonteDoInstrumento,
  gruposDoFiltro,
  inteiroPt,
  lerRecorte,
  mudar,
  nomeDaAutoria,
  nomeDaColuna,
  plural,
  quantosFiltros,
  registroDaLinha,
  rs,
  slugFuncao,
  temPeriodoDoFormulario,
  textoPeriodo,
  urlExportacao,
  urlFicha,
  urlInicio,
  urlMunicipio,
  urlRegistros,
  NAO_INFORMADO,
  NAO_LOCALIZADO,
  type CampoOrdem,
  type Recorte,
} from "@/lib/oportunidades/emendas-recorte";
import { dataBrasilia } from "@/lib/oportunidades/datas";
import { BarraRecorte, SeletorPeriodo } from "../_componentes/BarraRecorte";
import { CopiarLink, FocoNaLinha } from "../_componentes/Navegador";
import { Ajuda, Datas, EtiquetaCanal, Indisponivel, Paginacao, SemDado, Trilha } from "../_componentes/Percurso";

export const metadata: Metadata = {
  title: "Registros",
  description: "Os registros (emenda × destino × instrumento) que compõem cada valor do portal, com os totais, a cobertura de cada medida e o arquivo do recorte.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const X = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const BAIXAR = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);

/** O endereço canônico pede redirecionamento? (o formulário manda `canal=a&canal=b`, `ano_de`, campos vazios). */
function precisaCanonico(sp: URLSearchParams): boolean {
  if (temPeriodoDoFormulario(sp)) return true;
  const vistos = new Set<string>();
  for (const [k, v] of sp) {
    if (v === "" || vistos.has(k)) return true;
    vistos.add(k);
  }
  return false;
}

/** Os campos ocultos de um formulário GET que muda só uma parte do recorte (o resto vai junto). */
function ocultos(r: Recorte, menos: readonly string[]): [string, string][] {
  return consultaDoRecorte(r)
    .split("&")
    .filter(Boolean)
    .map((par) => {
      const i = par.indexOf("=");
      return [par.slice(0, i), decodeURIComponent(par.slice(i + 1))] as [string, string];
    })
    .filter(([k]) => !menos.includes(k));
}

/**
 * Os registros de um recorte (versão 2): a prova do número. O recorte está todo no endereço (CONTRATO §11) — o mesmo
 * endereço aberto numa aba nova, sem histórico, mostra os mesmos registros, totais, ordem e página. Os totais são do
 * recorte INTEIRO (oport_68), com a cobertura de previsto e empenho (ajuste A); a frase do período diz que o período é o
 * ano da emenda e o realizado vai até a data de referência (ajuste B). O número de cada instrumento leva à fonte oficial
 * (ajuste C); o código da emenda abre a ficha com a volta para este mesmo endereço, com o foco nesta linha.
 */
export default async function Registros({ searchParams }: Props) {
  const sp = parametrosDoEndereco(await searchParams);
  const anoMax = anoAtualBrasilia();
  const r = lerRecorte(sp, anoMax);
  if (precisaCanonico(sp)) redirect(urlRegistros(r));
  const l = await lerRegistros(r);
  if (l.estado === "sem_dado") return <SemDado />;
  if (l.estado !== "ok") return <Indisponivel endereco={urlRegistros(r)} />;

  const host = (await headers()).get("host") ?? "ponteprojetos.com.br";
  const nomeMun = r.municipio ? (l.municipios.find((m) => m.ibge === r.municipio)?.nome ?? r.municipio) : null;
  const onde = nomeMun ? `em ${nomeMun}` : "na Paraíba";
  const s = l.soma;
  const cob = coberturas(s, r.canal);
  const ate = dataBrasilia(l.execucao.dadoAte, "");
  const perTxt = emendasDoPeriodo(r.periodo).toLowerCase();
  const territorio = nomeMun ?? "Paraíba";
  const paginas = Math.max(1, Math.ceil(s.registros / r.por));
  const pagina = Math.min(r.pagina, paginas);
  const inicio = (pagina - 1) * r.por;
  const registros = l.linhas.map((x: LinhaPublica) => ({ l: x, r: registroDaLinha(x) }));
  const aqui = urlRegistros(r);
  const nomeAutoria = (c: string) => nomeDaAutoria(c, l.autores.find((a) => a.codigo === c)?.nome ?? null);
  const nomeFuncao = (slug: string) => {
    const achada = l.linhas.find((x) => x.funcao && slug === slugFuncao(x.funcao));
    return achada?.funcao ?? (slug === "nao-localizado-na-fonte" ? NAO_LOCALIZADO : slug.replace(/-/g, " "));
  };
  const chips: { rotulo: string; href: string }[] = [];
  for (const c of r.canal) chips.push({ rotulo: `Forma de repasse: ${CANAL[c].nome}`, href: urlRegistros(mudar(r, { canal: r.canal.filter((x) => x !== c) })) });
  for (const d of r.destinatario) chips.push({ rotulo: `Destinatário: ${NOME_DESTINATARIO[d]}`, href: urlRegistros(mudar(r, { destinatario: r.destinatario.filter((x) => x !== d) })) });
  for (const f of r.funcao) chips.push({ rotulo: `Função: ${nomeFuncao(f)}`, href: urlRegistros(mudar(r, { funcao: r.funcao.filter((x) => x !== f) })) });
  for (const t of r.tipo) chips.push({ rotulo: `Tipo: ${NOME_TIPO[t]}`, href: urlRegistros(mudar(r, { tipo: r.tipo.filter((x) => x !== t) })) });
  for (const a of r.autoria) chips.push({ rotulo: `Autoria: ${nomeAutoria(a)}`, href: urlRegistros(mudar(r, { autoria: r.autoria.filter((x) => x !== a) })) });
  for (const a of r.ano) chips.push({ rotulo: `Ano da emenda: ${a}`, href: urlRegistros(mudar(r, { ano: r.ano.filter((x) => x !== a) })) });
  if (r.q) chips.push({ rotulo: `Busca: “${r.q}”`, href: urlRegistros(mudar(r, { q: "" })) });
  const semFiltros = mudar(r, { canal: [], destinatario: [], funcao: [], tipo: [], autoria: [], ano: [], q: "" });
  const ordemLink = (campo: CampoOrdem) => {
    const ativa = r.ordem.campo === campo;
    return urlRegistros(mudar(r, { ordem: { campo, desc: ativa ? !r.ordem.desc : colunaNumerica(campo) } }));
  };
  const legenda = `${plural(s.registros, "registro", "registros")} · ordem: ${nomeDaColuna(r.ordem.campo)}${r.ordem.desc ? ", do maior para o menor" : ""} · página ${pagina} de ${paginas}. Ano = ano da emenda; realizado até ${ate || "a data de referência"}.`;

  return (
    <>
      <Trilha
        elos={[
          { nome: "Início", href: urlInicio(r.periodo, r.municipio) },
          ...(r.municipio && nomeMun ? [{ nome: nomeMun, href: urlMunicipio(r.municipio, r.periodo) }] : []),
          { nome: r.municipio ? "Registros" : "Registros da Paraíba" },
        ]}
      />
      <BarraRecorte municipio={r.municipio && nomeMun ? { ibge: r.municipio, nome: nomeMun } : null} trocarHref={urlInicio(r.periodo)}>
        <SeletorPeriodo
          periodo={r.periodo}
          anoMax={anoMax}
          urlDoPeriodo={(p) => urlRegistros(mudar(r, { periodo: p }))}
          acao="/emendas/registros"
          ocultos={ocultos(r, ["periodo", "pagina", "ano"])}
        />
      </BarraRecorte>

      <section aria-labelledby="titulo-tela" className="envolve pilha" style={{ paddingTop: 16, paddingBottom: 32, gap: 18 }}>
        <div className="pilha" style={{ gap: 8 }}>
          <h1 id="titulo-tela" className="disp titulo-tela">
            {nomeMun ? `Registros de ${nomeMun}` : "Registros da Paraíba"}
          </h1>
          <p className="t18">
            {emendasDoPeriodo(r.periodo)}: <strong className="num">{rs(s.realizado)}</strong> pagos a destinatários {onde}
            {ate ? ` até ${ate}` : ""}
            {quantosFiltros(r) ? ", neste recorte" : ""}.
          </p>
        </div>

        <div role="group" aria-label="Recorte" className="linha-flex" style={{ gap: 8 }}>
          <span className="chip-fixo t14">Período: {textoPeriodo(r.periodo)}</span>
          {r.municipio && nomeMun ? (
            <Link prefetch={false} className="chip t14" href={urlRegistros(mudar(r, { municipio: null }))} aria-label={`Remover o município ${nomeMun} e ver a Paraíba inteira`}>
              Município: {nomeMun}
              {X}
            </Link>
          ) : null}
          {chips.map((c) => (
            <Link prefetch={false} key={c.href} className="chip t14" href={c.href} aria-label={`Remover o filtro ${c.rotulo}`}>
              {c.rotulo}
              {X}
            </Link>
          ))}
          {chips.length ? (
            <Link prefetch={false} className="btn t14" href={urlRegistros(semFiltros)}>
              Limpar filtros
            </Link>
          ) : null}
        </div>

        <div className="colunas col-5-7" style={{ alignItems: "end", gap: "16px 32px" }}>
          <form action="/emendas/registros" method="get" className="pilha" style={{ gap: 6 }} role="search">
            {ocultos(r, ["q", "pagina"]).map(([k, v]) => (
              <input key={`${k}=${v}`} type="hidden" name={k} value={v} />
            ))}
            <label htmlFor="campo-q" className="t14" style={{ fontWeight: 700 }}>
              Buscar nestes registros
            </label>
            <div className="linha-flex" style={{ gap: 8, flexWrap: "nowrap" }}>
              <input
                id="campo-q"
                name="q"
                className="campo t16"
                type="search"
                autoComplete="off"
                defaultValue={r.q}
                maxLength={200}
                placeholder="Código, instrumento, destinatário, objeto ou autoria"
                style={{ minHeight: 48 }}
              />
              <button className="btn t14" type="submit">
                Buscar
              </button>
            </div>
          </form>
          <dl className="totais num">
            <div>
              <dt className="t12 rotulo">Registros</dt>
              <dd className="t22" style={{ fontWeight: 760 }}>
                {inteiroPt(s.registros)}
                <span className="sub t12">{plural(s.emendas, "emenda", "emendas")}</span>
              </dd>
            </div>
            <div>
              <dt className="t12 rotulo">
                Previsto <Ajuda chave="previsto" territorio={territorio} periodo={perTxt} pequena />
              </dt>
              <dd className="t16" style={{ fontWeight: 700 }}>
                {cob.previsto.exato ?? cob.previsto.valor}
                {cob.previsto.cobertura ? <span className="sub t12">{cob.previsto.cobertura}</span> : null}
                {cob.previsto.porque ? <span className="sub t12">{cob.previsto.porque}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="t12 rotulo">
                Empenhado <Ajuda chave="empenhado" territorio={territorio} periodo={perTxt} pequena />
              </dt>
              <dd className="t16" style={{ fontWeight: 700 }}>
                {cob.empenhado.exato ?? cob.empenhado.valor}
                {cob.empenhado.cobertura ? <span className="sub t12">{cob.empenhado.cobertura}</span> : null}
                {cob.empenhado.porque ? <span className="sub t12">{cob.empenhado.porque}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="t12 rotulo">
                Realizado <Ajuda chave="realizado" territorio={territorio} periodo={`${perTxt}; valores até ${ate}`} pequena />
              </dt>
              <dd className="t16" style={{ fontWeight: 760 }}>
                {rs(s.realizado)}
                <span className="sub t12">{comp(s.realizado)}</span>
              </dd>
            </div>
          </dl>
        </div>

        <details className="painel filtrar">
          <summary className="btn t14">
            Filtrar{quantosFiltros(r) - (r.q ? 1 : 0) ? ` (${quantosFiltros(r) - (r.q ? 1 : 0)})` : ""}
            <span className="t12 tinta-2" style={{ fontWeight: 400 }}>
              forma de repasse, destinatário, função, tipo, autoria e ano
            </span>
          </summary>
          <form action="/emendas/registros" method="get" className="filtros-form t14">
            {ocultos(r, ["canal", "destinatario", "funcao", "tipo", "autoria", "ano", "pagina"]).map(([k, v]) => (
              <input key={`${k}=${v}`} type="hidden" name={k} value={v} />
            ))}
            <p className="t12 tinta-2">
              O número ao lado de cada opção é quantos registros ela teria com os outros filtros deste recorte. As opções estão em ordem fixa ou
              alfabética.
            </p>
            {gruposDoFiltro(l.facetas, r).map((g) =>
              g.opcoes.length ? (
                <fieldset key={g.nome} className={g.opcoes.length > 12 ? "longo" : undefined}>
                  <legend>{g.titulo}</legend>
                  {g.opcoes.map((o) => (
                    <label key={o.valor}>
                      <input type="checkbox" name={g.nome} value={o.valor} defaultChecked={o.marcada} />
                      <span>
                        {o.rotulo}
                        {o.registros !== null ? <span className="tinta-2 num"> ({inteiroPt(o.registros)})</span> : null}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : null,
            )}
            <div className="linha-flex" style={{ gap: 8 }}>
              <button className="btn btn-pri t14" type="submit">
                Aplicar os filtros
              </button>
              {chips.length ? (
                <Link prefetch={false} className="btn t14" href={urlRegistros(semFiltros)}>
                  Limpar filtros
                </Link>
              ) : null}
            </div>
          </form>
        </details>

        <div className="acoes linha-flex" style={{ justifyContent: "space-between", gap: "10px 24px" }}>
          <div className="linha-flex" style={{ gap: 8 }}>
            <a className="btn t14" href={urlExportacao(r, "csv")} download>
              {BAIXAR}
              Baixar CSV
            </a>
            <a className="btn t14" href={urlExportacao(r, "json")}>
              {BAIXAR}
              Baixar JSON
            </a>
            <CopiarLink caminho={aqui} />
          </div>
          <p className="t14 tinta-2">O arquivo traz o recorte inteiro ({plural(s.registros, "registro", "registros")}), na ordem da tabela.</p>
        </div>
        <code className="url">
          {host}
          {aqui}
        </code>

        <form action="/emendas/registros" method="get" className="ordem-celular pilha" style={{ gap: 6 }}>
          {ocultos(r, ["ordem", "pagina"]).map(([k, v]) => (
            <input key={`${k}=${v}`} type="hidden" name={k} value={v} />
          ))}
          <label htmlFor="campo-ordem" className="t14" style={{ fontWeight: 700 }}>
            Ordenar por
          </label>
          <div className="linha-flex" style={{ gap: 8, flexWrap: "nowrap" }}>
            <select id="campo-ordem" name="ordem" className="campo t16" defaultValue={`${r.ordem.desc ? "-" : ""}${r.ordem.campo}`} style={{ flex: "1 1 auto", minWidth: 0, minHeight: 48 }}>
              {COLUNAS_REGISTROS.flatMap((c) => [
                <option key={c.campo} value={c.campo}>
                  {c.titulo}, crescente
                </option>,
                <option key={`-${c.campo}`} value={`-${c.campo}`}>
                  {c.titulo}, decrescente
                </option>,
              ])}
            </select>
            <button className="btn t14" type="submit">
              Ordenar
            </button>
          </div>
        </form>

        <div className="rolagem tabela-registros" role="region" aria-labelledby="cap-reg" tabIndex={0}>
          <p id="cap-reg" className="t14 tinta-2" style={{ padding: "12px 16px" }}>
            {legenda}
          </p>
          <div className="gtab t14" role="table" aria-labelledby="cap-reg" aria-rowcount={s.registros + 1}>
            <div role="rowgroup">
              <div role="row" className="gl gl-cab" aria-rowindex={1}>
                {COLUNAS_REGISTROS.map((c) => {
                  const ativa = r.ordem.campo === c.campo;
                  return (
                    <div
                      key={c.campo}
                      role="columnheader"
                      aria-sort={ativa ? (r.ordem.desc ? "descending" : "ascending") : "none"}
                      className={c.numerica ? "direita" : undefined}
                    >
                      <Link prefetch={false} className="ord" href={ordemLink(c.campo)}>
                        <span>{c.titulo}</span>
                        <span className="ord-i" aria-hidden="true">
                          {ativa ? (r.ordem.desc ? "↓" : "↑") : "⇅"}
                        </span>
                        <span className="sr">
                          {ativa ? `, ordenado ${r.ordem.desc ? "do maior para o menor" : "em ordem crescente"}; inverter` : ", ordenar"}
                        </span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
            <div role="rowgroup">
              {registros.map(({ l: x, r: g }, j) => {
                const fonte = fonteDoInstrumento(x);
                const de = `${aqui}#${ancoraDaLinha(g.linha)}`;
                return (
                  <div role="row" key={g.linha} id={ancoraDaLinha(g.linha)} className="gl gl-l" aria-rowindex={inicio + j + 2}>
                    <div role="cell" className="c-emenda">
                      <span className="rotulo-celula">Emenda</span>
                      {g.codigo ? (
                        <Link prefetch={false} id={`abrir-${g.linha}`} className="cod-btn t14" href={urlFicha(g.codigo, de)} aria-label={`Abrir a emenda ${g.codigoLegivel}, ${g.destinatario}, ${CANAL[g.canal].curto}`}>
                          {g.codigoLegivel}
                        </Link>
                      ) : (
                        <span className="aus">{NAO_LOCALIZADO}</span>
                      )}
                      <span className="sub t12">
                        {g.canal === "direto" ? (
                          g.instrumentoRotulo
                        ) : (
                          <a href={fonte.href} target="_blank" rel="noopener noreferrer" title={fonte.texto}>
                            {g.instrumentoRotulo}
                            <span className="sr"> ({fonte.numero ? `${fonte.texto}; ` : ""}fonte oficial, abre em nova aba)</span>
                          </a>
                        )}
                      </span>
                    </div>
                    <div role="cell" className="num">
                      <span className="rotulo-celula">Ano</span>
                      {g.ano ?? "—"}
                      {g.anoPagamento ? <span className="sub t12">pago em {g.anoPagamento}</span> : null}
                    </div>
                    <div role="cell">
                      <span className="rotulo-celula">Autoria</span>
                      <span className={g.autoria === NAO_LOCALIZADO ? "aus" : undefined}>{g.autoria}</span>
                      {g.coletiva ? (
                        <span className="sub">
                          <span className="selo-col">Autoria coletiva</span>
                        </span>
                      ) : null}
                    </div>
                    <div role="cell">
                      <span className="rotulo-celula">Tipo</span>
                      <span className={g.tipo === NAO_LOCALIZADO ? "aus" : undefined}>{g.tipo}</span>
                    </div>
                    <div role="cell">
                      <span className="rotulo-celula">Forma de repasse</span>
                      <EtiquetaCanal canal={g.canal} className="" />
                    </div>
                    <div role="cell" className="c-destinatario">
                      <span className="rotulo-celula">Destinatário</span>
                      {g.destinatario}
                      <span className="sub t12">
                        {NOME_DESTINATARIO[g.destinatarioGrupo]}
                        {r.municipio ? "" : ` · ${g.municipio ?? "sem município"}`}
                      </span>
                    </div>
                    <div role="cell">
                      <span className="sub t12">{g.finalidadeFonte}</span>
                      <span className={g.finalidade ? "clamp3" : "aus"} title={g.finalidade ?? undefined}>{g.finalidade ?? NAO_INFORMADO}</span>
                    </div>
                    <div role="cell" className="num direita">
                      <span className="rotulo-celula">Previsto</span>
                      <span className={g.previsto === null ? "aus t12" : undefined}>{g.previsto === null ? NAO_INFORMADO : rs(g.previsto)}</span>
                    </div>
                    <div role="cell" className="num direita">
                      <span className="rotulo-celula">Empenhado</span>
                      <span className={g.empenhado === null ? "aus t12" : undefined}>{g.empenhado === null ? NAO_INFORMADO : rs(g.empenhado)}</span>
                    </div>
                    <div role="cell" className="num direita c-realizado">
                      <span className="rotulo-celula">Realizado</span>
                      <strong>{rs(g.realizado)}</strong>
                      {g.realizado === 0 ? <span className="sub t12">zero registrado na fonte</span> : null}
                    </div>
                    <div role="cell">
                      <span className="rotulo-celula">Situação</span>
                      <span className="etq-sit">{g.situacao}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {s.registros === 0 ? (
            <div role="status" className="pilha" style={{ padding: "24px 16px", gap: 10, borderTop: "1px solid var(--linha-fina)" }}>
              <p className="disp t28" style={{ fontWeight: 720 }}>
                Nenhum registro neste recorte
              </p>
              <p className="t16 tinta-2">Remova um filtro ou alargue o período.</p>
              <div className="linha-flex" style={{ gap: 8 }}>
                <Link prefetch={false} className="btn t14" href={urlRegistros(semFiltros)}>
                  Limpar filtros
                </Link>
                <Link prefetch={false} className="btn t14" href={urlRegistros(mudar(r, { periodo: { de: 2019, ate: anoMax } }))}>
                  Toda a série (2019–{anoMax})
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <Paginacao
          rotulo="Páginas dos registros"
          pagina={pagina}
          paginas={paginas}
          url={(p) => urlRegistros({ ...r, pagina: p })}
          faixa={s.registros ? `Mostrando ${inteiroPt(inicio + 1)}–${inteiroPt(inicio + registros.length)} de ${inteiroPt(s.registros)}` : "Nenhum registro para mostrar"}
        />
      </section>
      <FocoNaLinha />
      <Datas execucao={l.execucao} />
    </>
  );
}

