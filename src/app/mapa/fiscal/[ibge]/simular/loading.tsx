import { Esqueleto, EsqueletoCartoes, EsqueletoFormulario, EsqueletoSecoes } from "../../../_componentes/Esqueleto";

/**
 * Enquanto o simulador carrega (D1 A11, 09/11/2026): com a rota aberta ao cliente da prefeitura, a página ganha o
 * esqueleto que as páginas de nível têm — a base fiscal em cartões, o formulário e o resultado em seções.
 */
export default function SimuladorCarregando() {
  return (
    <Esqueleto texto="Carregando o simulador…" linhas={2} aviso>
      <EsqueletoCartoes />
      <EsqueletoFormulario filtros={3} />
      <EsqueletoSecoes n={2} />
    </Esqueleto>
  );
}
