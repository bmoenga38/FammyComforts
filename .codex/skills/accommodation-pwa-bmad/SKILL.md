---
name: accommodation-pwa-bmad
description: Use for Fammy Comforts accommodation operations PWA work when planning, designing, implementing, or reviewing features with the local rental-app-specific method, PRD, Arrowpath-inspired design system, UI samples, PWA requirements, role-based workflows, or hotel/property operations domain context.
---

# Accommodation PWA Method

Use this skill to work on the Fammy Comforts accommodation operations PWA in this repository.

## Core Workflow

1. Read `PRD.md` for product scope.
2. Read `DEMO_REVIEW_REPORT.md` when the task depends on the reviewed Kemettech demo.
3. Read `DEVELOPMENT_PHASES.md` when sequencing delivery work.
4. Read `FAMMY_COMFORTS_METHOD.md` when using the project-specific planning, UX, architecture, backlog, implementation, QA, and launch method.
5. Read `DESIGN_SYSTEM.md` when creating UI, frontend code, design tokens, icons, or samples.
6. Read `UI_SAMPLES.md` when choosing which visual references or prototype screens to build.
7. Use `method/` templates as the local planning source of truth.

## Product Rules

- Keep guest, admin, front desk, operations manager, caretaker, housekeeping, restaurant/kitchen, and finance workflows distinct.
- Treat mobile PWA support as a core requirement.
- Include offline behavior for caretaker, housekeeping, maintenance, asset check, and task-update workflows.
- Include audit logging for payments, bookings, guest identity, room status, staff permissions, inventory, assets, and reports.
- Use role-based permissions for all staff-facing functionality.

## UI Rules

- Use `Inter` for default UI, `Space Grotesk` for headings, optional `Syne` for premium display moments, and `JetBrains Mono` for references and compact numeric data.
- Support both dark and light mode using the tokens in `DESIGN_SYSTEM.md`.
- Prefer `lucide-react` icons for implementation.
- Keep admin screens dense, scannable, and operational.
- Keep guest screens polished, clear, and conversion-focused.
- Do not copy Arrowpath fleet content; adapt its visual style to accommodation operations.
