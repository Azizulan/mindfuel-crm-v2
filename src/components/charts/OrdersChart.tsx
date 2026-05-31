
import React, { useState } from 'react';

interface OrdersChartProps {
    data: Array<{ date: string, count: number }>;
}

const OrdersChart: React.FC<OrdersChartProps> = ({ data }) => {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    if (data.length === 0) {
        return (
            <div className="h-56 flex items-center justify-center text-foreground/45 text-sm italic">
                No order data for the last 30 days.
            </div>
        );
    }

    const maxValue = Math.max(...data.map(d => d.count), 1);
    const total = data.reduce((s, d) => s + d.count, 0);
    const avg = total / data.length;

    // Y-axis ticks: 0, max/2, max
    const yTicks = [0, Math.round(maxValue / 2), maxValue];

    return (
        <div className="mt-2">
            {/* Chart area */}
            <div className="flex gap-1 items-end" style={{ height: '180px' }}>
                {/* Y-axis */}
                <div className="flex flex-col justify-between items-end pr-2 flex-shrink-0" style={{ height: '180px' }}>
                    {[...yTicks].reverse().map(t => (
                        <span key={t} className="text-[9px] text-foreground/30 font-mono">{t}</span>
                    ))}
                </div>

                {/* Bars */}
                <div className="flex-1 flex items-end gap-[2px] relative" style={{ height: '180px' }}>
                    {/* Average line */}
                    <div
                        className="absolute left-0 right-0 border-t border-dashed border-amber-300/60 z-10 pointer-events-none"
                        style={{ bottom: `${(avg / maxValue) * 100}%` }}
                    >
                        <span className="absolute right-0 -top-3.5 text-[8px] text-amber-400 font-semibold bg-card px-1">avg {avg.toFixed(1)}</span>
                    </div>

                    {data.map((d, i) => {
                        const heightPct = (d.count / maxValue) * 100;
                        const isHovered = hoveredIdx === i;
                        const isWeekend = new Date(d.date).getDay() === 0 || new Date(d.date).getDay() === 6;
                        return (
                            <div
                                key={d.date}
                                className="flex-1 relative flex flex-col justify-end cursor-pointer group"
                                style={{ height: '180px' }}
                                onMouseEnter={() => setHoveredIdx(i)}
                                onMouseLeave={() => setHoveredIdx(null)}
                            >
                                <div
                                    className={`w-full rounded-t-sm transition-all duration-150 ${isHovered ? 'bg-blue-600' : d.count === 0 ? 'bg-foreground/[0.08]' : isWeekend ? 'bg-blue-300/70' : 'bg-blue-400/70'}`}
                                    style={{ height: `${Math.max(heightPct, d.count > 0 ? 2 : 0)}%` }}
                                />
                                {/* Tooltip */}
                                {isHovered && (
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2.5 py-1.5 rounded-lg z-20 whitespace-nowrap shadow-xl">
                                        <p className="font-bold">{d.count} orders</p>
                                        <p className="text-foreground/45">{d.date}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* X-axis date labels */}
            <div className="flex items-start pl-8 mt-1.5 gap-[2px]">
                {data.map((d, i) => (
                    <div key={d.date} className="flex-1 text-center overflow-visible">
                        {(i === 0 || i % 7 === 0 || i === data.length - 1) ? (
                            <span className="text-[8px] text-foreground/30 font-mono">
                                {d.date.slice(5)}
                            </span>
                        ) : null}
                    </div>
                ))}
            </div>

            {/* Summary row */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-foreground/[0.08]">
                <div className="flex items-center gap-4 text-xs text-foreground/45">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400/70 inline-block" />Daily orders</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 border-t-2 border-dashed border-amber-300 inline-block" />30-day avg</span>
                </div>
                <div className="text-xs text-foreground/45">
                    Peak: <span className="font-semibold text-foreground/70">{maxValue}</span> &nbsp;·&nbsp; Total: <span className="font-semibold text-foreground/70">{total}</span>
                </div>
            </div>
        </div>
    );
};

export default OrdersChart;
