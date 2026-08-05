import { describe, it, expect } from 'vitest';
import { scoreCustomer, globalRecencyFactor, ScoringCustomer } from './queueScoring';

const NOW = new Date('2026-05-20T10:00:00.000Z');

const days = (n: number): Date => {
    const d = new Date(NOW);
    d.setDate(d.getDate() - n);
    return d;
};

const future = (n: number): Date => {
    const d = new Date(NOW);
    d.setDate(d.getDate() + n);
    return d;
};

const base = (overrides: Partial<ScoringCustomer> = {}): ScoringCustomer => ({
    id: '01700000001',
    name: 'Test Customer',
    phone: '01700000001',
    totalSpending: 0,
    purchaseCount: 0,
    lastPurchaseDate: null,
    followUpNotes: [],
    ...overrides,
});

const score = (c: ScoringCustomer, agent = 'Rohan') => scoreCustomer(c, agent, NOW).score;

// ─── Suppression ───────────────────────────────────────────────────────────

describe('suppression', () => {
    it('suppresses when latest note is Angry', () => {
        const c = base({ followUpNotes: [{ date: days(1), feedback: 'Angry', agent: 'Rohan' }] });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(true);
        expect(r.suppressionReason).toBe('Angry');
    });

    it('suppresses with 2 Not Interested notes within 60 days', () => {
        const c = base({
            followUpNotes: [
                { date: days(35), feedback: 'Not Interested', agent: 'Rohan' },
                { date: days(50), feedback: 'Not Interested', agent: 'Rohan' },
            ],
        });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(true);
        expect(r.suppressionReason).toContain('Not Interested');
    });

    it('does NOT suppress if the second Not Interested is older than 60 days', () => {
        const c = base({
            totalSpending: 1000, purchaseCount: 1, lastPurchaseDate: days(45),
            followUpNotes: [
                { date: days(35), feedback: 'Not Interested', agent: 'Rohan' },
                { date: days(95), feedback: 'Not Interested', agent: 'Rohan' },
            ],
        });
        expect(scoreCustomer(c, 'Rohan', NOW).suppressed).toBe(false);
    });

    it('suppresses when a Call Back Later reminder is still in the future', () => {
        const c = base({
            followUpNotes: [{
                date: days(2), feedback: 'Call Back Later', agent: 'Rohan', reminderDate: future(3),
            }],
        });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(true);
        expect(r.suppressionReason).toContain('Callback scheduled');
    });

    it('a due callback overrides the 30-day called-recently suppression', () => {
        const c = base({
            totalSpending: 2000, purchaseCount: 2, lastPurchaseDate: days(40),
            followUpNotes: [{
                date: days(3), feedback: 'Call Back Later', agent: 'Rohan', reminderDate: days(1),
            }],
        });
        expect(scoreCustomer(c, 'Rohan', NOW).suppressed).toBe(false);
    });

    it('suppresses anyone called within the last 30 days', () => {
        const c = base({
            totalSpending: 2000, purchaseCount: 2, lastPurchaseDate: days(45),
            followUpNotes: [{ date: days(5), feedback: 'Neutral', agent: 'Rohan' }],
        });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(true);
        expect(r.suppressionReason).toContain('Called 5d ago');
    });
});

// ─── The bug this rewrite fixes ─────────────────────────────────────────────

describe('recency decay: dormant customers must not outrank warm ones', () => {
    // The exact complaint: a big spender who last bought ~1.5 years ago was
    // ranking above a modest customer who bought last month.
    const dormantWhale = base({
        id: 'whale', totalSpending: 12000, purchaseCount: 6,
        lastPurchaseDate: days(300), rfmSegment: "Can't Lose",
    });
    const warmMidValue = base({
        id: 'warm', totalSpending: 2500, purchaseCount: 3,
        lastPurchaseDate: days(45), rfmSegment: 'Loyal',
    });

    it('a warm mid-value customer outranks a long-dormant high-value one', () => {
        expect(score(warmMidValue)).toBeGreaterThan(score(dormantWhale));
    });

    it('the same whale outranks the warm customer once they are recent again', () => {
        const activeWhale = base({
            ...dormantWhale, lastPurchaseDate: days(45), rfmSegment: 'Champion',
        });
        expect(score(activeWhale)).toBeGreaterThan(score(warmMidValue));
    });

    it('value decays monotonically as dormancy grows', () => {
        const at = (d: number) => score(base({
            totalSpending: 12000, purchaseCount: 6, lastPurchaseDate: days(d),
        }));
        expect(at(45)).toBeGreaterThan(at(150));
        expect(at(150)).toBeGreaterThan(at(200));
        expect(at(200)).toBeGreaterThan(at(300));
    });

    it('181 days and 900 days no longer score the same (the old flat tail)', () => {
        const at = (d: number) => score(base({
            totalSpending: 12000, purchaseCount: 6, lastPurchaseDate: days(d),
            followUpNotes: [{ date: days(200), feedback: 'Happy', agent: 'Rohan' }],
        }));
        expect(at(181)).toBeGreaterThan(at(900));
    });
});

describe('dormancy cutoff', () => {
    it('drops a customer past the cutoff out of the daily queue', () => {
        const c = base({ totalSpending: 12000, purchaseCount: 6, lastPurchaseDate: days(500) });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(true);
        expect(r.suppressionReason).toContain('Win-Back');
    });

    it('keeps a dormant customer who has a due callback', () => {
        const c = base({
            totalSpending: 12000, purchaseCount: 6, lastPurchaseDate: days(500),
            followUpNotes: [{
                date: days(40), feedback: 'Call Back Later', agent: 'Rohan', reminderDate: days(1),
            }],
        });
        expect(scoreCustomer(c, 'Rohan', NOW).suppressed).toBe(false);
    });

    it('keeps a dormant customer whose last conversation was positive', () => {
        const c = base({
            totalSpending: 12000, purchaseCount: 6, lastPurchaseDate: days(500),
            followUpNotes: [{ date: days(40), feedback: 'Happy', agent: 'Rohan' }],
        });
        expect(scoreCustomer(c, 'Rohan', NOW).suppressed).toBe(false);
    });

    it('respects a custom cutoff', () => {
        const c = base({ totalSpending: 5000, purchaseCount: 3, lastPurchaseDate: days(200) });
        expect(scoreCustomer(c, 'Rohan', NOW, { maxDormancyDays: 180 }).suppressed).toBe(true);
        expect(scoreCustomer(c, 'Rohan', NOW, { maxDormancyDays: 365 }).suppressed).toBe(false);
    });
});

describe('globalRecencyFactor curve', () => {
    it('peaks in the 31-120 day window', () => {
        expect(globalRecencyFactor(60)).toBe(1.0);
        expect(globalRecencyFactor(100)).toBe(1.0);
    });

    it('discounts a customer who just ordered — too soon to re-pitch', () => {
        expect(globalRecencyFactor(5)).toBeLessThan(globalRecencyFactor(60));
    });

    it('decays past the warm window and never rises again', () => {
        const points = [60, 150, 200, 300, 400, 900].map(globalRecencyFactor);
        for (let i = 1; i < points.length; i++) {
            expect(points[i]).toBeLessThanOrEqual(points[i - 1]);
        }
    });
});

// ─── Value ordering still holds at equal recency ────────────────────────────

describe('value ordering at equal recency', () => {
    it('VIP outranks a one-time buyer at the same dormancy', () => {
        const vip = base({ totalSpending: 12000, purchaseCount: 6, lastPurchaseDate: days(55) });
        const oneTime = base({ id: '2', totalSpending: 500, purchaseCount: 1, lastPurchaseDate: days(55) });
        expect(score(vip)).toBeGreaterThan(score(oneTime));
    });

    it('higher spend wins when frequency and recency match', () => {
        const rich = base({ totalSpending: 12000, purchaseCount: 3, lastPurchaseDate: days(60) });
        const poor = base({ id: '2', totalSpending: 800, purchaseCount: 3, lastPurchaseDate: days(60) });
        expect(score(rich)).toBeGreaterThan(score(poor));
    });
});

// ─── Segment boost no longer rewards going quiet ────────────────────────────

describe('segment boost', () => {
    const withSegment = (rfmSegment: any) => base({
        totalSpending: 6000, purchaseCount: 4, lastPurchaseDate: days(60), rfmSegment,
    });

    it("Champion (active) outranks Can't Lose (lapsed) at equal recency", () => {
        expect(score(withSegment('Champion'))).toBeGreaterThan(score(withSegment("Can't Lose")));
    });

    it('Lost is penalised relative to Loyal', () => {
        expect(score(withSegment('Lost'))).toBeLessThan(score(withSegment('Loyal')));
    });
});

// ─── Sentiment ──────────────────────────────────────────────────────────────

describe('sentiment modifier', () => {
    // Note is >30d old so it clears the called-recently suppression.
    const withSentiment = (feedback: string) => base({
        totalSpending: 2000, purchaseCount: 2, lastPurchaseDate: days(40),
        followUpNotes: [{ date: days(35), feedback, agent: 'Rohan' }],
    });

    it('Happy scores higher than Neutral', () => {
        expect(score(withSentiment('Happy'))).toBeGreaterThan(score(withSentiment('Neutral')));
    });

    it('Neutral scores higher than Not Interested', () => {
        expect(score(withSentiment('Neutral'))).toBeGreaterThan(score(withSentiment('Not Interested')));
    });
});

// ─── Agent exclusivity ──────────────────────────────────────────────────────

describe('agent exclusivity', () => {
    it('a customer called today by another agent is deprioritised', () => {
        // A note dated today would normally trip the 30-day suppression, so use
        // a due callback to isolate the exclusivity penalty.
        const mk = (agent: string) => base({
            totalSpending: 3000, purchaseCount: 3, lastPurchaseDate: days(45),
            followUpNotes: [{
                date: new Date(NOW), feedback: 'Call Back Later', agent, reminderDate: days(1),
            }],
        });
        expect(score(mk('Rohan'))).toBeGreaterThan(score(mk('Wasi')));
    });
});

// ─── Reason strings ─────────────────────────────────────────────────────────

describe('reason strings', () => {
    it('flags the prime reorder window', () => {
        const c = base({ totalSpending: 12000, purchaseCount: 6, lastPurchaseDate: days(45) });
        const { reason } = scoreCustomer(c, 'Rohan', NOW);
        expect(reason).toContain('VIP');
        expect(reason).toContain('prime reorder window');
    });

    it('says the value is discounted when dormant', () => {
        const c = base({ totalSpending: 12000, purchaseCount: 6, lastPurchaseDate: days(300) });
        expect(scoreCustomer(c, 'Rohan', NOW).reason).toContain('discounted');
    });

    it('flags an overdue callback', () => {
        const c = base({
            totalSpending: 2000, purchaseCount: 2, lastPurchaseDate: days(40),
            followUpNotes: [{
                date: days(3), feedback: 'Call Back Later', agent: 'Rohan', reminderDate: days(1),
            }],
        });
        expect(scoreCustomer(c, 'Rohan', NOW).reason).toContain('callback');
    });
});
