import { Suspense } from "react";
import { ComporClient } from "./ComporClient";

export default function ComporPage() {
  return (
    <Suspense fallback={null}>
      <ComporClient />
    </Suspense>
  );
}
