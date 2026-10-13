/**
 * A exibição do radar. Recebe os dados já lidos e só desenha — é o que permite
 * conferir a tela com dados reais sem o portão de administrador e sem Supabase.
 *
 * Onda 15, fase 2, lote D (13/10/2026): a regra do titular de filtro e ordem em cada coluna. A disputa, a lista da
 * Paraíba, o "por programa" e os municípios parados viraram `TabelaFiltravel` (colunas e valores em `radar.ts`, com
 * teste), com todas as linhas na página: os limites da leitura subiram (`radar.server.ts`) e o corte dos 25 programas
 * saiu. O `Ordenavel` (link GET por coluna) saiu com o `?ordem=` de antes, que redireciona para a forma nova. "Por canal"
 * e "por tipo de proponente" (até 6 linhas fixas) são resumo: ficam sem filtro e sem ordem, na ordem do banco (mais
 * propostas primeiro). Os chips de janela, categoria, canal e tipo e o "Onde" continuam indo ao banco.
 */
import type { ReactNode } from "react";
import { formatarPublicacao } from "@/lib/oportunidades/central";
import { UFS } from "@/lib/oportunidades/organizacao";
import { urlBusca, urlProposta, type ParametrosBusca } from "@/lib/oportunidades/busca";
import { urlFicha } from "@/lib/oportunidades/painel";
import {
  CANAIS_RADAR,
  CATEGORIAS,
  COLUNAS_ENVIOS_PB,
  COLUNAS_PARADOS,
  COLUNAS_RECORTE_PROGRAMA,
  DESCRICAO_CATEGORIA,
  JANELAS,
  TABELAS_RADAR,
  TIPOS_RADAR,
  ROTULO_CANAL_RADAR,
  ROTULO_CATEGORIA,
  ROTULO_JANELA,
  colunasDisputa,
  janela24hTocaFimDeSemana,
  moedaCurta,
  rotuloTipo,
  urlRadar,
  valoresDaDisputa,
  valoresDoEnvio,
  valoresDoParado,
  valoresDoRecorte,
  variacao,
  type ParametrosRadar,
} from "@/lib/oportunidades/radar";
import type { LeituraRadar, LinhaRecorte } from "@/lib/oportunidades/radar.server";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { Saidas, type Saida } from "../painel/Pecas";
import { LinkMapa } from "../_componentes/LinkMapa";
import { TabelaFiltravel } from "../_componentes/TabelaFiltravel";
import { TabelaRolagem } from "../_componentes/TabelaRolagem";
import { Termo } from "../_componentes/Termo";

type LeituraOk = Extract<LeituraRadar, { estado: "ok" }>;

/**
 * O vazio do radar diz o recorte e dá a saída para ampliá-lo (B14b, 08/10/2026). Antes era "Nenhuma janela aberta
 * neste recorte" ou "Nada no período", sem dizer qual nem como mudar (B12, seção 5). `usa` diz que filtros valem
 * para a tabela: a disputa não olha o período nem o proponente; a lista da Paraíba não olha a UF.
 */
function VazioRadar({
  p,
  oQue,
  usa,
  semSaidas = false,
}: {
  p: ParametrosRadar;
  oQue: string;
  usa: { uf?: boolean; dias?: boolean; tipo?: boolean };
  semSaidas?: boolean;
}) {
  const partes: string[] = [];
  const saidas: Saida[] = [];
  if (usa.uf) {
    partes.push(p.uf ?? "Brasil");
    if (p.uf) saidas.push({ rotulo: "Ver o Brasil inteiro", href: urlRadar(p, { uf: null }) });
  }
  if (usa.dias) {
    partes.push(p.dias === 1 ? "últimas 24 horas" : `últimos ${ROTULO_JANELA[p.dias]}`);
    if (p.dias < 30) saidas.push({ rotulo: "Ver os últimos 30 dias", href: urlRadar(p, { dias: 30 }) });
  }
  if (p.canal) {
    partes.push(`canal ${ROTULO_CANAL_RADAR[p.canal] ?? p.canal}`);
    saidas.push({ rotulo: "Tirar o filtro de canal", href: urlRadar(p, { canal: null }) });
  }
  if (usa.tipo && p.tipo) {
    partes.push(`proponente ${rotuloTipo(p.tipo)}`);
    saidas.push({ rotulo: "Tirar o filtro de proponente", href: urlRadar(p, { tipo: null }) });
  }
  return (
    <p className="pa-cartao pa-cartao-plano">
      {oQue}
      {partes.length > 0 && (
        <>
          {" "}
          neste recorte: <strong>{partes.join(" · ")}</strong>
        </>
      )}
      .{!semSaidas && <Saidas saidas={saidas} />}
    </p>
  );
}

const BUSCA_VAZIA: ParametrosBusca = { aba: "instrumentos", q: "", uf: null, municipio: null, tema: null, grupo: null, pagina: 1 };

/** O programa na busca: as propostas que o citam, na mesma UF do recorte. */
const urlPorPrograma = (programa: string, uf: string | null) => urlBusca(BUSCA_VAZIA, { aba: "propostas", q: programa, uf });

/** O recorte no nome do CSV: "brasil-30d-nova", "pb-7d-revisada". */
const recorteNoNome = (p: ParametrosRadar) => `${(p.uf ?? "brasil").toLowerCase()}-${p.dias}d-${p.categoria.replace("_", "-")}`;

export function RadarConteudo({ p, leitura }: { p: ParametrosRadar; leitura: LeituraOk }) {
  // O `?ordem=` de antes (onda 15) é redirecionado em `page.tsx`, antes da leitura; aqui ele já não chega.
  const { execucao, placar } = leitura;
  const fimDeSemana = janela24hTocaFimDeSemana(execucao.dado_ate);
  const onde = p.uf ?? "Brasil";
  const referencia = execucao.referencia.split("-").reverse().join("/");

  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Radar da PONTE · uso interno</p>
        <h1 className="pa-titulo">Propostas no Transferegov · {onde}</h1>
        <p className="pa-sub">
          Dado até <strong>{formatarPublicacao(execucao.dado_ate)}</strong>. O Transferegov publica os arquivos uma
          vez por dia: as janelas contam até o último registro, e não até agora.
          {(p.canal || p.tipo) && (
            <>
              {" "}
              Filtrado por{p.canal ? <> canal <strong>{ROTULO_CANAL_RADAR[p.canal] ?? p.canal}</strong></> : null}
              {p.canal && p.tipo ? " e" : null}
              {p.tipo ? <> proponente <strong>{rotuloTipo(p.tipo)}</strong></> : null}.
            </>
          )}
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
        <ResumoRecorte
          p={p}
          titulo="Por canal"
          coluna="Canal"
          linhas={leitura.porCanal}
          rotulo={(l) => ROTULO_CANAL_RADAR[l.chave ?? ""] ?? l.chave ?? "—"}
          nota={
            <>
              <Termo slug="emenda-parlamentar">Emenda</Termo> vem da tabela de emendas. Voluntária e beneficiário específico são inferidos
              pela janela do programa aberta no primeiro envio.
            </>
          }
          mostrarInferidos
        />
        {/* B14b: as três tabelas leem o mesmo recorte; vazias juntas, só a primeira repete as saídas. */}
        <ResumoRecorte
          p={p}
          titulo="Por tipo de proponente"
          coluna="Tipo de proponente"
          linhas={leitura.porTipo}
          rotulo={(l) => rotuloTipo(l.chave ?? "")}
          semSaidas={leitura.porCanal.length === 0}
        />
        <RecortePrograma p={p} linhas={leitura.porPrograma} semSaidas={leitura.porCanal.length === 0} />
      </section>

      {/* ------------------------------------------------------------ disputa */}
      <section aria-labelledby="radar-disputa" className="mp-radar-secao">
        <h2 id="radar-disputa" className="mp-radar-h2">
          Disputa por programa aberto · {onde}
        </h2>
        <p className="pa-nota">
          <Termo slug="janela">Janelas abertas</Termo> em {referencia}, com as propostas novas do mesmo canal{p.uf ? ` e da ${p.uf}` : ""} desde a
          abertura.{p.uf ? "" : " No Brasil, somadas entre as UFs."} Todas as janelas abertas, das mais disputadas para as menos; o órgão e as
          datas de abertura e de fechamento também filtram.
        </p>
        {leitura.disputa.length === 0 ? (
          <VazioRadar p={p} oQue={`Nenhuma janela aberta em ${referencia}`} usa={{ uf: true }} />
        ) : (
          <TabelaFiltravel
            id={TABELAS_RADAR.disputa}
            rotulo={`Disputa por programa aberto · ${onde}`}
            colunas={colunasDisputa(!p.uf)}
            linhas={leitura.disputa.map(
              (d): LinhaTabela => ({
                chave: `${d.cod_programa}-${d.canal}`,
                valores: valoresDaDisputa(d),
                celulas: {
                  programa: (
                    <>
                      <LinkMapa href={urlPorPrograma(d.programa, p.uf)} className="mp-tabela-principal">
                        {d.programa}
                      </LinkMapa>
                      <span className="mp-tabela-secundario">{d.orgao}</span>
                    </>
                  ),
                  valor: moedaCurta(d.valor_pedido),
                  faltam: d.dias_restantes === null ? "—" : `${d.dias_restantes} d`,
                },
              }),
            )}
            ordemPadrao={{ coluna: "desde-abertura", sentido: "desc" }}
            csv={{ nome: `radar-disputa-${(p.uf ?? "brasil").toLowerCase()}` }}
          />
        )}
      </section>

      {/* ------------------------------------------------------------ quem enviou na PB */}
      <section aria-labelledby="radar-pb" className="mp-radar-secao">
        <h2 id="radar-pb" className="mp-radar-h2">
          Quem movimentou proposta na Paraíba · {ROTULO_JANELA[p.dias]}
        </h2>
        {leitura.enviaramPB.length === 0 ? (
          <VazioRadar p={p} oQue="Nenhuma proposta da Paraíba movimentada" usa={{ dias: true, tipo: true }} />
        ) : (
          <TabelaFiltravel
            id={TABELAS_RADAR.pb}
            rotulo={`Quem movimentou proposta na Paraíba · ${ROTULO_JANELA[p.dias]}`}
            colunas={COLUNAS_ENVIOS_PB}
            linhas={leitura.enviaramPB.map(
              (e, i): LinhaTabela => ({
                chave: `${i}-${e.ocorrido_em}-${e.id_proposta ?? "sem"}`,
                valores: valoresDoEnvio(e),
                celulas: {
                  proponente: (
                    <>
                      <span className="mp-tabela-principal">{e.proponente ?? "—"}</span>
                      <span className="mp-tabela-secundario">
                        {e.cod_ibge ? <LinkMapa href={urlFicha({ ibge: e.cod_ibge })}>{e.municipio}</LinkMapa> : e.municipio} ·{" "}
                        {rotuloTipo(e.tipo_agente ?? "")}
                      </span>
                    </>
                  ),
                  quando: <span className="mp-nowrap">{formatarPublicacao(e.ocorrido_em)}</span>,
                  categoria: e.id_proposta ? (
                    <LinkMapa href={urlProposta(e.id_proposta)}>{ROTULO_CATEGORIA[e.categoria]}</LinkMapa>
                  ) : (
                    ROTULO_CATEGORIA[e.categoria]
                  ),
                  programa: e.programa ? <LinkMapa href={urlPorPrograma(e.programa, "PB")}>{e.programa}</LinkMapa> : "—",
                  valor: moedaCurta(e.valor_repasse),
                },
              }),
            )}
            ordemPadrao={{ coluna: "quando", sentido: "desc" }}
            csv={{ nome: `radar-pb-${p.dias}d` }}
          />
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
        {/* Trocar a UF não pode apagar os outros filtros (achado da B14b, 08/10/2026): os mesmos de `urlRadar`. */}
        {p.canal && <input type="hidden" name="canal" value={p.canal} />}
        {p.tipo && <input type="hidden" name="tipo" value={p.tipo} />}
        <button type="submit" className="pa-btn pa-btn-pequeno">
          Aplicar o filtro
        </button>
      </form>

      <nav aria-label="Janela dos recortes" className="pa-chips">
        {JANELAS.map((d) => (
          <LinkMapa
            key={d}
            href={urlRadar(p, { dias: d })}
            className={`pa-chip${p.dias === d ? " pa-ativo" : ""}`}
            aria-current={p.dias === d ? "true" : undefined}
          >
            {ROTULO_JANELA[d]}
          </LinkMapa>
        ))}
      </nav>

      <nav aria-label="Categoria dos recortes" className="pa-chips">
        {CATEGORIAS.map((c) => (
          <LinkMapa
            key={c}
            href={urlRadar(p, { categoria: c })}
            className={`pa-chip${p.categoria === c ? " pa-ativo" : ""}`}
            aria-current={p.categoria === c ? "true" : undefined}
          >
            {ROTULO_CATEGORIA[c]}
          </LinkMapa>
        ))}
      </nav>

      {/* Filtro que vai ao banco: vale para o placar, os recortes, a disputa (só canal) e a lista da Paraíba. */}
      <nav aria-label="Canal" className="pa-chips">
        <span className="pa-campo-rotulo mp-radar-filtro-rotulo">Canal</span>
        <LinkMapa href={urlRadar(p, { canal: null })} className={`pa-chip${p.canal === null ? " pa-ativo" : ""}`} aria-current={p.canal === null ? "true" : undefined}>
          Todos
        </LinkMapa>
        {CANAIS_RADAR.map((c) => (
          <LinkMapa key={c} href={urlRadar(p, { canal: c })} className={`pa-chip${p.canal === c ? " pa-ativo" : ""}`} aria-current={p.canal === c ? "true" : undefined}>
            {ROTULO_CANAL_RADAR[c] ?? c}
          </LinkMapa>
        ))}
      </nav>

      <nav aria-label="Tipo de proponente" className="pa-chips">
        <span className="pa-campo-rotulo mp-radar-filtro-rotulo">Proponente</span>
        <LinkMapa href={urlRadar(p, { tipo: null })} className={`pa-chip${p.tipo === null ? " pa-ativo" : ""}`} aria-current={p.tipo === null ? "true" : undefined}>
          Todos
        </LinkMapa>
        {TIPOS_RADAR.map((t) => (
          <LinkMapa key={t} href={urlRadar(p, { tipo: t })} className={`pa-chip${p.tipo === t ? " pa-ativo" : ""}`} aria-current={p.tipo === t ? "true" : undefined}>
            {rotuloTipo(t)}
          </LinkMapa>
        ))}
      </nav>
      <p className="pa-nota">
        Estes filtros mudam o que o radar lê. O “Filtrar e ordenar” de cada tabela filtra por cima do que foi lido e recomeça quando o recorte
        muda.
      </p>
    </div>
  );
}

/**
 * "Por canal" e "por tipo de proponente": resumo de até 6 linhas fixas (a regra do titular deixa resumo sem filtro),
 * na ordem do banco, com mais propostas primeiro. Onda 15, fase 2, lote D (13/10/2026): sem o cabeçalho que ordenava.
 */
function ResumoRecorte({
  p,
  titulo,
  coluna,
  linhas,
  rotulo,
  nota,
  mostrarInferidos = false,
  semSaidas = false,
}: {
  p: ParametrosRadar;
  titulo: string;
  coluna: string;
  linhas: LinhaRecorte[];
  rotulo: (l: LinhaRecorte) => string;
  nota?: ReactNode;
  mostrarInferidos?: boolean;
  /** No vazio, sem os links (a tabela de cima já os deu). */
  semSaidas?: boolean;
}) {
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">{titulo}</h3>
      {nota && <p className="pa-nota">{nota}</p>}
      {linhas.length === 0 ? (
        <VazioRadar
          p={p}
          oQue={`Nenhuma proposta em “${ROTULO_CATEGORIA[p.categoria]}”`}
          usa={{ uf: true, dias: true, tipo: true }}
          semSaidas={semSaidas}
        />
      ) : (
        <TabelaRolagem rotulo={titulo}>
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">{coluna}</th>
                <th scope="col" className="mp-num">
                  Propostas
                </th>
                <th scope="col" className="mp-num">
                  Período anterior
                </th>
                <th scope="col" className="mp-num">
                  Variação
                </th>
                <th scope="col" className="mp-num">
                  Valor pedido
                </th>
                {mostrarInferidos && (
                  <th scope="col" className="mp-num">
                    Inferidas
                  </th>
                )}
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
        </TabelaRolagem>
      )}
    </div>
  );
}

/** "Por programa" (#92): todos os programas do período, com filtro e ordem em cada coluna. */
function RecortePrograma({ p, linhas, semSaidas }: { p: ParametrosRadar; linhas: LinhaRecorte[]; semSaidas: boolean }) {
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">Por programa</h3>
      <p className="pa-nota">
        Todos os programas com proposta no período, dos que têm mais propostas para os que têm menos. O nome do programa abre a busca de
        propostas.
      </p>
      {linhas.length === 0 ? (
        <VazioRadar
          p={p}
          oQue={`Nenhuma proposta em “${ROTULO_CATEGORIA[p.categoria]}”`}
          usa={{ uf: true, dias: true, tipo: true }}
          semSaidas={semSaidas}
        />
      ) : (
        <TabelaFiltravel
          id={TABELAS_RADAR.programa}
          rotulo="Propostas por programa"
          colunas={COLUNAS_RECORTE_PROGRAMA}
          linhas={linhas.map((l): LinhaTabela => {
            const v = variacao(l.atual, l.anterior);
            return {
              chave: l.chave ?? "sem-programa",
              valores: valoresDoRecorte(l),
              celulas: {
                programa: l.rotulo ? <LinkMapa href={urlPorPrograma(l.rotulo, p.uf)}>{l.rotulo}</LinkMapa> : (l.chave ?? "—"),
                variacao: <span className={`mp-radar-${v.sentido}`}>{v.texto}</span>,
                valor: moedaCurta(l.valor_atual),
              },
            };
          })}
          ordemPadrao={{ coluna: "propostas", sentido: "desc" }}
          csv={{ nome: `radar-programas-${recorteNoNome(p)}` }}
        />
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
      {/* B14b (08/10/2026): a tabela vazia sumia sem dizer nada. */}
      {parados.length === 0 && (
        <p className="pa-cartao pa-cartao-plano">
          {leitura.municipiosPB.length > 0
            ? "Todos os municípios da Paraíba enviaram proposta nova nos últimos 30 dias."
            : "A lista dos municípios da Paraíba não veio na última atualização diária do radar."}
        </p>
      )}
      {parados.length > 0 && (
        <TabelaFiltravel
          id={TABELAS_RADAR.parados}
          rotulo="Municípios da Paraíba sem proposta nova em 30 dias"
          colunas={COLUNAS_PARADOS}
          linhas={parados.map(
            (m): LinhaTabela => ({
              chave: m.cod_ibge,
              valores: valoresDoParado(m),
              celulas: {
                municipio: <LinkMapa href={urlFicha({ ibge: m.cod_ibge })}>{m.municipio}</LinkMapa>,
                "ultimo-envio": m.ultimo_envio ? formatarPublicacao(m.ultimo_envio) : "nenhum envio registrado",
              },
            }),
          )}
          ordemPadrao={{ coluna: "municipio", sentido: "asc" }}
          csv={{ nome: "radar-municipios-pb-parados" }}
        />
      )}
    </section>
  );
}

/**
 * Indisponível do radar, só para administrador: pode falar da migração e do workflow. B14b (08/10/2026): como o
 * `DadoIndisponivel` da B12, `endereco` vira "Tentar de novo" quando a leitura falhou.
 */
export function RadarIndisponivel({ estado, endereco }: { estado: "nao_ativado" | "sem_execucao" | "erro"; endereco?: string }) {
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
        <p className="pa-linha">
          {estado === "erro" && endereco && (
            <LinkMapa href={endereco} className="pa-btn pa-btn-pequeno">
              Tentar de novo
            </LinkMapa>
          )}
          <LinkMapa href="/mapa/painel" className="pa-btn pa-btn-pequeno">
            Ir ao painel de execução
          </LinkMapa>
        </p>
      </div>
    </div>
  );
}
