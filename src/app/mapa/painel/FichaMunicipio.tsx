/**
 * Ficha do município: tudo o que trava num lugar, para a conversa com a prefeitura.
 * Recebe os dados já lidos e só desenha, como o PainelConteudo.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import {
  DESCRICAO_SINAL,
  MOVIMENTOS,
  ROTULO_DESFECHO,
  ROTULO_MOVIMENTO,
  ROTULO_SINAL,
  anosAssinatura,
  urlExportarFicha,
  fracao,
  idadePorExtenso,
  parametrosPainel,
  percentual,
  periodoPorExtenso,
  resumoDe,
  urlFicha,
  urlPainel,
  vezDaProposta,
  type ParametrosFicha,
  type PropostaPainel,
  type Sinal,
  type Visao,
} from "@/lib/oportunidades/painel";
import {
  DIAS_FICHA_MUDANCAS,
  LIMITE_FICHA_CONVENIOS,
  LIMITE_FICHA_MUDANCAS,
  type FichaMunicipio,
  type MunicipioPainel,
} from "@/lib/oportunidades/painel.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { Tag } from "../../_design/primitivos";
import { CopiarNumero } from "./CopiarNumero";
import {
  BotaoCsv,
  Cartao,
  Lista,
  TabelaContas,
  TabelaFisico,
  TabelaMudancas,
  TabelaNunca,
  TabelaSaldo,
  TabelaSuspensiva,
  TabelaVigencia,
  n,
} from "./Pecas";

export function FichaConteudo({ f, ficha }: { f: ParametrosFicha; ficha: FichaMunicipio }) {
  const nome = ficha.nome ?? `IBGE ${f.ibge}`;
  const r = (v: Visao) => resumoDe(ficha.resumo, v);
  const contas = r("contas");
  const periodo = periodoPorExtenso(f.assinadoDe, f.assinadoAte);
  const anoMinimoPropostas = Number(ficha.execucao.referencia.slice(0, 4)) - 2;
  // Link para a mesma visão no painel, já filtrada por este município e período.
  const noPainel = (visao: Visao) =>
    urlPainel(parametrosPainel({ visao, municipio: f.ibge }), {
      assinadoDe: f.assinadoDe,
      assinadoAte: f.assinadoAte,
      movimento: f.movimento,
    });
  const semConvenio = [ficha.suspensiva, ficha.nunca, ficha.vigencia, ficha.contas, ficha.saldo, ficha.fisico].every(
    (l) => l.length === 0,
  );

  return (
    <div className="pa-pagina mp-radar mp-painel">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">
          <Link href={urlPainel(parametrosPainel({ uf: f.uf }), {})}>Painel da PONTE · {f.uf}</Link> · ficha do município
        </p>
        <h1 className="pa-titulo">
          {nome}/{f.uf}
        </h1>
        <p className="pa-sub">
          IBGE {f.ibge}. Dado até <strong>{formatarPublicacao(ficha.execucao.dado_ate)}</strong>; prazos contados a partir
          de {formatarData(ficha.execucao.referencia)}.
        </p>
      </div>

      <nav aria-label="Quais proponentes" className="pa-chips mp-painel-lados mp-painel-quem">
        {(["prefeitura", "todos"] as const).map((q) => (
          <Link
            key={q}
            href={urlFicha(f, { quem: q })}
            className={`pa-chip${f.quem === q ? " pa-ativo" : ""}`}
            aria-current={f.quem === q ? "true" : undefined}
          >
            {q === "prefeitura" ? "Prefeitura" : "Todos os proponentes no município"}
          </Link>
        ))}
      </nav>

      <div className="mp-filtros mp-radar-filtros">
        <form method="get" action={`/mapa/painel/municipio/${f.ibge}`} className="pa-linha mp-radar-uf mp-painel-filtros">
          {f.quem !== "prefeitura" && <input type="hidden" name="quem" value={f.quem} />}
          <label htmlFor="ficha-movimento" className="pa-campo-rotulo">
            Movimentação
          </label>
          <select id="ficha-movimento" name="movimento" defaultValue={f.movimento ?? ""} className="pa-select">
            <option value="">qualquer</option>
            {MOVIMENTOS.map((m) => (
              <option key={m} value={m}>
                {ROTULO_MOVIMENTO[m]}
              </option>
            ))}
          </select>
          <fieldset className="mp-painel-periodo">
            <legend className="pa-campo-rotulo">Convênios assinados</legend>
            <label htmlFor="ficha-assinado-de" className="pa-sr">
              Assinado a partir de
            </label>
            <select id="ficha-assinado-de" name="assinado_de" defaultValue={f.assinadoDe ?? ""} className="pa-select">
              <option value="">desde sempre</option>
              {[...anosAssinatura(ficha.execucao.referencia)].reverse().map((a) => (
                <option key={a} value={a}>
                  de {a}
                </option>
              ))}
            </select>
            <label htmlFor="ficha-assinado-ate" className="pa-sr">
              Assinado até
            </label>
            <select id="ficha-assinado-ate" name="assinado_ate" defaultValue={f.assinadoAte ?? ""} className="pa-select">
              <option value="">até hoje</option>
              {anosAssinatura(ficha.execucao.referencia).map((a) => (
                <option key={a} value={a}>
                  até {a}
                </option>
              ))}
            </select>
          </fieldset>
          <button type="submit" className="pa-btn pa-btn-pequeno">
            Aplicar
          </button>
        </form>
      </div>

      {f.quem === "prefeitura" && <Sinais sinais={ficha.sinais} />}

      <section aria-labelledby="ficha-mudancas" className="mp-radar-secao">
        <h2 id="ficha-mudancas" className="mp-radar-h2">
          O que mudou nos últimos {DIAS_FICHA_MUDANCAS} dias
          {ficha.mudancas.length >= LIMITE_FICHA_MUDANCAS ? ` · as ${n(ficha.mudancas.length)} mais recentes` : ""}
        </h2>
        {ficha.mudancas.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhuma mudança {f.quem === "prefeitura" ? "da prefeitura " : ""}nos convênios e propostas acompanhados.
          </p>
        ) : (
          <>
            <p className="pa-nota">
              <Link href={urlPainel(parametrosPainel({ visao: "mudancas", municipio: f.ibge }), { dias: 7 })}>
                Ver no painel, com a contagem por tipo
              </Link>
            </p>
            <div className="mp-tabela-rolagem">
              <TabelaMudancas linhas={ficha.mudancas} naFicha comData />
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="ficha-convenios" className="mp-radar-secao">
        <div className="mp-painel-lista-cabeca">
          <h2 id="ficha-convenios" className="mp-radar-h2">
            Convênios que travam{periodo ? ` · ${periodo}` : ""}
            {f.movimento ? ` · ${ROTULO_MOVIMENTO[f.movimento]}` : ""}
          </h2>
          {!semConvenio && <BotaoCsv href={urlExportarFicha(f)} rotulo="Baixar os convênios (CSV)" />}
        </div>
        <div className="pa-grade pa-grade-3 mp-painel-cartoes">
          <Cartao rotulo="Suspensiva pendente" quantidade={r("suspensiva")("total").n} valor={r("suspensiva")("total").valor} legenda="de repasse" />
          <Cartao rotulo="Nunca desembolsado" quantidade={r("nunca")("total").n} valor={r("nunca")("total").valor} legenda="de repasse" tom="urgente" />
          <Cartao rotulo="Vigência em risco" quantidade={r("vigencia")("total").n} valor={r("vigencia")("total").valor} legenda="a desembolsar" />
          <Cartao
            rotulo="Contas atrasadas ou negativas"
            quantidade={contas("atrasada").n + contas("negativo").n}
            nota={<>TCE: {n(contas("tce").n)} · esperando o concedente: {n(contas("concedente").n)}</>}
            tom={contas("negativo").n > 0 ? "urgente" : undefined}
          />
          <Cartao rotulo="Saldo parado há +1 ano" quantidade={r("saldo")("parado").n} valor={r("saldo")("parado").valor} legenda="em conta" />
          <Cartao
            rotulo="Desembolso alto, físico baixo"
            quantidade={r("fisico")("total").n}
            valor={r("fisico")("total").valor}
            legenda="desembolsados"
          />
        </div>

        {semConvenio && (
          <p className="pa-cartao pa-cartao-plano">
            Nenhum convênio {f.quem === "prefeitura" ? "da prefeitura " : ""}em alguma das visões do painel
            {periodo ? `, ${periodo}` : ""}.
          </p>
        )}
        <Bloco titulo="Cláusula suspensiva, pelo prazo" linhas={ficha.suspensiva.length} total={r("suspensiva")("total").n} href={noPainel("suspensiva")}>
          <TabelaSuspensiva linhas={ficha.suspensiva} naFicha />
        </Bloco>
        <Bloco titulo="Nunca desembolsados" linhas={ficha.nunca.length} total={r("nunca")("total").n} href={noPainel("nunca")}>
          <TabelaNunca linhas={ficha.nunca} naFicha />
        </Bloco>
        <Bloco titulo="Vigência acabando com execução baixa" linhas={ficha.vigencia.length} total={r("vigencia")("total").n} href={noPainel("vigencia")}>
          <TabelaVigencia linhas={ficha.vigencia} naFicha />
        </Bloco>
        <Bloco titulo="Prestação de contas, pelo valor" linhas={ficha.contas.length} href={noPainel("contas")}>
          <TabelaContas linhas={ficha.contas} naFicha />
        </Bloco>
        <Bloco titulo="Saldo parado, pelo valor" linhas={ficha.saldo.length} total={r("saldo")("parado").n} href={noPainel("saldo")}>
          <TabelaSaldo linhas={ficha.saldo} naFicha />
        </Bloco>
        <Bloco
          titulo="Desembolso alto com físico baixo, pelo valor"
          linhas={ficha.fisico.length}
          total={r("fisico")("total").n}
          href={noPainel("fisico")}
        >
          <TabelaFisico linhas={ficha.fisico} naFicha />
        </Bloco>
      </section>

      <section aria-labelledby="ficha-propostas" className="mp-radar-secao">
        <div className="mp-painel-lista-cabeca">
          <h2 id="ficha-propostas" className="mp-radar-h2">Propostas</h2>
          {ficha.porAno.length > 0 && <BotaoCsv href={urlExportarFicha(f, "propostas")} rotulo="Baixar as propostas (CSV)" />}
        </div>
        <p className="pa-sub">
          Enviadas desde {anoMinimoPropostas}, e as mais antigas ainda sem desfecho que se mexeram no último ano. O filtro
          de assinatura acima vale só para os convênios.
        </p>
        {ficha.porAno.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhuma proposta recente {f.quem === "prefeitura" ? "da prefeitura" : "no município"}.</p>
        ) : (
          <>
            <div className="mp-tabela-rolagem">
              <table className="mp-tabela mp-painel-anos-propostas">
                <thead>
                  <tr>
                    <th scope="col">Ano do envio</th>
                    <th scope="col" className="mp-num">Enviadas</th>
                    <th scope="col" className="mp-num">Assinadas</th>
                    <th scope="col" className="mp-num">Reprovadas</th>
                    <th scope="col" className="mp-num">Impedimento</th>
                    <th scope="col" className="mp-num">Sem desfecho</th>
                    <th scope="col" className="mp-num">Pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.porAno.map((a) => (
                    <tr key={a.ano_envio}>
                      <th scope="row">{a.ano_envio}</th>
                      <td className="mp-num">{n(a.enviadas)}</td>
                      <td className="mp-num">
                        {n(a.assinadas)} <span className="mp-painel-taxa">{percentual(fracao(a.assinadas, a.enviadas))}</span>
                      </td>
                      <td className="mp-num">
                        {n(a.reprovadas)}
                        {a.reprovadas_lote > 0 && <span className="mp-painel-taxa"> · {n(a.reprovadas_lote)} em lote</span>}
                      </td>
                      <td className="mp-num">
                        {n(a.impedimento)}
                        {a.impedimento_lote > 0 && <span className="mp-painel-taxa"> · {n(a.impedimento_lote)} em lote</span>}
                      </td>
                      <td className="mp-num">{n(a.sem_desfecho)}</td>
                      <td className="mp-num">{moedaCurta(a.valor_pedido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Lista titulo="Sem desfecho, das mais paradas para as menos" vazio="Nenhuma proposta esperando desfecho.">
              {ficha.semDesfecho.length > 0 && <TabelaPropostas linhas={ficha.semDesfecho} quando="movimento" />}
            </Lista>
            <Lista titulo="Reprovadas, impedidas e eliminadas, as mais recentes" vazio="Nenhuma proposta negada.">
              {ficha.negadas.length > 0 && <TabelaPropostas linhas={ficha.negadas} quando="movimento" />}
            </Lista>
            <Lista titulo="Assinadas, as mais recentes" vazio="Nenhuma proposta assinada.">
              {ficha.assinadas.length > 0 && <TabelaPropostas linhas={ficha.assinadas} quando="assinatura" />}
            </Lista>
            <p className="pa-nota">
              <strong>Em lote</strong> são 100 ou mais reprovações no mesmo dia pelo mesmo órgão: encerramento de edital, não
              análise de mérito. Os números copiados são os que se digitam na consulta de propostas e de programas do
              Transferegov.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

// ============================================================================ peças da ficha

const SINAIS_DA_FICHA: { sinal: Sinal; marca: (m: MunicipioPainel) => boolean; resumo: (m: MunicipioPainel) => string }[] = [
  { sinal: "saldo", marca: (m) => m.sinal_saldo, resumo: (m) => `${n(m.n_saldo)} · ${moedaCurta(m.valor_saldo)}` },
  { sinal: "suspensiva", marca: (m) => m.sinal_suspensiva, resumo: (m) => `${n(m.n_suspensiva)} · ${moedaCurta(m.valor_suspensiva)}` },
  { sinal: "contas_atrasadas", marca: (m) => m.sinal_contas_atrasadas, resumo: (m) => n(m.n_contas_atrasadas) },
  { sinal: "contas_negativas", marca: (m) => m.sinal_contas_negativas, resumo: (m) => n(m.n_contas_negativas) },
  {
    sinal: "sem_desembolso",
    marca: (m) => m.sinal_sem_desembolso,
    resumo: (m) => `${n(m.n_sem_desembolso)} · ${moedaCurta(m.valor_sem_desembolso)}`,
  },
];

function Sinais({ sinais }: { sinais: MunicipioPainel | null }) {
  return (
    <section aria-labelledby="ficha-sinais" className="mp-radar-secao">
      <h2 id="ficha-sinais" className="mp-radar-h2">
        Sinais da prefeitura{sinais ? ` · ${sinais.n_sinais} de 5` : ""}
      </h2>
      {!sinais ? (
        <p className="pa-cartao pa-cartao-plano">Nenhum dos cinco sinais aceso para a prefeitura.</p>
      ) : (
        <ul className="mp-painel-sinais">
          {SINAIS_DA_FICHA.map(({ sinal, marca, resumo }) => (
            <li key={sinal} className={marca(sinais) ? "mp-painel-sinal-aceso" : undefined}>
              <span className="mp-painel-sinal-marca" aria-hidden="true">
                {marca(sinais) ? "●" : "○"}
              </span>
              <span>
                <strong>{ROTULO_SINAL[sinal]}</strong>
                <span className="pa-sr">{marca(sinais) ? " — aceso" : " — apagado"}</span>
                <span className="mp-tabela-secundario">
                  {marca(sinais) ? resumo(sinais) : DESCRICAO_SINAL[sinal]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="pa-nota">Os sinais olham todos os convênios da prefeitura, de qualquer ano de assinatura.</p>
    </section>
  );
}

function Bloco({
  titulo,
  linhas,
  total,
  href,
  children,
}: {
  titulo: string;
  linhas: number;
  total?: number;
  href: string;
  children: ReactNode;
}) {
  if (linhas === 0) return null;
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">
        {titulo}
        {total !== undefined
          ? total > linhas
            ? ` · ${n(linhas)} de ${n(total)}`
            : ""
          : linhas >= LIMITE_FICHA_CONVENIOS
            ? ` · os ${n(linhas)} primeiros`
            : ""}
      </h3>
      <p className="pa-nota">
        <Link href={href}>Ver no painel, com os números por órgão</Link>
      </p>
      <div className="mp-tabela-rolagem">{children}</div>
    </div>
  );
}

function TabelaPropostas({ linhas, quando }: { linhas: PropostaPainel[]; quando: "movimento" | "assinatura" }) {
  return (
    <table className="mp-tabela">
      <thead>
        <tr>
          <th scope="col">Proponente e proposta</th>
          <th scope="col">Programa e órgão</th>
          <th scope="col">Situação</th>
          <th scope="col">{quando === "assinatura" ? "Assinada" : "Último movimento"}</th>
          <th scope="col" className="mp-num">Repasse pedido</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((p) => {
          const vez = vezDaProposta(p.desfecho);
          return (
            <tr key={p.id_proposta}>
              <th scope="row">
                <span className="mp-tabela-principal">{p.proponente ?? "—"}</span>
                <span className="mp-tabela-secundario">
                  {p.nr_proposta ? (
                    <>
                      nº {p.nr_proposta} <CopiarNumero numero={p.nr_proposta} de="proposta" />
                    </>
                  ) : (
                    `id ${p.id_proposta}`
                  )}
                  {p.dt_envio ? ` · enviada em ${formatarData(p.dt_envio)}` : ""}
                </span>
                {p.objeto && <span className="mp-tabela-secundario mp-painel-objeto">{p.objeto}</span>}
              </th>
              <td>
                <span className="mp-tabela-principal mp-painel-programa">{p.programa ?? "—"}</span>
                <span className="mp-tabela-secundario">
                  {p.cod_programa && p.cod_programa !== "(sem programa)" && (
                    <>
                      cód. {p.cod_programa} <CopiarNumero numero={p.cod_programa} de="programa" /> ·{" "}
                    </>
                  )}
                  {p.orgao_sup ?? "—"}
                </span>
              </td>
              <td>
                <span className="mp-painel-tags">
                  <span className="mp-tabela-principal">{ROTULO_DESFECHO[p.desfecho] ?? p.desfecho}</span>
                  {p.em_lote && <Tag>em lote</Tag>}
                  {p.com_emenda && <Tag>emenda</Tag>}
                  {vez && <Tag tom="proto">vez do {vez}</Tag>}
                </span>
                {p.limbo && <span className="mp-tabela-secundario mp-painel-urgente">nunca analisada</span>}
              </td>
              <td className="mp-nowrap">
                {quando === "assinatura" ? (
                  <>
                    {p.dt_assinatura ? formatarData(p.dt_assinatura) : "—"}
                    {p.nr_convenio && <span className="mp-tabela-secundario">convênio {p.nr_convenio}</span>}
                  </>
                ) : (
                  <>
                    {p.dt_ultimo_evento ? formatarData(p.dt_ultimo_evento) : "—"}
                    {p.dias_sem_evento !== null && (
                      <span className={`mp-tabela-secundario${vez && p.dias_sem_evento > 90 ? " mp-painel-urgente" : ""}`}>
                        há {idadePorExtenso(p.dias_sem_evento)}
                      </span>
                    )}
                  </>
                )}
              </td>
              <td className="mp-num">{moedaCurta(p.valor_repasse)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
