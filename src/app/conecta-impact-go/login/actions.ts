"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Server action de login pro dashboard privado /conecta-impact-go.
 *
 * Compara login/senha com env vars (default de fallback: rachel / centelha*2026).
 * Se OK, seta cookie httpOnly `ci_go_auth` e redireciona.
 * Se falhar, retorna { success: false, error } pra client exibir.
 */

const AUTH_USER = process.env.CI_GO_USER || "rachel";
const AUTH_PASS = process.env.CI_GO_PASS || "centelha*2026";
const AUTH_SECRET = process.env.CI_GO_AUTH_SECRET || "conecta-impact-go-2026";

// 30 dias
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export interface LoginResult {
  success: boolean;
  error?: string;
}

export async function loginConectaImpact(
  formData: FormData
): Promise<LoginResult> {
  const usuario = ((formData.get("usuario") as string) || "").trim().toLowerCase();
  const senha = ((formData.get("senha") as string) || "").trim();
  const next = ((formData.get("next") as string) || "/conecta-impact-go").trim();

  // Delay curto pra frustrar brute force minimamente
  await new Promise((r) => setTimeout(r, 400));

  if (usuario !== AUTH_USER.toLowerCase() || senha !== AUTH_PASS) {
    return { success: false, error: "Usuário ou senha incorretos." };
  }

  // Seta cookie
  const jar = await cookies();
  jar.set("ci_go_auth", AUTH_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  // Redireciona pra rota original (ou dashboard)
  const target =
    next.startsWith("/conecta-impact-go") && !next.startsWith("/conecta-impact-go/login")
      ? next
      : "/conecta-impact-go";
  redirect(target);
}

export async function logoutConectaImpact(): Promise<void> {
  const jar = await cookies();
  jar.delete("ci_go_auth");
  redirect("/conecta-impact-go/login");
}
