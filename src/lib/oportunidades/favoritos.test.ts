import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { PayloadV2 } from "./contrato-v2.ts";
import {
  FRASE_JANELA_FECHOU,
  TIPOS_ITEM,
  FRASE_JANELA_REABRIU,
  abertasParaAvisos,
  chaveValida,
  filtrarAvisos,
  fraseDoAviso,
  nomeDoItemSeguido,
  retratoDaJanela,
  rotuloEstrela,
  situacaoDaJanela,
  somaNaoLidos,
  urlDoItem,
} from "./favoritos.ts";

/** As sete oportunidades reais de 10/09/2026 dos testes do contrato e do catálogo. */
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "v2-amostra.json"), "utf-8"),
) as PayloadV2;

test("chave: as mesmas regras da tabela", () => {
  assert.ok(chaveValida("instrumento", "956541"));
  assert.ok(chaveValida("instrumento", "7AAAAA"), "há número de convênio com letra");
  assert.ok(!chaveValida("instrumento", "95 6541"));
  assert.ok(chaveValida("proposta", "2241841"));
  assert.ok(!chaveValida("proposta", "34797/2026"), "proposta é pelo id, não pelo número com barra");
  assert.ok(chaveValida("janela", "transferegov-0429be615502-beneficiario-especifico"));
  assert.ok(!chaveValida("janela", "x/../y"));
  assert.ok(!chaveValida("programa", "123"));
  assert.ok(!chaveValida("janela", 123));
  assert.ok(chaveValida("municipio", "2510808"), "município é o IBGE de 7 dígitos");
  assert.ok(!chaveValida("municipio", "251080"));
  assert.ok(!chaveValida("municipio", "25108O8"));
});

test("url do item: convênio e proposta têm página; janela é âncora no catálogo", () => {
  assert.equal(urlDoItem("instrumento", "7AAAAA"), "/mapa/instrumento/7AAAAA");
  assert.equal(urlDoItem("proposta", "2241841"), "/mapa/proposta/2241841");
  assert.equal(urlDoItem("janela", "cnpq-24-2026"), "/mapa#janela-cnpq-24-2026");
  assert.equal(urlDoItem("municipio", "2510808"), "/mapa/municipio/2510808", "a página com abas, para todo aprovado");
});

test("frases do município: contagens, decisão fiscal, CAUC e pessoal em português", () => {
  const f = (evento: string, antes: string | null, depois: string | null) => fraseDoAviso({ tipo: "municipio", evento, antes, depois });
  assert.deepEqual(f("contas_atrasadas", "1", "2"), { rotulo: "Prestações de contas atrasadas", detalhe: "1 → 2" });
  assert.deepEqual(f("tce_tcu", null, "2"), { rotulo: "Tomadas de Contas Especiais no TCU", detalhe: "0 → 2" });
  assert.deepEqual(f("fiscal_b", "nao_atendido", "atencao"), { rotulo: "Painel fiscal: receber transferência voluntária", detalhe: "não atendido → atenção" });
  assert.deepEqual(f("fiscal_a", "atendido", null), { rotulo: "Painel fiscal: declarações fiscais em dia", detalhe: "atendido → sem dado" });
  assert.deepEqual(f("cauc", "", "1.5, 3.2.3"), { rotulo: "Pendências no CAUC", detalhe: "nenhuma → 1.5, 3.2.3" });
  assert.deepEqual(f("pessoal_pct", "53.9", "54.54"), { rotulo: "Despesa com pessoal (% da RCL ajustada)", detalhe: "53,90% → 54,54%" });
  assert.deepEqual(f("pix_vez_ente", "0", "1"), { rotulo: "Pix: planos à espera do município no ciclo", detalhe: "0 → 1" });
  assert.deepEqual(f("pix_prazo_ente", null, "2027-05-10"), { rotulo: "Pix: prazo da etapa do município", detalhe: "sem prazo → 10/05/2027" });
});

test("janelas abertas para a geração: só as abertas no dia, com prazo sem hora", () => {
  const antes = abertasParaAvisos(FIXTURE, "2026-09-09");
  assert.equal(Object.keys(antes).length, 5, "as mesmas 5 abertas do catálogo");
  const depois = abertasParaAvisos(FIXTURE, "2026-09-12");
  assert.deepEqual(Object.keys(depois), ["cnpq-24-2026"]);
  assert.match(depois["cnpq-24-2026"].prazo ?? "", /^\d{4}-\d{2}-\d{2}$/);
});

test("retrato da janela ao seguir: aberta e prazo; id desconhecido não segue", () => {
  const r = retratoDaJanela(FIXTURE, "cnpq-24-2026", "2026-09-12");
  assert.equal(r?.estado.aberta, true);
  assert.equal(retratoDaJanela(FIXTURE, "cnpq-24-2026", "2026-12-31")?.estado.aberta, false);
  assert.equal(retratoDaJanela(FIXTURE, "nao-existe", "2026-09-12"), null);
});

test("frases: desembolso diz quanto entrou, e não só o total", () => {
  const f = fraseDoAviso({ tipo: "instrumento", evento: "vl_desembolsado", antes: "0", depois: "400000.00" });
  assert.equal(f.rotulo, "Novo desembolso");
  assert.equal(f.detalhe, "R$ 400 mil a mais · total de R$ 0 para R$ 400 mil");
  assert.equal(fraseDoAviso({ tipo: "instrumento", evento: "vl_desembolsado", antes: "500", depois: "100" }).rotulo,
    "O total desembolsado mudou");
});

test("frases: datas, percentuais e desfecho em português", () => {
  assert.equal(fraseDoAviso({ tipo: "instrumento", evento: "dt_fim_vigencia", antes: "2025-08-17", depois: "2026-02-17" }).detalhe,
    "até 17/08/2025 → até 17/02/2026");
  assert.equal(fraseDoAviso({ tipo: "instrumento", evento: "pct_fisico", antes: "0.375", depois: "0.5" }).detalhe, "38% → 50%");
  assert.equal(fraseDoAviso({ tipo: "proposta", evento: "desfecho", antes: "aberta_concedente", depois: "assinada" }).detalhe,
    "Em análise no concedente → Assinada");
  assert.equal(fraseDoAviso({ tipo: "proposta", evento: "situacao", antes: "A", depois: "B" }).rotulo, "A proposta mudou de situação");
  assert.equal(fraseDoAviso({ tipo: "proposta", evento: "nr_convenio", antes: null, depois: "999999" }).detalhe, "convênio nº 999999");
});

test("frases das janelas: fechando conta os dias; campo desconhecido não some", () => {
  assert.equal(fraseDoAviso({ tipo: "janela", evento: "fechando", antes: "2026-09-18", depois: "1" }).rotulo, "Falta 1 dia");
  assert.equal(fraseDoAviso({ tipo: "janela", evento: "fechando", antes: "2026-09-18", depois: "0" }).rotulo, "Fecha hoje");
  assert.equal(fraseDoAviso({ tipo: "janela", evento: "encerrada", antes: "2026-09-18", depois: null }).detalhe, "O prazo era 18/09/2026.");
  assert.equal(fraseDoAviso({ tipo: "instrumento", evento: "campo_novo", antes: "x", depois: "y" }).detalhe, "campo_novo: x → y");
});

test("filtro das abas e soma dos não lidos", () => {
  const avisos = [
    { id: "1", lida_em: null, arquivada_em: null },
    { id: "2", lida_em: "2026-09-15", arquivada_em: null },
    { id: "3", lida_em: null, arquivada_em: "2026-09-15" },
  ];
  assert.deepEqual(filtrarAvisos(avisos, "nao_lidas").map((a) => a.id), ["1"]);
  assert.deepEqual(filtrarAvisos(avisos, "todas").map((a) => a.id), ["1", "2"]);
  assert.deepEqual(filtrarAvisos(avisos, "arquivadas").map((a) => a.id), ["3"]);
  assert.equal(somaNaoLidos(3, 2), 5);
  assert.equal(somaNaoLidos(null, 2), 2);
  assert.equal(somaNaoLidos(null, null), null);
});

test("aviso de prazo de janela que já fechou não repete a contagem velha", () => {
  const a = { tipo: "janela" as const, evento: "fechando", antes: "2026-09-18", depois: "1" };
  assert.deepEqual(fraseDoAviso(a, "2026-10-02"), { rotulo: "A janela fechou", detalhe: "O prazo era 18/09/2026; o aviso foi do dia em que faltava 1 dia." });
  assert.equal(fraseDoAviso(a, "2026-09-17").rotulo, "Falta 1 dia");
});

test("oport_31: entidade se segue pelo CNPJ (alfanumérico aceito) e abre a página dela", () => {
  assert.equal(chaveValida("entidade", "09112236000194"), true);
  assert.equal(chaveValida("entidade", "12ABC34501DE35"), true);
  assert.equal(chaveValida("entidade", "09.112.236/0001-94"), false);
  assert.equal(chaveValida("entidade", "0911223600019"), false);
  assert.equal(urlDoItem("entidade", "09112236000194"), "/mapa/entidade/09112236000194");
  const a = { id: "1", tipo: "entidade", chave: "09112236000194", evento: "instrumentos", titulo: "X", antes: "88", depois: "89", referencia: "r", criado_em: "2026-10-08T12:00:00Z", lida_em: null, arquivada_em: null } as const;
  assert.equal(fraseDoAviso(a as never).rotulo, "Instrumentos no painel");
});

test("B8: a estrela diz qual item, nos dois estados, sem depender de cor", () => {
  const fora = rotuloEstrela("janela", "Edital CNPq 24/2026", false);
  assert.deepEqual(fora, {
    icone: "☆",
    visivel: "Seguir",
    item: "a janela Edital CNPq 24/2026",
    nomeAcessivel: "Seguir a janela Edital CNPq 24/2026",
    acao: "Seguir a janela Edital CNPq 24/2026",
    confirmacao: "Você deixou de seguir a janela Edital CNPq 24/2026.",
    desfazer: "voltar a seguir a janela Edital CNPq 24/2026",
    desfeito: "Você deixou de seguir a janela Edital CNPq 24/2026.",
  });
  const dentro = rotuloEstrela("janela", "Edital CNPq 24/2026", true);
  assert.equal(dentro.icone, "★");
  assert.equal(dentro.visivel, "Seguindo");
  assert.equal(dentro.nomeAcessivel, "Seguindo a janela Edital CNPq 24/2026");
  assert.equal(dentro.acao, "Deixar de seguir a janela Edital CNPq 24/2026");
  assert.equal(dentro.confirmacao, "Agora você segue a janela Edital CNPq 24/2026.");
  assert.equal(dentro.desfeito, "Você voltou a seguir a janela Edital CNPq 24/2026.");
  // WCAG 2.5.3: o nome acessível começa pelo texto à vista
  for (const r of [fora, dentro]) assert.equal(r.nomeAcessivel, `${r.visivel} ${r.item}`);
});

test("B8: o nome que já vem com artigo (costume das telas) não repete o tipo", () => {
  assert.equal(rotuloEstrela("instrumento", "o convênio nº 956541", true).acao, "Deixar de seguir o convênio nº 956541");
  assert.equal(rotuloEstrela("janela", "a janela X", false).nomeAcessivel, "Seguir a janela X");
  assert.equal(rotuloEstrela("municipio", "o município Patos", true).confirmacao, "Agora você segue o município Patos.");
  assert.equal(rotuloEstrela("entidade", "Prefeitura de Patos", false).nomeAcessivel, "Seguir a entidade Prefeitura de Patos");
  assert.equal(rotuloEstrela("proposta", "a proposta nº 34797/2026", false).acao, "Seguir a proposta nº 34797/2026");
  // título com maiúscula que começa como o artigo é título, não artigo
  assert.equal(rotuloEstrela("janela", "A janela da inovação", false).acao, "Seguir a janela A janela da inovação");
  // ponto final do nome não dobra o da frase
  assert.equal(rotuloEstrela("entidade", "a entidade X Ltda.", false).confirmacao, "Você deixou de seguir a entidade X Ltda.");
});

test("B8: nome do item seguido — convênio pelo número, título longo encurtado, reserva sem repetir o tipo", () => {
  assert.equal(nomeDoItemSeguido("instrumento", "956541", "Construção de praça"), "o convênio nº 956541");
  assert.equal(nomeDoItemSeguido("municipio", "2510808", "Patos"), "o município Patos");
  assert.equal(nomeDoItemSeguido("janela", "cnpq-24-2026", "Janela cnpq-24-2026"), "a janela cnpq-24-2026");
  assert.equal(nomeDoItemSeguido("proposta", "2241841", null), "a proposta 2241841");
  assert.equal(nomeDoItemSeguido("entidade", "09112236000194", "  "), "a entidade 09112236000194");
  const longo = nomeDoItemSeguido("janela", "x", `Programa ${"de apoio à inovação ".repeat(10)}`);
  assert.ok(longo.startsWith("a janela Programa de apoio"));
  assert.ok(longo.endsWith("…"));
  assert.ok(longo.length <= "a janela ".length + 100);
});

test("B8: janela fechada não vira link para o catálogo; o último aviso de abrir/fechar decide", () => {
  // as frases que a geração grava são as que a situação lê
  assert.equal(fraseDoAviso({ tipo: "janela", evento: "encerrada", antes: "2026-09-18", depois: null }).rotulo, FRASE_JANELA_FECHOU);
  assert.equal(fraseDoAviso({ tipo: "janela", evento: "reaberta", antes: null, depois: "2026-12-01" }).rotulo, FRASE_JANELA_REABRIU);
  assert.equal(fraseDoAviso({ tipo: "janela", evento: "fechando", antes: "2026-09-18", depois: "1" }, "2026-10-08").rotulo, FRASE_JANELA_FECHOU);

  // Meus itens: sem retrato, aberta até o aviso de que fechou
  assert.equal(situacaoDaJanela([]), "aberta");
  assert.equal(situacaoDaJanela(["O prazo da janela mudou", FRASE_JANELA_FECHOU]), "fechada");
  assert.equal(situacaoDaJanela([FRASE_JANELA_REABRIU, FRASE_JANELA_FECHOU]), "aberta", "reabriu depois de fechar");
  assert.equal(situacaoDaJanela([FRASE_JANELA_FECHOU, FRASE_JANELA_REABRIU]), "fechada", "fechou de novo");

  // Carteira: o retrato com prazo à frente vale mais que aviso velho; sem prazo à frente e sem aviso, não dá para dizer
  assert.equal(situacaoDaJanela([FRASE_JANELA_FECHOU], true), "aberta");
  assert.equal(situacaoDaJanela([FRASE_JANELA_FECHOU], false), "fechada");
  assert.equal(situacaoDaJanela([], false), "incerta");
  assert.equal(situacaoDaJanela([FRASE_JANELA_REABRIU], false), "incerta", "reabriu, mas sem prazo à frente");
});

test("B0: município de fora da PB abre os investimentos (a página com abas só aceita a PB)", () => {
  assert.equal(urlDoItem("municipio", "2510808"), "/mapa/municipio/2510808");
  assert.equal(urlDoItem("municipio", "3550308"), "/mapa/municipio/3550308/investimentos");
  assert.equal(urlDoItem("municipio", "5300108"), "/mapa/municipio/5300108/investimentos");
});

test("B0: cada tipo diz o próprio tipo na estrela (a entidade era lida como janela)", () => {
  const esperado = { janela: "a janela X", instrumento: "o convênio nº 123", proposta: "a proposta X", municipio: "o município X", entidade: "a entidade X" };
  for (const tipo of TIPOS_ITEM) {
    const nome = nomeDoItemSeguido(tipo, "123", "X");
    assert.equal(nome, esperado[tipo], tipo);
    assert.equal(rotuloEstrela(tipo, nome, true).nomeAcessivel, `Seguindo ${esperado[tipo]}`, tipo);
    assert.equal(rotuloEstrela(tipo, nome, false).confirmacao, `Você deixou de seguir ${esperado[tipo]}.`, tipo);
  }
});
