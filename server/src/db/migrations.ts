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
];
