# Design System - Consultoria Ponte

## Filosofia Visual

A identidade visual deve refletir a expertise em "estruturação de projetos complexos, inovação e captação de recursos".
A estética é inspirada nas maiores consultorias globais: **Limpa (Clean), Elegante, Confiável e Corporativa, porém com um toque de Inovação.**

### Princípios

- **Respiro (White Space):** Uso abundante de margens e preenchimentos para evitar poluição visual e facilitar a leitura.
- **Alto Contraste:** Textos perfeitamente legíveis (WCAG AAA ou AA).
- **Mobile-first:** Tipografia e espaçamentos redimensionados matematicamente para oferecer a mesma sofisticação na palma da mão.

---

## Tipografia

- **Família Primária (Títulos e Destaques):** `Plus Jakarta Sans`
  - *Sugerido:* Geométrico, limpo e transmite modernidade e estrutura matemática.
  - Pesos: `SemiBold (600)`, `Bold (700)`, `ExtraBold (800)`.
- **Família Secundária (Textos longos, Parágrafos, Legendas):** `Inter`
  - *Sugerido:* Legibilidade universal, neutro.
  - Pesos: `Regular (400)`, `Medium (500)`.

---

## Paleta de Cores (Tailwind CSS)

Buscando "Alta Conversão Corporativa":

- **Background Principal:** `#ffffff` (White) e fundos alternados em `#f8fafc` (Slate 50) sutil para diferenciar seções.
- **Cor Primária (Brand):** `#0f172a` (Slate 900) - Um tom "quase preto", escuro o suficiente para ler bem, sofisticado. Usado nos textos e fundos de destaque.
- **Cor Secundária (Accent/Trust):** `#1e40af` (Blue 800) ou `#2563eb` (Blue 600) - O Azul clássico da consultoria para transmitir segurança. Usado em links, botões secundários ou detalhes de ícones.
- **Cor de Textos Base:** `#475569` (Slate 600) para parágrafos para suavizar o contraste com o fundo branco (evitando cansar os olhos).

---

## Ícones

- **Biblioteca:** `Lucide React`
- Estilo: Outline (linhas consistentes de `2px` ou `1.5px`), traços minimalistas, sem blocos preenchidos, do tamanho `24x24` ou maior dependendo do bloco.

---

## Componentes

### Botões (CTAs)

Para a captação de leads e contato:

- **Button Primary:**
  - Fundo: Slate 900 (`bg-slate-900`)
  - Texto: Branco (`text-white`)
  - Arredondamento: Sutil (`rounded-md` ou `rounded-lg`)
  - Interação: Escurecimento leve no Hover ou translação no Eixo Y (`hover:-translate-y-0.5`, `transition-all`).
- **Button Secondary / Outline:**
  - Fundo: Transparente (`bg-transparent`)
  - Borda: Sólida de 1px ou 2px em Slate 200 ou Blue 600.
  - Texto: Slate 900.

### Sombras e Elevação

- Evitar sombras exageradas. Usar sombras suaves (`shadow-sm` ou `shadow-md`) apenas em cards interativos ou modais de diagnóstico flutuantes.

---

## Animações (Framer Motion)

"Fade-ins sutis para transmitir confiança e sofisticação."

- **Scroll Reveal (Entrada de seção):** Elementos (títulos, cards) começam invisíveis (`opacity: 0, y: 20`) e sobem revelando-se suavemente (`opacity: 1, y: 0`).
- **Duração (Duration):** `0.5s` a `0.8s`.
- **Easing:** `easeOut` ou `cubic-bezier(0.16, 1, 0.3, 1)` para entradas.
- Stagger nos grids (ex: Cards de Serviços aparecem um após o outro com delay de `0.1s`).
