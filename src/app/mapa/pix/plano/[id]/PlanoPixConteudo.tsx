/**
 * O laudo de um plano de ação do Pix (onda 13A): os pontos a conferir, os itens do roteiro por grupo e o
 * Pix do município no TCE-PB. Recebe a leitura pronta; as regras moram no job (`pix_fundo/laudo.py`).
 *
 * `cliente`: a prefeitura vendo o plano dela — sem atalhos para páginas de administrador. O conteúdo é o
 * mesmo: o laudo do Pix não tem nome de servidor nem de fornecedor.
 */
import Link from "next/link";
import { BotaoImprimir } from "@/app/mapa/fiscal/[ibge]/simular/BotaoImprimir";
import { formatarData } from "@/lib/oportunidades/central";
import {
  GRUPOS,
  classeEstado,
  itensDoGrupo,
  pontosAConferir,
  rotuloItem,
  urlEntePix,
  type ItemLaudoPix,
} from "@/lib/oportunidades/pix-laudo";
import type { LeituraLaudoPlanoPix } from "@/lib/oportunidades/pix-laudo.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { PixNoTce } from "../../PixNoTce";

type LeituraOk = Extract<LeituraLaudoPlanoPix, { estado: "ok" }>;

const data = (iso: string | null | undefined) => (iso ? formatarData(iso) : "—");

export const AVISO_PIX =
  "Leitura automática dos dados abertos do Transferegov (API das transferências especiais) e das despesas prestadas ao TCE-PB. " +
  "\"A conferir\" é ponto para olhar, não irregularidade: o documento pode existir fora da API. Não substitui o plano de trabalho, o " +
  "relatório de gestão nem orientação jurídica.";

export function PlanoPixConteudo({ leitura, cliente = false }: { leitura: LeituraOk; cliente?: boolean }) {
  const { plano: p, autor, tce, execucao } = leitura;
  const conferir = pontosAConferir(p.itens);
  const chaveEnte = p.cnpj ?? p.cod_ibge;

  return (
    <div className="pa-pagina mp-radar mp-laudo">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">
          Laudo do Pix · plano de ação {p.codigo_plano_acao ?? p.id_plano_acao} · {p.ano}
        </p>
        <h1 className="pa-titulo">{p.beneficiario ?? "Beneficiário não informado"}</h1>
        {p.objeto && <p className="pa-sub">{p.objeto}</p>}
        <p className="pa-sub">
          {p.autor ? `Emenda de ${p.autor}` : "Autor não informado"}
          {p.codigo_emenda ? ` · ${p.codigo_emenda.split("-")[0]}` : ""}
          {p.area ? ` · ${p.area}` : ""}
          {` · situação: ${p.situacao ?? "—"}`}
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          {chaveEnte && (
            <Link href={urlEntePix(chaveEnte)} className="pa-btn pa-btn-pequeno">
              Todos os planos do ente
            </Link>
          )}
          {!cliente && (
            <Link href="/mapa/painel/pix?aba=especiais&uf=PB" className="pa-btn pa-btn-pequeno">
              Painel do Pix
            </Link>
          )}
        </p>
        <p className="mp-fiscal-aviso">{AVISO_PIX}</p>
      </div>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <article className="pa-cartao">
          <h2 className="pa-mono">Valor</h2>
          <p className="pa-numero">{moedaCurta(p.valor)}</p>
          <p className="pa-nota">
            {moedaCurta(p.investimento)} em investimento · {moedaCurta(p.custeio)} em custeio
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Pago</h2>
          <p className="pa-numero">{moedaCurta(p.pago)}</p>
          <p className="pa-nota">{p.dt_primeira_ob ? `1ª ordem bancária em ${data(p.dt_primeira_ob)}` : "nenhuma ordem bancária"}</p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Limite da execução</h2>
          <p className="pa-numero">{data(p.limite_execucao)}</p>
          <p className="pa-nota">{p.fim_execucao ? `fim previsto no plano de trabalho: ${data(p.fim_execucao)}` : "sem fim previsto"}</p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Saldo em conta</h2>
          <p className="pa-numero">{p.saldo === null ? "—" : moedaCurta(p.saldo)}</p>
          <p className="pa-nota">{p.dt_saldo ? `em ${data(p.dt_saldo)}` : "sem saldo publicado"}</p>
        </article>
      </div>

      <section aria-labelledby="pix-conferir" className="mp-radar-secao">
        <h2 id="pix-conferir" className="mp-radar-h2">
          O que conferir
        </h2>
        {conferir.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhum ponto a conferir nos itens que os dados abertos permitem verificar. Os itens não verificáveis estão abaixo.
          </p>
        ) : (
          <ul className="mp-laudo-lista">
            {conferir.map((i) => (
              <Item key={i.item} i={i} />
            ))}
          </ul>
        )}
      </section>

      {GRUPOS.map((g) => {
        const itens = itensDoGrupo(p.itens, g.letra);
        if (!itens.length) return null;
        return (
          <section key={g.letra} aria-labelledby={`pix-grupo-${g.letra}`} className="mp-radar-secao">
            <h2 id={`pix-grupo-${g.letra}`} className="mp-radar-h2">
              {g.titulo}
            </h2>
            <ul className="mp-laudo-lista">
              {itens.map((i) => (
                <Item key={i.item} i={i} />
              ))}
            </ul>
            {g.letra === "B" && autor && (
              <p className="pa-nota">
                {autor.autor ?? "O autor"} teve {autor.planos} {autor.planos === 1 ? "plano" : "planos"} de transferência especial não impedidos em{" "}
                {autor.ano} no Brasil, somando {moedaCurta(autor.valor)}, dos quais {moedaCurta(autor.investimento)} em capital;{" "}
                {autor.planos_uf} na PB.
              </p>
            )}
          </section>
        );
      })}

      <PixNoTce tce={tce} desde={p.ano} />

      <section aria-labelledby="pix-metodo" className="mp-radar-secao">
        <h2 id="pix-metodo" className="mp-radar-h2">
          Fonte e método
        </h2>
        <ul className="mp-laudo-causas mp-laudo-miudo">
          <li>
            API pública das transferências especiais do Transferegov, retrato de {data(execucao.dado_ate)}; extrato, executores e documentos de
            liquidação lidos plano a plano para a PB.
          </li>
          <li>
            Normas lidas em 29/09/2026: IN-TCU 93/2024; LC 210/2024; Portaria Conjunta MF/MGI 15/2025; ADPF 854 (decisões de 02/12/2024,
            09/12/2024 e 24/08/2025); CF, art. 166-A. Cada item cita o dispositivo.
          </li>
          <li>
            O recebimento é a data da 1ª ordem bancária, no lugar do crédito em conta. O prazo de execução conta de 1º de janeiro do ano seguinte;
            para o que foi repassado antes de 18/01/2024, de 02/01/2025 (IN 93, art. 8º, p.ú.).
          </li>
          <li>
            Relatório de gestão: prazo único de 30/06/2026 para os planos de 2020 a 2025 (aviso do Transferegov de 23/06/2026); depois, 30 de junho
            de cada ano até o relatório final.
          </li>
          <li>
            Saída para o próprio ente: transferência da conta do plano para o CNPJ do beneficiário. A partir de 10% dos pagamentos da conta é alto; de
            2% a 10%, moderado (pode ser retenção de tributo); abaixo, informação.
          </li>
          <li>Pagamento a pessoa física aparece só somado, sem nome nem documento.</li>
          <li>
            Regras na versão {p.versao ?? "—"}. Laudo elaborado por PONTE Estruturação de Projetos de Impacto.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Item({ i }: { i: ItemLaudoPix }) {
  return (
    <li className={`pa-cartao mp-laudo-risco ${classeEstado(i)}`}>
      <p>
        <span className={`pa-tag mp-laudo-nivel ${classeEstado(i)}`}>{rotuloItem(i)}</span> <strong>{i.titulo}</strong>
      </p>
      <p>
        {i.fato} <span className="mp-laudo-miudo">({i.dispositivo})</span>
      </p>
    </li>
  );
}
