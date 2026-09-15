/**
 * A exibição da busca. Recebe os dados já lidos e só desenha: é o que permite conferir a
 * tela com dados reais sem o portão de login.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import {
  GRUPOS_DESFECHO,
  GRUPOS_SITUACAO,
  LIMITE_POR_PAGINA,
  contagem,
  totalDePaginas,
  urlBusca,
  urlInstrumento,
  urlInvestimentos,
  urlProposta,
  type InstrumentoBusca,
  type ParametrosBusca,
  type PropostaBusca,
} from "@/lib/oportunidades/busca";
import type { LeituraBusca } from "@/lib/oportunidades/busca.server";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { UFS } from "@/lib/oportunidades/organizacao";
import { ROTULO_DESFECHO } from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_TEMA, TEMAS_RAIZ } from "@/lib/oportunidades/temas";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { EstrelaSeguir } from "../_componentes/EstrelaSeguir";

type LeituraOk = Extract<LeituraBusca, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");
const data = (iso: string | null) => (iso ? formatarData(iso) : "—");

export function BuscaConteudo({
  p,
  leitura,
  seguidas = null,
}: {
  p: ParametrosBusca;
  leitura: LeituraOk;
  /** Chaves `tipo:chave` seguidas. Null sem a oport_15: as linhas ficam sem estrela. */
  seguidas?: ReadonlySet<string> | null;
}) {
  const grupos = p.aba === "instrumentos" ? GRUPOS_SITUACAO : GRUPOS_DESFECHO;
  const paginas = totalDePaginas(leitura.total);
  const vazio = leitura.instrumentos.length === 0 && leitura.propostas.length === 0;

  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Busca</p>
        <h1 className="pa-titulo">Convênios e propostas</h1>
        <p className="pa-sub">
          Pelo número, pelo nome do programa, pelo objeto, pelo proponente ou pelo CNPJ. Dado do Transferegov até{" "}
          <strong>{formatarPublicacao(leitura.execucao.dado_ate)}</strong>. Na Paraíba, todos os convênios desde 2008 e as
          propostas desde 2019; no resto do país, os convênios em execução ou em prestação de contas e as propostas recentes.
        </p>
      </div>

      <nav aria-label="O que buscar" className="pa-chips mp-radar-filtros">
        {(
          [
            ["instrumentos", "Convênios"],
            ["propostas", "Propostas"],
          ] as const
        ).map(([aba, rotulo]) => (
          <Link
            key={aba}
            href={urlBusca(p, { aba })}
            className={`pa-chip${p.aba === aba ? " pa-ativo" : ""}`}
            aria-current={p.aba === aba ? "page" : undefined}
          >
            {rotulo}
          </Link>
        ))}
      </nav>

      <form method="get" action="/mapa/busca" className="mp-filtros mp-busca-form" role="search">
        {p.aba !== "instrumentos" && <input type="hidden" name="aba" value={p.aba} />}
        <div className="mp-busca-termo">
          <label htmlFor="busca-q" className="pa-campo-rotulo">
            Buscar
          </label>
          <input
            id="busca-q"
            name="q"
            type="search"
            defaultValue={p.q}
            className="pa-input"
            placeholder="nº do convênio, programa, objeto, município ou CNPJ"
            autoComplete="off"
          />
        </div>
        <div className="pa-linha mp-painel-filtros">
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
          {p.uf && leitura.municipios.length > 0 && (
            <Campo id="busca-municipio" rotulo="Município">
              <select id="busca-municipio" name="municipio" defaultValue={p.municipio ?? ""} className="pa-select mp-painel-municipio">
                <option value="">Todos da UF</option>
                {leitura.municipios.map((m) => (
                  <option key={m.cod_ibge} value={m.cod_ibge}>
                    {m.municipio ?? `IBGE ${m.cod_ibge}`}
                  </option>
                ))}
              </select>
            </Campo>
          )}
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
          <button type="submit" className="pa-btn pa-btn-pequeno">
            Buscar
          </button>
        </div>
      </form>

      <section aria-labelledby="busca-resultado" className="mp-radar-secao">
        <h2 id="busca-resultado" className="mp-radar-h2" aria-live="polite">
          {vazio
            ? "Nada encontrado"
            : p.aba === "instrumentos"
              ? contagem(leitura.total, "convênio", "convênios")
              : contagem(leitura.total, "proposta", "propostas")}
          {p.municipio ? (
            <>
              {" "}
              · <Link href={urlInvestimentos(p.municipio)}>ver os investimentos do município</Link>
            </>
          ) : null}
        </h2>
        {vazio ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhum resultado com esses termos e filtros. Busque por uma palavra só, tire um filtro ou confira o número.
          </p>
        ) : p.aba === "instrumentos" ? (
          <TabelaInstrumentos linhas={leitura.instrumentos} seguidas={seguidas} />
        ) : (
          <TabelaPropostas linhas={leitura.propostas} seguidas={seguidas} />
        )}
        {paginas > 1 && (
          <nav aria-label="Páginas" className="pa-linha mp-busca-paginas">
            {p.pagina > 1 && (
              <Link href={urlBusca(p, { pagina: p.pagina - 1 })} className="pa-btn pa-btn-pequeno" rel="prev">
                ← Anteriores
              </Link>
            )}
            <span className="pa-nota">
              Página {n(p.pagina)} de {n(paginas)} · {LIMITE_POR_PAGINA} por página
            </span>
            {p.pagina < paginas && (
              <Link href={urlBusca(p, { pagina: p.pagina + 1 })} className="pa-btn pa-btn-pequeno" rel="next">
                Próximos →
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}

function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: ReactNode }) {
  return (
    <span className="mp-busca-campo">
      <label htmlFor={id} className="pa-campo-rotulo">
        {rotulo}
      </label>
      {children}
    </span>
  );
}

function Temas({ temas }: { temas: string[] }) {
  const conhecidos = temas.filter((t) => ROTULO_TEMA[t]);
  if (!conhecidos.length) return null;
  return <span className="mp-tabela-secundario">{conhecidos.map((t) => ROTULO_TEMA[t]).join(" · ")}</span>;
}

function TabelaInstrumentos({ linhas, seguidas }: { linhas: InstrumentoBusca[]; seguidas: ReadonlySet<string> | null }) {
  return (
    <div className="mp-tabela-rolagem">
      <table className="mp-tabela mp-busca-tabela">
        <thead>
          <tr>
            <th scope="col">Convênio</th>
            <th scope="col">Programa e objeto</th>
            <th scope="col">Situação</th>
            <th scope="col" className="mp-num">Repasse</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nr_convenio}>
              <th scope="row">
                <span className="mp-busca-numero">
                  <Link href={urlInstrumento(l.nr_convenio)} className="mp-tabela-principal">
                    nº {l.nr_convenio}
                  </Link>
                  {seguidas && (
                    <EstrelaSeguir
                      tipo="instrumento"
                      chave={l.nr_convenio}
                      nome={`o convênio nº ${l.nr_convenio}`}
                      seguindo={seguidas.has(chaveSeguida("instrumento", l.nr_convenio))}
                      compacta
                    />
                  )}
                </span>
                <span className="mp-tabela-secundario">
                  {l.proponente ?? "—"} · {l.municipio ?? "—"}/{l.uf ?? "—"}
                </span>
              </th>
              <td>
                <span className="mp-tabela-principal">{l.programa ?? "—"}</span>
                {l.objeto && <span className="mp-tabela-secundario">{l.objeto}</span>}
                <Temas temas={l.temas} />
              </td>
              <td>
                {l.situacao ?? "—"}
                <span className="mp-tabela-secundario">assinado em {data(l.dt_assinatura)}</span>
              </td>
              <td className="mp-num">
                {moedaCurta(l.vl_repasse)}
                <span className="mp-tabela-secundario">
                  {l.vl_desembolsado ? `${moedaCurta(l.vl_desembolsado)} desembolsados` : "nada desembolsado"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelaPropostas({ linhas, seguidas }: { linhas: PropostaBusca[]; seguidas: ReadonlySet<string> | null }) {
  return (
    <div className="mp-tabela-rolagem">
      <table className="mp-tabela mp-busca-tabela">
        <thead>
          <tr>
            <th scope="col">Proposta</th>
            <th scope="col">Programa e objeto</th>
            <th scope="col">Desfecho</th>
            <th scope="col" className="mp-num">Repasse pedido</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id_proposta}>
              <th scope="row">
                <span className="mp-busca-numero">
                  <Link href={urlProposta(l.id_proposta)} className="mp-tabela-principal">
                    nº {l.nr_proposta ?? l.id_proposta}
                  </Link>
                  {seguidas && (
                    <EstrelaSeguir
                      tipo="proposta"
                      chave={l.id_proposta}
                      nome={`a proposta nº ${l.nr_proposta ?? l.id_proposta}`}
                      seguindo={seguidas.has(chaveSeguida("proposta", l.id_proposta))}
                      compacta
                    />
                  )}
                </span>
                <span className="mp-tabela-secundario">
                  {l.proponente ?? "—"} · {l.municipio ?? "—"}/{l.uf ?? "—"}
                </span>
              </th>
              <td>
                <span className="mp-tabela-principal">{l.programa ?? "—"}</span>
                {l.objeto && <span className="mp-tabela-secundario">{l.objeto}</span>}
                <Temas temas={l.temas} />
              </td>
              <td>
                {l.desfecho ? (ROTULO_DESFECHO[l.desfecho] ?? l.desfecho) : "—"}
                <span className="mp-tabela-secundario">enviada em {data(l.dt_envio)}</span>
              </td>
              <td className="mp-num">{moedaCurta(l.valor_repasse)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tela neutra de indisponível, para quem não é administrador: sem falar de migração nem de workflow. */
export function DadoIndisponivel({ titulo, kicker }: { titulo: string; kicker: string }) {
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">{kicker}</p>
        <h1 className="pa-titulo">{titulo}</h1>
        <p>Os dados não puderam ser lidos agora. Tente de novo em alguns minutos.</p>
        <p className="pa-nota">
          <Link href="/mapa">Voltar às janelas</Link>
        </p>
      </div>
    </div>
  );
}
