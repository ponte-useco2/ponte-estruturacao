/**
 * As peças da primeira infância (P2, 22/10/2026): os cartões, a lista dos 223, o detalhe do município (a aba) e as
 * notas de método. A regra mora em `lib/oportunidades/primeira-infancia.ts`; aqui só o desenho.
 */
import type { ReactNode } from "react";
import { formatarDataBr } from "@/lib/oportunidades/tabela-filtro";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { destinoConvenio, PODE, urlMunicipio, type NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import {
  DIAS_PARADO,
  DIAS_PARADO_LONGO,
  LIMITE_FUNDEB_NAO_APLICADO,
  ROTULO_ESTADO,
  SITUACAO_PARALISADA,
  TABELA_PRIMEIRA_INFANCIA,
  colunasPI,
  estadoTermo,
  ordenarObras,
  resumoMunicipio,
  totais,
  valoresPI,
  type MunicipioPI,
  type ObraCreche,
  type ResumoPI,
} from "@/lib/oportunidades/primeira-infancia";
import type { DatasPI } from "@/lib/oportunidades/primeira-infancia.server";
import type { IndicadorLido } from "@/lib/oportunidades/indicadores-municipio";
import { MUNICIPIOS_PB } from "@/lib/oportunidades/municipios-pb";
import { frasesReferencia } from "@/lib/oportunidades/indicadores-municipio";
import { LinkMapa } from "../_componentes/LinkMapa";
import { TabelaFiltravel } from "../_componentes/TabelaFiltravel";

const n = (x: number) => x.toLocaleString("pt-BR");
const pct = (x: number | null) => (x === null ? "—" : `${x.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const mes = (aaaamm: number | null) => (aaaamm ? `${String(aaaamm % 100).padStart(2, "0")}/${Math.floor(aaaamm / 100)}` : "—");
const plural = (x: number, um: string, varios: string) => `${n(x)} ${x === 1 ? um : varios}`;

function Cartao({ rotulo, valor, nota, tom }: { rotulo: string; valor: string; nota: ReactNode; tom?: "urgente" }) {
  return (
    <article className={`pa-cartao mp-painel-cartao${tom ? " mp-painel-urgente" : ""}`}>
      <h3 className="pa-mono">{rotulo}</h3>
      <p className="pa-numero">{valor}</p>
      <p className="mp-painel-valor">{nota}</p>
    </article>
  );
}

/** Os cartões: o carimbado em cima, o contexto embaixo. Servem à lista estadual e à aba (um município). */
export function CartoesPI({ t, datas, estadual }: { t: ResumoPI & { acimaDoLimite?: string[] }; datas: DatasPI; estadual: boolean }) {
  return (
    <>
      <h3 className="mp-radar-h3">Dinheiro carimbado para a primeira infância</h3>
      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <Cartao
          rotulo="Creches: em conta, sem pagamento"
          valor={moedaCurta(t.parado)}
          tom={t.parado > 0 ? "urgente" : undefined}
          nota={
            <>
              {plural(t.nParado, "termo", "termos")} com a 1ª parcela em conta, nenhum pagamento e {DIAS_PARADO}+ dias sem movimento;{" "}
              {moedaCurta(t.paradoLongo)} há mais de {DIAS_PARADO_LONGO} dias.
              {t.recente > 0 ? ` Mais ${moedaCurta(t.recente)} liberados há pouco.` : ""}
            </>
          }
        />
        <Cartao rotulo="Creches: assinadas, a liberar" valor={moedaCurta(t.aLiberar)} nota={`${plural(t.nALiberar, "termo", "termos")} do MEC sem nenhuma liberação.`} />
        <Cartao
          rotulo="Criança Feliz: saldo"
          valor={moedaCurta(t.cfSaldo)}
          nota={
            <>
              Conta &ldquo;Primeira Infância no SUAS&rdquo; em {mes(datas.fnasMes)}
              {!estadual && t.cfMeses !== null ? `: ${n(t.cfMeses)} meses do repasse recebido.` : "."}
            </>
          }
        />
        <Cartao
          rotulo="Pix só de creche e PAR4"
          valor={moedaCurta(t.pixSaldo + t.parSaldo)}
          nota={`Pix ${moedaCurta(t.pixSaldo)} (data do saldo varia por plano); PAR4 ${moedaCurta(t.parSaldo)} em conta.${t.obrasParalisadas ? ` ${plural(t.obrasParalisadas, "obra de creche paralisada", "obras de creche paralisadas")} no Obrasgov.` : ""}`}
        />
      </div>
      <h3 className="mp-radar-h3">Contexto: dinheiro que pode ir para a primeira infância, mas não é carimbado</h3>
      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <Cartao
          rotulo={`FUNDEB não usado em ${datas.siopeAno ?? "—"}`}
          valor={moedaCurta(t.fundebNaoUsado)}
          tom={t.fundebAcimaDoLimite ? "urgente" : undefined}
          nota={
            <>
              Pela parte que {estadual ? "cada município aplica" : "o município aplica"} em educação infantil, cerca de{" "}
              {moedaCurta(t.fundebEiEstimado)} (estimativa).
              {estadual && t.acimaDoLimite?.length
                ? ` ${plural(t.acimaDoLimite.length, "município passou", "municípios passaram")} do limite de ${LIMITE_FUNDEB_NAO_APLICADO}%.`
                : ""}
              {!estadual && t.fundebPctNaoAplicado !== null
                ? ` Não aplicado: ${pct(t.fundebPctNaoAplicado)}${t.fundebAcimaDoLimite ? `, acima do limite de ${LIMITE_FUNDEB_NAO_APLICADO}%` : ""}.`
                : ""}
            </>
          }
        />
        <Cartao rotulo={`Salário-educação: saldo ${datas.siopeAno ?? ""}`} valor={moedaCurta(t.salarioEducacao)} nota="Serve a toda a educação básica." />
        <Cartao
          rotulo="Saúde: saldo nas contas do FNS"
          valor={moedaCurta(t.saude)}
          nota={`Fundos municipais${datas.saudeData ? `, em ${formatarDataBr(datas.saudeData)}` : ""}. Sem marca de idade.`}
        />
      </div>
    </>
  );
}

/** A lista dos 223 (só os que têm algo carimbado, ou todos), filtrável. Ordem por valor só para o administrador. */
export function TabelaMunicipiosPI({ municipios, administrador }: { municipios: MunicipioPI[]; administrador: boolean }) {
  const cel = (v: number | null) => (v ? moedaCurta(v) : "—");
  return (
    <TabelaFiltravel
      id={TABELA_PRIMEIRA_INFANCIA}
      rotulo="Primeira infância por município"
      colunas={colunasPI(administrador)}
      linhas={municipios.map((m) => {
        const r = resumoMunicipio(m);
        const v = valoresPI(m);
        return {
          chave: m.ibge,
          valores: v,
          celulas: {
            municipio: <LinkMapa href={urlMunicipio(m.ibge, "primeira-infancia")}>{m.nome}</LinkMapa>,
            parado: cel(r.parado),
            "a-liberar": cel(r.aLiberar),
            par: cel(r.parSaldo),
            pix: cel(r.pixSaldo),
            "obras-paralisadas": r.obrasParalisadas ? n(r.obrasParalisadas) : "—",
            "crianca-feliz": cel(r.cfSaldo),
            fundeb: (
              <>
                {cel(r.fundebNaoUsado)}
                {r.fundebAcimaDoLimite && <span className="mp-tabela-secundario">acima de {LIMITE_FUNDEB_NAO_APLICADO}%</span>}
              </>
            ),
            "creche-03": m.creche03 === null ? "—" : m.creche03.toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
          },
        };
      })}
      ordemPadrao={{ coluna: "municipio", sentido: "asc" }}
      descricaoOrdemPadrao="município, em ordem alfabética"
      csv={{ nome: "primeira-infancia-pb" }}
    />
  );
}

/** A aba do município: os termos e os planos, um a um, o contexto em números e a necessidade da camada 2. */
export function DetalheMunicipioPI({
  m,
  datas,
  nivel,
  necessidade,
}: {
  m: MunicipioPI;
  datas: DatasPI;
  nivel: NivelAcesso;
  necessidade: IndicadorLido[];
}) {
  const destino = destinoConvenio(nivel);
  const termos = [...m.termos].sort((a, b) => (b.saldo ?? 0) - (a.saldo ?? 0) || (b.repasse ?? 0) - (a.repasse ?? 0));
  const s = m.contexto.siope;
  return (
    <>
      <h3 className="mp-radar-h3">Creches e educação infantil no SICONV</h3>
      {termos.length === 0 ? (
        <p className="pa-nota">Nenhum termo de creche ou educação infantil em execução, nem com saldo em conta, no SICONV de {datas.siconv ? formatarDataBr(datas.siconv) : "—"}.</p>
      ) : (
        <ul className="mp-laudo-lista">
          {termos.map((t) => (
            <li key={t.nr}>
              <strong>{ROTULO_ESTADO[estadoTermo(t)]}</strong> · <LinkMapa href={destino(t.nr)}>{t.nr}</LinkMapa> · {t.programa ?? "—"}
              <br />
              <span className="mp-tabela-secundario">
                assinado {t.assinatura ? formatarDataBr(t.assinatura) : "—"} · vigência até {t.vigencia ? formatarDataBr(t.vigencia) : "—"} · liberado{" "}
                {moedaCurta(t.desembolsado ?? 0)} de {moedaCurta(t.repasse)}
                {t.saldo ? ` · ${moedaCurta(t.saldo)} em conta` : ""}
                {t.dias !== null ? ` · ${n(t.dias)} dias sem movimento` : ""}
                {t.fisico !== null ? ` · físico ${Math.round(t.fisico * 100)}%` : ""}
                {t.licitacao ? ` · licitação: ${t.licitacao.replace(/_/g, " ")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mp-radar-h3">Obras de creche no Obrasgov.br</h3>
      <ObrasPI obras={m.obras} data={datas.obras} vazio="Nenhuma obra de creche ou educação infantil deste município no Obrasgov.br." />

      {m.pix.length > 0 && (
        <>
          <h3 className="mp-radar-h3">Planos do Pix que citam a primeira infância</h3>
          <ul className="mp-laudo-lista">
            {m.pix.map((p) => (
              <li key={p.id}>
                <strong>{p.classe === "exclusivo" ? "só creche ou educação infantil" : "misto (com outras obras)"}</strong> ·{" "}
                {PODE.laudo(nivel) ? <LinkMapa href={`/mapa/pix/plano/${p.id}`}>{p.codigo}</LinkMapa> : p.codigo} · {p.ano}
                <br />
                <span className="mp-tabela-secundario">
                  {p.objeto ? p.objeto.slice(0, 220) : "—"} · pago {moedaCurta(p.pago)}
                  {p.saldo !== null ? ` · saldo ${moedaCurta(p.saldo)}${p.dataSaldo ? ` em ${formatarDataBr(p.dataSaldo)}` : ""}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="pa-nota">O saldo do plano misto é da conta inteira, e não só da primeira infância: não entra na soma.</p>
        </>
      )}

      <h3 className="mp-radar-h3">Educação infantil no SIOPE ({datas.siopeAno ?? "—"}, 6º bimestre)</h3>
      {s ? (
        <table className="mp-tabela">
          <tbody>
            <tr><th scope="row">FUNDEB não usado no ano</th><td className="mp-num">{moedaCurta(s["7.3"])}</td></tr>
            <tr><th scope="row">% do FUNDEB não aplicado (limite {LIMITE_FUNDEB_NAO_APLICADO}%)</th><td className="mp-num">{pct(s["1.4"] ?? null)}</td></tr>
            <tr><th scope="row">% do FUNDEB aplicado na educação infantil</th><td className="mp-num">{pct(s["2.1"] ?? null)}</td></tr>
            <tr><th scope="row">% da despesa com educação na educação infantil</th><td className="mp-num">{pct(s["2.4"] ?? null)}</td></tr>
            <tr><th scope="row">Investimento por aluno da educação infantil</th><td className="mp-num">{moedaCurta(s["4.1"])}</td></tr>
            <tr><th scope="row">Saldo do FUNDEB no fim do ano</th><td className="mp-num">{moedaCurta(s["7.2"])}</td></tr>
            <tr><th scope="row">Saldo do salário-educação</th><td className="mp-num">{moedaCurta(s["166"])}</td></tr>
          </tbody>
        </table>
      ) : (
        <p className="pa-nota">O SIOPE não traz a transmissão do 6º bimestre de {datas.siopeAno ?? "—"} deste município.</p>
      )}

      {necessidade.length > 0 && (
        <>
          <h3 className="mp-radar-h3">A necessidade, nos indicadores do município</h3>
          <ul className="mp-laudo-lista">
            {necessidade.map((x) => (
              <li key={x.id}>
                <strong>{x.nome}</strong>: {x.texto} ({x.ano}){frasesReferencia(x) ? ` · ${frasesReferencia(x)}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
      <NotasPI datas={datas} />
    </>
  );
}

export function NotasPI({ datas }: { datas: DatasPI }) {
  return (
    <details className="mp-fiscal-detalhe">
      <summary>Como ler e de onde vem</summary>
      <ul>
        <li>
          <strong>Datas.</strong> SICONV de {datas.siconv ? formatarDataBr(datas.siconv) : "—"}; saldos do FNAS de {mes(datas.fnasMes)}; SIOPE de{" "}
          {datas.siopeAno ?? "—"}, 6º bimestre; FNS com saldos de {datas.saudeData ? formatarDataBr(datas.saudeData) : "—"}; Obrasgov.br lido em{" "}
          {datas.obras ? formatarDataBr(datas.obras) : "—"}.
        </li>
        <li>
          <strong>&ldquo;Em conta, sem pagamento&rdquo;</strong> é a 1ª parcela do MEC depositada, sem nenhum pagamento da prefeitura e com{" "}
          {DIAS_PARADO} dias ou mais sem movimento (contados até o dia do arquivo do SICONV). O saldo inclui o rendimento da aplicação.
          É ponto para olhar, não irregularidade: o mais comum é a licitação ou o início da obra atrasados.
        </li>
        <li>
          <strong>PAR4.</strong> Os termos do SIMEC/PAR aparecem no SICONV sem a execução, que corre no SIMEC. A situação e o percentual das obras
          vêm do Obrasgov.br (o cadastro federal de obras, que espelha o SIMEC), lido toda quarta.
        </li>
        <li>
          <strong>Obras no Obrasgov.br.</strong> A fonte não traz o número do termo: obra e termo se ligam só pelo município, nunca como &ldquo;é esta
          obra&rdquo;. O município vem do tomador, do nome da obra (&ldquo;Município/PB&rdquo;) ou da localização, quando não é a de João Pessoa, que a
          fonte usa quando não sabe; sem nenhum deles, a obra fica como &ldquo;município não identificado&rdquo;. Paralisada é ponto para olhar, não
          irregularidade: pode estar em repactuação (Pacto pela Retomada de Obras, Lei 14.719/2023).
        </li>
        <li>
          <strong>Pix.</strong> Entra na soma só o plano cujo objeto é inteiramente creche ou educação infantil; o misto aparece, sem somar.
        </li>
        <li>
          <strong>Criança Feliz.</strong> O saldo da conta &ldquo;Primeira Infância no SUAS&rdquo; do Portal de Dados do FNAS (MDS). Na PB, o saldo costuma
          equivaler a cerca de um mês do repasse: o dinheiro gira.
        </li>
        <li>
          <strong>FUNDEB.</strong> Não é carimbado por etapa. A estimativa multiplica o não usado pelo percentual aplicado em educação infantil. Até{" "}
          {LIMITE_FUNDEB_NAO_APLICADO}% podem ficar para o 1º quadrimestre do ano seguinte (Lei 14.113/2020, art. 25, §3º).
        </li>
        <li>
          <strong>Saúde.</strong> As contas do FNS são por bloco e por emenda, sem marca de faixa etária: é contexto do tamanho do saldo da saúde.
        </li>
        <li>
          <strong>Fontes.</strong> SICONV/Transferegov, API das transferências especiais, Portal de Dados do FNAS, SIOPE/FNDE e a consulta pública de contas
          do FNS. Contas bancárias não são guardadas: só as somas.
        </li>
      </ul>
    </details>
  );
}

const SECUNDARIAS = new Set(["Concluída", "Cancelada", "Inacabada"]);
const NOME_MUNICIPIO = new Map(MUNICIPIOS_PB.map(([codigo, nome]) => [codigo, nome]));

/** As obras de creche, uma por linha: as vivas primeiro; as concluídas e canceladas, recolhidas. */
export function ObrasPI({
  obras,
  data,
  vazio,
  comMunicipio = false,
}: {
  obras: ObraCreche[];
  data: string | null;
  vazio: string;
  comMunicipio?: boolean;
}) {
  if (!data) return <p className="pa-nota">O Obrasgov.br ainda não foi lido (o job das obras roda toda quarta).</p>;
  if (obras.length === 0) return <p className="pa-nota">{vazio}</p>;
  const ordem = ordenarObras(obras);
  const vivas = ordem.filter((o) => !SECUNDARIAS.has(o.situacao ?? ""));
  const outras = ordem.filter((o) => SECUNDARIAS.has(o.situacao ?? ""));
  const item = (o: ObraCreche) => (
    <li key={o.id}>
      <strong>{o.situacao ?? "—"}</strong>
      {o.pct !== null ? ` · ${pct(o.pct)} executado` : ""} · {o.nome}
      {comMunicipio &&
        (o.ibge ? (
          <>
            {" · "}
            <LinkMapa href={urlMunicipio(o.ibge, "primeira-infancia")}>{NOME_MUNICIPIO.get(o.ibge) ?? o.ibge}</LinkMapa>
          </>
        ) : (
          " · município não identificado na fonte"
        ))}
      <br />
      <span className="mp-tabela-secundario">
        {o.inicio ? `início ${formatarDataBr(o.inicio)}` : "sem início registrado"}
        {o.fimPrevista ? ` · fim previsto ${formatarDataBr(o.fimPrevista)}` : ""}
        {o.situacao === SITUACAO_PARALISADA && o.dataSituacao ? ` · paralisada em ${formatarDataBr(o.dataSituacao)}` : ""}
        {o.justificativa && o.justificativa !== o.situacao ? ` · ${o.justificativa.slice(0, 160)}` : ""}
        {` · ${o.sistema ?? "Obrasgov"} ${o.id}`}
      </span>
    </li>
  );
  return (
    <>
      {vivas.length > 0 ? <ul className="mp-laudo-lista">{vivas.map(item)}</ul> : <p className="pa-nota">Nenhuma obra em andamento ou parada.</p>}
      {outras.length > 0 && (
        <details className="mp-fiscal-detalhe">
          <summary>{plural(outras.length, "obra concluída ou cancelada", "obras concluídas ou canceladas")}</summary>
          <ul className="mp-laudo-lista">{outras.map(item)}</ul>
        </details>
      )}
      <p className="pa-nota">
        Obrasgov.br lido em {formatarDataBr(data)}. A ligação com os termos do SICONV é pelo município, não pelo número do termo.
      </p>
    </>
  );
}

export { totais };
