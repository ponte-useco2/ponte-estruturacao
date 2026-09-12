/**
 * Leitura e criação de organizações.
 *
 * Usa o cliente da SESSÃO: a RLS da `oport_6` é a barreira de verdade. Mesmo
 * que estas funções esquecessem de filtrar, o banco só devolveria as entidades
 * a que a pessoa pertence — e a criação passa por `oport_criar_organizacao`,
 * que confere a aprovação por dentro, sem confiar na tela.
 */
import { cookies } from "next/headers";
import { authConfigurada, clienteSessao } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import { ehTipoAgente, type Organizacao, type TipoAgente } from "./organizacao";

/**
 * Qual organização está ativa quando a pessoa pertence a mais de uma.
 *
 * Cookie, e não coluna: a escolha é de sessão de trabalho, não de identidade —
 * a mesma pessoa alterna entre duas entidades ao longo do dia, e em dois
 * navegadores pode estar em cada uma. Gravar no banco tornaria a escolha
 * global e obrigaria uma escrita a cada troca.
 *
 * O valor NUNCA é confiado: ele só é usado para escolher dentro da lista que o
 * banco já devolveu. Cookie adulterado seleciona nada e cai na primeira.
 */
export const COOKIE_ORG = "mapa_org";

interface LinhaMembro {
  papel: string;
  organizacao: {
    id: string;
    nome: string;
    tipo: string;
    uf: string | null;
    municipio_ibge: string | null;
    cnpj: string | null;
  } | null;
}

/**
 * As organizações da pessoa, em ordem de nome.
 *
 * Falha de leitura devolve lista vazia, como `lerPreferencias` faz com as
 * preferências: o Mapa precisa abrir mesmo quando o cadastro não pôde ser lido.
 * Não saber a entidade custa o filtro de elegibilidade; não abrir custa a tela.
 */
export async function lerOrganizacoes(): Promise<Organizacao[]> {
  if (!authConfigurada()) return [];

  const db = await clienteSessao();
  const { data, error } = await db
    .from("oport_membro")
    .select("papel, organizacao:oport_organizacao (id, nome, tipo, uf, municipio_ibge, cnpj)");

  if (error) {
    if (!ehEsquemaAusente(error.code)) console.error("lerOrganizacoes:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as LinhaMembro[])
    .flatMap((m) => {
      const o = m.organizacao;
      // `tipo` vem de uma coluna com check dos doze; ainda assim é validado na
      // entrada, porque um tipo desconhecido aqui viraria portão de
      // elegibilidade sempre fechado, e em silêncio.
      if (!o || !ehTipoAgente(o.tipo)) return [];
      return [
        {
          id: o.id,
          nome: o.nome,
          tipo: o.tipo,
          uf: o.uf,
          municipioIbge: o.municipio_ibge,
          cnpj: o.cnpj,
          papel: (m.papel === "dono" || m.papel === "editor" ? m.papel : "leitor") as Organizacao["papel"],
        },
      ];
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * A organização ativa, e todas as da pessoa — numa leitura só, porque a moldura
 * precisa das duas coisas: qual está ativa e se há outra para trocar.
 */
export async function lerContexto(): Promise<{ ativa: Organizacao | null; todas: Organizacao[] }> {
  const todas = await lerOrganizacoes();
  if (todas.length === 0) return { ativa: null, todas };

  const escolhido = (await cookies()).get(COOKIE_ORG)?.value;
  const ativa = todas.find((o) => o.id === escolhido) ?? todas[0];
  return { ativa, todas };
}

export type ResultadoCriacao =
  | { ok: true; id: string }
  | { ok: false; erro: string };

/**
 * Cria a entidade e o vínculo de dono numa transação só.
 *
 * A função do banco é que decide se pode: ela lê `auth.uid()` por dentro e
 * confere a aprovação. Esta camada só traduz o erro para a tela.
 */
export async function criarOrganizacao(campos: {
  nome: string;
  tipo: TipoAgente;
  uf: string | null;
  municipioIbge: string | null;
  cnpj: string | null;
}): Promise<ResultadoCriacao> {
  if (!authConfigurada()) return { ok: false, erro: "Cadastro indisponível no momento." };

  const db = await clienteSessao();
  const { data, error } = await db.rpc("oport_criar_organizacao", {
    p_nome: campos.nome,
    p_tipo: campos.tipo,
    p_uf: campos.uf,
    p_municipio_ibge: campos.municipioIbge,
    p_cnpj: campos.cnpj,
  });

  if (error) {
    console.error("criarOrganizacao:", error.message);
    if (ehEsquemaAusente(error.code)) {
      return { ok: false, erro: "O cadastro de organizações ainda não foi ativado no banco." };
    }
    // 42501 é o que a função levanta para sessão ausente e para acesso não
    // aprovado. A tela não distingue os dois de propósito: quem não está
    // aprovado não precisa saber se o motivo foi esse ou a sessão.
    if (error.code === "42501") {
      return { ok: false, erro: "Seu acesso ainda não foi aprovado." };
    }
    return { ok: false, erro: "Não foi possível salvar. Tente de novo." };
  }

  return { ok: true, id: String(data) };
}
