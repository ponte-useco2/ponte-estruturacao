import { Barra, Rotulo } from "ponte-app";

/** Aderência de uma chamada ao projeto, como em Compor. */
export const Aderencia = () => (
  <div style={{ display: "grid", gap: "0.5rem", maxWidth: 360 }}>
    <Rotulo>Aderência à CP-014 · 82%</Rotulo>
    <Barra valor={82} rotulo="Aderência à CP-014" />
  </div>
);

/** Três leituras de progresso: início, meio e completo. */
export const Faixas = () => (
  <div style={{ display: "grid", gap: "0.9rem", maxWidth: 360 }}>
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <Rotulo>Diagnóstico técnico · 20%</Rotulo>
      <Barra valor={20} rotulo="Progresso da entrega E-01" />
    </div>
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <Rotulo>Composição do PJF-0027 · 60%</Rotulo>
      <Barra valor={60} rotulo="Composição do PJF-0027" />
    </div>
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <Rotulo>Completude do cadastro · 100%</Rotulo>
      <Barra valor={100} rotulo="Completude do cadastro" />
    </div>
  </div>
);
