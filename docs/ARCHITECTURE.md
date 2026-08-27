# Architecture — Pain Diary (Phase 1)

Engineering overview of the local-first Android Expo app **Дневник головной боли**.

## Goals

- Local-first headache diary for RuStore / Android
- UUID string IDs, ISO-8601 UTC timestamps, local `YYYY-MM-DD` calendar days
- Hybrid normalized SQLite schema (schema version 1)
- No cloud sync in Phase 1

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Expo SDK 57, React Native 0.86, React 19 |
| Navigation | Expo Router (tabs) |
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
src/providers/        # React context (DatabaseProvider)
src/repositories/     # CRUD + validation before write
src/db/               # Adapters, migrations, opener
src/domain/           # Codes, types, validation, errors
src/utils/            # id, timestamps, localDate, numeric
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

Foreign keys are enabled per connection (`PRAGMA foreign_keys = ON`).

## Calendar days vs timestamps

- Event times: ISO-8601 UTC strings (`nowIsoUtc`, `assertIsoTimestamp`).
- Calendar days: local `YYYY-MM-DD` via `src/utils/localDate.ts`.
- **Never** take `substring(0, 10)` of a UTC ISO string for a “day”.

## Domain vocabulary

Controlled codes (`LocationCode`, `SymptomCode`, `FactorCode`, etc.) live in `src/domain/codes.ts`.  
`episode_factors` store *possible triggers*, not medical causes.

## Phase 1 out of scope

- Full diary / analytics UI
- Reminder delivery (settings flag only)
- Export / backup / sync
- Cloud accounts

## Testing

```bash
npm test
```

Repository tests open an in-memory `sql.js` DB, wrap it with `createSqlJsAdapter`, then `createDatabaseFromClient` / `runMigrations`.
