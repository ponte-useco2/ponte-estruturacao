"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { autenticarArea, type AreaProtegida } from "@/lib/auth-area";

/**
 * Login da área reservada da Plataforma PONTE (/plataforma/app).
 *
 * A lógica (comparação em tempo constante, honeypot, freio de tentativas,
 * validação do `next`) mora em src/lib/auth-area.ts, compartilhada com as
 * outras duas áreas. Estava triplicada, e as três cópias divergiram —
 * inclusive na parte que importava, que era a existência de senha padrão.
 *
 * Defina na Vercel: PLATAFORMA_USER, PLATAFORMA_PASS, PLATAFORMA_AUTH_SECRET.
 */
const AREA: AreaProtegida = {
  prefixo: "/plataforma/app",
  cookie: "plataforma_auth",
  destinoPadrao: "/plataforma/app/onboarding",
  vars: ["PLATAFORMA_USER", "PLATAFORMA_PASS", "PLATAFORMA_AUTH_SECRET"],
  duracao: 60 * 60 * 12, // 12 horas
};

export interface LoginResult {
  success: boolean;
  error?: string;
}

export async function loginPlataforma(formData: FormData): Promise<LoginResult> {
  const r = await autenticarArea(formData, AREA);
  if (!r.ok) return { success: false, error: r.erro };
  redirect(r.destino!);
}

export async function logoutPlataforma(): Promise<void> {
  const jar = await cookies();
  jar.delete(AREA.cookie);
  redirect("/plataforma/login");
}
