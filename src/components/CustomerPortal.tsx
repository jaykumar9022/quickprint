import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Eye,
  RefreshCw,
  QrCode,
  ArrowRight,
  HelpCircle,
  Copy,
  Smartphone,
  CreditCard,
  Building2,
  Printer as PrinterIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  ShopSettings,
  PricingRule,
  PrintConfig,
  PriceQuote,
  OrderRecord,
  PrintJobRecord,
  PrintEventRecord,
} from '../types';
import {
  uploadDocument,
  deleteUploadedDocument,
  createQuote,
  createOrder,
  fetchOrderByPublicId,
  simulatePayment,
} from '../services/api';

interface CustomerPortalProps {
  shop: ShopSettings | null;
  pricing: PricingRule | null;
  agentOnline: boolean;
  onOpenAgentMonitor: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  shop,
  pricing,
  agentOnline,
  onOpenAgentMonitor,
}) => {
  // Step state: 'upload' | 'configure' | 'payment' | 'tracking'
  const [currentStep, setCurrentStep] = useState<'upload' | 'configure' | 'tracking'>('upload');

  // File & Document State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<{
    id: string;
    originalFilename: string;
    fileSizeBytes: number;
    pageCount: number;
    uploadedAt: string;
    expiresAt: string;
  } | null>(null);

  // Preview Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Configuration State
  const [config, setConfig] = useState<PrintConfig>({
    printMode: 'bw',
    paperSize: 'A4',
    printSides: 'single',
    copies: 1,
    pageSelection: 'all',
    customPages: '',
    orientation: 'portrait',
    paperType: 'Normal (75gsm)',
  });

  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNote, setCustomerNote] = useState('');

  // Quote State
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);

  // Active Order & Tracking State
  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);
  const [activeJob, setActiveJob] = useState<PrintJobRecord | null>(null);
  const [jobEvents, setJobEvents] = useState<PrintEventRecord[]>([]);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'UPI_GPay' | 'UPI_PhonePe' | 'UPI_Paytm' | 'CARD' | 'NETBANKING'>('UPI_GPay');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-fetch price quote whenever config changes
  useEffect(() => {
    if (uploadedDoc) {
      let isMounted = true;
      setIsQuoting(true);
      createQuote(uploadedDoc.id, config)
        .then((res) => {
          if (isMounted) {
            setQuote(res.quote);
            setIsQuoting(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsQuoting(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [uploadedDoc, config]);

  // Polling tracker for active order
  useEffect(() => {
    if (currentStep === 'tracking' && activeOrder?.publicId) {
      const interval = setInterval(async () => {
        try {
          const data = await fetchOrderByPublicId(activeOrder.publicId);
          setActiveOrder(data.order);
          if (data.job) setActiveJob(data.job);
          if (data.jobEvents) setJobEvents(data.jobEvents);

          if (data.order.printStatus === 'COMPLETED') {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.7 },
            });
          }
        } catch (e) {
          console.warn('Polling error', e);
        }
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [currentStep, activeOrder?.publicId]);

  // Create sample PDF for rapid evaluation
  const handleUploadSamplePdf = async () => {
    setIsUploading(true);
    setUploadError(null);
    try {
      // Create minimal valid PDF in memory
      const samplePdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R >>
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R >>
endobj
6 0 obj
<< /Length 55 >>
stream
BT /F1 24 Tf 100 700 Td (QuickPrint Sample Document - Page 1) ET
endstream
endobj
7 0 obj
<< /Length 55 >>
stream
BT /F1 24 Tf 100 700 Td (QuickPrint Sample Document - Page 2) ET
endstream
endobj
8 0 obj
<< /Length 55 >>
stream
BT /F1 24 Tf 100 700 Td (QuickPrint Sample Document - Page 3) ET
endstream
endobj
xref
0 9
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000133 00000 n 
0000000223 00000 n 
0000000313 00000 n 
0000000403 00000 n 
0000000508 00000 n 
0000000613 00000 n 
trailer
<< /Size 9 /Root 1 0 R >>
startxref
718
%%EOF`;

      const blob = new Blob([samplePdfContent], { type: 'application/pdf' });
      const sampleFile = new File([blob], 'QuickPrint_Demo_Invoice_3Pages.pdf', {
        type: 'application/pdf',
      });

      const res = await uploadDocument(sampleFile);
      setUploadedDoc(res.document);
      setCurrentStep('configure');
    } catch (err: any) {
      setUploadError(err.message || 'Sample PDF generation failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF documents are supported for automatic printing.');
      return;
    }

    if (file.size > (shop?.maxFileSizeMb || 25) * 1024 * 1024) {
      setUploadError(`File size exceeds store limit of ${shop?.maxFileSizeMb || 25} MB.`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      const res = await uploadDocument(file);
      setUploadedDoc(res.document);
      setCurrentStep('configure');
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!uploadedDoc) return;
    try {
      setPaymentError(null);
      const res = await createOrder({
        documentId: uploadedDoc.id,
        config,
        customerPhone,
        customerNote,
      });
      setActiveOrder(res.order);
      setShowPaymentModal(true);
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to initialize order');
    }
  };

  const handleExecutePaymentSimulation = async () => {
    if (!activeOrder) return;
    setIsPaying(true);
    setPaymentError(null);
    try {
      const res = await simulatePayment(activeOrder.id, paymentMethod);
      setActiveOrder(res.order);
      setShowPaymentModal(false);
      setCurrentStep('tracking');
    } catch (err: any) {
      setPaymentError(err.message || 'Payment simulation failed');
    } finally {
      setIsPaying(false);
    }
  };

  const copyPublicId = () => {
    if (activeOrder?.publicId) {
      navigator.clipboard.writeText(activeOrder.publicId);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-16">
      {/* Hero / Landing Header */}
      <section className="bg-gradient-to-b from-blue-50/70 via-white to-slate-50 border-b border-slate-200/60 py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200 text-blue-800 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Instant Shop QR Printing • No App Download Required</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-3">
            Scan. Upload. Pay. <span className="text-blue-600">Print.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-6">
            Upload your document from your phone, customize print settings, pay securely, and collect your crisp prints right off the shop printer tray.
          </p>

          {/* Shop Hardware Status Badge */}
          <div className="inline-flex flex-wrap items-center justify-center gap-4 bg-white p-3 rounded-2xl shadow-xs border border-slate-200 text-xs text-slate-700">
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${agentOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-semibold">{shop?.name || 'QuickPrint Station'}</span>
            </div>
            <div className="hidden sm:block text-slate-300">•</div>
            <div className="flex items-center gap-1 text-slate-600">
              <PrinterIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Laser B&W & Color Ready</span>
            </div>
            <div className="hidden sm:block text-slate-300">•</div>
            <div className="flex items-center gap-1 text-emerald-700 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Files Auto-Deleted in 2 hrs</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
        {/* Navigation Breadcrumb Steps */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
          <button
            onClick={() => setCurrentStep('upload')}
            className={`flex items-center gap-2 text-xs sm:text-sm font-semibold transition-colors ${
              currentStep === 'upload' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${currentStep === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
              1
            </span>
            <span>Upload Document</span>
          </button>

          <ChevronRight className="w-4 h-4 text-slate-300" />

          <button
            onClick={() => uploadedDoc && setCurrentStep('configure')}
            disabled={!uploadedDoc}
            className={`flex items-center gap-2 text-xs sm:text-sm font-semibold transition-colors ${
              currentStep === 'configure' ? 'text-blue-600' : !uploadedDoc ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${currentStep === 'configure' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
              2
            </span>
            <span>Print Settings & Pricing</span>
          </button>

          <ChevronRight className="w-4 h-4 text-slate-300" />

          <button
            onClick={() => activeOrder && setCurrentStep('tracking')}
            disabled={!activeOrder}
            className={`flex items-center gap-2 text-xs sm:text-sm font-semibold transition-colors ${
              currentStep === 'tracking' ? 'text-blue-600' : !activeOrder ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${currentStep === 'tracking' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
              3
            </span>
            <span>Live Order Status</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: UPLOAD DOCUMENT */}
        {/* ========================================================================= */}
        {currentStep === 'upload' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Upload Your PDF Document</h2>
              <p className="text-sm text-slate-500 mb-6">
                Select your PDF file from your phone storage or computer. We will count pages and calculate the exact shop rate instantly.
              </p>

              {/* Upload Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-blue-50/30 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,application/pdf"
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-blue-100 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center mx-auto mb-4 transition-colors">
                  <Upload className="w-8 h-8" />
                </div>

                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Tap to upload or drag & drop PDF here
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  PDF documents up to {shop?.maxFileSizeMb || 25} MB • Maximum {shop?.maxPagesAllowed || 250} pages
                </p>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs group-hover:bg-blue-700">
                  <FileText className="w-4 h-4" />
                  <span>Choose PDF File</span>
                </div>
              </div>

              {isUploading && (
                <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3 text-blue-800 text-xs font-medium">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Validating PDF structure, checking security permissions, and scanning page count...</span>
                </div>
              )}

              {uploadError && (
                <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Demo Sample Helper */}
              <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Testing on mobile or no PDF at hand?</span> Use our sample test invoice document:
                </div>
                <button
                  type="button"
                  onClick={handleUploadSamplePdf}
                  disabled={isUploading}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Load Sample 3-Page PDF</span>
                </button>
              </div>
            </div>

            {/* Shop Price Rate Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>Shop Official Print Rates</span>
                <span className="text-[10px] font-normal text-slate-400">All prices in INR (₹)</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-500 block mb-1">Black & White (A4)</span>
                  <span className="text-lg font-extrabold text-slate-900">
                    ₹{((pricing?.bwPricePaise || 200) / 100).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">per printed side</span>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100">
                  <span className="text-xs text-blue-700 block mb-1">Color High-Res (A4)</span>
                  <span className="text-lg font-extrabold text-blue-900">
                    ₹{((pricing?.colorPricePaise || 1000) / 100).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-blue-500 block">per printed side</span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-xs text-emerald-700 block mb-1">Duplex (Both Sides)</span>
                  <span className="text-lg font-extrabold text-emerald-900">
                    {Math.round((1 - (pricing?.duplexMultiplier || 0.9)) * 100)}% Off
                  </span>
                  <span className="text-[10px] text-emerald-600 block">paper saver discount</span>
                </div>

                <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-100">
                  <span className="text-xs text-purple-700 block mb-1">Min Order</span>
                  <span className="text-lg font-extrabold text-purple-900">
                    ₹{((shop?.minOrderPaise || 500) / 100).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-purple-500 block">minimum store billing</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: CONFIGURE PRINT SETTINGS & PREVIEW */}
        {/* ========================================================================= */}
        {currentStep === 'configure' && uploadedDoc && (
          <div className="space-y-6">
            {/* Active Document Header Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-[280px] sm:max-w-md">
                    {uploadedDoc.originalFilename}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>{(uploadedDoc.fileSizeBytes / 1024).toFixed(1)} KB</span>
                    <span>•</span>
                    <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      {uploadedDoc.pageCount} Pages detected
                    </span>
                    {(uploadedDoc as any).detectedPaperSize && (
                      <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {(uploadedDoc as any).detectedPaperSize} ({(uploadedDoc as any).detectedOrientation || 'portrait'})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Preview PDF</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (uploadedDoc?.id) {
                      await deleteUploadedDocument(uploadedDoc.id);
                    }
                    setUploadedDoc(null);
                    setCurrentStep('upload');
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-rose-600 text-xs font-semibold hover:bg-rose-50"
                >
                  Change File
                </button>
              </div>
            </div>

            {/* Print Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Settings Configuration Column */}
              <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Select Print Preferences
                </h3>

                {/* 1. Print Mode: B&W vs Color */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    1. Print Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, printMode: 'bw' })}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        config.printMode === 'bw'
                          ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-sm">Black & White</span>
                        <span className="text-xs font-extrabold text-blue-700">
                          ₹{((pricing?.bwPricePaise || 200) / 100).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">High speed laser monochrome, ideal for text & forms</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, printMode: 'color' })}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        config.printMode === 'color'
                          ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-sm">Full Color</span>
                        <span className="text-xs font-extrabold text-blue-700">
                          ₹{((pricing?.colorPricePaise || 1000) / 100).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">Vibrant high-resolution inkjet / laser for graphics & photos</p>
                    </button>
                  </div>
                </div>

                {/* 2. Sides: Single vs Double Sided */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    2. Print Sides (Duplex)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, printSides: 'single' })}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        config.printSides === 'single'
                          ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="font-bold text-slate-900 text-sm block">Single-Sided (Simplex)</span>
                      <span className="text-[11px] text-slate-500">One page per sheet</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, printSides: 'double' })}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        config.printSides === 'double'
                          ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">Double-Sided (Duplex)</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          Save 10%
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">Prints both front and back</span>
                    </button>
                  </div>
                </div>

                {/* 3. Paper Size & Paper Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      3. Paper Size
                    </label>
                    <select
                      value={config.paperSize}
                      onChange={(e) => setConfig({ ...config, paperSize: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                    >
                      <option value="A4">A4 (Standard 210 × 297 mm) — Default</option>
                      <option value="Legal">Legal (8.5 × 14 in) — +₹1.00</option>
                      <option value="A3">A3 (Poster / Ledger 297 × 420 mm) — +₹6.00</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      4. Paper Stock Type
                    </label>
                    <select
                      value={config.paperType}
                      onChange={(e) => setConfig({ ...config, paperType: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                    >
                      <option value="Normal (75gsm)">Normal 75gsm Copier Paper</option>
                      <option value="Bond (100gsm)">Executive Bond 100gsm (+₹3.00)</option>
                      <option value="Glossy Photo (180gsm)">Glossy Photo 180gsm (+₹15.00)</option>
                    </select>
                  </div>
                </div>

                {/* 4. Number of Copies */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      5. Number of Copies
                    </label>
                    <div className="flex gap-1.5">
                      {[1, 2, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setConfig({ ...config, copies: num })}
                          className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                            config.copies === num
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, copies: Math.max(1, config.copies - 1) })}
                      className="w-10 h-10 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 flex items-center justify-center text-lg"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={config.copies}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          copies: Math.max(1, parseInt(e.target.value || '1', 10)),
                        })
                      }
                      className="w-20 text-center py-2 rounded-xl border border-slate-200 font-extrabold text-slate-900 text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, copies: config.copies + 1 })}
                      className="w-10 h-10 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 flex items-center justify-center text-lg"
                    >
                      +
                    </button>
                    <span className="text-xs text-slate-500">Set (Total {quote?.pricingBreakdown.totalPrintedSides || uploadedDoc.pageCount * config.copies} pages to print)</span>
                  </div>
                </div>

                {/* 5. Page Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    6. Page Range Selection
                  </label>
                  <div className="flex items-center gap-4 mb-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        checked={config.pageSelection === 'all'}
                        onChange={() => setConfig({ ...config, pageSelection: 'all' })}
                        className="text-blue-600 focus:ring-blue-600"
                      />
                      <span>Print All Pages (1 to {uploadedDoc.pageCount})</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        checked={config.pageSelection === 'custom'}
                        onChange={() => setConfig({ ...config, pageSelection: 'custom' })}
                        className="text-blue-600 focus:ring-blue-600"
                      />
                      <span>Specific Pages Only</span>
                    </label>
                  </div>

                  {config.pageSelection === 'custom' && (
                    <div className="mt-2 space-y-1.5">
                      <input
                        type="text"
                        placeholder="e.g. 1-3, 5, 7"
                        value={config.customPages || ''}
                        onChange={(e) => setConfig({ ...config, customPages: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                      />
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Enter comma-separated page numbers or ranges (1-{uploadedDoc.pageCount}).</span>
                        {quote?.pricingBreakdown.selectedPages && (
                          <span className="font-semibold text-blue-600">
                            Printing {quote.pricingBreakdown.selectedPages.length} of {uploadedDoc.pageCount} pages
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Customer Contact & Special Instructions */}
                <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer Phone (Optional for SMS receipt)
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Note to Operator (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Please staple top-left corner"
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Order Summary & Pricing Breakdown Column */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between h-fit sticky top-20">
                <div>
                  <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                    <span>Order Price Quote</span>
                    {isQuoting && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />}
                  </h3>

                  <div className="space-y-3 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Document:</span>
                      <span className="font-semibold text-slate-900 truncate max-w-[140px]">
                        {uploadedDoc.originalFilename}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Pages Selected:</span>
                      <span className="font-semibold text-slate-900">
                        {quote?.pricingBreakdown.selectedPagesCount || uploadedDoc.pageCount} pages
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Copies:</span>
                      <span className="font-semibold text-slate-900">{config.copies}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Total Sides to Print:</span>
                      <span className="font-semibold text-slate-900">
                        {quote?.pricingBreakdown.totalPrintedSides || uploadedDoc.pageCount * config.copies}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Paper Sheets Needed:</span>
                      <span className="font-semibold text-slate-900">
                        {quote?.pricingBreakdown.sheetsUsed || Math.ceil(uploadedDoc.pageCount / 2)} sheets
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Print Rate / Side:</span>
                      <span className="font-semibold text-slate-900">
                        ₹{((quote?.pricingBreakdown.ratePerSidePaise || 200) / 100).toFixed(2)}
                      </span>
                    </div>

                    {quote && quote.pricingBreakdown.sheetCostPerUnitPaise > 0 && (
                      <div className="flex justify-between text-indigo-700">
                        <span>Paper Size/Type Add-on:</span>
                        <span className="font-semibold">
                          +₹{((quote.pricingBreakdown.sheetCostPerUnitPaise * quote.pricingBreakdown.sheetsUsed) / 100).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {quote && quote.pricingBreakdown.savingsPaise && quote.pricingBreakdown.savingsPaise > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Duplex Savings (10% off):</span>
                        <span>-₹{(quote.pricingBreakdown.savingsPaise / 100).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                      <span className="text-sm font-bold text-slate-900">Total Payable:</span>
                      <div className="text-right">
                        <span className="text-2xl font-black text-blue-600">
                          ₹{((quote?.finalAmountPaise || 500) / 100).toFixed(2)}
                        </span>
                        <span className="block text-[10px] text-slate-400">Includes all taxes</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Pay ₹{((quote?.finalAmountPaise || 500) / 100).toFixed(2)}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Instant UPI & Card Sandbox Gateway</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: ORDER TRACKER & PRINT JOB PROGRESS */}
        {/* ========================================================================= */}
        {currentStep === 'tracking' && activeOrder && (
          <div className="space-y-6">
            {/* Status Hero Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-4">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Payment Verified ({activeOrder.paymentId || 'UPI Captured'})</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
                Order <span className="font-mono text-blue-600">{activeOrder.publicId}</span>
              </h2>

              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6">
                Your print job is active. Show this Order ID at the shop counter to collect your prints.
              </p>

              {/* Progress Steps Timeline */}
              <div className="max-w-2xl mx-auto py-6">
                <div className="grid grid-cols-5 gap-2 relative">
                  {/* Step 1: Paid */}
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center text-xs font-bold bg-emerald-600 text-white shadow-xs">
                      ✓
                    </div>
                    <span className="text-[11px] font-semibold text-slate-900 block mt-2">Paid & Verified</span>
                  </div>

                  {/* Step 2: Queued */}
                  <div className="text-center">
                    <div
                      className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center text-xs font-bold ${
                        ['QUEUED', 'CLAIMED', 'DOWNLOADING', 'SUBMITTED_TO_SPOOLER', 'COMPLETED'].includes(activeOrder.printStatus)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {['QUEUED', 'CLAIMED', 'DOWNLOADING', 'SUBMITTED_TO_SPOOLER', 'COMPLETED'].includes(activeOrder.printStatus) ? '✓' : '2'}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-900 block mt-2">In Queue</span>
                  </div>

                  {/* Step 3: Claimed */}
                  <div className="text-center">
                    <div
                      className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center text-xs font-bold ${
                        ['CLAIMED', 'DOWNLOADING', 'SUBMITTED_TO_SPOOLER', 'COMPLETED'].includes(activeOrder.printStatus)
                          ? 'bg-emerald-600 text-white'
                          : activeOrder.printStatus === 'QUEUED'
                          ? 'bg-blue-600 text-white animate-pulse'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {['CLAIMED', 'DOWNLOADING', 'SUBMITTED_TO_SPOOLER', 'COMPLETED'].includes(activeOrder.printStatus) ? '✓' : '3'}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-900 block mt-2">Agent Claimed</span>
                  </div>

                  {/* Step 4: Spooling */}
                  <div className="text-center">
                    <div
                      className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center text-xs font-bold ${
                        ['SUBMITTED_TO_SPOOLER', 'COMPLETED'].includes(activeOrder.printStatus)
                          ? 'bg-emerald-600 text-white'
                          : ['CLAIMED', 'DOWNLOADING'].includes(activeOrder.printStatus)
                          ? 'bg-blue-600 text-white animate-pulse'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {['SUBMITTED_TO_SPOOLER', 'COMPLETED'].includes(activeOrder.printStatus) ? '✓' : '4'}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-900 block mt-2">Spooling</span>
                  </div>

                  {/* Step 5: Ready */}
                  <div className="text-center">
                    <div
                      className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center text-xs font-bold ${
                        activeOrder.printStatus === 'COMPLETED'
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {activeOrder.printStatus === 'COMPLETED' ? '★' : '5'}
                    </div>
                    <span className="text-[11px] font-bold text-slate-900 block mt-2">Printed!</span>
                  </div>
                </div>
              </div>

              {/* Current Status Message Callout */}
              <div
                className={`p-4 rounded-2xl max-w-lg mx-auto text-xs font-medium border ${
                  activeOrder.printStatus === 'COMPLETED'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : ['FAILED', 'NEEDS_OPERATOR_REVIEW'].includes(activeOrder.printStatus)
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}
              >
                {activeOrder.printStatus === 'COMPLETED' ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Your document has been printed! Please collect it from the counter tray.</span>
                  </div>
                ) : ['FAILED', 'NEEDS_OPERATOR_REVIEW'].includes(activeOrder.printStatus) ? (
                  <div className="flex items-center justify-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>The printer encountered an issue. The shop operator is assisting right now.</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span>
                      {activeOrder.printStatus === 'QUEUED' && 'Dispatched to shop queue. Waiting for Windows agent to claim...'}
                      {activeOrder.printStatus === 'CLAIMED' && 'Windows Print Agent has claimed your file and is downloading...'}
                      {activeOrder.printStatus === 'DOWNLOADING' && 'Downloading high-resolution PDF to local spool cache...'}
                      {activeOrder.printStatus === 'SUBMITTED_TO_SPOOLER' && `Sent to printer [${activeJob?.printerName || 'Laser Printer'}]. Outputting pages...`}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={copyPublicId}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 hover:bg-slate-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Order ID ({activeOrder.publicId})</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenAgentMonitor}
                  className="px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold flex items-center gap-2 hover:bg-indigo-100"
                >
                  <PrinterIcon className="w-3.5 h-3.5" />
                  <span>View Live Windows Agent Console</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUploadedDoc(null);
                    setActiveOrder(null);
                    setCurrentStep('upload');
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold flex items-center gap-2 hover:bg-blue-700 shadow-xs"
                >
                  <span>Print Another Document</span>
                </button>
              </div>
            </div>

            {/* Print Events Audit Trail */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
                <span>Hardware & Spooler Transition Log</span>
                <span className="text-[10px] font-mono text-slate-400">Auto-refreshing</span>
              </h3>

              <div className="space-y-3">
                {jobEvents.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Awaiting initial spooler event...</p>
                ) : (
                  jobEvents.map((ev, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs border-b border-slate-50 pb-2">
                      <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap pt-0.5">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-slate-100 text-slate-700 uppercase font-semibold">
                        {ev.state}
                      </span>
                      <span className="text-slate-700 flex-1">{ev.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: DOCUMENT PREVIEW */}
      {/* ========================================================================= */}
      {showPreviewModal && uploadedDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{uploadedDoc.originalFilename}</h4>
                <p className="text-xs text-slate-500">{uploadedDoc.pageCount} Pages • In-Browser Document Preview</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 bg-slate-100 p-4 overflow-auto min-h-[450px]">
              <iframe
                src={`/api/v1/documents/${uploadedDoc.id}/preview`}
                className="w-full h-full min-h-[450px] rounded-xl border border-slate-200 shadow-xs bg-white"
                title="PDF Preview"
              />
            </div>

            <div className="p-3 bg-amber-50 border-t border-amber-100 text-[11px] text-amber-800 text-center">
              Notice: Document preview is for content verification. Output page margins and alignment will match physical printer calibration.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RAZORPAY SANDBOX CHECKOUT SIMULATOR */}
      {/* ========================================================================= */}
      {showPaymentModal && activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            {/* Razorpay Brand Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold tracking-widest uppercase opacity-80">Razorpay Trusted Sandbox</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono">Test Mode</span>
              </div>
              <h3 className="font-extrabold text-xl">{shop?.name || 'QuickPrint Digital Hub'}</h3>
              <p className="text-xs opacity-90">Order #{activeOrder.publicId}</p>
              <div className="mt-3 text-2xl font-black">
                ₹{(activeOrder.totalPaise / 100).toFixed(2)}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="p-5 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Select Payment Method
              </span>

              <div className="space-y-2">
                <label
                  onClick={() => setPaymentMethod('UPI_GPay')}
                  className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'UPI_GPay' ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-blue-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Google Pay (UPI)</span>
                      <span className="text-[10px] text-slate-500">Fast 1-tap checkout</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">@okhdfcbank</span>
                </label>

                <label
                  onClick={() => setPaymentMethod('UPI_PhonePe')}
                  className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'UPI_PhonePe' ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-purple-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">PhonePe / Paytm UPI</span>
                      <span className="text-[10px] text-slate-500">Instant UPI authorization</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">@ybl</span>
                </label>

                <label
                  onClick={() => setPaymentMethod('CARD')}
                  className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'CARD' ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Debit / Credit Card</span>
                      <span className="text-[10px] text-slate-500">Visa, MasterCard, RuPay</span>
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setPaymentMethod('NETBANKING')}
                  className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'NETBANKING' ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-amber-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Net Banking</span>
                      <span className="text-[10px] text-slate-500">All major Indian banks</span>
                    </div>
                  </div>
                </label>
              </div>

              {paymentError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs">
                  {paymentError}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExecutePaymentSimulation}
                  disabled={isPaying}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isPaying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying HMAC Webhook...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Simulate Success & Trigger Signed Webhook</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                >
                  Cancel payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
