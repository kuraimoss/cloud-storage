# Kuraimos Storage – UI/UX & Architecture Notes

## UI Concept (SaaS-grade)
- **Visual language**: clean, airy spacing, soft shadows, consistent radii, neutral background + accent highlights.
- **Information hierarchy**: topbar title + context, cards for KPIs, tables for management, quick actions for primary flows.
- **Navigation**: sidebar (desktop), off-canvas + overlay (mobile).

## Color System (HEX)
- **Background**: `#F6F0D7`
- **Surface**: `#FFFCF2`
- **Surface 2**: `#EFE7CC`
- **Border**: `#E3D9BA`
- **Text**: `#1F2A1B`
- **Muted**: `#55614A`
- **Primary**: `#89986D`
- **Accent**: `#C5D89D`
- **Success**: `#4F7A4F`
- **Danger**: `#E25555`

## Motion / Animation Guidelines
- **Duration**: 150–300ms
- **Easing**: `cubic-bezier(.2,.8,.2,1)`
- **Applied**:
  - Sidebar hover + active state
  - Card hover lift
  - Button hover + press
  - Page fade-up on load + leave transition on navigation
  - Modal open animation
  - Upload progress bar smoothing
- **Accessibility**: respect `prefers-reduced-motion`

## Backend Structure (Layered)
See `src/`:
- `routes/` → HTTP routing
- `controllers/` → request/response
- `services/` → business rules
- `repositories/` → database access
- `middlewares/` → auth + error handling

## PostgreSQL Schema
DDL lives in `db/schema.sql`:
- `users`
- `files`
- `folders`
- `shared_files`
- `activity_logs`

## Production Readiness Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Strong `SESSION_SECRET` + `SHARE_TOKEN_SECRET`
- [ ] Run `npm run db:migrate`
- [ ] Configure Postgres backups + PITR
- [ ] Enable TLS/HTTPS (reverse proxy)
- [ ] Add rate limit for `/api/auth/login`
- [ ] File antivirus scanning (optional)
- [ ] Object storage (S3/R2/MinIO) for scale
- [ ] Observability: structured logs + metrics + alerts
