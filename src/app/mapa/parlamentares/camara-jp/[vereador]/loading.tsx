import { Esqueleto, EsqueletoCartoes, EsqueletoTabela } from "../../../_componentes/Esqueleto";

/** Enquanto a ficha do vereador carrega (D1 A69, 12/11/2026; antes herdava o esqueleto da lista da Câmara). */
export default function VereadorJpCarregando() {
  return (
    <Esqueleto texto="Carregando as emendas do vereador…" linhas={2} acoes={2} aviso>
      <EsqueletoCartoes n={4} />
      <EsqueletoTabela linhas={4} />
      <EsqueletoTabela linhas={8} />
    </Esqueleto>
  );
}
