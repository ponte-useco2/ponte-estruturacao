/**
 * Leitura da página da UF (U1, 08/10/2026) — só servidor, só chave de serviço.
 *
 * Quem decide se a pessoa pode ver é a página (o portão de aprovados do `/mapa`). Cada fonte é lida pela sua
 * última execução e falha sozinha: o que cair entra em `faltas` e a página sai sem o bloco. As somas nacionais vêm
 * prontas do job (`painel_territorio`, oport_34); as da UF por município e por proponente, de duas funções que
 * usam o índice por UF. A Paraíba ganha ainda o fiscal (nome e população dos 223), as regiões imediatas e o porte
 * (camada 2), os indicadores do estado e as OSC ativas. Memória de 10 minutos por UF: as fontes mudam uma vez por dia.
 *
 * Onda 7, A (09/10/2026): a leitura de quem não é administrador ganha a camada comum às instâncias
 * (`cache-dados.server.ts`), também de 10 minutos, e só com a leitura inteira (sem faltas). A do administrador traz a
 * decisão B do fiscal e os sinais do painel, que só ele vê: fica fora do cache comum, só na memória da instância, como
 * antes (R2 de 09/10, §5.1 item 3). São poucos administradores; o ganho seria pequeno e o risco, de dado interno.
 *
 * Onda 8, B (09/10/2026): a última execução do painel vai junto com as das outras fontes, e a leitura a frio perde uma
 * ida e volta em série (PB: de 3 para 2; SP, com 3 páginas de proponentes: de 5 para 4). Os pedidos e o resultado são os
 * mesmos.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { VALIDADE_DADOS_MS } from "./cache-dados";
import { camadaDoCacheDeDados } from "./cache-dados.server";
import { ehEsquemaAusente } from "./esquema";
import { conclusaoDe, type MunicipioFiscal } from "./fiscal";
import catalogoIndicadores from "./indicadores-municipio.json";
import type { ItemCatalogo } from "./indicadores-municipio";
import { criarMemoria } from "./memoria";
import { ehUfCompleta, indicadoresDaUf, type IndicadorUf, type LinhaTerritorio, type MunicipioUf, type ProponenteUf } from "./pagina-uf";
import { tituloOrgao } from "./padroes";
import { todas } from "./padroes.server";
import type { LinhaDesfecho, LinhaEtapa } from "./painel";
import type { LinhaEspecialAno, LinhaFundoAno } from "./pix";

type Banco = ReturnType<typeof clienteServidor>;
type Resposta = { data: unknown; error: { message: string; code?: string } | null };

export interface LeituraUfOk {
  estado: "ok";
  sigla: string;
  completa: boolean;
  execucao: { id: number; referencia: string | null; dado_ate: string | null };
  /** `painel_territorio` da UF e do Brasil; null antes da primeira rodada do job com a oport_34. */
  territorio: LinhaTerritorio[] | null;
  proponentes: ProponenteUf[] | null;
  municipios: MunicipioUf[] | null;
  etapas: LinhaEtapa[] | null;
  desfechos: LinhaDesfecho[] | null;
  pix: LinhaEspecialAno[] | null;
  fundo: LinhaFundoAno[] | null;
  janelas: number | null;
  indicadores: IndicadorUf[] | null;
  /** Só a PB: as OSC ativas no Mapa das OSC e a versão do arquivo. */
  osc: { ativas: number; versao: string | null } | null;
  faltas: string[];
}

export type LeituraUf = { estado: "nao_ativado" } | { estado: "sem_execucao" } | { estado: "erro" } | LeituraUfOk;

/** Uma leitura que pode faltar: erro vira null e entra em `faltas` (a tabela que ainda não existe não é erro). */
async function ler<T>(faltas: string[], nome: string, consulta: PromiseLike<Resposta>): Promise<T | null> {
  const r = await consulta;
  if (r.error) {
    if (!ehEsquemaAusente(r.error.code)) {
      console.error(`página da UF (${nome}):`, r.error.message);
      faltas.push(nome);
    }
    return null;
  }
  return r.data as T;
}

async function ultimaId(db: Banco, rpc: string): Promise<number | null> {
  const r = await db.rpc(rpc);
  if (r.error) return null;
  return ((r.data as { id: number }[] | null) ?? [])[0]?.id ?? null;
}

const memoria = criarMemoria<LeituraUf>({
  validadeMs: VALIDADE_DADOS_MS,
  maximo: 30,
  guardar: (l) => l.estado === "ok",
  compartilhada: camadaDoCacheDeDados<LeituraUf>({ leitor: "uf", guardavel: (l) => l.estado === "ok" && l.faltas.length === 0 }),
});
const memoriaAdministrador = criarMemoria<LeituraUf>({ validadeMs: VALIDADE_DADOS_MS, maximo: 30, guardar: (l) => l.estado === "ok" });

/** A página de uma UF, da memória ou do cache quando há. Não altere o objeto devolvido. */
export function lerUf(sigla: string, administrador: boolean): Promise<LeituraUf> {
  return administrador
    ? memoriaAdministrador.obter(`${sigla}|adm`, () => lerDoBanco(sigla, true))
    : memoria.obter(`${sigla}|`, () => lerDoBanco(sigla, false));
}

async function lerDoBanco(sigla: string, administrador: boolean): Promise<LeituraUf> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const faltas: string[] = [];

  const completa = ehUfCompleta(sigla);

  // Onda 8, B (09/10/2026): as últimas execuções numa ida só. Antes, as das outras fontes esperavam a do painel, uma ida
  // e volta a mais (~300 ms de iad1 a Oregon, R2 §2.9). Sem o painel, o resultado é o mesmo de antes: as outras leituras
  // se perdem, e a página diz "não ativado", "erro" ou "sem execução".
  const [painel, pixId, radarId, munId, oscId, fiscalId] = await Promise.all([
    db.rpc("painel_ultima_execucao"),
    ultimaId(db, "pix_ultima_execucao"),
    ultimaId(db, "radar_ultima_execucao"),
    completa ? ultimaId(db, "mun_ultima_execucao") : Promise.resolve(null),
    completa ? ultimaId(db, "osc_ultima_execucao") : Promise.resolve(null),
    completa ? ultimaId(db, "fiscal_ultima_execucao") : Promise.resolve(null),
  ]);
  if (painel.error) {
    if (ehEsquemaAusente(painel.error.code)) return { estado: "nao_ativado" };
    console.error("página da UF (painel):", painel.error.message);
    return { estado: "erro" };
  }
  const ex = ((painel.data as { id: number; referencia: string | null; dado_ate: string | null }[] | null) ?? [])[0];
  if (!ex) return { estado: "sem_execucao" };

  const [territorio, proponentes, porMunicipio, etapas, desfechos, pix, fundo, janelas, refs, grupos, oscMun, oscVersao, fiscal, sinais] =
    await Promise.all([
      ler<LinhaTerritorio[]>(faltas, "somas do território",
        db.from("painel_territorio").select("recorte,dimensao,chave,vivo,n,em_execucao,valor,desembolsado,municipios,proponentes").eq("execucao_id", ex.id).in("recorte", [sigla, "BR"]).limit(5000)),
      // a API devolve no máximo mil linhas por pedido: SP tem ~2 mil proponentes com instrumento vivo
      todas<ProponenteUf>("página da UF (proponentes)", (a, b) => db.rpc("painel_territorio_proponente", { p_execucao: ex.id, p_uf: sigla }).order("cnpj").range(a, b))
        .then((r) => (Array.isArray(r) ? r : (faltas.push("proponentes"), null))),
      ler<{ cod_ibge: string; municipio: string | null; instrumentos: number; vivos: number; em_execucao: number; valor_execucao: number; ultimo_ano: number | null }[]>(
        faltas, "municípios", db.rpc("painel_territorio_municipio", { p_execucao: ex.id, p_uf: sigla }).limit(2000)),
      ler<LinhaEtapa[]>(faltas, "tempos",
        db.from("painel_etapa_tempo").select("*").eq("execucao_id", ex.id).eq("dimensao", "orgao").in("recorte", [sigla, "BR"]).limit(3000)),
      ler<LinhaDesfecho[]>(faltas, "funil",
        db.from("painel_programa_desfecho").select("*").eq("execucao_id", ex.id).in("uf", [sigla, "BR"]).is("cod_programa", null).is("orgao_sup", null).limit(100)),
      pixId ? ler<LinhaEspecialAno[]>(faltas, "Pix", db.from("pix_especial_ano").select("*").eq("execucao_id", pixId).in("recorte", [sigla, "BR"]).limit(100)) : Promise.resolve(null),
      pixId ? ler<LinhaFundoAno[]>(faltas, "fundo a fundo", db.from("pix_fundo_ano").select("*").eq("execucao_id", pixId).eq("recorte", sigla).limit(1000)) : Promise.resolve(null),
      radarId
        ? db.from("radar_programa_aberto").select("cod_programa", { count: "exact", head: true }).eq("execucao_id", radarId).eq("uf", sigla).then((r) => (r.error ? null : (r.count ?? 0)))
        : Promise.resolve(null),
      munId ? ler<{ indicador: string; ano: string; recorte: string; valor: number | null }[]>(faltas, "indicadores",
        db.from("mun_referencia").select("indicador,ano,recorte,valor").eq("execucao_id", munId).in("recorte", [sigla, "BR"]).limit(2000)) : Promise.resolve(null),
      munId ? ler<{ ibge: string; porte: string | null; regiao_imediata: string | null; regiao_intermediaria: string | null }[]>(faltas, "regiões",
        db.from("mun_grupo").select("ibge,porte,regiao_imediata,regiao_intermediaria").eq("execucao_id", munId).limit(1000)) : Promise.resolve(null),
      oscId ? ler<{ cod_ibge: string; ativas: number }[]>(faltas, "OSC", db.from("osc_municipio").select("cod_ibge,ativas").eq("execucao_id", oscId).limit(1000)) : Promise.resolve(null),
      oscId ? db.from("osc_execucao").select("versao_fonte").eq("id", oscId).limit(1).then((r) => ((r.data as { versao_fonte: string | null }[] | null) ?? [])[0]?.versao_fonte ?? null) : Promise.resolve(null),
      fiscalId ? ler<Pick<MunicipioFiscal, "ibge" | "nome" | "populacao" | "conclusoes">[]>(faltas, "fiscal",
        db.from("fiscal_municipio").select("ibge,nome,populacao,conclusoes").eq("execucao_id", fiscalId).limit(1000)) : Promise.resolve(null),
      completa && administrador
        ? ler<{ cod_ibge: string; n_sinais: number | null }[]>(faltas, "sinais do painel", db.from("painel_municipio").select("cod_ibge,n_sinais").eq("execucao_id", ex.id).like("cod_ibge", "25%").limit(1000))
        : Promise.resolve(null),
    ]);

  // A lista dos municípios: na PB, os 223 do fiscal (nome com acento e população) com as somas, a região e as OSC;
  // nas outras UFs, os que têm instrumento, com o nome do SICONV.
  const somas = new Map((porMunicipio ?? []).map((m) => [m.cod_ibge, m]));
  const grupo = new Map((grupos ?? []).map((g) => [g.ibge, g]));
  const oscPor = new Map((oscMun ?? []).map((o) => [o.cod_ibge, o.ativas]));
  const sinaisPor = new Map((sinais ?? []).map((s) => [s.cod_ibge, s.n_sinais]));
  const base: { ibge: string; nome: string; populacao: number | null; decisao_b?: string | null }[] =
    completa && fiscal?.length
      ? fiscal.map((f) => ({ ibge: f.ibge, nome: f.nome, populacao: f.populacao, decisao_b: administrador ? (conclusaoDe(f as MunicipioFiscal, "B")?.estado ?? null) : undefined }))
      : (porMunicipio ?? []).map((m) => ({ ibge: m.cod_ibge, nome: m.municipio ? tituloOrgao(m.municipio) : m.cod_ibge, populacao: null }));
  const municipios: MunicipioUf[] | null =
    porMunicipio === null && !fiscal
      ? null
      : base.map((b) => {
          const s = somas.get(b.ibge);
          const g = grupo.get(b.ibge);
          return {
            ibge: b.ibge,
            nome: b.nome,
            populacao: b.populacao,
            porte: g?.porte ?? null,
            regiao: g?.regiao_imediata ?? null,
            intermediaria: g?.regiao_intermediaria ?? null,
            instrumentos: s?.instrumentos ?? 0,
            em_execucao: s?.em_execucao ?? 0,
            valor_execucao: Number(s?.valor_execucao ?? 0),
            osc_ativas: oscMun ? (oscPor.get(b.ibge) ?? 0) : null,
            ...(administrador ? { decisao_b: b.decisao_b ?? null, sinais: sinais ? (sinaisPor.get(b.ibge) ?? 0) : null } : {}),
          };
        });

  return {
    estado: "ok",
    sigla,
    completa,
    execucao: ex,
    territorio: territorio?.length ? territorio.map((l) => ({ ...l, valor: Number(l.valor), desembolsado: Number(l.desembolsado) })) : null,
    proponentes: proponentes ? proponentes.map((p) => ({ ...p, valor: Number(p.valor) })) : null,
    municipios,
    etapas,
    desfechos,
    pix,
    fundo,
    janelas,
    indicadores: refs ? indicadoresDaUf(refs, (catalogoIndicadores as { indicadores: ItemCatalogo[] }).indicadores, sigla) : null,
    osc: oscMun ? { ativas: oscMun.reduce((s, o) => s + o.ativas, 0), versao: oscVersao } : null,
    faltas,
  };
}
