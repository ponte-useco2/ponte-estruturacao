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
