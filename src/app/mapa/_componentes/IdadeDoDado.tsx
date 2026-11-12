/**
 * A data do dado e, quando passou do limiar da fonte, a etiqueta "Dado antigo" (D1 A02/A06, lote 4, 10/11/2026).
 * Sem hooks: serve a componentes de servidor e de cliente. A regra está em `idade-dado.ts`.
 */
import { formatarData } from "@/lib/oportunidades/central";
import { causaDoAtraso, diaDaLeitura, idadeDoDado, textoIdade } from "@/lib/oportunidades/idade-dado";
import { Tag } from "../../_design/primitivos";

export function IdadeDoDado({
  rotulo,
  data,
  hoje,
  limiarHoras,
  explicacao,
  lidoEm,
}: {
  /** "dados do Transferegov de", "catálogo gerado em". */
  rotulo: string;
  data: string | null | undefined;
  hoje: string;
  limiarHoras: number;
  /** O que pode ter acontecido sem aparecer aqui; só sai quando o dado é antigo. */
  explicacao: string;
  /**
   * Quando o nosso job leu a fonte pela última vez (12/11/2026). Com ela, o dado antigo diz de quem é o atraso: da
   * fonte, que não publicou nada novo, ou da nossa leitura, que parou. Sem ela, o texto fica como antes.
   */
  lidoEm?: string | null;
}) {
  const i = idadeDoDado(data, hoje, limiarHoras);
  if (i.estado === "desconhecido") return <span>{rotulo} data desconhecida</span>;
  const quando = formatarData((data as string).slice(0, 10));
  if (i.estado === "fresco") return <span>{`${rotulo} ${quando}`}</span>;
  const causa = causaDoAtraso(data, lidoEm, hoje, limiarHoras);
  const leitura = diaDaLeitura(lidoEm);
  const quem =
    causa === "fonte"
      ? ` A fonte não publicou dado novo desde então: a nossa leitura mais recente, em ${leitura}, trouxe o mesmo dado.`
      : causa === "leitura"
        ? ` A nossa leitura está parada desde ${leitura}.`
        : "";
  return (
    <span className="mp-idade-antigo">
      <Tag tom="proto">Dado antigo</Tag>{" "}
      <span>
        {rotulo} {quando}, {textoIdade(i)}.{quem} {explicacao}
      </span>
    </span>
  );
}
