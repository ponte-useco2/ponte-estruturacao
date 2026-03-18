# Workflow Mínimo: Deploy na Vercel (Ponte Estruturação de Projetos)

Este guia detalha o passo a passo exato para publicar o site corporativo da Ponte na nuvem, conectando o repositório GitHub à Vercel e configurando as variáveis de ambiente necessárias para o funcionamento do Supabase (Formulário de Diagnóstico B2B).

## 1. Preparação Local (Terminal)

Antes de enviar o código atual para o GitHub, certifique-se de que os pacotes finais que adicionamos instalem corretamente.

1. **Pare o servidor local** se estiver rodando (`Ctrl + C` no terminal).
2. **Execute a instalação das dependências** adicionadas para o Analytics e o Backend:
   ```bash
   npm install @vercel/analytics @supabase/supabase-js
   ```
3. **Teste o build localmente** (Opcional, mas altamente recomendado):
   ```bash
   npm run build
   ```
   *Se o build concluir sem erros (verde), o projeto está 100% pronto para a Vercel compilar na nuvem.*

## 2. Enviando para o GitHub

1. Inicialize o repositório Git (se ainda não o fez durante a Fase 1):
   ```bash
   git init
   git add .
   git commit -m "feat: versão final do site com formulário Supabase, Framer Motion e Vercel Analytics"
   ```
2. Crie um novo repositório limpo no [GitHub](https://github.com/new).
3. Conecte o seu código local ao repositório remoto recém-criado e faça o push (envio):
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git branch -M main
   git push -u origin main
   ```

## 3. Configuração do Banco de Dados (Supabase)

Antes de publicar o site, a estrutura e a segurança do banco de dados que receberá os leads (via diagnóstico) precisam existir:

1. Acesse o [Supabase](https://supabase.com/) e crie uma conta gratuita.
2. Crie um novo projeto (ex: `ponte-db`). Defina uma senha forte.
3. Vá no menu esquerdo em **SQL Editor** e rode este script exato para criar a tabela com as regras restritivas de **RLS (Row Level Security)**:

```sql
-- 1. Criar a tabela de leads
create table public.leads (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  email text not null,
  whatsapp text not null,
  organizacao text not null,
  cidade text not null,
  tipo_org text not null,
  estagio_proj text not null,
  objetivo text not null,
  prazo_edital text not null,
  demanda_resumo text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Habilitar RLS (Row Level Security) - Essencial B2B
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 3. Política de Inserção: Permite a qualquer usuário anonimo INSERIR dados no form
CREATE POLICY "Permitir inserções anonimas em leads" 
ON public.leads 
FOR INSERT 
TO anon 
WITH CHECK (true);
```
*OBS: Não deve ser criada política de `SELECT`, garantindo que ninguém mal-intencionado possa consultar a sua lista de clientes B2B via API pública do site.*

4. No painel do Supabase, vá em **Project Settings > API** e copie os valores:
   - **Project URL**
   - **Project API Keys (anon public)** ou sua chave administrativa *(depende de sua política de privacidade isolada)*. 

## 4. Deploy na Vercel e Variáveis de Ambiente

Com o GitHub e o Supabase prontos, unimos tudo na plataforma de hospedagem:

1. Acesse a [Vercel](https://vercel.com/) e faça login (idealmente com seu próprio GitHub conectado).
2. Clique no botão preto **"Add New..." > "Project"**.
3. Na lista à esquerda ("Import Git Repository"), localize o repositório da Ponte (`SEU_REPOSITORIO`) que você subiu e clique em **"Import"**.
4. Configure o Projeto: a Vercel identificará o Framework Preset como *Next.js*.
5. **Configuração Crucial: Environment Variables (Variáveis de Ambiente)**:
   Abra a sanfona "Environment Variables" *antes* de clicar em Deploy e adicione as 4 chaves (referentes ao Supabase e Disparo de E-mails):
   - Nome: `NEXT_PUBLIC_SUPABASE_URL` | Valor: *[Cole a URL do Supabase]* | Clicar em "Add"
   - Nome: `SUPABASE_SERVICE_ROLE_KEY` | Valor: *[Cole a anon key ou service_key do Supabase]* | Clicar em "Add"
   - Nome: `EMAIL_USER` | Valor: `diretoria.ponte.projetos@gmail.com` | Clicar em "Add"
   - Nome: `EMAIL_PASS` | Valor: *[Cole a Senha de Aplicativo (16 dígitos) do Gmail]* | Clicar em "Add"
   
6. Clique no botão azul definitivo: **"Deploy"**.

## 5. Pós-Deploy: Analytics e Metatags B2B

1. Aguarde a Vercel processar 1-2 minutos. O site estará online com o um domínio temporário (`.vercel.app`), que pode ser atrelado ao seu `ponteprojetos.com.br` no painel *Settings > Domains*.
2. **Ativando Métricas Profissionais de Acessos**: 
   - Na dashboard do seu novo projeto na Vercel, clique na aba **"Analytics"** no menu superior.
   - Clique em **"Enable"**. Como a tag `<Analytics />` já está codificada em seu App, seu Dashboard passará a monitorar todo o tráfego a partir de dados geográficos, dispositivos nativos e taxa de rejeição B2B em milissegundos.

### ⚠️ Lembrete de SEO (Arquivos Visuais do WhatsApp)
Para que a sua "imagem de vitrine" renderize perfeitamente ao colar o link do site no chat do investidor/prospecto:
- Salve uma imagem (1200x630 pixels) de boa qualidade sobrepondo a logo da Ponte.
- Salve-a estritamente com o nome `og-image.jpg` e coloque dentro da pasta raiz `public/` do projeto no Visual Studio. Faça novo comit. O `layout.tsx` a puxará magicamente como OpenGraph Cover.
