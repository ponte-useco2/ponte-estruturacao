"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { autenticarArea, type AreaProtegida } from "@/lib/auth-area";

/**
 * Login do Workspace do Instituidor — HUB Bananeiras.
 *
 * As credenciais saíram do código. Antes eram `bananeiras / hub*2026` como
 * default, o que num repositório público equivale a publicar a senha: quem
 * clonou o repositório em qualquer momento já a tem, e nenhuma variável de
 * ambiente desfaz isso. Por isso a credencial foi trocada, não escondida.
 *
 * Defina na Vercel: HUB_USER, HUB_PASS, HUB_AUTH_SECRET.
 */
const AREA: AreaProtegida = {
  prefixo: "/hub-bananeiras/workspace",
  cookie: "hub_bananeiras_auth",
  destinoPadrao: "/hub-bananeiras/workspace",
  vars: ["HUB_USER", "HUB_PASS", "HUB_AUTH_SECRET"],
  duracao: 60 * 60 * 24 * 30, // 30 dias
};

export interface LoginResult {
  success: boolean;
  error?: string;
}

export async function loginHubBananeiras(formData: FormData): Promise<LoginResult> {
  const r = await autenticarArea(formData, AREA);
  if (!r.ok) return { success: false, error: r.erro };
  redirect(r.destino!);
}

export async function logoutHubBananeiras(): Promise<void> {
  const jar = await cookies();
  jar.delete(AREA.cookie);
  redirect("/hub-bananeiras/login");
}
