/**
 * O e-mail diário do painel para a equipe: o que mudou no último dado do Transferegov.
 *
 * Função pura — recebe as contagens e as mudanças já lidas e devolve assunto, HTML e
 * texto. Quem lê do banco, decide se envia e marca como enviado é a rota
 * `/api/painel/resumo-diario`. Todo texto que veio do arquivo (proponente, objeto,
 * programa) passa por `escapar`: é dado de terceiros dentro de HTML.
 */
import { moedaCurta } from "./radar.ts";
import {
  ROTULO_GRUPO_MUDANCA,
  definicaoMudanca,
  descreverMudanca,
  diaDoDado,
  ordenarContagens,
  urlFicha,
  type ContagemMudanca,
  type MudancaPainel,
} from "./painel.ts";

/** A UF da equipe: os destaques do e-mail são dela; o painel tem o Brasil inteiro. */
export const UF_DESTAQUE = "PB";
export const LIMITE_DESTAQUES = 20;
/** A rota lê mais do que mostra: os destaques são escolhidos por grupo, e o banco ordena só por valor. */
export const LEITURA_DESTAQUES = 200;
const ORDEM_GRUPO = { avanco: 0, alerta: 1, registro: 2 } as const;

export interface EntradaResumo {
  dadoAte: string;
  /** O dado com que este foi comparado (menor `desde` das contagens). */
  desde: string | null;
  brasil: Pick<ContagemMudanca, "tipo" | "n" | "valor">[];
  uf: Pick<ContagemMudanca, "tipo" | "n" | "valor">[];
  destaques: MudancaPainel[];
  /** Sem barra no fim: https://ponteprojetos.com.br */
  urlBase: string;
}

export interface ResumoDiario {
  assunto: string;
  html: string;
  texto: string;
}

export function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/** O painel já filtrado: um tipo de mudança, no Brasil ou na UF. Mesmos parâmetros que `urlPainel` escreve. */
export function urlMudancas(urlBase: string, opcoes: { tipo?: string; uf?: string; municipio?: string } = {}): string {
  const q = new URLSearchParams({ visao: "mudancas" });
  if (opcoes.uf) q.set("uf", opcoes.uf);
  if (opcoes.municipio) q.set("municipio", opcoes.municipio);
  if (opcoes.tipo) q.set("tipo", opcoes.tipo);
  return `${urlBase}/mapa/painel?${q.toString()}`;
}

/** A página do item que mudou: convênio pelo número, proposta pelo id do SICONV (a `chave` de `painel_mudanca`). */
export function urlDoItem(urlBase: string, m: Pick<MudancaPainel, "alvo" | "chave">): string {
  const caminho = m.alvo === "proposta" ? "proposta" : "instrumento";
  return `${urlBase}/mapa/${caminho}/${encodeURIComponent(m.chave)}`;
}

const COR_GRUPO = { avanco: "#047857", alerta: "#b91c1c", registro: "#475569" } as const;
const n = (x: number) => x.toLocaleString("pt-BR");

export function montarResumoDiario(e: EntradaResumo): ResumoDiario {
  const dia = diaDoDado(e.dadoAte);
  const totalBr = e.brasil.reduce((s, l) => s + l.n, 0);
  const totalUf = e.uf.reduce((s, l) => s + l.n, 0);
  const porUf = new Map(e.uf.map((l) => [l.tipo, l]));
  const linhas = ordenarContagens(e.brasil).filter((l) => l.n > 0);
  // Avanços e alertas antes do registro; dentro do grupo, a ordem do banco (valor).
  const destaques = e.destaques
    .map((m, i) => ({ m, i, g: ORDEM_GRUPO[definicaoMudanca(m.tipo).grupo] }))
    .sort((a, b) => a.g - b.g || a.i - b.i)
    .slice(0, LIMITE_DESTAQUES)
    .map((x) => x.m);
  const link = `${e.urlBase}/mapa/painel?visao=mudancas&uf=${UF_DESTAQUE}`;
  const linkBrasil = `${e.urlBase}/mapa/painel?visao=mudancas`;
  const comparacao = e.desde ? `comparado com o de ${diaDoDado(e.desde)}` : "comparado com o dado anterior";

  const assunto = `[PONTE] O que mudou no Transferegov · dado de ${dia} · ${n(totalUf)} na ${UF_DESTAQUE}, ${n(totalBr)} no Brasil`;

  // ---------------------------------------------------------------- texto
  const texto = [
    `O que mudou no dado de ${dia} do Transferegov (${comparacao}).`,
    "",
    `Brasil: ${n(totalBr)} · ${UF_DESTAQUE}: ${n(totalUf)}`,
    ...linhas.map((l) => `- ${definicaoMudanca(l.tipo).rotulo}: ${n(l.n)} no Brasil, ${n(porUf.get(l.tipo)?.n ?? 0)} na ${UF_DESTAQUE}`),
    "",
    destaques.length ? `Destaques na ${UF_DESTAQUE}:` : `Nenhuma mudança na ${UF_DESTAQUE} neste dado.`,
    ...destaques.map((m) => {
      const frase = descreverMudanca(m);
      return `- ${definicaoMudanca(m.tipo).rotulo} · ${m.proponente ?? "—"} (${m.municipio ?? "—"}) · ${
        m.alvo === "proposta" ? "proposta" : "convênio"
      } nº ${m.numero ?? m.chave}${frase ? ` · ${frase}` : ""}${m.valor !== null ? ` · ${moedaCurta(m.valor)}` : ""}\n  ${urlDoItem(e.urlBase, m)}`;
    }),
    "",
    `No painel: ${link}`,
    "",
    "—",
    "Resumo automático do Painel da PONTE para os administradores. O painel só abre com login.",
  ].join("\n");

  // ---------------------------------------------------------------- HTML
  // Cada linha leva ao painel já filtrado naquele tipo: o número do Brasil abre o Brasil, o da UF abre a UF.
  // Zero não vira link: levaria a uma lista vazia.
  const CELULA = "padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:14px;";
  const elo = (texto: string, url: string | null) =>
    url ? `<a href="${escapar(url)}" style="color:#0f172a;text-decoration:underline;">${texto}</a>` : texto;
  const linhasTabela = linhas
    .map((l) => {
      const def = definicaoMudanca(l.tipo);
      const uf = porUf.get(l.tipo)?.n ?? 0;
      const doTipo = urlMudancas(e.urlBase, { tipo: l.tipo });
      return `<tr>
        <td style="${CELULA}"><span style="color:${COR_GRUPO[def.grupo]};font-weight:600;">●</span> ${elo(escapar(def.rotulo), doTipo)}</td>
        <td style="${CELULA}text-align:right;">${elo(n(l.n), l.n ? doTipo : null)}</td>
        <td style="${CELULA}text-align:right;font-weight:${uf ? 700 : 400};">${elo(n(uf), uf ? urlMudancas(e.urlBase, { tipo: l.tipo, uf: UF_DESTAQUE }) : null)}</td>
      </tr>`;
    })
    .join("");

  // No destaque, o nome abre o item (convênio ou proposta) e o município abre a ficha dele no painel.
  const linhasDestaque = destaques
    .map((m) => {
      const def = definicaoMudanca(m.tipo);
      const frase = descreverMudanca(m);
      const lugar = escapar(m.municipio ?? "—");
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:12px;font-weight:700;color:${COR_GRUPO[def.grupo]};text-transform:uppercase;letter-spacing:0.04em;">${escapar(def.rotulo)}</div>
        <div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:2px;">${elo(escapar(m.proponente ?? "—"), urlDoItem(e.urlBase, m))} · ${
          m.cod_ibge ? elo(lugar, `${e.urlBase}${urlFicha({ ibge: m.cod_ibge })}`) : lugar
        }</div>
        <div style="font-size:13px;color:#475569;margin-top:2px;">${elo(
          `${m.alvo === "proposta" ? "Proposta" : "Convênio"} nº ${escapar(m.numero ?? m.chave)}`,
          urlDoItem(e.urlBase, m),
        )}${frase ? ` · ${escapar(frase)}` : ""}${m.valor !== null ? ` · <strong>${escapar(moedaCurta(m.valor))}</strong>` : ""}</div>
        ${m.programa ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${escapar(m.programa)}</div>` : ""}
      </td></tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapar(assunto)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:20px 24px;background:#059669;color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;">Painel da PONTE · resumo diário</div>
          <div style="font-size:20px;font-weight:700;margin-top:4px;">O que mudou no dado de ${escapar(dia)}</div>
          <div style="font-size:13px;opacity:0.9;margin-top:4px;">${escapar(comparacao)} · ${n(totalUf)} na ${UF_DESTAQUE}, ${n(totalBr)} no Brasil</div>
        </td></tr>
        <tr><td style="padding:16px 24px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <th align="left" style="padding:6px 10px;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0;">Mudança</th>
              <th align="right" style="padding:6px 10px;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0;">Brasil</th>
              <th align="right" style="padding:6px 10px;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0;">${UF_DESTAQUE}</th>
            </tr>
            ${linhasTabela}
          </table>
          <p style="font-size:12px;color:#64748b;margin:8px 0 0;">● ${ROTULO_GRUPO_MUDANCA.avanco} em verde, ${ROTULO_GRUPO_MUDANCA.alerta.toLowerCase()} em vermelho, ${ROTULO_GRUPO_MUDANCA.registro.toLowerCase()} em cinza.</p>
        </td></tr>
        <tr><td style="padding:16px 24px 4px;">
          <div style="font-size:16px;font-weight:700;">${destaques.length ? `Destaques na ${UF_DESTAQUE}` : `Nenhuma mudança na ${UF_DESTAQUE} neste dado`}</div>
          ${
            destaques.length
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${linhasDestaque}</table>${
                  totalUf > destaques.length
                    ? `<p style="font-size:13px;color:#475569;">Mais ${n(totalUf - destaques.length)} no painel.</p>`
                    : ""
                }`
              : ""
          }
        </td></tr>
        <tr><td style="padding:12px 24px 20px;">
          <a href="${escapar(link)}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;margin-right:8px;">Abrir no painel (${UF_DESTAQUE})</a>
          <a href="${escapar(linkBrasil)}" style="display:inline-block;color:#0f172a;padding:10px 4px;font-size:14px;font-weight:600;">Brasil</a>
        </td></tr>
        <tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;">
          Resumo automático do Painel da PONTE para os administradores. O painel só abre com login. Valor é o repasse, ou o desembolsado, o saldo ou o que falta desembolsar, conforme o tipo.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { assunto: assunto.replace(/[\r\n]+/g, " "), html, texto };
}
