import { PrintConfig } from '../types';

export interface DbShopSettings {
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
  webhookSecret: string;
  agentRegistrationKey: string;
  wifiSsid: string;
  wifiPassword: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbPricingRules {
  id: string;
  shopId: string;
  bwPricePaise: number;
  colorPricePaise: number;
  duplexMultiplier: number;
  paperSizeRatesPaise: Record<string, number>;
  paperTypeRatesPaise: Record<string, number>;
  updatedAt: string;
}

export interface DbDocument {
  id: string;
  originalFilename: string;
  storageKey: string;
  filePath: string;
  fileSizeBytes: number;
  pageCount: number;
  isPasswordProtected: boolean;
  isValidPdf: boolean;
  uploadedAt: string;
  expiresAt: string;
}

export interface DbOrderItem {
  id: string;
  orderId: string;
  documentId: string;
  config: PrintConfig;
  calculatedPages: number;
  sheetsUsed: number;
  subtotalPaise: number;
}

export interface DbOrder {
  id: string;
  publicId: string;
  customerPhone?: string;
  customerNote?: string;
  documentId?: string;
  documentName: string;
  totalPaise: number;
  currency: string;
  paymentStatus: 'PENDING' | 'VERIFIED' | 'FAILED' | 'REFUNDED';
  printStatus: 'AWAITING_PAYMENT' | 'QUEUED' | 'CLAIMED' | 'DOWNLOADING' | 'SUBMITTED_TO_SPOOLER' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'NEEDS_OPERATOR_REVIEW';
  paymentId?: string;
  providerOrderId?: string;
  printJobId?: string;
  createdAt: string;
  updatedAt: string;
  items?: DbOrderItem[];
}

export interface DbPayment {
  id: string;
  orderId: string;
  provider: string;
  providerOrderId: string;
  providerPaymentId?: string;
  amountPaise: number;
  currency: string;
  status: 'CREATED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
  method?: string;
  signature?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface DbWebhookEvent {
  id: string;
  eventId: string;
  eventType: string;
  orderId?: string;
  paymentId?: string;
  payload: any;
  isValidSignature: boolean;
  processedAt: string;
}

export interface DbPrintAgent {
  id: string;
  name: string;
  machineHostname: string;
  ipAddress: string;
  apiKey: string;
  status: 'ONLINE' | 'OFFLINE';
  lastHeartbeat: string;
  version: string;
  printers: {
    name: string;
    isDefault: boolean;
    status: string;
    supportedPaperSizes: string[];
    supportsColor: boolean;
    supportsDuplex: boolean;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface DbPrintJob {
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

export interface DbPrintEvent {
  id: string;
  jobId: string;
  state: string;
  message: string;
  payload?: any;
  timestamp: string;
}

export interface DbRefund {
  id: string;
  orderId: string;
  amountPaise: number;
  reason: string;
  status: string;
  processedAt: string;
}

export interface DbAuditLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  details: string;
  timestamp: string;
}
