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
   * Renders HTML to a PDF file and returns a shareable local URI.
   * Copies into documentDirectory when needed for Expo Go file permissions.
   */
  async createPdf(report: DoctorReport): Promise<DoctorReportPdfResult> {
    const html = renderDoctorReportHtml(report);
    const fileName = buildReportFileName(report.bounds);

    let printUri: string;
    let base64: string | undefined;
    try {
      const result = await Print.printToFileAsync({ html, base64: true });
      printUri = result.uri;
      base64 = result.base64;
    } catch (error) {
      if (__DEV__) {
        console.error('[DoctorReportService] printToFileAsync failed', error);
      }
      throw new Error(REPORT_GENERATION_ERROR);
    }

    const documentDir = FileSystem.documentDirectory;
    if (!documentDir || !base64) {
      return { fileUri: printUri, fileName };
    }

    const destUri = `${documentDir}${fileName}`;
    try {
      const existing = await FileSystem.getInfoAsync(destUri);
      if (existing.exists) {
        await FileSystem.deleteAsync(destUri, { idempotent: true });
      }

      await FileSystem.writeAsStringAsync(destUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[DoctorReportService] document write failed', error);
      }
      return { fileUri: printUri, fileName };
    }

    try {
      await FileSystem.deleteAsync(printUri, { idempotent: true });
    } catch {
      // Temp print files are disposable; ignore cleanup failures.
    }

    if (__DEV__) {
      console.log('[DoctorReportService] pdf saved to', destUri);
    }
    return { fileUri: destUri, fileName };
  }

  /** Opens the native share sheet for a generated PDF file. */
  async sharePdf(fileUri: string): Promise<void> {
    try {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Поделиться отчётом',
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[DoctorReportService] shareAsync failed', error);
      }
      throw new Error(REPORT_SHARE_UNAVAILABLE);
    }
  }
}
