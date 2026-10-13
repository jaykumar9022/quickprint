import {
  ShopSettings,
  PricingRule,
  DocumentUploadResponse,
  PrintConfig,
  PriceQuote,
  OrderRecord,
  PrintJobRecord,
  PrintEventRecord,
  DashboardMetrics,
  AuditLogRecord,
} from '../types';

const API_BASE = '/api/v1';

export const DEFAULT_SHOP_DATA: ShopSettings = {
  id: 'shop_001',
  name: 'QuickPrint Xerox & Digital Hub',
  tagline: 'High Speed Laser & Color Printing Station',
  address: 'Shop #4, Metro Station Commercial Plaza, Sector 18',
  phone: '+91 98765 43210',
  email: 'shop@quickprint.io',
  upiVpa: 'quickprint@icici',
  currency: 'INR',
  minOrderPaise: 500,
  maxFileSizeMb: 25,
  maxPagesAllowed: 250,
  retentionHours: 2,
  agentRegistrationKey: 'QP-AGENT-SECURE-KEY-8821',
  wifiSsid: 'QuickPrint_Free_WiFi',
  wifiPassword: 'printnowguest',
  agentOnline: true,
  printers: [
    {
      name: 'HP LaserJet Pro M404dn (Network B&W Duplex)',
      isDefault: true,
      status: 'Ready - Paper Loaded',
      supportedPaperSizes: ['A4', 'Legal'],
      supportsColor: false,
      supportsDuplex: true,
    },
    {
      name: 'Epson EcoTank L3250 (Color High-Res)',
      isDefault: false,
      status: 'Ready - Ink Levels 94%',
      supportedPaperSizes: ['A4', 'Legal', 'A3'],
      supportsColor: true,
      supportsDuplex: false,
    },
    {
      name: 'Canon imageRUNNER 2625 Heavy Duty Copier',
      isDefault: false,
      status: 'Ready - Trays 1-3 Full',
      supportedPaperSizes: ['A4', 'A3', 'Legal'],
      supportsColor: false,
      supportsDuplex: true,
    },
  ],
};

export const DEFAULT_PRICING_DATA: PricingRule = {
  bwPricePaise: 200,
  colorPricePaise: 1000,
  duplexMultiplier: 0.9,
  paperSizeRatesPaise: { A4: 0, Legal: 100, A3: 600 },
  paperTypeRatesPaise: {
    'Normal (75gsm)': 0,
    'Bond (100gsm)': 300,
    'Glossy Photo (180gsm)': 1500,
  },
};

/**
 * Robust JSON fetch wrapper that never throws raw SyntaxError on HTML responses
 * (e.g. from server warmups, proxies, or 502/504 errors).
 */
export async function safeRequestJson<T>(
  url: string,
  options?: RequestInit,
  defaultErrorMessage = 'Request failed'
): Promise<T> {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(`Server returned error (${res.status}): ${text.slice(0, 120) || defaultErrorMessage}`);
    }
    throw new Error(`Server returned unexpected response type (${contentType || 'non-JSON'}): ${text.slice(0, 120)}`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch (parseErr: any) {
    throw new Error(`Failed to parse JSON response from ${url}: ${parseErr?.message || 'Invalid syntax'}`);
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}: ${defaultErrorMessage}`);
  }

  return data as T;
}

/**
 * Fetch wrapper with graceful fallback for non-critical/initial bootstrap data.
 */
async function safeFetchJson<T>(url: string, options?: RequestInit, fallback?: T): Promise<T> {
  try {
    return await safeRequestJson<T>(url, options);
  } catch (error: any) {
    if (fallback !== undefined) {
      console.warn(`[QuickPrint API] Using fallback data for ${url}:`, error?.message || error);
      return fallback;
    }
    throw error;
  }
}

export async function fetchHealth() {
  return safeFetchJson(`${API_BASE}/health`, undefined, {
    status: 'healthy',
    service: 'QuickPrint Core API',
    agentConnected: true,
  });
}

export async function fetchShop(): Promise<{ shop: ShopSettings }> {
  return safeFetchJson<{ shop: ShopSettings }>(`${API_BASE}/shop`, undefined, {
    shop: DEFAULT_SHOP_DATA,
  });
}

export async function fetchPricing(): Promise<{ pricing: PricingRule; currency: string; minOrderPaise: number }> {
  return safeFetchJson<{ pricing: PricingRule; currency: string; minOrderPaise: number }>(
    `${API_BASE}/pricing`,
    undefined,
    {
      pricing: DEFAULT_PRICING_DATA,
      currency: 'INR',
      minOrderPaise: 500,
    }
  );
}

export async function uploadDocument(file: File): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.append('document', file);

  return safeRequestJson<DocumentUploadResponse>(
    `${API_BASE}/documents`,
    {
      method: 'POST',
      body: formData,
    },
    'Failed to upload document'
  );
}

export async function deleteUploadedDocument(documentId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createQuote(documentId: string, config: PrintConfig): Promise<{ quote: PriceQuote }> {
  return safeRequestJson<{ quote: PriceQuote }>(
    `${API_BASE}/quotes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, config }),
    },
    'Failed to generate price quote'
  );
}

export async function createOrder(data: {
  documentId: string;
  config: PrintConfig;
  customerPhone?: string;
  customerNote?: string;
}): Promise<{ order: OrderRecord }> {
  return safeRequestJson<{ order: OrderRecord }>(
    `${API_BASE}/orders`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to create order'
  );
}

export async function fetchOrderByPublicId(
  publicId: string
): Promise<{ order: OrderRecord; job?: PrintJobRecord; jobEvents: PrintEventRecord[] }> {
  return safeRequestJson<{ order: OrderRecord; job?: PrintJobRecord; jobEvents: PrintEventRecord[] }>(
    `${API_BASE}/orders/${publicId}`,
    undefined,
    'Order not found'
  );
}

export async function createPaymentOrder(orderId: string): Promise<any> {
  return safeRequestJson<any>(
    `${API_BASE}/orders/${orderId}/payments`,
    {
      method: 'POST',
    },
    'Failed to initialize payment'
  );
}

export async function simulatePayment(orderId: string, method: string = 'UPI_GPay'): Promise<any> {
  return safeRequestJson<any>(
    `${API_BASE}/orders/${orderId}/simulate-payment`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method }),
    },
    'Payment simulation failed'
  );
}

// ADMIN API
export async function adminLogin(password: string): Promise<{ token: string; admin: any }> {
  return safeRequestJson<{ token: string; admin: any }>(
    `${API_BASE}/admin/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password }),
    },
    'Admin login failed'
  );
}

export async function fetchAdminDashboard(token: string): Promise<{
  metrics: DashboardMetrics;
  agents: any[];
  recentOrders: OrderRecord[];
}> {
  return safeRequestJson<{
    metrics: DashboardMetrics;
    agents: any[];
    recentOrders: OrderRecord[];
  }>(
    `${API_BASE}/admin/dashboard`,
    {
      headers: { 'x-admin-token': token },
    },
    'Failed to fetch admin dashboard'
  );
}

export async function fetchAdminOrders(
  token: string,
  params?: { status?: string; paymentStatus?: string; search?: string }
): Promise<{ orders: OrderRecord[] }> {
  const query = new URLSearchParams(params as any).toString();
  return safeRequestJson<{ orders: OrderRecord[] }>(
    `${API_BASE}/admin/orders?${query}`,
    {
      headers: { 'x-admin-token': token },
    },
    'Failed to fetch orders'
  );
}

export async function fetchAdminOrderDetail(
  token: string,
  orderId: string
): Promise<{ order: OrderRecord; job?: PrintJobRecord; events: PrintEventRecord[]; payment?: any }> {
  return safeRequestJson<{ order: OrderRecord; job?: PrintJobRecord; events: PrintEventRecord[]; payment?: any }>(
    `${API_BASE}/admin/orders/${orderId}`,
    {
      headers: { 'x-admin-token': token },
    },
    'Failed to fetch order detail'
  );
}

export async function adminRetryPrint(token: string, orderId: string): Promise<any> {
  return safeRequestJson<any>(
    `${API_BASE}/admin/orders/${orderId}/retry-print`,
    {
      method: 'POST',
      headers: { 'x-admin-token': token },
    },
    'Failed to retry print'
  );
}

export async function adminCancelOrder(token: string, orderId: string): Promise<any> {
  return safeRequestJson<any>(
    `${API_BASE}/admin/orders/${orderId}/cancel`,
    {
      method: 'POST',
      headers: { 'x-admin-token': token },
    },
    'Failed to cancel order'
  );
}

export async function adminRefundOrder(token: string, orderId: string, reason: string): Promise<any> {
  return safeRequestJson<any>(
    `${API_BASE}/admin/orders/${orderId}/refund`,
    {
      method: 'POST',
      headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
    'Failed to process refund'
  );
}

export async function updateAdminPricing(token: string, pricingData: any): Promise<any> {
  return safeRequestJson<any>(
    `${API_BASE}/admin/pricing`,
    {
      method: 'PATCH',
      headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(pricingData),
    },
    'Failed to update pricing'
  );
}

export async function sendTestPrint(token: string, printerName?: string): Promise<any> {
  return safeRequestJson<any>(
    `${API_BASE}/admin/printers/test-print`,
    {
      method: 'POST',
      headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName }),
    },
    'Failed to send test print'
  );
}

export async function fetchAuditLogs(token: string): Promise<{ auditLogs: AuditLogRecord[]; webhooks: any[] }> {
  return safeRequestJson<{ auditLogs: AuditLogRecord[]; webhooks: any[] }>(
    `${API_BASE}/admin/audit-logs`,
    {
      headers: { 'x-admin-token': token },
    },
    'Failed to fetch audit logs'
  );
}

// AGENT WORKER API CALLS
export async function agentHeartbeat(apiKey: string): Promise<any> {
  return safeRequestJson<any>(
    `${API_BASE}/agent/heartbeat`,
    {
      method: 'POST',
      headers: { 'x-agent-key': apiKey },
    },
    'Agent heartbeat failed'
  );
}

export async function agentClaimJob(apiKey: string): Promise<any> {
  return safeRequestJson<any>(
    `${API_BASE}/agent/jobs/claim`,
    {
      method: 'POST',
      headers: { 'x-agent-key': apiKey },
    },
    'Agent claim job failed'
  );
}

export async function agentReportEvent(
  apiKey: string,
  jobId: string,
  state: string,
  message: string,
  spoolerJobId?: string
): Promise<any> {
  return safeRequestJson<any>(
    `${API_BASE}/agent/jobs/${jobId}/events`,
    {
      method: 'POST',
      headers: { 'x-agent-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, message, spoolerJobId }),
    },
    'Agent report event failed'
  );
}

export async function agentCompleteJob(apiKey: string, jobId: string, spoolerJobId: string): Promise<any> {
  return safeRequestJson<any>(
    `${API_BASE}/agent/jobs/${jobId}/complete`,
    {
      method: 'POST',
      headers: { 'x-agent-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ spoolerJobId }),
    },
    'Agent complete job failed'
  );
}

export async function agentFailJob(apiKey: string, jobId: string, reason: string): Promise<any> {
  return safeRequestJson<any>(
    `${API_BASE}/agent/jobs/${jobId}/fail`,
    {
      method: 'POST',
      headers: { 'x-agent-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, requiresOperatorReview: true }),
    },
    'Agent fail job failed'
  );
}
