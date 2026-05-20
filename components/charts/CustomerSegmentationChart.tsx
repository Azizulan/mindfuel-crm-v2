
import React, { useState } from 'react';
import { TrendData } from '../../types';

interface ChartProps {
    trend?: {
        monthly: TrendData[];
        yearly: TrendData[];
    };
}

const CustomerSegmentationChart: React.FC<ChartProps> = ({ trend }) => {
    const [view, setView] = useState<'monthly' | 'yearly'>('monthly');
    // Slice to only show last 10 points to avoid clutter and overflow
    const rawData = trend ? trend[view] : [];
    const data = rawData.slice(-10);
    
    const maxVal = data.length > 0 ? Math.max(...data.map(d => (Number(d.Repeat) || 0) + (Number(d.Single) || 0)), 10) : 10;
    const colors = { Repeat: '#3b82f6', Single: '#93c5fd' };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 h-[380px] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-700">Customer Segments</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Last {data.length} periods</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setView('monthly')}
                        className={`px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-md transition-all ${view === 'monthly' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                    >Monthly</button>
                    <button 
                        onClick={() => setView('yearly')}
                        className={`px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-md transition-all ${view === 'yearly' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                    >Yearly</button>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-end min-h-0">
                {data.length > 0 ? (
                    <>
                        <div className="flex-1 flex items-end gap-2 border-b border-slate-100 pb-2 min-h-0">
                            {data.map((d, i) => {
                                const repeatHeight = ((Number(d.Repeat) || 0) / maxVal) * 100;
                                const singleHeight = ((Number(d.Single) || 0) / maxVal) * 100;
                                // Only show label for every other point if there are many, or if it's the first/last
                                const showLabel = data.length < 6 || i % 2 === 0 || i === data.length - 1;

                                return (
                                    <div key={i} className="flex-1 group relative flex flex-col justify-end items-center h-full max-w-[40px]">
                                        <div className="w-full flex flex-col rounded-t-sm overflow-hidden">
                                            <div style={{ height: `${singleHeight}%`, backgroundColor: colors.Single }} className="w-full hover:opacity-80 transition-opacity"></div>
                                            <div style={{ height: `${repeatHeight}%`, backgroundColor: colors.Repeat }} className="w-full hover:opacity-80 transition-opacity"></div>
                                        </div>
                                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl z-10 whitespace-nowrap">
                                            <p className="font-bold border-b border-slate-600 mb-1">{d.period}</p>
                                            <p>Repeat: {d.Repeat}</p>
                                            <p>One-Time: {d.Single}</p>
                                        </div>
                                        <div className="h-6 flex items-start justify-center overflow-visible">
                                             {showLabel && (
                                                 <span className="text-[8px] font-bold text-slate-400 rotate-45 mt-1 whitespace-nowrap">
                                                     {d.period.includes('-') ? d.period.split('-')[1] + '/' + d.period.split('-')[0].slice(-2) : d.period}
                                                 </span>
                                             )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-8 flex justify-center gap-6">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.Repeat }}></span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Repeat Buyers</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.Single }}></span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">One-Time</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center flex-1 text-slate-400 italic text-sm">No segmentation data synced.</div>
                )}
            </div>
        </div>
    );
};

export default CustomerSegmentationChart;
