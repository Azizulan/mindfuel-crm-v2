import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../services/apiService';
import type { CoverageDay, ReconcileDay, ReconcileResponse } from '../services/apiService';

// ─── Courier sync coverage calendar ──────────────────────────────────────────
//
// Two layers on one grid:
//
//   density      — deliveries per day from our own data. Instant, but a day
//                  with zero deliveries is ambiguous: never synced, or just a
//                  quiet day? Our data cannot tell the difference.
//   reconcile    — the authoritative diff against Steadfast. Marks each date
//                  complete / partial / never-synced. Costs a courier API
//                  sweep, so it runs on demand for a bounded range.

const MS_DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** YYYY-MM-DD for a Date, using its local calendar fields (no UTC shift). */
const iso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseIso = (s: string): Date => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

interface Cell {
    key: string;
    date: Date;
    deliveries: number;
    duplicates: number;
    recon: ReconcileDay | null;
}

const SyncCoverageCalendar: React.FC = () => {
    const [days, setDays] = useState<CoverageDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [recon, setRecon] = useState<ReconcileResponse | null>(null);
    const [reconciling, setReconciling] = useState(false);
    const [reconError, setReconError] = useState<string | null>(null);

    const [hovered, setHovered] = useState<Cell | null>(null);
    const [monthsBack, setMonthsBack] = useState(6);

    const rangeEnd = useMemo(() => new Date(), []);
    const rangeStart = useMemo(() => {
        const d = new Date(rangeEnd);
        d.setMonth(d.getMonth() - monthsBack);
        d.setDate(1);
        return d;
    }, [rangeEnd, monthsBack]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.getSyncCoverage(iso(rangeStart), iso(rangeEnd));
            setDays(res.days ?? []);
        } catch (e: any) {
            setError(e.message || 'Could not load coverage');
        } finally {
            setLoading(false);
        }
    }, [rangeStart, rangeEnd]);

    useEffect(() => { load(); }, [load]);

    const runReconcile = async () => {
        setReconciling(true);
        setReconError(null);
        try {
            // The endpoint caps a single sweep at 120 days.
            const start = new Date(rangeEnd);
            start.setDate(start.getDate() - 119);
            const res = await api.reconcileSync(iso(start), iso(rangeEnd));
            setRecon(res);
        } catch (e: any) {
            setReconError(e.message || 'Reconcile failed');
        } finally {
            setReconciling(false);
        }
    };

    // ── Build the grid ──
    const { months, maxDeliveries, totals } = useMemo(() => {
        const byDate = new Map(days.map(d => [d.date, d]));
        const reconByDate = new Map((recon?.days ?? []).map(d => [d.date, d]));

        const cells: Cell[] = [];
        const cur = new Date(rangeStart);
        while (cur <= rangeEnd) {
            const key = iso(cur);
            const row = byDate.get(key);
            cells.push({
                key,
                date: new Date(cur),
                deliveries: row?.deliveries ?? 0,
                duplicates: row ? row.deliveries - row.distinct : 0,
                recon: reconByDate.get(key) ?? null,
            });
            cur.setTime(cur.getTime() + MS_DAY);
        }

        const grouped: { label: string; weeks: (Cell | null)[][] }[] = [];
        for (const cell of cells) {
            const label = `${MONTHS[cell.date.getMonth()]} ${String(cell.date.getFullYear()).slice(2)}`;
            let month = grouped[grouped.length - 1];
            if (!month || month.label !== label) {
                month = { label, weeks: [[]] };
                grouped.push(month);
                // Pad the first week so weekdays line up.
                for (let i = 0; i < cell.date.getDay(); i++) month.weeks[0].push(null);
            }
            let week = month.weeks[month.weeks.length - 1];
            if (week.length === 7) { week = []; month.weeks.push(week); }
            week.push(cell);
        }

        return {
            months: grouped,
            maxDeliveries: Math.max(1, ...cells.map(c => c.deliveries)),
            totals: {
                deliveries: cells.reduce((s, c) => s + c.deliveries, 0),
                duplicates: cells.reduce((s, c) => s + c.duplicates, 0),
                activeDays: cells.filter(c => c.deliveries > 0).length,
                totalDays: cells.length,
            },
        };
    }, [days, recon, rangeStart, rangeEnd]);

    const cellClass = (c: Cell): string => {
        // Reconciliation, when present, overrides density — it is authoritative.
        if (c.recon?.status === 'never-synced') return 'sc-gap';
        if (c.recon?.status === 'partial') return 'sc-partial';
        if (c.deliveries === 0) return 'sc-zero';
        const r = c.deliveries / maxDeliveries;
        if (r <= 0.25) return 'sc-l1';
        if (r <= 0.5) return 'sc-l2';
        if (r <= 0.75) return 'sc-l3';
        return 'sc-l4';
    };

    const s = recon?.summary;

    return (
        <div className="glass-surface p-5 space-y-4">
            <style>{`
                .sc-cell{width:13px;height:13px;border-radius:2.5px;transition:transform .08s}
                .sc-cell:hover{transform:scale(1.35)}
                .sc-zero{background:rgba(125,125,125,.14);box-shadow:inset 0 0 0 1px rgba(125,125,125,.28)}
                .sc-l1{background:#bfe3c9}.sc-l2{background:#7cc99a}
                .sc-l3{background:#3fa06c}.sc-l4{background:#1e6f45}
                .sc-partial{background:#f0c674;box-shadow:inset 0 0 0 1px #b8860b}
                .sc-gap{background:repeating-linear-gradient(45deg,#e8907d,#e8907d 2px,#f7d9d2 2px,#f7d9d2 4px);box-shadow:inset 0 0 0 1px #c8442e}
                .dark .sc-l1{background:#1f4c33}.dark .sc-l2{background:#2d7a4d}
                .dark .sc-l3{background:#46a86b}.dark .sc-l4{background:#7fd6a0}
                .dark .sc-gap{background:repeating-linear-gradient(45deg,#7d2f24,#7d2f24 2px,#4a1c15 2px,#4a1c15 4px);box-shadow:inset 0 0 0 1px #e8907d}
            `}</style>

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-bold text-foreground">Courier Sync Coverage</h3>
                    <p className="text-xs text-foreground/45 mt-0.5">
                        Deliveries held per day. Run a reconcile to confirm which dates are genuinely missing.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={monthsBack}
                        onChange={e => setMonthsBack(Number(e.target.value))}
                        className="text-xs bg-transparent border border-foreground/15 rounded-lg px-2 py-1.5 text-foreground/70"
                    >
                        <option value={3}>Last 3 months</option>
                        <option value={6}>Last 6 months</option>
                        <option value={12}>Last 12 months</option>
                    </select>
                    <button
                        onClick={runReconcile}
                        disabled={reconciling}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg glass-cta-primary disabled:opacity-50"
                    >
                        {reconciling ? 'Checking Steadfast…' : 'Reconcile last 120 days'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
            )}
            {reconError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{reconError}</div>
            )}

            {/* Summary */}
            <div className="flex flex-wrap gap-6">
                <Stat label="Deliveries" value={totals.deliveries.toLocaleString()} />
                <Stat label="Days with data" value={`${totals.activeDays} / ${totals.totalDays}`} />
                {totals.duplicates > 0 && (
                    <Stat label="Duplicate IDs" value={totals.duplicates.toLocaleString()} tone="bad" />
                )}
                {s && <Stat label="Missing at courier" value={s.totalMissing.toLocaleString()} tone={s.totalMissing ? 'bad' : 'ok'} />}
                {s && <Stat label="Dates never synced" value={String(s.datesNeverSynced)} tone={s.datesNeverSynced ? 'bad' : 'ok'} />}
                {s && <Stat label="Dates partial" value={String(s.datesPartial)} tone={s.datesPartial ? 'warn' : 'ok'} />}
            </div>

            {loading ? (
                <div className="py-10 text-center text-xs text-foreground/40">Loading coverage…</div>
            ) : (
                <div className="overflow-x-auto pb-1">
                    <div className="flex gap-1.5 min-w-max">
                        {months.map(m => (
                            <div key={m.label} className="flex flex-col gap-1">
                                <div className="text-[10px] text-foreground/45 font-semibold h-3">{m.label}</div>
                                <div className="flex gap-[3px]">
                                    {m.weeks.map((w, wi) => (
                                        <div key={wi} className="flex flex-col gap-[3px]">
                                            {w.map((c, ci) =>
                                                c === null
                                                    ? <div key={ci} className="w-[13px] h-[13px]" />
                                                    : (
                                                        <div
                                                            key={c.key}
                                                            className={`sc-cell ${cellClass(c)}`}
                                                            onMouseEnter={() => setHovered(c)}
                                                            onMouseLeave={() => setHovered(null)}
                                                        />
                                                    )
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Legend + hover readout */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-foreground/55">
                <span className="inline-flex items-center gap-1">
                    <i className="sc-cell sc-zero inline-block" />
                    <i className="sc-cell sc-l1 inline-block" />
                    <i className="sc-cell sc-l2 inline-block" />
                    <i className="sc-cell sc-l3 inline-block" />
                    <i className="sc-cell sc-l4 inline-block" />
                    fewer → more
                </span>
                <span className="inline-flex items-center gap-1"><i className="sc-cell sc-partial inline-block" /> partially synced</span>
                <span className="inline-flex items-center gap-1"><i className="sc-cell sc-gap inline-block" /> never synced</span>
            </div>

            <div className="text-xs text-foreground/70 min-h-[18px] tabular-nums">
                {hovered ? (
                    <>
                        <strong>{hovered.date.toDateString()}</strong>
                        {' — '}
                        {hovered.deliveries} deliver{hovered.deliveries === 1 ? 'y' : 'ies'} held
                        {hovered.duplicates > 0 && <span className="text-red-600"> · {hovered.duplicates} duplicate id(s)</span>}
                        {hovered.recon && (
                            <span className={hovered.recon.missing ? 'text-red-600' : 'text-green-700'}>
                                {' · courier has '}{hovered.recon.expected}
                                {hovered.recon.missing > 0 && `, missing ${hovered.recon.missing}`}
                            </span>
                        )}
                    </>
                ) : (
                    <span className="text-foreground/35">Hover a day for detail.</span>
                )}
            </div>

            {!recon && !reconciling && (
                <p className="text-[11px] text-foreground/40 leading-relaxed">
                    Density alone can't prove a date is missing — a day with no deliveries looks the same
                    whether it was never synced or simply had no orders. Reconcile checks Steadfast directly.
                </p>
            )}

            {recon && recon.warnings.length > 0 && (
                <details className="text-[11px] text-amber-700">
                    <summary className="cursor-pointer font-semibold">{recon.warnings.length} warning(s)</summary>
                    <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                        {recon.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                </details>
            )}
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string; tone?: 'ok' | 'bad' | 'warn' }> = ({ label, value, tone }) => (
    <div>
        <div className={`text-lg font-bold tabular-nums ${
            tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600'
            : tone === 'ok' ? 'text-green-600' : 'text-foreground'
        }`}>{value}</div>
        <div className="text-[11px] text-foreground/45 mt-0.5">{label}</div>
    </div>
);

export default SyncCoverageCalendar;
