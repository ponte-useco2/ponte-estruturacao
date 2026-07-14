import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { Loader2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acesso restrito · ConectaImpact GO",
  robots: { index: false, follow: false },
};

export default function ConectaImpactLoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#F6F5F0" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#0E7A5F",
            }}
          >
            Acesso restrito
          </div>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#21281F",
              marginTop: 8,
            }}
          >
            ConectaImpact GO
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#5A6259",
              marginTop: 8,
              fontFamily: "'Instrument Sans', sans-serif",
            }}
          >
            Painel operacional privado · D0–D365
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
