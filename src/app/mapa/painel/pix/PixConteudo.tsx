/**
 * A exibição de "Pix e fundo a fundo". Recebe os dados já lidos e só desenha.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { UFS } from "@/lib/oportunidades/organizacao";
import {
  ROTULO_LADO_MOTIVO,
  ROTULO_SITUACAO_RELATORIO,
  anosDe,
  dataDasContagens,
  filaRelatorios,
  fracaoDe,
  funilEspeciais,
  fundoPor,
  motivosSomados,
  percentual1,
  reapresentacao,
  rotuloMotivo,
  soma,
  urlPix,
  type LinhaEspecialAno,
  type LinhaFundoAno,
  type Numericas,
  type ParametrosPix,
  type PlanoEspecial,
  type PlanoFundo,
} from "@/lib/oportunidades/pix";
import type { LeituraPix } from "@/lib/oportunidades/pix.server";
import { LIMITE_LISTA } from "@/lib/oportunidades/pix.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { Cartao, Lista, n } from "../Pecas";

type LeituraOk = Extract<LeituraPix, { estado: "ok" }>;

const data = (iso: string | null | undefined) => (iso ? formatarData(iso) : "—");

export function PixConteudo({ p, leitura }: { p: ParametrosPix; leitura: LeituraOk }) {
  const c = leitura.execucao.contagens;
  const onde = p.uf ?? "Brasil";

  return (
    <div className="pa-pagina mp-radar mp-painel">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel da PONTE · uso interno</p>
        <h1 className="pa-titulo">Pix e fundo a fundo · {onde}</h1>
        <p className="pa-sub">
          Retrato das APIs do Transferegov gravado em <strong>{formatarPublicacao(leitura.execucao.concluida_em)}</strong>. Especiais:
          relatórios até {data(dataDasContagens(c, "especiais_dado_ate"))}, último pagamento registrado em{" "}
          {data(dataDasContagens(c, "especiais_ultimo_pagamento"))}. Fundo a fundo: movimento até{" "}
          {data(dataDasContagens(c, "fundo_dado_ate"))}.
        </p>
      </div>

      <nav aria-label="Seções" className="pa-chips mp-painel-visoes">
        <Link href="/mapa/painel" className="pa-chip">
          ← Painel de execução
        </Link>
        {(
          [
            ["especiais", "Transferências especiais (Pix)"],
            ["fundo", "Fundo a fundo"],
          ] as const
        ).map(([aba, rotulo]) => (
          <Link
            key={aba}
            href={urlPix(p, { aba })}
            className={`pa-chip${p.aba === aba ? " pa-ativo" : ""}`}
            aria-current={p.aba === aba ? "page" : undefined}
          >
            {rotulo}
          </Link>
        ))}
      </nav>

      <div className="mp-filtros mp-radar-filtros">
        <form method="get" action="/mapa/painel/pix" className="pa-linha mp-radar-uf mp-painel-filtros">
          {p.aba !== "especiais" && <input type="hidden" name="aba" value={p.aba} />}
          <label htmlFor="pix-uf" className="pa-campo-rotulo">
            Onde
          </label>
          <select id="pix-uf" name="uf" defaultValue={p.uf ?? ""} className="pa-select">
            <option value="">Brasil</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <button type="submit" className="pa-btn pa-btn-pequeno">
            Aplicar
          </button>
        </form>
      </div>

      <section className="mp-radar-secao">
        {p.aba === "especiais" ? <Especiais p={p} leitura={leitura} /> : <Fundo p={p} leitura={leitura} />}
      </section>
    </div>
  );
}

// ============================================================================ especiais

function Especiais({ p, leitura }: { p: ParametrosPix; leitura: LeituraOk }) {
  const recorte = p.uf ?? "BR";
  const { anos } = leitura;
  const s = (campo: Numericas<LinhaEspecialAno>) => soma(anos, recorte, campo);
  const c = leitura.execucao.contagens;
  const corte = dataDasContagens(c, "especiais_corte_lacuna");
  const anosComDuplicata = anosDe(anos, recorte).filter((a) => soma(anos, recorte, "duplicados", [a]) > 0);

  if (s("planos") === 0) {
    return <p className="pa-cartao pa-cartao-plano">Nenhum plano de transferência especial neste recorte.</p>;
  }

  return (
    <>
      <h2 className="mp-radar-h2">Transferências especiais · {p.uf ?? "Brasil"}</h2>
      <p className="pa-sub">
        A emenda individual que cai direto na conta do ente, sem convênio: o ente dá ciência, apresenta o plano de trabalho, recebe e
        presta contas por relatório de gestão.
      </p>

      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <Cartao rotulo="Planos de ação" quantidade={s("planos")} valor={s("indicado")} legenda="indicados" />
        <Cartao
          rotulo="Com pagamento"
          quantidade={s("planos_pagos")}
          valor={s("pago")}
          legenda={`(${percentual1(fracaoDe(s("pago"), s("indicado")))} do indicado)`}
        />
        <Cartao rotulo="Impedidos" quantidade={s("impedidos")} valor={s("valor_impedido")} legenda="sem poder receber" />
      </div>
      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <Cartao
          rotulo="Pagos há +12 meses sem relatório"
          quantidade={s("planos_12m_sem_relatorio")}
          valor={s("pago_12m_sem_relatorio")}
          legenda={`(${percentual1(fracaoDe(s("pago_12m_sem_relatorio"), s("pago_12m")))} do pago até ${data(corte)})`}
          tom="urgente"
          nota="Não consta relatório de gestão entregue na API. Não quer dizer irregular."
        />
        <Cartao
          rotulo="Execução encerrada sem relatório final"
          quantidade={s("planos_encerrada_sem_final")}
          valor={s("pago_encerrada_sem_final")}
          legenda="pagos"
        />
        <Cartao
          rotulo="Contados duas vezes"
          quantidade={s("duplicados")}
          valor={s("valor_duplicado")}
          legenda={anosComDuplicata.length ? `em ${anosComDuplicata.join(", ")}` : ""}
          nota="Impedido com um plano idêntico (emenda, CNPJ e valores) num ciclo posterior do mesmo ano: o valor aparece duas vezes na API."
        />
      </div>

      <Funil p={p} leitura={leitura} />
      <PorAnoEspeciais recorte={recorte} leitura={leitura} />
      <Motivos recorte={recorte} leitura={leitura} />
      <Reapresentacao recorte={recorte} leitura={leitura} />

      {leitura.especiais ? (
        <>
          <Lista
            titulo={`Pagos há mais de 12 meses sem relatório entregue · os ${LIMITE_LISTA} maiores`}
            vazio="Nenhum plano nessa situação."
          >
            {leitura.especiais.semRelatorio.length > 0 && <TabelaPlanosEspeciais linhas={leitura.especiais.semRelatorio} coluna="pago" />}
          </Lista>
          <Lista titulo={`Impedidos · os ${LIMITE_LISTA} mais recentes e maiores`} vazio="Nenhum plano impedido.">
            {leitura.especiais.impedidos.length > 0 && <TabelaPlanosEspeciais linhas={leitura.especiais.impedidos} coluna="motivo" />}
          </Lista>
          <Lista titulo={`Execução encerrada sem relatório final · os ${LIMITE_LISTA} maiores`} vazio="Nenhum plano nessa situação.">
            {leitura.especiais.encerradaSemFinal.length > 0 && (
              <TabelaPlanosEspeciais linhas={leitura.especiais.encerradaSemFinal} coluna="fim" />
            )}
          </Lista>
        </>
      ) : (
        <p className="pa-nota">
          A lista plano a plano sai só para {leitura.ufLista}.{" "}
          <Link href={urlPix(p, { uf: leitura.ufLista })}>Ver {leitura.ufLista}</Link>.
        </p>
      )}

      <Ressalvas>
        <li>
          Retrato semanal das APIs públicas do Transferegov. Na mesma data, os relatórios continuam chegando e os pagamentos do ano já
          saíram: a lacuna diminui à medida que os entes entregam.
        </li>
        <li>
          &quot;Pago&quot; é o valor do documento hábil com ordem bancária emitida. &quot;Relatório entregue&quot; é o relatório de gestão
          disponibilizado ou enviado para análise, no modelo novo ou no antigo.
        </li>
        <li>
          Sem registro na API, o painel diz &quot;não consta&quot;, nunca &quot;irregular&quot;: o relatório pode existir fora dela.
        </li>
        <li>
          Em 2025, planos impedidos no 1º ciclo e reapresentados iguais no 2º aparecem duas vezes na API. Os cartões mostram o valor para
          descontar; os totais por ano não descontam, para bater com a fonte.
        </li>
      </Ressalvas>
    </>
  );
}

function Funil({ p, leitura }: { p: ParametrosPix; leitura: LeituraOk }) {
  const etapas = funilEspeciais(leitura.anos, p.uf ?? "BR");
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">O caminho do dinheiro</h3>
      <div className="mp-tabela-rolagem">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Etapa</th>
              <th scope="col" className="mp-num">Valor</th>
              <th scope="col" className="mp-num">Do indicado</th>
            </tr>
          </thead>
          <tbody>
            {etapas.map((e) => (
              <tr key={e.rotulo}>
                <th scope="row">
                  {e.rotulo}
                  {e.nota && <span className="mp-tabela-secundario">{e.nota}</span>}
                </th>
                <td className="mp-num">{moedaCurta(e.valor)}</td>
                <td className="mp-num">{percentual1(e.fracao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PorAnoEspeciais({ recorte, leitura }: { recorte: string; leitura: LeituraOk }) {
  const linhas = leitura.anos.filter((l) => l.recorte === recorte).sort((a, b) => (a.ano ?? 0) - (b.ano ?? 0));
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">Por ano do plano</h3>
      <div className="mp-tabela-rolagem">
        <table className="mp-tabela mp-pix-anos">
          <thead>
            <tr>
              <th scope="col">Ano</th>
              <th scope="col" className="mp-num">Planos</th>
              <th scope="col" className="mp-num">Indicado</th>
              <th scope="col" className="mp-num">Impedido</th>
              <th scope="col" className="mp-num">Pago</th>
              <th scope="col" className="mp-num">Com relatório</th>
              <th scope="col" className="mp-num">Com final</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.ano}>
                <th scope="row">{l.ano}</th>
                <td className="mp-num">{n(l.planos)}</td>
                <td className="mp-num">{moedaCurta(l.indicado)}</td>
                <td className="mp-num">{moedaCurta(l.valor_impedido)}</td>
                <td className="mp-num">{moedaCurta(l.pago)}</td>
                <td className="mp-num">{percentual1(fracaoDe(l.pago_com_relatorio, l.pago))}</td>
                <td className="mp-num">{percentual1(fracaoDe(l.pago_com_final, l.pago))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pa-nota">Com relatório e com final: fração do valor pago.</p>
    </div>
  );
}

function Motivos({ recorte, leitura }: { recorte: string; leitura: LeituraOk }) {
  const linhas = motivosSomados(leitura.motivos, recorte);
  if (linhas.length === 0) return null;
  const total = linhas.reduce((t, l) => t + l.valor, 0);
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">Por que ficaram impedidos</h3>
      <div className="mp-tabela-rolagem">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Motivo</th>
              <th scope="col">De quem era a vez</th>
              <th scope="col" className="mp-num">Planos</th>
              <th scope="col" className="mp-num">Valor</th>
              <th scope="col" className="mp-num">Do impedido</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.motivo}>
                <th scope="row">{l.rotulo}</th>
                <td>{ROTULO_LADO_MOTIVO[l.lado]}</td>
                <td className="mp-num">{n(l.impedidos)}</td>
                <td className="mp-num">{moedaCurta(l.valor)}</td>
                <td className="mp-num">{percentual1(fracaoDe(l.valor, total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Reapresentacao({ recorte, leitura }: { recorte: string; leitura: LeituraOk }) {
  const anos = reapresentacao(leitura.motivos, recorte);
  if (anos.length === 0) return null;
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">Impedidos que voltaram no mesmo ano</h3>
      <p className="pa-nota">
        Impedido no 1º ciclo com um plano igual (mesma emenda, mesmo CNPJ, mesmos valores) num ciclo posterior do mesmo exercício, que
        ficou ciente. O pago é o do plano novo.
      </p>
      <div className="mp-tabela-rolagem">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Ano</th>
              <th scope="col" className="mp-num">Impedidos no 1º ciclo</th>
              <th scope="col" className="mp-num">Reapresentados</th>
              <th scope="col" className="mp-num">Fração</th>
              <th scope="col" className="mp-num">Pago no plano novo</th>
            </tr>
          </thead>
          <tbody>
            {anos.map((a) => (
              <tr key={a.ano}>
                <th scope="row">{a.ano}</th>
                <td className="mp-num">{n(a.impedidosCiclo1)}</td>
                <td className="mp-num">{n(a.reapresentados)}</td>
                <td className="mp-num">{percentual1(a.fracao)}</td>
                <td className="mp-num">{moedaCurta(a.pagoNoGemeo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelaPlanosEspeciais({ linhas, coluna }: { linhas: PlanoEspecial[]; coluna: "pago" | "motivo" | "fim" }) {
  return (
    <table className="mp-tabela mp-pix-planos">
      <thead>
        <tr>
          <th scope="col">Ente e plano</th>
          <th scope="col" className="mp-num">{coluna === "motivo" ? "Valor" : "Pago"}</th>
          <th scope="col">{coluna === "motivo" ? "Motivo" : coluna === "fim" ? "Fim da execução" : "Primeiro pagamento"}</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.id_plano_acao}>
            <th scope="row">
              <span className="mp-tabela-principal">{l.beneficiario ?? "—"}</span>
              <span className="mp-tabela-secundario">
                plano {l.codigo_plano_acao ?? l.id_plano_acao} · {l.ano}
                {l.numero_emenda ? ` · emenda ${l.numero_emenda}` : ""}
                {l.duplicado ? " · contado duas vezes" : ""}
              </span>
            </th>
            <td className="mp-num">{moedaCurta(coluna === "motivo" ? l.valor : l.pago)}</td>
            <td>
              {coluna === "motivo" ? (
                <>
                  {rotuloMotivo(l.motivo)}
                  {l.reapresentado && <span className="mp-tabela-secundario">reapresentado no mesmo ano</span>}
                </>
              ) : coluna === "fim" ? (
                data(l.fim_execucao)
              ) : (
                data(l.dt_primeira_ob)
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================================ fundo a fundo

function Fundo({ p, leitura }: { p: ParametrosPix; leitura: LeituraOk }) {
  const recorte = p.uf ?? "BR";
  const linhas = leitura.fundoAnos;
  const s = (campo: Numericas<LinhaFundoAno>) => soma(linhas, recorte, campo);
  const c = leitura.execucao.contagens;
  const num = (k: string) => Number(c[k] ?? 0);
  const porAno = fundoPor(linhas, recorte, "ano");
  const porOrgao = fundoPor(linhas, recorte, "orgao");
  const fila = filaRelatorios(leitura.relatorios, recorte);
  const corte = dataDasContagens(c, "fundo_corte_parado");

  if (s("planos") === 0) {
    return <p className="pa-cartao pa-cartao-plano">Nenhum plano de fundo a fundo neste recorte.</p>;
  }

  return (
    <>
      <h2 className="mp-radar-h2">Fundo a fundo no Transferegov · {p.uf ?? "Brasil"}</h2>
      <p className="pa-sub">
        Repasse de fundo federal para fundo do ente, por plano de ação: segurança pública, cultura, esporte, educação e outros. SUS e
        SUAS passam pelo FNS e pelo FNAS e não estão aqui.
      </p>

      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <Cartao rotulo="Planos de ação" quantidade={s("planos")} valor={s("repasse")} legenda="de repasse federal" />
        <Cartao rotulo="Autorizados" quantidade={s("planos_autorizados")} valor={s("repasse_autorizado")} legenda="de repasse" />
        <Cartao
          rotulo="Vigência encerrada com saldo"
          quantidade={s("planos_encerrada_com_saldo")}
          valor={s("saldo_encerrada")}
          legenda="em conta"
          tom="urgente"
          nota="Saldo acima de R$ 1 mil, pelo saldo final informado da conta (sem data de referência)."
        />
      </div>

      {leitura.fundo && (
        <div className="pa-grade pa-grade-3 mp-painel-cartoes">
          <Cartao
            rotulo="Com saldo em conta"
            quantidade={num("fundo_uf_planos_com_saldo")}
            valor={num("fundo_uf_saldo")}
            legenda="de saldo"
          />
          <Cartao
            rotulo="Parados há +12 meses"
            quantidade={num("fundo_uf_parados")}
            valor={num("fundo_uf_saldo_parado")}
            legenda="de saldo"
            tom="urgente"
            nota={`Repasse creditado antes de ${data(corte)}, mais de R$ 1 mil na conta e nenhum pagamento nos últimos 12 meses.`}
          />
          <Cartao
            rotulo="Parados sem nunca ter pago"
            quantidade={num("fundo_uf_parados_nunca_pagou")}
            valor={num("fundo_uf_saldo_parado_nunca_pagou")}
            legenda="de saldo"
          />
        </div>
      )}

      <div className="mp-radar-recorte">
        <h3 className="mp-radar-h3">Por ano do programa</h3>
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Ano</th>
                <th scope="col" className="mp-num">Planos</th>
                <th scope="col" className="mp-num">Repasse</th>
                <th scope="col" className="mp-num">Autorizado</th>
                <th scope="col" className="mp-num">Saldo em conta</th>
              </tr>
            </thead>
            <tbody>
              {porAno.map((l) => (
                <tr key={l.chave}>
                  <th scope="row">{l.chave}</th>
                  <td className="mp-num">{n(l.planos)}</td>
                  <td className="mp-num">{moedaCurta(l.repasse)}</td>
                  <td className="mp-num">{moedaCurta(l.repasseAutorizado)}</td>
                  <td className="mp-num">{moedaCurta(l.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mp-radar-recorte">
        <h3 className="mp-radar-h3">Por órgão repassador</h3>
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Órgão</th>
                <th scope="col" className="mp-num">Planos</th>
                <th scope="col" className="mp-num">Repasse</th>
                <th scope="col" className="mp-num">Saldo em conta</th>
                <th scope="col" className="mp-num">Encerrados com saldo</th>
              </tr>
            </thead>
            <tbody>
              {porOrgao.map((l) => (
                <tr key={l.chave}>
                  <th scope="row">{l.chave}</th>
                  <td className="mp-num">{n(l.planos)}</td>
                  <td className="mp-num">{moedaCurta(l.repasse)}</td>
                  <td className="mp-num">{moedaCurta(l.saldo)}</td>
                  <td className="mp-num">{n(l.encerradaComSaldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {fila.length > 0 && (
        <div className="mp-radar-recorte">
          <h3 className="mp-radar-h3">Relatórios de gestão dos planos em execução</h3>
          <p className="pa-nota">Pela situação do último relatório de cada plano.</p>
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Situação do último relatório</th>
                  <th scope="col" className="mp-num">Planos</th>
                  <th scope="col" className="mp-num">Repasse</th>
                  <th scope="col">O mais antigo é de</th>
                </tr>
              </thead>
              <tbody>
                {fila.map((l) => (
                  <tr key={l.situacao}>
                    <th scope="row">{l.rotulo}</th>
                    <td className="mp-num">{n(l.planos)}</td>
                    <td className="mp-num">{moedaCurta(l.repasse)}</td>
                    <td>{data(l.maisAntigo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {leitura.fundo ? (
        <>
          <Lista titulo={`Parados há mais de 12 meses · os ${LIMITE_LISTA} maiores saldos`} vazio="Nenhum plano parado.">
            {leitura.fundo.parados.length > 0 && <TabelaPlanosFundo linhas={leitura.fundo.parados} coluna="pagamento" />}
          </Lista>
          <Lista titulo={`Vigência encerrada com saldo · os ${LIMITE_LISTA} maiores`} vazio="Nenhum plano nessa situação.">
            {leitura.fundo.encerradosComSaldo.length > 0 && <TabelaPlanosFundo linhas={leitura.fundo.encerradosComSaldo} coluna="vigencia" />}
          </Lista>
          <Lista titulo={`Relatório aguardando análise · os ${LIMITE_LISTA} mais antigos`} vazio="Nenhum relatório aguardando análise.">
            {leitura.fundo.aguardandoAnalise.length > 0 && <TabelaPlanosFundo linhas={leitura.fundo.aguardandoAnalise} coluna="relatorio" />}
          </Lista>
        </>
      ) : (
        <p className="pa-nota">
          O extrato das contas e a lista plano a plano saem só para {leitura.ufLista}.{" "}
          <Link href={urlPix(p, { uf: leitura.ufLista })}>Ver {leitura.ufLista}</Link>.
        </p>
      )}

      <Ressalvas>
        <li>Valor é a parcela federal do plano (repasse); o ano é o do programa.</li>
        <li>
          O saldo é o saldo final que a API informa para cada conta, sem data de referência. Conta usada por mais de um plano entra uma vez,
          no plano mais antigo.
        </li>
        <li>
          &quot;Parado&quot; lê o extrato: repasse creditado, saldo acima de R$ 1 mil e nenhum pagamento (transferência, PIX, boleto,
          tributo ou ordem bancária com subtransações) nos últimos 12 meses. Aplicação financeira e tarifa não contam como pagamento.
        </li>
        <li>Não inclui SUS e SUAS, que são repassados pelo FNS e pelo FNAS fora do Transferegov.</li>
      </Ressalvas>
    </>
  );
}

function TabelaPlanosFundo({ linhas, coluna }: { linhas: PlanoFundo[]; coluna: "pagamento" | "vigencia" | "relatorio" }) {
  return (
    <table className="mp-tabela mp-pix-planos">
      <thead>
        <tr>
          <th scope="col">Ente e plano</th>
          <th scope="col" className="mp-num">{coluna === "relatorio" ? "Repasse" : "Saldo"}</th>
          <th scope="col">
            {coluna === "pagamento" ? "Último pagamento" : coluna === "vigencia" ? "Fim da vigência" : "Relatório enviado em"}
          </th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.id_plano_acao}>
            <th scope="row">
              <span className="mp-tabela-principal">{l.ente ?? "—"}</span>
              <span className="mp-tabela-secundario">
                {l.orgao ?? "—"} · {l.programa ?? "—"} · {l.ano} · plano {l.codigo_plano_acao ?? l.id_plano_acao}
              </span>
            </th>
            <td className="mp-num">{moedaCurta(coluna === "relatorio" ? l.repasse : l.saldo_contas)}</td>
            <td>
              {coluna === "pagamento" ? (
                l.dt_ultimo_pagamento ? (
                  data(l.dt_ultimo_pagamento)
                ) : (
                  <span className="mp-painel-urgente">nunca pagou</span>
                )
              ) : coluna === "vigencia" ? (
                data(l.fim_vigencia)
              ) : (
                <>
                  {data(l.dt_relatorio)}
                  <span className="mp-tabela-secundario">
                    {l.tipo_relatorio === "FINAL" ? "final" : "parcial"} ·{" "}
                    {ROTULO_SITUACAO_RELATORIO[l.situacao_relatorio ?? ""] ?? l.situacao_relatorio}
                  </span>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================================ peças

function Ressalvas({ children }: { children: ReactNode }) {
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">Como ler</h3>
      <ul className="pa-nota mp-pix-ressalvas">{children}</ul>
    </div>
  );
}

export function PixIndisponivel({ estado }: { estado: "nao_ativado" | "sem_execucao" | "erro" }) {
  const texto = {
    nao_ativado: {
      titulo: "Pix e fundo a fundo ainda não foi ativado no banco",
      corpo: "Falta aplicar a migração oport_13 no Supabase.",
    },
    sem_execucao: {
      titulo: "Pix e fundo a fundo ainda não rodou",
      corpo: "As tabelas existem, mas nenhuma execução foi concluída. O job roda toda semana no workflow pix-fundo do monorepo.",
    },
    erro: {
      titulo: "Pix e fundo a fundo está indisponível agora",
      corpo: "A leitura dos dados falhou. O detalhe está no registro do servidor.",
    },
  }[estado];
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">Painel da PONTE · uso interno</p>
        <h1 className="pa-titulo">{texto.titulo}</h1>
        <p>{texto.corpo}</p>
        <p>
          <Link href="/mapa/painel">Voltar ao painel de execução</Link>
        </p>
      </div>
    </div>
  );
}
