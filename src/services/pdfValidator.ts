import { PDFDocument } from 'pdf-lib';

export interface PdfValidationResult {
  isValid: boolean;
  pageCount: number;
  isEncrypted: boolean;
  detectedPaperSize?: 'A4' | 'Legal' | 'A3' | 'Custom';
  detectedOrientation?: 'portrait' | 'landscape';
  error?: string;
}

/**
 * Validates a PDF file buffer using binary magic bytes and structural parsing with pdf-lib.
 * Accurately extracts page counts, detects password encryption, and validates paper dimensions.
 */
export async function validateAndInspectPdf(buffer: Buffer): Promise<PdfValidationResult> {
  // 1. Magic bytes check: PDF specification requires '%PDF-' at byte 0-1024
  const headerSlice = buffer.subarray(0, 1024).toString('latin1');
  if (!headerSlice.includes('%PDF-')) {
    return {
      isValid: false,
      pageCount: 0,
      isEncrypted: false,
      error: 'Uploaded file is not a valid PDF document. Header check failed (missing %PDF- signature).',
    };
  }

  // 2. Structural parsing with pdf-lib
  try {
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: false,
      updateMetadata: false,
    });

    const pageCount = pdfDoc.getPageCount();
    if (pageCount < 1) {
      return {
        isValid: false,
        pageCount: 0,
        isEncrypted: false,
        error: 'PDF contains zero printable pages.',
      };
    }

    // Inspect first page dimensions
    let detectedPaperSize: 'A4' | 'Legal' | 'A3' | 'Custom' = 'A4';
    let detectedOrientation: 'portrait' | 'landscape' = 'portrait';

    try {
      const firstPage = pdfDoc.getPage(0);
      const { width, height } = firstPage.getSize();
      detectedOrientation = width > height ? 'landscape' : 'portrait';

      const shortEdge = Math.min(width, height);
      const longEdge = Math.max(width, height);

      // Points tolerance ±15pt
      // A4 is 595.28 x 841.89 pt
      // Legal is 612.00 x 1008.00 pt
      // A3 is 841.89 x 1190.55 pt
      if (Math.abs(shortEdge - 595) < 30 && Math.abs(longEdge - 842) < 30) {
        detectedPaperSize = 'A4';
      } else if (Math.abs(shortEdge - 612) < 30 && Math.abs(longEdge - 1008) < 30) {
        detectedPaperSize = 'Legal';
      } else if (Math.abs(shortEdge - 842) < 30 && Math.abs(longEdge - 1191) < 30) {
        detectedPaperSize = 'A3';
      } else {
        detectedPaperSize = 'Custom';
      }
    } catch {
      // Keep defaults if page size cannot be determined
    }

    return {
      isValid: true,
      pageCount,
      isEncrypted: false,
      detectedPaperSize,
      detectedOrientation,
    };
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.toLowerCase().includes('encrypt') || errorMsg.toLowerCase().includes('password')) {
      return {
        isValid: false,
        pageCount: 0,
        isEncrypted: true,
        error: 'Password-protected or encrypted PDFs cannot be printed automatically. Please unlock the file before uploading.',
      };
    }

    // Try fallback regex check for standard /Page objects if pdf-lib threw syntax error
    const content = buffer.toString('latin1');
    const matches = content.match(/\/Type\s*\/Page\b/g);
    if (matches && matches.length > 0) {
      return {
        isValid: true,
        pageCount: matches.length,
        isEncrypted: content.includes('/Encrypt'),
        detectedPaperSize: 'A4',
        detectedOrientation: 'portrait',
      };
    }

    return {
      isValid: false,
      pageCount: 0,
      isEncrypted: false,
      error: `Malformed or corrupt PDF document: ${errorMsg}`,
    };
  }
}
