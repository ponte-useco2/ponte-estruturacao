import { LinkMapa } from "./_componentes/LinkMapa";

/**
 * O "não encontrado" de dentro do Mapa: município, instrumento ou proposta que não existe nas fontes. Antes de
 * 06/10/2026 caía na página padrão do Next, em inglês e fora da moldura. Vale para o `notFound()` das páginas
 * do Mapa; endereço que não corresponde a rota nenhuma segue na página do site.
 *
 * B12 (onda 2 de UX, 08/10/2026): diz o que pode ter acontecido, caso a caso, e oferece a busca e as janelas como
 * botões. O texto não acusa ninguém: o item pode ter saído da fonte sem erro de quem digitou.
 */
export default function NaoEncontradoNoMapa() {
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">Não encontrado</p>
        <h1 className="pa-titulo">Este endereço não leva a nada nas fontes do Mapa</h1>
        <p>O que pode ter acontecido:</p>
        <ul className="pa-pilha">
          <li>O número ou o código no endereço está incompleto ou trocado (um dígito a menos ao copiar e colar, por exemplo).</li>
          <li>O convênio, a proposta ou a entidade saiu das fontes oficiais, ou ainda não entrou na última atualização diária dos dados.</li>
          <li>
            O município é de fora da Paraíba: a página em abas cobre a Paraíba; para as outras UFs há a página de investimentos
            federais, que a busca abre pelo nome do município.
          </li>
        </ul>
        <p className="pa-linha">
          <LinkMapa href="/mapa/busca" className="pa-btn pa-btn-pequeno">
            Procurar na busca
          </LinkMapa>
          <LinkMapa href="/mapa" className="pa-btn pa-btn-pequeno">
            Ver as janelas
          </LinkMapa>
        </p>
      </div>
    </div>
  );
}
