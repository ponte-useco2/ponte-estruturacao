/**
 * A exibição do painel de execução. Recebe os dados já lidos e só desenha — é o
 * que permite conferir a tela com dados reais sem o portão de administrador.
 *
 * Onda 15, fase 2, lote C (13/10/2026): as listas que chegam inteiras à página são a `TabelaFiltravel`, com filtro e
 * ordem em cada coluna (a regra do titular; tela de administrador, toda coluna ordena):
 *   · as mudanças por tipo (visão Mudanças);
 *   · por órgão concedente (as 6 visões de convênio), sem o corte nos 15 primeiros: são todos os órgãos lidos;
 *   · a matriz de tempos por órgão (visão Tempos), com as etapas como colunas de id estável (`idEtapa`);
 *   · os desfechos por órgão (visão Aprovação), também sem o corte nos 15.
 * O formulário do painel fica: ele vai ao banco (UF, município, órgão, período, movimentação), e a tabela filtra por cima
 * do que foi lido. As listas paginadas ou cortadas pelo banco (as 7 de convênio, os municípios com sinais, a matriz e os
 * desfechos por programa) ficam como estão: são da fase 3.
 */
import type { ReactNode } from "react";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { UFS } from "@/lib/oportunidades/organizacao";
import {
  CHAVE_TODOS,
  DESCRICAO_SINAL,
  ETAPAS_CAMINHO,
  ETAPAS_LICITACAO,
  ETAPAS_VEZ,
  EXIGENCIAS,
  FAIXAS_SALDO,
  FAIXAS_SUSPENSIVA,
  FAIXAS_VIGENCIA,
  GRUPOS_SUSPENSIVA,
  LADOS_CONTAS,
  MINIMO_MEDICOES,
  ROTULO_ETAPA,
  ROTULO_ETAPA_LICITACAO,
  ROTULO_EXIGENCIA,
  ROTULO_FAIXA_SALDO,
  ROTULO_FAIXA_SUSPENSIVA,
  ROTULO_FAIXA_VIGENCIA,
  ROTULO_GRUPO_SUSPENSIVA,
  ROTULO_LADO_CONTAS,
  ROTULO_SINAL,
  ROTULO_SINAL_CURTO,
  SINAIS,
  ANOS_MOTIVOS,
  MOTIVOS_ADITIVO,
  MOVIMENTOS,
  ROTULO_MOTIVO_ADITIVO,
  ROTULO_MOVIMENTO,
  VISOES,
  DIAS_MUDANCA,
  ROTULO_DIAS_MUDANCA,
  ROTULO_GRUPO_MUDANCA,
  aceitaMunicipio,
  definicaoMudanca,
  diaDoDado,
  ordenarContagens,
  somaPorGrupo,
  anosAssinatura,
  anosEnvio,
  somaMotivos,
  urlExportar,
  canceladas,
  definicao,
  diasPorExtenso,
  ehVisaoConvenio,
  etapasDe,
  fracao,
  idadePorExtenso,
  inicioJanela,
  matrizEtapas,
  medianaComparavel,
  percentual,
  periodoPorExtenso,
  resumoDe,
  semDesfecho,
  sinaisDe,
  urlFicha,
  urlPainel,
  type LinhaDesfecho,
  type LinhaEtapa,
  type ParametrosPainel,
  type Visao,
} from "@/lib/oportunidades/painel";
import type { LeituraPainel, LinhaOrgao, OpcaoMunicipio } from "@/lib/oportunidades/painel.server";
import {
  COLUNAS_MUNICIPIOS,
  OPCOES_MUDANCA,
  TABELA_DESFECHOS_PROGRAMAS,
  TABELA_PAINEL,
  TABELA_PAINEL_MUDANCAS,
  TABELA_PAINEL_MUNICIPIOS,
  TABELA_PAINEL_VENCIDOS,
  TABELA_TEMPOS_PROGRAMAS,
  colunasDosDesfechos,
  colunasDosTempos,
  idEtapa,
  valoresDoDesfecho,
  valoresDoMunicipioPainel,
  valoresDosTempos,
  opcoesFixas,
  urlCsvDaTabela,
  type VisaoConvenio,
} from "@/lib/oportunidades/painel-tabelas";
import { ESTADO_VAZIO, filtrosAtivos } from "@/lib/oportunidades/tabela-filtro";
import { TabelaDaVisao, TabelaDasMudancas } from "./TabelasConvenio";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { ColunaTabela, LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { Tag } from "../../_design/primitivos";
import { CopiarNumero } from "./CopiarNumero";
import {
  Cartao,
  Lista,
  Saidas,
  Urgente,
  n,
  type Saida,
} from "./Pecas";
import { LinkMapa } from "../_componentes/LinkMapa";
import { TabelaFiltravel } from "../_componentes/TabelaFiltravel";
import { TabelaRolagem } from "../_componentes/TabelaRolagem";
import { Termo } from "../_componentes/Termo";

type LeituraOk = Extract<LeituraPainel, { estado: "ok" }>;

/** O nome do município do filtro, de onde a leitura tiver; sem nome, o código IBGE. */
function nomeDoMunicipio(p: ParametrosPainel, leitura: LeituraOk): string | null {
  return p.municipio
    ? (leitura.opcoesMunicipio.find((m) => m.cod_ibge === p.municipio)?.municipio ??
        leitura.convenios.find((c) => c.cod_ibge === p.municipio)?.municipio ??
        leitura.mudancas.find((m) => m.cod_ibge === p.municipio)?.municipio ??
        `IBGE ${p.municipio}`)
    : null;
}

/**
 * O recorte da visão em palavras e as saídas que o ampliam, uma por filtro ligado (B14b, 08/10/2026). Antes o
 * vazio dizia "neste recorte" sem dizer qual nem como mudar (B12, seção 5). Só entram os filtros que a visão
 * usa: o órgão não vale em municípios e mudanças; o período e a movimentação, só nas visões de convênio.
 */
function recorteDoPainel(p: ParametrosPainel, leitura: LeituraOk): { texto: string; saidas: Saida[] } {
  const nome = nomeDoMunicipio(p, leitura);
  const partes = [nome ? `${nome}/${p.uf}` : (p.uf ?? "Brasil")];
  const saidas: Saida[] = [];
  if (nome) saidas.push({ rotulo: `Ver toda a UF (${p.uf})`, href: urlPainel(p, { municipio: null }) });
  else if (p.uf) saidas.push({ rotulo: "Ver o Brasil inteiro", href: urlPainel(p, { uf: null }) });
  if (p.orgao && p.visao !== "municipios" && p.visao !== "mudancas") {
    partes.push(p.orgao);
    saidas.push({ rotulo: "Tirar o filtro do órgão", href: urlPainel(p, { orgao: null }) });
  }
  if (ehVisaoConvenio(p.visao)) {
    const periodo = periodoPorExtenso(p.assinadoDe, p.assinadoAte);
    if (periodo) {
      partes.push(periodo);
      saidas.push({ rotulo: "Ver todos os anos de assinatura", href: urlPainel(p, { assinadoDe: null, assinadoAte: null }) });
    }
    if (p.movimento) {
      partes.push(ROTULO_MOVIMENTO[p.movimento]);
      saidas.push({ rotulo: "Tirar o filtro de movimentação", href: urlPainel(p, { movimento: null }) });
    }
  }
  if (p.visao === "mudancas") {
    partes.push(ROTULO_DIAS_MUDANCA[p.dias].toLowerCase());
    if (p.tipo) {
      partes.push(definicaoMudanca(p.tipo).rotulo);
      saidas.push({ rotulo: "Ver todos os tipos de mudança", href: urlPainel(p, { tipo: null }) });
    }
    if (p.dias < 30) saidas.push({ rotulo: "Ver os últimos 30 dias", href: urlPainel(p, { dias: 30 }) });
  }
  if (p.visao === "tempos" && p.ano !== null) {
    partes.push(`etapas terminadas em ${p.ano}`);
    saidas.push({ rotulo: "Ver os últimos 36 meses", href: urlPainel(p, { ano: null }) });
  }
  return { texto: partes.join(" · "), saidas };
}

/**
 * O vazio de uma lista do painel: o que não há, o recorte em negrito e as saídas (B14b). `semSaidas` para a
 * segunda lista vazia da mesma visão, que repetiria os mesmos links logo abaixo da primeira.
 */
function VazioPainel({
  p,
  leitura,
  oQue,
  extras = [],
  semSaidas = false,
}: {
  p: ParametrosPainel;
  leitura: LeituraOk;
  oQue: string;
  extras?: Saida[];
  semSaidas?: boolean;
}) {
  const r = recorteDoPainel(p, leitura);
  return (
    <>
      {oQue} neste recorte: <strong>{r.texto}</strong>.{!semSaidas && <Saidas saidas={[...extras, ...r.saidas]} />}
    </>
  );
}

export function PainelConteudo({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const { execucao } = leitura;
  const def = definicao(p.visao);
  const nomeMunicipio = nomeDoMunicipio(p, leitura);
  const onde = nomeMunicipio ? `${nomeMunicipio}/${p.uf}` : (p.uf ?? "Brasil");
  const periodo = ehVisaoConvenio(p.visao) ? periodoPorExtenso(p.assinadoDe, p.assinadoAte) : "";

  const r = (v: Visao) => resumoDe(leitura.resumo, v);
  const contas = r("contas");
  // Tempos e aprovação não são contagem de convênios: o chip vai sem número.
  const contadores: Partial<Record<Visao, number>> = {
    suspensiva: r("suspensiva")("total").n,
    nunca: r("nunca")("total").n,
    vigencia: r("vigencia")("total").n,
    contas: contas("convenente").n + contas("concedente").n + contas("negativo").n,
    saldo: r("saldo")("parado").n,
    fisico: r("fisico")("total").n,
    municipios: leitura.resumo.filter((l) => l.visao === "municipios").reduce((s, l) => s + l.n, 0),
  };
  const orgaos =
    p.visao === "tempos"
      ? matrizEtapas(leitura.etapas, "orgao").map((o) => o.chave)
      : p.visao === "aprovacao"
        ? leitura.desfechos.filter((d) => d.cod_programa === null && d.orgao_sup !== null).map((d) => d.orgao_sup as string)
        : leitura.porOrgao.map((o) => o.orgao);

  return (
    <div className="pa-pagina mp-radar mp-painel">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel da PONTE · uso interno</p>
        <h1 className="pa-titulo">Onde o dinheiro trava · {onde}</h1>
        <p className="pa-sub">
          Dado até <strong>{formatarPublicacao(execucao.dado_ate)}</strong>: o arquivo do Transferegov traz a situação de{" "}
          {formatarData(execucao.referencia)}. Prazos e idades contados até hoje, {formatarData(diaBrasilia(new Date().toISOString()))}; a
          seleção de cada lista segue o dia do arquivo.
        </p>
      </div>

      <nav aria-label="Visões do painel" className="pa-chips mp-painel-visoes">
        {VISOES.map((v) => (
          <LinkMapa
            key={v.id}
            href={urlPainel(p, { visao: v.id })}
            className={`pa-chip${p.visao === v.id ? " pa-ativo" : ""}`}
            aria-current={p.visao === v.id ? "page" : undefined}
          >
            {v.rotulo}
            {contadores[v.id] !== undefined && <span className="pa-chip-contagem">{n(contadores[v.id] ?? 0)}</span>}
          </LinkMapa>
        ))}
        {/* Outra fonte e outro retrato (semanal): página própria, com a UF levada junto. */}
        <LinkMapa href={p.uf ? `/mapa/painel/pix?uf=${p.uf}` : "/mapa/painel/pix"} className="pa-chip">
          Pix e fundo a fundo →
        </LinkMapa>
        <LinkMapa href="/mapa/fiscal" className="pa-chip">
          Capacidade fiscal (PB) →
        </LinkMapa>
        <LinkMapa href="/mapa/painel/tce" className="pa-chip">
          Dinheiro federal no TCE-PB →
        </LinkMapa>
        <LinkMapa href="/mapa/painel/contas" className="pa-chip">
          Contas e obras (PB) →
        </LinkMapa>
        {/* Onda 9, C (09/10/2026): a saúde das rodadas dos jobs, que o supervisor conferia à mão pelo MCP e pelo `gh`. */}
        <LinkMapa href="/mapa/painel/rodadas" className="pa-chip">
          Saúde das rodadas →
        </LinkMapa>
      </nav>

      <Filtros p={p} orgaos={orgaos} municipios={leitura.opcoesMunicipio} referencia={execucao.referencia} />

      <section aria-labelledby="painel-visao" className="mp-radar-secao">
        <h2 id="painel-visao" className="mp-radar-h2">
          {def.titulo} · {onde}
          {p.orgao ? ` · ${p.orgao}` : ""}
          {periodo ? ` · ${periodo}` : ""}
          {p.movimento && ehVisaoConvenio(p.visao) ? ` · ${ROTULO_MOVIMENTO[p.movimento]}` : ""}
          {p.visao === "mudancas" ? ` · ${ROTULO_DIAS_MUDANCA[p.dias].toLowerCase()}` : ""}
          {p.visao === "mudancas" && p.tipo ? ` · ${definicaoMudanca(p.tipo).rotulo}` : ""}
        </h2>
        <p className="pa-sub">{def.pergunta}</p>
        {p.municipio && (
          <p className="mp-painel-ficha-link">
            <LinkMapa
              href={urlFicha({ ibge: p.municipio, assinadoDe: p.assinadoDe, assinadoAte: p.assinadoAte })}
              className="pa-btn pa-btn-pequeno"
            >
              Abrir a ficha de {nomeMunicipio}
            </LinkMapa>
          </p>
        )}

        {p.visao === "mudancas" && <Mudancas p={p} leitura={leitura} />}
        {p.visao === "suspensiva" && <Suspensiva p={p} leitura={leitura} />}
        {p.visao === "nunca" && <NuncaDesembolsado p={p} leitura={leitura} />}
        {p.visao === "vigencia" && <Vigencia p={p} leitura={leitura} />}
        {p.visao === "contas" && <Contas p={p} leitura={leitura} />}
        {p.visao === "saldo" && <Saldo p={p} leitura={leitura} />}
        {p.visao === "fisico" && <Fisico p={p} leitura={leitura} />}
        {p.visao === "municipios" && <Municipios p={p} leitura={leitura} />}
        {p.visao === "tempos" && <Tempos p={p} leitura={leitura} />}
        {p.visao === "aprovacao" && <Aprovacao p={p} leitura={leitura} />}
      </section>
    </div>
  );
}

// ============================================================================ visões

function Mudancas({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const c = leitura.execucao.contagens;
  const contagens = ordenarContagens(leitura.contagensMudanca);
  const grupos = somaPorGrupo(contagens);
  // Instantes em ISO com fusos diferentes não se comparam como texto: compara o tempo.
  const extremo = (campo: "desde" | "ate", menor: boolean) =>
    contagens.reduce<string | null>((m, l) => {
      const v = l[campo];
      if (!v) return m;
      return !m || (menor ? Date.parse(v) < Date.parse(m) : Date.parse(v) > Date.parse(m)) ? v : m;
    }, null);
  const desde = extremo("desde", true);
  const ate = extremo("ate", false) ?? leitura.execucao.dado_ate;
  const total = contagens.reduce((s, l) => s + l.n, 0);

  return (
    <>
      <nav aria-label="Período das mudanças" className="pa-chips mp-painel-lados">
        {DIAS_MUDANCA.map((d) => (
          <LinkMapa
            key={d}
            href={urlPainel(p, { dias: d })}
            className={`pa-chip${p.dias === d ? " pa-ativo" : ""}`}
            aria-current={p.dias === d ? "true" : undefined}
          >
            {ROTULO_DIAS_MUDANCA[d]}
          </LinkMapa>
        ))}
      </nav>

      {c.mudancas_acima_do_teto === true && (
        <p className="pa-cartao pa-cartao-plano">
          A última atualização diária encontrou {n(Number(c.mudancas_total ?? 0))} mudanças, acima do teto de gravação. Isso costuma
          ser troca de regra ou arquivo com defeito: as contagens ficaram registradas, as linhas não.
        </p>
      )}
      {(c.mudancas_desde ?? null) === null && total === 0 && (
        <p className="pa-cartao pa-cartao-plano">
          As mudanças começam a aparecer depois da próxima atualização diária: a comparação precisa dos dados do dia anterior gravados.
        </p>
      )}

      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <Cartao rotulo={ROTULO_GRUPO_MUDANCA.avanco} quantidade={grupos.avanco} nota="O que destravou: suspensiva, dinheiro, assinatura." />
        <Cartao rotulo={ROTULO_GRUPO_MUDANCA.alerta} quantidade={grupos.alerta} tom="urgente" nota="O que pede ação: prazo vencido, contas, parado." />
        <Cartao rotulo={ROTULO_GRUPO_MUDANCA.registro} quantidade={grupos.registro} nota="Contexto: propostas enviadas, entradas e saídas." />
      </div>
      {total > 0 && (
        <p className="pa-nota">
          {desde ? `Comparação do dado de ${diaDoDado(desde)} ` : "Comparação "}com o de {diaDoDado(ate)}.
          Só passagens de limite contam: a troca de faixa que o calendário faz sozinha não é mudança.
        </p>
      )}

      {contagens.length > 0 && (
        <div className="mp-radar-recorte">
          <h3 className="mp-radar-h3">Por tipo</h3>
          <TabelaFiltravel
            id="mudancas-tipos"
            rotulo="Mudanças por tipo"
            colunas={COLUNAS_MUDANCAS}
            linhas={contagens.map((l) => linhaMudanca(p, l))}
            descricaoOrdemPadrao="os tipos na ordem de sempre: avanços, alertas e registro"
            csv={{ nome: "painel-mudancas-por-tipo" }}
          />
          {p.tipo && (
            <p className="pa-nota">
              <LinkMapa href={urlPainel(p, { tipo: null })}>Ver todos os tipos</LinkMapa>
            </p>
          )}
        </div>
      )}

      {/* F3.5a (28/10/2026): o filtro e a ordem de cada coluna vão ao banco; a lista mostra as 100 primeiras e o total. */}
      <Lista
        titulo="Uma a uma"
        vazio={<VazioPainel p={p} leitura={leitura} oQue="Nenhuma mudança" />}
        semRolagem
      >
        {(leitura.mudancas.length > 0 || filtrosAtivos(leitura.estados.lista ?? ESTADO_VAZIO) > 0) && (
          <TabelaDasMudancas
            id={TABELA_PAINEL_MUDANCAS}
            rotulo="Mudanças, uma a uma"
            linhas={leitura.mudancas}
            comData={p.dias > 1}
            servidor={{
              total: leitura.totalMudancas,
              opcoes: OPCOES_MUDANCA,
              csvHref: urlCsvDaTabela(urlExportar(p), TABELA_PAINEL_MUDANCAS, leitura.estados.lista ?? ESTADO_VAZIO),
            }}
          />
        )}
      </Lista>
      <p className="pa-nota">
        Valor é o repasse do convênio ou da proposta; no primeiro desembolso, o desembolsado; no saldo, o saldo em conta; na
        vigência, o que falta desembolsar. Proposta enviada é a que entrou no painel com envio de até 7 dias antes do dado
        anterior. As mudanças ficam guardadas por 60 dias.
      </p>
    </>
  );
}

function Suspensiva({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const r = resumoDe(leitura.resumo, "suspensiva");
  const total = r("total");
  const urgente = { n: r("vencido").n + r("ate_30").n, valor: (r("vencido").valor ?? 0) + (r("ate_30").valor ?? 0) };
  const meio = { n: r("31_90").n + r("91_180").n, valor: (r("31_90").valor ?? 0) + (r("91_180").valor ?? 0) };

  return (
    <>
      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <Cartao rotulo="Pendentes" quantidade={total.n} valor={total.valor} legenda="de repasse" />
        <Cartao rotulo="Vencido ou vence em 30 dias" quantidade={urgente.n} valor={urgente.valor} tom="urgente" />
        <Cartao rotulo="Vence em 31 a 180 dias" quantidade={meio.n} valor={meio.valor} />
      </div>

      <div className="pa-grade pa-grade-2 mp-painel-duas">
        <TabelaContagem
          titulo="Pelo prazo da cláusula"
          colunaValor="Repasse"
          linhas={FAIXAS_SUSPENSIVA.map((f) => ({ rotulo: ROTULO_FAIXA_SUSPENSIVA[f], ...r(f) }))}
        />
        <TabelaContagem
          titulo="Exigências citadas no motivo"
          colunaValor="Repasse"
          total={total.n}
          linhas={EXIGENCIAS.map((e) => ({ rotulo: ROTULO_EXIGENCIA[e], ...r(`exige_${e}`) }))}
        />
      </div>
      <p className="pa-nota">
        O SICONV registra um prazo por convênio para a <Termo slug="condicao-suspensiva">cláusula</Termo> inteira, e não um por
        exigência. As exigências são lidas do texto do motivo, que costuma ser uma lista-padrão — mostram o que foi pedido, não
        necessariamente o que ainda falta entregar.
      </p>

      <PorOrgao p={p} linhas={leitura.porOrgao} colunaValor="Repasse" colunaDestaque="Vence em até 90 dias" />

      <ListaDaVisao
        p={p}
        leitura={leitura}
        visao="suspensiva"
        titulo="Os próximos a vencer"
        ordem="pelo prazo, do mais próximo"
        vazio={<VazioPainel p={p} leitura={leitura} oQue="Nenhuma cláusula suspensiva a vencer" />}
      />
      {/* B14b (08/10/2026): antes, com `vazio=""`, a lista vazia sumia sem dizer nada. Agora fica e diz o recorte;
          as saídas só aparecem se a lista de cima não as tiver dado. */}
      <Lista
        semRolagem
        titulo="Já vencidos, dos mais recentes aos mais antigos"
        vazio={
          <VazioPainel p={p} leitura={leitura} oQue="Nenhuma cláusula suspensiva já vencida" semSaidas={leitura.convenios.length === 0} />
        }
      >
        {(leitura.vencidos.length > 0 || filtrosAtivos(leitura.estados.vencidos ?? ESTADO_VAZIO) > 0) && (
          <TabelaDaVisao
            id={TABELA_PAINEL_VENCIDOS}
            rotulo="Cláusulas suspensivas já vencidas"
            visao="suspensiva"
            linhas={leitura.vencidos}
            descricaoOrdemPadrao="pelo prazo, do mais recente ao mais antigo"
            servidor={{
              total: leitura.totalVencidos,
              opcoes: opcoesDoOrgao(leitura.porOrgao),
              csvHref: urlCsvDaTabela(urlExportar(p), TABELA_PAINEL_VENCIDOS, leitura.estados.vencidos ?? ESTADO_VAZIO),
            }}
          />
        )}
      </Lista>
    </>
  );
}

function NuncaDesembolsado({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const r = resumoDe(leitura.resumo, "nunca");
  const total = r("total");
  const parado = r("aceite_parado");

  return (
    <>
      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <Cartao rotulo="Nunca receberam" quantidade={total.n} valor={total.valor} legenda="de repasse" />
        <Cartao
          rotulo="Suspensiva já retirada"
          quantidade={r("grupo_retirada").n}
          valor={r("grupo_retirada").valor}
          nota="Cumpriram as condições e seguem sem dinheiro."
        />
        <Cartao
          rotulo="Licitação aceita há +90 dias"
          quantidade={parado.n}
          valor={parado.valor}
          tom="urgente"
          nota={
            <>
              <Tag tom="proto">hipótese</Tag> A vez é do concedente: o convenente fez a sua parte.
            </>
          }
        />
      </div>

      <div className="pa-grade pa-grade-2 mp-painel-duas">
        <TabelaContagem
          titulo="Situação da cláusula suspensiva"
          colunaValor="Repasse"
          linhas={GRUPOS_SUSPENSIVA.map((g) => ({ rotulo: ROTULO_GRUPO_SUSPENSIVA[g], ...r(`grupo_${g}`) }))}
        />
        <TabelaContagem
          titulo="Onde parou a licitação (obras e aquisições)"
          colunaValor="Repasse"
          linhas={ETAPAS_LICITACAO.map((e) => ({ rotulo: ROTULO_ETAPA_LICITACAO[e], ...r(`etapa_${e}`) }))}
        />
      </div>
      <p className="pa-nota">
        Nunca desembolsado: nenhum <Termo slug="desembolso">desembolso</Termo> registrado até a data do arquivo. A etapa é a mais avançada
        registrada: licitação homologada e aceita pelo concedente. Dispensa e cotação não contam como licitação. A plataforma
        não registra licitação deserta ou fracassada.
      </p>

      <PorOrgao p={p} linhas={leitura.porOrgao} colunaValor="Repasse" colunaDestaque="Aceite há +90 dias" />

      <ListaDaVisao
        p={p}
        leitura={leitura}
        visao="nunca"
        titulo="Aceitos há mais tempo, depois os assinados há mais tempo"
        ordem="aceite parado primeiro, depois pela data do aceite e da assinatura"
        vazio={<VazioPainel p={p} leitura={leitura} oQue="Nenhum convênio assinado sem desembolso" />}
      />
    </>
  );
}

function Vigencia({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const r = resumoDe(leitura.resumo, "vigencia");
  const total = r("total");
  const ate90 = { n: r("vencida").n + r("ate_90").n, valor: (r("vencida").valor ?? 0) + (r("ate_90").valor ?? 0) };

  return (
    <>
      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <Cartao rotulo="Em risco" quantidade={total.n} valor={total.valor} legenda="a desembolsar" />
        <Cartao rotulo="Termina em até 90 dias" quantidade={ate90.n} valor={ate90.valor} legenda="a desembolsar" tom="urgente" />
        <Cartao rotulo="Termina em 91 a 180 dias" quantidade={r("91_180").n} valor={r("91_180").valor} legenda="a desembolsar" />
      </div>
      <TabelaContagem
        titulo="Pelo fim da vigência"
        colunaValor="A desembolsar"
        linhas={FAIXAS_VIGENCIA.map((f) => ({ rotulo: ROTULO_FAIXA_VIGENCIA[f], ...r(f) }))}
      />
      <p className="pa-nota">
        Em execução, com menos da metade do repasse desembolsada. &ldquo;A desembolsar&rdquo; é o repasse que ainda não chegou à
        conta. Extensões somam os termos aditivos de <Termo slug="vigencia">vigência</Termo> e as prorrogações feitas pelo
        concedente.
      </p>

      <MotivosAditivos p={p} leitura={leitura} />

      <PorOrgao p={p} linhas={leitura.porOrgao} colunaValor="A desembolsar" colunaDestaque="Termina em até 90 dias" />

      <ListaDaVisao
        p={p}
        leitura={leitura}
        visao="vigencia"
        titulo="Os que terminam primeiro"
        ordem="pelo fim da vigência, do mais próximo"
        vazio={<VazioPainel p={p} leitura={leitura} oQue="Nenhum convênio com a vigência em risco" />}
      />
    </>
  );
}

/**
 * Por que se prorroga. Duas leituras: o motivo do último aditivo dos convênios em risco
 * da tela, e todos os aditivos de vigência do recorte nos últimos anos.
 */
function MotivosAditivos({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const r = resumoDe(leitura.resumo, "vigencia");
  const anoDado = Number(leitura.execucao.referencia.slice(0, 4));
  const anoMinimo = anoDado - (ANOS_MOTIVOS - 1);
  const todos = somaMotivos(leitura.aditivosMotivo, anoMinimo);
  const totalTodos = todos.reduce((s, m) => s + m.aditivos, 0);
  const emRisco = MOTIVOS_ADITIVO.map((m) => ({ motivo: m, ...r(`motivo_${m}`) }))
    .filter((m) => m.n > 0)
    .sort((a, b) => Number(a.motivo === "nao_classificado" || a.motivo === "sem_justificativa") - Number(b.motivo === "nao_classificado" || b.motivo === "sem_justificativa") || b.n - a.n);
  const totalRisco = emRisco.reduce((s, m) => s + m.n, 0);
  if (totalTodos === 0 && totalRisco === 0) return null;
  return (
    <div className="pa-grade pa-grade-2 mp-painel-duas">
      <div className="mp-radar-recorte">
        <h3 className="mp-radar-h3">Por que os convênios em risco se prorrogaram</h3>
        <p className="pa-nota">Motivo do aditivo de vigência mais recente de cada convênio da lista.</p>
        <TabelaRolagem rotulo="Por que os convênios em risco se prorrogaram">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Motivo</th>
                <th scope="col" className="mp-num">Convênios</th>
                <th scope="col" className="mp-num">Dos que têm aditivo</th>
              </tr>
            </thead>
            <tbody>
              {emRisco.slice(0, 8).map((m) => (
                <tr key={m.motivo}>
                  <th scope="row">{ROTULO_MOTIVO_ADITIVO[m.motivo] ?? m.motivo}</th>
                  <td className="mp-num">{n(m.n)}</td>
                  <td className="mp-num">{percentual(fracao(m.n, totalRisco))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
      </div>
      <div className="mp-radar-recorte">
        <h3 className="mp-radar-h3">
          Todos os aditivos de vigência · {p.uf ?? "Brasil"} · {anoMinimo} a {anoDado}
        </h3>
        <p className="pa-nota">Inclui convênios já concluídos: é o retrato de por que se pede mais prazo.</p>
        <TabelaRolagem rotulo={`Todos os aditivos de vigência · ${p.uf ?? "Brasil"} · ${anoMinimo} a ${anoDado}`}>
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Motivo</th>
                <th scope="col" className="mp-num">Aditivos</th>
                <th scope="col" className="mp-num">Do total</th>
              </tr>
            </thead>
            <tbody>
              {todos.slice(0, 8).map((m) => (
                <tr key={m.motivo}>
                  <th scope="row">{ROTULO_MOTIVO_ADITIVO[m.motivo] ?? m.motivo}</th>
                  <td className="mp-num">{n(m.aditivos)}</td>
                  <td className="mp-num">{percentual(fracao(m.aditivos, totalTodos))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
      </div>
      <p className="pa-nota mp-painel-nota-larga">
        <Tag tom="proto">classificação automática</Tag> O motivo é lido do texto da justificativa por expressões do estudo da PONTE; cada
        aditivo recebe a primeira categoria que casar. Cerca de um quarto dos textos não cai em nenhuma. O texto em si não é
        guardado.
      </p>
    </div>
  );
}

function Contas({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const r = resumoDe(leitura.resumo, "contas");
  const quantidade: Record<(typeof LADOS_CONTAS)[number], number> = {
    atrasada: r("atrasada").n,
    negativo: r("negativo").n,
    tce: r("tce").n,
    concedente: r("concedente").n,
  };

  return (
    <>
      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <Cartao
          rotulo="Atrasadas pelo convenente"
          quantidade={r("atrasada").n}
          valor={r("atrasada").valor}
          nota={<>Vez do convenente · {n(r("convenente_1ano").n)} há mais de um ano</>}
        />
        <Cartao rotulo="Rejeitadas e inadimplentes" quantidade={r("negativo").n} valor={r("negativo").valor} tom="urgente" />
        <Cartao rotulo="Em tomada de contas especial" quantidade={r("tce").n} valor={r("tce").valor} />
        <Cartao
          rotulo="Esperando análise do concedente"
          quantidade={r("concedente").n}
          valor={r("concedente").valor}
          nota={<>Vez do concedente · {n(r("concedente_1ano").n)} há mais de um ano</>}
        />
      </div>
      <p className="pa-nota">
        Valores de repasse. A <Termo slug="tomada-de-contas-especial">tomada de contas especial</Termo> é marca própria e se
        sobrepõe às situações. Inadimplente no SICONV não é o <Termo slug="cauc">CAUC</Termo>, que é o que de fato bloqueia — e o
        estudo da PONTE mostrou que municípios com inadimplência aberta seguem assinando convênios.
      </p>

      <PorOrgao p={p} linhas={leitura.porOrgao} colunaValor="Repasse" colunaDestaque="Parados há +1 ano" />

      <nav aria-label="Qual lista de prestação de contas" className="pa-chips mp-painel-lados">
        {LADOS_CONTAS.map((l) => (
          <LinkMapa
            key={l}
            href={urlPainel(p, { lado: l })}
            className={`pa-chip${p.lado === l ? " pa-ativo" : ""}`}
            aria-current={p.lado === l ? "true" : undefined}
          >
            {ROTULO_LADO_CONTAS[l]}
            <span className="pa-chip-contagem">{n(quantidade[l])}</span>
          </LinkMapa>
        ))}
      </nav>

      <ListaDaVisao
        p={p}
        leitura={leitura}
        visao="contas"
        titulo={
          {
            atrasada: "Atrasadas mais recentes — onde ainda dá para regularizar",
            negativo: "Rejeitadas e inadimplentes, pelo valor",
            tce: "Em tomada de contas especial, pelo valor",
            concedente: "Esperando análise há mais tempo",
          }[p.lado]
        }
        ordem={
          {
            atrasada: "pelos dias depois do prazo das contas, dos mais recentes",
            negativo: "pelo repasse, do maior",
            tce: "pelo repasse, do maior",
            concedente: "pelos dias com o concedente, do maior",
          }[p.lado]
        }
        vazio={<VazioPainel p={p} leitura={leitura} oQue={`Nenhum convênio na lista “${ROTULO_LADO_CONTAS[p.lado]}”`} />}
      />
    </>
  );
}

function Saldo({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const r = resumoDe(leitura.resumo, "saldo");
  const parado = r("parado");

  return (
    <>
      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <Cartao rotulo="Contas paradas há +1 ano" quantidade={parado.n} valor={parado.valor} legenda="de saldo" tom="urgente" />
        <Cartao
          rotulo="Rendimento nessas contas"
          quantidade={parado.n}
          valor={r("rendimento_parado").valor}
          legenda="implícito"
          nota="O sistema quase não registra rendimento; ele aparece no saldo."
        />
        <Cartao
          rotulo="Paradas sem nunca ter pago"
          quantidade={r("parado_nunca_pagou").n}
          valor={r("parado_nunca_pagou").valor}
          legenda="de saldo"
        />
      </div>
      <TabelaContagem
        titulo="Todas as contas com saldo, pela idade do último movimento"
        colunaValor="Saldo"
        linhas={FAIXAS_SALDO.map((f) => ({ rotulo: ROTULO_FAIXA_SALDO[f], ...r(f) }))}
      />
      <p className="pa-nota">
        Em execução ou aguardando a prestação de contas. A idade conta desde o último pagamento, ou desde o primeiro
        desembolso para quem nunca pagou. O saldo em conta é o saldo bancário e já inclui o rendimento; o rendimento
        implícito é o saldo menos o que entrou (desembolso e contrapartida) mais o que saiu (pagamentos e tributos).
      </p>

      <PorOrgao p={p} linhas={leitura.porOrgao} colunaValor="Saldo parado" colunaDestaque="Nunca pagaram" />

      <ListaDaVisao
        p={p}
        leitura={leitura}
        visao="saldo"
        titulo="Os maiores saldos parados"
        ordem="pelo saldo, do maior"
        vazio={<VazioPainel p={p} leitura={leitura} oQue="Nenhuma conta parada há mais de um ano" />}
      />
    </>
  );
}

function Fisico({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const r = resumoDe(leitura.resumo, "fisico");
  const total = r("total");
  const c = leitura.execucao.contagens;
  const emExecucao = Number(c.em_execucao ?? 0);
  const comFisico = Number(c.em_execucao_com_fisico ?? 0);

  return (
    <>
      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <Cartao
          rotulo="Desembolso alto, físico baixo"
          quantidade={total.n}
          valor={total.valor}
          legenda="desembolsados"
          tom="urgente"
        />
        <Cartao
          rotulo="Com físico zerado"
          quantidade={r("fisico_zero").n}
          valor={r("fisico_zero").valor}
          legenda="desembolsados"
          nota="Zero pode ser obra parada ou percentual nunca informado."
        />
        <Cartao
          rotulo="Sem movimentação há +1 ano"
          quantidade={r("parado_1ano").n}
          valor={r("parado_1ano").valor}
          legenda="desembolsados"
        />
      </div>
      <p className="pa-nota">
        <strong>Cobertura:</strong> só {percentual(fracao(comFisico, emExecucao))} dos convênios em execução no Brasil têm físico
        aferido ({n(comFisico)} de {n(emExecucao)}) — a maioria dos contratos de repasse, poucos convênios e nenhum termo de
        fomento. Fora dessa amostra, o painel não sabe como está a obra. Desembolsado é o que chegou à conta; físico é o
        percentual do resumo físico-financeiro do Transferegov.
      </p>

      <PorOrgao p={p} linhas={leitura.porOrgao} colunaValor="Desembolsado" colunaDestaque="Parados há +1 ano" />

      <ListaDaVisao
        p={p}
        leitura={leitura}
        visao="fisico"
        titulo="Os maiores valores desembolsados"
        ordem="pelo valor desembolsado, do maior"
        vazio={<VazioPainel p={p} leitura={leitura} oQue="Nenhum convênio com desembolso alto e físico baixo" />}
      />
    </>
  );
}

function Municipios({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const porSinais = new Map(leitura.resumo.filter((l) => l.visao === "municipios").map((l) => [Number(l.chave), l.n]));
  const com = (k: number) => porSinais.get(k) ?? 0;

  return (
    <>
      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <Cartao rotulo="Com 4 ou 5 sinais" quantidade={com(5) + com(4)} tom="urgente" />
        <Cartao rotulo="Com 3 sinais" quantidade={com(3)} />
        <Cartao rotulo="Com 1 ou 2 sinais" quantidade={com(2) + com(1)} />
      </div>
      <dl className="mp-painel-legenda">
        {SINAIS.map((s) => (
          <div key={s}>
            <dt>{ROTULO_SINAL[s]}</dt>
            <dd>{DESCRICAO_SINAL[s]}</dd>
          </div>
        ))}
      </dl>
      <p className="pa-nota">
        Só prefeituras. Cada sinal conta uma vez, sem peso: um índice ponderado mudava a lista inteira com pequenas
        mudanças de peso. A ordem é pelo número de sinais e, no empate, pelo saldo parado. Cidades grandes, com mais
        convênios, tendem a acender mais sinais — o filtro por UF ajuda a comparar vizinhos.
      </p>

      <Lista titulo="Os com mais sinais" vazio={<VazioPainel p={p} leitura={leitura} oQue="Nenhum município com sinal aceso" />} semRolagem>
        {(leitura.municipios.length > 0 || filtrosAtivos(leitura.estados.lista ?? ESTADO_VAZIO) > 0) && (
          <TabelaFiltravel
            id={TABELA_PAINEL_MUNICIPIOS}
            rotulo="Municípios com sinais"
            colunas={COLUNAS_MUNICIPIOS}
            linhas={leitura.municipios.map(
              (m): LinhaTabela => ({
                chave: m.cod_ibge,
                valores: valoresDoMunicipioPainel(m),
                celulas: {
                  municipio: (
                    <>
                      <span className="mp-tabela-principal">
                        <LinkMapa href={urlFicha({ ibge: m.cod_ibge })}>
                          {m.municipio ?? "—"}/{m.uf ?? "—"}
                        </LinkMapa>
                      </span>
                      <span className="mp-tabela-secundario">IBGE {m.cod_ibge}</span>
                    </>
                  ),
                  sinais: (
                    <span className="mp-painel-tags">
                      <strong className="mp-painel-contagem-sinais">{m.n_sinais}</strong>
                      {sinaisDe(m).map((s) => (
                        <Tag key={s}>{ROTULO_SINAL_CURTO[s]}</Tag>
                      ))}
                    </span>
                  ),
                  saldo: m.n_saldo ? moedaCurta(m.valor_saldo) : "—",
                  "sem-desembolso": m.n_sem_desembolso ? `${m.n_sem_desembolso} · ${moedaCurta(m.valor_sem_desembolso)}` : "—",
                },
              }),
            )}
            descricaoOrdemPadrao="pelo número de sinais e, no empate, pelo saldo parado"
            servidor={{
              total: leitura.totalMunicipios,
              opcoes: { uf: UFS.map((u) => ({ valor: u, linhas: null })) },
              csvHref: urlCsvDaTabela(urlExportar(p), TABELA_PAINEL_MUNICIPIOS, leitura.estados.lista ?? ESTADO_VAZIO),
            }}
          />
        )}
      </Lista>
    </>
  );
}

function Tempos({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const onde = p.uf ?? "Brasil";
  const todos = etapasDe(leitura.etapas, CHAVE_TODOS);
  const foco = p.orgao ? etapasDe(leitura.etapas, p.orgao) : todos;
  const linhas = matrizEtapas(leitura.etapas, p.dimensao);
  const porAno = p.ano !== null;
  // "De quem é a vez" só existe na janela; por ano, a matriz fica nas cinco etapas.
  const colunas = porAno ? [...ETAPAS_CAMINHO] : [...ETAPAS_CAMINHO, "vez_concedente"];
  const porPrograma = p.dimensao === "programa";
  const anoDado = Number(leitura.execucao.referencia.slice(0, 4));

  return (
    <>
      <nav aria-label="Período das etapas" className="pa-chips mp-painel-lados mp-painel-anos">
        {[null, ...anosEnvio(leitura.execucao.referencia)].map((a) => (
          <LinkMapa
            key={a ?? "janela"}
            href={urlPainel(p, { ano: a })}
            className={`pa-chip${p.ano === a ? " pa-ativo" : ""}`}
            aria-current={p.ano === a ? "true" : undefined}
          >
            {a === null ? "Últimos 36 meses" : `${a}${a === anoDado ? " · parcial" : ""}`}
          </LinkMapa>
        ))}
      </nav>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        {ETAPAS_CAMINHO.map((e) => (
          <CartaoTempo key={e} rotulo={ROTULO_ETAPA[e]} linha={foco[e]} />
        ))}
      </div>
      {porAno ? (
        <p className="pa-nota">
          Mediana das etapas que <strong>terminaram em {p.ano}</strong>, qualquer que seja o ano em que começaram: metade levou
          menos que isso. Compare anos para ver se um órgão ficou mais rápido. Os primeiros anos da série somam etapas
          iniciadas antes deles e tendem a sair mais longos; o ano corrente ainda está em andamento.
        </p>
      ) : (
        <p className="pa-nota">
          <Termo slug="mediana">Mediana</Termo> das etapas que terminaram desde {formatarData(inicioJanela(leitura.execucao.referencia))},
          nos últimos 36 meses: metade levou menos que isso. Aprovação é o plano de trabalho aprovado; assinatura, a data formal
          do convênio; conclusão, a prestação de contas aprovada. &ldquo;Ainda nesta etapa&rdquo; conta, nas etapas de proposta,
          só as enviadas nos mesmos 36 meses; nas de convênio, os que estão nela hoje.
        </p>
      )}

      {porAno ? null : <div className="mp-radar-recorte">
        <h3 className="mp-radar-h3">De quem é a vez, do envio à assinatura</h3>
        <TabelaRolagem rotulo="De quem é a vez, do envio à assinatura">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Com quem estava</th>
                <th scope="col" className="mp-num">Mediana</th>
                <th scope="col" className="mp-num">
                  <Termo slug="p90">9 em cada 10 em até</Termo>
                </th>
                <th scope="col" className="mp-num">Assinadas medidas</th>
              </tr>
            </thead>
            <tbody>
              {["envio_assinatura", ...ETAPAS_VEZ].map((e) => {
                const l = foco[e];
                const m = medianaComparavel(l);
                return (
                  <tr key={e}>
                    <th scope="row">{e === "envio_assinatura" ? <strong>Tempo total</strong> : ROTULO_ETAPA[e]}</th>
                    <td className="mp-num">{diasPorExtenso(m)}</td>
                    <td className="mp-num">{m === null ? "—" : diasPorExtenso(l?.p90)}</td>
                    <td className="mp-num">{n(l?.n ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TabelaRolagem>
        <p className="pa-nota">
          Nas propostas assinadas nos últimos 36 meses, o tempo somado em análise do concedente, em complementação pelo
          proponente e aprovada esperando a assinatura. As medianas não se somam: cada uma é o meio da sua própria distribuição.
        </p>
      </div>}

      <nav aria-label="Comparar por" className="pa-chips mp-painel-lados">
        {(["orgao", "programa"] as const).map((d) => (
          <LinkMapa
            key={d}
            href={urlPainel(p, { dimensao: d })}
            className={`pa-chip${p.dimensao === d ? " pa-ativo" : ""}`}
            aria-current={p.dimensao === d ? "true" : undefined}
          >
            {d === "orgao" ? "Por ministério" : "Por programa"}
          </LinkMapa>
        ))}
      </nav>

      <Lista
        semRolagem
        titulo={
          porPrograma
            ? linhas.length > 0
              ? `Mediana em dias, nos ${n(linhas.length)} programas${p.orgao ? " do órgão" : ""}${porAno ? ` com etapas terminadas em ${p.ano}` : ""}`
              : "Mediana em dias, por programa"
            : `Mediana em dias, por órgão concedente${porAno ? ` · etapas terminadas em ${p.ano}` : ""}`
        }
        vazio={
          porAno && porPrograma && p.uf ? (
            <>
              Por ano, os programas só são medidos no Brasil inteiro: por UF a amostra de cada um é pequena demais.
              <Saidas
                saidas={[
                  { rotulo: "Ver o Brasil inteiro", href: urlPainel(p, { uf: null }) },
                  { rotulo: `Ver os últimos 36 meses em ${p.uf}`, href: urlPainel(p, { ano: null }) },
                ]}
              />
            </>
          ) : (
            <VazioPainel p={p} leitura={leitura} oQue={`Nenhum ${porPrograma ? "programa" : "órgão"} com medição`} />
          )
        }
      >
        {/* Uma expressão só: com a lista vazia, a `Lista` precisa receber `false` para mostrar o vazio. As duas tabelas são
            filtráveis; a por programa (F3.4, 22/10/2026) traz todos os programas do recorte, não mais só os 40 maiores.
            A classe de antes, num invólucro: o cabeçalho que quebra linha de `mp-painel-matriz` (mapa.css) vale dentro. */}
        {linhas.length > 0 && (
          <div className="mp-painel-matriz">
            <TabelaFiltravel
              id={porPrograma ? TABELA_TEMPOS_PROGRAMAS : "tempos"}
              rotulo={porPrograma ? "Mediana em dias, por programa" : "Mediana em dias, por órgão concedente"}
              colunas={colunasDosTempos(colunas, porAno ? p.ano : null, p.dimensao, !p.orgao)}
              linhas={linhas.map((l) => linhaMatriz(p, l, colunas, todos, porAno))}
              ordemPadrao={{ coluna: "assinadas", sentido: "desc" }}
              csv={{
                nome: `painel-tempos-por-${porPrograma ? "programa" : "orgao"}${p.uf ? `-${p.uf.toLowerCase()}` : ""}${porAno ? `-${p.ano}` : ""}`,
              }}
            />
          </div>
        )}
      </Lista>
      <p className="pa-nota">
        Com &ldquo;▲ lento&rdquo;, a mediana 1,5 vez ou mais a de {p.uf ? `todos os órgãos em ${onde}` : "todos os órgãos do Brasil"}.
        &ldquo;—&rdquo; quando há menos de {MINIMO_MEDICOES} medições.{" "}
        {porPrograma ? "O código é o que se digita na consulta de programas do Transferegov." : "O nome do órgão abre os programas dele."}
      </p>
    </>
  );
}

function CartaoTempo({ rotulo, linha }: { rotulo: string; linha: LinhaEtapa | undefined }) {
  const mediana = medianaComparavel(linha);
  return (
    <article className="pa-cartao mp-painel-cartao">
      <h3 className="pa-mono">{rotulo}</h3>
      <p className="pa-numero">{diasPorExtenso(mediana)}</p>
      <p className="mp-painel-valor">
        {mediana === null ? `menos de ${MINIMO_MEDICOES} medições` : `9 em cada 10 em até ${diasPorExtenso(linha?.p90)}`}
      </p>
      {linha && linha.em_aberto > 0 && (
        <p className="pa-nota">
          {n(linha.em_aberto)} ainda nesta etapa · metade há mais de{" "}
          {idadePorExtenso(Math.round(linha.idade_mediana_aberto ?? 0))}
        </p>
      )}
    </article>
  );
}

function Aprovacao({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const ano = leitura.ano ?? 0;
  const anoDado = Number(leitura.execucao.referencia.slice(0, 4));
  const total = leitura.desfechos.find((d) => d.cod_programa === null && d.orgao_sup === null);
  const orgaos = leitura.desfechos.filter((d) => d.cod_programa === null && d.orgao_sup !== null);
  const programas = leitura.desfechos.filter((d) => d.cod_programa !== null);
  const historico = Number(leitura.execucao.contagens.propostas_impedimento_historico ?? 0);
  // B14b: no vazio, a saída para o ano anterior ao escolhido (ou o mais próximo que houver).
  const anos = anosEnvio(leitura.execucao.referencia);
  const outroAno = anos.find((a) => a < ano) ?? anos.find((a) => a !== ano);
  const outroAnoSaida = outroAno ? [{ rotulo: `Ver as enviadas em ${outroAno}`, href: urlPainel(p, { ano: outroAno }) }] : [];

  return (
    <>
      <nav aria-label="Ano do primeiro envio" className="pa-chips mp-painel-lados mp-painel-anos">
        {anosEnvio(leitura.execucao.referencia).map((a) => (
          <LinkMapa
            key={a}
            href={urlPainel(p, { ano: a })}
            className={`pa-chip${a === ano ? " pa-ativo" : ""}`}
            aria-current={a === ano ? "true" : undefined}
          >
            {a}
            {a === anoDado ? " · parcial" : ""}
          </LinkMapa>
        ))}
      </nav>

      {!total ? (
        <p className="pa-cartao pa-cartao-plano">
          <VazioPainel p={p} leitura={leitura} oQue={`Nenhuma proposta enviada em ${ano}`} extras={outroAnoSaida} />
        </p>
      ) : (
        <>
          <div className="pa-grade pa-grade-4 mp-painel-cartoes">
            <Cartao rotulo={`Enviadas em ${ano}`} quantidade={total.enviadas} valor={total.valor_pedido} legenda="pedidos" />
            <Cartao
              rotulo="Assinadas"
              quantidade={total.assinadas}
              nota={`${percentual(fracao(total.assinadas, total.enviadas))} das enviadas`}
            />
            <Cartao
              rotulo="Reprovadas"
              quantidade={total.reprovadas}
              tom="urgente"
              nota={`${percentual(fracao(total.reprovadas, total.enviadas))} das enviadas · ${n(total.reprovadas_lote)} em lote`}
            />
            <Cartao
              rotulo="Impedimento técnico"
              quantidade={total.impedimento}
              tom="urgente"
              nota={`${percentual(fracao(total.impedimento, total.enviadas))} das enviadas · ${n(total.impedimento_lote)} em lote`}
            />
          </div>
          {ano >= anoDado - 1 && semDesfecho(total) > 0 && (
            <p className="pa-nota">
              <strong>Ano ainda aberto:</strong> {n(semDesfecho(total))} propostas de {ano} seguem sem desfecho. As taxas
              deste ano mudam até elas terminarem.
            </p>
          )}

          <div className="pa-grade pa-grade-2 mp-painel-duas">
            <div className="mp-radar-recorte">
              <h3 className="mp-radar-h3">Onde está cada proposta hoje</h3>
              <TabelaRolagem rotulo="Onde está cada proposta hoje">
                <table className="mp-tabela">
                  <thead>
                    <tr>
                      <th scope="col">Desfecho</th>
                      <th scope="col" className="mp-num">Propostas</th>
                      <th scope="col" className="mp-num">Das enviadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["Assinadas", total.assinadas],
                        ["Reprovadas", total.reprovadas],
                        ["↳ em lote", total.reprovadas_lote],
                        ["Impedimento técnico", total.impedimento],
                        ["↳ em lote", total.impedimento_lote],
                        ["Eliminadas em chamamento público", total.eliminadas],
                        ["Em análise no concedente", total.abertas_concedente],
                        ["↳ sem análise há +1 ano", total.limbo],
                        ["Em complementação pelo proponente", total.abertas_proponente],
                        ["Aprovadas, esperando assinatura", total.aguardando_assinatura],
                        ["Canceladas ou anuladas", canceladas(total)],
                      ] as const
                    ).map(([rotulo, q], i) => (
                      <tr key={i}>
                        <th scope="row" className={rotulo.startsWith("↳") ? "mp-painel-sublinha" : undefined}>
                          {rotulo}
                        </th>
                        <td className="mp-num">{n(q)}</td>
                        <td className="mp-num">{percentual(fracao(q, total.enviadas))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabelaRolagem>
            </div>
            <div className="mp-radar-recorte">
              <h3 className="mp-radar-h3">
                Com e sem <Termo slug="emenda-parlamentar">emenda parlamentar</Termo>
              </h3>
              <TabelaRolagem rotulo="Com e sem emenda parlamentar">
                <table className="mp-tabela">
                  <thead>
                    <tr>
                      <th scope="col">Origem</th>
                      <th scope="col" className="mp-num">Enviadas</th>
                      <th scope="col" className="mp-num">Assinadas</th>
                      <th scope="col" className="mp-num">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["Com emenda", total.com_emenda, total.assinadas_com_emenda],
                        ["Sem emenda", total.enviadas - total.com_emenda, total.assinadas - total.assinadas_com_emenda],
                      ] as const
                    ).map(([rotulo, env, ass]) => (
                      <tr key={rotulo}>
                        <th scope="row">{rotulo}</th>
                        <td className="mp-num">{n(env)}</td>
                        <td className="mp-num">{n(ass)}</td>
                        <td className="mp-num">{percentual(fracao(ass, env))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabelaRolagem>
            </div>
          </div>
          <p className="pa-nota">
            Cada proposta conta uma vez, no ano do primeiro envio, pelo desfecho de hoje. <strong>Em lote</strong> são 100 ou
            mais no mesmo dia pelo mesmo órgão: é o encerramento de um edital, não análise de mérito.
            {historico > 0 && (
              <>
                {" "}
                Em todo o arquivo, de qualquer ano, {n(historico)} propostas estão hoje como &ldquo;Rejeitados por
                impedimento técnico&rdquo;; aqui entram só as enviadas desde 2019.
              </>
            )}
          </p>
        </>
      )}

      {!p.orgao && orgaos.length > 0 && (
        <div className="mp-radar-recorte">
          <h3 className="mp-radar-h3">Por órgão concedente</h3>
          <p className="pa-nota">
            Os {n(orgaos.length)} órgãos, dos com mais propostas enviadas aos com menos; a porcentagem é das enviadas. O nome filtra os
            programas.
          </p>
          <TabelaFiltravel
            id="desfechos"
            rotulo="Desfechos por órgão concedente"
            colunas={colunasDosDesfechos("orgao")}
            linhas={orgaos.map((d) => linhaDesfecho(p, d, "orgao"))}
            ordemPadrao={{ coluna: "enviadas", sentido: "desc" }}
            csv={{ nome: `painel-desfechos-por-orgao-${ano}` }}
          />
        </div>
      )}

      <Lista
        titulo={programas.length > 0 ? `Os ${n(programas.length)} programas com propostas enviadas em ${ano}` : `Programas com propostas enviadas em ${ano}`}
        semRolagem
        vazio={
          <VazioPainel
            p={p}
            leitura={leitura}
            oQue={`Nenhum programa com proposta enviada em ${ano}`}
            extras={outroAnoSaida}
            semSaidas={!total}
          />
        }
      >
        {programas.length > 0 && (
          <TabelaFiltravel
            id={TABELA_DESFECHOS_PROGRAMAS}
            rotulo={`Desfechos por programa, enviadas em ${ano}`}
            colunas={colunasDosDesfechos("programa", !p.orgao)}
            linhas={programas.map((d) => linhaDesfecho(p, d, "programa"))}
            ordemPadrao={{ coluna: "enviadas", sentido: "desc" }}
            csv={{ nome: `painel-desfechos-por-programa${p.uf ? `-${p.uf.toLowerCase()}` : ""}-${ano}` }}
          />
        )}
      </Lista>
    </>
  );
}

// ============================================================================ peças

function Filtros({
  p,
  orgaos,
  municipios,
  referencia,
}: {
  p: ParametrosPainel;
  orgaos: string[];
  municipios: OpcaoMunicipio[];
  referencia: string;
}) {
  const opcoes = [...orgaos];
  if (p.orgao && !opcoes.includes(p.orgao)) opcoes.unshift(p.orgao);
  const convenio = ehVisaoConvenio(p.visao);
  const anos = anosAssinatura(referencia);
  return (
    <div className="mp-filtros mp-radar-filtros">
      {/* GET puro: funciona sem JavaScript e deixa a URL pronta para compartilhar. O
          município aparece depois de escolher a UF e aplicar. */}
      <form method="get" action="/mapa/painel" className="pa-linha mp-radar-uf mp-painel-filtros">
        {p.visao !== "suspensiva" && <input type="hidden" name="visao" value={p.visao} />}
        {p.visao === "contas" && p.lado !== "atrasada" && <input type="hidden" name="lado" value={p.lado} />}
        {p.visao === "tempos" && p.dimensao !== "orgao" && <input type="hidden" name="dimensao" value={p.dimensao} />}
        {(p.visao === "aprovacao" || p.visao === "tempos") && p.ano !== null && <input type="hidden" name="ano" value={p.ano} />}
        {p.visao === "mudancas" && p.dias !== 1 && <input type="hidden" name="dias" value={p.dias} />}
        {p.visao === "mudancas" && p.tipo && <input type="hidden" name="tipo" value={p.tipo} />}
        <label htmlFor="painel-uf" className="pa-campo-rotulo">
          Onde
        </label>
        <select id="painel-uf" name="uf" defaultValue={p.uf ?? ""} className="pa-select">
          <option value="">Brasil</option>
          {UFS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        {aceitaMunicipio(p.visao) && p.uf && municipios.length > 0 && (
          <>
            <label htmlFor="painel-municipio" className="pa-campo-rotulo">
              Município
            </label>
            <select id="painel-municipio" name="municipio" defaultValue={p.municipio ?? ""} className="pa-select mp-painel-municipio">
              <option value="">Todos da UF</option>
              {municipios.map((m) => (
                <option key={m.cod_ibge} value={m.cod_ibge}>
                  {m.municipio ?? `IBGE ${m.cod_ibge}`}
                </option>
              ))}
            </select>
          </>
        )}
        {p.visao !== "municipios" && p.visao !== "mudancas" && (
          <>
            <label htmlFor="painel-orgao" className="pa-campo-rotulo">
              Órgão
            </label>
            <select id="painel-orgao" name="orgao" defaultValue={p.orgao ?? ""} className="pa-select mp-painel-orgao">
              <option value="">Todos</option>
              {opcoes.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </>
        )}
        {convenio && (
          <fieldset className="mp-painel-periodo">
            <legend className="pa-campo-rotulo">Assinado</legend>
            <label htmlFor="painel-assinado-de" className="pa-sr">
              Assinado a partir de
            </label>
            <select id="painel-assinado-de" name="assinado_de" defaultValue={p.assinadoDe ?? ""} className="pa-select">
              <option value="">desde sempre</option>
              {[...anos].reverse().map((a) => (
                <option key={a} value={a}>
                  de {a}
                </option>
              ))}
            </select>
            <label htmlFor="painel-assinado-ate" className="pa-sr">
              Assinado até
            </label>
            <select id="painel-assinado-ate" name="assinado_ate" defaultValue={p.assinadoAte ?? ""} className="pa-select">
              <option value="">até hoje</option>
              {anos.map((a) => (
                <option key={a} value={a}>
                  até {a}
                </option>
              ))}
            </select>
          </fieldset>
        )}
        {convenio && (
          <>
            <label htmlFor="painel-movimento" className="pa-campo-rotulo">
              Movimentação
            </label>
            <select id="painel-movimento" name="movimento" defaultValue={p.movimento ?? ""} className="pa-select">
              <option value="">qualquer</option>
              {MOVIMENTOS.map((m) => (
                <option key={m} value={m}>
                  {ROTULO_MOVIMENTO[m]}
                </option>
              ))}
            </select>
          </>
        )}
        <button type="submit" className="pa-btn pa-btn-pequeno">
          Aplicar os filtros
        </button>
      </form>
    </div>
  );
}

function TabelaContagem({
  titulo,
  colunaValor,
  linhas,
  total,
}: {
  titulo: string;
  colunaValor: string;
  linhas: { rotulo: string; n: number; valor: number | null }[];
  /** Com total, mostra a fatia de cada linha. */
  total?: number;
}) {
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">{titulo}</h3>
      <TabelaRolagem rotulo={titulo}>
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">{total ? "Exigência" : "Faixa"}</th>
              <th scope="col" className="mp-num">Convênios</th>
              {total ? <th scope="col" className="mp-num">Dos pendentes</th> : null}
              <th scope="col" className="mp-num">{colunaValor}</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.rotulo}>
                <th scope="row">{l.rotulo}</th>
                <td className="mp-num">{n(l.n)}</td>
                {total ? <td className="mp-num">{percentual(total ? l.n / total : null)}</td> : null}
                <td className="mp-num">{moedaCurta(l.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaRolagem>
    </div>
  );
}

/**
 * Por órgão concedente, nas 6 visões de convênio (onda 15, fase 2, lote C, 13/10/2026): todos os órgãos lidos (a RPC lê
 * até 60, e há 33), e não mais os 15 primeiros. O nome continua filtrando a lista de baixo, pelo banco.
 */
function PorOrgao({
  p,
  linhas,
  colunaValor,
  colunaDestaque,
}: {
  p: ParametrosPainel;
  linhas: LinhaOrgao[];
  colunaValor: string;
  colunaDestaque: string;
}) {
  if (p.orgao || linhas.length === 0) return null;
  // Os ids são fixos; só o título do valor e do destaque muda com a visão.
  const colunas: ColunaTabela[] = [
    { id: "orgao", titulo: "Órgão", tipo: "texto" },
    { id: "convenios", titulo: "Convênios", tipo: "numero", alinhar: "direita" },
    { id: "valor", titulo: colunaValor, tipo: "numero", alinhar: "direita" },
    { id: "destaque", titulo: colunaDestaque, tipo: "numero", alinhar: "direita" },
  ];
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">Por órgão concedente</h3>
      <p className="pa-nota">Os {n(linhas.length)} órgãos, dos com mais convênios aos com menos. O nome filtra a lista de baixo.</p>
      <TabelaFiltravel
        id="orgaos"
        rotulo="Por órgão concedente"
        colunas={colunas}
        linhas={linhas.map((o) => ({
          chave: o.orgao,
          valores: { orgao: o.orgao, convenios: o.n, valor: o.valor, destaque: o.destaque },
          celulas: {
            orgao: <LinkMapa href={urlPainel(p, { orgao: o.orgao })}>{o.orgao}</LinkMapa>,
            valor: moedaCurta(o.valor),
          },
        }))}
        descricaoOrdemPadrao="dos órgãos com mais convênios aos com menos"
        csv={{ nome: `painel-${p.visao}-por-orgao${p.uf ? `-${p.uf.toLowerCase()}` : ""}` }}
      />
    </div>
  );
}

// ============================================================================ as tabelas filtráveis (onda 15, fase 2, lote C)

const COLUNAS_MUDANCAS: ColunaTabela[] = [
  { id: "mudanca", titulo: "Mudança", tipo: "texto" },
  { id: "grupo", titulo: "Grupo", tipo: "categoria" },
  { id: "quantas", titulo: "Quantas", tipo: "numero", alinhar: "direita" },
  { id: "valor", titulo: "Valor", tipo: "numero", alinhar: "direita" },
];

/** Um tipo de mudança: o nome é o link que filtra a lista de baixo, pelo banco (`?tipo=`), como antes. */
function linhaMudanca(p: ParametrosPainel, l: { tipo: string; n: number; valor: number | null }): LinhaTabela {
  const def = definicaoMudanca(l.tipo);
  const ativo = p.tipo === l.tipo;
  return {
    chave: l.tipo,
    valores: { mudanca: def.rotulo, grupo: ROTULO_GRUPO_MUDANCA[def.grupo], quantas: l.n, valor: l.valor },
    celulas: {
      mudanca: (
        <LinkMapa href={urlPainel(p, { tipo: ativo ? null : l.tipo })} aria-current={ativo ? "true" : undefined}>
          {ativo ? <strong>{def.rotulo}</strong> : def.rotulo}
        </LinkMapa>
      ),
      valor: moedaCurta(l.valor),
    },
  };
}

/**
 * Uma linha da matriz de tempos (as colunas e os valores crus em `painel-tabelas.ts`). Por órgão, o nome abre os
 * programas dele; por programa, o código copiável e, sem órgão no filtro, o órgão embaixo do nome.
 */
function linhaMatriz(
  p: ParametrosPainel,
  l: ReturnType<typeof matrizEtapas>[number],
  etapas: string[],
  todos: ReturnType<typeof etapasDe>,
  porAno: boolean,
): LinhaTabela {
  const { valores, lentas } = valoresDosTempos(l, etapas, todos, porAno, p.dimensao);
  const celulas: LinhaTabela["celulas"] =
    p.dimensao === "programa"
      ? {
          programa: (
            <>
              <span className="mp-tabela-principal mp-painel-programa">{l.rotulo}</span>
              <span className="mp-tabela-secundario">
                cód. {l.chave} <CopiarNumero numero={l.chave} de="programa" />
                {!p.orgao && l.orgao_sup ? ` · ${l.orgao_sup}` : ""}
              </span>
            </>
          ),
        }
      : {
          orgao: (
            <>
              <LinkMapa href={urlPainel(p, { dimensao: "programa", orgao: l.chave })}>{l.rotulo}</LinkMapa>
              {l.chave === p.orgao && <span className="mp-tabela-secundario">o órgão do filtro</span>}
            </>
          ),
        };
  celulas.assinadas = n(l.volume);
  for (const e of etapas) {
    const m = valores[idEtapa(e)];
    celulas[idEtapa(e)] =
      typeof m !== "number" ? (
        "—"
      ) : lentas.has(e) ? (
        // N09 (onda 8, C, 09/10/2026): o destaque tinha só a cor; agora leva "▲ lento" sob o número.
        <span className="mp-painel-urgente">
          {n(m)}
          <Urgente palavra="lento" />
        </span>
      ) : (
        n(m)
      );
  }
  if (!porAno) celulas["sem-desfecho"] = n(Number(valores["sem-desfecho"]));
  return { chave: l.chave, valores, celulas };
}

/** A célula de uma taxa: a porcentagem em cima e a contagem (e o lote) embaixo. */
function celulaTaxa(parte: number, d: LinhaDesfecho, lote?: number): ReactNode {
  return (
    <>
      <span className="mp-tabela-principal">{percentual(fracao(parte, d.enviadas))}</span>
      <span className="mp-tabela-secundario">
        {n(parte)}
        {lote ? ` · ${n(lote)} em lote` : ""}
      </span>
    </>
  );
}

/** Uma linha dos desfechos: por órgão, o nome filtra os programas; por programa, o código copiável e o valor pedido. */
function linhaDesfecho(p: ParametrosPainel, d: LinhaDesfecho, dimensao: "orgao" | "programa"): LinhaTabela {
  const sem = semDesfecho(d);
  const primeira: LinhaTabela["celulas"] =
    dimensao === "programa"
      ? {
          programa: (
            <>
              <span className="mp-tabela-principal mp-painel-programa">{d.programa ?? "—"}</span>
              <span className="mp-tabela-secundario">
                cód. {d.cod_programa} <CopiarNumero numero={d.cod_programa ?? ""} de="programa" />
                {!p.orgao && d.orgao_sup ? ` · ${d.orgao_sup}` : ""}
              </span>
            </>
          ),
          pedido: moedaCurta(d.valor_pedido),
        }
      : { orgao: <LinkMapa href={urlPainel(p, { orgao: d.orgao_sup })}>{d.orgao_sup}</LinkMapa> };
  return {
    chave: dimensao === "programa" ? `${d.cod_programa}|${d.orgao_sup}` : (d.orgao_sup ?? ""),
    valores: valoresDoDesfecho(d, dimensao),
    celulas: {
      ...primeira,
      enviadas: n(d.enviadas),
      assinadas: celulaTaxa(d.assinadas, d),
      reprovadas: celulaTaxa(d.reprovadas, d, d.reprovadas_lote),
      impedimento: celulaTaxa(d.impedimento, d, d.impedimento_lote),
      "sem-desfecho": celulaTaxa(sem, d),
    },
  };
}

/**
 * Indisponível do painel, só para administrador: pode falar da migração e do workflow. B14b (08/10/2026): como o
 * `DadoIndisponivel` da B12, `endereco` vira "Tentar de novo" (só quando a leitura falhou) e `voltarPara`, a volta.
 */
export function PainelIndisponivel({
  estado,
  endereco,
  voltarPara,
}: {
  estado: "nao_ativado" | "sem_execucao" | "erro";
  endereco?: string;
  voltarPara?: Saida;
}) {
  const texto = {
    nao_ativado: {
      titulo: "O painel ainda não foi ativado no banco",
      corpo: "Falta aplicar a migração oport_8 no Supabase. Até lá não há onde guardar os dados.",
    },
    sem_execucao: {
      titulo: "O painel ainda não rodou",
      corpo:
        "As tabelas existem, mas nenhuma execução foi concluída. O painel roda todo dia depois do radar, às 12h45 UTC, no workflow radar-propostas do monorepo.",
    },
    erro: {
      titulo: "O painel está indisponível agora",
      corpo: "A leitura dos dados falhou. O detalhe está no registro do servidor.",
    },
  }[estado];
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">Painel da PONTE · uso interno</p>
        <h1 className="pa-titulo">{texto.titulo}</h1>
        <p>{texto.corpo}</p>
        {/* Onda 9, C (09/10/2026): com o painel fora, a saúde das rodadas diz se o job rodou, parou ou falhou. */}
        <p className="pa-linha">
          {estado === "erro" && endereco && (
            <LinkMapa href={endereco} className="pa-btn pa-btn-pequeno">
              Tentar de novo
            </LinkMapa>
          )}
          {voltarPara && (
            <LinkMapa href={voltarPara.href} className="pa-btn pa-btn-pequeno">
              {voltarPara.rotulo}
            </LinkMapa>
          )}
          <LinkMapa href="/mapa/painel/rodadas" className="pa-btn pa-btn-pequeno">
            Ver a saúde das rodadas
          </LinkMapa>
        </p>
      </div>
    </div>
  );
}

// ============================================================================ as listas de convênio (F3.2)

/** As opções do filtro de órgão: os órgãos do quadro por órgão da própria visão, com a contagem dele. */
function opcoesDoOrgao(linhas: LinhaOrgao[]): Record<string, { valor: string; linhas: number | null }[]> {
  return { orgao: linhas.map((l) => ({ valor: l.orgao, linhas: l.n })) };
}

/**
 * A lista de uma visão de convênio como tabela com filtro (onda 15, fase 3, F3.2, 20/10/2026): o filtro e a ordem de
 * cada coluna vão ao banco; a tabela mostra os 100 primeiros e quantos atendem o filtro, e o CSV traz todos. Com filtro
 * que não acha nada, a tabela continua à vista (para tirar o filtro); sem nenhum convênio no recorte, o vazio de sempre.
 */
function ListaDaVisao({
  p,
  leitura,
  visao,
  titulo,
  ordem,
  vazio,
}: {
  p: ParametrosPainel;
  leitura: LeituraOk;
  visao: VisaoConvenio;
  titulo: string;
  ordem: string;
  vazio: ReactNode;
}) {
  const estado = leitura.estados.lista ?? ESTADO_VAZIO;
  const comTabela = leitura.convenios.length > 0 || filtrosAtivos(estado) > 0;
  return (
    <Lista titulo={titulo} vazio={vazio} semRolagem>
      {comTabela && (
        <TabelaDaVisao
          id={TABELA_PAINEL[visao]}
          rotulo={titulo}
          visao={visao}
          linhas={leitura.convenios}
          descricaoOrdemPadrao={ordem}
          servidor={{
            total: leitura.totalConvenios,
            opcoes: { ...opcoesDoOrgao(leitura.porOrgao), ...opcoesFixas(visao) },
            csvHref: urlCsvDaTabela(urlExportar(p), TABELA_PAINEL[visao], estado),
          }}
        />
      )}
    </Lista>
  );
}
