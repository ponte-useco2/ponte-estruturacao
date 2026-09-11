import { Rotulo, Tag } from "ponte-app";

/** Metadado em fonte mono: datas, contagens, origem do dado. */
export const Metadado = () => <Rotulo>Fecha em 14/09/2026 · 12 propostas enviadas</Rotulo>;

/** Rótulo antes de um identificador. */
export const AntesDeTag = () => (
  <div className="pa-linha">
    <Rotulo>Projeto</Rotulo>
    <Tag tom="forte">PJF-0027</Tag>
  </div>
);
