"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { visitanteAtual } from "@/lib/supabase-auth";
import { COOKIE_ORG, atualizarOrganizacao, criarOrganizacao, lerOrganizacoes } from "@/lib/oportunidades/organizacao.server";
import { cnpjValido, digitosDoCnpj, ehTipoAgente, ehUF, type TipoAgente } from "@/lib/oportunidades/organizacao";

/**
 * Cadastro da organização e troca da entidade ativa.
 *
 * Server action é endpoint HTTP: tudo o que a tela valida é validado aqui de
 * novo. A tela é conveniência; isto é a barreira — junto com a RLS e com a
 * própria `oport_criar_organizacao`, que confere aprovação por dentro.
 */

export interface ResultadoConta {
  ok: boolean;
  erro?: string;
}

const ROTA = "/mapa";

/** Só dígitos, sete deles. Vazio é ausência, não erro: o campo é opcional. */
function municipioValido(v: string): boolean {
  return v === "" || /^[0-9]{7}$/.test(v);
}

interface CamposDaEntidade {
  nome: string;
  tipo: TipoAgente;
  uf: string | null;
  municipioIbge: string | null;
  cnpj: string | null;
}

/** As validações do cadastro, as mesmas para criar e para editar (A09). */
function lerCampos(form: FormData): CamposDaEntidade | { erro: string } {
  const nome = String(form.get("nome") ?? "").trim();
  const tipo = String(form.get("tipo") ?? "");
  const uf = String(form.get("uf") ?? "").trim().toUpperCase();
  const municipio = String(form.get("municipio_ibge") ?? "").trim();
  const cnpjBruto = String(form.get("cnpj") ?? "").trim();

  if (nome.length < 2 || nome.length > 160) {
    return { erro: "O nome precisa ter entre 2 e 160 caracteres." };
  }
  if (!ehTipoAgente(tipo)) {
    return { erro: "Escolha o tipo de agente." };
  }
  // A lista fechada das 27 UFs, e não o regex de duas letras que o banco usa:
  // "XX" passaria no regex e não existe.
  if (uf !== "" && !ehUF(uf)) {
    return { erro: "UF inválida." };
  }
  if (!municipioValido(municipio)) {
    return { erro: "O código do IBGE tem sete dígitos." };
  }
  // O banco só confere o formato; os dígitos verificadores são conferidos aqui.
  // Sem isso, 00000000000000 entraria e só apareceria na hora de submeter.
  if (!cnpjValido(cnpjBruto)) {
    return { erro: "CNPJ inválido." };
  }
  return { nome, tipo, uf: uf === "" ? null : uf, municipioIbge: municipio === "" ? null : municipio, cnpj: digitosDoCnpj(cnpjBruto) };
}

export async function cadastrarOrganizacao(_anterior: unknown, form: FormData): Promise<ResultadoConta> {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return { ok: false, erro: "Sem permissão." };

  const campos = lerCampos(form);
  if ("erro" in campos) return { ok: false, erro: campos.erro };

  const r = await criarOrganizacao(campos);

  if (!r.ok) return { ok: false, erro: r.erro };

  // Recém-criada vira a ativa: quem acabou de cadastrar quer trabalhar nela.
  await gravarCookieAtiva(r.id);
  revalidatePath(ROTA);
  redirect(ROTA);
}

/**
 * Corrige o cadastro de uma organização já existente (diagnóstico externo de 17/11/2026, A09).
 *
 * O id vem do formulário e por isso é conferido contra a lista que o banco devolve à própria pessoa, com o papel
 * dela: leitor não edita. A RLS confere de novo na gravação.
 */
export async function editarOrganizacao(_anterior: unknown, form: FormData): Promise<ResultadoConta> {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return { ok: false, erro: "Sem permissão." };

  const id = String(form.get("organizacao_id") ?? "");
  const minha = (await lerOrganizacoes()).find((o) => o.id === id);
  if (!minha || minha.papel === "leitor") return { ok: false, erro: "Sem permissão para editar esta organização." };

  const campos = lerCampos(form);
  if ("erro" in campos) return { ok: false, erro: campos.erro };

  const r = await atualizarOrganizacao(id, campos);
  if (!r.ok) return { ok: false, erro: r.erro };

  revalidatePath(ROTA, "layout");
  redirect("/mapa/conta/organizacao");
}

/**
 * Troca a entidade ativa.
 *
 * O id é conferido contra a lista que o BANCO devolve, nunca aceito por vir do
 * formulário: sem isso, um id alheio no corpo da requisição marcaria como ativa
 * uma organização de outra pessoa. A RLS não pegaria — gravar cookie não toca
 * no banco.
 */
export async function trocarOrganizacao(form: FormData): Promise<void> {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return;

  const id = String(form.get("organizacao_id") ?? "");
  const minhas = await lerOrganizacoes();
  if (!minhas.some((o) => o.id === id)) {
    // Só chega aqui corpo de requisição adulterado: a tela nunca oferece id
    // alheio. Não trocar em silêncio é a resposta certa — não há o que explicar
    // a quem forjou o pedido.
    console.warn("trocarOrganizacao: id fora das organizações do visitante");
    return;
  }

  await gravarCookieAtiva(id);
  revalidatePath(ROTA, "layout");
}

async function gravarCookieAtiva(id: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_ORG, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
