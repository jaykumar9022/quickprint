import { db } from '../db';
import { orderCreateSchema, quoteRequestSchema } from '../middleware/validate';

async function runPhase1Tests() {
  console.log('--- RUNNING PHASE 1 TEST SUITE ---');

  // Test 1: Shop & Pricing configuration
  const shop = await db.getShopSettings();
  if (!shop || !shop.name) throw new Error('Test 1 Failed: Shop settings missing');
  console.log('✓ Test 1 Passed: Shop settings loaded from persistent store');

  const pricing = await db.getPricing();
  if (!pricing || pricing.bwPricePaise <= 0) throw new Error('Test 2 Failed: Pricing rules missing');
  console.log('✓ Test 2 Passed: Pricing rules validated');

  // Test 2: Validation schemas
  const validOrderPayload = {
    documentId: 'doc_test_123',
    config: {
      printMode: 'bw' as const,
      paperSize: 'A4' as const,
      printSides: 'single' as const,
      copies: 2,
      pageSelection: 'all' as const,
      orientation: 'portrait' as const,
      paperType: 'Normal (75gsm)' as const,
    },
    customerPhone: '9876543210',
  };
  const parsedOrder = orderCreateSchema.safeParse(validOrderPayload);
  if (!parsedOrder.success) throw new Error('Test 3 Failed: Valid order payload rejected');
  console.log('✓ Test 3 Passed: Zod order validation schema accepts valid payload');

  const invalidOrderPayload = {
    documentId: '',
    config: {
      printMode: 'invalid_mode',
      copies: -1,
    },
  };
  const invalidParsed = orderCreateSchema.safeParse(invalidOrderPayload);
  if (invalidParsed.success) throw new Error('Test 4 Failed: Invalid order payload accepted');
  console.log('✓ Test 4 Passed: Zod order validation rejects invalid fields');

  // Test 3: Transactional Order & Order Items Creation
  const testOrderId = `test_ord_${Date.now()}`;
  const testPublicId = `QP-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
  const createdOrder = await db.createOrderWithItems(
    {
      id: testOrderId,
      publicId: testPublicId,
      customerPhone: '9876543210',
      documentName: 'Unit_Test.pdf',
      totalPaise: 400,
      currency: 'INR',
      paymentStatus: 'PENDING',
      printStatus: 'AWAITING_PAYMENT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    [
      {
        id: `item_${Date.now()}`,
        orderId: testOrderId,
        documentId: 'doc_test_123',
        config: validOrderPayload.config,
        calculatedPages: 1,
        sheetsUsed: 1,
        subtotalPaise: 400,
      },
    ]
  );

  const retrieved = await db.getOrder(testPublicId);
  if (!retrieved || retrieved.id !== testOrderId || retrieved.items?.length !== 1) {
    throw new Error('Test 5 Failed: Order with relational items retrieval failed');
  }
  console.log('✓ Test 5 Passed: Transactional Order + Items creation and lookup by Public ID verified');

  // Test 4: Webhook Deduplication & Idempotency
  const testEventId = `evt_test_${Date.now()}`;
  const firstInsert = await db.recordWebhook({
    id: `wh_${Date.now()}`,
    eventId: testEventId,
    eventType: 'payment.captured',
    payload: { amount: 400 },
    isValidSignature: true,
    processedAt: new Date().toISOString(),
  });
  if (!firstInsert) throw new Error('Test 6 Failed: Webhook insertion failed');

  const duplicateInsert = await db.recordWebhook({
    id: `wh_dup_${Date.now()}`,
    eventId: testEventId,
    eventType: 'payment.captured',
    payload: { amount: 400 },
    isValidSignature: true,
    processedAt: new Date().toISOString(),
  });
  if (duplicateInsert) throw new Error('Test 7 Failed: Duplicate webhook was not deduplicated');
  console.log('✓ Test 6 & 7 Passed: Webhook recording and strict duplicate rejection verified');

  // Test 5: Print Job Creation & Atomic Claiming
  const testJobId = `job_test_${Date.now()}`;
  await db.createPrintJob({
    id: testJobId,
    orderId: testOrderId,
    publicId: testPublicId,
    printerName: 'HP LaserJet Pro M404dn',
    status: 'QUEUED',
    config: validOrderPayload.config,
    documentId: 'doc_test_123',
    totalPages: 2,
    copies: 1,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const claimedJob = await db.claimNextJob('agent_win_desk_01');
  if (!claimedJob || claimedJob.id !== testJobId || claimedJob.status !== 'CLAIMED') {
    throw new Error('Test 8 Failed: Atomic job claiming failed');
  }

  // Second claim should return null because queue is empty
  const secondClaim = await db.claimNextJob('agent_win_desk_01');
  if (secondClaim && secondClaim.id === testJobId) {
    throw new Error('Test 9 Failed: Double claim prevented check failed');
  }
  console.log('✓ Test 8 & 9 Passed: Atomic Print Job claiming and exclusive lock verified');

  // Test 6: Audit logging
  await db.logAudit('TEST_RUNNER', 'PHASE1_VERIFY', 'DATABASE_CORE', 'Phase 1 verification completed.');
  const logs = await db.listAuditLogs(10);
  if (!logs.some((l) => l.action === 'PHASE1_VERIFY')) {
    throw new Error('Test 10 Failed: Audit log entry missing');
  }
  console.log('✓ Test 10 Passed: Audit log persistence verified');

  console.log('\n--- ALL PHASE 1 TESTS PASSED SUCCESSFULLY! ---');
}

runPhase1Tests().catch((err) => {
  console.error('Phase 1 Test Error:', err);
  process.exit(1);
});
