/**
 * A página da entidade em abas (E1, desenho aprovado em 07/10/2026): um CNPJ proponente com a sua fila, a sua
 * carteira e o seu dinheiro. Os blocos são os do relatório do município (RelatorioConteudo), alimentados pelo
 * relatório lido por CNPJ; aqui só se escolhe o que entra em cada aba e o que o nível de acesso alcança.
 * Fiscal e indicadores são do território: ficam na página do município, com link.
 *
 * Desde a C1c (08/10/2026) a aba "Relatório e dados" é curta, como a do município: o relatório inteiro mora em
 * `/mapa/entidade/[cnpj]/relatorio`, a peça única para imprimir, que usa os blocos exportados daqui. Os links internos
 * passaram a `LinkMapa` (o mesmo `Link` sem pré-carga e com o `Carregando`).
 */
import type { ReactNode } from "react";
import { formatarData } from "@/lib/oportunidades/central";
import { dataBrasilia } from "@/lib/oportunidades/datas";
import { cnpjLegivel } from "@/lib/oportunidades/fornecedores";
import {
  ABAS_ENTIDADE,
  ROTULO_ESPECIE,
  carteiraPorSituacao,
  dinheiroPorOrgao,
  ehMunicipal,
  fontesDaEntidade,
  saidasEntidadeVazia,
  urlEntidade,
  urlRelatorioEntidade,
  type AbaEntidade,
} from "@/lib/oportunidades/pagina-entidade";
import { PODE, destinoConvenio, urlMunicipio, type NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import {
  ROTULO_CEBAS,
  idade,
  rotuloArea,
  rotuloNatureza,
  situacaoNaReceita,
  subareasUteis,
  versaoLegivel,
} from "@/lib/oportunidades/osc";
import type { LeituraCadastroOsc } from "@/lib/oportunidades/osc.server";
import { ROTULO_DESFECHO } from "@/lib/oportunidades/painel";
import { tituloOrgao } from "@/lib/oportunidades/padroes";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { InstrumentoRelatorio, PropostaRelatorio, Relatorio } from "@/lib/oportunidades/relatorio-municipio";
import type { IdentidadeEntidade } from "@/lib/oportunidades/relatorio-municipio.server";
import { lugarDaEntidade, trilha } from "@/lib/oportunidades/trilha";
import { RECORTE_DA_BASE } from "@/lib/oportunidades/vazios";
import { EstrelaSeguir } from "../../_componentes/EstrelaSeguir";
import { Termo } from "../../_componentes/Termo";
import { Trilha } from "../../_componentes/Trilha";
import { BotaoImprimir } from "../../fiscal/[ibge]/simular/BotaoImprimir";
import {
  BlocoControle,
  BlocoConvenios,
  BlocoEmendas,
  BlocoFila,
  BlocoFontes,
  BlocoFornecedores,
  BlocoPix,
  BlocoPropostas,
  BlocoTcePb,
  Cartoes,
  EmOrdem,
  Secao,
} from "../../municipio/[ibge]/relatorio/RelatorioConteudo";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";

type Destino = (nr: string) => string;

const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");
const n = (x: number) => x.toLocaleString("pt-BR");
export const ehPb = (ibge: string | null) => !!ibge && /^25\d{5}$/.test(ibge);

/** O município como a tela mostra: o SICONV grava em caixa alta ("JOÃO PESSOA"); na tela, "João Pessoa". */
export function entidadeLegivel(e: IdentidadeEntidade): IdentidadeEntidade {
  return { ...e, municipio: e.municipio ? tituloOrgao(e.municipio) : null };
}

/**
 * As fontes que a entidade lê, com a do Mapa das OSC quando ela está lá (C1c): para a aba e para o relatório. A OSC só
 * do cadastro (`soCadastro`) fica com o Transferegov e o Mapa das OSC.
 */
export function comFontesDaEntidade(r: Relatorio, e: IdentidadeEntidade, osc: LeituraCadastroOsc, soCadastro = false): Relatorio {
  const mapaOsc = osc.estado === "ok" ? { versao: osc.fonte.versao ? versaoLegivel(osc.fonte.versao) : null } : null;
  return { ...r, fontes: fontesDaEntidade(r.fontes, { especie: e.especie, mapaOsc, soCadastro }) };
}

function Cabeca({ e, r, nivel, seguindo, soCadastro }: { e: IdentidadeEntidade; r: Relatorio; nivel: NivelAcesso; seguindo: boolean; soCadastro: boolean }) {
  const municipal = ehMunicipal(e.especie);
  return (
    <div className="pa-pilha mp-radar-cabeca">
      {/*
        B11 e C1c: a trilha da entidade passa pela região imediata, como a do município. A leitura não traz a região:
        `lugarDaEntidade` a tira da lista fixa dos 223 (`municipios-pb.ts`), pelo IBGE da sede, só na PB (nunca se
        inventa elo). O município leva à página dele na PB e aos investimentos fora da PB; sem UF no dado, o elo some.
      */}
      <Trilha elos={trilha(lugarDaEntidade(e))} />
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
        <span>dados lidos em {data(r.hoje)}</span>
      </p>
      <p className="mp-nao-imprimir mp-laudo-acoes">
        <EstrelaSeguir tipo="entidade" chave={e.cnpj} nome={`a entidade ${e.nome}`} seguindo={seguindo} />
        {/* C1c: a OSC só do cadastro não tem abas, nem a do relatório; a porta da peça para imprimir fica aqui. */}
        {soCadastro ? (
          <LinkMapa href={urlRelatorioEntidade(e.cnpj)} className="pa-btn">
            Abrir o relatório para imprimir
          </LinkMapa>
        ) : (
          <BotaoImprimir />
        )}
        {ehPb(e.cod_ibge) && (
          <LinkMapa href={urlMunicipio(e.cod_ibge as string)} className="pa-btn pa-btn-pequeno">
            Abrir a página do município
          </LinkMapa>
        )}
        {PODE.interno(nivel) && ehPb(e.cod_ibge) && municipal && (
          <LinkMapa href={`/mapa/painel/municipio/${e.cod_ibge}?quem=todos`} className="pa-btn pa-btn-pequeno">
            Abrir a ficha no painel
          </LinkMapa>
        )}
      </p>
    </div>
  );
}

function Abas({ cnpj, aba, nivel, soCadastro }: { cnpj: string; aba: AbaEntidade; nivel: NivelAcesso; soCadastro: boolean }) {
  // A OSC que só está no cadastro do Mapa (E3) não tem fila, carteira nem dinheiro: só o resumo.
  if (soCadastro) return null;
  return (
    <nav aria-label="Partes da entidade" className="mp-mun-abas mp-nao-imprimir">
      {ABAS_ENTIDADE.filter((a) => nivel >= a.minimo).map((a) => (
        <LinkMapa key={a.id} href={urlEntidade(cnpj, a.id)} aria-current={a.id === aba ? "page" : undefined} scroll={false}>
          {a.nome}
        </LinkMapa>
      ))}
    </nav>
  );
}

/** Se o `AvisoFiscal` tem o que dizer para esta entidade (o relatório para imprimir só abre a seção quando tem). */
export function temAvisoFiscal(e: IdentidadeEntidade): boolean {
  return ehMunicipal(e.especie) || e.especie === "osc" || e.tipoAgente === "estado" || e.especie === "empresa";
}

/** O que a fila desta entidade não traz, e onde está: fiscal do município, certidões da OSC, CAUC dos estados. */
export function AvisoFiscal({ e }: { e: IdentidadeEntidade }) {
  if (ehMunicipal(e.especie)) {
    return (
      <p className="pa-nota">
        O <Termo slug="cauc">CAUC</Termo> e os limites da <Termo slug="lrf">LRF</Termo> são do município, não do CNPJ: os pontos fiscais desta lista
        são os {e.municipio ? `de ${e.municipio}` : "do município"}.
        {ehPb(e.cod_ibge) && (
          <>
            {" "}
            O detalhe está em{" "}
            <LinkMapa href={urlMunicipio(e.cod_ibge as string, "contas")}>Contas públicas do município</LinkMapa>
            .
          </>
        )}
      </p>
    );
  }
  if (e.especie === "osc") {
    return (
      <p className="pa-nota">
        Organização da sociedade civil: o <Termo slug="cauc">CAUC</Termo> e a <Termo slug="lrf">LRF</Termo> valem para estados e municípios, não para ela. A
        regularidade da OSC (certidões federais e <Termo slug="cepim">CEPIM</Termo>) não está na base do Mapa.
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

export function Sobre({ e, instrumentos, propostas }: { e: IdentidadeEntidade; instrumentos: InstrumentoRelatorio[]; propostas: PropostaRelatorio[] }) {
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
          {!instrumentos.length && !propostas.length ? (
            "nenhum instrumento nem proposta"
          ) : (
            <>
              {n(instrumentos.length)} {instrumentos.length === 1 ? "instrumento" : "instrumentos"} e {n(propostas.length)}{" "}
              {propostas.length === 1 ? "proposta" : "propostas"}
              {e.desde ? `, desde ${e.desde}` : ""}
            </>
          )}
        </dd>
      </dl>
      {/* Sem nada na base, o `EntidadeVazia` logo acima já diz o recorte (C1c). O texto é o de `vazios.ts` (A4x). */}
      {(instrumentos.length > 0 || propostas.length > 0) && <p className="pa-nota">{RECORTE_DA_BASE}</p>}
    </Secao>
  );
}

const dataCurta = (iso: string | null) => (iso ? formatarData(iso.slice(0, 10)) : null);
const cnae = (c: string | null) => (c && /^\d{5}$/.test(c) ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

/**
 * O cadastro no Mapa das OSC (E3, oport_32): natureza, situação na Receita, fundação, áreas do Ipea e CEBAS. Nada
 * de endereço, dirigentes ou contato (o job não grava). Para a OSC que não está no Mapa, o porquê provável.
 */
export function CadastroMapa({ osc, hoje, especie }: { osc: LeituraCadastroOsc; hoje: string; especie: string }) {
  if (osc.estado === "indisponivel") return null;
  if (osc.estado === "nao_encontrado") {
    if (especie !== "osc") return null;
    return (
      <Secao id="ent-cadastro" titulo="Cadastro no Mapa das OSC">
        <p className="pa-nota">
          Este CNPJ não está no Mapa das OSC (Ipea, versão de {versaoLegivel(osc.fonte.versao)}). O Mapa inclui só associações, fundações
          privadas, organizações religiosas e organizações sociais: cooperativas, entidades sindicais e o Sistema S ficam fora, mesmo quando
          o Transferegov os registra como organização da sociedade civil.
        </p>
      </Secao>
    );
  }
  const c = osc.cadastro;
  const situacao = situacaoNaReceita(c);
  const anos = idade(c.dt_fundacao, hoje);
  const subareas = subareasUteis(c);
  return (
    <Secao
      id="ent-cadastro"
      titulo="Cadastro no Mapa das OSC"
      nota={`Mapa das Organizações da Sociedade Civil (Ipea), versão de ${versaoLegivel(osc.fonte.versao)}, com o cadastro da Receita Federal.`}
    >
      <dl className="mp-ent-sobre">
        {c.razao_social && (
          <>
            <dt>Razão social</dt>
            <dd>{c.razao_social}</dd>
          </>
        )}
        {c.nome_fantasia && (
          <>
            <dt>Nome fantasia</dt>
            <dd>{c.nome_fantasia}</dd>
          </>
        )}
        <dt>Natureza jurídica</dt>
        <dd>{rotuloNatureza(c.natureza_juridica)}</dd>
        <dt>Situação</dt>
        <dd className={situacao.atencao ? "mp-ent-atencao" : undefined}>{situacao.texto}</dd>
        <dt>Matriz ou filial</dt>
        <dd>
          {c.matriz === true ? "Matriz" : c.matriz === false ? "Filial" : "Não informado"}
          {c.matriz === false && osc.matriz && (
            <>
              {" "}
              de{" "}
              <LinkMapa href={urlEntidade(osc.matriz.cnpj)}>{osc.matriz.nome ?? cnpjLegivel(osc.matriz.cnpj)}</LinkMapa>
            </>
          )}
        </dd>
        <dt>Fundação</dt>
        <dd>{c.dt_fundacao ? `${dataCurta(c.dt_fundacao)}${anos !== null ? ` (${anos} ${anos === 1 ? "ano" : "anos"})` : ""}` : "não informada"}</dd>
        {c.dt_fechamento && (
          <>
            <dt>Fechamento</dt>
            <dd>{dataCurta(c.dt_fechamento)}</dd>
          </>
        )}
        <dt>Área de atuação</dt>
        <dd>
          {c.areas.length ? c.areas.map(rotuloArea).join("; ") : "não informada"}
          {subareas.length > 0 && <span className="pa-nota"> ({subareas.join("; ")})</span>}
        </dd>
        {c.cnae_principal && (
          <>
            <dt>Atividade (CNAE)</dt>
            <dd className="pa-mono">{cnae(c.cnae_principal)}</dd>
          </>
        )}
        <dt>
          <Termo slug="cebas">CEBAS</Termo>
        </dt>
        <dd>
          {!osc.fonte.cebasLido ? (
            "as planilhas de certificação não foram lidas nesta carga"
          ) : c.cebas.length ? (
            <ul className="mp-ent-cebas">
              {c.cebas.map((x, i) => (
                <li key={`${x.tipo}-${i}`}>
                  {ROTULO_CEBAS[x.tipo] ?? x.tipo}: {x.situacao ?? "situação não informada"}
                  {x.fim ? `, validade até ${dataCurta(x.fim)}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            "nenhuma certificação nas planilhas do Mapa"
          )}
        </dd>
      </dl>
      {/* A4x: o Last-Modified das planilhas é carimbo com hora; a data é a do dia em Brasília, e não a de UTC. */}
      <p className="pa-nota">
        A área de atuação é a classificação do Ipea, pelo nome e pela atividade declarada. As planilhas de CEBAS do Mapa são de{" "}
        {dataBrasilia(osc.fonte.cebasModificado, "data não informada")}: a certificação é
        renovada por processo, e a situação atual se confere no ministério certificador. Endereço, dirigentes e contatos não entram nesta página.
      </p>
    </Secao>
  );
}

export function Carteira({ instrumentos, destino }: { instrumentos: InstrumentoRelatorio[]; destino: Destino }) {
  const grupos = carteiraPorSituacao(instrumentos);
  if (!grupos.length) return null;
  return (
    <Secao id="ent-carteira" titulo={`Os instrumentos (${n(instrumentos.length)})`} nota="Todos os instrumentos do CNPJ, por situação, do mais recente para o mais antigo.">
      {grupos.map((g) => (
        <details key={g.id} className="mp-ent-grupo" open={g.id === "execucao" || g.id === "contas"}>
          <summary>
            <strong>{g.rotulo}</strong> · {n(g.itens.length)} · {moedaCurta(g.valor)} de valor global
          </summary>
          <TabelaRolagem rotulo={`${g.rotulo} · ${n(g.itens.length)} · ${moedaCurta(g.valor)} de valor global`}>
            <table className="mp-tabela mp-tabela-empilha">
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
                      <LinkMapa href={destino(i.nr_convenio)}>{i.nr_convenio}</LinkMapa>
                    </td>
                    <td data-rotulo="Órgão">{i.orgao_sup ? tituloOrgao(i.orgao_sup) : "—"}</td>
                    <td data-rotulo="Objeto">{i.objeto ?? "—"}</td>
                    <td data-rotulo="Valor" className="mp-rel-num">{moedaCurta(i.vl_global ?? 0)}</td>
                    <td data-rotulo="Desembolsado" className="mp-rel-num">{i.vl_desembolsado ? moedaCurta(i.vl_desembolsado) : "—"}</td>
                    <td data-rotulo="Assinatura">{data(i.dt_assinatura)}</td>
                    <td data-rotulo="Vigência até">{data(i.dt_fim_vigencia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        </details>
      ))}
    </Secao>
  );
}

/**
 * A lista das propostas. Na página, recolhida; no relatório para imprimir (`aberta`, C1c), a tabela vem direto: no
 * papel o resumo «Ver a lista das propostas» sairia como título, e ele é um convite ao clique, não um nome.
 */
export function ListaPropostas({ propostas, aberta = false }: { propostas: PropostaRelatorio[]; aberta?: boolean }) {
  if (!propostas.length) return null;
  const xs = [...propostas].sort((a, b) => (b.ano_envio ?? 0) - (a.ano_envio ?? 0));
  const tabela = (
    <TabelaRolagem rotulo={`As propostas (${n(propostas.length)})`}>
      <table className="mp-tabela mp-tabela-empilha">
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
              <td data-rotulo="Programa">{p.programa ?? "—"}</td>
              <td data-rotulo="Órgão">{p.orgao_sup ? tituloOrgao(p.orgao_sup) : "—"}</td>
              <td data-rotulo="Repasse" className="mp-rel-num">{moedaCurta(p.valor_repasse ?? 0)}</td>
              <td data-rotulo="Desfecho">{p.desfecho ? (ROTULO_DESFECHO[p.desfecho as keyof typeof ROTULO_DESFECHO] ?? p.desfecho) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TabelaRolagem>
  );
  return (
    <Secao id="ent-propostas-lista" titulo={`As propostas (${n(propostas.length)})`} nota="Enviadas desde 2019 (fora da Paraíba, só as recentes e as que ainda se movem), da mais recente para a mais antiga.">
      {aberta ? (
        tabela
      ) : (
        <details className="mp-ent-grupo">
          <summary>Ver a lista das propostas</summary>
          {tabela}
        </details>
      )}
    </Secao>
  );
}

/**
 * O CNPJ sem instrumento nem proposta na base (C1c; B12, seção 5). Dizia só "Nenhum instrumento nem proposta deste
 * CNPJ na base."; agora diz o recorte da base e o que tentar: o nome na busca (o convênio pode estar noutro CNPJ da
 * mesma organização) e o Transferegov, que é a fonte. `cadastro`: a OSC só do Mapa das OSC (E3), cuja página é o
 * cadastro. As saídas não vão para o papel.
 */
export function EntidadeVazia({ e, cadastro = false }: { e: Pick<IdentidadeEntidade, "cnpj" | "nome">; cadastro?: boolean }) {
  const saidas = saidasEntidadeVazia(e);
  return (
    <div className="pa-cartao pa-cartao-plano">
      <p>
        <strong>Nenhum instrumento nem proposta deste CNPJ na base do Mapa.</strong> {RECORTE_DA_BASE}
      </p>
      {cadastro && (
        <p>
          A página mostra o cadastro do Mapa das OSC; quem segue a entidade recebe aviso quando aparecer a primeira proposta ou o primeiro
          instrumento.
        </p>
      )}
      <div className="mp-nao-imprimir">
        <p>
          O que tentar (o convênio pode estar noutro CNPJ da mesma organização, como a matriz, uma filial ou um CNPJ antigo; fora do recorte, a
          fonte é o próprio Transferegov):
        </p>
        <ul>
          {saidas.map((s) => (
            <li key={s.href}>
              {s.externo ? (
                <a href={s.href} rel="noreferrer" target="_blank">
                  {s.rotulo}
                  <span className="pa-sr"> (abre em nova aba)</span>
                </a>
              ) : (
                <LinkMapa href={s.href}>{s.rotulo}</LinkMapa>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PorOrgao({ instrumentos }: { instrumentos: InstrumentoRelatorio[] }) {
  const xs = dinheiroPorOrgao(instrumentos);
  if (!xs.length) return null;
  return (
    <Secao id="ent-orgaos" titulo="De onde vem o dinheiro" nota="Por órgão concedente: valor global dos instrumentos e o que já foi desembolsado.">
      <TabelaRolagem rotulo="De onde vem o dinheiro">
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
      </TabelaRolagem>
    </Secao>
  );
}

function Mais({ children }: { children: ReactNode }) {
  return <p className="mp-nao-imprimir mp-laudo-acoes">{children}</p>;
}

export function EntidadeConteudo({
  e: entidade,
  r,
  instrumentos,
  propostas,
  osc = { estado: "indisponivel" },
  aba,
  nivel,
  seguindo = false,
}: {
  e: IdentidadeEntidade;
  r: Relatorio;
  instrumentos: InstrumentoRelatorio[];
  propostas: PropostaRelatorio[];
  /** O cadastro no Mapa das OSC (E3). */
  osc?: LeituraCadastroOsc;
  aba: AbaEntidade;
  nivel: NivelAcesso;
  seguindo?: boolean;
}) {
  const soCadastro = !instrumentos.length && !propostas.length;
  const e = entidadeLegivel(entidade);
  const destino = destinoConvenio(nivel);
  const nomeAba = ABAS_ENTIDADE.find((a) => a.id === aba)?.nome ?? "";
  const csv = `/mapa/entidade/${e.cnpj}/csv`;
  return (
    <div className="pa-pagina mp-radar mp-laudo mp-rel mp-mun">
      <Cabeca e={e} r={r} nivel={nivel} seguindo={seguindo} soCadastro={soCadastro} />
      <Abas cnpj={e.cnpj} aba={aba} nivel={nivel} soCadastro={soCadastro} />
      <p className="mp-so-imprimir pa-kicker">{nomeAba}</p>

      {aba === "trava" && (
        <>
          <AvisoFiscal e={e} />
          <BlocoFila r={r} destino={destino} />
        </>
      )}

      {aba === "resumo" && (
        <>
          {soCadastro ? (
            <EntidadeVazia e={e} cadastro />
          ) : (
            <Secao id="ent-resumo" titulo="Em números">
              <Cartoes r={r} />
              <EmOrdem r={r} />
            </Secao>
          )}
          <Sobre e={e} instrumentos={instrumentos} propostas={propostas} />
          <CadastroMapa osc={osc} hoje={r.hoje} especie={e.especie} />
        </>
      )}

      {aba === "instrumentos" && (
        <>
          {nivel >= 1 && <BlocoConvenios r={r} destino={destino} />}
          <Carteira instrumentos={instrumentos} destino={destino} />
          {nivel >= 1 && <BlocoPropostas r={r} destino={destino} />}
          <ListaPropostas propostas={propostas} />
          {soCadastro && <EntidadeVazia e={e} />}
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

      {/*
        C1c (08/10/2026; B11, 9.5): a aba fica curta, como a do município. Antes ela repetia a página inteira dentro da
        aba; agora o relatório completo mora em `/relatorio` (a peça única para imprimir, com trilha, fontes e
        assinatura), e aqui ficam a porta, os CSVs e as fontes que a entidade lê.
      */}
      {aba === "relatorio" && (
        <>
          <Secao id="ent-relatorio" titulo="O relatório completo" nota="Todas as abas numa peça só, com a fonte de cada número, para imprimir ou anexar.">
            <Mais>
              <LinkMapa href={urlRelatorioEntidade(e.cnpj)} className="pa-btn">
                Abrir o relatório para imprimir
              </LinkMapa>
              <a href={csv} className="pa-btn pa-btn-pequeno">
                Baixar os instrumentos (CSV)
              </a>
              <a href={`${csv}?tipo=achados`} className="pa-btn pa-btn-pequeno">
                Baixar os pontos do relatório (CSV)
              </a>
            </Mais>
          </Secao>
          <BlocoFontes r={comFontesDaEntidade(r, e, osc)} />
        </>
      )}
    </div>
  );
}
