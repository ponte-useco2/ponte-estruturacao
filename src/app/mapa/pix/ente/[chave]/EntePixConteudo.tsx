/**
 * Os planos do Pix de um ente: um por linha, com o pior ponto a conferir e o estado dos itens que mais
 * pesam; o CSV traz todos os itens, um por coluna. Recebe a leitura pronta.
 */
import Link from "next/link";
import { BotaoImprimir } from "@/app/mapa/fiscal/[ibge]/simular/BotaoImprimir";
import { formatarData } from "@/lib/oportunidades/central";
import { ROTULO_LADO_MOTIVO } from "@/lib/oportunidades/pix";
import { ROTULO_NIVEL, classeEstado, impedidosPorAno, rotuloItem, urlCsvEntePix, urlLaudoPix, type PlanoLaudoPix } from "@/lib/oportunidades/pix-laudo";
import type { LeituraLaudoEntePix } from "@/lib/oportunidades/pix-laudo.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { PixNoTce } from "../../PixNoTce";
import { AVISO_PIX } from "../../plano/[id]/PlanoPixConteudo";

type LeituraOk = Extract<LeituraLaudoEntePix, { estado: "ok" }>;

/** Os itens que aparecem na tabela (o resto está no laudo de cada plano e no CSV). */
const COLUNAS = [
  { item: "A4b", rotulo: "Saída p/ o ente" },
  { item: "A5", rotulo: "Plano antes do pagamento" },
  { item: "C1", rotulo: "Relatório" },
  { item: "C1b", rotulo: "Relatório final" },
  { item: "D1", rotulo: "Prazo" },
];

const n = (x: number) => x.toLocaleString("pt-BR");

export function EntePixConteudo({ leitura, chave, cliente = false }: { leitura: LeituraOk; chave: string; cliente?: boolean }) {
  const planos = leitura.planos;
  const p0 = planos[0];
  const soma = (f: (p: PlanoLaudoPix) => number) => planos.reduce((t, p) => t + f(p), 0);
  const conferir = planos.filter((p) => p.pior);
  const impedidos = impedidosPorAno(planos, 0);

  return (
    <div className="pa-pagina mp-radar mp-laudo">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Laudo do Pix · planos do ente{p0.cnpj ? ` · CNPJ ${p0.cnpj}` : ""}</p>
        <h1 className="pa-titulo">{p0.beneficiario ?? "Ente"}</h1>
        <p className="pa-sub">
          {n(planos.length)} {planos.length === 1 ? "plano de ação" : "planos de ação"} · {moedaCurta(soma((p) => p.valor))} indicados ·{" "}
          {moedaCurta(soma((p) => p.pago))} pagos · {n(conferir.length)} com ponto a conferir
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          <a href={urlCsvEntePix(chave)} className="pa-btn pa-btn-pequeno">
            Baixar CSV (um item por coluna)
          </a>
          {!cliente && (
            <Link prefetch={false} href="/mapa/painel/pix?aba=especiais&uf=PB" className="pa-btn pa-btn-pequeno">
              Painel do Pix
            </Link>
          )}
        </p>
        <p className="mp-fiscal-aviso">{AVISO_PIX}</p>
      </div>

      {impedidos.length > 0 && (
        <section aria-labelledby="ente-impedidos" className="mp-radar-secao">
          <h2 id="ente-impedidos" className="mp-radar-h2">
            Impedidos
          </h2>
          <p className="pa-nota">
            Plano impedido não recebe repasse. &quot;Voltou no mesmo ano&quot; é o plano reapresentado num ciclo seguinte que ficou ciente (ou a
            repetição do mesmo plano); a perda líquida é o resto. O porquê de cada um está no laudo do plano.
          </p>
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Ano</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">De quem era a vez</th>
                  <th scope="col" className="mp-num">Planos</th>
                  <th scope="col" className="mp-num">Valor</th>
                  <th scope="col" className="mp-num">Voltou no mesmo ano</th>
                  <th scope="col" className="mp-num">Perda líquida</th>
                </tr>
              </thead>
              <tbody>
                {impedidos.map((i) => (
                  <tr key={`${i.ano}-${i.grupo}`}>
                    <td>{i.ano}</td>
                    <td>{i.rotulo}</td>
                    <td>{ROTULO_LADO_MOTIVO[i.lado]}</td>
                    <td className="mp-num">{n(i.planos)}</td>
                    <td className="mp-num">{moedaCurta(i.valor)}</td>
                    <td className="mp-num">{i.valorRecuperado > 0 ? moedaCurta(i.valorRecuperado) : "—"}</td>
                    <td className="mp-num">{moedaCurta(i.valorPerdido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="ente-planos" className="mp-radar-secao">
        <h2 id="ente-planos" className="mp-radar-h2">
          Plano a plano
        </h2>
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela mp-pix-laudo-ente">
            <thead>
              <tr>
                <th scope="col">Plano</th>
                <th scope="col" className="mp-num">Pago</th>
                <th scope="col">Pior ponto</th>
                {COLUNAS.map((c) => (
                  <th key={c.item} scope="col">
                    {c.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planos.map((p) => (
                <tr key={p.id_plano_acao}>
                  <th scope="row">
                    <Link prefetch={false} href={urlLaudoPix(p.id_plano_acao)} className="mp-tabela-principal">
                      {p.codigo_plano_acao ?? p.id_plano_acao}
                    </Link>
                    <span className="mp-tabela-secundario">
                      {p.ano} · {p.autor ?? "autor não informado"}
                      {p.situacao?.startsWith("IMPEDIDO") ? " · impedido" : ""}
                    </span>
                    {p.objeto && <span className="mp-tabela-secundario">{p.objeto}</span>}
                  </th>
                  <td className="mp-num">
                    {moedaCurta(p.pago)}
                    {p.dt_primeira_ob && <span className="mp-tabela-secundario">desde {formatarData(p.dt_primeira_ob)}</span>}
                  </td>
                  <td>{p.pior ? <span className={`pa-tag mp-laudo-nivel mp-laudo-${p.pior}`}>{ROTULO_NIVEL[p.pior]}</span> : "—"}</td>
                  {COLUNAS.map((c) => {
                    const i = p.itens.find((x) => x.item === c.item);
                    return (
                      <td key={c.item}>
                        {i ? <span className={`mp-laudo-marca ${classeEstado(i)}`}>{rotuloItem(i)}</span> : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pa-nota">O laudo de cada plano traz todos os itens, com o fato e o dispositivo de cada um.</p>
      </section>

      <PixNoTce tce={leitura.tce} id="ente-tce" />
    </div>
  );
}
