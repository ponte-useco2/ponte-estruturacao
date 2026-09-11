# Plataforma PONTE — como desenhar com este design system

App logado da PONTE, com a interface em português do Brasil. O estilo vem de **classes CSS `pa-*` e tokens `var(--pa-*)`**.
Não há utilitários Tailwind nem props de estilo: componha com as classes abaixo e com os 7 componentes.

## Raiz obrigatória

Toda tela fica dentro de `RaizPlataforma`, que renderiza `div.pa-root`. É ela que define os tokens `--pa-*`, a fonte
do corpo e o fundo. Fora dela nenhum `var(--pa-*)` resolve e a tela sai sem cor. Use uma raiz só por tela.

```jsx
const { RaizPlataforma, Tag, Barra, Nota, Rotulo } = window.PlataformaPonte;

<RaizPlataforma>
  <article className="pa-cartao">
    <div className="pa-linha">
      <Tag tom="forte">PJF-0027</Tag>
      <Tag>EM COMPOSIÇÃO</Tag>
    </div>
    <h3>Recuperação Hídrica, Drenagem e Gestão Integrada de Resíduos</h3>
    <Rotulo>Composição do projeto · 60%</Rotulo>
    <Barra valor={60} rotulo="Composição do PJF-0027" />
    <Nota>Dados de projeto ilustrativos.</Nota>
  </article>
</RaizPlataforma>
```

## Tokens — sempre `var(--pa-*)`, nunca cor em hex

- Superfícies: `--pa-bg`, `--pa-surface`, `--pa-surface-2`, `--pa-dark`, `--pa-dark-surface`
- Texto e traço: `--pa-text`, `--pa-muted`, `--pa-border`
- Marca: `--pa-brand`, `--pa-brand-2`, `--pa-brand-soft`
- Eixos: `--pa-environmental`, `--pa-economic`, `--pa-social`
- Estado: `--pa-danger` — só para prazo correndo
- Fontes: `--pa-font` (Inter, corpo), `--pa-display` (Plus Jakarta Sans; `h1`–`h4` já usam), `--pa-mono`
- Forma e ritmo: `--pa-r`, `--pa-r-lg`, `--pa-max`, `--pa-top`, `--pa-abas`, `--pa-top-total`

## Classes

| Família | Classes |
|---|---|
| Moldura do app | `pa-top`, `pa-top-inner`, `pa-marca`, `pa-marca-selo`, `pa-marca-nome`, `pa-abas`, `pa-aba`, `pa-aba-num`, `pa-main`, `pa-bottom`, `pa-bottom-num` |
| Página e layout | `pa-pagina`, `pa-pagina-cabeca`, `pa-pagina-estreita`, `pa-kicker`, `pa-titulo`, `pa-sub`, `pa-grade`, `pa-grade-2`, `pa-grade-3`, `pa-grade-4`, `pa-pilha`, `pa-linha`, `pa-espaco` |
| Cartões | `pa-cartao`, `pa-cartao-plano`, `pa-cartao-titulo`, `pa-cartao-link`, `pa-escuro` |
| Oportunidade | `pa-oportunidade`, `pa-oportunidade-corpo`, `pa-oportunidade-titulo`, `pa-oportunidade-detalhe`, `pa-oportunidade-lado`, `pa-origem` |
| Controles | `pa-btn`, `pa-btn-primario`, `pa-btn-pequeno`, `pa-btn-bloco`, `pa-btn-perigo`, `pa-chips`, `pa-chip`, `pa-chip-contagem`, `pa-fieldset`, `pa-check`, `pa-campo`, `pa-campo-rotulo`, `pa-input`, `pa-select`, `pa-textarea` |
| Mapa de Oportunidades | `pa-mapa`, `pa-mapa-controles`, `pa-mapa-lote`, `pa-mapa-selecao`, `pa-mapa-desfazer`, `pa-mapa-nao-lida`, `pa-mapa-marca-nao-lida`, `pa-mapa-descricao`, `pa-mapa-vazio-titulo`, `pa-vazio` |
| Texto e apoio | `pa-mono`, `pa-nota`, `pa-ressalva`, `pa-sr` (só para leitor de tela), `pa-esconde-mobile` |

Antes de estilizar, leia `styles.css` e `_ds_bundle.css`: estão ali todas as classes `pa-*`, seus estados e as
quebras para celular. Cada componente tem exemplos no seu `.prompt.md`.

## Regras do produto

- A cor de perigo (`--pa-danger`, `Tag tom="urgente"`) marca só prazo correndo — nunca "não lida" nem erro genérico.
- Prazo sempre em data absoluta ("fecha em 14/09"), nunca só "em 3 dias".
- `Tag tom="forte"` é o identificador principal da tela; `aderente`, o que combina com as preferências da pessoa.
- Nenhum sucesso aparente: não mostre confirmação do que não aconteceu.
