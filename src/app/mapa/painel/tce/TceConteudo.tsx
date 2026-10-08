/**
 * Dinheiro federal no TCE-PB: o Pix por município e a conciliação SICONV × TCE-PB, num ano.
 * Recebe a leitura pronta (lib/oportunidades/tce.server.ts); aqui só se apresenta.
 */
import { formatarData } from "@/lib/oportunidades/central";
import { moedaCurta } from "@/lib/oportunidades/radar";
import {
  CAPITAL_MINIMO,
  VERSAO_REGRAS_PIX,
  descreverCobertura,
  marcasPix,
  pct,
  resumirConciliacao,
  urlTce,
  type TceFederalMunicipio,
  type TcePixMunicipio,
} from "@/lib/oportunidades/tce";
import type { LeituraPainelTce } from "@/lib/oportunidades/tce.server";
import { Saidas, type Saida } from "../Pecas";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";
import { Termo } from "../../_componentes/Termo";

type LeituraOk = Extract<LeituraPainelTce, { estado: "ok" }>;

// B14b (08/10/2026): "TCE" solto aqui é sempre o TCE-PB, e passa a ser escrito assim (H06).
export const AVISO_TCE =
  "Uso interno da PONTE. Despesas abertas do TCE-PB cruzadas com os pagamentos do SICONV. O TCE-PB não traz o número do convênio: o " +
  "casamento é pelo município, pelo CNPJ do credor e pelo ano. O que não casa é para conferir, não irregularidade. Pessoa física não " +
  "aparece: só o valor somado.";

const n = (x: number) => x.toLocaleString("pt-BR");

export function TceConteudo({ leitura, anoPedido }: { leitura: LeituraOk; anoPedido: number | null }) {
  const anos = [...new Set(leitura.cobertura.map((c) => c.ano))].sort((a, b) => b - a);
  const hoje = Number((leitura.execucao.referencia ?? "").slice(0, 4)) || new Date().getFullYear();
  // Padrão: o último ano fechado, que o TCE já consolidou.
  const ano = anoPedido && anos.includes(anoPedido) ? anoPedido : (anos.find((a) => a < hoje) ?? anos[0]);
  const pix = leitura.pix.filter((p) => p.ano === ano);
  const ms = leitura.municipios.filter((m) => m.ano === ano);
  const cob = leitura.cobertura.filter((c) => c.ano === ano);
  const comMarca = pix.filter((p) => marcasPix(p).length > 0);
  const resumo = resumirConciliacao(ms);
  const pixOrdenado = [...pix].sort((a, b) => marcasPix(b).length - marcasPix(a).length || b.pago - a.pago);
  const concOrdenada = [...ms].sort((a, b) => b.siconv_so - a.siconv_so || b.tce_convenio_so - a.tce_convenio_so || b.siconv_pj - a.siconv_pj);
  // B14b (08/10/2026): o ano vazio aponta para o ano mais próximo que tem dado, no lugar de "neste ano".
  const outroAno = (comDado: number[]): Saida[] => {
    const a = [...new Set(comDado)].filter((x) => x !== ano).sort((x, y) => Math.abs(x - ano) - Math.abs(y - ano) || y - x)[0];
    return a ? [{ rotulo: `Ver ${a}`, href: `${urlTce()}?ano=${a}` }] : [];
  };

  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel · TCE-PB</p>
        <h1 className="pa-titulo">Dinheiro federal nas contas dos municípios</h1>
        <p className="pa-sub">
          Como cada município da PB gastou o <Termo slug="pix">Pix</Termo> (transferência especial) e se o que o SICONV registra pago a
          empresas nos convênios aparece nas despesas que o município presta ao Tribunal de Contas do Estado (
          <Termo slug="tce-pb">TCE-PB</Termo>) — e o contrário.
        </p>
        <p className="mp-fiscal-aviso">{AVISO_TCE}</p>
        <p className="pa-nota">
          {descreverCobertura(cob)} para {ano}
          {leitura.execucao.dado_ate ? ` · arquivo mais novo do TCE-PB de ${formatarData(leitura.execucao.dado_ate)}` : ""}.
        </p>
      </div>

      <nav aria-label="Ano" className="pa-chips mp-nao-imprimir">
        <span className="pa-campo-rotulo mp-radar-filtro-rotulo">Ano</span>
        {anos.map((a) => (
          <LinkMapa key={a} href={`${urlTce()}?ano=${a}`} className={`pa-chip${a === ano ? " pa-ativo" : ""}`} aria-current={a === ano ? "true" : undefined}>
            {a}
            {a >= hoje ? " (em curso)" : ""}
          </LinkMapa>
        ))}
      </nav>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <Cartao titulo="Pix pago" numero={moedaCurta(pix.reduce((s, p) => s + p.pago, 0))} nota={`em ${n(pix.length)} municípios, em ${ano}`} />
        <Cartao
          titulo="Pix a conferir"
          numero={n(comMarca.length)}
          nota="municípios com pessoal, dívida ou menos de 70% em capital pagos com a fonte do Pix"
        />
        <Cartao
          titulo="SICONV no TCE-PB"
          numero={pct(resumo.taxa)}
          nota={`de ${moedaCurta(resumo.siconv - resumo.naoVerificado)} pagos a empresas nos convênios das prefeituras`}
        />
        <Cartao titulo="Só no TCE-PB" numero={moedaCurta(resumo.tceSo)} nota={`de fonte de convênio federal, em ${n(resumo.nSoTce)} pares sem SICONV`} />
      </div>

      <section aria-labelledby="tce-pix" className="mp-radar-secao">
        <h2 id="tce-pix" className="mp-radar-h2">
          O Pix nas contas de {ano}
        </h2>
        {pix.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhum município com despesa paga na fonte do Pix (706) em {ano}, nos arquivos do TCE-PB lidos para esse ano.
            <Saidas saidas={outroAno(leitura.pix.map((x) => x.ano))} />
          </p>
        ) : (
          <TabelaRolagem rotuloId="tce-pix">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Município</th>
                  <th scope="col" className="mp-num">
                    Pago
                  </th>
                  <th scope="col" className="mp-num">
                    Capital
                  </th>
                  <th scope="col" className="mp-num">
                    Pessoal e dívida
                  </th>
                </tr>
              </thead>
              <tbody>
                {pixOrdenado.map((p) => (
                  <LinhaPix key={p.ibge} p={p} />
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        )}
        <p className="pa-nota">
          Fonte 706 (transferência especial da União) nas despesas do município. Capital = investimentos e inversões financeiras; a amortização
          de dívida fica fora, porque o § 5º do art. 166-A ressalva a vedação do serviço da dívida. As marcas seguem a CF, art. 166-A (EC 105/2019),
          regras {VERSAO_REGRAS_PIX}; a LC 210/2024 e a IN 93/2024 ainda não entram. Os 70% valem para a transferência, não para cada ano: abaixo
          de {pct(CAPITAL_MINIMO)} num ano é para olhar.
        </p>
      </section>

      <section aria-labelledby="tce-conciliacao" className="mp-radar-secao">
        <h2 id="tce-conciliacao" className="mp-radar-h2">
          Convênios: SICONV × TCE-PB em {ano}
        </h2>
        {ms.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhum pagamento a empresa para conciliar entre o SICONV e o TCE-PB em {ano}.
            <Saidas saidas={outroAno(leitura.municipios.map((x) => x.ano))} />
          </p>
        ) : (
          <TabelaRolagem rotuloId="tce-conciliacao">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Município</th>
                  <th scope="col" className="mp-num">
                    SICONV pagou
                  </th>
                  <th scope="col" className="mp-num">
                    Achado no TCE-PB
                  </th>
                  <th scope="col" className="mp-num">
                    Só no SICONV
                  </th>
                  <th scope="col" className="mp-num">
                    Convênio no TCE-PB
                  </th>
                  <th scope="col" className="mp-num">
                    Só no TCE-PB
                  </th>
                </tr>
              </thead>
              <tbody>
                {concOrdenada.map((m) => (
                  <LinhaConciliacao key={m.ibge} m={m} />
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        )}
        <p className="pa-nota">
          “SICONV pagou”: pagamentos a empresas nos convênios da administração municipal (prefeitura, fundos, autarquias), sem a OBTV para o
          próprio convenente. Casa quando o TCE-PB tem pagamento ao mesmo CNPJ no mesmo ano ou no seguinte, em qualquer fonte (a contrapartida
          sai de recurso próprio). “Convênio no TCE-PB”: fontes 700, 631 e 570 (convênios da União), pagas a empresas; “só no TCE-PB” é o
          que não tem par no SICONV no mesmo ano nem no anterior.
        </p>
      </section>
    </div>
  );
}

function Cartao({ titulo, numero, nota }: { titulo: string; numero: string; nota: string }) {
  return (
    <article className="pa-cartao">
      <h2 className="pa-mono">{titulo}</h2>
      <p className="pa-numero">{numero}</p>
      <p className="pa-nota">{nota}</p>
    </article>
  );
}

function LinhaPix({ p }: { p: TcePixMunicipio }) {
  const marcas = marcasPix(p);
  const divida = p.pago_pessoal + p.pago_juros + p.pago_amortizacao;
  return (
    <tr>
      <th scope="row">
        <LinkMapa href={urlTce(p.ibge)} className="mp-tabela-principal">
          {p.municipio ?? `IBGE ${p.ibge}`}
        </LinkMapa>
        <span className="mp-tabela-secundario">
          {n(p.n_credores_pj)} {p.n_credores_pj === 1 ? "empresa" : "empresas"}
        </span>
        {marcas.map((m) => (
          <span key={m.regra} className={`pa-tag mp-laudo-nivel mp-laudo-${m.nivel}`} title={m.dispositivo}>
            {m.regra === "capital" ? "capital < 70%" : m.regra}
          </span>
        ))}
      </th>
      <td className="mp-num">
        {moedaCurta(p.pago)}
        {p.pago_emenda_individual > 0 && <span className="mp-tabela-secundario">emenda individual: {moedaCurta(p.pago_emenda_individual)}</span>}
      </td>
      <td className="mp-num">{pct(p.pct_capital)}</td>
      <td className="mp-num">{divida > 0 ? moedaCurta(divida) : "—"}</td>
    </tr>
  );
}

function LinhaConciliacao({ m }: { m: TceFederalMunicipio }) {
  const verificado = m.siconv_pj - m.siconv_nao_verificado;
  return (
    <tr>
      <th scope="row">
        <LinkMapa href={urlTce(m.ibge)} className="mp-tabela-principal">
          {m.municipio ?? `IBGE ${m.ibge}`}
        </LinkMapa>
        {!m.coberto && <span className="mp-tabela-secundario">arquivo do TCE-PB ainda não lido</span>}
      </th>
      <td className="mp-num">{m.siconv_pj > 0 ? moedaCurta(m.siconv_pj) : "—"}</td>
      <td className="mp-num">{verificado > 0 ? pct(m.siconv_casado / verificado) : "—"}</td>
      <td className="mp-num">
        {m.siconv_so > 0 ? moedaCurta(m.siconv_so) : "—"}
        {m.n_so_siconv > 0 && <span className="mp-tabela-secundario">{n(m.n_so_siconv)} {m.n_so_siconv === 1 ? "empresa" : "empresas"}</span>}
      </td>
      <td className="mp-num">{m.tce_convenio_pj > 0 ? moedaCurta(m.tce_convenio_pj) : "—"}</td>
      <td className="mp-num">
        {m.tce_convenio_so > 0 ? moedaCurta(m.tce_convenio_so) : "—"}
        {m.n_so_tce > 0 && <span className="mp-tabela-secundario">{n(m.n_so_tce)} {m.n_so_tce === 1 ? "empresa" : "empresas"}</span>}
      </td>
    </tr>
  );
}
