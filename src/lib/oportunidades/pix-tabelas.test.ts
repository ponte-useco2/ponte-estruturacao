/** As listas plano a plano do Pix como tabelas com filtro (onda 15, fase 3, F3.1b, 20/10/2026). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { PlanoEspecial, PlanoFundo } from "./pix.ts";
import {
  TABELA_PIX_ESPECIAIS,
  TABELA_PIX_FUNDO,
  colunasEspeciais,
  colunasFundo,
  valoresDoPlanoEspecial,
  valoresDoPlanoFundo,
  type ListaEspeciais,
  type ListaFundo,
} from "./pix-tabelas.ts";
import type { ColunaTabela } from "./tabela-filtro.ts";

const especial: PlanoEspecial = {
  id_plano_acao: 14604, codigo_plano_acao: "09032025-014604", ano: 2025, beneficiario: "MUNICIPIO DE SAPE", cnpj: "08890045000101",
  numero_emenda: 202544, situacao: "IMPEDIDO", motivo: "IMPEDIMENTO_TECNICO", valor: 500_000, empenhado: 0, pago: 450_000,
  dt_primeira_ob: "2025-06-10", situacao_pt: null, fim_execucao: "2026-12-31", relatorio_entregue: false, final_entregue: false,
  duplicado: false, reapresentado: true, sem_relatorio_12m: true, encerrada_sem_final: false,
};
const fundo: PlanoFundo = {
  id_plano_acao: 75883, codigo_plano_acao: null, ano: 2023, orgao: "MS", programa: "P", ente: "FUNDO MUNICIPAL", cnpj: null, cod_ibge: "2511400",
  situacao: null, repasse: 100_000, fim_vigencia: "2025-12-31", saldo_contas: 30_000, contas: 1, repasse_creditado: 100_000, pago: 0,
  dt_primeiro_credito: null, dt_ultimo_pagamento: null, dt_ultimo_movimento: null, situacao_relatorio: "ENVIADO_ANALISE", tipo_relatorio: "FINAL",
  dt_relatorio: "2026-01-10", parado_12m: true, nunca_pagou: true, vigencia_encerrada: true,
};

function conferir(nome: string, colunas: ColunaTabela[], valores: Record<string, unknown>) {
  assert.equal(new Set(colunas.map((c) => c.id)).size, colunas.length, nome);
  for (const c of colunas) {
    assert.match(c.id, /^[a-z0-9-]+$/, `${nome}.${c.id}`);
    assert.notEqual(c.ordenavel, false, `${nome}.${c.id}`);
    assert.ok(c.id in valores, `${nome}.${c.id}: o valor cru existe`);
  }
  assert.equal(colunas[0].id, "ente");
}

test("ids das seis tabelas: válidos e únicos", () => {
  const ids = [...Object.values(TABELA_PIX_ESPECIAIS), ...Object.values(TABELA_PIX_FUNDO)];
  assert.equal(new Set(ids).size, 6);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
});

test("especiais e fundo a fundo: cada coluna tem o valor cru; plano e emenda como texto no CSV", () => {
  for (const l of ["pago", "motivo", "fim"] as ListaEspeciais[]) conferir(`especiais-${l}`, colunasEspeciais(l), valoresDoPlanoEspecial(especial, l));
  for (const l of ["pagamento", "vigencia", "relatorio"] as ListaFundo[]) conferir(`fundo-${l}`, colunasFundo(l), valoresDoPlanoFundo(fundo, l));
  const m = valoresDoPlanoEspecial(especial, "motivo");
  assert.deepEqual([m.plano, m.emenda, m.reapresentado, m.ano], ["09032025-014604", "202544", "Sim", 2025]);
  assert.equal(valoresDoPlanoFundo(fundo, "pagamento")["nunca-pagou"], "Sim");
  assert.equal(valoresDoPlanoFundo(fundo, "relatorio")["tipo-relatorio"], "Final");
  assert.equal(valoresDoPlanoFundo(fundo, "vigencia").plano, "75883", "sem código, o id do plano");
});

test("a tela do Pix: tabelas com filtro, sem caixa de rolagem dupla, e o recorte inteiro na página", () => {
  const tela = fs.readFileSync(path.resolve(import.meta.dirname, "..", "..", "app", "mapa", "painel", "pix", "PixConteudo.tsx"), "utf-8");
  assert.equal((tela.match(/<TabelaPlanosEspeciais\b/g) ?? []).length, 3);
  assert.equal((tela.match(/<TabelaPlanosFundo\b/g) ?? []).length, 3);
  assert.equal((tela.match(/<table className="mp-tabela mp-pix-planos">/g) ?? []).length, 0, "as tabelas antigas saíram");
  assert.equal((tela.match(/\bsemRolagem\b/g) ?? []).length, 6);
  const servidor = fs.readFileSync(path.resolve(import.meta.dirname, "pix.server.ts"), "utf-8");
  assert.match(servidor, /export const LIMITE_LISTA = 1200;/);
});
