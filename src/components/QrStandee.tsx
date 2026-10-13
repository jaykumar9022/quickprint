import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Printer, Wifi, Sparkles, Smartphone, CheckCircle2, Download, Copy, ExternalLink } from 'lucide-react';
import { ShopSettings } from '../types';

interface QrStandeeProps {
  shop: ShopSettings | null;
}

export const QrStandee: React.FC<QrStandeeProps> = ({ shop }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'https://quickprint.shop';

  useEffect(() => {
    QRCode.toDataURL(currentUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.warn('QR code generation warning:', err));
  }, [currentUrl]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header controls (hidden when printing) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Shop Counter QR Standee</h2>
          <p className="text-xs text-slate-500">
            Print this standee and display it at your billing desk or front counter for customers to scan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedLink ? 'Copied URL!' : 'Copy Shop URL'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Standee (A4/A5)</span>
          </button>
        </div>
      </div>

      {/* Standee Document Template (Clean Printable Layout) */}
      <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-slate-300 shadow-xl max-w-xl mx-auto text-center space-y-6 print:border-none print:shadow-none print:p-4">
        {/* Shop Logo & Title */}
        <div>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-md mb-3">
            <Printer className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {shop?.name || 'QuickPrint Xerox Hub'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            {shop?.tagline || 'High Speed Laser & Color Printing Station'}
          </p>
        </div>

        {/* Big QR Code Card */}
        <div className="p-6 rounded-3xl bg-slate-50 border-2 border-slate-200 inline-block shadow-inner">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs inline-block">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QuickPrint Shop QR Code" className="w-64 h-64 mx-auto" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-slate-100 rounded-xl text-xs text-slate-400">
                Generating QR...
              </div>
            )}
          </div>
          <span className="block text-xs font-mono font-bold text-slate-700 mt-3 uppercase tracking-wider">
            Scan with any phone camera
          </span>
        </div>

        {/* 3 Step Instructions */}
        <div className="grid grid-cols-3 gap-3 text-left">
          <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mb-2">
              1
            </span>
            <h4 className="text-xs font-bold text-slate-900">Scan & Upload</h4>
            <p className="text-[11px] text-slate-600 mt-0.5">Point camera at QR and choose your PDF.</p>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold mb-2">
              2
            </span>
            <h4 className="text-xs font-bold text-slate-900">Choose & Pay</h4>
            <p className="text-[11px] text-slate-600 mt-0.5">Select B&W or Color, pay via UPI / GPay.</p>
          </div>

          <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-100">
            <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold mb-2">
              3
            </span>
            <h4 className="text-xs font-bold text-slate-900">Collect Print</h4>
            <p className="text-[11px] text-slate-600 mt-0.5">Printer outputs automatically at counter!</p>
          </div>
        </div>

        {/* Shop Free Customer Wi-Fi Card */}
        {shop?.wifiSsid && (
          <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center gap-4 text-xs font-medium text-slate-700">
            <div className="flex items-center gap-1.5 font-bold">
              <Wifi className="w-4 h-4 text-blue-600" />
              <span>Customer Wi-Fi:</span>
            </div>
            <div className="font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-300">
              SSID: <span className="font-bold text-slate-900">{shop.wifiSsid}</span>
            </div>
            {shop.wifiPassword && (
              <div className="font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                Password: <span className="font-bold text-slate-900">{shop.wifiPassword}</span>
              </div>
            )}
          </div>
        )}

        {/* Privacy footnote */}
        <p className="text-[10px] text-slate-400">
          QuickPrint SaaS • Powered by automated local spooling • Uploaded files are automatically wiped after 2 hours.
        </p>
      </div>
    </div>
  );
};
