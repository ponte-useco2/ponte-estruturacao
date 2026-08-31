/**
 * Serialização das respostas para texto plano.
 *
 * É o entregável real da página: não há envio para servidor, então o que sai
 * daqui é o que a instituição cola no e-mail para a Ponte. Fica em módulo
 * próprio, sem React e sem DOM, porque é a única parte com regra de negócio de
 * verdade — e porque assim dá para conferir a saída sem abrir navegador.
 *
 * Diferença em relação ao protótipo: ele lia rótulo por rótulo do DOM e
 * despejava uma lista corrida de 95 linhas. Aqui as respostas vêm agrupadas
 * pelos mesmos dez blocos da tela, e blocos inteiramente vazios não aparecem —
 * quem recebe o e-mail lê na ordem do formulário, não num paredão.
 */

import { ENTRADAS } from "./campos";
import type { Respostas } from "./rascunho";

const CABECALHO = "FORMULÁRIO DE PERFIL INSTITUCIONAL — Ponte Estruturação de Projetos";

export function montarTexto(respostas: Respostas): string {
  const linhas: string[] = [CABECALHO];
  let blocoAtual = "";

  for (const entrada of ENTRADAS) {
    const valor = respostas[entrada.nome];

    if (entrada.chave === "marca") {
      if (valor !== true) continue;
    } else if (typeof valor !== "string" || valor.trim() === "") {
      continue;
    }

    // Título do bloco só quando ele tem ao menos uma resposta — daí ser
    // emitido aqui, na primeira que aparece, e não ao entrar no bloco.
    if (entrada.bloco !== blocoAtual) {
      blocoAtual = entrada.bloco;
      linhas.push("", blocoAtual.toLocaleUpperCase("pt-BR"));
    }

    linhas.push(
      `${entrada.rotulo}: ${entrada.chave === "marca" ? "sim" : (valor as string).trim()}`,
    );
  }

  return linhas.join("\n");
}
