/**
 * Local-date picker for doctor report custom period (date only).
 */

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { parseLocalDate, toLocalDateString } from '@/src/utils/localDate';

type LocalDateFieldProps = {
  label: string;
  valueLocal: string;
  onChangeLocal: (localDate: string) => void;
};

/**
 * Shows a Russian local date chip and opens the native date picker.
 */
export function LocalDateField({
  label,
  valueLocal,
  onChangeLocal,
}: LocalDateFieldProps) {
  const [open, setOpen] = useState(false);
  const value = parseLocalDate(valueLocal);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
    }
    if (event.type === 'dismissed' || !selected) {
      return;
    }
    onChangeLocal(toLocalDateString(selected));
  };

  const display = value.toLocaleDateString('ru-RU');

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${display}`}
        onPress={() => setOpen(true)}
        style={styles.chip}
      >
        <Text style={styles.chipText}>{display}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chip: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  chipText: {
    ...typography.body,
    color: colors.text,
  },
});
