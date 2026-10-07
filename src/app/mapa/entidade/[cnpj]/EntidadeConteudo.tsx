/**
 * A página da entidade em abas (E1, desenho aprovado em 07/10/2026): um CNPJ proponente com a sua fila, a sua
 * carteira e o seu dinheiro. Os blocos são os do relatório do município (RelatorioConteudo), alimentados pelo
 * relatório lido por CNPJ; aqui só se escolhe o que entra em cada aba e o que o nível de acesso alcança.
 * Fiscal e indicadores são do território: ficam na página do município, com link.
 */
import Link from "next/link";
import { formatarData } from "@/lib/oportunidades/central";
import { cnpjLegivel } from "@/lib/oportunidades/fornecedores";
import {
  ABAS_ENTIDADE,
  ROTULO_ESPECIE,
  carteiraPorSituacao,
  dinheiroPorOrgao,
  ehMunicipal,
  urlEntidade,
  type AbaEntidade,
} from "@/lib/oportunidades/pagina-entidade";
import { PODE, destinoConvenio, urlMunicipio, type NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import { ROTULO_DESFECHO } from "@/lib/oportunidades/painel";
import { tituloOrgao } from "@/lib/oportunidades/padroes";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { InstrumentoRelatorio, PropostaRelatorio, Relatorio } from "@/lib/oportunidades/relatorio-municipio";
import type { IdentidadeEntidade } from "@/lib/oportunidades/relatorio-municipio.server";
import { Carregando } from "../../_componentes/Carregando";
import { BotaoImprimir } from "../../fiscal/[ibge]/simular/BotaoImprimir";
import {
  BlocoControle,
  BlocoConvenios,
  BlocoEmendas,
  BlocoFila,
  BlocoFontes,
  BlocoFornecedores,
  BlocoPassos,
  BlocoPix,
  BlocoPropostas,
  BlocoTcePb,
  Cartoes,
  EmOrdem,
  ListaAchados,
  Secao,
} from "../../municipio/[ibge]/relatorio/RelatorioConteudo";

type Destino = (nr: string) => string;

const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");
const n = (x: number) => x.toLocaleString("pt-BR");
const ehPb = (ibge: string | null) => !!ibge && /^25\d{5}$/.test(ibge);

function Cabeca({ e, r, nivel }: { e: IdentidadeEntidade; r: Relatorio; nivel: NivelAcesso }) {
  const municipal = ehMunicipal(e.especie);
  return (
    <div className="pa-pilha mp-radar-cabeca">
      <nav aria-label="Onde você está" className="mp-mun-trilha">
        <span>Brasil</span>
        <span>{e.uf === "PB" ? "Paraíba" : (e.uf ?? "UF não informada")}</span>
        {e.municipio && (ehPb(e.cod_ibge) ? <Link href={urlMunicipio(e.cod_ibge as string)} prefetch={false}>{e.municipio}</Link> : <span>{e.municipio}</span>)}
        <span aria-current="page">{e.nome}</span>
      </nav>
      <h1 className="pa-titulo">{e.nome}</h1>
      <p className="pa-sub mp-mun-chips">
        <span>CNPJ {cnpjLegivel(e.cnpj)}</span>
        <span>{ROTULO_ESPECIE[e.especie]}</span>
        {e.municipio && (
          <span>
            sede em {e.municipio}/{e.uf ?? "—"}
          </span>
        )}
        {e.desde && <span>na base desde {e.desde}</span>}
        <span>posição de {data(r.hoje)}</span>
      </p>
      <p className="mp-nao-imprimir mp-laudo-acoes">
        <BotaoImprimir />
        {ehPb(e.cod_ibge) && (
          <Link href={urlMunicipio(e.cod_ibge as string)} className="pa-btn pa-btn-pequeno" prefetch={false}>
            Página do município
          </Link>
        )}
        {PODE.interno(nivel) && ehPb(e.cod_ibge) && municipal && (
          <Link href={`/mapa/painel/municipio/${e.cod_ibge}?quem=todos`} className="pa-btn pa-btn-pequeno" prefetch={false}>
            Ficha no painel
          </Link>
        )}
      </p>
    </div>
  );
}

function Abas({ cnpj, aba, nivel }: { cnpj: string; aba: AbaEntidade; nivel: NivelAcesso }) {
  return (
    <nav aria-label="Partes da entidade" className="mp-mun-abas mp-nao-imprimir">
      {ABAS_ENTIDADE.filter((a) => nivel >= a.minimo).map((a) => (
        <Link key={a.id} href={urlEntidade(cnpj, a.id)} aria-current={a.id === aba ? "page" : undefined} scroll={false} prefetch={false}>
          {a.nome}
          <Carregando />
        </Link>
      ))}
    </nav>
  );
}

/** O que a fila desta entidade não traz, e onde está: fiscal do município, certidões da OSC, CAUC dos estados. */
function AvisoFiscal({ e }: { e: IdentidadeEntidade }) {
  if (ehMunicipal(e.especie)) {
    return (
      <p className="pa-nota">
        O CAUC e os limites da LRF são do município, não do CNPJ: os pontos fiscais desta fila são os de {e.municipio ?? "o município"}.
        {ehPb(e.cod_ibge) && (
          <>
            {" "}
            O detalhe está em{" "}
            <Link href={urlMunicipio(e.cod_ibge as string, "contas")} prefetch={false}>
              Contas públicas do município
              <Carregando />
            </Link>
            .
          </>
        )}
      </p>
    );
  }
  if (e.especie === "osc") {
    return (
      <p className="pa-nota">
        Organização da sociedade civil: o CAUC e a LRF valem para entes federativos, não para ela. A regularidade da OSC (certidões federais, CEPIM)
        não está na base.
      </p>
    );
  }
  if (e.tipoAgente === "estado" || e.especie === "empresa") {
    return (
      <p className="pa-nota">
        A situação fiscal dos estados não entra aqui: o relatório dos estados no Tesouro Transparente não é atualizado desde 03/11/2025, e o
        extrato do CAUC tem verificação manual.
      </p>
    );
  }
  return null;
}

function Sobre({ e, instrumentos, propostas }: { e: IdentidadeEntidade; instrumentos: InstrumentoRelatorio[]; propostas: PropostaRelatorio[] }) {
  return (
    <Secao id="ent-sobre" titulo="Quem é">
      <dl className="mp-ent-sobre">
        <dt>CNPJ</dt>
        <dd className="pa-mono">{cnpjLegivel(e.cnpj)}</dd>
        <dt>Espécie</dt>
        <dd>{ROTULO_ESPECIE[e.especie]}</dd>
        <dt>Sede</dt>
        <dd>{e.municipio ? `${e.municipio}/${e.uf ?? "—"}` : "não informada"}</dd>
        <dt>Na base</dt>
        <dd>
          {n(instrumentos.length)} {instrumentos.length === 1 ? "instrumento" : "instrumentos"} e {n(propostas.length)}{" "}
          {propostas.length === 1 ? "proposta" : "propostas"}
          {e.desde ? `, desde ${e.desde}` : ""}
        </dd>
      </dl>
      <p className="pa-nota">
        Instrumentos do Transferegov: todos os de proponente da Paraíba desde 2008; fora da Paraíba, só os em execução ou em prestação de contas.
        Propostas: só as de proponente da Paraíba desde 2019.
      </p>
    </Secao>
  );
}

function Carteira({ instrumentos, destino }: { instrumentos: InstrumentoRelatorio[]; destino: Destino }) {
  const grupos = carteiraPorSituacao(instrumentos);
  if (!grupos.length) return null;
  return (
    <Secao id="ent-carteira" titulo={`A carteira (${n(instrumentos.length)})`} nota="Todos os instrumentos do CNPJ, por situação, do mais recente para o mais antigo.">
      {grupos.map((g) => (
        <details key={g.id} className="mp-ent-grupo" open={g.id === "execucao" || g.id === "contas"}>
          <summary>
            <strong>{g.rotulo}</strong> · {n(g.itens.length)} · {moedaCurta(g.valor)} de valor global
          </summary>
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Número</th>
                  <th scope="col">Órgão</th>
                  <th scope="col">Objeto</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Desembolsado</th>
                  <th scope="col">Assinatura</th>
                  <th scope="col">Vigência até</th>
                </tr>
              </thead>
              <tbody>
                {g.itens.map((i) => (
                  <tr key={i.nr_convenio}>
                    <td>
                      <Link href={destino(i.nr_convenio)} prefetch={false}>
                        {i.nr_convenio}
                        <Carregando />
                      </Link>
                    </td>
                    <td>{i.orgao_sup ? tituloOrgao(i.orgao_sup) : "—"}</td>
                    <td>{i.objeto ?? "—"}</td>
                    <td className="mp-rel-num">{moedaCurta(i.vl_global ?? 0)}</td>
                    <td className="mp-rel-num">{i.vl_desembolsado ? moedaCurta(i.vl_desembolsado) : "—"}</td>
                    <td>{data(i.dt_assinatura)}</td>
                    <td>{data(i.dt_fim_vigencia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </Secao>
  );
}

function ListaPropostas({ propostas }: { propostas: PropostaRelatorio[] }) {
  if (!propostas.length) return null;
  const xs = [...propostas].sort((a, b) => (b.ano_envio ?? 0) - (a.ano_envio ?? 0));
  return (
    <Secao id="ent-propostas-lista" titulo={`As propostas (${n(propostas.length)})`} nota="Enviadas desde 2019 (só proponentes da Paraíba), da mais recente para a mais antiga.">
      <details className="mp-ent-grupo">
        <summary>Ver a lista</summary>
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Ano</th>
                <th scope="col">Programa</th>
                <th scope="col">Órgão</th>
                <th scope="col">Repasse</th>
                <th scope="col">Desfecho</th>
              </tr>
            </thead>
            <tbody>
              {xs.map((p) => (
                <tr key={p.id_proposta}>
                  <td>{p.ano_envio ?? "—"}</td>
                  <td>{p.programa ?? "—"}</td>
                  <td>{p.orgao_sup ? tituloOrgao(p.orgao_sup) : "—"}</td>
                  <td className="mp-rel-num">{moedaCurta(p.valor_repasse ?? 0)}</td>
                  <td>{p.desfecho ? (ROTULO_DESFECHO[p.desfecho as keyof typeof ROTULO_DESFECHO] ?? p.desfecho) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Secao>
  );
}

function PorOrgao({ instrumentos }: { instrumentos: InstrumentoRelatorio[] }) {
  const xs = dinheiroPorOrgao(instrumentos);
  if (!xs.length) return null;
  return (
    <Secao id="ent-orgaos" titulo="De onde veio" nota="Por órgão concedente: valor global dos instrumentos e o que já foi desembolsado.">
      <div className="mp-tabela-rolagem">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Órgão</th>
              <th scope="col">Instrumentos</th>
              <th scope="col">Valor</th>
              <th scope="col">Desembolsado</th>
            </tr>
          </thead>
          <tbody>
            {xs.map((o) => (
              <tr key={o.orgao}>
                <td>{tituloOrgao(o.orgao)}</td>
                <td className="mp-rel-num">{n(o.n)}</td>
                <td className="mp-rel-num">{moedaCurta(o.valor)}</td>
                <td className="mp-rel-num">{o.desembolsado ? moedaCurta(o.desembolsado) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Secao>
  );
}

function Mais({ children }: { children: React.ReactNode }) {
  return <p className="mp-nao-imprimir mp-laudo-acoes">{children}</p>;
}

export function EntidadeConteudo({
  e: entidade,
  r,
  instrumentos,
  propostas,
  aba,
  nivel,
}: {
  e: IdentidadeEntidade;
  r: Relatorio;
  instrumentos: InstrumentoRelatorio[];
  propostas: PropostaRelatorio[];
  aba: AbaEntidade;
  nivel: NivelAcesso;
}) {
  // o SICONV grava o município em caixa alta ("JOÃO PESSOA"); na tela, "João Pessoa"
  const e = { ...entidade, municipio: entidade.municipio ? tituloOrgao(entidade.municipio) : null };
  const destino = destinoConvenio(nivel);
  const nomeAba = ABAS_ENTIDADE.find((a) => a.id === aba)?.nome ?? "";
  const csv = `/mapa/entidade/${e.cnpj}/csv`;
  return (
    <div className="pa-pagina mp-radar mp-laudo mp-rel mp-mun">
      <Cabeca e={e} r={r} nivel={nivel} />
      <Abas cnpj={e.cnpj} aba={aba} nivel={nivel} />
      <p className="mp-so-imprimir pa-kicker">{nomeAba}</p>

      {aba === "trava" && (
        <>
          <AvisoFiscal e={e} />
          <BlocoFila r={r} destino={destino} />
        </>
      )}

      {aba === "resumo" && (
        <>
          <Secao id="ent-resumo" titulo="Em números">
            <Cartoes r={r} />
            <EmOrdem r={r} />
          </Secao>
          <Sobre e={e} instrumentos={instrumentos} propostas={propostas} />
        </>
      )}

      {aba === "instrumentos" && (
        <>
          {nivel >= 1 && <BlocoConvenios r={r} destino={destino} />}
          <Carteira instrumentos={instrumentos} destino={destino} />
          {nivel >= 1 && <BlocoPropostas r={r} destino={destino} />}
          <ListaPropostas propostas={propostas} />
          {!instrumentos.length && !propostas.length && <p>Nenhum instrumento nem proposta deste CNPJ na base.</p>}
        </>
      )}

      {aba === "dinheiro" && (
        <>
          <PorOrgao instrumentos={instrumentos} />
          <BlocoEmendas r={r} />
          {nivel >= 1 && (
            <>
              <BlocoPix r={r} destino={destino} />
              <BlocoTcePb r={r} />
              <BlocoFornecedores r={r} destino={destino} />
            </>
          )}
        </>
      )}

      {aba === "controle" && <BlocoControle r={r} destino={destino} />}

      {aba === "relatorio" && (
        <>
          <Secao id="ent-relatorio" titulo="Relatório e dados" nota="A página inteira numa peça só, com a fonte de cada número, para imprimir ou anexar.">
            <Mais>
              <BotaoImprimir />
              <a href={csv} className="pa-btn pa-btn-pequeno">
                Instrumentos em CSV
              </a>
              <a href={`${csv}?tipo=achados`} className="pa-btn pa-btn-pequeno">
                Achados em CSV
              </a>
            </Mais>
          </Secao>
          <Secao id="ent-pagina" titulo="Em uma página">
            <Cartoes r={r} />
            <ListaAchados achados={r.destaques} destino={destino} fila="com_classe" hoje={r.hoje} />
            <EmOrdem r={r} />
          </Secao>
          <BlocoPassos r={r} />
          <BlocoConvenios r={r} destino={destino} />
          <BlocoControle r={r} destino={destino} />
          <BlocoPropostas r={r} destino={destino} />
          <BlocoEmendas r={r} />
          <BlocoPix r={r} destino={destino} />
          <BlocoTcePb r={r} />
          <BlocoFornecedores r={r} destino={destino} />
          <BlocoFontes r={r} />
        </>
      )}
    </div>
  );
}
