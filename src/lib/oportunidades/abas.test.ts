import test from "node:test";
import assert from "node:assert/strict";
import {
  ABAS_MENU,
  LAUDO_PELAS_SUSPENSIVAS,
  ORIGEM_SUSPENSIVAS,
  abaAcesa,
  abaAtiva,
  abasDoMenu,
  naMinhaEntidade,
  noMeuMunicipio,
  type PerfilMenu,
  type RegraAba,
} from "./abas.ts";
import { rotaPublica } from "./publico.ts";

const JANELAS: RegraAba = { href: "/mapa", exata: true };
const BUSCA: RegraAba = { href: "/mapa/busca", exata: false, tambem: ["/mapa/instrumento/", "/mapa/proposta/"], exceto: [LAUDO_PELAS_SUSPENSIVAS] };
const SUSPENSIVAS: RegraAba = { href: "/mapa/suspensivas", exata: false, tambem: [LAUDO_PELAS_SUSPENSIVAS] };

test("o laudo acende a Busca, a não ser que se chegue pela lista das suspensivas", () => {
  assert.equal(abaAtiva(BUSCA, "/mapa/instrumento/962210/laudo"), true);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/instrumento/962210/laudo"), false);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/instrumento/980439/laudo", ORIGEM_SUSPENSIVAS), true);
  assert.equal(abaAtiva(BUSCA, "/mapa/instrumento/980439/laudo", ORIGEM_SUSPENSIVAS), false);
  // Origem desconhecida não muda nada.
  assert.equal(abaAtiva(BUSCA, "/mapa/instrumento/980439/laudo", "outra"), true);
});

test("a página do convênio segue acendendo Busca, venha de onde vier; as páginas das suspensivas, Suspensivas", () => {
  assert.equal(abaAtiva(BUSCA, "/mapa/instrumento/980439"), true);
  assert.equal(abaAtiva(BUSCA, "/mapa/instrumento/980439", ORIGEM_SUSPENSIVAS), true);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/instrumento/980439", ORIGEM_SUSPENSIVAS), false);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/suspensivas/checklist"), true);
});

test("aba exata só no caminho exato; convênio com 'laudo' no número não confunde", () => {
  assert.equal(abaAtiva(JANELAS, "/mapa"), true);
  assert.equal(abaAtiva(JANELAS, "/mapa/avisos"), false);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/instrumento/laudo", ORIGEM_SUSPENSIVAS), false);
  assert.equal(abaAtiva(BUSCA, "/mapa/proposta/123"), true);
});

test("o dossiê do fornecedor acende a aba Fornecedores, e só ela", () => {
  const FORNECEDORES: RegraAba = { href: "/mapa/fornecedores", exata: false, tambem: ["/mapa/fornecedor/"] };
  assert.equal(abaAtiva(FORNECEDORES, "/mapa/fornecedores"), true);
  assert.equal(abaAtiva(FORNECEDORES, "/mapa/fornecedor/05476456000146"), true);
  assert.equal(abaAtiva(BUSCA, "/mapa/fornecedor/05476456000146"), false);
  // O laudo aberto pelo dossiê é da Busca.
  assert.equal(abaAtiva(FORNECEDORES, "/mapa/instrumento/962210/laudo"), false);
});

test("F1c: a página do próprio município (e o que fica debaixo dela) é do «Meu município»; a de outro, não", () => {
  assert.equal(noMeuMunicipio("/mapa/municipio/2513802", "2513802"), true);
  assert.equal(noMeuMunicipio("/mapa/municipio/2513802/relatorio", "2513802"), true);
  assert.equal(noMeuMunicipio("/mapa/municipio/2510808", "2513802"), false);
  // prefixo do número não confunde
  assert.equal(noMeuMunicipio("/mapa/municipio/25138021", "2513802"), false);
  assert.equal(noMeuMunicipio("/mapa/municipio/2513802", null), false);
  assert.equal(noMeuMunicipio("/mapa/busca", "2513802"), false);
});

test("oport_31: a página da própria entidade (e as rotas debaixo dela) é da «Minha organização»", () => {
  assert.equal(naMinhaEntidade("/mapa/entidade/09112236000194", "09112236000194"), true);
  assert.equal(naMinhaEntidade("/mapa/entidade/09112236000194/csv", "09112236000194"), true);
  assert.equal(naMinhaEntidade("/mapa/entidade/12671814000137", "09112236000194"), false);
  assert.equal(naMinhaEntidade("/mapa/entidade/0911223600019400", "09112236000194"), false);
  assert.equal(naMinhaEntidade("/mapa/entidade/09112236000194", null), false);
});

// ================================================================ B11: o menu de verdade (ABAS_MENU)

const MEU_IBGE = "2513802";
const OUTRO_IBGE = "2510808";
const MINHA = "09112236000194";
const OUTRA = "12671814000137";

const PERFIS: Record<string, { perfil: PerfilMenu; dono: { meuIbge?: string | null; minhaEntidade?: string | null } }> = {
  aprovado: { perfil: { admin: false, municipio: false, organizacao: false }, dono: {} },
  prefeitura: { perfil: { admin: false, municipio: true, organizacao: false }, dono: { meuIbge: MEU_IBGE } },
  osc: { perfil: { admin: false, municipio: false, organizacao: true }, dono: { minhaEntidade: MINHA } },
  administrador: { perfil: { admin: true, municipio: false, organizacao: false }, dono: {} },
  "administrador com prefeitura": { perfil: { admin: true, municipio: true, organizacao: false }, dono: { meuIbge: MEU_IBGE } },
};

/** O nome da aba acesa, como o menu desenha para o perfil. */
function acesa(perfil: keyof typeof PERFIS, caminho: string, de: string | null = null): string | null {
  const { perfil: p, dono } = PERFIS[perfil];
  const href = abaAcesa(abasDoMenu(p), caminho, de, dono);
  return ABAS_MENU.find((a) => a.href === href)?.nome ?? null;
}

test("B11: o menu tem a aba «Território», para todo aprovado, logo depois da Busca", () => {
  const nomes = (p: keyof typeof PERFIS) => abasDoMenu(PERFIS[p].perfil).map((a) => a.nome);
  assert.deepEqual(nomes("aprovado"), ["Janelas", "Avisos", "Carteira", "Busca", "Território"]);
  assert.deepEqual(nomes("prefeitura"), ["Janelas", "Avisos", "Carteira", "Busca", "Território", "Meu município"]);
  assert.deepEqual(nomes("osc"), ["Janelas", "Avisos", "Carteira", "Busca", "Território", "Minha organização"]);
  assert.deepEqual(nomes("administrador"), ["Janelas", "Avisos", "Carteira", "Busca", "Território", "Radar", "Painel", "Fiscal", "Suspensivas", "Fornecedores"]);
  assert.equal(ABAS_MENU.find((a) => a.nome === "Território")?.href, "/mapa/brasil", "a porta leva ao topo da descida");
});

test("B11: «Território» acende no Brasil, na UF, no município e na entidade (e nas rotas debaixo deles)", () => {
  const territorio = [
    "/mapa/brasil",
    "/mapa/uf/pb",
    "/mapa/uf/sp",
    `/mapa/municipio/${OUTRO_IBGE}`,
    `/mapa/municipio/${OUTRO_IBGE}/organizacoes`,
    `/mapa/municipio/${OUTRO_IBGE}/relatorio`,
    "/mapa/municipio/3509502/investimentos",
    `/mapa/entidade/${OUTRA}`,
  ];
  for (const perfil of Object.keys(PERFIS)) {
    for (const caminho of territorio) assert.equal(acesa(perfil, caminho), "Território", `${perfil} em ${caminho}`);
  }
});

test("B11: a página do próprio cliente acende «Meu município» ou «Minha organização», e não o Território", () => {
  assert.equal(acesa("prefeitura", `/mapa/municipio/${MEU_IBGE}`), "Meu município");
  assert.equal(acesa("prefeitura", `/mapa/municipio/${MEU_IBGE}/relatorio`), "Meu município");
  assert.equal(acesa("prefeitura", `/mapa/municipio/${MEU_IBGE}/organizacoes`), "Meu município");
  assert.equal(acesa("prefeitura", "/mapa/meu-municipio"), "Meu município");
  assert.equal(acesa("prefeitura", `/mapa/municipio/${OUTRO_IBGE}`), "Território", "o município dos outros é do Território");
  assert.equal(acesa("osc", `/mapa/entidade/${MINHA}`), "Minha organização");
  assert.equal(acesa("osc", `/mapa/entidade/${MINHA}/csv`), "Minha organização");
  assert.equal(acesa("osc", `/mapa/entidade/${OUTRA}`), "Território");
  // sem a aba do dono no menu, o IBGE não pesa: o aprovado sem organização vê o mesmo município no Território
  assert.equal(acesa("aprovado", `/mapa/municipio/${MEU_IBGE}`), "Território");
});

test("B11: o convênio, a proposta e o laudo seguem na Busca; o painel do município, no Painel", () => {
  assert.equal(acesa("aprovado", "/mapa/instrumento/942082"), "Busca");
  assert.equal(acesa("aprovado", "/mapa/instrumento/942082/laudo"), "Busca");
  assert.equal(acesa("aprovado", "/mapa/proposta/1234567"), "Busca");
  assert.equal(acesa("administrador", "/mapa/instrumento/942082/laudo", ORIGEM_SUSPENSIVAS), "Suspensivas");
  assert.equal(acesa("administrador", `/mapa/painel/municipio/${OUTRO_IBGE}`), "Painel", "o prefixo /mapa/municipio/ não confunde com /mapa/painel/municipio/");
  assert.equal(acesa("administrador", `/mapa/fiscal/${OUTRO_IBGE}`), "Fiscal");
  assert.equal(acesa("aprovado", "/mapa/conta/organizacao"), null);
  assert.equal(acesa("aprovado", "/mapa/glossario"), null);
});

test("B11: uma aba acesa por vez — o laudo do Pix do administrador com prefeitura acende só uma", () => {
  assert.equal(acesa("administrador com prefeitura", "/mapa/pix/ente/2513802"), "Meu município");
  assert.equal(acesa("administrador", "/mapa/pix/ente/2513802"), "Painel");
  assert.equal(acesa("prefeitura", "/mapa/pix/plano/123"), "Meu município");
  // varredura: em qualquer página, no máximo uma aba casa com a regra que o menu aplica
  const caminhos = ["/mapa", "/mapa/avisos", "/mapa/carteira", "/mapa/busca", "/mapa/brasil", "/mapa/uf/pb", `/mapa/municipio/${MEU_IBGE}`, `/mapa/entidade/${MINHA}`, "/mapa/pix/ente/2513802", "/mapa/radar", "/mapa/fornecedor/05476456000146"];
  for (const perfil of Object.keys(PERFIS)) {
    for (const caminho of caminhos) {
      const href = abaAcesa(abasDoMenu(PERFIS[perfil].perfil), caminho, null, PERFIS[perfil].dono);
      assert.ok(href === null || abasDoMenu(PERFIS[perfil].perfil).some((a) => a.href === href), `${perfil} em ${caminho}: a acesa é uma das visíveis`);
    }
  }
});

// ================================================================ C4a: o menu da versão pública

test("C4a: sem `publico` (ou com false), o menu de cada perfil é o de antes", () => {
  for (const { perfil } of Object.values(PERFIS)) {
    assert.deepEqual(abasDoMenu({ ...perfil, publico: false }), abasDoMenu(perfil));
  }
});

test("C4a: a versão pública mostra só Janelas e Território — as abas cujo destino abre para o público", () => {
  const publico: PerfilMenu = { admin: false, municipio: false, organizacao: false, publico: true };
  // A busca fica fora da lista branca (decisão do titular em aberto, R3 seção 6): a aba some junto.
  assert.deepEqual(
    abasDoMenu(publico).map((a) => a.nome),
    ["Janelas", "Território"],
  );
  for (const a of abasDoMenu(publico)) assert.equal(rotaPublica(a.href), true, `${a.nome} leva a rota pública`);
  for (const a of ABAS_MENU.filter((x) => !abasDoMenu(publico).includes(x))) assert.equal(rotaPublica(a.href), false, `${a.nome} pede cadastro`);
  // Avisos, Carteira e as abas de administrador ficam de fora mesmo se o perfil viesse com elas ligadas.
  assert.deepEqual(
    abasDoMenu({ admin: true, municipio: true, organizacao: true, publico: true }).map((a) => a.nome),
    ["Janelas", "Território"],
  );
});

test("C4a: na versão pública, o Território acende no Brasil, na UF, no município (e nos investimentos) e na entidade", () => {
  const abas = abasDoMenu({ admin: false, municipio: false, organizacao: false, publico: true });
  const nome = (caminho: string) => ABAS_MENU.find((a) => a.href === abaAcesa(abas, caminho))?.nome ?? null;
  for (const c of ["/mapa/brasil", "/mapa/uf/pb", `/mapa/municipio/${OUTRO_IBGE}`, `/mapa/municipio/${OUTRO_IBGE}/investimentos`, `/mapa/entidade/${OUTRA}`]) {
    assert.equal(nome(c), "Território", c);
  }
  assert.equal(nome("/mapa"), "Janelas");
  // Sem a aba da Busca, o convênio e o glossário não acendem nenhuma: uma por vez, ou nenhuma.
  assert.equal(nome("/mapa/instrumento/942082"), null);
  assert.equal(nome("/mapa/glossario"), null);
});
