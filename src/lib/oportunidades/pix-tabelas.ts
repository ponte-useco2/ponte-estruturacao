/**
 * As listas plano a plano do painel do Pix como tabelas com filtro (onda 15, fase 3, F3.1b, 20/10/2026): as colunas e
 * os valores crus. Puro, com teste; as células ficam em `PixConteudo.tsx`.
 *
 * O limite da leitura subiu para 1.200 (o maior recorte da PB tinha 1.009 planos em 13/10), e todas as linhas ficam na
 * página: o filtro de cada coluna vê o recorte inteiro. Tela de administrador: toda coluna ordena.
 */
import { ROTULO_SITUACAO_RELATORIO, rotuloMotivo, type PlanoEspecial, type PlanoFundo } from "./pix.ts";
import type { ColunaTabela, ValorCelula } from "./tabela-filtro.ts";

export type ListaEspeciais = "pago" | "motivo" | "fim";
export type ListaFundo = "pagamento" | "vigencia" | "relatorio";

export const TABELA_PIX_ESPECIAIS: Readonly<Record<ListaEspeciais, string>> = Object.freeze({
  pago: "pix-sem-relatorio",
  motivo: "pix-impedidos",
  fim: "pix-encerrada-sem-final",
});
export const TABELA_PIX_FUNDO: Readonly<Record<ListaFundo, string>> = Object.freeze({
  pagamento: "pix-parados",
  vigencia: "pix-encerrados-com-saldo",
  relatorio: "pix-aguardando-analise",
});

const oculta = (c: ColunaTabela): ColunaTabela => ({ ...c, oculta: true });

export function colunasEspeciais(lista: ListaEspeciais): ColunaTabela[] {
  return [
    { id: "ente", titulo: "Ente e plano", tipo: "texto" },
    lista === "motivo"
      ? { id: "valor", titulo: "Valor", tipo: "numero", alinhar: "direita" }
      : { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
    lista === "motivo"
      ? { id: "motivo", titulo: "Motivo", tipo: "categoria" }
      : lista === "fim"
        ? { id: "fim", titulo: "Fim da execução", tipo: "data" }
        : { id: "primeiro-pagamento", titulo: "Primeiro pagamento", tipo: "data" },
    oculta({ id: "plano", titulo: "Plano", tipo: "texto", textoNoCsv: true }),
    oculta({ id: "ano", titulo: "Ano", tipo: "numero", alinhar: "direita" }),
    oculta({ id: "emenda", titulo: "Emenda", tipo: "texto", textoNoCsv: true }),
    oculta({ id: "cnpj", titulo: "CNPJ", tipo: "texto", textoNoCsv: true }),
    ...(lista === "motivo" ? [oculta({ id: "reapresentado", titulo: "Reapresentado no mesmo ano", tipo: "categoria" })] : []),
  ];
}

export function valoresDoPlanoEspecial(l: PlanoEspecial, lista: ListaEspeciais): Record<string, ValorCelula> {
  return {
    ente: l.beneficiario,
    ...(lista === "motivo" ? { valor: l.valor, motivo: rotuloMotivo(l.motivo), reapresentado: l.reapresentado ? "Sim" : "Não" } : { pago: l.pago }),
    ...(lista === "fim" ? { fim: l.fim_execucao } : lista === "pago" ? { "primeiro-pagamento": l.dt_primeira_ob } : {}),
    plano: l.codigo_plano_acao ?? String(l.id_plano_acao),
    ano: l.ano,
    emenda: l.numero_emenda === null ? null : String(l.numero_emenda),
    cnpj: l.cnpj,
  };
}

export function colunasFundo(lista: ListaFundo): ColunaTabela[] {
  return [
    { id: "ente", titulo: "Ente e plano", tipo: "texto" },
    lista === "relatorio"
      ? { id: "repasse", titulo: "Repasse", tipo: "numero", alinhar: "direita" }
      : { id: "saldo", titulo: "Saldo", tipo: "numero", alinhar: "direita" },
    lista === "pagamento"
      ? { id: "ultimo-pagamento", titulo: "Último pagamento", tipo: "data" }
      : lista === "vigencia"
        ? { id: "fim-vigencia", titulo: "Fim da vigência", tipo: "data" }
        : { id: "relatorio", titulo: "Relatório enviado em", tipo: "data" },
    oculta({ id: "orgao", titulo: "Órgão", tipo: "categoria" }),
    oculta({ id: "programa", titulo: "Programa", tipo: "texto" }),
    oculta({ id: "ano", titulo: "Ano", tipo: "numero", alinhar: "direita" }),
    oculta({ id: "plano", titulo: "Plano", tipo: "texto", textoNoCsv: true }),
    ...(lista === "pagamento" ? [oculta({ id: "nunca-pagou", titulo: "Nunca pagou", tipo: "categoria" })] : []),
    ...(lista === "relatorio"
      ? [oculta({ id: "tipo-relatorio", titulo: "Tipo do relatório", tipo: "categoria" }), oculta({ id: "situacao-relatorio", titulo: "Situação do relatório", tipo: "categoria" })]
      : []),
  ];
}

export function valoresDoPlanoFundo(l: PlanoFundo, lista: ListaFundo): Record<string, ValorCelula> {
  return {
    ente: l.ente,
    ...(lista === "relatorio" ? { repasse: l.repasse } : { saldo: l.saldo_contas }),
    ...(lista === "pagamento"
      ? { "ultimo-pagamento": l.dt_ultimo_pagamento, "nunca-pagou": l.dt_ultimo_pagamento ? "Não" : "Sim" }
      : lista === "vigencia"
        ? { "fim-vigencia": l.fim_vigencia }
        : {
            relatorio: l.dt_relatorio,
            "tipo-relatorio": l.tipo_relatorio === "FINAL" ? "Final" : "Parcial",
            "situacao-relatorio": l.situacao_relatorio ? (ROTULO_SITUACAO_RELATORIO[l.situacao_relatorio] ?? l.situacao_relatorio) : null,
          }),
    orgao: l.orgao,
    programa: l.programa,
    ano: l.ano,
    plano: l.codigo_plano_acao ?? String(l.id_plano_acao),
  };
}
