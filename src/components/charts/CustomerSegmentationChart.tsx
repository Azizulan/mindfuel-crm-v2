
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
    const rawData = trend ? trend[view] : [];
    const data = rawData.slice(-10);

    const maxVal = data.length > 0 ? Math.max(...data.map(d => (Number(d.Repeat) || 0) + (Number(d.Single) || 0)), 10) : 10;
    const colors = { Repeat: '#3b82f6', Single: '#bfdbfe' };

    return (
        <div className="h-[320px] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] text-foreground/45 font-semibold uppercase tracking-widest">Last {data.length} periods</p>
                <div className="flex bg-foreground/[0.08] p-1 rounded-lg">
                    <button
                        onClick={() => setView('monthly')}
                        className={`px-3 py-1 text-[10px] font-semibold uppercase rounded-md transition-all ${view === 'monthly' ? 'bg-card text-foreground/85 shadow-sm' : 'text-foreground/45 hover:text-foreground/70'}`}
                    >Monthly</button>
                    <button
                        onClick={() => setView('yearly')}
                        className={`px-3 py-1 text-[10px] font-semibold uppercase rounded-md transition-all ${view === 'yearly' ? 'bg-card text-foreground/85 shadow-sm' : 'text-foreground/45 hover:text-foreground/70'}`}
                    >Yearly</button>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-end min-h-0">
                {data.length > 0 ? (
                    <>
                        <div className="flex-1 flex items-end gap-2 border-b border-foreground/[0.12] pb-2 min-h-0">
                            {data.map((d, i) => {
                                const repeatHeight = ((Number(d.Repeat) || 0) / maxVal) * 100;
                                const singleHeight = ((Number(d.Single) || 0) / maxVal) * 100;
                                const showLabel = data.length < 6 || i % 2 === 0 || i === data.length - 1;

                                return (
                                    <div key={i} className="flex-1 group relative flex flex-col justify-end items-center h-full max-w-[40px]">
                                        <div className="w-full flex flex-col rounded-t-sm overflow-hidden">
                                            <div style={{ height: `${singleHeight}%`, backgroundColor: colors.Single }} className="w-full hover:opacity-80 transition-opacity"></div>
                                            <div style={{ height: `${repeatHeight}%`, backgroundColor: colors.Repeat }} className="w-full hover:opacity-80 transition-opacity"></div>
                                        </div>
                                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] p-2 rounded shadow-xl z-10 whitespace-nowrap">
                                            <p className="font-bold border-b border-gray-700 mb-1">{d.period}</p>
                                            <p>Repeat: {d.Repeat}</p>
                                            <p>One-Time: {d.Single}</p>
                                        </div>
                                        <div className="h-6 flex items-start justify-center overflow-visible">
                                             {showLabel && (
                                                 <span className="text-[8px] font-bold text-foreground/45 rotate-45 mt-1 whitespace-nowrap">
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
                                <span className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest">Repeat Buyers</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.Single }}></span>
                                <span className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest">One-Time</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center flex-1 text-foreground/45 italic text-sm">No segmentation data synced.</div>
                )}
            </div>
        </div>
    );
};

export default CustomerSegmentationChart;
