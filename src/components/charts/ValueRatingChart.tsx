
import React, { useState } from 'react';
import { TrendData } from '../../types';

interface ChartProps {
    trend?: {
        monthly: TrendData[];
        yearly: TrendData[];
    };
}

const ValueRatingChart: React.FC<ChartProps> = ({ trend }) => {
    const [view, setView] = useState<'monthly' | 'yearly'>('monthly');
    const rawData = trend ? trend[view] : [];
    const data = rawData.slice(-10);

    const maxVal = data.length > 0 ? Math.max(...data.map(d => Math.max(Number(d.High) || 0, Number(d.Medium) || 0, Number(d.Low) || 0)), 5) : 5;
    const colors = { High: '#10b981', Medium: '#f59e0b', Low: '#ef4444' };

    return (
        <div className="h-[320px] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">Last {data.length} periods</p>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setView('monthly')}
                        className={`px-3 py-1 text-[10px] font-semibold uppercase rounded-md transition-all ${view === 'monthly' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >Monthly</button>
                    <button
                        onClick={() => setView('yearly')}
                        className={`px-3 py-1 text-[10px] font-semibold uppercase rounded-md transition-all ${view === 'yearly' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >Yearly</button>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-end min-h-0">
                {data.length > 0 ? (
                    <>
                        <div className="flex-1 flex items-end gap-4 border-b border-gray-200 pb-2 min-h-0">
                            {data.map((d, i) => {
                                const showLabel = data.length < 6 || i % 2 === 0 || i === data.length - 1;
                                return (
                                    <div key={i} className="flex-1 group relative flex flex-col justify-end items-center h-full max-w-[40px]">
                                        <div className="flex items-end gap-0.5 w-full h-full pb-1">
                                            <div style={{ height: `${(Number(d.High) / maxVal) * 100}%`, backgroundColor: colors.High }} className="flex-1 rounded-t-xs hover:opacity-80 transition-all"></div>
                                            <div style={{ height: `${(Number(d.Medium) / maxVal) * 100}%`, backgroundColor: colors.Medium }} className="flex-1 rounded-t-xs hover:opacity-80 transition-all"></div>
                                            <div style={{ height: `${(Number(d.Low) / maxVal) * 100}%`, backgroundColor: colors.Low }} className="flex-1 rounded-t-xs hover:opacity-80 transition-all"></div>
                                        </div>
                                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] p-2 rounded shadow-xl z-10 whitespace-nowrap">
                                            <p className="font-bold border-b border-gray-700 mb-1">{d.period}</p>
                                            <p className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> High: {d.High}</p>
                                            <p className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> Medium: {d.Medium}</p>
                                            <p className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Low: {d.Low}</p>
                                        </div>
                                        <div className="h-6 flex items-start justify-center overflow-visible">
                                            {showLabel && (
                                                <span className="text-[8px] font-bold text-gray-400 rotate-45 mt-1 whitespace-nowrap">
                                                    {d.period.includes('-') ? d.period.split('-')[1] + '/' + d.period.split('-')[0].slice(-2) : d.period}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-8 flex justify-center gap-4 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-green-500"></span>
                                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-tighter">High (3k+)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500"></span>
                                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-tighter">Med (1k-3k)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-red-500"></span>
                                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-tighter">Low (&lt;1k)</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center flex-1 text-gray-400 italic text-sm">No value rating data available.</div>
                )}
            </div>
        </div>
    );
};

export default ValueRatingChart;
