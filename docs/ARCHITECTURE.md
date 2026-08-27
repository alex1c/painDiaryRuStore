# Architecture — Pain Diary

Engineering overview of the local-first Android Expo app **Дневник головной боли**.

## Goals

- Local-first headache diary for RuStore / Android
- UUID string IDs, ISO-8601 UTC timestamps, local `YYYY-MM-DD` calendar days
- Hybrid normalized SQLite schema (schema version **2**)
- No cloud sync

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Expo SDK 57, React Native 0.86, React 19 |
| Navigation | Expo Router (tabs + modals) |
| Storage | `expo-sqlite` (`openDatabaseSync`) |
| Language | TypeScript strict |
| Tests | Jest + `sql.js` in-memory adapter |

## Package identity

- Android package: `com.calculatorplatform.paindiary`
- Scheme: `paindiary`
- DB file: `pain_diary.db`

## Layering

```
app/                  # Expo Router screens (UI only)
components/ui/        # Presentational primitives
components/episode/   # IntensityScale, DateTimeField
src/providers/        # React context (DatabaseProvider)
src/repositories/     # CRUD + validation before write
src/db/               # Adapters, migrations, opener
src/domain/           # Codes, types, validation, errors
src/utils/            # id, timestamps, localDate, numeric, formatters
src/theme/            # Design tokens
```

### Data flow

1. UI calls repositories via `useDatabase()`.
2. Repositories validate with `src/domain/validation.ts`.
3. Writes go through `SqlDatabase` (`run` / `withTransaction`).
4. On device: `expoSqliteAdapter`; in tests: `sqlJsAdapter`.

## Schema & migrations

- Migrations live in `src/db/migrations/` as numbered modules.
- `runMigrations` applies pending versions using `PRAGMA user_version`.
- Each migration runs inside a transaction; version bumps only on success.
- Init is **idempotent**; there is **no destructive reset**.
- **v1**: initial tables. **v2**: composite index `(episode_id, recorded_at)` on intensity.

Foreign keys are enabled per connection (`PRAGMA foreign_keys = ON`).

## Phase 2 episode rules

### One active episode

- At most one episode with `endedAt === null`.
- `startEpisode` / active `createEpisode` reject a second active.
- If corrupted data has multiple actives: `getActiveEpisode()` returns the newest by `started_at` (then `created_at`, `id`); **no automatic deletes**.

### Intensity history

- Current intensity = latest `PainIntensityEntry` by `recorded_at DESC, created_at DESC, id DESC`.
- Never store a denormalized `currentIntensity` on the episode.
- Duplicate same intensity (no forced time change) is skipped.

### Today local-date policy

- Completed episodes on the Today list belong to the **local calendar date of `startedAt`**.
- Cross-midnight episodes are **not** split; they stay on the start day.
- Active episodes are shown in the active card regardless of start day.

### Persistence

- SQLite is the source of truth for active state.
- Today screen reloads on focus and AppState `active`; duration ticks ~every minute.

## Calendar days vs timestamps

- Event times: ISO-8601 UTC strings (`nowIsoUtc`, `assertIsoTimestamp`).
- Calendar days: local `YYYY-MM-DD` via `src/utils/localDate.ts`.
- **Never** take `substring(0, 10)` of a UTC ISO string for a “day”.
- “Future” writes rejected with a small clock-skew tolerance (`FUTURE_TOLERANCE_MS`).

## Domain vocabulary

Controlled codes (`LocationCode`, `SymptomCode`, `FactorCode`, etc.) live in `src/domain/codes.ts`.  
`episode_factors` store *possible triggers*, not medical causes.

## Out of scope (later phases)

- Medications, symptoms, triggers, daily check-in UI
- Charts / analytics / PDF / ads / AppMetrica / notifications / backup

## Testing

```bash
npm test
```

Repository tests open an in-memory `sql.js` DB, wrap it with `createSqlJsAdapter`, then `createDatabaseFromClient` / `runMigrations`.
