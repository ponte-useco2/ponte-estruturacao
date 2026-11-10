/**
 * A data do dado e, quando passou do limiar da fonte, a etiqueta "Dado antigo" (D1 A02/A06, lote 4, 10/11/2026).
 * Sem hooks: serve a componentes de servidor e de cliente. A regra está em `idade-dado.ts`.
 */
import { formatarData } from "@/lib/oportunidades/central";
import { idadeDoDado, textoIdade } from "@/lib/oportunidades/idade-dado";
import { Tag } from "../../_design/primitivos";

export function IdadeDoDado({
  rotulo,
  data,
  hoje,
  limiarHoras,
  explicacao,
}: {
  /** "dados do Transferegov de", "catálogo gerado em". */
  rotulo: string;
  data: string | null | undefined;
  hoje: string;
  limiarHoras: number;
  /** O que pode ter acontecido sem aparecer aqui; só sai quando o dado é antigo. */
  explicacao: string;
}) {
  const i = idadeDoDado(data, hoje, limiarHoras);
  if (i.estado === "desconhecido") return <span>{rotulo} data desconhecida</span>;
  const quando = formatarData((data as string).slice(0, 10));
  if (i.estado === "fresco") return <span>{`${rotulo} ${quando}`}</span>;
  return (
    <span className="mp-idade-antigo">
      <Tag tom="proto">Dado antigo</Tag>{" "}
      <span>
        {rotulo} {quando}, {textoIdade(i)}. {explicacao}
      </span>
    </span>
  );
}
