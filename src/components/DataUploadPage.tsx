
import React, { useState, useCallback, useEffect } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import * as api from '../services/apiService';
import { getCredentialStatus } from '../services/packzyApiService';
import { processAndAnalyzeData } from '../utils/dataProcessor';
import { motion, AnimatePresence } from 'motion/react';
import { XMarkIcon } from './icons/XMarkIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { RefreshCw, Calendar, AlertCircle, Database } from 'lucide-react';

declare const Papa: any;
declare const XLSX: any;

interface DataUploadPageProps {
  onUploadSuccess: () => void;
}

// ─── Date range presets ───────────────────────────────────────────────────────

type Preset = 'today' | 'yesterday' | '7days' | 'thisMonth' | 'custom';

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today',     label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7days',     label: 'Last 7 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'custom',    label: 'Custom Range' },
];

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function getRangeDates(preset: Preset, customStart: string, customEnd: string): { start: string; end: string } {
  const now = new Date();
  if (preset === 'today') return { start: isoDate(now), end: isoDate(now) };
  if (preset === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { start: isoDate(y), end: isoDate(y) };
  }
  if (preset === '7days') {
    const s = new Date(now); s.setDate(s.getDate() - 6);
    return { start: isoDate(s), end: isoDate(now) };
  }
  if (preset === 'thisMonth') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: isoDate(s), end: isoDate(now) };
  }
  return { start: customStart, end: customEnd };
}

// ─── Steadfast Sync tab ───────────────────────────────────────────────────────

const SteadfastSyncTab: React.FC = () => {
  const [preset, setPreset]           = useState<Preset>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [result, setResult]           = useState<{
    message: string; synced: number; newCustomers: number;
    alreadySynced: number; paymentsProcessed: number; errors: string[];
  } | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);

  useEffect(() => {
    getCredentialStatus()
      .then(s => setHasCredentials(s.configured))
      .catch(() => setHasCredentials(false));
  }, []);

  const handleSync = async () => {
    if (!hasCredentials) return;
    const { start, end } = getRangeDates(preset, customStart, customEnd);
    if (preset === 'custom' && (!start || !end)) {
      setError('Please select both a start and end date.'); return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.syncSteadfast(start, end);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Sync failed. Check your API credentials in Settings.');
    } finally {
      setIsLoading(false);
    }
  };

  if (hasCredentials === false) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-3">
        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
          <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-sm font-bold text-amber-800">API Credentials Required</h3>
        <p className="text-xs text-amber-600 leading-relaxed max-w-xs mx-auto">
          Go to <strong>Settings → Courier Integration</strong> and enter your Steadfast API Key and Secret Key to enable delivery sync.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Date range picker */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
          <Calendar className="w-3.5 h-3.5" />
          Select Delivery Date Range
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                preset === p.id
                  ? 'glass-chip-selected text-foreground'
                  : 'text-foreground/55 hover:text-foreground/85 hover:bg-foreground/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
            />
          </div>
        )}
      </div>

      {/* Sync button */}
      <button
        onClick={handleSync}
        disabled={isLoading || (preset === 'custom' && (!customStart || !customEnd))}
        className="w-full py-3.5 glass-cta-primary text-sm font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
      >
        {isLoading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Syncing deliveries from Steadfast…
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            Sync Delivered Orders
          </>
        )}
      </button>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium leading-relaxed flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-200">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-800">Sync Complete</p>
                  <p className="text-xs text-emerald-600 mt-0.5 leading-relaxed">{result.message}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Payments Fetched',  value: result.paymentsProcessed, color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-100' },
                  { label: 'Customers Updated', value: result.synced,            color: 'text-emerald-700', bg: 'bg-white border-emerald-200' },
                  { label: 'New Customers',     value: result.newCustomers,      color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-100' },
                  { label: 'Already Synced',    value: result.alreadySynced,     color: 'text-gray-600',    bg: 'bg-gray-50 border-gray-200' },
                ].map(s => (
                  <div key={s.label} className={`border rounded-xl p-3 ${s.bg}`}>
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {result.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="text-amber-700 font-semibold cursor-pointer">
                    {result.errors.length} warning{result.errors.length !== 1 ? 's' : ''} during sync
                  </summary>
                  <ul className="mt-2 space-y-1 text-amber-600">
                    {result.errors.map((e, i) => <li key={i} className="pl-3 border-l-2 border-amber-200">{e}</li>)}
                  </ul>
                </details>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How it works */}
      {!result && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-500">
          {[
            { icon: '📦', title: 'Reads Payment Batches', desc: 'Fetches all Steadfast payment records within your selected date range.' },
            { icon: '🔍', title: 'Matches by Phone', desc: 'Each delivered consignment is matched to a customer in your CRM by phone number.' },
            { icon: '🔄', title: 'Dedup Protected', desc: 'Each consignment ID is only applied once — syncing the same range twice is safe.' },
          ].map(item => (
            <div key={item.title} className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-1">
              <p className="text-base">{item.icon}</p>
              <p className="font-bold text-gray-700">{item.title}</p>
              <p className="leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── CSV Upload tab ───────────────────────────────────────────────────────────

const CsvUploadTab: React.FC<{ onUploadSuccess: () => void }> = ({ onUploadSuccess }) => {
  const [fileName, setFileName]       = useState<string | null>(null);
  const [parsedRows, setParsedRows]   = useState<any[] | null>(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [progress, setProgress]       = useState<{current: number, total: number} | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);

  const handleDataParsed = (data: any[]) => {
    const processed = processAndAnalyzeData(data);
    if (processed.length === 0) {
      setError("Warning: 0 valid records found. Please check your file headers. Required columns (or similar): 'Name', 'Phone', 'Date', 'Price'.");
      setParsedRows(null);
    } else {
      setParsedRows(processed);
      setError(null);
    }
  };

  const handleFinalUpload = async () => {
    if (!parsedRows) return;
    setIsLoading(true); setError(null); setSuccess(null);
    try {
      const response = await api.uploadCustomers(parsedRows, (current, total) => setProgress({ current, total }));
      setSuccess(response.message);
      setParsedRows(null); setFileName(null);
      onUploadSuccess();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false); setProgress(null);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }, []);

  const parseFile = (file: File) => {
    setFileName(file.name); setError(null); setSuccess(null); setParsedRows(null);
    const reader = new FileReader();
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (res: any) => handleDataParsed(res.data),
        error: (err: any) => setError(`CSV Error: ${err.message}`)
      });
    } else if (file.name.endsWith('.xlsx')) {
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          handleDataParsed(XLSX.utils.sheet_to_json(worksheet));
        } catch (err: any) { setError(`Excel Error: ${err.message}`); }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
        {!parsedRows ? (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="group border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input type="file" id="file-upload" className="hidden" accept=".csv, .xlsx" onChange={handleFileChange} />
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto border border-gray-200 group-hover:border-blue-200 group-hover:bg-blue-50 transition-all mb-4">
              <UploadIcon className="w-7 h-7 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Drop your file here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Supports CSV, Excel (.xlsx)</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-xl border border-blue-100">
                  <CheckCircleIcon className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm font-semibold text-gray-800">Ready to Import</span>
              </div>
              <button onClick={() => { setParsedRows(null); setFileName(null); }} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Source File</p>
                <p className="text-sm font-medium text-gray-800 truncate">{fileName}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Detected Records</p>
                <p className="text-sm font-bold text-blue-600">{parsedRows.length} customers</p>
              </div>
            </div>
            {isLoading && progress && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-gray-500">
                  <span>Processing…</span>
                  <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(progress.current / progress.total) * 100}%` }} className="h-full bg-blue-600 rounded-full" />
                </div>
              </div>
            )}
            <button onClick={handleFinalUpload} disabled={isLoading} className="w-full glass-cta-primary font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 text-sm">
              {isLoading ? `Syncing ${progress?.current || 0}/${progress?.total || '...'}` : 'Confirm & Sync to Database'}
            </button>
          </motion.div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium leading-relaxed">
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-medium flex items-start gap-2">
              <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">ID Detection</p>
          <p className="text-xs text-gray-500 leading-relaxed">Phone, Mobile, Email, or ID columns are used as unique keys for profile identification.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Smart Merge</p>
          <p className="text-xs text-gray-500 leading-relaxed">New purchases are appended to history; names and addresses are intelligently updated.</p>
        </div>
      </div>
    </div>
  );
};

// ─── Page shell with tabs ─────────────────────────────────────────────────────

type Tab = 'csv' | 'steadfast';

const DataUploadPage: React.FC<DataUploadPageProps> = ({ onUploadSuccess }) => {
  const [tab, setTab] = useState<Tab>('csv');

  return (
    <div className="space-y-5 pb-12">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Tab switcher */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-1.5 flex gap-1">
          {([
            { id: 'csv' as Tab,       icon: <UploadIcon className="w-3.5 h-3.5" />, label: 'CSV / Excel Upload',  sub: 'Manual batch import' },
            { id: 'steadfast' as Tab, icon: <Database className="w-3.5 h-3.5" />,  label: 'Steadfast Sync',      sub: 'Auto-import deliveries' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all ${tab === t.id ? 'glass-chip-selected' : 'hover:bg-foreground/5'}`}
            >
              <span className={tab === t.id ? 'text-foreground' : 'text-foreground/40'}>{t.icon}</span>
              <div className="text-left">
                <p className={`text-xs font-bold leading-tight ${tab === t.id ? 'text-foreground' : 'text-foreground/70'}`}>{t.label}</p>
                <p className={`text-[10px] hidden sm:block ${tab === t.id ? 'text-foreground/55' : 'text-foreground/40'}`}>{t.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {tab === 'csv'       && <CsvUploadTab onUploadSuccess={onUploadSuccess} />}
        {tab === 'steadfast' && <SteadfastSyncTab />}
      </div>
    </div>
  );
};

export default DataUploadPage;
