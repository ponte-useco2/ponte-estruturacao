/**
 * A página do Brasil em abas (U2, desenho aprovado em 08/10/2026): o país e as 27 UFs lado a lado, em ordem
 * alfabética, sem destaque de melhor ou pior. Só o que a base guarda para o país inteiro: os instrumentos vivos, as
 * propostas desde 2019, o tempo das etapas, o Pix e o fundo a fundo e as janelas abertas. O mapa leva a cada UF.
 *
 * Desde a C1b (08/10/2026) cada aba é um bloco exportado, como no município: o relatório para imprimir
 * (`/mapa/brasil/relatorio`) junta os mesmos blocos, e a aba "Relatório e dados" ficou curta (o link, o CSV e as fontes).
 */
import { formatarData } from "@/lib/oportunidades/central";
import malhaBrasil from "@/lib/oportunidades/malhas/brasil-uf.json";
import {
  ABAS_BRASIL,
  MACRORREGIAO,
  ORDEM_MACRORREGIAO,
  ROTULO_MACRORREGIAO,
  URL_CSV_BRASIL,
  URL_RELATORIO_BRASIL,
  anoDeReferencia,
  fontesDoBrasil,
  metodoDoBrasil,
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
import { trilha } from "@/lib/oportunidades/trilha";
import { LinkMapa } from "../_componentes/LinkMapa";
import { MapaTerritorio } from "../_componentes/MapaTerritorio";
import { Termo } from "../_componentes/Termo";
import { Trilha } from "../_componentes/Trilha";
import { BotaoImprimir } from "../fiscal/[ibge]/simular/BotaoImprimir";
import { Secao } from "../municipio/[ibge]/relatorio/RelatorioConteudo";
import { Dinheiro } from "../uf/[sigla]/UfConteudo";
import { TabelaRolagem } from "../_componentes/TabelaRolagem";

const n = (x: number | null | undefined) => (x === null || x === undefined ? "—" : x.toLocaleString("pt-BR"));
const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");
const pct = (x: number | null) => (x === null ? "—" : `${x.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`);

function Cabeca({ l }: { l: LeituraBrasilOk }) {
  return (
    <div className="pa-pilha mp-radar-cabeca">
      <Trilha elos={trilha({})} />
      <h1 className="pa-titulo">Brasil</h1>
      <p className="pa-sub mp-mun-chips">
        <span>27 UFs</span>
        <span>
          <Termo slug="instrumento-vivo">instrumentos vivos</Termo> de todo o país; o dado completo é o da Paraíba
        </span>
        <span>Transferegov até {data(l.execucao.dado_ate)}</span>
      </p>
      <p className="mp-nao-imprimir mp-laudo-acoes">
        <BotaoImprimir />
        <LinkMapa href={urlUf("PB")} className="pa-btn pa-btn-pequeno">
          Ver a Paraíba
        </LinkMapa>
      </p>
    </div>
  );
}

function Abas({ aba, nivel }: { aba: AbaBrasil; nivel: NivelAcesso }) {
  return (
    <nav aria-label="Partes do Brasil" className="mp-mun-abas mp-nao-imprimir">
      {ABAS_BRASIL.filter((a) => nivel >= a.minimo).map((a) => (
        <LinkMapa key={a.id} href={urlBrasil(a.id)} aria-current={a.id === aba ? "page" : undefined} scroll={false}>
          {a.nome}
        </LinkMapa>
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

/**
 * A aba "Resumo": os números do país e o mapa. `noRelatorio` (C1b): sem o botão que leva à aba das UFs (no relatório a
 * tabela vem logo depois) e sem a nota do que faltou, que lá sai nas fontes.
 */
export function Resumo({ l, ano, noRelatorio = false }: { l: LeituraBrasilOk; ano: number; noRelatorio?: boolean }) {
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
              // "Na tabela", e não "na aba": a frase vale na página e no relatório (C1b).
              <Cartao rotulo="Programas com janela aberta" valor={n(l.programasAbertos)} nota="No Transferegov, em alguma UF; a contagem por UF está na tabela das 27 UFs." />
            )}
          </div>
        ) : (
          <p className="pa-cartao pa-cartao-plano">As somas do país aparecem depois da próxima atualização diária dos dados.</p>
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
        {!noRelatorio && (
          <p className="mp-nao-imprimir mp-laudo-acoes">
            <LinkMapa href={urlBrasil("estados")} className="pa-btn pa-btn-pequeno">
              Ver as 27 UFs lado a lado
            </LinkMapa>
          </p>
        )}
      </Secao>
      {!noRelatorio && l.faltas.length > 0 && <p className="pa-nota">Não puderam ser lidos agora: {l.faltas.join(", ")}.</p>}
    </>
  );
}

/** A aba "As 27 UFs". `noRelatorio` (C1b): sem o botão do CSV, que no relatório fica no cabeçalho. */
export function Estados({ l, ano, noRelatorio = false }: { l: LeituraBrasilOk; ano: number; noRelatorio?: boolean }) {
  if (!l.territorio) return <p className="pa-cartao pa-cartao-plano">As somas por UF aparecem depois da próxima atualização diária dos dados.</p>;
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
      <TabelaRolagem rotulo="As 27 UFs lado a lado">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">UF</th>
              <th scope="col">Região</th>
              <th scope="col">Instrumentos vivos</th>
              <th scope="col">Em execução</th>
              <th scope="col">Prestando contas</th>
              <th scope="col">Valor global dos vivos</th>
              <th scope="col">Municípios com instrumento vivo</th>
              <th scope="col">Propostas em {ano}</th>
              <th scope="col">Pix pago em {ano}</th>
              <th scope="col">Janelas abertas</th>
            </tr>
          </thead>
          <tbody>
            {ufs.map((u) => (
              <tr key={u.sigla}>
                <th scope="row">
                  <LinkMapa href={urlUf(u.sigla)}>{u.nome}</LinkMapa>
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
      </TabelaRolagem>
      {!noRelatorio && (
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <a href={URL_CSV_BRASIL} className="pa-btn pa-btn-pequeno">
            Baixar as 27 UFs (CSV)
          </a>
        </p>
      )}
    </Secao>
  );
}

/** A aba "Dinheiro federal": o bloco da UF com o recorte "BR" (só os vivos, sem a lista de proponentes e municípios). */
export function DinheiroDoBrasil({ l, nivel }: { l: LeituraBrasilOk; nivel: NivelAcesso }) {
  return (
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
  );
}

/** A aba "Tempos e funil". */
export function Tempos({ l }: { l: LeituraBrasilOk }) {
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
        <TabelaRolagem rotulo="Quanto leva cada etapa no Brasil">
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
        </TabelaRolagem>
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
          <TabelaRolagem rotulo="O funil das propostas no Brasil">
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
          </TabelaRolagem>
        </Secao>
      )}
    </>
  );
}

/**
 * Fontes, datas e limites (C1b, 08/10/2026), no formato do relatório do município: cada fonte com a data do dado, o
 * que faltou ler, como se conta e a assinatura. Fecha o relatório e fica na aba "Relatório e dados".
 */
export function FontesDoBrasil({ l, ano }: { l: LeituraBrasilOk; ano: number }) {
  const fontes = fontesDoBrasil({ painel: l.execucao.dado_ate, pix: l.pixDadoAte, janelas: l.janelasDadoAte });
  return (
    <Secao id="br-fontes" titulo="Fontes, datas e limites">
      <ul>
        {fontes.map((x) => (
          <li key={x.fonte}>
            <strong>{x.fonte}</strong>
            {x.data ? ` (dado até ${data(x.data)})` : ""}: {x.nota}
          </li>
        ))}
      </ul>
      {l.faltas.length > 0 && <p className="pa-nota">Não lido nesta página (a leitura falhou ou a fonte ainda não está publicada): {l.faltas.join(", ")}.</p>}
      <div className="mp-rel-sub">
        <h3 className="mp-rel-h3">Como se conta</h3>
        <ul>
          {metodoDoBrasil(ano).map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
      <p className="pa-nota">Relatório preparado por PONTE Estruturação de Projetos de Impacto.</p>
    </Secao>
  );
}

/**
 * "Relatório e dados" (B11; curta desde a C1b, 08/10/2026): como a do município, leva ao relatório para imprimir, que
 * tem rota própria, e ao CSV, e diz as fontes. Antes ela repetia a página inteira (B0, 4.4).
 */
function Relatorio({ l, ano }: { l: LeituraBrasilOk; ano: number }) {
  return (
    <>
      <Secao id="br-relatorio" titulo="O relatório completo" nota="Todas as abas numa peça só, com a fonte de cada número, para imprimir ou anexar.">
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <LinkMapa href={URL_RELATORIO_BRASIL} className="pa-btn">
            Abrir o relatório para imprimir
          </LinkMapa>
          <a href={URL_CSV_BRASIL} className="pa-btn pa-btn-pequeno">
            Baixar as 27 UFs (CSV)
          </a>
        </p>
      </Secao>
      <FontesDoBrasil l={l} ano={ano} />
    </>
  );
}

export function BrasilConteudo({ l, aba, nivel }: { l: LeituraBrasilOk; aba: AbaBrasil; nivel: NivelAcesso }) {
  const ano = anoDeReferencia(l.execucao);
  const nomeAba = ABAS_BRASIL.find((a) => a.id === aba)?.nome ?? "";
  return (
    <div className="pa-pagina mp-radar mp-laudo mp-rel mp-mun">
      <Cabeca l={l} />
      <Abas aba={aba} nivel={nivel} />
      <p className="mp-so-imprimir pa-kicker">{nomeAba}</p>
      {aba === "resumo" && <Resumo l={l} ano={ano} />}
      {aba === "estados" && <Estados l={l} ano={ano} />}
      {aba === "dinheiro" && <DinheiroDoBrasil l={l} nivel={nivel} />}
      {aba === "tempos" && <Tempos l={l} />}
      {aba === "relatorio" && <Relatorio l={l} ano={ano} />}
    </div>
  );
}
