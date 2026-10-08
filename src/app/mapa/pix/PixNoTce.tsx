/**
 * O Pix do município nas despesas prestadas ao TCE-PB (fonte 706), ano a ano, com as marcas da CF,
 * art. 166-A (pessoal, dívida, capital). Serve ao laudo do plano e ao do ente: é por município e ano,
 * não por plano — a despesa do TCE não traz o número do plano de ação.
 */
import { moedaCurta } from "@/lib/oportunidades/radar";
import { marcasPix, pct, type TcePixMunicipio } from "@/lib/oportunidades/tce";
import { TabelaRolagem } from "../_componentes/TabelaRolagem";

export function PixNoTce({ tce, desde, id = "pix-tce" }: { tce: TcePixMunicipio[] | null; desde?: number; id?: string }) {
  const anos = (tce ?? []).filter((t) => desde === undefined || t.ano >= desde).sort((a, b) => b.ano - a.ano);
  const marcas = anos.flatMap((t) => marcasPix(t));
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        Pessoal, dívida e capital no TCE-PB
      </h2>
      <p className="pa-nota">
        A Constituição proíbe pagar pessoal e dívida com a transferência especial (art. 166-A, §1º). A API das especiais não traz a natureza da
        despesa; o TCE-PB traz, mas por município e ano, somando todos os planos do Pix do município — não só este.
      </p>
      {tce === null ? (
        <p className="pa-cartao pa-cartao-plano">O TCE-PB não pôde ser lido agora.</p>
      ) : anos.length === 0 ? (
        <p className="pa-cartao pa-cartao-plano">Nenhuma despesa paga na fonte do Pix (706) nos arquivos lidos do TCE-PB (de 2024 em diante{desde && desde > 2024 ? `, a partir de ${desde}` : ""}).</p>
      ) : (
        <>
          <TabelaRolagem rotulo="Pessoal, dívida e capital no TCE-PB">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Ano</th>
                  <th scope="col" className="mp-num">Pago</th>
                  <th scope="col" className="mp-num">Pessoal</th>
                  <th scope="col" className="mp-num">Dívida</th>
                  <th scope="col" className="mp-num">Capital</th>
                </tr>
              </thead>
              <tbody>
                {anos.map((t) => (
                  <tr key={t.ano}>
                    <th scope="row">{t.ano}</th>
                    <td className="mp-num">{moedaCurta(t.pago)}</td>
                    <td className="mp-num">{t.pago_pessoal > 0 ? moedaCurta(t.pago_pessoal) : "—"}</td>
                    <td className="mp-num">{t.pago_juros + t.pago_amortizacao > 0 ? moedaCurta(t.pago_juros + t.pago_amortizacao) : "—"}</td>
                    <td className="mp-num">{pct(t.pct_capital)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
          {marcas.length > 0 && (
            <ul className="mp-laudo-lista">
              {marcas.map((m, k) => (
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
          )}
          <p className="pa-nota">
            O TCE-PB é lido de 2024 em diante e publica as despesas com cerca de dois meses de atraso: o ano corrente ainda está incompleto.
          </p>
        </>
      )}
    </section>
  );
}
