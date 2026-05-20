# BuildingMind — Design Direction

## Inspiration
Dark professional dashboard — dense data, clean typography, electric blue accents on deep dark backgrounds. Similar to Figma's dark UI / Linear / Vercel dashboard.

## Colors
```css
--bg-base: #0a0c10        /* quase preto */
--bg-surface: #111318     /* cards e painéis */
--bg-elevated: #1a1d25    /* hover states, dropdowns */
--border: #1e2230         /* bordas subtis */
--border-strong: #2a2f3d  /* bordas visíveis */

--blue-primary: #2563eb   /* accent principal */
--blue-bright: #3b82f6    /* hover do accent */
--blue-glow: #1d4ed8      /* pressed */
--blue-subtle: #1e3a5f    /* backgrounds de badge/tag */

--text-primary: #f1f5f9   /* branco suave */
--text-secondary: #94a3b8 /* slate-400 */
--text-muted: #475569     /* slate-600 */

--green: #10b981          /* pago, sucesso */
--red: #ef4444            /* moroso, erro */
--amber: #f59e0b          /* aviso, pendente */
--purple: #8b5cf6         /* agentes AI */
```

## Typography
- **Font:** Poppins (Google Fonts)
- **Display:** Poppins 600–700, tracking tight
- **Body:** Poppins 400–500
- **Mono:** JetBrains Mono (para valores monetários, códigos)
- **Hierarchy:** text-xs (labels), text-sm (body/table), text-base (subtítulos), text-xl–3xl (headings)

## Layout
- Sidebar fixa esquerda, 240px, dark navy
- Header top com breadcrumb + ações
- Content area com padding generoso
- Cards com border subtil + bg-surface
- Tabelas dense com row hover

## Component Style
- Botões primários: bg-blue-primary, sem rounded excessivo (rounded-md)
- Badges: pill pequeno, fundo colorido subtil
- Cards: border border-[--border], bg-[--bg-surface], rounded-lg
- Inputs: bg-[--bg-elevated], border, focus ring azul
- Tabelas: striped subtil, hover highlight

## Motion
- Page transitions: fade + slide-up suave (150ms)
- Numbers: counter animation na entrada (dashboard KPIs)
- Sidebar links: slide indicator bar à esquerda

## Anti-patterns to avoid
- Gradients coloridos no fundo
- Cards com shadow excessiva
- Rounded-full em botões
- Branco puro (#fff) em qualquer fundo
