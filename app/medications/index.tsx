/**
 * My medications catalog — add, edit, archive, restore.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { medicationDoseLabel } from '@/src/domain/labels';
import type { Medication } from '@/src/domain/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

export default function MedicationsScreen() {
  const router = useRouter();
  const { medicationRepository } = useDatabase();
  const [active, setActive] = useState<Medication[]>([]);
  const [archived, setArchived] = useState<Medication[]>([]);

  const reload = useCallback(() => {
    if (!medicationRepository) return;
    setActive(medicationRepository.listMedications());
    setArchived(
      medicationRepository
        .listMedications({ includeArchived: true })
        .filter((item) => item.isArchived)
    );
  }, [medicationRepository]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return (
    <Screen scroll>
      <Text style={styles.subtitle}>
        Сохранённые лекарства для быстрого приёма во время приступа.
      </Text>

      <Button
        title="+ Добавить лекарство"
        onPress={() => router.push('/medication-form')}
        style={styles.cta}
      />

      {active.length === 0 ? (
        <Text style={styles.empty}>Пока нет сохранённых лекарств.</Text>
      ) : (
        active.map((medication) => (
          <MedicationRow
            key={medication.id}
            medication={medication}
            onPress={() =>
              router.push({
                pathname: '/medication-form',
                params: { id: medication.id },
              })
            }
          />
        ))
      )}

      {archived.length > 0 ? (
        <>
          <Text style={styles.section}>В архиве</Text>
          {archived.map((medication) => (
            <View key={medication.id} style={styles.archivedRow}>
              <MedicationRow medication={medication} muted />
              <Button
                title="Вернуть"
                variant="ghost"
                onPress={() => {
                  medicationRepository?.reactivateMedication(medication.id);
                  reload();
                }}
              />
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function MedicationRow({
  medication,
  onPress,
  muted = false,
}: {
  medication: Medication;
  onPress?: () => void;
  muted?: boolean;
}) {
  const dose = medicationDoseLabel(medication.defaultDose, medication.unit);
  const content = (
    <>
      <Text style={[styles.name, muted ? styles.mutedText : null]}>
        {medication.name}
      </Text>
      {dose ? (
        <Text style={styles.dose}>{dose}</Text>
      ) : (
        <Text style={styles.dose}>Доза не указана</Text>
      )}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={medication.name}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  cta: {
    marginBottom: spacing.lg,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
  },
  section: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  row: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
    justifyContent: 'center',
  },
  archivedRow: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.subtitle,
    color: colors.text,
  },
  mutedText: {
    color: colors.textSecondary,
  },
  dose: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
});
