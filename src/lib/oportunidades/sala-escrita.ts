/**
 * Salas que gravam (oport_59, 30/10/2026): a sala do Pablo. Parte pura — vocabulário, a regra do texto livre (a mesma
 * de `sala_texto` no banco, que é a guarda; esta só avisa antes), os botões de cada estado, as ordens da tela e a
 * tradução de cada ato na chamada da função do banco. Toda escrita passa por uma função `sala_*` (ver a migração): a
 * página nunca grava tabela direto.
 */

export const SALA_PABLO = "pablo";

export type EstadoDemanda = "recebida" | "combinada" | "andamento" | "validacao" | "concluida" | "cancelada";
export type Prioridade = "alta" | "normal" | "baixa";
export type QuemAge = "PONTE" | "Pablo" | "Terceiro";

export const ESTADOS: Record<EstadoDemanda, string> = {
  recebida: "Recebida",
  combinada: "Combinada",
  andamento: "Em andamento",
  validacao: "Para validação",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
export const ABERTOS: EstadoDemanda[] = ["recebida", "combinada", "andamento", "validacao"];
export const PRIORIDADES: Record<Prioridade, string> = { alta: "Alta", normal: "Normal", baixa: "Baixa" };
export const QUEM_AGE: QuemAge[] = ["PONTE", "Pablo", "Terceiro"];
export const DECISORES = ["Pablo", "Jonathan", "Pablo e Jonathan", "Terceiro"] as const;
export const FASES = ["Captação", "Execução", "Prestação de contas", "A confirmar", "Encerrado"] as const;
export const A_CLASSIFICAR = "A_CLASSIFICAR";

export interface Dependencia {
  de: QuemAge;
  quem: string;
  acompanha: "PONTE" | "Pablo";
  ultimo_contato: string | null;
  proximo_contato: string | null;
}

export interface Demanda {
  id: string;
  objeto: string;
  estado: EstadoDemanda;
  titulo: string;
  descricao: string;
  prioridade: Prioridade;
  data_desejada: string | null;
  data_combinada: string | null;
  responsavel: QuemAge | null;
  criterio: string;
  referencia: string;
  dependencia: Dependencia | null;
  entrega: { descricao: string; versao: string; em: string } | null;
  validacao: { resultado: "aprovada" | "ajuste"; comentario: string; em: string } | null;
  datas_anteriores: { data: string | null; ate: string; motivo: string }[];
  motivo_cancelamento: string | null;
  autor_rotulo: string | null;
  criado_em: string;
  criado_por: string | null;
  atualizado_em: string;
}

export interface Documento {
  titulo: string;
  estado?: string;
  onde?: string;
  nota?: string;
}

export interface Objeto {
  id: string;
  ordem: number;
  atualizado_em: string;
  atualizado_por: string | null;
  nome: string;
  nomes_anteriores?: string[];
  iniciativa?: string;
  organizacao?: string;
  fase?: string;
  papeis?: Record<string, string>;
  papel_pablo?: string;
  papel_ponte?: string;
  instrumento?: string;
  resumo?: string;
  identidade?: string;
  documentos?: Documento[];
  relacoes?: string[];
  fonte?: string;
  confirmado_em?: string;
}

export interface Decisao {
  id: string;
  objeto: string;
  questao: string;
  alternativas: string[];
  decisor: string;
  estado: "aberta" | "decidida";
  decisao: string;
  efeito: string;
  autor_rotulo: string | null;
  decidido_rotulo: string | null;
  criado_por: string | null;
  decidido_em: string | null;
  decidido_por: string | null;
}

export interface Reuniao {
  data: string;
  pauta: string[];
  trabalho_da_manha: string[];
  decisoes_tomadas: string[];
  compromissos: string[];
  notas: string;
  atualizado_em: string;
}

export interface Evento {
  id: number;
  quando: string;
  quem: string | null;
  autor_rotulo: string | null;
  tipo: string;
  alvo: string;
  objeto: string | null;
  motivo: string | null;
}

export interface Membro {
  user_id: string;
  papel: "cliente" | "ponte";
  nome: string;
}

// ------------------------------------------------------------------ arquivos

/** Os tipos aceitos — os mesmos de `sala_tipos_arquivo()` e do bucket `salas` (oport_59). */
export const TIPOS_ARQUIVO: Record<string, { rotulo: string; extensoes: string[] }> = {
  "application/pdf": { rotulo: "PDF", extensoes: ["pdf"] },
  "image/png": { rotulo: "PNG", extensoes: ["png"] },
  "image/jpeg": { rotulo: "JPEG", extensoes: ["jpg", "jpeg"] },
  "image/webp": { rotulo: "WEBP", extensoes: ["webp"] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { rotulo: "DOCX", extensoes: ["docx"] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { rotulo: "XLSX", extensoes: ["xlsx"] },
  "text/csv": { rotulo: "CSV", extensoes: ["csv"] },
  "text/plain": { rotulo: "TXT", extensoes: ["txt"] },
};
export const LIMITE_ARQUIVO = 25 * 1024 * 1024;
export const ACEITA_ARQUIVO = Object.values(TIPOS_ARQUIVO)
  .flatMap((t) => t.extensoes.map((e) => `.${e}`))
  .join(",");

/** O tipo pela extensão do nome (o navegador às vezes manda o tipo vazio ou genérico); null se não for aceito. */
export function tipoDoArquivo(nome: string): string | null {
  const ext = (nome.split(".").pop() ?? "").toLowerCase();
  for (const [tipo, t] of Object.entries(TIPOS_ARQUIVO)) if (t.extensoes.includes(ext)) return tipo;
  return null;
}

/** O motivo de recusa do arquivo antes de subir, ou null. */
export function problemaNoArquivo(nome: string, tamanho: number): string | null {
  if (!tipoDoArquivo(nome)) return "Tipo de arquivo não aceito aqui. Use PDF, imagem (PNG, JPEG, WEBP), DOCX, XLSX, CSV ou TXT.";
  if (tamanho > LIMITE_ARQUIVO) return "O arquivo passa de 25 MB.";
  if (tamanho === 0) return "O arquivo está vazio.";
  return null;
}

/** Nome guardado no caminho do armazenamento: sem acento, sem espaço, só [A-Za-z0-9._-], até 120 caracteres, com a extensão. */
export function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "");
  const ext = (limpo.split(".").pop() ?? "").toLowerCase();
  const base = limpo.slice(0, Math.max(1, limpo.length - ext.length - 1)).slice(0, 120 - ext.length - 1) || "arquivo";
  return `${base}.${ext}`;
}

export function tamanhoBR(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** Link aceito: http ou https, sem espaço. */
export function linkValido(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url.trim());
}

export type EstadoMelhoria = "recebida" | "em_analise" | "feita" | "nao_sera_feita";
export const MELHORIA_ESTADOS: Record<EstadoMelhoria, string> = {
  recebida: "Recebida",
  em_analise: "Em análise",
  feita: "Feita",
  nao_sera_feita: "Não será feita",
};

/** Pedido de melhoria da sala (adendo 1): uma página, o texto, quem e quando; só a PONTE responde. */
export interface Melhoria {
  id: string;
  pagina: string;
  texto: string;
  estado: EstadoMelhoria;
  resposta: string;
  criado_em: string;
  criado_por: string | null;
  respondido_em: string | null;
}

/** Link ou arquivo enviado a um projeto (adendo 1). O arquivo mora no bucket privado `salas`. */
export interface Envio {
  id: string;
  objeto: string;
  tipo: "link" | "arquivo";
  titulo: string;
  nota: string;
  url: string | null;
  nome_arquivo: string | null;
  tipo_conteudo: string | null;
  tamanho: number | null;
  sha256: string | null;
  estado: "ativo" | "retirado";
  retirado_motivo: string | null;
  arquivo_apagado: boolean;
  criado_em: string;
  criado_por: string | null;
}

export interface DadosSala {
  objetos: Objeto[];
  melhorias: Melhoria[];
  envios: Envio[];
  demandas: Demanda[];
  decisoes: Decisao[];
  reunioes: Reuniao[];
  eventos: Evento[];
  membros: Membro[];
}

// ------------------------------------------------------------------ texto livre

const CPF = [/\d{3}\.\d{3}\.\d{3}-\d{2}/, /(^|[^0-9./-])\d{11}([^0-9./-]|$)/];
const TELEFONE = [/\(\d{2}\)\s*9?\d{4}[-\s.]?\d{4}/, /(^|[^0-9])9\d{4}-\d{4}([^0-9]|$)/, /\+55\s?\d/];
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const REAIS = /R\$\s*\d/i;

/** O motivo da recusa do texto livre, ou null. O mesmo critério de `sala_texto` (oport_59). */
export function problemaNoTexto(valor: string, rotulo: string, max: number, obrigatorio = false): string | null {
  const v = valor.trim();
  if (obrigatorio && !v) return `Preencha ${rotulo}.`;
  if (v.length > max) return `${maiuscula(rotulo)} passa de ${max} caracteres.`;
  if (CPF.some((r) => r.test(v))) return `${maiuscula(rotulo)} parece ter um CPF. A sala não guarda documento pessoal.`;
  if (TELEFONE.some((r) => r.test(v))) return `${maiuscula(rotulo)} parece ter um telefone. A sala não guarda contato pessoal.`;
  if (EMAIL.test(v)) return `${maiuscula(rotulo)} parece ter um e-mail. A sala não guarda contato pessoal.`;
  if (REAIS.test(v)) return `${maiuscula(rotulo)} tem um valor em R$. A sala não registra valores financeiros.`;
  return null;
}

function maiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "um por linha" → lista sem vazios. */
export function linhas(texto: string): string[] {
  return texto
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ------------------------------------------------------------------ erros

/** A mensagem que a pessoa lê. As do banco começam com "sala: "; o resto vira genérico (e vai para o log). */
export function mensagemDoErro(mensagem: string | null | undefined): string {
  const m = (mensagem ?? "").match(/sala: ([\s\S]+)$/);
  if (m) {
    const t = m[1].trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return "Não foi possível salvar. Tente de novo; se continuar, recarregue a página.";
}

// ------------------------------------------------------------------ atos

/** Cada ato da tela, e o que ele manda. A data vai como "AAAA-MM-DD" ou null; a versão é o `atualizado_em` lido. */
export type Ato =
  | { ato: "registrar"; titulo: string; descricao: string; objeto: string; prioridade: Prioridade; data_desejada: string | null; referencia: string }
  | { ato: "combinar"; id: string; versao: string; responsavel: QuemAge; data_combinada: string | null; criterio: string }
  | { ato: "iniciar"; id: string; versao: string }
  | { ato: "entregar"; id: string; versao: string; descricao: string; versao_entrega: string }
  | { ato: "validar"; id: string; versao: string; resultado: "aprovar" | "ajuste"; comentario: string }
  | { ato: "rever_data"; id: string; versao: string; nova: string | null; motivo: string }
  | { ato: "dependencia"; id: string; versao: string; dependencia: Dependencia | null }
  | { ato: "classificar"; id: string; versao: string; titulo: string; objeto: string; prioridade: Prioridade; data_desejada: string | null }
  | { ato: "cancelar"; id: string; versao: string; motivo: string }
  | { ato: "mover_objeto"; id: string; direcao: -1 | 1 }
  | { ato: "atualizar_objeto"; id: string; versao: string; fase: string; resumo: string }
  | { ato: "abrir_decisao"; questao: string; alternativas: string[]; decisor: string; objeto: string }
  | { ato: "decidir"; id: string; decisao: string; efeito: string }
  | {
      ato: "salvar_reuniao";
      data: string;
      versao: string | null;
      pauta: string[];
      trabalho_da_manha: string[];
      decisoes_tomadas: string[];
      compromissos: string[];
      notas: string;
    }
  | {
      ato: "cadastrar_objeto";
      nome: string;
      organizacao: string;
      fase: string;
      instrumento: string;
      papel_pablo: string;
      papel_ponte: string;
      resumo: string;
      nome_anterior: string;
    }
  | { ato: "pedir_melhoria"; pagina: string; texto: string }
  | { ato: "responder_melhoria"; id: string; estado: EstadoMelhoria; resposta: string }
  | { ato: "enviar_link"; objeto: string; url: string; titulo: string; nota: string }
  | { ato: "registrar_arquivo"; objeto: string; id: string; caminho: string; titulo: string; nota: string; nome: string; sha256: string }
  | { ato: "retirar_envio"; id: string; motivo: string };

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const data = (d: string | null) => (d && DATA.test(d) ? d : null);

/** O ato vira a função do banco e os argumentos. Lança em ato desconhecido (a action recebe o que o navegador mandar). */
export function montarChamada(sala: string, a: Ato): { funcao: string; args: Record<string, unknown> } {
  const s = { p_sala: sala };
  switch (a.ato) {
    case "registrar":
      return {
        funcao: "sala_demanda_registrar",
        args: { ...s, p_titulo: a.titulo, p_descricao: a.descricao, p_objeto: a.objeto, p_prioridade: a.prioridade, p_data_desejada: data(a.data_desejada), p_referencia: a.referencia },
      };
    case "combinar":
      return {
        funcao: "sala_demanda_combinar",
        args: { ...s, p_id: a.id, p_versao: a.versao, p_responsavel: a.responsavel, p_data_combinada: data(a.data_combinada), p_criterio: a.criterio },
      };
    case "iniciar":
      return { funcao: "sala_demanda_iniciar", args: { ...s, p_id: a.id, p_versao: a.versao } };
    case "entregar":
      return { funcao: "sala_demanda_entregar", args: { ...s, p_id: a.id, p_versao: a.versao, p_descricao: a.descricao, p_versao_entrega: a.versao_entrega } };
    case "validar":
      return { funcao: "sala_demanda_validar", args: { ...s, p_id: a.id, p_versao: a.versao, p_resultado: a.resultado, p_comentario: a.comentario } };
    case "rever_data":
      return { funcao: "sala_demanda_rever_data", args: { ...s, p_id: a.id, p_versao: a.versao, p_nova: data(a.nova), p_motivo: a.motivo } };
    case "dependencia": {
      const d = a.dependencia;
      return {
        funcao: "sala_demanda_dependencia",
        args: {
          ...s,
          p_id: a.id,
          p_versao: a.versao,
          p_de: d ? d.de : null,
          p_quem: d ? d.quem : null,
          p_acompanha: d ? d.acompanha : null,
          p_ultimo_contato: d ? data(d.ultimo_contato) : null,
          p_proximo_contato: d ? data(d.proximo_contato) : null,
        },
      };
    }
    case "classificar":
      return {
        funcao: "sala_demanda_classificar",
        args: { ...s, p_id: a.id, p_versao: a.versao, p_titulo: a.titulo, p_objeto: a.objeto, p_prioridade: a.prioridade, p_data_desejada: data(a.data_desejada) },
      };
    case "cancelar":
      return { funcao: "sala_demanda_cancelar", args: { ...s, p_id: a.id, p_versao: a.versao, p_motivo: a.motivo } };
    case "mover_objeto":
      return { funcao: "sala_objeto_mover", args: { ...s, p_id: a.id, p_direcao: a.direcao === -1 ? -1 : 1 } };
    case "atualizar_objeto":
      return { funcao: "sala_objeto_atualizar", args: { ...s, p_id: a.id, p_versao: a.versao, p_fase: a.fase, p_resumo: a.resumo } };
    case "abrir_decisao":
      return { funcao: "sala_decisao_abrir", args: { ...s, p_questao: a.questao, p_alternativas: a.alternativas, p_decisor: a.decisor, p_objeto: a.objeto } };
    case "decidir":
      return { funcao: "sala_decisao_decidir", args: { ...s, p_id: a.id, p_decisao: a.decisao, p_efeito: a.efeito } };
    case "salvar_reuniao":
      return {
        funcao: "sala_reuniao_salvar",
        args: {
          ...s,
          p_data: data(a.data),
          p_versao: a.versao,
          p_pauta: a.pauta,
          p_trabalho_da_manha: a.trabalho_da_manha,
          p_decisoes_tomadas: a.decisoes_tomadas,
          p_compromissos: a.compromissos,
          p_notas: a.notas,
        },
      };
    case "cadastrar_objeto":
      return {
        funcao: "sala_objeto_cadastrar",
        args: {
          ...s,
          p_nome: a.nome,
          p_organizacao: a.organizacao,
          p_fase: a.fase,
          p_instrumento: a.instrumento,
          p_papel_pablo: a.papel_pablo,
          p_papel_ponte: a.papel_ponte,
          p_resumo: a.resumo,
          p_nome_anterior: a.nome_anterior,
        },
      };
    case "pedir_melhoria":
      return { funcao: "sala_melhoria_pedir", args: { ...s, p_pagina: a.pagina, p_texto: a.texto } };
    case "responder_melhoria":
      return { funcao: "sala_melhoria_responder", args: { ...s, p_id: a.id, p_estado: a.estado, p_resposta: a.resposta } };
    case "enviar_link":
      return { funcao: "sala_envio_link", args: { ...s, p_objeto: a.objeto, p_url: a.url, p_titulo: a.titulo, p_nota: a.nota } };
    case "registrar_arquivo":
      return {
        funcao: "sala_arquivo_registrar",
        args: { ...s, p_objeto: a.objeto, p_id: a.id, p_caminho: a.caminho, p_titulo: a.titulo, p_nota: a.nota, p_nome: a.nome, p_sha256: a.sha256 },
      };
    case "retirar_envio":
      return { funcao: "sala_envio_retirar", args: { ...s, p_id: a.id, p_motivo: a.motivo } };
    default:
      throw new Error("ato desconhecido");
  }
}

// ------------------------------------------------------------------ tela

export type Botao = "combinar" | "classificar" | "iniciar" | "entregar" | "validar" | "rever_data" | "dependencia" | "prioridade" | "cancelar";

/** Os botões de cada estado, na ordem do protótipo. */
export function botoesDoEstado(estado: EstadoDemanda): Botao[] {
  const b: Botao[] = [];
  if (estado === "recebida") b.push("combinar", "classificar");
  if (estado === "combinada") b.push("iniciar", "entregar");
  if (estado === "andamento") b.push("entregar");
  if (estado === "validacao") b.push("validar");
  if (estado === "combinada" || estado === "andamento" || estado === "validacao") b.push("rever_data");
  if (ABERTOS.includes(estado)) {
    b.push("dependencia");
    if (estado !== "recebida") b.push("prioridade");
    b.push("cancelar");
  }
  return b;
}

const PESO: Record<Prioridade, number> = { alta: 0, normal: 1, baixa: 2 };

/** Pela data combinada (sem data por último) e, no empate, pela prioridade. */
export function ordemDemanda(a: Demanda, b: Demanda): number {
  const da = a.data_combinada ?? "9999";
  const db = b.data_combinada ?? "9999";
  if (da !== db) return da < db ? -1 : 1;
  return (PESO[a.prioridade] ?? 1) - (PESO[b.prioridade] ?? 1);
}

export function venceu(d: Demanda, hoje: string): boolean {
  return Boolean(d.data_combinada && ABERTOS.includes(d.estado) && d.data_combinada < hoje);
}

/** A próxima sexta (hoje, se hoje for sexta), em "AAAA-MM-DD". `hoje` é a data de Brasília. */
export function proximaSexta(hoje: string): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  const falta = (5 - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + falta);
  return d.toISOString().slice(0, 10);
}

/** A data de hoje em Brasília (sem horário de verão). */
export function hojeBrasilia(agora: Date = new Date()): string {
  return new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && a ? `${d}/${m}/${a}` : String(iso);
}

export function quandoBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function nomeObjeto(objetos: Objeto[], id: string | null | undefined): string {
  if (!id || id === A_CLASSIFICAR) return "A classificar";
  const o = objetos.find((x) => x.id === id);
  return o ? `${o.id} · ${o.nome}` : id;
}

/** Quem fez: o rótulo da carga inicial, o nome do membro, "você" ou "alguém da sala". */
export function autorDe(reg: { autor_rotulo?: string | null; quem?: string | null; criado_por?: string | null }, membros: Membro[], eu: string): string {
  if (reg.autor_rotulo) return reg.autor_rotulo;
  const id = reg.quem ?? reg.criado_por;
  if (!id) return "—";
  const m = membros.find((x) => x.user_id === id);
  if (m) return id === eu ? `${m.nome} (você)` : m.nome;
  return id === eu ? "você" : "alguém da sala";
}

/** A linha do banco (`dados` jsonb + colunas) vira o objeto da tela. */
export function objetoDaLinha(l: { id: string; ordem: number; atualizado_em: string; atualizado_por: string | null; dados: Record<string, unknown> }): Objeto {
  return { ...(l.dados as Omit<Objeto, "id" | "ordem" | "atualizado_em" | "atualizado_por">), id: l.id, ordem: l.ordem, atualizado_em: l.atualizado_em, atualizado_por: l.atualizado_por, nome: String(l.dados.nome ?? l.id) };
}
