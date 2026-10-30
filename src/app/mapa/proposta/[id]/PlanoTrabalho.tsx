/**
 * O plano de trabalho da proposta (oport_58, 30/10/2026): metas com as etapas, os itens do plano de aplicação e as
 * parcelas previstas, como o SICONV publica. Cada parte em `details`, para a página não virar uma lista sem fim.
 */
import { mesAno, parcelasPorResponsavel, periodo, somarItens, type PlanoTrabalho } from "@/lib/oportunidades/plano-trabalho";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";

const n = (x: number | null | undefined) => (x === null || x === undefined ? "—" : x.toLocaleString("pt-BR"));
const v = (x: number | string | null | undefined) => (x === null || x === undefined ? "—" : moedaCurta(Number(x)));
const qtd = (q: number | null, u: string | null) => (q === null ? "—" : `${q.toLocaleString("pt-BR")}${u ? ` ${u}` : ""}`);

export function PlanoTrabalhoSecao({ plano }: { plano: PlanoTrabalho | null }) {
  if (!plano) {
    return (
      <section aria-labelledby="proposta-plano" className="mp-radar-secao">
        <h2 id="proposta-plano" className="mp-radar-h2">
          Plano de trabalho
        </h2>
        <p className="pa-nota">
          O plano de trabalho desta proposta não está nos arquivos abertos do SICONV desta rodada (metas, etapas, itens e
          cronograma de desembolso), ou a proposta é de fora da Paraíba.
        </p>
      </section>
    );
  }
  const porTipo = somarItens(plano.itens, (i) => i.tipo);
  // A natureza da aquisição às vezes vem só como código ("1"): o resumo por origem só aparece quando vem escrita.
  const porAquisicao = plano.itens.some((i) => i.aquisicao && !/^\d+$/.test(i.aquisicao)) ? somarItens(plano.itens, (i) => i.aquisicao) : [];
  const porResponsavel = parcelasPorResponsavel(plano.parcelas);
  return (
    <section aria-labelledby="proposta-plano" className="mp-radar-secao">
      <h2 id="proposta-plano" className="mp-radar-h2">
        Plano de trabalho
      </h2>
      <p className="pa-sub">
        {n(plano.n_metas)} {plano.n_metas === 1 ? "meta" : "metas"} ({v(plano.vl_metas)}), {n(plano.n_etapas)}{" "}
        {plano.n_etapas === 1 ? "etapa" : "etapas"}, {n(plano.n_itens)} {plano.n_itens === 1 ? "item" : "itens"} no plano de aplicação (
        {v(plano.vl_itens)}) e {n(plano.parcelas.length)} {plano.parcelas.length === 1 ? "parcela prevista" : "parcelas previstas"}.
      </p>

      {plano.metas.length > 0 && (
        <details open>
          <summary className="mp-radar-h3">Metas e etapas</summary>
          <ol className="mp-laudo-lista">
            {plano.metas.map((m, k) => (
              <li key={`${m.nr ?? k}-${k}`}>
                <p>
                  <strong>Meta {m.nr ?? k + 1}</strong>
                  {m.tipo && m.tipo !== "NORMAL" ? ` (${m.tipo.toLowerCase()})` : ""}: {m.descricao ?? "sem descrição"}
                </p>
                <p className="pa-nota">
                  {periodo(m.inicio, m.fim)} · {qtd(m.quantidade, m.unidade)} · {v(m.valor)}
                  {m.municipio ? ` · ${m.municipio}${m.uf ? `/${m.uf}` : ""}` : ""}
                </p>
                {m.etapas.length > 0 && (
                  <ol className="mp-laudo-lista">
                    {m.etapas.map((e, j) => (
                      <li key={`${e.nr ?? j}-${j}`}>
                        Etapa {e.nr ?? j + 1}: {e.descricao ?? "sem descrição"}{" "}
                        <span className="pa-nota">
                          ({periodo(e.inicio, e.fim)} · {qtd(e.quantidade, e.unidade)} · {v(e.valor)})
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}

      {plano.itens.length > 0 && (
        <details>
          <summary className="mp-radar-h3">Plano de aplicação: o que se compra</summary>
          <p className="pa-nota">
            Por tipo de despesa: {porTipo.map((s) => `${s.chave.toLowerCase()} ${moedaCurta(s.valor)}`).join(" · ")}.
            {porAquisicao.length > 0 ? ` Por origem: ${porAquisicao.map((s) => `${s.chave.toLowerCase()} ${moedaCurta(s.valor)}`).join(" · ")}.` : ""}
            {plano.itens_cortados ? ` A lista mostra os ${plano.itens.length} itens de maior valor, de ${n(plano.n_itens)}.` : ""}
          </p>
          <TabelaRolagem rotulo="Itens do plano de aplicação">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Natureza da despesa</th>
                  <th scope="col" className="mp-num">
                    Quantidade
                  </th>
                  <th scope="col" className="mp-num">
                    Unitário
                  </th>
                  <th scope="col" className="mp-num">
                    Total
                  </th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {plano.itens.map((i, k) => (
                  <tr key={k}>
                    <th scope="row">{i.descricao ?? "—"}</th>
                    <td>{i.tipo ?? "—"}</td>
                    <td>
                      {i.natureza ?? "—"}
                      {i.cod_natureza ? <span className="pa-mono"> ({i.cod_natureza})</span> : null}
                    </td>
                    <td className="mp-num">{n(i.quantidade)}</td>
                    <td className="mp-num">{v(i.valor_unitario)}</td>
                    <td className="mp-num">{v(i.valor_total)}</td>
                    <td>{i.situacao ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        </details>
      )}

      {plano.parcelas.length > 0 && (
        <details>
          <summary className="mp-radar-h3">Cronograma de desembolso previsto</summary>
          <p className="pa-nota">{porResponsavel.map((s) => `${s.chave}: ${moedaCurta(s.valor)} em ${s.itens} ${s.itens === 1 ? "parcela" : "parcelas"}`).join(" · ")}.</p>
          <TabelaRolagem rotulo="Parcelas previstas">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Parcela</th>
                  <th scope="col">Quando</th>
                  <th scope="col">Quem paga</th>
                  <th scope="col" className="mp-num">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {plano.parcelas.map((p, k) => (
                  <tr key={k}>
                    <th scope="row">{p.nr ?? "—"}</th>
                    <td>{mesAno(p)}</td>
                    <td>{p.responsavel ?? "—"}</td>
                    <td className="mp-num">{v(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        </details>
      )}

      <p className="pa-nota">
        Fonte: arquivos abertos do SICONV (metas, etapas, plano de aplicação detalhado e cronograma de desembolso), no{" "}
        <a href="https://www.gov.br/transferegov/pt-br" target="_blank" rel="noopener noreferrer">
          Transferegov
        </a>
        . A justificativa e o texto da proposta não estão nos dados abertos: só na consulta do próprio Transferegov.
      </p>
    </section>
  );
}
