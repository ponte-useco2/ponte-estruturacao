import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROVEDORES_DO_ADMINISTRADOR, identidadeDeAdministrador, recusaDeAdministrador, type UsuarioDaSessao } from "./administrador.ts";

/** A conta como nasce pelo botão "Entrar com Google": é a de quem administra hoje. E-mail fictício. */
const GOOGLE: UsuarioDaSessao = {
  email: "Diretoria@Exemplo.org",
  email_confirmed_at: "2026-09-02T12:00:00.000000Z",
  app_metadata: { provider: "google", providers: ["google"] },
  identities: [{ provider: "google", identity_data: { email: "diretoria@exemplo.org", email_verified: true } }],
};

test("C6: a conta do Google com e-mail confirmado continua administrador", () => {
  assert.equal(recusaDeAdministrador(GOOGLE), null);
  assert.equal(identidadeDeAdministrador(GOOGLE), true);
  // Sem a lista de identidades na resposta, vale o `app_metadata`, que só a chave de serviço muda.
  assert.equal(identidadeDeAdministrador({ ...GOOGLE, identities: undefined }), true);
  assert.equal(identidadeDeAdministrador({ ...GOOGLE, app_metadata: { provider: "google" } }), true);
});

test("C6: e-mail e senha não fazem administrador, nem com o e-mail confirmado", () => {
  // Com a confirmação desligada, o Supabase já grava `email_confirmed_at` no cadastro.
  const senha: UsuarioDaSessao = {
    ...GOOGLE,
    app_metadata: { provider: "email", providers: ["email"] },
    identities: [{ provider: "email", identity_data: { email: "diretoria@exemplo.org" } }],
  };
  assert.equal(recusaDeAdministrador(senha), "a conta não nasceu pelo Google");
  // Cadastrada por senha antes e ligada ao Google depois: quem tem a senha entraria como o administrador.
  const ligada: UsuarioDaSessao = {
    ...senha,
    app_metadata: { provider: "email", providers: ["email", "google"] },
    identities: [...(senha.identities ?? []), ...(GOOGLE.identities ?? [])],
  };
  assert.equal(recusaDeAdministrador(ligada), "a conta não nasceu pelo Google");
  // Do Google, mas com outro provedor ou outra identidade ligada depois.
  assert.equal(recusaDeAdministrador({ ...GOOGLE, app_metadata: { provider: "google", providers: ["google", "email"] } }), "a conta tem outro provedor ligado");
  assert.equal(
    recusaDeAdministrador({ ...GOOGLE, identities: [...(GOOGLE.identities ?? []), { provider: "email", identity_data: {} }] }),
    "a conta tem outra identidade ligada",
  );
});

test("C6: sem e-mail confirmado, ou com o e-mail trocado depois do Google, não é administrador", () => {
  assert.equal(recusaDeAdministrador({ ...GOOGLE, email_confirmed_at: null }), "e-mail não confirmado");
  assert.equal(recusaDeAdministrador({ ...GOOGLE, email_confirmed_at: "não é data" }), "e-mail não confirmado");
  // Entrou com o próprio Google e trocou o e-mail da conta para o do administrador.
  assert.equal(
    recusaDeAdministrador({ ...GOOGLE, identities: [{ provider: "google", identity_data: { email: "outra.pessoa@exemplo.org" } }] }),
    "o e-mail da conta não é o da identidade do Google",
  );
  assert.equal(recusaDeAdministrador(null), "sem sessão");
  assert.equal(recusaDeAdministrador({ ...GOOGLE, email: "" }), "sem e-mail");
});

test("C6: só o Google reconhece administrador; outro provedor pede exceção explícita", () => {
  assert.deepEqual(PROVEDORES_DO_ADMINISTRADOR, ["google"]);
  const github: UsuarioDaSessao = {
    ...GOOGLE,
    app_metadata: { provider: "github", providers: ["github"] },
    identities: [{ provider: "github", identity_data: { email: "diretoria@exemplo.org" } }],
  };
  assert.equal(identidadeDeAdministrador(github), false);
});

test("C6: a única porta de entrada do site é o OAuth do Google", () => {
  // Prova por código de que a conta de quem administra nasceu pelo Google: nenhum outro jeito de entrar existe
  // no site. Se aparecer um (senha, link mágico, outro provedor), este teste falha e a regra acima tem de ser revista.
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const entradas: string[] = [];
  for (const rel of fs.readdirSync(raiz, { recursive: true }) as string[]) {
    if (!/\.(ts|tsx)$/.test(rel) || /\.test\.ts$/.test(rel)) continue;
    const fonte = fs.readFileSync(path.join(raiz, rel), "utf-8");
    for (const m of fonte.matchAll(/\.auth\.(signInWith\w+|signUp|verifyOtp|signInAnonymously|linkIdentity)\(/g)) {
      entradas.push(`${rel.split(path.sep).join("/")}: ${m[1]}`);
    }
  }
  assert.deepEqual(entradas, ["app/oportunidades/entrar/BotaoGoogle.tsx: signInWithOAuth"]);
  const botao = fs.readFileSync(path.join(raiz, "app", "oportunidades", "entrar", "BotaoGoogle.tsx"), "utf-8");
  assert.deepEqual([...botao.matchAll(/provider:\s*"(\w+)"/g)].map((m) => m[1]), ["google"]);
});
