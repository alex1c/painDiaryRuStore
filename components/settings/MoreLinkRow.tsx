/**
 * Tappable navigation row used on the More tab and settings sections.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type Props = {
  title: string;
  hint?: string;
  href: string;
  /** When true, uses danger accent for destructive destinations. */
  danger?: boolean;
};

export function MoreLinkRow({ title, hint, href, danger = false }: Props) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => router.push(href as never)}
      style={({ pressed }) => [
        styles.row,
        danger ? styles.dangerRow : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.textBlock}>
        <Text style={[styles.title, danger ? styles.dangerTitle : null]}>
          {title}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dangerRow: {
    borderColor: colors.danger,
  },
  textBlock: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  dangerTitle: {
    color: colors.danger,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  chevron: {
    ...typography.title,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.85,
  },
});
