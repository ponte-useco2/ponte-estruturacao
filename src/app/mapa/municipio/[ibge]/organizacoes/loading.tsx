import { Esqueleto, EsqueletoChips, EsqueletoFormulario, EsqueletoTabela } from "../../../_componentes/Esqueleto";

/** Enquanto as organizações do município carregam (B10): a trilha, os chips de área, a busca por nome e a lista. */
export default function OrganizacoesCarregando() {
  return (
    <Esqueleto texto="Carregando as organizações do município…" trilha={4}>
      <EsqueletoChips n={8} />
      <EsqueletoFormulario />
      <EsqueletoTabela linhas={10} />
    </Esqueleto>
  );
}
