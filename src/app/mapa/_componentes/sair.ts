"use server";

import { cookies } from "next/headers";
import { COOKIE_ORG } from "@/lib/oportunidades/organizacao.server";

/**
 * O cookie da organização ativa (`mapa_org`) sai junto com a sessão (onda 8, C, 09/10/2026; sobra da revisão da
 * política de privacidade, E da onda 7, seção 4.3, item 2). Antes, o `signOut` derrubava só os cookies de sessão do
 * Supabase, e o `mapa_org` ficava no navegador por até um ano. Sem sessão ele não abre nada, mas dizia a quem usasse o
 * mesmo navegador qual organização a pessoa tinha escolhido por último.
 *
 * Ação do servidor porque o cookie é `httpOnly` (`conta/organizacao/acoes.ts`): o JavaScript da página não o alcança.
 * Apagar exige o mesmo caminho com que foi gravado, `/` (o padrão do Next). É endpoint público, como toda ação: não
 * confere sessão porque só apaga o cookie de quem a chama, e não lê nem devolve nada.
 *
 * Quem chama: as duas saídas da conta, o "Sair" do menu do Mapa (`ContaMenu`) e o "Sair e entrar com outra conta" da
 * sala de espera (`oportunidades/aguardando/SairBotao`), pelo `esquecerOrganizacaoAoSair` (esquecer-ao-sair.ts), que
 * não deixa a ação segurar a saída. As duas chamam DEPOIS do `signOut`: apagar cookie numa ação faz o Next desenhar de
 * novo a página atual, e sem sessão o layout do Mapa só redireciona, sem ler o banco. Antes do `signOut`, a página
 * inteira seria lida de novo só para a pessoa sair.
 */
export async function esquecerOrganizacaoAtiva(): Promise<void> {
  (await cookies()).delete({ name: COOKIE_ORG, path: "/" });
}
