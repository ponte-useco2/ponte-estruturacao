import { FRASE_FIXA, divergenciasDoManifesto, semReferenciaInterna, type BlocoCq, type CadeiaQuebrada, type ExecucaoCq } from "@/lib/oportunidades/cadeia-quebrada";
import { formatarData } from "@/lib/oportunidades/central";
import { moedaCurta } from "@/lib/oportunidades/radar";

const n = (x: number) => x.toLocaleString("pt-BR");
const pct = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** O corpo da página da cadeia quebrada (PUB-11): só agregados, sem nome de empresa, órgão ou pessoa. */
export function CadeiaConteudo({ ex, c }: { ex: ExecucaoCq; c: CadeiaQuebrada }) {
  const divergencias = divergenciasDoManifesto(ex, c);
  const dadoAte = ex.dado_ate ? formatarData(ex.dado_ate.slice(0, 10)) : "data não informada";
  const geradoEm = ex.gerado_em ? formatarData(ex.gerado_em.slice(0, 10)) : "data não informada";

  return (
    <div className="pa-pagina mp-radar mp-laudo">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Paraíba · gasto do Estado · fase 1</p>
        <h1 className="pa-titulo">A cadeia do gasto no Diário Oficial</h1>
        <p className="pa-sub">
          Para cada empresa que recebeu pagamento do Estado, se a contratação aparece publicada no Diário Oficial da Paraíba
          pelo próprio órgão que pagou. Quando um elo não aparece, a cadeia está &ldquo;quebrada&rdquo; no que é público.{" "}
          <strong>{FRASE_FIXA}</strong> O Diário não é a única publicação obrigatória, e a ligação entre pagamento e ato é
          feita pelo CNPJ.
        </p>
        <p className="pa-nota">
          Dado até {dadoAte} · gerado em {geradoEm} · regra de alcance das sanções versão {ex.regra_versao ?? "—"}
        </p>
      </div>

      {divergencias.length > 0 && (
        <p className="pa-cartao pa-cartao-plano">
          As contagens desta página não batem com o manifesto do pacote ({divergencias.join("; ")}). Os números abaixo ficam
          em revisão.
        </p>
      )}

      <section aria-labelledby="cq-cobertura" className="mp-radar-secao">
        <h2 id="cq-cobertura" className="mp-radar-h2">
          O que foi olhado
        </h2>
        <div className="pa-grade pa-grade-3">
          <article className="pa-cartao">
            <p className="pa-mono">Pagamentos com nota de empenho</p>
            <p className="pa-numero">{n(c.notas.pares)}</p>
            <p className="pa-nota">
              pares órgão × empresa, em {n(c.orgaosNotas)} órgãos estaduais, de 2023 em diante; compra, serviço, obra e locação
            </p>
          </article>
          <article className="pa-cartao">
            <p className="pa-mono">Emendas parlamentares estaduais</p>
            <p className="pa-numero">{n(c.emendas.pares)}</p>
            <p className="pa-nota">pares órgão × empresa no Estado inteiro, de 2023 em diante; ligação só pelo CNPJ</p>
          </article>
          <article className="pa-cartao">
            <p className="pa-mono">Sanções no CEIS e no CNEP</p>
            <p className="pa-numero">{n(c.sancoes.pares)}</p>
            <p className="pa-nota">
              cruzamentos com atos do Diário{c.fornecedoresConsultados !== null ? `, entre ${n(c.fornecedoresConsultados)} fornecedores consultados` : ""}
            </p>
          </article>
        </div>
      </section>

      <TabelaSituacao
        id="cq-notas"
        titulo="Pagamentos com nota de empenho"
        bloco={c.notas}
        nota={`Fecha a cadeia: ${semReferenciaInterna(ex.regra_fecha) || "ato contratual do próprio órgão pagador com o CNPJ"}. ${n(c.notasFecham)} de ${n(c.notas.pares)} pares fecham (${pct(c.notas.pares ? c.notasFecham / c.notas.pares : 0)}). "Nome em ato… (a conferir)" não soma como fecha: a conferência por nome ficou abaixo do limiar de precisão.`}
        valor
      />
      <TabelaSituacao
        id="cq-emendas"
        titulo="Emendas parlamentares estaduais"
        bloco={c.emendas}
        nota="Credor público (prefeitura, consórcio, estatal) é transferência e fica fora da cadeia de contratação."
        valor
      />
      <TabelaSituacao
        id="cq-sancoes"
        titulo="Sanções do CEIS e do CNEP × atos do Diário"
        bloco={c.sancoes}
        nota="Quem não está entre os fornecedores consultados não foi consultado, o que não quer dizer sem sanção. A classe segue a regra de alcance abaixo."
      />

      <section aria-labelledby="cq-regra" className="mp-radar-secao">
        <h2 id="cq-regra" className="mp-radar-h2">
          A regra de alcance das sanções (versão {ex.regra_versao ?? "—"})
        </h2>
        <p className="pa-sub">
          Uma sanção só conta quando alcança quem contratou. A abrangência que o CEIS registra não decide: impedimento e
          suspensão ficam no ente que os aplicou, mesmo quando o registro diz &ldquo;todas as esferas&rdquo;.
        </p>
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Situação</th>
              <th scope="col">Classe</th>
              <th scope="col">Base legal</th>
            </tr>
          </thead>
          <tbody>
            {c.regras.map((r) => (
              <tr key={r.chave}>
                <th scope="row">{r.motivo}</th>
                <td>{r.classe}</td>
                <td>{r.base}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="cq-metodo" className="mp-radar-secao">
        <h2 id="cq-metodo" className="mp-radar-h2">
          Método e limites
        </h2>
        <ul className="mp-laudo-lista">
          <li>A análise é da PONTE sobre o Diário Oficial da Paraíba e os dados abertos do Estado (notas de empenho e emendas), cruzados pelo CNPJ.</li>
          <li>
            A ligação pelo CNPJ foi conferida à mão numa amostra e acertou todos os casos. A ligação só pelo nome da empresa
            ficou abaixo da precisão exigida (90%) e, nesta fase, nunca soma como cadeia fechada: fica &ldquo;a conferir&rdquo;.
          </li>
          <li>Os casos um a um ficam fora desta página. Ela mostra só totais, sem nome de empresa, de órgão ou de pessoa.</li>
          <li>
            Pacote {ex.versao_pacote ?? "—"}, conferido na carga pelo hash{" "}
            <span className="pa-mono">{ex.sha256_pacote ? `${ex.sha256_pacote.slice(0, 12)}…` : "—"}</span> e pelas contagens do manifesto.
          </li>
        </ul>
      </section>
    </div>
  );
}

function TabelaSituacao({ id, titulo, bloco, nota, valor = false }: { id: string; titulo: string; bloco: BlocoCq; nota: string; valor?: boolean }) {
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
      </h2>
      <table className="mp-tabela">
        <thead>
          <tr>
            <th scope="col">Situação</th>
            <th scope="col" className="mp-num">
              Pares
            </th>
            <th scope="col" className="mp-num">
              Fatia
            </th>
            {valor && (
              <th scope="col" className="mp-num">
                Pago
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {bloco.linhas.map((l) => (
            <tr key={l.situacao}>
              <th scope="row">
                {l.situacao}
                {l.fecha ? " ✓" : ""}
              </th>
              <td className="mp-num">{n(l.pares)}</td>
              <td className="mp-num">{pct(l.fatia)}</td>
              {valor && <td className="mp-num">{l.pago === null ? "—" : moedaCurta(l.pago)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="mp-num">{n(bloco.pares)}</td>
            <td className="mp-num">100%</td>
            {valor && <td className="mp-num">{moedaCurta(bloco.pago)}</td>}
          </tr>
        </tfoot>
      </table>
      <p className="pa-nota">{nota}</p>
    </section>
  );
}
