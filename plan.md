# Plano de Implementação: Site da Consultoria Ponte

## Fase 1: Planejamento e Design System (Status: Aguardando Aprovação)
- ✅ Definição da Stack Tecnológica
- ✅ Criação do Design System (`design-system.md`) e da estrutura do plano.
- ⏳ Obtenção da copy/textos base (Documento "Ponte - Estruturação de Projetos").

## Fase 2: Estrutura Base e Componentes (A Iniciar)
1. **Inicialização do Projeto:**
   - Setup com `Next.js` (App Router) e `Tailwind CSS`.
   - Adicionar bibliotecas: `lucide-react` para ícones e `framer-motion` para animações fluidas.
2. **Configuração Global:**
   - Adicionar fontes (`Inter` e `Plus Jakarta Sans`) via `next/font`.
   - Setup das cores no `tailwind.config.ts`.
3. **Componentes Reutilizáveis:**
   - `Header` (Navegação minimalista e transparente/glassmorphism).
   - `Footer` (Estrutura corporativa com links e contatos).
   - `Button` (Primário e Secundário para CTAs consistentes).
   - `Section` (Wrapper para manter respiro/whitespace padrão).

## Fase 3: Desenvolvimento das Páginas
A construção será feita de forma modular, mobile-first, seguindo a Copy Oficial.
1. **Home (Hero):** Título principal forte, subtítulo com a proposta de valor e CTA (ex: "Fale com nossos especialistas"). Animação de `fade-up`.
2. **Serviços:** Grid limpo (ex: 3 colunas no desktop) para áreas de atuação, com ícones minimalistas.
3. **Como trabalhamos:** Componente visual de passos/metodologia.
4. **Experiência/Setores:** Lista de indústrias atendidas (substituindo "Casos" conforme solicitado).
5. **Contato/Diagnóstico:** Formulário de captação de leads de alta conversão.

## Próximos Passos
1. Aguardar aprovação deste plano e do `design-system.md`.
2. Receber o conteúdo do documento "Ponte - Estruturação de Projetos".
3. Inicializar o repositório Next.js.
