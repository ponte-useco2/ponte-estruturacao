/**
 * A página do explorador em camadas (C3a, 09/10/2026), componente de servidor: o cabeçalho (marcado "Protótipo"), a
 * trilha da descida e o palco com as camadas desenhadas. A trilha é a mesma `Trilha` das páginas de nível, com os elos
 * apontando para as camadas do explorador: é o caminho de volta pelo teclado e o lugar das camadas que já não estão
 * desenhadas (só as 3 mais fundas têm plano no palco).
 */
import {
  ROTULO_NIVEL,
  anuncioDaCamada,
  chaveDaCamada,
  elosDoExplorador,
  niveisDaPilha,
  niveisDesenhados,
  nomeDoNivel,
  urlDaVista,
  urlDoNivel,
  urlPai,
} from "@/lib/oportunidades/explorador";
import { Trilha } from "../_componentes/Trilha";
import { ConteudoDaCamada, nomesDaLeitura } from "./Camadas";
import type { LeiturasExplorador } from "./camadas.server";
import { Palco, type CamadaDoPalco } from "./Palco";
import "./explorador.css";

export function ExploradorConteudo({ l }: { l: LeiturasExplorador }) {
  const p = l.pilha;
  const nomes = nomesDaLeitura(l);
  const niveis = niveisDaPilha(p);
  const camadas: CamadaDoPalco[] = niveisDesenhados(p).map((nivel) => ({
    chave: chaveDaCamada(p, nivel),
    href: urlDoNivel(p, nivel),
    lombada: `${ROTULO_NIVEL[nivel]} · ${nomeDoNivel(p, nivel, nomes)}`,
    conteudo: <ConteudoDaCamada nivel={nivel} l={l} />,
  }));
  const pai = urlPai(p);

  return (
    <div className="pa-pagina mp-radar mp-exp">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-linha">
          <span className="pa-tag pa-tag-proto">Protótipo</span>
          <span className="pa-mono">Só administradores · fora do menu</span>
        </p>
        <h1 className="pa-titulo">Explorador em camadas</h1>
        <p className="pa-sub">
          Do Brasil ao instrumento, uma camada por vez. Cada camada leva à página completa do nível e ao relatório dele; a trilha volta a qualquer uma.
        </p>
        <Trilha elos={elosDoExplorador(p, nomes)} />
        {l.aviso && <p className="pa-cartao pa-cartao-plano">{l.aviso}</p>}
      </div>
      <Palco
        camadas={camadas}
        profundidade={niveis.length}
        anuncio={anuncioDaCamada(p, nomes)}
        pai={pai ? { href: pai, nome: nomeDoNivel(p, niveis[niveis.length - 2], nomes) } : null}
        vistaPedida={p.vista}
        urlPlana={urlDaVista(p, "plana")}
        urlCamadas={urlDaVista(p, "camadas")}
      />
    </div>
  );
}
