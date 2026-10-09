/**
 * O cache de dados compartilhado entre as instâncias (onda 7, A, 09/10/2026) — só servidor. Liga a camada pura de
 * `cache-dados.ts` ao `unstable_cache` do Next, que na Vercel guarda no Runtime Cache da região (as funções rodam todas
 * em `iad1`). O projeto não usa `cacheComponents` nem `"use cache"`: o `unstable_cache` é o cache de dados do modelo
 * anterior, e funciona com o `force-dynamic` do layout do `/mapa` (o `force-dynamic` muda o padrão do `fetch`, não o
 * `unstable_cache`).
 *
 * Quem usa: os leitores de `relatorio-municipio.server.ts` (município, entidade e "quem recebe"), `pagina-brasil`,
 * `pagina-uf` (só a leitura de quem não é administrador), `busca.server.ts` (os proponentes da PB) e `osc.server.ts`.
 * Cada um passa a camada à sua `criarMemoria`, que continua na frente. Só leituras com a chave de serviço, sem cookie:
 * a função que vai para o cache não pode chamar `cookies()`, `headers()` nem `visitanteAtual()` (o Next recusa
 * `cookies()` lá dentro, o que é uma trava a mais).
 *
 * Para limpar tudo de uma vez (por exemplo, ao fim da rodada do painel): `revalidateTag("mapa-dados", "max")` numa rota
 * protegida, ou "Purge Data Cache" no painel da Vercel. Sem isso, a validade de 10 minutos faz o resto.
 */
import { unstable_cache } from "next/cache";
import { criarCamadaCompartilhada, implantacaoDe } from "./cache-dados";
import type { CamadaCompartilhada } from "./memoria";

/** A camada de um leitor. `guardavel` é a regra do que vai ao cache comum; o resto, como em `criarCamadaCompartilhada`. */
export function camadaDoCacheDeDados<T>(o: {
  leitor: string;
  guardavel: (valor: T) => boolean;
  paraGuardar?: (valor: T) => unknown;
  doGuardado?: (guardado: unknown) => T;
}): CamadaCompartilhada<T> {
  return criarCamadaCompartilhada<T>({
    ...o,
    cachear: (ler, partes, opcoes) => unstable_cache(ler, partes, opcoes),
    implantacao: implantacaoDe(process.env),
  });
}
