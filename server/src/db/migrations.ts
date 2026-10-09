/**
 * Forward-only SQL migrations. Kept in TypeScript (rather than .sql files) so they are
 * bundled into the production build with no extra file copying. Append new entries; never
 * edit one that has shipped.
 */
export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: '001_create_applications',
    sql: /* sql */ `
      -- gen_random_uuid() is built in from Postgres 13 onward.
      CREATE TABLE applications (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company         text NOT NULL CHECK (char_length(company) BETWEEN 1 AND 120),
        role            text NOT NULL CHECK (char_length(role) BETWEEN 1 AND 160),
        link            text,
        status          text NOT NULL DEFAULT 'wishlist'
                        CHECK (status IN ('wishlist', 'applied', 'interviewing', 'offer', 'rejected')),
        applied_date    date,
        follow_up_date  date,
        notes           text NOT NULL DEFAULT '',
        referral_name   text,
        referral_status text NOT NULL DEFAULT 'not_asked'
                        CHECK (referral_status IN ('not_asked', 'asked', 'referred')),
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX applications_status_idx ON applications (status);
      CREATE INDEX applications_follow_up_idx ON applications (follow_up_date)
        WHERE follow_up_date IS NOT NULL;
      CREATE INDEX applications_updated_at_idx ON applications (updated_at DESC);

      -- Keep updated_at honest regardless of which code path writes the row.
      CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER applications_set_updated_at
        BEFORE UPDATE ON applications
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `,
  },
  {
    id: '002_users_and_sessions',
    sql: /* sql */ `
      CREATE TABLE users (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
        -- Demo sandboxes have no credentials.
        email         text UNIQUE CHECK (email = lower(email)),
        password_hash text,
        is_demo       boolean NOT NULL DEFAULT false,
        expires_at    timestamptz,
        created_at    timestamptz NOT NULL DEFAULT now(),
        CHECK (is_demo OR (email IS NOT NULL AND password_hash IS NOT NULL)),
        CHECK (NOT is_demo OR expires_at IS NOT NULL)
      );
      CREATE INDEX users_demo_expiry_idx ON users (expires_at) WHERE is_demo;

      -- Only a SHA-256 of each session token is stored, so a leaked sessions table
      -- can't be used to impersonate anyone.
      CREATE TABLE sessions (
        token_hash text PRIMARY KEY,
        user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX sessions_user_idx ON sessions (user_id);
      CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

      -- Rows created before accounts existed have no owner and were sample data; drop them.
      DELETE FROM applications;
      ALTER TABLE applications
        ADD COLUMN user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE;

      -- Every list query filters by user, then by status or sorts by recency.
      DROP INDEX applications_status_idx;
      DROP INDEX applications_updated_at_idx;
      CREATE INDEX applications_user_status_idx ON applications (user_id, status);
      CREATE INDEX applications_user_updated_idx ON applications (user_id, updated_at DESC);
    `,
  },
  {
    // Phase 1 (Prep planner). Purely additive: a new table, nothing existing is touched.
    id: '003_tasks',
    sql: /* sql */ `
      CREATE TABLE tasks (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        title      text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
        notes      text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
        due_date   date,
        priority   text NOT NULL DEFAULT 'none'
                   CHECK (priority IN ('none', 'low', 'medium', 'high')),
        tags       text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 10),
        done_at    timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- Open lists (today / upcoming / someday) filter on due_date; Done sorts by done_at.
      CREATE INDEX tasks_user_open_due_idx ON tasks (user_id, due_date) WHERE done_at IS NULL;
      CREATE INDEX tasks_user_done_idx ON tasks (user_id, done_at DESC) WHERE done_at IS NOT NULL;

      CREATE TRIGGER tasks_set_updated_at
        BEFORE UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `,
  },
  {
    // Phase 2 (study plans). Purely additive: two new tables.
    id: '004_study_plans',
    sql: /* sql */ `
      -- One row per user per plan (e.g. 'neetcode150'). The day-by-day schedule is computed,
      -- not stored, so changing pace or study days never leaves stale rows behind.
      CREATE TABLE study_plans (
        user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        plan_key   text NOT NULL CHECK (char_length(plan_key) BETWEEN 1 AND 40),
        pace       text NOT NULL CHECK (pace IN ('low', 'medium', 'high')),
        study_days smallint[] NOT NULL
                   CHECK (cardinality(study_days) BETWEEN 1 AND 7
                          AND study_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]),
        start_date date NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, plan_key)
      );

      CREATE TRIGGER study_plans_set_updated_at
        BEFORE UPDATE ON study_plans
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

      -- Solved problems, independent of any plan (resetting a plan keeps your progress).
      CREATE TABLE problem_progress (
        user_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        slug      text NOT NULL CHECK (char_length(slug) BETWEEN 1 AND 100),
        solved_on date NOT NULL,
        solved_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, slug)
      );
    `,
  },
  {
    // Phase 3 (revision reminders, streaks, goals). New nullable/defaulted columns + new tables.
    id: '005_revision_and_goals',
    sql: /* sql */ `
      ALTER TABLE problem_progress
        ADD COLUMN rating           text CHECK (rating IN ('hard', 'ok', 'easy')),
        ADD COLUMN review_stage     smallint NOT NULL DEFAULT 0 CHECK (review_stage BETWEEN 0 AND 5),
        ADD COLUMN next_review_on   date,
        ADD COLUMN last_reviewed_on date,
        ADD COLUMN review_count     integer NOT NULL DEFAULT 0 CHECK (review_count >= 0);

      -- Problems solved before this feature existed: first review a week after solving.
      UPDATE problem_progress SET review_stage = 2, next_review_on = solved_on + 7;

      CREATE INDEX problem_progress_due_idx ON problem_progress (user_id, next_review_on)
        WHERE next_review_on IS NOT NULL;

      -- One row per review, for the activity heatmap and streaks.
      CREATE TABLE problem_reviews (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        slug        text NOT NULL CHECK (char_length(slug) BETWEEN 1 AND 100),
        reviewed_on date NOT NULL,
        rating      text NOT NULL CHECK (rating IN ('hard', 'ok', 'easy')),
        created_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX problem_reviews_user_day_idx ON problem_reviews (user_id, reviewed_on);

      CREATE TABLE prep_goals (
        user_id             uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        target_date         date NOT NULL,
        weekly_problems     smallint NOT NULL CHECK (weekly_problems BETWEEN 0 AND 100),
        weekly_applications smallint NOT NULL CHECK (weekly_applications BETWEEN 0 AND 200),
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now()
      );
      CREATE TRIGGER prep_goals_set_updated_at
        BEFORE UPDATE ON prep_goals
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `,
  },
];
