import { Esqueleto, EsqueletoCartoes, EsqueletoTabela } from "../../../_componentes/Esqueleto";

/** Enquanto a ficha do deputado carrega (D1 A69, 12/11/2026; antes herdava o esqueleto da lista da Assembleia). */
export default function DeputadoCarregando() {
  return (
    <Esqueleto texto="Carregando as emendas do deputado…" linhas={2} acoes={2} aviso>
      <EsqueletoCartoes n={4} />
      <EsqueletoTabela linhas={5} />
      <EsqueletoTabela linhas={8} />
    </Esqueleto>
  );
}
