export interface ShopSettings {
  id: string;
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  upiVpa: string;
  currency: string;
  minOrderPaise: number;
  maxFileSizeMb: number;
  maxPagesAllowed: number;
  retentionHours: number;
  agentRegistrationKey: string;
  wifiSsid: string;
  wifiPassword: string;
  agentOnline: boolean;
  printers: {
    name: string;
    isDefault: boolean;
    status: string;
    supportedPaperSizes: string[];
    supportsColor: boolean;
    supportsDuplex: boolean;
  }[];
}

export interface PricingRule {
  bwPricePaise: number;
  colorPricePaise: number;
  duplexMultiplier: number;
  paperSizeRatesPaise: Record<string, number>;
  paperTypeRatesPaise: Record<string, number>;
}

export interface PrintConfig {
  printMode: 'bw' | 'color';
  paperSize: 'A4' | 'A3' | 'Legal';
  printSides: 'single' | 'double';
  copies: number;
  pageSelection: 'all' | 'custom';
  customPages?: string;
  orientation: 'portrait' | 'landscape';
  paperType: 'Normal (75gsm)' | 'Bond (100gsm)' | 'Glossy Photo (180gsm)';
}

export interface DocumentUploadResponse {
  document: {
    id: string;
    originalFilename: string;
    fileSizeBytes: number;
    pageCount: number;
    detectedPaperSize?: 'A4' | 'Legal' | 'A3' | 'Custom';
    detectedOrientation?: 'portrait' | 'landscape';
    uploadedAt: string;
    expiresAt: string;
  };
}

export interface PriceQuote {
  id: string;
  documentId: string;
  documentName: string;
  totalDocumentPages: number;
  config: PrintConfig;
  pricingBreakdown: {
    selectedPagesCount: number;
    sheetsUsed: number;
    totalPrintedSides: number;
    subtotalPaise: number;
    ratePerSidePaise: number;
    sheetCostPerUnitPaise: number;
    savingsPaise?: number;
    selectedPages?: number[];
  };
  finalAmountPaise: number;
  currency: string;
  expiresAt: string;
}

export interface OrderItem {
  id: string;
  documentId: string;
  config: PrintConfig;
  calculatedPages: number;
  sheetsUsed: number;
  subtotalPaise: number;
}

export interface OrderRecord {
  id: string;
  publicId: string;
  customerPhone?: string;
  customerNote?: string;
  documentId: string;
  documentName: string;
  items: OrderItem[];
  totalPaise: number;
  currency: string;
  paymentStatus: 'PENDING' | 'VERIFIED' | 'FAILED' | 'REFUNDED';
  printStatus: 'AWAITING_PAYMENT' | 'QUEUED' | 'CLAIMED' | 'DOWNLOADING' | 'SUBMITTED_TO_SPOOLER' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'NEEDS_OPERATOR_REVIEW';
  paymentId?: string;
  providerOrderId?: string;
  createdAt: string;
  updatedAt: string;
  printJobId?: string;
}

export interface PrintJobRecord {
  id: string;
  orderId: string;
  publicId: string;
  agentId?: string;
  printerName: string;
  status: 'QUEUED' | 'CLAIMED' | 'DOWNLOADING' | 'SUBMITTED_TO_SPOOLER' | 'COMPLETED' | 'FAILED' | 'NEEDS_OPERATOR_REVIEW';
  spoolerJobId?: string;
  config: PrintConfig;
  documentId: string;
  totalPages: number;
  copies: number;
  retryCount: number;
  claimedAt?: string;
  completedAt?: string;
  failedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrintEventRecord {
  id: string;
  jobId: string;
  state: string;
  message: string;
  timestamp: string;
}

export interface AuditLogRecord {
  id: string;
  actor: string;
  action: string;
  target: string;
  details: string;
  timestamp: string;
}

export interface DashboardMetrics {
  totalOrdersToday: number;
  awaitingPayment: number;
  paidWaitingPrint: number;
  currentlyPrinting: number;
  completedJobs: number;
  failedJobs: number;
  totalRevenuePaise: number;
  totalRevenueRupees: string;
  agentStatus: 'ONLINE' | 'OFFLINE';
  activeAgentName: string;
  connectedPrintersCount: number;
}
