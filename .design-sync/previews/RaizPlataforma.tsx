import { RaizPlataforma, Tag, Barra, Nota, Rotulo } from "ponte-app";

/** Toda tela começa na raiz: ela define os tokens --pa-* e a tipografia. */
export const CartaoDeProjeto = () => (
  <RaizPlataforma>
    <div style={{ padding: "1.5rem", maxWidth: 560 }}>
      <article className="pa-cartao">
        <div className="pa-linha">
          <Tag tom="forte">PJF-0027</Tag>
          <Tag>EM COMPOSIÇÃO</Tag>
        </div>
        <h3>Recuperação Hídrica, Drenagem e Gestão Integrada de Resíduos</h3>
        <Rotulo>Composição do projeto · 60%</Rotulo>
        <Barra valor={60} rotulo="Composição do PJF-0027" />
        <Nota>Dados de projeto ilustrativos, como no protótipo do app.</Nota>
      </article>
    </div>
  </RaizPlataforma>
);
