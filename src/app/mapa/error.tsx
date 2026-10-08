"use client";

/**
 * O erro de dentro do Mapa (B12, onda 2 de UX, 08/10/2026; achado H14 da auditoria B1+B2). Antes não havia: uma exceção
 * numa página do Mapa caía na página de erro padrão do Next, em inglês e fora da moldura. Este arquivo envolve as
 * páginas do `/mapa` e fica DENTRO do layout, então o cabeçalho, o menu e o rodapé continuam à vista; erro no próprio
 * layout (o portão de login) não passa por aqui.
 *
 * Nunca mostra a mensagem técnica: em produção o Next já a troca por um texto genérico nos erros do servidor, e a dos
 * erros do navegador pode trazer dado. Fica só o código (`digest`), que liga a tela ao registro do servidor.
 *
 * "Tentar de novo" usa o `retry()` do Next 16 (lê de novo do servidor e redesenha); o `reset()` sozinho só redesenha,
 * e o erro de leitura voltaria igual. Sem o `retry`, cai no `reset()`.
 */
import { useEffect, useRef } from "react";
import { LinkMapa } from "./_componentes/LinkMapa";

export default function ErroNoMapa({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);

  // O conteúdo trocou sem navegação: o foco vai para o título, e o leitor de tela lê o que aconteceu.
  useEffect(() => {
    titulo.current?.focus();
  }, [error]);

  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">Algo deu errado</p>
        <h1 className="pa-titulo" tabIndex={-1} ref={titulo}>
          Esta página não abriu
        </h1>
        <p>
          Houve uma falha ao montar a página. Costuma ser passageira: tente de novo. Se continuar, procure o item pela busca ou
          volte às janelas abertas.
        </p>
        <p className="pa-linha">
          <button type="button" className="pa-btn pa-btn-pequeno" onClick={() => (retry ?? reset)()}>
            Tentar de novo
          </button>
          <LinkMapa href="/mapa/busca" className="pa-btn pa-btn-pequeno">
            Procurar na busca
          </LinkMapa>
          <LinkMapa href="/mapa" className="pa-btn pa-btn-pequeno">
            Ver as janelas
          </LinkMapa>
        </p>
        {error.digest && <p className="pa-nota">Se escrever à PONTE sobre esta falha, informe o código {error.digest}.</p>}
      </div>
    </div>
  );
}
