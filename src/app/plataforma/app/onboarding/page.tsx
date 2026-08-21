import { Suspense } from "react";
import { OnboardingClient } from "./OnboardingClient";

export default function OnboardingPage() {
  // useSearchParams exige boundary de Suspense na renderização estática.
  return (
    <Suspense fallback={null}>
      <OnboardingClient />
    </Suspense>
  );
}
