/**
 * A exibição do radar. Recebe os dados já lidos e só desenha — é o que permite
 * conferir a tela com dados reais sem o portão de administrador e sem Supabase.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { formatarPublicacao } from "@/lib/oportunidades/central";
import { UFS } from "@/lib/oportunidades/organizacao";
import { urlBusca, urlProposta, type ParametrosBusca } from "@/lib/oportunidades/busca";
import { urlFicha } from "@/lib/oportunidades/painel";
import {
  CATEGORIAS,
  DESCRICAO_CATEGORIA,
  JANELAS,
  ROTULO_CANAL_RADAR,
  ROTULO_CATEGORIA,
  ROTULO_JANELA,
  janela24hTocaFimDeSemana,
  moedaCurta,
  ordemDaTabela,
  ordenar,
  proximaOrdem,
  rotuloTipo,
  urlRadar,
  variacao,
  type ParametrosRadar,
} from "@/lib/oportunidades/radar";
import type { LeituraRadar, LinhaRecorte } from "@/lib/oportunidades/radar.server";

type LeituraOk = Extract<LeituraRadar, { estado: "ok" }>;

const BUSCA_VAZIA: ParametrosBusca = { aba: "instrumentos", q: "", uf: null, municipio: null, tema: null, grupo: null, pagina: 1 };

/** O programa na busca: as propostas que o citam, na mesma UF do recorte. */
const urlPorPrograma = (programa: string, uf: string | null) => urlBusca(BUSCA_VAZIA, { aba: "propostas", q: programa, uf });

/** Cabeçalho que ordena: link GET, sem JavaScript, com a ordem na URL para poder ser compartilhada. */
function Ordenavel({
  p,
  tabela,
  coluna,
  children,
  num = false,
  texto = false,
}: {
  p: ParametrosRadar;
  tabela: string;
  coluna: string;
  children: ReactNode;
  num?: boolean;
  texto?: boolean;
}) {
  const atual = ordemDaTabela(p, tabela);
  const ativa = atual.coluna === coluna;
  return (
    <th
      scope="col"
      className={num ? "mp-num" : undefined}
      aria-sort={ativa ? (atual.sentido === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link href={urlRadar(p, { ordem: proximaOrdem(atual, tabela, coluna, texto) })} className="mp-ordenar">
        {children}
        <span aria-hidden="true" className={`mp-ordenar-seta${ativa ? " mp-ordenar-ativa" : ""}`}>
          {ativa ? (atual.sentido === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </th>
  );
}

export function RadarConteudo({ p, leitura }: { p: ParametrosRadar; leitura: LeituraOk }) {
  const { execucao, placar } = leitura;
  const fimDeSemana = janela24hTocaFimDeSemana(execucao.dado_ate);
  const onde = p.uf ?? "Brasil";

  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Radar da PONTE · uso interno</p>
        <h1 className="pa-titulo">Propostas no Transferegov · {onde}</h1>
        <p className="pa-sub">
          Dado até <strong>{formatarPublicacao(execucao.dado_ate)}</strong>. O Transferegov publica os arquivos uma
          vez por dia: as janelas contam até o último registro, e não até agora.
        </p>
      </div>

      <Filtros p={p} />

      {/* ------------------------------------------------------------ placar */}
      <section aria-labelledby="radar-placar" className="mp-radar-secao">
        <h2 id="radar-placar" className="mp-radar-h2">
          Placar · {onde}
        </h2>
        {fimDeSemana && (
          <p className="pa-nota">
            A janela de 24 horas inclui sábado ou domingo, quando quase ninguém envia proposta. Compare com cuidado.
          </p>
        )}
        <div className="pa-grade pa-grade-3">
          {CATEGORIAS.map((c) => (
            <article key={c} className="pa-cartao mp-radar-placar">
              <h3 className="mp-radar-h3">{ROTULO_CATEGORIA[c]}</h3>
              <p className="pa-mono">{DESCRICAO_CATEGORIA[c]}</p>
              <dl className="mp-radar-janelas">
                {JANELAS.map((d) => {
                  const linha = placar.find((x) => x.categoria === c && x.dias === d);
                  const v = variacao(linha?.atual ?? 0, linha?.anterior ?? 0);
                  return (
                    <div key={d} className="mp-radar-janela">
                      <dt className="pa-mono">{ROTULO_JANELA[d]}</dt>
                      <dd>
                        <span className="pa-numero">{linha?.atual ?? 0}</span>
                        <span className={`mp-radar-variacao mp-radar-${v.sentido}`}>{v.texto}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ recortes */}
      <section aria-labelledby="radar-recortes" className="mp-radar-secao">
        <h2 id="radar-recortes" className="mp-radar-h2">
          {ROTULO_CATEGORIA[p.categoria]} em {ROTULO_JANELA[p.dias]} · por canal, tipo e programa
        </h2>
        <p className="pa-nota">
          Valor é o repasse pedido, somado uma vez por proposta. A comparação é com os {ROTULO_JANELA[p.dias]} anteriores.
        </p>
        <TabelaRecorte
          p={p}
          tabela="canal"
          titulo="Por canal"
          linhas={leitura.porCanal}
          rotulo={(l) => ROTULO_CANAL_RADAR[l.chave ?? ""] ?? l.chave ?? "—"}
          nota="Emenda vem da tabela de emendas. Voluntária e beneficiário específico são inferidos pela janela do programa aberta no primeiro envio."
          mostrarInferidos
        />
        <TabelaRecorte p={p} tabela="tipo" titulo="Por tipo de proponente" linhas={leitura.porTipo} rotulo={(l) => rotuloTipo(l.chave ?? "")} />
        <TabelaRecorte
          p={p}
          tabela="programa"
          titulo="Por programa"
          linhas={leitura.porPrograma}
          rotulo={(l) => l.rotulo ?? l.chave ?? "—"}
          link={(l) => (l.rotulo ? urlPorPrograma(l.rotulo, p.uf) : null)}
          nota="Os 25 com mais propostas no período. O nome do programa abre a busca de propostas."
        />
      </section>

      {/* ------------------------------------------------------------ disputa */}
      <section aria-labelledby="radar-disputa" className="mp-radar-secao">
        <h2 id="radar-disputa" className="mp-radar-h2">
          Disputa por programa aberto · {onde}
        </h2>
        <p className="pa-nota">
          Janelas abertas em {execucao.referencia.split("-").reverse().join("/")}, com as propostas novas do mesmo canal
          {p.uf ? ` e da ${p.uf}` : ""} desde a abertura.{p.uf ? "" : " No Brasil, somadas entre as UFs."}
        </p>
        {leitura.disputa.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhuma janela aberta neste recorte.</p>
        ) : (
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <Ordenavel p={p} tabela="disputa" coluna="programa" texto>Programa</Ordenavel>
                  <Ordenavel p={p} tabela="disputa" coluna="canal" texto>Canal</Ordenavel>
                  <Ordenavel p={p} tabela="disputa" coluna="desde_abertura" num>Propostas desde a abertura</Ordenavel>
                  <Ordenavel p={p} tabela="disputa" coluna="trinta_dias" num>Últimos 30 dias</Ordenavel>
                  <Ordenavel p={p} tabela="disputa" coluna="valor" num>Valor pedido</Ordenavel>
                  <Ordenavel p={p} tabela="disputa" coluna="faltam" num>Faltam</Ordenavel>
                  {!p.uf && <Ordenavel p={p} tabela="disputa" coluna="ufs" num>UFs</Ordenavel>}
                </tr>
              </thead>
              <tbody>
                {ordenar(leitura.disputa, CHAVES_DISPUTA[ordemDaTabela(p, "disputa").coluna] ?? CHAVES_DISPUTA.desde_abertura, ordemDaTabela(p, "disputa").sentido).map((d) => (
                  <tr key={`${d.cod_programa}-${d.canal}`}>
                    <th scope="row">
                      <Link href={urlPorPrograma(d.programa, p.uf)} className="mp-tabela-principal">
                        {d.programa}
                      </Link>
                      <span className="mp-tabela-secundario">{d.orgao}</span>
                    </th>
                    <td>{ROTULO_CANAL_RADAR[d.canal] ?? d.canal}</td>
                    <td className="mp-num">{d.novas_desde_abertura}</td>
                    <td className="mp-num">{d.novas_30d}</td>
                    <td className="mp-num">{moedaCurta(d.valor_pedido)}</td>
                    <td className="mp-num">{d.dias_restantes === null ? "—" : `${d.dias_restantes} d`}</td>
                    {!p.uf && <td className="mp-num">{d.ufs}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ quem enviou na PB */}
      <section aria-labelledby="radar-pb" className="mp-radar-secao">
        <h2 id="radar-pb" className="mp-radar-h2">
          Quem movimentou proposta na Paraíba · {ROTULO_JANELA[p.dias]}
        </h2>
        {leitura.enviaramPB.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhuma proposta da Paraíba no período.</p>
        ) : (
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <Ordenavel p={p} tabela="pb" coluna="quando">Quando</Ordenavel>
                  <Ordenavel p={p} tabela="pb" coluna="proponente" texto>Proponente</Ordenavel>
                  <Ordenavel p={p} tabela="pb" coluna="categoria" texto>O quê</Ordenavel>
                  <Ordenavel p={p} tabela="pb" coluna="programa" texto>Programa</Ordenavel>
                  <Ordenavel p={p} tabela="pb" coluna="canal" texto>Canal</Ordenavel>
                  <Ordenavel p={p} tabela="pb" coluna="valor" num>Repasse</Ordenavel>
                </tr>
              </thead>
              <tbody>
                {ordenar(leitura.enviaramPB, CHAVES_PB[ordemDaTabela(p, "pb").coluna] ?? CHAVES_PB.quando, ordemDaTabela(p, "pb").sentido).map((e, i) => (
                  <tr key={`${e.ocorrido_em}-${e.id_proposta ?? i}`}>
                    <td className="mp-nowrap">{formatarPublicacao(e.ocorrido_em)}</td>
                    <th scope="row">
                      <span className="mp-tabela-principal">{e.proponente ?? "—"}</span>
                      <span className="mp-tabela-secundario">
                        {e.cod_ibge ? <Link href={urlFicha({ ibge: e.cod_ibge })}>{e.municipio}</Link> : e.municipio} ·{" "}
                        {rotuloTipo(e.tipo_agente ?? "")}
                      </span>
                    </th>
                    <td>
                      {e.id_proposta ? (
                        <Link href={urlProposta(e.id_proposta)}>{ROTULO_CATEGORIA[e.categoria]}</Link>
                      ) : (
                        ROTULO_CATEGORIA[e.categoria]
                      )}
                    </td>
                    <td>{e.programa ? <Link href={urlPorPrograma(e.programa, "PB")}>{e.programa}</Link> : "—"}</td>
                    <td>{ROTULO_CANAL_RADAR[e.canal ?? ""] ?? "—"}</td>
                    <td className="mp-num">{moedaCurta(e.valor_repasse)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ municípios parados */}
      <MunicipiosParados p={p} leitura={leitura} />
    </div>
  );
}

// ============================================================================

function Filtros({ p }: { p: ParametrosRadar }) {
  return (
    <div className="mp-filtros mp-radar-filtros">
      {/* GET puro: funciona sem JavaScript e deixa a URL pronta para compartilhar. */}
      <form method="get" action="/mapa/radar" className="pa-linha mp-radar-uf">
        <label htmlFor="radar-uf" className="pa-campo-rotulo">
          Onde
        </label>
        <select id="radar-uf" name="uf" defaultValue={p.uf ?? ""} className="pa-select">
          <option value="">Brasil</option>
          {UFS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        {p.dias !== 30 && <input type="hidden" name="dias" value={p.dias} />}
        {p.categoria !== "nova" && <input type="hidden" name="categoria" value={p.categoria} />}
        <button type="submit" className="pa-btn pa-btn-pequeno">
          Aplicar
        </button>
      </form>

      <nav aria-label="Janela dos recortes" className="pa-chips">
        {JANELAS.map((d) => (
          <Link
            key={d}
            href={urlRadar(p, { dias: d })}
            className={`pa-chip${p.dias === d ? " pa-ativo" : ""}`}
            aria-current={p.dias === d ? "true" : undefined}
          >
            {ROTULO_JANELA[d]}
          </Link>
        ))}
      </nav>

      <nav aria-label="Categoria dos recortes" className="pa-chips">
        {CATEGORIAS.map((c) => (
          <Link
            key={c}
            href={urlRadar(p, { categoria: c })}
            className={`pa-chip${p.categoria === c ? " pa-ativo" : ""}`}
            aria-current={p.categoria === c ? "true" : undefined}
          >
            {ROTULO_CATEGORIA[c]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function TabelaRecorte({
  p,
  tabela,
  titulo,
  linhas,
  rotulo,
  link,
  nota,
  mostrarInferidos = false,
}: {
  p: ParametrosRadar;
  tabela: string;
  titulo: string;
  linhas: LinhaRecorte[];
  rotulo: (l: LinhaRecorte) => string;
  link?: (l: LinhaRecorte) => string | null;
  nota?: string;
  mostrarInferidos?: boolean;
}) {
  const o = ordemDaTabela(p, tabela);
  const chave = { rotulo: (l: LinhaRecorte) => rotulo(l), atual: (l: LinhaRecorte) => l.atual, anterior: (l: LinhaRecorte) => l.anterior,
    variacao: (l: LinhaRecorte) => l.atual - l.anterior, valor: (l: LinhaRecorte) => l.valor_atual, inferidos: (l: LinhaRecorte) => l.inferidos };
  const ordenadas = ordenar(linhas, chave[o.coluna as keyof typeof chave] ?? chave.atual, o.sentido);
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">{titulo}</h3>
      {nota && <p className="pa-nota">{nota}</p>}
      {linhas.length === 0 ? (
        <p className="pa-cartao pa-cartao-plano">Nada no período.</p>
      ) : (
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <Ordenavel p={p} tabela={tabela} coluna="rotulo" texto>
                  {titulo.replace(/^Por /, "").replace(/^\w/, (x) => x.toUpperCase())}
                </Ordenavel>
                <Ordenavel p={p} tabela={tabela} coluna="atual" num>Propostas</Ordenavel>
                <Ordenavel p={p} tabela={tabela} coluna="anterior" num>Período anterior</Ordenavel>
                <Ordenavel p={p} tabela={tabela} coluna="variacao" num>Variação</Ordenavel>
                <Ordenavel p={p} tabela={tabela} coluna="valor" num>Valor pedido</Ordenavel>
                {mostrarInferidos && <Ordenavel p={p} tabela={tabela} coluna="inferidos" num>Inferidas</Ordenavel>}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((l) => {
                const v = variacao(l.atual, l.anterior);
                const destino = link?.(l) ?? null;
                return (
                  <tr key={l.chave ?? "sem"}>
                    <th scope="row">{destino ? <Link href={destino}>{rotulo(l)}</Link> : rotulo(l)}</th>
                    <td className="mp-num">{l.atual}</td>
                    <td className="mp-num">{l.anterior}</td>
                    <td className={`mp-num mp-radar-${v.sentido}`}>{v.texto}</td>
                    <td className="mp-num">{moedaCurta(l.valor_atual)}</td>
                    {mostrarInferidos && <td className="mp-num">{l.inferidos}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const CHAVES_DISPUTA: Record<string, (d: LeituraOk["disputa"][number]) => string | number | null> = {
  programa: (d) => d.programa,
  canal: (d) => ROTULO_CANAL_RADAR[d.canal] ?? d.canal,
  desde_abertura: (d) => d.novas_desde_abertura,
  trinta_dias: (d) => d.novas_30d,
  valor: (d) => d.valor_pedido,
  faltam: (d) => d.dias_restantes,
  ufs: (d) => d.ufs,
};

const CHAVES_PB: Record<string, (e: LeituraOk["enviaramPB"][number]) => string | number | null> = {
  quando: (e) => e.ocorrido_em,
  proponente: (e) => e.proponente,
  categoria: (e) => ROTULO_CATEGORIA[e.categoria],
  programa: (e) => e.programa,
  canal: (e) => ROTULO_CANAL_RADAR[e.canal ?? ""] ?? null,
  valor: (e) => e.valor_repasse,
};

const CHAVES_PARADOS: Record<string, (m: LeituraOk["municipiosPB"][number]) => string | number | null> = {
  municipio: (m) => m.municipio,
  em_revisao: (m) => m.em_revisao_30d,
  revisadas: (m) => m.revisadas_30d,
  ultimo_envio: (m) => m.ultimo_envio,
};

function MunicipiosParados({ p, leitura }: { p: ParametrosRadar; leitura: LeituraOk }) {
  const janelas = leitura.execucao.contagens.janelas_abertas_municipio_pb ?? 0;
  // "Parado" é sem proposta NOVA em 30 dias. Quem só tem proposta em revisão
  // continua na lista, mas com o número à vista: está trabalhando, só não abriu
  // proposta nova.
  const parados = leitura.municipiosPB.filter((m) => m.novas_30d === 0);
  const ativos = leitura.municipiosPB.length - parados.length;

  return (
    <section aria-labelledby="radar-parados" className="mp-radar-secao">
      <h2 id="radar-parados" className="mp-radar-h2">
        Municípios da Paraíba sem proposta nova em 30 dias
      </h2>
      <p className="pa-sub">
        <strong>{parados.length}</strong> de {leitura.municipiosPB.length} municípios não enviaram proposta nova
        {ativos > 0 && <> ({ativos} enviaram)</>}, com <strong>{janelas}</strong> janelas abertas aceitando município na
        Paraíba. Conta só proposta da própria prefeitura; OSC sediada no município não tira o município da lista.
      </p>
      {parados.length > 0 && (
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <Ordenavel p={p} tabela="parados" coluna="municipio" texto>Município</Ordenavel>
                <Ordenavel p={p} tabela="parados" coluna="em_revisao" num>Em revisão (30 d)</Ordenavel>
                <Ordenavel p={p} tabela="parados" coluna="revisadas" num>Revisadas (30 d)</Ordenavel>
                <Ordenavel p={p} tabela="parados" coluna="ultimo_envio">Último envio novo</Ordenavel>
              </tr>
            </thead>
            <tbody>
              {ordenar(parados, CHAVES_PARADOS[ordemDaTabela(p, "parados").coluna] ?? CHAVES_PARADOS.municipio, ordemDaTabela(p, "parados").sentido).map((m) => (
                <tr key={m.cod_ibge}>
                  <th scope="row">
                    <Link href={urlFicha({ ibge: m.cod_ibge })}>{m.municipio}</Link>
                  </th>
                  <td className="mp-num">{m.em_revisao_30d}</td>
                  <td className="mp-num">{m.revisadas_30d}</td>
                  <td>{m.ultimo_envio ? formatarPublicacao(m.ultimo_envio) : "nenhum envio registrado"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RadarIndisponivel({ estado }: { estado: "nao_ativado" | "sem_execucao" | "erro" }) {
  const texto = {
    nao_ativado: {
      titulo: "O radar ainda não foi ativado no banco",
      corpo: "Falta aplicar a migração oport_7 no Supabase. Até lá não há onde guardar os dados.",
    },
    sem_execucao: {
      titulo: "O radar ainda não rodou",
      corpo:
        "As tabelas existem, mas nenhuma execução foi concluída. O job roda todo dia às 12h45 UTC no monorepo, e pode ser disparado à mão pelo workflow radar-propostas.",
    },
    erro: {
      titulo: "O radar está indisponível agora",
      corpo: "A leitura dos dados falhou. O detalhe está no registro do servidor.",
    },
  }[estado];
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">Radar da PONTE · uso interno</p>
        <h1 className="pa-titulo">{texto.titulo}</h1>
        <p>{texto.corpo}</p>
      </div>
    </div>
  );
}
