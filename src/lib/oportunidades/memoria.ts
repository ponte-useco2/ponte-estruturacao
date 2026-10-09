/**
 * Memória curta de leituras caras no servidor (06/10/2026). Nasceu para o relatório do município: cada troca de
 * aba relia ~19 fontes e levava ~3 s. Fica na memória da instância do servidor, nunca entre publicações nem
 * entre instâncias: uma publicação nova começa vazia e não serve objeto no formato antigo.
 *
 * - `validadeMs`: depois disso a chave é lida de novo.
 * - `maximo`: quantas chaves cabem; sai a usada há mais tempo.
 * - `guardar`: o que não deve ficar (erro, fonte fora do ar) volta ao chamador sem ser guardado.
 * - Dois pedidos da mesma chave ao mesmo tempo dividem uma leitura só.
 *
 * Segunda camada (onda 7, A, 09/10/2026): com `compartilhada`, a falta na memória vai primeiro ao cache comum a
 * todas as instâncias (`cache-dados.server.ts`), e só dele ao banco. A memória continua na frente, para não pagar a ida
 * ao cache duas vezes no mesmo servidor, e conta a validade de quando o valor foi lido do banco (`desde`), e não de
 * quando chegou a esta instância: um valor de 9 minutos no cache fica só mais 1 minuto aqui, e a frescura de ponta a
 * ponta continua a de 10 minutos.
 *
 * O valor devolvido é o mesmo objeto para todos: quem chama não pode alterá-lo.
 */
export interface Memoria<T> {
  obter(chave: string, carregar: () => Promise<T>): Promise<T>;
  tamanho(): number;
}

/** O cache comum às instâncias: devolve o valor e quando ele foi lido do banco (ms desde 1970, no relógio do servidor). */
export interface CamadaCompartilhada<T> {
  obter(chave: string, carregar: () => Promise<T>): Promise<{ valor: T; desde: number }>;
}

export function criarMemoria<T>(opcoes: {
  validadeMs: number;
  maximo: number;
  guardar?: (valor: T) => boolean;
  agora?: () => number;
  compartilhada?: CamadaCompartilhada<T>;
}): Memoria<T> {
  const agora = opcoes.agora ?? Date.now;
  const guardados = new Map<string, { valor: T; ate: number }>();
  const aCaminho = new Map<string, Promise<T>>();

  return {
    obter(chave, carregar) {
      const g = guardados.get(chave);
      if (g && g.ate > agora()) {
        // Reinserir põe a chave no fim: a ordem do Map é a ordem de uso.
        guardados.delete(chave);
        guardados.set(chave, g);
        return Promise.resolve(g.valor);
      }
      if (g) guardados.delete(chave);
      const pendente = aCaminho.get(chave);
      if (pendente) return pendente;

      const lida = opcoes.compartilhada ? opcoes.compartilhada.obter(chave, carregar) : carregar().then((valor) => ({ valor, desde: agora() }));
      const leitura = lida
        .then(({ valor, desde }) => {
          // `desde` no futuro (relógio de outra instância adiantado) conta como agora: nunca mais que a validade.
          const ate = Math.min(desde, agora()) + opcoes.validadeMs;
          // Vencido já ao chegar (veio velho do cache): volta ao chamador e não fica.
          if ((!opcoes.guardar || opcoes.guardar(valor)) && ate > agora()) {
            guardados.set(chave, { valor, ate });
            while (guardados.size > opcoes.maximo) {
              const maisAntiga = guardados.keys().next().value;
              if (maisAntiga === undefined) break;
              guardados.delete(maisAntiga);
            }
          }
          return valor;
        })
        .finally(() => aCaminho.delete(chave));
      aCaminho.set(chave, leitura);
      return leitura;
    },
    tamanho: () => guardados.size,
  };
}
