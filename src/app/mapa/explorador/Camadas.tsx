/**
 * O conteúdo de cada camada do explorador (C3a, 09/10/2026): Brasil, UF, município, entidade e instrumento. Componentes
 * de SERVIDOR: o palco (`Palco.tsx`, cliente) só empilha e anima; o que cada camada mostra chega pronto do servidor, com
 * a malha do IBGE desenhada aqui (o JSON dos 223 municípios não vai no pacote do navegador).
 *
 * Cada camada tem a mesma cabeça: a posição na descida, o título (que recebe o foco na troca, `data-titulo-camada`), o
 * resumo e as duas saídas para fora do explorador — a página completa do nível e o relatório dele. O corpo é a lista do
 * nível de baixo, cada item um link para a camada seguinte; os mapas levam ao mesmo lugar, e a lista é o caminho do
 * teclado e do leitor de tela (o mapa sai do Tab, como o dos 223 na página da UF).
 *
 * Texto neutro e ordem neutra: as UFs e os municípios em ordem alfabética, sem ranking (decisão de 02/10). As entidades
 * seguem a ordem do "Quem recebe" da página do município. Privacidade: só CNPJ (pessoa jurídica) e o que o painel já
 * mostra; nenhum nome de fornecedor, de pessoa física, endereço ou dirigente de OSC.
 */
import { dataBrasilia } from "@/lib/oportunidades/datas";
import {
  NIVEIS,
  ROTULO_LENTE_EXPLORADOR,
  ROTULO_NIVEL,
  UF_DA_DESCIDA,
  lentesDoExplorador,
  nomeDoNivel,
  paginasDoNivel,
  regiaoDaDescida,
  regioesDaDescida,
  totalDaLente,
  urlDaLente,
  urlExplorador,
  urlFilho,
  type LenteExplorador,
  type NivelExplorador,
  type NomesDaPilha,
  type PilhaExplorador,
} from "@/lib/oportunidades/explorador";
import malhaBrasil from "@/lib/oportunidades/malhas/brasil-uf.json";
import malhaPb from "@/lib/oportunidades/malhas/pb-municipios.json";
import { MACRORREGIAO, ORDEM_MACRORREGIAO, ROTULO_MACRORREGIAO, gruposDeCor, type AreaMapa, type Malha } from "@/lib/oportunidades/pagina-brasil";
import { ROTULO_ESPECIE, ROTULO_LENTE, carteiraPorSituacao, quemRecebe, type EntidadeNoMunicipio } from "@/lib/oportunidades/pagina-entidade";
import { NOME_UF, totalTerritorio } from "@/lib/oportunidades/pagina-uf";
import { tituloOrgao } from "@/lib/oportunidades/padroes";
import { percentual } from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { LinkMapa } from "../_componentes/LinkMapa";
import { MapaTerritorio } from "../_componentes/MapaTerritorio";
import type { LeiturasExplorador } from "./camadas.server";

const n = (x: number | null | undefined) => (x === null || x === undefined ? "—" : x.toLocaleString("pt-BR"));
const plural = (x: number, um: string, varios: string) => `${n(x)} ${x === 1 ? um : varios}`;
const ano = (iso: string | null | undefined) => (iso && /^\d{4}/.test(iso) ? iso.slice(0, 4) : null);
/** O objeto do convênio, que às vezes passa de mil caracteres: a camada mostra o começo; a página completa, o todo. */
const resumo = (s: string | null | undefined, max = 160) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** O que a camada usa da leitura, para os nomes: a entidade e a modalidade do instrumento. */
export function nomesDaLeitura(l: LeiturasExplorador): NomesDaPilha {
  const e = l.pilha.cnpj && l.entidade?.estado === "ok" ? l.entidade : null;
  const i = e && l.pilha.instrumento ? e.instrumentos.find((x) => x.nr_convenio === l.pilha.instrumento) : undefined;
  return { entidade: e?.entidade.nome ?? null, modalidade: i?.modalidade ?? null };
}

// ================================================================ peças comuns

function Cabeca({ p, nivel, nome, sub }: { p: PilhaExplorador; nivel: NivelExplorador; nome: string; sub?: React.ReactNode }) {
  const pg = paginasDoNivel(p, nivel);
  return (
    <header className="mp-exp-cabeca">
      <p className="pa-kicker">
        Camada {NIVEIS.indexOf(nivel) + 1} de {NIVEIS.length} · {ROTULO_NIVEL[nivel]}
      </p>
      {/* O foco vem para cá a cada troca de camada (Palco.tsx); fora do Tab, só por programa. */}
      <h2 className="pa-titulo mp-exp-titulo" tabIndex={-1} data-titulo-camada="">
        {nome}
      </h2>
      {sub && <p className="pa-sub mp-mun-chips">{sub}</p>}
      <p className="mp-laudo-acoes mp-exp-saidas">
        <LinkMapa href={pg.completa.href} className="pa-btn pa-btn-pequeno">
          {pg.completa.rotulo}
        </LinkMapa>
        <LinkMapa href={pg.relatorio.href} className="pa-btn pa-btn-pequeno">
          {pg.relatorio.rotulo}
        </LinkMapa>
      </p>
    </header>
  );
}

/** A leitura da camada falhou: a camada fica, com o "Tentar de novo" e as saídas da cabeça. */
function Indisponivel({ p, texto }: { p: PilhaExplorador; texto: string }) {
  return (
    <p className="pa-cartao pa-cartao-plano">
      {texto} Costuma ser passageiro:{" "}
      <LinkMapa href={urlExplorador(p)} scroll={false}>
        tentar de novo
      </LinkMapa>
      , ou abrir a página completa.
    </p>
  );
}

/** Um item da lista: o link para a camada de baixo, com o nome e uma ou duas linhas de dado. */
function Item({ href, nome, dados }: { href: string; nome: string; dados: (string | null | false | undefined)[] }) {
  return (
    <li>
      <LinkMapa href={href} scroll={false} className="mp-exp-item">
        <span className="mp-exp-item-nome">{nome}</span>
        {dados.filter(Boolean).map((d, i) => (
          <span key={i} className="mp-exp-item-dado">
            {d}
          </span>
        ))}
      </LinkMapa>
    </li>
  );
}

// ================================================================ Brasil

function CamadaBrasil({ p, l }: { p: PilhaExplorador; l: LeiturasExplorador }) {
  const leitura = l.brasil?.estado === "ok" ? l.brasil : null;
  const t = leitura?.territorio ?? null;
  const vivosDe = (recorte: string) => (t ? totalTerritorio(t, recorte, "vivos") : null);
  const ufs = Object.keys(NOME_UF).sort((a, b) => NOME_UF[a].localeCompare(NOME_UF[b], "pt-BR"));
  const cor = new Map(ORDEM_MACRORREGIAO.map((r, i) => [r, i]));
  const areas = new Map<string, AreaMapa>(
    ufs.map((s) => [s, { nome: `${NOME_UF[s]} (${ROTULO_MACRORREGIAO[MACRORREGIAO[s]]})`, href: urlFilho(p, "brasil", s), grupo: cor.get(MACRORREGIAO[s]) ?? 0 }]),
  );
  const br = vivosDe("BR");
  return (
    <>
      <Cabeca
        p={p}
        nivel="brasil"
        nome="Brasil"
        sub={
          <>
            <span>27 UFs</span>
            {br && <span>{plural(br.n, "instrumento vivo", "instrumentos vivos")} no país</span>}
            {leitura && <span>Transferegov até {dataBrasilia(leitura.execucao.dado_ate)}</span>}
          </>
        }
      />
      {!leitura && <Indisponivel p={p} texto="As somas do país não puderam ser lidas agora." />}
      <div className="mp-exp-corpo">
        <MapaTerritorio
          malha={malhaBrasil as Malha}
          areas={areas}
          legenda={ORDEM_MACRORREGIAO.map((r) => ({ grupo: cor.get(r) ?? 0, rotulo: ROTULO_MACRORREGIAO[r] }))}
          titulo="Mapa do Brasil por UF, cor pela macrorregião"
          rotulos
          navegavel={false}
          alternativa="Pelo teclado ou com leitor de tela, use a lista das 27 UFs logo abaixo do mapa: ela tem os mesmos links."
        />
        <h3 className="mp-rel-h3">As 27 UFs, em ordem alfabética</h3>
        <p className="pa-nota">
          Instrumentos vivos: em execução, prestando contas ou em tomada de contas especial. A Paraíba tem o dado completo e desce até o instrumento; nas
          outras UFs, a descida para no estado.
        </p>
        <ul className="mp-exp-lista">
          {ufs.map((s) => {
            const v = vivosDe(s);
            return (
              <Item
                key={s}
                href={urlFilho(p, "brasil", s)}
                nome={NOME_UF[s]}
                dados={[v ? `${plural(v.n, "instrumento vivo", "instrumentos vivos")} · ${moedaCurta(v.valor)}` : null, s === UF_DA_DESCIDA && "Desce até o instrumento"]}
              />
            );
          })}
        </ul>
      </div>
    </>
  );
}

// ================================================================ UF

function CamadaUf({ p, l }: { p: PilhaExplorador; l: LeiturasExplorador }) {
  const sigla = p.uf ?? UF_DA_DESCIDA;
  const leitura = l.uf?.estado === "ok" ? l.uf : null;
  const vivos = leitura?.territorio ? totalTerritorio(leitura.territorio, sigla, "vivos") : null;
  const desce = sigla === UF_DA_DESCIDA;
  const sub = (
    <>
      {vivos && <span>{plural(vivos.n, "instrumento vivo", "instrumentos vivos")}</span>}
      {vivos && <span>{moedaCurta(vivos.valor)} de valor global dos vivos</span>}
      {desce ? (
        <span>223 municípios</span>
      ) : (
        vivos?.municipios != null && <span>{plural(vivos.municipios, "município", "municípios")} com instrumento vivo</span>
      )}
    </>
  );

  if (!desce) {
    return (
      <>
        <Cabeca p={p} nivel="uf" nome={nomeDoNivel(p, "uf")} sub={sub} />
        {!leitura && <Indisponivel p={p} texto="As somas do estado não puderam ser lidas agora." />}
        <div className="mp-exp-corpo">
          <p className="pa-cartao pa-cartao-plano">
            Neste protótipo, a descida até o município só vale na Paraíba, a UF com o dado completo (todos os instrumentos desde 2008 e a malha dos
            municípios). A página do estado tem os municípios e o que a base guarda para o país.
          </p>
        </div>
      </>
    );
  }

  // A PB: os 223 pela lista fixa (nome com acento e região, sem banco), com as somas da leitura da UF quando há.
  const regioes = regioesDaDescida();
  const somas = new Map((leitura?.municipios ?? []).map((m) => [m.ibge, m]));
  const intermediarias = [...new Set(regioes.map((r) => r.intermediaria))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const cor = gruposDeCor(intermediarias);
  const areas = new Map<string, AreaMapa>(
    regioes.flatMap((r) =>
      r.municipios.map((m) => [m.ibge, { nome: `${m.nome} (região imediata de ${r.imediata})`, href: urlFilho(p, "uf", m.ibge), grupo: cor.get(r.intermediaria) ?? 0 }] as const),
    ),
  );
  return (
    <>
      <Cabeca p={p} nivel="uf" nome={nomeDoNivel(p, "uf")} sub={sub} />
      {!leitura && <Indisponivel p={p} texto="As somas dos municípios não puderam ser lidas agora." />}
      <div className="mp-exp-corpo">
        <MapaTerritorio
          malha={malhaPb as Malha}
          areas={areas}
          legenda={intermediarias.map((r) => ({ grupo: cor.get(r) ?? 0, rotulo: `Região intermediária de ${r}` }))}
          titulo="Mapa dos 223 municípios da Paraíba, cor pela região intermediária do IBGE"
          alternativa="Pelo teclado ou com leitor de tela, use a lista por região logo abaixo do mapa: ela tem os mesmos links."
        />
        <h3 className="mp-rel-h3">Os municípios por região imediata</h3>
        <p className="pa-nota">Em ordem alfabética dentro de cada região imediata do IBGE; a cor do mapa é a da região intermediária, que cada grupo diz.</p>
        {regioes.map((r) => (
          <details key={r.imediata} className="mp-ent-grupo">
            <summary>
              <span className={`mp-mapa-amostra mp-mapa-g${cor.get(r.intermediaria) ?? 0}`} aria-hidden="true" /> <strong>Região imediata de {r.imediata}</strong> ·
              região intermediária de {r.intermediaria} · {plural(r.municipios.length, "município", "municípios")}
            </summary>
            <ul className="mp-exp-lista">
              {r.municipios.map((m) => {
                const s = somas.get(m.ibge);
                return (
                  <Item
                    key={m.ibge}
                    href={urlFilho(p, "uf", m.ibge)}
                    nome={m.nome}
                    dados={[s ? `${plural(s.instrumentos, "instrumento", "instrumentos")} desde 2008${s.em_execucao ? ` · ${n(s.em_execucao)} em execução` : ""}` : null]}
                  />
                );
              })}
            </ul>
          </details>
        ))}
      </div>
    </>
  );
}

// ================================================================ município

function ListaDeEntidades({ p, entidades }: { p: PilhaExplorador; entidades: EntidadeNoMunicipio[] }) {
  return (
    <ul className="mp-exp-lista">
      {entidades.map((e) => (
        <Item
          key={e.cnpj}
          href={urlFilho(p, "municipio", e.cnpj)}
          nome={e.nome}
          dados={[
            `${ROTULO_ESPECIE[e.especie]} · ${plural(e.instrumentos, "instrumento", "instrumentos")}${e.emExecucao ? ` · ${n(e.emExecucao)} em execução` : ""}`,
            `${moedaCurta(e.valor)} de valor global${e.ultimoAno ? ` · o mais recente de ${e.ultimoAno}` : ""}`,
          ]}
        />
      ))}
    </ul>
  );
}

function CamadaMunicipio({ p, l }: { p: PilhaExplorador; l: LeiturasExplorador }) {
  const ibge = p.ibge ?? "";
  const nome = nomeDoNivel(p, "municipio");
  const regiao = regiaoDaDescida(ibge);
  const m = l.uf?.estado === "ok" ? l.uf.municipios?.find((x) => x.ibge === ibge) : undefined;
  const sub = (
    <>
      {regiao && <span>Região imediata de {regiao.imediata}</span>}
      {m?.populacao ? <span>{n(m.populacao)} habitantes</span> : null}
      {m && <span>{plural(m.instrumentos, "instrumento", "instrumentos")} desde 2008</span>}
      {m && m.em_execucao > 0 && <span>{n(m.em_execucao)} em execução</span>}
    </>
  );
  if (!Array.isArray(l.entidades)) {
    return (
      <>
        <Cabeca p={p} nivel="municipio" nome={nome} sub={sub} />
        <Indisponivel p={p} texto="A lista de quem recebe no município não pôde ser lida agora." />
      </>
    );
  }
  const lentes = lentesDoExplorador(quemRecebe(l.entidades));
  const abas: LenteExplorador[] = ["publico", "sociedade"];
  return (
    <>
      <Cabeca p={p} nivel="municipio" nome={nome} sub={sub} />
      <div className="mp-exp-corpo">
        <nav aria-label="Lentes do município" className="mp-mun-abas">
          {abas.map((a) => (
            <LinkMapa key={a} href={urlDaLente(p, a)} scroll={false} aria-current={a === p.lente ? "page" : undefined}>
              {ROTULO_LENTE_EXPLORADOR[a]} ({n(totalDaLente(lentes, a))})
            </LinkMapa>
          ))}
        </nav>
        {p.lente === "publico" ? (
          lentes.publico.length ? (
            lentes.publico.map((g) => (
              <section key={g.lente} aria-labelledby={`mp-exp-lente-${g.lente}`}>
                <h3 id={`mp-exp-lente-${g.lente}`} className="mp-rel-h3">
                  {ROTULO_LENTE[g.lente]} · {plural(g.entidades.length, "entidade", "entidades")}
                </h3>
                <ListaDeEntidades p={p} entidades={g.entidades} />
              </section>
            ))
          ) : (
            <p className="pa-cartao pa-cartao-plano">Nenhuma entidade do poder público com instrumento na base em {nome}.</p>
          )
        ) : (
          <>
            <h3 className="mp-rel-h3">Organizações da sociedade civil com instrumento federal</h3>
            {lentes.sociedade.length ? (
              <ListaDeEntidades p={p} entidades={lentes.sociedade} />
            ) : (
              <p className="pa-cartao pa-cartao-plano">Nenhuma organização da sociedade civil com instrumento federal na base em {nome}.</p>
            )}
            {m?.osc_ativas ? (
              <p className="pa-nota">
                O Mapa das OSC (Ipea) registra {plural(m.osc_ativas, "organização ativa", "organizações ativas")} com sede em {nome}, com ou sem
                instrumento.{" "}
                <LinkMapa href={`/mapa/municipio/${encodeURIComponent(ibge)}/organizacoes`}>Ver a lista na página do município</LinkMapa>.
              </p>
            ) : null}
          </>
        )}
        {lentes.outros > 0 && (
          <p className="pa-nota">
            {lentes.outros === 1 ? "Outro proponente" : `Outros ${n(lentes.outros)} proponentes`} (empresas, Sistema S e outros) não{" "}
            {lentes.outros === 1 ? "entra" : "entram"} nas duas lentes: {lentes.outros === 1 ? "está" : "estão"} na página completa do município.
          </p>
        )}
      </div>
    </>
  );
}

// ================================================================ entidade

function CamadaEntidade({ p, l }: { p: PilhaExplorador; l: LeiturasExplorador }) {
  const le = l.entidade?.estado === "ok" ? l.entidade : null;
  const nome = nomeDoNivel(p, "entidade", nomesDaLeitura(l));
  if (!le) {
    return (
      <>
        <Cabeca p={p} nivel="entidade" nome={nome} />
        <Indisponivel p={p} texto="A carteira da entidade não pôde ser lida agora." />
      </>
    );
  }
  const e = le.entidade;
  const grupos = carteiraPorSituacao(le.instrumentos);
  return (
    <>
      <Cabeca
        p={p}
        nivel="entidade"
        nome={nome}
        sub={
          <>
            <span>{ROTULO_ESPECIE[e.especie]}</span>
            {e.municipio && <span>Sede em {tituloOrgao(e.municipio)}</span>}
            {e.desde && <span>Na base desde {e.desde}</span>}
            <span>{plural(le.instrumentos.length, "instrumento", "instrumentos")}</span>
          </>
        }
      />
      <div className="mp-exp-corpo">
        {grupos.length ? (
          <>
            <h3 className="mp-rel-h3">A carteira, por situação</h3>
            {grupos.map((g, k) => (
              <details key={g.id} className="mp-ent-grupo" open={k === 0}>
                <summary>
                  <strong>{g.rotulo}</strong> · {plural(g.itens.length, "instrumento", "instrumentos")} · {moedaCurta(g.valor)}
                </summary>
                <ul className="mp-exp-lista">
                  {g.itens.map((i) => (
                    <Item
                      key={i.nr_convenio}
                      href={urlFilho(p, "entidade", i.nr_convenio)}
                      nome={nomeDoNivel({ ...p, instrumento: i.nr_convenio }, "instrumento", { modalidade: i.modalidade })}
                      dados={[resumo(i.objeto), `${moedaCurta(i.vl_global)} de valor global${ano(i.dt_assinatura) ? ` · assinado em ${ano(i.dt_assinatura)}` : ""}`]}
                    />
                  ))}
                </ul>
              </details>
            ))}
          </>
        ) : (
          <p className="pa-cartao pa-cartao-plano">Nenhum instrumento desta entidade na base. A página completa mostra as propostas e o cadastro.</p>
        )}
      </div>
    </>
  );
}

// ================================================================ instrumento

function CamadaInstrumento({ p, l }: { p: PilhaExplorador; l: LeiturasExplorador }) {
  const le = l.entidade?.estado === "ok" ? l.entidade : null;
  const i = le?.instrumentos.find((x) => x.nr_convenio === p.instrumento);
  const nome = nomeDoNivel(p, "instrumento", nomesDaLeitura(l));
  if (!i) {
    return (
      <>
        <Cabeca p={p} nivel="instrumento" nome={nome} />
        <Indisponivel p={p} texto="Os dados do instrumento não puderam ser lidos agora." />
      </>
    );
  }
  const linhas: [string, string][] = [
    ["Valor global", moedaCurta(i.vl_global)],
    ["Repasse federal", moedaCurta(i.vl_repasse)],
    ["Desembolsado", moedaCurta(i.vl_desembolsado)],
    ["Pago pela entidade", moedaCurta(i.vl_pago)],
    ["Saldo em conta", moedaCurta(i.vl_saldo_conta)],
    ["Execução física aferida", i.pct_fisico === null ? "—" : percentual(i.pct_fisico)],
    ["Assinatura", dataBrasilia(i.dt_assinatura)],
    ["Fim da vigência", dataBrasilia(i.dt_fim_vigencia)],
    ["Limite da prestação de contas", dataBrasilia(i.dt_limite_contas)],
  ];
  return (
    <>
      <Cabeca
        p={p}
        nivel="instrumento"
        nome={nome}
        sub={
          <>
            {i.situacao && <span>{i.situacao}</span>}
            {i.orgao_sup && <span>{tituloOrgao(i.orgao_sup)}</span>}
            {i.programa && <span>{resumo(i.programa, 90)}</span>}
          </>
        }
      />
      <div className="mp-exp-corpo">
        {i.objeto && <p className="mp-exp-objeto">{resumo(i.objeto, 600)}</p>}
        <dl className="mp-exp-ficha">
          {linhas.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="pa-nota">
          A execução mês a mês, os fornecedores e os pagamentos ficam na página do instrumento e no laudo; no explorador, são as próximas camadas.
        </p>
      </div>
    </>
  );
}

// ================================================================ a camada pelo nível

export function ConteudoDaCamada({ nivel, l }: { nivel: NivelExplorador; l: LeiturasExplorador }) {
  const p = l.pilha;
  switch (nivel) {
    case "brasil":
      return <CamadaBrasil p={p} l={l} />;
    case "uf":
      return <CamadaUf p={p} l={l} />;
    case "municipio":
      return <CamadaMunicipio p={p} l={l} />;
    case "entidade":
      return <CamadaEntidade p={p} l={l} />;
    case "instrumento":
      return <CamadaInstrumento p={p} l={l} />;
  }
}
