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
import { AvisoSeguir, EstrelaSeguir } from "../_componentes/EstrelaSeguir";
import { LinkMapa } from "../_componentes/LinkMapa";
import "./busca.css";
import { TabelaRolagem } from "../_componentes/TabelaRolagem";

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
        ) : vazio ? (
          <BuscaVazia p={p} temMunicipio={leitura.municipiosAchados.length > 0} />
        ) : p.aba === "instrumentos" ? (
          <TabelaInstrumentos linhas={leitura.instrumentos} seguidas={seguidas} />
        ) : org ? (
          <TabelaOrganizacoes linhas={leitura.organizacoes} />
        ) : (
          <TabelaPropostas linhas={leitura.propostas} seguidas={seguidas} />
        )}
        {paginas > 1 && (
          <nav aria-label="Páginas" className="pa-linha mp-busca-paginas">
            {p.pagina > 1 && (
              <LinkMapa href={urlBusca(p, { pagina: p.pagina - 1 })} className="pa-btn pa-btn-pequeno" rel="prev">
                ← Página anterior
              </LinkMapa>
            )}
            <span className="pa-nota">
              Página {n(p.pagina)} de {n(paginas)} · {LIMITE_POR_PAGINA} por página
            </span>
            {p.pagina < paginas && (
              <LinkMapa href={urlBusca(p, { pagina: p.pagina + 1 })} className="pa-btn pa-btn-pequeno" rel="next">
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
 * Onda 7, C (09/10/2026; N23 da auditoria R1): o cabeçalho de linha (`th`) é só o número. Juntava o número, a estrela
 * ("Seguir o convênio nº …") e o proponente, e o leitor de tela repetia tudo isso a cada célula na navegação por tabela.
 * A estrela vem na coluna logo depois do número, ainda colada a ele (B8: a estrela longe do nome do item foi
 * confundida com a do vizinho), e o proponente ganha coluna própria.
 */
function CabecaDaLinha({ href, numero }: { href: string; numero: string }) {
  return (
    <th scope="row" className="mp-busca-numero-celula">
      <LinkMapa href={href} className="mp-tabela-principal">
        nº {numero}
      </LinkMapa>
    </th>
  );
}

/** O proponente com link para a entidade quando há CNPJ, e o município. */
function CelulaProponente({
  cnpj,
  proponente,
  municipio,
  uf,
}: {
  cnpj?: string | null;
  proponente?: string | null;
  municipio?: string | null;
  uf?: string | null;
}) {
  return (
    <td className="mp-busca-proponente">
      <span className="mp-tabela-principal">{cnpj ? <LinkMapa href={urlEntidade(cnpj)}>{proponente ?? "—"}</LinkMapa> : (proponente ?? "—")}</span>
      <span className="mp-tabela-secundario">
        {municipio ?? "—"}/{uf ?? "—"}
      </span>
    </td>
  );
}

function TabelaInstrumentos({ linhas, seguidas }: { linhas: InstrumentoBusca[]; seguidas: ReadonlySet<string> | null }) {
  return (
    <TabelaRolagem rotulo="Convênios encontrados">
      <table className="mp-tabela mp-busca-tabela">
        <thead>
          <tr>
            <th scope="col">Convênio</th>
            {seguidas && (
              <th scope="col">
                <span className="pa-sr">Seguir</span>
              </th>
            )}
            <th scope="col">Proponente</th>
            <th scope="col">Programa e objeto</th>
            <th scope="col">Situação</th>
            <th scope="col" className="mp-num">Repasse</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nr_convenio}>
              <CabecaDaLinha href={urlInstrumento(l.nr_convenio)} numero={l.nr_convenio} />
              {/* Com texto ("☆ Seguir"), não a compacta: o que a ★ faz não pode depender do title, que o toque não mostra (B12). */}
              {seguidas && (
                <td className="mp-busca-seguir">
                  <EstrelaSeguir
                    tipo="instrumento"
                    chave={l.nr_convenio}
                    nome={`o convênio nº ${l.nr_convenio}`}
                    seguindo={seguidas.has(chaveSeguida("instrumento", l.nr_convenio))}
                  />
                </td>
              )}
              <CelulaProponente cnpj={l.cnpj} proponente={l.proponente} municipio={l.municipio} uf={l.uf} />
              <td className="mp-busca-programa">
                <span className="mp-tabela-principal">{l.programa ?? "—"}</span>
                {l.objeto && <span className="mp-tabela-secundario">{l.objeto}</span>}
                <Temas temas={l.temas} />
              </td>
              <td className="mp-busca-situacao">
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
    </TabelaRolagem>
  );
}

function TabelaPropostas({ linhas, seguidas }: { linhas: PropostaBusca[]; seguidas: ReadonlySet<string> | null }) {
  return (
    <TabelaRolagem rotulo="Propostas encontradas">
      <table className="mp-tabela mp-busca-tabela">
        <thead>
          <tr>
            <th scope="col">Proposta</th>
            {seguidas && (
              <th scope="col">
                <span className="pa-sr">Seguir</span>
              </th>
            )}
            <th scope="col">Proponente</th>
            <th scope="col">Programa e objeto</th>
            <th scope="col">Desfecho</th>
            <th scope="col" className="mp-num">Repasse pedido</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id_proposta}>
              <CabecaDaLinha href={urlProposta(l.id_proposta)} numero={l.nr_proposta ?? l.id_proposta} />
              {seguidas && (
                <td className="mp-busca-seguir">
                  <EstrelaSeguir
                    tipo="proposta"
                    chave={l.id_proposta}
                    nome={`a proposta nº ${l.nr_proposta ?? l.id_proposta}`}
                    seguindo={seguidas.has(chaveSeguida("proposta", l.id_proposta))}
                  />
                </td>
              )}
              <CelulaProponente cnpj={l.cnpj} proponente={l.proponente} municipio={l.municipio} uf={l.uf} />
              <td className="mp-busca-programa">
                <span className="mp-tabela-principal">{l.programa ?? "—"}</span>
                {l.objeto && <span className="mp-tabela-secundario">{l.objeto}</span>}
                <Temas temas={l.temas} />
              </td>
              <td className="mp-busca-situacao">
                {l.desfecho ? (ROTULO_DESFECHO[l.desfecho] ?? l.desfecho) : "—"}
                <span className="mp-tabela-secundario">enviada em {data(l.dt_envio)}</span>
              </td>
              <td className="mp-num">{moedaCurta(l.valor_repasse)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TabelaRolagem>
  );
}

function TabelaOrganizacoes({ linhas }: { linhas: OscBusca[] }) {
  return (
    <TabelaRolagem rotulo="Organizações encontradas">
      <table className="mp-tabela mp-busca-tabela">
        <thead>
          <tr>
            <th scope="col">Organização</th>
            <th scope="col">Natureza e área</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const s = situacaoNaReceita(l);
            return (
              <tr key={l.cnpj}>
                <th scope="row">
                  <LinkMapa href={urlEntidade(l.cnpj)} className="mp-tabela-principal">
                    {nomeOsc(l)}
                  </LinkMapa>
                  <span className="mp-tabela-secundario">
                    {cnpjLegivel(l.cnpj)} · {l.municipio ?? "—"}/PB{l.matriz === false ? " · filial" : ""}
                  </span>
                </th>
                <td className="mp-busca-programa">
                  <span className="mp-tabela-principal">{rotuloNatureza(l.natureza_juridica)}</span>
                  <span className="mp-tabela-secundario">{l.areas.length ? l.areas.map(rotuloArea).join(" · ") : "área não informada"}</span>
                </td>
                <td className="mp-busca-situacao">{s.atencao ? <strong>{s.texto}</strong> : s.texto}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TabelaRolagem>
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
