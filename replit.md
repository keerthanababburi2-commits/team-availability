# Team Availability Tracker

A real-time team availability dashboard where managers can see all team members and toggle their availability on/off, with every change persisting to a PostgreSQL database.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/team-availability run dev` — run the frontend (port 18183)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/team-members.ts` — Drizzle schema for the `team_members` table
- `artifacts/api-server/src/routes/users.ts` — API routes for users and stats
- `artifacts/team-availability/src/` — React frontend

## Architecture decisions

- Date serialization: DB returns `Date` objects; routes call `.toISOString()` via `serializeMember()` helper before Zod parsing, since the OpenAPI spec declares `createdAt` as `string`.
- Optimistic UI: availability toggles update the local React Query cache instantly, then confirm from server, reverting on error.
- Avatar colors: stored as Tailwind color class names (e.g. `bg-violet-500`) in the DB and rendered as initials circles on the frontend.

## Product

- Dashboard showing all team members with colored avatar initials, role, and availability status
- Toggle switches per member that instantly update availability in the DB
- Summary stats bar: Total / Active / Away counts
- Filter by All / Available / Unavailable
- Search bar to filter by name
- Add member form (modal) and inline delete

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, run `pnpm --filter @workspace/api-spec run codegen` before touching routes or frontend.
- DB returns `Date` objects for timestamp columns — always serialize via `serializeMember()` before Zod parsing in route handlers.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
