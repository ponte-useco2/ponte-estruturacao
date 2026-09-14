/**
 * A exibição do radar. Recebe os dados já lidos e só desenha — é o que permite
 * conferir a tela com dados reais sem o portão de administrador e sem Supabase.
 */
import Link from "next/link";
import { formatarPublicacao } from "@/lib/oportunidades/central";
import { UFS } from "@/lib/oportunidades/organizacao";
import {
  CATEGORIAS,
  DESCRICAO_CATEGORIA,
  JANELAS,
  ROTULO_CANAL_RADAR,
  ROTULO_CATEGORIA,
  ROTULO_JANELA,
  janela24hTocaFimDeSemana,
  moedaCurta,
  rotuloTipo,
  urlRadar,
  variacao,
  type ParametrosRadar,
} from "@/lib/oportunidades/radar";
import type { LeituraRadar, LinhaRecorte } from "@/lib/oportunidades/radar.server";

type LeituraOk = Extract<LeituraRadar, { estado: "ok" }>;

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
          titulo="Por canal"
          linhas={leitura.porCanal}
          rotulo={(l) => ROTULO_CANAL_RADAR[l.chave ?? ""] ?? l.chave ?? "—"}
          nota="Emenda vem da tabela de emendas. Voluntária e beneficiário específico são inferidos pela janela do programa aberta no primeiro envio."
          mostrarInferidos
        />
        <TabelaRecorte titulo="Por tipo de proponente" linhas={leitura.porTipo} rotulo={(l) => rotuloTipo(l.chave ?? "")} />
        <TabelaRecorte
          titulo="Por programa"
          linhas={leitura.porPrograma}
          rotulo={(l) => l.rotulo ?? l.chave ?? "—"}
          nota="Os 25 com mais propostas no período."
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
                  <th scope="col">Programa</th>
                  <th scope="col">Canal</th>
                  <th scope="col" className="mp-num">Propostas desde a abertura</th>
                  <th scope="col" className="mp-num">Últimos 30 dias</th>
                  <th scope="col" className="mp-num">Valor pedido</th>
                  <th scope="col" className="mp-num">Faltam</th>
                  {!p.uf && <th scope="col" className="mp-num">UFs</th>}
                </tr>
              </thead>
              <tbody>
                {leitura.disputa.map((d) => (
                  <tr key={`${d.cod_programa}-${d.canal}`}>
                    <th scope="row">
                      <span className="mp-tabela-principal">{d.programa}</span>
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
                  <th scope="col">Quando</th>
                  <th scope="col">Proponente</th>
                  <th scope="col">O quê</th>
                  <th scope="col">Programa</th>
                  <th scope="col">Canal</th>
                  <th scope="col" className="mp-num">Repasse</th>
                </tr>
              </thead>
              <tbody>
                {leitura.enviaramPB.map((e, i) => (
                  <tr key={`${e.ocorrido_em}-${i}`}>
                    <td className="mp-nowrap">{formatarPublicacao(e.ocorrido_em)}</td>
                    <th scope="row">
                      <span className="mp-tabela-principal">{e.proponente ?? "—"}</span>
                      <span className="mp-tabela-secundario">
                        {e.municipio} · {rotuloTipo(e.tipo_agente ?? "")}
                      </span>
                    </th>
                    <td>{ROTULO_CATEGORIA[e.categoria]}</td>
                    <td>{e.programa ?? "—"}</td>
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
      <MunicipiosParados leitura={leitura} />
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
  titulo,
  linhas,
  rotulo,
  nota,
  mostrarInferidos = false,
}: {
  titulo: string;
  linhas: LinhaRecorte[];
  rotulo: (l: LinhaRecorte) => string;
  nota?: string;
  mostrarInferidos?: boolean;
}) {
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
                <th scope="col">{titulo.replace(/^Por /, "").replace(/^\w/, (x) => x.toUpperCase())}</th>
                <th scope="col" className="mp-num">Propostas</th>
                <th scope="col" className="mp-num">Período anterior</th>
                <th scope="col" className="mp-num">Variação</th>
                <th scope="col" className="mp-num">Valor pedido</th>
                {mostrarInferidos && <th scope="col" className="mp-num">Inferidas</th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const v = variacao(l.atual, l.anterior);
                return (
                  <tr key={l.chave ?? "sem"}>
                    <th scope="row">{rotulo(l)}</th>
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

function MunicipiosParados({ leitura }: { leitura: LeituraOk }) {
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
                <th scope="col">Município</th>
                <th scope="col" className="mp-num">Em revisão (30 d)</th>
                <th scope="col" className="mp-num">Revisadas (30 d)</th>
                <th scope="col">Último envio novo</th>
              </tr>
            </thead>
            <tbody>
              {parados.map((m) => (
                <tr key={m.cod_ibge}>
                  <th scope="row">{m.municipio}</th>
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
