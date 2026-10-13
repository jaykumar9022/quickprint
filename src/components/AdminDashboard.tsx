import React, { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Printer,
  DollarSign,
  Clock,
  RotateCcw,
  Ban,
  FileText,
  Sliders,
  History,
  Terminal,
  Send,
  Eye,
  Lock,
  LogOut,
  ChevronRight,
  TrendingUp,
  Cpu
} from 'lucide-react';
import {
  ShopSettings,
  PricingRule,
  DashboardMetrics,
  OrderRecord,
  PrintJobRecord,
  PrintEventRecord,
  AuditLogRecord,
} from '../types';
import {
  adminLogin,
  fetchAdminDashboard,
  fetchAdminOrders,
  fetchAdminOrderDetail,
  adminRetryPrint,
  adminCancelOrder,
  adminRefundOrder,
  updateAdminPricing,
  sendTestPrint,
  fetchAuditLogs,
} from '../services/api';

interface AdminDashboardProps {
  shop: ShopSettings | null;
  onRefreshShop: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ shop, onRefreshShop }) => {
  // Authentication State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('qp_admin_token') || 'admin_session_token_dev_auth');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Tab: 'overview' | 'orders' | 'printers' | 'pricing' | 'logs'
  const [adminTab, setAdminTab] = useState<'overview' | 'orders' | 'printers' | 'pricing' | 'logs'>('overview');

  // Dashboard Data
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Order Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

  // Selected Order Drawer
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderData, setSelectedOrderData] = useState<{
    order: OrderRecord;
    job?: PrintJobRecord;
    events: PrintEventRecord[];
    payment?: any;
  } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Pricing Editor
  const [editPricing, setEditPricing] = useState<{
    bwPriceRupees: number;
    colorPriceRupees: number;
    duplexMultiplier: number;
    minOrderRupees: number;
  }>({
    bwPriceRupees: 2.0,
    colorPriceRupees: 10.0,
    duplexMultiplier: 0.9,
    minOrderRupees: 5.0,
  });
  const [pricingSuccessMsg, setPricingSuccessMsg] = useState<string | null>(null);

  // Pricing Tester Calculator
  const [testPages, setTestPages] = useState(10);
  const [testCopies, setTestCopies] = useState(1);
  const [testIsColor, setTestIsColor] = useState(false);
  const [testIsDuplex, setTestIsDuplex] = useState(true);

  // Logs & Webhooks
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);

  // Test Print
  const [testPrintSuccess, setTestPrintSuccess] = useState<string | null>(null);

  const loadDashboard = async () => {
    if (!token) return;
    setIsLoadingData(true);
    try {
      const data = await fetchAdminDashboard(token);
      setMetrics(data.metrics);
      setAgents(data.agents);
      setOrders(data.recentOrders);
    } catch (e) {
      console.warn('Dashboard fetch:', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadOrders = async () => {
    if (!token) return;
    setIsLoadingData(true);
    try {
      const data = await fetchAdminOrders(token, {
        status: orderStatusFilter,
        search: orderSearch,
      });
      setOrders(data.orders);
    } catch (e) {
      console.warn('Orders fetch:', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadAuditData = async () => {
    if (!token) return;
    try {
      const data = await fetchAuditLogs(token);
      setAuditLogs(data.auditLogs);
      setWebhooks(data.webhooks);
    } catch (e) {
      console.warn('Audit logs fetch:', e);
    }
  };

  useEffect(() => {
    if (token) {
      loadDashboard();
      const interval = setInterval(loadDashboard, 6000);
      return () => clearInterval(interval);
    }
  }, [token]);

  useEffect(() => {
    if (adminTab === 'orders') {
      loadOrders();
    } else if (adminTab === 'logs') {
      loadAuditData();
    }
  }, [adminTab, orderStatusFilter, orderSearch]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await adminLogin(passwordInput);
      setToken(res.token);
      localStorage.setItem('qp_admin_token', res.token);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('qp_admin_token');
  };

  const openOrderDetail = async (orderId: string) => {
    if (!token) return;
    setSelectedOrderId(orderId);
    try {
      const data = await fetchAdminOrderDetail(token, orderId);
      setSelectedOrderData(data);
    } catch (e) {
      console.warn('Order detail fetch:', e);
    }
  };

  const handleRetryPrint = async () => {
    if (!token || !selectedOrderId) return;
    setIsActionLoading(true);
    try {
      await adminRetryPrint(token, selectedOrderId);
      await openOrderDetail(selectedOrderId);
      loadDashboard();
    } catch (e) {
      console.warn('Retry print error:', e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!token || !selectedOrderId) return;
    setIsActionLoading(true);
    try {
      await adminCancelOrder(token, selectedOrderId);
      await openOrderDetail(selectedOrderId);
      loadDashboard();
    } catch (e) {
      console.warn('Cancel order error:', e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRefundOrder = async () => {
    if (!token || !selectedOrderId) return;
    const reason = prompt('Enter reason for refund to customer:', 'Printer jam / Customer request');
    if (!reason) return;
    setIsActionLoading(true);
    try {
      await adminRefundOrder(token, selectedOrderId, reason);
      await openOrderDetail(selectedOrderId);
      loadDashboard();
    } catch (e) {
      console.warn('Refund order error:', e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await updateAdminPricing(token, {
        bwPricePaise: Math.round(editPricing.bwPriceRupees * 100),
        colorPricePaise: Math.round(editPricing.colorPriceRupees * 100),
        duplexMultiplier: editPricing.duplexMultiplier,
        minOrderPaise: Math.round(editPricing.minOrderRupees * 100),
      });
      setPricingSuccessMsg('Pricing rules saved & published to live store!');
      onRefreshShop();
      setTimeout(() => setPricingSuccessMsg(null), 4000);
    } catch (e) {
      console.warn('Save pricing error:', e);
    }
  };

  const handleSendTestPrint = async () => {
    if (!token) return;
    setTestPrintSuccess(null);
    try {
      const res = await sendTestPrint(token);
      setTestPrintSuccess(`Test print job [${res.testJob.id}] dispatched to ${res.testJob.printerName}!`);
      loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch test print.');
    }
  };

  // Login view if unauthenticated
  if (!token) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 border border-slate-200 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 text-center mb-1">
            Shop Operator Access
          </h2>
          <p className="text-xs text-slate-500 text-center mb-6">
            Log in to manage live orders, printers, pricing, and refunds.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Password
              </label>
              <input
                type="password"
                placeholder="Enter admin password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default demo password: <code className="font-mono text-slate-600">quickprint2026</code></p>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-xs transition-all"
            >
              {isLoggingIn ? 'Verifying...' : 'Sign In as Operator'}
            </button>

            <button
              type="button"
              onClick={() => {
                setPasswordInput('quickprint2026');
              }}
              className="w-full py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors"
            >
              Fill Demo Password
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Calculated price for interactive pricing tester
  const calcTestPrice = () => {
    const ratePerSide = testIsColor ? editPricing.colorPriceRupees : editPricing.bwPriceRupees;
    const effectiveRate = testIsDuplex ? ratePerSide * editPricing.duplexMultiplier : ratePerSide;
    const total = testPages * testCopies * effectiveRate;
    return Math.max(editPricing.minOrderRupees, total).toFixed(2);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Subnav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900">Shop Operator Dashboard</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              Admin Session
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {shop?.name} • Station ID: <span className="font-mono text-slate-700">{shop?.id}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDashboard}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs flex items-center gap-1.5"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setAdminTab('overview')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
            adminTab === 'overview' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Overview & Metrics
        </button>
        <button
          onClick={() => setAdminTab('orders')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
            adminTab === 'orders' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Order Queue & Spooler
        </button>
        <button
          onClick={() => setAdminTab('printers')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
            adminTab === 'printers' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Windows Printers & Hardware
        </button>
        <button
          onClick={() => setAdminTab('pricing')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
            adminTab === 'pricing' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Rate Card & Limits
        </button>
        <button
          onClick={() => setAdminTab('logs')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
            adminTab === 'logs' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Audit Log & Webhooks
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & METRICS */}
      {/* ========================================================================= */}
      {adminTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Total Orders Today</span>
              <span className="text-2xl font-black text-slate-900">{metrics?.totalOrdersToday ?? 0}</span>
              <span className="text-[11px] text-slate-400 block mt-1">Processed from QR scans</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-blue-600 block mb-1">Paid Queued for Print</span>
              <span className="text-2xl font-black text-blue-600">{metrics?.paidWaitingPrint ?? 0}</span>
              <span className="text-[11px] text-blue-400 block mt-1">Waiting for agent pickup</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-emerald-600 block mb-1">Completed Prints</span>
              <span className="text-2xl font-black text-emerald-600">{metrics?.completedJobs ?? 0}</span>
              <span className="text-[11px] text-emerald-500 block mt-1">Delivered to counter</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-purple-600 block mb-1">Total Verified Revenue</span>
              <span className="text-2xl font-black text-purple-600">₹{metrics?.totalRevenueRupees ?? '0.00'}</span>
              <span className="text-[11px] text-purple-400 block mt-1">UPI & Card verified</span>
            </div>
          </div>

          {/* Secondary Metric Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-800 block">Failed / Review Required</span>
                <span className="text-xl font-black text-amber-900">{metrics?.failedJobs ?? 0} orders</span>
              </div>
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>

            <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 block">Awaiting Customer Payment</span>
                <span className="text-xl font-black text-slate-900">{metrics?.awaitingPayment ?? 0} orders</span>
              </div>
              <Clock className="w-6 h-6 text-slate-400" />
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-800 block">Connected Windows Stations</span>
                <span className="text-xl font-black text-emerald-900">
                  {metrics?.agentStatus === 'ONLINE' ? '1 Online' : '0 Offline'}
                </span>
              </div>
              <Cpu className="w-6 h-6 text-emerald-600" />
            </div>
          </div>

          {/* Recent Orders List */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Recent Customer Print Jobs</h3>
              <button
                onClick={() => setAdminTab('orders')}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
              >
                <span>View Full Queue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-mono">
                    <th className="py-2.5">Order ID</th>
                    <th className="py-2.5">Document</th>
                    <th className="py-2.5">Config</th>
                    <th className="py-2.5">Amount</th>
                    <th className="py-2.5">Payment</th>
                    <th className="py-2.5">Print Status</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.slice(0, 5).map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/60">
                      <td className="py-3 font-mono font-bold text-blue-600">{ord.publicId}</td>
                      <td className="py-3 font-medium text-slate-800 truncate max-w-[180px]">{ord.documentName}</td>
                      <td className="py-3 text-slate-500">
                        {ord.items[0]?.config.printMode.toUpperCase()} • {ord.items[0]?.config.printSides} • {ord.items[0]?.config.copies} copies
                      </td>
                      <td className="py-3 font-bold text-slate-900">₹{(ord.totalPaise / 100).toFixed(2)}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ord.paymentStatus === 'VERIFIED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {ord.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="font-mono text-[10px] uppercase font-bold text-slate-700">
                          {ord.printStatus}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => openOrderDetail(ord.id)}
                          className="px-2 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ORDER QUEUE & SPOOLER MANAGEMENT */}
      {/* ========================================================================= */}
      {adminTab === 'orders' && (
        <div className="space-y-6">
          {/* Search & Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Order ID (QP-...), filename, or phone..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white outline-hidden"
              >
                <option value="ALL">All Statuses</option>
                <option value="QUEUED">QUEUED (Awaiting Agent)</option>
                <option value="CLAIMED">CLAIMED</option>
                <option value="SUBMITTED_TO_SPOOLER">SUBMITTED TO SPOOLER</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="FAILED">FAILED</option>
                <option value="AWAITING_PAYMENT">AWAITING PAYMENT</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-slate-500 uppercase font-mono">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Customer Document</th>
                    <th className="py-3 px-4">Pages / Sheets</th>
                    <th className="py-3 px-4">Settings</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Print Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No orders match filter criteria.
                      </td>
                    </tr>
                  ) : (
                    orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">{ord.publicId}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block truncate max-w-[200px]">{ord.documentName}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(ord.createdAt).toLocaleTimeString()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {ord.items[0]?.calculatedPages} pgs • {ord.items[0]?.sheetsUsed} sheets
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {ord.items[0]?.config.printMode.toUpperCase()} ({ord.items[0]?.config.paperSize}) • {ord.items[0]?.config.copies} cop
                        </td>
                        <td className="py-3 px-4 font-black text-slate-900">₹{(ord.totalPaise / 100).toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              ord.printStatus === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : ['FAILED', 'NEEDS_OPERATOR_REVIEW'].includes(ord.printStatus)
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {ord.printStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => openOrderDetail(ord.id)}
                            className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WINDOWS PRINTERS & HARDWARE */}
      {/* ========================================================================= */}
      {adminTab === 'printers' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Local Windows Print Stations</h3>
                <p className="text-xs text-slate-500">
                  Registered Windows PCs running the QuickPrint Print Agent daemon.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSendTestPrint}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Print Page</span>
                </button>
              </div>
            </div>

            {testPrintSuccess && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{testPrintSuccess}</span>
              </div>
            )}

            {agents.map((ag) => (
              <div key={ag.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 mb-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{ag.name}</h4>
                      <p className="text-xs font-mono text-slate-500">
                        Host: {ag.machineHostname} • IP: {ag.ipAddress} • {ag.version}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      Heartbeat: <span className="font-mono text-slate-700">{new Date(ag.lastHeartbeat).toLocaleTimeString()}</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      ONLINE
                    </span>
                  </div>
                </div>

                {/* Detected Local Printers */}
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                    Printers Enumerated by Windows Spooler:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {ag.printers.map((p: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900 text-xs truncate max-w-[180px]">{p.name}</span>
                          {p.isDefault && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-emerald-700 font-medium">{p.status}</p>
                        <div className="flex gap-2 text-[10px] text-slate-400 mt-2">
                          <span>Color: {p.supportsColor ? 'Yes' : 'No'}</span>
                          <span>•</span>
                          <span>Duplex: {p.supportsDuplex ? 'Yes' : 'No'}</span>
                          <span>•</span>
                          <span>Sizes: {p.supportedPaperSizes.join(', ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Agent Registration Token Card */}
            <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-800 block">Agent Registration Secret Key</span>
                <span className="text-slate-500">Use this token to register any additional Windows PC stations:</span>
              </div>
              <div className="font-mono font-bold bg-white px-3 py-1.5 rounded-xl border border-slate-300 text-slate-800 select-all">
                {shop?.agentRegistrationKey || 'QP-AGENT-SECURE-KEY-8821'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RATE CARD & PRICING RULES */}
      {/* ========================================================================= */}
      {adminTab === 'pricing' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-6">
              Configure Store Rate Card
            </h3>

            <form onSubmit={handleSavePricing} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Black & White Print Rate (₹ / side)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={editPricing.bwPriceRupees}
                    onChange={(e) => setEditPricing({ ...editPricing, bwPriceRupees: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold outline-hidden focus:border-blue-600"
                  />
                  <span className="text-[11px] text-slate-400">Current store rate per monochrome A4 side</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Color Print Rate (₹ / side)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={editPricing.colorPriceRupees}
                    onChange={(e) => setEditPricing({ ...editPricing, colorPriceRupees: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold outline-hidden focus:border-blue-600"
                  />
                  <span className="text-[11px] text-slate-400">High resolution color inkjet/laser</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Duplex Multiplier (Discount)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.5"
                    max="1.0"
                    value={editPricing.duplexMultiplier}
                    onChange={(e) => setEditPricing({ ...editPricing, duplexMultiplier: parseFloat(e.target.value) || 0.9 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold outline-hidden focus:border-blue-600"
                  />
                  <span className="text-[11px] text-slate-400">0.90 gives 10% discount on 2-sided prints</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Minimum Order Value (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={editPricing.minOrderRupees}
                    onChange={(e) => setEditPricing({ ...editPricing, minOrderRupees: parseFloat(e.target.value) || 5 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold outline-hidden focus:border-blue-600"
                  />
                  <span className="text-[11px] text-slate-400">Minimum total cart threshold</span>
                </div>
              </div>

              {pricingSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{pricingSuccessMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="py-3 px-6 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 shadow-xs"
              >
                Save & Update Rates
              </button>
            </form>
          </div>

          {/* Interactive Pricing Engine Tester */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
              Rate Card Live Simulator
            </h4>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Simulate Pages</label>
                <input
                  type="number"
                  min={1}
                  value={testPages}
                  onChange={(e) => setTestPages(parseInt(e.target.value || '1', 10))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Simulate Copies</label>
                <input
                  type="number"
                  min={1}
                  value={testCopies}
                  onChange={(e) => setTestCopies(parseInt(e.target.value || '1', 10))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-bold"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testIsColor}
                    onChange={(e) => setTestIsColor(e.target.checked)}
                  />
                  <span>Color</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testIsDuplex}
                    onChange={(e) => setTestIsDuplex(e.target.checked)}
                  />
                  <span>Duplex</span>
                </label>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-center">
                <span className="text-xs text-blue-700 block">Calculated Customer Price:</span>
                <span className="text-2xl font-black text-blue-900">₹{calcTestPrice()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: AUDIT LOG & WEBHOOK INSPECTOR */}
      {/* ========================================================================= */}
      {adminTab === 'logs' && (
        <div className="space-y-6">
          {/* Audit Logs */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <span>System & Operator Audit Trail</span>
            </h3>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between text-xs gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap pt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                      {log.actor}
                    </span>
                    <span className="font-semibold text-slate-900">{log.action}:</span>
                    <span className="text-slate-600">{log.details}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">{log.target}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook Events */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span>Payment Gateway Signed Webhooks Log</span>
              <span className="text-xs font-mono text-slate-400">HMAC-SHA256 Idempotent</span>
            </h3>

            <div className="space-y-3">
              {webhooks.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No payment webhooks recorded yet.</p>
              ) : (
                webhooks.map((wh) => (
                  <div key={wh.id} className="p-3 rounded-xl border border-slate-200 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-bold text-slate-900">{wh.eventType}</span>
                      <span className="text-[10px] text-slate-400">{wh.processedAt}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span>Event ID: {wh.eventId}</span>
                      <span className={wh.isValidSignature ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                        Signature: {wh.isValidSignature ? 'VALID' : 'INVALID'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ORDER DETAILS DRAWER / MODAL */}
      {/* ========================================================================= */}
      {selectedOrderId && selectedOrderData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                  <span>Order</span>
                  <span className="font-mono text-blue-600">{selectedOrderData.order.publicId}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Internal ID: <code className="font-mono">{selectedOrderData.order.id}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Order Specs */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-slate-500 block mb-1">Document:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedOrderData.order.documentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Total Amount:</span>
                  <span className="font-black text-slate-900 text-sm">
                    ₹{(selectedOrderData.order.totalPaise / 100).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Payment Status:</span>
                  <span className="font-bold text-emerald-700">{selectedOrderData.order.paymentStatus}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Print Status:</span>
                  <span className="font-mono font-bold text-blue-700">{selectedOrderData.order.printStatus}</span>
                </div>
              </div>

              {/* Spooler Info */}
              {selectedOrderData.job && (
                <div className="p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Print Job Hardware Dispatch
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div>Printer: <span className="font-semibold">{selectedOrderData.job.printerName}</span></div>
                    <div>Retry Attempts: <span className="font-semibold">{selectedOrderData.job.retryCount}</span></div>
                    <div>Spooler ID: <span className="font-mono font-semibold">{selectedOrderData.job.spoolerJobId || 'Pending'}</span></div>
                    <div>Total Pages: <span className="font-semibold">{selectedOrderData.job.totalPages}</span></div>
                  </div>
                </div>
              )}

              {/* Event transitions */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                  State Transition History
                </h4>
                <div className="space-y-1.5">
                  {selectedOrderData.events.map((ev, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-[11px]">
                      <span className="font-mono text-slate-400">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                      <span className="font-bold text-slate-800 uppercase">[{ev.state}]</span>
                      <span className="text-slate-600">{ev.message}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operator Action Controls */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRetryPrint}
                  disabled={isActionLoading || selectedOrderData.order.paymentStatus !== 'VERIFIED'}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Manual Retry Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={isActionLoading || selectedOrderData.order.printStatus === 'COMPLETED'}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cancel Job</span>
                </button>

                <button
                  type="button"
                  onClick={handleRefundOrder}
                  disabled={isActionLoading || selectedOrderData.order.paymentStatus !== 'VERIFIED'}
                  className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold flex items-center gap-1.5"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Process Refund</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
