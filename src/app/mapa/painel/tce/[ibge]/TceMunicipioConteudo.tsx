/**
 * Um município no TCE-PB: o Pix ano a ano (com as marcas do art. 166-A e as empresas) e a conciliação dos
 * convênios, empresa por empresa. Recebe a leitura pronta; aqui só se apresenta.
 */
import { urlLaudo } from "@/lib/oportunidades/busca";
import { formatarData } from "@/lib/oportunidades/central";
import { cnpjLegivel, nomeFornecedor, urlFornecedor } from "@/lib/oportunidades/fornecedores";
import { urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
import { urlFicha } from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_SITUACAO, marcasPix, pct, resumirConciliacao, urlTce, type SituacaoPar, type TceFederalPar } from "@/lib/oportunidades/tce";
import type { LeituraTceMunicipio } from "@/lib/oportunidades/tce.server";
import { BotaoImprimir } from "../../../fiscal/[ibge]/simular/BotaoImprimir";
import { AVISO_TCE } from "../TceConteudo";
import { LinkMapa } from "../../../_componentes/LinkMapa";

type LeituraOk = Extract<LeituraTceMunicipio, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");
// O que pede olhar primeiro: pago no SICONV sem TCE, depois o TCE sem SICONV.
const PRIORIDADE: Record<SituacaoPar, number> = {
  so_siconv: 0, so_tce: 1, nao_verificado: 2, casado_ano_seguinte: 3, casado_ano_anterior: 4, casado: 5,
};
const NIVEL: Partial<Record<SituacaoPar, string>> = { so_siconv: "moderado", so_tce: "informativo" };

export function TceMunicipioConteudo({ leitura }: { leitura: LeituraOk }) {
  const nome = leitura.nome ?? `IBGE ${leitura.ibge}`;
  const anos = [...new Set(leitura.cobertura.map((c) => c.ano))].sort((a, b) => b - a);
  const pares = [...leitura.pares].sort(
    (a, b) => PRIORIDADE[a.situacao] - PRIORIDADE[b.situacao] || b.ano - a.ano || b.siconv + b.tce_convenio - (a.siconv + a.tce_convenio),
  );
  const resumo = resumirConciliacao(leitura.municipios);

  return (
    <div className="pa-pagina mp-radar mp-laudo">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel · TCE-PB · IBGE {leitura.ibge}</p>
        <h1 className="pa-titulo">{nome}</h1>
        <p className="pa-sub">O Pix nas contas do município e os convênios do SICONV conferidos com as despesas prestadas ao TCE-PB.</p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          <LinkMapa href={urlTce()} className="pa-btn pa-btn-pequeno">
            Todos os municípios
          </LinkMapa>
          <LinkMapa href={urlMunicipio(leitura.ibge, "controle")} className="pa-btn pa-btn-pequeno">
            Página do município
          </LinkMapa>
          <LinkMapa href={urlFicha({ ibge: leitura.ibge })} className="pa-btn pa-btn-pequeno">
            Ficha do município no painel
          </LinkMapa>
        </p>
        <p className="mp-fiscal-aviso">{AVISO_TCE}</p>
      </div>

      <section aria-labelledby="tce-m-pix" className="mp-radar-secao">
        <h2 id="tce-m-pix" className="mp-radar-h2">
          O Pix, ano a ano
        </h2>
        {leitura.pix.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhuma despesa paga na fonte do Pix nos arquivos lidos.</p>
        ) : (
          <>
            <div className="mp-tabela-rolagem">
              <table className="mp-tabela">
                <thead>
                  <tr>
                    <th scope="col">Ano</th>
                    <th scope="col" className="mp-num">
                      Pago
                    </th>
                    <th scope="col" className="mp-num">
                      Investimentos
                    </th>
                    <th scope="col" className="mp-num">
                      Correntes
                    </th>
                    <th scope="col" className="mp-num">
                      Pessoal
                    </th>
                    <th scope="col" className="mp-num">
                      Dívida
                    </th>
                    <th scope="col" className="mp-num">
                      Capital
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...leitura.pix].sort((a, b) => b.ano - a.ano).map((p) => (
                    <tr key={p.ano}>
                      <th scope="row">
                        {p.ano}
                        <span className="mp-tabela-secundario">
                          {n(p.n_empenhos)} empenhos · {n(p.n_credores_pj)} {p.n_credores_pj === 1 ? "empresa" : "empresas"}
                          {p.pago_com_obra > 0 ? ` · ${pct(p.pago_com_obra / (p.pago || 1))} com obra informada` : ""}
                        </span>
                      </th>
                      <td className="mp-num">{moedaCurta(p.pago)}</td>
                      <td className="mp-num">{moedaCurta(p.pago_investimentos + p.pago_inversoes)}</td>
                      <td className="mp-num">{moedaCurta(p.pago_correntes)}</td>
                      <td className="mp-num">{p.pago_pessoal > 0 ? moedaCurta(p.pago_pessoal) : "—"}</td>
                      <td className="mp-num">{p.pago_juros + p.pago_amortizacao > 0 ? moedaCurta(p.pago_juros + p.pago_amortizacao) : "—"}</td>
                      <td className="mp-num">{pct(p.pct_capital)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mp-laudo-lista">
              {leitura.pix.flatMap((p) => marcasPix(p)).map((m, k) => (
                <li key={k} className={`pa-cartao mp-laudo-risco mp-laudo-${m.nivel}`}>
                  <p>
                    <span className={`pa-tag mp-laudo-nivel mp-laudo-${m.nivel}`}>a conferir</span> <strong>{m.titulo}</strong>
                  </p>
                  <p>
                    {m.fato} <span className="mp-laudo-miudo">({m.dispositivo})</span>
                  </p>
                </li>
              ))}
            </ul>
            {leitura.credores.length > 0 && (
              <div className="mp-tabela-rolagem">
                <table className="mp-tabela">
                  <caption className="mp-laudo-legenda-tabela">Empresas pagas com a fonte do Pix</caption>
                  <thead>
                    <tr>
                      <th scope="col">Empresa</th>
                      <th scope="col">Ano</th>
                      <th scope="col" className="mp-num">
                        Pago
                      </th>
                      <th scope="col" className="mp-num">
                        Em investimentos
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...leitura.credores]
                      .sort((a, b) => b.ano - a.ano || b.pago - a.pago)
                      .map((c) => (
                        <tr key={`${c.ano}-${c.cnpj}`}>
                          <th scope="row">
                            {nomeFornecedor(c)}
                            <span className="mp-tabela-secundario">CNPJ {cnpjLegivel(c.cnpj)}</span>
                          </th>
                          <td>{c.ano}</td>
                          <td className="mp-num">{moedaCurta(c.pago)}</td>
                          <td className="mp-num">{c.pago_investimentos > 0 ? moedaCurta(c.pago_investimentos) : "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="tce-m-conc" className="mp-radar-secao">
        <h2 id="tce-m-conc" className="mp-radar-h2">
          Convênios: SICONV × TCE-PB
        </h2>
        <p className="pa-nota">
          Somando os anos: o SICONV registra {moedaCurta(resumo.siconv)} pagos a empresas nos convênios da administração municipal; {pct(resumo.taxa)}{" "}
          do que foi verificado aparece no TCE-PB. De fonte de convênio federal, o TCE-PB registra {moedaCurta(resumo.tceConvenio)} pagos a empresas,{" "}
          {moedaCurta(resumo.tceSo)} sem par no SICONV.
        </p>
        {pares.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhum pagamento a conciliar.</p>
        ) : (
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Empresa</th>
                  <th scope="col">Ano</th>
                  <th scope="col" className="mp-num">
                    SICONV
                  </th>
                  <th scope="col" className="mp-num">
                    TCE-PB
                  </th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {pares.map((p) => (
                  <LinhaPar key={`${p.ano}-${p.cnpj}`} p={p} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="tce-m-fonte" className="mp-radar-secao">
        <h2 id="tce-m-fonte" className="mp-radar-h2">
          Fonte e método
        </h2>
        <ul className="mp-laudo-causas mp-laudo-miudo">
          {anos.map((a) => {
            const c = leitura.cobertura.find((x) => x.ano === a);
            return (
              <li key={a}>
                Despesas de {a} no TCE-PB:{" "}
                {c?.lido ? `lidas${c.coletado_em ? ` em ${formatarData(c.coletado_em)}` : ""}` : `não lidas — ${c?.motivo ?? "motivo não registrado"}`}.
              </li>
            );
          })}
          <li>
            Pix: fonte 706 (transferência especial da União). Convênio federal: fontes 700, 631 e 570. A Câmara e os consórcios ficam fora. O
            casamento com o SICONV é pelo CNPJ do credor e pelo ano (o mesmo ou o seguinte), em qualquer fonte do TCE.
          </li>
          <li>Pessoa física não aparece: o TCE publica o CPF do credor, e o painel guarda só o valor somado.</li>
        </ul>
      </section>
    </div>
  );
}

function LinhaPar({ p }: { p: TceFederalPar }) {
  const tce = p.tce_convenio + p.tce_pix + p.tce_outras;
  const nivel = NIVEL[p.situacao];
  return (
    <tr>
      <th scope="row">
        {p.siconv > 0 ? (
          <LinkMapa href={urlFornecedor(p.cnpj)} className="mp-tabela-principal">
            {nomeFornecedor(p)}
          </LinkMapa>
        ) : (
          <span className="mp-tabela-principal">{nomeFornecedor(p)}</span>
        )}
        <span className="mp-tabela-secundario">CNPJ {cnpjLegivel(p.cnpj)}</span>
        {p.convenios.length > 0 && (
          <span className="mp-tabela-secundario">
            {p.convenios.slice(0, 4).map((nr, k) => (
              <span key={nr}>
                {k > 0 ? ", " : ""}
                <LinkMapa href={urlLaudo(nr)}>nº {nr}</LinkMapa>
              </span>
            ))}
            {p.convenios.length > 4 ? ` e mais ${n(p.convenios.length - 4)}` : ""}
          </span>
        )}
      </th>
      <td>{p.ano}</td>
      <td className="mp-num">{p.siconv > 0 ? moedaCurta(p.siconv) : "—"}</td>
      <td className="mp-num">
        {tce > 0 ? moedaCurta(tce) : "—"}
        {p.tce_convenio > 0 && tce !== p.tce_convenio && <span className="mp-tabela-secundario">{moedaCurta(p.tce_convenio)} de convênio</span>}
        {p.tce_pix > 0 && <span className="mp-tabela-secundario">{moedaCurta(p.tce_pix)} do Pix</span>}
      </td>
      <td>{nivel ? <span className={`pa-tag mp-laudo-nivel mp-laudo-${nivel}`}>{ROTULO_SITUACAO[p.situacao]}</span> : ROTULO_SITUACAO[p.situacao]}</td>
    </tr>
  );
}
