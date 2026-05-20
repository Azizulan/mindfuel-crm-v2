import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons/UploadIcon';

// PapaParse and XLSX are loaded from CDN, declare their types here for TypeScript
declare const Papa: any;
declare const XLSX: any;

interface FileUploadProps {
  onDataLoaded: (data: any[]) => void;
  isLoading: boolean;
  error: string | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, isLoading, error }) => {
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      parseFile(file);
    }
  }, []);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const parseFile = (file: File) => {
    setFileName(file.name);
    
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          onDataLoaded(results.data);
        },
        error: (err: any) => {
          console.error('PapaParse error:', err);
        }
      });
    } else if (file.name.endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          onDataLoaded(json);
        } catch (err) {
          console.error('XLSX parsing error:', err);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md border border-slate-200 text-center">
      <h2 className="text-2xl font-semibold mb-2 text-slate-700">Upload Customer Data</h2>
      <p className="text-slate-500 mb-6">Drag and drop or select a CSV or Excel file to get started.</p>
      
      <div 
        onDrop={handleDrop} 
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-slate-300 rounded-lg p-10 cursor-pointer hover:border-blue-500 hover:bg-slate-50 transition-colors"
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          onChange={handleFileChange}
        />
        <label htmlFor="file-upload" className="flex flex-col items-center space-y-4 cursor-pointer">
          <UploadIcon />
          {isLoading ? (
            <p className="text-slate-600">Processing file...</p>
          ) : fileName ? (
             <p className="text-slate-600 font-medium">{fileName}</p>
          ) : (
            <p className="text-slate-600">
              <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
            </p>
          )}
          <p className="text-xs text-slate-400">CSV or Excel (.xlsx) files only. Please include headers.</p>
        </label>
      </div>
      
      {error && <p className="mt-4 text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
      
      <div className="mt-8 text-left text-sm text-slate-500 bg-slate-100 p-4 rounded-md">
        <h4 className="font-semibold text-slate-600 mb-2">File Columns:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li><code className="bg-slate-200 px-1 rounded">name</code></li>
          <li><code className="bg-slate-200 px-1 rounded">purchase date</code> (e.g., "2023-10-27")</li>
          <li><code className="bg-slate-200 px-1 rounded">phone</code> or <code className="bg-slate-200 px-1 rounded">email</code> (as unique identifier)</li>
          <li><code className="bg-slate-200 px-1 rounded">address</code></li>
          <li><code className="bg-slate-200 px-1 rounded">product</code></li>
          <li><code className="bg-slate-200 px-1 rounded">product price</code></li>
        </ul>
      </div>
    </div>
  );
};

export default FileUpload;