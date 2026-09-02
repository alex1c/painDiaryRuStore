/**
 * Doctor report PDF service — print and share integration.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';

import { DoctorReportService } from '@/src/reports/DoctorReportService';
import { REPORT_GENERATION_ERROR } from '@/src/reports/constants';
import type { DoctorReport } from '@/src/reports/types';

let mockDocumentDirectory: string | null = 'file:///documents/';

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  get documentDirectory() {
    return mockDocumentDirectory;
  },
  EncodingType: { Base64: 'base64' },
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

jest.mock('@/src/reports/renderDoctorReportHtml', () => ({
  renderDoctorReportHtml: jest.fn(() => '<html><body>report</body></html>'),
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
}));

const mockReport = {
  bounds: { from: '2024-06-01', to: '2024-06-30' },
} as DoctorReport;

describe('DoctorReportService.createPdf', () => {
  const service = new DoctorReportService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentDirectory = 'file:///documents/';
    (Print.printToFileAsync as jest.Mock).mockResolvedValue({
      uri: 'file:///print-temp/report.pdf',
      base64: 'JVBERi0x',
    });
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
  });

  test('writes print output into documentDirectory for sharing', async () => {
    const result = await service.createPdf(mockReport);

    expect(Print.printToFileAsync).toHaveBeenCalledWith({
      html: '<html><body>report</body></html>',
      base64: true,
    });
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///documents/headache-report-2024-06-01-2024-06-30.pdf',
      'JVBERi0x',
      { encoding: 'base64' }
    );
    expect(result).toEqual({
      fileUri: 'file:///documents/headache-report-2024-06-01-2024-06-30.pdf',
      fileName: 'headache-report-2024-06-01-2024-06-30.pdf',
    });
  });

  test('falls back to print uri when document write fails', async () => {
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(
      new Error('write failed')
    );

    const result = await service.createPdf(mockReport);

    expect(result.fileUri).toBe('file:///print-temp/report.pdf');
  });

  test('throws when printToFileAsync fails', async () => {
    (Print.printToFileAsync as jest.Mock).mockRejectedValue(new Error('print failed'));

    await expect(service.createPdf(mockReport)).rejects.toThrow(
      REPORT_GENERATION_ERROR
    );
  });
});
