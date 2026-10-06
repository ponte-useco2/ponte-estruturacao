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
 * O valor devolvido é o mesmo objeto para todos: quem chama não pode alterá-lo.
 */
export interface Memoria<T> {
  obter(chave: string, carregar: () => Promise<T>): Promise<T>;
  tamanho(): number;
}

export function criarMemoria<T>(opcoes: {
  validadeMs: number;
  maximo: number;
  guardar?: (valor: T) => boolean;
  agora?: () => number;
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

      const leitura = carregar()
        .then((valor) => {
          if (!opcoes.guardar || opcoes.guardar(valor)) {
            guardados.set(chave, { valor, ate: agora() + opcoes.validadeMs });
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
