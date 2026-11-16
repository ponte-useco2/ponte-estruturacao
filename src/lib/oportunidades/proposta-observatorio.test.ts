/**
 * Teste da proposta do Observatório de Mobilidade Urbana (16/11/2026): o modelo que carrega o que ainda não se sabe, o
 * dinheiro em centavos inteiros, a proposta da PONTE para apreciação sem endosso emprestado, e a página e a folha lendo o
 * mesmo dado.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { APRESENTACAO, PROPOSTA } from "../../app/sala/_salas/observatorio-mobilidade/dados.ts";
import {
  CODIGOS_PRODUTO,
  LIMITE_OBJETO_CURTO,
  centavosEmReais,
  AVISO_ATIVOS,
  TIPOS_DE_ATIVO,
  centavosResumidos,
  evidenciasDe,
  lerComposicao,
  naturezaDaProposta,
  pendenciasDaApresentacao,
  ROTULO_GRAU,
  prontidaoTecnica,
  seloDeEstado,
  totalDoItem,
  type Apresentacao,
  type ItemDeComposicao,
  type Proposta,
} from "./proposta-observatorio.ts";

/** Uma linha definida, para montar casos. */
const linha = (atividade: string, quantidade: number, centavos: number, produtos: ItemDeComposicao["produtos"]): ItemDeComposicao => ({
  atividade,
  unidade: "mês",
  quantidade: { estado: "definida", valor: quantidade },
  valorUnitario: { estado: "definido", centavos },
  produtos,
});

/** Uma composição fictícia que fecha exatamente R$ 200.000,00 e serve aos quatro produtos. SÓ PARA TESTE. */
const FECHA: ItemDeComposicao[] = [
  linha("teste A", 4, 1_250_000, ["P1"]),
  linha("teste B", 4, 1_250_000, ["P2"]),
  linha("teste C", 2, 2_500_000, ["P3"]),
  linha("teste D", 1, 5_000_000, ["P4", "P1"]),
];

const comComposicao = (composicao: ItemDeComposicao[], extra: Partial<Proposta> = {}): Proposta => ({
  ...PROPOSTA,
  composicao,
  ...extra,
});

// ------------------------------------------------------------------ o conteúdo real da minuta

test("a minuta traz os quatro produtos, P1 a P4, cada um com evidência objetiva", () => {
  assert.deepEqual(PROPOSTA.produtos.map((p) => p.codigo), [...CODIGOS_PRODUTO]);
  for (const p of PROPOSTA.produtos) {
    assert.ok(p.nome.trim(), `${p.codigo} sem nome`);
    assert.ok(p.evidencia.trim(), `${p.codigo} sem evidência`);
  }
});

test("a proposta: autoria da PONTE, executora prevista Ilha Tech, R$ 200.000,00 em 8 meses", () => {
  assert.match(PROPOSTA.autoria, /^PONTE/);
  assert.equal(PROPOSTA.executoraPrevista, "Associação Ilha Tech");
  assert.equal(PROPOSTA.investimentoPretendidoCentavos, 20_000_000);
  assert.equal(centavosEmReais(PROPOSTA.investimentoPretendidoCentavos), "R$ 200.000,00");
  assert.equal(PROPOSTA.prazoMeses, 8);
});

test("a minuta não inventa: composição e evidências vazias até a equipe preencher", () => {
  assert.deepEqual(PROPOSTA.composicao, []);
  assert.deepEqual(PROPOSTA.evidencias, []);
});

test("a minuta real não está pronta, e a pendência do orçamento vem nomeada", () => {
  const r = prontidaoTecnica(PROPOSTA);
  assert.equal(r.pronta, false);
  assert.ok(r.pendencias.includes("A composição do orçamento ainda não foi informada."), r.pendencias.join(" | "));
  assert.equal(r.pendencias.length, 1, "o resto da minuta está completo: só o orçamento falta");
});

test("o objeto curto real cabe no teto", () => {
  assert.ok(PROPOSTA.objetoCurto.length <= LIMITE_OBJETO_CURTO, `${PROPOSTA.objetoCurto.length} caracteres`);
});

test("a proposta está para apreciação, com a versão identificável", () => {
  assert.equal(PROPOSTA.situacao, "para-apreciacao");
  assert.match(PROPOSTA.versao, /^\d{4}-\d{2}-\d{2}\.\d+$/);
});

// ------------------------------------------------------------------ dinheiro em centavos inteiros

test("centavosEmReais formata por aritmética inteira", () => {
  assert.equal(centavosEmReais(0), "R$ 0,00");
  assert.equal(centavosEmReais(5), "R$ 0,05");
  assert.equal(centavosEmReais(123_456_789), "R$ 1.234.567,89");
  assert.equal(centavosEmReais(-150), "-R$ 1,50");
  assert.throws(() => centavosEmReais(10.5));
});

test("valores inválidos são rejeitados, nunca arredondados", () => {
  const base = linha("x", 1, 100, ["P1"]);
  for (const centavos of [0, -100, 10.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60]) {
    const t = totalDoItem({ ...base, valorUnitario: { estado: "definido", centavos } });
    assert.equal(t.estado, "invalido", `valor ${centavos} deveria ser inválido`);
  }
  for (const valor of [0, -1, Number.NaN]) {
    const t = totalDoItem({ ...base, quantidade: { estado: "definida", valor } });
    assert.equal(t.estado, "invalido", `quantidade ${valor} deveria ser inválida`);
  }
  // 1,5 × 333 centavos = 499,5 centavos: não dá centavo inteiro, e por isso não vale.
  assert.equal(totalDoItem(linha("meio", 1.5, 333, ["P1"])).estado, "invalido");
  assert.deepEqual(totalDoItem(linha("ok", 1.5, 200, ["P1"])), { estado: "definido", centavos: 300 });
});

test("linha em elaboração não entra como zero: fica contada à parte", () => {
  const c = lerComposicao([
    linha("definida", 2, 1_000, ["P1"]),
    { atividade: "pendente", unidade: "hora", quantidade: { estado: "em-elaboracao" }, valorUnitario: { estado: "definido", centavos: 500 }, produtos: ["P2"] },
  ]);
  assert.equal(c.definidoCentavos, 2_000);
  assert.equal(c.emElaboracao, 1);
  assert.deepEqual(c.invalidos, []);
});

// ------------------------------------------------------------------ prontidão técnica

test("uma linha em elaboração impede a prontidão, mesmo com o resto fechando", () => {
  const pendente: ItemDeComposicao = { ...FECHA[3], valorUnitario: { estado: "em-elaboracao", nota: "cotação" } };
  const r = prontidaoTecnica(comComposicao([...FECHA.slice(0, 3), pendente]));
  assert.equal(r.pronta, false);
  assert.ok(r.pendencias.some((x) => x.includes("em elaboração")), r.pendencias.join(" | "));
});

test("a soma tem de fechar com o investimento, ao centavo", () => {
  const um = [...FECHA.slice(0, 3), linha("teste D", 1, 4_999_999, ["P4", "P1"])];
  const r = prontidaoTecnica(comComposicao(um));
  assert.equal(r.pronta, false);
  assert.ok(r.pendencias.some((x) => x.includes("R$ 199.999,99") && x.includes("R$ 200.000,00")), r.pendencias.join(" | "));
});

test("todo produto precisa de pelo menos uma linha da composição", () => {
  const semP3 = FECHA.map((l) => (l.produtos.includes("P3") ? { ...l, produtos: ["P2" as const] } : l));
  const r = prontidaoTecnica(comComposicao(semP3));
  assert.ok(r.pendencias.includes("Nenhuma linha da composição serve a P3."), r.pendencias.join(" | "));
});

test("linha sem produto ou com produto inexistente é inválida", () => {
  const r = prontidaoTecnica(comComposicao([...FECHA, { ...linha("solta", 1, 100, []) }, { ...linha("errada", 1, 100, ["P9" as never]) }]));
  assert.ok(r.pendencias.some((x) => x.includes('"solta" não está ligada')), r.pendencias.join(" | "));
  assert.ok(r.pendencias.some((x) => x.includes("produto inexistente (P9)")), r.pendencias.join(" | "));
});

test("o limite do objeto curto é conferido dentro da prontidão", () => {
  const longo = "a".repeat(LIMITE_OBJETO_CURTO + 1);
  const r = prontidaoTecnica(comComposicao(FECHA, { objetoCurto: longo }));
  assert.equal(r.pronta, false);
  assert.ok(r.pendencias.some((x) => x.includes(`${LIMITE_OBJETO_CURTO + 1} caracteres`)), r.pendencias.join(" | "));
  assert.ok(prontidaoTecnica(comComposicao(FECHA, { objetoCurto: "" })).pendencias.includes("Falta o objeto curto."));
});

test("produtos: faltar um, repetir um ou perder a evidência impede a prontidão", () => {
  const [p1, p2, p3] = PROPOSTA.produtos;
  assert.equal(prontidaoTecnica(comComposicao(FECHA, { produtos: [p1, p2, p3] })).pronta, false);
  assert.equal(prontidaoTecnica(comComposicao(FECHA, { produtos: [p1, p2, p3, { ...p3 }] })).pronta, false);
  const semEvidencia = PROPOSTA.produtos.map((p) => (p.codigo === "P2" ? { ...p, evidencia: "  " } : p));
  assert.ok(prontidaoTecnica(comComposicao(FECHA, { produtos: semEvidencia })).pendencias.includes("P2 está sem evidência objetiva de conclusão."));
});

test("investimento e prazo inválidos são pendência", () => {
  assert.ok(prontidaoTecnica(comComposicao(FECHA, { investimentoPretendidoCentavos: 200_000.5 })).pendencias.some((x) => x.includes("investimento pretendido é inválido")));
  assert.ok(prontidaoTecnica(comComposicao(FECHA, { prazoMeses: 0 })).pendencias.includes("O prazo em meses é inválido."));
});

test("o caminho feliz existe: composição que fecha e serve aos quatro produtos deixa o conteúdo pronto", () => {
  const r = prontidaoTecnica(comComposicao(FECHA));
  assert.deepEqual(r.pendencias, []);
  assert.equal(r.pronta, true);
});

// ------------------------------------------------------------------ prontidão técnica ≠ autorização institucional

test("o selo e a natureza: proposta da PONTE para apreciação, executora prevista, sem aprovação de ninguém", () => {
  assert.equal(seloDeEstado(PROPOSTA), `Proposta para apreciação · versão preliminar ${PROPOSTA.versao}`);
  const natureza = naturezaDaProposta(PROPOSTA);
  assert.match(natureza, /^Proposta elaborada pela PONTE/);
  assert.match(natureza, /Entidade executora prevista: Associação Ilha Tech\.$/);
  assert.doesNotMatch(natureza + seloDeEstado(PROPOSTA), /aprov|autoriz|endoss|minuta/i);
});

test("nenhuma função muda a proposta que recebe", () => {
  const congelada = structuredClone(comComposicao(FECHA));
  const antes = JSON.stringify(congelada);
  prontidaoTecnica(congelada);
  naturezaDaProposta(congelada);
  seloDeEstado(congelada);
  lerComposicao(congelada.composicao);
  evidenciasDe(congelada, "previsto");
  assert.equal(JSON.stringify(congelada), antes);
});

test("conteúdo completo não muda a situação: a proposta continua para apreciação", () => {
  const pronta = comComposicao(FECHA);
  assert.equal(prontidaoTecnica(pronta).pronta, true);
  assert.equal(pronta.situacao, "para-apreciacao");
  assert.equal(seloDeEstado(pronta), seloDeEstado(PROPOSTA));
});

// ------------------------------------------------------------------ evidências em três graus

test("os três graus de evidência não se misturam", () => {
  const p: Proposta = {
    ...PROPOSTA,
    evidencias: [
      { grau: "previsto", texto: "campo" },
      { grau: "demonstrado", texto: "cálculo" },
      { grau: "hipotese", texto: "expansão" },
      { grau: "previsto", texto: "protocolo" },
    ],
  };
  assert.deepEqual(evidenciasDe(p, "demonstrado"), ["cálculo"]);
  assert.deepEqual(evidenciasDe(p, "previsto"), ["campo", "protocolo"]);
  assert.deepEqual(evidenciasDe(p, "hipotese"), ["expansão"]);
});

// ------------------------------------------------------------------ página e folha: o mesmo dado

const fonte = (arquivo: string) =>
  readFileSync(new URL(`../../app/sala/_salas/observatorio-mobilidade/${arquivo}`, import.meta.url), "utf8");

test("a folha não tem fonte própria: recebe a proposta por parâmetro, sem importar o dado nem repetir o texto", () => {
  const folha = fonte("Folha.tsx");
  assert.doesNotMatch(folha, /from "\.\/dados"/, "a folha não pode ler o dado por conta própria");
  for (const p of PROPOSTA.produtos) assert.ok(!folha.includes(p.evidencia), `a folha repete o texto de ${p.codigo}`);
  assert.ok(!folha.includes(PROPOSTA.objetoCurto.slice(0, 40)), "a folha repete o objeto curto");
  assert.ok(!folha.includes("200.000"), "a folha escreve o investimento à mão");
  assert.ok(!folha.includes(PROPOSTA.titulo), "a folha escreve o título à mão");
  assert.ok(!folha.includes(PROPOSTA.autoria), "a folha escreve a autoria à mão");
  assert.ok(!folha.includes(PROPOSTA.executoraPrevista), "a folha escreve a executora à mão");
  for (const c of APRESENTACAO.conversa) assert.ok(!folha.includes(c), "a folha repete a conversa à mão");
  for (const e of APRESENTACAO.etapas) {
    assert.ok(!folha.includes(e.trecho), `a folha repete a atividade de ${e.produto}`);
    assert.ok(!folha.includes(e.entrega), `a folha repete a entrega de ${e.produto}`);
  }
  for (const x of APRESENTACAO.sintese) assert.ok(!folha.includes(x.texto), `a folha repete a síntese "${x.verbo}"`);
  for (const r of APRESENTACAO.reuso) assert.ok(!folha.includes(r.uso), `a folha repete o uso de "${r.ativo}"`);
});

test("a página passa à folha o mesmo objeto que ela mesma mostra", () => {
  const conteudo = fonte("Conteudo.tsx");
  assert.match(conteudo, /<Folha proposta=\{proposta\} apresentacao=\{apresentacao\}/);
  assert.match(conteudo, /import \{ APRESENTACAO, PROPOSTA \} from "\.\/dados"/);
});

test("na impressão sai só a folha; na tela, a folha não aparece", () => {
  const css = fonte("observatorio.css");
  assert.match(css, /\.ob-folha\s*\{[^}]*display:\s*none/);
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /\.ob-tela\s*\{[^}]*display:\s*none/);
  assert.match(print, /\.ob-folha\s*\{[^}]*display:\s*block/);
});

// ------------------------------------------------------------------ rodada visual: textos de apresentação

test("os textos de apresentação reais estão em ordem: só faltam a evidência técnica e a revisão final", () => {
  assert.deepEqual(pendenciasDaApresentacao(PROPOSTA, APRESENTACAO), [
    "Nenhum resultado técnico verificado foi recebido nesta sala: nada aparece como comprovado.",
    "Os textos de apresentação estão em redação provisória.",
  ]);
  assert.equal(APRESENTACAO.estado, "redacao-provisoria", "a validação é da Ilha Tech, não do código");
});

test("cada etapa é cópia literal do objeto completo, na ordem P1 a P4", () => {
  assert.deepEqual(APRESENTACAO.etapas.map((e) => e.produto), [...CODIGOS_PRODUTO]);
  assert.deepEqual(APRESENTACAO.etapas.map((e) => e.rotulo), ["Dados", "Modelos", "Validação", "Resultados"]);
  for (const e of APRESENTACAO.etapas) assert.ok(PROPOSTA.objetoCompleto.includes(e.trecho), e.trecho);
});

test("etapa que diz o que o objeto não diz é pendência", () => {
  const inventada: Apresentacao = {
    ...APRESENTACAO,
    etapas: APRESENTACAO.etapas.map((e) => (e.produto === "P3" ? { ...e, trecho: "mede o tempo real de caminhada" } : e)),
  };
  const r = pendenciasDaApresentacao(PROPOSTA, inventada);
  assert.ok(r.some((x) => x.startsWith("A etapa de P3 diz algo que o objeto completo não diz")), r.join(" | "));
});

test("etapas fora de ordem, faltando ou repetidas são pendência", () => {
  const [a, b, c, d] = APRESENTACAO.etapas;
  for (const etapas of [[b, a, c, d], [a, b, c], [a, b, c, c]]) {
    const r = pendenciasDaApresentacao(PROPOSTA, { ...APRESENTACAO, etapas });
    assert.ok(r.includes("As etapas precisam seguir P1 a P4, uma por produto."), r.join(" | "));
  }
});

test("texto de apresentação com número é barrado: estatística só com fonte conferida", () => {
  const comNumero: Apresentacao = {
    ...APRESENTACAO,
    problema: { ...APRESENTACAO.problema, necessidade: "Hoje 40% da população anda mais de 1 km até a unidade de saúde." },
  };
  const r = pendenciasDaApresentacao(PROPOSTA, comNumero);
  assert.ok(r.some((x) => x.startsWith("Texto de apresentação com número")), r.join(" | "));
  for (const t of [APRESENTACAO.problema.pergunta, APRESENTACAO.problema.necessidade, APRESENTACAO.solucao, APRESENTACAO.expansao]) {
    assert.doesNotMatch(t, /\d/, t);
  }
});

test("validados os textos, a pendência some; sem fontes, volta", () => {
  const validada: Apresentacao = { ...APRESENTACAO, estado: "validada" };
  assert.deepEqual(pendenciasDaApresentacao(PROPOSTA, validada), [
    "Nenhum resultado técnico verificado foi recebido nesta sala: nada aparece como comprovado.",
  ]);
  assert.ok(pendenciasDaApresentacao(PROPOSTA, { ...validada, fontes: [] }).includes("Faltam as fontes documentais."));
});

test("a expansão é apresentada como hipótese, não como compromisso", () => {
  assert.match(APRESENTACAO.expansao, /^A ampliação do Observatório além desta etapa/);
  assert.doesNotMatch(APRESENTACAO.expansao, /\b(vai|irá|garante|garantirá|será)\b/i);
});

test("centavosResumidos: 'R$ 200 mil' só quando é mil exato; senão, o valor exato, sem arredondar", () => {
  assert.equal(centavosResumidos(PROPOSTA.investimentoPretendidoCentavos), "R$ 200 mil");
  assert.equal(centavosResumidos(150_000_000), "R$ 1.500 mil");
  assert.equal(centavosResumidos(20_000_050), "R$ 200.000,50");
  assert.equal(centavosResumidos(19_999_900), "R$ 199.999,00");
});

// ------------------------------------------------------------------ rodada 5: clareza e controle de divulgação

const comPendencia = (a: Apresentacao, inicio: string) =>
  pendenciasDaApresentacao(PROPOSTA, a).some((x) => x.startsWith(inicio));

test("os rótulos dos graus são as perguntas que a sala tem de responder", () => {
  assert.equal(ROTULO_GRAU.demonstrado, "O que já foi demonstrado");
  assert.equal(ROTULO_GRAU.previsto, "O que esta pesquisa vai verificar");
  assert.equal(ROTULO_GRAU.hipotese, "O que é hipótese de expansão");
});

test("a síntese de abertura cobre os quatro produtos e fala no futuro", () => {
  const cobertos = new Set(APRESENTACAO.sintese.flatMap((x) => x.produtos));
  assert.deepEqual([...cobertos].sort(), [...CODIGOS_PRODUTO]);
  const semP4: Apresentacao = { ...APRESENTACAO, sintese: APRESENTACAO.sintese.map((x) => ({ ...x, produtos: x.produtos.filter((c) => c !== "P4") })) };
  assert.ok(comPendencia(semP4, "A síntese de abertura precisa cobrir os quatro produtos."));
  const noPassado: Apresentacao = {
    ...APRESENTACAO,
    sintese: [{ ...APRESENTACAO.sintese[0], texto: "o modelo que já foi validado em campo." }, ...APRESENTACAO.sintese.slice(1)],
  };
  assert.ok(comPendencia(noPassado, 'A síntese ("Desenvolver") fala como se já estivesse feita.'));
});

test("cada produto tem entrega tangível, sem meta numérica e sem falar como coisa feita", () => {
  for (const e of APRESENTACAO.etapas) {
    assert.ok(e.entrega.trim(), `${e.produto} sem entrega`);
    assert.doesNotMatch(e.entrega, /\d/, `${e.produto}: ${e.entrega}`);
  }
  const comMeta: Apresentacao = {
    ...APRESENTACAO,
    etapas: APRESENTACAO.etapas.map((e) => (e.produto === "P3" ? { ...e, entrega: "Pesquisa de campo em 12 bairros." } : e)),
  };
  assert.ok(comPendencia(comMeta, "Texto de apresentação com número"));
  const feita: Apresentacao = {
    ...APRESENTACAO,
    etapas: APRESENTACAO.etapas.map((e) => (e.produto === "P2" ? { ...e, entrega: "Protótipo já validado." } : e)),
  };
  assert.ok(comPendencia(feita, "A entrega de P2 fala como se já estivesse feita."));
});

test("o que fica para o Observatório é só o que a evidência de aceite já prevê", () => {
  for (const r of APRESENTACAO.reuso) {
    const evid = PROPOSTA.produtos.find((x) => x.codigo === r.produto)!.evidencia.toLowerCase();
    assert.ok(evid.includes(r.ativo.toLowerCase()), `${r.ativo} não consta da evidência de ${r.produto}`);
  }
  // Os quatro produtos deixam ao menos um ativo.
  assert.deepEqual([...new Set(APRESENTACAO.reuso.map((r) => r.produto))].sort(), [...CODIGOS_PRODUTO]);
  const inventado: Apresentacao = {
    ...APRESENTACAO,
    reuso: [...APRESENTACAO.reuso, { tipo: "tecnologico", ativo: "Painel público em tempo real", produto: "P2", uso: "Acompanhamento da cidade." }],
  };
  assert.ok(comPendencia(inventado, 'O ativo "Painel público em tempo real" não consta da evidência de aceite de P2.'));
});

test("nada aparece como comprovado sem evidência técnica recebida verificada, e o contrário também é barrado", () => {
  assert.equal(APRESENTACAO.provaPreliminar.estado, "nao-recebida");
  assert.deepEqual(evidenciasDe(PROPOSTA, "demonstrado"), []);
  const comResultado: Proposta = { ...PROPOSTA, evidencias: [{ grau: "demonstrado", texto: "resultado de teste" }] };
  assert.ok(pendenciasDaApresentacao(comResultado, APRESENTACAO).some((x) => x.startsWith('Há resultado em "já demonstrado"')));
  const verificadaVazia: Apresentacao = { ...APRESENTACAO, provaPreliminar: { ...APRESENTACAO.provaPreliminar, estado: "verificada" } };
  assert.ok(comPendencia(verificadaVazia, "A investigação preliminar consta como verificada"));
  // Com as duas coisas juntas, a pendência da evidência técnica some.
  const juntas = pendenciasDaApresentacao(comResultado, verificadaVazia);
  assert.ok(!juntas.some((x) => x.includes("comprovado") || x.includes("verificada")), juntas.join(" | "));
});

test("a página só mostra o quadro 'já demonstrado' quando há resultado verificado", () => {
  const conteudo = fonte("Conteudo.tsx");
  assert.match(conteudo, /\{demonstrado\.length > 0 && \(\s*<li className="ob-estado ob-estado-demonstrado">/);
  assert.match(conteudo, /\{demonstrado\.length === 0 && \(\s*<p className="ob-nota-estado"/);
});

test("os ativos se distribuem nas três naturezas, cada uma com a condição de reuso definida pelo titular", () => {
  assert.deepEqual(TIPOS_DE_ATIVO.map((t) => t.tipo), ["tecnologico", "metodologico", "registro"]);
  assert.equal(TIPOS_DE_ATIVO[0].condicao, "Reutilizáveis quando as condições técnicas e de uso permitirem.");
  assert.equal(TIPOS_DE_ATIVO[1].condicao, "Poderão orientar futuros projetos.");
  assert.equal(TIPOS_DE_ATIVO[2].condicao, "Reutilização sujeita às condições pertinentes.");
  const de = (tipo: string) => APRESENTACAO.reuso.filter((r) => r.tipo === tipo).map((r) => r.ativo);
  assert.deepEqual(de("tecnologico"), ["Catálogo de fontes", "Processamento documentado", "Protótipo", "Testes reproduzíveis"]);
  assert.deepEqual(de("metodologico"), ["Relatório metodológico", "Protocolo", "Plano de replicação"]);
  assert.deepEqual(de("registro"), ["Registros de campo", "Comparação entre estimativas e observações", "Demonstração registrada"]);
  assert.match(AVISO_ATIVOS, /entregas previstas.*não resultados já produzidos/);
  // Uma natureza vazia, ou um ativo sem natureza, é pendência.
  const semRegistros: Apresentacao = { ...APRESENTACAO, reuso: APRESENTACAO.reuso.filter((r) => r.tipo !== "registro") };
  assert.ok(comPendencia(semRegistros, 'Nenhum ativo em "Registros e evidências".'));
  const usoFeito: Apresentacao = { ...APRESENTACAO, reuso: [{ ...APRESENTACAO.reuso[0], uso: "Já foi usado pela prefeitura." }, ...APRESENTACAO.reuso.slice(1)] };
  assert.ok(comPendencia(usoFeito, 'O uso de "Catálogo de fontes" fala como se já estivesse feito.'));
});

test("nenhum texto atribui aprovação ou endosso a terceiros", () => {
  const endosso = (fontes: string[]): Apresentacao => ({ ...APRESENTACAO, fontes });
  assert.ok(comPendencia(endosso(["Proposta aprovada pela Associação Ilha Tech."]), "Texto de apresentação atribui aprovação"));
  assert.ok(comPendencia(endosso(["Projeto endossado pela prefeitura."]), "Texto de apresentação atribui aprovação"));
  assert.ok(!comPendencia(APRESENTACAO, "Texto de apresentação atribui aprovação"), "os textos reais estão limpos");
  assert.ok(APRESENTACAO.conversa.length > 0, "a sala termina num convite para a conversa");
});

test("a sala e a folha não trazem marca d'água nem linguagem de aprovação interna", () => {
  for (const arquivo of ["Conteudo.tsx", "Folha.tsx"]) {
    const codigo = fonte(arquivo).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""); // sem os comentários
    assert.doesNotMatch(codigo, /minuta|não divulgar|autoriza|aprovad|ob-folha-marca/i, arquivo);
  }
  assert.doesNotMatch(fonte("observatorio.css"), /ob-folha-marca/);
});
