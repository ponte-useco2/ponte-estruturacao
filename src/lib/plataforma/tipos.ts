/**
 * Modelo de domínio da Plataforma PONTE — fase 1 (sem backend).
 *
 * Nada aqui tem persistência. As fixtures vivem em `fixtures.ts` e são servidas
 * como a `oportunidades.json` já é: dado estático lido no servidor. Quando o
 * backend existir, estes tipos viram o contrato dele — por isso já estão
 * escritos com as invariantes que a UI promete.
 *
 * Disciplina emprestada de docs/GOVERNANCE-GRAPH-SPEC-v1.0.md: event sourcing
 * append-only com hash encadeado. Emprestado é o PADRÃO, não o esquema — as
 * entidades daquele documento (Decision, Clause, DocumentRevision, RegistryAct)
 * são de outro domínio: a constituição institucional do HUB Bananeiras. Os
 * nós aqui são os do quadro 1k: Território, Problema, Ativo, Organização,
 * Capacidade, Capital, Projeto, Evidência.
 */

// ============================ ATORES ==============================

/**
 * Os 7 perfis. O 07 é interno e NÃO tem autocadastro — as telas de backoffice
 * não foram desenhadas e estão fora desta fase. Ele existe no enum para que
 * a autorização já saiba recusá-lo, não para que a UI o ofereça.
 */
export type PerfilAtor =
  | "01_empresa"
  | "02_especialista"
  | "03_osc"
  | "04_territorio"
  | "05_ict"
  | "06_capital"
  | "07_ponte";

export const PERFIS_PUBLICOS: Exclude<PerfilAtor, "07_ponte">[] = [
  "01_empresa",
  "02_especialista",
  "03_osc",
  "04_territorio",
  "05_ict",
  "06_capital",
];

export const ROTULO_PERFIL: Record<PerfilAtor, string> = {
  "01_empresa": "Empresa / Indústria",
  "02_especialista": "Especialista / Fornecedor",
  "03_osc": "OSC / Associação / Cooperativa",
  "04_territorio": "Território / Poder Público",
  "05_ict": "ICT / Entidade Setorial",
  "06_capital": "Capital / Financiador",
  "07_ponte": "Equipe PONTE — backoffice/PMO",
};

export type Eixo = "SOCIAL" | "ECONOMICO" | "AMBIENTAL";

export interface Territorio {
  municipio: string;
  uf: string;
}

export interface Ator {
  id: string;
  perfil: PerfilAtor;
  nome: string;
  organizacao_id: string | null;
  capacidades: string[]; // insumo do cálculo de aderência
}

export interface Organizacao {
  id: string;
  razao_social: string;
  natureza: string; // mesmo vocabulário do contrato de oportunidades
  territorio: Territorio;
}

// ============================ CONTEÚDO E ANEXOS ==============================

/**
 * Texto e/ou áudio. Regra 1 do modo áudio: todo campo longo aceita voz, e o
 * áudio vale como resposta — não como anexo secundário. Por isso `texto` é
 * opcional: um conteúdo só-áudio é válido.
 */
export interface ConteudoMisto {
  texto: string | null;
  audio: RefAudio | null;
}

/**
 * Separação artefato/evento (decisão de LGPD).
 *
 * O ARQUIVO de áudio vive em storage comum, com retenção, e PODE ser apagado.
 * O EVENTO no ledger é imutável e sobrevive à remoção, carregando o resumo
 * derivado da transcrição. Assim append-only e direito de eliminação deixam
 * de colidir: some o dado pessoal bruto, permanece o registro de que houve
 * manifestação, de quem e quando.
 */
export interface RefAudio {
  id: string;
  duracao_seg: number;
  transcricao: string | null; // gerada no cliente onde o navegador permitir
  /** Preenchido quando o titular exerce eliminação. O evento no ledger fica. */
  removido_em: string | null;
  removido_a_pedido_do_titular: boolean;
}

export interface Anexo {
  id: string;
  nome: string;
  tipo: "documento" | "imagem" | "planilha" | "outro";
  bytes: number;
  enviado_em: string;
}

// ============================ CONSENTIMENTO ==============================

/**
 * Regra 4 do modo áudio: confirmação com efeito jurídico exige toque
 * explícito. Voz resolve ENTRADA de informação; não resolve consentimento.
 *
 * Registrar um booleano `confirmado_por_toque: true` não registraria nada —
 * só pode ser true, então não distingue nada e não é auditável. O que a
 * trilha precisa mostrar é COMO o consentimento foi dado, não apenas que foi.
 */
export type MetodoConfirmacao = "TOQUE" | "ASSINATURA_ELETRONICA" | "ACEITE_PRESENCIAL";

export interface Confirmacao {
  metodo: MetodoConfirmacao;
  ator_id: string;
  confirmado_em: string; // ISO 8601 com fuso
  /** Texto exato da ressalva exibida no momento do aceite, congelado. */
  ressalva_exibida: string;
  /** Evento correspondente no ledger. */
  evento_id: string;
}

// ============================ PROJETO EM FORMAÇÃO ==============================

export type StatusPJF =
  | "EM_DIAGNOSTICO"
  | "EM_COMPOSICAO"
  | "EM_CAPTACAO"
  | "EM_EXECUCAO"
  | "CONCLUIDO";

export type EtapaCiclo =
  | "PROBLEMA"
  | "PROJETO"
  | "FINANCIAMENTO"
  | "EXECUCAO"
  | "EVIDENCIA"
  | "RESULTADO";

export const ORDEM_CICLO: EtapaCiclo[] = [
  "PROBLEMA",
  "PROJETO",
  "FINANCIAMENTO",
  "EXECUCAO",
  "EVIDENCIA",
  "RESULTADO",
];

export interface FuncaoCritica {
  id: string;
  rotulo: string; // "Engenharia Hídrica"
  essencial: boolean;
  ocupante: { organizacao_id: string; confirmado_em: string } | null;
  /** Código da chamada aberta para preencher a vaga. Null quando ocupada. */
  chamada_codigo: string | null;
}

export interface ProjetoEmFormacao {
  codigo: string; // "PJF-0027" — id público estável, usado em deep link
  status: StatusPJF;
  titulo: string;
  territorio: Territorio;
  eixos: Eixo[];
  quadrantes: {
    problema_demonstrado: string;
    solucao_em_estruturacao: string;
    organizacoes_mobilizadas: string[];
    capital_potencial: string;
  };
  funcoes: FuncaoCritica[];
  etapas_atingidas: EtapaCiclo[];
}

/**
 * Cobertura da coalizão — DERIVADA, nunca persistida.
 *
 * O "3/5 · 60%" do quadro 1h muda toda vez que uma chamada é composta.
 * Guardar o número produziria a mesma classe de divergência que o contrato de
 * oportunidades proíbe no sentido inverso: número exibido que não bate com o
 * estado real.
 */
export function coberturaCoalizao(pjf: ProjetoEmFormacao): {
  cobertas: number;
  total: number;
  pct: number;
  abertas: FuncaoCritica[];
} {
  const total = pjf.funcoes.length;
  const abertas = pjf.funcoes.filter((f) => !f.ocupante);
  const cobertas = total - abertas.length;
  return {
    cobertas,
    total,
    pct: total === 0 ? 0 : Math.round((cobertas / total) * 100),
    abertas,
  };
}

// ============================ CHAMADA DE COMPOSIÇÃO ==============================

export type StatusChamada = "ABERTA" | "EM_ANALISE" | "COMPOSTA" | "CANCELADA";

export interface Requisito {
  id: string;
  descricao: string;
  /** Capacidade cadastrada que satisfaz este requisito, se houver correspondência. */
  chave_capacidade: string;
}

export interface ChamadaComposicao {
  codigo: string; // "CP-014"
  pjf_codigo: string; // vínculo obrigatório — chamada órfã não existe
  funcao_id: string;
  titulo: string;
  papel_no_projeto: string;
  entregas_esperadas: string[];
  experiencia_requerida: Requisito[];
  forma_participacao: string;
  status: StatusChamada;
}

/** Ressalva contratual do quadro 1i. Congelada na Confirmacao ao manifestar. */
export const RESSALVA_MANIFESTACAO =
  "A manifestação de interesse não constitui promessa de contratação, financiamento ou participação definitiva. Condições econômicas serão formalizadas em instrumento próprio.";

/**
 * Aderência é CALCULADA a partir do cadastro do ator contra os requisitos da
 * chamada. Não existe campo `aderencia` vivo em ChamadaComposicao — ele
 * mudaria de valor por ator e por atualização de cadastro.
 */
export function calcularAderencia(
  ator: Ator,
  chamada: ChamadaComposicao
): { pct: number; cobertos: Requisito[]; faltantes: Requisito[] } {
  const capacidades = new Set(ator.capacidades);
  const cobertos = chamada.experiencia_requerida.filter((r) => capacidades.has(r.chave_capacidade));
  const faltantes = chamada.experiencia_requerida.filter((r) => !capacidades.has(r.chave_capacidade));
  const total = chamada.experiencia_requerida.length;
  return {
    pct: total === 0 ? 0 : Math.round((cobertos.length / total) * 100),
    cobertos,
    faltantes,
  };
}

export interface Manifestacao {
  id: string;
  chamada_codigo: string;
  ator_id: string;
  tipo: "TENHO_CAPACIDADE" | "INDICACAO";
  /** Preenchido só quando tipo === "INDICACAO". Indicar transforma quem não é
   *  candidato em nó útil do grafo — não é feature secundária. */
  indicado: { nome: string; contato: string; justificativa: ConteudoMisto } | null;
  descricao: ConteudoMisto;
  anexos: Anexo[];
  /**
   * SNAPSHOT da aderência no instante do envio.
   *
   * A pessoa viu este número e agiu sobre ele. Se o cadastro dela mudar
   * depois, o recálculo daria outro valor e o registro do que foi visto no
   * momento da decisão se perderia. Requisito de auditoria, não de UI.
   */
  aderencia_no_envio: number;
  confirmacao: Confirmacao;
  criado_em: string;
}

// ============================ EXECUÇÃO E EVIDÊNCIA ==============================

export type EstadoEntrega = "APROVADA" | "PENDENTE" | "EM_ANDAMENTO";

export interface Entrega {
  codigo: string; // "E-01"
  pjf_codigo: string;
  titulo: string;
  responsavel_id: string;
  prazo: string; // YYYY-MM-DD
  estado: EstadoEntrega;
  progresso: { feitas: number; total: number } | null;
}

/**
 * Evidência é APPEND-ONLY. Sem update, sem delete.
 *
 * Correção é evidência nova apontando `supersede_id` para a anterior. É isso
 * que dá sentido literal à nota de auditoria do quadro 1j — "fica disponível
 * para escrutínio institucional quando cabível". Se desse para editar em
 * silêncio, a frase seria decorativa.
 */
export interface Evidencia {
  id: string;
  entrega_codigo: string; // vínculo obrigatório
  autor_id: string;
  arquivos: Anexo[];
  comprova: ConteudoMisto;
  criado_em: string;
  supersede_id: string | null;
}

// ============================ TRILHA DE DECISÕES (LEDGER) ==============================

export type TipoEvento =
  | "PJF_CRIADO"
  | "CHAMADA_ABERTA"
  | "MANIFESTACAO_ENVIADA"
  | "CHAMADA_COMPOSTA"
  | "CAPITAL_ACOPLADO"
  | "ORCAMENTO_APROVADO"
  | "EVIDENCIA_ENVIADA"
  | "EVIDENCIA_APROVADA"
  | "AUDIO_REGISTRADO"
  | "AUDIO_REMOVIDO_A_PEDIDO"
  | "CONSENTIMENTO_REGISTRADO";

/**
 * Evento imutável. `previous_hash` encadeia com o `content_hash` do anterior
 * no mesmo stream; cadeia rompida é rejeitada. Padrão herdado do
 * GOVERNANCE-GRAPH-SPEC §2.3 e §4.5.
 *
 * Um áudio enviado dentro de um projeto entra aqui (regra 3 do modo áudio).
 * Quando o titular pede eliminação, NÃO se apaga o evento: grava-se um
 * AUDIO_REMOVIDO_A_PEDIDO e o RefAudio original passa a ter `removido_em`.
 */
export interface EventoTrilha {
  evento_id: string;
  pjf_codigo: string; // stream
  seq: number; // sequencial rigoroso por stream
  tipo: TipoEvento;
  ator_id: string;
  resumo: string; // legível; quando vem de áudio, derivado da transcrição
  referencia: { entidade: string; id: string } | null;
  previous_event_id: string | null;
  previous_hash: string; // ou "GENESIS_ROOT"
  content_hash: string;
  criado_em: string;
}

// ============================ GRAFO ==============================

/** Os 8 tipos de nó do quadro 1k. O filtro por tipo não é opcional: sem ele
 *  o grafo é ilegível. */
export type TipoNo =
  | "TERRITORIO"
  | "PROBLEMA"
  | "ATIVO"
  | "ORGANIZACAO"
  | "CAPACIDADE"
  | "CAPITAL"
  | "PROJETO"
  | "EVIDENCIA";

export interface NoGrafo {
  id: string;
  tipo: TipoNo;
  rotulo: string;
}

/**
 * Arestas NÃO são cadastradas — são derivadas dos eventos da trilha. É isso
 * que sustenta a legenda do quadro 1k ("arestas = relações registradas durante
 * a execução") sem prometer inferência automática nem IA.
 */
export interface ArestaGrafo {
  origem_id: string;
  destino_id: string;
  relacao: string;
  evento_origem_id: string;
}
