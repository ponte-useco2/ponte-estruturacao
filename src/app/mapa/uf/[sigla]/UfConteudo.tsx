/**
 * A página da UF em abas (U1, desenho aprovado em 08/10/2026): o território acima do município. A Paraíba tem o dado
 * completo; as outras UFs, só o que a base guarda para o país (instrumentos vivos, propostas desde 2019, tempos, Pix
 * e fundo a fundo), e a página diz isso. A lista dos municípios é neutra para quem não é administrador.
 *
 * Desde a C1a (08/10/2026) as seções são exportadas: o relatório para imprimir (`./relatorio`) junta todas numa peça
 * só, como o do município, e a aba "Relatório e dados" ficou curta (o link para ele, o CSV e as fontes).
 *
 * C4a (09/10/2026; achados B1 e C5 da revisão R3): no nível 0 (a versão pública, atrás da chave `MAPA_PUBLICO`) somem o
 * botão de imprimir e o CSV dos municípios, que a D1 põe atrás do cadastro. Do nível 1 em diante, nada muda.
 */
import Link from "next/link";
import { dataBrasilia } from "@/lib/oportunidades/datas";
import { ROTULO_DECISAO } from "@/lib/oportunidades/fiscal";
import { cnpjLegivel } from "@/lib/oportunidades/fornecedores";
import { formatarValor } from "@/lib/oportunidades/indicadores-municipio";
import malhaPb from "@/lib/oportunidades/malhas/pb-municipios.json";
import { anoDeReferencia, gruposDeCor, type AreaMapa, type Malha } from "@/lib/oportunidades/pagina-brasil";
import { versaoLegivel } from "@/lib/oportunidades/osc";
import { ROTULO_ESPECIE, especieDe, lenteDe, urlEntidade } from "@/lib/oportunidades/pagina-entidade";
import { PODE, urlMunicipio, type NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import {
  ABAS_UF,
  NOME_UF,
  ancoraRegiao,
  ROTULO_LENTE_UF,
  etapasComparadas,
  fontesDaUf,
  funil,
  intermediariasDaUf,
  lentesDaUf,
  metodoDaUf,
  municipiosPorRegiao,
  naUf,
  orgaosComparados,
  porChave,
  porSinais,
  porSituacao,
  SUFIXO_VIVO_POR_TCE,
  textoSemMedicoes,
  textoSemOrgaoEstadual,
  totalTerritorio,
  urlRelatorioUf,
  urlUf,
  type AbaUf,
  type MunicipioUf,
} from "@/lib/oportunidades/pagina-uf";
import type { LeituraUfOk } from "@/lib/oportunidades/pagina-uf.server";
import { tituloOrgao } from "@/lib/oportunidades/padroes";
import { CHAVE_TODOS, MINIMO_MEDICOES, ROTULO_ETAPA } from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_TEMA } from "@/lib/oportunidades/temas";
import { trilha } from "@/lib/oportunidades/trilha";
import { Carregando } from "../../_componentes/Carregando";
import { MapaTerritorio } from "../../_componentes/MapaTerritorio";
import { Termo } from "../../_componentes/Termo";
import { Trilha } from "../../_componentes/Trilha";
import { BotaoImprimir } from "../../fiscal/[ibge]/simular/BotaoImprimir";
import { Secao } from "../../municipio/[ibge]/relatorio/RelatorioConteudo";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";

const n = (x: number | null | undefined) => (x === null || x === undefined ? "—" : x.toLocaleString("pt-BR"));
// A4x (08/10/2026): o `dado_ate` é carimbo com hora; o dia é o de Brasília (o arquivo de 07/10, 22h34, saía como 08/10).
const data = (iso: string | null | undefined) => dataBrasilia(iso);
const pct = (x: number | null) => (x === null ? "—" : `${x.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`);
const dias = (x: number | null) => (x === null ? "—" : `${n(Math.round(x))} dias`);

/** Fora da PB, o município não tem a página em abas: a descida vai aos investimentos do município. */
const urlDoMunicipioNaUf = (ibge: string, completa: boolean) => (completa ? urlMunicipio(ibge) : `/mapa/municipio/${ibge}/investimentos`);

/** Os atalhos do administrador para os painéis dos 223 (só a PB tem): na página e no relatório (C1a). */
export function AtalhosAdmin({ l, nivel }: { l: LeituraUfOk; nivel: NivelAcesso }) {
  if (nivel < 3 || !l.completa) return null;
  return (
    <>
      <LinkMapa href="/mapa/fiscal" className="pa-btn pa-btn-pequeno">
        Capacidade fiscal dos 223
      </LinkMapa>
      <LinkMapa href={`/mapa/painel?uf=${l.sigla}`} className="pa-btn pa-btn-pequeno">
        Painel de execução
      </LinkMapa>
      <LinkMapa href="/mapa/painel/tce" className="pa-btn pa-btn-pequeno">
        Tribunal de Contas (TCE-PB)
      </LinkMapa>
      <LinkMapa href="/mapa/painel/contas" className="pa-btn pa-btn-pequeno">
        Contas e obras
      </LinkMapa>
      <LinkMapa href="/mapa/fornecedores" className="pa-btn pa-btn-pequeno">
        Fornecedores
      </LinkMapa>
    </>
  );
}

/** Fora da PB, o que a base tem e o que não tem: na página e no relatório (C1a), que dizem o mesmo. */
export function AvisoCobertura({ l }: { l: LeituraUfOk }) {
  if (l.completa) return null;
  return (
    <p className="pa-nota">
      A PONTE cobre a Paraíba por inteiro. Para {NOME_UF[l.sigla]}, a base tem os instrumentos vivos (em execução, em prestação de contas e em{" "}
      <Termo slug="tomada-de-contas-especial">tomada de contas especial</Termo>), as propostas desde 2019, o tempo de cada etapa e o Pix e o fundo a
      fundo por ano. Não há fiscal, indicadores nem OSC.
    </p>
  );
}

function Cabeca({ l, nivel }: { l: LeituraUfOk; nivel: NivelAcesso }) {
  const nome = NOME_UF[l.sigla];
  return (
    <div className="pa-pilha mp-radar-cabeca">
      <Trilha elos={trilha({ uf: l.sigla })} />
      <h1 className="pa-titulo">{nome}</h1>
      <p className="pa-sub mp-mun-chips">
        <span>{l.sigla}</span>
        <span>{l.completa ? "dado completo: todos os instrumentos desde 2008" : "cobertura parcial: instrumentos vivos e propostas desde 2019"}</span>
        <span>Transferegov até {data(l.execucao.dado_ate)}</span>
      </p>
      {/* C4a (C5 da R3): imprimir é do cadastro; no nível 0 a linha inteira sai (os atalhos são do administrador). */}
      {PODE.cadastro(nivel) && (
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          <AtalhosAdmin l={l} nivel={nivel} />
        </p>
      )}
      <AvisoCobertura l={l} />
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
      As somas do estado aparecem depois da próxima atualização diária dos dados.
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

/**
 * A aba de entrada. `peca` (C1a): a versão do relatório para imprimir, sem os botões que levam às outras abas (no
 * relatório elas vêm logo abaixo) e sem a linha das leituras que falharam, que lá fica nas fontes.
 */
export function Resumo({ l, peca = false }: { l: LeituraUfOk; peca?: boolean }) {
  const t = l.territorio;
  const grupos = t ? porSituacao(t, l.sigla) : [];
  const g = (id: string) => grupos.find((x) => x.id === id);
  const vivos = t ? totalTerritorio(t, l.sigla, "vivos") : null;
  // A4x: a mesma regra do Brasil, com o `dado_ate` (carimbo) pelo dia de Brasília.
  const ano = anoDeReferencia(l.execucao);
  const f = l.desfechos ? funil(l.desfechos, l.sigla).find((x) => x.ano === ano) : undefined;
  const pixAno = (l.pix ?? []).filter((p) => p.recorte === l.sigla && p.ano !== null && p.pago > 0).sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0))[0];
  const lentes = l.proponentes ? lentesDaUf(l.proponentes) : null;
  return (
    <>
      <Secao id="uf-numeros" titulo="Em números">
        {t ? (
          <div className="pa-grade pa-grade-4 mp-painel-cartoes">
            <Cartao
              rotulo="Em execução"
              valor={n(g("execucao")?.n ?? 0)}
              nota={
                <>
                  {moedaCurta(g("execucao")?.valor ?? 0)} de <Termo slug="valor-global">valor global</Termo>; {moedaCurta(g("execucao")?.desembolsado ?? 0)}{" "}
                  <Termo slug="desembolso">desembolsados</Termo>.
                </>
              }
            />
            <Cartao rotulo="Prestando contas" valor={n(g("contas")?.n ?? 0)} nota={`${moedaCurta(g("contas")?.valor ?? 0)} de valor global.`} />
            <Cartao
              rotulo="Municípios com instrumento vivo"
              valor={n(vivos?.municipios ?? 0)}
              nota={
                <>
                  {n(vivos?.proponentes ?? 0)} <Termo slug="proponente">proponentes</Termo> com <Termo slug="instrumento-vivo">instrumento vivo</Termo>.
                </>
              }
            />
            {f && <Cartao rotulo={`Propostas em ${ano}`} valor={n(f.enviadas)} nota={`${n(f.assinadas)} assinadas até agora; ${n(f.emAndamento)} em andamento.`} />}
            {l.janelas !== null && (
              <Cartao
                rotulo="Janelas abertas no Transferegov"
                valor={n(l.janelas)}
                nota={
                  peca ? (
                    "Programas abertos hoje, no catálogo do Mapa."
                  ) : (
                    <Link href="/mapa" prefetch={false}>
                      Ver as janelas
                      <Carregando />
                    </Link>
                  )
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
        <Secao id="uf-quem-recebe" titulo="Quem recebe no estado" nota="Quem tem instrumento na base, nos mesmos grupos da página do município. Cada município e cada entidade têm a sua página.">
          <TabelaRolagem rotulo="Quem recebe no estado">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Grupo</th>
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
          </TabelaRolagem>
          {l.osc && (
            <p className="pa-nota">
              Na sociedade civil, além das que têm instrumento: {n(l.osc.ativas)} organizações ativas no <Termo slug="mapa-das-osc">Mapa das OSC</Termo> (Ipea,
              versão de{" "}
              {versaoLegivel(l.osc.versao)}), listadas na página de cada município.
            </p>
          )}
          {!peca && (
            <p className="mp-nao-imprimir mp-laudo-acoes">
              <Link href={urlUf(l.sigla, "municipios")} className="pa-btn pa-btn-pequeno" prefetch={false}>
                Ver os municípios
                <Carregando />
              </Link>
              <Link href={urlUf(l.sigla, "estado")} className="pa-btn pa-btn-pequeno" prefetch={false}>
                Ver o estado como proponente
                <Carregando />
              </Link>
            </p>
          )}
        </Secao>
      )}

      {l.indicadores && l.indicadores.length > 0 && (
        <Secao id="uf-indicadores" titulo="O estado em indicadores" nota="O valor do estado e o do Brasil no mesmo ano, pelas mesmas fontes da página do município.">
          <TabelaRolagem rotulo="O estado em indicadores">
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
          </TabelaRolagem>
        </Secao>
      )}
      {!peca && l.faltas.length > 0 && <p className="pa-nota">Não puderam ser lidos agora: {l.faltas.join(", ")}.</p>}
    </>
  );
}

/**
 * `rotuloId` (onda 7, C, 09/10/2026; N04 da auditoria R1): o id do resumo do grupo. Sem ele, as 15 tabelas da PB tinham
 * o mesmo nome ("Municípios: instrumentos e valores"), e a lista de regiões do leitor de tela não dizia qual era qual.
 */
function TabelaMunicipios({ ms, completa, admin, rotuloId }: { ms: MunicipioUf[]; completa: boolean; admin: boolean; rotuloId?: string }) {
  return (
    <TabelaRolagem {...(rotuloId ? { rotuloId } : { rotulo: "Municípios: instrumentos e valores" })}>
      <table className="mp-tabela">
        <thead>
          <tr>
            <th scope="col">Município</th>
            {completa && <th scope="col">Porte na PB</th>}
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
              {/* A09 (onda 7, C, 09/10/2026): cabeçalho de linha, para o leitor de tela dizer o município em cada célula. */}
              <th scope="row" className="mp-th-celula">
                <Link href={urlDoMunicipioNaUf(m.ibge, completa)} prefetch={false}>
                  {m.nome}
                  <Carregando />
                </Link>
              </th>
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
    </TabelaRolagem>
  );
}

/**
 * O mapa dos municípios da PB (a única UF com a malha municipal), cor pela região intermediária do IBGE. `alternativa`
 * (C1a): onde está a lista com os mesmos links, quando não é logo abaixo do mapa (no relatório, é a aba Municípios).
 */
export function MapaDaUf({ municipios, alternativa }: { municipios: MunicipioUf[]; alternativa?: React.ReactNode }) {
  const intermediarias = intermediariasDaUf(municipios);
  const cor = gruposDeCor(intermediarias);
  const areas = new Map<string, AreaMapa>(
    municipios.map((m) => [m.ibge, { nome: m.regiao ? `${m.nome} (região imediata de ${m.regiao})` : m.nome, href: urlMunicipio(m.ibge), grupo: cor.get(m.intermediaria ?? "") ?? 0 }]),
  );
  return (
    <MapaTerritorio
      malha={malhaPb as Malha}
      areas={areas}
      legenda={intermediarias.map((r) => ({ grupo: cor.get(r) ?? 0, rotulo: `Região intermediária de ${r}` }))}
      titulo="Mapa dos 223 municípios da Paraíba, cor pela região intermediária do IBGE"
      alternativa={alternativa}
    />
  );
}

function Municipios({ l, nivel, ordenarPorSinais }: { l: LeituraUfOk; nivel: NivelAcesso; ordenarPorSinais: boolean }) {
  if (!l.municipios) return <p className="pa-nota">A lista dos municípios não pôde ser lida agora.</p>;
  // o fiscal e os sinais do painel só existem para a Paraíba
  const admin = nivel >= 3 && l.completa;
  // A cor de cada região intermediária, a mesma do mapa: o título de cada grupo da tabela a repete (H12, B11).
  const corDaIntermediaria = gruposDeCor(intermediariasDaUf(l.municipios));
  const ordem: React.ReactNode = ordenarPorSinais ? (
    "ordenados pelos sinais do painel (só o administrador vê esta ordem)"
  ) : l.completa ? (
    <>
      em ordem alfabética dentro de cada <Termo slug="regiao-imediata">região imediata</Termo> do IBGE
    </>
  ) : (
    "em ordem alfabética"
  );
  const nota = l.completa ? (
    <>
      Os {n(l.municipios.length)} municípios, {ordem}. Instrumentos: todos os da base desde 2008; porte: pequeno, médio ou grande, pelo{" "}
      <Termo slug="tercil">terço da população</Termo> entre os 223; OSC: as <Termo slug="osc-ativa">ativas</Termo> no Mapa das OSC.
      {!ordenarPorSinais && (
        <>
          {" "}
          No mapa, a cor é a da <Termo slug="regiao-intermediaria">região intermediária</Termo>, que reúne várias imediatas: cada grupo da tabela diz a
          sua e repete a cor, e os grupos da mesma cor vêm juntos.
        </>
      )}
      {admin && (
        <>
          {" "}
          A coluna da transferência voluntária diz se o município pode receber esse repasse, pelo <Termo slug="decisoes-fiscais">painel fiscal</Termo>.
        </>
      )}
    </>
  ) : (
    <>
      Os {n(l.municipios.length)} municípios com <Termo slug="instrumento-vivo">instrumento vivo</Termo> na base, {ordem}.
    </>
  );
  return (
    <Secao id="uf-municipios" titulo="Os municípios" nota={nota}>
      {l.completa && !ordenarPorSinais && <MapaDaUf municipios={l.municipios} />}
      {admin && (
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <span className="pa-nota">Administrador: </span>
          {/* Onda 8, C (09/10/2026; N26 da auditoria R1, WCAG 4.1.2): a ordem escolhida não era só a cor do chip; o
              `aria-current` diz qual é, como nos chips do painel. */}
          <LinkMapa
            href={urlUf(l.sigla, "municipios")}
            className={`pa-chip${!ordenarPorSinais ? " pa-ativo" : ""}`}
            aria-current={!ordenarPorSinais ? "true" : undefined}
          >
            Por região
          </LinkMapa>
          <LinkMapa
            href={`${urlUf(l.sigla, "municipios")}&ordem=sinais`}
            className={`pa-chip${ordenarPorSinais ? " pa-ativo" : ""}`}
            aria-current={ordenarPorSinais ? "true" : undefined}
          >
            Por sinais do painel
          </LinkMapa>
        </p>
      )}
      {ordenarPorSinais ? (
        <TabelaMunicipios ms={porSinais(l.municipios)} completa={l.completa} admin={admin} />
      ) : (
        municipiosPorRegiao(l.municipios).map((g) => (
          <details key={g.regiao} id={ancoraRegiao(g.regiao)} className="mp-ent-grupo" open>
            <summary id={`${ancoraRegiao(g.regiao)}-resumo`}>
              {/* H12 (B11): o mapa pinta pela intermediária e a tabela agrupa pela imediata; o título casa os dois. */}
              {l.completa && g.intermediaria && (
                <>
                  <span className={`mp-mapa-amostra mp-mapa-g${corDaIntermediaria.get(g.intermediaria) ?? 0}`} aria-hidden="true" />{" "}
                </>
              )}
              <strong>{l.completa ? `Região imediata de ${g.regiao}` : g.regiao}</strong>
              {l.completa && g.intermediaria && <> · região intermediária de {g.intermediaria}</>} · {n(g.municipios.length)}{" "}
              {g.municipios.length === 1 ? "município" : "municípios"}
            </summary>
            <TabelaMunicipios ms={g.municipios} completa={l.completa} admin={admin} rotuloId={`${ancoraRegiao(g.regiao)}-resumo`} />
          </details>
        ))
      )}
      {/* C4a: o CSV é do cadastro (D1; a rota responde 404 a quem não é aprovado); no nível 0 o botão não aparece. */}
      {PODE.cadastro(nivel) && (
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <a href={`/mapa/uf/${l.sigla.toLowerCase()}/csv`} className="pa-btn pa-btn-pequeno">
            Baixar os municípios (CSV)
          </a>
        </p>
      )}
    </Secao>
  );
}

export function Estado({ l }: { l: LeituraUfOk }) {
  if (!l.proponentes) return <p className="pa-nota">A lista dos proponentes não pôde ser lida agora.</p>;
  const estaduais = l.proponentes
    .map((p) => ({ ...p, especie: especieDe(p.proponente, p.tipo_agente) }))
    .filter((p) => lenteDe(p.especie) === "estado")
    .sort((a, b) => b.valor - a.valor || (a.proponente ?? "").localeCompare(b.proponente ?? "", "pt-BR"));
  return (
    <Secao
      id="uf-estado"
      titulo="O estado como proponente"
      nota={
        <>
          O governo, as secretarias, as universidades, os fundos e as autarquias estaduais com instrumento na base
          {!l.completa && (
            <>
              {" "}
              (só os <Termo slug="instrumento-vivo">vivos</Termo>)
            </>
          )}
          , cada um com a sua página.
        </>
      }
    >
      {estaduais.length ? (
        <TabelaRolagem rotulo="O estado como proponente">
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
                  <th scope="row" className="mp-th-celula">
                    <Link href={urlEntidade(p.cnpj)} prefetch={false}>
                      {p.proponente ?? cnpjLegivel(p.cnpj)}
                      <Carregando />
                    </Link>
                  </th>
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
        </TabelaRolagem>
      ) : (
        // B12 (C1a, 08/10/2026): o vazio diz o recorte da base; fora da PB, só entram os instrumentos vivos.
        <p>{textoSemOrgaoEstadual(l.sigla)}</p>
      )}
      <p className="pa-nota">
        A situação fiscal dos estados não entra aqui: o relatório dos estados no Tesouro Transparente não é atualizado desde 03/11/2025, e o
        extrato do <Termo slug="cauc">CAUC</Termo> tem verificação manual.
      </p>
    </Secao>
  );
}

/** Também é a aba do Brasil (`sigla` "BR", `completa` falso): lá a soma por situação fica só com os vivos. */
export function Dinheiro({ l, nivel }: { l: LeituraUfOk; nivel: NivelAcesso }) {
  const t = l.territorio;
  if (!t) return <SemSomas />;
  const situacoes = porSituacao(t, l.sigla, !l.completa);
  // A4x: entre os vivos, a linha além de execução e contas é a da tomada de contas especial (o rótulo já diz; a nota explica).
  const vivoPorTce = !l.completa && situacoes.some((s) => s.rotulo.endsWith(SUFIXO_VIVO_POR_TCE));
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
      <Secao
        id="uf-situacao"
        titulo="Os instrumentos por situação"
        nota={
          <>
            {l.completa ? (
              "Todos os instrumentos da base, desde 2008."
            ) : (
              <>
                Só os <Termo slug="instrumento-vivo">vivos</Termo>: fora da Paraíba a base não guarda os encerrados.
                {/* A4x: no Brasil, 43 concluídos apareciam aqui sem explicação; são os com tomada de contas especial. */}
                {vivoPorTce && (
                  <>
                    {" "}
                    Além dos em execução e dos prestando contas, só entram os que estão em{" "}
                    <Termo slug="tomada-de-contas-especial">tomada de contas especial</Termo>, que conta como vivo.
                  </>
                )}
              </>
            )}{" "}
            O <Termo slug="valor-global">valor global</Termo> é o total previsto; o <Termo slug="desembolso">desembolsado</Termo>, o que já foi liberado.
          </>
        }
      >
        <TabelaRolagem rotulo="Os instrumentos por situação">
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
        </TabelaRolagem>
      </Secao>
      <Secao
        id="uf-orgaos"
        titulo="De onde vem o dinheiro"
        nota={
          <>
            Os {l.completa ? <Termo slug="instrumento-vivo">instrumentos vivos</Termo> : "instrumentos vivos"} por órgão concedente, do maior valor para o
            menor.
          </>
        }
      >
        <TabelaRolagem rotulo="De onde vem o dinheiro">
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
        </TabelaRolagem>
      </Secao>
      {nivel >= 1 && temas.length > 0 && (
        <Secao id="uf-temas" titulo="Por tema" nota="Os instrumentos vivos por tema do programa (um instrumento pode ter mais de um tema).">
          <TabelaRolagem rotulo="Por tema">
            <table className="mp-tabela mp-ent-areas">
              {/* A09 (onda 7, C, 09/10/2026): sem `thead`, os dois números da linha não tinham nome para o leitor de tela. */}
              <thead>
                <tr>
                  <th scope="col">Tema</th>
                  <th scope="col">Instrumentos vivos</th>
                  <th scope="col">Valor global</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
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
          </TabelaRolagem>
        </Secao>
      )}
      {nivel >= 1 && pix.length > 0 && (
        <Secao
          id="uf-pix"
          titulo="Pix (transferências especiais)"
          nota={
            <>
              Os planos de ação do <Termo slug="pix">Pix</Termo> com beneficiário {l.sigla === "BR" ? "no país" : "no estado"}, por ano da emenda.
            </>
          }
        >
          <TabelaRolagem rotulo="Pix (transferências especiais)">
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
          </TabelaRolagem>
        </Secao>
      )}
      {nivel >= 1 && fundoPorAno.size > 0 && (
        <Secao
          id="uf-fundo"
          titulo="Fundo a fundo"
          nota={
            <>
              Os planos de ação do <Termo slug="fundo-a-fundo">fundo a fundo</Termo> com entes {l.sigla === "BR" ? "de todo o país" : "do estado"}, por ano.
            </>
          }
        >
          <TabelaRolagem rotulo="Fundo a fundo">
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
          </TabelaRolagem>
        </Secao>
      )}
    </>
  );
}

export function Tempos({ l }: { l: LeituraUfOk }) {
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
        nota={
          <>
            <Termo slug="mediana">Mediana</Termo> em dias das etapas que terminaram nos últimos 36 meses, contra a do Brasil. Marcada quando passa de 1,5 vez a
            do país; com menos de {MINIMO_MEDICOES} medições, não compara.
          </>
        }
      >
        {todos.some((e) => e.uf !== null) ? (
          <TabelaRolagem rotulo={`Quanto leva cada etapa ${naUf(l.sigla)}`}>
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
          </TabelaRolagem>
        ) : (
          // B12 (C1a, 08/10/2026): o vazio diz o mínimo de casos; a leitura que falhou não se passa por falta de medição.
          <p className="pa-nota">{l.etapas ? textoSemMedicoes(l.sigla) : "O tempo das etapas não pôde ser lido agora. Costuma ser passageiro: tente de novo em alguns minutos."}</p>
        )}
        {orgaos.length > 0 && (
          <details className="mp-ent-grupo">
            <summary>
              <strong>Por órgão</strong> · {n(orgaos.length)} órgãos, os com mais etapas lentas primeiro
            </summary>
            <TabelaRolagem rotulo={`Por órgão · ${n(orgaos.length)} órgãos, os com mais etapas lentas primeiro`}>
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
            </TabelaRolagem>
          </details>
        )}
      </Secao>
      {f.length > 0 && (
        <Secao
          id="uf-funil"
          titulo="O funil das propostas"
          nota={
            <>
              As propostas por ano de envio e o que aconteceu com elas até agora. Os anos recentes ainda têm muita proposta em andamento; entre parênteses, as{" "}
              <Termo slug="limbo">paradas há mais de um ano</Termo>.
            </>
          }
        >
          <TabelaRolagem rotulo="O funil das propostas">
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
          </TabelaRolagem>
        </Secao>
      )}
    </>
  );
}

/**
 * Fontes, datas e limites (C1a, 08/10/2026): as fontes da página, cada uma com a sua data, o "como ler" e a
 * assinatura da PONTE, como no relatório do município. Fecha o relatório para imprimir e a aba "Relatório e dados".
 */
export function FontesUf({ l, administrador }: { l: LeituraUfOk; administrador: boolean }) {
  return (
    <Secao id="uf-fontes" titulo="Fontes, datas e limites">
      <ul>
        {fontesDaUf(l, administrador).map((x) => (
          <li key={x.fonte}>
            <strong>{x.fonte}</strong>
            {x.data ? ` (${data(x.data)})` : ""}: {x.nota}
          </li>
        ))}
      </ul>
      <div className="mp-rel-sub">
        <h3 className="mp-rel-h3">Como ler</h3>
        <ul>
          {metodoDaUf(l.completa, administrador).map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      {l.faltas.length > 0 && <p className="pa-nota">Não lido nesta página (a leitura falhou ou a fonte ainda não está publicada): {l.faltas.join(", ")}.</p>}
      <p className="pa-nota">Relatório preparado por PONTE Estruturação de Projetos de Impacto.</p>
    </Secao>
  );
}

/**
 * A aba "Relatório e dados" (C1a, 08/10/2026; B11, 9.5): curta, como a do município. Antes repetia o Resumo e o
 * Dinheiro dentro da aba (B0, 4.4); agora leva ao relatório para imprimir, que junta todas as abas, e dá o CSV e as
 * fontes.
 */
function Relatorio({ l, nivel }: { l: LeituraUfOk; nivel: NivelAcesso }) {
  return (
    <>
      <Secao
        id="uf-relatorio"
        titulo="O relatório completo"
        nota="Todas as abas numa peça só, com a fonte de cada número, para imprimir ou anexar. No papel, os municípios vêm somados por região; a lista, município a município, sai no CSV."
      >
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <LinkMapa href={urlRelatorioUf(l.sigla)} className="pa-btn">
            Abrir o relatório para imprimir
          </LinkMapa>
          <a href={`/mapa/uf/${l.sigla.toLowerCase()}/csv`} className="pa-btn pa-btn-pequeno">
            Baixar os municípios (CSV)
          </a>
        </p>
      </Secao>
      {/* as colunas do administrador (fiscal e sinais) só existem na PB */}
      <FontesUf l={l} administrador={nivel >= 3 && l.completa} />
    </>
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
      {aba === "relatorio" && <Relatorio l={l} nivel={nivel} />}
    </div>
  );
}
