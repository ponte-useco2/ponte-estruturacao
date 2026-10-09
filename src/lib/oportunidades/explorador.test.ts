import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CAMADAS,
  NIVEIS,
  PILHA_VAZIA,
  ROTULO_NIVEL,
  anuncioDaCamada,
  aparelhoFraco,
  chaveDaCamada,
  direcaoDaTroca,
  elosDoExplorador,
  lentesDoExplorador,
  niveisDaPilha,
  niveisDesenhados,
  nivelDoTopo,
  nomeDoNivel,
  paginasDoNivel,
  pilhaAte,
  pilhaDaUrl,
  poseDaCamada,
  poseDaFrente,
  profundidade,
  quadrosLentos,
  regioesDaDescida,
  totalDaLente,
  urlDaLente,
  urlDaVista,
  urlDoNivel,
  urlExplorador,
  urlFilho,
  urlPai,
  vistaEfetiva,
  type PilhaExplorador,
} from "./explorador.ts";
import { MUNICIPIOS_PB } from "./municipios-pb.ts";
import type { EntidadeNoMunicipio } from "./pagina-entidade.ts";

const PATOS = "2510808";
const CNPJ = "09084815000170";
/** A descida inteira: Brasil › Paraíba › Patos › entidade › instrumento. */
const FUNDA: PilhaExplorador = { uf: "PB", ibge: PATOS, cnpj: CNPJ, instrumento: "942082", lente: "publico", vista: null };

/** O endereço lido de volta, como o Next entrega os `searchParams`. */
const ler = (url: string) => pilhaDaUrl(Object.fromEntries(new URL(url, "https://x").searchParams));

test("C3a: URL → pilha — cada nível só vale com o de cima e no formato certo", () => {
  assert.deepEqual(pilhaDaUrl({}), PILHA_VAZIA);
  assert.deepEqual(pilhaDaUrl({ uf: "pb", ibge: PATOS, cnpj: "09.084.815/0001-70", instrumento: "942082" }), FUNDA);
  // a UF fora das 27 corta tudo abaixo
  assert.deepEqual(niveisDaPilha(pilhaDaUrl({ uf: "XX", ibge: PATOS })), ["brasil"]);
  // só a PB desce ao município, e só os 223 dela
  assert.equal(pilhaDaUrl({ uf: "SP", ibge: "3509502" }).ibge, null);
  assert.equal(pilhaDaUrl({ uf: "PB", ibge: "2599999" }).ibge, null);
  assert.equal(pilhaDaUrl({ uf: "PB", ibge: "3509502" }).ibge, null);
  // sem município não há entidade; sem entidade não há instrumento
  assert.equal(pilhaDaUrl({ uf: "PB", cnpj: CNPJ }).cnpj, null);
  assert.equal(pilhaDaUrl({ uf: "PB", ibge: PATOS, instrumento: "942082" }).instrumento, null);
  // formato: CNPJ curto e número com símbolo caem
  assert.equal(pilhaDaUrl({ uf: "PB", ibge: PATOS, cnpj: "123" }).cnpj, null);
  assert.equal(pilhaDaUrl({ uf: "PB", ibge: PATOS, cnpj: CNPJ, instrumento: "94'2082" }).instrumento, null);
  // parâmetro repetido: vale o primeiro
  assert.equal(pilhaDaUrl({ uf: ["PB", "SP"] }).uf, "PB");
});

test("C3a: lente e vista — valores fora da lista voltam ao padrão; lente só com município", () => {
  assert.equal(pilhaDaUrl({ uf: "PB", ibge: PATOS, lente: "sociedade" }).lente, "sociedade");
  assert.equal(pilhaDaUrl({ uf: "PB", ibge: PATOS, lente: "outra" }).lente, "publico");
  assert.equal(pilhaDaUrl({ uf: "PB", lente: "sociedade" }).lente, "publico");
  assert.equal(pilhaDaUrl({ vista: "plana" }).vista, "plana");
  assert.equal(pilhaDaUrl({ vista: "camadas" }).vista, "camadas");
  assert.equal(pilhaDaUrl({ vista: "3d" }).vista, null);
});

test("C3a: pilha → URL → pilha — ida e volta sem perda, em ordem fixa", () => {
  assert.equal(urlExplorador(PILHA_VAZIA), "/mapa/explorador");
  assert.equal(urlExplorador(FUNDA), "/mapa/explorador?uf=PB&ibge=2510808&cnpj=09084815000170&instrumento=942082");
  const casos: PilhaExplorador[] = [
    PILHA_VAZIA,
    { ...PILHA_VAZIA, uf: "SP" },
    { ...PILHA_VAZIA, uf: "PB", ibge: PATOS, lente: "sociedade" },
    { ...FUNDA, lente: "sociedade", vista: "plana" },
    { ...PILHA_VAZIA, vista: "camadas" },
  ];
  for (const p of casos) assert.deepEqual(ler(urlExplorador(p)), p);
  // nível sem o de cima não entra no endereço
  assert.equal(urlExplorador({ ibge: PATOS, cnpj: CNPJ }), "/mapa/explorador");
  assert.equal(urlExplorador({ uf: "PB", cnpj: CNPJ, lente: "sociedade" }), "/mapa/explorador?uf=PB");
});

test("C3a: níveis, topo e profundidade", () => {
  assert.deepEqual(niveisDaPilha(FUNDA), NIVEIS);
  assert.equal(profundidade(FUNDA), 5);
  assert.equal(nivelDoTopo(FUNDA), "instrumento");
  assert.equal(nivelDoTopo(PILHA_VAZIA), "brasil");
  assert.equal(nivelDoTopo({ ...PILHA_VAZIA, uf: "SP" }), "uf");
});

test("C3a: corte, pai e filho — a volta e a descida de cada camada", () => {
  assert.deepEqual(pilhaAte(FUNDA, "municipio"), { ...FUNDA, cnpj: null, instrumento: null });
  assert.deepEqual(pilhaAte({ ...FUNDA, lente: "sociedade", vista: "plana" }, "uf"), { ...PILHA_VAZIA, uf: "PB", vista: "plana" });
  assert.equal(urlDoNivel(FUNDA, "brasil"), "/mapa/explorador");
  assert.equal(urlDoNivel(FUNDA, "entidade"), "/mapa/explorador?uf=PB&ibge=2510808&cnpj=09084815000170");
  assert.equal(urlPai(FUNDA), "/mapa/explorador?uf=PB&ibge=2510808&cnpj=09084815000170");
  assert.equal(urlPai({ ...PILHA_VAZIA, uf: "PB" }), "/mapa/explorador");
  assert.equal(urlPai(PILHA_VAZIA), null);
  // a vista viaja em toda a descida e em toda a volta
  const plana = { ...PILHA_VAZIA, vista: "plana" as const };
  assert.equal(urlFilho(plana, "brasil", "PB"), "/mapa/explorador?uf=PB&vista=plana");
  assert.equal(urlPai({ ...plana, uf: "PB" }), "/mapa/explorador?vista=plana");
  // descer a partir de uma camada de trás corta o que estava abaixo dela
  assert.equal(urlFilho(FUNDA, "uf", "2504009"), "/mapa/explorador?uf=PB&ibge=2504009");
  // a lente vai junto do município à entidade, e volta com ela
  const soc = { ...PILHA_VAZIA, uf: "PB", ibge: PATOS, lente: "sociedade" as const };
  assert.equal(urlFilho(soc, "municipio", CNPJ), "/mapa/explorador?uf=PB&ibge=2510808&cnpj=09084815000170&lente=sociedade");
  assert.equal(urlPai({ ...soc, cnpj: CNPJ }), "/mapa/explorador?uf=PB&ibge=2510808&lente=sociedade");
  assert.equal(urlFilho({ ...soc, cnpj: CNPJ }, "entidade", "942082"), "/mapa/explorador?uf=PB&ibge=2510808&cnpj=09084815000170&instrumento=942082&lente=sociedade");
  // trocar a lente volta ao município; trocar a vista guarda a pilha
  assert.equal(urlDaLente(FUNDA, "sociedade"), "/mapa/explorador?uf=PB&ibge=2510808&lente=sociedade");
  assert.equal(urlDaLente(FUNDA, "publico"), "/mapa/explorador?uf=PB&ibge=2510808");
  assert.equal(urlDaVista(FUNDA, "plana"), `${urlExplorador(FUNDA)}&vista=plana`);
  assert.equal(urlDaVista({ ...FUNDA, vista: "plana" }, null), urlExplorador(FUNDA));
});

test("C3a: limite de camadas — no máximo 3 desenhadas; as mais antigas ficam só na trilha", () => {
  assert.equal(MAX_CAMADAS, 3);
  assert.deepEqual(niveisDesenhados(PILHA_VAZIA), ["brasil"]);
  assert.deepEqual(niveisDesenhados({ ...PILHA_VAZIA, uf: "PB", ibge: PATOS }), ["brasil", "uf", "municipio"]);
  assert.deepEqual(niveisDesenhados({ ...FUNDA, instrumento: null }), ["uf", "municipio", "entidade"]);
  assert.deepEqual(niveisDesenhados(FUNDA), ["municipio", "entidade", "instrumento"]);
  assert.deepEqual(niveisDesenhados(FUNDA, 1), ["instrumento"]);
  assert.deepEqual(niveisDesenhados(FUNDA, 0), ["instrumento"]);
  // a trilha continua com os 5
  assert.equal(elosDoExplorador(FUNDA).length, 5);
  // as chaves: trocar a lente não troca a camada; trocar o município troca
  assert.equal(chaveDaCamada({ ...FUNDA, lente: "sociedade" }, "municipio"), chaveDaCamada(FUNDA, "municipio"));
  assert.notEqual(chaveDaCamada({ ...FUNDA, ibge: "2504009" }, "municipio"), chaveDaCamada(FUNDA, "municipio"));
  assert.equal(new Set(NIVEIS.map((n) => chaveDaCamada(FUNDA, n))).size, 5);
});

test("C3a: rótulos e nomes — do IBGE com acento; sem o nome do banco, o código legível", () => {
  assert.deepEqual(
    NIVEIS.map((n) => ROTULO_NIVEL[n]),
    ["País", "Estado", "Município", "Entidade", "Instrumento"],
  );
  assert.equal(nomeDoNivel(FUNDA, "uf"), "Paraíba");
  assert.equal(nomeDoNivel(FUNDA, "municipio"), "Patos");
  assert.equal(nomeDoNivel({ ...FUNDA, ibge: "2516201" }, "municipio"), "Sousa");
  assert.equal(nomeDoNivel(FUNDA, "entidade"), "CNPJ 09.084.815/0001-70");
  assert.equal(nomeDoNivel(FUNDA, "entidade", { entidade: "MUNICIPIO DE PATOS" }), "MUNICIPIO DE PATOS");
  assert.equal(nomeDoNivel(FUNDA, "instrumento"), "Instrumento nº 942082");
  assert.equal(nomeDoNivel(FUNDA, "instrumento", { modalidade: "CONVENIO" }), "Convênio nº 942082");
});

test("C3a: trilha — cada elo leva à sua camada; o último é a camada aberta, sem link", () => {
  const elos = elosDoExplorador(FUNDA, { entidade: "MUNICIPIO DE PATOS", modalidade: "CONVENIO" });
  assert.deepEqual(
    elos.map((e) => e.rotulo),
    ["Brasil", "Paraíba", "Patos", "MUNICIPIO DE PATOS", "Convênio nº 942082"],
  );
  assert.deepEqual(
    elos.map((e) => e.href),
    [
      "/mapa/explorador",
      "/mapa/explorador?uf=PB",
      "/mapa/explorador?uf=PB&ibge=2510808",
      "/mapa/explorador?uf=PB&ibge=2510808&cnpj=09084815000170",
      null,
    ],
  );
  assert.deepEqual(elosDoExplorador(PILHA_VAZIA), [{ rotulo: "Brasil", href: null }]);
});

test("C3a: anúncio — posição na descida e a trilha, sem o separador gráfico", () => {
  assert.equal(anuncioDaCamada(PILHA_VAZIA), "Camada 1 de 5, país: Brasil.");
  assert.equal(
    anuncioDaCamada({ ...PILHA_VAZIA, uf: "PB", ibge: PATOS }),
    "Camada 3 de 5, município: Patos. Trilha: Brasil, Paraíba, Patos.",
  );
  assert.ok(!anuncioDaCamada(FUNDA).includes("›"));
});

test("C3a: páginas de cada nível — a completa e o relatório (o laudo, no instrumento)", () => {
  assert.deepEqual(paginasDoNivel(FUNDA, "brasil"), {
    completa: { rotulo: "Página do Brasil", href: "/mapa/brasil" },
    relatorio: { rotulo: "Relatório do Brasil", href: "/mapa/brasil/relatorio" },
  });
  assert.equal(paginasDoNivel(FUNDA, "uf").completa.href, "/mapa/uf/pb");
  assert.equal(paginasDoNivel(FUNDA, "municipio").relatorio.href, "/mapa/municipio/2510808/relatorio");
  assert.equal(paginasDoNivel(FUNDA, "entidade").completa.href, "/mapa/entidade/09084815000170");
  assert.equal(paginasDoNivel(FUNDA, "entidade").relatorio.href, "/mapa/entidade/09084815000170/relatorio");
  assert.equal(paginasDoNivel(FUNDA, "instrumento").relatorio.href, "/mapa/instrumento/942082/laudo");
});

test("C3a: regiões da descida — os 223, cada um uma vez, em ordem alfabética dentro da região", () => {
  const rs = regioesDaDescida();
  assert.equal(rs.length, 15);
  const todos = rs.flatMap((r) => r.municipios.map((m) => m.ibge));
  assert.equal(todos.length, 223);
  assert.equal(new Set(todos).size, MUNICIPIOS_PB.length);
  // na ordem da legenda: intermediárias em ordem alfabética
  assert.equal(rs[0].intermediaria, "Campina Grande");
  assert.equal(rs[rs.length - 1].intermediaria, "Sousa - Cajazeiras");
  for (const r of rs) {
    const nomes = r.municipios.map((m) => m.nome);
    assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
  }
  // os nomes vêm com acento, da lista do IBGE
  assert.ok(rs.some((r) => r.municipios.some((m) => m.nome === "Água Branca")));
});

test("C3a: lentes — poder público (municipal e estado), sociedade civil e o resto só contado", () => {
  const e = (cnpj: string): EntidadeNoMunicipio => ({ cnpj, nome: cnpj, especie: "outro", instrumentos: 1, emExecucao: 0, valor: 1, ultimoAno: 2024 });
  const l = lentesDoExplorador([
    { lente: "municipal", entidades: [e("a"), e("b")] },
    { lente: "estado", entidades: [e("c")] },
    { lente: "sociedade", entidades: [e("d")] },
    { lente: "outros", entidades: [e("e"), e("f"), e("g")] },
  ]);
  assert.deepEqual(l.publico.map((g) => g.lente), ["municipal", "estado"]);
  assert.equal(totalDaLente(l, "publico"), 3);
  assert.equal(totalDaLente(l, "sociedade"), 1);
  assert.equal(l.outros, 3);
  const vazio = lentesDoExplorador([]);
  assert.deepEqual(vazio, { publico: [], sociedade: [], outros: 0 });
});

test("C3a: 3D — pose por distância (só transform e opacidade) e direção da troca", () => {
  assert.deepEqual(poseDaCamada(0), { y: -0, z: -0, opacity: 1 });
  const um = poseDaCamada(1);
  const dois = poseDaCamada(2);
  assert.ok(um.z < 0 && dois.z < um.z, "cada camada de trás recua mais");
  assert.ok(um.y < 0 && dois.y < um.y, "e sobe, para a borda dela aparecer acima da da frente");
  assert.ok(dois.opacity < um.opacity && um.opacity < 1);
  // a partir do limite, a camada some: é por onde a mais antiga sai
  assert.equal(poseDaCamada(MAX_CAMADAS).opacity, 0);
  assert.equal(poseDaCamada(-1).opacity, 1);
  assert.deepEqual(Object.keys(poseDaFrente()).sort(), ["opacity", "y", "z"]);
  assert.ok(poseDaFrente().z > 0 && poseDaFrente().opacity === 0);
  assert.equal(direcaoDaTroca(2, 3), "desce");
  assert.equal(direcaoDaTroca(5, 1), "sobe");
  assert.equal(direcaoDaTroca(3, 3), "desce");
});

test("C3a: vista — o pedido vence; sem pedido, reduzir movimento ou aparelho fraco levam à plana", () => {
  assert.equal(vistaEfetiva(null, false, false), "camadas");
  assert.equal(vistaEfetiva(null, true, false), "plana");
  assert.equal(vistaEfetiva(null, false, true), "plana");
  assert.equal(vistaEfetiva("camadas", true, true), "camadas");
  assert.equal(vistaEfetiva("plana", false, false), "plana");
  assert.equal(aparelhoFraco({ memoriaGb: 2 }), true);
  assert.equal(aparelhoFraco({ nucleos: 2 }), true);
  assert.equal(aparelhoFraco({ memoriaGb: 8, nucleos: 8 }), false);
  assert.equal(aparelhoFraco({}), false);
  assert.equal(aparelhoFraco({ memoriaGb: 0, nucleos: 0 }), false);
  assert.equal(quadrosLentos([16, 17, 16, 18, 16, 17]), false);
  assert.equal(quadrosLentos([50, 48, 52, 60, 45, 70]), true);
  assert.equal(quadrosLentos([80, 90]), false, "poucas amostras não decidem");
  assert.equal(quadrosLentos([16, 16, 16, 100, 120, 16]), false, "um engasgo isolado não decide");
});
