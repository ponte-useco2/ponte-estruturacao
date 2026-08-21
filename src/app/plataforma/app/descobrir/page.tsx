import { Suspense } from "react";
import { DescobrirClient } from "./DescobrirClient";
import { lerOportunidades } from "../_lib/oportunidades.server";

export const revalidate = 3600;

export default async function DescobrirPage() {
  const payload = await lerOportunidades();
  return (
    <Suspense fallback={null}>
      <DescobrirClient payload={payload} />
    </Suspense>
  );
}
