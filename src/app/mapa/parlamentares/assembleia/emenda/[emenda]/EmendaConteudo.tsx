/**
 * Uma emenda estadual (E2, 16/10/2026): a ficha (objeto, tipo, secretaria, beneficiário), o caminho com a data, o
 * parecer e o responsável de cada passo, o catálogo por classificação e o destino pelo empenho.
 *
 * O responsável de cada passo é nome de servidor (quem enviou, quem deu o parecer): fica, para achar padrão (regra de
 * 29/09/2026), mas só nesta tela de administrador, nunca no modo cliente nem em sala. Os pareceres já vêm com CPF,
 * e-mail e telefone mascarados pelo job.
 *
 * E4 (16/10/2026, oport_43): a estrela segue a emenda, e a rodada semanal avisa quando ela anda no caminho, é empenhada
 * ou paga. Sem saber o que a pessoa segue (`seguindo` nulo), a estrela não aparece, como nas outras páginas.
 */
import {
  COLUNAS_DESTINO_EMENDA,
  TABELA_DESTINO_EMENDA,
  porcento,
  valoresDoDestino,
  vezDaEmenda,
} from "@/lib/oportunidades/assembleia-tela";
import {
  ROTULO_MODALIDADE,
  ROTULO_PASSO,
  URL_ASSEMBLEIA,
  URL_FILA_EPB,
  diasEntre,
  emendasDoRetrato,
  pct,
  urlDeputado,
  type LeituraEmendaEpb,
} from "@/lib/oportunidades/emendas-pb";
import { formatarDataBr, type LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { Tag } from "../../../../../_design/primitivos";
import { LinkMapa } from "../../../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../../../_componentes/TabelaFiltravel";
import { EstrelaSeguir } from "../../../../_componentes/EstrelaSeguir";
import { TabelaRolagem } from "../../../../_componentes/TabelaRolagem";
import { CartaoNumero, CasasParlamentares, dinheiro, n } from "../../../PecasParlamentares";
import { AVISO_ASSEMBLEIA, CarimboEpb, NotaDeMetodoEpb } from "../../PecasAssembleia";

type LeituraOk = Extract<LeituraEmendaEpb, { estado: "ok" }>;

const data = (iso: string | null) => (iso ? formatarDataBr(iso) : "—");

export function EmendaConteudo({
  leitura,
  hoje,
  chave,
  seguindo = null,
}: {
  leitura: LeituraOk;
  hoje: string;
  /** A chave do endereço (`AAAA-NNNN`), a mesma do item seguido. */
  chave: string;
  seguindo?: boolean | null;
}) {
  const { retrato, emenda: codigo, tramites } = leitura;
  const e = emendasDoRetrato(retrato).find((x) => x.emenda === codigo);
  const ficha = retrato.fichas.find((f) => f.emenda === codigo);
  const catalogo = retrato.catalogo.filter((c) => c.emenda === codigo).sort((a, b) => a.seq - b.seq);
  const destinos = retrato.destinos.filter((d) => d.emenda === codigo);
  const pf = retrato.pf.find((p) => p.emenda === codigo);
  if (!e) return null;
  const dias = e.temFicha && e.passo !== "paga" ? diasEntre(e.passoEm, hoje) : null;
  const vez = vezDaEmenda(e);

  return (
    <div className="pa-pagina mp-radar mp-parl">
      <CasasParlamentares atual="assembleia" />
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Assembleia (PB) · emenda impositiva</p>
        <h1 className="pa-titulo">Emenda {codigo}</h1>
        <p className="pa-sub mp-parl-chips">
          {e.pessoa ? (
            <span>
              Deputado: <LinkMapa href={urlDeputado(e.pessoa)}>{e.pessoa}</LinkMapa>
            </span>
          ) : (
            <span>Deputado não ligado à tabela curada</span>
          )}
          {e.tipo && <span>{e.tipo}</span>}
          {e.noCatalogo && <span>{ROTULO_MODALIDADE[e.modalidade]}</span>}
          {e.secretaria && <span>{e.secretaria}</span>}
        </p>
        {e.objeto && (
          <p>
            <strong>Objeto:</strong> {e.objeto}
            {ficha?.retificacao_objeto && ficha.objeto && ficha.objeto !== ficha.retificacao_objeto && (
              <span className="mp-tabela-secundario">Objeto antes da retificação: {ficha.objeto}</span>
            )}
          </p>
        )}
        {e.beneficiario && (
          <p>
            <strong>Beneficiário final:</strong> {e.beneficiario}
          </p>
        )}
        {e.beneficiarioRetido && (
          <p className="pa-nota">
            O beneficiário final desta ficha é texto livre que pode ser nome de pessoa: não é guardado nem mostrado.
          </p>
        )}
        {e.autoriaDivergente && (
          <p>
            <Tag>autoria divergente</Tag> O catálogo publica <strong>{e.autorCatalogo ?? "—"}</strong> e a ficha publica{" "}
            <strong>{e.deputadoFicha ?? "—"}</strong>, que a tabela curada liga a pessoas diferentes. Ponto para olhar.
          </p>
        )}
        <p className="mp-fiscal-aviso">{AVISO_ASSEMBLEIA}</p>
        <CarimboEpb execucao={retrato.execucao} />
        <p className="pa-linha mp-nao-imprimir">
          {seguindo !== null && <EstrelaSeguir tipo="emenda_estadual" chave={chave} nome={`a emenda estadual ${codigo}`} seguindo={seguindo} />}
          {e.pessoa && (
            <LinkMapa href={urlDeputado(e.pessoa)} className="pa-btn pa-btn-pequeno">
              Ver a ficha do deputado
            </LinkMapa>
          )}
          <LinkMapa href={URL_FILA_EPB} className="pa-btn pa-btn-pequeno">
            Ver a fila do caminho
          </LinkMapa>
          <LinkMapa href={URL_ASSEMBLEIA} className="pa-btn pa-btn-pequeno">
            Ver a lista dos deputados
          </LinkMapa>
        </p>
      </div>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <CartaoNumero titulo="Valor" numero={dinheiro(e.valor)} nota={e.temFicha ? "o da ficha da emenda" : "o do catálogo (sem ficha)"} />
        <CartaoNumero titulo="Empenhado" numero={dinheiro(e.empenhado)} nota="no catálogo" />
        <CartaoNumero titulo="Pago" numero={dinheiro(e.pago)} nota={`${porcento(pct(e.pago, e.valor))} do valor`} />
        <CartaoNumero
          titulo="Onde está"
          numero={e.temFicha ? ROTULO_PASSO[e.passo] : "Sem ficha"}
          nota={
            e.passo === "paga"
              ? "paga por inteiro"
              : [e.passoEm ? `desde ${data(e.passoEm)}` : null, dias !== null ? `há ${n(dias)} dias` : null, vez ? `vez de ${vez}` : null]
                  .filter(Boolean)
                  .join(" · ") || "sem data no caminho"
          }
        />
      </div>

      <section aria-labelledby="alpb-emd-caminho" className="mp-radar-secao">
        <h2 id="alpb-emd-caminho" className="mp-radar-h2">
          O caminho
        </h2>
        <p className="pa-nota">
          Os passos com data na ficha da emenda, com o responsável (servidor que enviou ou deu o parecer) e o texto do parecer, como a API
          publica (CPF, e-mail e telefone mascarados).
          {e.foraDeOrdem && " As datas desta ficha estão fora de ordem em algum passo: marca de qualidade do dado, não erro da emenda."}
          {e.devolvida && " Um dos pareceres fala em devolver a emenda."}
        </p>
        {tramites.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">{e.temFicha ? "A ficha não tem passo com data." : "A emenda não tem ficha na API."}</p>
        ) : (
          <TabelaRolagem rotulo="O caminho da emenda">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Passo</th>
                  <th scope="col">Data</th>
                  <th scope="col">Responsável</th>
                  <th scope="col">Parecer</th>
                </tr>
              </thead>
              <tbody>
                {tramites.map((t) => (
                  <tr key={t.ordem}>
                    <th scope="row" className="mp-th-celula">
                      {ROTULO_PASSO[t.passo]}
                    </th>
                    <td>{data(t.data)}</td>
                    <td>{t.responsavel ?? "—"}</td>
                    <td>{t.texto ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        )}
      </section>

      <section aria-labelledby="alpb-emd-catalogo" className="mp-radar-secao">
        <h2 id="alpb-emd-catalogo" className="mp-radar-h2">
          O catálogo (execução orçamentária)
        </h2>
        {catalogo.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">A emenda não está no catálogo da API (só na ficha).</p>
        ) : (
          <TabelaRolagem rotulo="O catálogo da emenda, por classificação">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Classificação</th>
                  <th scope="col">Órgão e unidade</th>
                  <th scope="col">Programa e ação</th>
                  <th scope="col">Natureza e fonte</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Empenhado</th>
                  <th scope="col">Liquidado</th>
                  <th scope="col">Pago</th>
                </tr>
              </thead>
              <tbody>
                {catalogo.map((c) => (
                  <tr key={c.seq}>
                    <th scope="row" className="mp-th-celula">
                      {c.seq}
                      <span className="mp-tabela-secundario">{c.modalidade ?? "—"}</span>
                    </th>
                    <td>
                      {c.orgao ?? "—"}
                      {c.unidade && <span className="mp-tabela-secundario">{c.unidade}</span>}
                    </td>
                    <td>
                      {c.programa ?? "—"}
                      {c.acao && <span className="mp-tabela-secundario">{c.acao}</span>}
                    </td>
                    <td>
                      {c.natureza ?? c.elemento ?? "—"}
                      {c.fonte_recurso && <span className="mp-tabela-secundario">{c.fonte_recurso}</span>}
                    </td>
                    <td className="mp-rel-num">{dinheiro(c.valor_emenda)}</td>
                    <td className="mp-rel-num">{dinheiro(c.empenhado)}</td>
                    <td className="mp-rel-num">{dinheiro(c.liquidado)}</td>
                    <td className="mp-rel-num">{dinheiro(c.pago)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        )}
      </section>

      <section aria-labelledby="alpb-emd-destino" className="mp-radar-secao">
        <h2 id="alpb-emd-destino" className="mp-radar-h2">
          O destino (empenho)
        </h2>
        <p className="pa-nota">
          Os credores pessoa jurídica das notas de empenho com esta emenda. O empenhado é o valor atualizado da nota. {ROTULO_MODALIDADE[e.modalidade]}
          {e.modalidade === "direta"
            ? ": o credor é fornecedor do Estado, e o município dele não é destino da emenda."
            : e.modalidade === "entidades"
              ? ": o município é a sede da entidade."
              : e.modalidade === "municipios"
                ? ": o município do credor é o atendido."
                : "."}
          {pf && ` Pessoa física, só somada: ${dinheiro(pf.empenhado)} empenhados e ${dinheiro(pf.pago)} pagos, em ${n(pf.notas)} notas.`}
        </p>
        {destinos.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhum empenho a pessoa jurídica com esta emenda.</p>
        ) : (
          <TabelaFiltravel
            id={TABELA_DESTINO_EMENDA}
            rotulo="Credores do empenho da emenda"
            colunas={COLUNAS_DESTINO_EMENDA}
            linhas={destinos.map(
              (d, i): LinhaTabela => ({
                chave: `${d.credor_cnpj}-${d.ibge ?? ""}-${i}`,
                valores: valoresDoDestino(d),
                celulas: {
                  credor: d.credor_nome ?? d.credor_cnpj,
                  municipio: d.ibge ? <LinkMapa href={`/mapa/municipio/${d.ibge}`}>{d.municipio ?? d.ibge}</LinkMapa> : (d.municipio ?? "—"),
                  orgao: d.orgao ?? "—",
                  empenhado: dinheiro(d.empenhado),
                  liquidado: dinheiro(d.liquidado),
                  pago: dinheiro(d.pago),
                  notas: n(d.notas),
                  primeira: data(d.primeira),
                  ultima: data(d.ultima),
                },
              }),
            )}
            descricaoOrdemPadrao="por credor"
            csv={{ nome: `assembleia-emenda-${codigo.replace("/", "-")}-destino` }}
          />
        )}
      </section>

      <NotaDeMetodoEpb id="alpb-emd-como-ler" />
    </div>
  );
}
