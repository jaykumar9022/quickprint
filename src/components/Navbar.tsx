import React from 'react';
import { Printer, Shield, Terminal, QrCode, Wifi, CheckCircle2, AlertCircle } from 'lucide-react';
import { ShopSettings } from '../types';

interface NavbarProps {
  activeTab: 'customer' | 'admin' | 'agent' | 'standee';
  setActiveTab: (tab: 'customer' | 'admin' | 'agent' | 'standee') => void;
  shop: ShopSettings | null;
  agentOnline: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, shop, agentOnline }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('customer')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Printer className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">
                  Quick<span className="text-blue-600">Print</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  SaaS v1.0
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block truncate max-w-[240px]">
                {shop?.name || 'Automated Shop Print Hub'}
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setActiveTab('customer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'customer'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Customer Hub</span>
            </button>

            <button
              onClick={() => setActiveTab('agent')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'agent'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Agent Live Monitor</span>
              <span className={`w-2 h-2 rounded-full ${agentOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'admin'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Shop Admin</span>
            </button>

            <button
              onClick={() => setActiveTab('standee')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'standee'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Shop QR Standee</span>
            </button>
          </nav>

          {/* Hardware Status Pill */}
          <div className="hidden md:flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
                agentOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {agentOnline ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Printer Online & Ready</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Agent Offline</span>
                </>
              )}
            </div>

            {shop?.wifiSsid && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                <Wifi className="w-3 h-3 text-slate-500" />
                <span className="hidden lg:inline">{shop.wifiSsid}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
