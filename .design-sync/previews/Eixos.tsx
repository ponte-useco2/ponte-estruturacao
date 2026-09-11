import { Eixos } from "ponte-app";

/** Projeto que atravessa os três eixos de transformação. */
export const TresEixos = () => <Eixos eixos={["ambiental", "economico", "social"]} />;

/** Projeto de um eixo só. */
export const UmEixo = () => <Eixos eixos={["economico"]} />;
