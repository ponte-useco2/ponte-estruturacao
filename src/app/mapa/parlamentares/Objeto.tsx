import { resumir } from "@/lib/oportunidades/assembleia-tela";

/**
 * O objeto da emenda na célula (D1 A50, 12/11/2026; WCAG 1.4.13 e 2.1.1): o resumo à vista e o texto inteiro num
 * `details`, que abre pelo teclado, pelo toque e pelo leitor de tela. Antes o inteiro só existia no `title`, que é só do
 * mouse. Quando o resumo já é o texto inteiro, sai só ele. O CSV leva o inteiro, como antes.
 */
export function Objeto({ texto }: { texto: string | null | undefined }) {
  const inteiro = (texto ?? "").replace(/\s+/g, " ").trim();
  const curto = resumir(inteiro);
  if (!inteiro || curto === inteiro) return <>{curto}</>;
  return (
    <details className="mp-objeto">
      <summary>
        {curto}
        <span className="pa-sr"> (abrir o objeto inteiro)</span>
      </summary>
      <p>{inteiro}</p>
    </details>
  );
}
