/**
 * O laudo de qualquer instrumento (onda 12): onde está, quanto tempo contra o típico, o dinheiro, os
 * riscos, a estratégia, o custo de não agir, o programa, o proponente, a emenda de origem e a próxima
 * porta aberta. Recebe a leitura pronta (lib/oportunidades/diagnostico.ts); aqui só se apresenta.
 *
 * Dois usos: a página inteira (`DiagnosticoConteudo`), para quem não tem dossiê da suspensiva; e o
 * complemento (`DiagnosticoComplemento`), que entra no fim do laudo da suspensiva quando há dossiê.
 */
import { urlEntidade } from "@/lib/oportunidades/pagina-entidade";
import { rotuloModalidade, urlDoMunicipio, urlInstrumento } from "@/lib/oportunidades/busca";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import {
  ROTULO_ETAPA_LAUDO,
  ROTULO_TIPO_EMENDA,
  cnpjLegivel,
  nivelMaisAlto,
  nomeProponente,
  type Diagnostico,
  type InstrumentoLaudo,
  type Vizinhanca,
} from "@/lib/oportunidades/diagnostico";
import { ROTULO_CANAL } from "@/lib/oportunidades/contrato-v2";
import { NOME_VERIFICACAO, ROTULO_DECISAO, urlMunicipioFiscal } from "@/lib/oportunidades/fiscal";
import { NIVEL_MOMENTO, ROTULO_FAIXA, ROTULO_MOMENTO, nomeFornecedor, urlFornecedor, type SecaoFornecedores } from "@/lib/oportunidades/fornecedores";
import type { Dossie, Nivel, Passo, Risco } from "@/lib/oportunidades/laudo";
import { classeEstado, rotuloItem, type ItemLaudo } from "@/lib/oportunidades/itens-laudo";
import { DIAS_JANELA_TEMPO, percentual } from "@/lib/oportunidades/painel";
import { tituloOrgao } from "@/lib/oportunidades/padroes";
import { rotuloDemaisPc33, secaoPc33 } from "@/lib/oportunidades/portaria33";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { descreverTce, tituloDebito, type SecaoTceTcu } from "@/lib/oportunidades/tce-tcu";
import { moedaContas, type SecaoContasObras } from "@/lib/oportunidades/contas-obras";
import { eloInstrumento, trilha } from "@/lib/oportunidades/trilha";
import { BotaoImprimir } from "../../../fiscal/[ibge]/simular/BotaoImprimir";
import { AnalistasSecao, DocumentosSecao, LinhaDoTempoSecao } from "./LaudoConteudo";
import { LinkMapa } from "../../../_componentes/LinkMapa";
import { Termo } from "../../../_componentes/Termo";
import { Trilha } from "../../../_componentes/Trilha";
import { TabelaRolagem } from "../../../_componentes/TabelaRolagem";

const aviso = (cliente: boolean) =>
  `Leitura automática dos dados abertos do Transferegov${cliente ? "" : " e do painel fiscal"}. Não substitui o termo, o parecer do ` +
  "concedente nem orientação jurídica: confira no Transferegov a situação, a vigência e as condições do instrumento antes de agir.";

const ROTULO_NIVEL: Record<Nivel, string> = { critico: "crítico", alto: "alto", moderado: "moderado", informativo: "informação" };

const n = (x: number) => x.toLocaleString("pt-BR");
const dias = (x: number) => `${n(x)} ${Math.abs(x) === 1 ? "dia" : "dias"}`;
const data = (iso: string | null | undefined) => (iso ? formatarData(iso) : "—");
const diasArredondados = (x: number) => dias(Math.round(x));

/**
 * `dossie`: a coleta do Acesso Livre no recorte da assinatura, para a lista de documentos.
 * `cliente`: a prefeitura vendo o laudo de um instrumento seu (onda 12, parte 3) — sem atalhos para
 * páginas de administrador, sem a lista de instrumentos de outros entes e sem o painel fiscal. Nome de
 * servidor e fornecedor já não chegam aqui (a página não os lê).
 */
export function DiagnosticoConteudo({
  d,
  i,
  referencia,
  hoje,
  dossie = null,
  cliente = false,
}: {
  d: Diagnostico;
  i: InstrumentoLaudo;
  referencia: string;
  hoje: string;
  dossie?: Dossie | null;
  cliente?: boolean;
}) {
  const municipio = i.municipio ? `${i.municipio}${i.uf ? `/${i.uf}` : ""}` : null;
  // O título é o proponente, link para a página da entidade (E1); a cidade vem logo abaixo.
  const titulo = i.proponente ? nomeProponente(i) : (municipio ?? "Proponente não informado");
  const t = d.tempo;

  return (
    <div className="pa-pagina mp-radar mp-laudo">
      <div className="pa-pilha mp-radar-cabeca">
        <Trilha
          elos={trilha(
            {
              uf: i.uf,
              municipio: i.cod_ibge || i.municipio ? { ibge: i.cod_ibge, nome: i.municipio } : null,
              entidade: { cnpj: i.cnpj, nome: i.proponente ? nomeProponente(i) : null },
            },
            eloInstrumento(i.nr_convenio, i.modalidade),
            "Laudo",
          )}
        />
        <p className="pa-kicker">
          Laudo do instrumento · {rotuloModalidade(i.modalidade) ?? "instrumento"} nº {i.nr_convenio}
        </p>
        <h1 className="pa-titulo">
          {i.cnpj ? (
            <LinkMapa href={urlEntidade(i.cnpj)}>
              {titulo}
            </LinkMapa>
          ) : (
            titulo
          )}
        </h1>
        {titulo !== municipio && municipio && <p className="pa-sub">{municipio}</p>}
        <p className="pa-sub">{i.programa ?? "Programa não informado"}</p>
        {i.objeto && <p className="pa-sub">{i.objeto}</p>}
        <p className="pa-sub">
          {i.orgao_sup ? tituloOrgao(i.orgao_sup) : "Órgão não informado"}
          {i.nr_proposta ? ` · proposta ${i.nr_proposta}` : ""}
          {` · situação: ${i.situacao ?? "sem situação registrada"}`}
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          <LinkMapa href={urlInstrumento(i.nr_convenio)} className="pa-btn pa-btn-pequeno">
            Abrir a página do convênio
          </LinkMapa>
          {d.fiscal && !cliente && (
            <LinkMapa href={urlMunicipioFiscal(d.fiscal.ibge)} className="pa-btn pa-btn-pequeno">
              Abrir o painel fiscal do município
            </LinkMapa>
          )}
        </p>
        <p className="mp-fiscal-aviso">{aviso(cliente)}</p>
      </div>

      <section aria-labelledby="diag-frase" className="mp-radar-secao">
        <h2 id="diag-frase" className="mp-radar-h2">
          Onde está
        </h2>
        <div className={`pa-cartao mp-laudo-frase mp-laudo-${nivelMaisAlto(d.riscos)}`}>
          <p>
            <strong>{d.rotuloEtapa}</strong>
            {d.vez ? ` · a vez é do ${d.vez === "concedente" ? "concedente" : "proponente"}` : ""}
          </p>
          <p>{d.frase}</p>
          {d.acessoLivre && <p>{d.acessoLivreVazio ?? d.acessoLivre.vez.frase}</p>}
        </div>
      </section>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <article className="pa-cartao">
          <h2 className="pa-mono">{t ? "Nesta etapa há" : "Assinado em"}</h2>
          <p className="pa-numero">{t ? (t.dias !== null ? dias(t.dias) : "—") : data(i.dt_assinatura)}</p>
          <p className="pa-nota">
            {!t
              ? ROTULO_ETAPA_LAUDO[d.etapa].toLowerCase()
              : t.dias === null
                ? `o histórico não registra ${t.marco}`
                : t.base
                  ? `desde ${t.marco} (${data(t.desde)}) · ${t.base.rotulo}: metade em até ${diasArredondados(t.base.mediana)}; 9 em cada 10, em até ${diasArredondados(t.base.p90)}`
                  : `desde ${t.marco} (${data(t.desde)}) · poucos casos para comparar`}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Repasse</h2>
          <p className="pa-numero">{moedaCurta(d.dinheiro.repasse)}</p>
          <p className="pa-nota">
            {d.dinheiro.desembolsado
              ? `desembolsado ${moedaCurta(d.dinheiro.desembolsado)} (${percentual(d.dinheiro.pctDesembolsado)})` +
                (d.dinheiro.saldoConta ? ` · em conta ${moedaCurta(d.dinheiro.saldoConta)}` : "")
              : `nada desembolsado${d.dinheiro.empenhado ? ` · empenhado ${moedaCurta(d.dinheiro.empenhado)}` : ""}`}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Vigência</h2>
          <p className="pa-numero">{data(d.vigencia.data)}</p>
          <p className="pa-nota">
            {d.vigencia.dias === null
              ? "sem vigência informada"
              : d.vigencia.dias < 0
                ? `vencida há ${dias(-d.vigencia.dias)}`
                : d.vigencia.dias === 0
                  ? "vence hoje"
                  : `faltam ${dias(d.vigencia.dias)}`}
            {d.vigencia.original ? ` · a original era ${data(d.vigencia.original)}` : ""}
          </p>
        </article>
        <CartaoQuarto d={d} />
      </div>

      {t && t.comparacoes.length > 0 && (
        <section aria-labelledby="diag-tempo" className="mp-radar-secao">
          <h2 id="diag-tempo" className="mp-radar-h2">
            O tempo nesta etapa, contra quem já passou por ela
          </h2>
          <TabelaRolagem rotuloId="diag-tempo">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Comparado com</th>
                  <th scope="col" className="mp-num">
                    Metade leva até
                  </th>
                  <th scope="col" className="mp-num">
                    9 em cada 10, até
                  </th>
                  <th scope="col" className="mp-num">
                    Medições
                  </th>
                  <th scope="col" className="mp-num">
                    Nesta etapa agora
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.comparacoes.map((c) => (
                  <tr key={c.rotulo}>
                    <th scope="row">{c.rotulo}</th>
                    <td className="mp-num">{diasArredondados(c.mediana)}</td>
                    <td className="mp-num">{diasArredondados(c.p90)}</td>
                    <td className="mp-num">{n(c.n)}</td>
                    <td className="mp-num">
                      {n(c.emAberto)}
                      {c.idadeAberto !== null && c.emAberto > 0 && <span className="mp-tabela-secundario">há {diasArredondados(c.idadeAberto)} (mediana)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
          <p className="pa-nota">
            Etapa «{t.rotulo}». Este instrumento: {t.dias !== null ? `${dias(t.dias)} desde ${t.marco}, contados até ${data(hoje)}` : "sem data de início"}. A metade e o “9 em
            cada 10” vêm das etapas que terminaram nos últimos {Math.round(DIAS_JANELA_TEMPO / 365)} anos; “nesta etapa agora” conta quem ainda não saiu dela.
          </p>
        </section>
      )}

      <Riscos riscos={d.riscos} titulo="Riscos" id="diag-riscos" />
      <Passos passos={d.estrategia} titulo="Estratégia de ação" id="diag-estrategia" />

      {d.inacao.length > 0 && (
        <section aria-labelledby="diag-inacao" className="mp-radar-secao">
          <h2 id="diag-inacao" className="mp-radar-h2">
            Se nada for feito
          </h2>
          <ul className="pa-cartao pa-cartao-plano mp-laudo-inacao">
            {d.inacao.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      <Cruzamentos d={d} i={i} cliente={cliente} />

      {/* Os registros dos requisitos para celebração, como no laudo da suspensiva: depois da leitura, antes da fonte. */}
      {d.acessoLivre && d.acessoLivre.linha.length > 0 && (
        <>
          <LinhaDoTempoSecao linha={d.acessoLivre.linha} proponente="proponente" />
          <AnalistasSecao analistas={d.acessoLivre.analistas} />
          {dossie && <DocumentosSecao documentos={d.acessoLivre.documentos} lista={dossie.documentos} hoje={hoje} />}
        </>
      )}

      <section aria-labelledby="diag-fonte" className="mp-radar-secao">
        <h2 id="diag-fonte" className="mp-radar-h2">
          Fonte e método
        </h2>
        <ul className="mp-laudo-causas mp-laudo-miudo">
          <FontesDiagnostico d={d} referencia={referencia} hoje={hoje} />
        </ul>
        {i.cod_ibge && (
          <p className="pa-nota mp-nao-imprimir">
            <LinkMapa href={urlDoMunicipio(i.cod_ibge, "dinheiro")}>
              Ver os outros investimentos {i.municipio ? `em ${i.municipio}` : "neste município"}
            </LinkMapa>
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * O que o diagnóstico acrescenta ao laudo da suspensiva: outros riscos e frentes (liminar, fiscal,
 * carteira, emenda), o programa, o proponente e as janelas abertas. Entra antes da "Fonte e método" de lá.
 */
export function DiagnosticoComplemento({ d, i, cliente = false }: { d: Diagnostico; i: InstrumentoLaudo; cliente?: boolean }) {
  return (
    <>
      <Riscos riscos={d.riscos} titulo="Outros riscos do instrumento" id="diag-outros-riscos" />
      <Passos
        passos={d.estrategia}
        titulo="Outras frentes"
        id="diag-outras-frentes"
        nota="Frentes que andam junto com a retirada da suspensiva, tiradas do programa, do proponente e da origem do dinheiro."
      />
      <Cruzamentos d={d} i={i} cliente={cliente} />
    </>
  );
}

/** As linhas de método do diagnóstico, para a lista da "Fonte e método" (de cá ou do laudo da suspensiva). */
export function FontesDiagnostico({ d, referencia, hoje }: { d: Diagnostico; referencia: string; hoje: string }) {
  return (
    <>
      <li>
        Instrumento, valores, datas e situação: dados abertos do Transferegov (SICONV) de {data(referencia)}; prazos contados até {data(hoje)}.
      </li>
      <li>
        Tempo na etapa: marcos do histórico da proposta (envio, aprovação do plano de trabalho, assinatura, 1º desembolso), comparados com as
        etapas que terminaram nos últimos {Math.round(DIAS_JANELA_TEMPO / 365)} anos no mesmo programa e no mesmo órgão, na UF e no Brasil. Com
        menos de 10 medições, a comparação não é feita.
      </li>
      <li>
        Programa: na UF, todos os instrumentos da base do Mapa (na PB, a base tem todos); no Brasil, as propostas enviadas desde 2019 — fora da PB a base só
        tem os instrumentos vivos, e contá-los esconderia os que ficaram pelo caminho.
      </li>
      {d.proponente && <li>Proponente: os instrumentos do mesmo CNPJ na base do Mapa (todos, se o proponente é da PB; fora dela, só os vivos).</li>}
      <li>Emenda de origem: arquivo de emendas do SICONV, ligado pela proposta. O autor é agente público e aparece como registrado.</li>
      {d.fiscal && <li>Situação fiscal: painel de capacidade fiscal, decisão “receber transferência voluntária”, de {data(d.fiscal.referencia)}.</li>}
      {d.contasObras && (
        <li>
          Prestação de contas e obra: coletas assistidas no Acesso Livre do Transferegov (a tela da prestação de contas, com os eventos
          SIAFI e os pareceres, e o módulo de acompanhamento de obras). Não estão nos dados abertos.
        </li>
      )}
      {d.tceTcu && (
        <li>
          Tomada de Contas Especial: API pública do e-TCE do TCU, uma consulta por convênio, toda semana, para os convênios assinados da PB. A
          resposta não traz responsável.
        </li>
      )}
      {d.fornecedores && (
        <li>
          Fornecedores: pagamentos, contratos (ligados pela licitação) e empenhos do SICONV. Pessoa física entra só somada, sem nome; o que vai
          para a conta do próprio convenente ou do executor não é fornecedor. O “no TCE-PB” casa o pagamento com as despesas do município no
          TCE-PB pelo CNPJ e pelo ano (o TCE-PB não traz o número do convênio). A marca de inidôneo é a lista do TCU no dia do painel
          {d.fornecedores.tcuVerificado ? "" : " (não lida nesta execução: sem marca não quer dizer fora da lista)"}. Concentração é indicador
          para olhar, não irregularidade.
        </li>
      )}
      <li>Janelas abertas: catálogo de oportunidades, filtrado pelo tipo de proponente e pela UF; entram as do mesmo programa ou do mesmo órgão concedente.</li>
      {d.acessoLivre && (
        <li>
          Requisitos para celebração: tela do Acesso Livre do Transferegov, colhida em{" "}
          {d.acessoLivre.coletadoEm ? formatarPublicacao(d.acessoLivre.coletadoEm) : "data desconhecida"}, com os instrumentos da PB aprovados e não
          assinados. O tempo parado conta até essa coleta; “atendido” é o rótulo que o concedente registrou, não uma conclusão deste laudo.
        </li>
      )}
      {d.faltas.length > 0 && <li>Não vieram nesta leitura: {d.faltas.join(", ")}. O laudo saiu sem esses cruzamentos.</li>}
    </>
  );
}

function CartaoQuarto({ d }: { d: Diagnostico }) {
  if (d.fiscal?.conclusao) {
    const c = d.fiscal.conclusao;
    return (
      <article className="pa-cartao">
        <h2 className="pa-mono">Transferência voluntária</h2>
        <p className="pa-numero">{ROTULO_DECISAO[c.estado]}</p>
        <p className="pa-nota">
          {c.bloqueantes.length ? `bloqueia: ${c.bloqueantes.map((g) => NOME_VERIFICACAO[g] ?? g).join(", ")} · ` : ""}
          painel fiscal de {data(d.fiscal.referencia)}
        </p>
      </article>
    );
  }
  if (d.emendas.length) {
    const total = d.emendas.reduce((s, e) => s + (e.valor ?? 0), 0);
    const autores = [...new Set(d.emendas.map((e) => e.parlamentar).filter((x): x is string => !!x))];
    return (
      <article className="pa-cartao">
        <h2 className="pa-mono">Emenda de origem</h2>
        <p className="pa-numero">{moedaCurta(total)}</p>
        <p className="pa-nota">{autores.length ? autores.join(", ") : `${n(d.emendas.length)} emenda(s) sem autor informado`}</p>
      </article>
    );
  }
  return (
    <article className="pa-cartao">
      <h2 className="pa-mono">Contrapartida</h2>
      <p className="pa-numero">{moedaCurta(d.dinheiro.contrapartida ?? 0)}</p>
      <p className="pa-nota">
        {d.dinheiro.pctContrapartida !== null
          ? `ingressada ${moedaCurta(d.dinheiro.contrapartidaIngressada)} (${percentual(d.dinheiro.pctContrapartida)})`
          : d.dinheiro.contrapartida
            ? "ingresso não informado"
            : "sem contrapartida financeira"}
      </p>
    </article>
  );
}

function Riscos({ riscos, titulo, id }: { riscos: Risco[]; titulo: string; id: string }) {
  if (!riscos.length) return null;
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
      </h2>
      <ul className="mp-laudo-lista">
        {riscos.map((r) => (
          <li key={r.titulo} className={`pa-cartao mp-laudo-risco mp-laudo-${r.nivel}`}>
            <p>
              <span className={`pa-tag mp-laudo-nivel mp-laudo-${r.nivel}`}>{ROTULO_NIVEL[r.nivel]}</span> <strong>{r.titulo}</strong>
            </p>
            <p>{r.fato}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Passos({
  passos,
  titulo,
  id,
  nota = "Na ordem em que convém fazer. Cada passo diz o porquê, com a data e o registro que o sustentam.",
}: {
  passos: Passo[];
  titulo: string;
  id: string;
  nota?: string;
}) {
  if (!passos.length) return null;
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
      </h2>
      <p className="pa-nota">{nota}</p>
      <ol className="mp-simulador-caminho">
        {passos.map((p) => (
          <li key={p.titulo} className="pa-cartao mp-simulador-passo">
            <p>
              <strong>{p.titulo}</strong>
            </p>
            <p>{p.porque}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Programa, proponente, emenda de origem e janelas abertas: o que cerca o instrumento. No laudo do
 * cliente, o programa sai só em números: sem a lista dos instrumentos de outros entes.
 */
function Cruzamentos({ d, i, cliente = false }: { d: Diagnostico; i: InstrumentoLaudo; cliente?: boolean }) {
  const pr = d.programa;
  const brasil = pr?.funis.find((f) => f.recorte === "BR");
  return (
    <>
      {pr && (pr.naUf || pr.funis.length > 0) && (
        <section aria-labelledby="diag-programa" className="mp-radar-secao">
          <h2 id="diag-programa" className="mp-radar-h2">
            O programa
          </h2>
          <p className="pa-nota">
            {pr.nome ?? "Programa sem nome"}
            {pr.codigo ? ` · código ${pr.codigo}` : ""}
          </p>
          {pr.naUf && <Distribuicao v={pr.naUf} rotulo={`Na ${pr.uf}`} etapa={d.etapa} semNumeros={cliente} />}
          {pr.funis.length > 0 && (
            <TabelaRolagem rotulo="Propostas enviadas desde 2019 e o que aconteceu com elas">
              <table className="mp-tabela">
                <caption className="mp-laudo-legenda-tabela">Propostas enviadas desde 2019 e o que aconteceu com elas</caption>
                <thead>
                  <tr>
                    <th scope="col">Onde</th>
                    <th scope="col" className="mp-num">
                      Enviadas
                    </th>
                    <th scope="col" className="mp-num">
                      Assinadas
                    </th>
                    <th scope="col" className="mp-num">
                      Esperando assinatura
                    </th>
                    <th scope="col" className="mp-num">
                      Em análise
                    </th>
                    <th scope="col" className="mp-num">
                      Negadas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pr.funis.map((f) => (
                    <tr key={f.recorte}>
                      <th scope="row">{f.recorte === "BR" ? "Brasil" : f.recorte}</th>
                      <td className="mp-num">{n(f.enviadas)}</td>
                      <td className="mp-num">{n(f.assinadas)}</td>
                      <td className="mp-num">{n(f.aguardando)}</td>
                      <td className="mp-num">{n(f.abertas)}</td>
                      <td className="mp-num">{n(f.negadas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaRolagem>
          )}
          {brasil && brasil.enviadas > 0 && (
            <p className="pa-nota">
              No Brasil, {percentual(brasil.assinadas / brasil.enviadas)} das propostas do programa enviadas desde 2019 já foram assinadas.
            </p>
          )}
        </section>
      )}

      {d.proponente && d.proponente.carteira.total > 1 && (
        <section aria-labelledby="diag-proponente" className="mp-radar-secao">
          <h2 id="diag-proponente" className="mp-radar-h2">
            O proponente
          </h2>
          <p className="pa-nota">
            {nomeProponente(i)}
            {d.proponente.cnpj ? ` · CNPJ ${cnpjLegivel(d.proponente.cnpj)}` : ""}
            {d.proponente.cnpj && (
              <>
                {" · "}
                <LinkMapa href={urlEntidade(d.proponente.cnpj)}>
                  abrir a página da entidade
                </LinkMapa>
              </>
            )}
          </p>
          <Distribuicao v={d.proponente.carteira} rotulo="Instrumentos do proponente" etapa={d.etapa} />
        </section>
      )}

      {d.emendas.length > 0 && (
        <section aria-labelledby="diag-emenda" className="mp-radar-secao">
          <h2 id="diag-emenda" className="mp-radar-h2">
            De onde veio o dinheiro
          </h2>
          <TabelaRolagem rotuloId="diag-emenda">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Emenda</th>
                  <th scope="col">Autor</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="mp-num">
                    Valor indicado
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.emendas.map((e) => (
                  <tr key={e.nr_emenda}>
                    <th scope="row">{e.nr_emenda}</th>
                    <td>{e.parlamentar ?? "—"}</td>
                    <td>
                      {e.tipo_parlamentar ? (ROTULO_TIPO_EMENDA[e.tipo_parlamentar] ?? e.tipo_parlamentar.toLowerCase()) : "—"}
                      {e.impositiva ? " · impositiva" : ""}
                    </td>
                    <td className="mp-num">{moedaCurta(e.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
          <p className="pa-nota">Emendas parlamentares ligadas à proposta, como registradas no SICONV.</p>
        </section>
      )}

      <DestinoDoDinheiro d={d} />

      <ExecucaoPc33 i={i} />
      <ContasNoTcu s={d.tceTcu} />
      <ContasEObra s={d.contasObras} cliente={cliente} />

      {!cliente && !d.fiscal && d.fiscalMotivo && (
        <section aria-labelledby="diag-fiscal" className="mp-radar-secao">
          <h2 id="diag-fiscal" className="mp-radar-h2">
            Situação fiscal
          </h2>
          <p className="pa-cartao pa-cartao-plano">{d.fiscalMotivo}</p>
        </section>
      )}

      {d.portas.length > 0 && (
        <section aria-labelledby="diag-portas" className="mp-radar-secao">
          <h2 id="diag-portas" className="mp-radar-h2">
            Janelas abertas para este proponente
          </h2>
          <ul className="mp-laudo-lista">
            {d.portas.map((p) => (
              <li key={p.id} className="pa-cartao">
                <p>
                  <span className="pa-tag">{p.mesmoPrograma ? "mesmo programa" : "mesmo órgão"}</span> <strong>{p.titulo}</strong>
                </p>
                <p className="mp-laudo-miudo">
                  {tituloOrgao(p.financiador)} ·{" "}
                  {p.prazo
                    ? `até ${data(p.prazo)}${p.diasRestantes === 0 ? " (fecha hoje)" : p.diasRestantes !== null ? ` (faltam ${dias(p.diasRestantes)})` : ""}`
                    : "sem prazo informado"}
                  {p.codigos.length ? ` · código ${p.codigos.join(", ")}` : ""}
                  {p.canal && p.canal !== "voluntaria" ? ` · ${ROTULO_CANAL[p.canal].toLowerCase()}` : ""} ·{" "}
                  <a href={p.fonteUrl} target="_blank" rel="noopener noreferrer">
                    {p.fonteNome}
                    <span className="pa-sr"> (abre em nova aba)</span>
                  </a>
                </p>
              </li>
            ))}
          </ul>
          <p className="pa-nota">
            Do catálogo de janelas, filtradas pelo tipo de proponente e pela UF; entram as do mesmo programa e as do mesmo órgão concedente.
          </p>
        </section>
      )}
    </>
  );
}

/** Quantos instrumentos em cada etapa, e os outros na mesma etapa deste, com o número (menos com `semNumeros`). */
function Distribuicao({
  v,
  rotulo,
  etapa,
  semNumeros = false,
}: {
  v: Vizinhanca;
  rotulo: string;
  etapa: Diagnostico["etapa"];
  semNumeros?: boolean;
}) {
  const mostrados = semNumeros ? [] : v.mesmaEtapa.numeros.slice(0, 12);
  return (
    <>
      <TabelaRolagem rotulo={`${rotulo}: ${n(v.total)} (${moedaCurta(v.valor)} de repasse)`}>
        <table className="mp-tabela">
          <caption className="mp-laudo-legenda-tabela">
            {rotulo}: {n(v.total)} ({moedaCurta(v.valor)} de repasse)
          </caption>
          <thead>
            <tr>
              <th scope="col">Etapa</th>
              <th scope="col" className="mp-num">
                Instrumentos
              </th>
              <th scope="col" className="mp-num">
                Repasse
              </th>
            </tr>
          </thead>
          <tbody>
            {v.porEtapa.map((c) => (
              <tr key={c.etapa}>
                <th scope="row">
                  {ROTULO_ETAPA_LAUDO[c.etapa]}
                  {c.etapa === etapa ? " · a deste" : ""}
                </th>
                <td className="mp-num">{n(c.n)}</td>
                <td className="mp-num">{moedaCurta(c.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaRolagem>
      {mostrados.length > 0 && (
        <p className="pa-nota">
          Na mesma etapa: {mostrados.map((nr, k) => (
            <span key={nr}>
              {k > 0 ? ", " : ""}
              <LinkMapa href={urlInstrumento(nr)}>nº {nr}</LinkMapa>
            </span>
          ))}
          {v.mesmaEtapa.numeros.length > mostrados.length ? ` e mais ${n(v.mesmaEtapa.numeros.length - mostrados.length)}` : ""}.
        </p>
      )}
    </>
  );
}

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`);
function Periodo({ de, ate }: { de: string; ate: string | null }) {
  if (!ate || ate === de) return <span className="mp-nowrap">em {data(de)}</span>;
  return (
    <>
      <span className="mp-nowrap">de {data(de)}</span> <span className="mp-nowrap">a {data(ate)}</span>
    </>
  );
}

/**
 * Para onde foi o dinheiro (onda 12, parte 3): empenho por natureza, depósitos da contrapartida, ponto da
 * obra, as empresas que receberam, os contratos e a concentração nos convênios da prefeitura. As empresas
 * só entram quando há leitura de fornecedores (PB e administrador).
 */
/**
 * Onda 13B: a execução pela Portaria Conjunta 33/2023, na redação da época, item a item (o job grava pronto).
 * Entra também no laudo do cliente: não tem nome de pessoa.
 */
function ExecucaoPc33({ i }: { i: InstrumentoLaudo }) {
  const s = secaoPc33(i);
  if (!s) return null;
  return (
    <section aria-labelledby="diag-pc33" className="mp-radar-secao">
      <h2 id="diag-pc33" className="mp-radar-h2">
        Execução pela norma de convênios
      </h2>
      <p className="pa-sub">{s.rotulo}</p>
      {s.abertura && <p className="pa-nota">{s.abertura.fato}</p>}
      {s.conferir.length > 0 && (
        <ul className="mp-laudo-lista">
          {s.conferir.map((x) => (
            <ItemPc33 key={x.item} x={x} />
          ))}
        </ul>
      )}
      {s.demais.length > 0 && (
        <details className="mp-fiscal-detalhe" open={s.conferir.length === 0}>
          <summary>{rotuloDemaisPc33(s.demais.length, s.conferir.length > 0)}</summary>
          <ul className="mp-laudo-lista">
            {s.demais.map((x) => (
              <ItemPc33 key={x.item} x={x} />
            ))}
          </ul>
        </details>
      )}
      <p className="pa-nota">
        Conferido pela <Termo slug="pc-33">Portaria Conjunta 33/2023</Termo> ou pela norma da época, nos dados abertos do Transferegov (cronograma de
        desembolso, metas, plano de aplicação, histórico do projeto, desembolsos, pagamentos e contrapartida). Ponto{" "}
        <Termo slug="ponto-a-conferir">a conferir</Termo> é para olhar, não irregularidade: a exceção pode estar justificada fora dos dados abertos.
      </p>
    </section>
  );
}

/**
 * Prestação de contas e obra pelas coletas do Acesso Livre (onda 13C.2 e 13C.3). O nome do servidor que deu o
 * parecer só aparece para administrador.
 */
function ContasEObra({ s, cliente }: { s: SecaoContasObras | null; cliente: boolean }) {
  if (!s) return null;
  const p = s.prestacao;
  const o = s.obra;
  return (
    <section aria-labelledby="diag-contas-obra" className="mp-radar-secao">
      <h2 id="diag-contas-obra" className="mp-radar-h2">
        Prestação de contas e obra no Transferegov
      </h2>
      {p && (
        <>
          <p className="pa-sub">{p.frase}</p>
          {p.cumprimento && <p className="pa-nota">{p.cumprimento}</p>}
          {p.eventos.length > 0 && (
            <TabelaRolagem rotuloId="diag-contas-obra">
              <table className="mp-tabela">
                <thead>
                  <tr>
                    <th scope="col">Evento no SIAFI (sistema financeiro da União)</th>
                    <th scope="col">Data</th>
                    <th scope="col" className="mp-num">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.eventos.map((e) => (
                    <tr key={e.ordem}>
                      <td>
                        {e.evento ?? "—"}
                        {e.situacao && e.situacao !== "Enviada" ? <span className="mp-laudo-miudo"> · {e.situacao}</span> : null}
                      </td>
                      <td>{e.data_hora ? formatarData(e.data_hora.slice(0, 10)) : "—"}</td>
                      <td className="mp-num">{e.valor !== null ? moedaContas(e.valor) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaRolagem>
          )}
          {p.pareceres.length > 0 && (
            <ul className="mp-laudo-lista">
              {p.pareceres.slice(0, 5).map((x) => (
                <li key={x.ordem} className="pa-cartao mp-laudo-risco mp-laudo-informativo">
                  <p>
                    <strong>
                      Parecer {x.tipo ? x.tipo.toLowerCase() : ""} de {x.data ? formatarData(x.data) : "—"}
                    </strong>
                    {x.situacao ? ` · ${x.situacao}` : ""}
                  </p>
                  {x.texto && <p>{x.texto.length > 600 ? `${x.texto.slice(0, 600)}…` : x.texto}</p>}
                  <p className="mp-laudo-miudo">
                    {[x.emitido_por, !cliente ? x.responsavel : null, !cliente ? x.atribuicao : null].filter(Boolean).join(" · ")}
                    {x.n_anexos ? ` · ${x.n_anexos} ${x.n_anexos === 1 ? "anexo" : "anexos"} no Transferegov` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {o && (
        <>
          <p className="pa-sub">{o.frase}</p>
          {o.atestado && <p className="pa-nota">{o.atestado}</p>}
        </>
      )}
      <p className="pa-nota">
        Coletado no Acesso Livre do Transferegov
        {p?.referencia ? ` (prestação de contas em ${formatarData(p.referencia)}` : ""}
        {o?.referencia ? `${p?.referencia ? "; " : " ("}acompanhamento de obras em ${formatarData(o.referencia)}` : ""}
        {p?.referencia || o?.referencia ? ")" : ""}.
        {p ? " Impugnação é o concedente recusando parte da comprovação, não julgamento; o texto completo dos pareceres fica nos anexos do Transferegov." : ""}
        {o ? " O atestado da obra é o executado que cada lado registrou nas medições." : ""}
      </p>
    </section>
  );
}

/** Tomada de Contas Especial no e-TCE do TCU (onda 13C). Sem nome de responsável: também para o cliente. */
function ContasNoTcu({ s }: { s: SecaoTceTcu | null }) {
  if (!s) return null;
  return (
    <section aria-labelledby="diag-tce-tcu" className="mp-radar-secao">
      <h2 id="diag-tce-tcu" className="mp-radar-h2">
        Tomada de Contas Especial
      </h2>
      <p className="pa-sub">{s.frase}</p>
      {s.tces.length > 0 && (
        <ul className="mp-laudo-lista">
          {s.tces.map((t, k) => (
            <li key={`${t.codigo ?? k}`} className="pa-cartao mp-laudo-risco mp-laudo-critico">
              <p>
                <span className="pa-tag mp-laudo-nivel mp-laudo-critico">{t.situacao ?? "tomada de contas especial"}</span>{" "}
                <strong>{tituloDebito(t)}</strong>
              </p>
              <p>{descreverTce(t)}</p>
              {(t.submotivo || t.parecer_controle_interno) && (
                <p className="mp-laudo-miudo">
                  {[t.submotivo ? `Detalhe do motivo: ${t.submotivo}.` : null, t.parecer_controle_interno ? `Controle interno: ${t.parecer_controle_interno}.` : null]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              )}
              {(t.numero_processo || t.numero_acordao) && (
                <p className="mp-laudo-miudo">
                  {t.numero_processo &&
                    (t.url_processo ? (
                      <a href={t.url_processo} target="_blank" rel="noopener noreferrer">
                        Processo TC {t.numero_processo} no TCU
                        <span className="pa-sr"> (abre em nova aba)</span>
                      </a>
                    ) : (
                      `Processo TC ${t.numero_processo} no TCU`
                    ))}
                  {t.numero_acordao ? ` · acórdão ${t.numero_acordao}${t.origem_acordao ? ` (${t.origem_acordao})` : ""}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="pa-nota">
        Fonte: API pública do sistema e-TCE do Tribunal de Contas da União, consultada toda semana para os convênios assinados da PB. A aba
        &quot;TCE&quot; do convênio no Transferegov fica vazia mesmo quando há tomada de contas especial, porque o processo hoje corre no e-TCE.{" "}
        <Termo slug="tomada-de-contas-especial">Tomada de contas especial</Termo> instaurada é o órgão apurando dano; quem julga é o TCU, e
        &quot;processo autuado&quot; não é condenação.
      </p>
    </section>
  );
}

function ItemPc33({ x }: { x: ItemLaudo }) {
  return (
    <li className={`pa-cartao mp-laudo-risco ${classeEstado(x)}`}>
      <p>
        <span className={`pa-tag mp-laudo-nivel ${classeEstado(x)}`}>{rotuloItem(x)}</span> <strong>{x.titulo}</strong>
      </p>
      <p>
        {x.fato} <span className="mp-laudo-miudo">({x.dispositivo})</span>
      </p>
    </li>
  );
}

function DestinoDoDinheiro({ d }: { d: Diagnostico }) {
  const f = d.fornecedores;
  const din = d.dinheiro;
  const temEmpenho = din.empenhadoCorrente !== null || din.empenhadoCapital !== null;
  if (!f && !temEmpenho && !din.ingressos && !d.coordenada) return null;
  const m = f?.municipio;
  const recebedores = f ? f.linhas.filter((l) => l.pago > 0).length : 0;
  return (
    <section aria-labelledby="diag-destino" className="mp-radar-secao">
      <h2 id="diag-destino" className="mp-radar-h2">
        Para onde foi o dinheiro
      </h2>
      <ul className="pa-cartao pa-cartao-plano mp-laudo-inacao">
        {f && (
          <li>
            Pago a empresas: {moedaCurta(f.pagoPj ?? 0)}
            {recebedores ? ` (${n(recebedores)} ${recebedores === 1 ? "fornecedor" : "fornecedores"})` : ""}
            {f.pagoPf ? ` · a pessoas físicas ou sem CNPJ: ${moedaCurta(f.pagoPf)} em ${n(f.nPagamentosPf ?? 0)} pagamentos, sem nome` : ""}
            {f.pagoConvenente ? ` · à conta do próprio convenente ou do executor: ${moedaCurta(f.pagoConvenente)}` : ""}.
          </li>
        )}
        {temEmpenho && (
          <li>
            Empenhado:{" "}
            {[
              din.empenhadoCapital ? `${moedaCurta(din.empenhadoCapital)} em investimento (capital)` : null,
              din.empenhadoCorrente ? `${moedaCurta(din.empenhadoCorrente)} em despesa corrente` : null,
            ]
              .filter(Boolean)
              .join(" e ") || "saldo zero depois das anulações"}
            , pelos empenhos do SICONV.
          </li>
        )}
        {din.ingressos && (
          <li>
            Contrapartida depositada{" "}
            {din.ingressos.n === 1
              ? `em ${data(din.ingressos.primeiro)}`
              : `${n(din.ingressos.n)} vezes, de ${data(din.ingressos.primeiro)} a ${data(din.ingressos.ultimo)}`}
            {din.contrapartidaIngressada !== null ? ` (${moedaCurta(din.contrapartidaIngressada)} no total)` : ""}.
          </li>
        )}
        {d.coordenada && (
          <li>
            Ponto da obra no SICONV: {d.coordenada.latitude.toLocaleString("pt-BR", { maximumFractionDigits: 5 })};{" "}
            {d.coordenada.longitude.toLocaleString("pt-BR", { maximumFractionDigits: 5 })}
            <span className="mp-nao-imprimir">
              {" · "}
              <a
                href={`https://www.openstreetmap.org/?mlat=${d.coordenada.latitude}&mlon=${d.coordenada.longitude}#map=17/${d.coordenada.latitude}/${d.coordenada.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                ver no mapa
                <span className="pa-sr"> (abre o OpenStreetMap em nova aba)</span>
              </a>
            </span>
            .
          </li>
        )}
      </ul>

      {f && f.linhas.length > 0 && <TabelaFornecedores f={f} />}
      {f && f.contratos.length > 0 && <TabelaContratos f={f} />}

      {m && m.faixa !== "pouco_dado" && (
        <p className={`pa-cartao pa-cartao-plano${m.faixa === "alta" ? " mp-laudo-informativo" : ""}`}>
          Nos convênios federais da prefeitura de {m.municipio ?? "este município"}, {n(m.n_fornecedores)} fornecedores receberam{" "}
          {moedaCurta(m.pago_pj)}. O maior, {nomeFornecedor({ nome: m.maior_nome, cnpj: m.maior_cnpj })}, levou {pct(m.maior_fatia)} (índice de
          concentração {m.hhi !== null ? m.hhi.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}: {ROTULO_FAIXA[m.faixa]}).
          {m.nesteConvenio ? " Ele também é fornecedor deste convênio." : ""} É um indicador para olhar, não uma irregularidade.
        </p>
      )}
    </section>
  );
}

function TabelaFornecedores({ f }: { f: SecaoFornecedores }) {
  return (
    <TabelaRolagem rotulo="Empresas que receberam ou foram contratadas neste convênio">
      <table className="mp-tabela">
        <caption className="mp-laudo-legenda-tabela">Empresas que receberam ou foram contratadas neste convênio</caption>
        <thead>
          <tr>
            <th scope="col">Empresa</th>
            <th scope="col" className="mp-num">
              Recebeu aqui
            </th>
            <th scope="col">Pagamentos</th>
            <th scope="col" className="mp-num">
              Contratado
            </th>
            <th scope="col" className="mp-num">
              Na PB
            </th>
          </tr>
        </thead>
        <tbody>
          {f.linhas.map((l) => (
            <tr key={l.cnpj}>
              <th scope="row">
                <LinkMapa href={urlFornecedor(l.cnpj)} className="mp-tabela-principal">
                  {l.nome}
                </LinkMapa>
                <span className="mp-tabela-secundario">
                  CNPJ {cnpjLegivel(l.cnpj)}
                  {l.mei ? " · MEI" : ""}
                </span>
                {l.tce && <span className="mp-tabela-secundario">{l.tce}</span>}
                {l.momento && (
                  <span className={`pa-tag mp-laudo-nivel mp-laudo-${NIVEL_MOMENTO[l.momento]}`}>inidôneo (TCU) · {ROTULO_MOMENTO[l.momento]}</span>
                )}
              </th>
              <td className="mp-num">
                {moedaCurta(l.pago)}
                {l.fatia !== null && l.pago > 0 && <span className="mp-tabela-secundario">{pct(l.fatia)} do pago a empresas</span>}
              </td>
              <td>
                {l.nPagamentos > 0 ? n(l.nPagamentos) : "nenhum"}
                {l.primeiro && (
                  <span className="mp-tabela-secundario">
                    <Periodo de={l.primeiro} ate={l.ultimo} />
                  </span>
                )}
              </td>
              <td className="mp-num">
                {l.nContratos > 0 ? moedaCurta(l.contratado) : "—"}
                {l.nContratos > 1 && <span className="mp-tabela-secundario">{n(l.nContratos)} contratos</span>}
              </td>
              <td className="mp-num">
                {l.pbMunicipios !== null ? `${n(l.pbMunicipios)} ${l.pbMunicipios === 1 ? "município" : "municípios"}` : "—"}
                {l.pbConvenios !== null && (
                  <span className="mp-tabela-secundario">
                    {n(l.pbConvenios)} {l.pbConvenios === 1 ? "convênio" : "convênios"}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TabelaRolagem>
  );
}

function TabelaContratos({ f }: { f: SecaoFornecedores }) {
  return (
    <TabelaRolagem rotulo="Contratos do convênio">
      <table className="mp-tabela">
        <caption className="mp-laudo-legenda-tabela">Contratos do convênio</caption>
        <thead>
          <tr>
            <th scope="col">Contrato</th>
            <th scope="col">Objeto</th>
            <th scope="col" className="mp-num">
              Valor
            </th>
            <th scope="col">Vigência</th>
          </tr>
        </thead>
        <tbody>
          {f.contratos.map((c, k) => (
            <tr key={`${c.id_licitacao}-${c.id_contrato}-${k}`}>
              <th scope="row">
                nº {c.nr_contrato ?? c.id_contrato}
                <span className="mp-tabela-secundario">
                  {c.pessoa_fisica ? "pessoa física" : nomeFornecedor({ nome: c.fornecedor, cnpj: c.cnpj })}
                  {c.dt_assinatura ? ` · assinado em ${data(c.dt_assinatura)}` : ""}
                </span>
              </th>
              <td>
                {c.objeto ?? "—"}
                {c.tipo_aquisicao && <span className="mp-tabela-secundario">{c.tipo_aquisicao}</span>}
              </td>
              <td className="mp-num">{moedaCurta(c.valor)}</td>
              <td>{c.dt_inicio_vigencia || c.dt_fim_vigencia ? `${data(c.dt_inicio_vigencia)} a ${data(c.dt_fim_vigencia)}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TabelaRolagem>
  );
}
