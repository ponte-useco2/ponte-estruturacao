# Contrato de dados — `oportunidades.json`

Versão **1.0**. Este é o único acoplamento entre o pipeline e o site.

## A fronteira, antes de tudo

**O site não fala com o Transferegov.** Nunca. O repositório de origem entrega
215 MB de CSV compactado que precisam de DuckDB para processar — isso não roda
no navegador nem deveria rodar no request de uma página.

```
pipeline (diário, fora do site)          site
──────────────────────────────           ────────────────────
baixa 3 CSV do repositório
processa em DuckDB
compara com o estado de ontem
publica  oportunidades.json    ────────► fetch + render
                                          filtra no cliente
```

O site **lê um JSON estático de 60 KB** e renderiza. Sem backend, sem banco,
sem chave de API. Se o agente do site propuser consultar o repositório
diretamente, está errado: recuse.

## Onde o JSON fica

Duas decisões que **você precisa preencher antes de enviar** ao agente do site:

| decisão | opções | recomendação |
|---|---|---|
| Onde publicar o JSON | mesmo domínio (`/dados/oportunidades.json`), bucket S3/R2, ou GitHub Pages | **mesmo domínio** — elimina CORS por completo |
| Quem publica | GitHub Action diária, cron no servidor, ou upload manual | GitHub Action: o pipeline é um script Python sem dependência de infra |

Se ficar em outro domínio, o servidor precisa mandar
`Access-Control-Allow-Origin` para o domínio do site.

## Cabeçalhos esperados

```
Content-Type: application/json; charset=utf-8
Cache-Control: public, max-age=1800
ETag: "<hash do arquivo>"
```

`max-age` de 30 minutos: o dado muda no máximo uma vez por dia, e meia hora de
cache evita rajada sem atrasar percepção.

## Estrutura

```jsonc
{
  "versao": "1.0",                  // quebra de contrato incrementa o major
  "gerado_em": "2026-08-14T14:29:49.123456",
  "uf": "PB",

  "origem": {
    "repositorio": "https://repositorio.dados.gov.br/seges/detru/",
    "modulo": "Transferências Discricionárias (SICONV)",
    "atualizada_em": "2026-07-17T12:15:56+00:00",
    "defasagem_dias": 28,
    "defasada": true                // ⚠ se true, o site É OBRIGADO a avisar
  },

  "resumo": {                       // já calculado; não recontar no front
    "abertas": 97, "urgentes": 6, "aderentes": 35,
    "novas": 0, "propostas_recentes": 0, "encerradas": 0
  },

  "filtros": {                      // eixos prontos, ordenados por frequência
    "naturezas": ["Administração Pública Estadual ou do Distrito Federal", "..."],
    "canais": ["emenda", "proposta"],
    "orgaos": ["MINISTERIO DA CULTURA", "..."]
  },

  "oportunidades": [ { /* ver abaixo */ } ],
  "propostas_recentes": [ { /* ver abaixo */ } ],
  "encerradas": ["3000020260025"]   // códigos que fecharam desde a última rodada
}
```

### `oportunidades[]`

| campo | tipo | observação |
|---|---|---|
| `id` | string(12) | **estável entre execuções**. Use como `key` de lista e como âncora de deep link (`#op-4ea5cbcdc848`). |
| `programa` | string | pode passar de 120 caracteres — ver truncamento |
| `orgao` | string | vem em CAIXA ALTA da origem; **não corrigir**, é o nome oficial |
| `natureza` | string | quem pode se candidatar. Eixo primário de filtro |
| `canal` | `"proposta"` \| `"emenda"` | duas janelas distintas — ver nota |
| `modalidade` | string | CONVENIO, TERMO DE FOMENTO, TERMO DE COMPROMISSO… |
| `situacao` | string | `DISPONIBILIZADO` ou `CADASTRADO` |
| `abre` / `fecha` | `YYYY-MM-DD` | **exibir como DD/MM/AAAA** |
| `dias_restantes` | int ≥ 0 | calculado no pipeline, na data de geração |
| `urgente` | bool | `dias_restantes <= 15`. **Não recalcular no front** |
| `nova` | bool | apareceu desde a rodada anterior |
| `aderente` | bool | casou com os temas da carteira |
| `temas` | string[] | pode ser vazio |
| `codigos` | string[] | 1 a ~20. Com mais de um, mostre "N códigos" |
| `propostas_recebidas` | int | leitura de concorrência |

### `propostas_recentes[]`

`data`, `programa`, `proponente`, `municipio`, `uf`, `natureza`, `situacao`,
`valor_global` (number, reais), `objeto` (string, já truncado em 120),
`mesma_uf` (bool — concorrência direta, destacar).

Esta lista pode vir **vazia** e isso é normal: só se popula quando existe
rodada anterior para comparar.

## Duas janelas, não uma

`canal` não é decoração. `proposta` é o prazo de recebimento geral; `emenda` é o
prazo específico de emenda parlamentar. **Não coincidem**, e o mesmo programa
pode aparecer duas vezes, com prazos diferentes, uma linha por canal. Isso é
correto — não deduplique por nome.

## Regras que o front não pode reinterpretar

1. **`origem.defasada === true` obriga a exibir o aviso.** O repositório promete
   extração diária e frequentemente não cumpre. Sem o aviso, o usuário lê
   "nenhuma novidade" como "nada aconteceu", quando pode ser "ninguém coletou".
   Isto não é um detalhe de UI: é a diferença entre calmaria e cegueira.
2. **Não recalcular `urgente`, `dias_restantes` nem os totais de `resumo`.**
   Foram calculados na geração; recalcular no cliente com `new Date()` produz
   divergência de fuso e números que não batem com a notificação por push.
3. **Não deduplicar por `programa`.** Ver a nota sobre canais.
4. **Não ordenar por relevância própria.** O array já vem ordenado por
   `dias_restantes` e depois por nome. Ordenação alternativa só se o usuário
   pedir explicitamente, via controle visível.

## Versionamento

`versao` segue semver reduzido. Mudança de major (`2.0`) significa contrato
incompatível — o front deve exibir "formato de dados não suportado" em vez de
tentar renderizar. Campos novos podem entrar em minor sem aviso, então o front
deve ignorar chaves que não conhece.
