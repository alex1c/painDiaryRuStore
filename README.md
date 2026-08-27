# Дневник головной боли

Локальный Android-дневник головной боли (Expo / React Native) для RuStore.  
**Phase 1** — фундамент: SQLite-схема, домен, репозитории, вкладки-заглушки.

Пакет: `com.calculatorplatform.paindiary`

## Возможности Phase 1

- Локальная БД (`expo-sqlite`) с миграциями и внешними ключами
- Эпизоды боли, интенсивность, теги, препараты, ежедневные check-in, настройки
- 4 вкладки: Сегодня, Дневник, Аналитика, Ещё (UI-заглушки)

## Требования

- Node.js 20+ (рекомендуется 22 для `crypto.randomUUID` в тестах)
- Android Studio / эмулятор или устройство для `expo start --android`

## Установка

```bash
npm install
```

## Запуск

```bash
npm start
npm run android
```

## Проверки качества

```bash
npm test
npm run lint
npm run typecheck
npm run doctor
```

## Структура

```
app/                 # Expo Router (вкладки)
components/ui/       # Screen, Button, Card
src/domain/          # Коды, типы, валидация, ошибки
src/db/              # Адаптеры, миграции, opener
src/repositories/    # Доступ к данным
src/providers/       # DatabaseProvider
src/theme/           # Токены дизайна
src/utils/           # id, timestamps, localDate, numeric
docs/                # ARCHITECTURE, PRIVACY_DATA_MODEL
__tests__/           # Jest + sql.js
```

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/PRIVACY_DATA_MODEL.md](docs/PRIVACY_DATA_MODEL.md).

## Приватность

Данные хранятся только на устройстве. Облачной синхронизации в Phase 1 нет.
