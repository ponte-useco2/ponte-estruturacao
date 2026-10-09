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
 * Falta com validade curta (onda 8, B, 09/10/2026; R2 de 09/10, §4.2 ressalva 2 e §5.1 item 6): com `falta`, a leitura
 * que `guardar` recusa porque uma fonte veio fora do ar (`falta.e`) fica `falta.validadeMs` (60 s) nesta instância, e não
 * zero. Antes, com uma fonte lenta ou fora do ar, cada visita seguinte relia o pacote inteiro (o município completo, ~50
 * pedidos), e a falta se multiplicava justamente no pico. A falta nunca sobe ao cache compartilhado: lá vale a regra
 * `guardavel` da camada, que a recusa; ela só entra no `Map` desta instância. Erro, "não ativado" e o que `falta.e` não
 * reconhece continuam fora, como antes, e a validade da falta nunca passa a da leitura inteira.
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
  /** A falta com validade curta (onda 8, B): o que `guardar` recusa e `e` reconhece fica `validadeMs`, só aqui. */
  falta?: { validadeMs: number; e: (valor: T) => boolean };
}): Memoria<T> {
  const agora = opcoes.agora ?? Date.now;
  const guardados = new Map<string, { valor: T; ate: number }>();
  const aCaminho = new Map<string, Promise<T>>();

  /** Quanto o valor fica: a validade toda se é a leitura inteira; a curta se é falta (onda 8, B); senão, nada. */
  const validadeDe = (valor: T): number => {
    if (!opcoes.guardar || opcoes.guardar(valor)) return opcoes.validadeMs;
    if (opcoes.falta?.e(valor)) return Math.min(opcoes.falta.validadeMs, opcoes.validadeMs);
    return 0;
  };

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
          const validade = validadeDe(valor);
          // `desde` no futuro (relógio de outra instância adiantado) conta como agora: nunca mais que a validade.
          const ate = Math.min(desde, agora()) + validade;
          // Vencido já ao chegar (veio velho do cache): volta ao chamador e não fica.
          if (validade > 0 && ate > agora()) {
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

// ================================================================ uma leitura por versão (onda 8, B)

/**
 * Uma leitura guardada pela versão do que foi lido (onda 8, B, 09/10/2026; R2 de 09/10, §2.2 e §5.5 item 7). Nasceu
 * para o catálogo das janelas (`catalogo.server.ts`): cada pedido relia e interpretava os dois JSON (692 kB e 362 kB),
 * e a página do município, a das janelas e o diagnóstico faziam isso a cada visita. Agora o arquivo é interpretado uma
 * vez por instância e por versão (a data e o tamanho do arquivo): versão nova, leitura nova.
 *
 * - Fica só a última versão: a anterior sai quando a nova é pedida.
 * - Dois pedidos da mesma versão ao mesmo tempo dividem uma leitura só.
 * - O que `guardar` recusa (arquivo ilegível, fora do contrato) e o que lança voltam ao chamador e não ficam: a próxima
 *   chamada lê de novo, como antes.
 *
 * O valor devolvido é o mesmo objeto para todos: quem chama não pode alterá-lo (`memoria.test.ts` passa o catálogo
 * congelado pelas funções que o leem).
 */
export interface PorVersao<T> {
  obter(versao: string, carregar: () => Promise<T>): Promise<T>;
}

export function criarPorVersao<T>(guardar: (valor: T) => boolean = () => true): PorVersao<T> {
  let atual: { versao: string; leitura: Promise<T> } | null = null;
  return {
    obter(versao, carregar) {
      if (atual && atual.versao === versao) return atual.leitura;
      // Só desfaz a si mesma: se outra versão já entrou no lugar, ela fica.
      const largar = () => {
        if (atual?.leitura === leitura) atual = null;
      };
      const leitura: Promise<T> = carregar().then(
        (valor) => {
          if (!guardar(valor)) largar();
          return valor;
        },
        (erro: unknown) => {
          largar();
          throw erro;
        },
      );
      atual = { versao, leitura };
      return leitura;
    },
  };
}
