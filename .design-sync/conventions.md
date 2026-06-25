# KiwiVoca Design System — build conventions

KiwiVoca is a Korean-first language-learning UI with a warm **"kiwi" theme**: kiwi-green + cream + a coral **"pop"** accent, rounded shapes, soft shadows, and Pretendard (body) / Quicksand (display) fonts. Components are React (import from `window.KiwiVoca.*`) styled with **Tailwind utility classes bound to design tokens**. Never hardcode hex — always use the token utilities below.

## Setup
- The compiled `styles.css` carries every token + utility + the brand-font `@import`s. Tokens are CSS variables on `:root` (light — "Orchard Pop") and `.dark` (dark — "Orchard at Dusk"). **Dark mode:** add `class="dark"` to a root element and every token flips automatically.
- Body text inherits the Pretendard sans font and `text-seed` color from `body` — you don't set them per element. Use `font-display` for headings (Quicksand).
- **Toasts:** wrap the app in `ToastProvider`, then call the `useToast()` hook — `const t = useToast(); t.success("저장했어요")` / `t.error(…)` / `t.info(…)`.

## Styling idiom — token-backed Tailwind utilities
Style with these classes (all accept opacity modifiers, e.g. `bg-kiwi/50`, `text-seed/60`):

| Concern | Classes |
|---|---|
| Brand green | `bg-kiwi` (CTA), `bg-kiwi-600` (hover), `bg-kiwi-50`/`bg-kiwi-100` (soft chips), `text-kiwi-700` (chip text) |
| Coral accent | `bg-pop`, `text-pop-dark`, `bg-pop-soft`, `shadow-pop` |
| Text | `text-seed` (primary); muted text via opacity: `text-seed/60`, `text-seed/45` |
| Surfaces / lines | `bg-surface` (cards), `bg-cream` / `bg-bg` (page), `bg-ink-100` (subtle fill), `ring-border` / `border-border` |
| Semantic | `text-success` + `bg-success-soft`; likewise `warning`, `danger`, `info` |
| Accent | `text-bark` / `bg-bark` (earthy brown) |
| Type | headings `font-display`; sizes `text-display` `text-h1` `text-h2` `text-h3` `text-body` `text-body-sm` `text-caption` |
| Radius | `rounded-2xl` (16px — controls), `rounded-3xl` (24px — cards) |
| Elevation | `shadow-sm` `shadow-soft` `shadow-lg` `shadow-xl`; `shadow-kiwi-glow` (green CTA), `shadow-pop` (coral CTA) |
| Texture | `bg-orchard` (page gradient), `seed-dots` (dotted texture), `skeleton-shimmer` (loading) |

## Where the truth lives
- `styles.css` (and its `@import`ed `_ds_bundle.css`) — every token + utility; read it before styling.
- Per component: `components/general/<Name>/<Name>.d.ts` (props contract) and `<Name>.prompt.md` (usage).

## Idiomatic snippet
```tsx
// Deck summary — library Card/Badge/Button + token utilities for layout glue
<Card elevation="md" padding="md" interactive>
  <div className="flex items-center justify-between">
    <h3 className="text-h3 font-display text-seed">토익 빈출 600</h3>
    <Badge tone="kiwi">진행중</Badge>
  </div>
  <p className="mt-1 text-body-sm text-seed/60">단어 124개 · 78% 완료</p>
  <Button variant="primary" fullWidth className="mt-4">이어서 학습</Button>
</Card>
```
