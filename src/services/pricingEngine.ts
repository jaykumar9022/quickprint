import { PrintConfig } from '../types';
import { DbPricingRules, DbShopSettings } from '../db/types';

export interface PageSelectionResult {
  pages: number[];
  error?: string;
}

export interface PricingBreakdownResult {
  selectedPages: number[];
  selectedPagesCount: number;
  copies: number;
  sheetsPerCopy: number;
  totalSheetsUsed: number;
  totalPrintedSides: number;
  baseRatePerSidePaise: number;
  discountedRatePerSidePaise: number;
  sideCostPaise: number;
  paperCostPaise: number;
  subtotalBeforeMinPaise: number;
  minOrderApplied: boolean;
  finalAmountPaise: number;
  savingsPaise: number;
}

/**
 * Validates and parses custom page ranges such as "1-3, 5, 7-10".
 * Rejects invalid strings, zeroes, or out-of-bounds page requests.
 */
export function parseAndValidatePageSelection(
  selection: 'all' | 'custom',
  customPages: string | undefined,
  maxPages: number
): PageSelectionResult {
  if (selection === 'all' || !customPages || !customPages.trim()) {
    return {
      pages: Array.from({ length: maxPages }, (_, i) => i + 1),
    };
  }

  const set = new Set<number>();
  const parts = customPages.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const bounds = trimmed.split('-');
      if (bounds.length !== 2) {
        return { pages: [], error: `Malformed range expression: "${trimmed}"` };
      }
      const start = parseInt(bounds[0].trim(), 10);
      const end = parseInt(bounds[1].trim(), 10);

      if (isNaN(start) || isNaN(end)) {
        return { pages: [], error: `Non-numeric page range: "${trimmed}"` };
      }
      if (start < 1) {
        return { pages: [], error: `Page number must be 1 or greater, got ${start}.` };
      }
      if (end < start) {
        return { pages: [], error: `Invalid range: start page ${start} cannot be greater than end page ${end}.` };
      }
      if (end > maxPages) {
        return { pages: [], error: `Requested page ${end} exceeds total document pages (${maxPages}).` };
      }

      for (let i = start; i <= end; i++) {
        set.add(i);
      }
    } else {
      const p = parseInt(trimmed, 10);
      if (isNaN(p)) {
        return { pages: [], error: `Invalid page number: "${trimmed}"` };
      }
      if (p < 1) {
        return { pages: [], error: `Page number must be 1 or greater, got ${p}.` };
      }
      if (p > maxPages) {
        return { pages: [], error: `Requested page ${p} exceeds total document pages (${maxPages}).` };
      }
      set.add(p);
    }
  }

  if (set.size === 0) {
    return { pages: [], error: 'No valid pages selected for printing.' };
  }

  const sortedPages = Array.from(set).sort((a, b) => a - b);
  return { pages: sortedPages };
}

/**
 * Calculates deterministic pricing in integer minor units (paise) with full sheet and duplex logic.
 */
export function calculateExactPricing(
  config: PrintConfig,
  totalDocPages: number,
  pricing: DbPricingRules,
  shop: DbShopSettings
): PricingBreakdownResult {
  const pageResult = parseAndValidatePageSelection(config.pageSelection, config.customPages, totalDocPages);
  if (pageResult.error) {
    throw new Error(pageResult.error);
  }

  const selectedPages = pageResult.pages;
  const selectedPagesCount = selectedPages.length;
  const copies = Math.max(1, config.copies || 1);

  const baseRatePerSide = config.printMode === 'color' ? pricing.colorPricePaise : pricing.bwPricePaise;
  const paperSizeExtra = pricing.paperSizeRatesPaise[config.paperSize] || 0;
  const paperTypeKey = config.paperType || 'Normal (75gsm)';
  const paperTypeExtra = pricing.paperTypeRatesPaise[paperTypeKey] || 0;
  const sheetCostPerUnit = paperSizeExtra + paperTypeExtra;

  const totalPrintedSides = selectedPagesCount * copies;

  let sheetsPerCopy = selectedPagesCount;
  let discountedRatePerSide = baseRatePerSide;
  let savingsPaise = 0;

  if (config.printSides === 'double') {
    sheetsPerCopy = Math.ceil(selectedPagesCount / 2);
    discountedRatePerSide = Math.round(baseRatePerSide * pricing.duplexMultiplier);
    // Calculate duplex discount savings
    savingsPaise = (baseRatePerSide - discountedRatePerSide) * totalPrintedSides;
  }

  const totalSheetsUsed = sheetsPerCopy * copies;
  const sideCostPaise = totalPrintedSides * discountedRatePerSide;
  const paperCostPaise = totalSheetsUsed * sheetCostPerUnit;
  const subtotalBeforeMinPaise = sideCostPaise + paperCostPaise;

  const finalAmountPaise = Math.max(shop.minOrderPaise, subtotalBeforeMinPaise);
  const minOrderApplied = finalAmountPaise > subtotalBeforeMinPaise;

  return {
    selectedPages,
    selectedPagesCount,
    copies,
    sheetsPerCopy,
    totalSheetsUsed,
    totalPrintedSides,
    baseRatePerSidePaise: baseRatePerSide,
    discountedRatePerSidePaise: discountedRatePerSide,
    sideCostPaise,
    paperCostPaise,
    subtotalBeforeMinPaise,
    minOrderApplied,
    finalAmountPaise,
    savingsPaise,
  };
}
