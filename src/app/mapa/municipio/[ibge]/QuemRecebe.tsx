/**
 * "Quem recebe no município" (E1, 07/10/2026): a descida do município para as entidades. Os instrumentos do
 * município agrupados por CNPJ em lentes (poder público municipal, estado no município, sociedade civil), cada
 * entidade levando à sua página. Só a lente municipal forma a fila do município; as outras são listadas, não somadas.
 *
 * E3 (07/10/2026): na sociedade civil entram também as organizações ativas do Mapa das OSC (Ipea), com ou sem
 * instrumento — aqui o resumo por área e natureza; a lista inteira em `/mapa/municipio/[ibge]/organizacoes`.
 *
 * C4a (09/10/2026; achado 4.1 da auditoria R1): a lista das organizações pede cadastro (fora da lista branca de
 * `publico.ts`, decisão do titular em aberto). No nível 0, as áreas ficam sem link e o botão diz "(pede cadastro)" e
 * leva à entrada, em vez de mandar ao login sem aviso.
 *
 * Onda 15, fase 2, lote A (13/10/2026): as entidades viraram uma tabela só, filtrável (eram uma tabela por lente, do
 * maior valor para o menor, numa tela pública). A lente é a coluna "Grupo", de categoria; a ordem padrão é a alfabética;
 * o valor e as contagens filtram, mas não ordenam (ranking público rejeitado). A explicação de cada grupo fica logo
 * abaixo da tabela, e o resumo das OSC, que vinha dentro do grupo da sociedade civil, num bloco próprio. Este bloco não
 * recebe o nível: a regra pública vale para todos aqui, e o CSV (só o filtrado) fica do cadastro em diante.
 */
import Link from "next/link";
import { ROTULO_AREA, rotuloArea, rotuloNatureza, versaoLegivel, type FonteOsc, type ResumoOscMunicipio } from "@/lib/oportunidades/osc";
import { EXPLICA_LENTE, ROTULO_ESPECIE, ROTULO_LENTE, urlEntidade, type EntidadeNoMunicipio, type LenteEntidade } from "@/lib/oportunidades/pagina-entidade";
import { colunasEntidades, emOrdemAlfabetica, valoresDaEntidade } from "@/lib/oportunidades/pagina-uf";
import { MARCA_PEDE_CADASTRO, linkNoPublico } from "@/lib/oportunidades/publico";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { Carregando } from "../../_componentes/Carregando";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../_componentes/TabelaFiltravel";
import { Termo } from "../../_componentes/Termo";
import { Secao } from "./relatorio/RelatorioConteudo";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";

/** O prefixo da tabela no endereço (`?t.quem-recebe.<coluna>=…`), único na página do município. */
const TABELA_QUEM_RECEBE = "quem-recebe";
/** A regra pública: as colunas de valor e de contagem filtram, mas não ordenam. */
const COLUNAS_QUEM_RECEBE = colunasEntidades({ grupo: true, livre: false });

const n = (x: number) => x.toLocaleString("pt-BR");
const plural = (x: number, um: string, varios: string) => `${n(x)} ${x === 1 ? um : varios}`;

/** O resumo do cadastro: quantas ativas, de que tipo e em que área, com o link para a lista inteira. */
function SociedadeCivil({
  osc,
  ibge,
  municipio,
  publico,
}: {
  osc: { resumo: ResumoOscMunicipio; fonte: FonteOsc };
  ibge: string;
  municipio: string;
  publico: boolean;
}) {
  const r = osc.resumo;
  const lista = linkNoPublico(`/mapa/municipio/${ibge}/organizacoes`, publico);
  const daArea = (a: string) => linkNoPublico(`/mapa/municipio/${ibge}/organizacoes?area=${a}`, publico);
  const maior = Math.max(1, ...Object.values(r.por_area));
  const areas = Object.entries(r.por_area).sort(
    (a, b) => Number(a[0] === "sem_area") - Number(b[0] === "sem_area") || b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const naturezas = Object.entries(r.por_natureza).sort((a, b) => b[1] - a[1]);
  const fora = r.inaptas + r.suspensas + r.baixadas;
  return (
    <div className="mp-ent-osc">
      <h3 className="mp-rel-h3">Todas as organizações da sociedade civil</h3>
      <p>
        O <Termo slug="mapa-das-osc">Mapa das OSC</Termo> (Ipea, versão de {versaoLegivel(osc.fonte.versao)}) registra{" "}
        <strong>{plural(r.ativas, "organização ativa", "organizações ativas")}</strong> com sede em {municipio}: {plural(r.matrizes, "matriz", "matrizes")} e{" "}
        {plural(r.filiais, "filial", "filiais")}.
        {fora > 0 && (
          <>
            {" "}
            Outras {n(fora)} estão <Termo slug="osc-ativa">inaptas, suspensas ou baixadas</Termo> na Receita e ficam fora da lista.
          </>
        )}
        {r.recentes > 0 && <> {plural(r.recentes, "foi fundada", "foram fundadas")} nos últimos 5 anos.</>}
        {r.com_cebas > 0 && (
          <>
            {" "}
            {plural(r.com_cebas, "tem", "têm")} <Termo slug="cebas">CEBAS</Termo> nas planilhas do Mapa.
          </>
        )}
      </p>
      <TabelaRolagem rotulo="Ativas por área de atuação (uma organização pode ter mais de uma área)">
        <table className="mp-tabela mp-ent-areas">
          <caption className="pa-nota">Ativas por área de atuação (uma organização pode ter mais de uma área)</caption>
          <tbody>
            {areas.map(([a, x]) => (
              <tr key={a}>
                <th scope="row">
                  {Object.hasOwn(ROTULO_AREA, a) && a !== "sem_area" && !daArea(a).pedeCadastro ? (
                    <Link href={daArea(a).href} prefetch={false}>
                      {rotuloArea(a)}
                      <Carregando />
                    </Link>
                  ) : (
                    rotuloArea(a)
                  )}
                </th>
                <td className="mp-rel-num">{n(x)}</td>
                <td className="mp-ent-barra-celula" aria-hidden="true">
                  <span className="mp-ent-barra" style={{ width: `${Math.round((x / maior) * 100)}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaRolagem>
      <p className="pa-nota">
        Por <Termo slug="natureza-juridica">natureza jurídica</Termo>: {naturezas.map(([k, x]) => `${rotuloNatureza(k === "sem_natureza" ? null : k)} ${n(x)}`).join("; ")}.
      </p>
      <p className="mp-nao-imprimir mp-laudo-acoes">
        <Link href={lista.href} className="pa-btn pa-btn-pequeno" prefetch={false}>
          Ver as {n(r.ativas)} organizações{lista.pedeCadastro && ` ${MARCA_PEDE_CADASTRO}`}
          <Carregando />
        </Link>
      </p>
    </div>
  );
}

export function QuemRecebe({
  grupos,
  municipio,
  ibge,
  osc = null,
  publico = false,
}: {
  grupos: { lente: LenteEntidade; entidades: EntidadeNoMunicipio[] }[] | null;
  municipio: string;
  ibge: string;
  /** O resumo do Mapa das OSC (E3); null sem a oport_32 ou sem carga. */
  osc?: { resumo: ResumoOscMunicipio; fonte: FonteOsc } | null;
  /** C4a: o nível 0 (versão pública). */
  publico?: boolean;
}) {
  if (!grupos) return <p className="pa-nota">A lista de quem recebe no município não pôde ser lida agora.</p>;
  if (!grupos.length && !osc) return null;
  const temSociedade = grupos.some((g) => g.lente === "sociedade");
  const entidades = emOrdemAlfabetica(
    grupos.flatMap((g) => g.entidades.map((e): { e: EntidadeNoMunicipio; lente: LenteEntidade } => ({ e, lente: g.lente }))),
    (x) => x.e.nome,
  );
  const linhas: LinhaTabela[] = entidades.map(({ e, lente }) => ({
    chave: e.cnpj,
    valores: valoresDaEntidade({
      cnpj: e.cnpj,
      nome: e.nome,
      especie: ROTULO_ESPECIE[e.especie],
      instrumentos: e.instrumentos,
      emExecucao: e.emExecucao,
      valor: e.valor,
      ultimoAno: e.ultimoAno,
      grupo: ROTULO_LENTE[lente],
    }),
    celulas: {
      entidade: <LinkMapa href={urlEntidade(e.cnpj)}>{e.nome}</LinkMapa>,
      "em-execucao": e.emExecucao ? n(e.emExecucao) : "—",
      valor: moedaCurta(e.valor),
      "mais-recente": e.ultimoAno === null ? "—" : String(e.ultimoAno),
    },
  }));
  return (
    <Secao
      id="mun-quem-recebe"
      titulo="Quem recebe no município"
      nota={
        <>
          Os <Termo slug="proponente">proponentes</Termo> com instrumento e sede em {municipio}, em ordem alfabética, cada um com a sua página: carteira,
          fila e dinheiro. Cada coluna filtra (o grupo inclusive); os números não ordenam a lista, para ela não virar classificação.
        </>
      }
    >
      {linhas.length > 0 && (
        <>
          <TabelaFiltravel
            id={TABELA_QUEM_RECEBE}
            rotulo={`Quem recebe em ${municipio}`}
            colunas={COLUNAS_QUEM_RECEBE}
            linhas={linhas}
            ordemPadrao={{ coluna: "entidade", sentido: "asc" }}
            csv={publico ? undefined : { nome: `quem-recebe-${ibge}` }}
          />
          <ul className="pa-nota">
            {grupos.map((g) => (
              <li key={g.lente}>
                <strong>{ROTULO_LENTE[g.lente]}</strong> ({n(g.entidades.length)} {g.entidades.length === 1 ? "entidade" : "entidades"}):{" "}
                {EXPLICA_LENTE[g.lente]}
              </li>
            ))}
          </ul>
        </>
      )}
      {osc && (
        <details className="mp-ent-grupo" open>
          <summary>
            <strong>{ROTULO_LENTE.sociedade}</strong> ·{" "}
            {temSociedade ? "todas as organizações, com e sem instrumento federal" : "nenhuma com instrumento federal na base"}
          </summary>
          <SociedadeCivil osc={osc} ibge={ibge} municipio={municipio} publico={publico} />
        </details>
      )}
    </Secao>
  );
}
