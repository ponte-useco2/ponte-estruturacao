# PONTE Projetos — Release v1.3 Institucional

## Status

**CONGELADA para apresentação executiva.**

A v1.3 foi construída a partir da v1.2 nativa e submetida a ciclos sucessivos de análise, implementação, renderização, regressão funcional e correção. O ciclo foi encerrado quando a rodada final não encontrou nova falha material de arquitetura, semântica, responsividade, acessibilidade ou comportamento dentro do escopo de uma apresentação executiva portátil.

## Mudanças estruturais

### 1. Explicação para leigos
A narrativa foi reorganizada para:

`Tese → Inversão → Como funciona em 60s → Três mercados → Ecossistema → PJF → Ambientes → P&D → Grafo → Escala → Ambição → Participação → Comunidade`

O visitante passa a compreender o mecanismo simples antes da abstração dos três mercados.

### 2. Identidade da plataforma
O Hero agora explicita que **PONTE Projetos é a infraestrutura digital da PONTE Estruturação de Projetos de Impacto** e resume sua função em linguagem não técnica.

### 3. Camada institucional
Foi criada a seção `#ecossistema`, distinguindo os papéis de:

- empresas e indústrias;
- territórios e poder público;
- ICTs públicas e privadas;
- OSCs, associações e cooperativas;
- federações, sindicatos e entidades patronais;
- capital e fomento.

Instituições de justiça, controle e accountability foram posicionadas em camada separada de transparência e rastreabilidade, sem serem apresentadas como validadores comerciais ou membros da coalizão econômica.

### 4. Núcleo de P&D empresarial
O P&D foi reposicionado como **aplicação do mesmo motor PONTE**, não como produto paralelo.

- Pilar 01: Diagnóstico & Pipeline.
- Pilar 02: Capital para Inovação, separando recursos não reembolsáveis de financiamento.
- Pilar 03: Incentivos & Créditos, com terminologia vigente (Lei do Bem, Lei de TICs e MOVER, quando aplicáveis).
- Pilar 04: ICTs & Infraestrutura Científica.

### 5. Escalabilidade
Foi criada a seção `#escala`, com cinco mecanismos:

1. objeto padronizado (PJF);
2. atores reutilizáveis quando aderentes;
3. conhecimento persistente;
4. motor multissetorial;
5. efeito de densidade.

A página evita declarar “disrupção” ou “network effect” como fatos já provados; demonstra a hipótese estrutural de escala.

### 6. CRM / WhatsApp
O antigo “CRM Gate” foi substituído por **Cadastro de Interesse + Comunidade PONTE**.

A versão portátil:

- não grava leads em `localStorage`;
- não afirma integração com CRM quando não existe endpoint;
- possui configuração `PONTE_CONFIG.crmEndpoint`;
- exige HTTPS para endpoint real;
- só abre a comunidade após resposta bem-sucedida quando o CRM está configurado;
- em modo demonstrativo, informa explicitamente que os dados não foram enviados nem armazenados;
- mantém opt-in de comunicações futuras separado e opcional;
- oferece aviso de privacidade específico do protótipo;
- oferece fallback sem JavaScript para acesso ao WhatsApp.

> Limite arquitetural: um HTML estático não consegue proteger de fato o link do grupo WhatsApp. Um gate obrigatório exige backend/autorização server-side.

## Correções ontológicas preservadas

- `Organização` não é `Ativo`.
- `Proponente` é função institucional, não “capacidade”.
- O PJF mede **funções críticas cobertas** (3/5), não “capacidades” genéricas.
- Accountability não é parceria econômica nem chancela institucional.

## QA final

### Estrutura

- DOCTYPE: 1
- IDs duplicados: 0
- Seções principais: 13
- Âncoras internas sem destino: 0
- Scripts externos: 0
- CSS externo: 0
- Escrita em localStorage: 0
- Termos obsoletos removidos: `Rota 2030`, `Lei de Informática`, `Capital Não Reembolsável`, `CRM Gate`

### Viewports

| Largura | Overflow horizontal | Erros JS |
|---:|---:|---:|
| 360 px | 0 | 0 |
| 390 px | 0 | 0 |
| 768 px | 0 | 0 |
| 1024 px | 0 | 0 |
| 1440 px | 0 | 0 |

### Interações

- menu mobile: OK
- 6 personas: OK
- navegação das personas por teclado: OK
- CP-014 e CP-015: OK
- ESC em modais: OK
- privacidade aninhada preserva formulário: OK
- grafo por teclado: OK
- barra 3/5 estabiliza em 60%: OK
- `prefers-reduced-motion`: 60% sem depender da animação
- fallback sem JavaScript: navegação + link WhatsApp OK

### Contraste

Auditoria computada dos elementos textuais visíveis em 390 px e 1440 px: **0 falhas nos limiares AA aplicáveis avaliados**. Isto é QA técnico, não certificação formal WCAG.

### CRM

- endpoint HTTP: bloqueado
- endpoint HTTPS simulado: payload enviado corretamente
- opt-in de marketing: separado no payload
- erro de envio: não abre WhatsApp nem afirma cadastro
- sucesso: abre comunidade e fecha modal

## Configuração para produção

No bloco `window.PONTE_CONFIG`, preencher:

```js
window.PONTE_CONFIG = {
  crmEndpoint: 'https://SEU-ENDPOINT-SEGURO/lead',
  whatsappCommunityUrl: 'https://chat.whatsapp.com/...'
};
```

Nunca inserir segredo de API ou credencial no HTML. O endpoint deve autenticar e proteger a integração no servidor.

## Pendências que não são defeitos desta release

Antes de usar o formulário como captação real em produção:

1. configurar endpoint CRM HTTPS;
2. publicar aviso de privacidade definitivo com identificação do controlador, finalidades, base(s) legal(is), compartilhamentos, retenção, segurança e canal do titular;
3. definir política de retenção e exclusão;
4. validar backend contra abuso/spam;
5. decidir se o acesso ao WhatsApp será livre ou protegido por backend.

Esses itens exigem decisões operacionais e infraestrutura externa; não podem ser resolvidos de forma real dentro de um HTML portátil isolado.
