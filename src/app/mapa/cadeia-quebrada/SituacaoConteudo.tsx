import {
  BLOCOS,
  FRASE_FIXA,
  casosPorOrgao,
  motivosDaClasse,
  rotuloSituacao,
  urlDaLei,
  urlSituacao,
  type BlocoId,
  type CasoCq,
  type ExecucaoCq,
  type LinhaCq,
  type SituacaoCq,
} from "@/lib/oportunidades/cadeia-quebrada";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { LinkMapa } from "../_componentes/LinkMapa";
import { FontesDoBloco, LinkFora, TabelaCasos, n } from "./PecasCadeia";

/**
 * Uma situação de um bloco (30/10/2026): o recorte por órgão (notas: do pacote; emendas: dos casos) ou por motivo
 * (sanções, pela regra da própria geração), e os casos por CNPJ. Com `orgao`, só os casos daquele órgão.
 */
export function SituacaoConteudo({
  ex,
  bloco,
  linha,
  orgao,
  porOrgao,
  motivos,
  casos,
}: {
  ex: ExecucaoCq;
  bloco: BlocoId;
  linha: SituacaoCq;
  orgao: string | null;
  porOrgao: LinhaCq[];
  motivos: LinhaCq[];
  casos: CasoCq[];
}) {
  const def = BLOCOS[bloco];
  const grupos =
    porOrgao.length > 0
      ? porOrgao.map((o) => ({ chave: o.orgao ?? "órgão não informado", pares: Number(o.pares ?? 0), pago: o.pago === null ? null : Number(o.pago) }))
      : casosPorOrgao(casos);
  const doMotivo = bloco === "sancoes" ? motivosDaClasse(ex, motivos, linha.situacao) : [];
  const regras = Object.values(((ex.regra_alcance ?? {}) as { regras?: Record<string, { classe?: string; motivo?: string; base_legal?: string }> }).regras ?? {});
  const baseDoMotivo = (m: string) => regras.find((r) => r.motivo === m)?.base_legal ?? null;
  const casosDoOrgao = orgao ? casos.filter((c) => c.orgao === orgao) : casos;

  return (
    <div className="pa-pagina mp-radar mp-laudo">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">
          <LinkMapa href="/mapa/cadeia-quebrada">Cadeia do gasto</LinkMapa> ·{" "}
          <LinkMapa href={`/mapa/cadeia-quebrada#cq-${bloco}`}>{def.titulo}</LinkMapa>
          {orgao ? (
            <>
              {" "}
              · <LinkMapa href={urlSituacao(bloco, linha.situacao)}>{rotuloSituacao(linha.situacao)}</LinkMapa>
            </>
          ) : null}
        </p>
        <h1 className="pa-titulo">{orgao ?? rotuloSituacao(linha.situacao)}</h1>
        <p className="pa-sub">
          {orgao ? `${rotuloSituacao(linha.situacao)}. ` : ""}
          {n(linha.pares)} {linha.pares === 1 ? "par" : "pares"} na situação
          {linha.pago !== null ? `, ${moedaCurta(linha.pago)} pagos` : ""}. <strong>{FRASE_FIXA}</strong>
        </p>
      </div>

      {!orgao && grupos.length > 0 && (
        <section aria-labelledby="cq-orgaos" className="mp-radar-secao">
          <h2 id="cq-orgaos" className="mp-radar-h2">
            Por órgão pagador
          </h2>
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Órgão</th>
                <th scope="col" className="mp-num">
                  Pares
                </th>
                <th scope="col" className="mp-num">
                  Pago
                </th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.chave}>
                  <th scope="row">
                    <LinkMapa href={urlSituacao(bloco, linha.situacao, g.chave)}>{g.chave}</LinkMapa>
                  </th>
                  <td className="mp-num">{n(g.pares)}</td>
                  <td className="mp-num">{g.pago === null ? "—" : moedaCurta(g.pago)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {!orgao && doMotivo.length > 0 && (
        <section aria-labelledby="cq-motivos" className="mp-radar-secao">
          <h2 id="cq-motivos" className="mp-radar-h2">
            Por motivo, pela regra de alcance
          </h2>
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Motivo</th>
                <th scope="col" className="mp-num">
                  Cruzamentos
                </th>
                <th scope="col">Base legal</th>
              </tr>
            </thead>
            <tbody>
              {doMotivo.map((m) => {
                const base = baseDoMotivo(m.chave);
                const lei = base ? urlDaLei(base) : null;
                return (
                  <tr key={m.chave}>
                    <th scope="row">{m.chave}</th>
                    <td className="mp-num">{n(m.pares)}</td>
                    <td>{base ? lei ? <LinkFora href={lei}>{base}</LinkFora> : base : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="cq-casos" className="mp-radar-secao">
        <h2 id="cq-casos" className="mp-radar-h2">
          {orgao ? "Os casos deste órgão" : "Os casos, por CNPJ"}
        </h2>
        {casosDoOrgao.length > 0 ? (
          <>
            <p className="pa-sub">
              {n(casosDoOrgao.length)} {casosDoOrgao.length === 1 ? "caso" : "casos"}, do maior valor pago ao menor. O CNPJ abre
              tudo o que a geração tem dele, com os endereços para conferir na origem.
            </p>
            <TabelaCasos casos={casosDoOrgao} bloco={bloco} situacao={linha.situacao} />
          </>
        ) : (
          <p className="pa-cartao pa-cartao-plano">
            O pacote desta geração não traz os casos um a um desta situação: só os das situações com ponto para olhar.
            {grupos.length > 0 && !orgao ? " O recorte por órgão acima vem do próprio pacote." : ""}
          </p>
        )}
        <FontesDoBloco bloco={bloco} />
      </section>
    </div>
  );
}
