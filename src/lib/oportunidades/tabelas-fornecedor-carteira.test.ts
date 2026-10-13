/**
 * As tabelas com filtro e ordem em cada coluna dos fornecedores, do dossiê e da carteira (onda 15, fase 2, lote D,
 * 13/10/2026): ids válidos e únicos, um valor cru por coluna, os valores em percentual e o vazio onde a tela mostra "—",
 * e o filtro das colunas ocultas achando a linha certa.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  COLUNAS_CARTEIRA_CONVENIOS,
  ROTULO_NIVEL,
  montarCarteira,
  valoresDoConvenioSeguido,
  type SeguidoCarteira,
} from "./carteira.ts";
import {
  COLUNAS_CONCENTRACAO,
  COLUNAS_CONTRATOS_DO_FORNECEDOR,
  COLUNAS_CONVENIOS_DO_FORNECEDOR,
  COLUNAS_LIDERA,
  COLUNAS_MUNICIPIOS_DO_FORNECEDOR,
  COLUNAS_TCE_DO_FORNECEDOR,
  ROTULO_MOMENTO,
  emPercentual,
  linhasTceDoFornecedor,
  municipiosDoFornecedor,
  valoresDaConcentracao,
  valoresDaLideranca,
  valoresDaLinhaTce,
  valoresDoContrato,
  valoresDoConvenioDoFornecedor,
  valoresDoMunicipioDoFornecedor,
  type ConcentracaoMunicipio,
  type Contrato,
  type FornecedorConvenio,
} from "./fornecedores.ts";
import { aplicar, csvDaTabela, idValido, lerEstado, type ColunaTabela, type LinhaTabela, type ValorCelula } from "./tabela-filtro.ts";
import type { TceFederalPar, TcePixCredor } from "./tce.ts";

const ACM = "05476456000146";

const CAMPINA: ConcentracaoMunicipio = {
  cod_ibge: "2504009",
  municipio: "CAMPINA GRANDE",
  convenios: 47,
  n_fornecedores: 149,
  pago_pj: 130_690_000,
  pago_pf: 0,
  maior_cnpj: ACM,
  maior_nome: "ACM AUTO CENTER MAQUINAS LTDA",
  maior_pago: 83_640_000,
  maior_fatia: 0.6403,
  hhi: 0.43,
};

const PATOS: ConcentracaoMunicipio = {
  ...CAMPINA,
  cod_ibge: "2510808",
  municipio: "PATOS",
  maior_cnpj: "11111111000111",
  maior_nome: "MEI 123.456.789-01 FULANO",
  maior_fatia: 0.31,
  hhi: 0.27,
  pago_pj: 5_000_000,
};

function convenio(extra: Partial<FornecedorConvenio> = {}): FornecedorConvenio {
  return {
    cnpj: ACM,
    nr_convenio: "900001",
    cod_ibge: "2504009",
    municipio: "CAMPINA GRANDE",
    proponente: "MUNICIPIO DE CAMPINA GRANDE",
    tipo_agente: "municipio",
    orgao_sup: "MINISTERIO DAS CIDADES",
    cod_programa: "5600020240001",
    pago: 1000,
    n_pagamentos: 2,
    primeiro_pagamento: "2020-03-01",
    ultimo_pagamento: "2020-06-01",
    fatia: 0.255,
    n_contratos: 0,
    contratado: 0,
    ...extra,
  };
}

function contrato(extra: Partial<Contrato> = {}): Contrato {
  return {
    nr_convenio: "900001",
    id_licitacao: "L1",
    id_contrato: "K1",
    nr_contrato: null,
    cnpj: ACM,
    fornecedor: "ACM",
    pessoa_fisica: false,
    tipo_aquisicao: " Pregão ",
    objeto: "Pavimentação",
    valor: 100,
    dt_assinatura: "2021-05-04",
    dt_publicacao: null,
    dt_inicio_vigencia: "2021-05-05",
    dt_fim_vigencia: "2022-05-05",
    ...extra,
  };
}

function conferirColunas(nome: string, colunas: ColunaTabela[], valores: Record<string, ValorCelula>) {
  const ids = colunas.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, `${nome}: ids únicos`);
  for (const id of ids) assert.ok(idValido(id), `${nome}: ${id}`);
  assert.ok(colunas.every((c) => c.ordenavel !== false && c.filtravel !== false), `${nome}: toda coluna filtra e ordena`);
  assert.ok(!colunas[0].oculta, `${nome}: a primeira coluna aparece (é o cabeçalho da linha)`);
  assert.deepEqual(Object.keys(valores).sort(), [...ids].sort(), `${nome}: um valor cru por coluna`);
}

const linhasDe = <T>(itens: T[], valores: (x: T) => Record<string, ValorCelula>): LinhaTabela[] =>
  itens.map((x, i) => ({ chave: String(i), valores: valores(x), celulas: {} }));

test("fornecedores e dossiê: colunas válidas, todas filtram e ordenam, um valor por coluna", () => {
  conferirColunas("concentração", COLUNAS_CONCENTRACAO, valoresDaConcentracao(CAMPINA));
  conferirColunas("lidera", COLUNAS_LIDERA, valoresDaLideranca(CAMPINA));
  conferirColunas("municípios", COLUNAS_MUNICIPIOS_DO_FORNECEDOR, valoresDoMunicipioDoFornecedor(municipiosDoFornecedor([convenio()])[0]));
  conferirColunas(
    "convênios",
    COLUNAS_CONVENIOS_DO_FORNECEDOR,
    valoresDoConvenioDoFornecedor(convenio(), { proponente: "P", orgao: "O", programa: null, momento: null }),
  );
  conferirColunas("contratos", COLUNAS_CONTRATOS_DO_FORNECEDOR, valoresDoContrato(contrato()));
  const tce = linhasTceDoFornecedor([], [{ ibge: "2504009", ano: 2025, cnpj: ACM, nome: null, pago: 10, pago_investimentos: 0, n_empenhos: 1 }], () => "Campina Grande");
  conferirColunas("TCE-PB", COLUNAS_TCE_DO_FORNECEDOR, valoresDaLinhaTce(tce[0]));
});

test("concentração: fatia em percentual, nome com o CPF mascarado, a faixa como categoria", () => {
  assert.equal(emPercentual(0.6403), 64);
  assert.equal(emPercentual(0.2555), 25.6);
  assert.equal(emPercentual(null), null);
  const v = valoresDaConcentracao(CAMPINA);
  assert.deepEqual([v.fatia, v.faixa, v["maior-cnpj"]], [64, "Alta", "05.476.456/0001-46"]);
  const patos = valoresDaConcentracao(PATOS);
  assert.equal(patos.faixa, "Moderada");
  assert.doesNotMatch(String(patos.maior), /456\.789-01/, "o CPF da razão social do MEI não aparece");
  assert.equal(valoresDaConcentracao({ ...CAMPINA, maior_cnpj: null }).maior, null);
  const linhas = linhasDe([CAMPINA, PATOS], valoresDaConcentracao);
  const so = (q: string) => aplicar(COLUNAS_CONCENTRACAO, linhas, lerEstado("conc", COLUNAS_CONCENTRACAO, new URLSearchParams(q))).map((l) => l.valores.prefeitura);
  assert.deepEqual(so("t.conc.fatia=50.."), ["CAMPINA GRANDE"], "“50” é 50%");
  assert.deepEqual(so("t.conc.faixa=moderada"), ["PATOS"], "a coluna oculta da faixa filtra");
  assert.deepEqual(so("t.conc.o=pago-pj.asc"), ["PATOS", "CAMPINA GRANDE"], "tela de administrador: ordena pelo valor");
  assert.match(csvDaTabela(COLUNAS_CONCENTRACAO, linhas), /"=""2504009"""/, "o IBGE sai como texto no CSV");
});

test("dossiê: convênios com o momento da sanção, a fatia só com pagamento e o contratado vazio sem contrato", () => {
  const v = valoresDoConvenioDoFornecedor(convenio(), { proponente: "Município de Campina Grande", orgao: "Ministério das Cidades", programa: "Pavimentação", momento: "pagou" });
  assert.deepEqual([v.sancao, v.fatia, v.contratado, v.recebeu], [ROTULO_MOMENTO.pagou, 25.5, null, 1000]);
  const semPagamento = valoresDoConvenioDoFornecedor(convenio({ pago: 0, n_contratos: 2, contratado: 500 }), { proponente: null, orgao: null, programa: null, momento: null });
  assert.deepEqual([semPagamento.fatia, semPagamento.contratado, semPagamento.sancao], [null, 500, null]);
  const linhas = linhasDe(
    [convenio(), convenio({ nr_convenio: "900002", municipio: "PATOS", orgao_sup: "MINISTERIO DA SAUDE" })],
    (c) => valoresDoConvenioDoFornecedor(c, { proponente: null, orgao: c.orgao_sup === "MINISTERIO DA SAUDE" ? "Ministério da Saúde" : "Ministério das Cidades", programa: null, momento: null }),
  );
  const achadas = aplicar(COLUNAS_CONVENIOS_DO_FORNECEDOR, linhas, lerEstado("convenios", COLUNAS_CONVENIOS_DO_FORNECEDOR, new URLSearchParams("t.convenios.municipio=patos")));
  assert.deepEqual(achadas.map((l) => l.valores.convenio), ["900002"], "o município, oculto na célula do convênio, filtra");
});

test("dossiê: municípios somados do que mais recebeu ao que menos", () => {
  const m = municipiosDoFornecedor([
    convenio({ pago: 10 }),
    convenio({ cod_ibge: "2510808", municipio: "PATOS", pago: 50 }),
    convenio({ pago: 30 }),
    convenio({ cod_ibge: null, municipio: null, pago: 0 }),
  ]);
  assert.deepEqual(
    m.map((x) => [x.nome, x.convenios, x.pago]),
    [["PATOS", 1, 50], ["CAMPINA GRANDE", 2, 40], ["Município não informado", 1, 0]],
  );
});

test("dossiê: contratos com o número do contrato, o tipo de aquisição limpo e as datas da vigência", () => {
  const v = valoresDoContrato(contrato());
  assert.deepEqual([v.contrato, v.aquisicao, v.assinatura, v["fim-vigencia"]], ["K1", "Pregão", "2021-05-04", "2022-05-05"]);
  assert.equal(valoresDoContrato(contrato({ nr_contrato: "12/2021", objeto: "  " })).contrato, "12/2021");
  assert.equal(valoresDoContrato(contrato({ objeto: "  " })).objeto, null);
  const linhas = linhasDe([contrato({ nr_contrato: "12/2021" }), contrato({ id_contrato: "K2", dt_assinatura: "2023-01-10", tipo_aquisicao: "Dispensa" })], valoresDoContrato);
  const de2023 = aplicar(COLUNAS_CONTRATOS_DO_FORNECEDOR, linhas, lerEstado("contratos", COLUNAS_CONTRATOS_DO_FORNECEDOR, new URLSearchParams("t.contratos.assinatura=2023-01-01..")));
  assert.deepEqual(de2023.map((l) => l.valores.contrato), ["K2"], "a assinatura, oculta, filtra");
  assert.match(csvDaTabela(COLUNAS_CONTRATOS_DO_FORNECEDOR, linhas), /"=""12\/2021"""/, "o número do contrato sai como texto (o Excel leria data)");
});

test("dossiê: TCE-PB junta o par e o Pix, do ano mais recente ao mais antigo", () => {
  const par: TceFederalPar = {
    ibge: "2504009",
    ano: 2024,
    cnpj: ACM,
    nome: null,
    tce_convenio: 100,
    tce_pix: 20,
    tce_outras: 5,
    siconv: 0,
    convenios: [],
    situacao: "so_tce",
  };
  const pix: TcePixCredor[] = [
    { ibge: "2504009", ano: 2024, cnpj: ACM, nome: null, pago: 30, pago_investimentos: 0, n_empenhos: 1 },
    { ibge: "2510808", ano: 2025, cnpj: ACM, nome: null, pago: 70, pago_investimentos: 0, n_empenhos: 2 },
  ];
  const nomes: Record<string, string> = { "2504009": "Campina Grande", "2510808": "Patos" };
  const linhas = linhasTceDoFornecedor([par], pix, (ibge) => nomes[ibge]);
  assert.deepEqual(
    linhas.map((l) => [l.municipio, l.ano, l.total, l.pix, l.siconv, l.situacao]),
    [
      ["Patos", 2025, 70, 70, null, "Pix"],
      ["Campina Grande", 2024, 125, 30, null, "só no TCE-PB"],
    ],
  );
  assert.equal(valoresDaLinhaTce({ ...linhas[0], total: 0 }).tce, null, "sem total, o vazio que a tela mostra como “—”");
});

test("carteira: os convênios seguidos com situação, fim da vigência, físico e a próxima ação", () => {
  const seguidos: SeguidoCarteira[] = [
    {
      tipo: "instrumento",
      chave: "942082",
      titulo: "Máquinas agrícolas",
      estado: { situacao: "Em execução", dt_fim_vigencia: "2026-09-30", pct_fisico: 0.5 },
      referencia: "painel:2026-10-01T23:00:00Z",
      criado_em: "2026-10-02T10:00:00Z",
    },
    {
      tipo: "instrumento",
      chave: "900100",
      titulo: "Unidade de saúde",
      estado: { situacao: "Em execução", dt_fim_vigencia: "2027-12-31" },
      referencia: "painel:2026-10-01T23:00:00Z",
      criado_em: "2026-10-02T10:00:00Z",
    },
  ];
  const k = montarCarteira({ seguidos, avisos: [] }, "2026-10-02");
  const [vencido, longe] = k.porTipo.instrumento;
  assert.deepEqual(vencido.instrumento, { situacao: "Em execução", fimVigencia: "2026-09-30", nivelVigencia: "alto", fisico: 0.5 });
  assert.equal(vencido.numeros.find((n) => n.rotulo === "Vigência")?.nivel, "alto", "os números de antes não mudaram");
  const v = valoresDoConvenioSeguido(vencido);
  assert.deepEqual(Object.keys(v).sort(), COLUNAS_CARTEIRA_CONVENIOS.map((c) => c.id).sort());
  assert.deepEqual([v.situacao, v["fim-vigencia"], v.fisico, v.nivel, v.mudancas], ["Em execução", "2026-09-30", 50, ROTULO_NIVEL.alto, 0]);
  const w = valoresDoConvenioSeguido(longe);
  assert.deepEqual([w.fisico, w.acao, w.nivel], [null, null, null], "sem físico e sem ação: o vazio");
  for (const c of COLUNAS_CARTEIRA_CONVENIOS) assert.ok(idValido(c.id) && c.ordenavel !== false, c.id);
  const linhas = k.porTipo.instrumento.map((i) => ({ chave: i.chave, valores: valoresDoConvenioSeguido(i), celulas: {} }));
  const ate2026 = aplicar(COLUNAS_CARTEIRA_CONVENIOS, linhas, lerEstado("cart-conv", COLUNAS_CARTEIRA_CONVENIOS, new URLSearchParams("t.cart-conv.fim-vigencia=..2026-12-31")));
  assert.deepEqual(ate2026.map((l) => l.chave), ["942082"]);
  const porNivel = aplicar(COLUNAS_CARTEIRA_CONVENIOS, linhas, lerEstado("cart-conv", COLUNAS_CARTEIRA_CONVENIOS, new URLSearchParams("t.cart-conv.nivel=alto")));
  assert.deepEqual(porNivel.map((l) => l.chave), ["942082"], "o nível da próxima ação, oculto, filtra");
  assert.equal(montarCarteira({ seguidos: [{ ...seguidos[0], tipo: "municipio" }], avisos: [] }, "2026-10-02").itens[0].instrumento, undefined, "só o convênio leva o retrato cru");
});
