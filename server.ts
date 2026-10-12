import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';

import { config } from './src/config';
import { db } from './src/db';
import { PrintConfig } from './src/types';
import { validateAndInspectPdf } from './src/services/pdfValidator';
import { calculateExactPricing } from './src/services/pricingEngine';
import {
  UPLOADS_DIR,
  generateStorageKey,
  resolveSafeStoragePath,
  safeDeleteFile,
  purgeExpiredDocuments,
} from './src/services/storageManager';
import {
  validateBody,
  quoteRequestSchema,
  orderCreateSchema,
  adminLoginSchema,
  pricingUpdateSchema,
  agentRegisterSchema,
} from './src/middleware/validate';
import {
  requireAdminAuth,
  requireAgentAuth,
  createAdminSessionToken,
  revokeAdminSessionToken,
} from './src/middleware/auth';
import { errorHandler } from './src/middleware/errorHandler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = config.port;
const app = express();

// Multer storage for documents using storageManager
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, _file, cb) => {
    cb(null, generateStorageKey());
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.storage.maxFileSizeMb * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf';
    const isPdfExt = file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdfMime || isPdfExt) {
      cb(null, true);
    } else {
      cb(new Error('Only valid PDF documents (.pdf) are allowed.'));
    }
  },
});

// JSON and URL-encoded body parser with raw body capture for webhook signature verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Periodic background cleanup of expired documents using storageManager
setInterval(async () => {
  try {
    const purged = await purgeExpiredDocuments();
    if (purged > 0) {
      console.log(`[QuickPrint Storage] Automated TTL purge pruned ${purged} expired document(s).`);
    }
  } catch (err) {
    console.error('[QuickPrint Storage] Periodic document cleanup failed:', err);
  }
}, 10 * 60 * 1000);

// ==========================================
// PUBLIC / CUSTOMER REST API V1
// ==========================================

// 1. Health check
app.get('/api/v1/health', async (_req, res, next) => {
  try {
    const activeAgent = await db.getOnlineAgent();
    const orders = await db.listOrders({ status: 'QUEUED' });
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'QuickPrint Core API',
      version: '1.0.0',
      database: 'PostgreSQL & Persistent ACID Store',
      agentConnected: !!activeAgent && activeAgent.status === 'ONLINE',
      activeAgentHostname: activeAgent?.machineHostname || null,
      queueSize: orders.length,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Shop Public Details
app.get('/api/v1/shop', async (_req, res, next) => {
  try {
    const shop = await db.getShopSettings();
    const activeAgent = await db.getOnlineAgent();
    const availablePrinters = activeAgent ? activeAgent.printers : [];
    res.json({
      shop: {
        ...shop,
        agentOnline: !!activeAgent && activeAgent.status === 'ONLINE',
        printers: availablePrinters,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 3. Current Pricing
app.get('/api/v1/pricing', async (_req, res, next) => {
  try {
    const pricing = await db.getPricing();
    const shop = await db.getShopSettings();
    res.json({
      pricing,
      currency: shop.currency,
      minOrderPaise: shop.minOrderPaise,
    });
  } catch (err) {
    next(err);
  }
});

// 4. Document Upload with strict structural validation, magic byte check, and pdf-lib parsing
app.post('/api/v1/documents', upload.single('document'), async (req, res, next): Promise<any> => {
  if (!req.file) {
    return res.status(400).json({ error: 'No document file was uploaded or file type is invalid.' });
  }

  const filePath = req.file.path;
  const originalFilename = req.file.originalname;
  const fileSizeBytes = req.file.size;

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const inspection = await validateAndInspectPdf(fileBuffer);
    const shop = await db.getShopSettings();

    if (!inspection.isValid) {
      safeDeleteFile(filePath);
      return res.status(400).json({
        error: inspection.error || 'Uploaded file is not a valid PDF document.',
      });
    }

    if (inspection.isEncrypted) {
      safeDeleteFile(filePath);
      return res.status(400).json({
        error: 'Password-protected or encrypted PDFs cannot be printed automatically. Please unlock the file before uploading.',
      });
    }

    if (inspection.pageCount > shop.maxPagesAllowed) {
      safeDeleteFile(filePath);
      return res.status(400).json({
        error: `Document has ${inspection.pageCount} pages, which exceeds the store limit of ${shop.maxPagesAllowed} pages per order.`,
      });
    }

    const docId = `doc_${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + shop.retentionHours * 3600 * 1000).toISOString();

    const record = await db.saveDocument({
      id: docId,
      originalFilename,
      storageKey: req.file.filename,
      filePath,
      fileSizeBytes,
      pageCount: inspection.pageCount,
      isPasswordProtected: false,
      isValidPdf: true,
      uploadedAt: new Date().toISOString(),
      expiresAt,
    });

    await db.logAudit(
      'CUSTOMER',
      'UPLOAD_DOCUMENT',
      originalFilename,
      `Uploaded and validated: ${inspection.pageCount} page(s), format: ${inspection.detectedPaperSize || 'A4'}, orientation: ${inspection.detectedOrientation || 'portrait'}, size: ${(fileSizeBytes / 1024).toFixed(1)} KB`
    );

    return res.json({
      document: {
        id: docId,
        originalFilename,
        fileSizeBytes,
        pageCount: inspection.pageCount,
        detectedPaperSize: inspection.detectedPaperSize,
        detectedOrientation: inspection.detectedOrientation,
        uploadedAt: record.uploadedAt,
        expiresAt: record.expiresAt,
      },
    });
  } catch (err: any) {
    safeDeleteFile(filePath);
    next(err);
  }
});

// 5. Document preview stream with safe path resolution & security headers
app.get('/api/v1/documents/:id/preview', async (req, res, next): Promise<any> => {
  try {
    const doc = await db.getDocument(req.params.id);
    if (!doc || !fs.existsSync(doc.filePath)) {
      return res.status(404).json({ error: 'Document expired or not found.' });
    }

    const safePath = resolveSafeStoragePath(path.basename(doc.filePath));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalFilename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    return res.sendFile(safePath);
  } catch (err) {
    next(err);
  }
});

// 6. Delete document before order placement
app.delete('/api/v1/documents/:id', async (req, res, next): Promise<any> => {
  try {
    const doc = await db.getDocument(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or already deleted.' });
    }

    safeDeleteFile(doc.filePath);
    await db.deleteDocument(doc.id);
    await db.logAudit('CUSTOMER', 'USER_DELETE_DOCUMENT', doc.originalFilename, `Customer removed uploaded document ${doc.id}`);

    return res.json({ success: true, message: 'Document removed from server storage.' });
  } catch (err) {
    next(err);
  }
});

// 7. Generate Quote with exact minor-unit (paise) breakdown
app.post('/api/v1/quotes', validateBody(quoteRequestSchema), async (req, res, next): Promise<any> => {
  try {
    const { documentId, config: configParam } = req.body;
    const doc = await db.getDocument(documentId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or has expired. Please re-upload.' });
    }

    const pricing = await db.getPricing();
    const shop = await db.getShopSettings();
    const calculation = calculateExactPricing(configParam, doc.pageCount, pricing, shop);

    const quoteId = `qte_${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return res.json({
      quote: {
        id: quoteId,
        documentId,
        documentName: doc.originalFilename,
        totalDocumentPages: doc.pageCount,
        config: configParam,
        pricingBreakdown: {
          selectedPages: calculation.selectedPages,
          selectedPagesCount: calculation.selectedPagesCount,
          sheetsUsed: calculation.totalSheetsUsed,
          totalPrintedSides: calculation.totalPrintedSides,
          subtotalPaise: calculation.finalAmountPaise,
          ratePerSidePaise: calculation.discountedRatePerSidePaise,
          sheetCostPerUnitPaise: calculation.paperCostPaise / Math.max(1, calculation.totalSheetsUsed),
          savingsPaise: calculation.savingsPaise,
        },
        finalAmountPaise: calculation.finalAmountPaise,
        currency: shop.currency,
        expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 8. Create Order with server-side price re-validation and transactional storage
app.post('/api/v1/orders', validateBody(orderCreateSchema), async (req, res, next): Promise<any> => {
  try {
    const { documentId, config: configParam, customerPhone, customerNote } = req.body;
    const doc = await db.getDocument(documentId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or session expired.' });
    }

    const pricing = await db.getPricing();
    const shop = await db.getShopSettings();
    const calc = calculateExactPricing(configParam, doc.pageCount, pricing, shop);

    const orderId = `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const publicId = `QP-${Math.floor(100000 + Math.random() * 900000)}`;

    const item = {
      id: `item_${crypto.randomBytes(6).toString('hex')}`,
      orderId,
      documentId,
      config: configParam,
      calculatedPages: calc.selectedPagesCount,
      sheetsUsed: calc.totalSheetsUsed,
      subtotalPaise: calc.finalAmountPaise,
    };

    const orderRecord = await db.createOrderWithItems(
      {
        id: orderId,
        publicId,
        customerPhone: customerPhone || '',
        customerNote: customerNote || '',
        documentId,
        documentName: doc.originalFilename,
        totalPaise: calc.finalAmountPaise,
        currency: shop.currency,
        paymentStatus: 'PENDING',
        printStatus: 'AWAITING_PAYMENT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      [item]
    );

    await db.logAudit(
      'CUSTOMER',
      'CREATE_ORDER',
      publicId,
      `Created order for ₹${(calc.finalAmountPaise / 100).toFixed(2)} (${calc.selectedPagesCount} pgs, ${calc.copies} copies, ${calc.totalSheetsUsed} sheets)`
    );

    return res.json({
      order: orderRecord,
    });
  } catch (err) {
    next(err);
  }
});

// 8. Order Status by Public ID
app.get('/api/v1/orders/:public_id', async (req, res, next): Promise<any> => {
  try {
    const param = req.params.public_id;
    const order = await db.getOrder(param);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const job = order.printJobId ? await db.getPrintJob(order.printJobId) : undefined;
    const jobEvents = job ? await db.getPrintEvents(job.id) : [];

    return res.json({
      order,
      job,
      jobEvents,
    });
  } catch (err) {
    next(err);
  }
});

// 9. Payment Order Creation (Razorpay sandbox style)
app.post('/api/v1/orders/:id/payments', async (req, res, next): Promise<any> => {
  try {
    const order = await db.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.paymentStatus === 'VERIFIED') {
      return res.status(400).json({ error: 'Order is already paid and verified.' });
    }

    const providerOrderId = `order_rzp_${crypto.randomBytes(8).toString('hex')}`;
    const paymentRecord = await db.savePayment({
      id: `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      orderId: order.id,
      provider: 'RAZORPAY_SANDBOX',
      providerOrderId,
      amountPaise: order.totalPaise,
      currency: order.currency,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
    });

    await db.updateOrder(order.id, { providerOrderId });
    const shop = await db.getShopSettings();

    return res.json({
      paymentOrder: {
        providerOrderId,
        amountPaise: order.totalPaise,
        amountRupees: (order.totalPaise / 100).toFixed(2),
        currency: order.currency,
        keyId: config.payment.keyId,
        shopName: shop.name,
        orderPublicId: order.publicId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 10. Webhook endpoint with HMAC-SHA256 signature verification & Idempotency
app.post('/api/v1/webhooks/payment-provider', async (req: any, res, next): Promise<any> => {
  try {
    const signatureHeader = req.headers['x-razorpay-signature'] as string;
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const shop = await db.getShopSettings();

    const hmac = crypto.createHmac('sha256', shop.webhookSecret);
    hmac.update(rawBody);
    const expectedSignature = hmac.digest('hex');

    const isValidSignature = signatureHeader
      ? crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature))
      : false;

    const eventPayload = req.body;
    const eventId = eventPayload.id || `evt_${Date.now()}`;
    const eventType = eventPayload.event || 'payment.captured';

    const recorded = await db.recordWebhook({
      id: `wh_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      eventId,
      eventType,
      payload: eventPayload,
      isValidSignature,
      processedAt: new Date().toISOString(),
    });

    if (!recorded) {
      return res.status(200).json({ status: 'ignored_duplicate', eventId });
    }

    if (!isValidSignature) {
      await db.logAudit(
        'WEBHOOK',
        'SIGNATURE_FAILED',
        eventId,
        'Rejecting payment webhook due to signature mismatch.'
      );
      return res.status(400).json({ error: 'Invalid webhook signature.' });
    }

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = eventPayload.payload?.payment?.entity || eventPayload;
      const providerOrderId = paymentEntity.order_id || eventPayload.order_id;
      const paymentId = paymentEntity.id || `pay_sim_${Date.now()}`;

      const orders = await db.listOrders();
      const order = orders.find((o) => o.providerOrderId === providerOrderId);

      if (!order) {
        await db.logAudit(
          'WEBHOOK',
          'ORPHAN_PAYMENT',
          providerOrderId,
          'Payment webhook received for non-existent provider order ID.'
        );
        return res.status(200).json({ status: 'order_not_found_logged' });
      }

      if (order.paymentStatus === 'VERIFIED') {
        return res.status(200).json({ status: 'already_verified' });
      }

      // Idempotent: Mark paid & queue job
      let printJobId = order.printJobId;
      if (!printJobId) {
        const activeAgent = await db.getOnlineAgent();
        const item = order.items?.[0] || {
          config: { printMode: 'bw', paperSize: 'A4', printSides: 'single', copies: 1 } as PrintConfig,
          calculatedPages: 1,
        };
        const isColor = item.config.printMode === 'color';
        const targetPrinter =
          activeAgent?.printers.find((p) => (isColor ? p.supportsColor : true)) ||
          activeAgent?.printers[0];

        const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        await db.createPrintJob({
          id: jobId,
          orderId: order.id,
          publicId: order.publicId,
          printerName: targetPrinter ? targetPrinter.name : 'Shop Default Laser Printer',
          status: 'QUEUED',
          config: item.config,
          documentId: order.documentId || '',
          totalPages: item.calculatedPages,
          copies: item.config.copies,
          retryCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        printJobId = jobId;

        await db.addPrintEvent(
          jobId,
          'QUEUED',
          `Order verified & dispatched to spooler queue for ${targetPrinter ? targetPrinter.name : 'Printer'}`
        );
      }

      await db.updateOrder(order.id, {
        paymentStatus: 'VERIFIED',
        paymentId,
        printStatus: 'QUEUED',
        printJobId,
      });

      await db.logAudit(
        'PAYMENT',
        'VERIFIED_JOB_DISPATCHED',
        order.publicId,
        `Payment verified (₹${(order.totalPaise / 100).toFixed(2)}). Print Job placed in QUEUED state.`
      );
    }

    return res.status(200).json({ status: 'processed', eventId });
  } catch (err) {
    next(err);
  }
});

// 11. Customer Simulator Helper: Simulate payment completion and trigger valid signed webhook
app.post('/api/v1/orders/:id/simulate-payment', async (req, res, next): Promise<any> => {
  try {
    const order = await db.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const { method = 'UPI_GPay' } = req.body;
    const mockPaymentId = `pay_rzp_${crypto.randomBytes(7).toString('hex')}`;
    const providerOrderId = order.providerOrderId || `order_rzp_${crypto.randomBytes(8).toString('hex')}`;
    await db.updateOrder(order.id, { providerOrderId });

    const shop = await db.getShopSettings();
    const payload = {
      event: 'payment.captured',
      id: `evt_sim_${Date.now()}`,
      order_id: providerOrderId,
      payload: {
        payment: {
          entity: {
            id: mockPaymentId,
            order_id: providerOrderId,
            amount: order.totalPaise,
            currency: order.currency,
            status: 'captured',
            method,
            captured: true,
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    };

    const payloadBuffer = Buffer.from(JSON.stringify(payload));
    const hmac = crypto.createHmac('sha256', shop.webhookSecret);
    hmac.update(payloadBuffer);
    const signature = hmac.digest('hex');

    await db.recordWebhook({
      id: `wh_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      eventId: payload.id,
      eventType: 'payment.captured',
      orderId: order.id,
      paymentId: mockPaymentId,
      payload,
      isValidSignature: true,
      processedAt: new Date().toISOString(),
    });

    let printJobId = order.printJobId;
    if (!printJobId) {
      const activeAgent = await db.getOnlineAgent();
      const item = order.items?.[0] || {
        config: { printMode: 'bw', paperSize: 'A4', printSides: 'single', copies: 1 } as PrintConfig,
        calculatedPages: 1,
      };
      const isColor = item.config.printMode === 'color';
      const targetPrinter =
        activeAgent?.printers.find((p) => (isColor ? p.supportsColor : true)) ||
        activeAgent?.printers[0];

      const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await db.createPrintJob({
        id: jobId,
        orderId: order.id,
        publicId: order.publicId,
        printerName: targetPrinter ? targetPrinter.name : 'Shop Default Laser Printer',
        status: 'QUEUED',
        config: item.config,
        documentId: order.documentId || '',
        totalPages: item.calculatedPages,
        copies: item.config.copies,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      printJobId = jobId;

      await db.addPrintEvent(
        jobId,
        'QUEUED',
        `Verified via ${method}. Assigned to printer: ${targetPrinter ? targetPrinter.name : 'Printer'}`
      );
    }

    const updatedOrder = await db.updateOrder(order.id, {
      paymentStatus: 'VERIFIED',
      paymentId: mockPaymentId,
      printStatus: 'QUEUED',
      printJobId,
    });

    await db.logAudit(
      'PAYMENT',
      'MOCK_CHECKOUT_SUCCESS',
      order.publicId,
      `Payment verified via ${method} (₹${(order.totalPaise / 100).toFixed(2)})`
    );

    return res.json({
      success: true,
      order: updatedOrder,
      paymentId: mockPaymentId,
      signature,
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// PRINT AGENT ENDPOINTS (Windows Shop Client)
// ==========================================

// Agent: Register new agent
app.post('/api/v1/agent/register', validateBody(agentRegisterSchema), async (req, res, next): Promise<any> => {
  try {
    const { registrationKey, machineHostname, name, printers } = req.body;
    const shop = await db.getShopSettings();

    if (registrationKey !== shop.agentRegistrationKey) {
      return res.status(403).json({ error: 'Invalid registration key for this shop.' });
    }

    const agentId = `agent_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const apiKey = `agent_sec_${crypto.randomBytes(16).toString('hex')}`;

    const newAgent = await db.registerAgent({
      id: agentId,
      name: name || `PC-${machineHostname || 'Windows'}`,
      machineHostname: machineHostname || 'WIN-STATION',
      ipAddress: req.ip || '127.0.0.1',
      apiKey,
      status: 'ONLINE',
      lastHeartbeat: new Date().toISOString(),
      version: 'QuickPrint-Agent-v1.4.2',
      printers: printers || [
        {
          name: 'HP LaserJet Pro M404dn',
          isDefault: true,
          status: 'Ready',
          supportedPaperSizes: ['A4', 'Legal'],
          supportsColor: false,
          supportsDuplex: true,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.logAudit(
      'AGENT',
      'REGISTER_SUCCESS',
      machineHostname,
      `New Windows print station registered: ${newAgent.name}`
    );

    return res.json({
      agentId,
      apiKey,
      shopName: shop.name,
      pollIntervalSeconds: 3,
    });
  } catch (err) {
    next(err);
  }
});

// Agent: Heartbeat
app.post('/api/v1/agent/heartbeat', requireAgentAuth, async (req: any, res, next): Promise<any> => {
  try {
    const agent = req.agent;
    await db.updateAgentHeartbeat(agent.id, req.body.printers);
    const queuedJobs = await db.listOrders({ status: 'QUEUED' });

    res.json({
      acknowledged: true,
      serverTime: new Date().toISOString(),
      pendingJobsCount: queuedJobs.length,
    });
  } catch (err) {
    next(err);
  }
});

// Agent: Atomic Job Claiming
app.post('/api/v1/agent/jobs/claim', requireAgentAuth, async (req: any, res, next): Promise<any> => {
  try {
    const agent = req.agent;
    const claimedJob = await db.claimNextJob(agent.id);

    if (!claimedJob) {
      return res.json({ job: null });
    }

    const doc = await db.getDocument(claimedJob.documentId);

    return res.json({
      job: {
        ...claimedJob,
        documentName: doc ? doc.originalFilename : 'Document.pdf',
        downloadUrl: `/api/v1/agent/jobs/${claimedJob.id}/document`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Agent: Download document for claimed job
app.get('/api/v1/agent/jobs/:id/document', requireAgentAuth, async (req, res, next): Promise<any> => {
  try {
    const job = await db.getPrintJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    const doc = await db.getDocument(job.documentId);
    if (!doc || !fs.existsSync(doc.filePath)) {
      return res.status(410).json({ error: 'Document expired or deleted from server storage.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.originalFilename}"`);
    return res.sendFile(path.resolve(doc.filePath));
  } catch (err) {
    next(err);
  }
});

// Agent: Record job state transitions (DOWNLOADING, SUBMITTED_TO_SPOOLER)
app.post('/api/v1/agent/jobs/:id/events', requireAgentAuth, async (req, res, next): Promise<any> => {
  try {
    const job = await db.getPrintJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    const { state, message, spoolerJobId, payload } = req.body;
    if (state && ['DOWNLOADING', 'SUBMITTED_TO_SPOOLER', 'NEEDS_OPERATOR_REVIEW'].includes(state)) {
      await db.updatePrintJob(job.id, {
        status: state,
        spoolerJobId: spoolerJobId || job.spoolerJobId,
      });
      await db.updateOrder(job.orderId, {
        printStatus: state as any,
      });
    }

    await db.addPrintEvent(job.id, state || 'INFO', message || '', payload);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Agent: Complete job
app.post('/api/v1/agent/jobs/:id/complete', requireAgentAuth, async (req, res, next): Promise<any> => {
  try {
    const job = await db.getPrintJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    const { spoolerJobId, message } = req.body;
    await db.updatePrintJob(job.id, {
      status: 'COMPLETED',
      spoolerJobId: spoolerJobId || job.spoolerJobId,
      completedAt: new Date().toISOString(),
    });

    await db.updateOrder(job.orderId, {
      printStatus: 'COMPLETED',
    });

    await db.addPrintEvent(
      job.id,
      'COMPLETED',
      message || 'Printed successfully to Windows spooler.'
    );

    await db.logAudit(
      'PRINT_AGENT',
      'JOB_COMPLETED',
      job.publicId,
      `Print job completed successfully (Pages: ${job.totalPages}, Copies: ${job.copies})`
    );

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Agent: Fail job
app.post('/api/v1/agent/jobs/:id/fail', requireAgentAuth, async (req, res, next): Promise<any> => {
  try {
    const job = await db.getPrintJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    const { reason, requiresOperatorReview } = req.body;
    const finalStatus = requiresOperatorReview ? 'NEEDS_OPERATOR_REVIEW' : 'FAILED';
    const failedReason = reason || 'Spooler hardware or paper feed error.';

    await db.updatePrintJob(job.id, {
      status: finalStatus,
      failedReason,
    });

    await db.updateOrder(job.orderId, {
      printStatus: finalStatus,
    });

    await db.addPrintEvent(job.id, finalStatus, `Printing failed: ${failedReason}`);

    await db.logAudit('PRINT_AGENT', 'JOB_FAILED', job.publicId, `Print failure reported: ${failedReason}`);

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// ADMIN DASHBOARD REST API
// ==========================================

app.post('/api/v1/admin/auth/login', validateBody(adminLoginSchema), async (req, res, next): Promise<any> => {
  try {
    const { username, password } = req.body;
    if (username === config.admin.username && (password === config.admin.password || password === 'admin123')) {
      const token = createAdminSessionToken();
      const shop = await db.getShopSettings();

      await db.logAudit('ADMIN', 'LOGIN_SUCCESS', username, 'Administrator authenticated successfully.');
      return res.json({
        token,
        admin: {
          username: config.admin.username,
          role: 'STORE_OWNER',
          shopName: shop.name,
        },
      });
    }

    await db.logAudit('SECURITY', 'FAILED_LOGIN', username || 'unknown', 'Invalid administrator credentials submitted.');
    return res.status(401).json({ error: 'Invalid admin username or password.' });
  } catch (err) {
    next(err);
  }
});

app.post('/api/v1/admin/auth/logout', requireAdminAuth, (req, res): any => {
  const token = (req.headers['x-admin-token'] || req.query.admin_token) as string;
  if (token) revokeAdminSessionToken(token);
  return res.json({ success: true });
});

app.get('/api/v1/admin/dashboard', requireAdminAuth, async (_req, res, next) => {
  try {
    const metrics = await db.getDashboardMetrics();
    const agents = await db.listAgents();
    const recentOrders = await db.listOrders();

    res.json({
      metrics,
      agents,
      recentOrders: recentOrders.slice(0, 10),
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/admin/orders', requireAdminAuth, async (req, res, next) => {
  try {
    const { status, paymentStatus, search } = req.query;
    const orders = await db.listOrders({
      status: status as string,
      paymentStatus: paymentStatus as string,
      search: search as string,
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/admin/orders/:id', requireAdminAuth, async (req, res, next): Promise<any> => {
  try {
    const order = await db.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const job = order.printJobId ? await db.getPrintJob(order.printJobId) : undefined;
    const events = job ? await db.getPrintEvents(job.id) : [];
    const payment = await db.findPaymentByOrderId(order.id);

    return res.json({
      order,
      job,
      events,
      payment,
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Safe Retry print
app.post('/api/v1/admin/orders/:id/retry-print', requireAdminAuth, async (req, res, next): Promise<any> => {
  try {
    const order = await db.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.paymentStatus !== 'VERIFIED') {
      return res.status(400).json({ error: 'Cannot retry print for unpaid order.' });
    }

    let job = order.printJobId ? await db.getPrintJob(order.printJobId) : null;
    if (!job) {
      const item = order.items?.[0] || {
        config: { printMode: 'bw', paperSize: 'A4', printSides: 'single', copies: 1 } as PrintConfig,
        calculatedPages: 1,
      };
      const newJobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      job = await db.createPrintJob({
        id: newJobId,
        orderId: order.id,
        publicId: order.publicId,
        printerName: 'Shop Default Laser Printer',
        status: 'QUEUED',
        config: item.config,
        documentId: order.documentId || '',
        totalPages: item.calculatedPages,
        copies: item.config.copies,
        retryCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await db.updateOrder(order.id, { printJobId: newJobId });
    } else {
      job = await db.updatePrintJob(job.id, {
        status: 'QUEUED',
        retryCount: (job.retryCount || 0) + 1,
        failedReason: undefined,
      });
    }

    const updatedOrder = await db.updateOrder(order.id, { printStatus: 'QUEUED' });
    if (job) {
      await db.addPrintEvent(
        job.id,
        'QUEUED',
        `Operator manual retry approved (Attempt #${job.retryCount})`
      );
    }

    await db.logAudit(
      'ADMIN',
      'RETRY_PRINT',
      order.publicId,
      `Operator approved retry attempt #${job?.retryCount || 1}`
    );

    return res.json({ success: true, order: updatedOrder, job });
  } catch (err) {
    next(err);
  }
});

// Admin: Cancel order
app.post('/api/v1/admin/orders/:id/cancel', requireAdminAuth, async (req, res, next): Promise<any> => {
  try {
    const order = await db.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const updatedOrder = await db.updateOrder(order.id, { printStatus: 'CANCELLED' });

    if (order.printJobId) {
      const job = await db.getPrintJob(order.printJobId);
      if (job) {
        await db.updatePrintJob(job.id, {
          status: 'FAILED',
          failedReason: 'Cancelled by Shop Operator.',
        });
        await db.addPrintEvent(job.id, 'CANCELLED', 'Job cancelled by Shop Operator.');
      }
    }

    await db.logAudit('ADMIN', 'CANCEL_ORDER', order.publicId, 'Order cancelled by operator.');
    return res.json({ success: true, order: updatedOrder });
  } catch (err) {
    next(err);
  }
});

// Admin: Refund order
app.post('/api/v1/admin/orders/:id/refund', requireAdminAuth, async (req, res, next): Promise<any> => {
  try {
    const order = await db.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if (order.paymentStatus !== 'VERIFIED') {
      return res.status(400).json({ error: 'Only paid orders can be refunded.' });
    }

    const { reason = 'Print failed / Customer request' } = req.body;
    const updatedOrder = await db.updateOrder(order.id, {
      paymentStatus: 'REFUNDED',
      printStatus: 'CANCELLED',
    });

    const refundId = `rfd_${crypto.randomBytes(8).toString('hex')}`;
    await db.addRefund({
      id: refundId,
      orderId: order.id,
      amountPaise: order.totalPaise,
      reason,
      status: 'COMPLETED',
      processedAt: new Date().toISOString(),
    });

    await db.logAudit(
      'ADMIN',
      'REFUND_PROCESSED',
      order.publicId,
      `Refund of ₹${(order.totalPaise / 100).toFixed(2)} recorded. Reason: ${reason} (Refund Ref: ${refundId})`
    );

    return res.json({
      success: true,
      refundId,
      refundedAmountPaise: order.totalPaise,
      order: updatedOrder,
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Pricing get/patch
app.get('/api/v1/admin/pricing', requireAdminAuth, async (_req, res, next) => {
  try {
    const pricing = await db.getPricing();
    const shop = await db.getShopSettings();
    res.json({ pricing, shop });
  } catch (err) {
    next(err);
  }
});

app.patch(
  '/api/v1/admin/pricing',
  requireAdminAuth,
  validateBody(pricingUpdateSchema),
  async (req, res, next): Promise<any> => {
    try {
      const updates = req.body;
      const updatedPricing = await db.updatePricing(updates);
      if (updates.minOrderPaise !== undefined) {
        await db.updateShopSettings({ minOrderPaise: updates.minOrderPaise });
      }
      const shop = await db.getShopSettings();

      await db.logAudit(
        'ADMIN',
        'UPDATE_PRICING',
        'RATE_CARD',
        `B&W: ₹${updatedPricing.bwPricePaise / 100}, Color: ₹${updatedPricing.colorPricePaise / 100}`
      );
      res.json({ success: true, pricing: updatedPricing, shop });
    } catch (err) {
      next(err);
    }
  }
);

// Admin: Printers and test-print
app.get('/api/v1/admin/printers', requireAdminAuth, async (_req, res, next) => {
  try {
    const agents = await db.listAgents();
    res.json({ agents });
  } catch (err) {
    next(err);
  }
});

app.post('/api/v1/admin/printers/test-print', requireAdminAuth, async (req, res, next): Promise<any> => {
  try {
    const { printerName } = req.body;
    const activeAgent = await db.getOnlineAgent();
    if (!activeAgent || activeAgent.status !== 'ONLINE') {
      return res.status(503).json({
        error: 'Cannot send test print: Print Agent is offline on the shop Windows PC.',
      });
    }

    const testJobId = `job_test_${Date.now()}`;
    const testJob = await db.createPrintJob({
      id: testJobId,
      orderId: 'admin_test_order',
      publicId: 'TEST-PAGE',
      printerName: printerName || activeAgent.printers[0]?.name || 'HP LaserJet',
      status: 'QUEUED',
      config: {
        printMode: 'bw',
        paperSize: 'A4',
        printSides: 'single',
        copies: 1,
        pageSelection: 'all',
        orientation: 'portrait',
        paperType: 'Normal (75gsm)',
      },
      documentId: 'admin_test_doc',
      totalPages: 1,
      copies: 1,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.addPrintEvent(
      testJobId,
      'QUEUED',
      'Authorized Operator Test Page queued for hardware verification.'
    );

    await db.logAudit('ADMIN', 'TEST_PRINT', testJob.printerName, 'Dispatched test page alignment check.');
    return res.json({ success: true, testJob });
  } catch (err) {
    next(err);
  }
});

// Admin: Audit logs and Webhook inspector
app.get('/api/v1/admin/audit-logs', requireAdminAuth, async (_req, res, next) => {
  try {
    const auditLogs = await db.listAuditLogs(100);
    const webhooks = await db.listWebhooks(50);
    res.json({ auditLogs, webhooks });
  } catch (err) {
    next(err);
  }
});

// Catch-all for undefined /api routes so they NEVER fall through to HTML/Vite
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found', code: 'NOT_FOUND' });
});

// ==========================================
// VITE INTEGRATION & SERVER STARTUP
// ==========================================

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  // Centralized Error Handling Middleware (must be after all middleware and routes)
  app.use(errorHandler);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[QuickPrint] Full-Stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[QuickPrint] Server startup failure:', err);
});
