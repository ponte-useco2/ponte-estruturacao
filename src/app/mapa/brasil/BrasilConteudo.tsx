/**
 * A página do Brasil em abas (U2, desenho aprovado em 08/10/2026): o país e as 27 UFs lado a lado, em ordem
 * alfabética, sem destaque de melhor ou pior. Só o que a base guarda para o país inteiro: os instrumentos vivos, as
 * propostas desde 2019, o tempo das etapas, o Pix e o fundo a fundo e as janelas abertas. O mapa leva a cada UF.
 */
import Link from "next/link";
import { formatarData } from "@/lib/oportunidades/central";
import malhaBrasil from "@/lib/oportunidades/malhas/brasil-uf.json";
import {
  ABAS_BRASIL,
  MACRORREGIAO,
  ORDEM_MACRORREGIAO,
  ROTULO_MACRORREGIAO,
  ufsLadoALado,
  urlBrasil,
  type AbaBrasil,
  type AreaMapa,
  type Malha,
} from "@/lib/oportunidades/pagina-brasil";
import type { LeituraBrasilOk } from "@/lib/oportunidades/pagina-brasil.server";
import type { NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import { NOME_UF, funil, porSituacao, totalTerritorio, urlUf } from "@/lib/oportunidades/pagina-uf";
import { CHAVE_TODOS, ETAPAS_CAMINHO, ROTULO_ETAPA, medianaComparavel } from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { Carregando } from "../_componentes/Carregando";
import { MapaTerritorio } from "../_componentes/MapaTerritorio";
import { Termo } from "../_componentes/Termo";
import { BotaoImprimir } from "../fiscal/[ibge]/simular/BotaoImprimir";
import { Secao } from "../municipio/[ibge]/relatorio/RelatorioConteudo";
import { Dinheiro } from "../uf/[sigla]/UfConteudo";

const n = (x: number | null | undefined) => (x === null || x === undefined ? "—" : x.toLocaleString("pt-BR"));
const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");
const pct = (x: number | null) => (x === null ? "—" : `${x.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`);

function Cabeca({ l }: { l: LeituraBrasilOk }) {
  return (
    <div className="pa-pilha mp-radar-cabeca">
      <nav aria-label="Onde você está" className="mp-mun-trilha">
        <span aria-current="page">Brasil</span>
      </nav>
      <h1 className="pa-titulo">Brasil</h1>
      <p className="pa-sub mp-mun-chips">
        <span>27 UFs</span>
        <span>instrumentos vivos de todo o país; o dado completo é o da Paraíba</span>
        <span>Transferegov até {data(l.execucao.dado_ate)}</span>
      </p>
      <p className="mp-nao-imprimir mp-laudo-acoes">
        <BotaoImprimir />
        <Link href={urlUf("PB")} className="pa-btn pa-btn-pequeno" prefetch={false}>
          Paraíba
          <Carregando />
        </Link>
      </p>
    </div>
  );
}

function Abas({ aba, nivel }: { aba: AbaBrasil; nivel: NivelAcesso }) {
  return (
    <nav aria-label="Partes do Brasil" className="mp-mun-abas mp-nao-imprimir">
      {ABAS_BRASIL.filter((a) => nivel >= a.minimo).map((a) => (
        <Link key={a.id} href={urlBrasil(a.id)} aria-current={a.id === aba ? "page" : undefined} scroll={false} prefetch={false}>
          {a.nome}
          <Carregando />
        </Link>
      ))}
    </nav>
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

function MapaDoBrasil() {
  const cor = new Map(ORDEM_MACRORREGIAO.map((r, i) => [r, i]));
  const areas = new Map<string, AreaMapa>(
    Object.keys(NOME_UF).map((sigla) => [sigla, { nome: `${NOME_UF[sigla]} (${ROTULO_MACRORREGIAO[MACRORREGIAO[sigla]]})`, href: urlUf(sigla), grupo: cor.get(MACRORREGIAO[sigla]) ?? 0 }]),
  );
  return (
    <MapaTerritorio
      malha={malhaBrasil as Malha}
      areas={areas}
      legenda={ORDEM_MACRORREGIAO.map((r) => ({ grupo: cor.get(r) ?? 0, rotulo: ROTULO_MACRORREGIAO[r] }))}
      titulo="Mapa do Brasil por UF, cor pela macrorregião"
      rotulos
    />
  );
}

function Resumo({ l, ano }: { l: LeituraBrasilOk; ano: number }) {
  const t = l.territorio;
  const vivos = t ? totalTerritorio(t, "BR", "vivos") : null;
  const grupos = t ? porSituacao(t, "BR", true) : [];
  const g = (id: string) => grupos.find((x) => x.id === id);
  const f = l.desfechos ? funil(l.desfechos, "BR").find((x) => x.ano === ano) : undefined;
  const pix = (l.pix ?? []).filter((p) => p.recorte === "BR" && p.ano !== null && p.pago > 0).sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0))[0];

  return (
    <>
      <Secao
        id="br-numeros"
        titulo="Em números"
        nota={
          <>
            Os <Termo slug="instrumento-vivo">instrumentos vivos</Termo> (em execução, em prestação de contas e em{" "}
            <Termo slug="tomada-de-contas-especial">tomada de contas especial</Termo>) de todo o país.
          </>
        }
      >
        {t ? (
          <div className="pa-grade pa-grade-4 mp-painel-cartoes">
            <Cartao rotulo="Instrumentos vivos" valor={n(vivos?.n ?? 0)} nota={`${moedaCurta(vivos?.valor ?? 0)} de valor global.`} />
            <Cartao rotulo="Em execução" valor={n(g("execucao")?.n ?? 0)} nota={`${moedaCurta(g("execucao")?.desembolsado ?? 0)} desembolsados.`} />
            <Cartao rotulo="Prestando contas" valor={n(g("contas")?.n ?? 0)} />
            <Cartao rotulo="Municípios com instrumento vivo" valor={n(vivos?.municipios ?? 0)} nota={`${n(vivos?.proponentes ?? 0)} proponentes.`} />
            {f && <Cartao rotulo={`Propostas em ${ano}`} valor={n(f.enviadas)} nota={`${n(f.assinadas)} assinadas até agora.`} />}
            {pix && <Cartao rotulo={`Pix ${pix.ano}${pix.ano === ano ? " (ano em curso)" : ""}`} valor={moedaCurta(pix.pago)} nota={`${n(pix.planos_pagos)} planos pagos de ${n(pix.planos)}.`} />}
            {l.programasAbertos !== null && (
              <Cartao rotulo="Programas com janela aberta" valor={n(l.programasAbertos)} nota="No Transferegov, em alguma UF; a contagem por UF está na aba das 27 UFs." />
            )}
          </div>
        ) : (
          <p className="pa-cartao pa-cartao-plano">As somas do país saem na próxima rodada diária do painel.</p>
        )}
      </Secao>
      <Secao
        id="br-mapa"
        titulo="As 27 UFs"
        nota={
          <>
            Cada UF leva à sua página; a cor é a da <Termo slug="macrorregiao">macrorregião</Termo>. A Paraíba tem o dado completo; as outras, o que a base
            guarda para o país.
          </>
        }
      >
        <MapaDoBrasil />
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <Link href={urlBrasil("estados")} className="pa-btn pa-btn-pequeno" prefetch={false}>
            As 27 UFs lado a lado
            <Carregando />
          </Link>
        </p>
      </Secao>
      {l.faltas.length > 0 && <p className="pa-nota">Não puderam ser lidos agora: {l.faltas.join(", ")}.</p>}
    </>
  );
}

function Estados({ l, ano }: { l: LeituraBrasilOk; ano: number }) {
  if (!l.territorio) return <p className="pa-cartao pa-cartao-plano">As somas por UF saem na próxima rodada diária do painel.</p>;
  const ufs = ufsLadoALado(l.territorio, l.desfechos ?? [], l.pix ?? [], l.janelas, ano);
  return (
    <Secao
      id="br-ufs"
      titulo="As 27 UFs lado a lado"
      nota={
        <>
          Em ordem alfabética. Instrumentos: só os <Termo slug="instrumento-vivo">vivos</Termo>, os únicos que a base guarda para todas as UFs. Propostas e{" "}
          <Termo slug="pix">Pix</Termo>: {ano}, até agora.
        </>
      }
    >
      <div className="mp-tabela-rolagem">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">UF</th>
              <th scope="col">Região</th>
              <th scope="col">Instrumentos vivos</th>
              <th scope="col">Em execução</th>
              <th scope="col">Prestando contas</th>
              <th scope="col">Valor dos vivos</th>
              <th scope="col">Municípios com vivo</th>
              <th scope="col">Propostas em {ano}</th>
              <th scope="col">Pix pago em {ano}</th>
              <th scope="col">Janelas abertas</th>
            </tr>
          </thead>
          <tbody>
            {ufs.map((u) => (
              <tr key={u.sigla}>
                <th scope="row">
                  <Link href={urlUf(u.sigla)} prefetch={false}>
                    {u.nome}
                    <Carregando />
                  </Link>
                </th>
                <td>{ROTULO_MACRORREGIAO[u.regiao]}</td>
                <td className="mp-rel-num">{n(u.vivos)}</td>
                <td className="mp-rel-num">{n(u.emExecucao)}</td>
                <td className="mp-rel-num">{n(u.prestandoContas)}</td>
                <td className="mp-rel-num">{moedaCurta(u.valorVivos)}</td>
                <td className="mp-rel-num">{n(u.municipiosVivos)}</td>
                <td className="mp-rel-num">{n(u.propostasAno)}</td>
                <td className="mp-rel-num">{u.pixPagoAno === null ? "—" : moedaCurta(u.pixPagoAno)}</td>
                <td className="mp-rel-num">{n(u.janelas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mp-nao-imprimir mp-laudo-acoes">
        <a href="/mapa/brasil/csv" className="pa-btn pa-btn-pequeno">
          As 27 UFs em CSV
        </a>
      </p>
    </Secao>
  );
}

function Tempos({ l }: { l: LeituraBrasilOk }) {
  const etapas = ETAPAS_CAMINHO.map((etapa) => {
    const linha = (l.etapas ?? []).find((e) => e.chave === CHAVE_TODOS && e.etapa === etapa);
    return { etapa, rotulo: ROTULO_ETAPA[etapa] ?? etapa, mediana: medianaComparavel(linha), p90: linha?.p90 ?? null, n: linha?.n ?? 0 };
  });
  const f = l.desfechos ? funil(l.desfechos, "BR") : [];
  const dias = (x: number | null) => (x === null ? "—" : `${n(Math.round(x))} dias`);
  return (
    <>
      <Secao
        id="br-tempos"
        titulo="Quanto leva cada etapa no Brasil"
        nota={
          <>
            Em dias, das etapas que terminaram nos últimos 36 meses: a <Termo slug="mediana">mediana</Termo> e o{" "}
            <Termo slug="p90">9 em cada 10 até</Termo>. A comparação de cada UF com o país está na página dela.
          </>
        }
      >
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Etapa (todos os órgãos)</th>
                <th scope="col">Mediana</th>
                <th scope="col">9 em cada 10 até</th>
                <th scope="col">Medições</th>
              </tr>
            </thead>
            <tbody>
              {etapas.map((e) => (
                <tr key={e.etapa}>
                  <th scope="row">{e.rotulo}</th>
                  <td className="mp-rel-num">{dias(e.mediana)}</td>
                  <td className="mp-rel-num">{dias(e.p90)}</td>
                  <td className="mp-rel-num">{n(e.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
      {f.length > 0 && (
        <Secao
          id="br-funil"
          titulo="O funil das propostas no Brasil"
          nota={
            <>
              As propostas por ano de envio e o que aconteceu com elas até agora. Entre as em andamento, as{" "}
              <Termo slug="limbo">paradas há mais de um ano</Termo> vêm entre parênteses.
            </>
          }
        >
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Ano</th>
                  <th scope="col">Enviadas</th>
                  <th scope="col">Assinadas</th>
                  <th scope="col">% assinadas</th>
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

export function BrasilConteudo({ l, aba, nivel }: { l: LeituraBrasilOk; aba: AbaBrasil; nivel: NivelAcesso }) {
  const ano = Number((l.execucao.referencia ?? l.execucao.dado_ate ?? "").slice(0, 4));
  const nomeAba = ABAS_BRASIL.find((a) => a.id === aba)?.nome ?? "";
  return (
    <div className="pa-pagina mp-radar mp-laudo mp-rel mp-mun">
      <Cabeca l={l} />
      <Abas aba={aba} nivel={nivel} />
      <p className="mp-so-imprimir pa-kicker">{nomeAba}</p>
      {aba === "resumo" && <Resumo l={l} ano={ano} />}
      {aba === "estados" && <Estados l={l} ano={ano} />}
      {aba === "dinheiro" && (
        <Dinheiro
          l={{
            estado: "ok",
            sigla: "BR",
            completa: false,
            execucao: l.execucao,
            territorio: l.territorio,
            proponentes: null,
            municipios: null,
            etapas: null,
            desfechos: null,
            pix: l.pix,
            fundo: l.fundo,
            janelas: null,
            indicadores: null,
            osc: null,
            faltas: l.faltas,
          }}
          nivel={nivel}
        />
      )}
      {aba === "tempos" && <Tempos l={l} />}
    </div>
  );
}
