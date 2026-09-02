/**
 * Doctor report screen — period selection, preview, PDF generation and share.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { LocalDateField } from '@/components/reports/LocalDateField';
import { ReportPeriodSelector } from '@/components/reports/ReportPeriodSelector';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import {
  buildDoctorReport,
  DEFAULT_REPORT_PERIOD,
  DoctorReportRepository,
  DoctorReportService,
  REPORT_GENERATION_ERROR,
  REPORT_NO_EPISODES_MESSAGE,
  REPORT_SHARE_UNAVAILABLE,
  validateCustomReportRange,
} from '@/src/reports';
import type { DoctorReportPdfResult, ReportPeriodPreset } from '@/src/reports/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import {
  addDaysToLocalDate,
  toLocalDateString,
} from '@/src/utils/localDate';
import { colors, spacing, typography } from '@/src/theme/tokens';

const reportService = new DoctorReportService();

export default function DoctorReportScreen() {
  const { ready, db, analyticsRepository } = useDatabase();
  const todayLocal = useMemo(() => toLocalDateString(new Date()), []);
  const [preset, setPreset] = useState<ReportPeriodPreset>(DEFAULT_REPORT_PERIOD);
  const [customFrom, setCustomFrom] = useState(
    addDaysToLocalDate(todayLocal, -29)
  );
  const [customTo, setCustomTo] = useState(todayLocal);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pdfCache, setPdfCache] = useState<{
    key: string;
    pdf: DoctorReportPdfResult;
  } | null>(null);

  const customValidation = useMemo(() => {
    if (preset !== 'custom') {
      return null;
    }
    return validateCustomReportRange(customFrom, customTo);
  }, [preset, customFrom, customTo]);

  const report = useMemo(() => {
    if (!ready || !db || !analyticsRepository || customValidation) {
      return null;
    }

    try {
      const doctorReportRepository = new DoctorReportRepository(db);
      return buildDoctorReport(analyticsRepository, doctorReportRepository, {
        preset,
        todayLocal,
        customFrom: preset === 'custom' ? customFrom : undefined,
        customTo: preset === 'custom' ? customTo : undefined,
      });
    } catch {
      return null;
    }
  }, [
    ready,
    db,
    analyticsRepository,
    preset,
    customFrom,
    customTo,
    customValidation,
    todayLocal,
  ]);

  const reportCacheKey = useMemo(
    () =>
      `${preset}:${customFrom}:${customTo}:${report?.preview.periodLabel ?? ''}`,
    [preset, customFrom, customTo, report?.preview.periodLabel]
  );
  const cachedPdf =
    pdfCache?.key === reportCacheKey ? pdfCache.pdf : null;

  const hasEpisodes = report?.preview.hasEpisodes ?? false;

  const runPdfAction = useCallback(
    async (shareAfter: boolean) => {
      if (!report || !hasEpisodes) {
        return;
      }

      setBusy(true);
      setActionError(null);

      try {
        const pdf =
          shareAfter && cachedPdf
            ? cachedPdf
            : await reportService.createPdf(report);

        if (!shareAfter || !cachedPdf) {
          setPdfCache({ key: reportCacheKey, pdf });
        }

        if (shareAfter) {
          await reportService.sharePdf(pdf.fileUri);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : REPORT_GENERATION_ERROR;
        setActionError(
          message === REPORT_SHARE_UNAVAILABLE ||
            message === REPORT_GENERATION_ERROR
            ? message
            : shareAfter
              ? REPORT_SHARE_UNAVAILABLE
              : REPORT_GENERATION_ERROR
        );
      } finally {
        setBusy(false);
      }
    },
    [report, hasEpisodes, cachedPdf, reportCacheKey]
  );

  return (
    <Screen scroll>
      <Text style={styles.subtitle}>
        Сводка для врача в формате PDF. Данные остаются только на устройстве.
      </Text>

      <ReportPeriodSelector value={preset} onChange={setPreset} />

      {preset === 'custom' ? (
        <View style={styles.customRow}>
          <LocalDateField
            label="С"
            valueLocal={customFrom}
            onChangeLocal={setCustomFrom}
          />
          <LocalDateField
            label="По"
            valueLocal={customTo}
            onChangeLocal={setCustomTo}
          />
        </View>
      ) : null}

      {customValidation ? (
        <Text style={styles.error}>{customValidation}</Text>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.previewTitle}>Предпросмотр</Text>
        {!report ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            <Text style={styles.previewLine}>
              Период: {report.preview.periodLabel}
            </Text>
            <Text style={styles.previewLine}>
              Приступов: {report.preview.episodeCount}
            </Text>
            <Text style={styles.previewLine}>
              Дней с головной болью: {report.preview.headacheDayCount}
            </Text>
            {!hasEpisodes ? (
              <Text style={styles.empty}>{REPORT_NO_EPISODES_MESSAGE}</Text>
            ) : null}
          </>
        )}
      </Card>

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      <Button
        title="Создать PDF"
        disabled={!hasEpisodes || busy || Boolean(customValidation)}
        onPress={() => runPdfAction(false)}
        style={styles.button}
      />
      <Button
        title="Поделиться"
        variant="secondary"
        disabled={!hasEpisodes || busy || Boolean(customValidation)}
        onPress={() => runPdfAction(true)}
        style={styles.button}
      />

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.busyText}>Формируем отчёт…</Text>
        </View>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.disclaimer}>
          Отчёт содержит ваши личные записи. Приложение не ставит диагноз и не
          заменяет консультацию врача.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  customRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  previewTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  previewLine: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  button: {
    marginBottom: spacing.sm,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  loader: {
    marginVertical: spacing.sm,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  busyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
