/**
 * A exibição do painel de execução. Recebe os dados já lidos e só desenha — é o
 * que permite conferir a tela com dados reais sem o portão de administrador.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { UFS } from "@/lib/oportunidades/organizacao";
import {
  DESCRICAO_SINAL,
  ETAPAS_LICITACAO,
  EXIGENCIAS,
  FAIXAS_SALDO,
  FAIXAS_SUSPENSIVA,
  FAIXAS_VIGENCIA,
  GRUPOS_SUSPENSIVA,
  LADOS_CONTAS,
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
  VISOES,
  definicao,
  exigenciasDe,
  idadePorExtenso,
  percentual,
  prazoPorExtenso,
  resumoDe,
  sinaisDe,
  urlPainel,
  type ParametrosPainel,
  type Visao,
} from "@/lib/oportunidades/painel";
import type { ConvenioPainel, LeituraPainel, LinhaOrgao } from "@/lib/oportunidades/painel.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { Tag } from "../../_design/primitivos";
import { CopiarNumero } from "./CopiarNumero";

type LeituraOk = Extract<LeituraPainel, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");

export function PainelConteudo({ p, leitura }: { p: ParametrosPainel; leitura: LeituraOk }) {
  const { execucao } = leitura;
  const def = definicao(p.visao);
  const onde = p.uf ?? "Brasil";

  const r = (v: Visao) => resumoDe(leitura.resumo, v);
  const contas = r("contas");
  const contadores: Record<Visao, number> = {
    suspensiva: r("suspensiva")("total").n,
    nunca: r("nunca")("total").n,
    vigencia: r("vigencia")("total").n,
    contas: contas("convenente").n + contas("concedente").n + contas("negativo").n,
    saldo: r("saldo")("parado").n,
    municipios: leitura.resumo.filter((l) => l.visao === "municipios").reduce((s, l) => s + l.n, 0),
  };

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
            <span className="pa-chip-contagem">{n(contadores[v.id])}</span>
          </Link>
        ))}
      </nav>

      <Filtros p={p} orgaos={leitura.porOrgao} />

      <section aria-labelledby="painel-visao" className="mp-radar-secao">
        <h2 id="painel-visao" className="mp-radar-h2">
          {def.titulo} · {onde}
          {p.orgao ? ` · ${p.orgao}` : ""}
        </h2>
        <p className="pa-sub">{def.pergunta}</p>

        {p.visao === "suspensiva" && <Suspensiva p={p} leitura={leitura} />}
        {p.visao === "nunca" && <NuncaDesembolsado p={p} leitura={leitura} />}
        {p.visao === "vigencia" && <Vigencia p={p} leitura={leitura} />}
        {p.visao === "contas" && <Contas p={p} leitura={leitura} />}
        {p.visao === "saldo" && <Saldo p={p} leitura={leitura} />}
        {p.visao === "municipios" && <Municipios leitura={leitura} />}
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

      <Lista titulo="Os próximos a vencer" vazio="Nenhuma cláusula suspensiva a vencer neste recorte.">
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

function TabelaSuspensiva({ linhas }: { linhas: ConvenioPainel[] }) {
  return (
    <table className="mp-tabela">
      <thead>
        <tr>
          <th scope="col">Proponente e convênio</th>
          <th scope="col">Prazo</th>
          <th scope="col">Programa e órgão</th>
          <th scope="col">Exigências</th>
          <th scope="col" className="mp-num">Repasse</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((c) => (
          <tr key={c.nr_convenio}>
            <CelulaConvenio c={c} />
            <td className="mp-nowrap">
              <span className="mp-tabela-principal">{c.suspensiva_prazo ? formatarData(c.suspensiva_prazo) : "—"}</span>
              <span className={`mp-tabela-secundario${(c.suspensiva_dias ?? 999) <= 30 ? " mp-painel-urgente" : ""}`}>
                {(c.suspensiva_dias ?? 0) < -60
                  ? `venceu há ${idadePorExtenso(-(c.suspensiva_dias ?? 0))}`
                  : prazoPorExtenso(c.suspensiva_dias)}
              </span>
            </td>
            <CelulaPrograma c={c} />
            <td>
              <span className="mp-painel-tags">
                {exigenciasDe(c).map((e) => (
                  <Tag key={e}>{ROTULO_EXIGENCIA[e]}</Tag>
                ))}
                {exigenciasDe(c).length === 0 && "—"}
              </span>
            </td>
            <td className="mp-num">{moedaCurta(c.repasse)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
      >
        {leitura.convenios.length > 0 && (
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Proponente e convênio</th>
                <th scope="col">Programa e órgão</th>
                <th scope="col">Assinado</th>
                <th scope="col">Onde parou</th>
                <th scope="col" className="mp-num">Repasse</th>
                <th scope="col" className="mp-num">Empenhado</th>
              </tr>
            </thead>
            <tbody>
              {leitura.convenios.map((c) => (
                <tr key={c.nr_convenio}>
                  <CelulaConvenio c={c} />
                  <CelulaPrograma c={c} />
                  <td className="mp-nowrap">{c.dt_assinatura ? formatarData(c.dt_assinatura) : "—"}</td>
                  <td>
                    <span className="mp-tabela-principal">
                      {c.etapa_licitacao
                        ? ROTULO_ETAPA_LICITACAO[c.etapa_licitacao]
                        : ROTULO_GRUPO_SUSPENSIVA[c.grupo_suspensiva ?? ""] ?? "—"}
                    </span>
                    {c.dt_aceite && (
                      <span className={`mp-tabela-secundario${c.aceite_parado ? " mp-painel-urgente" : ""}`}>
                        aceite em {formatarData(c.dt_aceite)}
                      </span>
                    )}
                  </td>
                  <td className="mp-num">{moedaCurta(c.repasse)}</td>
                  <td className="mp-num">{moedaCurta(c.empenhado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

      <PorOrgao p={p} linhas={leitura.porOrgao} colunaValor="A desembolsar" colunaDestaque="Termina em até 90 dias" />

      <Lista titulo="Os que terminam primeiro" vazio="Nenhum convênio em risco de vigência neste recorte.">
        {leitura.convenios.length > 0 && (
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Proponente e convênio</th>
                <th scope="col">Fim da vigência</th>
                <th scope="col">Programa e órgão</th>
                <th scope="col" className="mp-num">Desembolsado</th>
                <th scope="col" className="mp-num">Extensões</th>
                <th scope="col" className="mp-num">A desembolsar</th>
              </tr>
            </thead>
            <tbody>
              {leitura.convenios.map((c) => (
                <tr key={c.nr_convenio}>
                  <CelulaConvenio c={c} />
                  <td className="mp-nowrap">
                    <span className="mp-tabela-principal">{c.dt_fim_vigencia ? formatarData(c.dt_fim_vigencia) : "—"}</span>
                    <span className={`mp-tabela-secundario${(c.dias_para_fim ?? 999) <= 90 ? " mp-painel-urgente" : ""}`}>
                      {prazoPorExtenso(c.dias_para_fim, { futuro: "termina", passado: "terminou" })}
                    </span>
                  </td>
                  <CelulaPrograma c={c} />
                  <td className="mp-num">{percentual(c.pct_desembolsado)}</td>
                  <td className="mp-num">{c.n_extensoes ?? 0}</td>
                  <td className="mp-num">{moedaCurta(Math.max((c.repasse ?? 0) - (c.desembolsado ?? 0), 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Lista>
    </>
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
      >
        {leitura.convenios.length > 0 && (
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Proponente e convênio</th>
                <th scope="col">Programa e órgão</th>
                <th scope="col">Situação</th>
                <th scope="col">Prazo das contas</th>
                <th scope="col" className="mp-num">Repasse</th>
              </tr>
            </thead>
            <tbody>
              {leitura.convenios.map((c) => (
                <tr key={c.nr_convenio}>
                  <CelulaConvenio c={c} />
                  <CelulaPrograma c={c} />
                  <td>
                    <span className="mp-tabela-principal">{c.situacao ?? "—"}</span>
                    {c.contas_lado === "concedente" && c.dias_com_concedente !== null && (
                      <span className="mp-tabela-secundario">com o concedente há {idadePorExtenso(c.dias_com_concedente)}</span>
                    )}
                  </td>
                  <td className="mp-nowrap">
                    {c.dias_apos_limite === null
                      ? "—"
                      : c.dias_apos_limite > 0
                        ? `venceu há ${idadePorExtenso(c.dias_apos_limite)}`
                        : prazoPorExtenso(-c.dias_apos_limite)}
                  </td>
                  <td className="mp-num">{moedaCurta(c.repasse)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

      <Lista titulo="Os maiores saldos parados" vazio="Nenhuma conta parada há mais de um ano neste recorte.">
        {leitura.convenios.length > 0 && (
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Proponente e convênio</th>
                <th scope="col">Programa e órgão</th>
                <th scope="col">Último pagamento</th>
                <th scope="col">Parado há</th>
                <th scope="col" className="mp-num">Saldo</th>
                <th scope="col" className="mp-num">Rendimento</th>
              </tr>
            </thead>
            <tbody>
              {leitura.convenios.map((c) => (
                <tr key={c.nr_convenio}>
                  <CelulaConvenio c={c} />
                  <CelulaPrograma c={c} />
                  <td className="mp-nowrap">{c.dt_ultimo_pagamento ? formatarData(c.dt_ultimo_pagamento) : "nunca pagou"}</td>
                  <td className="mp-nowrap">{idadePorExtenso(c.dias_sem_movimento)}</td>
                  <td className="mp-num">{moedaCurta(c.saldo_conta)}</td>
                  <td className="mp-num">{moedaCurta(c.rendimento_implicito)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
                      {m.municipio ?? "—"}/{m.uf ?? "—"}
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

// ============================================================================ peças

function Filtros({ p, orgaos }: { p: ParametrosPainel; orgaos: LinhaOrgao[] }) {
  const opcoes = orgaos.map((o) => o.orgao);
  if (p.orgao && !opcoes.includes(p.orgao)) opcoes.unshift(p.orgao);
  return (
    <div className="mp-filtros mp-radar-filtros">
      {/* GET puro: funciona sem JavaScript e deixa a URL pronta para compartilhar. */}
      <form method="get" action="/mapa/painel" className="pa-linha mp-radar-uf mp-painel-filtros">
        {p.visao !== "suspensiva" && <input type="hidden" name="visao" value={p.visao} />}
        {p.visao === "contas" && p.lado !== "atrasada" && <input type="hidden" name="lado" value={p.lado} />}
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
        <button type="submit" className="pa-btn pa-btn-pequeno">
          Aplicar
        </button>
      </form>
    </div>
  );
}

function Cartao({
  rotulo,
  quantidade,
  valor,
  legenda,
  nota,
  tom,
}: {
  rotulo: string;
  quantidade: number;
  valor?: number | null;
  legenda?: string;
  nota?: ReactNode;
  tom?: "urgente";
}) {
  return (
    <article className={`pa-cartao mp-painel-cartao${tom === "urgente" ? " mp-painel-cartao-urgente" : ""}`}>
      <h3 className="pa-mono">{rotulo}</h3>
      <p className="pa-numero">{n(quantidade)}</p>
      {valor !== undefined && (
        <p className="mp-painel-valor">
          {moedaCurta(valor)}
          {legenda ? ` ${legenda}` : ""}
        </p>
      )}
      {nota && <p className="pa-nota">{nota}</p>}
    </article>
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

function Lista({ titulo, vazio, children }: { titulo: string; vazio: string; children: ReactNode }) {
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">{titulo}</h3>
      {children ? <div className="mp-tabela-rolagem">{children}</div> : <p className="pa-cartao pa-cartao-plano">{vazio}</p>}
    </div>
  );
}

function CelulaConvenio({ c }: { c: ConvenioPainel }) {
  return (
    <th scope="row">
      <span className="mp-tabela-principal">{c.proponente ?? "—"}</span>
      <span className="mp-tabela-secundario">
        {c.municipio ?? "—"}/{c.uf ?? "—"} · nº {c.nr_convenio} <CopiarNumero numero={c.nr_convenio} />
      </span>
    </th>
  );
}

function CelulaPrograma({ c }: { c: ConvenioPainel }) {
  return (
    <td>
      <span className="mp-tabela-principal mp-painel-programa">{c.programa ?? "—"}</span>
      <span className="mp-tabela-secundario">{c.orgao_sup ?? "—"}</span>
      {c.objeto && <span className="mp-tabela-secundario mp-painel-objeto">{c.objeto}</span>}
    </td>
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
