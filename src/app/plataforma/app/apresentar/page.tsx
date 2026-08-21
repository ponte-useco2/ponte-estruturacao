import { Suspense } from "react";
import { ApresentarClient } from "./ApresentarClient";

export default function ApresentarPage() {
  return (
    <Suspense fallback={null}>
      <ApresentarClient />
    </Suspense>
  );
}
