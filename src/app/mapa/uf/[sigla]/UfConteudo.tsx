/**
 * A página da UF em abas (U1, desenho aprovado em 08/10/2026): o território acima do município. A Paraíba tem o dado
 * completo; as outras UFs, só o que a base guarda para o país (instrumentos vivos, propostas desde 2019, tempos, Pix
 * e fundo a fundo), e a página diz isso. A lista dos municípios é neutra para quem não é administrador.
 */
import Link from "next/link";
import { formatarData } from "@/lib/oportunidades/central";
import { ROTULO_DECISAO } from "@/lib/oportunidades/fiscal";
import { cnpjLegivel } from "@/lib/oportunidades/fornecedores";
import { formatarValor } from "@/lib/oportunidades/indicadores-municipio";
import { versaoLegivel } from "@/lib/oportunidades/osc";
import { ROTULO_ESPECIE, especieDe, lenteDe, urlEntidade } from "@/lib/oportunidades/pagina-entidade";
import { urlMunicipio, type NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import {
  ABAS_UF,
  NOME_UF,
  ancoraRegiao,
  ROTULO_LENTE_UF,
  etapasComparadas,
  funil,
  lentesDaUf,
  municipiosPorRegiao,
  naUf,
  orgaosComparados,
  porChave,
  porSinais,
  porSituacao,
  totalTerritorio,
  urlUf,
  type AbaUf,
  type MunicipioUf,
} from "@/lib/oportunidades/pagina-uf";
import type { LeituraUfOk } from "@/lib/oportunidades/pagina-uf.server";
import { tituloOrgao } from "@/lib/oportunidades/padroes";
import { CHAVE_TODOS, ROTULO_ETAPA } from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_TEMA } from "@/lib/oportunidades/temas";
import { Carregando } from "../../_componentes/Carregando";
import { BotaoImprimir } from "../../fiscal/[ibge]/simular/BotaoImprimir";
import { Secao } from "../../municipio/[ibge]/relatorio/RelatorioConteudo";

const n = (x: number | null | undefined) => (x === null || x === undefined ? "—" : x.toLocaleString("pt-BR"));
const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");
const pct = (x: number | null) => (x === null ? "—" : `${x.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`);
const dias = (x: number | null) => (x === null ? "—" : `${n(Math.round(x))} dias`);

/** Fora da PB, o município não tem a página em abas: a descida vai aos investimentos do município. */
const urlDoMunicipioNaUf = (ibge: string, completa: boolean) => (completa ? urlMunicipio(ibge) : `/mapa/municipio/${ibge}/investimentos`);

function Cabeca({ l, nivel }: { l: LeituraUfOk; nivel: NivelAcesso }) {
  const nome = NOME_UF[l.sigla];
  return (
    <div className="pa-pilha mp-radar-cabeca">
      <nav aria-label="Onde você está" className="mp-mun-trilha">
        <span>Brasil</span>
        <span aria-current="page">{nome}</span>
      </nav>
      <h1 className="pa-titulo">{nome}</h1>
      <p className="pa-sub mp-mun-chips">
        <span>{l.sigla}</span>
        <span>{l.completa ? "dado completo: todos os instrumentos desde 2008" : "cobertura parcial: instrumentos vivos e propostas desde 2019"}</span>
        <span>Transferegov até {data(l.execucao.dado_ate)}</span>
      </p>
      <p className="mp-nao-imprimir mp-laudo-acoes">
        <BotaoImprimir />
        {nivel >= 3 && l.completa && (
          <>
            <Link href="/mapa/fiscal" className="pa-btn pa-btn-pequeno" prefetch={false}>
              Fiscal dos 223
            </Link>
            <Link href={`/mapa/painel?uf=${l.sigla}`} className="pa-btn pa-btn-pequeno" prefetch={false}>
              Painel
            </Link>
            <Link href="/mapa/painel/tce" className="pa-btn pa-btn-pequeno" prefetch={false}>
              TCE-PB
            </Link>
            <Link href="/mapa/painel/contas" className="pa-btn pa-btn-pequeno" prefetch={false}>
              Contas e obras
            </Link>
            <Link href="/mapa/fornecedores" className="pa-btn pa-btn-pequeno" prefetch={false}>
              Fornecedores
            </Link>
          </>
        )}
      </p>
      {!l.completa && (
        <p className="pa-nota">
          A PONTE cobre a Paraíba por inteiro. Para {nome}, a base tem os instrumentos vivos (em execução, em prestação de contas e em
          TCE), as propostas desde 2019, o tempo de cada etapa e o Pix e o fundo a fundo por ano. Não há fiscal, indicadores nem OSC.
        </p>
      )}
    </div>
  );
}

function Abas({ sigla, aba, nivel }: { sigla: string; aba: AbaUf; nivel: NivelAcesso }) {
  return (
    <nav aria-label="Partes do estado" className="mp-mun-abas mp-nao-imprimir">
      {ABAS_UF.filter((a) => nivel >= a.minimo).map((a) => (
        <Link key={a.id} href={urlUf(sigla, a.id)} aria-current={a.id === aba ? "page" : undefined} scroll={false} prefetch={false}>
          {a.nome}
          <Carregando />
        </Link>
      ))}
    </nav>
  );
}

function SemSomas() {
  return (
    <p className="pa-cartao pa-cartao-plano">
      As somas do estado saem na próxima rodada diária do painel (a primeira depois da atualização de 08/10/2026).
    </p>
  );
}

function Cartao({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: React.ReactNode }) {
  return (
    <article className="pa-cartao mp-rel-cartao">
      <h3 className="pa-mono">{rotulo}</h3>
      <p className="pa-numero">{valor}</p>
      {nota && <p className="pa-nota">{nota}</p>}
    </article>
  );
}

function Resumo({ l }: { l: LeituraUfOk }) {
  const t = l.territorio;
  const grupos = t ? porSituacao(t, l.sigla) : [];
  const g = (id: string) => grupos.find((x) => x.id === id);
  const vivos = t ? totalTerritorio(t, l.sigla, "vivos") : null;
  const ano = Number((l.execucao.referencia ?? l.execucao.dado_ate ?? "").slice(0, 4));
  const f = l.desfechos ? funil(l.desfechos, l.sigla).find((x) => x.ano === ano) : undefined;
  const pixAno = (l.pix ?? []).filter((p) => p.recorte === l.sigla && p.ano !== null && p.pago > 0).sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0))[0];
  const lentes = l.proponentes ? lentesDaUf(l.proponentes) : null;
  return (
    <>
      <Secao id="uf-numeros" titulo="Em números">
        {t ? (
          <div className="pa-grade pa-grade-4 mp-painel-cartoes">
            <Cartao rotulo="Em execução" valor={n(g("execucao")?.n ?? 0)} nota={`${moedaCurta(g("execucao")?.valor ?? 0)} de valor global; ${moedaCurta(g("execucao")?.desembolsado ?? 0)} desembolsados.`} />
            <Cartao rotulo="Prestando contas" valor={n(g("contas")?.n ?? 0)} nota={`${moedaCurta(g("contas")?.valor ?? 0)} de valor global.`} />
            <Cartao rotulo="Municípios com instrumento vivo" valor={n(vivos?.municipios ?? 0)} nota={`${n(vivos?.proponentes ?? 0)} proponentes com instrumento vivo.`} />
            {f && <Cartao rotulo={`Propostas em ${ano}`} valor={n(f.enviadas)} nota={`${n(f.assinadas)} assinadas até agora; ${n(f.emAndamento)} em andamento.`} />}
            {l.janelas !== null && (
              <Cartao
                rotulo="Janelas abertas no Transferegov"
                valor={n(l.janelas)}
                nota={
                  <Link href="/mapa" prefetch={false}>
                    Ver as janelas
                    <Carregando />
                  </Link>
                }
              />
            )}
            {pixAno && (
              <Cartao
                rotulo={`Pix ${pixAno.ano}${pixAno.ano === ano ? " (ano em curso)" : ""}`}
                valor={moedaCurta(pixAno.pago)}
                nota={`pagos até agora; ${n(pixAno.planos_pagos)} planos pagos de ${n(pixAno.planos)}.`}
              />
            )}
          </div>
        ) : (
          <SemSomas />
        )}
      </Secao>

      {lentes && (
        <Secao id="uf-quem-recebe" titulo="Quem recebe no estado" nota="Os proponentes com instrumento na base, pelas lentes da página do município. Cada município e cada entidade têm a sua página.">
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Lente</th>
                  <th scope="col">Entidades</th>
                  <th scope="col">Instrumentos</th>
                  <th scope="col">Em execução</th>
                  <th scope="col">Valor global</th>
                </tr>
              </thead>
              <tbody>
                {lentes.map((x) => (
                  <tr key={x.lente}>
                    <th scope="row">{ROTULO_LENTE_UF[x.lente]}</th>
                    <td className="mp-rel-num">{n(x.entidades)}</td>
                    <td className="mp-rel-num">{n(x.instrumentos)}</td>
                    <td className="mp-rel-num">{n(x.emExecucao)}</td>
                    <td className="mp-rel-num">{moedaCurta(x.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {l.osc && (
            <p className="pa-nota">
              Na sociedade civil, além das que têm instrumento: {n(l.osc.ativas)} organizações ativas no Mapa das OSC (Ipea, versão de{" "}
              {versaoLegivel(l.osc.versao)}), listadas na página de cada município.
            </p>
          )}
          <p className="mp-nao-imprimir mp-laudo-acoes">
            <Link href={urlUf(l.sigla, "municipios")} className="pa-btn pa-btn-pequeno" prefetch={false}>
              Os municípios
              <Carregando />
            </Link>
            <Link href={urlUf(l.sigla, "estado")} className="pa-btn pa-btn-pequeno" prefetch={false}>
              O estado como proponente
              <Carregando />
            </Link>
          </p>
        </Secao>
      )}

      {l.indicadores && l.indicadores.length > 0 && (
        <Secao id="uf-indicadores" titulo="O estado em indicadores" nota="O valor do estado e o do Brasil no mesmo ano, pelas mesmas fontes da página do município.">
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Indicador</th>
                  <th scope="col">{NOME_UF[l.sigla]}</th>
                  <th scope="col">Brasil</th>
                  <th scope="col">Ano</th>
                </tr>
              </thead>
              <tbody>
                {l.indicadores.map((x) => (
                  <tr key={x.item.id}>
                    <th scope="row">{x.item.nome}</th>
                    <td className="mp-rel-num">{formatarValor(x.uf, x.item)}</td>
                    <td className="mp-rel-num">{x.br === null ? "—" : formatarValor(x.br, x.item)}</td>
                    <td>{x.ano}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}
      {l.faltas.length > 0 && <p className="pa-nota">Não puderam ser lidos agora: {l.faltas.join(", ")}.</p>}
    </>
  );
}

function TabelaMunicipios({ ms, completa, admin }: { ms: MunicipioUf[]; completa: boolean; admin: boolean }) {
  return (
    <div className="mp-tabela-rolagem">
      <table className="mp-tabela">
        <thead>
          <tr>
            <th scope="col">Município</th>
            {completa && <th scope="col">Porte na PB (tercil)</th>}
            {completa && <th scope="col">População</th>}
            <th scope="col">Instrumentos</th>
            <th scope="col">Em execução</th>
            <th scope="col">Valor em execução</th>
            {completa && <th scope="col">OSC ativas</th>}
            {admin && <th scope="col">Transferência voluntária (fiscal)</th>}
            {admin && <th scope="col">Sinais do painel</th>}
          </tr>
        </thead>
        <tbody>
          {ms.map((m) => (
            <tr key={m.ibge}>
              <td>
                <Link href={urlDoMunicipioNaUf(m.ibge, completa)} prefetch={false}>
                  {m.nome}
                  <Carregando />
                </Link>
              </td>
              {completa && <td>{m.porte ?? "—"}</td>}
              {completa && <td className="mp-rel-num">{n(m.populacao)}</td>}
              <td className="mp-rel-num">{n(m.instrumentos)}</td>
              <td className="mp-rel-num">{m.em_execucao ? n(m.em_execucao) : "—"}</td>
              <td className="mp-rel-num">{m.valor_execucao ? moedaCurta(m.valor_execucao) : "—"}</td>
              {completa && <td className="mp-rel-num">{n(m.osc_ativas)}</td>}
              {admin && <td>{m.decisao_b ? (ROTULO_DECISAO[m.decisao_b as keyof typeof ROTULO_DECISAO] ?? m.decisao_b) : "—"}</td>}
              {admin && <td className="mp-rel-num">{n(m.sinais)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Municipios({ l, nivel, ordenarPorSinais }: { l: LeituraUfOk; nivel: NivelAcesso; ordenarPorSinais: boolean }) {
  if (!l.municipios) return <p className="pa-nota">A lista dos municípios não pôde ser lida agora.</p>;
  // o fiscal e os sinais do painel só existem para a Paraíba
  const admin = nivel >= 3 && l.completa;
  const ordem = ordenarPorSinais
    ? "ordenados pelos sinais do painel (só o administrador vê esta ordem)"
    : l.completa
      ? "em ordem alfabética dentro de cada região imediata do IBGE"
      : "em ordem alfabética";
  const nota = l.completa
    ? `Os ${n(l.municipios.length)} municípios, ${ordem}. Instrumentos: todos os da base desde 2008; porte: o tercil da população entre os 223; OSC: as ativas no Mapa das OSC.`
    : `Os ${n(l.municipios.length)} municípios com instrumento vivo na base, ${ordem}.`;
  return (
    <Secao id="uf-municipios" titulo="Os municípios" nota={nota}>
      {admin && (
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <span className="pa-nota">Administrador: </span>
          <Link href={urlUf(l.sigla, "municipios")} className={`pa-chip${!ordenarPorSinais ? " pa-ativo" : ""}`} prefetch={false}>
            Por região
          </Link>
          <Link href={`${urlUf(l.sigla, "municipios")}&ordem=sinais`} className={`pa-chip${ordenarPorSinais ? " pa-ativo" : ""}`} prefetch={false}>
            Por sinais do painel
          </Link>
        </p>
      )}
      {ordenarPorSinais ? (
        <TabelaMunicipios ms={porSinais(l.municipios)} completa={l.completa} admin={admin} />
      ) : (
        municipiosPorRegiao(l.municipios).map((g) => (
          <details key={g.regiao} id={ancoraRegiao(g.regiao)} className="mp-ent-grupo" open>
            <summary>
              <strong>{l.completa ? `Região imediata de ${g.regiao}` : g.regiao}</strong> · {n(g.municipios.length)}{" "}
              {g.municipios.length === 1 ? "município" : "municípios"}
            </summary>
            <TabelaMunicipios ms={g.municipios} completa={l.completa} admin={admin} />
          </details>
        ))
      )}
      <p className="mp-nao-imprimir mp-laudo-acoes">
        <a href={`/mapa/uf/${l.sigla.toLowerCase()}/csv`} className="pa-btn pa-btn-pequeno">
          Municípios em CSV
        </a>
      </p>
    </Secao>
  );
}

function Estado({ l }: { l: LeituraUfOk }) {
  if (!l.proponentes) return <p className="pa-nota">A lista dos proponentes não pôde ser lida agora.</p>;
  const estaduais = l.proponentes
    .map((p) => ({ ...p, especie: especieDe(p.proponente, p.tipo_agente) }))
    .filter((p) => lenteDe(p.especie) === "estado")
    .sort((a, b) => b.valor - a.valor || (a.proponente ?? "").localeCompare(b.proponente ?? "", "pt-BR"));
  return (
    <Secao
      id="uf-estado"
      titulo="O estado como proponente"
      nota={`O governo, as secretarias, as universidades, os fundos e as autarquias estaduais com instrumento na base${l.completa ? "" : " (só os vivos)"}, cada um com a sua página.`}
    >
      {estaduais.length ? (
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Entidade</th>
                <th scope="col">Espécie</th>
                <th scope="col">Sede</th>
                <th scope="col">Instrumentos</th>
                <th scope="col">Em execução</th>
                <th scope="col">Valor global</th>
                <th scope="col">Mais recente</th>
              </tr>
            </thead>
            <tbody>
              {estaduais.map((p) => (
                <tr key={p.cnpj}>
                  <td>
                    <Link href={urlEntidade(p.cnpj)} prefetch={false}>
                      {p.proponente ?? cnpjLegivel(p.cnpj)}
                      <Carregando />
                    </Link>
                  </td>
                  <td>{ROTULO_ESPECIE[p.especie]}</td>
                  <td>{p.municipio ? tituloOrgao(p.municipio) : "—"}</td>
                  <td className="mp-rel-num">{n(p.instrumentos)}</td>
                  <td className="mp-rel-num">{p.em_execucao ? n(p.em_execucao) : "—"}</td>
                  <td className="mp-rel-num">{moedaCurta(p.valor)}</td>
                  <td>{p.ultimo_ano ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Nenhum órgão estadual com instrumento na base.</p>
      )}
      <p className="pa-nota">
        A situação fiscal dos estados não entra aqui: o relatório dos estados no Tesouro Transparente não é atualizado desde 03/11/2025, e o
        extrato do CAUC tem verificação manual.
      </p>
    </Secao>
  );
}

function Dinheiro({ l, nivel }: { l: LeituraUfOk; nivel: NivelAcesso }) {
  const t = l.territorio;
  if (!t) return <SemSomas />;
  const situacoes = porSituacao(t, l.sigla);
  const orgaos = porChave(t, l.sigla, "orgao");
  const temas = porChave(t, l.sigla, "tema");
  const maiorTema = Math.max(1, ...temas.map((x) => x.valor));
  const pix = (l.pix ?? []).filter((p) => p.recorte === l.sigla && p.ano !== null).sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0));
  const fundoPorAno = new Map<number, { repasse: number; planos: number }>();
  for (const f of l.fundo ?? []) {
    if (f.ano === null) continue;
    const g = fundoPorAno.get(f.ano) ?? { repasse: 0, planos: 0 };
    g.repasse += Number(f.repasse ?? 0);
    g.planos += f.planos;
    fundoPorAno.set(f.ano, g);
  }
  return (
    <>
      <Secao id="uf-situacao" titulo="Os instrumentos por situação" nota={l.completa ? "Todos os instrumentos da base, desde 2008." : "Só os vivos (a base não guarda os outros fora da Paraíba)."}>
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Situação</th>
                <th scope="col">Instrumentos</th>
                <th scope="col">Valor global</th>
                <th scope="col">Desembolsado</th>
              </tr>
            </thead>
            <tbody>
              {situacoes.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.rotulo}</th>
                  <td className="mp-rel-num">{n(s.n)}</td>
                  <td className="mp-rel-num">{moedaCurta(s.valor)}</td>
                  <td className="mp-rel-num">{moedaCurta(s.desembolsado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
      <Secao id="uf-orgaos" titulo="De onde vem o dinheiro" nota="Os instrumentos vivos por órgão concedente, do maior valor para o menor.">
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Órgão</th>
                <th scope="col">Instrumentos vivos</th>
                <th scope="col">Em execução</th>
                <th scope="col">Valor global</th>
                <th scope="col">Desembolsado</th>
              </tr>
            </thead>
            <tbody>
              {(nivel >= 1 ? orgaos : orgaos.slice(0, 10)).map((o) => (
                <tr key={o.chave}>
                  <th scope="row">{tituloOrgao(o.chave)}</th>
                  <td className="mp-rel-num">{n(o.n)}</td>
                  <td className="mp-rel-num">{n(o.em_execucao)}</td>
                  <td className="mp-rel-num">{moedaCurta(o.valor)}</td>
                  <td className="mp-rel-num">{moedaCurta(o.desembolsado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
      {nivel >= 1 && temas.length > 0 && (
        <Secao id="uf-temas" titulo="Por tema" nota="Os instrumentos vivos por tema do programa (um instrumento pode ter mais de um tema).">
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela mp-ent-areas">
              <tbody>
                {temas.map((x) => (
                  <tr key={x.chave}>
                    <th scope="row">{ROTULO_TEMA[x.chave] ?? x.chave}</th>
                    <td className="mp-rel-num">{n(x.n)}</td>
                    <td className="mp-rel-num">{moedaCurta(x.valor)}</td>
                    <td className="mp-ent-barra-celula" aria-hidden="true">
                      <span className="mp-ent-barra" style={{ width: `${Math.round((x.valor / maiorTema) * 100)}%` }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}
      {nivel >= 1 && pix.length > 0 && (
        <Secao id="uf-pix" titulo="Pix (transferências especiais)" nota="Os planos de ação com beneficiário no estado, por ano da emenda.">
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Ano</th>
                  <th scope="col">Planos</th>
                  <th scope="col">Planos pagos</th>
                  <th scope="col">Pago</th>
                  <th scope="col">Pago com relatório de gestão</th>
                </tr>
              </thead>
              <tbody>
                {pix.map((p) => (
                  <tr key={p.ano}>
                    <th scope="row">{p.ano}</th>
                    <td className="mp-rel-num">{n(p.planos)}</td>
                    <td className="mp-rel-num">{n(p.planos_pagos)}</td>
                    <td className="mp-rel-num">{moedaCurta(p.pago)}</td>
                    <td className="mp-rel-num">{moedaCurta(p.pago_com_relatorio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}
      {nivel >= 1 && fundoPorAno.size > 0 && (
        <Secao id="uf-fundo" titulo="Fundo a fundo" nota="Os planos de ação do fundo a fundo com entes do estado, por ano.">
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Ano</th>
                  <th scope="col">Planos</th>
                  <th scope="col">Repasse</th>
                </tr>
              </thead>
              <tbody>
                {[...fundoPorAno.entries()].sort((a, b) => b[0] - a[0]).map(([ano, g]) => (
                  <tr key={ano}>
                    <th scope="row">{ano}</th>
                    <td className="mp-rel-num">{n(g.planos)}</td>
                    <td className="mp-rel-num">{moedaCurta(g.repasse)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}
    </>
  );
}

function Tempos({ l }: { l: LeituraUfOk }) {
  const nome = NOME_UF[l.sigla];
  const todos = l.etapas ? etapasComparadas(l.etapas, l.sigla, CHAVE_TODOS) : [];
  const orgaos = l.etapas ? orgaosComparados(l.etapas, l.sigla) : [];
  const f = l.desfechos ? funil(l.desfechos, l.sigla) : [];
  const fBr = l.desfechos ? funil(l.desfechos, "BR") : [];
  return (
    <>
      <Secao
        id="uf-tempos"
        titulo={`Quanto leva cada etapa ${naUf(l.sigla)}`}
        nota="Mediana em dias das etapas que terminaram nos últimos 36 meses, contra a do Brasil. Marcada quando passa de 1,5 vez a do país; com menos de 10 medições, não compara."
      >
        {todos.some((e) => e.uf !== null) ? (
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Etapa (todos os órgãos)</th>
                  <th scope="col">{nome}</th>
                  <th scope="col">Brasil</th>
                </tr>
              </thead>
              <tbody>
                {todos.map((e) => (
                  <tr key={e.etapa}>
                    <th scope="row">{e.rotulo}</th>
                    <td className="mp-rel-num">{e.lento ? <strong>{dias(e.uf)}</strong> : dias(e.uf)}</td>
                    <td className="mp-rel-num">{dias(e.br)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pa-nota">Sem medições suficientes do tempo das etapas.</p>
        )}
        {orgaos.length > 0 && (
          <details className="mp-ent-grupo">
            <summary>
              <strong>Por órgão</strong> · {n(orgaos.length)} órgãos, os com mais etapas lentas primeiro
            </summary>
            <div className="mp-tabela-rolagem">
              <table className="mp-tabela">
                <thead>
                  <tr>
                    <th scope="col">Órgão</th>
                    {orgaos[0].etapas.map((e) => (
                      <th key={e.etapa} scope="col">
                        {ROTULO_ETAPA[e.etapa] ?? e.etapa}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orgaos.map((o) => (
                    <tr key={o.chave}>
                      <th scope="row">{tituloOrgao(o.rotulo)}</th>
                      {o.etapas.map((e) => (
                        <td key={e.etapa} className="mp-rel-num">
                          {e.uf === null ? "—" : e.lento ? <strong>{dias(e.uf)}</strong> : dias(e.uf)}
                          {e.br !== null && <span className="pa-nota"> (Brasil {dias(e.br)})</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </Secao>
      {f.length > 0 && (
        <Secao id="uf-funil" titulo="O funil das propostas" nota="As propostas por ano de envio e o que aconteceu com elas até agora. Os anos recentes ainda têm muita proposta em andamento.">
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Ano</th>
                  <th scope="col">Enviadas</th>
                  <th scope="col">Assinadas</th>
                  <th scope="col">% assinadas</th>
                  <th scope="col">% no Brasil</th>
                  <th scope="col">Reprovadas ou impedidas</th>
                  <th scope="col">Em andamento</th>
                </tr>
              </thead>
              <tbody>
                {f.map((x) => (
                  <tr key={x.ano}>
                    <th scope="row">{x.ano}</th>
                    <td className="mp-rel-num">{n(x.enviadas)}</td>
                    <td className="mp-rel-num">{n(x.assinadas)}</td>
                    <td className="mp-rel-num">{pct(x.pctAssinadas)}</td>
                    <td className="mp-rel-num">{pct(fBr.find((y) => y.ano === x.ano)?.pctAssinadas ?? null)}</td>
                    <td className="mp-rel-num">{n(x.negadas)}</td>
                    <td className="mp-rel-num">
                      {n(x.emAndamento)}
                      {x.paradas > 0 && <span className="pa-nota"> ({n(x.paradas)} paradas há mais de um ano)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}
    </>
  );
}

function Relatorio({ l }: { l: LeituraUfOk }) {
  return (
    <Secao id="uf-relatorio" titulo="Relatório e dados" nota="Para imprimir ou anexar: o resumo, os municípios e o dinheiro do estado numa peça só.">
      <p className="mp-nao-imprimir mp-laudo-acoes">
        <BotaoImprimir />
        <a href={`/mapa/uf/${l.sigla.toLowerCase()}/csv`} className="pa-btn pa-btn-pequeno">
          Municípios em CSV
        </a>
      </p>
      <p className="pa-nota">
        Fontes: Transferegov (instrumentos, propostas, tempos, Pix e fundo a fundo), arquivo de {data(l.execucao.dado_ate)}
        {l.completa && l.osc ? `; Mapa das OSC (Ipea), versão de ${versaoLegivel(l.osc.versao)}` : ""}
        {l.completa ? "; IBGE e demais fontes da camada 2 nos indicadores" : ""}.
      </p>
    </Secao>
  );
}

export function UfConteudo({ l, aba, nivel, porSinais: ordenarPorSinais = false }: { l: LeituraUfOk; aba: AbaUf; nivel: NivelAcesso; porSinais?: boolean }) {
  const nomeAba = ABAS_UF.find((a) => a.id === aba)?.nome ?? "";
  return (
    <div className="pa-pagina mp-radar mp-laudo mp-rel mp-mun">
      <Cabeca l={l} nivel={nivel} />
      <Abas sigla={l.sigla} aba={aba} nivel={nivel} />
      <p className="mp-so-imprimir pa-kicker">{nomeAba}</p>
      {aba === "resumo" && <Resumo l={l} />}
      {aba === "municipios" && <Municipios l={l} nivel={nivel} ordenarPorSinais={ordenarPorSinais} />}
      {aba === "estado" && <Estado l={l} />}
      {aba === "dinheiro" && <Dinheiro l={l} nivel={nivel} />}
      {aba === "tempos" && <Tempos l={l} />}
      {aba === "relatorio" && (
        <>
          <Relatorio l={l} />
          <Resumo l={l} />
          <Dinheiro l={l} nivel={nivel} />
        </>
      )}
    </div>
  );
}
