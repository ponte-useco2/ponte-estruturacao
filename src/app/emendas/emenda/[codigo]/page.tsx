import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  codigoEmendaDaUrl,
  codigoLegivel,
  identificacaoDaEmenda,
  parametrosDoEndereco,
  urlPortalEmenda,
  type LinhaPublica,
} from "@/lib/oportunidades/emendas-publico";
import { lerEmenda, lerNomesDosMunicipios } from "@/lib/oportunidades/emendas-publico.server";
import {
  CANAIS_PUBLICOS,
  CANAL,
  CANAL_DA_FONTE,
  NAO_INFORMADO,
  NAO_LOCALIZADO,
  NAO_SE_APLICA,
  NOME_DESTINATARIO,
  NOME_TIPO,
  ORDENS_INSTRUMENTOS,
  anoAtualBrasilia,
  camposDoInstrumento,
  cnpjLegivel,
  coberturaDoFisico,
  comp,
  destinatarioDoEnte,
  execucaoDaLinhaPb,
  execucaoNacional,
  fonteDoInstrumento,
  instrumentosDaEmenda,
  inteiroPt,
  largura,
  lerConsultaInstrumentos,
  lerOrigem,
  nomeDaAutoria,
  nomeDoDestinatario,
  plural,
  porcento,
  rotuloDaVolta,
  rs,
  situacaoDoRegistro,
  somar,
  tipoPublico,
  urlFicha,
  urlInicio,
  urlMunicipio,
  type ConsultaInstrumentos,
  type Execucao,
} from "@/lib/oportunidades/emendas-recorte";
import { CopiarLink, FocoNoFragmento } from "../../_componentes/Navegador";
import { Ajuda, COR_DO_CANAL, Datas, EtiquetaCanal, Indisponivel, Paginacao, SemDado, Trilha } from "../../_componentes/Percurso";

type Props = { params: Promise<{ codigo: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = codigoEmendaDaUrl((await params).codigo);
  return c ? { title: `Emenda ${codigoLegivel(c)}` } : { title: "Emenda não encontrada", robots: { index: false, follow: true } };
}

const FORA = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M18 14v6H4V6h6" />
  </svg>
);

function Degraus({ e, titulo }: { e: Execucao; titulo: string }) {
  const m = e.degraus.reduce((x, d) => Math.max(x, d.valor ?? 0), 0);
  return (
    <ol className="degraus num" aria-label={titulo}>
      {e.degraus.map((d) => (
        <li key={d.rotulo} className="degrau">
          <span className="t14" style={{ fontWeight: 600 }}>
            {d.rotulo}
          </span>
          <span className="trilho" aria-hidden="true" style={{ height: 12 }}>
            <span className={`cheio${!d.valor ? " zero" : ""}`} style={{ width: `${largura(d.valor ?? 0, m).toFixed(2)}%` }} />
          </span>
          <span className="t14" style={{ textAlign: "right" }}>
            <strong className={d.valor === null ? "aus" : undefined}>{d.valor === null ? NAO_INFORMADO : rs(d.valor)}</strong>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * A ficha da emenda (versão 2): a volta ao MESMO recorte (o parâmetro `de`, só caminho interno do portal), Brasil e
 * Paraíba lado a lado (o nacional nunca soma à parcela da PB), a execução orçamentária completa, a PB por forma de
 * repasse e por município, a finalidade e — ajuste C — a lista COMPLETA dos instrumentos da emenda na PB, com busca,
 * ordem, página, o município do recorte no topo, o detalhe de cada um e a fonte oficial de cada um.
 */
export default async function FichaDaEmenda({ params, searchParams }: Props) {
  const { codigo: bruto } = await params;
  const codigo = codigoEmendaDaUrl(bruto);
  if (!codigo) notFound();
  const sp = parametrosDoEndereco(await searchParams);
  const anoMax = anoAtualBrasilia();
  const [l, nomes] = await Promise.all([lerEmenda(codigo), lerNomesDosMunicipios()]);
  if (l.estado === "nao_encontrado") notFound();
  if (l.estado === "sem_dado") return <SemDado />;
  if (l.estado !== "ok") return <Indisponivel endereco={urlFicha(codigo, null)} />;

  const nomeDe = (ibge: string) => nomes.find((m) => m.ibge === ibge)?.nome ?? null;
  const deBruto = sp.get("de");
  const origem = lerOrigem(deBruto, anoMax);
  if (deBruto !== null && !origem) {
    // Origem fora do portal (`//…`, `https://…`, `..`): ignorada, e o endereço volta a ser o da ficha, sem ela.
    const limpo = new URLSearchParams(sp);
    limpo.delete("de");
    const resto = limpo.toString();
    redirect(`/emendas/emenda/${codigo}${resto ? `?${resto}` : ""}`);
  }
  const munRecorte = origem?.tela === "registros" ? origem.recorte.municipio : origem?.tela === "municipio" ? origem.ibge : null;
  const nomeRecorte = munRecorte ? nomeDe(munRecorte) : null;
  const periodoOrigem = origem?.tela === "registros" ? origem.recorte.periodo : origem?.tela === "municipio" ? origem.periodo : null;
  const volta = origem?.caminho ?? "/emendas";
  const rotuloVolta = rotuloDaVolta(origem, nomeDe);
  const host = (await headers()).get("host") ?? "ponteprojetos.com.br";
  const aqui = urlFicha(codigo, origem?.caminho ?? null);

  const id = identificacaoDaEmenda(codigo, l.linhas, l.catalogo);
  const tipo = tipoPublico(id.tipo);
  const autoria = nomeDaAutoria(id.autor_codigo, id.autor_nome);
  const pb = somar(l.linhas);
  const nac = execucaoNacional(l.catalogo);
  const linhaPb = execucaoDaLinhaPb(l.catalogo);
  const localidade = l.catalogo.find((c) => !c.pb_localidade)?.localidade ?? l.catalogo[0]?.localidade ?? null;
  const munsPb = new Set(l.linhas.filter((x) => x.ibge).map((x) => x.ibge as string));
  const temEstado = l.linhas.some((x) => !x.ibge);
  const doRecorte = munRecorte ? l.linhas.filter((x) => x.ibge === munRecorte) : [];
  const somaRecorte = somar(doRecorte);
  const escalaOk = !!(nac && nac.degraus[0].valor && nac.degraus[0].valor > 0 && pb.comPrevisto > 0);
  const fisicoConv = l.linhas.filter((x) => x.canal === "convenio");
  const comFisico = fisicoConv.filter((x) => x.fisico !== null).length;

  // A PB por município (o do recorte em destaque e no topo).
  const porMun = new Map<string, LinhaPublica[]>();
  for (const x of l.linhas) {
    const k = x.ibge ?? "estado";
    porMun.set(k, [...(porMun.get(k) ?? []), x]);
  }
  const listaMun = [...porMun.entries()]
    .map(([k, xs]) => ({
      k,
      nome: k === "estado" ? "Estado da Paraíba (sem município)" : (xs[0].municipio ?? nomeDe(k) ?? k),
      destaque: !!munRecorte && k === munRecorte,
      canais: [...new Set(xs.map((x) => CANAL[CANAL_DA_FONTE[x.canal]].curto))].join(", "),
      soma: somar(xs),
    }))
    .sort((a, b) => Number(b.destaque) - Number(a.destaque) || a.nome.localeCompare(b.nome, "pt-BR"));
  const LIMITE_MUN = 12;

  // Os instrumentos (ajuste C).
  const ci: ConsultaInstrumentos = lerConsultaInstrumentos(sp);
  const inst = instrumentosDaEmenda(l.linhas, munRecorte, ci);
  const urlInst = (m: Partial<ConsultaInstrumentos>) => {
    const c = { ...ci, ...m };
    const q = new URLSearchParams();
    if (origem) q.set("de", origem.caminho);
    if (c.q) q.set("iq", c.q);
    if (c.ordem !== "municipio") q.set("iordem", c.ordem);
    if (c.pagina > 1) q.set("ipagina", String(c.pagina));
    const s = q.toString();
    return `/emendas/emenda/${codigo}${s ? `?${s}` : ""}#instrumentos`;
  };

  // As finalidades (objetos) do município do recorte, com a fonte rotulada.
  const objetos = [...new Map(doRecorte.filter((x) => x.objeto).map((x) => [`${x.objeto_fonte}|${x.objeto}`, x])).values()].slice(0, 4);
  const pfV = l.pf.reduce((t, p) => t + p.valor, 0);
  const pfN = l.pf.reduce((t, p) => t + p.n_pagamentos, 0);
  const anosPf = [...new Set(l.pf.map((p) => p.ano))].sort((a, b) => a - b);

  // Conferir na fonte: o Portal (a emenda) e as fontes dos instrumentos do município do recorte (ou de todos, sem recorte).
  const base = doRecorte.length ? doRecorte : l.linhas;
  const fontes = [{ texto: `Portal da Transparência: emenda ${codigoLegivel(codigo)}`, href: urlPortalEmenda(codigo), det: "Execução orçamentária nacional, localidades e favorecidos.", numero: null as string | null }];
  const vistos = new Set<string>();
  for (const x of base) {
    const f = fonteDoInstrumento(x);
    const c = CANAL_DA_FONTE[x.canal];
    if (c === "direto" || vistos.has(f.texto) || fontes.length >= 8) continue;
    vistos.add(f.texto);
    fontes.push({
      texto: f.texto,
      href: f.href,
      det: c === "convenio" ? "Valores, desembolsos, situação e execução física." : c === "especial" ? "Transferências especiais: procure pelo número do plano de ação." : "Fundo Nacional de Saúde: procure pelo número da proposta.",
      numero: f.numero,
    });
  }

  const trilha = [
    { nome: "Início", href: urlInicio(periodoOrigem ?? { de: 2023, ate: anoMax }, munRecorte) },
    ...(munRecorte && nomeRecorte && periodoOrigem ? [{ nome: nomeRecorte, href: urlMunicipio(munRecorte, periodoOrigem) }] : []),
    ...(origem?.tela === "registros" ? [{ nome: munRecorte ? "Registros" : "Registros da Paraíba", href: origem.caminho.split("#")[0] }] : []),
    { nome: `Emenda ${codigoLegivel(codigo)}` },
  ];

  return (
    <>
      <Trilha elos={trilha} />
      <nav aria-label="Nesta ficha" className="indice-ficha t14">
        <div className="envolve linha-flex" style={{ gap: "0 16px" }}>
          <span className="t12 rotulo tinta-2">Nesta ficha</span>
          <ol>
            <li>
              <a href="#f-brpb">Brasil e Paraíba</a>
            </li>
            <li>
              <a href="#f-exec">Execução orçamentária</a>
            </li>
            <li>
              <a href="#instrumentos">Instrumentos</a>
            </li>
            <li>
              <a href="#f-fin">Finalidade</a>
            </li>
            <li>
              <a href="#f-fonte">Conferir na fonte</a>
            </li>
          </ol>
        </div>
      </nav>
      <FocoNoFragmento />
      <section aria-labelledby="titulo-tela" className="envolve pilha" style={{ paddingTop: 12, paddingBottom: 32, gap: 28 }}>
        <div>
          <Link prefetch={false} className="btn t16" href={volta}>
            {rotuloVolta}
          </Link>
        </div>

        <div className="painel so-celular" style={{ padding: 16 }}>
          <p className="t14 rotulo tinta-2">Quanto chegou</p>
          <p className="t22 num" style={{ fontWeight: 760 }}>
            {comp(pb.realizado)} <span className="t14" style={{ fontWeight: 400 }}>na Paraíba</span>
          </p>
          {nomeRecorte ? (
            <p className="t18 num" style={{ fontWeight: 700 }}>
              {doRecorte.length ? comp(somaRecorte.realizado) : "nenhum registro"} <span className="t14" style={{ fontWeight: 400 }}>em {nomeRecorte}</span>
            </p>
          ) : null}
        </div>

        <div className="colunas col-7-5" style={{ alignItems: "end", borderBottom: "2px solid var(--linha)", paddingBottom: 24 }}>
          <div className="pilha" style={{ gap: 14 }}>
            <p className="t14 rotulo tinta-2">Emenda parlamentar federal · {tipo ? NOME_TIPO[tipo] : "tipo não localizado na fonte"}</p>
            <h1 id="titulo-tela" className="disp titulo-tela">
              Emenda{" "}
              <span className="mono" style={{ fontWeight: 500, letterSpacing: "-.01em" }}>
                {codigoLegivel(codigo)}
              </span>
            </h1>
            <p className="t18 linha-flex" style={{ gap: "8px 12px" }}>
              <strong>{autoria}</strong>
              {id.coletivo ? <span className="selo-col">Autoria coletiva</span> : null}
              <span className="t16 tinta-2">
                {id.funcao ? `${id.funcao}${id.subfuncao ? ` · ${id.subfuncao}` : ""} · ` : ""}ano {codigo.slice(0, 4)}
              </span>
            </p>
            {id.acao ? <p className="t14 tinta-2" style={{ maxWidth: "80ch" }}>Ação orçamentária: {id.acao}</p> : null}
          </div>
          <div role="group" aria-label="Como ler o código da emenda" className="cod-caixas">
            <div>
              <span className="mono t28" style={{ display: "block", fontWeight: 500 }}>
                {codigo.slice(0, 4)}
              </span>
              <span className="t12 rotulo tinta-2">ano</span>
            </div>
            <div className="destaque-sol">
              <span className="mono t28" style={{ display: "block", fontWeight: 500 }}>
                {codigo.slice(4, 8)}
              </span>
              <span className="t12 rotulo">autoria</span>
            </div>
            <div>
              <span className="mono t28" style={{ display: "block", fontWeight: 500 }}>
                {codigo.slice(8)}
              </span>
              <span className="t12 rotulo tinta-2">número</span>
            </div>
          </div>
        </div>

        <section aria-labelledby="f-brpb" className="pilha" style={{ gap: 12 }}>
          <h2 id="f-brpb" tabIndex={-1} className="disp t36" style={{ fontWeight: 720, fontVariationSettings: "'wdth' 86" }}>
            Brasil e Paraíba
          </h2>
          <div className="painel tres-ficha">
            <div>
              <div className="t12 rotulo">
                Valor nacional da emenda <Ajuda chave="nacional" territorio="Brasil" periodo="ano da emenda" />
              </div>
              <span className="num t28" style={{ fontWeight: 760 }}>
                <span className={nac ? undefined : "aus t16"}>{nac && nac.degraus[0].valor !== null ? rs(nac.degraus[0].valor) : NAO_LOCALIZADO}</span>
              </span>
              <span className="t14 num tinta-2">{nac ? `empenhados · pago total ${nac.pagoTotal === null ? NAO_INFORMADO : rs(nac.pagoTotal)}` : ""}</span>
            </div>
            <div className="fundo-mar">
              <div className="t12 rotulo">
                Parcela identificada na Paraíba <Ajuda chave="parcela" territorio="Paraíba" periodo="ano da emenda" />
              </div>
              <span className="num t28" style={{ fontWeight: 760 }}>
                {rs(pb.realizado)}{" "}
                <span className="t14" style={{ fontWeight: 400 }}>
                  realizados
                </span>
              </span>
              <span className="t14 num tinta-2">
                {plural(pb.registros, "instrumento", "instrumentos")} em {plural(munsPb.size, "município", "municípios")}
                {temEstado ? " e no Estado" : ""}
                {pb.comPrevisto ? ` · previsto ${rs(pb.previsto)}${pb.comPrevisto < pb.registros ? ` em ${pb.comPrevisto} dos ${pb.registros}` : ""}` : ` · previsto ${NAO_INFORMADO}`}
                {pb.comEmpenhado ? ` · empenhado ${rs(pb.empenhado)}${pb.comEmpenhado < pb.registros ? ` em ${pb.comEmpenhado} dos ${pb.registros}` : ""}` : ""}
              </span>
            </div>
            <div>
              <div className="t12 rotulo">
                Escala <Ajuda chave="escala" territorio="Paraíba e Brasil" periodo="ano da emenda" />
              </div>
              <span className="num t28" style={{ fontWeight: 760 }}>
                <span className={escalaOk ? undefined : "aus t16"}>{escalaOk && nac ? porcento(pb.previsto / (nac.degraus[0].valor as number)) : NAO_SE_APLICA}</span>
              </span>
              <span className="t14 num tinta-2">{escalaOk ? "previsto na PB ÷ empenhado nacional" : "sem previsto na PB ou sem empenho nacional"}</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="f-exec" className="painel pilha" style={{ padding: 24, gap: 14 }}>
          <div className="linha-flex" style={{ gap: 12 }}>
            <h2 id="f-exec" tabIndex={-1} className="disp t28" style={{ fontWeight: 720 }}>
              Execução orçamentária da emenda
            </h2>
            <Ajuda chave="execucao" territorio="Brasil e linha da Paraíba" periodo="ano da emenda e anos seguintes" />
          </div>
          <div className="colunas col-2" style={{ gap: "24px 40px" }}>
            <div className="pilha" style={{ gap: 8 }}>
              <h3 className="t18" style={{ fontWeight: 700 }}>
                Brasil <span className="t14 tinta-2" style={{ fontWeight: 400 }}>todas as localidades</span>
              </h3>
              {nac ? (
                <>
                  <Degraus e={nac} titulo="Execução orçamentária nacional" />
                  <p className="t14 num">
                    <strong>Pago total</strong> = pago no exercício + restos a pagar pagos = <strong>{nac.pagoTotal === null ? NAO_INFORMADO : rs(nac.pagoTotal)}</strong>
                  </p>
                </>
              ) : (
                <p className="t14 aus">{NAO_LOCALIZADO}</p>
              )}
            </div>
            <div className="pilha" style={{ gap: 8 }}>
              <h3 className="t18" style={{ fontWeight: 700 }}>
                Linha da Paraíba <span className="t14 tinta-2" style={{ fontWeight: 400 }}>no Portal da Transparência</span>
              </h3>
              {linhaPb ? (
                <>
                  <Degraus e={linhaPb} titulo="Execução orçamentária da linha da Paraíba" />
                  <p className="t14 num">
                    <strong>Pago total na linha PB</strong> = <strong>{linhaPb.pagoTotal === null ? NAO_INFORMADO : rs(linhaPb.pagoTotal)}</strong>
                  </p>
                </>
              ) : (
                <p className="t14">
                  <span className="aus">{NAO_SE_APLICA}</span>{" "}
                  <span className="tinta-2">
                    No Portal, a localidade desta emenda é {localidade ? localidade.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "não informada"}; não há
                    linha só da Paraíba.
                  </span>
                </p>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="f-pb" className="pilha" style={{ gap: 14 }}>
          <h2 id="f-pb" className="disp t36" style={{ fontWeight: 720, fontVariationSettings: "'wdth' 86" }}>
            Na Paraíba
          </h2>
          <div className="colunas col-5-7" style={{ alignItems: "start", gap: 24 }}>
            <div className="painel bloco">
              <h3 className="t18" style={{ fontWeight: 700 }}>
                Por forma de repasse
              </h3>
              <ul className="lista-barras">
                {CANAIS_PUBLICOS.map((c) => {
                  const x = somar(l.linhas.filter((y) => CANAL_DA_FONTE[y.canal] === c));
                  return (
                    <li key={c} className="barra-btn" style={{ ["--cc" as string]: COR_DO_CANAL[c] }}>
                      <EtiquetaCanal canal={c} />
                      <span className="t12 num tinta-2">
                        {x.registros
                          ? `${plural(x.registros, "registro", "registros")}${x.comPrevisto ? ` · previsto ${comp(x.previsto)}` : ""}${x.comEmpenhado ? ` · empenhado ${comp(x.empenhado)}` : ""}`
                          : ""}
                      </span>
                      <span className="num t14" style={{ textAlign: "right" }}>
                        <strong>{x.registros ? rs(x.realizado) : "nenhum registro"}</strong>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="painel bloco">
              <h3 className="t18" style={{ fontWeight: 700 }}>
                Por município{" "}
                <span className="t14 tinta-2" style={{ fontWeight: 400 }}>
                  {plural(listaMun.length, "destino", "destinos")}
                  {nomeRecorte ? ` · ${nomeRecorte} em destaque` : ""}
                </span>
              </h3>
              <div className="lin-mun t12 rotulo tinta-2" aria-hidden="true">
                <span>Município</span>
                <span>Forma de repasse</span>
                <span style={{ textAlign: "right" }}>Registros</span>
                <span style={{ textAlign: "right" }}>Previsto</span>
                <span style={{ textAlign: "right" }}>Realizado</span>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {listaMun.slice(0, LIMITE_MUN).map((m) => (
                  <LinhaMun key={m.k} m={m} />
                ))}
              </ul>
              {listaMun.length > LIMITE_MUN ? (
                <details className="mais">
                  <summary>Mostrar os {listaMun.length} destinos</summary>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {listaMun.slice(LIMITE_MUN).map((m) => (
                      <LinhaMun key={m.k} m={m} />
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </div>
        </section>


        <section aria-labelledby="instrumentos" className="pilha" style={{ gap: 14 }}>
          <h2 id="instrumentos" tabIndex={-1} className="disp t36" style={{ fontWeight: 720, fontVariationSettings: "'wdth' 86" }}>
            Instrumentos na Paraíba{" "}
            <span className="t18 tinta-2" style={{ fontWeight: 500 }}>
              {inteiroPt(inst.total)} em {plural(munsPb.size, "município", "municípios")}
              {temEstado ? " e no Estado" : ""}
            </span>
          </h2>
          <p className="t14 tinta-2">
            Todos os instrumentos desta emenda com destino na Paraíba, nos quatro canais. {nomeRecorte ? `${nomeRecorte} (o município do recorte) vem no topo, em destaque. ` : ""}O
            número de cada um leva à fonte oficial.
          </p>
          <form action={`/emendas/emenda/${codigo}#instrumentos`} method="get" className="linha-flex" style={{ gap: "8px 16px", alignItems: "end" }}>
            {origem ? <input type="hidden" name="de" value={origem.caminho} /> : null}
            <div className="pilha" style={{ gap: 6, flex: "1 1 280px" }}>
              <label htmlFor="campo-iq" className="t14" style={{ fontWeight: 700 }}>
                Buscar nos instrumentos
              </label>
              <input id="campo-iq" name="iq" type="search" className="campo t16" defaultValue={ci.q} maxLength={200} placeholder="Município, destinatário, número ou objeto" style={{ minHeight: 48 }} />
            </div>
            <div className="pilha" style={{ gap: 6, flex: "0 1 300px" }}>
              <label htmlFor="campo-iordem" className="t14" style={{ fontWeight: 700 }}>
                Ordem
              </label>
              <select id="campo-iordem" name="iordem" className="campo t16" defaultValue={ci.ordem} style={{ minHeight: 48 }}>
                {ORDENS_INSTRUMENTOS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn t14" type="submit">
              Aplicar
            </button>
          </form>
          <p className="t14" role="status">
            {inst.filtrados === inst.total ? plural(inst.total, "instrumento", "instrumentos") : `${plural(inst.filtrados, "instrumento encontrado", "instrumentos encontrados")} de ${inteiroPt(inst.total)}`}
            {fisicoConv.length ? ` · execução física ${coberturaDoFisico(comFisico, fisicoConv.length)}` : ""}
          </p>
          <div className="painel">
            <div className="instr-linha instr-cab t12 rotulo" aria-hidden="true">
              <span>Município</span>
              <span>Destinatário</span>
              <span>Forma de repasse</span>
              <span>Instrumento</span>
              <span style={{ textAlign: "right" }}>Previsto</span>
              <span style={{ textAlign: "right" }}>Empenhado</span>
              <span style={{ textAlign: "right" }}>Realizado</span>
              <span>Situação</span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {inst.itens.map((x) => (
                <Instrumento key={x.linha} x={x} destaque={!!munRecorte && x.ibge === munRecorte} />
              ))}
            </ul>
            {inst.filtrados === 0 ? (
              <p className="t16" role="status" style={{ padding: 16 }}>
                Nenhum instrumento com essa busca.{" "}
                <Link prefetch={false} href={urlInst({ q: "", pagina: 1 })}>
                  Ver todos
                </Link>
              </p>
            ) : null}
          </div>
          <Paginacao
            rotulo="Páginas dos instrumentos"
            pagina={inst.pagina}
            paginas={inst.paginas}
            url={(p) => urlInst({ pagina: p })}
            faixa={inst.filtrados ? `Mostrando ${(inst.pagina - 1) * 20 + 1}–${(inst.pagina - 1) * 20 + inst.itens.length} de ${inst.filtrados}` : ""}
          />
          {l.linhas.length ? (
            <div className="t14 linha-flex" style={{ gap: 10 }}>
              <strong>Pagamento não comprova a conclusão da obra nem a entrega do serviço.</strong>
              <Ajuda chave="fisico" territorio="instrumento" periodo="até a data de referência" />
            </div>
          ) : null}
        </section>

        <section aria-labelledby="f-fin" className="painel pilha" style={{ padding: 24, gap: 10 }}>
          <h2 id="f-fin" tabIndex={-1} className="disp t28" style={{ fontWeight: 720 }}>
            Finalidade
          </h2>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px 32px" }}>
            <div>
              <dt className="t12 rotulo tinta-2">Função de governo</dt>
              <dd className="t16">
                <span className={id.funcao ? undefined : "aus"}>{id.funcao ? `${id.funcao}${id.subfuncao ? ` · ${id.subfuncao}` : ""}` : NAO_LOCALIZADO}</span>
              </dd>
            </div>
            <div>
              <dt className="t12 rotulo tinta-2">Programa</dt>
              <dd className="t16">
                <span className={id.programa ? undefined : "aus"}>{id.programa ?? NAO_LOCALIZADO}</span>
              </dd>
            </div>
            <div>
              <dt className="t12 rotulo tinta-2">Ação orçamentária</dt>
              <dd className="t16">
                <span className={id.acao ? undefined : "aus"}>{id.acao ?? NAO_LOCALIZADO}</span>
              </dd>
            </div>
            {objetos.map((x) => (
              <div key={`${x.objeto_fonte}|${x.objeto}`}>
                <dt className="t12 rotulo tinta-2">
                  {registroFonte(x)}
                  {nomeRecorte ? ` em ${nomeRecorte}` : ""}
                </dt>
                <dd className="t16">{x.objeto}</dd>
              </div>
            ))}
          </dl>
        </section>

        {l.pf.length ? (
          <section aria-labelledby="f-pf" className="painel pilha" style={{ padding: 20, gap: 6 }}>
            <h2 id="f-pf" className="disp t22" style={{ fontWeight: 720 }}>
              Pessoas físicas
            </h2>
            <p className="t16 num">
              {rs(pfV)} pagos a pessoas físicas na Paraíba, em {plural(pfN, "pagamento", "pagamentos")}, pagos de {anosPf[0]}
              {anosPf.length > 1 ? ` a ${anosPf[anosPf.length - 1]}` : ""} (ano do pagamento). Nomes e documentos de pessoas físicas não são publicados.
            </p>
          </section>
        ) : null}

        <section aria-labelledby="f-fonte" className="painel pilha" style={{ padding: 24, gap: 12 }}>
          <h2 id="f-fonte" tabIndex={-1} className="disp t28" style={{ fontWeight: 720 }}>
            Conferir na fonte
          </h2>
          <ul className="fontes t14">
            {fontes.map((f) => (
              <li key={f.texto}>
                <a href={f.href} target="_blank" rel="noopener noreferrer">
                  {f.texto} {FORA}
                  <span className="t12" style={{ fontWeight: 400 }}>
                    abre em nova aba
                  </span>
                </a>
                <span className="tinta-2">
                  {f.numero ? (
                    <>
                      Número: <span className="numero-copiavel">{f.numero}</span>.{" "}
                    </>
                  ) : null}
                  {f.det}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="acoes linha-flex" style={{ gap: "10px 20px" }}>
          <Link prefetch={false} className="btn btn-pri t16" href={volta}>
            {rotuloVolta}
          </Link>
          <CopiarLink caminho={aqui} rotulo="Copiar link desta ficha" />
        </div>
        <code className="url">
          {host}
          {aqui}
        </code>
      </section>
      <Datas execucao={l.execucao} />
    </>
  );
}

function registroFonte(x: LinhaPublica): string {
  const r = { convenio: "Objeto do instrumento", plano_acao: "Objeto do plano de ação", proposta_fns: "Tipo de proposta (FNS)", acao_orcamentaria: "Ação orçamentária" } as const;
  return x.objeto_fonte ? r[x.objeto_fonte] : "Finalidade";
}

function LinhaMun({ m }: { m: { k: string; nome: string; destaque: boolean; canais: string; soma: ReturnType<typeof somar> } }) {
  return (
    <li className={`lin-mun${m.destaque ? " destaque" : ""}`}>
      <span className="t14" style={{ fontWeight: 600 }}>
        {m.nome}
        {m.destaque ? <span className="sr"> (município do recorte)</span> : null}
      </span>
      <span className="t12">{m.canais}</span>
      <span className="t14 num" style={{ textAlign: "right" }}>
        {inteiroPt(m.soma.registros)}
      </span>
      <span className="t14 num" style={{ textAlign: "right" }}>
        <span className={m.soma.comPrevisto ? undefined : "aus t12"}>{m.soma.comPrevisto ? rs(m.soma.previsto) : NAO_INFORMADO}</span>
      </span>
      <span className="t14 num" style={{ textAlign: "right" }}>
        <strong>{rs(m.soma.realizado)}</strong>
      </span>
    </li>
  );
}

function Instrumento({ x, destaque }: { x: LinhaPublica; destaque: boolean }) {
  const c = CANAL_DA_FONTE[x.canal];
  const f = fonteDoInstrumento(x);
  const numero = c === "convenio" ? `nº ${x.instrumento}` : c === "especial" ? `plano de ação nº ${x.instrumento}` : c === "saude" ? `proposta nº ${x.instrumento}` : `CNPJ ${cnpjLegivel(x.ente_cnpj ?? x.instrumento)}`;
  return (
    <li className={`instr${destaque ? " destaque" : ""}`}>
      <div className="instr-linha t14">
        <span style={{ fontWeight: 600 }}>
          {x.municipio ?? "Estado da Paraíba"}
          {destaque ? <span className="sub t12">município do recorte</span> : null}
        </span>
        <span>
          {nomeDoDestinatario(x)}
          <span className="sub t12">{NOME_DESTINATARIO[destinatarioDoEnte(x.ente_tipo)]}</span>
        </span>
        <span>
          <EtiquetaCanal canal={c} className="t14" />
        </span>
        <span className="mono">
          <a href={f.href} target="_blank" rel="noopener noreferrer">
            {c === "convenio" ? f.texto : c === "direto" ? numero : f.texto}
            <span className="sr"> (fonte oficial, abre em nova aba)</span>
          </a>
          {f.numero ? <span className="sub t12">Número: <span className="numero-copiavel">{f.numero}</span></span> : null}
        </span>
        <span className="num" style={{ textAlign: "right" }}>
          <span className={x.previsto === null ? "aus t12" : undefined}>{x.previsto === null ? NAO_INFORMADO : rs(x.previsto)}</span>
        </span>
        <span className="num" style={{ textAlign: "right" }}>
          <span className={x.empenhado === null ? "aus t12" : undefined}>{x.empenhado === null ? NAO_INFORMADO : rs(x.empenhado)}</span>
        </span>
        <span className="num" style={{ textAlign: "right" }}>
          <strong>{rs(x.pago)}</strong>
        </span>
        <span>
          <span className="etq-sit">{situacaoDoRegistro(x)}</span>
        </span>
      </div>
      <details>
        <summary className="t14">Ver o detalhe do {c === "direto" ? "pagamento" : c === "saude" ? "repasse" : "instrumento"}</summary>
        <div className="pilha" style={{ gap: 8, padding: "0 12px 12px" }}>
          <p className="t16">
            <span className="sub t12">{registroFonte(x)}</span>
            {x.objeto ?? <span className="aus">{NAO_INFORMADO}</span>}
          </p>
          <dl className="campos-instr t14 num">
            {camposDoInstrumento(x).map((cp) => (
              <div key={cp.rotulo}>
                <dt className="t12">{cp.rotulo}</dt>
                <dd>
                  <span className={cp.ausente ? "aus" : undefined}>{cp.valor}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
    </li>
  );
}
