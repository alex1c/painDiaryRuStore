/**
 * Compact date/time field using the community DateTimePicker (Android-friendly).
 */

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { formatLocalTime } from '@/src/utils/formatTime';

type DateTimeFieldProps = {
  label: string;
  /** Current value as ISO-8601 UTC string. */
  valueIso: string;
  onChangeIso: (iso: string) => void;
  /** When true, also allow changing the calendar date. */
  includeDate?: boolean;
};

/**
 * Shows local time (and optional date); opens native picker on press.
 */
export function DateTimeField({
  label,
  valueIso,
  onChangeIso,
  includeDate = false,
}: DateTimeFieldProps) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);
  const value = new Date(valueIso);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setMode(null);
    }
    if (event.type === 'dismissed' || !selected) {
      return;
    }

    const next = new Date(value);
    if (mode === 'date') {
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    } else {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }
    onChangeIso(next.toISOString());
  };

  const display = includeDate
    ? `${value.toLocaleDateString('ru-RU')} ${formatLocalTime(valueIso)}`
    : formatLocalTime(valueIso);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {includeDate ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}, изменить дату`}
            onPress={() => setMode('date')}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{value.toLocaleDateString('ru-RU')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, изменить время, сейчас ${formatLocalTime(valueIso)}`}
          onPress={() => setMode('time')}
          style={styles.chip}
        >
          <Text style={styles.chipText}>{includeDate ? formatLocalTime(valueIso) : display}</Text>
        </Pressable>
      </View>

      {mode != null ? (
        <DateTimePicker
          value={Number.isNaN(value.getTime()) ? new Date() : value}
          mode={mode}
          is24Hour
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
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
  },
  chipText: {
    ...typography.body,
    color: colors.text,
  },
});

export default DateTimeField;
