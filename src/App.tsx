import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CustomerPortal } from './components/CustomerPortal';
import { AdminDashboard } from './components/AdminDashboard';
import { AgentSimulator } from './components/AgentSimulator';
import { QrStandee } from './components/QrStandee';
import { ShopSettings, PricingRule } from './types';
import { fetchShop, fetchPricing, DEFAULT_SHOP_DATA, DEFAULT_PRICING_DATA } from './services/api';
import { Printer, Shield, Terminal, QrCode } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'customer' | 'admin' | 'agent' | 'standee'>('customer');
  const [shop, setShop] = useState<ShopSettings>(DEFAULT_SHOP_DATA);
  const [pricing, setPricing] = useState<PricingRule>(DEFAULT_PRICING_DATA);
  const [agentOnline, setAgentOnline] = useState(true);

  const loadShopData = async () => {
    try {
      const [shopRes, pricingRes] = await Promise.all([fetchShop(), fetchPricing()]);
      if (shopRes?.shop) {
        setShop(shopRes.shop);
        setAgentOnline(shopRes.shop.agentOnline);
      }
      if (pricingRes?.pricing) {
        setPricing(pricingRes.pricing);
      }
    } catch (err) {
      console.warn('Background sync for shop data deferred:', err);
    }
  };

  useEffect(() => {
    loadShopData();
    const interval = setInterval(loadShopData, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        shop={shop}
        agentOnline={agentOnline}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'customer' && (
          <CustomerPortal
            shop={shop}
            pricing={pricing}
            agentOnline={agentOnline}
            onOpenAgentMonitor={() => setActiveTab('agent')}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard
            shop={shop}
            onRefreshShop={loadShopData}
          />
        )}

        {activeTab === 'agent' && (
          <AgentSimulator
            apiKey="agent_sec_token_991823719283"
          />
        )}

        {activeTab === 'standee' && (
          <QrStandee
            shop={shop}
          />
        )}
      </main>

      {/* Global Footer (hidden on print) */}
      <footer className="no-print bg-white border-t border-slate-200/80 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-900">
              Quick<span className="text-blue-600">Print</span>
            </span>
            <span>• QR-Based Automatic Printing SaaS</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="hidden sm:inline text-slate-400">Zero-Install Customer Experience</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Encrypted Outbound Spooling</span>
            <span>•</span>
            <span>Files Auto-Deleted in 2 hrs</span>
            <span>•</span>
            <span>v1.0 Production Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
