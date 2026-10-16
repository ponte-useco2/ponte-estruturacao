/**
 * A sala da Associação Ilha Tech (reunião de 15/10/2026). Fatos públicos, cada um com a fonte; nenhuma leitura sobre
 * pessoas, nenhum ranking (decisão do titular, 14/10/2026). Os parlamentares abrem em ordem alfabética e as colunas de
 * valor filtram, mas não ordenam: regra das telas públicas desde a onda 15.
 *
 * Duas fontes: o retrato das emendas em `dados.ts` (Portal da Transparência, arquivo de 10/10/2026) e os programas
 * abertos a OSC na PB, lidos ao vivo da última rodada do radar de janelas (`lerProgramasParaOsc`).
 */
import type { ReactNode } from "react";
import { TabelaFiltravel } from "@/app/mapa/_componentes/TabelaFiltravel";
import { TabelaRolagem } from "@/app/mapa/_componentes/TabelaRolagem";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_CANAL_PROGRAMA, contarPorCanal, diasEntre, type ProgramaAberto } from "@/lib/oportunidades/sala-programas";
import type { LeituraProgramas } from "@/lib/oportunidades/sala.server";
import type { ColunaTabela, LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import {
  CAMINHO_ESTADUAL,
  CIENCIA_E_TECNOLOGIA,
  DADOS_DA_API_PB,
  DEPUTADOS_ESTADUAIS_OSC,
  ENVIO_DAS_INDICACOES,
  ESTADUAIS_POR_ANO,
  ESTADUAIS_POR_ORGAO,
} from "./dados-estaduais";
import {
  DADOS_DO_PORTAL, F, MARCOS, MINISTERIOS_CITADOS, MINISTERIOS_OSC, PARLAMENTARES, PREPARADO_EM, REQUISITOS,
  type Fonte, type Marco,
} from "./dados";

const n = (x: number) => x.toLocaleString("pt-BR");
const dinheiro = (v: number) => (v > 0 ? moedaCurta(v) : "—");
const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function LinkFonte({ fonte, children }: { fonte: Fonte; children?: ReactNode }) {
  return (
    <a href={fonte.url} target="_blank" rel="noopener noreferrer">
      {children ?? fonte.rotulo}
      <span className="pa-sr"> (abre em nova aba)</span>
    </a>
  );
}

function Prazo({ marco, hoje }: { marco: Marco; hoje: string }) {
  const fim = diasEntre(hoje, marco.ate);
  const inicio = marco.de ? diasEntre(hoje, marco.de) : null;
  let rotulo: string;
  let tom: "passou" | "agora" | "breve" | "adiante";
  if (fim < 0) {
    rotulo = "encerrado";
    tom = "passou";
  } else if (inicio !== null && inicio > 0) {
    rotulo = inicio === 1 ? "começa amanhã" : `começa em ${inicio} dias`;
    tom = inicio <= 7 ? "breve" : "adiante";
  } else if (fim === 0) {
    rotulo = "termina hoje";
    tom = "agora";
  } else {
    rotulo = fim === 1 ? "falta 1 dia" : `faltam ${fim} dias`;
    tom = fim <= 7 ? "agora" : "breve";
  }
  return <span className={`sl-prazo sl-prazo-${tom}`}>{rotulo}</span>;
}

const VALE: Record<Marco["vale"], string> = { osc: "vale para OSC", entes: "só municípios e estados", todos: "vale para todos" };

// ---------------------------------------------------------------- tabelas

const COLUNAS_PROGRAMAS: ColunaTabela[] = [
  { id: "programa", titulo: "Programa", tipo: "texto" },
  { id: "ministerio", titulo: "Órgão", tipo: "categoria" },
  { id: "canal", titulo: "Como propor", tipo: "categoria" },
  { id: "codigo", titulo: "Código no Transferegov", tipo: "texto", textoNoCsv: true },
  { id: "abre", titulo: "Abre", tipo: "data", alinhar: "direita" },
  { id: "fecha", titulo: "Fecha", tipo: "data", alinhar: "direita" },
];

function linhasProgramas(programas: ProgramaAberto[]): LinhaTabela[] {
  return programas.map((p) => ({
    chave: p.codigo,
    valores: {
      programa: p.programa, ministerio: p.orgao, canal: p.canal === "outro" ? "Outro" : ROTULO_CANAL_PROGRAMA[p.canal],
      codigo: p.codigo, abre: p.abre, fecha: p.fecha,
    },
    celulas: {
      programa: p.programa,
      ministerio: p.orgao,
      canal: p.canal === "outro" ? "Outro" : ROTULO_CANAL_PROGRAMA[p.canal],
      codigo: <span className="pa-mono">{p.codigo}</span>,
      abre: p.abre ? dataBr(p.abre) : "—",
      fecha: (
        <>
          {dataBr(p.fecha)}
          <span className="sl-dias"> · {p.diasRestantes === 0 ? "hoje" : `${p.diasRestantes} d`}</span>
        </>
      ),
    },
  }));
}

// Tela pública: o filtro vale em toda coluna, mas valor e contagem não ordenam (sem ranking).
const COLUNAS_PARLAMENTARES: ColunaTabela[] = [
  { id: "parlamentar", titulo: "Parlamentar", tipo: "texto" },
  { id: "casa", titulo: "Casa", tipo: "categoria" },
  { id: "osc", titulo: "Para OSC", tipo: "numero", ordenavel: false, alinhar: "direita" },
  { id: "oscs", titulo: "OSCs atendidas", tipo: "numero", ordenavel: false, alinhar: "direita" },
  { id: "ministerios", titulo: "Ministérios das emendas a OSC", tipo: "texto" },
  { id: "areas", titulo: "Áreas das emendas com finalidade definida", tipo: "texto" },
  { id: "pix", titulo: "Pix (transferência especial)", tipo: "numero", ordenavel: false, alinhar: "direita" },
  { id: "fundos", titulo: "Fundos de saúde e outros fundos", tipo: "numero", ordenavel: false, alinhar: "direita" },
  { id: "entes", titulo: "Convênios com municípios e estado", tipo: "numero", ordenavel: false, alinhar: "direita" },
  { id: "emp25", titulo: "Empenhado 2025", tipo: "numero", ordenavel: false, alinhar: "direita" },
  { id: "emp26", titulo: `Empenhado 2026 (até ${DADOS_DO_PORTAL.slice(0, 5)})`, tipo: "numero", ordenavel: false, alinhar: "direita" },
];

function linhasParlamentares(): LinhaTabela[] {
  return [...PARLAMENTARES]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((p) => ({
      chave: p.nome,
      valores: {
        parlamentar: p.nome, casa: p.casa, osc: p.osc, oscs: p.oscs, ministerios: p.ministeriosOsc.join(", "), areas: p.areas,
        pix: p.pix, fundos: p.fundos, entes: p.conveniosEntes, emp25: p.empenhado2025, emp26: p.empenhado2026,
      },
      celulas: {
        parlamentar: <strong>{p.nome}</strong>,
        casa: p.casa === "Senado Federal" ? "Senado" : "Câmara",
        osc: dinheiro(p.osc),
        oscs: n(p.oscs),
        ministerios: p.ministeriosOsc.join(", "),
        areas: p.areas,
        pix: dinheiro(p.pix),
        fundos: dinheiro(p.fundos),
        entes: dinheiro(p.conveniosEntes),
        emp25: dinheiro(p.empenhado2025),
        emp26: dinheiro(p.empenhado2026),
      },
    }));
}

// ---------------------------------------------------------------- a Assembleia da PB (E3 das emendas estaduais, 16/10/2026)

// Tela pública: filtro em toda coluna; valor e contagem não ordenam (sem ranking). Os nomes, como a API do Estado publica.
const COLUNAS_DEPUTADOS_ESTADUAIS: ColunaTabela[] = [
  { id: "deputado", titulo: "Deputado estadual", tipo: "texto" },
  { id: "emendas", titulo: "Emendas a OSC", tipo: "numero", ordenavel: false, alinhar: "direita" },
  { id: "valor", titulo: "Valor indicado", tipo: "numero", ordenavel: false, alinhar: "direita" },
  { id: "entidades", titulo: "OSCs com empenho", tipo: "numero", ordenavel: false, alinhar: "direita" },
  { id: "orgaos", titulo: "Órgãos mais usados", tipo: "texto" },
];

function linhasDeputadosEstaduais(): LinhaTabela[] {
  return [...DEPUTADOS_ESTADUAIS_OSC]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((d) => ({
      chave: d.nome,
      valores: { deputado: d.nome, emendas: d.emendas, valor: d.valor, entidades: d.entidades, orgaos: d.orgaos.join("; ") },
      celulas: {
        deputado: <strong>{d.nome}</strong>,
        emendas: n(d.emendas),
        valor: dinheiro(d.valor),
        entidades: d.entidades ? n(d.entidades) : "—",
        orgaos: d.orgaos.join("; "),
      },
    }));
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "abril" ou "fevereiro e março": os meses em que as indicações a OSC foram enviadas à SEPLAG naquele ano. */
const mesesDoEnvio = (ano: number) =>
  Object.keys(ENVIO_DAS_INDICACOES[String(ano)] ?? {})
    .sort()
    .map((m) => MESES[Number(m) - 1])
    .join(" e ");

function SecaoAssembleia() {
  const total = ESTADUAIS_POR_ANO.reduce((s, a) => ({ emendas: s.emendas + a.emendas, valor: s.valor + a.valor, pago: s.pago + a.pago }), {
    emendas: 0,
    valor: 0,
    pago: 0,
  });
  const ent25 = CAMINHO_ESTADUAL.find((c) => c.grupo === "entidade" && c.ano === 2025);
  const mun25 = CAMINHO_ESTADUAL.find((c) => c.grupo === "municipio" && c.ano === 2025);
  return (
    <section aria-labelledby="sl-assembleia" className="mp-radar-secao">
      <h2 id="sl-assembleia" className="mp-radar-h2">A Assembleia da Paraíba e as OSC, 2024 a 2026</h2>
      <p className="pa-nota">
        Além das emendas federais, os deputados estaduais têm emendas impositivas no orçamento do Estado, e parte delas vai a organizações da
        sociedade civil. São {n(total.emendas)} emendas a OSC de {n(DEPUTADOS_ESTADUAIS_OSC.length)} deputados, com {dinheiro(total.valor)}{" "}
        indicados e {dinheiro(total.pago)} pagos até {DADOS_DA_API_PB}.
      </p>

      <h3 className="mp-radar-h3">O caminho até o dinheiro</h3>
      <p>
        A indicação do deputado vai à SEPLAG, que dá o parecer; o secretário da SEPLAG aprova; a SEFAZ põe a emenda no cronograma e o secretário
        da SEFAZ aprova; o órgão do Estado empenha e paga. Em 2025, da indicação ao primeiro empenho passaram {ent25?.ateEmpenho ?? "—"} dias
        (mediana) para OSC, contra {mun25?.ateEmpenho ?? "—"} para municípios. A espera maior é entre a aprovação na SEPLAG e o cronograma
        da SEFAZ: {ent25?.cronograma ?? "—"} dias para OSC e {mun25?.cronograma ?? "—"} para municípios. Das {n(ent25?.emendas ?? 0)} emendas
        a OSC de 2025, {n(ent25?.empenhadas ?? 0)} chegaram ao empenho até {DADOS_DA_API_PB}; das {n(mun25?.emendas ?? 0)} a municípios,{" "}
        {n(mun25?.empenhadas ?? 0)}.
      </p>
      <TabelaRolagem rotulo="Emendas estaduais a OSC por ano">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Ano da emenda</th>
              <th scope="col">Indicações enviadas em</th>
              <th scope="col" className="sl-num">Emendas a OSC</th>
              <th scope="col" className="sl-num">Valor indicado</th>
              <th scope="col" className="sl-num">Chegaram ao empenho</th>
              <th scope="col" className="sl-num">Pago</th>
            </tr>
          </thead>
          <tbody>
            {ESTADUAIS_POR_ANO.map((a) => (
              <tr key={a.ano}>
                <th scope="row">{a.ano}</th>
                <td>{mesesDoEnvio(a.ano) || "—"}</td>
                <td className="sl-num">{n(a.emendas)}</td>
                <td className="sl-num">{dinheiro(a.valor)}</td>
                <td className="sl-num">{n(a.empenhadas)}</td>
                <td className="sl-num">{dinheiro(a.pago)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaRolagem>

      <h3 className="mp-radar-h3">Por qual órgão do Estado</h3>
      <TabelaRolagem rotulo="Emendas estaduais a OSC por órgão do Estado, 2024 a 2026">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Órgão</th>
              <th scope="col" className="sl-num">Emendas</th>
              <th scope="col" className="sl-num">Valor indicado</th>
              <th scope="col" className="sl-num">Chegaram ao empenho</th>
              <th scope="col" className="sl-num">Pago</th>
            </tr>
          </thead>
          <tbody>
            {ESTADUAIS_POR_ORGAO.map((o) => (
              <tr key={o.orgao}>
                <th scope="row">{o.orgao}</th>
                <td className="sl-num">{n(o.emendas)}</td>
                <td className="sl-num">{dinheiro(o.valor)}</td>
                <td className="sl-num">{n(o.empenhadas)}</td>
                <td className="sl-num">{dinheiro(o.pago)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaRolagem>
      {CIENCIA_E_TECNOLOGIA.length > 0 && (
        <p className="pa-nota">
          Na área da associação, ciência e tecnologia:{" "}
          {CIENCIA_E_TECNOLOGIA.map((o) => `${o.orgao}, ${n(o.emendas)} ${o.emendas === 1 ? "emenda" : "emendas"} (${dinheiro(o.valor)}, pago ${dinheiro(o.pago)})`).join("; ")}.
        </p>
      )}

      <h3 className="mp-radar-h3">Os deputados estaduais que destinaram emendas a OSC</h3>
      <p className="pa-nota">
        Em ordem alfabética, com o nome como a API do Estado publica; as colunas de valor filtram, mas não ordenam. “OSCs com empenho” conta as
        entidades que já receberam empenho dessas emendas.
      </p>
      <TabelaFiltravel
        id="assembleia"
        rotulo="Deputados estaduais e as emendas a OSC, 2024 a 2026"
        colunas={COLUNAS_DEPUTADOS_ESTADUAIS}
        linhas={linhasDeputadosEstaduais()}
        descricaoOrdemPadrao="em ordem alfabética"
        csv={{ nome: "assembleia-pb-emendas-osc-2024-2026" }}
        empilhar
      />
      <ul className="pa-nota sl-lista">
        <li>
          <strong>OSC pela modalidade.</strong> Contam as emendas cuja modalidade, no orçamento do Estado, é a transferência a entidade privada
          sem fins lucrativos.
        </li>
        <li>
          <strong>O pago depende do órgão.</strong> A execução varia muito de um órgão do Estado para outro, e o pago de 2026 ainda está em
          curso.
        </li>
        <li>
          <strong>Fato, não avaliação.</strong> Deputado é agente público; a tabela mostra o que os dados abertos do Estado registram, sem nota
          nem posição.
        </li>
      </ul>
      <p className="pa-nota">
        Fonte: <LinkFonte fonte={F.apiPb} />, lida em {DADOS_DA_API_PB} e processada pela PONTE.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- a página

export function ConteudoIlhaTech({ hoje, leitura }: { hoje: string; leitura: LeituraProgramas }) {
  const programas = leitura.estado === "ok" ? leitura.programas : [];
  const porCanal = contarPorCanal(programas);
  const remanejamento = MARCOS.find((m) => m.de === "2026-11-04")!;
  const diasRemanejamento = diasEntre(hoje, remanejamento.de!);

  return (
    <div className="pa-pagina sl-pagina">
      <header className="pa-pilha sl-cabeca">
        <p className="pa-kicker">Sala de trabalho · PONTE Estruturação de Projetos de Impacto</p>
        <h1 className="pa-titulo">Associação Ilha Tech: caminhos de recurso federal em 2026 e 2027</h1>
        <p className="pa-sub">
          Preparada para a reunião de 15/10/2026. Reúne fatos públicos, cada um com a fonte: o calendário oficial das emendas, o que a
          bancada da Paraíba destinou a organizações da sociedade civil e os programas abertos hoje no Transferegov. Desde 16/10/2026,
          também as emendas da Assembleia Legislativa da Paraíba a OSC.
        </p>
        <p className="pa-nota sl-carimbo">
          Emendas federais: Portal da Transparência, arquivo de {DADOS_DO_PORTAL}. Emendas estaduais: API de dados abertos do Governo da
          Paraíba, lida em {DADOS_DA_API_PB}. Programas:{" "}
          {leitura.estado === "ok" && leitura.referencia
            ? `Transferegov, leitura de ${dataBr(leitura.referencia)}, atualizada todo dia.`
            : "leitura do Transferegov indisponível agora."}{" "}
          Sala preparada em {PREPARADO_EM}.
        </p>
      </header>

      <section aria-labelledby="sl-hoje" className="mp-radar-secao">
        <h2 id="sl-hoje" className="mp-radar-h2">A associação hoje</h2>
        <div className="pa-grade pa-grade-3 sl-cartoes">
          <article className="pa-cartao">
            <h3 className="pa-mono">Tempo de CNPJ</h3>
            <p className="pa-numero">3 anos</p>
            <p className="pa-nota">Completos em 05/10/2026: o mínimo para assinar com a União (Portaria Conjunta nº 2/2026, art. 4-A, I).</p>
          </article>
          <article className="pa-cartao">
            <h3 className="pa-mono">Parcerias federais</h3>
            <p className="pa-numero">Nenhuma</p>
            <p className="pa-nota">Sem convênio, termo ou proposta registrados no Transferegov até 14/10/2026. A primeira parceria pede o dossiê completo.</p>
          </article>
          <article className="pa-cartao">
            <h3 className="pa-mono">Indicação no SIOP em 2026</h3>
            <p className="pa-numero">Nenhuma</p>
            <p className="pa-nota">Informado pela associação em 14/10/2026. Sem indicação, o cronograma de 17/10 a 02/11 não se aplica a ela.</p>
          </article>
        </div>
      </section>

      <section aria-labelledby="sl-caminhos" className="mp-radar-secao">
        <h2 id="sl-caminhos" className="mp-radar-h2">Três caminhos</h2>
        <ol className="sl-caminhos">
          <li className="sl-caminho">
            <p className="sl-caminho-quando">2026 · emenda individual</p>
            <h3>Remanejamento de 04 a 09/11</h3>
            <p>
              É a última abertura do SIOP em 2026 e só alcança impedimentos técnicos identificados até lá. Depois dela, o ministério que
              receber o recurso define um cronograma próprio, com assinatura até 31/12.{" "}
              {diasRemanejamento > 0 ? `Começa em ${diasRemanejamento} dias.` : ""}
            </p>
            <p className="pa-nota">Fonte: <LinkFonte fonte={F.c32} /></p>
          </li>
          <li className="sl-caminho">
            <p className="sl-caminho-quando">Agora · sem emenda</p>
            <h3>
              {leitura.estado !== "ok"
                ? "Programas voluntários abertos a OSC na PB"
                : `${n(porCanal.voluntaria)} ${porCanal.voluntaria === 1 ? "programa voluntário aberto" : "programas voluntários abertos"} a OSC na PB`}
            </h3>
            <p>
              Propostas que a associação pode enviar sem indicação de parlamentar, se o objeto couber no programa. A lista completa está
              abaixo, com os que pedem emenda.
            </p>
            <p className="pa-nota">Fonte: Transferegov.br, leitura diária da PONTE.</p>
          </li>
          <li className="sl-caminho">
            <p className="sl-caminho-quando">2027 · emendas ao orçamento de 2027</p>
            <h3>O prazo de emendas ainda não abriu</h3>
            <p>
              O projeto do orçamento de 2027 (PLN 24/2026) chegou ao Congresso em 31/08/2026; em 14/10/2026 aguardava despacho na CMO, sem
              emendas. No ciclo anterior, o prazo foi de 24/10 a 13/11. A indicação dos beneficiários de 2027 acontece em 2027, com a
              associação já acima de 3 anos.
            </p>
            <p className="pa-nota">
              Fontes: <LinkFonte fonte={F.cmo}>CMO, quadro de tramitação</LinkFonte> · <LinkFonte fonte={F.cnmLoa2026}>CNM, prazo da LOA 2026</LinkFonte> ·{" "}
              <LinkFonte fonte={F.ploa2027}>imprensa: R$ 44,8 bi para emendas individuais e de bancada</LinkFonte>
            </p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="sl-calendario" className="mp-radar-secao">
        <h2 id="sl-calendario" className="mp-radar-h2">O calendário oficial de 2026</h2>
        <ol className="sl-linha">
          {MARCOS.map((m) => (
            <li key={m.titulo} className={`sl-marco${diasEntre(hoje, m.ate) < 0 ? " sl-marco-passou" : ""}`}>
              <p className="sl-marco-data">
                <span className="pa-mono">{m.de ? `${diaMes(m.de)} a ${diaMes(m.ate)}` : `até ${diaMes(m.ate)}`}</span>
                <Prazo marco={m} hoje={hoje} />
                <span className={`sl-vale sl-vale-${m.vale}`}>{VALE[m.vale]}</span>
              </p>
              <h3>{m.titulo}</h3>
              <p>{m.texto}</p>
              <p className="pa-nota">Fonte: <LinkFonte fonte={m.fonte} /></p>
            </li>
          ))}
        </ol>
        <p className="pa-nota">
          Em ano eleitoral, a vedação de transferências voluntárias nos três meses antes do pleito (Lei nº 9.504/1997, art. 73, VI, a) vale
          para estados e municípios e foi mantida pela AGU em 2026 (<LinkFonte fonte={F.c22}>Comunicado nº 22/2026</LinkFonte>).
        </p>
      </section>

      <section aria-labelledby="sl-programas" className="mp-radar-secao">
        <h2 id="sl-programas" className="mp-radar-h2">Programas abertos a OSC na Paraíba</h2>
        {leitura.estado !== "ok" ? (
          <p className="pa-ressalva">A leitura do Transferegov está indisponível agora. Tente de novo em alguns minutos.</p>
        ) : programas.length === 0 ? (
          <p className="pa-nota">Nenhum programa aberto a OSC na Paraíba na leitura de hoje.</p>
        ) : (
          <>
            <p className="pa-nota">
              {n(programas.length)} programas: {n(porCanal.voluntaria)} voluntários (sem emenda), {n(porCanal.emenda_parlamentar)} que pedem
              indicação de parlamentar e {n(porCanal.beneficiario_especifico)} só para o beneficiário que o órgão já nomeou. Os do
              cronograma 4/2026 entram até 16/10.
            </p>
            <TabelaFiltravel
              id="programas"
              rotulo="Programas do Transferegov abertos a OSC na Paraíba"
              colunas={COLUNAS_PROGRAMAS}
              linhas={linhasProgramas(programas)}
              descricaoOrdemPadrao="pela data de fechamento"
              csv={{ nome: "programas-abertos-osc-pb" }}
              empilhar
            />
          </>
        )}
      </section>

      <section aria-labelledby="sl-bancada" className="mp-radar-secao">
        <h2 id="sl-bancada" className="mp-radar-h2">A bancada da Paraíba e as OSC, 2024 a 2026</h2>
        <p className="pa-nota">
          Emendas individuais dos 12 deputados federais e dos 3 senadores da Paraíba com destino no estado, pelo caminho que o dinheiro
          tomou. Em ordem alfabética; as colunas de valor filtram, mas não ordenam.
        </p>
        <TabelaFiltravel
          id="bancada"
          rotulo="Emendas da bancada da Paraíba por caminho, 2024 a 2026"
          colunas={COLUNAS_PARLAMENTARES}
          linhas={linhasParlamentares()}
          descricaoOrdemPadrao="em ordem alfabética"
          csv={{ nome: "bancada-pb-emendas-2024-2026" }}
          empilhar
        />
        <ul className="pa-nota sl-lista">
          <li>
            <strong>Mesmo dinheiro, uma vez.</strong> Pix, fundos, convênios e OSC são caminhos diferentes, sem soma em dobro. O empenhado é
            do catálogo do Portal e não se soma aos caminhos.
          </li>
          <li>
            <strong>Empenhado de 2026 é parcial.</strong> Vai até {DADOS_DO_PORTAL}. Valor ainda não empenhado não quer dizer recurso
            disponível: pode estar indicado a outro beneficiário, em análise ou com impedimento técnico, o que só o SIOP mostra.
          </li>
          <li>
            <strong>Só o destino na Paraíba.</strong> Emendas para outros estados não entram.
          </li>
          <li>
            <strong>Fato, não avaliação.</strong> Parlamentar é agente público; a tabela mostra o que os dados abertos registram, sem nota
            nem posição.
          </li>
        </ul>
        <p className="pa-nota">
          Fonte: <LinkFonte fonte={F.portal} />, processado pela PONTE (canais de convênio, Pix, saúde fundo a fundo e pagamento direto).
        </p>
      </section>

      <section aria-labelledby="sl-ministerios" className="mp-radar-secao">
        <h2 id="sl-ministerios" className="mp-radar-h2">Por quais ministérios as emendas chegaram a OSC na PB</h2>
        <TabelaRolagem rotuloId="sl-ministerios">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Ministério</th>
                <th scope="col" className="sl-num">Valor, 2024 a 2026</th>
                <th scope="col" className="sl-num">Instrumentos</th>
                <th scope="col" className="sl-num">OSCs</th>
                <th scope="col" className="sl-num">Parlamentares</th>
              </tr>
            </thead>
            <tbody>
              {MINISTERIOS_OSC.map((m) => (
                <tr key={m.orgao}>
                  <th scope="row">{m.orgao}</th>
                  <td className="sl-num">{dinheiro(m.valor)}</td>
                  <td className="sl-num">{n(m.instrumentos)}</td>
                  <td className="sl-num">{n(m.oscs)}</td>
                  <td className="sl-num">{n(m.parlamentares)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
        <p className="pa-nota">Emendas dos 15 parlamentares da Paraíba a OSC com sede na PB. Fonte: <LinkFonte fonte={F.portal} /> e SICONV.</p>
      </section>

      <SecaoAssembleia />

      <section aria-labelledby="sl-citados" className="mp-radar-secao">
        <h2 id="sl-citados" className="mp-radar-h2">Os quatro ministérios de relacionamento da associação</h2>
        <div className="pa-grade pa-grade-2 sl-cartoes">
          {MINISTERIOS_CITADOS.map((m) => (
            <article key={m.nome} className="pa-cartao sl-ministerio">
              <h3 className="pa-cartao-titulo">{m.nome}</h3>
              <p><strong>Emendas da bancada a OSC.</strong> {m.emendasOsc}</p>
              <p><strong>Programas e chamamentos.</strong> {m.programas}</p>
              <p className="pa-nota">
                Fonte:{" "}
                {m.fontes.map((f, i) => (
                  <span key={f.url}>
                    {i > 0 ? " · " : ""}
                    <LinkFonte fonte={f} />
                  </span>
                ))}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="sl-pronto" className="mp-radar-secao">
        <h2 id="sl-pronto" className="mp-radar-h2">O que a associação precisa ter pronto</h2>
        <p className="pa-nota">Vale para qualquer caminho: emenda em 2026 ou 2027, ou programa voluntário.</p>
        <ul className="sl-requisitos">
          {REQUISITOS.map((r) => (
            <li key={r.item} className={`sl-requisito sl-requisito-${r.estado}`}>
              <span className="sl-estado">{r.estado === "cumprido" ? "Cumprido" : r.estado === "a-fazer" ? "A fazer" : "A confirmar"}</span>
              <div>
                <h3>{r.item}</h3>
                <p>{r.situacao}</p>
                <p className="pa-nota">
                  {r.base} · <LinkFonte fonte={r.fonte}>fonte</LinkFonte>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sl-passos" className="mp-radar-secao">
        <h2 id="sl-passos" className="mp-radar-h2">Próximos passos</h2>
        <ol className="sl-passos">
          <li>
            <strong>Até 02/11:</strong> confirmar o cadastro no Transferegov e reunir estatuto, certidões e o registro das atividades
            desde 2023. Isso independe de emenda.
          </li>
          <li>
            <strong>Programas voluntários:</strong> conferir, na lista acima, os que cabem no objeto da associação e os prazos de cada um.
          </li>
          <li>
            <strong>04 a 09/11:</strong> única janela de remanejamento de 2026. Só serve se um gabinete tiver impedimento técnico a
            remanejar e houver programa do ministério aberto a OSC.
          </li>
          <li>
            <strong>2027:</strong> levar aos gabinetes um projeto pronto, com objeto, metas, custos e o ministério da área, antes da
            abertura do prazo de emendas ao orçamento de 2027.
          </li>
          <li>
            <strong>Assembleia:</strong> as indicações estaduais a OSC foram enviadas à SEPLAG em {mesesDoEnvio(2024)} de 2024,{" "}
            {mesesDoEnvio(2025)} de 2025 e {mesesDoEnvio(2026)} de 2026. Um projeto pronto também serve aos gabinetes estaduais, antes do
            envio das indicações de 2027; conte com meses entre a indicação e o empenho.
          </li>
          <li>
            <strong>Transparência:</strong> publicar a página com os recursos recebidos de emendas, exigida antes da primeira parceria.
          </li>
        </ol>
      </section>

      <section aria-labelledby="sl-fontes" className="mp-radar-secao">
        <h2 id="sl-fontes" className="mp-radar-h2">Fontes</h2>
        <ul className="pa-nota sl-fontes">
          {Object.values(F).map((f) => (
            <li key={f.url}>
              <LinkFonte fonte={f} />
            </li>
          ))}
        </ul>
      </section>

      <footer className="pa-nota sl-rodape">
        PONTE Estruturação de Projetos de Impacto · Sala preparada em {PREPARADO_EM}. Reúne fatos públicos com a fonte de cada um; não é
        parecer jurídico nem avaliação de parlamentar.
      </footer>
    </div>
  );
}
