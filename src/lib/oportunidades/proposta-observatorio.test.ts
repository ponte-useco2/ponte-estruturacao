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
  AVISO_CARTEIRA,
  AVISO_ENVELOPES,
  AVISO_MODULOS,
  AVISO_VALORES,
  DEFINICAO_AUTONOMIA,
  NATUREZAS_DO_VALOR,
  ROTULO_AUTONOMIA,
  centavosEmEscala,
  condicoesDeReaproveitamento,
  emSequencia,
  entradaDaCarteira,
  fontesDosValores,
  lerEnvelopes,
  lerModulos,
  lerValoresDoPrograma,
  pendenciasDaEstimativa,
  quantidadePorExtenso,
  emVoltaDoValor,
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
  for (const c of APRESENTACAO.proximaDecisao.temas) assert.ok(!folha.includes(c.texto.slice(0, 40)), "a folha repete a decisão à mão");
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
  assert.ok(APRESENTACAO.proximaDecisao.temas.length > 0, "a sala termina numa decisão possível");
});

test("a sala e a folha não trazem marca d'água nem linguagem de aprovação interna", () => {
  for (const arquivo of ["Conteudo.tsx", "Folha.tsx"]) {
    const codigo = fonte(arquivo).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""); // sem os comentários
    assert.doesNotMatch(codigo, /minuta|não divulgar|autoriza|aprovad|ob-folha-marca/i, arquivo);
  }
  assert.doesNotMatch(fonte("observatorio.css"), /ob-folha-marca/);
});

// ------------------------------------------------------------------ incremento macro: carteira, esquema, percursos

test("a carteira tem os seis projetos candidatos, na ordem definida, com a abertura do titular", () => {
  assert.deepEqual(APRESENTACAO.carteira.projetos.map((pr) => pr.nome), [
    "Acessibilidade territorial ampliada",
    "Mobilidade ativa e caminhabilidade",
    "Transporte coletivo e integração modal",
    "Segurança viária",
    "Avaliação de intervenções e investimentos",
    "Mobilidade sustentável e resiliência urbana",
  ]);
  assert.equal(
    APRESENTACAO.carteira.abertura,
    "O primeiro investimento constrói a capacidade. Os próximos ampliam o que João Pessoa poderá compreender e avaliar.",
  );
  for (const pr of APRESENTACAO.carteira.projetos) {
    assert.ok(pr.problema.trim() && pr.capacidade.trim(), pr.nome);
    assert.ok(pr.problema.endsWith("?"), `${pr.nome}: o problema é a pergunta que a cidade precisa responder`);
    assert.ok(pr.componentes.length > 0 && pr.dependencias.length > 0, pr.nome);
  }
  assert.match(AVISO_CARTEIRA, /hipóteses de expansão: nenhum tem financiamento ou apoio institucional definido/);
});

test("cada projeto só aproveita componentes que o demonstrador pretende deixar", () => {
  const ativos = new Set(APRESENTACAO.reuso.map((r) => r.ativo));
  for (const pr of APRESENTACAO.carteira.projetos) {
    for (const c of pr.componentes) assert.ok(ativos.has(c), `${pr.nome}: "${c}" não é ativo do demonstrador`);
  }
  const inventado: Apresentacao = {
    ...APRESENTACAO,
    carteira: {
      ...APRESENTACAO.carteira,
      projetos: APRESENTACAO.carteira.projetos.map((pr, i) => (i === 0 ? { ...pr, componentes: ["Plataforma de dados em nuvem"] } : pr)),
    },
  };
  assert.ok(comPendencia(inventado, '"Acessibilidade territorial ampliada" aproveita "Plataforma de dados em nuvem"'));
});

test("hipótese não presume dinheiro, não fala como coisa feita, e a carteira não perde projeto", () => {
  const com = (mudanca: Partial<Apresentacao["carteira"]["projetos"][number]>): Apresentacao => ({
    ...APRESENTACAO,
    carteira: { ...APRESENTACAO.carteira, projetos: APRESENTACAO.carteira.projetos.map((pr, i) => (i === 3 ? { ...pr, ...mudanca } : pr)) },
  });
  assert.ok(comPendencia(com({ capacidade: "Projeto financiado pela secretaria." }), '"Segurança viária" presume recurso assegurado'));
  assert.ok(comPendencia(com({ dependencias: ["Orçamento já reservado."] }), '"Segurança viária" presume recurso'));
  // Valor no texto, sem natureza, não é estimativa identificada: barra; o mesmo valor no campo próprio passa.
  assert.ok(comPendencia(com({ capacidade: "Monitorar sinistros por R$ 320 mil." }), '"Segurança viária" traz valor no texto'));
  assert.ok(!comPendencia(APRESENTACAO, "traz valor no texto"));
  assert.ok(comPendencia(com({ capacidade: "Monitoramento já implantado." }), '"Segurança viária" fala como se já estivesse feito.'));
  const cinco: Apresentacao = { ...APRESENTACAO, carteira: { ...APRESENTACAO.carteira, projetos: APRESENTACAO.carteira.projetos.slice(0, 5) } };
  assert.ok(comPendencia(cinco, "A carteira precisa dos seis projetos candidatos."));
  for (const pr of APRESENTACAO.carteira.projetos) {
    const textos = [pr.problema, pr.capacidade, ...pr.dependencias, ...pr.modulos.flatMap((m) => [m.titulo, ...m.entregas])];
    for (const t of textos) assert.doesNotMatch(t, /\d|R\$/, `${pr.nome}: ${t}`);
  }
});

const ATRIBUI = "Texto de apresentação atribui aprovação, apoio ou compromisso a interlocutor";
const comTextoDaDecisao = (texto: string): Apresentacao => ({
  ...APRESENTACAO,
  proximaDecisao: { ...APRESENTACAO.proximaDecisao, texto },
});

test("interlocutor pode ser identificado; aprovação, apoio ou compromisso não podem ser atribuídos a ele", () => {
  // Identificar é legítimo (versões futuras podem fazê-lo).
  assert.ok(!comPendencia(comTextoDaDecisao("A próxima decisão possível: proposta para apreciação de Ruy Dantas."), ATRIBUI));
  assert.ok(!comPendencia(comTextoDaDecisao("A próxima decisão possível pode envolver Thiago Lucena como interlocutor."), ATRIBUI));
  // Atribuir, não.
  for (const frase of [
    "Ruy Dantas vai levar a proposta adiante.",
    "Proposta com o apoio de Thiago Lucena.",
    "Ruy Dantas aprovou o enquadramento.",
    "Thiago Lucena assumiu o compromisso de financiar a etapa.",
  ]) {
    assert.ok(comPendencia(comTextoDaDecisao(frase), ATRIBUI), frase);
  }
  // A regra olha a frase: nome numa, verbo de compromisso noutra, sem atribuição.
  assert.ok(!comPendencia(comTextoDaDecisao("Proposta para apreciação de Ruy Dantas. A equipe vai aprofundar o enquadramento."), ATRIBUI));
  assert.ok(!comPendencia(APRESENTACAO, ATRIBUI));
});

test("nesta versão, Ruy Dantas e Thiago Lucena ficam fora do conteúdo (decisão do titular, 16/11/2026)", () => {
  const tudo = JSON.stringify({ PROPOSTA, APRESENTACAO });
  assert.doesNotMatch(tudo, /Ruy|Thiago|Lucena|Dantas/);
  assert.match(APRESENTACAO.proximaDecisao.texto, /^A próxima decisão possível/);
});

test("os temas da próxima decisão são os do titular: demonstrador e programa maior", () => {
  assert.deepEqual(APRESENTACAO.proximaDecisao.temas, [
    {
      rotulo: "Demonstrador",
      texto: "Aprofundar o enquadramento, a composição financeira e as condições de execução da etapa inicial de R$ 200 mil.",
    },
    {
      rotulo: "Programa maior",
      texto:
        "Selecionar os projetos prioritários da carteira, avaliar suas dependências e identificar instrumentos e " +
        "potenciais fontes de financiamento, sem pressupor compromissos já assumidos.",
    },
  ]);
  // O valor citado é o da proposta, não um número solto.
  assert.ok(APRESENTACAO.proximaDecisao.temas[0].texto.includes(centavosResumidos(PROPOSTA.investimentoPretendidoCentavos)));
  assert.deepEqual(pendenciasDaApresentacao(PROPOSTA, APRESENTACAO).filter((x) => /número|assegurado|interlocutor/.test(x)), []);
});

test("mencionar fontes potenciais de financiamento não é declarar recurso assegurado", () => {
  const ASSEGURADO = "Texto de apresentação dá recurso como assegurado";
  for (const frase of [
    "A próxima decisão possível: identificar instrumentos e potenciais fontes de financiamento.",
    "A próxima decisão possível: avaliar o orçamento necessário e os financiamentos possíveis.",
    "A próxima decisão possível: aprofundar a etapa inicial de R$ 200 mil.",
  ]) {
    assert.ok(!comPendencia(comTextoDaDecisao(frase), ASSEGURADO), frase);
  }
  for (const frase of [
    "A próxima decisão possível conta com recursos assegurados.",
    "A próxima decisão possível tem financiamento garantido.",
    "A próxima decisão possível será executada com recursos do fundo.",
    "A próxima decisão possível tem orçamento já reservado.",
    "A próxima decisão possível é a etapa financiada pela secretaria.",
  ]) {
    assert.ok(comPendencia(comTextoDaDecisao(frase), ASSEGURADO), frase);
  }
  // Outro valor que não o da proposta continua barrado no texto, como valor solto e como número; não é "recurso
  // assegurado": a trava de dinheiro presumido e a de valor sem natureza são duas.
  const outroValor = comTextoDaDecisao("A próxima decisão possível: aprofundar a etapa inicial de R$ 300 mil.");
  assert.ok(comPendencia(outroValor, "Texto de apresentação com valor solto"));
  assert.ok(comPendencia(outroValor, "Texto de apresentação com número"));
  assert.ok(!comPendencia(outroValor, ASSEGURADO));
  // Na carteira, a mesma distinção: dependência que cita fontes potenciais passa.
  const carteira: Apresentacao = {
    ...APRESENTACAO,
    carteira: {
      ...APRESENTACAO.carteira,
      projetos: APRESENTACAO.carteira.projetos.map((pr, i) =>
        i === 0 ? { ...pr, dependencias: [...pr.dependencias, "Identificar potenciais fontes de financiamento."] } : pr,
      ),
    },
  };
  assert.ok(!comPendencia(carteira, '"Acessibilidade territorial ampliada" presume recurso'));
});

test("o valor da proposta fica inteiro: o texto é partido em volta dele", () => {
  assert.deepEqual(emVoltaDoValor("etapa inicial de R$ 200 mil.", "R$ 200 mil"), [
    { trecho: "etapa inicial de ", valor: false },
    { trecho: "R$ 200 mil", valor: true },
    { trecho: ".", valor: false },
  ]);
  assert.deepEqual(emVoltaDoValor("sem valor", "R$ 200 mil"), [{ trecho: "sem valor", valor: false }]);
});

test("o esquema é conceitual: quatro camadas, nessa ordem, e a ressalva dita em texto", () => {
  assert.deepEqual(APRESENTACAO.esquema.camadas.map((c) => c.id), ["territorio", "caminhos", "servicos", "barreiras"]);
  assert.match(APRESENTACAO.esquema.ressalva, /^Esquema conceitual: não representa/);
  const semRessalva: Apresentacao = { ...APRESENTACAO, esquema: { ...APRESENTACAO.esquema, ressalva: "Mapa de João Pessoa." } };
  assert.ok(comPendencia(semRessalva, "O esquema precisa dizer que é conceitual"));
  const esquema = fonte("Esquema.tsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.match(esquema, /role="img"/);
  assert.match(esquema, /aria-pressed=\{foco === c\.id\}/);
  assert.doesNotMatch(esquema, /João Pessoa|latitude|longitude|fetch\(|setInterval|requestAnimationFrame/, "sem geografia real nem movimento sozinho");
});

test("a abertura tem os dois percursos, e cada âncora tem destino", () => {
  const conteudo = fonte("Conteudo.tsx");
  assert.match(conteudo, /href="#ob-demonstrador"[^>]*>\s*Conhecer o demonstrador de <span className="ob-sem-quebra">\{investimento\}<\/span>/);
  assert.match(conteudo, /href="#ob-programa"[^>]*>\s*Explorar o programa completo/);
  for (const destino of ["ob-demonstrador", "ob-programa", "ob-produtos", "ob-fontes"]) {
    assert.match(conteudo, new RegExp(`id="${destino}"`), `a âncora #${destino} não tem destino`);
  }
  assert.match(conteudo, /titulo="O que o projeto pretende deixar como base para o Observatório"/);
  assert.match(conteudo, /titulo="Um observatório, múltiplas capacidades"/);
  // Detalhe abre por clique e por teclado, sem script; o leitor de tela ouve também o nome do projeto.
  for (const rotulo of ["Módulos e entregas", "Componentes reutilizáveis", "Dependências"]) {
    assert.match(conteudo, new RegExp(`<summary>\\s*${rotulo}<span className="ob-sr">: \\{pr\\.nome\\}</span>\\s*</summary>`), rotulo);
  }
});

test("movimento discreto: transições de 150 a 250 ms, só para quem não pediu menos movimento", () => {
  const css = fonte("observatorio.css");
  const bloco = css.match(/@media \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n\}/);
  assert.ok(bloco, "falta o bloco de movimento");
  const fora = css.replace(bloco![0], "");
  assert.doesNotMatch(fora, /transition\s*:|animation\s*:/, "transição ou animação fora do bloco de movimento");
  const duracoes = [...bloco![1].matchAll(/(\d+)ms/g)].map((m) => Number(m[1]));
  assert.ok(duracoes.length > 0 && duracoes.every((d) => d >= 150 && d <= 250), duracoes.join(", "));
  assert.doesNotMatch(css, /infinite|background-attachment:\s*fixed/, "nada de animação sem fim nem parallax");
});

test("a folha continua sendo o resumo do primeiro investimento: a carteira não entra nela", () => {
  const folha = fonte("Folha.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(folha, /apresentacao\.carteira|apresentacao\.esquema/);
  // Nem as estimativas novas: a folha continua dedicada aos R$ 200 mil (coordenação, 16/11/2026).
  assert.doesNotMatch(
    folha,
    /envelopes|modulos|totalIndicativo|programaIndicativo|lerValoresDoPrograma|fontesDosValores|lerEnvelopes|AVISO_VALORES|autonomia|dependeDe|entradaDaCarteira|lerModulos|DEFINICAO_AUTONOMIA/,
  );
});

// ------------------------------------------------------------------ valores indicativos (coordenação, 16/11/2026)

const MIL = 100_000; // R$ 1.000,00 em centavos

test("os envelopes do demonstrador são os da coordenação e fecham os R$ 200 mil ao centavo", () => {
  assert.deepEqual(
    PROPOSTA.envelopes.itens.map((x) => [x.rotulo, x.centavos / MIL]),
    [
      ["Dados e base territorial", 30],
      ["Modelagem de acessibilidade", 48],
      ["Pesquisa empírica", 34],
      ["Protótipo tecnológico", 38],
      ["Avaliação e testes", 20],
      ["Documentação e transferência", 18],
      ["Coordenação e gestão", 12],
    ],
  );
  assert.equal(PROPOSTA.envelopes.estimativa.natureza, "estimativa-interna");
  const e = lerEnvelopes(PROPOSTA);
  assert.equal(e.somaCentavos, 20_000_000);
  assert.ok(e.confere);
  assert.deepEqual(e.pendencias, []);
  assert.match(AVISO_ENVELOPES, /^Referências internas para a futura pesquisa de preços, não custos cotados\.$/);
});

test("os envelopes não viram orçamento: a composição continua vazia e a página diz 'em elaboração'", () => {
  assert.deepEqual(PROPOSTA.composicao, []);
  assert.ok(prontidaoTecnica(PROPOSTA).pendencias.includes("A composição do orçamento ainda não foi informada."));
  const conteudo = fonte("Conteudo.tsx");
  assert.match(conteudo, /Composição financeira em elaboração/);
  assert.match(conteudo, /<Envelopes proposta=\{proposta\} \/>\s*<Composicao proposta=\{proposta\} \/>/);
});

test("envelope que não fecha, ou com valor inválido, é pendência; nunca arredondado", () => {
  const com = (itens: Proposta["envelopes"]["itens"]): Proposta => ({ ...PROPOSTA, envelopes: { ...PROPOSTA.envelopes, itens } });
  const menos = com(PROPOSTA.envelopes.itens.slice(1));
  assert.ok(prontidaoTecnica(menos).pendencias.includes("Os envelopes somam R$ 170.000,00; o investimento pretendido é R$ 200.000,00."));
  const quebrado = com([{ rotulo: "Coordenação e gestão", centavos: 1_200_000.5 }]);
  assert.ok(prontidaoTecnica(quebrado).pendencias.some((x) => x.includes('"Coordenação e gestão" tem valor inválido')));
  assert.deepEqual(lerEnvelopes(com([])).pendencias, [], "sem envelopes, nada a conferir");
});

test("a carteira traz os valores e os módulos da coordenação, e cada projeto soma exatamente o total", () => {
  const esperado: [string, number, number[]][] = [
    ["Acessibilidade territorial ampliada", 320, [70, 100, 150]],
    ["Mobilidade ativa e caminhabilidade", 300, [60, 100, 140]],
    ["Transporte coletivo e integração modal", 470, [90, 160, 220]],
    ["Segurança viária", 320, [70, 110, 140]],
    ["Avaliação de intervenções e investimentos", 410, [80, 160, 170]],
    ["Mobilidade sustentável e resiliência urbana", 350, [70, 130, 150]],
  ];
  assert.deepEqual(
    APRESENTACAO.carteira.projetos.map((pr) => [pr.nome, pr.totalIndicativoCentavos / MIL, pr.modulos.map((m) => m.centavos / MIL)]),
    esperado,
  );
  const v = lerValoresDoPrograma(PROPOSTA, APRESENTACAO);
  for (const x of v.projetos) assert.ok(x.confere, x.nome);
  assert.equal(v.carteiraCentavos, 217_000_000);
  assert.equal(v.programaCentavos, 237_000_000);
  assert.equal(centavosEmEscala(v.carteiraCentavos), "R$ 2,17 milhões");
  assert.equal(centavosEmEscala(v.programaCentavos), "R$ 2,37 milhões");
  for (const pr of APRESENTACAO.carteira.projetos) {
    assert.equal(pr.estimativa.natureza, "estimativa-interna", pr.nome);
    for (const m of pr.modulos) assert.ok(m.titulo.trim() && m.entregas.length > 0, `${pr.nome}: módulo sem título ou entregas`);
  }
});

test("a soma é sempre dos módulos: total declarado diferente vira pendência, nos três níveis", () => {
  const projeto = (i: number, mudanca: Partial<Apresentacao["carteira"]["projetos"][number]>): Apresentacao => ({
    ...APRESENTACAO,
    carteira: { ...APRESENTACAO.carteira, projetos: APRESENTACAO.carteira.projetos.map((pr, j) => (j === i ? { ...pr, ...mudanca } : pr)) },
  });
  assert.ok(comPendencia(projeto(0, { totalIndicativoCentavos: 33_000_000 }), '"Acessibilidade territorial ampliada": os módulos somam R$ 320.000,00; o total indicado é R$ 330.000,00.'));
  const semModulo = projeto(1, { modulos: APRESENTACAO.carteira.projetos[1].modulos.slice(0, 2) });
  assert.ok(comPendencia(semModulo, '"Mobilidade ativa e caminhabilidade": os módulos somam R$ 160.000,00'));
  assert.ok(comPendencia(projeto(2, { modulos: [] }), '"Transporte coletivo e integração modal" está sem módulos.'));
  const invalido = projeto(3, { modulos: APRESENTACAO.carteira.projetos[3].modulos.map((m, j) => (j === 0 ? { ...m, centavos: -1 } : m)) });
  assert.ok(comPendencia(invalido, '"Segurança viária": o módulo "Base de sinistros" tem valor inválido'));
  const semTitulo = projeto(4, { modulos: APRESENTACAO.carteira.projetos[4].modulos.map((m, j) => (j === 1 ? { ...m, titulo: " " } : m)) });
  assert.ok(comPendencia(semTitulo, '"Avaliação de intervenções e investimentos" tem módulo sem título ou sem entregas.'));
  const carteira: Apresentacao = { ...APRESENTACAO, carteira: { ...APRESENTACAO.carteira, totalIndicativoCentavos: 220_000_000 } };
  assert.ok(comPendencia(carteira, "A carteira soma R$ 2.170.000,00; o total indicado é R$ 2.200.000,00."));
  const programa: Apresentacao = { ...APRESENTACAO, carteira: { ...APRESENTACAO.carteira, programaIndicativoCentavos: 217_000_000 } };
  assert.ok(comPendencia(programa, "O programa soma R$ 2.370.000,00; o total indicado é R$ 2.170.000,00."));
});

test("as quatro naturezas do valor são distintas, e só a estimativa interna dispensa documento", () => {
  assert.deepEqual([...NATUREZAS_DO_VALOR], ["estimativa-interna", "cotacao-recebida", "referencia-validada", "orcamento-consolidado"]);
  assert.deepEqual(pendenciasDaEstimativa({ natureza: "estimativa-interna", origem: "Coordenação." }, "X"), []);
  for (const natureza of ["cotacao-recebida", "referencia-validada", "orcamento-consolidado"] as const) {
    const sem = pendenciasDaEstimativa({ natureza, origem: "Coordenação." }, "X");
    assert.equal(sem.length, 1, natureza);
    assert.match(sem[0], /precisa do documento que o sustenta/);
    assert.deepEqual(pendenciasDaEstimativa({ natureza, origem: "Coordenação.", documento: "Cotação de teste." }, "X"), []);
  }
  // Dar a um projeto natureza que ele não tem, sem documento, é pendência: a página nunca promove estimativa sozinha.
  const promovido: Apresentacao = {
    ...APRESENTACAO,
    carteira: {
      ...APRESENTACAO.carteira,
      projetos: APRESENTACAO.carteira.projetos.map((pr, i) =>
        i === 5 ? { ...pr, estimativa: { natureza: "orcamento-consolidado", origem: pr.estimativa.origem } } : pr,
      ),
    },
  };
  assert.ok(comPendencia(promovido, '"Mobilidade sustentável e resiliência urbana": valor como "Orçamento consolidado" precisa do documento'));
  const errada = pendenciasDaEstimativa({ natureza: "orcamento-aprovado" as never, origem: "Coordenação." }, "X");
  assert.match(errada[0], /natureza do valor inválida/);
});

test("estimativa identificada não é financiamento presumido: os valores reais não geram pendência nova", () => {
  const p = pendenciasDaApresentacao(PROPOSTA, APRESENTACAO);
  assert.ok(!p.some((x) => /presume recurso|valor no texto|valor solto|somam|sem módulos|natureza/.test(x)), p.join(" | "));
  assert.ok(!prontidaoTecnica(PROPOSTA).pendencias.some((x) => /envelope/i.test(x)));
});

test("a página mostra os valores com a natureza e os avisos, e o celular vê a síntese sem abrir os módulos", () => {
  const conteudo = fonte("Conteudo.tsx");
  assert.match(conteudo, /\{AVISO_VALORES\}/);
  assert.match(conteudo, /\{AVISO_MODULOS\}/);
  assert.match(conteudo, /\{AVISO_ENVELOPES\}/);
  assert.match(conteudo, /Investimento indicativo · \{ROTULO_NATUREZA\[pr\.estimativa\.natureza\]\.toLowerCase\(\)\}/);
  // A síntese financeira (total, quantidade e menor módulo) fica fora do <details>; os módulos ficam dentro.
  const card = conteudo.slice(conteudo.indexOf('className="ob-projeto-valor"'), conteudo.indexOf('className="ob-projeto-detalhes"'));
  assert.match(card, /ob-projeto-total/);
  assert.match(card, /modulos\.quantidade/);
  assert.match(card, /Menor módulo/);
  assert.doesNotMatch(card, /<details/);
  assert.match(AVISO_VALORES, /não são cotações nem compromissos financeiros/);
  assert.match(AVISO_MODULOS, /projetos independentes, quando tecnicamente e juridicamente cabível/);
});

test("as condições de reaproveitamento vêm da natureza de cada ativo, com o produto que o entrega", () => {
  const pr = APRESENTACAO.carteira.projetos[1]; // Mobilidade ativa: protocolo, registros e comparação
  assert.deepEqual(condicoesDeReaproveitamento(pr, APRESENTACAO.reuso), [
    { titulo: "Ativos metodológicos", condicao: "Poderão orientar futuros projetos.", ativos: [{ ativo: "Protocolo", produto: "P3" }] },
    {
      titulo: "Registros e evidências",
      condicao: "Reutilização sujeita às condições pertinentes.",
      ativos: [
        { ativo: "Registros de campo", produto: "P3" },
        { ativo: "Comparação entre estimativas e observações", produto: "P3" },
      ],
    },
  ]);
  for (const p of APRESENTACAO.carteira.projetos) {
    const n = condicoesDeReaproveitamento(p, APRESENTACAO.reuso).flatMap((g) => g.ativos).length;
    assert.equal(n, p.componentes.length, `${p.nome}: todo componente tem condição`);
  }
});

test("a origem dos valores entra nas fontes da página, uma vez por decisão", () => {
  assert.deepEqual(fontesDosValores(PROPOSTA, APRESENTACAO), [
    "Valores indicativos (envelopes do demonstrador e projetos e módulos da carteira): Estimativa interna. " +
      "Estratégia financeira preliminar da coordenação, de 16/11/2026.",
  ]);
  assert.match(fonte("Conteudo.tsx"), /\.\.\.fontesDosValores\(proposta, apresentacao\)/);
});

test("formatos: milhões só nos totais, sem arredondar; listas e quantidades por extenso", () => {
  assert.equal(centavosEmEscala(217_000_000), "R$ 2,17 milhões");
  assert.equal(centavosEmEscala(250_000_000), "R$ 2,5 milhões");
  assert.equal(centavosEmEscala(100_000_000), "R$ 1 milhão");
  assert.equal(centavosEmEscala(217_500_000), "R$ 2.175 mil", "sem exatidão de dez mil, não abrevia em milhões");
  assert.equal(centavosEmEscala(32_000_000), "R$ 320 mil");
  assert.equal(centavosResumidos(150_000_000), "R$ 1.500 mil", "o resumo de sempre não muda");
  assert.equal(emSequencia(["a"]), "a");
  assert.equal(emSequencia(["a", "b", "c"]), "a, b e c");
  assert.equal(quantidadePorExtenso(3, "módulo", "módulos"), "três módulos");
  assert.equal(quantidadePorExtenso(1, "módulo", "módulos"), "um módulo");
  assert.equal(quantidadePorExtenso(12, "módulo", "módulos"), "12 módulos");
});

// ------------------------------------------------------------------ revisão da entrega 13 (coordenação, 16/11/2026)

test("os módulos seguem a matriz da coordenação: títulos, valores e ordem", () => {
  assert.deepEqual(
    APRESENTACAO.carteira.projetos.map((pr) => pr.modulos.map((m) => [m.titulo, m.centavos / MIL])),
    [
      [["Novos territórios", 70], ["Novos serviços", 100], ["Painéis de equidade", 150]],
      [["Inventário territorial", 60], ["Auditoria ampliada", 100], ["Priorização de melhorias", 140]],
      [["Diagnóstico de dados operacionais", 90], ["Acessibilidade multimodal", 160], ["Monitoramento de confiabilidade", 220]],
      [["Base de sinistros", 70], ["Análise de risco", 110], ["Painel e priorização", 140]],
      [["Inventário e indicadores", 80], ["Simulação de cenários antes de intervenções", 160], ["Avaliação de resultados observados", 170]],
      [["Dados e indicadores ambientais", 70], ["Modelagem de emissões", 130], ["Vulnerabilidade e resiliência", 150]],
    ],
  );
  // Os totais não mudam: a matriz preserva os valores da coordenação.
  const v = lerValoresDoPrograma(PROPOSTA, APRESENTACAO);
  assert.equal(v.carteiraCentavos, 217_000_000);
  assert.equal(v.programaCentavos, 237_000_000);
  assert.ok(v.projetos.every((x) => x.confere));
});

test("cada módulo tem entregas mensuráveis: produtos verificáveis, sem número e sem coisa feita", () => {
  // Verificável = diz o que se confere ao receber: documentado, ficha técnica, reproduzível, critério, período ou cobertura.
  const VERIFICAVEL = /documentad|ficha|reproduzíve|critério|justificativa|período|cobertura|lacunas|método|premissas|limites|georreferenciad|comparáve|data/;
  for (const pr of APRESENTACAO.carteira.projetos) {
    for (const m of pr.modulos) {
      assert.ok(m.entregas.length >= 2, `${pr.nome} · ${m.titulo}: pelo menos duas entregas`);
      for (const e of m.entregas) {
        assert.ok(e.endsWith("."), `${m.titulo}: "${e}"`);
        assert.doesNotMatch(e, /\d|R\$/, `${m.titulo}: "${e}"`);
      }
      assert.ok(m.entregas.some((e) => VERIFICAVEL.test(e)), `${pr.nome} · ${m.titulo}: nenhuma entrega diz como se confere`);
    }
  }
  const p = pendenciasDaApresentacao(PROPOSTA, APRESENTACAO);
  assert.ok(!p.some((x) => /módulo|porta de entrada|autonomia/.test(x)), p.join(" | "));
});

test("autonomia: o dependente diz de qual módulo anterior depende, e a porta de entrada é sempre autônoma", () => {
  const A = "potencialmente-autonomo";
  const D = "dependente";
  assert.deepEqual(
    APRESENTACAO.carteira.projetos.map((pr) => pr.modulos.map((m) => [m.autonomia, m.dependeDe])),
    [
      [[A, []], [A, []], [D, ["Novos territórios", "Novos serviços"]]],
      [[A, []], [D, ["Inventário territorial"]], [D, ["Auditoria ampliada"]]],
      [[A, []], [D, ["Diagnóstico de dados operacionais"]], [D, ["Diagnóstico de dados operacionais"]]],
      [[A, []], [D, ["Base de sinistros"]], [D, ["Análise de risco"]]],
      [[A, []], [D, ["Inventário e indicadores"]], [D, ["Inventário e indicadores"]]],
      [[A, []], [D, ["Dados e indicadores ambientais"]], [D, ["Dados e indicadores ambientais"]]],
    ],
  );
  for (const pr of APRESENTACAO.carteira.projetos) {
    const l = lerModulos(pr);
    assert.equal(l.quantidade, 3, pr.nome);
    assert.equal(l.menorCentavos, pr.modulos[0].centavos, `${pr.nome}: o menor é o primeiro`);
    assert.equal(l.entradaCentavos, l.menorCentavos, `${pr.nome}: o menor módulo pode começar sozinho`);
  }
  assert.equal(ROTULO_AUTONOMIA[A], "Potencialmente autônomo");
  // Mutações: cada incoerência vira pendência, nomeada.
  const mudar = (i: number, j: number, m: Partial<Apresentacao["carteira"]["projetos"][number]["modulos"][number]>): Apresentacao => ({
    ...APRESENTACAO,
    carteira: {
      ...APRESENTACAO.carteira,
      projetos: APRESENTACAO.carteira.projetos.map((pr, k) =>
        k === i ? { ...pr, modulos: pr.modulos.map((x, n) => (n === j ? { ...x, ...m } : x)) } : pr,
      ),
    },
  });
  assert.ok(comPendencia(mudar(1, 1, { dependeDe: [] }), '"Mobilidade ativa e caminhabilidade": o módulo "Auditoria ampliada" é dependente e não diz de qual módulo.'));
  assert.ok(comPendencia(mudar(1, 1, { autonomia: A }), '"Mobilidade ativa e caminhabilidade": o módulo "Auditoria ampliada" é potencialmente autônomo, mas depende de outro módulo.'));
  assert.ok(comPendencia(mudar(3, 1, { dependeDe: ["Base de acidentes"] }), '"Segurança viária": o módulo "Análise de risco" depende de "Base de acidentes", que não é módulo do projeto.'));
  assert.ok(comPendencia(mudar(3, 1, { dependeDe: ["Painel e priorização"] }), '"Segurança viária": o módulo "Análise de risco" depende de "Painel e priorização", que não vem antes dele.'));
  assert.ok(comPendencia(mudar(3, 0, { autonomia: "independente" as never }), '"Segurança viária": o módulo "Base de sinistros" está sem autonomia válida'));
  assert.ok(comPendencia(mudar(3, 2, { titulo: "Análise de risco" }), '"Segurança viária" tem módulos com o mesmo título.'));
  assert.ok(comPendencia(mudar(4, 0, { entregas: [] }), '"Avaliação de intervenções e investimentos" tem módulo sem título ou sem entregas.'));
  // O menor módulo dependente: o card mostraria como entrada algo que não começa sozinho.
  const menorDependente = mudar(1, 0, { autonomia: D, dependeDe: ["Auditoria ampliada"] });
  assert.ok(comPendencia(menorDependente, '"Mobilidade ativa e caminhabilidade": o menor módulo depende de outro; a porta de entrada tem de ser potencialmente autônoma.'));
});

test("a abertura da carteira: seis projetos, dezoito módulos e a partir de R$ 60 mil, sempre como estimativa", () => {
  assert.deepEqual(entradaDaCarteira(APRESENTACAO), { projetos: 6, modulos: 18, autonomos: 7, aPartirDeCentavos: 6_000_000 });
  assert.equal(centavosResumidos(6_000_000), "R$ 60 mil");
  // O "a partir de" é o menor AUTÔNOMO: tornar dependente o módulo de R$ 60 mil leva a entrada para o seguinte.
  const semEntrada: Apresentacao = {
    ...APRESENTACAO,
    carteira: {
      ...APRESENTACAO.carteira,
      projetos: APRESENTACAO.carteira.projetos.map((pr, k) =>
        k === 1 ? { ...pr, modulos: pr.modulos.map((m, n) => (n === 0 ? { ...m, autonomia: "dependente" as const } : m)) } : pr,
      ),
    },
  };
  assert.equal(entradaDaCarteira(semEntrada).aPartirDeCentavos, 7_000_000);
  const conteudo = fonte("Conteudo.tsx");
  assert.match(conteudo, /entradaDaCarteira\(apresentacao\)/);
  assert.match(conteudo, /<dt>Investimento modular<\/dt>/);
  assert.match(conteudo, /estimativa interna, por módulo potencialmente autônomo/);
  assert.match(conteudo, /\{DEFINICAO_AUTONOMIA\}/);
  assert.match(conteudo, /estimativa interna, em \{quantidadePorExtenso/);
  assert.match(conteudo, /estimativa interna, com o demonstrador/);
  assert.match(DEFINICAO_AUTONOMIA, /não exige outro módulo da carteira, só a base do demonstrador/);
  // Independência só para os autônomos (coordenação, 16/11/2026).
  assert.match(AVISO_MODULOS, /^Os módulos potencialmente autônomos poderão ser estruturados como projetos independentes/);
  assert.match(AVISO_MODULOS, /Os dependentes exigem, antes, a entrega do módulo indicado\./);
});

test("os cards mostram só o essencial; módulos, componentes e dependências ficam fechados, com o conteúdo inteiro", () => {
  const conteudo = fonte("Conteudo.tsx");
  const inicio = conteudo.indexOf('<li key={pr.nome} className="ob-projeto">');
  const detalhes = conteudo.indexOf('className="ob-projeto-detalhes"', inicio);
  const fim = conteudo.indexOf("{AVISO_CARTEIRA}", detalhes);
  assert.ok(inicio > 0 && detalhes > inicio && fim > detalhes);
  const visivel = conteudo.slice(inicio, detalhes);
  const fechado = conteudo.slice(detalhes, fim);
  // À vista: nome, finalidade (o problema público), síntese da capacidade, investimento, quantidade e menor módulo.
  for (const x of ["{pr.nome}", "{pr.problema}", "{pr.capacidade}", "pr.totalIndicativoCentavos", "modulos.quantidade", "modulos.menorCentavos"]) {
    assert.ok(visivel.includes(x), `falta à vista: ${x}`);
  }
  // Fechado por padrão: nada de detalhe técnico à vista, e nenhum <details> nasce aberto.
  for (const x of ["pr.componentes", "pr.dependencias", "m.entregas", "condicoesDeReaproveitamento", "AVISO_MODULOS"]) {
    assert.ok(!visivel.includes(x), `à vista sem precisar: ${x}`);
  }
  assert.doesNotMatch(conteudo, /<details[^>]*\sopen/);
  // O conteúdo continua inteiro: só mudou de lugar.
  for (const x of ["m.entregas", "m.dependeDe", "ROTULO_AUTONOMIA[m.autonomia]", "condicoesDeReaproveitamento(pr, apresentacao.reuso)", "pr.dependencias", "{AVISO_ATIVOS}", "{AVISO_MODULOS}", "g.condicao", "x.produto"]) {
    assert.ok(fechado.includes(x), `sumiu do card: ${x}`);
  }
  assert.equal((fechado.match(/<details className="ob-projeto-detalhe">/g) ?? []).length, 3);
  // Alvo de toque de 44 px no resumo e o nome escondido só para leitor de tela.
  const css = fonte("observatorio.css");
  assert.match(css, /\.ob-projeto-detalhe summary \{[^}]*min-height: 44px/);
  assert.match(css, /\.ob-sr \{[^}]*clip: rect\(0, 0, 0, 0\)/);
});
