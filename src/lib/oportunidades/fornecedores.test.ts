import test from "node:test";
import assert from "node:assert/strict";
import {
  cadastrosDe,
  cnpjValido,
  alcanceMaior,
  alcanceSancao,
  descreverSancao,
  leituraCeisCnep,
  momentoDaSancao,
  faixaConcentracao,
  lerSecaoFornecedores,
  nomeFornecedor,
  situacaoSancao,
  situacaoTcu,
  type ConcentracaoMunicipio,
  type Contrato,
  type EntradaFornecedores,
  type EntradaSancoes,
  type Fornecedor,
  type FornecedorConvenio,
  type RegistroSancao,
} from "./fornecedores.ts";

// Casos do SICONV de 14/09/2026: ACM Auto Center (45 municípios, R$ 29,8 mi) e Livramento Construções
// (inidônea pelo TCU, acórdão 821/2019-PL, R$ 10 mi recebidos na PB).
const ACM = "05476456000146";
const LIVRAMENTO = "09326532000198";
const MEI = "33333333000133";

function fornecedor(cnpj: string, extra: Partial<Fornecedor> = {}): Fornecedor {
  return {
    cnpj,
    nome: `EMPRESA ${cnpj}`,
    mei: false,
    pb_convenios: 1,
    pb_municipios: 1,
    pb_proponentes: 1,
    pb_orgaos: 1,
    pb_pago: 0,
    pb_n_pagamentos: 0,
    pb_primeiro_pagamento: null,
    pb_ultimo_pagamento: null,
    pb_contratos: 0,
    pb_contratado: 0,
    br_convenios: 1,
    br_ufs: 1,
    br_pago: 0,
    inidoneo_tcu: false,
    tcu_acordao: null,
    tcu_inicio: null,
    tcu_data_final: null,
    tcu_link: null,
    ...extra,
  };
}

function linha(cnpj: string, pago: number, extra: Partial<FornecedorConvenio> = {}): FornecedorConvenio {
  return {
    cnpj,
    nr_convenio: "900001",
    cod_ibge: "2504009",
    municipio: "CAMPINA GRANDE",
    proponente: "MUNICIPIO DE CAMPINA GRANDE",
    tipo_agente: "municipio",
    orgao_sup: "MINISTERIO DAS CIDADES",
    cod_programa: "5600020240001",
    pago,
    n_pagamentos: pago > 0 ? 2 : 0,
    primeiro_pagamento: pago > 0 ? "2020-03-01" : null,
    ultimo_pagamento: pago > 0 ? "2020-06-01" : null,
    fatia: null,
    n_contratos: 0,
    contratado: 0,
    ...extra,
  };
}

function contrato(cnpj: string | null, assinatura: string, extra: Partial<Contrato> = {}): Contrato {
  return {
    nr_convenio: "900001",
    id_licitacao: "L1",
    id_contrato: `K-${cnpj}-${assinatura}`,
    nr_contrato: "1",
    cnpj,
    fornecedor: cnpj ? `EMPRESA ${cnpj}` : null,
    pessoa_fisica: cnpj === null,
    tipo_aquisicao: "Obras",
    objeto: "Pavimentação",
    valor: 100,
    dt_assinatura: assinatura,
    dt_publicacao: null,
    dt_inicio_vigencia: null,
    dt_fim_vigencia: null,
    ...extra,
  };
}

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
  maior_fatia: 0.64,
  hhi: 0.43,
};

test("faixa de concentração: pouco pago não se lê; mais da metade é alta; HHI alto é moderada", () => {
  assert.equal(faixaConcentracao({ pago_pj: 999_999, maior_fatia: 1, hhi: 1 }), "pouco_dado");
  assert.equal(faixaConcentracao(CAMPINA), "alta");
  assert.equal(faixaConcentracao({ pago_pj: 2_000_000, maior_fatia: 0.4, hhi: 0.3 }), "moderada");
  assert.equal(faixaConcentracao({ pago_pj: 2_000_000, maior_fatia: 0.2, hhi: 0.1 }), "baixa");
  // Exatamente metade ainda não é "mais da metade".
  assert.equal(faixaConcentracao({ pago_pj: 2_000_000, maior_fatia: 0.5, hhi: 0.2 }), "baixa");
});

test("nome para a tela: CPF da razão social mascarado, e o CNPJ quando não há nome", () => {
  assert.equal(nomeFornecedor({ nome: "MARIA DA SILVA 12345678909" }), "MARIA DA SILVA ***");
  assert.equal(nomeFornecedor({ nome: "MARIA DA SILVA 123.456.789-09 ME" }), "MARIA DA SILVA *** ME");
  // A raiz do CNPJ na frente do MEI (8 dígitos) não é CPF, e o CNPJ inteiro também não.
  assert.equal(nomeFornecedor({ nome: "63.406.267 GABRIEL ROCHA" }), "63.406.267 GABRIEL ROCHA");
  assert.equal(nomeFornecedor({ nome: "EMPRESA 05476456000146" }), "EMPRESA 05476456000146");
  assert.equal(nomeFornecedor({ nome: null, cnpj: ACM }), "CNPJ 05.476.456/0001-46");
});

test("CNPJ da URL: só 14 dígitos passam", () => {
  assert.equal(cnpjValido("05.476.456/0001-46"), ACM);
  assert.equal(cnpjValido("0547645600014"), null);
  assert.equal(cnpjValido("abc"), null);
  assert.equal(cnpjValido(null), null);
});

test("situação no TCU: não verificado não é 'fora da lista'", () => {
  assert.equal(situacaoTcu({ inidoneo_tcu: true }), "inidoneo");
  assert.equal(situacaoTcu({ inidoneo_tcu: false }), "fora_da_lista");
  assert.equal(situacaoTcu({ inidoneo_tcu: null }), "nao_verificado");
});

test("momento da sanção: contrato assinado nela, pagamento nela de contrato antigo, ou tudo antes", () => {
  const f = { inidoneo_tcu: true, tcu_inicio: "2021-03-01", tcu_data_final: "2029-03-01" };
  assert.equal(momentoDaSancao(f, { primeiro: "2019-01-01", ultimo: "2020-12-31" }, []), "antes");
  assert.equal(momentoDaSancao(f, { primeiro: "2020-01-01", ultimo: "2021-03-01" }, [{ dt_assinatura: "2019-12-01" }]), "pagou");
  assert.equal(momentoDaSancao(f, { primeiro: null, ultimo: null }, [{ dt_assinatura: "2022-05-05" }]), "contratou");
  assert.equal(momentoDaSancao(f, { primeiro: "2022-01-01", ultimo: "2022-02-01" }, [{ dt_assinatura: "2022-01-01" }]), "contratou");
  assert.equal(momentoDaSancao(f, { primeiro: null, ultimo: null }, [{ dt_assinatura: "2020-05-05" }]), "antes");
  // Sem início conhecido, a sanção conta desde sempre: o erro seguro é mandar conferir.
  assert.equal(momentoDaSancao({ ...f, tcu_inicio: null }, { primeiro: "2010-01-01", ultimo: "2010-02-01" }, []), "pagou");
  assert.equal(momentoDaSancao({ ...f, inidoneo_tcu: false }, { primeiro: "2022-01-01", ultimo: "2022-02-01" }, []), null);
});

function entrada(extra: Partial<EntradaFornecedores> = {}): EntradaFornecedores {
  return {
    linhas: [
      linha(ACM, 600_000, { fatia: 0.6 }),
      linha(LIVRAMENTO, 300_000, { fatia: 0.3, primeiro_pagamento: "2021-05-01", ultimo_pagamento: "2021-08-01" }),
      linha(MEI, 100_000, { fatia: 0.1 }),
    ],
    fornecedores: [
      fornecedor(ACM, { nome: "ACM AUTO CENTER MAQUINAS LTDA", pb_municipios: 45, pb_convenios: 53 }),
      fornecedor(LIVRAMENTO, {
        nome: "LIVRAMENTO CONSTRUCOES, SERVICOS E PROJETOS LTDA",
        inidoneo_tcu: true,
        tcu_acordao: "821/2019-PL",
        tcu_inicio: "2021-03-01",
        tcu_data_final: "2029-03-01",
      }),
      fornecedor(MEI, { nome: "MARIA DA SILVA ***", mei: true }),
    ],
    contratos: [contrato(ACM, "2020-02-01"), contrato(null, "2020-02-02")],
    municipio: CAMPINA,
    ...extra,
  };
}

const PREFEITURA = { tipo_agente: "municipio", municipio: "CAMPINA GRANDE", pago_pj: 1_000_000, pago_pf: 5_000, n_pagamentos_pf: 3, pago_convenente: 0 };

test("seção do laudo: empresas do maior valor ao menor, com MEI e a marca do TCU", () => {
  const s = lerSecaoFornecedores(entrada(), PREFEITURA);
  assert.deepEqual(
    s.linhas.map((l) => l.cnpj),
    [ACM, LIVRAMENTO, MEI],
  );
  assert.equal(s.linhas[0].pbMunicipios, 45);
  assert.equal(s.linhas[2].mei, true);
  assert.equal(s.linhas[1].tcu, "inidoneo");
  assert.equal(s.linhas[1].momento, "pagou");
  assert.match(s.linhas[1].sancao ?? "", /acórdão 821\/2019-PL; sanção de 01\/03\/2021 até 01\/03\/2029/);
  assert.equal(s.tcuVerificado, true);
  assert.equal(s.pagoPf, 5_000);
  assert.equal(s.contratos.length, 2);
});

test("inidôneo: contratado na sanção é crítico; pago nela por contrato antigo, alto; tudo antes, moderado", () => {
  const pago = lerSecaoFornecedores(entrada(), PREFEITURA).riscos.find((r) => r.titulo.startsWith("LIVRAMENTO"));
  assert.equal(pago?.nivel, "alto");
  assert.match(pago?.fato ?? "", /recebeu R\$ 300 mil neste convênio entre 01\/05\/2021 e 01\/08\/2021; parte disso caiu dentro da sanção/);

  const contratado = entrada({ contratos: [...entrada().contratos, contrato(LIVRAMENTO, "2021-04-10")] });
  const c = lerSecaoFornecedores(contratado, PREFEITURA).riscos.find((r) => r.titulo.startsWith("LIVRAMENTO"));
  assert.equal(c?.nivel, "critico");
  assert.match(c?.titulo ?? "", /contratado dentro da sanção do TCU/);

  const antes = entrada();
  antes.linhas[1] = linha(LIVRAMENTO, 300_000, { primeiro_pagamento: "2019-05-01", ultimo_pagamento: "2019-08-01" });
  const r = lerSecaoFornecedores(antes, PREFEITURA).riscos.find((x) => x.titulo.startsWith("LIVRAMENTO"));
  assert.equal(r?.nivel, "moderado");
  assert.match(r?.fato ?? "", /antes do período da sanção/);
});

test("concentração entra como informativo só na prefeitura, com o maior fornecedor dentro deste convênio", () => {
  const s = lerSecaoFornecedores(entrada(), PREFEITURA);
  const c = s.riscos.find((r) => r.nivel === "informativo");
  assert.ok(c);
  assert.match(c.fato, /ACM AUTO CENTER MAQUINAS LTDA recebeu R\$ 83,6 mi dos R\$ 130,7 mi pagos a empresas \(64%\)/);
  assert.match(c.fato, /indicador para olhar, não uma irregularidade/);
  assert.equal(s.municipio?.faixa, "alta");

  // O maior de lá não é fornecedor deste convênio: o quadro aparece, o risco não.
  const semEle = lerSecaoFornecedores(entrada({ linhas: entrada().linhas.slice(1) }), PREFEITURA);
  assert.equal(semEle.municipio?.nesteConvenio, false);
  assert.equal(semEle.riscos.some((r) => r.nivel === "informativo"), false);

  // O Estado tem o IBGE da capital: a concentração da prefeitura não é dele.
  const estado = lerSecaoFornecedores(entrada(), { ...PREFEITURA, tipo_agente: "estado" });
  assert.equal(estado.municipio, null);
  assert.equal(estado.riscos.some((r) => r.nivel === "informativo"), false);
});

test("lista do TCU não lida: sem marca e sem risco, e a seção diz que não verificou", () => {
  const e = entrada();
  e.fornecedores = e.fornecedores.map((f) => ({ ...f, inidoneo_tcu: null }));
  const s = lerSecaoFornecedores(e, PREFEITURA);
  assert.equal(s.tcuVerificado, false);
  assert.ok(s.linhas.every((l) => l.tcu === "nao_verificado"));
  assert.equal(s.riscos.some((r) => r.nivel === "critico" || r.nivel === "alto"), false);
});

test("convênio sem fornecedor: seção vazia, sem risco", () => {
  const s = lerSecaoFornecedores({ linhas: [], fornecedores: [], contratos: [], municipio: null }, { tipo_agente: "municipio" });
  assert.deepEqual(s.linhas, []);
  assert.deepEqual(s.riscos, []);
  assert.equal(s.tcuVerificado, false);
  assert.equal(s.pagoPj, null);
});

test("pago no SICONV sem registro no TCE-PB: risco moderado, com o convênio do laudo", () => {
  const tce = [
    { ibge: "2504009", ano: 2020, cnpj: ACM, nome: null, tce_convenio: 0, tce_pix: 0, tce_outras: 0, siconv: 600_000, convenios: ["900001"], situacao: "so_siconv" as const },
    { ibge: "2504009", ano: 2020, cnpj: MEI, nome: null, tce_convenio: 0, tce_pix: 0, tce_outras: 0, siconv: 100_000, convenios: ["900001"], situacao: "casado" as const },
    // Outro convênio: não entra neste laudo.
    { ibge: "2504009", ano: 2021, cnpj: MEI, nome: null, tce_convenio: 0, tce_pix: 0, tce_outras: 0, siconv: 5, convenios: ["999"], situacao: "so_siconv" as const },
  ];
  const s = lerSecaoFornecedores(entrada({ tce }), { ...PREFEITURA, nr_convenio: "900001" });
  const acm = s.linhas.find((l) => l.cnpj === ACM);
  assert.equal(acm?.tce, "sem registro no TCE-PB em 2020");
  assert.equal(s.linhas.find((l) => l.cnpj === MEI)?.tce, "no TCE-PB em 2020");
  const r = s.riscos.filter((x) => /sem registro no TCE-PB/.test(x.titulo));
  assert.equal(r.length, 1);
  assert.equal(r[0].nivel, "moderado");
  assert.match(r[0].fato, /R\$ 600 mil pagos à empresa em 2020/);
  // Sem a leitura do TCE, nada muda.
  assert.ok(lerSecaoFornecedores(entrada(), PREFEITURA).linhas.every((l) => l.tce === null));
});

// ================================================================ CEIS e CNEP (D1, 08/10/2026)

function sancao(cnpj: string, extra: Partial<RegistroSancao> = {}): RegistroSancao {
  return {
    cnpj,
    cnpj_sancionado: cnpj,
    cadastro: "CEIS",
    tipo: "Impedimento/proibição de contratar com prazo determinado",
    orgao: "Prefeitura Municipal de Patos",
    orgao_uf: "PB",
    orgao_esfera: "Municipal",
    abrangencia: null,
    dt_inicio: "2025-03-10",
    dt_fim: "2027-03-10",
    dt_publicacao: "2025-03-12",
    processo: "2025.0001/PB",
    link: "https://www.in.gov.br/web/dou/-/extrato-123",
    valor_multa: null,
    vigente: true,
    ...extra,
  };
}

function consultadas(registros: RegistroSancao[], cnpjs = [ACM, LIVRAMENTO, MEI]): EntradaSancoes {
  return {
    referencia: "2026-10-11",
    consultas: cnpjs.map((cnpj) => ({ cnpj, matriz: null, consultado_em: "2026-10-11T03:20:00Z", n_ceis: 0, n_cnep: 0, n_vigentes: 0, erro: null })),
    registros,
  };
}

// Nada de juízo nos textos de CEIS/CNEP: registro é fato a conferir.
const PROIBIDAS = /irregular|condenad|inidôneo|fraude|culpad/i;

test("CEIS/CNEP: não consultado, sem sanção, vigente e encerrada", () => {
  assert.equal(situacaoSancao(ACM, undefined), "nao_consultado");
  assert.equal(situacaoSancao(ACM, null), "nao_consultado");
  const s = consultadas([sancao(ACM), sancao(LIVRAMENTO, { vigente: false, dt_fim: "2026-01-01" })]);
  assert.equal(situacaoSancao(ACM, s), "vigente");
  assert.equal(situacaoSancao(LIVRAMENTO, s), "encerrada");
  assert.equal(situacaoSancao(MEI, s), "sem_sancao");
  // Fora da cobertura da rodada ou com erro na consulta: não consultado, nunca "sem sanção".
  assert.equal(situacaoSancao("11111111000191", s), "nao_consultado");
  const comErro = consultadas([], [ACM]);
  comErro.consultas[0].erro = "Indisponivel: HTTP 503";
  assert.equal(situacaoSancao(ACM, comErro), "nao_consultado");
  assert.deepEqual(leituraCeisCnep(undefined), { estado: "nao_consultado" });
  assert.deepEqual(leituraCeisCnep(null), { estado: "falhou" });
  assert.deepEqual(leituraCeisCnep(s), { estado: "consultado", referencia: "2026-10-11" });
});

test("CEIS/CNEP: descrição neutra, com o outro estabelecimento quando a sanção é da matriz", () => {
  assert.equal(
    descreverSancao(sancao(ACM)),
    "CEIS: Impedimento/proibição de contratar com prazo determinado, aplicada por Prefeitura Municipal de Patos (PB), de 10/03/2025 até 10/03/2027",
  );
  assert.match(descreverSancao(sancao("05476456000227", { cnpj_sancionado: ACM, dt_fim: null })), /sem data final informada, em nome de outro estabelecimento da mesma empresa \(CNPJ 05\.476\.456\/0001-46\)/);
  assert.equal(cadastrosDe([sancao(ACM, { cadastro: "CNEP" }), sancao(ACM)]), "CEIS e CNEP");
  assert.equal(cadastrosDe([sancao(ACM, { cadastro: "CNEP" })]), "CNEP");
});

test("laudo sem execução de CEIS/CNEP: a seção diz que não consultou e não há risco", () => {
  const s = lerSecaoFornecedores(entrada(), PREFEITURA);
  assert.deepEqual(s.ceisCnep, { estado: "nao_consultado" });
  assert.ok(s.linhas.every((l) => l.ceisCnep === "nao_consultado" && l.sancoesCgu.length === 0));
  assert.equal(s.riscos.some((r) => /CEIS|CNEP/.test(r.titulo)), false);
  assert.deepEqual(lerSecaoFornecedores(entrada({ sancoes: null }), PREFEITURA).ceisCnep, { estado: "falhou" });
});

test("laudo: impedimento vigente no CEIS, restrito ao órgão, é moderado, com o período confrontado com o convênio", () => {
  const s = lerSecaoFornecedores(entrada({ sancoes: consultadas([sancao(ACM, { dt_inicio: "2020-04-01" })]) }), PREFEITURA);
  const acm = s.linhas.find((l) => l.cnpj === ACM);
  assert.equal(acm?.ceisCnep, "vigente");
  assert.equal(s.linhas.find((l) => l.cnpj === MEI)?.ceisCnep, "sem_sancao");
  const r = s.riscos.filter((x) => /CEIS/.test(x.titulo));
  assert.equal(r.length, 1);
  assert.equal(r[0].nivel, "moderado");
  assert.equal(r[0].titulo, "ACM AUTO CENTER MAQUINAS LTDA: registro no CEIS restrito ao órgão ou à esfera que o aplicou");
  assert.match(r[0].fato, /Lei 14\.133, art\. 156, § 4º/);
  assert.match(r[0].fato, /um registro no CEIS vigente na consulta de 11\/10\/2026 \(CEIS: Impedimento/);
  // Pagamentos de 01/03/2020 a 01/06/2020, registro desde 01/04/2020, contrato de 01/02/2020.
  assert.match(r[0].fato, /Parte dos pagamentos deste convênio caiu dentro do período do registro/);
  assert.doesNotMatch(`${r[0].titulo} ${r[0].fato}`, PROIBIDAS);
  assert.deepEqual(s.ceisCnep, { estado: "consultado", referencia: "2026-10-11" });

  // Registro que começou depois de tudo deste convênio.
  const depois = lerSecaoFornecedores(entrada({ sancoes: consultadas([sancao(ACM)]) }), PREFEITURA);
  assert.match(depois.riscos.find((x) => /CEIS/.test(x.titulo))?.fato ?? "", /anteriores ao início do registro/);
});

test("laudo: registro encerrado não vira risco; multa no CNEP é informação", () => {
  const encerrado = lerSecaoFornecedores(entrada({ sancoes: consultadas([sancao(ACM, { vigente: false, dt_fim: "2026-01-01" })]) }), PREFEITURA);
  assert.equal(encerrado.linhas.find((l) => l.cnpj === ACM)?.ceisCnep, "encerrada");
  assert.equal(encerrado.riscos.some((r) => /CEIS|CNEP/.test(r.titulo)), false);
  const cnep = lerSecaoFornecedores(entrada({ sancoes: consultadas([sancao(MEI, { cadastro: "CNEP", tipo: "Multa", valor_multa: 10_000 })]) }), PREFEITURA);
  const r = cnep.riscos.find((x) => /CNEP/.test(x.titulo));
  assert.equal(r?.nivel, "informativo");
  assert.match(r?.titulo ?? "", /registro no CNEP que não proíbe contratar/);
  assert.doesNotMatch(`${r?.titulo} ${r?.fato}`, PROIBIDAS);
});

test("laudo: inidôneo do TCU segue com o nível dele, e o mesmo registro no CEIS não se repete", () => {
  const doTcu = sancao(LIVRAMENTO, { tipo: "Inidoneidade", orgao: "Tribunal de Contas da União", orgao_uf: null, dt_fim: null });
  const s = lerSecaoFornecedores(entrada({ sancoes: consultadas([doTcu]) }), PREFEITURA);
  assert.equal(s.linhas.find((l) => l.cnpj === LIVRAMENTO)?.ceisCnep, "vigente");
  assert.equal(s.riscos.filter((r) => r.titulo.startsWith("LIVRAMENTO")).length, 1);
  assert.equal(s.riscos.find((r) => r.titulo.startsWith("LIVRAMENTO"))?.titulo, "LIVRAMENTO CONSTRUCOES, SERVICOS E PROJETOS LTDA: pago durante a sanção do TCU");
  // Um registro de outro órgão entra à parte; impedimento restrito ao órgão é moderado.
  const outro = lerSecaoFornecedores(entrada({ sancoes: consultadas([doTcu, sancao(LIVRAMENTO)]) }), PREFEITURA);
  const r = outro.riscos.filter((x) => x.titulo.startsWith("LIVRAMENTO"));
  assert.deepEqual(r.map((x) => x.nivel), ["alto", "moderado"]);
  assert.match(r[1].titulo, /registro no CEIS restrito/);
  assert.doesNotMatch(r[1].fato, /Tribunal de Contas/);
});

test("alcance da sanção (09/10/2026): inidoneidade e todas as esferas valem em todo ente; impedimento é restrito; multa do CNEP não proíbe", () => {
  assert.equal(alcanceSancao(sancao(ACM, { tipo: "Declaração de Inidoneidade com prazo determinado" })), "amplo");
  assert.equal(alcanceSancao(sancao(ACM, { tipo: "Suspensão", abrangencia: "Todas as Esferas em todos os Poderes" })), "amplo");
  assert.equal(alcanceSancao(sancao(ACM, { cadastro: "CNEP", tipo: "Dissolução compulsória da PJ" })), "amplo");
  assert.equal(alcanceSancao(sancao(ACM, { cadastro: "CNEP", tipo: "Suspensão/Interdição das atividades com prazo determinado" })), "amplo");
  assert.equal(alcanceSancao(sancao(ACM, { tipo: "Suspensão", abrangencia: "No órgão sancionador" })), "restrito");
  assert.equal(alcanceSancao(sancao(ACM, { tipo: "Impedimento/proibição de contratar com prazo determinado", abrangencia: "Em todos os Poderes da Esfera do órgão sancionador" })), "restrito");
  assert.equal(alcanceSancao(sancao(ACM, { tipo: null })), "restrito", "CEIS de tipo desconhecido fica a conferir, nunca abaixo");
  assert.equal(alcanceSancao(sancao(ACM, { cadastro: "CNEP", tipo: "Multa" })), "sem_impedimento");
  assert.equal(alcanceSancao(sancao(ACM, { cadastro: "CNEP", tipo: "Publicação extraordinária da decisão condenatória" })), "sem_impedimento");
  assert.equal(alcanceSancao(sancao(ACM, { cadastro: "CNEP", tipo: "Proibição de receber incentivos, subsídios, subvenções, doações ou empréstimos" })), "sem_impedimento");
  assert.equal(alcanceMaior([sancao(ACM, { cadastro: "CNEP", tipo: "Multa" }), sancao(ACM, { tipo: "Declaração de Inidoneidade sem prazo determinado" })]), "amplo");
  // No laudo, a inidoneidade vigente é alto, com o texto neutro.
  const s = lerSecaoFornecedores(entrada({ sancoes: consultadas([sancao(ACM, { tipo: "Declaração de Inidoneidade com prazo determinado", orgao: "Controladoria-Geral da União" })]) }), PREFEITURA);
  const r = s.riscos.find((x) => /CEIS/.test(x.titulo));
  assert.equal(r?.nivel, "alto");
  assert.match(r?.titulo ?? "", /registro no CEIS que impede contratar com qualquer ente/);
  assert.doesNotMatch(`${r?.titulo} ${r?.fato}`, PROIBIDAS);
});
