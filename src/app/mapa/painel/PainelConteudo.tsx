/**
 * A exibição do painel de execução. Recebe os dados já lidos e só desenha — é o
 * que permite conferir a tela com dados reais sem o portão de administrador.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
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
  maisLento,
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
import { moedaCurta } from "@/lib/oportunidades/radar";
import { Tag } from "../../_design/primitivos";
import { CopiarNumero } from "./CopiarNumero";
import {
  Cartao,
  Lista,
  TabelaContas,
  TabelaFisico,
  TabelaNunca,
  TabelaSaldo,
  TabelaSuspensiva,
  TabelaVigencia,
  n,
} from "./Pecas";

type LeituraOk = Extract<LeituraPainel, { estado: "ok" }>;

export function PainelConteudo({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const { execucao } = leitura;
  const def = definicao(p.visao);
  const nomeMunicipio = p.municipio
    ? (leitura.opcoesMunicipio.find((m) => m.cod_ibge === p.municipio)?.municipio ??
      leitura.convenios.find((c) => c.cod_ibge === p.municipio)?.municipio ??
      `IBGE ${p.municipio}`)
    : null;
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
          Dado até <strong>{formatarPublicacao(execucao.dado_ate)}</strong>. Prazos e idades contados a partir de{" "}
          {formatarData(execucao.referencia)}, o dia que o arquivo do Transferegov retrata.
        </p>
      </div>

      <nav aria-label="Visões do painel" className="pa-chips mp-painel-visoes">
        {VISOES.map((v) => (
          <Link
            key={v.id}
            href={urlPainel(p, { visao: v.id })}
            className={`pa-chip${p.visao === v.id ? " pa-ativo" : ""}`}
            aria-current={p.visao === v.id ? "page" : undefined}
          >
            {v.rotulo}
            {contadores[v.id] !== undefined && <span className="pa-chip-contagem">{n(contadores[v.id] ?? 0)}</span>}
          </Link>
        ))}
      </nav>

      <Filtros p={p} orgaos={orgaos} municipios={leitura.opcoesMunicipio} referencia={execucao.referencia} />

      <section aria-labelledby="painel-visao" className="mp-radar-secao">
        <h2 id="painel-visao" className="mp-radar-h2">
          {def.titulo} · {onde}
          {p.orgao ? ` · ${p.orgao}` : ""}
          {periodo ? ` · ${periodo}` : ""}
          {p.movimento && ehVisaoConvenio(p.visao) ? ` · ${ROTULO_MOVIMENTO[p.movimento]}` : ""}
        </h2>
        <p className="pa-sub">{def.pergunta}</p>
        {p.municipio && (
          <p className="mp-painel-ficha-link">
            <Link
              href={urlFicha({ ibge: p.municipio, assinadoDe: p.assinadoDe, assinadoAte: p.assinadoAte })}
              className="pa-btn pa-btn-pequeno"
            >
              Abrir a ficha de {nomeMunicipio}
            </Link>
          </p>
        )}

        {p.visao === "suspensiva" && <Suspensiva p={p} leitura={leitura} />}
        {p.visao === "nunca" && <NuncaDesembolsado p={p} leitura={leitura} />}
        {p.visao === "vigencia" && <Vigencia p={p} leitura={leitura} />}
        {p.visao === "contas" && <Contas p={p} leitura={leitura} />}
        {p.visao === "saldo" && <Saldo p={p} leitura={leitura} />}
        {p.visao === "fisico" && <Fisico p={p} leitura={leitura} />}
        {p.visao === "municipios" && <Municipios leitura={leitura} />}
        {p.visao === "tempos" && <Tempos p={p} leitura={leitura} />}
        {p.visao === "aprovacao" && <Aprovacao p={p} leitura={leitura} />}
      </section>
    </div>
  );
}

// ============================================================================ visões

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
        O SICONV registra um prazo por convênio para a cláusula inteira, e não um por exigência. As exigências são lidas
        do texto do motivo, que costuma ser uma lista-padrão — mostram o que foi pedido, não necessariamente o que ainda
        falta entregar.
      </p>

      <PorOrgao p={p} linhas={leitura.porOrgao} colunaValor="Repasse" colunaDestaque="Vence em até 90 dias" />

      <Lista titulo="Os próximos a vencer" vazio="Nenhuma cláusula suspensiva a vencer neste recorte." csv={urlExportar(p)}>
        {leitura.convenios.length > 0 && <TabelaSuspensiva linhas={leitura.convenios} />}
      </Lista>
      {leitura.vencidos.length > 0 && (
        <Lista titulo="Já vencidos, dos mais recentes aos mais antigos" vazio="">
          <TabelaSuspensiva linhas={leitura.vencidos} />
        </Lista>
      )}
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
              <Tag tom="proto">hipótese</Tag> Fila do concedente: o convenente fez a sua parte.
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
        A etapa é a mais avançada registrada: licitação homologada e aceita pelo concedente. Dispensa e cotação não
        contam como licitação. A plataforma não registra licitação deserta ou fracassada.
      </p>

      <PorOrgao p={p} linhas={leitura.porOrgao} colunaValor="Repasse" colunaDestaque="Aceite há +90 dias" />

      <Lista
        titulo="Aceitos há mais tempo, depois os assinados há mais tempo"
        vazio="Nenhum convênio sem desembolso neste recorte."
        csv={urlExportar(p)}
      >
        {leitura.convenios.length > 0 && <TabelaNunca linhas={leitura.convenios} />}
      </Lista>
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
        conta. Extensões somam os termos aditivos de vigência e as prorrogações de ofício.
      </p>

      <MotivosAditivos p={p} leitura={leitura} />

      <PorOrgao p={p} linhas={leitura.porOrgao} colunaValor="A desembolsar" colunaDestaque="Termina em até 90 dias" />

      <Lista titulo="Os que terminam primeiro" vazio="Nenhum convênio em risco de vigência neste recorte." csv={urlExportar(p)}>
        {leitura.convenios.length > 0 && <TabelaVigencia linhas={leitura.convenios} />}
      </Lista>
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
        <div className="mp-tabela-rolagem">
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
        </div>
      </div>
      <div className="mp-radar-recorte">
        <h3 className="mp-radar-h3">
          Todos os aditivos de vigência · {p.uf ?? "Brasil"} · {anoMinimo} a {anoDado}
        </h3>
        <p className="pa-nota">Inclui convênios já concluídos: é o retrato de por que se pede mais prazo.</p>
        <div className="mp-tabela-rolagem">
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
        </div>
      </div>
      <p className="pa-nota mp-painel-nota-larga">
        <Tag tom="proto">classificação automática</Tag> O motivo é lido do texto da justificativa por expressões do estudo; cada
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
        <Cartao rotulo="Em TCE" quantidade={r("tce").n} valor={r("tce").valor} />
        <Cartao
          rotulo="Esperando análise do concedente"
          quantidade={r("concedente").n}
          valor={r("concedente").valor}
          nota={<>Vez do concedente · {n(r("concedente_1ano").n)} há mais de um ano</>}
        />
      </div>
      <p className="pa-nota">
        Valores de repasse. TCE é marca própria e se sobrepõe às situações. Inadimplente no SICONV não é o CAUC, que é o
        que de fato bloqueia — e o estudo mostrou que municípios com inadimplência aberta seguem assinando convênios.
      </p>

      <PorOrgao p={p} linhas={leitura.porOrgao} colunaValor="Repasse" colunaDestaque="Parados há +1 ano" />

      <nav aria-label="Qual lista de prestação de contas" className="pa-chips mp-painel-lados">
        {LADOS_CONTAS.map((l) => (
          <Link
            key={l}
            href={urlPainel(p, { lado: l })}
            className={`pa-chip${p.lado === l ? " pa-ativo" : ""}`}
            aria-current={p.lado === l ? "true" : undefined}
          >
            {ROTULO_LADO_CONTAS[l]}
            <span className="pa-chip-contagem">{n(quantidade[l])}</span>
          </Link>
        ))}
      </nav>

      <Lista
        titulo={
          {
            atrasada: "Atrasadas mais recentes — onde ainda dá para regularizar",
            negativo: "Rejeitadas e inadimplentes, pelo valor",
            tce: "Em TCE, pelo valor",
            concedente: "Esperando análise há mais tempo",
          }[p.lado]
        }
        vazio="Nenhum convênio nesta lista."
        csv={urlExportar(p)}
      >
        {leitura.convenios.length > 0 && <TabelaContas linhas={leitura.convenios} />}
      </Lista>
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

      <Lista titulo="Os maiores saldos parados" vazio="Nenhuma conta parada há mais de um ano neste recorte." csv={urlExportar(p)}>
        {leitura.convenios.length > 0 && <TabelaSaldo linhas={leitura.convenios} />}
      </Lista>
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

      <Lista titulo="Os maiores valores desembolsados" vazio="Nenhum convênio com desembolso alto e físico baixo neste recorte." csv={urlExportar(p)}>
        {leitura.convenios.length > 0 && <TabelaFisico linhas={leitura.convenios} />}
      </Lista>
    </>
  );
}

function Municipios({ leitura }: { leitura: LeituraOk }) {
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

      <Lista titulo="Os com mais sinais" vazio="Nenhum município com sinal neste recorte.">
        {leitura.municipios.length > 0 && (
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Município</th>
                <th scope="col">Sinais</th>
                <th scope="col" className="mp-num">Saldo parado</th>
                <th scope="col" className="mp-num">Suspensivas vencendo</th>
                <th scope="col" className="mp-num">Contas atrasadas</th>
                <th scope="col" className="mp-num">Contas negativas</th>
                <th scope="col" className="mp-num">Sem desembolso</th>
              </tr>
            </thead>
            <tbody>
              {leitura.municipios.map((m) => (
                <tr key={m.cod_ibge}>
                  <th scope="row">
                    <span className="mp-tabela-principal">
                      <Link href={urlFicha({ ibge: m.cod_ibge })}>
                        {m.municipio ?? "—"}/{m.uf ?? "—"}
                      </Link>
                    </span>
                    <span className="mp-tabela-secundario">IBGE {m.cod_ibge}</span>
                  </th>
                  <td>
                    <span className="mp-painel-tags">
                      <strong className="mp-painel-contagem-sinais">{m.n_sinais}</strong>
                      {sinaisDe(m).map((s) => (
                        <Tag key={s}>{ROTULO_SINAL_CURTO[s]}</Tag>
                      ))}
                    </span>
                  </td>
                  <td className="mp-num">{m.n_saldo ? moedaCurta(m.valor_saldo) : "—"}</td>
                  <td className="mp-num">{m.n_suspensiva || "—"}</td>
                  <td className="mp-num">{m.n_contas_atrasadas || "—"}</td>
                  <td className="mp-num">{m.n_contas_negativas || "—"}</td>
                  <td className="mp-num">{m.n_sem_desembolso ? `${m.n_sem_desembolso} · ${moedaCurta(m.valor_sem_desembolso)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <Link
            key={a ?? "janela"}
            href={urlPainel(p, { ano: a })}
            className={`pa-chip${p.ano === a ? " pa-ativo" : ""}`}
            aria-current={p.ano === a ? "true" : undefined}
          >
            {a === null ? "Últimos 36 meses" : `${a}${a === anoDado ? " · parcial" : ""}`}
          </Link>
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
          Mediana das etapas que terminaram desde {formatarData(inicioJanela(leitura.execucao.referencia))}, nos últimos 36
          meses: metade levou menos que isso. Aprovação é o plano de trabalho aprovado; assinatura, a data formal do
          convênio; conclusão, a prestação de contas aprovada. &ldquo;Ainda nesta etapa&rdquo; conta, nas etapas de proposta,
          só as enviadas na mesma janela; nas de convênio, os que estão nela hoje.
        </p>
      )}

      {porAno ? null : <div className="mp-radar-recorte">
        <h3 className="mp-radar-h3">De quem é a vez, do envio à assinatura</h3>
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Com quem estava</th>
                <th scope="col" className="mp-num">Mediana</th>
                <th scope="col" className="mp-num">9 em cada 10 em até</th>
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
        </div>
        <p className="pa-nota">
          Nas propostas assinadas na janela, o tempo somado em análise do concedente, em complementação pelo proponente e
          aprovada esperando a assinatura. As medianas não se somam: cada uma é o meio da sua própria distribuição.
        </p>
      </div>}

      <nav aria-label="Comparar por" className="pa-chips mp-painel-lados">
        {(["orgao", "programa"] as const).map((d) => (
          <Link
            key={d}
            href={urlPainel(p, { dimensao: d })}
            className={`pa-chip${p.dimensao === d ? " pa-ativo" : ""}`}
            aria-current={p.dimensao === d ? "true" : undefined}
          >
            {d === "orgao" ? "Por ministério" : "Por programa"}
          </Link>
        ))}
      </nav>

      <Lista
        titulo={
          porPrograma
            ? linhas.length > 0
              ? `Mediana em dias, nos ${linhas.length} programas com mais assinaturas${p.orgao ? " do órgão" : ""}${porAno ? ` em ${p.ano}` : ""}`
              : "Mediana em dias, por programa"
            : `Mediana em dias, por órgão concedente${porAno ? ` · etapas terminadas em ${p.ano}` : ""}`
        }
        vazio={
          porAno && porPrograma && p.uf
            ? "Por ano, os programas só são medidos no Brasil inteiro: por UF a amostra de cada um é pequena demais."
            : `Nenhum ${porPrograma ? "programa" : "órgão"} com medição neste recorte.`
        }
      >
        {linhas.length > 0 && (
          <table className="mp-tabela mp-painel-matriz">
            <thead>
              <tr>
                <th scope="col">{porPrograma ? "Programa" : "Órgão"}</th>
                {colunas.map((e) => (
                  <th key={e} scope="col" className="mp-num">
                    {ROTULO_ETAPA[e]}
                  </th>
                ))}
                <th scope="col" className="mp-num">{porAno ? `Assinadas em ${p.ano}` : "Assinadas na janela"}</th>
                {porAno ? null : <th scope="col" className="mp-num">Propostas sem desfecho</th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave} className={!porPrograma && l.chave === p.orgao ? "mp-painel-foco" : undefined}>
                  <th scope="row">
                    {porPrograma ? (
                      <>
                        <span className="mp-tabela-principal mp-painel-programa">{l.rotulo}</span>
                        <span className="mp-tabela-secundario">
                          cód. {l.chave} <CopiarNumero numero={l.chave} de="programa" />
                          {!p.orgao && l.orgao_sup ? ` · ${l.orgao_sup}` : ""}
                        </span>
                      </>
                    ) : (
                      <Link href={urlPainel(p, { dimensao: "programa", orgao: l.chave })}>{l.rotulo}</Link>
                    )}
                  </th>
                  {colunas.map((e) => {
                    const m = medianaComparavel(l.etapas[e]);
                    return (
                      <td key={e} className="mp-num">
                        {m === null ? (
                          "—"
                        ) : (
                          <span className={maisLento(m, medianaComparavel(todos[e])) ? "mp-painel-urgente" : undefined}>
                            {n(Math.round(m))}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="mp-num">{n(l.volume)}</td>
                  {porAno ? null : <td className="mp-num">{n(l.etapas.envio_assinatura?.em_aberto ?? 0)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Lista>
      <p className="pa-nota">
        Em destaque, a mediana 1,5 vez ou mais a de {p.uf ? `todos os órgãos em ${onde}` : "todos os órgãos do Brasil"}.
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

  return (
    <>
      <nav aria-label="Ano do primeiro envio" className="pa-chips mp-painel-lados mp-painel-anos">
        {anosEnvio(leitura.execucao.referencia).map((a) => (
          <Link
            key={a}
            href={urlPainel(p, { ano: a })}
            className={`pa-chip${a === ano ? " pa-ativo" : ""}`}
            aria-current={a === ano ? "true" : undefined}
          >
            {a}
            {a === anoDado ? " · parcial" : ""}
          </Link>
        ))}
      </nav>

      {!total ? (
        <p className="pa-cartao pa-cartao-plano">Nenhuma proposta enviada em {ano} neste recorte.</p>
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
              <div className="mp-tabela-rolagem">
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
              </div>
            </div>
            <div className="mp-radar-recorte">
              <h3 className="mp-radar-h3">Com e sem emenda parlamentar</h3>
              <div className="mp-tabela-rolagem">
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
              </div>
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
          <p className="pa-nota">Os {Math.min(ORGAOS_NA_TABELA, orgaos.length)} com mais propostas enviadas. O nome filtra os programas.</p>
          <div className="mp-tabela-rolagem">
            <TabelaDesfechos
              linhas={orgaos.slice(0, ORGAOS_NA_TABELA)}
              cabeca="Órgão"
              linha={(d) => <Link href={urlPainel(p, { orgao: d.orgao_sup })}>{d.orgao_sup}</Link>}
            />
          </div>
        </div>
      )}

      <Lista
        titulo={`Programas com mais propostas enviadas em ${ano}`}
        vazio="Nenhum programa com proposta enviada neste recorte."
      >
        {programas.length > 0 && (
          <TabelaDesfechos
            linhas={programas}
            cabeca="Programa"
            linha={(d) => (
              <>
                <span className="mp-tabela-principal mp-painel-programa">{d.programa ?? "—"}</span>
                <span className="mp-tabela-secundario">
                  cód. {d.cod_programa} <CopiarNumero numero={d.cod_programa ?? ""} de="programa" />
                  {!p.orgao && d.orgao_sup ? ` · ${d.orgao_sup}` : ""}
                </span>
              </>
            )}
            valor
          />
        )}
      </Lista>
    </>
  );
}

function TabelaDesfechos({
  linhas,
  cabeca,
  linha,
  valor,
}: {
  linhas: LinhaDesfecho[];
  cabeca: string;
  linha: (d: LinhaDesfecho) => ReactNode;
  /** Com a coluna do valor pedido. */
  valor?: boolean;
}) {
  const taxa = (parte: number, d: LinhaDesfecho, lote?: number) => (
    <td className="mp-num">
      <span className="mp-tabela-principal">{percentual(fracao(parte, d.enviadas))}</span>
      <span className="mp-tabela-secundario">
        {n(parte)}
        {lote ? ` · ${n(lote)} em lote` : ""}
      </span>
    </td>
  );
  return (
    <table className="mp-tabela">
      <thead>
        <tr>
          <th scope="col">{cabeca}</th>
          <th scope="col" className="mp-num">Enviadas</th>
          <th scope="col" className="mp-num">Assinadas</th>
          <th scope="col" className="mp-num">Reprovadas</th>
          <th scope="col" className="mp-num">Impedimento</th>
          <th scope="col" className="mp-num">Sem desfecho</th>
          {valor && <th scope="col" className="mp-num">Pedido</th>}
        </tr>
      </thead>
      <tbody>
        {linhas.map((d) => (
          <tr key={`${d.orgao_sup}|${d.cod_programa}`}>
            <th scope="row">{linha(d)}</th>
            <td className="mp-num">{n(d.enviadas)}</td>
            {taxa(d.assinadas, d)}
            {taxa(d.reprovadas, d, d.reprovadas_lote)}
            {taxa(d.impedimento, d, d.impedimento_lote)}
            {taxa(semDesfecho(d), d)}
            {valor && <td className="mp-num">{moedaCurta(d.valor_pedido)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
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
        {convenio && p.uf && municipios.length > 0 && (
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
        {p.visao !== "municipios" && (
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
          Aplicar
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
      <div className="mp-tabela-rolagem">
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
      </div>
    </div>
  );
}

const ORGAOS_NA_TABELA = 15;

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
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">Por órgão concedente</h3>
      <p className="pa-nota">Os {Math.min(ORGAOS_NA_TABELA, linhas.length)} com mais convênios. O nome filtra a lista.</p>
      <div className="mp-tabela-rolagem">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Órgão</th>
              <th scope="col" className="mp-num">Convênios</th>
              <th scope="col" className="mp-num">{colunaValor}</th>
              <th scope="col" className="mp-num">{colunaDestaque}</th>
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, ORGAOS_NA_TABELA).map((o) => (
              <tr key={o.orgao}>
                <th scope="row">
                  <Link href={urlPainel(p, { orgao: o.orgao })}>{o.orgao}</Link>
                </th>
                <td className="mp-num">{n(o.n)}</td>
                <td className="mp-num">{moedaCurta(o.valor)}</td>
                <td className="mp-num">{n(o.destaque)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PainelIndisponivel({ estado }: { estado: "nao_ativado" | "sem_execucao" | "erro" }) {
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
      </div>
    </div>
  );
}
