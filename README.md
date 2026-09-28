# Job Tracker

A full-stack, multi-user job application tracker: pipeline stages, referral contacts and follow-up reminders on one private dashboard. Recruiters and visitors can open a disposable demo sandbox in one click, no sign-up needed.

**Stack:** React 19 · TypeScript · TanStack Query · Tailwind CSS · Node.js · Express 5 · PostgreSQL · Zod · Vitest

**Live demo:** https://job-tracker--anoopnavile.replit.app (click **Try the live demo**)

![Dashboard](docs/screenshot.png)

<img src="docs/sign-in.png" alt="Sign-in page" width="600">

## Features

- **Accounts:** email + password sign-up and sign-in. Each user's applications are private to them.
- **One-click demo sandbox:** every visitor gets their own throwaway account pre-filled with sample data. It's deleted automatically after 24 hours, so visitors can edit freely without touching anyone else's data.
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
│       ├── lib/                        password hashing (scrypt), cookies, errors
│       ├── middleware/                 auth + CSRF guards, validation, centralized errors
│       └── modules/
│           ├── auth/                   signup, login, sessions, demo sandboxes
│           └── applications/           routes → service → repository (all queries user-scoped)
└── client/   React SPA (Vite)
    └── src/
        ├── api/                        typed fetch client
        ├── pages/                      AuthPage (sign in / sign up / demo), Dashboard
        ├── hooks/                      TanStack Query hooks (auth + data), URL-synced filters
        ├── components/                 table, summary, drawer form, dialogs
        └── lib/                        date + status helpers
```

**Design decisions**

- **Authentication, done by hand.** Passwords are hashed with scrypt, a memory-hard algorithm built into Node, using a per-user salt and constant-time comparison. Login runs a dummy hash for unknown emails, so response timing doesn't reveal which accounts exist. Sessions are 256-bit random tokens in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Only a SHA-256 of each token is stored, so a leaked `sessions` table can't be used to log in. Logout deletes the session server-side.
- **CSRF protection.** On top of SameSite cookies, every state-changing request must carry an `X-Requested-With` header. Browsers can't add that header to cross-site requests without a CORS preflight, which the API never approves.
- **Per-user isolation at the data layer.** Every repository query filters by `user_id`. Another user's row returns `404`, not `403`, so ids can't be probed. Integration tests assert this for list, stats, read, update and delete.
- **Ephemeral demo users.** Demo accounts carry an `expires_at`. Expired sessions stop working immediately, and an hourly sweep (also run whenever a demo starts) deletes expired users. Their data goes with them through `ON DELETE CASCADE`.
- **Brute-force limits.** Credential endpoints allow 20 attempts per 15 minutes per IP, and demo creation 10 per hour.

- **One contract, two runtimes.** The request schemas in `shared/` validate API input on the server _and_ power the React form (via `react-hook-form` + `zodResolver`), so client and server can't disagree about what's valid.
- **Layered backend.** Routes handle HTTP only, the service holds business rules (404s, sample-data guard), and the repository owns all SQL. Every query is parameterized; sort columns come from a whitelist.
- **Correct dates.** Dates are stored as Postgres `DATE` and sent as `YYYY-MM-DD` strings (the pg DATE parser is overridden). The client sends its local "today", so "overdue" matches the user's timezone rather than the server's.
- **Integrity at the DB layer too.** `CHECK` constraints on enums and lengths, a trigger-maintained `updated_at`, and indexes on status and follow-up date.
- **Production-ready server.** Helmet, compression, rate-limiting on writes (there's no auth), a health check that pings the DB, advisory-locked migrations on boot, and graceful shutdown.

## REST API

All `/api/applications` routes require a signed-in session. Every non-GET request must send `X-Requested-With: fetch`.

| Method   | Path                            | Description                                                          |
| -------- | ------------------------------- | -------------------------------------------------------------------- |
| `POST`   | `/api/auth/signup`              | Create an account and start a session                                |
| `POST`   | `/api/auth/login`               | Sign in                                                              |
| `POST`   | `/api/auth/demo`                | Start a 24-hour demo sandbox pre-filled with sample data             |
| `POST`   | `/api/auth/logout`              | End the session (server-side)                                        |
| `GET`    | `/api/auth/me`                  | Current user, or `401`                                               |
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
npm run dev                        # API on :3001, web on http://localhost:5173
```

The server runs migrations automatically on startup.

## Tests

```bash
createdb job_tracker_test          # once
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/job_tracker_test npm test
```

- **server:** integration tests with Supertest against a real Postgres: auth (hashing, sessions, logout revocation, CSRF, demo expiry), cross-user isolation, CRUD, validation, filters, overdue logic and sorting
- **shared:** schema normalization and follow-up classification
- **client:** component tests for the table, the mobile card list and the auth page (overdue highlighting, inline status, sorting, shared-schema form validation)

CI (GitHub Actions) runs lint, typecheck, tests against a Postgres service container, and a production build on every push.

## Deploying to Replit

1. Push this repo to GitHub, then in Replit go to **Create App → Import from GitHub**.
2. Open the **Database** tool and create a PostgreSQL database. Replit sets `DATABASE_URL` for you.
3. Click **Run**. It installs dependencies, builds the React app, and serves everything from Express on one port.
4. Click **Publish** (Autoscale). Build and run commands are already in `.replit`. When prompted, add a production database so `DATABASE_URL` is available to the published app.

Also deployable anywhere Docker runs: `docker compose --profile full up --build`.

## Roadmap

- Kanban board view with drag-and-drop between stages
- Email/calendar reminders for follow-ups
- Pagination and full-text search for large lists
