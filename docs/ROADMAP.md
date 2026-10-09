# Roadmap

Job Tracker is growing from an application tracker into a **job prep + application
tracker**: two tabs, **Prep** and **Applications**, free, private per account and usable
on a phone.

## Principles (every phase)

- **One phase = one commit = one deploy.** Each phase is tested and verified live before
  the next starts. Vercel can roll back any deploy in one click.
- **Additive database changes only.** New tables/columns; nothing renamed or dropped, so
  existing accounts and applications are never touched.
- **Tests stay green.** All existing tests keep passing and every phase adds its own.
- **Demo first.** The demo sandbox gets sample data for each new feature.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0 | App shell: top nav (Applications / Prep), phone bottom tab bar, installable (web app manifest + icons) | Done |
| 1 | Planner basics: quick add (`LC 2 mediums tomorrow #dsa !high`), Today / Upcoming / Someday / Done, tracker follow-ups shown in Today | Done |
| 2 | NeetCode 150 study plan: pick pace (low / medium / high), study days and start date → day-by-day plan in roadmap order; topic checklists with progress; plan re-flows when a day is missed | Done |
| 3 | Spaced-repetition revision reminders (1, 3, 7, 14, 30 days; sooner when rated Hard), streaks + activity heatmap, goal countdown (May 2027) + weekly targets | Done |
| 4 | Job snapshot (saved job description via Greenhouse / Lever / Ashby public APIs, paste for other sites), autofill from link, one-click save for existing applications, dead-posting detection in the daily cron (closed after 2 misses) | Done |
| 5 | Referral finder (warmest-first LinkedIn search links, message drafts, optional LinkedIn connections CSV) + outreach log with follow-up cadence | Planned |
| 6 | Version history: the exact resume / cover letter / links sent to each application (content-addressed, deduplicated) | Planned |
| 7 | Private calendar feed (.ics) + automatic interview-prep checklists + behavioral (STAR) story bank | Planned |
| 8 | Inbox autopilot: user-installed Google Apps Script classifies recruiter emails and updates statuses; emails never leave the user's Google account | Planned |

## Study plan pacing (Phase 2)

| Pace | New problems / day | Study days | NeetCode 150 finishes in about |
|---|---|---|---|
| Low | 2 | 5 / week | 15 weeks |
| Medium | 3 | 6 / week | 8–9 weeks |
| High | 5 | 6 / week | 5 weeks |

Review load is counted into each day so days don't overflow. Problems link to LeetCode and
NeetCode; we don't copy NeetCode's explanations or videos, and we credit them.

## Explicitly out of scope

- Browser extension / form autofill and AI resume tools (crowded, mostly paid elsewhere).
- Storing third-party portal passwords. We store the portal link and which email/username
  was used; passwords belong in a password manager.
- Automated LinkedIn searching or scraping (against LinkedIn's terms).
