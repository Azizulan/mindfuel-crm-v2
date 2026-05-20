
import React, { useState } from 'react';

interface OrdersChartProps {
    data: Array<{ date: string, count: number }>;
}

const OrdersChart: React.FC<OrdersChartProps> = ({ data }) => {
    const maxValue = data.length > 0 ? Math.max(...data.map(d => d.count), 10) : 10;
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-700">Orders Over Last 30 Days</h3>
            </div>
            {data.length > 0 ? (
                <div className="h-64 flex flex-col">
                    <div className="flex-grow flex items-end gap-1 border-b border-slate-200">
                         {data.map((dataPoint, index) => (
                             <div key={dataPoint.date} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                                 <div 
                                     className="w-full bg-blue-300 hover:bg-blue-500 rounded-t-sm transition-all duration-300"
                                     style={{ height: `${(dataPoint.count / maxValue) * 100}%` }}
                                 ></div>
                                 <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded-md z-10">
                                     {dataPoint.count} orders on {dataPoint.date}
                                </div>
                             </div>
                         ))}
                    </div>
                    <div className="flex items-end gap-1 mt-1 -mx-1">
                        {data.map((dataPoint, index) => (
                            <div key={dataPoint.date} className="flex-1 text-center text-[8px] text-slate-400 overflow-hidden">
                                {index % 5 === 0 ? dataPoint.date.split('-').slice(1).join('/') : ''}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="h-64 flex items-center justify-center text-slate-500 italic">
                    <p>No data recorded for the last 30 days.</p>
                </div>
            )}
        </div>
    );
};

export default OrdersChart;
