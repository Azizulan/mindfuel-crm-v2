
import React, { useState } from 'react';
import { getTrackingStatus } from '../services/packzyApiService';
import { TrackingStatusResponse } from '../types';

type IdType = 'consignment_id' | 'invoice' | 'tracking_code';

const TrackOrderPage: React.FC = () => {
    const [idType, setIdType] = useState<IdType>('tracking_code');
    const [idValue, setIdValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<TrackingStatusResponse | null>(null);

    const handleTrack = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!idValue) {
            setError('Please enter a value to track.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await getTrackingStatus(idType, idValue);
            setResult(response);
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 max-w-2xl">
                <p className="text-sm text-slate-600 mb-4">Enter the ID provided by the courier service to see the current status of your delivery.</p>
                <form onSubmit={handleTrack} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <select
                        value={idType}
                        onChange={(e) => setIdType(e.target.value as IdType)}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                        <option value="tracking_code">Tracking Code</option>
                        <option value="invoice">Invoice ID</option>
                        <option value="consignment_id">Consignment ID</option>
                    </select>
                    <input
                        type="text"
                        value={idValue}
                        onChange={(e) => setIdValue(e.target.value)}
                        className="flex-grow px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder={`Enter ${idType.replace('_', ' ')}`}
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400"
                    >
                        {isLoading ? 'Tracking...' : 'Track'}
                    </button>
                </form>

                {error && <div className="mt-6 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}

                <div className="mt-6 p-6 bg-slate-50 rounded-lg text-center text-slate-500 min-h-[100px] flex items-center justify-center">
                    {result ? (
                         <div>
                            <p className="text-sm text-slate-600">Delivery Status for ID <span className="font-bold">{idValue}</span>:</p>
                            <p className="text-2xl font-bold text-blue-600 capitalize mt-1">{result.delivery_status.replace(/_/g, ' ')}</p>
                        </div>
                    ) : (
                         <p>Tracking information will be displayed here.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrackOrderPage;
