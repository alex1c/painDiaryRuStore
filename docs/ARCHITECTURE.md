# Architecture — Pain Diary

Engineering overview of the local-first Android Expo app **Дневник головной боли**.

## Goals

- Local-first headache diary for RuStore / Android
- UUID string IDs, ISO-8601 UTC timestamps, local `YYYY-MM-DD` calendar days
- Hybrid normalized SQLite schema (schema version **3**)
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
components/episode/   # IntensityScale, DateTimeField, ChipSelect
src/providers/        # React context (DatabaseProvider)
src/repositories/     # CRUD + validation before write
src/db/               # Adapters, migrations, opener
src/domain/           # Codes, labels, types, validation, errors
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
- **v1**: initial tables. **v2**: intensity `(episode_id, recorded_at)` index.
- **v3**: `custom_factors` table + `episode_factors.custom_factor_id`.
- Never edit published migrations; always add a new version.

## Phase 2 episode rules

### One active episode

- At most one episode with `endedAt === null`.
- Corrupted multiples: newest by `started_at` wins; no automatic deletes.

### Intensity history

- Current intensity = latest entry by `recorded_at DESC, created_at DESC, id DESC`.
- Duplicate same intensity is skipped (unless forced).

### Today local-date policy

- Completed Today list = local calendar date of `startedAt` (no cross-midnight split).

## Phase 3 pain details

### Aggregate

`HeadacheRepository.getEpisodeDetails(id)` returns episode + intensities + side +
locations / characters / symptoms / factors.

`replaceEpisodeDetails` updates side + all tag sets in **one transaction**.
Empty arrays clear previous tags. Undefined fields leave existing tags unchanged.

### Persisted keys vs UI labels

- SQLite stores English codes (`photophobia`, `weather_change`, …).
- Russian copy lives in `src/domain/labels.ts` only.

### Custom factors

- Table `custom_factors`: reusable names with `normalized_name` (trim + lowercase).
- Episode rows use `code = 'custom'` + `custom_factor_id`.
- Archive (soft) — historical links remain; archived factors leave the picker.

### Quick start

Phase 3 fields are **never** required for starting an episode.
Details are optional after start / from the active card.

## Out of scope (later)

Medications UI, daily check-in, charts, PDF, ads, AppMetrica, diagnosis.

## Testing

```bash
npm test
```
