/**
 * Dossiê de um fornecedor. Recebe a leitura pronta (lib/oportunidades/fornecedores.server.ts); aqui só se
 * apresenta. A sanção do TCU é confrontada com as datas de cada convênio: o laudo separa o que foi pago
 * dentro do período da sanção do que foi pago antes.
 */
import { urlInstrumento } from "@/lib/oportunidades/busca";
import { formatarData } from "@/lib/oportunidades/central";
import { nomeProponente } from "@/lib/oportunidades/diagnostico";
import { NIVEL_MOMENTO, ROTULO_MOMENTO, cnpjLegivel, momentoDaSancao, nomeFornecedor, type FornecedorConvenio } from "@/lib/oportunidades/fornecedores";
import type { LeituraDossieFornecedor } from "@/lib/oportunidades/fornecedores.server";
import { tituloOrgao } from "@/lib/oportunidades/padroes";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_SITUACAO, urlTce, type TceFederalPar, type TcePixCredor } from "@/lib/oportunidades/tce";
import type { TceDoFornecedor } from "@/lib/oportunidades/tce.server";
import { BotaoImprimir } from "../../fiscal/[ibge]/simular/BotaoImprimir";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";

type LeituraOk = Extract<LeituraDossieFornecedor, { estado: "ok" }>;

const AVISO =
  "Uso interno da PONTE. Dados abertos do Transferegov (SICONV) e lista de inidôneos do TCU. Estar em muitos municípios ou concentrar as " +
  "compras de uma prefeitura é indicador para olhar, não irregularidade.";

const n = (x: number) => x.toLocaleString("pt-BR");
const data = (iso: string | null | undefined) => (iso ? formatarData(iso) : "—");
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`);
const urlLaudo = (nr: string) => `/mapa/instrumento/${encodeURIComponent(nr)}/laudo`;

/** `tce`: o que o TCE-PB registra pago à empresa (onda 12, parte 3B); `null` = a leitura falhou. */
export function FornecedorConteudo({ leitura, tce = null }: { leitura: LeituraOk; tce?: TceDoFornecedor | null }) {
  const { fornecedor: f, convenios, contratos, instrumentos, lidera } = leitura;
  const nome = nomeFornecedor(f);
  const porNr = new Map(instrumentos.map((i) => [i.nr_convenio, i]));
  const referencia = leitura.execucao.referencia ?? leitura.execucao.dado_ate;
  const momento = (c: FornecedorConvenio) =>
    momentoDaSancao(f, { primeiro: c.primeiro_pagamento, ultimo: c.ultimo_pagamento }, contratos.filter((k) => k.nr_convenio === c.nr_convenio));
  const contratouNa = convenios.filter((c) => momento(c) === "contratou").length;
  const pagouNa = convenios.filter((c) => momento(c) === "pagou").length;
  const ordenados = [...convenios].sort((a, b) => b.pago - a.pago || b.contratado - a.contratado);
  const municipios = porMunicipio(convenios);

  return (
    <div className="pa-pagina mp-radar mp-laudo">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">
          Fornecedor · CNPJ {cnpjLegivel(f.cnpj)}
          {f.mei ? " · MEI" : ""}
        </p>
        <h1 className="pa-titulo">{nome}</h1>
        <p className="pa-sub">
          {n(f.pb_convenios)} {f.pb_convenios === 1 ? "convênio" : "convênios"} em {n(f.pb_municipios)}{" "}
          {f.pb_municipios === 1 ? "município" : "municípios"} da Paraíba, de {n(f.pb_orgaos)} {f.pb_orgaos === 1 ? "órgão" : "órgãos"} concedentes
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          <LinkMapa href="/mapa/fornecedores" className="pa-btn pa-btn-pequeno">
            Ver todos os fornecedores
          </LinkMapa>
        </p>
        <p className="mp-fiscal-aviso">{AVISO}</p>
      </div>

      {f.inidoneo_tcu && (
        <section aria-labelledby="forn-tcu" className="mp-radar-secao">
          <h2 id="forn-tcu" className="mp-radar-h2">
            Na lista de inidôneos do TCU
          </h2>
          <div className={`pa-cartao mp-laudo-frase mp-laudo-${contratouNa ? "critico" : pagouNa ? "alto" : "moderado"}`}>
            <p>
              <strong>Acórdão {f.tcu_acordao ?? "não informado"}</strong>
              {` · sanção ${f.tcu_inicio ? `de ${data(f.tcu_inicio)} ` : ""}até ${f.tcu_data_final ? data(f.tcu_data_final) : "data não informada"}`}
            </p>
            <p>
              {contratouNa || pagouNa
                ? [
                    contratouNa
                      ? `${n(contratouNa)} ${contratouNa === 1 ? "convênio tem contrato assinado" : "convênios têm contrato assinado"} dentro do período da sanção`
                      : null,
                    pagouNa ? `${n(pagouNa)} ${pagouNa === 1 ? "tem pagamento" : "têm pagamento"} dentro dele, de contrato anterior` : null,
                  ]
                    .filter(Boolean)
                    .join("; ") + " (marcados na tabela)."
                : "Nenhum pagamento ou contrato dos convênios abaixo cai dentro do período da sanção: a marca vale para contratações novas."}
            </p>
            {f.tcu_link && (
              <p className="mp-nao-imprimir">
                <a href={f.tcu_link} target="_blank" rel="noopener noreferrer">
                  Abrir o processo no TCU
                  <span className="pa-sr"> (abre em nova aba)</span>
                </a>
              </p>
            )}
          </div>
        </section>
      )}

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <article className="pa-cartao">
          <h2 className="pa-mono">Recebeu na PB</h2>
          <p className="pa-numero">{moedaCurta(f.pb_pago)}</p>
          <p className="pa-nota">
            {f.pb_n_pagamentos ? `${n(f.pb_n_pagamentos)} pagamentos, de ${data(f.pb_primeiro_pagamento)} a ${data(f.pb_ultimo_pagamento)}` : "nenhum pagamento"}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Contratos na PB</h2>
          <p className="pa-numero">{f.pb_contratos ? moedaCurta(f.pb_contratado) : "—"}</p>
          <p className="pa-nota">{f.pb_contratos ? `${n(f.pb_contratos)} ${f.pb_contratos === 1 ? "contrato" : "contratos"}` : "nenhum contrato registrado"}</p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Proponentes</h2>
          <p className="pa-numero">{n(f.pb_proponentes)}</p>
          <p className="pa-nota">
            prefeituras, Estado e entidades que pagaram · maior fornecedor em {n(lidera.length)} {lidera.length === 1 ? "prefeitura" : "prefeituras"}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">No Brasil</h2>
          <p className="pa-numero">{moedaCurta(f.br_pago)}</p>
          <p className="pa-nota">
            {n(f.br_convenios)} {f.br_convenios === 1 ? "convênio" : "convênios"} em {n(f.br_ufs)} {f.br_ufs === 1 ? "UF" : "UFs"}
          </p>
        </article>
      </div>

      {lidera.length > 0 && (
        <section aria-labelledby="forn-lidera" className="mp-radar-secao">
          <h2 id="forn-lidera" className="mp-radar-h2">
            Onde é o maior fornecedor da prefeitura
          </h2>
          <TabelaRolagem rotuloId="forn-lidera">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Prefeitura</th>
                  <th scope="col" className="mp-num">
                    Fatia
                  </th>
                  <th scope="col" className="mp-num">
                    Recebeu
                  </th>
                  <th scope="col" className="mp-num">
                    Pago a empresas
                  </th>
                </tr>
              </thead>
              <tbody>
                {lidera.map((m) => (
                  <tr key={m.cod_ibge}>
                    <th scope="row">
                      <LinkMapa href={`/mapa/fornecedores?municipio=${m.cod_ibge}`}>{m.municipio ?? `IBGE ${m.cod_ibge}`}</LinkMapa>
                      <span className="mp-tabela-secundario">{n(m.n_fornecedores)} fornecedores</span>
                    </th>
                    <td className="mp-num">{pct(m.maior_fatia)}</td>
                    <td className="mp-num">{moedaCurta(m.maior_pago)}</td>
                    <td className="mp-num">{moedaCurta(m.pago_pj)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
          <p className="pa-nota">Só os convênios em que a prefeitura é a proponente. Indicador para olhar, não irregularidade.</p>
        </section>
      )}

      {municipios.length > 1 && (
        <section aria-labelledby="forn-municipios" className="mp-radar-secao">
          <h2 id="forn-municipios" className="mp-radar-h2">
            Por município
          </h2>
          <TabelaRolagem rotuloId="forn-municipios">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Município</th>
                  <th scope="col" className="mp-num">
                    Convênios
                  </th>
                  <th scope="col" className="mp-num">
                    Recebeu
                  </th>
                </tr>
              </thead>
              <tbody>
                {municipios.map((m) => (
                  <tr key={m.chave}>
                    <th scope="row">{m.nome}</th>
                    <td className="mp-num">{n(m.convenios)}</td>
                    <td className="mp-num">{m.pago > 0 ? moedaCurta(m.pago) : "só contrato"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        </section>
      )}

      <section aria-labelledby="forn-convenios" className="mp-radar-secao">
        <h2 id="forn-convenios" className="mp-radar-h2">
          Convênios
        </h2>
        <TabelaRolagem rotuloId="forn-convenios">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Convênio</th>
                <th scope="col">Órgão</th>
                <th scope="col" className="mp-num">
                  Recebeu
                </th>
                <th scope="col">Pagamentos</th>
                <th scope="col" className="mp-num">
                  Contratado
                </th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((c) => {
                const i = porNr.get(c.nr_convenio);
                const m = momento(c);
                return (
                  <tr key={c.nr_convenio}>
                    <th scope="row">
                      <LinkMapa href={urlLaudo(c.nr_convenio)} className="mp-tabela-principal">
                        {c.municipio ?? "Município não informado"} · nº {c.nr_convenio}
                      </LinkMapa>
                      <span className="mp-tabela-secundario">
                        {nomeProponente(c)}
                        {i?.programa ? ` · ${i.programa}` : ""}
                      </span>
                      {m && m !== "antes" && <span className={`pa-tag mp-laudo-nivel mp-laudo-${NIVEL_MOMENTO[m]}`}>{ROTULO_MOMENTO[m]}</span>}
                    </th>
                    <td>{c.orgao_sup ? tituloOrgao(c.orgao_sup) : "—"}</td>
                    <td className="mp-num">
                      {moedaCurta(c.pago)}
                      {c.fatia !== null && c.pago > 0 && <span className="mp-tabela-secundario">{pct(c.fatia)} do pago a empresas</span>}
                    </td>
                    <td>
                      {c.n_pagamentos > 0 ? n(c.n_pagamentos) : "nenhum"}
                      {c.primeiro_pagamento && (
                        <span className="mp-tabela-secundario">
                          {c.ultimo_pagamento && c.ultimo_pagamento !== c.primeiro_pagamento ? (
                            <>
                              <span className="mp-nowrap">de {data(c.primeiro_pagamento)}</span>{" "}
                              <span className="mp-nowrap">a {data(c.ultimo_pagamento)}</span>
                            </>
                          ) : (
                            <span className="mp-nowrap">em {data(c.primeiro_pagamento)}</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="mp-num">{c.n_contratos ? moedaCurta(c.contratado) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TabelaRolagem>
      </section>

      <NoTce tce={tce} nomes={new Map([...Object.entries(tce?.nomes ?? {}), ...convenios.map((c) => [c.cod_ibge ?? "", c.municipio ?? ""] as [string, string])])} />

      {contratos.length > 0 && (
        <section aria-labelledby="forn-contratos" className="mp-radar-secao">
          <h2 id="forn-contratos" className="mp-radar-h2">
            Contratos
          </h2>
          <TabelaRolagem rotuloId="forn-contratos">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Contrato</th>
                  <th scope="col">Objeto</th>
                  <th scope="col" className="mp-num">
                    Valor
                  </th>
                  <th scope="col">Vigência</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((k, ordem) => (
                  <tr key={`${k.id_licitacao}-${k.id_contrato}-${ordem}`}>
                    <th scope="row">
                      <LinkMapa href={urlInstrumento(k.nr_convenio)}>convênio nº {k.nr_convenio}</LinkMapa>
                      <span className="mp-tabela-secundario">
                        contrato nº {k.nr_contrato ?? k.id_contrato}
                        {k.dt_assinatura ? ` · assinado em ${data(k.dt_assinatura)}` : ""}
                      </span>
                    </th>
                    <td>
                      {k.objeto ?? "—"}
                      {k.tipo_aquisicao && <span className="mp-tabela-secundario">{k.tipo_aquisicao}</span>}
                    </td>
                    <td className="mp-num">{moedaCurta(k.valor)}</td>
                    <td>{k.dt_inicio_vigencia || k.dt_fim_vigencia ? `${data(k.dt_inicio_vigencia)} a ${data(k.dt_fim_vigencia)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        </section>
      )}

      <section aria-labelledby="forn-fonte" className="mp-radar-secao">
        <h2 id="forn-fonte" className="mp-radar-h2">
          Fonte e método
        </h2>
        <ul className="mp-laudo-causas mp-laudo-miudo">
          <li>
            Pagamentos, contratos e convênios: dados abertos do Transferegov (SICONV), atualização de {data(referencia)}. O contrato liga ao
            convênio pela licitação; “recebeu” é a soma dos pagamentos à empresa.
          </li>
          <li>
            Nome: o mais recente nos pagamentos e contratos da PB, com qualquer CPF da razão social mascarado.
            {f.mei ? " A razão social segue o padrão do MEI (CPF ou raiz do CNPJ no nome)." : ""}
          </li>
          <li>
            Inidôneos:{" "}
            {f.inidoneo_tcu === null
              ? "a lista do TCU não foi lida nesta atualização; sem marca não quer dizer fora da lista."
              : "lista de licitantes inidôneos do TCU, lida no dia da atualização; o início da sanção é o trânsito em julgado do acórdão."}{" "}
            CEIS e CNEP, da CGU, ainda não entram.
          </li>
        </ul>
      </section>
    </div>
  );
}

/**
 * O que as despesas dos municípios no TCE-PB registram pago à empresa com dinheiro federal: fonte de
 * convênio, Pix e, onde há par no SICONV, o resto. Casado pelo CNPJ e pelo ano.
 */
function NoTce({ tce, nomes }: { tce: TceDoFornecedor | null; nomes: Map<string, string> }) {
  const municipio = (ibge: string) => nomes.get(ibge) || `IBGE ${ibge}`;
  const linhas: { chave: string; ibge: string; ano: number; par: TceFederalPar | null; pix: TcePixCredor | null }[] = [];
  if (tce) {
    const pix = new Map(tce.pix.map((x) => [`${x.ibge}-${x.ano}`, x]));
    for (const p of tce.pares) linhas.push({ chave: `${p.ibge}-${p.ano}`, ibge: p.ibge, ano: p.ano, par: p, pix: pix.get(`${p.ibge}-${p.ano}`) ?? null });
    const vistos = new Set(linhas.map((l) => l.chave));
    for (const x of tce.pix) if (!vistos.has(`${x.ibge}-${x.ano}`)) linhas.push({ chave: `${x.ibge}-${x.ano}`, ibge: x.ibge, ano: x.ano, par: null, pix: x });
  }
  linhas.sort((a, b) => b.ano - a.ano || municipio(a.ibge).localeCompare(municipio(b.ibge), "pt-BR"));
  return (
    <section aria-labelledby="forn-tce" className="mp-radar-secao">
      <h2 id="forn-tce" className="mp-radar-h2">
        Nas contas dos municípios no Tribunal de Contas do Estado (TCE-PB)
      </h2>
      {tce === null ? (
        <p className="pa-cartao pa-cartao-plano">
          As despesas do TCE-PB não puderam ser lidas agora. Costuma ser passageiro: recarregue a página em alguns minutos.
        </p>
      ) : linhas.length === 0 ? (
        <p className="pa-cartao pa-cartao-plano">
          O TCE-PB não registra pagamento a esta empresa com dinheiro federal (convênio ou Pix) nos arquivos lidos, desde 2024.
        </p>
      ) : (
        <TabelaRolagem rotuloId="forn-tce">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Município</th>
                <th scope="col">Ano</th>
                <th scope="col" className="mp-num">
                  TCE-PB
                </th>
                <th scope="col" className="mp-num">
                  SICONV
                </th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave}>
                  <th scope="row">
                    <LinkMapa href={urlTce(l.ibge)}>{municipio(l.ibge)}</LinkMapa>
                  </th>
                  <td>{l.ano}</td>
                  <td className="mp-num">
                    <ValorTce par={l.par} pix={l.pix} />
                  </td>
                  <td className="mp-num">{l.par && l.par.siconv > 0 ? moedaCurta(l.par.siconv) : "—"}</td>
                  <td>{l.par ? ROTULO_SITUACAO[l.par.situacao] : "Pix"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
      )}
      <p className="pa-nota">
        Despesas abertas do TCE-PB desde 2024: fontes 700, 631 e 570 (convênios da União) e 706 (Pix). O TCE-PB não traz o número do
        convênio; o casamento com o SICONV é pelo CNPJ e pelo ano, e o que não casa é para conferir.
      </p>
    </section>
  );
}

/** O total pago pelo município à empresa no TCE-PB e, embaixo, quanto foi de convênio federal e de Pix. */
function ValorTce({ par, pix }: { par: TceFederalPar | null; pix: TcePixCredor | null }) {
  const convenio = par?.tce_convenio ?? 0;
  const doPix = pix?.pago ?? par?.tce_pix ?? 0;
  const total = par ? par.tce_convenio + par.tce_pix + par.tce_outras : doPix;
  if (total <= 0) return <>—</>;
  return (
    <>
      {moedaCurta(total)}
      {convenio > 0 && <span className="mp-tabela-secundario">{moedaCurta(convenio)} de convênio</span>}
      {doPix > 0 && <span className="mp-tabela-secundario">{moedaCurta(doPix)} do Pix</span>}
      {par && par.tce_outras > 0 && <span className="mp-tabela-secundario">{moedaCurta(par.tce_outras)} de outras fontes</span>}
    </>
  );
}

/** Soma por município do proponente, do que mais recebeu ao que menos. */
function porMunicipio(cs: FornecedorConvenio[]): { chave: string; nome: string; convenios: number; pago: number }[] {
  const m = new Map<string, { chave: string; nome: string; convenios: number; pago: number }>();
  for (const c of cs) {
    const chave = c.cod_ibge ?? "?";
    const x = m.get(chave) ?? { chave, nome: c.municipio ?? "Município não informado", convenios: 0, pago: 0 };
    x.convenios += 1;
    x.pago += c.pago;
    m.set(chave, x);
  }
  return [...m.values()].sort((a, b) => b.pago - a.pago);
}
