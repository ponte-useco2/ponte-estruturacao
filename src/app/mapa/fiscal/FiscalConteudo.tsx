/**
 * A lista dos 223 municípios da PB no Painel de Capacidade Fiscal. Recebe os dados já lidos e só desenha.
 */
import Link from "next/link";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import {
  AVISO_FIXO,
  DECISOES,
  MARCA_ESTADO,
  NOME_CURTO,
  ROTULO_DECISAO,
  TOM_ESTADO,
  conclusaoDe,
  contarDecisoes,
  filtrarMunicipios,
  pct,
  urlFiscal,
  urlMunicipioFiscal,
  type EstadoFiscal,
  type ParametrosFiscal,
} from "@/lib/oportunidades/fiscal";
import type { LeituraFiscal } from "@/lib/oportunidades/fiscal.server";
import { Tag } from "../../_design/primitivos";

type LeituraOk = Extract<LeituraFiscal, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");
const GRUPOS_DECISAO: EstadoFiscal[] = ["nao_atendido", "atencao", "nao_verificavel", "atendido"];

export function EstadoDecisao({ estado }: { estado: EstadoFiscal }) {
  return (
    <Tag tom={TOM_ESTADO[estado]}>
      <span aria-hidden="true">{MARCA_ESTADO[estado]} </span>
      {ROTULO_DECISAO[estado]}
    </Tag>
  );
}

export function FiscalConteudo({ p, leitura }: { p: ParametrosFiscal; leitura: LeituraOk }) {
  const contagem = contarDecisoes(leitura.municipios);
  const visiveis = filtrarMunicipios(leitura.municipios, p);
  const c = leitura.execucao.contagens;
  const cauc = typeof c.cauc_data_pesquisa === "string" ? c.cauc_data_pesquisa : null;

  return (
    <div className="pa-pagina mp-radar mp-painel mp-fiscal">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel da PONTE · uso interno</p>
        <h1 className="pa-titulo">Capacidade fiscal · Paraíba</h1>
        <p className="pa-sub">
          Os {n(leitura.municipios.length)} municípios, lidos em <strong>{formatarPublicacao(leitura.execucao.concluida_em)}</strong>
          {cauc ? <> · CAUC na posição de {formatarData(cauc)}</> : null}
          {typeof c.versao_regras === "string" ? <> · regras {c.versao_regras}</> : null}. Para cada decisão, o que bloqueia e o que
          não deu para verificar.
        </p>
        <p className="mp-fiscal-aviso">{AVISO_FIXO}</p>
      </div>

      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        {DECISOES.map((d) => (
          <article key={d.id} className="pa-cartao mp-painel-cartao">
            <h2 className="pa-mono">
              {d.id} · {d.nome}
            </h2>
            <ul className="mp-fiscal-contagem">
              {GRUPOS_DECISAO.map((e) => (
                <li key={e}>
                  <Link href={urlFiscal(p, { decisao: d.id, estado: e })} aria-current={p.decisao === d.id && p.estado === e ? "true" : undefined}>
                    <EstadoDecisao estado={e} /> <span className="mp-num">{n(contagem[d.id][e] ?? 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <form method="get" action="/mapa/fiscal" className="mp-filtros mp-busca-form" role="search">
        <div className="pa-linha mp-painel-filtros">
        <span className="mp-busca-campo">
          <label htmlFor="fiscal-q" className="pa-campo-rotulo">
            Município
          </label>
          <input id="fiscal-q" name="q" type="search" defaultValue={p.q} className="pa-input" placeholder="nome ou IBGE" autoComplete="off" />
        </span>
        <span className="mp-busca-campo">
          <label htmlFor="fiscal-decisao" className="pa-campo-rotulo">
            Decisão
          </label>
          <select id="fiscal-decisao" name="decisao" defaultValue={p.decisao ?? ""} className="pa-select">
            <option value="">Todas</option>
            {DECISOES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id} · {d.curto}
              </option>
            ))}
          </select>
        </span>
        <span className="mp-busca-campo">
          <label htmlFor="fiscal-estado" className="pa-campo-rotulo">
            Situação na decisão
          </label>
          <select id="fiscal-estado" name="estado" defaultValue={p.estado ?? ""} className="pa-select">
            <option value="">Qualquer</option>
            {GRUPOS_DECISAO.map((e) => (
              <option key={e} value={e}>
                {ROTULO_DECISAO[e]}
              </option>
            ))}
          </select>
        </span>
        <button type="submit" className="pa-btn pa-btn-pequeno">
          Filtrar
        </button>
        {(p.q || p.decisao) && (
          <Link href="/mapa/fiscal" className="pa-btn pa-btn-pequeno">
            Limpar
          </Link>
        )}
        </div>
      </form>

      <section aria-labelledby="fiscal-lista" className="mp-radar-secao">
        <h2 id="fiscal-lista" className="mp-radar-h2" aria-live="polite">
          {visiveis.length === leitura.municipios.length ? `${n(visiveis.length)} municípios` : `${n(visiveis.length)} de ${n(leitura.municipios.length)} municípios`}
        </h2>
        {visiveis.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhum município com esse filtro.</p>
        ) : (
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela mp-fiscal-tabela">
              <thead>
                <tr>
                  <th scope="col">Município</th>
                  {DECISOES.map((d) => (
                    <th key={d.id} scope="col">
                      {d.id} · {d.curto}
                    </th>
                  ))}
                  <th scope="col" className="mp-num">
                    Pessoal
                  </th>
                  <th scope="col">CAUC</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((m) => {
                  const pendencias = m.indicadores.cauc_pendencias ?? [];
                  return (
                    <tr key={m.ibge}>
                      <th scope="row">
                        <Link href={urlMunicipioFiscal(m.ibge)} className="mp-tabela-principal">
                          {m.nome}
                        </Link>
                        <span className="mp-tabela-secundario">
                          IBGE {m.ibge}
                          {m.populacao ? ` · ${n(m.populacao)} hab.` : ""}
                        </span>
                      </th>
                      {DECISOES.map((d) => {
                        const cd = conclusaoDe(m, d.id);
                        return (
                          <td key={d.id}>
                            {cd ? <EstadoDecisao estado={cd.estado} /> : "—"}
                            {cd && cd.bloqueantes.length > 0 && (
                              <span className="mp-tabela-secundario">{cd.bloqueantes.map((b) => NOME_CURTO[b] ?? b).join(" · ")}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="mp-num">
                        {pct(m.indicadores.pessoal_pct)}
                        {m.indicadores.rgf && <span className="mp-tabela-secundario">RGF {m.indicadores.rgf}</span>}
                      </td>
                      <td>{pendencias.length ? `${pendencias.length} ${pendencias.length === 1 ? "pendência" : "pendências"}` : "sem pendência"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function FiscalIndisponivel({ estado }: { estado: "nao_ativado" | "sem_execucao" | "erro" }) {
  const texto = {
    nao_ativado: { titulo: "O painel fiscal ainda não foi ativado no banco", corpo: "Falta aplicar a migração fiscal_1 no Supabase." },
    sem_execucao: {
      titulo: "O painel fiscal ainda não rodou",
      corpo: "As tabelas existem, mas nenhuma execução foi concluída. O job roda todo dia às 12h UTC no workflow Painel fiscal do monorepo.",
    },
    erro: { titulo: "O painel fiscal está indisponível agora", corpo: "A leitura dos dados falhou. O detalhe está no registro do servidor." },
  }[estado];
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">Painel da PONTE · uso interno</p>
        <h1 className="pa-titulo">{texto.titulo}</h1>
        <p>{texto.corpo}</p>
        <p>
          <Link href="/mapa/painel">Voltar ao painel de execução</Link>
        </p>
      </div>
    </div>
  );
}
