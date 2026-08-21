import { Suspense } from "react";
import { ConstruirClient } from "./ConstruirClient";

export default function ConstruirPage() {
  return (
    <Suspense fallback={null}>
      <ConstruirClient />
    </Suspense>
  );
}
