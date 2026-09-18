/**
 * Checklist preventivo de um órgão: condições que o termo costuma impor, documentos que o concedente
 * pede (os que vencem marcados), os pedidos nas palavras dele e o tempo típico até a retirada.
 * Sem órgão escolhido, mostra a lista dos órgãos que têm base na coleta.
 */
import Link from "next/link";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { COORTE_DESDE, MINIMO_PADRAO, lerHistorico, montarChecklist, tituloOrgao } from "@/lib/oportunidades/padroes";
import type { LeituraPadroes } from "@/lib/oportunidades/padroes.server";
import { BotaoImprimir } from "../../fiscal/[ibge]/simular/BotaoImprimir";

type LeituraOk = Extract<LeituraPadroes, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const dias = (x: number | null) => (x === null ? "—" : `${n(Math.round(x))} dias`);
const url = (orgao: string) => `/mapa/suspensivas/checklist?orgao=${encodeURIComponent(orgao)}`;
/** Documento pedido em pelo menos esta fatia dos convênios do órgão entra no checklist. */
const FATIA_DOCUMENTO = 0.2;
const MAX_PALAVRAS = 6;

export function ChecklistConteudo({ leitura, hoje, orgao }: { leitura: LeituraOk; hoje: string; orgao: string | null }) {
  const contagem = new Map<string, number>();
  for (const a of leitura.atuais) if (a.orgao_sup) contagem.set(a.orgao_sup, (contagem.get(a.orgao_sup) ?? 0) + 1);
  const orgaos = [...contagem].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  // O órgão vem da URL: só vale se existir no dado. Valor desconhecido volta para a escolha.
  const escolhido = orgao && contagem.has(orgao) ? orgao : null;

  if (!escolhido) {
    return (
      <div className="pa-pagina pa-pagina-estreita mp-radar">
        <div className="pa-pilha mp-radar-cabeca">
          <p className="pa-kicker">Checklist preventivo</p>
          <h1 className="pa-titulo">Antes de mandar uma proposta, veja o que o órgão costuma exigir</h1>
          <p className="pa-sub">
            Aprendido com os convênios da PB que estão presos na cláusula suspensiva: as condições que o termo impôs, os documentos que o concedente
            pediu e os pedidos nas palavras dele. Escolha o órgão.
          </p>
          {orgao && <p className="pa-cartao pa-cartao-plano">Não há convênio em suspensiva de “{orgao}” na coleta.</p>}
        </div>
        <ul className="mp-checklist-orgaos">
          {orgaos.map(([o, q]) => (
            <li key={o}>
              <Link href={url(o)} className="pa-cartao mp-checklist-orgao">
                <strong>{tituloOrgao(o)}</strong>
                <span className="mp-laudo-miudo">
                  {n(q)} {q === 1 ? "convênio" : "convênios"} em suspensiva{q < MINIMO_PADRAO ? " · poucos casos" : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const historico = lerHistorico(leitura.historico).orgaos;
  const c = montarChecklist(escolhido, hoje, leitura.atuais, leitura.documentos, leitura.detalhes, historico);
  const documentos = c.documentos.filter((d) => d.fatia >= FATIA_DOCUMENTO);
  const h = c.historico;
  const terminados = h ? h.destinos.saiu.n + h.destinos.morreu.n + h.destinos.encerrou.n : 0;

  return (
    <div className="pa-pagina mp-radar mp-checklist">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Checklist preventivo</p>
        <h1 className="pa-titulo">{tituloOrgao(escolhido)}</h1>
        <p className="pa-sub">
          O que ter pronto antes de mandar uma proposta a este órgão, aprendido com {n(c.base)} {c.base === 1 ? "convênio" : "convênios"} da PB que
          seguem presos na cláusula suspensiva.
          {c.base < MINIMO_PADRAO ? " São poucos casos: leia como indício, não como regra." : ""}
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          <Link href="/mapa/suspensivas/checklist" className="pa-btn pa-btn-pequeno">
            Outro órgão
          </Link>
          <Link href={`/mapa/suspensivas?orgao=${encodeURIComponent(escolhido)}`} className="pa-btn pa-btn-pequeno">
            Os convênios deste órgão
          </Link>
        </p>
        <p className="mp-fiscal-aviso">
          Não é a lista oficial de exigências: é o que os registros mostram. Confira sempre o edital do programa, a portaria e o termo.
        </p>
      </div>

      {h && terminados > 0 && (
        <section aria-labelledby="checklist-tempo" className="mp-radar-secao">
          <h2 id="checklist-tempo" className="mp-radar-h2">
            Quanto tempo leva, e quanto se perde
          </h2>
          <div className="pa-cartao mp-laudo-frase">
            <p>
              Dos convênios da PB deste órgão assinados desde {formatarData(COORTE_DESDE)} que tiveram suspensiva, {n(h.destinos.saiu.n)} saíram — na
              mediana, {dias(h.mediana)} depois da assinatura
              {h.p75 !== null ? `; um em cada quatro levou mais de ${dias(h.p75)}` : ""}.
            </p>
            <p>
              {n(h.destinos.morreu.n + h.destinos.encerrou.n)} morreram na suspensiva, sem um real desembolsado:{" "}
              {pct((h.destinos.morreu.n + h.destinos.encerrou.n) / terminados)} dos que terminaram.
            </p>
          </div>
        </section>
      )}

      <section aria-labelledby="checklist-condicoes" className="mp-radar-secao">
        <h2 id="checklist-condicoes" className="mp-radar-h2">
          Condições que o termo costuma impor
        </h2>
        <p className="pa-nota">
          Cada uma é uma providência que pode — e deve — começar antes da assinatura: é o que segura a liberação depois.
        </p>
        <ul className="mp-checklist-itens">
          {c.condicoes.map((x) => (
            <li key={x.texto}>
              <span className="mp-checklist-caixa" aria-hidden="true" />
              <span>
                <strong>{x.texto}</strong> <span className="mp-laudo-miudo">— em {pct(x.fatia)} dos convênios ({n(x.convenios)})</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="checklist-documentos" className="mp-radar-secao">
        <h2 id="checklist-documentos" className="mp-radar-h2">
          Documentos que o concedente pede
        </h2>
        <p className="pa-nota">
          Os anexados em pelo menos {pct(FATIA_DOCUMENTO)} dos convênios deste órgão. Os marcados perdem a validade ou precisam ser recentes
          (certidões, declarações, comprovantes, CAUC): tire perto do envio e confira de novo antes de cada nova análise.
        </p>
        {documentos.length ? (
          <ul className="mp-checklist-itens">
            {documentos.map((d) => (
              <li key={d.requisito}>
                <span className="mp-checklist-caixa" aria-hidden="true" />
                <span>
                  <strong>{d.requisito}</strong> <span className="mp-laudo-miudo">— em {pct(d.fatia)} dos convênios</span>
                  {d.vence && <span className="pa-tag mp-checklist-vence">vence: tirar perto do envio</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pa-cartao pa-cartao-plano">Nenhum documento se repete o bastante neste órgão para entrar na lista.</p>
        )}
      </section>

      <section aria-labelledby="checklist-palavras" className="mp-radar-secao">
        <h2 id="checklist-palavras" className="mp-radar-h2">
          Nas palavras do concedente
        </h2>
        {c.palavras.length ? (
          <>
            <p className="pa-nota">Os pedidos de complementação deste órgão, do que mais se repete ao que menos, como foram escritos.</p>
            {c.palavras.slice(0, MAX_PALAVRAS).map((p) => (
              <blockquote key={p.texto} className="mp-laudo-texto">
                <p>{p.texto}</p>
                <footer className="mp-laudo-miudo">
                  em {n(p.convenios)} {p.convenios === 1 ? "convênio" : "convênios"}
                  {p.vezes > p.convenios ? `, ${n(p.vezes)} vezes` : ""}
                </footer>
              </blockquote>
            ))}
          </>
        ) : (
          <p className="pa-cartao pa-cartao-plano">A coleta não trouxe pedido de complementação com texto para este órgão.</p>
        )}
      </section>

      <p className="pa-nota">
        Condições: motivo da cláusula suspensiva nos dados abertos do Transferegov. Documentos e pedidos: coleta no Acesso Livre de{" "}
        {formatarPublicacao(leitura.coletadoEm)} (o texto vem dos três eventos mais recentes de cada convênio). Tempo e perda: histórico dos dados
        abertos, atualizado todo dia.
      </p>
    </div>
  );
}
