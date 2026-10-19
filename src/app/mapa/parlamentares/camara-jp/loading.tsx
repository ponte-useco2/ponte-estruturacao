import { Esqueleto, EsqueletoCartoes, EsqueletoTabela } from "../../_componentes/Esqueleto";

/** Enquanto as emendas da Câmara de João Pessoa carregam (J2, 16/10/2026). */
export default function CamaraJpCarregando() {
  return (
    <Esqueleto texto="Carregando as emendas da Câmara de João Pessoa…" linhas={2} acoes={2} aviso>
      <EsqueletoCartoes n={4} />
      <EsqueletoTabela linhas={8} />
    </Esqueleto>
  );
}
