/**
 * Wrapping multi-select / single-select chip grid for Android (360dp-friendly).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme/tokens';

export type ChipOption<T extends string> = {
  value: T;
  label: string;
};

type ChipSelectProps<T extends string> = {
  options: ChipOption<T>[];
  /** Selected values (multi). For single-select pass 0–1 items. */
  selected: T[];
  onChange: (next: T[]) => void;
  /** When true, selecting a new value replaces the previous (radio-like). */
  single?: boolean;
  /** Allow clearing the single selection by tapping again. */
  allowDeselect?: boolean;
};

/**
 * Accessible wrapping chips with min 44 touch targets.
 * Selection state is communicated via accessibilityState.selected + label text.
 */
export function ChipSelect<T extends string>({
  options,
  selected,
  onChange,
  single = false,
  allowDeselect = true,
}: ChipSelectProps<T>) {
  const toggle = (value: T) => {
    const isOn = selected.includes(value);
    if (single) {
      if (isOn && allowDeselect) {
        onChange([]);
      } else {
        onChange([value]);
      }
      return;
    }
    if (isOn) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            accessibilityRole={single ? 'radio' : 'checkbox'}
            accessibilityState={{ selected: isSelected, checked: isSelected }}
            accessibilityLabel={`${opt.label}${isSelected ? ', выбрано' : ''}`}
            onPress={() => toggle(opt.value)}
            style={({ pressed }) => [
              styles.chip,
              isSelected ? styles.chipSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text
              style={[
                styles.label,
                isSelected ? styles.labelSelected : null,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: '100%',
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
  },
  labelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default ChipSelect;
