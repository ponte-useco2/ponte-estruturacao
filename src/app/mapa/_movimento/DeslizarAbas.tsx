"use client";

/**
 * Deslizar entre as abas no celular (onda 16, M2; gestos). Só com toque (`pointer: coarse`): no computador, arrastar
 * com o mouse seleciona texto, como sempre. O conteúdo acompanha o dedo na horizontal com resistência (`dragElastic`) e
 * volta ao lugar; passou de 80 px (ou foi rápido), abre a aba vizinha. A rolagem vertical continua livre
 * (`dragDirectionLock`). O caminho sem gesto são as próprias abas, logo acima.
 */
import { m, type PanInfo } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { Movimento } from "./Movimento";

const TOQUE = "(pointer: coarse)";
const assinar = (f: () => void) => {
  const q = window.matchMedia(TOQUE);
  q.addEventListener("change", f);
  return () => q.removeEventListener("change", f);
};

export function DeslizarAbas({ anterior, proxima, children }: { anterior: string | null; proxima: string | null; children: ReactNode }) {
  const router = useRouter();
  const toque = useSyncExternalStore(
    assinar,
    () => window.matchMedia(TOQUE).matches,
    () => false,
  );
  if (!toque || (!anterior && !proxima)) return <>{children}</>;
  const soltou = (_: unknown, info: PanInfo) => {
    const longe = Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 500;
    if (!longe) return;
    if (info.offset.x < 0 && proxima) router.push(proxima, { scroll: false });
    if (info.offset.x > 0 && anterior) router.push(anterior, { scroll: false });
  };
  return (
    <Movimento recursos="completo">
      <m.div drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={0.18} onDragEnd={soltou}>
        {children}
      </m.div>
    </Movimento>
  );
}
