/**
 * Um município no TCE-PB: o Pix ano a ano (com as marcas do art. 166-A e as empresas) e a conciliação dos
 * convênios, empresa por empresa. Recebe a leitura pronta; aqui só se apresenta.
 *
 * Onda 15, fase 2, lote C (13/10/2026): as empresas do Pix e os pares empresa × ano são a `TabelaFiltravel`, com filtro
 * e ordem em cada coluna (a regra do titular; tela de administrador, toda coluna ordena). As células são as de antes; os
 * valores crus e as colunas ocultas (o CNPJ, os convênios, o TCE-PB de convênio e do Pix) estão em `tce.ts`. O nome da
 * empresa é o de `nomeFornecedor`, que mascara o CPF colado no nome do MEI. O Pix ano a ano é série curta e fica como está.
 */
import { urlLaudo } from "@/lib/oportunidades/busca";
import { dataBrasilia } from "@/lib/oportunidades/datas";
import { cnpjLegivel, nomeFornecedor, urlFornecedor } from "@/lib/oportunidades/fornecedores";
import { urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
import { urlFicha } from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import {
  COLUNAS_TCE_EMPRESAS_PIX,
  COLUNAS_TCE_PARES,
  ROTULO_SITUACAO,
  TABELA_TCE_EMPRESAS_PIX,
  TABELA_TCE_PARES,
  marcasPix,
  pct,
  resumirConciliacao,
  urlTce,
  valoresTceCredor,
  valoresTcePar,
  type SituacaoPar,
  type TceFederalPar,
  type TcePixCredor,
} from "@/lib/oportunidades/tce";
import type { LeituraTceMunicipio } from "@/lib/oportunidades/tce.server";
import { BotaoImprimir } from "../../../fiscal/[ibge]/simular/BotaoImprimir";
import { AVISO_TCE } from "../TceConteudo";
import { Saidas } from "../../Pecas";
import { LinkMapa } from "../../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../../_componentes/TabelaFiltravel";
import { TabelaRolagem } from "../../../_componentes/TabelaRolagem";
import { Termo } from "../../../_componentes/Termo";

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
  // B14b (08/10/2026): os vazios dizem quais anos foram lidos e levam à lista dos municípios.
  const lidos = leitura.cobertura.filter((c) => c.lido).map((c) => c.ano).sort((a, b) => a - b);
  const anosLidos = lidos.length === 0 ? "nenhum ano lido" : lidos.length === 1 ? `${lidos[0]}` : `${lidos[0]} a ${lidos.at(-1)}`;
  const verTodos = [{ rotulo: "Ver todos os municípios no TCE-PB", href: urlTce() }];

  return (
    <div className="pa-pagina mp-radar mp-laudo">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel · TCE-PB · IBGE {leitura.ibge}</p>
        <h1 className="pa-titulo">{nome}</h1>
        <p className="pa-sub">
          O <Termo slug="pix">Pix</Termo> nas contas do município e os convênios do SICONV conferidos com as despesas prestadas ao
          Tribunal de Contas do Estado (<Termo slug="tce-pb">TCE-PB</Termo>).
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          <LinkMapa href={urlTce()} className="pa-btn pa-btn-pequeno">
            Ver todos os municípios
          </LinkMapa>
          <LinkMapa href={urlMunicipio(leitura.ibge, "controle")} className="pa-btn pa-btn-pequeno">
            Abrir a página do município
          </LinkMapa>
          <LinkMapa href={urlFicha({ ibge: leitura.ibge })} className="pa-btn pa-btn-pequeno">
            Abrir a ficha no painel
          </LinkMapa>
        </p>
        <p className="mp-fiscal-aviso">{AVISO_TCE}</p>
      </div>

      <section aria-labelledby="tce-m-pix" className="mp-radar-secao">
        <h2 id="tce-m-pix" className="mp-radar-h2">
          O Pix, ano a ano
        </h2>
        {leitura.pix.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhuma despesa de {nome} paga na fonte do Pix (706) nos arquivos do TCE-PB lidos ({anosLidos}).
            <Saidas saidas={verTodos} />
          </p>
        ) : (
          <>
            <TabelaRolagem rotuloId="tce-m-pix">
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
            </TabelaRolagem>
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
              <>
                {/* A legenda era o `<caption>` da tabela; com a tabela filtrável, vira o título da subseção. */}
                <h3 className="mp-radar-h3">Empresas pagas com a fonte do Pix</h3>
                <TabelaFiltravel
                  id={TABELA_TCE_EMPRESAS_PIX}
                  rotulo="Empresas pagas com a fonte do Pix"
                  colunas={COLUNAS_TCE_EMPRESAS_PIX}
                  linhas={[...leitura.credores].sort((a, b) => b.ano - a.ano || b.pago - a.pago).map(linhaCredor)}
                  descricaoOrdemPadrao="do ano mais recente ao mais antigo e, no ano, do maior pago ao menor"
                  csv={{ nome: `tce-pb-${leitura.ibge}-empresas-pix` }}
                />
              </>
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
          <p className="pa-cartao pa-cartao-plano">
            Nenhum pagamento a empresa para conciliar entre o SICONV e o TCE-PB em {nome} ({anosLidos}).
            <Saidas saidas={verTodos} />
          </p>
        ) : (
          <TabelaFiltravel
            id={TABELA_TCE_PARES}
            rotulo="Convênios: SICONV × TCE-PB, empresa por empresa"
            colunas={COLUNAS_TCE_PARES}
            linhas={pares.map(linhaPar)}
            descricaoOrdemPadrao="o que pede olhar primeiro (só no SICONV, só no TCE-PB, não verificado, os casados), depois o ano mais recente e o maior valor"
            csv={{ nome: `tce-pb-${leitura.ibge}-conciliacao` }}
          />
        )}
      </section>

      <section aria-labelledby="tce-m-fonte" className="mp-radar-secao">
        <h2 id="tce-m-fonte" className="mp-radar-h2">
          Fonte e método
        </h2>
        <ul className="mp-laudo-causas mp-laudo-miudo">
          {anos.map((a) => {
            const c = leitura.cobertura.find((x) => x.ano === a);
            // A4x (08/10/2026): `coletado_em` é carimbo com hora; a data é a do dia em Brasília, e não a de UTC.
            return (
              <li key={a}>
                Despesas de {a} no TCE-PB:{" "}
                {c?.lido ? `lidas${c.coletado_em ? ` em ${dataBrasilia(c.coletado_em)}` : ""}` : `não lidas — ${c?.motivo ?? "motivo não registrado"}`}.
              </li>
            );
          })}
          <li>
            Pix: fonte 706 (transferência especial da União). Convênio federal: fontes 700, 631 e 570. A Câmara e os consórcios ficam fora. O
            casamento com o SICONV é pelo CNPJ do credor e pelo ano (o mesmo ou o seguinte), em qualquer fonte do TCE-PB.
          </li>
          <li>Pessoa física não aparece: o TCE-PB publica o CPF do credor, e o painel guarda só o valor somado.</li>
        </ul>
      </section>
    </div>
  );
}

/** A empresa como a tela escreve: o nome sem CPF (`nomeFornecedor`) e o CNPJ com pontuação. */
const identificacao = (x: { nome: string | null; cnpj: string }) => ({ nome: nomeFornecedor(x), cnpj: cnpjLegivel(x.cnpj) ?? x.cnpj });

/** Uma empresa paga com o Pix: os valores de `tce.ts` e as células de antes (onda 15, fase 2, lote C, 13/10/2026). */
function linhaCredor(c: TcePixCredor): LinhaTabela {
  const id = identificacao(c);
  return {
    chave: `${c.ano}-${c.cnpj}`,
    valores: valoresTceCredor(c, id),
    celulas: {
      empresa: (
        <>
          {id.nome}
          <span className="mp-tabela-secundario">CNPJ {id.cnpj}</span>
        </>
      ),
      ano: String(c.ano),
      pago: moedaCurta(c.pago),
      investimentos: c.pago_investimentos > 0 ? moedaCurta(c.pago_investimentos) : "—",
    },
  };
}

/** Um par empresa × ano da conciliação: os valores de `tce.ts` e as células de antes (onda 15, fase 2, lote C, 13/10/2026). */
function linhaPar(p: TceFederalPar): LinhaTabela {
  const tce = p.tce_convenio + p.tce_pix + p.tce_outras;
  const nivel = NIVEL[p.situacao];
  const id = identificacao(p);
  return {
    chave: `${p.ano}-${p.cnpj}`,
    valores: valoresTcePar(p, id),
    celulas: {
      empresa: (
        <>
          {p.siconv > 0 ? (
            <LinkMapa href={urlFornecedor(p.cnpj)} className="mp-tabela-principal">
              {id.nome}
            </LinkMapa>
          ) : (
            <span className="mp-tabela-principal">{id.nome}</span>
          )}
          <span className="mp-tabela-secundario">CNPJ {id.cnpj}</span>
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
        </>
      ),
      ano: String(p.ano),
      siconv: p.siconv > 0 ? moedaCurta(p.siconv) : "—",
      tce: (
        <>
          {tce > 0 ? moedaCurta(tce) : "—"}
          {p.tce_convenio > 0 && tce !== p.tce_convenio && <span className="mp-tabela-secundario">{moedaCurta(p.tce_convenio)} de convênio</span>}
          {p.tce_pix > 0 && <span className="mp-tabela-secundario">{moedaCurta(p.tce_pix)} do Pix</span>}
        </>
      ),
      situacao: nivel ? <span className={`pa-tag mp-laudo-nivel mp-laudo-${nivel}`}>{ROTULO_SITUACAO[p.situacao]}</span> : ROTULO_SITUACAO[p.situacao],
    },
  };
}
