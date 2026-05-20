
import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import * as api from '../services/apiService';
import { processAndAnalyzeData } from '../utils/dataProcessor';

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
          setError(err.message || "An unexpected error occurred during upload.");
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
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                // Fixed: Removed the redundant nested sheet_to_json call
                const json = XLSX.utils.sheet_to_json(worksheet);
                handleDataParsed(json);
            } catch (err: any) { 
                setError(`Excel Error: ${err.message}`); 
            }
        };
        reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Customer Batch Upload</h3>
        <p className="text-slate-500 mb-6 text-sm">System will auto-match headers and merge with existing database.</p>
        
        {!parsedRows ? (
            <div 
            onDrop={handleDrop} 
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-12 transition-colors cursor-pointer hover:border-blue-500 hover:bg-slate-50"
            onClick={() => document.getElementById('file-upload')?.click()}
            >
            <input type="file" id="file-upload" className="hidden" accept=".csv, .xlsx" onChange={handleFileChange} />
            <UploadIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-bold">Drop your file here or click to browse</p>
            <p className="text-xs text-slate-400 mt-2">Supports CSV, Excel (.xlsx)</p>
            </div>
        ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-left">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-black text-blue-800 uppercase text-xs tracking-widest">Ready to Import</h4>
                    <button onClick={() => {setParsedRows(null); setFileName(null);}} className="text-blue-600 text-[10px] font-black uppercase hover:underline">Clear</button>
                </div>
                <div className="space-y-2 mb-6">
                    <p className="text-sm font-bold text-blue-900">File: <span className="font-normal">{fileName}</span></p>
                    <p className="text-sm font-bold text-blue-900">Detected Records: <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs ml-1">{parsedRows.length} customers</span></p>
                </div>
                <button 
                    onClick={handleFinalUpload}
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white font-black uppercase tracking-widest py-3 rounded-lg hover:bg-blue-700 transition-shadow shadow-lg disabled:opacity-50"
                >
                    {isLoading ? `Syncing ${progress?.current || 0}/${progress?.total || '...'} batches` : 'Confirm & Sync to Database'}
                </button>
            </div>
        )}
        
        {error && <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-xs font-bold leading-relaxed">{error}</div>}
        {success && <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700 text-xs font-bold">{success}</div>}
        
        <div className="mt-8 grid grid-cols-2 gap-4 text-left">
            <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">ID Detection</p>
                <p className="text-xs text-slate-600 leading-tight">Phone, Mobile, Email, or ID columns are used as unique keys.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Smart Merge</p>
                <p className="text-xs text-slate-600 leading-tight">New purchases are added to history; names/addresses are updated.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DataUploadPage;
