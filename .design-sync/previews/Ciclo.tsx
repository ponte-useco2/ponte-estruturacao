import { Ciclo } from "ponte-app";

/** Ainda no problema: nenhuma etapa vencida além da primeira. */
export const NoProblema = () => <Ciclo ate={0} />;

/** Projeto desenhado, buscando financiamento. */
export const EmProjeto = () => <Ciclo ate={1} />;

/** Em execução. */
export const EmExecucao = () => <Ciclo ate={3} />;

/** Ciclo completo, com resultado medido. */
export const Completo = () => <Ciclo ate={5} />;
