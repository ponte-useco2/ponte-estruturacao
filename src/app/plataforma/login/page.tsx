import { redirect } from "next/navigation";

/**
 * O login por usuário e senha desta área foi substituído por conta Google,
 * com a mesma lista de acesso da /oportunidades.
 *
 * A rota permanece como redirecionamento em vez de sumir: ela chegou a ser
 * divulgada, e um 404 faria quem tem o link antigo achar que a plataforma saiu
 * do ar. Aqui ele cai na porta certa e volta para onde queria ir.
 *
 * Os arquivos actions.ts e LoginForm.tsx deste diretório ficaram sem uso e
 * podem ser removidos — foram deixados fora deste commit para a mudança de
 * mecanismo aparecer sozinha no diff.
 */
export default function PlataformaLoginPage() {
  redirect("/oportunidades/entrar?next=/plataforma/app");
}
