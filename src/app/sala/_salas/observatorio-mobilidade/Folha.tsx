/**
 * A folha A4 da proposta (16/11/2026). Só aparece na impressão (`observatorio.css`); na tela fica escondida.
 *
 * Identidade da Ilha Tech na versão de papel: página branca, texto escuro e laranja pontual (régua do topo, códigos dos
 * produtos). Sem fundos: a impressão comum não imprime cor de fundo.
 *
 * É peça de apresentação, para envio por link privado: a natureza preliminar aparece de forma discreta (o selo "proposta
 * para apreciação · versão preliminar"), sem marca d'água nem linguagem de aprovação (correção estratégica do titular,
 * 16/11/2026). A autoria é da PONTE; a Ilha Tech aparece como entidade executora prevista.
 *
 * Não tem fonte própria: recebe a proposta e os textos de apresentação por parâmetro, os mesmos que a página mostra.
 * Nenhum texto de conteúdo é escrito aqui — o teste `proposta-observatorio.test.ts` confere isso lendo este arquivo.
 *
 * O título é parágrafo, não `<h1>`: na tela a folha fica escondida e a página já tem o seu; a sala tem um só `<h1>`.
 */
import {
  AVISO_ATIVOS,
  TIPOS_DE_ATIVO,
  centavosEmReais,
  centavosResumidos,
  dataBr,
  evidenciasDe,
  lerComposicao,
  seloDeEstado,
  type Apresentacao,
  type Proposta,
} from "@/lib/oportunidades/proposta-observatorio";

const comMaiuscula = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1) + ".";

/** O selo com a versão inteira numa linha só: o navegador quebraria "2026-11-16.5" no hífen. */
function Selo({ proposta }: { proposta: Proposta }) {
  const [antes, ...resto] = seloDeEstado(proposta).split(proposta.versao);
  if (resto.length === 0) return <>{antes}</>;
  return (
    <>
      {antes}
      <span className="ob-inteiro">{proposta.versao}</span>
      {resto.join(proposta.versao)}
    </>
  );
}

export function Folha({
  proposta,
  apresentacao,
}: {
  proposta: Proposta;
  apresentacao: Apresentacao;
}) {
  const composicao =
    proposta.composicao.length > 0 ? lerComposicao(proposta.composicao) : null;
  const etapa = (codigo: string) =>
    apresentacao.etapas.find((e) => e.produto === codigo);
  const semComprovado = evidenciasDe(proposta, "demonstrado").length === 0;
  return (
    <article className="ob-folha">
      <header className="ob-folha-cabeca">
        <div>
          <p className="ob-folha-kicker">Proposta de pesquisa aplicada</p>
          <p className="ob-folha-titulo">{proposta.titulo}</p>
          <p className="ob-folha-autoria">
            <span>
              Proposta: <strong>{proposta.autoria}</strong>
            </span>
            <span>
              Entidade executora prevista:{" "}
              <strong>{proposta.executoraPrevista}</strong>
            </span>
          </p>
        </div>
        <p className="ob-folha-selo">
          <Selo proposta={proposta} />
        </p>
      </header>

      <section>
        <h2>Objeto</h2>
        <p className="ob-folha-objeto">{proposta.objetoCurto}</p>
      </section>

      <section>
        <h2>
          O que se propõe fazer com{" "}
          {centavosResumidos(proposta.investimentoPretendidoCentavos)}
        </h2>
        <ol className="ob-folha-sintese">
          {apresentacao.sintese.map((x) => (
            <li key={x.verbo}>
              <strong>{x.verbo}</strong> {x.texto}{" "}
              <span className="ob-folha-codigos">{x.produtos.join(" · ")}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Os quatro produtos</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Produto</th>
              <th scope="col">Entrega</th>
              <th scope="col">Atividade ou metodologia</th>
              <th scope="col">Como a conclusão será comprovada</th>
            </tr>
          </thead>
          <tbody>
            {proposta.produtos.map((p) => {
              const e = etapa(p.codigo);
              return (
                <tr key={p.codigo}>
                  <td>
                    <span className="ob-folha-codigo">{p.codigo}</span>{" "}
                    <strong>{p.nome}</strong>
                  </td>
                  <td>{e ? e.entrega : "—"}</td>
                  <td>{e ? comMaiuscula(e.trecho) : "—"}</td>
                  <td>{p.evidencia}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {semComprovado && (
          <p className="ob-folha-estado">
            Nenhum resultado aparece como comprovado nesta versão: os produtos
            são o que a pesquisa vai fazer.
          </p>
        )}
      </section>

      <section className="ob-folha-fim">
        <div>
          <h2>O que fica para o Observatório</h2>
          <div className="ob-folha-reuso">
            {TIPOS_DE_ATIVO.map((t) => (
              <p key={t.tipo}>
                <strong>{t.titulo}</strong>{" "}
                <span className="ob-folha-condicao">
                  ({t.condicao.replace(/\.$/, "").toLowerCase()})
                </span>
                :{" "}
                {apresentacao.reuso
                  .filter((r) => r.tipo === t.tipo)
                  .map((r) => `${r.ativo} (${r.produto})`)
                  .join(" · ")}
              </p>
            ))}
          </div>
          <p className="ob-folha-nota">
            {AVISO_ATIVOS}
          </p>
        </div>
        <div>
          <h2>Para a próxima conversa</h2>
          <p className="ob-folha-conversa">{apresentacao.conversa.join(" ")}</p>
        </div>
      </section>

      <section className="ob-folha-numeros">
        <div>
          <h2>Investimento proposto</h2>
          <p className="ob-folha-numero">
            {centavosResumidos(proposta.investimentoPretendidoCentavos)}
          </p>
          <p className="ob-folha-nota">
            {centavosEmReais(proposta.investimentoPretendidoCentavos)}
          </p>
        </div>
        <div>
          <h2>Prazo de trabalho</h2>
          <p className="ob-folha-numero">{proposta.prazoMeses} meses</p>
        </div>
        <div>
          <h2>Composição financeira</h2>
          <p>
            {composicao === null
              ? "Em elaboração."
              : composicao.emElaboracao > 0
                ? `${centavosEmReais(composicao.definidoCentavos)} definidos; ${composicao.emElaboracao} linha(s) em elaboração.`
                : centavosEmReais(composicao.definidoCentavos)}
          </p>
        </div>
      </section>

      <footer className="ob-folha-pe">
        <p>
          Preparada em {dataBr(proposta.preparadaEm)}. Fontes:{" "}
          {apresentacao.fontes.join(" ")}
        </p>
      </footer>
    </article>
  );
}
