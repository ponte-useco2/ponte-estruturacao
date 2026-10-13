/**
 * Os planos do Pix de um ente: um por linha, com o pior ponto a conferir e o estado dos itens que mais
 * pesam; o CSV traz todos os itens, um por coluna. Recebe a leitura pronta.
 *
 * Onda 15, fase 2, lote B (13/10/2026): os impedidos por ano e motivo e os planos são tabelas com filtro e ordem em cada
 * coluna (`TabelaFiltravel`). A tela é do cliente e do administrador: toda coluna ordena, e a ordem padrão é a de antes.
 * A célula do plano junta o código, o ano, o autor, o impedido e o objeto; cada um filtra numa coluna oculta. O CSV
 * filtrado de cada tabela convive com o CSV de todos os itens, que continua no alto.
 */
import { BotaoImprimir } from "@/app/mapa/fiscal/[ibge]/simular/BotaoImprimir";
import { formatarData } from "@/lib/oportunidades/central";
import { ROTULO_LADO_MOTIVO } from "@/lib/oportunidades/pix";
import { ROTULO_NIVEL, classeEstado, impedidosPorAno, rotuloItem, urlCsvEntePix, urlLaudoPix, type PlanoLaudoPix } from "@/lib/oportunidades/pix-laudo";
import type { LeituraLaudoEntePix } from "@/lib/oportunidades/pix-laudo.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { ColunaTabela, LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { PixNoTce } from "../../PixNoTce";
import { AVISO_PIX } from "../../plano/[id]/PlanoPixConteudo";
import { LinkMapa } from "../../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../../_componentes/TabelaFiltravel";
import { Termo } from "../../../_componentes/Termo";

type LeituraOk = Extract<LeituraLaudoEntePix, { estado: "ok" }>;

/** Os itens que aparecem na tabela (o resto está no laudo de cada plano e no CSV). */
const COLUNAS = [
  { item: "A4b", rotulo: "Saída p/ o ente" },
  { item: "A5", rotulo: "Plano antes do pagamento" },
  { item: "C1", rotulo: "Relatório" },
  { item: "C1b", rotulo: "Relatório final" },
  { item: "D1", rotulo: "Prazo" },
];

/** O id da coluna de um item no endereço: "A4b" → "a4b" (só minúsculas, dígitos e hífen). */
const idDoItem = (item: string) => item.toLowerCase();

// ================================================================ as tabelas com filtro (onda 15, fase 2, lote B, 13/10/2026)

const COLUNAS_IMPEDIDOS: ColunaTabela[] = [
  { id: "ano", titulo: "Ano", tipo: "numero" },
  { id: "motivo", titulo: "Motivo", tipo: "categoria" },
  { id: "vez", titulo: "De quem era a vez", tipo: "categoria" },
  { id: "planos", titulo: "Planos", tipo: "numero", alinhar: "direita" },
  { id: "valor", titulo: "Valor", tipo: "numero", alinhar: "direita" },
  { id: "recuperado", titulo: "Voltou no mesmo ano", tipo: "numero", alinhar: "direita" },
  { id: "perda", titulo: "Perda líquida", tipo: "numero", alinhar: "direita" },
];

const COLUNAS_PLANOS: ColunaTabela[] = [
  { id: "plano", titulo: "Plano", tipo: "texto", textoNoCsv: true },
  { id: "ano", titulo: "Ano", tipo: "numero", oculta: true },
  { id: "autor", titulo: "Autor", tipo: "texto", oculta: true },
  { id: "impedido", titulo: "Impedido", tipo: "categoria", oculta: true },
  { id: "objeto", titulo: "Objeto", tipo: "texto", oculta: true },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
  { id: "primeira-ob", titulo: "Primeiro pagamento", tipo: "data", oculta: true },
  { id: "pior", titulo: "Pior ponto", tipo: "categoria" },
  ...COLUNAS.map((c): ColunaTabela => ({ id: idDoItem(c.item), titulo: c.rotulo, tipo: "categoria" })),
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
          {moedaCurta(soma((p) => p.pago))} pagos · {n(conferir.length)} com ponto{" "}
          <Termo slug="ponto-a-conferir">a conferir</Termo>
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          {/* B14b (08/10/2026): botões com verbo e objeto. */}
          <a href={urlCsvEntePix(chave)} className="pa-btn pa-btn-pequeno">
            Baixar os planos (CSV, um item por coluna)
          </a>
          {!cliente && (
            <LinkMapa href="/mapa/painel/pix?aba=especiais&uf=PB" className="pa-btn pa-btn-pequeno">
              Abrir o painel do Pix
            </LinkMapa>
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
          <TabelaFiltravel
            id="pix-impedidos"
            rotulo="Impedidos por ano e motivo"
            colunas={COLUNAS_IMPEDIDOS}
            linhas={impedidos.map(
              (i): LinhaTabela => ({
                chave: `${i.ano}-${i.grupo}`,
                valores: {
                  ano: i.ano,
                  motivo: i.rotulo,
                  vez: ROTULO_LADO_MOTIVO[i.lado] ?? null,
                  planos: i.planos,
                  valor: i.valor,
                  recuperado: i.valorRecuperado,
                  perda: i.valorPerdido,
                },
                celulas: {
                  // O ano tem célula própria: sem ela, sairia com ponto de milhar ("2.025").
                  ano: String(i.ano),
                  valor: moedaCurta(i.valor),
                  recuperado: i.valorRecuperado > 0 ? moedaCurta(i.valorRecuperado) : "—",
                  perda: moedaCurta(i.valorPerdido),
                },
              }),
            )}
            descricaoOrdemPadrao="do ano mais recente para o mais antigo e, no ano, do maior valor para o menor"
            csv={{ nome: `pix-impedidos-${chave}` }}
            empilhar
          />
        </section>
      )}

      <section aria-labelledby="ente-planos" className="mp-radar-secao">
        <h2 id="ente-planos" className="mp-radar-h2">
          Plano a plano
        </h2>
        <TabelaFiltravel
          id="pix-planos"
          rotulo="Plano a plano"
          colunas={COLUNAS_PLANOS}
          linhas={planos.map((p): LinhaTabela => {
            const impedido = !!p.situacao?.startsWith("IMPEDIDO");
            const valores: LinhaTabela["valores"] = {
              plano: p.codigo_plano_acao ?? String(p.id_plano_acao),
              ano: p.ano,
              autor: p.autor,
              impedido: impedido ? "Sim" : "Não",
              objeto: p.objeto,
              pago: p.pago,
              "primeira-ob": p.dt_primeira_ob,
              pior: p.pior ? ROTULO_NIVEL[p.pior] : null,
            };
            const celulas: LinhaTabela["celulas"] = {
              plano: (
                <>
                  <LinkMapa href={urlLaudoPix(p.id_plano_acao)} className="mp-tabela-principal">
                    {p.codigo_plano_acao ?? p.id_plano_acao}
                  </LinkMapa>
                  <span className="mp-tabela-secundario">
                    {p.ano} · {p.autor ?? "autor não informado"}
                    {impedido ? " · impedido" : ""}
                  </span>
                  {p.objeto && <span className="mp-tabela-secundario">{p.objeto}</span>}
                </>
              ),
              pago: (
                <>
                  {moedaCurta(p.pago)}
                  {p.dt_primeira_ob && <span className="mp-tabela-secundario">desde {formatarData(p.dt_primeira_ob)}</span>}
                </>
              ),
              pior: p.pior ? <span className={`pa-tag mp-laudo-nivel mp-laudo-${p.pior}`}>{ROTULO_NIVEL[p.pior]}</span> : "—",
            };
            for (const c of COLUNAS) {
              const i = p.itens.find((x) => x.item === c.item);
              valores[idDoItem(c.item)] = i ? rotuloItem(i) : null;
              celulas[idDoItem(c.item)] = i ? <span className={`mp-laudo-marca ${classeEstado(i)}`}>{rotuloItem(i)}</span> : "—";
            }
            return { chave: String(p.id_plano_acao), valores, celulas };
          })}
          descricaoOrdemPadrao="do ano mais recente para o mais antigo e, no ano, do mais pago para o menos pago"
          csv={{ nome: `pix-planos-${chave}` }}
        />
        <p className="pa-nota">O laudo de cada plano traz todos os itens, com o fato e o dispositivo de cada um.</p>
      </section>

      <PixNoTce tce={leitura.tce} id="ente-tce" />
    </div>
  );
}
