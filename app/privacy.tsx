/**
 * Privacy information — local-first data handling in plain Russian.
 */

import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function PrivacyScreen() {
  const router = useRouter();
  const appName =
    Constants.expoConfig?.name ?? 'Дневник головной боли';

  return (
    <Screen scroll>
      <Text style={styles.title}>Конфиденциальность</Text>

      <Card style={styles.card}>
        <Text style={styles.body}>
          {appName} хранит записи о приступах, лекарствах, дневных отметках и
          заметках локально на вашем устройстве в базе SQLite. Для работы
          дневника не требуется аккаунт и подключение к интернету.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.body}>
          Записи о приступах, лекарствах и заметках хранятся локально и не
          отправляются разработчику текущей версией приложения.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.body}>
          PDF-отчёт, резервная копия и CSV-экспорт покидают приложение только
          когда вы сами нажимаете «Поделиться» или сохраняете файл. Хранение
          и передача таких файлов — ваша ответственность.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.body}>
          Удаление приложения или очистка данных на устройстве может удалить
          локальные записи. Регулярно создавайте резервные копии, если они вам
          нужны.
        </Text>
      </Card>

      <Button title="Назад" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
