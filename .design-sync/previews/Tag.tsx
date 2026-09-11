import { Tag } from "ponte-app";

/** Tons de estado, como nas listas de oportunidades do app. */
export const TonsDeEstado = () => (
  <div className="pa-linha">
    <Tag tom="urgente">Urgente</Tag>
    <Tag tom="nova">Nova</Tag>
    <Tag tom="aderente">Aderente</Tag>
    <Tag tom="proto">Aviso de origem</Tag>
    <Tag>Turismo</Tag>
  </div>
);

/** O tom forte marca o identificador principal da tela; o neutro, metadados. */
export const Identificadores = () => (
  <div className="pa-linha">
    <Tag tom="forte">PJF-0027</Tag>
    <Tag>EM COMPOSIÇÃO</Tag>
    <Tag>E-01</Tag>
  </div>
);

/** Tons dos eixos de transformação. */
export const TonsDeEixo = () => (
  <div className="pa-linha">
    <Tag tom="ambiental">Ambiental</Tag>
    <Tag tom="economico">Econômico</Tag>
    <Tag tom="social">Social</Tag>
  </div>
);
