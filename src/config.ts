import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env if present
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL,
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'quickprint_user',
    password: process.env.PGPASSWORD || 'secure_shop_password_2026',
    database: process.env.PGDATABASE || 'quickprint',
    ssl: process.env.PGSSL === 'true',
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'quickprint2026',
    jwtSecret: process.env.ADMIN_JWT_SECRET || 'qp_super_secret_jwt_admin_key_2026',
  },

  payment: {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_quickprint_demo_key_2026',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_key_demo_2026',
    webhookSecret: process.env.WEBHOOK_SECRET || 'whsec_quickprint_live_sandbox_secret_2026',
  },

  agent: {
    registrationKey: process.env.AGENT_REGISTRATION_KEY || 'QP-AGENT-SECURE-KEY-8821',
  },

  storage: {
    retentionHours: parseInt(process.env.DOCUMENT_RETENTION_HOURS || '2', 10),
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10),
    maxPagesAllowed: parseInt(process.env.MAX_PAGES_ALLOWED || '250', 10),
  },

  shop: {
    id: process.env.SHOP_ID || 'shop_001',
    name: process.env.SHOP_NAME || 'QuickPrint Xerox & Digital Hub',
    tagline: process.env.SHOP_TAGLINE || 'High Speed Laser & Color Printing Station',
    address: process.env.SHOP_ADDRESS || 'Shop #4, Metro Station Commercial Plaza, Sector 18',
    phone: process.env.SHOP_PHONE || '+91 98765 43210',
    email: process.env.SHOP_EMAIL || 'shop@quickprint.io',
    upiVpa: process.env.SHOP_UPI_VPA || 'quickprint@icici',
    currency: process.env.SHOP_CURRENCY || 'INR',
    minOrderPaise: parseInt(process.env.SHOP_MIN_ORDER_PAISE || '500', 10),
    wifiSsid: process.env.SHOP_WIFI_SSID || 'QuickPrint_Free_WiFi',
    wifiPassword: process.env.SHOP_WIFI_PASSWORD || 'printnowguest',
  },
};
