/**
 * A lista das emendas da Câmara de João Pessoa (J2, 16/10/2026). Recebe o retrato pronto (`lerCamaraJp`); aqui só se
 * apresenta.
 *
 *   · a lista abre por nome; não há posição, medalha, nota única nem cor de "bom" ou "ruim". É tela de administrador:
 *     toda coluna filtra e ordena, e ordenar por valor é leitura, não posição;
 *   · cada ano acima da lista, com a fonte dele (painel diário no exercício; portal de 2021 a 2025): execução só se
 *     compara no mesmo ano;
 *   · o que ainda não está pago no exercício leva à fila da execução.
 */
import type { ReactNode } from "react";
import {
  COLUNAS_PONTOS_JP,
  COLUNAS_VEREADORES_JP,
  TABELA_PONTOS_JP,
  TABELA_VEREADORES_JP,
  porcento,
  valoresDoPontoJp,
  valoresDoVereadorJp,
} from "@/lib/oportunidades/camara-jp-tela";
import { resumir } from "@/lib/oportunidades/assembleia-tela";
import {
  URL_FILA_EJP,
  URL_PAINEL_PREFEITURA,
  anosDaCamara,
  emendasDoRetrato,
  fonteDoAno,
  pct,
  pontosParaOlhar,
  resumoDasEtapas,
  ROTULO_ETAPA,
  urlEmendaJp,
  urlVereadorJp,
  vereadoresDoRetrato,
  type PontoEjp,
  type RetratoEjp,
  type VereadorJp,
} from "@/lib/oportunidades/emendas-jp";
import type { LinhaTabela, ValorCelula } from "@/lib/oportunidades/tabela-filtro";
import { Tag } from "../../../_design/primitivos";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../_componentes/TabelaFiltravel";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";
import { CartaoNumero, CasasParlamentares, n } from "../PecasParlamentares";
import { AVISO_CAMARA_JP, CarimboEjp, NotaDeMetodoEjp, Secao, reais } from "./PecasCamaraJp";

/** A contagem de cada ponto, para a nota da seção. */
const FRASE_PONTO: Record<PontoEjp, (q: number) => string> = {
  cnpj_invalido: (q) => `${n(q)} com CNPJ de dígito errado no objeto`,
  credor_diferente: (q) => `${n(q)} com empenho a outro CNPJ`,
  sem_empenho_tce: (q) => `${n(q)} empenhadas no painel sem empenho do TCE-PB ligado`,
};

const EM_REAIS = ["atual", "empenhado", "pago", "exercicio-atual", "exercicio-pago"] as const;
const CONTAGENS = ["emendas", "exercicio-emendas", "exercicio-sem-empenho"] as const;

export function CamaraJpConteudo({ retrato }: { retrato: RetratoEjp }) {
  const emendas = emendasDoRetrato(retrato);
  const vereadores = vereadoresDoRetrato(retrato, emendas);
  const anos = anosDaCamara(emendas);
  const exercicio = retrato.execucao.exercicio;
  const doAno = anos.find((a) => a.ano === exercicio);
  const etapas = resumoDasEtapas(emendas, exercicio);
  const naoPagas = etapas.filter((e) => e.etapa !== "paga" && e.etapa !== "sem_valor");
  const linhas: LinhaTabela[] = vereadores.map((v) => {
    const valores = valoresDoVereadorJp(v);
    return { chave: v.slug, valores, celulas: celulasDoVereador(v, valores) };
  });
  const pontos = pontosParaOlhar(retrato, emendas);
  const linhasPontos: LinhaTabela[] = pontos.map((p) => ({
    chave: `${p.ponto}-${p.emenda.chave}`,
    valores: valoresDoPontoJp(p),
    celulas: {
      emenda: (
        <LinkMapa href={urlEmendaJp(p.emenda.ano, p.emenda.codigo)} className="mp-tabela-principal">
          {p.emenda.codigo}
        </LinkMapa>
      ),
      ano: String(p.emenda.ano),
      vereador: p.emenda.pessoa ? <LinkMapa href={urlVereadorJp(p.emenda.pessoa)}>{p.emenda.pessoa}</LinkMapa> : (p.emenda.autorPublicado ?? "—"),
      objeto: <span title={p.emenda.objeto ?? undefined}>{resumir(p.emenda.objeto)}</span>,
      atual: reais(p.emenda.atual),
    },
  }));
  const porPonto = new Map<PontoEjp, number>();
  for (const p of pontos) porPonto.set(p.ponto, (porPonto.get(p.ponto) ?? 0) + 1);

  return (
    <div className="pa-pagina mp-radar mp-parl">
      <CasasParlamentares atual="camara-jp" />
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel · parlamentares · Câmara de João Pessoa</p>
        <h1 className="pa-titulo">Emendas impositivas da Câmara Municipal de João Pessoa</h1>
        <p className="pa-sub">
          {n(vereadores.length)} vereadores e colegiados com emendas de 2021 em diante, com o valor original, o atual, o empenhado e o pago de
          cada um. Cada nome abre a ficha; a fila mostra em que etapa está cada emenda do exercício.
        </p>
        <p className="mp-fiscal-aviso">{AVISO_CAMARA_JP}</p>
        <CarimboEjp execucao={retrato.execucao} />
        <p className="pa-linha mp-nao-imprimir">
          <LinkMapa href={URL_FILA_EJP} className="pa-btn pa-btn-pequeno">
            Ver a fila da execução
          </LinkMapa>
          <a href={URL_PAINEL_PREFEITURA} className="pa-btn pa-btn-pequeno" rel="noreferrer">
            Abrir o painel da Prefeitura
          </a>
        </p>
      </div>

      {doAno && (
        <div className="pa-grade pa-grade-4 mp-painel-cartoes">
          <CartaoNumero titulo={`Emendas de ${doAno.ano}`} numero={n(doAno.emendas)} nota={`${reais(doAno.atual)} no valor atual`} />
          <CartaoNumero titulo="Empenhado" numero={reais(doAno.empenhado)} nota={`${porcento(pct(doAno.empenhado, doAno.atual))} do valor atual`} />
          <CartaoNumero titulo="Pago" numero={reais(doAno.pago)} nota={`${porcento(doAno.pctPago)} do valor atual`} />
          <CartaoNumero
            titulo="Ainda não pagas"
            numero={n(naoPagas.reduce((s, e) => s + e.emendas, 0))}
            nota={
              <>
                {n(doAno.semEmpenho)} sem empenho · <LinkMapa href={URL_FILA_EJP}>ver a fila</LinkMapa>
              </>
            }
          />
        </div>
      )}

      {etapas.length > 0 && (
        <Secao id="cjp-etapas" titulo={`Onde estão as emendas de ${exercicio}`} nota="Pelo painel da Prefeitura, no dia da leitura. A soma é do valor atual.">
          <TabelaRolagem rotulo="As emendas do exercício por etapa">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Etapa</th>
                  <th scope="col">Emendas</th>
                  <th scope="col">Valor atual</th>
                </tr>
              </thead>
              <tbody>
                {etapas.map((e) => (
                  <tr key={e.etapa}>
                    <th scope="row" className="mp-th-celula">
                      {ROTULO_ETAPA[e.etapa]}
                    </th>
                    <td className="mp-rel-num">{n(e.emendas)}</td>
                    <td className="mp-rel-num">{reais(e.atual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        </Secao>
      )}

      <Secao
        id="cjp-anos"
        titulo="Cada ano"
        nota="A Câmara inteira, pelo ano da emenda, com a fonte de cada ano. O ano corrente ainda está pagando; os antigos mostram o que ficou para trás."
      >
        <TabelaRolagem rotulo="As emendas de cada ano">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Ano</th>
                <th scope="col">Emendas</th>
                <th scope="col">Valor original</th>
                <th scope="col">Valor atual</th>
                <th scope="col">Empenhado</th>
                <th scope="col">Pago</th>
                <th scope="col">Pago ÷ atual</th>
                <th scope="col">Sem autor publicado</th>
                <th scope="col">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {anos.map((a) => (
                <tr key={a.ano}>
                  <th scope="row" className="mp-th-celula">
                    {a.ano}
                  </th>
                  <td className="mp-rel-num">{n(a.emendas)}</td>
                  <td className="mp-rel-num">{reais(a.original)}</td>
                  <td className="mp-rel-num">{reais(a.atual)}</td>
                  <td className="mp-rel-num">{reais(a.empenhado)}</td>
                  <td className="mp-rel-num">{reais(a.pago)}</td>
                  <td className="mp-rel-num">{porcento(a.pctPago)}</td>
                  <td className="mp-rel-num">{a.semAutor ? n(a.semAutor) : "—"}</td>
                  <td>{fonteDoAno(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
      </Secao>

      {pontos.length > 0 && (
        <Secao
          id="cjp-pontos"
          titulo="Pontos para olhar"
          nota={
            <>
              O que pede um segundo olhar nas fontes, sem juízo: nenhum destes pontos é irregularidade. O CNPJ com dígito errado costuma ser
              erro de digitação no objeto; o empenho a outro CNPJ pode ser compra feita pela Prefeitura para a entidade; e a emenda empenhada no
              painel sem empenho do TCE-PB ligado pode ter um empenho que não cita a emenda no histórico, ou o arquivo do TCE-PB ainda não
              chegou ao mês do empenho. Nesta leitura: {[...porPonto].map(([p, q]) => FRASE_PONTO[p](q)).join("; ")}.
            </>
          }
        >
          <TabelaFiltravel
            id={TABELA_PONTOS_JP}
            rotulo="Pontos para olhar nas emendas da Câmara de João Pessoa"
            colunas={COLUNAS_PONTOS_JP}
            linhas={linhasPontos}
            descricaoOrdemPadrao="pelo tipo de ponto, do ano mais recente, pelo número"
            csv={{ nome: "camara-joao-pessoa-pontos-para-olhar" }}
          />
        </Secao>
      )}

      <Secao id="cjp-lista" titulo={`Os ${n(vereadores.length)} vereadores e colegiados`}>
        <p className="pa-nota mp-parl-grupo-nota">
          Em ordem de nome. “Filtrar e ordenar” filtra e ordena por qualquer coluna; o CSV sai só com o que está filtrado. Ordenar por valor é
          leitura, não posição: o total junta anos diferentes. Quem saiu da Câmara aparece com o nome da lista da LOA; grafias diferentes da
          mesma pessoa só se juntam pela tabela curada.
        </p>
        <TabelaFiltravel
          id={TABELA_VEREADORES_JP}
          rotulo="Vereadores e colegiados com emendas impositivas em João Pessoa"
          colunas={COLUNAS_VEREADORES_JP}
          linhas={linhas}
          descricaoOrdemPadrao="por nome"
          csv={{ nome: "camara-joao-pessoa-vereadores" }}
        />
      </Secao>

      <NotaDeMetodoEjp id="cjp-como-ler" />
    </div>
  );
}

function celulasDoVereador(v: VereadorJp, valores: Record<string, ValorCelula>): Record<string, ReactNode> {
  const celulas: Record<string, ReactNode> = {};
  for (const id of EM_REAIS) {
    const x = valores[id];
    celulas[id] = typeof x === "number" ? reais(x) : "—";
  }
  for (const id of CONTAGENS) {
    const x = valores[id];
    celulas[id] = typeof x === "number" && x > 0 ? n(x) : "—";
  }
  celulas.vereador = (
    <>
      <LinkMapa href={urlVereadorJp(v.pessoa)} className="mp-tabela-principal">
        {v.pessoa}
      </LinkMapa>
      {v.tipo === "colegiado" && <Tag>colegiado</Tag>}
    </>
  );
  celulas["pct-pago"] = porcento(typeof valores["pct-pago"] === "number" ? valores["pct-pago"] : null);
  celulas["ano-inicial"] = v.anoMin === null ? "—" : String(v.anoMin);
  celulas["ano-final"] = v.anoMax === null ? "—" : String(v.anoMax);
  return celulas;
}
