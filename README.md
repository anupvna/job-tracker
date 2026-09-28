# Job Tracker

A full-stack job application tracker for managing a new-grad search: pipeline stages, referral contacts, and follow-up reminders on one dashboard.

**Stack:** React 19 · TypeScript · TanStack Query · Tailwind CSS · Node.js · Express 5 · PostgreSQL · Zod · Vitest

**Live demo:** _add your Replit URL here_

![Dashboard](docs/screenshot.png)

## Features

- **CRUD for applications:** company, role, posting link, status, applied date, notes
- **Pipeline stages:** Wishlist → Applied → Interviewing → Offer / Rejected, changeable inline from the table
- **Referral tracking:** contact name plus status (Not asked / Asked / Referred), searchable
- **Follow-up reminders:** overdue follow-ups are highlighted in red, with a banner and a one-click "overdue only" filter. Closed applications (offer or rejected) are never flagged.
- **Dashboard:** counts per status that double as filter tabs, a pipeline distribution bar, search, and sortable columns
- **Shareable views:** filters and sort live in the URL
- **UX details:** optimistic updates, debounced search, keyboard shortcuts (`N` = new, `⌘↵` = save, `Esc` = close), a card layout on phones, accessible native dialogs, loading/empty/error states, and one-click sample data

## Architecture

```
job-tracker/
├── shared/   @job-tracker/shared: Zod schemas + TS types, used by BOTH client and server
├── server/   Express REST API
│   └── src/
│       ├── app.ts                      app factory (dependency-injected, used by tests)
│       ├── index.ts                    bootstrap: config → migrate → listen → graceful shutdown
│       ├── config.ts                   env validated with Zod at startup
│       ├── db/                         pg pool, forward-only migrations, seed data
│       ├── middleware/                 validation + centralized error handling
│       └── modules/applications/       routes → service → repository
└── client/   React SPA (Vite)
    └── src/
        ├── api/                        typed fetch client
        ├── hooks/                      TanStack Query hooks, URL-synced filters
        ├── components/                 table, summary, drawer form, dialogs
        └── lib/                        date + status helpers
```

**Design decisions**

- **One contract, two runtimes.** The request schemas in `shared/` validate API input on the server _and_ power the React form (via `react-hook-form` + `zodResolver`), so client and server can't disagree about what's valid.
- **Layered backend.** Routes handle HTTP only, the service holds business rules (404s, sample-data guard), and the repository owns all SQL. Every query is parameterized; sort columns come from a whitelist.
- **Correct dates.** Dates are stored as Postgres `DATE` and sent as `YYYY-MM-DD` strings (the pg DATE parser is overridden). The client sends its local "today", so "overdue" matches the user's timezone rather than the server's.
- **Integrity at the DB layer too.** `CHECK` constraints on enums and lengths, a trigger-maintained `updated_at`, and indexes on status and follow-up date.
- **Production-ready server.** Helmet, compression, rate-limiting on writes (there's no auth), a health check that pings the DB, advisory-locked migrations on boot, and graceful shutdown.

## REST API

| Method   | Path                            | Description                                                          |
| -------- | ------------------------------- | -------------------------------------------------------------------- |
| `GET`    | `/api/applications`             | List. Query: `status`, `q`, `overdue=true`, `today`, `sort`, `order` |
| `GET`    | `/api/applications/stats`       | Counts per status + overdue follow-ups                               |
| `GET`    | `/api/applications/:id`         | Get one                                                              |
| `POST`   | `/api/applications`             | Create (`201` + `Location`)                                          |
| `PATCH`  | `/api/applications/:id`         | Partial update                                                       |
| `DELETE` | `/api/applications/:id`         | Delete (`204`)                                                       |
| `POST`   | `/api/applications/sample-data` | Seed an empty tracker (`409` if not empty)                           |
| `GET`    | `/api/health`                   | Liveness + DB check                                                  |

Errors use one shape: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [{ "path": "company", "message": "Company is required" }] } }`

## Running locally

Requires Node 20+ and Postgres (or Docker).

```bash
cp .env.example .env
docker compose up -d db            # or point DATABASE_URL at your own Postgres
npm install
npm run db:seed                    # optional: migrate + add sample data
npm run dev                        # API on :3001, web on http://localhost:5173
```

The server runs migrations automatically on startup.

## Tests

```bash
createdb job_tracker_test          # once
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/job_tracker_test npm test
```

- **server:** integration tests with Supertest against a real Postgres (CRUD, validation, filters, overdue logic, sorting, 404/400 paths)
- **shared:** schema normalization and follow-up classification
- **client:** component tests for the table and mobile card list (overdue highlighting, inline status, sorting)

CI (GitHub Actions) runs lint, typecheck, tests against a Postgres service container, and a production build on every push.

## Deploying to Replit

1. Push this repo to GitHub, then in Replit go to **Create App → Import from GitHub**.
2. Open the **Database** tool and create a PostgreSQL database. Replit sets `DATABASE_URL` for you.
3. Click **Run**. It installs dependencies, builds the React app, and serves everything from Express on one port.
4. Click **Publish** (Autoscale). Build and run commands are already in `.replit`. When prompted, add a production database so `DATABASE_URL` is available to the published app.

Also deployable anywhere Docker runs: `docker compose --profile full up --build`.

## Roadmap

- Auth (per-user trackers) with row-level ownership
- Kanban board view with drag-and-drop between stages
- Email/calendar reminders for follow-ups
- Pagination and full-text search for large lists
