/**
 * Testes da lógica das emendas parlamentares (onda 14, parte 2, A, 13/10/2026). `node --test`, TypeScript executado
 * direto pelo Node 24. O último bloco lê o código-fonte das páginas e da lógica: os campos `catalogo_*` sem o recorte
 * da PB trazem o Brasil inteiro das emendas "Múltiplo" e "Nacional" e não podem aparecer em tela nenhuma.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANAIS,
  FRASE_AUTORIA_COLETIVA,
  ROTULO_CANAL,
  ROTULO_TIPO_AUTOR,
  TIPOS_AUTOR,
  avisoFnsPendente,
  canaisComValor,
  classeDestino,
  codigoAutorDaUrl,
  datasDaExecucao,
  destinoNaoClassificado,
  destinoPorAutor,
  destinoPorMunicipio,
  execucaoNaSafra,
  municipiosMenores,
  notasDoAutor,
  ordenarAutores,
  porHabitante,
  resumoPorCanal,
  rotuloCanal,
  rotuloEnteTipo,
  rotuloTipoAutor,
  separarDestino,
  somarDestino,
  type AnoCanalEmendas,
  type AutorEmendas,
  type CanalEmenda,
  type DestinoEmendas,
  type EnteTipoEmenda,
  type MunicipioPopulacao,
  type SafraEmendas,
} from "./emendas.ts";

// ================================================================ montagem

function destino(p: Partial<DestinoEmendas> & { ente_tipo: EnteTipoEmenda | null }): DestinoEmendas {
  return {
    ibge: null,
    autor_codigo: "1277",
    canal: "convenio",
    instrumentos: 1,
    emendas: 1,
    indicado: 0,
    valido: 0,
    pago: 0,
    caducado: 0,
    ...p,
  };
}

function autor(p: Partial<AutorEmendas> = {}): AutorEmendas {
  return {
    codigo: "1277",
    nome: "AUTOR",
    tipo: "individual",
    coletivo: false,
    pessoa: null,
    emendas: 0,
    ano_min: null,
    ano_max: null,
    convenio_indicado: 0,
    convenio_valido: 0,
    convenio_pago: 0,
    pix_indicado: 0,
    pix_valido: 0,
    pix_pago: 0,
    fns_indicado: 0,
    fns_valido: 0,
    fns_pago: 0,
    favorecido_pago: 0,
    caducados: 0,
    caducado_valor: 0,
    na_fila: 0,
    municipios: 0,
    catalogo_empenhado: 0,
    catalogo_pago_total: 0,
    catalogo_a_pagar: 0,
    catalogo_empenhado_pb: 0,
    catalogo_pago_total_pb: 0,
    ...p,
  };
}

/** Dez municípios: o quinto menor são os 2 de menor população (A e B). */
const DEZ: MunicipioPopulacao[] = [
  { ibge: "2500001", nome: "A", populacao: 1_000 },
  { ibge: "2500002", nome: "B", populacao: 2_000 },
  { ibge: "2500003", nome: "C", populacao: 3_000 },
  { ibge: "2500004", nome: "D", populacao: 4_000 },
  { ibge: "2500005", nome: "E", populacao: 5_000 },
  { ibge: "2500006", nome: "F", populacao: 6_000 },
  { ibge: "2500007", nome: "G", populacao: 7_000 },
  { ibge: "2500008", nome: "H", populacao: 8_000 },
  { ibge: "2500009", nome: "I", populacao: 9_000 },
  { ibge: "2500010", nome: "J", populacao: 55_000 },
];

// ================================================================ rótulos e chave

test("rótulos do tipo de autor: sem juízo, o individual sem a Casa", () => {
  assert.equal(rotuloTipoAutor("individual"), "Individual");
  assert.equal(rotuloTipoAutor("bancada"), "Bancada");
  assert.equal(rotuloTipoAutor("comissao"), "Comissão");
  assert.equal(rotuloTipoAutor("relator"), "Relator-geral");
  assert.equal(rotuloTipoAutor("outro"), "Outro");
  for (const t of TIPOS_AUTOR) assert.equal(rotuloTipoAutor(t), ROTULO_TIPO_AUTOR[t]);
  // O código individual também é de senador: nenhum rótulo diz "deputado".
  for (const t of TIPOS_AUTOR) assert.doesNotMatch(rotuloTipoAutor(t), /deputad|senador|melhor|pior/i);
  // Valor fora do contrato (o banco mudou antes da tela): "Outro", nunca undefined.
  assert.equal(rotuloTipoAutor("xyz" as never), "Outro");
});

test("rótulos do canal: os quatro, e o favorecido não se confunde com o bloco das entidades", () => {
  assert.equal(rotuloCanal("convenio"), "Convênio");
  assert.equal(rotuloCanal("pix"), "Pix (transferência especial)");
  assert.equal(rotuloCanal("fns"), "Saúde fundo a fundo (FNS)");
  assert.equal(rotuloCanal("favorecido"), "Pago ao favorecido");
  for (const c of CANAIS) assert.equal(rotuloCanal(c), ROTULO_CANAL[c]);
  assert.doesNotMatch(rotuloCanal("favorecido"), /entidade/i);
});

test("rótulo do tipo do ente", () => {
  assert.equal(rotuloEnteTipo("estado"), "Governo do estado");
  assert.equal(rotuloEnteTipo("fundo_municipal"), "Fundo municipal");
  assert.equal(rotuloEnteTipo(null), "Não informado");
});

test("codigoAutorDaUrl: exatamente 4 dígitos, senão null", () => {
  assert.equal(codigoAutorDaUrl("1277"), "1277");
  assert.equal(codigoAutorDaUrl("0001"), "0001");
  for (const v of ["127", "12770", "12a7", " 1277", "1277 ", "", "١٢٧٧", "12.7", null, undefined]) {
    assert.equal(codigoAutorDaUrl(v as string | null | undefined), null, `aceitou ${JSON.stringify(v)}`);
  }
  assert.equal(codigoAutorDaUrl(1277 as unknown as string), null);
});

// ================================================================ separarDestino

test("separarDestino: empresa e OSC nunca no municipal, mesmo com o IBGE da sede", () => {
  const linhas = [
    destino({ ibge: "2507507", ente_tipo: "municipio", pago: 10 }),
    destino({ ibge: "2507507", ente_tipo: "fundo_municipal", canal: "fns", pago: 20 }),
    destino({ ibge: "2507507", ente_tipo: "empresa", canal: "favorecido", pago: 30 }),
    destino({ ibge: "2507507", ente_tipo: "osc", pago: 40 }),
    destino({ ibge: "2504009", ente_tipo: "consorcio", pago: 50 }),
    destino({ ibge: "2507507", ente_tipo: "orgao_federal", canal: "favorecido", pago: 60 }),
    destino({ ibge: "2507507", ente_tipo: "outro", canal: "favorecido", pago: 70 }),
  ];
  const s = separarDestino(linhas);
  assert.deepEqual(s.municipal.map((d) => d.ente_tipo), ["municipio", "fundo_municipal"]);
  assert.deepEqual(s.entidadeComSede.map((d) => d.ente_tipo), ["empresa", "osc", "consorcio", "orgao_federal", "outro"]);
  assert.equal(s.estadual.length, 0);
  for (const d of s.municipal) assert.ok(d.ente_tipo === "municipio" || d.ente_tipo === "fundo_municipal");
});

test("separarDestino: estado e fundo estadual sem IBGE à parte; município sem IBGE fora das três classes", () => {
  const linhas = [
    destino({ ibge: null, ente_tipo: "estado", pago: 1 }),
    destino({ ibge: null, ente_tipo: "fundo_estadual", canal: "fns", pago: 2 }),
    destino({ ibge: null, ente_tipo: "municipio", canal: "favorecido", pago: 3 }),
    destino({ ibge: null, ente_tipo: "fundo_municipal", canal: "favorecido", pago: 4 }),
    destino({ ibge: "2507507", ente_tipo: null, pago: 5 }),
    destino({ ibge: "2507507", ente_tipo: "municipio", pago: 6 }),
  ];
  const s = separarDestino(linhas);
  assert.deepEqual(s.estadual.map((d) => d.pago), [1, 2]);
  assert.deepEqual(s.municipal.map((d) => d.pago), [6]);
  assert.equal(s.entidadeComSede.length, 0);
  assert.deepEqual(destinoNaoClassificado(linhas).map((d) => d.pago), [3, 4, 5]);
  // Nada se perde e nada conta duas vezes.
  const total = s.municipal.length + s.estadual.length + s.entidadeComSede.length + destinoNaoClassificado(linhas).length;
  assert.equal(total, linhas.length);
  assert.equal(classeDestino({ ibge: "25075", ente_tipo: "municipio" }), "naoClassificado");
});

test("somarDestino: soma as quatro medidas", () => {
  const s = somarDestino([
    destino({ ente_tipo: "municipio", indicado: 10, valido: 8, pago: 5, caducado: 1 }),
    destino({ ente_tipo: "municipio", indicado: 1, valido: 1, pago: 1, caducado: 0 }),
  ]);
  assert.deepEqual(s, { indicado: 11, valido: 9, pago: 6, caducado: 1 });
});

// ================================================================ porHabitante

test("porHabitante: soma ÷ soma da população, e não a média das razões", () => {
  // A: 1.000 hab, R$ 100.000 (100/hab). J: 55.000 hab, R$ 55.000 (1/hab).
  const linhas = [
    destino({ ibge: "2500001", ente_tipo: "municipio", pago: 100_000 }),
    destino({ ibge: "2500010", ente_tipo: "municipio", pago: 55_000 }),
  ];
  const r = porHabitante(linhas, DEZ, "pago");
  assert.equal(r.atendidos, 2);
  assert.equal(r.populacaoAtendida, 56_000);
  assert.equal(r.valorPorHabitante, 155_000 / 56_000);
  // A média das razões daria 50,5/hab: o resultado tem de ser outro.
  assert.notEqual(r.valorPorHabitante, (100 + 1) / 2);
});

test("porHabitante: as linhas do mesmo município (canais, autores, entes) somam antes da razão", () => {
  const linhas = [
    destino({ ibge: "2500003", ente_tipo: "municipio", canal: "convenio", pago: 1_000 }),
    destino({ ibge: "2500003", ente_tipo: "fundo_municipal", canal: "fns", pago: 2_000, autor_codigo: null }),
    destino({ ibge: "2500003", ente_tipo: "municipio", canal: "pix", pago: 3_000, autor_codigo: "4088" }),
  ];
  const r = porHabitante(linhas, DEZ, "pago");
  assert.equal(r.atendidos, 1);
  assert.equal(r.populacaoAtendida, 3_000);
  assert.equal(r.valorPorHabitante, 2);
});

test("porHabitante: município sem população fica fora do numerador e do denominador", () => {
  const municipios: MunicipioPopulacao[] = [
    { ibge: "2500001", nome: "A", populacao: 1_000 },
    { ibge: "2500002", nome: "B", populacao: null },
    { ibge: "2500003", nome: "C", populacao: 0 },
  ];
  const linhas = [
    destino({ ibge: "2500001", ente_tipo: "municipio", pago: 1_000 }),
    destino({ ibge: "2500002", ente_tipo: "municipio", pago: 9_999 }),
    destino({ ibge: "2500003", ente_tipo: "municipio", pago: 9_999 }),
    destino({ ibge: "2599999", ente_tipo: "municipio", pago: 9_999 }), // fora da lista
  ];
  const r = porHabitante(linhas, municipios, "pago");
  assert.equal(r.atendidos, 1);
  assert.equal(r.populacaoAtendida, 1_000);
  assert.equal(r.valorPorHabitante, 1);
});

test("porHabitante: empresa, OSC e estado não entram, mesmo passados por engano", () => {
  const linhas = [
    destino({ ibge: "2500001", ente_tipo: "municipio", pago: 1_000 }),
    destino({ ibge: "2500002", ente_tipo: "empresa", canal: "favorecido", pago: 50_000 }),
    destino({ ibge: "2500003", ente_tipo: "osc", pago: 50_000 }),
    destino({ ibge: null, ente_tipo: "estado", pago: 50_000 }),
  ];
  const r = porHabitante(linhas, DEZ, "pago");
  assert.equal(r.atendidos, 1);
  assert.equal(r.valorPorHabitante, 1);
});

test("porHabitante: a fatia dos menores é o quinto de menor população da lista inteira", () => {
  assert.deepEqual([...municipiosMenores(DEZ)].sort(), ["2500001", "2500002"]);
  const linhas = [
    destino({ ibge: "2500001", ente_tipo: "municipio", pago: 300 }),
    destino({ ibge: "2500002", ente_tipo: "municipio", pago: 100 }),
    destino({ ibge: "2500010", ente_tipo: "municipio", pago: 600 }),
  ];
  const r = porHabitante(linhas, DEZ, "pago");
  assert.equal(r.fatiaMenores, 400 / 1_000);
  // A fatia da população é dos menores na lista inteira (100.000), não só nos atendidos.
  assert.equal(r.fatiaPopulacaoMenores, 3_000 / 100_000);
});

test("porHabitante: o quinto de 223 é 45, e o empate de população vai pelo IBGE", () => {
  const muitos: MunicipioPopulacao[] = Array.from({ length: 223 }, (_, k) => ({
    ibge: String(2500000 + 223 - k),
    nome: `M${k}`,
    populacao: 1_000 + Math.floor(k / 2), // pares empatados
  }));
  const menores = municipiosMenores(muitos);
  assert.equal(menores.size, 45);
  // O 45º e o 46º têm a mesma população (k = 44 e 45): fica o de menor IBGE.
  const k44 = String(2500000 + 223 - 44);
  const k45 = String(2500000 + 223 - 45);
  assert.ok(menores.has(k45) && !menores.has(k44));
});

test("porHabitante: sem valor, ou sem lista de municípios, as razões são null (nunca zero nem NaN)", () => {
  const vazio = porHabitante([], DEZ, "pago");
  assert.equal(vazio.atendidos, 0);
  assert.equal(vazio.valorPorHabitante, null);
  assert.equal(vazio.fatiaMenores, null);
  assert.equal(vazio.fatiaPopulacaoMenores, 0.03);
  const semLista = porHabitante([destino({ ibge: "2500001", ente_tipo: "municipio", pago: 10 })], [], "pago");
  assert.deepEqual(semLista, { atendidos: 0, populacaoAtendida: 0, valorPorHabitante: null, fatiaMenores: null, fatiaPopulacaoMenores: null });
});

test("porHabitante: a medida escolhe a coluna; o favorecido não tem válido", () => {
  const linhas = [
    destino({ ibge: "2500001", ente_tipo: "municipio", valido: 2_000, pago: 1_000 }),
    destino({ ibge: "2500002", ente_tipo: "fundo_municipal", canal: "favorecido", valido: 0, pago: 4_000 }),
  ];
  const pago = porHabitante(linhas, DEZ, "pago");
  const valido = porHabitante(linhas, DEZ, "valido");
  assert.equal(pago.atendidos, 2);
  assert.equal(pago.valorPorHabitante, 5_000 / 3_000);
  assert.equal(valido.atendidos, 1);
  assert.equal(valido.valorPorHabitante, 2);
});

test("destinoPorMunicipio: os da lista em ordem de nome, com os não atendidos, e o IBGE desconhecido no fim", () => {
  const municipios: MunicipioPopulacao[] = [
    { ibge: "2500002", nome: "Água Branca", populacao: 2_000 },
    { ibge: "2500001", nome: "Zabelê", populacao: 1_000 },
    { ibge: "2500003", nome: "Bananeiras", populacao: null },
  ];
  const linhas = [
    destino({ ibge: "2500001", ente_tipo: "municipio", pago: 500 }),
    destino({ ibge: "2500003", ente_tipo: "municipio", pago: 100 }),
    destino({ ibge: "2599999", ente_tipo: "municipio", pago: 7 }),
    destino({ ibge: "2500002", ente_tipo: "empresa", canal: "favorecido", pago: 99 }),
  ];
  const r = destinoPorMunicipio(linhas, municipios, "pago");
  assert.deepEqual(r.map((m) => m.nome), ["Água Branca", "Bananeiras", "Zabelê", "2599999"]);
  assert.deepEqual(r.map((m) => m.valor), [0, 100, 500, 7]);
  assert.deepEqual(r.map((m) => m.atendido), [false, true, true, true]);
  assert.equal(r[1].valorPorHabitante, null); // sem população
  assert.equal(r[2].valorPorHabitante, 0.5);
});

// ================================================================ execucaoNaSafra

function ano(p: Partial<AnoCanalEmendas> & { ano: number; canal: CanalEmenda }): AnoCanalEmendas {
  return { emendas: 1, indicado: 0, valido: 0, pago: 0, caducado: 0, ...p };
}
function safra(p: Partial<SafraEmendas> & { ano: number; canal: CanalEmenda }): SafraEmendas {
  return { tipo: "individual", autores: 1, emendas: 1, valido: 0, pago: 0, ...p };
}

test("execucaoNaSafra: compara com a PB no mesmo ano, canal e tipo", () => {
  const anos = [ano({ ano: 2023, canal: "convenio", valido: 100, pago: 50 }), ano({ ano: 2023, canal: "pix", valido: 10, pago: 10 })];
  const s = [
    safra({ ano: 2023, canal: "convenio", valido: 1_000, pago: 800 }),
    safra({ ano: 2023, canal: "convenio", tipo: "comissao", valido: 1_000, pago: 100 }), // outro tipo: não entra
    safra({ ano: 2024, canal: "convenio", valido: 1_000, pago: 10 }), // outro ano: não entra
    safra({ ano: 2023, canal: "pix", valido: 100, pago: 90 }),
  ];
  const r = execucaoNaSafra(anos, s, "individual");
  assert.deepEqual(r, [
    { ano: 2023, canal: "convenio", validoAutor: 100, pagoAutor: 50, fracaoAutor: 0.5, fracaoPb: 0.8 },
    { ano: 2023, canal: "pix", validoAutor: 10, pagoAutor: 10, fracaoAutor: 1, fracaoPb: 0.9 },
  ]);
});

test("execucaoNaSafra: ano sem a PB (ou com válido zero nela) dá fracaoPb null", () => {
  const anos = [ano({ ano: 2019, canal: "convenio", valido: 100, pago: 30 }), ano({ ano: 2020, canal: "convenio", valido: 100, pago: 30 })];
  const s = [safra({ ano: 2020, canal: "convenio", valido: 0, pago: 0 }), safra({ ano: 2021, canal: "convenio", valido: 500, pago: 400 })];
  const r = execucaoNaSafra(anos, s, "individual");
  assert.equal(r.length, 2);
  assert.equal(r[0].fracaoPb, null);
  assert.equal(r[1].fracaoPb, null);
  assert.equal(r[0].fracaoAutor, 0.3);
});

test("execucaoNaSafra: válido zero do autor dá fracaoAutor null; o favorecido fica fora; ordem por ano e canal", () => {
  const anos = [
    ano({ ano: 2024, canal: "fns", valido: 0, pago: 0 }),
    ano({ ano: 2024, canal: "favorecido", valido: 0, pago: 999 }),
    ano({ ano: 2022, canal: "pix", valido: 10, pago: 5 }),
    ano({ ano: 2024, canal: "convenio", valido: 10, pago: 0 }),
  ];
  const r = execucaoNaSafra(anos, [safra({ ano: 2024, canal: "fns", valido: 10, pago: 10 })], "individual");
  assert.deepEqual(r.map((x) => `${x.ano}/${x.canal}`), ["2022/pix", "2024/convenio", "2024/fns"]);
  assert.equal(r[2].fracaoAutor, null);
  assert.equal(r[2].fracaoPb, 1);
  assert.equal(r[1].fracaoAutor, 0);
});

// ================================================================ acrescentadas

test("resumoPorCanal: válido e pago por canal, sem o catálogo; o favorecido só com o pago", () => {
  const a = autor({
    convenio_indicado: 300, convenio_valido: 200, convenio_pago: 100,
    pix_indicado: 50, pix_valido: 50, pix_pago: 40,
    fns_indicado: 10, fns_valido: 10, fns_pago: 10,
    favorecido_pago: 7,
    catalogo_empenhado: 1e12, catalogo_pago_total: 1e12, catalogo_a_pagar: 1e12,
    catalogo_empenhado_pb: 1e9, catalogo_pago_total_pb: 1e9,
  });
  const r = resumoPorCanal(a);
  assert.deepEqual(r.canais.map((c) => c.canal), ["convenio", "pix", "fns", "favorecido"]);
  assert.deepEqual(r.canais[3], { canal: "favorecido", indicado: null, valido: null, pago: 7 });
  assert.equal(r.validoTotal, 260);
  assert.equal(r.pagoTotal, 157);
  assert.deepEqual(canaisComValor(a), ["convenio", "pix", "fns", "favorecido"]);
  assert.deepEqual(canaisComValor(autor({ pix_pago: 1 })), ["pix"]);
});

test("ordenarAutores: por tipo e nome, nunca por valor", () => {
  const r = ordenarAutores([
    autor({ codigo: "8100", nome: "RELATOR GERAL", tipo: "relator", convenio_pago: 9e9 }),
    autor({ codigo: "6011", nome: "COMISSÃO B", tipo: "comissao" }),
    autor({ codigo: "1277", nome: "Ândrea", tipo: "individual" }),
    autor({ codigo: "3136", nome: null, tipo: "individual" }),
    autor({ codigo: "1000", nome: "Bruno", tipo: "individual", convenio_pago: 1 }),
    autor({ codigo: "7116", nome: "BANCADA DA PARAÍBA", tipo: "bancada" }),
  ]);
  assert.deepEqual(r.map((a) => a.codigo), ["1277", "1000", "3136", "7116", "6011", "8100"]);
});

test("destinoPorAutor: soma por autor, ordem de tipo e nome, e o FNS sem detalhe no fim", () => {
  const autores = [
    { codigo: "6011", nome: "COMISSÃO", tipo: "comissao" as const, coletivo: true, pessoa: null },
    { codigo: "1277", nome: "AUTOR", tipo: "individual" as const, coletivo: false, pessoa: null },
  ];
  const r = destinoPorAutor(
    [
      destino({ autor_codigo: null, canal: "fns", ente_tipo: "fundo_municipal", pago: 900 }),
      destino({ autor_codigo: "6011", canal: "convenio", ente_tipo: "municipio", pago: 1 }),
      destino({ autor_codigo: "1277", canal: "pix", ente_tipo: "municipio", pago: 2, valido: 2 }),
      destino({ autor_codigo: "1277", canal: "convenio", ente_tipo: "municipio", pago: 3, valido: 4 }),
      destino({ autor_codigo: "9999", canal: "favorecido", ente_tipo: "municipio", pago: 5 }),
    ],
    autores,
  );
  assert.deepEqual(r.map((g) => g.codigo), ["1277", "6011", "9999", null]);
  assert.deepEqual(r[0].canais, ["convenio", "pix"]);
  assert.equal(r[0].pago, 5);
  assert.equal(r[0].valido, 6);
  assert.equal(r[2].autor, null);
  assert.equal(r[3].pago, 900);
});

test("as notas do autor: coletivo ganha a de autoria coletiva", () => {
  assert.equal(notasDoAutor({ coletivo: false }).length, 1);
  assert.ok(notasDoAutor({ coletivo: true }).includes(FRASE_AUTORIA_COLETIVA));
});

test("datasDaExecucao: o dia em Brasília, igual em qualquer fuso do servidor", () => {
  // 10/10, 02:57 UTC = 09/10, 23:57 em Brasília.
  assert.deepEqual(datasDaExecucao({ dadoAte: "2026-10-10T02:57:21+00:00", concluidaEm: "2026-10-13T00:27:05.420752+00:00" }), {
    dadoAte: "09/10/2026",
    rodouEm: "12/10/2026",
  });
  assert.deepEqual(datasDaExecucao({ dadoAte: null, concluidaEm: "2026-10-13T12:00:00+00:00" }), { dadoAte: "—", rodouEm: "13/10/2026" });
});

test("avisoFnsPendente: só quando há pendência", () => {
  assert.equal(avisoFnsPendente({ fnsPendentes: 0 }), null);
  assert.equal(avisoFnsPendente({ fnsPendentes: Number.NaN }), null);
  assert.match(avisoFnsPendente({ fnsPendentes: 10_908 }) ?? "", /10\.908 propostas/);
  assert.match(avisoFnsPendente({ fnsPendentes: 1 }) ?? "", /1 proposta ainda/);
});

// ================================================================ o catálogo do Brasil inteiro nunca na tela

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(AQUI, "..", "..");
const PROIBIDOS = /\bcatalogo_(empenhado|pago_total|a_pagar)\b(?!_pb)/g;

function arquivos(dir: string): string[] {
  const saida: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && !e.name.startsWith(".")) saida.push(...arquivos(p));
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      saida.push(p);
    }
  }
  return saida;
}

/** Import do módulo das emendas por qualquer caminho: "@/lib/oportunidades/emendas", "./emendas.ts", "./emendas.server". */
const IMPORTA_EMENDAS = /["'][^"'\n]*\/emendas(\.server)?(\.ts)?["']/;

/**
 * As páginas, os componentes e os auxiliares das telas que usam as emendas: os que importam o módulo (por qualquer
 * caminho), os das rotas e os auxiliares de parlamentares, e a própria lógica e leitura. Os testes ficam de fora.
 */
function fontesDasTelas(): string[] {
  const todos = arquivos(SRC);
  return todos.filter((f) => {
    const rel = path.relative(SRC, f).split(path.sep).join("/");
    if (rel.startsWith("lib/oportunidades/emendas")) return true;
    if (/parlamentar/.test(rel)) return true;
    return IMPORTA_EMENDAS.test(fs.readFileSync(f, "utf8"));
  });
}

test("nenhuma tela nem função usa catalogo_empenhado, catalogo_pago_total e catalogo_a_pagar (Brasil inteiro)", () => {
  const fontes = fontesDasTelas();
  assert.ok(fontes.some((f) => f.endsWith(path.join("oportunidades", "emendas.ts"))), "o emendas.ts não foi lido");
  assert.ok(fontes.some((f) => f.endsWith(path.join("oportunidades", "emendas.server.ts"))), "o emendas.server.ts não foi lido");
  const achados: string[] = [];
  for (const f of fontes) {
    let texto = fs.readFileSync(f, "utf8");
    // A declaração do tipo (a única exceção): o bloco da `interface AutorEmendas` sai antes da busca.
    if (f.endsWith(path.join("oportunidades", "emendas.ts"))) {
      const antes = texto.length;
      texto = texto.replace(/export interface AutorEmendas \{[\s\S]*?\n\}/, "");
      assert.ok(texto.length < antes, "a declaração de AutorEmendas não foi achada");
    }
    for (const m of texto.matchAll(PROIBIDOS)) achados.push(`${path.relative(SRC, f)}: ${m[0]}`);
  }
  assert.deepEqual(achados, []);
});

test("a busca das telas acha o import do módulo por qualquer caminho", () => {
  for (const s of [
    'import { x } from "@/lib/oportunidades/emendas";',
    'import type { X } from "./emendas.ts";',
    'import { lerParlamentar } from "@/lib/oportunidades/emendas.server";',
    "import { y } from '../../lib/oportunidades/emendas';",
  ]) {
    assert.ok(IMPORTA_EMENDAS.test(s), s);
  }
  assert.ok(!IMPORTA_EMENDAS.test('import { z } from "./emendas-antigas";'));
});

test("a busca dos campos proibidos acha o uso e deixa passar o recorte da PB", () => {
  assert.equal("a.catalogo_empenhado + 1".match(PROIBIDOS)?.length, 1);
  assert.equal("x.catalogo_a_pagar".match(PROIBIDOS)?.length, 1);
  assert.equal("x.catalogo_pago_total".match(PROIBIDOS)?.length, 1);
  assert.equal("x.catalogo_empenhado_pb, x.catalogo_pago_total_pb".match(PROIBIDOS), null);
});
