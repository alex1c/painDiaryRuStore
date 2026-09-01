/**
 * Grouped analytics section with title and optional hint.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/src/theme/tokens';

type AnalyticsSectionProps = {
  title: string;
  hint?: string;
  children: React.ReactNode;
};

export function AnalyticsSection({ title, hint, children }: AnalyticsSectionProps) {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.body}>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  body: {
    gap: spacing.sm,
  },
});
