import {
  FRASE_FIXA,
  cnpjLegivelCq,
  origensDoCnpj,
  rotuloSituacao,
  urlSituacao,
  type CasoCq,
} from "@/lib/oportunidades/cadeia-quebrada";
import { formatarData } from "@/lib/oportunidades/central";
import { urlFornecedor } from "@/lib/oportunidades/fornecedores";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { LinkMapa } from "../_componentes/LinkMapa";
import { BLOCO_DO_TESTE, LinkFora, TabelaCasos } from "./PecasCadeia";

/**
 * O último nível (30/10/2026): tudo o que a geração tem de um CNPJ — os casos, a sanção quando há, o dossiê de
 * fornecedor quando ele recebeu convênio federal na PB — e os endereços para conferir na origem. Sem razão social.
 */
export function CnpjConteudo({ cnpj, casos, noPainelFederal }: { cnpj: string; casos: CasoCq[]; noPainelFederal: boolean }) {
  const pago = casos.reduce((s, c) => s + Number(c.pago ?? 0), 0);
  const situacoes = [...new Map(casos.map((c) => [`${c.teste}|${c.situacao}`, c])).values()];
  const sancoes = casos.filter((c) => c.sancao);
  return (
    <div className="pa-pagina mp-radar mp-laudo">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">
          <LinkMapa href="/mapa/cadeia-quebrada">Cadeia do gasto</LinkMapa> · CNPJ
        </p>
        <h1 className="pa-titulo pa-mono">{cnpjLegivelCq(cnpj)}</h1>
        <p className="pa-sub">
          {casos.length} {casos.length === 1 ? "caso" : "casos"} nesta geração{pago > 0 ? `, ${moedaCurta(pago)} pagos` : ""}.{" "}
          <strong>{FRASE_FIXA}</strong>
        </p>
        <p className="pa-nota">
          Situações:{" "}
          {situacoes.map((c, k) => {
            const bloco = BLOCO_DO_TESTE[c.teste];
            const situacao = bloco === "sancoes" ? c.situacao.replace(/^sanção /, "") : c.situacao;
            return (
              <span key={`${c.teste}|${c.situacao}`}>
                {k > 0 ? " · " : ""}
                {bloco ? <LinkMapa href={urlSituacao(bloco, situacao)}>{rotuloSituacao(c.situacao)}</LinkMapa> : rotuloSituacao(c.situacao)}
              </span>
            );
          })}
        </p>
      </div>

      <section aria-labelledby="cq-cnpj-casos" className="mp-radar-secao">
        <h2 id="cq-cnpj-casos" className="mp-radar-h2">
          Os casos
        </h2>
        <TabelaCasos casos={casos} bloco={null} situacao={null} />
      </section>

      {sancoes.length > 0 && (
        <section aria-labelledby="cq-cnpj-sancao" className="mp-radar-secao">
          <h2 id="cq-cnpj-sancao" className="mp-radar-h2">
            A sanção que alcança
          </h2>
          <ul className="mp-laudo-lista">
            {sancoes.map((c) => (
              <li key={c.ordem}>
                {c.sancao?.cadastro ?? "CEIS/CNEP"}: {c.sancao?.tipo ?? "tipo não informado"}
                {c.sancao?.sancionador
                  ? `, aplicada por ${c.sancao.sancionador}${c.sancao.uf && !c.sancao.sancionador.includes(`(${c.sancao.uf})`) ? ` (${c.sancao.uf})` : ""}`
                  : ""}
                {c.sancao?.inicio ? `, desde ${formatarData(c.sancao.inicio)}` : ""}
                {c.sancao?.fim ? ` até ${formatarData(c.sancao.fim)}` : ", sem data final"}. {c.motivo ? `${c.motivo}. ` : ""}
                {c.sancao?.link && <LinkFora href={c.sancao.link}>Ver o registro na CGU</LinkFora>}
                {c.link_diario && (
                  <>
                    {" · "}
                    <LinkFora href={c.link_diario}>o ato no Diário</LinkFora>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="cq-cnpj-origem" className="mp-radar-secao">
        <h2 id="cq-cnpj-origem" className="mp-radar-h2">
          Conferir na origem
        </h2>
        <ul className="mp-laudo-lista">
          {noPainelFederal && (
            <li>
              <LinkMapa href={urlFornecedor(cnpj)}>Dossiê de fornecedor</LinkMapa>: os convênios federais da PB em que a empresa recebeu.
            </li>
          )}
          {origensDoCnpj(cnpj).map((o) => (
            <li key={o.url}>
              <LinkFora href={o.url}>{o.nome}</LinkFora>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
