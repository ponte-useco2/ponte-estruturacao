/**
 * Simular um projeto num município da PB: o que ele já tem, o formulário, o diagnóstico com o caminho
 * mínimo, os limites da operação ano a ano e o cronograma. A mesma página é o relatório para imprimir.
 */
import Link from "next/link";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import {
  AVISO_FIXO,
  DECISOES,
  MARCA_ESTADO,
  ROTULO_ESTADO,
  pct,
  urlMunicipioFiscal,
  urlSimularFiscal,
  type EstadoFiscal,
} from "@/lib/oportunidades/fiscal";
import type { LeituraMunicipioFiscal } from "@/lib/oportunidades/fiscal.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import {
  ALERTA_DCL,
  ALERTA_OPERACOES,
  ALERTA_SERVICO,
  LIMITE_DCL,
  LIMITE_OPERACOES,
  LIMITE_SERVICO,
  PREMISSAS,
  baseFiscal,
  diagnosticar,
  moeda,
  parametrosSimulador,
  simular,
  urlSimulador,
  valorMaximo,
  type Campo,
  type Diagnostico,
  type ParametrosSimulador,
  type Simulacao,
  type TipoProvidencia,
} from "@/lib/oportunidades/simulador";
import { Tag } from "../../../../_design/primitivos";
import { EstadoDecisao } from "../../FiscalConteudo";
import { BotaoImprimir } from "./BotaoImprimir";

type LeituraOk = Extract<LeituraMunicipioFiscal, { estado: "ok" }>;

const AVISO_SIMULADOR =
  "A simulação soma uma operação hipotética ao que as fontes registram, com as premissas do fim da página. É estimativa para " +
  "preparar o pedido, não resultado da análise da STN.";

const ROTULO_TIPO: Record<TipoProvidencia, string> = {
  bloqueio: "bloqueia",
  limite: "limite da operação",
  contrapartida: "contrapartida",
  conferir: "conferir",
  documento: "documento",
  alerta: "acompanhar",
};

const FRASE_ESTADO: Record<EstadoFiscal, string> = {
  nao_atendido: "Há o que resolver antes de captar.",
  nao_verificavel: "Nenhum bloqueio automático, mas há dado a conferir na fonte.",
  atencao: "Nenhum bloqueio automático; há pontos a acompanhar.",
  desatualizado: "Nenhum bloqueio automático; há pontos a acompanhar.",
  atendido: "Nenhum bloqueio nas verificações automáticas.",
};

export function SimuladorConteudo({ leitura, sp }: { leitura: LeituraOk; sp: Record<string, string | string[] | undefined> }) {
  const m = leitura.municipio;
  const p = parametrosSimulador(sp, Number(leitura.execucao.concluida_em.slice(0, 4)) + 1);
  const base = baseFiscal(m.indicadores, leitura.projecao);
  const simulacao = p.operacao ? simular(base, p.operacao, p.crescimento) : null;
  const maximo = p.operacao ? valorMaximo(base, p.operacao, p.crescimento) : null;
  const diagnostico = p.projeto
    ? diagnosticar({ projeto: p.projeto, conclusoes: m.conclusoes, verificacoes: leitura.verificacoes, base, simulacao })
    : null;
  const ind = m.indicadores;
  const servico = ind.servico_ano;
  const versao = leitura.verificacoes[0]?.versao;

  return (
    <div className="pa-pagina mp-radar mp-painel mp-fiscal mp-simulador">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">
          <Link href="/mapa/fiscal">Capacidade fiscal · Paraíba</Link> · <Link href={urlMunicipioFiscal(m.ibge)}>{m.nome}</Link>
        </p>
        <h1 className="pa-titulo">Simular um projeto · {m.nome}/PB</h1>
        <p className="pa-sub">
          IBGE {m.ibge} · leitura de <strong>{formatarPublicacao(leitura.execucao.concluida_em)}</strong>. Some um projeto ao que o município
          já tem e veja o que falta resolver e, se houver crédito, os limites ano a ano.
        </p>
        <p className="mp-fiscal-aviso">
          {AVISO_FIXO} {AVISO_SIMULADOR}
        </p>
      </div>

      <section aria-labelledby="sim-base" className="mp-radar-secao">
        <h2 id="sim-base" className="mp-radar-h2">
          O que o município já tem
        </h2>
        <dl className="pa-cartao mp-fiscal-evidencia">
          <div>
            <dt>RCL ajustada</dt>
            <dd>
              {moedaCurta(base.rcl)}
              {base.rgf ? ` · RGF ${base.rgf}` : ""}
            </dd>
          </div>
          <div>
            <dt>Dívida consolidada líquida</dt>
            <dd>
              {moedaCurta(base.dcl)} · {pct(ind.dcl_pct)} da RCL
            </dd>
          </div>
          <div>
            <dt>Comprometimento com a dívida no ano</dt>
            <dd>
              {servico ? `${moedaCurta(servico.valor)} · ${base.rcl ? pct((servico.valor / base.rcl) * 100) : "—"} da RCL` : "—"}
              {servico && (
                <span className="mp-tabela-secundario">
                  {servico.fonte === "sadipem" ? `cronograma do PVL ${servico.pvl}` : `empenhado em ${servico.exercicio} (RREO), repetido`}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Operações de crédito no exercício</dt>
            <dd>
              {moedaCurta(base.operacoesExercicio)} · {pct(ind.operacoes_pct)} da RCL
            </dd>
          </div>
          <div>
            <dt>Caixa não vinculado{base.caixa ? ` em 31/12/${base.caixa.exercicio}` : ""}</dt>
            <dd>{base.caixa ? moedaCurta(base.caixa.valor) : "—"}</dd>
          </div>
          <div>
            <dt>Pedido de referência no SADIPEM</dt>
            <dd>
              {base.pvl ? (
                <>
                  {base.pvl.num_pvl ?? base.pvl.id_pleito} · {base.pvl.status}
                  <span className="mp-tabela-secundario">
                    {base.pvl.data_protocolo ? `protocolo em ${formatarData(base.pvl.data_protocolo)} · ` : ""}
                    {moedaCurta(base.pvl.valor)}
                    {base.pvl.finalidade ? ` · ${base.pvl.finalidade}` : ""}
                  </span>
                </>
              ) : (
                "nenhum nos últimos 5 anos"
              )}
            </dd>
          </div>
        </dl>
        {base.pvl?.pendente && (
          <p className="pa-nota">
            O pedido {base.pvl.num_pvl ?? base.pvl.id_pleito} está em curso e o cronograma dele já entra no que o município tem. Se a
            simulação for desse mesmo pedido, a operação conta duas vezes.
          </p>
        )}
      </section>

      <Formulario ibge={m.ibge} p={p} />

      {diagnostico && p.projeto && (
        <>
          <section aria-labelledby="sim-resultado" className="mp-radar-secao">
            <div className="pa-linha mp-simulador-titulo">
              <h2 id="sim-resultado" className="mp-radar-h2">
                Resultado
              </h2>
              <span className="mp-nao-imprimir">
                <BotaoImprimir />
              </span>
            </div>
            <Resumo diagnostico={diagnostico} p={p} maximo={maximo} />
          </section>

          <Caminho diagnostico={diagnostico} />

          {simulacao && <Limites simulacao={simulacao} />}

          <section aria-labelledby="sim-premissas" className="mp-radar-secao">
            <h2 id="sim-premissas" className="mp-radar-h2">
              Premissas e fontes
            </h2>
            <ul className="mp-simulador-premissas">
              {PREMISSAS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="mp-simulador-procedencia">
              Painel fiscal lido em {formatarPublicacao(leitura.execucao.concluida_em)}
              {versao ? `, regras na versão ${versao}` : ""}. Endereço desta simulação: {decodeURIComponent(urlSimulador(m.ibge, p.bruto))}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------ formulário

function Campo({ nome, rotulo, p, dica }: { nome: Campo; rotulo: string; p: ParametrosSimulador; dica?: string }) {
  const id = `sim-${nome}`;
  return (
    <span className="mp-busca-campo">
      <label htmlFor={id} className="pa-campo-rotulo">
        {rotulo}
      </label>
      <input
        id={id}
        name={nome}
        defaultValue={p.bruto[nome]}
        className="pa-input"
        inputMode="decimal"
        autoComplete="off"
        aria-describedby={dica ? `${id}-dica` : undefined}
      />
      {dica && (
        <span id={`${id}-dica`} className="mp-simulador-dica">
          {dica}
        </span>
      )}
    </span>
  );
}

function Formulario({ ibge, p }: { ibge: string; p: ParametrosSimulador }) {
  return (
    // `key`: a navegação do "Limpar" troca os valores iniciais; sem remontar, o campo guardaria o antigo.
    <form key={JSON.stringify(p.bruto)} method="get" action={urlSimularFiscal(ibge)} className="pa-cartao mp-simulador-form mp-nao-imprimir">
      {p.erros.length > 0 && (
        <div role="alert" className="mp-simulador-erros">
          <p>Corrija para simular:</p>
          <ul>
            {p.erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <fieldset className="mp-simulador-grupo">
        <legend>O projeto</legend>
        <div className="mp-simulador-campos">
          <Campo nome="total" rotulo="Valor total (R$)" p={p} dica="Opcional. O que não vier de repasse nem de crédito é contrapartida." />
          <Campo nome="repasse" rotulo="Repasse (R$)" p={p} dica="Transferência voluntária: convênio, contrato de repasse." />
          <Campo nome="credito" rotulo="Operação de crédito (R$)" p={p} />
        </div>
      </fieldset>
      <fieldset className="mp-simulador-grupo">
        <legend>Condições do crédito</legend>
        <div className="mp-simulador-campos">
          <Campo nome="taxa" rotulo="Juros (% ao ano)" p={p} />
          <Campo nome="prazo" rotulo="Prazo total (anos)" p={p} dica="Com a carência incluída." />
          <Campo nome="carencia" rotulo="Carência (anos)" p={p} dica="Precisa cobrir os anos de liberação." />
          <Campo nome="liberacao" rotulo="Anos de liberação" p={p} />
          <span className="mp-busca-campo">
            <label htmlFor="sim-sistema" className="pa-campo-rotulo">
              Amortização
            </label>
            <select id="sim-sistema" name="sistema" defaultValue={p.bruto.sistema} className="pa-select">
              <option value="sac">SAC (amortização constante)</option>
              <option value="price">Price (prestação constante)</option>
            </select>
          </span>
          <Campo nome="inicio" rotulo="Ano da 1ª liberação" p={p} />
          <Campo nome="crescimento" rotulo="Crescimento real da RCL (% ao ano)" p={p} dica="0 é o conservador." />
        </div>
      </fieldset>
      <div className="pa-linha mp-simulador-acoes">
        <button type="submit" className="pa-btn pa-btn-primario">
          Simular
        </button>
        <Link href={urlSimularFiscal(ibge)} className="pa-btn">
          Limpar
        </Link>
      </div>
    </form>
  );
}

// ------------------------------------------------------------ resultado

function Resumo({ diagnostico: d, p, maximo }: { diagnostico: Diagnostico; p: ParametrosSimulador; maximo: number | null }) {
  const projeto = p.projeto!;
  const op = p.operacao;
  const nomes = d.decisoes.map((id) => DECISOES.find((x) => x.id === id)?.curto ?? id);
  return (
    <article className={`pa-cartao mp-fiscal-decisao mp-fiscal-${d.estado}`}>
      <p className="mp-simulador-estado">
        <EstadoDecisao estado={d.estado} /> {FRASE_ESTADO[d.estado]}
      </p>
      <dl className="mp-fiscal-evidencia">
        <div>
          <dt>Projeto</dt>
          <dd>{moeda(projeto.total ?? projeto.repasse + projeto.credito)}</dd>
        </div>
        <div>
          <dt>Repasse · crédito · contrapartida</dt>
          <dd>
            {moeda(projeto.repasse)} · {moeda(projeto.credito)} · {moeda(d.contrapartida)}
          </dd>
        </div>
        {op && (
          <div>
            <dt>Condições do crédito</dt>
            <dd>
              {pct(op.taxa)} ao ano · {op.prazo} anos com {op.carencia} de carência · liberação em {op.liberacao}{" "}
              {op.liberacao === 1 ? "ano" : "anos"} a partir de {op.inicio} · {op.sistema === "sac" ? "SAC" : "Price"} · RCL crescendo{" "}
              {pct(p.crescimento)} ao ano
            </dd>
          </div>
        )}
        {op && (
          <div>
            <dt>Maior crédito nessas condições</dt>
            <dd>
              {maximo === null
                ? "não calculado: falta dado de algum limite"
                : maximo === 0
                  ? "nenhum: os limites já passam sem a operação"
                  : moeda(maximo)}
            </dd>
          </div>
        )}
        <div>
          <dt>Decisões consideradas</dt>
          <dd>{nomes.join(" · ")}</dd>
        </div>
      </dl>
      {d.notaContrapartida && <p className="mp-simulador-dica">{d.notaContrapartida}</p>}
    </article>
  );
}

function Caminho({ diagnostico: d }: { diagnostico: Diagnostico }) {
  return (
    <section aria-labelledby="sim-caminho" className="mp-radar-secao">
      <h2 id="sim-caminho" className="mp-radar-h2">
        O caminho mínimo
      </h2>
      {d.providencias.length === 0 ? (
        <p className="pa-cartao pa-cartao-plano">Nenhuma providência apontada pelas verificações automáticas.</p>
      ) : (
        <ol className="mp-simulador-caminho">
          {d.providencias.map((pr, i) => (
            <li key={`${pr.tipo}-${pr.codigo ?? i}`} className={`pa-cartao mp-simulador-passo mp-simulador-${pr.tipo}`}>
              <p>
                <span className="pa-mono mp-simulador-tipo">{ROTULO_TIPO[pr.tipo]}</span> <strong>{pr.texto}</strong>
              </p>
              <p className="mp-simulador-porque">{pr.porque}</p>
            </li>
          ))}
        </ol>
      )}
      {d.acompanhar.length > 0 && (
        <>
          <h3 className="mp-simulador-h3">Para acompanhar</h3>
          <ul className="mp-simulador-acompanhar">
            {d.acompanhar.map((pr) => (
              <li key={pr.codigo ?? pr.texto}>
                <strong>{pr.texto}</strong> <span className="mp-simulador-porque">{pr.porque}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Percentual({ v, limite, alerta }: { v: number | null; limite: number; alerta: number }) {
  if (v === null) return <>—</>;
  const estado: EstadoFiscal | null = v > limite ? "nao_atendido" : v > alerta ? "atencao" : null;
  if (!estado) return <>{pct(v)}</>;
  return (
    <span className={`mp-simulador-marca mp-fiscal-${estado}`}>
      {pct(v)} <span aria-hidden="true">{MARCA_ESTADO[estado]}</span>
      <span className="pa-sr"> ({ROTULO_ESTADO[estado].toLowerCase()})</span>
    </span>
  );
}

function Limites({ simulacao: s }: { simulacao: Simulacao }) {
  const g5 = s.limites.find((l) => l.codigo === "G5");
  const total = (k: "liberacao" | "juros" | "amortizacao" | "servico") => s.cronograma.reduce((soma, l) => soma + l[k], 0);
  return (
    <section aria-labelledby="sim-limites" className="mp-radar-secao">
      <h2 id="sim-limites" className="mp-radar-h2">
        Limites da operação de crédito
      </h2>
      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        {s.limites.map((l) => (
          <article key={l.codigo} className={`pa-cartao mp-fiscal-decisao mp-fiscal-${l.estado}`}>
            <h3 className="pa-mono">{l.nome}</h3>
            <p>
              <Tag tom={l.estado === "atendido" ? "aderente" : l.estado === "nao_atendido" ? "urgente" : l.estado === "atencao" ? "proto" : "neutro"}>
                <span aria-hidden="true">{MARCA_ESTADO[l.estado]} </span>
                {ROTULO_ESTADO[l.estado]}
              </Tag>
            </p>
            <p className="mp-simulador-porque">{l.frase}</p>
          </article>
        ))}
      </div>

      <h3 className="mp-simulador-h3">Ano a ano</h3>
      <div className="mp-tabela-rolagem">
        <table className="mp-tabela mp-simulador-tabela">
          <caption className="pa-sr">Liberações, serviço da dívida e dívida consolidada líquida, com a operação simulada, por ano</caption>
          <thead>
            <tr>
              <th scope="col">Ano</th>
              <th scope="col" className="mp-num">RCL projetada</th>
              <th scope="col" className="mp-num">Liberações já previstas</th>
              <th scope="col" className="mp-num">Liberação simulada</th>
              <th scope="col" className="mp-num">Operações · limite 16%</th>
              <th scope="col" className="mp-num">Serviço existente</th>
              <th scope="col" className="mp-num">Serviço simulado</th>
              <th scope="col" className="mp-num">Serviço · média até 11,5%</th>
              <th scope="col" className="mp-num">DCL aproximada · limite 120%</th>
            </tr>
          </thead>
          <tbody>
            {s.anos.map((a) => (
              <tr key={a.ano}>
                <th scope="row">{a.ano}</th>
                <td className="mp-num">{moedaCurta(a.rcl)}</td>
                <td className="mp-num">{moedaCurta(a.liberacaoExistente)}</td>
                <td className="mp-num">{moedaCurta(a.liberacaoSimulada)}</td>
                <td className="mp-num">
                  <Percentual v={a.operacoesPct} limite={LIMITE_OPERACOES} alerta={ALERTA_OPERACOES} />
                </td>
                <td className="mp-num">{moedaCurta(a.servicoExistente)}</td>
                <td className="mp-num">{moedaCurta(a.servicoSimulado)}</td>
                <td className="mp-num">
                  <Percentual v={a.servicoPct} limite={LIMITE_SERVICO} alerta={ALERTA_SERVICO} />
                </td>
                <td className="mp-num">
                  <Percentual v={a.dclPct} limite={LIMITE_DCL} alerta={ALERTA_DCL} />
                </td>
              </tr>
            ))}
          </tbody>
          {g5?.pct !== null && g5?.pct !== undefined && (
            <tfoot>
              <tr>
                <th scope="row" colSpan={7}>
                  Média nos anos com pagamento da operação
                </th>
                <td className="mp-num">
                  <Percentual v={g5.pct} limite={LIMITE_SERVICO} alerta={ALERTA_SERVICO} />
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <h3 className="mp-simulador-h3">Cronograma da operação simulada</h3>
      <div className="mp-tabela-rolagem">
        <table className="mp-tabela mp-simulador-tabela">
          <caption className="pa-sr">Liberação, juros, amortização e saldo devedor da operação simulada, por ano</caption>
          <thead>
            <tr>
              <th scope="col">Ano</th>
              <th scope="col" className="mp-num">Liberação</th>
              <th scope="col" className="mp-num">Juros</th>
              <th scope="col" className="mp-num">Amortização</th>
              <th scope="col" className="mp-num">Serviço</th>
              <th scope="col" className="mp-num">Saldo no fim do ano</th>
            </tr>
          </thead>
          <tbody>
            {s.cronograma.map((l) => (
              <tr key={l.ano}>
                <th scope="row">{l.ano}</th>
                <td className="mp-num">{moeda(l.liberacao)}</td>
                <td className="mp-num">{moeda(l.juros)}</td>
                <td className="mp-num">{moeda(l.amortizacao)}</td>
                <td className="mp-num">{moeda(l.servico)}</td>
                <td className="mp-num">{moeda(l.saldo)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="mp-num">{moeda(total("liberacao"))}</td>
              <td className="mp-num">{moeda(total("juros"))}</td>
              <td className="mp-num">{moeda(total("amortizacao"))}</td>
              <td className="mp-num">{moeda(total("servico"))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
