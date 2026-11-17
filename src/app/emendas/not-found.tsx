import Link from "next/link";
import { Cabeca } from "./_componentes/Pecas";

/** Endereço do portal que não existe (código de emenda, autor ou município fora da base). Texto neutro. */
export default function NaoEncontrado() {
  return (
    <div className="pa-pilha-larga">
      <Cabeca elos={[{ rotulo: "Não encontrado" }]} kicker="Emendas federais na Paraíba" titulo="Não encontramos este endereço" />
      <div className="pa-cartao pa-pilha">
        <p>
          Não consta registro com este código na base publicada. O código da emenda tem 12 dígitos (ano, autor e número), o do autor tem 4 e
          o do município é o do IBGE.
        </p>
        <p className="pa-linha">
          <Link prefetch={false} className="pa-btn" href="/emendas/registros">
            Ver os registros
          </Link>
          <Link prefetch={false} className="pa-btn" href="/emendas">
            Início do portal
          </Link>
        </p>
      </div>
    </div>
  );
}
