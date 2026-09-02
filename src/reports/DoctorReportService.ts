/**
 * Generates and shares doctor-report PDF files on device (local only).
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { buildReportFileName } from '@/src/reports/period';
import { renderDoctorReportHtml } from '@/src/reports/renderDoctorReportHtml';
import type { DoctorReport, DoctorReportPdfResult } from '@/src/reports/types';
import {
  REPORT_GENERATION_ERROR,
  REPORT_SHARE_UNAVAILABLE,
} from '@/src/reports/constants';

export class DoctorReportService {
  /**
   * Renders HTML to a cached PDF file and returns its local URI.
   * Overwrites any previous report with the same period file name.
   */
  async createPdf(report: DoctorReport): Promise<DoctorReportPdfResult> {
    const html = renderDoctorReportHtml(report);
    const fileName = buildReportFileName(report.bounds);

    try {
      const { uri: tempUri } = await Print.printToFileAsync({ html });
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        throw new Error('Cache directory unavailable');
      }

      const destUri = `${cacheDir}${fileName}`;
      const existing = await FileSystem.getInfoAsync(destUri);
      if (existing.exists) {
        await FileSystem.deleteAsync(destUri, { idempotent: true });
      }

      await FileSystem.moveAsync({ from: tempUri, to: destUri });

      return { fileUri: destUri, fileName };
    } catch {
      throw new Error(REPORT_GENERATION_ERROR);
    }
  }

  /** Opens the native share sheet for a generated PDF file. */
  async sharePdf(fileUri: string): Promise<void> {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      throw new Error(REPORT_SHARE_UNAVAILABLE);
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Поделиться отчётом',
    });
  }
}
