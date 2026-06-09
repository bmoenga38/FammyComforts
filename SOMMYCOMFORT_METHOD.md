# Fammy Comforts Method

This project uses a custom planning and delivery method for building the Fammy Comforts rental/accommodation operations PWA from scratch to production.

The method replaces the copied BMAD package. It keeps the useful discipline of structured planning, but every workflow is specific to accommodation, rentals, guest stays, staff operations, payments, housekeeping, assets, restaurant service, inventory, and reporting.

## Method Stages

| Stage | Folder | Purpose |
|---|---|---|
| 01 Product | `method/01-product/` | Define scope, users, value, business rules, and acceptance criteria |
| 02 UX | `method/02-ux/` | Design guest, admin, front desk, operations, caretaker, and staff experiences |
| 03 Architecture | `method/03-architecture/` | Define system architecture, database, API, PWA, auth, realtime, and integrations |
| 04 Backlog | `method/04-backlog/` | Convert PRD and architecture into epics, stories, tasks, and milestones |
| 05 Implementation | `method/05-implementation/` | Guide engineering execution, feature buildout, reviews, and release notes |
| 06 QA | `method/06-qa/` | Validate workflows, permissions, offline behavior, reports, and production readiness |
| 07 Launch | `method/07-launch/` | Prepare deployment, migration, training, support, and post-launch stabilization |

## Working Rules

- Every feature must identify the user role it serves.
- Every operational workflow must define status transitions.
- Every money-related workflow must define audit logs and reconciliation rules.
- Every guest identity workflow must define privacy, retention, and access control.
- Every mobile staff workflow must define offline behavior.
- Every report must trace to source records.
- Every implementation story must include acceptance criteria and test notes.

## Core Documents

- `PRD.md`: product requirements.
- `DEVELOPMENT_PHASES.md`: delivery phases.
- `DEMO_REVIEW_REPORT.md`: reviewed reference app findings.
- `DESIGN_SYSTEM.md`: visual system, fonts, colors, light/dark mode, icons.
- `UI_SAMPLES.md`: UI sample reference index.

## Recommended Flow

1. Update product scope in `method/01-product/product-brief-template.md`.
2. Create UX scope using `method/02-ux/ux-design-template.md`.
3. Define technical architecture using `method/03-architecture/architecture-template.md`.
4. Break delivery into epics using `method/04-backlog/epics-template.md`.
5. Create buildable stories using `method/04-backlog/story-template.md`.
6. Execute features using `method/05-implementation/implementation-checklist.md`.
7. Validate with `method/06-qa/qa-checklist.md`.
8. Launch with `method/07-launch/launch-checklist.md`.

