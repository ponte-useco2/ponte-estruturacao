import { FONTES_CQ, FRASE_FIXA, divergenciasDoManifesto, semReferenciaInterna, urlDaLei, urlSituacao, type CadeiaQuebrada, type ExecucaoCq } from "@/lib/oportunidades/cadeia-quebrada";
import { formatarData } from "@/lib/oportunidades/central";
import { LinkMapa } from "../_componentes/LinkMapa";
import { LinkFora, TabelaSituacao, n, pct } from "./PecasCadeia";

/**
 * O corpo da página da cadeia quebrada (PUB-11). Desde 30/10/2026 (pedido do titular), tudo é clicável: cada número e
 * cada situação levam à página da situação (órgãos ou motivos e os casos por CNPJ), cada fonte ao endereço de origem e
 * cada lei ao texto oficial.
 */
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
          <strong>{FRASE_FIXA}</strong> O <LinkFora href={FONTES_CQ.diario.url}>Diário</LinkFora> não é a única publicação
          obrigatória, e a ligação entre pagamento e ato é feita pelo CNPJ.
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
            <p className="pa-mono">
              <LinkFora href={FONTES_CQ.notas.url}>Pagamentos com nota de empenho</LinkFora>
            </p>
            <p className="pa-numero">
              <a href="#cq-notas">{n(c.notas.pares)}</a>
            </p>
            <p className="pa-nota">
              pares órgão × credor, em {n(c.orgaosNotas)} órgãos estaduais, de 2023 em diante; compra, serviço, obra e locação
            </p>
          </article>
          <article className="pa-cartao">
            <p className="pa-mono">
              <LinkFora href={FONTES_CQ.emendas.url}>Emendas parlamentares estaduais</LinkFora>
            </p>
            <p className="pa-numero">
              <a href="#cq-emendas">{n(c.emendas.pares)}</a>
            </p>
            <p className="pa-nota">pares órgão × credor no Estado inteiro, de 2023 em diante; ligação só pelo CNPJ</p>
          </article>
          <article className="pa-cartao">
            <p className="pa-mono">
              <LinkFora href={FONTES_CQ.sancoes.url}>Sanções no CEIS e no CNEP</LinkFora>
            </p>
            <p className="pa-numero">
              <a href="#cq-sancoes">{n(c.sancoes.pares)}</a>
            </p>
            <p className="pa-nota">
              cruzamentos com atos do Diário{c.fornecedoresConsultados !== null ? `, entre ${n(c.fornecedoresConsultados)} fornecedores consultados` : ""}
            </p>
          </article>
        </div>
      </section>

      <TabelaSituacao
        id="cq-notas"
        bloco="notas"
        titulo="Pagamentos com nota de empenho"
        dados={c.notas}
        nota={`Fecha a cadeia: ${semReferenciaInterna(ex.regra_fecha) || "ato contratual do próprio órgão pagador com o CNPJ"}. ${n(c.notasFecham)} de ${n(c.notas.pares)} pares fecham (${pct(c.notas.pares ? c.notasFecham / c.notas.pares : 0)}). "Nome em ato… (a conferir)" não soma como fecha: a conferência por nome ficou abaixo do limiar de precisão.`}
        valor
      />
      <TabelaSituacao
        id="cq-emendas"
        bloco="emendas"
        titulo="Emendas parlamentares estaduais"
        dados={c.emendas}
        nota="Nas emendas, a ligação é pelo CNPJ em ato de qualquer órgão do Diário, sem a regra do órgão pagador e da data: a precisão não foi medida. Credor público (prefeitura, consórcio, estatal) é transferência e fica fora da cadeia de contratação."
        valor
      />
      <TabelaSituacao
        id="cq-sancoes"
        bloco="sancoes"
        titulo="Sanções do CEIS e do CNEP × atos do Diário"
        dados={c.sancoes}
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
            {c.regras.map((r) => {
              const lei = urlDaLei(r.base);
              // A classe que tem cruzamento nesta geração leva à página dela (motivos e casos).
              const classe = c.sancoes.linhas.some((l) => l.situacao === r.classe) ? urlSituacao("sancoes", r.classe) : null;
              return (
                <tr key={r.chave}>
                  <th scope="row">{classe ? <LinkMapa href={classe}>{r.motivo}</LinkMapa> : r.motivo}</th>
                  <td>{classe ? <LinkMapa href={classe}>{r.classe}</LinkMapa> : r.classe}</td>
                  <td>{lei ? <LinkFora href={lei}>{r.base}</LinkFora> : r.base}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="cq-metodo" className="mp-radar-secao">
        <h2 id="cq-metodo" className="mp-radar-h2">
          Método e limites
        </h2>
        <ul className="mp-laudo-lista">
          <li>
            A análise é da PONTE sobre o <LinkFora href={FONTES_CQ.diario.url}>Diário Oficial da Paraíba</LinkFora> e os dados
            abertos do Estado (<LinkFora href={FONTES_CQ.notas.url}>notas de empenho</LinkFora> e{" "}
            <LinkFora href={FONTES_CQ.emendas.url}>emendas</LinkFora>), cruzados pelo CNPJ, e sobre o{" "}
            <LinkFora href={FONTES_CQ.sancoes.url}>CEIS e o CNEP</LinkFora>.
          </li>
          <li>
            Na regra adotada (ato contratual do próprio órgão pagador), 20 de 20 pares de uma amostra estavam certos,
            conferidos no texto de cada ato. A ligação só pelo nome da empresa ficou abaixo da precisão exigida (90%) e, nesta
            fase, nunca soma como cadeia fechada: fica &ldquo;a conferir&rdquo;.
          </li>
          <li>
            Clique numa situação para ver os órgãos e os casos, por CNPJ. Nenhuma página mostra razão social nem nome de pessoa.
            O pacote traz os casos das situações com ponto para olhar; nas demais, a situação abre com o recorte por órgão.
          </li>
          <li>
            Pacote {ex.versao_pacote ?? "—"}, conferido na carga pelo hash{" "}
            <span className="pa-mono">{ex.sha256_pacote ? `${ex.sha256_pacote.slice(0, 12)}…` : "—"}</span> e pelas contagens do manifesto.
          </li>
        </ul>
      </section>
      <p className="pa-nota">
        <strong>{FRASE_FIXA}</strong>
      </p>
    </div>
  );
}
