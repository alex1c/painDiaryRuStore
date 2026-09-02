/**
 * More / settings tab — organized sections for data, app, and destructive actions.
 */

import { Screen } from '@/components/ui/Screen';
import { MoreLinkRow } from '@/components/settings/MoreLinkRow';
import { MoreSectionHeader } from '@/components/settings/MoreSectionHeader';
import { StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function MoreScreen() {
  return (
    <Screen scroll>
      <Text style={styles.title}>Ещё</Text>
      <Text style={styles.subtitle}>Данные, настройки и сведения</Text>

      <MoreLinkRow
        title="Отчёт врачу"
        hint="PDF-сводка приступов для консультации"
        href="/doctor-report"
      />
      <MoreLinkRow
        title="Мои лекарства"
        hint="Сохранённые лекарства для быстрого приёма"
        href="/medications"
      />

      <MoreSectionHeader title="Данные" />
      <MoreLinkRow
        title="Резервная копия"
        hint="Сохранить все записи в JSON-файл"
        href="/backup"
      />
      <MoreLinkRow
        title="Восстановить из копии"
        hint="Заменить текущие данные из файла"
        href="/restore"
      />
      <MoreLinkRow
        title="Экспорт CSV"
        hint="Таблицы для Excel и других программ"
        href="/export-csv"
      />

      <MoreSectionHeader title="Приложение" />
      <MoreLinkRow
        title="Настройки"
        hint="Параметры приложения"
        href="/settings"
      />
      <MoreLinkRow
        title="О приложении"
        hint="Версия и назначение"
        href="/about"
      />
      <MoreLinkRow
        title="Конфиденциальность"
        hint="Как хранятся ваши данные"
        href="/privacy"
      />

      <MoreSectionHeader title="Опасная зона" />
      <MoreLinkRow
        title="Удалить все данные"
        hint="Безвозвратно очистить дневник на устройстве"
        href="/delete-data"
        danger
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
});
