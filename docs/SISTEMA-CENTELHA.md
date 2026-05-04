# Sistema Centelha 3 PB — Documentação Operacional

> Documentação completa do sistema de captura de leads, checkout, cupons e
> automação de email construído para a landing `/centelha-3-pb` em
> `ponteprojetos.com.br`.
>
> Criado em maio de 2026. Atualize esta doc sempre que mudar arquitetura.

---

## 1. Visão geral

```
┌─────────────────────────────────────────────────────────────────┐
│                     ponteprojetos.com.br                        │
│                  (Next.js 16 + Tailwind v4)                     │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼─────────────────────────┐
        │                       │                         │
        ▼                       ▼                         ▼
   /centelha-3-pb          /centelha-3-pb         /centelha-3-pb
   (landing)               /checkout              /obrigado
        │                       │                         ▲
        │ submit                │ pagar                   │
        ▼                       ▼                         │
   actions-centelha        actions-checkout-              │
   submitCentelhaLead      centelha                       │
        │                       │                         │
        ├──► Supabase            ├──► Asaas API            │
        │    (leads)             │    (createPayment)      │
        │                        │                         │
        ├──► Email admin         └──► redirect ────────────┘
        │    (imediato)
        │
        └──► Email lead
             (1h via cron)


┌─────────────────────────────────────────────────────────────────┐
│                    Asaas (Production)                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ webhook
                                ▼
                    /api/webhooks/asaas
                                │
                                ▼
                          Supabase
                          (atualiza estagio_proj)


┌─────────────────────────────────────────────────────────────────┐
│                    cron-job.org (a cada 10 min)                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ GET + Bearer
                                ▼
                /api/cron/send-pending-emails
                                │
                                ▼
                    Busca leads onde
                    email_pos_form_send_at <= NOW()
                    AND email_pos_form_sent_at IS NULL
                                │
                                ▼
                    Envia email (Gmail SMTP)
                    Marca sent_at
```

---

## 2. Ambiente e URLs

### Produção

- **Domínio:** `https://ponteprojetos.com.br`
- **Hospedagem:** Vercel (deploy automático no push pra `main`)
- **Repo:** `https://github.com/ponte-useco2/ponte-estruturacao`

### Páginas relevantes

| Rota | Tipo | Descrição |
|------|------|-----------|
| `/` | Estática | Home (formulário de diagnóstico geral) |
| `/centelha-3-pb` | Estática | Landing do produto Centelha 3 PB |
| `/centelha-3-pb/checkout` | Estática + Suspense | Pagamento via Asaas |
| `/centelha-3-pb/obrigado` | Estática | Confirmação pós-pagamento |
| `/reurb` | Estática | Landing REURB para municípios |
| `/consultoria-finep` | Estática | FINEP |
| `/finep-subvencao` | Estática | FINEP variante |
| `/api/webhooks/asaas` | Dinâmica | Recebe eventos Asaas |
| `/api/cron/send-pending-emails` | Dinâmica | Endpoint do cron-job.org |

### Serviços externos

| Serviço | Função | Painel |
|---------|--------|--------|
| **Vercel** | Hospedagem + deploy | vercel.com/dashboard |
| **Supabase** | Banco de dados (Postgres) | supabase.com/dashboard/project/vxvymlwxnejtlqbijatk |
| **Asaas** | Gateway de pagamento (Pix + Cartão) | asaas.com (modo Production) |
| **Gmail SMTP** | Envio de emails | Configurado via App Password |
| **cron-job.org** | Scheduler do email pós-formulário | console.cron-job.org |
| **GitHub** | Versionamento | github.com/ponte-useco2/ponte-estruturacao |

---

## 3. Variáveis de ambiente

Ficam em `.env.local` (local) e na Vercel → Settings → Environment Variables (produção).

| Variável | Descrição | Onde usa |
|----------|-----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | client/server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (pública) | client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (privada — passa por RLS) | server actions, webhook |
| `ASAAS_API_KEY` | Chave API Asaas Production (`$aact_prod_...`) | actions-checkout |
| `ASAAS_WEBHOOK_TOKEN` | Token enviado pelo Asaas no header `asaas-access-token` | webhook |
| `EMAIL_USER` | `diretoria.ponte.projetos@gmail.com` | nodemailer |
| `EMAIL_PASS` | App Password do Gmail (NÃO é a senha real) | nodemailer |
| `CRON_SECRET` | String aleatória pra autenticar cron-job.org via Bearer | endpoint cron |
| `NEXT_PUBLIC_SITE_URL` | (opcional) Override do `metadataBase`. Default: `https://ponteprojetos.com.br` | layout |

**⚠️ Crítico:** O `SUPABASE_SERVICE_ROLE_KEY` (formato novo `sb_secret_...`) é o que dá permissão de UPDATE/SELECT pro server. O webhook e o endpoint cron dependem dele. Se algum dia algo retornar `lead_not_found` ou similar, a primeira coisa a checar é se essa env var está setada na Vercel.

---

## 4. Estrutura do código

```
src/
├── app/
│   ├── actions.ts                          # Form home → submitLead
│   ├── actions-centelha.ts                 # Form Centelha → submitCentelhaLead
│   ├── actions-reurb.ts                    # Form REURB → submitReurbLead
│   ├── actions-finep.ts                    # Form FINEP → submitFinepForm
│   ├── actions-checkout-centelha.ts        # validateCupom + criarCobrancaCentelha
│   ├── layout.tsx                          # Root layout + metadataBase
│   ├── page.tsx                            # Home
│   ├── api/
│   │   ├── cron/send-pending-emails/route.ts   # Endpoint do cron-job.org
│   │   └── webhooks/asaas/route.ts             # Recebe eventos do Asaas
│   ├── centelha-3-pb/
│   │   ├── page.tsx                        # Landing
│   │   ├── checkout/page.tsx               # Server component
│   │   ├── checkout/CheckoutForm.tsx       # Client component (form)
│   │   └── obrigado/page.tsx               # Página de sucesso
│   ├── reurb/page.tsx
│   ├── consultoria-finep/page.tsx
│   └── finep-subvencao/page.tsx
├── components/
│   ├── layout/Header.tsx
│   ├── layout/Footer.tsx
│   └── ui/StickyCheckoutCTA.tsx           # Barra flutuante com cupom + CTA
├── config/
│   ├── centelha-edital.ts                  # Datas, valores, funil — fonte única
│   └── centelha-cupons.ts                  # Catálogo de cupons (referência)
├── lib/
│   ├── supabase.ts                         # createServerSupabaseClient
│   ├── asaas.ts                            # Cliente Asaas (createCustomer, createPayment, getPayment)
│   ├── email.ts                            # sendEmail (nodemailer Gmail)
│   └── email-templates/
│       ├── centelha-pos-formulario.ts      # Email pro lead (1h depois)
│       └── admin-notification.ts           # Email pro admin (imediato)
└── supabase/
    └── migrations/
        ├── centelha_cupons.sql             # Tabela + funções RPC + seed dos 10 cupons
        └── centelha_email_pos_form.sql     # Colunas pro email automático
```

---

## 5. Fluxo do lead gratuito

### O que acontece quando alguém preenche `/centelha-3-pb`

1. **Form submetido** → `submitCentelhaLead(formData)` em `actions-centelha.ts`
2. **Insert no Supabase** na tabela `leads` com:
   - `tipo_org = "Centelha 3 PB"` (vem de `centelhaEdital.edition.label`)
   - `email_pos_form_send_at = NOW() + 1 hour` (agendamento)
   - `email_pos_form_sent_at = NULL` (ainda não enviado)
   - `demanda_resumo` consolida todos os campos extras em texto livre
3. **Email IMEDIATO ao admin** (`diretoria.ponte.projetos@gmail.com`):
   - Subject: `[Ponte][Lead] Centelha 3 PB — Pré-diagnóstico — <nome>`
   - Tabela com todos os campos preenchidos
   - Botões "💬 Falar no WhatsApp" (link wa.me) e "✉️ Responder por email"
   - Falha de email NÃO bloqueia o sucesso do form (try/catch)
4. **Cron-job.org dispara a cada 10 min** o endpoint `/api/cron/send-pending-emails`
5. **Endpoint busca leads** com `send_at <= NOW()` e `sent_at IS NULL` (limite 20 por execução)
6. **Envia email PRO LEAD** (template `centelha-pos-formulario.ts`):
   - Subject personalizado com primeiro nome
   - Botão verde "Contratar Etapa 1 — R$ 2.160" (link `?cupom=WS`)
   - Botão "💬 Falar no WhatsApp" com mensagem pré-pronta
   - Disclaimer LGPD + compliance
7. **Marca `email_pos_form_sent_at`** após sucesso do envio

### Tabela `leads` (campos relevantes)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `nome` | text | |
| `email` | text | |
| `whatsapp` | text | |
| `organizacao` | text | Nome do projeto ou "Centelha 3 PB - Pessoa Física" |
| `cidade` | text | Formato `Município/PB` |
| `tipo_org` | text | `"Centelha 3 PB"` (filtro principal) |
| `estagio_proj` | text | Estágio do projeto OU status do pagamento (após webhook) |
| `objetivo` | text | Texto fixo `"Estruturação de proposta para Centelha 3 PB"` |
| `prazo_edital` | text | Label do prazo, vem de `getPrazoEditalLabel()` |
| `demanda_resumo` | text | Concatenação de todos os campos extras + ID Asaas (após pagamento) |
| `email_pos_form_send_at` | timestamptz | Quando enviar email automático (~1h depois) |
| `email_pos_form_sent_at` | timestamptz | Quando foi enviado (NULL = pendente) |
| `created_at` | timestamptz | |

---

## 6. Fluxo do checkout

### Quando alguém clica em "Comprar agora"

1. **Página `/centelha-3-pb/checkout`** carrega o `CheckoutForm` dentro de `<Suspense>` (necessário pelo `useSearchParams`)
2. **Pré-aplica cupom** se vier `?cupom=XXX` na URL (ex: do email automático com `?cupom=WS`)
3. **Usuário valida cupom** (botão "Aplicar") → chama `validateCupom(codigo)`:
   - Roda `consultar_cupom_centelha` no Supabase (não decrementa, só consulta)
   - Mostra "Cupom aplicado" + valor final
4. **Usuário preenche dados + submete** → `criarCobrancaCentelha(formData)`:
   - Decrementa cupom atomicamente via `consumir_cupom_centelha` (race-safe)
   - Cria customer no Asaas (ou reusa via CPF/CNPJ)
   - Cria cobrança no Asaas (Pix + Cartão habilitados)
   - Salva lead com `demanda_resumo` incluindo `Cupom: XXX | Asaas: <payment_id>`
   - Se Asaas falhar APÓS decremento, devolve cupom via `devolver_cupom_centelha`
5. **Redireciona pro Asaas** (URL de pagamento)
6. **Após pagamento, Asaas dispara webhook** → `/api/webhooks/asaas`:
   - Valida token (`asaas-access-token` header == `ASAAS_WEBHOOK_TOKEN`)
   - Busca lead via `demanda_resumo LIKE '%${payment.id}%'`
   - Atualiza `estagio_proj` baseado no evento:
     - `PAYMENT_RECEIVED` ou `PAYMENT_CONFIRMED` → `"Pagamento recebido"`
     - `PAYMENT_OVERDUE` → `"Pagamento vencido"`
     - `PAYMENT_REFUNDED` → `"Pagamento reembolsado"`

### Configuração no Asaas (Painel Asaas → Integrações)

- **Domínio cadastrado:** `ponteprojetos.com.br` (Minha Conta → Informações)
- **Pix:** Chave aleatória cadastrada (necessário pra Pix aparecer como opção no checkout)
- **Webhook URL:** `https://ponteprojetos.com.br/api/webhooks/asaas`
- **Webhook token:** mesmo valor que `ASAAS_WEBHOOK_TOKEN` na Vercel
- **Eventos a enviar:** PAYMENT_CREATED, PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, PAYMENT_REFUNDED

---

## 7. Sistema de cupons

### Tabela `centelha_cupons` (Supabase)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `codigo` | TEXT PK | Código em UPPER (ex: `WS`, `GAYOSO`) |
| `tipo` | TEXT | `'afiliado_20'` ou `'amigos_270'` |
| `valor_final_centavos` | INT | 216000 (R$ 2.160) ou 27000 (R$ 270) |
| `max_usos` | INT | NULL = ilimitado, número = vagas |
| `usos_atuais` | INT | Contador atômico |
| `afiliado_nome` | TEXT | Pra atribuição |
| `ativo` | BOOLEAN | Pode desativar sem deletar |
| `created_at` / `updated_at` | timestamptz | |

### Funções RPC (atômicas, race-safe)

- `consumir_cupom_centelha(codigo)` — decrementa atomicamente, retorna o cupom ou NULL se inválido/esgotado
- `consultar_cupom_centelha(codigo)` — só leitura, pra mostrar valor antes de pagar
- `devolver_cupom_centelha(codigo)` — incrementa de volta (em caso de falha do Asaas após decrement)

### Cupons cadastrados (catálogo atual)

**Afiliados 20% off (uso ilimitado, R$ 2.160):**
- `PEDRO` — Pedro
- `GAYOSO` — Gayoso (compartilhado entre Pedro/Paulo Gayoso)
- `ESC` — ESC
- `WS` — WS (cupom padrão do email automático)
- `RESULT` — Result (Fabrício + Emerson)

**Amigos 90% off (R$ 270, 2 vagas cada — total 10):**
- `LUZERO` — Luzero (Emerson, irmão de igreja)
- `FABRICIO` — Fabrício
- `PAULO` — Paulo
- `ISABELLE` — Isabelle (usado pelo grupo Gayoso após decisão)
- `PABLO` — Pablo

**Teste:**
- `TESTE_PROD` — usado na validação do Asaas Production (R$ 5, 1/1 esgotado)

### Adicionar novo cupom

```sql
INSERT INTO public.centelha_cupons
  (codigo, tipo, valor_final_centavos, max_usos, afiliado_nome)
VALUES
  ('NOVO_CUPOM', 'afiliado_20', 216000, NULL, 'Nome do Afiliado')
ON CONFLICT (codigo) DO NOTHING;
```

Para `amigos_270`: use `'amigos_270', 27000, 2, 'Nome'`.

### Query de monitoramento

```sql
SELECT
  codigo,
  afiliado_nome AS afiliado,
  CASE tipo
    WHEN 'afiliado_20' THEN '20% off'
    WHEN 'amigos_270'  THEN 'R$ 270 (taxa social)'
  END AS tipo,
  'R$ ' || REPLACE(TO_CHAR(valor_final_centavos / 100.0, 'FM999G990D00'), '.', ',') AS valor_final,
  usos_atuais AS usos,
  COALESCE(max_usos::TEXT, '∞') AS max_usos,
  CASE
    WHEN max_usos IS NULL THEN 'ilimitado'
    ELSE (max_usos - usos_atuais)::TEXT || ' vagas'
  END AS restante,
  CASE
    WHEN NOT ativo THEN '🔴 INATIVO'
    WHEN max_usos IS NOT NULL AND usos_atuais >= max_usos THEN '⚠️ ESGOTADO'
    WHEN usos_atuais > 0 THEN '🟢 EM USO'
    ELSE '⚪ DISPONÍVEL'
  END AS status,
  TO_CHAR(updated_at AT TIME ZONE 'America/Fortaleza', 'DD/MM HH24:MI') AS ultima_atualizacao
FROM public.centelha_cupons
ORDER BY
  CASE tipo WHEN 'afiliado_20' THEN 1 ELSE 2 END,
  usos_atuais DESC,
  codigo;
```

### Query "quem usou cada cupom"

```sql
SELECT
  l.created_at AT TIME ZONE 'America/Fortaleza' AS quando,
  l.nome,
  l.email,
  l.cidade,
  SUBSTRING(l.demanda_resumo FROM 'Cupom:\s*([A-Z0-9_]+)') AS cupom_usado,
  l.estagio_proj AS status_pagamento
FROM public.leads l
WHERE l.tipo_org = 'Centelha 3 PB'
  AND l.demanda_resumo ILIKE '%Cupom:%'
ORDER BY l.created_at DESC;
```

---

## 8. Sistema de emails

Tem **3 tipos de email** rodando:

### 8.1 Notificação ao admin (imediato a cada lead)

- **Quando:** Logo após `INSERT` bem-sucedido em `actions.ts` ou `actions-centelha.ts`
- **De:** `"Ponte — Notificação de Lead" <diretoria.ponte.projetos@gmail.com>`
- **Para:** `EMAIL_USER` (mesmo endereço)
- **Subject:** `[Ponte][Lead] Centelha 3 PB — Pré-diagnóstico — João Silva`
- **Template:** `src/lib/email-templates/admin-notification.ts`
- **Conteúdo:** Header verde + nome do lead + 2 botões (WhatsApp + Email) + tabela com todos campos
- **Falha:** Try/catch — não bloqueia sucesso do form

### 8.2 Email pós-formulário ao lead (1h depois)

- **Quando:** Cron-job.org dispara a cada 10 min, busca leads pendentes
- **De:** `"Equipe Ponte Projetos" <diretoria.ponte.projetos@gmail.com>`
- **Para:** Email do lead
- **Subject:** `<Primeiro_Nome>, recebemos sua proposta — próximos passos pro Centelha 3 PB`
- **Template:** `src/lib/email-templates/centelha-pos-formulario.ts`
- **Conteúdo:** Saudação + cupom WS + R$ 2.160 + wa.me com mensagem pré-pronta + compliance
- **Marcação:** Após sucesso, atualiza `email_pos_form_sent_at` no banco

### 8.3 Webhook Asaas (sem email — só atualiza banco)

- **Quando:** Asaas dispara após eventos de pagamento
- **Endpoint:** `/api/webhooks/asaas`
- **Ação:** Atualiza `estagio_proj` no Supabase (`"Pagamento recebido"`, etc.)
- **Sem email** — informação fica no banco pra consulta posterior

### Configuração SMTP Gmail

- **Service:** `gmail` (nodemailer detecta porta/host automaticamente)
- **Auth:** App Password (não senha real)
- **Gerar App Password:** https://myaccount.google.com/apppasswords
- **Quota:** 500 emails/dia via SMTP — folgado pro volume atual

---

## 9. Cron-job.org

### Cronjob configurado

- **Title:** `Centelha — envio email pós-formulário`
- **URL:** `https://ponteprojetos.com.br/api/cron/send-pending-emails`
- **Method:** GET
- **Schedule:** Every 10 minutes (`*/10 * * * *`)
- **Time zone:** America/Fortaleza
- **Headers:**
  - `Authorization: Bearer <CRON_SECRET>`
- **Notify on failure:** ✅
- **Cronjob ID:** 7547573 (visível na URL do painel)

### Validação manual

Botão "TEST RUN" (Run now) no cron-job.org. Resposta esperada:

```json
{"ok": true, "message": "Nenhum email pendente.", "sent": 0, "failed": 0}
```

ou se houver leads pendentes:

```json
{"ok": true, "sent": 1, "failed": 0, "total": 1}
```

### Erros possíveis

| Resposta | Causa | Solução |
|----------|-------|---------|
| 401 Unauthorized | Header Authorization errado | Verificar Bearer + CRON_SECRET na Vercel |
| 500 Internal Error | EMAIL_USER/EMAIL_PASS não setados ou Supabase fora | Checar Vercel Logs filtrando `[cron/send-emails]` |
| 200 mas `failed > 0` | Algum email falhou (email inválido, etc.) | Inspecionar log da execução pra ver qual lead |

---

## 10. Webhook Asaas

- **Endpoint:** `/api/webhooks/asaas`
- **Validação:** Header `asaas-access-token` deve bater com `ASAAS_WEBHOOK_TOKEN` na Vercel
- **Eventos tratados:**
  - `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` → `estagio_proj = "Pagamento recebido"`
  - `PAYMENT_OVERDUE` → `"Pagamento vencido"`
  - `PAYMENT_REFUNDED` → `"Pagamento reembolsado"`
- **Como localiza o lead:** Busca por `demanda_resumo ILIKE '%${payment.id}%'` (o ID é injetado no momento da criação da cobrança)

### Quando chegou pagamento mas estagio_proj não atualizou

1. Verificar se webhook foi disparado: painel Asaas → Configurações → Webhooks → Histórico
2. Se Asaas reporta sucesso (200) mas banco não atualizou:
   - Conferir se `SUPABASE_SERVICE_ROLE_KEY` está setado na Vercel (usa key nova `sb_secret_...`)
   - Verificar logs da Vercel filtrando `[webhook/asaas]`
3. Se webhook está falhando (4xx/5xx no Asaas):
   - Conferir token: header esperado é `asaas-access-token` (case-insensitive), valor = `ASAAS_WEBHOOK_TOKEN`

---

## 11. Comandos úteis

### Build local

```powershell
cd C:\Users\jonat\Ponte_Estruturacao
Remove-Item -Recurse -Force .next, .turbo -ErrorAction SilentlyContinue
npm run build
```

### Deploy

```powershell
git add .
git commit -m "feat: descrição da mudança"
git push
```

A Vercel deploya automaticamente em ~2 min após push pra `main`.

### Resetar/limpar tudo

```powershell
Remove-Item -Recurse -Force .next, .turbo, node_modules
npm install
npm run build
```

### Conferir variáveis locais

```powershell
Select-String -Path .env.local -Pattern "CRON_SECRET|ASAAS|SUPABASE|EMAIL"
```

---

## 12. Troubleshooting comum

### "Build failed: parsing ecmascript source code failed"

Geralmente é truncamento de arquivo (bug Windows/Linux sync). Soluções:

1. Limpar cache: `Remove-Item -Recurse -Force .next, .turbo`
2. Conferir bytes finais do arquivo: deve terminar com `}\n`
3. Reescrever via heredoc do bash se persistir
4. Cuidado com `*/N * * * *` em comentários JSDoc — o `*/` fecha o bloco antes da hora

### "useSearchParams should be wrapped in a suspense boundary"

`useSearchParams` em client component dentro de página que prerendera. Solução: envolver em `<Suspense>` no server component pai (ver `checkout/page.tsx`).

### Supabase com `lead_not_found` no webhook

Falta `SUPABASE_SERVICE_ROLE_KEY` na Vercel. RLS bloqueia anon de fazer SELECT/UPDATE.

### Asaas: "Não há nenhum domínio configurado"

Cadastrar `ponteprojetos.com.br` em Asaas → Minha Conta → Informações.

### Pix não aparece como opção

Cadastrar chave Pix aleatória no Asaas. Cobranças criadas ANTES do cadastro continuam sem Pix; novas terão.

### Email não chega no Gmail "para si mesmo"

Gmail às vezes filtra emails de SMTP que vão pro mesmo endereço. Para testar a notificação admin, mande um lead com email diferente do `EMAIL_USER` e veja se chega no `diretoria@`. Confirma que está chegando.

### Cron-job.org retorna 401

Header `Authorization` errado. Deve ser exatamente `Bearer <CRON_SECRET>` (com espaço). Não use o toggle "Requires HTTP authentication" (esse manda Basic Auth, não Bearer).

---

## 13. Manutenção

### Quando vier o Centelha 4 PB

1. Editar **`src/config/centelha-edital.ts`**:
   - `edition.label`, `edition.year`, `edition.fullName`
   - `funding.maxValueLabel`, `funding.maxValueDescription` (atualizar valores)
   - `schedule.phase1.window`, `schedule.phase1.endIso`
   - `schedule.phase2Classified.window`, `endIso`
   - `pricing` se reajustar
2. Renomear pasta `/centelha-3-pb` → `/centelha-4-pb` (ou criar nova mantendo a antiga como histórico)
3. Atualizar links em emails (templates) e cupons (se mudar valor cheio)
4. Build + commit + push
5. Atualizar imagem OG `og-centelha-3-pb.jpg` → `og-centelha-4-pb.jpg`
6. Atualizar webhook Asaas se URL mudar

### Postergação de prazo

Editar só `centelhaEdital.schedule.phase1.endIso` e `window`. O resto se atualiza sozinho via consumo do config.

### Reajuste de preço

Editar `centelhaEdital.pricing.stage1` e os cupons no Supabase:

```sql
-- Exemplo: novo valor cheio R$ 3.000, 20% off vira R$ 2.400
UPDATE public.centelha_cupons
   SET valor_final_centavos = 240000
 WHERE tipo = 'afiliado_20';
```

Atenção: o valor `R$ 2.700` está hardcoded no template do email pós-formulário (`centelha-pos-formulario.ts`). Atualizar lá também.

### Aumentar/diminuir vagas de um cupom

```sql
-- Aumentar pra 4 vagas
UPDATE public.centelha_cupons
   SET max_usos = 4
 WHERE codigo = 'LUZERO';

-- Desativar (sem deletar histórico)
UPDATE public.centelha_cupons
   SET ativo = false
 WHERE codigo = 'TESTE_PROD';

-- Deletar de vez (cuidado com integridade — quem usou já tá registrado em demanda_resumo)
DELETE FROM public.centelha_cupons WHERE codigo = 'TESTE_PROD';
```

### Forçar envio imediato de email pendente

```sql
UPDATE public.leads
   SET email_pos_form_send_at = NOW() - INTERVAL '1 minute'
 WHERE email = 'EMAIL_DO_LEAD@exemplo.com'
   AND email_pos_form_sent_at IS NULL;
```

Depois clica "Run now" no cron-job.org.

### Reenviar email pós-formulário (já enviado)

```sql
UPDATE public.leads
   SET email_pos_form_sent_at = NULL,
       email_pos_form_send_at = NOW() - INTERVAL '1 minute'
 WHERE id = '<UUID_DO_LEAD>';
```

---

## 14. Histórico de decisões

### Por que cron-job.org externo em vez de setTimeout?

Vercel é serverless. `setTimeout` numa server action não sobrevive ao retorno da função. Solução: persistir intenção de envio no banco (`email_pos_form_send_at`) e ter um worker externo (cron-job.org) que polla periodicamente.

### Por que email automático com delay de 1h?

Tom mais "humano" — parece análise feita por pessoa, não bot. Reduz a sensação de venda agressiva e dá margem pra começar o relacionamento por WhatsApp manual antes da automação fazer sua parte.

### Por que cupom em duas categorias (20% e R$ 270)?

- 20% off (afiliado): pra parceiros indicarem clientes pagantes — comissão padrão de afiliados
- R$ 270 (amigos): pra acessibilidade social — quem tem ideia mas não pode pagar valor cheio. Limite de 2 vagas por código pra evitar abuso

### Por que `metadataBase` precisou ser configurado

Next.js 16 emite warning em build se Open Graph/Twitter usam URLs relativas sem `metadataBase`. Solução: configurar no `layout.tsx` apontando pro domínio prod (com fallback via env var).

### Por que `package.json` em `C:\Users\jonat\` quebrava o workspace root

Tinha um `package.json` solto (resíduo de teste com Firecrawl/Playwright) na pasta de usuário. Next.js detectou múltiplos lockfiles e usou `C:\Users\jonat\` como raiz, resultando em paths errados nos erros (`./Ponte_Estruturacao/...`). Removido.

---

## 15. Pendências e próximos passos

### Curto prazo (acompanhamento operacional)

- [ ] Monitorar consumo de cupons sociais (10 vagas total) à medida que o pessoal indicar
- [ ] Acompanhar entrega de emails admin nas primeiras semanas (verificar caixa de entrada do `diretoria@`)
- [ ] Conferir histórico do cron-job.org pra garantir 200 OK em todas execuções

### Possíveis melhorias futuras

- [ ] **Query de alerta semanal:** "cupons sociais com ≥1 uso ou esgotados nos últimos 7 dias"
- [ ] **Dashboard de leads:** página interna `/admin/leads` (com auth) pra visualizar em vez de SQL
- [ ] **Notificação no WhatsApp:** integrar com WhatsApp Business API pra avisar lead chegado direto no zap (em vez de só email)
- [ ] **Campanha de remarketing:** quem preencheu o form mas não pagou em 7 dias → email de follow-up
- [ ] **Painel de afiliados:** página onde cada parceiro vê quantos leads já vieram do cupom dele
- [ ] **Domínio próprio em vez de subpasta:** se o produto crescer, considerar `centelhapb.com.br` (decidiu manter subpasta agora por SEO/legal)

---

## Apêndice A — Imagens e assets

- **OG image landing:** `/public/og-centelha-3-pb.jpg`
- **Edital oficial (referência):** `C:\Users\jonat\Downloads\[PB] Minuta Edital Centelha 3 Fapesq (24.04.2026).pdf`
  - 24 páginas
  - Valores: R$ 85.333,33 subvenção + R$ 50.000 bolsas = **R$ 135.333,33 por projeto**
  - 25 projetos aprovados / 100 ideias classificadas / 50 projetos classificados
  - Faturamento bruto até R$ 4.800.000,00 (Simples Nacional ME)
  - Sediada na Paraíba (obrigatório)

## Apêndice B — Mensagens distribuídas (maio/2026)

Foram enviadas mensagens de divulgação no WhatsApp para:

| Destinatário | Cupons | Status |
|--------------|--------|--------|
| Pablo Forlan | PABLO (90% off) | Enviada com valor correto (R$ 135k) |
| Emerson (Luzero) | LUZERO + RESULT | Enviada com valor correto (R$ 135k) |
| Grupo DESCARBONIZAÇÃO (Isa, Pedro, Paulo Gayoso) | GAYOSO + ISABELLE | Enviada com valor correto (R$ 135k) |
| Fabrício Marcíli | RESULT + FABRICIO | ⚠️ Enviada com valor antigo (60-200k) — corrigida em mensagem subsequente |
| Instituto Result (+55 83 9871-5797) | RESULT + FABRICIO | ⚠️ Mesma situação — corrigida |

Status do WhatsApp também foi postado em 3 versões (A direta, B provocativa, C amigável).
