/**
 * A exibição da busca. Recebe os dados já lidos e só desenha: é o que permite conferir a
 * tela com dados reais sem o portão de login.
 *
 * B12 (onda 2 de UX, 08/10/2026): o grupo "Municípios" no topo quando o termo é nome de município; o rótulo visível
 * diz o que se pode buscar (o placeholder era o único lugar, e sumia ao digitar: A06 da auditoria B1+B2); o vazio diz
 * o que foi procurado e oferece saídas; a estrela das linhas tem texto ("☆ Seguir"), não só o ícone.
 *
 * C2 (onda 4 de UX, 08/10/2026): estas são as listas (abas). A entrada da busca é a unificada (`BuscaUnificada.tsx`),
 * que chega aqui pelo "Ver todos (N)"; o chip "Tudo" volta para ela.
 */
import { urlEntidade } from "@/lib/oportunidades/pagina-entidade";
import { nomeOsc, rotuloArea, rotuloNatureza, situacaoNaReceita, versaoLegivel } from "@/lib/oportunidades/osc";
import type { OscBusca } from "@/lib/oportunidades/osc.server";
import { cnpjLegivel } from "@/lib/oportunidades/fornecedores";
import type { ReactNode } from "react";
import {
  GRUPOS_DESFECHO,
  GRUPOS_SITUACAO,
  LIMITE_POR_PAGINA,
  PAGINA_MAXIMA,
  contagem,
  totalDePaginas,
  urlBusca,
  urlInstrumento,
  ehMunicipioPb,
  saidasIndisponivel,
  urlDoMunicipio,
  urlProposta,
  type InstrumentoBusca,
  type ParametrosBusca,
  type PropostaBusca,
  type SaidaIndisponivel,
} from "@/lib/oportunidades/busca";
import { saidasBuscaVazia, textoBuscaVazia, tituloBuscaVazia, type MunicipioAchado } from "@/lib/oportunidades/busca-municipio";
import { urlDoChip } from "@/lib/oportunidades/busca-unificada";
import type { LeituraBusca } from "@/lib/oportunidades/busca.server";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { UFS } from "@/lib/oportunidades/organizacao";
import { ROTULO_DESFECHO } from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_TEMA, TEMAS_RAIZ } from "@/lib/oportunidades/temas";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { MARCA_PEDE_CADASTRO, linkNoPublico } from "@/lib/oportunidades/publico";
import {
  COLUNAS_ORGANIZACOES,
  OPCOES_CONVENIOS,
  OPCOES_ORGANIZACOES,
  OPCOES_PROPOSTAS,
  TABELA_BUSCA_CONVENIOS,
  TABELA_BUSCA_ORGANIZACOES,
  TABELA_BUSCA_PROPOSTAS,
  colunasDasPropostas,
  colunasDosConvenios,
  rotuloSituacaoOsc,
  urlComTabela,
} from "@/lib/oportunidades/busca-tabelas";
import { ESTADO_VAZIO, filtrosAtivos, type EstadoTabela, type LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { AvisoSeguir, EstrelaSeguir } from "../_componentes/EstrelaSeguir";
import { LinkMapa } from "../_componentes/LinkMapa";
import { TabelaFiltravel } from "../_componentes/TabelaFiltravel";
import "./busca.css";

type LeituraOk = Extract<LeituraBusca, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");
const data = (iso: string | null) => (iso ? formatarData(iso) : "—");

export function BuscaConteudo({
  p,
  leitura,
  seguidas = null,
  estado = ESTADO_VAZIO,
  tetoPaginas = PAGINA_MAXIMA,
}: {
  p: ParametrosBusca;
  leitura: LeituraOk;
  /** Chaves `tipo:chave` seguidas. Null sem a oport_15: as linhas ficam sem estrela. */
  seguidas?: ReadonlySet<string> | null;
  /** O filtro e a ordem da tabela da aba, que a leitura aplicou (F3.5b). */
  estado?: EstadoTabela;
  /** A última página que a pessoa pode abrir (`tetoDePaginas`). */
  tetoPaginas?: number;
}) {
  const grupos = p.aba === "instrumentos" ? GRUPOS_SITUACAO : GRUPOS_DESFECHO;
  // F3.5b: quem não administra percorre até `tetoPaginas` páginas (a porta da raspagem); o total é sempre dito.
  const paginas = Math.min(totalDePaginas(leitura.total), tetoPaginas);
  const cortadas = leitura.total > paginas * LIMITE_POR_PAGINA;
  const comFiltroNaTabela = filtrosAtivos(estado) > 0;
  // A página seguinte e a anterior levam o filtro e a ordem da tabela junto.
  const paginaDa = (pagina: number) => urlComTabela(urlBusca(p, { pagina }), p.aba === "tudo" ? "instrumentos" : p.aba, estado);
  const vazio = leitura.instrumentos.length === 0 && leitura.propostas.length === 0 && leitura.organizacoes.length === 0;
  const org = p.aba === "organizacoes";

  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Busca</p>
        <h1 className="pa-titulo">{org ? "Organizações da sociedade civil" : "Convênios e propostas"}</h1>
        {org ? (
          <p className="pa-sub">
            Pelo nome ou pelo CNPJ, todas as organizações da Paraíba no Mapa das OSC (Ipea
            {leitura.fonteOsc ? `, versão de ${versaoLegivel(leitura.fonteOsc.versao)}` : ""}), com ou sem instrumento federal. As ativas vêm
            primeiro.
          </p>
        ) : (
          <p className="pa-sub">
            Pelo número, pelo nome do programa, pelo objeto, pelo proponente, pelo município ou pelo CNPJ. Dado do Transferegov até{" "}
            <strong>{formatarPublicacao(leitura.execucao.dado_ate)}</strong>. Na Paraíba, todos os convênios desde 2008 e as
            propostas desde 2019; no resto do país, os convênios em execução ou em prestação de contas e as propostas recentes.
          </p>
        )}
      </div>

      <AbasBusca p={p} />

      <form method="get" action="/mapa/busca" className="mp-filtros mp-busca-form" role="search">
        {/* C2: sem `aba` é a unificada; a lista manda a dela sempre, também a dos convênios. */}
        <input type="hidden" name="aba" value={p.aba} />
        {/* O rótulo diz o que se pode buscar e fica à vista: no placeholder (2,66:1), sumia ao digitar (A06). */}
        <div className="mp-busca-termo">
          <label htmlFor="busca-q" className="mp-busca-rotulo">
            {org ? "Nome ou CNPJ da organização" : "Número, programa, objeto, município ou CNPJ"}
          </label>
          <input
            id="busca-q"
            name="q"
            type="search"
            defaultValue={p.q}
            className="pa-input"
            placeholder={org ? "ex.: Laureano" : "ex.: 956541, creche, Sousa"}
            autoComplete="off"
            aria-describedby="busca-q-ajuda"
          />
          <p id="busca-q-ajuda" className="mp-busca-ajuda">
            {org
              ? "Acento e maiúsculas não importam. O CNPJ vale com ou sem pontos."
              : "Uma palavra já basta. Acento e maiúsculas não importam. O CNPJ vale com ou sem pontos. O nome de um município leva também à página dele."}
          </p>
        </div>
        <div className="pa-linha mp-painel-filtros">
          {!org && (
            <Campo id="busca-uf" rotulo="UF">
              <select id="busca-uf" name="uf" defaultValue={p.uf ?? ""} className="pa-select">
                <option value="">Todas</option>
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          {p.uf && leitura.municipios.length > 0 && (
            <Campo id="busca-municipio" rotulo="Município">
              <select id="busca-municipio" name="municipio" defaultValue={p.municipio ?? ""} className="pa-select mp-painel-municipio">
                <option value="">{org ? "Todos da Paraíba" : "Todos da UF"}</option>
                {leitura.municipios.map((m) => (
                  <option key={m.cod_ibge} value={m.cod_ibge}>
                    {m.municipio ?? `IBGE ${m.cod_ibge}`}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          {!org && (
          <Campo id="busca-tema" rotulo="Tema">
            <select id="busca-tema" name="tema" defaultValue={p.tema ?? ""} className="pa-select">
              <option value="">Todos</option>
              {TEMAS_RAIZ.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          )}
          {!org && (
            <Campo id="busca-grupo" rotulo={p.aba === "instrumentos" ? "Situação" : "Desfecho"}>
              <select id="busca-grupo" name="grupo" defaultValue={p.grupo ?? ""} className="pa-select">
                <option value="">Todas</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <button type="submit" className="pa-btn pa-btn-pequeno">
            Buscar
          </button>
        </div>
      </form>

      {leitura.municipiosAchados.length > 0 && (
        <GrupoMunicipios p={p} municipios={leitura.municipiosAchados} mais={leitura.maisMunicipios} />
      )}

      <section aria-labelledby="busca-resultado" className="mp-radar-secao">
        <h2 id="busca-resultado" className="mp-radar-h2" aria-live="polite">
          {leitura.semFiltro
            ? "Digite um termo ou escolha um filtro"
            : vazio
            ? tituloBuscaVazia(p)
            : p.aba === "instrumentos"
              ? contagem(leitura.total, "convênio", "convênios")
              : org
                ? contagem(leitura.total, "organização", "organizações")
                : contagem(leitura.total, "proposta", "propostas")}
        </h2>
        {/* Onda 7, C (09/10/2026; N03 da auditoria R1, WCAG 1.4.1): o link ficava dentro do h2, com a cor e o peso do
            título e sem sublinhado, e entrava na região viva da contagem. Fora do título, é link de parágrafo (A01). */}
        {p.municipio ? (
          <p className="mp-busca-ajuda">
            <LinkMapa href={urlDoMunicipio(p.municipio, "dinheiro")}>
              {ehMunicipioPb(p.municipio) ? "Ver a página do município" : "Ver os investimentos do município"}
            </LinkMapa>
          </p>
        ) : null}
        {leitura.semFiltro ? (
          <p className="pa-cartao pa-cartao-plano">
            A busca procura em toda a base do Mapa: digite um número, uma palavra do programa ou do objeto, o nome do proponente ou o CNPJ, ou
            escolha a UF, o tema ou a situação.
          </p>
        ) : vazio && !comFiltroNaTabela ? (
          <BuscaVazia p={p} temMunicipio={leitura.municipiosAchados.length > 0} />
        ) : (
          <NaBusca>
            {p.aba === "instrumentos" ? (
              <TabelaInstrumentos linhas={leitura.instrumentos} seguidas={seguidas} total={leitura.total} />
            ) : org ? (
              <TabelaOrganizacoes linhas={leitura.organizacoes} total={leitura.total} />
            ) : (
              <TabelaPropostas linhas={leitura.propostas} seguidas={seguidas} total={leitura.total} />
            )}
          </NaBusca>
        )}
        {cortadas && (
          <p className="mp-busca-ajuda">
            A lista mostra até {n(paginas * LIMITE_POR_PAGINA)} dos {n(leitura.total)} resultados. Para chegar aos outros, refine a busca: um termo
            a mais, a UF, o município, o tema ou o filtro de uma coluna.
          </p>
        )}
        {paginas > 1 && (
          <nav aria-label="Páginas" className="pa-linha mp-busca-paginas">
            {p.pagina > 1 && (
              <LinkMapa href={paginaDa(p.pagina - 1)} className="pa-btn pa-btn-pequeno" rel="prev">
                ← Página anterior
              </LinkMapa>
            )}
            <span className="pa-nota">
              Página {n(p.pagina)} de {n(paginas)} · {LIMITE_POR_PAGINA} por página
            </span>
            {p.pagina < paginas && (
              <LinkMapa href={paginaDa(p.pagina + 1)} className="pa-btn pa-btn-pequeno" rel="next">
                Próxima página →
              </LinkMapa>
            )}
          </nav>
        )}
      </section>
      {/* Onda 7, C (09/10/2026; N06 da auditoria R1): o aviso da estrela, com o "Desfazer", fica fora da tabela, como na
          carteira. Dentro da estrela, ele nascia na 1ª célula da linha, que no celular gruda (`position: sticky`) e cria
          um contexto de empilhamento: as células grudadas das linhas de baixo podiam cobri-lo. */}
      {seguidas && <AvisoSeguir />}
    </div>
  );
}

/**
 * O que buscar: a unificada ("Tudo", C2, 08/10/2026) e as três listas. Cada chip leva o termo e a UF; a troca solta o
 * que não vale na outra aba (`urlDoChip`, que da unificada leva a UF do grupo para Convênios e Propostas).
 */
export function AbasBusca({ p }: { p: ParametrosBusca }) {
  return (
    <nav aria-label="O que buscar" className="pa-chips mp-radar-filtros">
      {(
        [
          ["tudo", "Tudo"],
          ["instrumentos", "Convênios"],
          ["propostas", "Propostas"],
          ["organizacoes", "Organizações"],
        ] as const
      ).map(([aba, rotulo]) => (
        <LinkMapa
          key={aba}
          href={urlDoChip(p, aba)}
          className={`pa-chip${p.aba === aba ? " pa-ativo" : ""}`}
          aria-current={p.aba === aba ? "page" : undefined}
        >
          {rotulo}
        </LinkMapa>
      ))}
    </nav>
  );
}

export function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: ReactNode }) {
  return (
    <span className="mp-busca-campo">
      <label htmlFor={id} className="pa-campo-rotulo">
        {rotulo}
      </label>
      {children}
    </span>
  );
}

/**
 * B12: os municípios cujo nome casa com o termo, antes dos resultados. Na PB, a página em abas; fora dela, os
 * investimentos. O segundo link filtra a própria busca pelo município, sem o termo (que já é o nome dele).
 */
function GrupoMunicipios({ p, municipios, mais }: { p: ParametrosBusca; municipios: MunicipioAchado[]; mais: boolean }) {
  const lista = p.aba === "instrumentos" ? "os convênios" : p.aba === "propostas" ? "as propostas" : "as organizações";
  return (
    <section aria-labelledby="busca-municipios" className="pa-cartao mp-busca-municipios">
      <h2 id="busca-municipios" className="mp-radar-h2">
        Municípios
      </h2>
      <ul>
        {municipios.map((m) => (
          <li key={m.ibge}>
            <LinkMapa href={m.href} className="mp-busca-municipio-nome">
              {m.nome}
            </LinkMapa>
            <span className="mp-busca-municipio-uf">
              {m.uf} · {ehMunicipioPb(m.ibge) ? "página do município" : "investimentos federais"}
            </span>
            <span className="mp-busca-municipio-filtro">
              ou só{" "}
              <LinkMapa href={urlBusca(p, { q: "", uf: m.uf, municipio: m.ibge })}>
                {lista} de {m.nome}
              </LinkMapa>
            </span>
          </li>
        ))}
      </ul>
      {mais && <p className="mp-busca-ajuda">Há outros com esse nome ou começo: escreva o nome inteiro ou escolha a UF.</p>}
    </section>
  );
}

/** B12: o vazio diz o que foi procurado (no título) e o que tentar, do mais perto ao mais longe. */
function BuscaVazia({ p, temMunicipio }: { p: ParametrosBusca; temMunicipio: boolean }) {
  return (
    <div className="pa-cartao pa-cartao-plano mp-busca-vazio">
      <p>{textoBuscaVazia(p)} O que tentar:</p>
      <ul>
        {saidasBuscaVazia(p, temMunicipio).map((s) => (
          <li key={s.texto}>
            {s.href ? <LinkMapa href={s.href}>{s.texto}</LinkMapa> : s.texto}
            {s.nota ? ` ${s.nota}` : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Temas({ temas }: { temas: string[] }) {
  const conhecidos = temas.filter((t) => ROTULO_TEMA[t]);
  if (!conhecidos.length) return null;
  return <span className="mp-tabela-secundario">{conhecidos.map((t) => ROTULO_TEMA[t]).join(" · ")}</span>;
}

/**
 * O número com o link da página, na primeira coluna (o cabeçalho da linha). Onda 7, C (09/10/2026; N23 da auditoria
 * R1): o cabeçalho de linha é só o número; a estrela vem na coluna logo depois dele (B8: a estrela longe do nome do item
 * foi confundida com a do vizinho), e o proponente tem coluna própria.
 */
function Numero({ href, numero }: { href: string; numero: string }) {
  return (
    <LinkMapa href={href} className="mp-tabela-principal">
      nº {numero}
    </LinkMapa>
  );
}

/** O proponente com link para a entidade quando há CNPJ, e o município. */
function Proponente({ cnpj, proponente, municipio, uf }: { cnpj?: string | null; proponente?: string | null; municipio?: string | null; uf?: string | null }) {
  return (
    <div className="mp-busca-proponente">
      <span className="mp-tabela-principal">{cnpj ? <LinkMapa href={urlEntidade(cnpj)}>{proponente ?? "—"}</LinkMapa> : (proponente ?? "—")}</span>
      <span className="mp-tabela-secundario">
        {municipio ?? "—"}/{uf ?? "—"}
      </span>
    </div>
  );
}

function ProgramaEObjeto({ programa, objeto, temas }: { programa: string | null; objeto: string | null; temas: string[] }) {
  return (
    <div className="mp-busca-programa">
      <span className="mp-tabela-principal">{programa ?? "—"}</span>
      {objeto && <span className="mp-tabela-secundario">{objeto}</span>}
      <Temas temas={temas} />
    </div>
  );
}

/** A tabela dentro do bloco que dá as larguras da busca (`mp-busca-tabela`, em `mapa.css`). */
function NaBusca({ children }: { children: ReactNode }) {
  return <div className="mp-busca-tabela">{children}</div>;
}

/**
 * F3.5b (28/10/2026): as três listas são `TabelaFiltravel` no modo servidor. A página lê o estado da tabela do
 * endereço e o manda ao banco; mudar o filtro ou a ordem solta a página (o filtro novo começa na primeira). Sem CSV: a
 * busca é a porta da raspagem.
 */
const MODO = (total: number, opcoes: Record<string, { valor: string; linhas: number | null }[]>) => ({ total, opcoes, soltar: ["pagina"] });

function TabelaInstrumentos({ linhas, seguidas, total }: { linhas: InstrumentoBusca[]; seguidas: ReadonlySet<string> | null; total: number }) {
  return (
    <TabelaFiltravel
      id={TABELA_BUSCA_CONVENIOS}
      rotulo="Convênios encontrados"
      colunas={colunasDosConvenios(seguidas !== null)}
      linhas={linhas.map(
        (l): LinhaTabela => ({
          chave: l.nr_convenio,
          valores: {
            numero: l.nr_convenio,
            seguir: null,
            proponente: l.proponente,
            programa: l.programa,
            situacao: l.situacao,
            repasse: l.vl_repasse,
            municipio: l.municipio,
            objeto: l.objeto,
            orgao: l.orgao_sup,
            assinatura: l.dt_assinatura,
            desembolsado: l.vl_desembolsado,
          },
          celulas: {
            numero: <Numero href={urlInstrumento(l.nr_convenio)} numero={l.nr_convenio} />,
            // Com texto ("☆ Seguir"), não a compacta: o que a ★ faz não pode depender do title, que o toque não mostra (B12).
            seguir: seguidas && (
              <span className="mp-busca-seguir">
                <EstrelaSeguir
                  tipo="instrumento"
                  chave={l.nr_convenio}
                  nome={`o convênio nº ${l.nr_convenio}`}
                  seguindo={seguidas.has(chaveSeguida("instrumento", l.nr_convenio))}
                />
              </span>
            ),
            proponente: <Proponente cnpj={l.cnpj} proponente={l.proponente} municipio={l.municipio} uf={l.uf} />,
            programa: <ProgramaEObjeto programa={l.programa} objeto={l.objeto} temas={l.temas} />,
            situacao: (
              <div className="mp-busca-situacao">
                {l.situacao ?? "—"}
                <span className="mp-tabela-secundario">assinado em {data(l.dt_assinatura)}</span>
              </div>
            ),
            repasse: (
              <>
                {moedaCurta(l.vl_repasse)}
                <span className="mp-tabela-secundario">
                  {l.vl_desembolsado ? `${moedaCurta(l.vl_desembolsado)} desembolsados` : "nada desembolsado"}
                </span>
              </>
            ),
          },
        }),
      )}
      descricaoOrdemPadrao="o número exato primeiro, depois os vivos e a assinatura mais recente"
      servidor={MODO(total, OPCOES_CONVENIOS)}
    />
  );
}

function TabelaPropostas({ linhas, seguidas, total }: { linhas: PropostaBusca[]; seguidas: ReadonlySet<string> | null; total: number }) {
  return (
    <TabelaFiltravel
      id={TABELA_BUSCA_PROPOSTAS}
      rotulo="Propostas encontradas"
      colunas={colunasDasPropostas(seguidas !== null)}
      linhas={linhas.map(
        (l): LinhaTabela => ({
          chave: l.id_proposta,
          valores: {
            numero: l.nr_proposta ?? l.id_proposta,
            seguir: null,
            proponente: l.proponente,
            programa: l.programa,
            desfecho: l.desfecho ? (ROTULO_DESFECHO[l.desfecho] ?? l.desfecho) : null,
            repasse: l.valor_repasse,
            municipio: l.municipio,
            objeto: l.objeto,
            orgao: l.orgao_sup,
            envio: l.dt_envio,
          },
          celulas: {
            numero: <Numero href={urlProposta(l.id_proposta)} numero={l.nr_proposta ?? l.id_proposta} />,
            seguir: seguidas && (
              <span className="mp-busca-seguir">
                <EstrelaSeguir
                  tipo="proposta"
                  chave={l.id_proposta}
                  nome={`a proposta nº ${l.nr_proposta ?? l.id_proposta}`}
                  seguindo={seguidas.has(chaveSeguida("proposta", l.id_proposta))}
                />
              </span>
            ),
            proponente: <Proponente cnpj={l.cnpj} proponente={l.proponente} municipio={l.municipio} uf={l.uf} />,
            programa: <ProgramaEObjeto programa={l.programa} objeto={l.objeto} temas={l.temas} />,
            desfecho: (
              <div className="mp-busca-situacao">
                {l.desfecho ? (ROTULO_DESFECHO[l.desfecho] ?? l.desfecho) : "—"}
                <span className="mp-tabela-secundario">enviada em {data(l.dt_envio)}</span>
              </div>
            ),
            repasse: moedaCurta(l.valor_repasse),
          },
        }),
      )}
      descricaoOrdemPadrao="o número exato primeiro, depois o envio mais recente"
      servidor={MODO(total, OPCOES_PROPOSTAS)}
    />
  );
}

function TabelaOrganizacoes({ linhas, total }: { linhas: OscBusca[]; total: number }) {
  return (
    <TabelaFiltravel
      id={TABELA_BUSCA_ORGANIZACOES}
      rotulo="Organizações encontradas"
      colunas={COLUNAS_ORGANIZACOES}
      linhas={linhas.map((l): LinhaTabela => {
        const s = situacaoNaReceita(l);
        return {
          chave: l.cnpj,
          valores: {
            organizacao: nomeOsc(l),
            natureza: rotuloNatureza(l.natureza_juridica),
            situacao: rotuloSituacaoOsc(l.ativa),
            cnpj: l.cnpj,
            municipio: l.municipio ?? null,
            area: l.areas.length ? l.areas.map(rotuloArea).join(" · ") : null,
          },
          celulas: {
            organizacao: (
              <>
                <LinkMapa href={urlEntidade(l.cnpj)} className="mp-tabela-principal">
                  {nomeOsc(l)}
                </LinkMapa>
                <span className="mp-tabela-secundario">
                  {cnpjLegivel(l.cnpj)} · {l.municipio ?? "—"}/PB{l.matriz === false ? " · filial" : ""}
                </span>
              </>
            ),
            natureza: (
              <div className="mp-busca-programa">
                <span className="mp-tabela-principal">{rotuloNatureza(l.natureza_juridica)}</span>
                <span className="mp-tabela-secundario">{l.areas.length ? l.areas.map(rotuloArea).join(" · ") : "área não informada"}</span>
              </div>
            ),
            situacao: <div className="mp-busca-situacao">{s.atencao ? <strong>{s.texto}</strong> : s.texto}</div>,
          },
        };
      })}
      descricaoOrdemPadrao="as ativas primeiro, depois pelo nome"
      servidor={MODO(total, OPCOES_ORGANIZACOES)}
    />
  );
}

/**
 * Tela neutra de indisponível, para quem não é administrador: sem falar de migração nem de workflow.
 *
 * B12 (onda 2 de UX, 08/10/2026; H14 da auditoria B1+B2): só oferecia "Voltar às janelas". As duas props novas são
 * opcionais, e quem não as passa continua igual, ganhando o link da busca:
 *   · `endereco` — o endereço da própria página, que vira o botão "Tentar de novo" (um link: funciona sem JavaScript);
 *   · `voltarPara` — para onde a pessoa estava indo antes (a página do município, a carteira), como botão também.
 */
export function DadoIndisponivel({
  titulo,
  kicker,
  endereco,
  voltarPara,
  publico = false,
}: {
  titulo: string;
  kicker: string;
  endereco?: string;
  voltarPara?: SaidaIndisponivel;
  /**
   * Onda 7, C (09/10/2026; N2 da revisão R3): a página aberta ao público passa `publico` no nível 0. A saída para rota
   * fechada (a busca) leva a marca "(pede cadastro)" e vai à entrada (`linkNoPublico`), como os outros links das
   * páginas abertas; sem a prop, o de sempre.
   */
  publico?: boolean;
}) {
  const { tentar, saidas } = saidasIndisponivel(endereco, voltarPara);
  // A volta pedida vira botão ao lado do "Tentar de novo"; a busca e as janelas ficam na nota.
  const volta = voltarPara ? (saidas.find((s) => s.href === voltarPara.href) ?? null) : null;
  const marcadas = saidas.map((s) => {
    const l = linkNoPublico(s.href, publico);
    return { href: l.href, rotulo: l.pedeCadastro ? `${s.rotulo} ${MARCA_PEDE_CADASTRO}` : s.rotulo, ehVolta: s === volta };
  });
  const primeira = marcadas.find((s) => s.ehVolta) ?? null;
  const outras = marcadas.filter((s) => !s.ehVolta);
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">{kicker}</p>
        <h1 className="pa-titulo">{titulo}</h1>
        <p>Os dados não puderam ser lidos agora. Costuma ser passageiro: tente de novo em alguns minutos.</p>
        {(tentar || primeira) && (
          <p className="pa-linha">
            {tentar && (
              <LinkMapa href={tentar} className="pa-btn pa-btn-pequeno">
                Tentar de novo
              </LinkMapa>
            )}
            {primeira && (
              <LinkMapa href={primeira.href} className="pa-btn pa-btn-pequeno">
                {primeira.rotulo}
              </LinkMapa>
            )}
          </p>
        )}
        {outras.length > 0 && (
          <p className="pa-nota">
            {outras.map((s, k) => (
              <span key={s.href}>
                {k > 0 && " · "}
                <LinkMapa href={s.href}>{s.rotulo}</LinkMapa>
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
