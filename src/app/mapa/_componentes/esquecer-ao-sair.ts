import { esquecerOrganizacaoAtiva } from "./sair";

/** Quanto a saída espera a ação que apaga o cookie antes de seguir sem ela. */
const LIMITE_DA_ESPERA = 3_000;

/**
 * O lado do navegador da saída (onda 8, C, 09/10/2026; privacidade): chama a ação que apaga o cookie da organização
 * ativa (`sair.ts`) sem deixar que ela segure a pessoa. A ação faz o Next desenhar de novo a página atual; sem sessão
 * isso é barato, mas, com a versão pública ligada numa rota aberta, a página pública é lida de novo. Passados 3 s, ou
 * com erro de rede, a saída segue: sem sessão, o cookie não abre nada, e o próximo "Sair" tenta de novo.
 *
 * Chamado DEPOIS do `signOut` pelas duas saídas: o "Sair" do menu do Mapa (`ContaMenu`) e o "Sair e entrar com outra
 * conta" da sala de espera (`oportunidades/aguardando/SairBotao`).
 */
export async function esquecerOrganizacaoAoSair(): Promise<void> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      esquecerOrganizacaoAtiva(),
      new Promise<void>((pronto) => {
        relogio = setTimeout(pronto, LIMITE_DA_ESPERA);
      }),
    ]);
  } catch {
    // A saída segue (ver acima).
  } finally {
    clearTimeout(relogio);
  }
}
