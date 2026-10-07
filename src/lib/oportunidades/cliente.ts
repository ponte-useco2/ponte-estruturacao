/**
 * Quem pode ver a ficha de qual município — a regra da visão do cliente, sem banco.
 *
 * O cliente vê só a ficha do município da própria organização, e só depois que um
 * administrador confirma o vínculo (oport_12). O município vem SEMPRE da organização
 * ativa e da confirmação; nunca da URL. Cada motivo de recusa tem nome, para a tela
 * dizer o que falta em vez de uma porta fechada sem explicação.
 */

export type MotivoSemFicha =
  | "nao_aprovado"
  | "sem_organizacao"
  | "nao_municipio"
  | "sem_ibge"
  | "aguardando_confirmacao"
  | "municipio_mudou";

export type AcessoFicha = { ok: true; ibge: string } | { ok: false; motivo: MotivoSemFicha };

export interface OrganizacaoParaFicha {
  tipo: string;
  municipioIbge: string | null;
}

export interface VinculoMunicipio {
  municipio_ibge: string;
  confirmado_em: string;
}

const IBGE = /^\d{7}$/;

export function podeVerMunicipio(
  status: string | null | undefined,
  organizacao: OrganizacaoParaFicha | null,
  vinculo: VinculoMunicipio | null,
): AcessoFicha {
  if (status !== "aprovado") return { ok: false, motivo: "nao_aprovado" };
  if (!organizacao) return { ok: false, motivo: "sem_organizacao" };
  if (organizacao.tipo !== "municipio") return { ok: false, motivo: "nao_municipio" };
  if (!organizacao.municipioIbge || !IBGE.test(organizacao.municipioIbge)) return { ok: false, motivo: "sem_ibge" };
  if (!vinculo) return { ok: false, motivo: "aguardando_confirmacao" };
  // Confirmado para outro município: o cadastro mudou depois da confirmação.
  if (vinculo.municipio_ibge !== organizacao.municipioIbge) return { ok: false, motivo: "municipio_mudou" };
  return { ok: true, ibge: vinculo.municipio_ibge };
}

/** O que dizer em cada recusa. */
export const EXPLICACAO_SEM_FICHA: Record<MotivoSemFicha, { titulo: string; texto: string }> = {
  nao_aprovado: {
    titulo: "Seu acesso ainda não foi aprovado",
    texto: "A ficha do município fica disponível depois que a PONTE libera o seu acesso.",
  },
  sem_organizacao: {
    titulo: "Cadastre a prefeitura",
    texto: "Declare a entidade em Conta → Organização, com o tipo Município e o município. A PONTE confere o vínculo e libera a ficha.",
  },
  nao_municipio: {
    titulo: "A ficha é da prefeitura",
    texto: "A organização ativa não é do tipo Município. Se você também atua por uma prefeitura, cadastre-a e troque a organização ativa no menu da conta.",
  },
  sem_ibge: {
    titulo: "Falta dizer qual é o município",
    texto: "O cadastro da organização está sem o município. Complete em Conta → Organização para a PONTE conferir o vínculo.",
  },
  aguardando_confirmacao: {
    titulo: "Vínculo em conferência",
    texto: "A PONTE confere se a organização representa mesmo esse município antes de mostrar a ficha. Assim que confirmar, ela aparece aqui.",
  },
  municipio_mudou: {
    titulo: "O município do cadastro mudou",
    texto: "A confirmação era para outro município. A PONTE precisa conferir o vínculo de novo antes de mostrar a ficha.",
  },
};

// ============================================================================ cliente por CNPJ (oport_31, E2)

/**
 * O cliente que não é prefeitura (organização da sociedade civil, órgão estadual, consórcio) vê como cliente a
 * página da própria entidade e o laudo dos próprios instrumentos, depois que um administrador confirma que a
 * organização representa aquele CNPJ. O CNPJ vem SEMPRE da organização ativa e da confirmação, nunca da URL.
 */
export type MotivoSemCnpj = "nao_aprovado" | "sem_organizacao" | "sem_cnpj" | "aguardando_confirmacao" | "cnpj_mudou";

export type AcessoCnpj = { ok: true; cnpj: string } | { ok: false; motivo: MotivoSemCnpj };

export interface VinculoCnpj {
  cnpj: string;
  confirmado_em: string;
}

const CNPJ = /^[0-9A-Z]{12}[0-9]{2}$/;

export function podeVerEntidadePropria(
  status: string | null | undefined,
  organizacao: { cnpj: string | null } | null,
  vinculo: VinculoCnpj | null,
): AcessoCnpj {
  if (status !== "aprovado") return { ok: false, motivo: "nao_aprovado" };
  if (!organizacao) return { ok: false, motivo: "sem_organizacao" };
  if (!organizacao.cnpj || !CNPJ.test(organizacao.cnpj)) return { ok: false, motivo: "sem_cnpj" };
  if (!vinculo) return { ok: false, motivo: "aguardando_confirmacao" };
  // Confirmado para outro CNPJ: o cadastro mudou depois da confirmação.
  if (vinculo.cnpj !== organizacao.cnpj) return { ok: false, motivo: "cnpj_mudou" };
  return { ok: true, cnpj: vinculo.cnpj };
}

export const EXPLICACAO_SEM_CNPJ: Record<MotivoSemCnpj, { titulo: string; texto: string }> = {
  nao_aprovado: { titulo: "Acesso em análise", texto: "O acesso ainda não foi liberado pela PONTE." },
  sem_organizacao: {
    titulo: "Nenhuma organização ativa",
    texto: "Cadastre ou escolha a sua organização em Conta → Organização para ver a página dela como cliente.",
  },
  sem_cnpj: {
    titulo: "Falta o CNPJ da organização",
    texto: "O cadastro da organização está sem CNPJ. Complete em Conta → Organização para a PONTE conferir o vínculo.",
  },
  aguardando_confirmacao: {
    titulo: "Vínculo em conferência",
    texto: "A PONTE confere se a organização é mesmo a dona desse CNPJ antes de abrir a página como cliente. Assim que confirmar, ela aparece aqui.",
  },
  cnpj_mudou: {
    titulo: "O CNPJ do cadastro mudou",
    texto: "A confirmação era para outro CNPJ. A PONTE precisa conferir o vínculo de novo.",
  },
};

/** O instrumento é da própria entidade do cliente por CNPJ. */
export function podeVerInstrumentoPorCnpj(acesso: AcessoCnpj, i: { cnpj?: string | null }): boolean {
  return acesso.ok && !!i.cnpj && i.cnpj === acesso.cnpj;
}

// ============================================================================ laudo do cliente (onda 12, parte 3)

export type MotivoSemLaudo = MotivoSemFicha | "outro_proponente" | "outro_municipio";

/**
 * O cliente vê o laudo só dos instrumentos do próprio município: o proponente é da administração
 * municipal (a prefeitura, o fundo, a autarquia) e o IBGE é o do vínculo confirmado. O município vem
 * do acesso (organização ativa + confirmação), nunca do instrumento pedido na URL.
 */
export function podeVerInstrumento(
  acesso: AcessoFicha,
  i: { cod_ibge: string | null; tipo_agente: string | null },
): { ok: true } | { ok: false; motivo: MotivoSemLaudo } {
  if (!acesso.ok) return acesso;
  if (i.tipo_agente !== "municipio") return { ok: false, motivo: "outro_proponente" };
  if (i.cod_ibge !== acesso.ibge) return { ok: false, motivo: "outro_municipio" };
  return { ok: true };
}
