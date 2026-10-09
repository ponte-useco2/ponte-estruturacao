/**
 * A busca unificada (C2, onda 4 de UX, 08/10/2026): um campo só e cinco grupos — municípios, entidades, organizações,
 * convênios e propostas. A lógica é de `busca-unificada.ts` (pura) e de `lerBuscaUnificada` (servidor).
 *
 * - Cada grupo chega na sua hora: é uma leitura em andamento dentro do seu `Suspense`. Na PB todos chegam em dezenas
 *   de ms; em outra UF, convênios e propostas podem levar segundos, e os outros grupos não esperam por eles.
 * - Cada grupo falha sozinho, com "Tentar de novo"; o resto da página continua.
 * - A região viva (`role="status"`) fica fora dos `Suspense`, para o leitor de tela ouvir a troca do "Procurando…"
 *   pelo total quando os cinco chegam.
 * - Os grupos são listas, não tabelas: cabem em 375 px sem rolar de lado. As tabelas continuam nas abas, onde o
 *   "Ver todos (N)" leva, dentro de `TabelaRolagem`.
 * - Todo link é `LinkMapa`. Nada de `title`: o que cada link faz está no texto dele.
 * - Privacidade: entidades e organizações são pessoas jurídicas; o nome do proponente passa por `semCpf`, e a OSC sai
 *   sem endereço (o cadastro lido nem traz endereço).
 */
import { Suspense, type ReactNode } from "react";
import {
  contagem,
  ehMunicipioPb,
  urlBusca,
  urlInstrumento,
  urlProposta,
  type InstrumentoBusca,
  type ParametrosBusca,
  type PropostaBusca,
} from "@/lib/oportunidades/busca";
import type { MunicipioAchado } from "@/lib/oportunidades/busca-municipio";
import {
  GRUPOS_UNIFICADOS,
  LIMITE_GRUPO,
  MAXIMO_ENTIDADES_ABERTAS,
  alcanceDoGrupo,
  avisoDoEscopo,
  cortar,
  escopoUnificado,
  notaEntidadesFora,
  resumoUnificado,
  rotuloVerTodos,
  semCpf,
  textoGrupoVazio,
  tudoVazio,
  urlBrasilInteiro,
  urlVerTodos,
  vazioUnificado,
  type Contado,
  type EntidadeAchada,
  type Entrada,
  type EscopoUnificado,
  type GrupoLido,
  type IdGrupo,
} from "@/lib/oportunidades/busca-unificada";
import type { GruposUnificados, LeituraUnificada } from "@/lib/oportunidades/busca.server";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { cnpjLegivel } from "@/lib/oportunidades/fornecedores";
import { UFS } from "@/lib/oportunidades/organizacao";
import { nomeOsc, rotuloNatureza, situacaoNaReceita } from "@/lib/oportunidades/osc";
import type { OscBusca } from "@/lib/oportunidades/osc.server";
import { urlEntidade } from "@/lib/oportunidades/pagina-entidade";
import { NOME_UF } from "@/lib/oportunidades/pagina-uf";
import { ROTULO_DESFECHO } from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { LinkMapa } from "../_componentes/LinkMapa";
import { AbasBusca, Campo } from "./BuscaConteudo";
import "./busca.css";

type LeituraOk = Extract<LeituraUnificada, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");
const data = (iso: string | null) => (iso ? formatarData(iso) : "—");
const grupo = (id: IdGrupo) => GRUPOS_UNIFICADOS.find((g) => g.id === id) as (typeof GRUPOS_UNIFICADOS)[number];
/**
 * O resumo do resto que abre no lugar (onda 7, C, 09/10/2026; N02 da auditoria R1). Era "Ver todos os municípios (N)",
 * sublinhado como link, e nada dizia que abria ali mesmo: agora diz quantos aparecem a mais, e o marcador ▸/▾ do CSS
 * mostra que abre e se está aberto. O estado aberto/fechado o leitor de tela já ouve do próprio `<details>`.
 */
const mostrarMais = (id: IdGrupo, quantos: number) => `Mostrar mais ${contagem(quantos, grupo(id).um, grupo(id).varios)}`;
/** As outras UFs em ordem de nome, para o seletor. */
const OUTRAS_UFS = UFS.filter((u) => u !== "PB").sort((a, b) => (NOME_UF[a] ?? a).localeCompare(NOME_UF[b] ?? b, "pt-BR"));

export function BuscaUnificada({ p, entrada, leitura }: { p: ParametrosBusca; entrada: Entrada; leitura: LeituraOk }) {
  const escopo = escopoUnificado(p);
  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Busca</p>
        <h1 className="pa-titulo">Buscar no Mapa</h1>
        <p className="pa-sub">
          Municípios, entidades, organizações da sociedade civil, convênios e propostas, num campo só. Dado do Transferegov até{" "}
          <strong>{formatarPublicacao(leitura.execucao.dado_ate)}</strong>.
        </p>
      </div>

      <AbasBusca p={p} />

      <form method="get" action="/mapa/busca" className="mp-filtros mp-busca-form" role="search">
        {/* Só quem digita aqui vai direto à página do CNPJ ou do número (page.tsx): os links de outras páginas não. */}
        <input type="hidden" name="direto" value="1" />
        <div className="mp-busca-termo">
          <label htmlFor="busca-q" className="mp-busca-rotulo">
            Nome, CNPJ ou número
          </label>
          <input
            id="busca-q"
            name="q"
            type="search"
            defaultValue={p.q}
            className="pa-input"
            placeholder="ex.: Patos, creche, 956541"
            autoComplete="off"
            aria-describedby="busca-q-ajuda"
          />
          <p id="busca-q-ajuda" className="mp-busca-ajuda">
            Procura de uma vez nos municípios, nas entidades, nas organizações da sociedade civil, nos convênios e nas propostas.
            Acento e maiúsculas não importam. Um CNPJ completo ou o número de um convênio abre direto a página dele.
          </p>
        </div>
        <div className="pa-linha mp-painel-filtros">
          <Campo id="busca-uf" rotulo="UF dos convênios e propostas">
            <select id="busca-uf" name="uf" defaultValue={escopo.padrao ? "" : escopo.uf} className="pa-select">
              <option value="">Paraíba</option>
              {OUTRAS_UFS.map((u) => (
                <option key={u} value={u}>
                  {NOME_UF[u] ?? u}
                </option>
              ))}
            </select>
          </Campo>
          <button type="submit" className="pa-btn pa-btn-pequeno">
            Buscar
          </button>
        </div>
      </form>

      {leitura.grupos ? (
        <Resultados p={p} entrada={entrada} escopo={escopo} g={leitura.grupos} />
      ) : (
        <Inicio p={p} escopo={escopo} />
      )}
    </div>
  );
}

/** Sem termo: o que a busca acha e onde. Com termo que não filtra ("%", uma letra), diz por que nada foi procurado. */
function Inicio({ p, escopo }: { p: ParametrosBusca; escopo: EscopoUnificado }) {
  return (
    <section aria-labelledby="busca-inicio" className="mp-radar-secao">
      <h2 id="busca-inicio" className="mp-radar-h2">
        {p.q ? `Nada para procurar em “${p.q}”` : "O que a busca acha"}
      </h2>
      {p.q && <p>Digite uma palavra de 2 letras ou mais, um CNPJ ou um número.</p>}
      <ul className="mp-unif-inicio">
        {GRUPOS_UNIFICADOS.map((g) => (
          <li key={g.id}>
            <strong>{g.titulo}:</strong> {alcanceDoGrupo(g.id, escopo)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Resultados({ p, entrada, escopo, g }: { p: ParametrosBusca; entrada: Entrada; escopo: EscopoUnificado; g: GruposUnificados }) {
  const lento = !escopo.ehPb;
  return (
    <>
      {/* A região viva fica fora do Suspense: o leitor de tela ouve a troca do "Procurando…" pelo total. */}
      <div role="status" className="mp-unif-total">
        <Suspense fallback={<>Procurando “{p.q}” nos municípios, nas entidades, nas organizações, nos convênios e nas propostas…</>}>
          <Total q={p.q} g={g} />
        </Suspense>
      </div>
      {entrada.tipo === "cnpj_invalido" && (
        <p className="pa-cartao pa-cartao-plano mp-unif-alerta">
          Os 14 dígitos “{entrada.digitos}” não formam um CNPJ válido: os dois últimos (os verificadores) não conferem. A busca procurou o
          número como texto.
        </p>
      )}
      <p className="pa-nota mp-unif-aviso">{avisoDoEscopo(escopo)}</p>

      <Suspense fallback={null}>
        <Vazio p={p} entrada={entrada} g={g} />
      </Suspense>

      <Suspense fallback={<Esperando id="municipios" escopo={escopo} />}>
        <GrupoMunicipios p={p} entrada={entrada} escopo={escopo} promessa={g.municipios} />
      </Suspense>
      <Suspense fallback={<Esperando id="entidades" escopo={escopo} />}>
        <GrupoEntidades p={p} entrada={entrada} escopo={escopo} promessa={g.entidades} />
      </Suspense>
      <Suspense fallback={<Esperando id="organizacoes" escopo={escopo} />}>
        <GrupoOrganizacoes p={p} entrada={entrada} escopo={escopo} promessa={g.organizacoes} />
      </Suspense>
      <Suspense fallback={<Esperando id="convenios" escopo={escopo} lento={lento} />}>
        <GrupoConvenios p={p} entrada={entrada} escopo={escopo} promessa={g.convenios} />
      </Suspense>
      <Suspense fallback={<Esperando id="propostas" escopo={escopo} lento={lento} />}>
        <GrupoPropostas p={p} entrada={entrada} escopo={escopo} promessa={g.propostas} />
      </Suspense>
    </>
  );
}

// ============================ TOTAL E VAZIO ============================

const contado = (x: GrupoLido<unknown>): Contado =>
  x.estado === "ok" ? { estado: "ok", total: x.total } : x.estado === "fora" ? { estado: "fora" } : { estado: "erro" };

async function contar(g: GruposUnificados): Promise<Record<IdGrupo, Contado>> {
  const [municipios, entidades, organizacoes, convenios, propostas] = await Promise.all([
    g.municipios,
    g.entidades,
    g.organizacoes,
    g.convenios,
    g.propostas,
  ]);
  return {
    municipios: contado(municipios),
    entidades: contado(entidades),
    organizacoes: contado(organizacoes),
    convenios: contado(convenios),
    propostas: contado(propostas),
  };
}

async function Total({ q, g }: { q: string; g: GruposUnificados }) {
  return <>{resumoUnificado(q, await contar(g))}</>;
}

/** B12: o vazio diz o que foi procurado e onde, e o que tentar. Só quando nenhum grupo achou e nenhum falhou. */
async function Vazio({ p, entrada, g }: { p: ParametrosBusca; entrada: Entrada; g: GruposUnificados }) {
  if (!tudoVazio(await contar(g))) return null;
  const v = vazioUnificado(p, entrada);
  return (
    <section aria-labelledby="busca-vazio" className="pa-cartao pa-cartao-plano mp-busca-vazio mp-unif-vazio-geral">
      <h2 id="busca-vazio" className="mp-radar-h2">
        {v.titulo}
      </h2>
      <p>{v.texto} O que tentar:</p>
      <ul>
        {v.saidas.map((s) => (
          <li key={s.texto}>
            {s.href ? <LinkMapa href={s.href}>{s.texto}</LinkMapa> : s.texto}
            {s.nota ? ` ${s.nota}` : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ============================ A MOLDURA DE CADA GRUPO ============================

/** Título com a contagem, o alcance do grupo e o corpo. `espera`: a moldura do Suspense, com outro id. */
function Grupo({
  id,
  escopo,
  total,
  espera = false,
  children,
}: {
  id: IdGrupo;
  escopo: EscopoUnificado;
  total: number | null;
  espera?: boolean;
  children: ReactNode;
}) {
  const idTitulo = `grupo-${id}${espera ? "-espera" : ""}`;
  return (
    <section aria-labelledby={idTitulo} className="mp-radar-secao mp-unif-grupo">
      <h2 id={idTitulo} className="mp-radar-h2 mp-unif-titulo">
        {grupo(id).titulo}
        {total !== null && <span className="mp-unif-n"> ({n(total)})</span>}
      </h2>
      <p className="mp-unif-alcance">{alcanceDoGrupo(id, escopo)}</p>
      {children}
    </section>
  );
}

function Esperando({ id, escopo, lento = false }: { id: IdGrupo; escopo: EscopoUnificado; lento?: boolean }) {
  return (
    <Grupo id={id} escopo={escopo} total={null} espera>
      <p className="mp-unif-espera">Procurando…{lento ? ` Fora da Paraíba, pode levar alguns segundos.` : ""}</p>
    </Grupo>
  );
}

/** O que o grupo diz quando não tem o que listar: erro (com "Tentar de novo"), não se aplica, ou nada achado. */
function SemItens({ id, p, entrada, r }: { id: IdGrupo; p: ParametrosBusca; entrada: Entrada; r: GrupoLido<unknown> }) {
  if (r.estado === "erro") {
    const oQue = grupo(id).todos.replace(/^tod[oa]s /, "");
    return (
      <p className="mp-unif-falha">
        Não deu para ler {oQue} agora; os outros grupos não dependem deste.{" "}
        <LinkMapa href={urlBusca(p, {})}>Tentar de novo</LinkMapa>
      </p>
    );
  }
  if (r.estado === "fora") return <p className="mp-unif-vazio">{r.motivo}</p>;
  return <p className="mp-unif-vazio">{textoGrupoVazio(id, p, entrada)}</p>;
}

/** O "Ver todos (N)" das abas e, sem UF escolhida, o Brasil inteiro, com o tempo que leva. */
function Acoes({ id, p, escopo, total }: { id: IdGrupo; p: ParametrosBusca; escopo: EscopoUnificado; total: number }) {
  const href = urlVerTodos(p, id);
  const brasil = escopo.padrao && (id === "convenios" || id === "propostas") ? id : null;
  if (!(href && total > 0) && !brasil) return null;
  return (
    <div className="mp-unif-acoes">
      {href && total > 0 && (
        <LinkMapa href={href} className="pa-btn pa-btn-pequeno">
          {rotuloVerTodos(id, total)}
        </LinkMapa>
      )}
      {brasil && (
        <span className="mp-unif-brasil">
          <LinkMapa href={urlBrasilInteiro(p, brasil)}>{brasil === "convenios" ? "Procurar nos convênios do Brasil inteiro" : "Procurar nas propostas do Brasil inteiro"}</LinkMapa>{" "}
          {/* Medido em 08/10/2026 (C2): convênios ~4 s; propostas ~15 s, acima dos 8 s da API. A nota não promete o que
              a busca não entrega (integração da onda 4). */}
          {brasil === "convenios" ? "(leva alguns segundos)" : "(sem a UF, costuma passar do limite de tempo e não voltar: se puder, escolha a UF)"}
        </span>
      )}
    </div>
  );
}

type PropsGrupo<T> = { p: ParametrosBusca; entrada: Entrada; escopo: EscopoUnificado; promessa: Promise<GrupoLido<T>> };

// ============================ MUNICÍPIOS ============================

async function GrupoMunicipios({ p, entrada, escopo, promessa }: PropsGrupo<MunicipioAchado>) {
  const r = await promessa;
  const ok = r.estado === "ok" && r.total > 0 ? r : null;
  const { primeiros, resto } = cortar(ok?.itens ?? []);
  const item = (m: MunicipioAchado) => (
    <li key={m.ibge}>
      <LinkMapa href={m.href} className="mp-unif-nome">
        {m.nome}
      </LinkMapa>
      <span className="mp-unif-sec">
        {m.uf} · {ehMunicipioPb(m.ibge) ? "página do município" : "investimentos federais"} · ou só{" "}
        <LinkMapa href={urlBusca(p, { aba: "instrumentos", q: "", uf: m.uf, municipio: m.ibge })}>os convênios de {m.nome}</LinkMapa>
      </span>
    </li>
  );
  return (
    <Grupo id="municipios" escopo={escopo} total={r.estado === "ok" ? r.total : null}>
      {r.estado === "ok" && r.aviso && <p className="mp-unif-falha">{r.aviso}</p>}
      {ok ? (
        <>
          <ul className="mp-unif-lista">{primeiros.map(item)}</ul>
          {resto.length > 0 && (
            <details className="mp-unif-mais">
              <summary>{mostrarMais("municipios", resto.length)}</summary>
              <ul className="mp-unif-lista">{resto.map(item)}</ul>
            </details>
          )}
          {ok.mais && <p className="mp-busca-ajuda">Pode haver outros com esse começo fora da Paraíba: escreva o nome inteiro.</p>}
        </>
      ) : (
        <SemItens id="municipios" p={p} entrada={entrada} r={r} />
      )}
    </Grupo>
  );
}

// ============================ ENTIDADES ============================

async function GrupoEntidades({ p, entrada, escopo, promessa }: PropsGrupo<EntidadeAchada>) {
  const r = await promessa;
  const ok = r.estado === "ok" && r.total > 0 ? r : null;
  const abertas = (ok?.itens ?? []).slice(0, MAXIMO_ENTIDADES_ABERTAS);
  const { primeiros, resto } = cortar(abertas);
  const nota = notaEntidadesFora(escopo);
  const item = (e: EntidadeAchada) => (
    <li key={e.cnpj}>
      <LinkMapa href={e.href} className="mp-unif-nome">
        {e.nome}
      </LinkMapa>
      <span className="mp-unif-sec">
        {e.rotulo} · {e.municipio ?? "—"}/{e.uf ?? "—"} · CNPJ {cnpjLegivel(e.cnpj)}
        {e.instrumentos !== null &&
          ` · ${contagem(e.instrumentos, "convênio", "convênios")}${e.emExecucao ? `, ${n(e.emExecucao)} em execução` : ""}`}
      </span>
    </li>
  );
  return (
    <Grupo id="entidades" escopo={escopo} total={r.estado === "ok" ? r.total : null}>
      {ok ? (
        <>
          <ul className="mp-unif-lista">{primeiros.map(item)}</ul>
          {resto.length > 0 && (
            <details className="mp-unif-mais">
              <summary>{mostrarMais("entidades", resto.length)}</summary>
              <ul className="mp-unif-lista">{resto.map(item)}</ul>
              {ok.total > abertas.length && (
                <p className="mp-busca-ajuda">
                  Aqui estão as {n(abertas.length)} primeiras de {n(ok.total)}. Escreva mais do nome para chegar às outras.
                </p>
              )}
            </details>
          )}
        </>
      ) : (
        <SemItens id="entidades" p={p} entrada={entrada} r={r} />
      )}
      {nota && <p className="mp-busca-ajuda">{nota}</p>}
    </Grupo>
  );
}

// ============================ ORGANIZAÇÕES ============================

async function GrupoOrganizacoes({ p, entrada, escopo, promessa }: PropsGrupo<OscBusca>) {
  const r = await promessa;
  const ok = r.estado === "ok" && r.total > 0 ? r : null;
  return (
    <Grupo id="organizacoes" escopo={escopo} total={r.estado === "ok" ? r.total : null}>
      {ok ? (
        <ul className="mp-unif-lista">
          {ok.itens.slice(0, LIMITE_GRUPO).map((l) => {
            const s = situacaoNaReceita(l);
            return (
              <li key={l.cnpj}>
                <LinkMapa href={urlEntidade(l.cnpj)} className="mp-unif-nome">
                  {nomeOsc(l)}
                </LinkMapa>
                <span className="mp-unif-sec">
                  {rotuloNatureza(l.natureza_juridica)} · {l.municipio ?? "—"}/PB · CNPJ {cnpjLegivel(l.cnpj)}
                  {l.matriz === false ? " · filial" : ""}
                </span>
                <span className="mp-unif-sec">{s.atencao ? <strong>{s.texto}</strong> : s.texto}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <SemItens id="organizacoes" p={p} entrada={entrada} r={r} />
      )}
      {r.estado === "ok" && <Acoes id="organizacoes" p={p} escopo={escopo} total={r.total} />}
    </Grupo>
  );
}

// ============================ CONVÊNIOS E PROPOSTAS ============================

/** O proponente com link para a entidade quando há CNPJ; o nome passa pela trava do CPF. */
function Proponente({ cnpj, nome }: { cnpj?: string | null; nome: string | null }) {
  const texto = nome ? semCpf(nome) : "—";
  return cnpj ? <LinkMapa href={urlEntidade(cnpj)}>{texto}</LinkMapa> : <>{texto}</>;
}

async function GrupoConvenios({ p, entrada, escopo, promessa }: PropsGrupo<InstrumentoBusca>) {
  const r = await promessa;
  const ok = r.estado === "ok" && r.total > 0 ? r : null;
  return (
    <Grupo id="convenios" escopo={escopo} total={r.estado === "ok" ? r.total : null}>
      {ok ? (
        <ul className="mp-unif-lista">
          {ok.itens.slice(0, LIMITE_GRUPO).map((l) => (
            <li key={l.nr_convenio}>
              <LinkMapa href={urlInstrumento(l.nr_convenio)} className="mp-unif-nome">
                Convênio nº {l.nr_convenio}
              </LinkMapa>
              {l.programa && <span className="mp-unif-principal">{l.programa}</span>}
              {l.objeto && <span className="mp-unif-sec mp-unif-objeto">{l.objeto}</span>}
              <span className="mp-unif-sec">
                <Proponente cnpj={l.cnpj} nome={l.proponente} /> · {l.municipio ?? "—"}/{l.uf ?? "—"}
              </span>
              <span className="mp-unif-sec">
                {l.situacao ?? "situação não informada"} · assinado em {data(l.dt_assinatura)} · repasse de {moedaCurta(l.vl_repasse)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <SemItens id="convenios" p={p} entrada={entrada} r={r} />
      )}
      <Acoes id="convenios" p={p} escopo={escopo} total={r.estado === "ok" ? r.total : 0} />
    </Grupo>
  );
}

async function GrupoPropostas({ p, entrada, escopo, promessa }: PropsGrupo<PropostaBusca>) {
  const r = await promessa;
  const ok = r.estado === "ok" && r.total > 0 ? r : null;
  return (
    <Grupo id="propostas" escopo={escopo} total={r.estado === "ok" ? r.total : null}>
      {ok ? (
        <ul className="mp-unif-lista">
          {ok.itens.slice(0, LIMITE_GRUPO).map((l) => (
            <li key={l.id_proposta}>
              <LinkMapa href={urlProposta(l.id_proposta)} className="mp-unif-nome">
                Proposta nº {l.nr_proposta ?? l.id_proposta}
              </LinkMapa>
              {l.programa && <span className="mp-unif-principal">{l.programa}</span>}
              {l.objeto && <span className="mp-unif-sec mp-unif-objeto">{l.objeto}</span>}
              <span className="mp-unif-sec">
                <Proponente cnpj={l.cnpj} nome={l.proponente} /> · {l.municipio ?? "—"}/{l.uf ?? "—"}
              </span>
              <span className="mp-unif-sec">
                {l.desfecho ? (ROTULO_DESFECHO[l.desfecho] ?? l.desfecho) : "desfecho não informado"} · enviada em {data(l.dt_envio)} · repasse
                pedido de {moedaCurta(l.valor_repasse)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <SemItens id="propostas" p={p} entrada={entrada} r={r} />
      )}
      <Acoes id="propostas" p={p} escopo={escopo} total={r.estado === "ok" ? r.total : 0} />
    </Grupo>
  );
}
