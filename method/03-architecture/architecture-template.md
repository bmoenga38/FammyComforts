# Architecture Template

## System Overview

Describe the frontend, backend, database, storage, queues, realtime, integrations, and deployment.

## Recommended Stack

- Frontend: React/Next.js with TypeScript
- UI: Tailwind CSS and reusable component system
- Icons: lucide-react
- Backend: Laravel, NestJS, or Django REST depending on final team choice
- Database: PostgreSQL or MySQL
- Storage: S3-compatible object storage
- Realtime: WebSockets or managed realtime service
- Queue: Redis-backed jobs
- PWA: service worker, manifest, offline shell, background sync where supported

## Core Modules

- Auth and roles
- Guest booking
- Bookings and front desk
- Rooms and availability
- Housekeeping and operations
- Assets and maintenance
- Payments and receipts
- Inventory and purchases
- Restaurant and kitchen
- Reports and exports
- Notifications
- Settings and audit logs

## Architecture Decisions

For each decision include:

- Context
- Decision
- Alternatives considered
- Consequences
- Rollback path

