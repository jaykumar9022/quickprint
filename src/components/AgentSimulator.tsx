import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Play,
  Square,
  AlertOctagon,
  Download,
  Copy,
  Check,
  RefreshCw,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  FileCode,
  ShieldCheck,
  Printer as PrinterIcon
} from 'lucide-react';
import {
  agentHeartbeat,
  agentClaimJob,
  agentReportEvent,
  agentCompleteJob,
  agentFailJob,
} from '../services/api';

interface AgentSimulatorProps {
  apiKey: string;
}

export const AgentSimulator: React.FC<AgentSimulatorProps> = ({ apiKey = 'agent_sec_token_991823719283' }) => {
  const [isRunning, setIsRunning] = useState(true);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] [QuickPrint.Main] Windows Print Agent v1.4.2 daemon ready.`,
    `[${new Date().toLocaleTimeString()}] [QuickPrint.Spooler] Enumerated 3 local Win32 printers: HP LaserJet Pro M404dn, Epson EcoTank L3250, Canon IR2625`,
  ]);

  const [activePrintingJob, setActivePrintingJob] = useState<{
    id: string;
    publicId: string;
    printerName: string;
    step: string;
    progress: number;
  } | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const appendLog = (msg: string) => {
    setLogs((prev) => [...prev.slice(-80), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Main simulated worker loop
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(async () => {
      try {
        // Send heartbeat
        await agentHeartbeat(apiKey);

        // Claim next job if not currently printing
        if (!activePrintingJob) {
          const claimRes = await agentClaimJob(apiKey);
          if (claimRes && claimRes.job) {
            const job = claimRes.job;
            appendLog(`CLAIMED Job [${job.publicId}] for printer [${job.printerName}]`);

            setActivePrintingJob({
              id: job.id,
              publicId: job.publicId,
              printerName: job.printerName,
              step: 'Downloading document...',
              progress: 25,
            });

            // Simulate download step
            setTimeout(async () => {
              await agentReportEvent(apiKey, job.id, 'DOWNLOADING', 'Agent downloading document via HTTPS stream.');
              appendLog(`DOWNLOADING: High-resolution PDF cached to C:\\QuickPrint\\TempSpool\\${job.id}.pdf`);

              setActivePrintingJob((prev) => prev ? { ...prev, step: 'Configuring DEVMODE & Spooler...', progress: 65 } : null);

              // Simulate spooler submission
              setTimeout(async () => {
                if (simulateFailure) {
                  // Injected hardware failure
                  appendLog(`ERROR: Win32 Spooler Error 0x80070005: Paper Jam / Out of Paper reported by ${job.printerName}`);
                  await agentFailJob(apiKey, job.id, 'Simulated hardware paper jam in Tray 2.');
                  setActivePrintingJob(null);
                } else {
                  await agentReportEvent(apiKey, job.id, 'SUBMITTED_TO_SPOOLER', `Document queued in Windows Spooler for ${job.printerName}`);
                  appendLog(`SPOOLER: Dispatched to Windows Win32 print queue with DEVMODE (Copies: ${job.copies}, Duplex: ${job.config?.printSides === 'double'})`);

                  setActivePrintingJob((prev) => prev ? { ...prev, step: 'Physical printing output...', progress: 90 } : null);

                  // Complete job
                  setTimeout(async () => {
                    const spoolerId = `WIN_SPOOL_${Math.floor(10000 + Math.random() * 90000)}`;
                    await agentCompleteJob(apiKey, job.id, spoolerId);
                    appendLog(`COMPLETED: Job [${job.publicId}] printed successfully. Spooler ID: ${spoolerId}. Temp file deleted.`);
                    setActivePrintingJob(null);
                  }, 2500);
                }
              }, 2000);
            }, 1800);
          }
        }
      } catch (err) {
        appendLog(`WARN: Worker loop network issue: ${err}`);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isRunning, activePrintingJob, simulateFailure, apiKey]);

  const copyPythonCode = () => {
    const code = `# Run this on the shop's Windows PC:
pip install requests toml pydantic pypdf pywin32
python main.py --config config.toml`;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900">Windows Print Agent Live Monitor</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              Win32 Daemon
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time outbound HTTPS worker communicating between cloud queue and physical shop printers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
              isRunning ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Pause Agent Worker</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Agent Worker</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Terminal Console Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-950 rounded-3xl p-5 shadow-xl border border-slate-800 font-mono text-xs">
            {/* Terminal Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-slate-400">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="text-slate-300 font-semibold text-[11px] ml-2">QuickPrint-Agent.exe [WIN11-STATION]</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{isRunning ? 'POLLING ACTIVE' : 'PAUSED'}</span>
              </div>
            </div>

            {/* Terminal Output */}
            <div
              ref={logContainerRef}
              className="h-80 overflow-y-auto space-y-1.5 text-slate-300 pr-2 scrollbar-thin scrollbar-thumb-slate-800"
            >
              {logs.map((line, i) => (
                <div
                  key={i}
                  className={`leading-relaxed text-[11px] ${
                    line.includes('CLAIMED')
                      ? 'text-cyan-400 font-bold'
                      : line.includes('COMPLETED')
                      ? 'text-emerald-400 font-bold'
                      : line.includes('ERROR')
                      ? 'text-rose-400 font-bold'
                      : line.includes('SPOOLER')
                      ? 'text-indigo-300'
                      : 'text-slate-400'
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Failure Injector */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${simulateFailure ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">Hardware Failure Injector (Operator Recovery Test)</span>
                <span className="text-[11px] text-slate-500">
                  Injects simulated paper jam / spooler error to test safe operator recovery.
                </span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>
        </div>

        {/* Printer Hardware Visualizer Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
              <span>Hardware Print Station</span>
              <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                Online
              </span>
            </h3>

            {/* Animated Printer Graphic */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200 text-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center mx-auto mb-3 border border-slate-200 text-slate-800">
                <PrinterIcon className={`w-8 h-8 ${activePrintingJob ? 'text-blue-600 animate-bounce' : 'text-slate-600'}`} />
              </div>

              <span className="text-xs font-bold text-slate-900 block">
                {activePrintingJob ? activePrintingJob.printerName : 'HP LaserJet Pro M404dn'}
              </span>

              <span className="text-[11px] text-slate-500 block mt-0.5">
                {activePrintingJob ? activePrintingJob.step : 'Idle • Spooler queue clean'}
              </span>

              {/* Progress bar */}
              {activePrintingJob && (
                <div className="mt-4">
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${activePrintingJob.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-blue-600 block mt-1">
                    Job {activePrintingJob.publicId} ({activePrintingJob.progress}%)
                  </span>
                </div>
              )}
            </div>

            {/* Shop Hardware Specs */}
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Machine Hostname:</span>
                <span className="font-mono font-bold text-slate-800">SHOP-PC-WIN11</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Print Queue Protocol:</span>
                <span className="font-semibold text-slate-800">Win32 Spooler / DEVMODE</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Temporary Spool Path:</span>
                <span className="font-mono text-slate-700">C:\QuickPrint\TempSpool</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Security Token:</span>
                <span className="font-mono text-emerald-600 font-bold">HMAC Revocable Token</span>
              </div>
            </div>
          </div>

          {/* Real Windows Deployment Instructions */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-blue-600" />
              <span>Deploy to Real Windows PC</span>
            </h4>
            <p className="text-xs text-slate-500">
              The full standalone Python agent is located in the <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">print-agent/</code> folder.
            </p>

            <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] relative">
              <pre className="overflow-x-auto">
{`cd print-agent
pip install -r requirements.txt
python main.py`}
              </pre>
              <button
                type="button"
                onClick={copyPythonCode}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Copy Windows commands"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
