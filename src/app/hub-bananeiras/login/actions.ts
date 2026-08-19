"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Login do Workspace do Instituidor — HUB Bananeiras.
 *
 * Credenciais vêm de env vars; os defaults existem só para não travar o
 * desenvolvimento. Em produção, defina HUB_USER e HUB_PASS na Vercel — o
 * default está no código-fonte, que é público.
 */

const AUTH_USER = process.env.HUB_USER || "bananeiras";
const AUTH_PASS = process.env.HUB_PASS || "hub*2026";
const AUTH_SECRET = process.env.HUB_AUTH_SECRET || "hub-bananeiras-2026";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export interface LoginResult {
  success: boolean;
  error?: string;
}

export async function loginHubBananeiras(formData: FormData): Promise<LoginResult> {
  const usuario = ((formData.get("usuario") as string) || "").trim().toLowerCase();
  const senha = ((formData.get("senha") as string) || "").trim();

  // Atraso curto para encarecer tentativa por força bruta
  await new Promise((r) => setTimeout(r, 400));

  if (usuario !== AUTH_USER.toLowerCase() || senha !== AUTH_PASS) {
    return { success: false, error: "Usuário ou senha incorretos." };
  }

  const jar = await cookies();
  jar.set("hub_bananeiras_auth", AUTH_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  redirect("/hub-bananeiras/workspace");
}

export async function logoutHubBananeiras(): Promise<void> {
  const jar = await cookies();
  jar.delete("hub_bananeiras_auth");
  redirect("/hub-bananeiras/login");
}
