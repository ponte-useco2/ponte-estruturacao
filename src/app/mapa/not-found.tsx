import { LinkMapa } from "./_componentes/LinkMapa";

/**
 * O "não encontrado" de dentro do Mapa: município, instrumento ou proposta que não existe nas fontes. Antes de
 * 06/10/2026 caía na página padrão do Next, em inglês e fora da moldura. Vale para o `notFound()` das páginas
 * do Mapa; endereço que não corresponde a rota nenhuma segue na página do site.
 */
export default function NaoEncontradoNoMapa() {
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">Não encontrado</p>
        <h1 className="pa-titulo">Este endereço não leva a nada nas fontes do Mapa</h1>
        <p>O código pode estar incompleto ou errado, ou o item pode ter saído das fontes oficiais.</p>
        <p className="pa-nota">
          <LinkMapa href="/mapa/busca">Procurar na busca</LinkMapa> · <LinkMapa href="/mapa">Voltar às janelas</LinkMapa>
        </p>
      </div>
    </div>
  );
}
