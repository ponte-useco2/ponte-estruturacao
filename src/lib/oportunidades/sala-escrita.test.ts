import test from "node:test";
import assert from "node:assert/strict";
import {
  autorDe,
  botoesDoEstado,
  hojeBrasilia,
  linkValido,
  mensagemDoErro,
  nomeSeguro,
  problemaNoArquivo,
  tipoDoArquivo,
  montarChamada,
  ordemDemanda,
  problemaNoTexto,
  proximaSexta,
  venceu,
  type Demanda,
} from "./sala-escrita.ts";

test("texto livre: recusa CPF, telefone, e-mail e R$; deixa passar período, CNPJ e número de termo", () => {
  const r = (t: string) => problemaNoTexto(t, "o título", 300);
  assert.match(r("ligar 123.456.789-09") ?? "", /CPF/);
  assert.match(r("cpf 12345678909 do sócio") ?? "", /CPF/);
  assert.match(r("ligar (83) 99999-1234") ?? "", /telefone/);
  assert.match(r("cel 99999-1234") ?? "", /telefone/);
  assert.match(r("mandar a fulano@gmail.com") ?? "", /e-mail/);
  assert.match(r("pagar R$ 5.000") ?? "", /R\$/);
  assert.equal(r("Período 2024-2025, CNPJ 47235479000109, TO 2686/2025, processo 0801234-56.2026"), null);
  assert.equal(problemaNoTexto("  ", "o motivo", 100, true), "Preencha o motivo.");
  assert.match(problemaNoTexto("a".repeat(301), "o título", 300) ?? "", /passa de 300/);
});

test("botões por estado: recebida combina, validação valida, fechada não tem botão", () => {
  assert.deepEqual(botoesDoEstado("recebida"), ["combinar", "classificar", "dependencia", "cancelar"]);
  assert.deepEqual(botoesDoEstado("combinada"), ["iniciar", "entregar", "rever_data", "dependencia", "prioridade", "cancelar"]);
  assert.deepEqual(botoesDoEstado("validacao"), ["validar", "rever_data", "dependencia", "prioridade", "cancelar"]);
  assert.deepEqual(botoesDoEstado("concluida"), []);
  assert.deepEqual(botoesDoEstado("cancelada"), []);
});

const dem = (p: Partial<Demanda>): Demanda =>
  ({ id: "d", objeto: "PB-01", estado: "combinada", titulo: "t", prioridade: "normal", data_combinada: null, ...p }) as Demanda;

test("ordem: data combinada primeiro, sem data por último, prioridade no empate; vencida só se aberta", () => {
  const l = [dem({ id: "a" }), dem({ id: "b", data_combinada: "2026-11-01", prioridade: "baixa" }), dem({ id: "c", data_combinada: "2026-11-01", prioridade: "alta" })];
  assert.deepEqual(l.sort(ordemDemanda).map((d) => d.id), ["c", "b", "a"]);
  assert.equal(venceu(dem({ data_combinada: "2026-10-29" }), "2026-10-30"), true);
  assert.equal(venceu(dem({ data_combinada: "2026-10-29", estado: "concluida" }), "2026-10-30"), false);
  assert.equal(venceu(dem({}), "2026-10-30"), false);
});

test("sexta e hoje em Brasília", () => {
  assert.equal(proximaSexta("2026-10-30"), "2026-10-30");
  assert.equal(proximaSexta("2026-10-31"), "2026-11-06");
  assert.equal(proximaSexta("2026-11-02"), "2026-11-06");
  assert.equal(hojeBrasilia(new Date("2026-10-31T02:00:00Z")), "2026-10-30");
});

test("montarChamada: cada ato vai para a sua função, com a sala; data inválida vira nula; ato estranho lança", () => {
  assert.deepEqual(montarChamada("pablo", { ato: "rever_data", id: "d-1", versao: "v", nova: "2026-12-10", motivo: "m" }), {
    funcao: "sala_demanda_rever_data",
    args: { p_sala: "pablo", p_id: "d-1", p_versao: "v", p_nova: "2026-12-10", p_motivo: "m" },
  });
  const r = montarChamada("pablo", { ato: "registrar", titulo: "t", descricao: "", objeto: "A_CLASSIFICAR", prioridade: "normal", data_desejada: "amanhã", referencia: "" });
  assert.equal(r.funcao, "sala_demanda_registrar");
  assert.equal(r.args.p_data_desejada, null);
  assert.deepEqual(montarChamada("pablo", { ato: "dependencia", id: "d", versao: "v", dependencia: null }).args.p_de, null);
  assert.throws(() => montarChamada("pablo", { ato: "apagar" } as never));
});

test("erro do banco: mostra o texto depois de 'sala: '; o resto é genérico", () => {
  assert.equal(mensagemDoErro("sala: preencha o motivo."), "Preencha o motivo.");
  assert.match(mensagemDoErro("permission denied for table sala_demanda"), /Não foi possível salvar/);
  assert.match(mensagemDoErro(undefined), /Não foi possível salvar/);
});

test("arquivo: tipo pela extensão, limite de 25 MB, nome seguro para o caminho; link só http(s)", () => {
  assert.equal(tipoDoArquivo("Termo Assinado.PDF"), "application/pdf");
  assert.equal(tipoDoArquivo("planilha.xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(tipoDoArquivo("virus.exe"), null);
  assert.equal(tipoDoArquivo("notas.md"), null);
  assert.match(problemaNoArquivo("x.exe", 10) ?? "", /não aceito/);
  assert.match(problemaNoArquivo("x.pdf", 25 * 1024 * 1024 + 1) ?? "", /25 MB/);
  assert.equal(problemaNoArquivo("x.pdf", 25 * 1024 * 1024), null);
  assert.equal(nomeSeguro("Ofício nº 12 — versão final.pdf"), "Oficio-n-12-versao-final.pdf");
  assert.equal(nomeSeguro("../../etc/passwd.txt"), "etc-passwd.txt");
  assert.ok(nomeSeguro(`${"a".repeat(300)}.pdf`).length <= 120);
  assert.equal(linkValido("https://drive.google.com/x"), true);
  assert.equal(linkValido("http://x.org"), true);
  assert.equal(linkValido("javascript:alert(1)"), false);
  assert.equal(linkValido("ftp://x.org"), false);
  assert.equal(linkValido("https://x.org/a b"), false);
});

test("montarChamada dos atos do adendo 1", () => {
  assert.equal(montarChamada("pablo", { ato: "pedir_melhoria", pagina: "PB-01", texto: "t" }).funcao, "sala_melhoria_pedir");
  assert.equal(montarChamada("pablo", { ato: "retirar_envio", id: "e-1", motivo: "m" }).args.p_motivo, "m");
  const c = montarChamada("pablo", { ato: "cadastrar_objeto", nome: "N", organizacao: "", fase: "Captação", instrumento: "", papel_pablo: "", papel_ponte: "", resumo: "", nome_anterior: "" });
  assert.equal(c.funcao, "sala_objeto_cadastrar");
  assert.equal(c.args.p_fase, "Captação");
});

test("filtro de texto: os 10 casos do adendo (5 recusas, 5 legítimos)", () => {
  const r = (t: string) => problemaNoTexto(t, "o texto", 2000);
  for (const t of ["CPF 123.456.789-09", "fone (83) 98888-7777", "a@b.com.br", "R$ 1.200,00", "12345678909"]) assert.notEqual(r(t), null, t);
  for (const t of ["Termo de Outorga 2686/2025", "Edital FAPESQ/FINEP 58/2024", "CNPJ 47.235.479/0001-09", "Ofício 123/2026-GAB", "prazo 31/10/2026"]) assert.equal(r(t), null, t);
});

test("autor: rótulo da carga, nome do membro, você", () => {
  const m = [{ user_id: "u1", papel: "cliente" as const, nome: "Pablo" }];
  assert.equal(autorDe({ autor_rotulo: "PONTE (registro inicial)" }, m, "u1"), "PONTE (registro inicial)");
  assert.equal(autorDe({ quem: "u1" }, m, "u2"), "Pablo");
  assert.equal(autorDe({ quem: "u1" }, m, "u1"), "Pablo (você)");
  assert.equal(autorDe({ quem: "u9" }, m, "u1"), "alguém da sala");
});
