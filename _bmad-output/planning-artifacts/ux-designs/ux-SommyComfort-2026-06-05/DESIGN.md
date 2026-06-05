---
status: final
updated: 2026-06-05
owns: visual-identity
defers_to: ../../../../DESIGN_SYSTEM.md
---

# SommyComfort — DESIGN (visual identity)

> **This project's visual identity already exists** in [`DESIGN_SYSTEM.md`](../../../../DESIGN_SYSTEM.md) and is implemented in `apps/web` (Story 1.2 tokens + Story 1.3 primitives). That document is the authoritative DESIGN spine — colors, typography, status colors, component style, icons. This file intentionally does **not** duplicate it.

## Pointer

- **Colors / dark+light tokens / status colors:** `DESIGN_SYSTEM.md` → Dark Mode Tokens, Light Mode Tokens, Semantic Status Colors. Implemented as CSS custom properties + Tailwind `@theme` utilities (`bg-bg`, `text-text`, `text-success`, …).
- **Typography:** Inter (UI), Space Grotesk (headings), Syne (expressive), JetBrains Mono (IDs/amounts).
- **Shapes/spacing:** 8px radius (`rounded-lg`), 1px borders, dense operational layouts vs. spacious guest screens.
- **Components (visual):** `DESIGN_SYSTEM.md` → Component Style; primitives in `apps/web/src/components/ui/`.
- **Icons:** `lucide-react` per the documented mapping.

`EXPERIENCE.md` (sibling) references these by concept; on any conflict, `DESIGN_SYSTEM.md` (visual) and `EXPERIENCE.md` (behavior) win over mocks.
