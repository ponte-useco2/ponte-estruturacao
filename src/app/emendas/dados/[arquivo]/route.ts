import type { NextRequest } from "next/server";
import {
  DICIONARIO_CATALOGO,
  DICIONARIO_LINHAS,
  DICIONARIO_PF,
  arquivoDoEndereco,
  csvDe,
  descreverConsulta,
  jsonComReais,
  jsonDe,
  lerConsulta,
  lerRecorteFixo,
  metadados,
  nomeDoArquivo,
  reais,
  type CampoDicionario,
  type ExecucaoPublica,
} from "@/lib/oportunidades/emendas-publico";
import {
  lerArquivoDaPf,
  lerArquivoDeLinhas,
  lerArquivoDoAno,
  lerArquivoDoCatalogo,
  lerArquivoDoRecorte,
  type LeituraArquivo,
} from "@/lib/oportunidades/emendas-publico.server";
import {
  DICIONARIO_RECORTE,
  anoAtualBrasilia,
  csvDoRecorte,
  descreverRecorte,
  exportado,
  lerRecorte,
  nomeDaAutoria,
  nomeDoArquivoDoRecorte,
  notaDoPeriodo,
  registroDaLinha,
  slugFuncao,
  textoPeriodo,
  totaisDoArquivo,
} from "@/lib/oportunidades/emendas-recorte";

/**
 * Os arquivos de dados abertos do portal das emendas (15.4; 17/11/2026), sem cadastro (decisão 3 do plano):
 *   · `linhas-AAAA.csv|json` — as linhas de um ano da emenda: o CAMINHO PRINCIPAL (cada ano fica bem abaixo do limite de
 *     4,5 MB da resposta de uma função da Vercel; tamanhos medidos em `arquivoDoEndereco`);
 *   · `linhas.csv|json` — todas as linhas (17.1), o recorte sem filtro: arquivo grande (~14 MB em CSV), que pode falhar
 *     na Vercel; a página de dados manda usar os arquivos por ano;
 *   · `recorte.csv|json` — versão 2 (com `periodo` no endereço): o recorte da tela de registros, com os MESMOS
 *     parâmetros dela (CONTRATO §11) — exatamente os registros (todas as páginas, na ordem da tabela), as colunas da tela,
 *     a coluna `ausencias` e, no JSON, os totais com a cobertura e a frase do período. Sem `periodo`, o recorte da v1
 *     (`q`, `t.emendas.*`, `autor`, `ibge`, `emenda`), que as páginas de apoio ainda usam;
 *   · `execucao-orcamentaria.csv|json` — o catálogo do Portal só nas linhas com a Paraíba (17.3);
 *   · `pessoa-fisica.csv|json` — a pessoa física somada por emenda e ano.
 *
 * CSV legível por máquina e pelo Excel em português (`paraCsv`: `;`, BOM, vírgula decimal, DD/MM/AAAA, proteção de
 * fórmula, os códigos como ="…"), com o cabeçalho na PRIMEIRA linha (sem notas em cima: a fonte, a data e a licença vão
 * no nome do arquivo, no JSON e na página de dados). JSON: `{ metadados, campos, linhas }`, cada linha uma lista na ordem de `campos`.
 *
 * Tudo ou nada: se uma das chamadas ao banco falha, o arquivo inteiro vira 503 (nunca um arquivo pela metade). O corpo
 * vai em partes (stream), e a CDN guarda a resposta por 6 horas (o dado muda uma vez por semana).
 */
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ponteprojetos.com.br";
const CACHE_PUBLICO = "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400";
const PARTE = 256 * 1024;

function erro(status: number, texto: string): Response {
  return new Response(texto, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

/** O corpo em partes de 256 kB: arquivo grande sem um corpo único na memória da resposta. */
function emPartes(texto: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(texto);
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controle) {
      if (i >= bytes.length) {
        controle.close();
        return;
      }
      controle.enqueue(bytes.subarray(i, i + PARTE));
      i += PARTE;
    },
  });
}

function responder<T>(
  leitura: LeituraArquivo<T>,
  o: { dicionario: readonly CampoDicionario<T>[]; formato: "csv" | "json"; base: string; titulo: string; descricao: string; recorte?: string[] },
): Response {
  if (leitura.estado === "sem_dado") return erro(404, "Dado ainda não publicado.");
  if (leitura.estado !== "ok") return erro(503, "A consulta não respondeu agora. Tente de novo em alguns minutos.");
  if (leitura.truncado) return erro(503, "O recorte passou do tamanho máximo do arquivo. Use um filtro.");
  const execucao: ExecucaoPublica = leitura.execucao;
  const nome = nomeDoArquivo(o.base, execucao.dadoAte, o.formato);
  const cabecalhos: Record<string, string> = {
    "Cache-Control": CACHE_PUBLICO,
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
  };
  if (o.formato === "csv") {
    return new Response(emPartes(csvDe(o.dicionario, leitura.linhas)), {
      headers: { ...cabecalhos, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"` },
    });
  }
  const meta = metadados({
    titulo: o.titulo,
    descricao: o.descricao,
    execucao,
    geradoEm: new Date().toISOString(),
    site: SITE_URL,
    recorte: o.recorte,
    total: leitura.linhas.length,
  });
  return new Response(emPartes(jsonDe(o.dicionario, leitura.linhas, meta)), {
    headers: { ...cabecalhos, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `inline; filename="${nome}"` },
  });
}

/** O arquivo do recorte da versão 2: os mesmos registros e totais da tela de registros com o mesmo endereço. */
async function recorteV2(sp: URLSearchParams, formato: "csv" | "json"): Promise<Response> {
  const r = lerRecorte(sp, anoAtualBrasilia());
  const l = await lerArquivoDoRecorte(r);
  if (l.estado === "sem_dado") return erro(404, "Dado ainda não publicado.");
  if (l.estado !== "ok") return erro(503, "A consulta não respondeu agora. Tente de novo em alguns minutos.");
  if (l.truncado) return erro(503, "O recorte passou do tamanho máximo do arquivo. Use um filtro ou os arquivos por ano.");
  const nomeMun = r.municipio ? (l.municipios.find((m) => m.ibge === r.municipio)?.nome ?? null) : null;
  const linhas = l.linhas.map((x) => exportado(registroDaLinha(x)));
  const nome = nomeDoArquivoDoRecorte(r, nomeMun, formato);
  const cabecalhos: Record<string, string> = {
    "Cache-Control": CACHE_PUBLICO,
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
  };
  if (formato === "csv") {
    return new Response(emPartes(csvDoRecorte(linhas)), {
      headers: { ...cabecalhos, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"` },
    });
  }
  const recorte = descreverRecorte(r, {
    municipio: nomeMun,
    autoria: (c) => nomeDaAutoria(c, l.autores.find((a) => a.codigo === c)?.nome ?? null),
    funcao: (f) => l.linhas.find((x) => x.funcao && slugFuncao(x.funcao) === f)?.funcao ?? f.replace(/-/g, " "),
  });
  const meta = {
    ...metadados({
      titulo: `Emendas parlamentares federais com destino ${nomeMun ? `a ${nomeMun}` : "à Paraíba"}: registros do recorte (${textoPeriodo(r.periodo)})`,
      descricao:
        "Os registros (emenda × destino × instrumento) do recorte da tela de registros do portal, com as mesmas colunas, na mesma ordem. O período é o ano da emenda; o realizado é acumulado até a data de referência.",
      execucao: l.execucao,
      geradoEm: new Date().toISOString(),
      site: SITE_URL,
      recorte,
      total: linhas.length,
    }),
    periodo: notaDoPeriodo(r.periodo, l.execucao.dadoAte),
    totais: Object.fromEntries(Object.entries(totaisDoArquivo(l.soma)).map(([k, v]) => [k, /^registros|^emendas/.test(k) ? v : reais(v)])),
    ausencias: "A coluna `ausencias` diz, em cada registro, os campos sem dado e o motivo (\"campo: motivo | campo: motivo\"). Zero é valor e não aparece ali.",
  };
  const campos = DICIONARIO_RECORTE.map((d) => d.campo);
  const emReais = DICIONARIO_RECORTE.map((d) => d.tipo === "número (reais)");
  // Os reais com duas casas (0.00), como no dicionário: `jsonComReais`.
  const corpo = jsonComReais({ metadados: meta, campos, linhas: linhas.map((x) => campos.map((c, i) => (emReais[i] ? reais(x[c]) : x[c]) ?? null)) });
  return new Response(emPartes(corpo), {
    headers: { ...cabecalhos, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `inline; filename="${nome}"` },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ arquivo: string }> }) {
  const arquivo = arquivoDoEndereco((await params).arquivo);
  if (!arquivo) return erro(404, "Arquivo não encontrado. Veja a lista em /emendas/dados.");
  const { conjunto, formato } = arquivo;
  if (conjunto === "recorte" && req.nextUrl.searchParams.has("periodo")) return recorteV2(req.nextUrl.searchParams, formato);

  if (arquivo.conjunto === "ano") {
    const ano = arquivo.ano;
    return responder(await lerArquivoDoAno(ano), {
      dicionario: DICIONARIO_LINHAS,
      formato,
      base: `linhas-${ano}`,
      titulo: `Emendas parlamentares federais com destino à Paraíba: linhas das emendas de ${ano}`,
      descricao: `As linhas (emenda × forma de repasse × instrumento) das emendas do ano ${ano}, com destino na Paraíba. Critério 17.1 do PNTP 2026 (referência).`,
      recorte: [`ano da emenda ${ano}`],
    });
  }
  if (conjunto === "linhas" || conjunto === "recorte") {
    const sp = req.nextUrl.searchParams;
    const consulta = conjunto === "recorte" ? lerConsulta(sp) : lerConsulta(new URLSearchParams());
    const fixo = conjunto === "recorte" ? lerRecorteFixo(sp) : {};
    const recorte = conjunto === "recorte" ? descreverConsulta(consulta, fixo) : [];
    return responder(await lerArquivoDeLinhas(consulta, fixo), {
      dicionario: DICIONARIO_LINHAS,
      formato,
      base: conjunto === "recorte" && recorte.length ? "recorte" : "linhas",
      titulo: "Emendas parlamentares federais com destino à Paraíba: linhas (emenda × forma de repasse × instrumento)",
      descricao:
        "Uma linha por emenda, forma de repasse e instrumento (convênio, plano de ação da transferência especial, proposta do FNS ou favorecido do pagamento direto), com destino na Paraíba. Critério 17.1 do PNTP 2026 (referência).",
      recorte,
    });
  }
  if (conjunto === "catalogo") {
    return responder(await lerArquivoDoCatalogo(), {
      dicionario: DICIONARIO_CATALOGO,
      formato,
      base: "execucao-orcamentaria",
      titulo: "Emendas parlamentares federais com destino à Paraíba: execução orçamentária no Portal da Transparência",
      descricao:
        "Empenhado, liquidado, pago, restos a pagar pagos e cancelados e o que falta pagar, só nas linhas do arquivo do Portal com a Paraíba na localidade. Critério 17.3 do PNTP 2026 (referência). Não se soma às linhas por forma de repasse.",
    });
  }
  return responder(await lerArquivoDaPf(), {
    dicionario: DICIONARIO_PF,
    formato,
    base: "pessoa-fisica",
    titulo: "Emendas parlamentares federais com destino à Paraíba: pagamentos a pessoas físicas, somados",
    descricao: "A soma dos pagamentos a pessoas físicas na Paraíba, por emenda e ano, sem nome e sem documento.",
  });
}
