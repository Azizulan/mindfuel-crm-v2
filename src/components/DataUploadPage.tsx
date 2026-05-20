
import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import * as api from '../services/apiService';
import { processAndAnalyzeData } from '../utils/dataProcessor';
import { motion, AnimatePresence } from 'motion/react';
import { XMarkIcon } from './icons/XMarkIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

declare const Papa: any;
declare const XLSX: any;

interface DataUploadPageProps {
  onUploadSuccess: () => void;
}

const DataUploadPage: React.FC<DataUploadPageProps> = ({ onUploadSuccess }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      try {
          const response = await api.uploadCustomers(parsedRows, (current, total) => {
              setProgress({ current, total });
          });
          setSuccess(response.message);
          setParsedRows(null);
          setFileName(null);
          onUploadSuccess();
      } catch (err: any) {
          setError(err.message || "An unexpected error occurred.");
      } finally {
          setIsLoading(false);
          setProgress(null);
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
    setFileName(file.name);
    setError(null);
    setSuccess(null);
    setParsedRows(null);
    const reader = new FileReader();
    if (file.name.endsWith('.csv')) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
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
    <div className="space-y-6 pb-12">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Upload card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-gray-900">Customer Batch Upload</h3>
            <p className="text-xs text-gray-400 mt-1">System will auto-match headers and merge with existing database using unique identifiers.</p>
          </div>

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
              <button onClick={handleFinalUpload} disabled={isLoading} className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 text-sm">
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

        {/* Info cards */}
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
    </div>
  );
};

export default DataUploadPage;
