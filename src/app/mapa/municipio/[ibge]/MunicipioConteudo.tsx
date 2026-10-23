/**
 * A página do município em abas (F1a, decisões de 06/10/2026): um endereço no lugar das telas espalhadas. Cada
 * aba junta os blocos do relatório que já existem (RelatorioConteudo); aqui só se escolhe o que entra em cada
 * uma e o que o nível de acesso alcança. A aba "o que trava" é a fila do município (F1b, `fila.ts`): a mesma ordem
 * do "Em uma página" do relatório e da carteira.
 *
 * C4a (09/10/2026; achados B2, B3 e C5 da revisão R3): no nível 0 (a versão pública, atrás da chave `MAPA_PUBLICO`),
 * o relatório chega recortado (`relatorioDoNivel`: sem fiscal, controle, TCE-PB, fornecedores, Pix nem análise), a
 * aba do dinheiro mostra só o que a entidade mostra ao público, e somem a estrela de seguir e o botão de imprimir.
 * Do nível 1 em diante, nada muda.
 *
 * Onda 15, fase 2, lote B (13/10/2026): os blocos de convênios e de emendas recebem o nível, só para o CSV filtrado das
 * tabelas, que é do cadastro (D1); as abas usam `LinkMapa`.
 */
import type { LeituraPI } from "@/lib/oportunidades/primeira-infancia.server";
import { resumoMunicipio } from "@/lib/oportunidades/primeira-infancia";
import { CartoesPI, DetalheMunicipioPI } from "../../primeira-infancia/PecasPrimeiraInfancia";
import { formatarData } from "@/lib/oportunidades/central";
import { rotuloRegic } from "@/lib/oportunidades/indicadores-municipio";
import { urlMunicipioFiscal } from "@/lib/oportunidades/fiscal";
import {
  ABAS_MUNICIPIO,
  PODE,
  destinoConvenio,
  relatorioDoNivel,
  urlMunicipio,
  type AbaMunicipio,
  type NivelAcesso,
} from "@/lib/oportunidades/pagina-municipio";
import type { LeituraEmendasMunicipio } from "@/lib/oportunidades/emendas";
import type { FonteOsc, ResumoOscMunicipio } from "@/lib/oportunidades/osc";
import { MARCA_PEDE_CADASTRO, linkNoPublico } from "@/lib/oportunidades/publico";
import type { EntidadeNoMunicipio, LenteEntidade } from "@/lib/oportunidades/pagina-entidade";
import type { Relatorio } from "@/lib/oportunidades/relatorio-municipio";
import { trilha } from "@/lib/oportunidades/trilha";
import { proximoDiaDoMes } from "@/lib/oportunidades/vazios";
import { EstrelaSeguir } from "../../_componentes/EstrelaSeguir";
import { Termo } from "../../_componentes/Termo";
import { Trilha } from "../../_componentes/Trilha";
import { EmendasDoMunicipio } from "./EmendasDoMunicipio";
import type { LeituraAssembleia } from "@/lib/oportunidades/emendas-pb";
import type { LeituraTceEstadoMunicipio } from "@/lib/oportunidades/tce-estado";
import type { LeituraFederalPorAno } from "@/lib/oportunidades/lado-a-lado";
import { EmendasEstaduaisDoMunicipio } from "../../parlamentares/assembleia/EmendasEstaduais";
import { EmendasDaCamaraNoMunicipio } from "../../parlamentares/camara-jp/EmendasDaCamaraJp";
import { municipalDaLeitura, type LeituraCamaraJp } from "@/lib/oportunidades/emendas-jp";
import { QuemRecebe } from "./QuemRecebe";
import { BotaoImprimir } from "../../fiscal/[ibge]/simular/BotaoImprimir";
import {
  BlocoControle,
  BlocoConvenios,
  BlocoEmendas,
  BlocoFila,
  BlocoFiscal,
  BlocoFontes,
  BlocoFornecedores,
  BlocoJanelas,
  BlocoMunicipio,
  BlocoPix,
  BlocoPropostas,
  BlocoTcePb,
  BlocoTramita,
  BlocosIndicadoresMunicipio,
  Cartoes,
  EmOrdem,
  Secao,
} from "./relatorio/RelatorioConteudo";
import { LinkMapa } from "../../_componentes/LinkMapa";

const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");

function Cabeca({ r, nivel, seguindo }: { r: Relatorio; nivel: NivelAcesso; seguindo: boolean }) {
  const g = r.indicadores?.grupo ?? null;
  const pop = r.indicadores?.municipio.find((x) => x.id === "populacao_estimada") ?? r.indicadores?.municipio.find((x) => x.id === "populacao_censo");
  return (
    <div className="pa-pilha mp-radar-cabeca">
      <Trilha elos={trilha({ uf: "PB", regiaoImediata: g?.regiao_imediata, municipio: { ibge: r.ibge, nome: r.nome } })} />
      <h1 className="pa-titulo">{r.nome}</h1>
      <p className="pa-sub mp-mun-chips">
        <span>IBGE {r.ibge}</span>
        {pop && (
          <span>
            {pop.texto} ({pop.ano})
          </span>
        )}
        {g?.porte && (
          <span>
            <Termo slug="tercil">porte {g.porte} na PB</Termo>
          </span>
        )}
        {g?.regic && <span>{rotuloRegic(g.regic)}</span>}
        <span>dados lidos em {data(r.hoje)}</span>
      </p>
      {/* C4a (C5 da R3): seguir e imprimir são do cadastro; no nível 0 a linha inteira sai. */}
      {PODE.cadastro(nivel) && (
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <EstrelaSeguir tipo="municipio" chave={r.ibge} nome={`o município ${r.nome}`} seguindo={seguindo} />
          <BotaoImprimir />
          {PODE.interno(nivel) && (
            <LinkMapa href={`/mapa/painel/municipio/${r.ibge}`} className="pa-btn pa-btn-pequeno">
              Abrir a ficha no painel
            </LinkMapa>
          )}
        </p>
      )}
    </div>
  );
}

function Abas({ ibge, aba, nivel }: { ibge: string; aba: AbaMunicipio; nivel: NivelAcesso }) {
  return (
    <nav aria-label="Partes do município" className="mp-mun-abas mp-nao-imprimir">
      {ABAS_MUNICIPIO.filter((a) => nivel >= a.minimo).map((a) => (
        <LinkMapa key={a.id} href={urlMunicipio(ibge, a.id)} aria-current={a.id === aba ? "page" : undefined} scroll={false}>
          {a.nome}
        </LinkMapa>
      ))}
    </nav>
  );
}

function Mais({ children }: { children: React.ReactNode }) {
  return <p className="mp-nao-imprimir mp-laudo-acoes">{children}</p>;
}

/*
 * B12b (onda 3 de UX, 08/10/2026): as duas abas sem dado diziam só "ainda não tem" / "ainda não foram lidos". Agora
 * separam a leitura que falhou agora (o nome vai em `faltas`, ver `relatorio-municipio.server.ts`), que pede "Tentar de
 * novo", do dado que ainda não existe, que diz quando a próxima rodada está marcada. A leitura que veio com falta não
 * vai ao cache compartilhado (`leituraGuardavel`) e fica no máximo 60 s só no servidor que a leu (onda 8, B: uma fonte
 * fora do ar não multiplica as leituras); por isso o texto pede "em alguns minutos". Os horários são os agendados
 * em `.github/workflows/` e no cron da Vercel, e só eles: o GitHub atrasa as execuções em horas, e a frase não promete
 * o minuto em que o dado chega.
 */
function TentarDeNovo({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div className="pa-cartao pa-cartao-plano pa-pilha">
      <p>{children}</p>
      <p className="pa-linha mp-nao-imprimir">
        <LinkMapa href={href} className="pa-btn pa-btn-pequeno">
          Tentar de novo
        </LinkMapa>
      </p>
    </div>
  );
}

/** O painel fiscal (`fiscal.yml`): diário, disparado pelo cron da Vercel às 11h30 UTC, que sai até as 12h29 UTC. */
function SemFiscal({ r }: { r: Relatorio }) {
  if (r.faltas.includes("painel fiscal")) {
    return (
      <TentarDeNovo href={urlMunicipio(r.ibge, "contas")}>
        O painel fiscal não pôde ser lido agora. Costuma ser passageiro: tente de novo em alguns minutos.
      </TentarDeNovo>
    );
  }
  return (
    <div className="pa-cartao pa-cartao-plano pa-pilha">
      <p>
        O painel fiscal ainda não tem {r.nome}. Ele é refeito todo dia para os 223 municípios da Paraíba, com o disparo de manhã, entre
        8h30 e 9h30 (horário de Brasília): confira de novo depois da próxima rodada.
      </p>
      <p className="pa-linha mp-nao-imprimir">
        <LinkMapa href={urlMunicipio(r.ibge, "dinheiro")} className="pa-btn pa-btn-pequeno">
          Ver o dinheiro federal
        </LinkMapa>
      </p>
    </div>
  );
}

/** O dia do cron de `.github/workflows/municipios.yml` ("0 10 5 * *"). */
const DIA_DOS_INDICADORES = 5;

/** Os indicadores (`municipios.yml`): rodada mensal, com o cron no dia 5 de cada mês. */
function SemIndicadores({ r }: { r: Relatorio }) {
  if (r.faltas.includes("indicadores do município")) {
    return (
      <TentarDeNovo href={urlMunicipio(r.ibge, "indicadores")}>
        Os indicadores não puderam ser lidos agora. Costuma ser passageiro: tente de novo em alguns minutos.
      </TentarDeNovo>
    );
  }
  const proxima = proximoDiaDoMes(r.hoje, DIA_DOS_INDICADORES);
  return (
    <div className="pa-cartao pa-cartao-plano pa-pilha">
      <p>
        Os indicadores de {r.nome} ainda não foram lidos. A leitura é mensal, com IBGE, Ministério da Saúde, INEP e outras fontes oficiais,
        marcada para o dia {DIA_DOS_INDICADORES} de cada mês{proxima ? `; a próxima, para ${data(proxima)}` : ""}.
      </p>
      <p className="pa-linha mp-nao-imprimir">
        <LinkMapa href={urlMunicipio(r.ibge, "resumo")} className="pa-btn pa-btn-pequeno">
          Ver o resumo em números
        </LinkMapa>
      </p>
    </div>
  );
}

/** Os indicadores da camada 2 que dizem a necessidade da primeira infância, na ordem de leitura. */
const NECESSIDADE_PI = ["creche_0a3", "pre_escola_4a5", "mortalidade_infantil", "mortalidade_materna"];

function AbaPrimeiraInfancia({ r, nivel, leitura }: { r: Relatorio; nivel: NivelAcesso; leitura?: LeituraPI }) {
  if (!leitura || leitura.estado !== "ok") {
    return (
      <p className="pa-cartao pa-cartao-plano">
        A primeira infância do município está indisponível agora.{" "}
        <LinkMapa href={urlMunicipio(r.ibge, "primeira-infancia")}>Tentar de novo</LinkMapa>
      </p>
    );
  }
  const m = leitura.municipios[0];
  if (!m) return null;
  const l = r.indicadores;
  const todos = l ? [...l.municipio, ...l.social.flatMap((b) => b.itens), ...(l.economia?.itens ?? []), ...(l.territorio?.itens ?? [])] : [];
  const necessidade = NECESSIDADE_PI.map((id) => todos.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  return (
    <Secao id="mun-primeira-infancia" titulo="Primeira infância">
      {leitura.faltas.length > 0 && (
        <p className="pa-nota" role="status">
          Não foi possível ler agora: {leitura.faltas.join(", ")}.
        </p>
      )}
      <CartoesPI t={resumoMunicipio(m)} datas={leitura.datas} estadual={false} />
      <DetalheMunicipioPI m={m} datas={leitura.datas} nivel={nivel} necessidade={necessidade} />
      <Mais>
        <LinkMapa href="/mapa/primeira-infancia" className="pa-btn pa-btn-pequeno">
          A primeira infância nos 223 municípios
        </LinkMapa>
      </Mais>
    </Secao>
  );
}

export function MunicipioConteudo({
  r: relatorio,
  aba,
  nivel,
  seguindo,
  entidades,
  osc,
  emendas,
  assembleia,
  tceEstado,
  federalPorAno,
  camaraJp,
  primeiraInfancia,
}: {
  r: Relatorio;
  aba: AbaMunicipio;
  nivel: NivelAcesso;
  seguindo: boolean;
  /** "Quem recebe no município" (E1): lido só na aba do dinheiro; null quando a leitura falhou. */
  entidades?: { lente: LenteEntidade; entidades: EntidadeNoMunicipio[] }[] | null;
  /** O resumo do Mapa das OSC (E3), também só na aba do dinheiro. */
  osc?: { resumo: ResumoOscMunicipio; fonte: FonteOsc } | null;
  /**
   * "De onde vêm as emendas" (onda 14, parte 2, C, 13/10/2026): lido só na aba do dinheiro e só para o administrador
   * (`leEmendasDoMunicipio`); ausente para os outros. O bloco ainda confere o nível antes de desenhar.
   */
  emendas?: LeituraEmendasMunicipio;
  /** As emendas estaduais (E2, 16/10/2026): a mesma regra das federais — só administrador, só na aba do dinheiro. */
  assembleia?: LeituraAssembleia;
  /** O dinheiro do Estado no TCE-PB (E3), com a mesma regra. */
  tceEstado?: LeituraTceEstadoMunicipio;
  /** As emendas federais por ano, para o lado a lado com as estaduais (E3). */
  federalPorAno?: LeituraFederalPorAno;
  /** As emendas da Câmara de João Pessoa (J2): só na página de João Pessoa, com a mesma regra. */
  camaraJp?: LeituraCamaraJp;
  /** A primeira infância do município (P2, 22/10/2026): lida só na aba dela. */
  primeiraInfancia?: LeituraPI;
}) {
  // C4a: o recorte do público mora no dado, e não só na tela (ver `relatorioDoPublico`); do nível 1 em diante, o inteiro.
  const r = relatorioDoNivel(relatorio, nivel);
  const publico = !PODE.cadastro(nivel);
  const investimentos = linkNoPublico(`/mapa/municipio/${r.ibge}/investimentos`, publico);
  const destino = destinoConvenio(nivel);
  const nomeAba = ABAS_MUNICIPIO.find((a) => a.id === aba)?.nome ?? "";
  return (
    <div className="pa-pagina mp-radar mp-laudo mp-rel mp-mun">
      <Cabeca r={r} nivel={nivel} seguindo={seguindo} />
      <Abas ibge={r.ibge} aba={aba} nivel={nivel} />
      <p className="mp-so-imprimir pa-kicker">{nomeAba}</p>

      {aba === "trava" && (
        <>
          <BlocoFila r={r} destino={destino} linkIndicadores={urlMunicipio(r.ibge, "indicadores")} />
          <BlocoJanelas r={r} />
        </>
      )}

      {aba === "resumo" && (
        <>
          <Secao id="mun-resumo" titulo="Em números">
            <Cartoes r={r} />
            <EmOrdem r={r} />
          </Secao>
          <BlocoMunicipio r={r} />
        </>
      )}

      {aba === "dinheiro" && (
        <>
          {entidades !== undefined && <QuemRecebe grupos={entidades} municipio={r.nome} ibge={r.ibge} osc={osc} publico={publico} />}
          <BlocoConvenios r={r} destino={destino} nivel={nivel} />
          <Mais>
            <LinkMapa href={investimentos.href} className="pa-btn pa-btn-pequeno">
              Ver os investimentos por tema, modalidade e tipo
              {investimentos.pedeCadastro && ` ${MARCA_PEDE_CADASTRO}`}
            </LinkMapa>
            {PODE.laudo(nivel) && (
              <LinkMapa href={`/mapa/pix/ente/${r.ibge}`} className="pa-btn pa-btn-pequeno">
                Abrir o laudo do Pix
              </LinkMapa>
            )}
          </Mais>
          <BlocoPropostas r={r} destino={destino} />
          <BlocoEmendas r={r} nivel={nivel} />
          {/* Onda 14, parte 2, C (13/10/2026): os autores das emendas, só do administrador, até a revisão jurídica. */}
          {PODE.interno(nivel) && emendas !== undefined && <EmendasDoMunicipio leitura={emendas} municipio={r.nome} />}
          {/* E2 das emendas estaduais (16/10/2026): a Assembleia da PB, à parte das federais, só do administrador. */}
          {PODE.interno(nivel) && assembleia !== undefined && (
            <EmendasEstaduaisDoMunicipio
              leitura={assembleia}
              ibge={r.ibge}
              municipio={r.nome}
              tce={tceEstado}
              federal={federalPorAno}
              municipal={municipalDaLeitura(camaraJp)}
            />
          )}
          {/* J2 das emendas de João Pessoa (16/10/2026): a Câmara Municipal da capital, à parte, só do administrador. */}
          {PODE.interno(nivel) && camaraJp !== undefined && <EmendasDaCamaraNoMunicipio leitura={camaraJp} />}
          {/* C4a (B3 da R3): Pix, TCE-PB e fornecedores só do nível 1 em diante, como na entidade. */}
          {PODE.cadastro(nivel) && (
            <>
              <BlocoPix r={r} destino={destino} />
              <BlocoTcePb r={r} />
              <BlocoFornecedores r={r} destino={destino} />
            </>
          )}
        </>
      )}

      {aba === "contas" && (
        <>
          <BlocoFiscal r={r} destino={destino} />
          {PODE.interno(nivel) && (
            <Mais>
              <LinkMapa href={urlMunicipioFiscal(r.ibge)} className="pa-btn pa-btn-pequeno">
                Abrir o painel fiscal completo
              </LinkMapa>
              <LinkMapa href={`/mapa/fiscal/${r.ibge}/simular`} className="pa-btn pa-btn-pequeno">
                Abrir o simulador de crédito
              </LinkMapa>
            </Mais>
          )}
          {!r.fiscal && <SemFiscal r={r} />}
        </>
      )}

      {aba === "controle" && (
        <>
          <BlocoControle r={r} destino={destino} />
          <BlocoTramita />
          {PODE.interno(nivel) && (
            <Mais>
              <LinkMapa href={`/mapa/painel/tce/${r.ibge}`} className="pa-btn pa-btn-pequeno">
                Ver as despesas no TCE-PB
              </LinkMapa>
            </Mais>
          )}
        </>
      )}

      {aba === "primeira-infancia" && <AbaPrimeiraInfancia r={r} nivel={nivel} leitura={primeiraInfancia} />}

      {aba === "indicadores" && (r.indicadores ? <BlocosIndicadoresMunicipio r={r} destino={destino} /> : <SemIndicadores r={r} />)}

      {aba === "relatorio" && (
        <>
          <Secao id="mun-relatorio" titulo="O relatório completo" nota="Todas as abas numa peça só, com a fonte de cada número, para imprimir ou anexar.">
            <Mais>
              <LinkMapa href={`/mapa/municipio/${r.ibge}/relatorio`} className="pa-btn">
                Abrir o relatório para imprimir
              </LinkMapa>
              <a href={`/mapa/municipio/${r.ibge}/relatorio/csv`} className="pa-btn pa-btn-pequeno">
                Baixar os pontos do relatório (CSV)
              </a>
            </Mais>
          </Secao>
          <BlocoFontes r={r} />
        </>
      )}
    </div>
  );
}
