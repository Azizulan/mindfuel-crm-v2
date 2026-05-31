import React, { useState } from 'react';
import { buildCallScript, ScriptInput } from '../lib/callScript';

const ACCENT: Record<string, { bar: string; chip: string; head: string }> = {
    red:     { bar: 'border-red-300',     chip: 'bg-red-100 text-red-700',         head: 'text-red-700' },
    amber:   { bar: 'border-amber-300',   chip: 'bg-amber-100 text-amber-800',     head: 'text-amber-700' },
    emerald: { bar: 'border-emerald-300', chip: 'bg-emerald-100 text-emerald-700', head: 'text-emerald-700' },
    blue:    { bar: 'border-blue-300',    chip: 'bg-blue-100 text-blue-700',       head: 'text-blue-700' },
    teal:    { bar: 'border-teal-300',    chip: 'bg-teal-100 text-teal-700',       head: 'text-teal-700' },
    sky:     { bar: 'border-sky-300',     chip: 'bg-sky-100 text-sky-700',         head: 'text-sky-700' },
    violet:  { bar: 'border-violet-300',  chip: 'bg-violet-100 text-violet-700',   head: 'text-violet-700' },
    gray:    { bar: 'border-gray-300',    chip: 'bg-gray-100 text-gray-600',       head: 'text-gray-700' },
};

const CallScriptPanel: React.FC<{ input: ScriptInput; agentName: string }> = ({ input, agentName }) => {
    const script = buildCallScript(input, agentName);
    const accent = ACCENT[script.accent] || ACCENT.gray;
    const [copied, setCopied] = useState<number | null>(null);
    const [showObjections, setShowObjections] = useState(false);

    const copy = (text: string, idx: number) => {
        navigator.clipboard?.writeText(text).then(() => {
            setCopied(idx);
            setTimeout(() => setCopied(null), 1500);
        }).catch(() => {});
    };

    return (
        <div className={`rounded-xl border-l-4 ${accent.bar} glass-surface p-4 mb-3`}>
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-base">🗣️</span>
                    <span className={`text-sm font-bold ${accent.head}`}>{script.scenario}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${accent.chip}`}>স্ক্রিপ্ট</span>
            </div>

            {/* Tone */}
            <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">🎯 {script.tone}</p>

            {/* Script lines */}
            <div className="space-y-2">
                {script.lines.map((line, idx) => (
                    <div key={idx} className="group flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pt-1 w-16 flex-shrink-0">{line.label}</span>
                        <p className="flex-1 text-sm text-gray-800 leading-relaxed" style={{ fontFamily: "'Noto Sans Bengali', system-ui, sans-serif" }}>{line.text}</p>
                        <button
                            type="button"
                            onClick={() => copy(line.text, idx)}
                            className="flex-shrink-0 text-[10px] font-semibold text-gray-400 hover:text-blue-600 transition-colors pt-1"
                            title="কপি করুন"
                        >
                            {copied === idx ? '✓' : 'কপি'}
                        </button>
                    </div>
                ))}
            </div>

            {/* Objections */}
            <button
                type="button"
                onClick={() => setShowObjections(s => !s)}
                className="mt-3 text-[11px] font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            >
                {showObjections ? '▾' : '▸'} আপত্তি সামলানোর উত্তর ({script.objections.length})
            </button>
            {showObjections && (
                <div className="mt-2 space-y-1.5">
                    {script.objections.map((o, i) => (
                        <div key={i} className="text-xs px-3 py-2 rounded-lg bg-gray-50 border border-gray-100" style={{ fontFamily: "'Noto Sans Bengali', system-ui, sans-serif" }}>
                            <span className="font-bold text-gray-700">"{o.q}"</span>
                            <span className="text-gray-400"> → </span>
                            <span className="text-gray-600">{o.a}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CallScriptPanel;
