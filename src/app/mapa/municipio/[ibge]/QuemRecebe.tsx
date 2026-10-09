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
 */
import Link from "next/link";
import { ROTULO_AREA, rotuloArea, rotuloNatureza, versaoLegivel, type FonteOsc, type ResumoOscMunicipio } from "@/lib/oportunidades/osc";
import { EXPLICA_LENTE, ROTULO_ESPECIE, ROTULO_LENTE, urlEntidade, type EntidadeNoMunicipio, type LenteEntidade } from "@/lib/oportunidades/pagina-entidade";
import { MARCA_PEDE_CADASTRO, linkNoPublico } from "@/lib/oportunidades/publico";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { Carregando } from "../../_componentes/Carregando";
import { Termo } from "../../_componentes/Termo";
import { Secao } from "./relatorio/RelatorioConteudo";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";

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
  return (
    <Secao
      id="mun-quem-recebe"
      titulo="Quem recebe no município"
      nota={
        <>
          Os <Termo slug="proponente">proponentes</Termo> com instrumento e sede em {municipio}, cada um com a sua página: carteira, fila e dinheiro.
        </>
      }
    >
      {grupos.map((g) => (
        <details key={g.lente} className="mp-ent-grupo" open>
          <summary>
            <strong>{ROTULO_LENTE[g.lente]}</strong> · {n(g.entidades.length)} {g.entidades.length === 1 ? "entidade" : "entidades"}
          </summary>
          <p className="pa-nota">{EXPLICA_LENTE[g.lente]}</p>
          <TabelaRolagem rotulo={`${ROTULO_LENTE[g.lente]} · ${n(g.entidades.length)} ${g.entidades.length === 1 ? "entidade" : "entidades"}`}>
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Entidade</th>
                  <th scope="col">Espécie</th>
                  <th scope="col">Instrumentos</th>
                  <th scope="col">Em execução</th>
                  <th scope="col">Valor global</th>
                  <th scope="col">Mais recente</th>
                </tr>
              </thead>
              <tbody>
                {g.entidades.map((e) => (
                  <tr key={e.cnpj}>
                    <td>
                      <Link href={urlEntidade(e.cnpj)} prefetch={false}>
                        {e.nome}
                        <Carregando />
                      </Link>
                    </td>
                    <td>{ROTULO_ESPECIE[e.especie]}</td>
                    <td className="mp-rel-num">{n(e.instrumentos)}</td>
                    <td className="mp-rel-num">{e.emExecucao ? n(e.emExecucao) : "—"}</td>
                    <td className="mp-rel-num">{moedaCurta(e.valor)}</td>
                    <td>{e.ultimoAno ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
          {g.lente === "sociedade" && osc && <SociedadeCivil osc={osc} ibge={ibge} municipio={municipio} publico={publico} />}
        </details>
      ))}
      {!temSociedade && osc && (
        <details className="mp-ent-grupo" open>
          <summary>
            <strong>{ROTULO_LENTE.sociedade}</strong> · nenhuma com instrumento federal na base
          </summary>
          <SociedadeCivil osc={osc} ibge={ibge} municipio={municipio} publico={publico} />
        </details>
      )}
    </Secao>
  );
}
