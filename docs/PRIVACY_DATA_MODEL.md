# Конфиденциальность и модель данных / Privacy & Data Model

Документ для команды и будущих экранов политики конфиденциальности.  
App: **Дневник головной боли** (`com.calculatorplatform.paindiary`).

## Кратко (RU)

- Все данные о головной боли хранятся **локально на устройстве** в SQLite (`pain_diary.db`).
- В Phase 1 **нет** облачной синхронизации, аккаунтов и аналитики третьих сторон.
- Пользователь контролирует содержимое дневника; удаление эпизода каскадно удаляет связанные теги и записи интенсивности.
- «Факторы» — это **возможные триггеры**, которые указывает пользователь, а не медицинский диагноз причины.

## Summary (EN)

- Local-first: headache diary data stays on-device.
- No Phase 1 network sync of health content.
- Schema is hybrid-normalized; IDs are UUID strings.
- Timestamps are ISO-8601 UTC; calendar days are local `YYYY-MM-DD`.

## What we store

| Entity | Purpose | Sensitive? |
| --- | --- | --- |
| `headache_episodes` | Start/end, side, notes | Health |
| `pain_intensity_entries` | 0–10 intensity over time | Health |
| `episode_*` tag tables | Locations, characters, symptoms, factors | Health |
| `medications` / `medication_intakes` | Catalog + doses + effect | Health |
| `daily_check_ins` | Day-level headache / sleep / stress | Health |
| `app_settings` | Theme, onboarding, reminders flag | Preferences |

## Retention & deletion

- Soft-archive for medications (`is_archived`) keeps history of past intakes.
- Deleting an episode: `ON DELETE CASCADE` removes intensities and tag rows; medication intakes get `episode_id` set to `NULL` (`ON DELETE SET NULL`).
- Deleting a medication that still has intakes is blocked (`ON DELETE RESTRICT`).

## Local dates

Daily check-ins use **local calendar dates** (`YYYY-MM-DD`), not UTC date slices from timestamps, so “сегодня” matches the user’s timezone.

## Future (not Phase 1)

If AppMetrica / ads are added later:

- Do **not** send episode notes, intensity series, medications, symptoms, or other medical payloads.
- Analytics events must stay aggregated / non-medical (e.g. screen opens, feature toggles).

If export, backup, or sync is added later:

- Document destinations and encryption.
- Require explicit user action for any off-device transfer.
- Update this file and the in-app privacy screen together.
