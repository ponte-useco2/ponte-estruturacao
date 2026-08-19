# Integração — PONTE Projetos v1.3

## Arquivo principal

`PONTE_Projetos_Apresentacao_Executiva_v1.3_FINAL_QA.html`

## CRM

Pesquise no HTML por `window.PONTE_CONFIG`.

O `crmEndpoint` vem vazio por segurança. Sem endpoint, o formulário funciona em **modo demonstrativo** e não persiste dados pessoais.

Para produção, use endpoint HTTPS próprio. Não coloque tokens, senhas, API keys ou segredos no HTML.

Payload atual:

```json
{
  "name": "...",
  "whatsapp": "...",
  "email": "...",
  "profile": "...",
  "interest": "...",
  "source": "...",
  "marketingOptIn": false,
  "timestamp": "ISO-8601"
}
```

O backend deve validar, registrar, aplicar política de retenção e devolver HTTP 2xx apenas quando a gravação tiver sido concluída.

## WhatsApp

O endereço da comunidade é configurável em `whatsappCommunityUrl`.

Como a apresentação é um HTML estático, o URL é necessariamente inspecionável no código. Se a PONTE quiser impedir acesso sem registro, o redirecionamento deve ser emitido pelo backend após validação do lead.

## Privacidade

O aviso existente é deliberadamente identificado como aviso do **protótipo**. Não substitui o aviso definitivo do ambiente de produção.
