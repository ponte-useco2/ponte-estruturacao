/**
 * As telas das emendas estaduais (E2, 16/10/2026): colunas, valores crus e títulos. Retrato sintético mínimo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  COLUNAS_ANOS_DEPUTADO,
  COLUNAS_CREDORES,
  COLUNAS_DEPUTADOS,
  COLUNAS_DESTINO_EMENDA,
  COLUNAS_EMENDAS,
  COLUNAS_EMENDAS_DO_LUGAR,
  COLUNAS_FILA,
  COLUNAS_MUNICIPIOS,
  TABELA_ANOS_DEPUTADO,
  TABELA_CREDORES_DEPUTADO,
  TABELA_DEPUTADOS,
  TABELA_DESTINO_EMENDA,
  TABELA_EMENDAS_DEPUTADO,
  TABELA_EPB_ENTIDADE,
  TABELA_EPB_ENTIDADES_MUNICIPIO,
  TABELA_EPB_MUNICIPIO,
  TABELA_FILA,
  TABELA_MUNICIPIOS_DEPUTADO,
  porcento,
  resumir,
  tituloAssembleia,
  tituloDeputado,
  tituloEmendaEpb,
  valoresDaEmenda,
  valoresDaEmendaNoLugar,
  valoresDaFila,
  valoresDoAno,
  valoresDoCredor,
  valoresDoDeputado,
  valoresDoDestino,
  valoresDoMunicipio,
  vezDaEmenda,
} from "./assembleia-tela.ts";
import { anosDoDeputado, deputadosDoRetrato, destinoDe, emendasDoRetrato, filaDoCiclo, type RetratoEpb } from "./emendas-pb.ts";
import { idValido, type ColunaTabela } from "./tabela-filtro.ts";

const HOJE = "2026-10-16";

const RETRATO: RetratoEpb = {
  execucao: { id: 1, concluidaEm: "2026-10-16T14:55:43Z", dadoAte: "2026-10-16T14:52:57Z", referencia: HOJE, anosLidos: [2025] },
  catalogo: [
    {
      ano: 2025, emenda: "0001/2025", seq: 1, autor_publicado: "DEP A CIVIL", pessoa: "DEP A", orgao: "SEC", unidade: null, funcao: null,
      subfuncao: null, programa: null, acao: null, natureza: null, fonte_recurso: null, modalidade: "TRANSFERÊNCIAS A MUNICÍPIOS",
      elemento: null, valor_emenda: 100_000, empenhado: 100_000, liquidado: 50_000, pago: 50_000,
    },
  ],
  fichas: [
    {
      ano: 2025, emenda: "0001/2025", prioridade: 1, deputado_publicado: "DEP A", pessoa: "DEP A", autoria_divergente: false, no_catalogo: true,
      tipo: "IMPOSITIVA", secretaria: "SECRETARIA DE ESTADO DA SAÚDE", objeto: "Equipamentos", retificacao_objeto: null,
      beneficiario_final: null, beneficiario_retido: false, tipo_entidade: null, valor: 100_000, passo: "empenhada", passo_em: "2025-06-10",
      devolvida: false, datas_fora_de_ordem: false,
    },
  ],
  destinos: [
    {
      ano: 2025, emenda: "0001/2025", credor_cnpj: "08939944000130", credor_nome: "FUNDO MUNICIPAL DE SAUDE", ibge: "2510808",
      municipio: "Patos", orgao: "SEC", empenhado: 100_000, liquidado: 50_000, pago: 50_000, notas: 2, primeira: "2025-06-10",
      ultima: "2025-07-01",
    },
  ],
  autores: [{ pessoa: "DEP A", pessoa_fonte: "teste", grafias_catalogo: ["DEP A CIVIL"], grafias_ficha: ["DEP A"], emendas: 1, anos: [2025] }],
  pf: [],
};

/** Toda coluna tem id válido e único, e todo valor cru tem a sua coluna (e vice-versa). */
function confere(tabela: string, colunas: ColunaTabela[], valores: Record<string, unknown>) {
  assert.ok(idValido(tabela), tabela);
  const ids = colunas.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, `${tabela}: ids repetidos`);
  for (const id of ids) assert.ok(idValido(id), `${tabela}.${id}`);
  assert.deepEqual(Object.keys(valores).sort(), [...ids].sort(), tabela);
}

test("cada tabela: ids válidos e únicos, e os valores crus batem com as colunas", () => {
  const emendas = emendasDoRetrato(RETRATO);
  const [dep] = deputadosDoRetrato(RETRATO);
  const destino = destinoDe(RETRATO, emendas);
  const lugar = { ...emendas[0], empenhadoAqui: 100_000, pagoAqui: 50_000 };
  confere(TABELA_DEPUTADOS, COLUNAS_DEPUTADOS, valoresDoDeputado(dep));
  confere(TABELA_FILA, COLUNAS_FILA, valoresDaFila(filaDoCiclo(RETRATO, HOJE)[0]));
  confere(TABELA_ANOS_DEPUTADO, COLUNAS_ANOS_DEPUTADO, valoresDoAno(anosDoDeputado(emendas, "DEP A")[0]));
  confere(TABELA_EMENDAS_DEPUTADO, COLUNAS_EMENDAS, valoresDaEmenda(emendas[0], HOJE));
  confere(TABELA_MUNICIPIOS_DEPUTADO, COLUNAS_MUNICIPIOS, valoresDoMunicipio(destino.municipios[0]));
  confere(TABELA_CREDORES_DEPUTADO, COLUNAS_CREDORES, valoresDoCredor(destino.credores[0]));
  confere(TABELA_DESTINO_EMENDA, COLUNAS_DESTINO_EMENDA, valoresDoDestino(RETRATO.destinos[0]));
  for (const t of [TABELA_EPB_MUNICIPIO, TABELA_EPB_ENTIDADES_MUNICIPIO, TABELA_EPB_ENTIDADE]) {
    confere(t, COLUNAS_EMENDAS_DO_LUGAR, valoresDaEmendaNoLugar(lugar));
  }
  const tabelas = [
    TABELA_DEPUTADOS, TABELA_FILA, TABELA_ANOS_DEPUTADO, TABELA_EMENDAS_DEPUTADO, TABELA_MUNICIPIOS_DEPUTADO, TABELA_CREDORES_DEPUTADO,
    TABELA_DESTINO_EMENDA, TABELA_EPB_MUNICIPIO, TABELA_EPB_ENTIDADES_MUNICIPIO, TABELA_EPB_ENTIDADE,
  ];
  assert.equal(new Set(tabelas).size, tabelas.length, "cada tabela com o seu prefixo no endereço");
});

test("os valores: o passo por extenso, os dias contados hoje e a vez só com data", () => {
  const [e] = emendasDoRetrato(RETRATO);
  const v = valoresDaEmenda(e, HOJE);
  assert.deepEqual([v.passo, v.dias, v.modalidade], ["Empenhada, falta pagar", 493, "Transferência a municípios"]);
  assert.equal(vezDaEmenda(e), "Órgão executor (pagamento)");
  assert.equal(vezDaEmenda({ ...e, passoEm: null }), null);
  assert.equal(vezDaEmenda({ ...e, passo: "paga" }), null);
  assert.equal(vezDaEmenda({ ...e, temFicha: false }), null);
  const fila = valoresDaFila(filaDoCiclo(RETRATO, HOJE)[0]);
  assert.deepEqual([fila["falta-pagar"], fila.vez, fila.devolvida], [50_000, "Órgão executor (pagamento)", "Não"]);
  assert.equal(valoresDoDeputado(deputadosDoRetrato(RETRATO)[0])["pct-pago"], 50);
});

test("o objeto longo na célula: cortado na palavra, com reticências; curto, inteiro", () => {
  assert.equal(resumir("Aquisição de equipamentos"), "Aquisição de equipamentos");
  assert.equal(resumir("  "), "—");
  assert.equal(resumir(null), "—");
  const longo = "Transferir, mediante convênio ou instrumento congênere, para a entidade sem fins lucrativos os recursos acima citados, para custeio das ações";
  const r = resumir(longo, 60);
  assert.ok(r.endsWith("…") && r.length <= 61, r);
  assert.equal(r, "Transferir, mediante convênio ou instrumento congênere…");
});

test("a fila diz 'Sem catálogo' quando a emenda ainda não está no catálogo", () => {
  const r: RetratoEpb = { ...RETRATO, catalogo: [] };
  assert.equal(valoresDaFila(filaDoCiclo(r, HOJE)[0]).modalidade, "Sem catálogo");
  assert.equal(valoresDaFila(filaDoCiclo(RETRATO, HOJE)[0]).modalidade, "Transferência a municípios");
});

test("porcento e os títulos, só com o que está no endereço", () => {
  assert.equal(porcento(88.9), "88,9%");
  assert.equal(porcento(null), "—");
  assert.equal(tituloAssembleia(), "Assembleia (PB) · Parlamentares · Mapa de Oportunidades · PONTE");
  assert.equal(tituloAssembleia("Fila do caminho"), "Fila do caminho · Assembleia (PB) · Parlamentares · Mapa de Oportunidades · PONTE");
  assert.equal(tituloDeputado("dr-erico"), "DR ERICO · Assembleia (PB) · Parlamentares · Mapa de Oportunidades · PONTE");
  assert.equal(tituloDeputado(null), "Deputado estadual · Assembleia (PB) · Parlamentares · Mapa de Oportunidades · PONTE");
  assert.equal(tituloEmendaEpb("0075/2025"), "Emenda 0075/2025 · Assembleia (PB) · Parlamentares · Mapa de Oportunidades · PONTE");
});

test("as telas das emendas estaduais: todas de administrador, e o nome de servidor só na página da emenda", () => {
  const raiz = path.resolve(import.meta.dirname, "..", "..", "app", "mapa");
  const paginas = ["parlamentares/assembleia/page.tsx", "parlamentares/assembleia/fila/page.tsx", "parlamentares/assembleia/[deputado]/page.tsx", "parlamentares/assembleia/emenda/[emenda]/page.tsx"];
  for (const p of paginas) {
    const fonte = fs.readFileSync(path.join(raiz, p), "utf-8");
    assert.match(fonte, /if \(!ehAdministrador\(visitante\.email\)\) redirect\("\/mapa"\);/, p);
    // A conferência vem antes de qualquer leitura (a da emenda lê junto o que a pessoa segue, E4).
    const leitura = fonte.search(/await (?:Promise\.all\(\[)?ler/);
    assert.ok(leitura > 0 && fonte.indexOf("ehAdministrador(") < leitura, `${p}: confere antes de ler`);
  }
  // E4 (oport_43): seguir a emenda estadual grava pela chave de serviço, e só depois de conferir o administrador.
  const acoes = fs.readFileSync(path.join(raiz, "acoes.ts"), "utf-8");
  const seguir = acoes.slice(acoes.indexOf("export async function seguir("), acoes.indexOf("export async function deixarDeSeguir("));
  assert.match(seguir, /if \(estadual && !ehAdministrador\(visitante\.email\)\) return \{ ok: false, erro: "Sem permissão\." \};/);
  assert.match(seguir, /const db = estadual \? clienteServidor\(\) : await clienteSessao\(\);/);
  assert.ok(seguir.indexOf("!ehAdministrador(") < seguir.indexOf("clienteServidor()"), "confere antes de abrir a chave de serviço");
  assert.match(seguir, /user_id: visitante\.id/, "o dono é o da sessão, nunca o do pedido");
  // O responsável do caminho (servidor) só é lido no leitor da emenda e só desenhado na página da emenda.
  const servidor = path.resolve(import.meta.dirname, "emendas-pb.server.ts");
  assert.equal((fs.readFileSync(servidor, "utf-8").match(/responsavel/g) ?? []).length, 1);
  const usam: string[] = [];
  const varrer = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) varrer(f);
      else if (/\.tsx?$/.test(e.name) && /\.responsavel\b/.test(fs.readFileSync(f, "utf-8"))) usam.push(path.relative(raiz, f).split(path.sep).join("/"));
    }
  };
  varrer(path.join(raiz, "parlamentares", "assembleia"));
  varrer(path.join(raiz, "municipio"));
  varrer(path.join(raiz, "entidade"));
  assert.deepEqual(usam, ["parlamentares/assembleia/emenda/[emenda]/EmendaConteudo.tsx"]);
});
