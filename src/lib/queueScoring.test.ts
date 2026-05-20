
import { describe, it, expect } from 'vitest';
import { scoreCustomer, ScoringCustomer } from './queueScoring';

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

// ─── Suppression ───────────────────────────────────────────────────────────

describe('suppression: Angry', () => {
    it('suppresses when latest note is Angry', () => {
        const c = base({ followUpNotes: [{ date: days(1), feedback: 'Angry', agent: 'Rohan' }] });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(true);
        expect(r.suppressionReason).toBe('Angry');
    });

    it('does NOT suppress if Angry is not the latest note', () => {
        const c = base({
            totalSpending: 2000,
            purchaseCount: 2,
            followUpNotes: [
                { date: days(10), feedback: 'Angry', agent: 'Rohan' },
                { date: days(2), feedback: 'Neutral', agent: 'Rohan' },
            ],
        });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(false);
    });
});

describe('suppression: Not Interested ×2 in 60 days', () => {
    it('suppresses with 2 Not Interested notes within 60 days', () => {
        const c = base({
            followUpNotes: [
                { date: days(5), feedback: 'Not Interested', agent: 'Rohan' },
                { date: days(20), feedback: 'Not Interested', agent: 'Rohan' },
            ],
        });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(true);
        expect(r.suppressionReason).toContain('Not Interested');
    });

    it('does NOT suppress with 1 Not Interested', () => {
        const c = base({
            totalSpending: 1000,
            purchaseCount: 1,
            followUpNotes: [{ date: days(5), feedback: 'Not Interested', agent: 'Rohan' }],
        });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(false);
    });

    it('does NOT suppress if second Not Interested is older than 60 days', () => {
        const c = base({
            totalSpending: 1000,
            purchaseCount: 1,
            followUpNotes: [
                { date: days(5), feedback: 'Not Interested', agent: 'Rohan' },
                { date: days(65), feedback: 'Not Interested', agent: 'Rohan' },
            ],
        });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(false);
    });
});

describe('suppression: Call Not Received ×3 in 14 days', () => {
    it('suppresses with 3 CNR notes within 14 days', () => {
        const c = base({
            followUpNotes: [
                { date: days(1), feedback: 'Call Not Received', agent: 'Rohan' },
                { date: days(3), feedback: 'Call Not Received', agent: 'Rohan' },
                { date: days(5), feedback: 'Call Not Received', agent: 'Rohan' },
            ],
        });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(true);
        expect(r.suppressionReason).toContain('Unreachable');
    });

    it('does NOT suppress with only 2 CNR notes', () => {
        const c = base({
            totalSpending: 1000,
            purchaseCount: 1,
            followUpNotes: [
                { date: days(1), feedback: 'Call Not Received', agent: 'Rohan' },
                { date: days(3), feedback: 'Call Not Received', agent: 'Rohan' },
            ],
        });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(false);
    });
});

describe('suppression: future Call Back Later', () => {
    it('suppresses when Call Back Later reminder is in the future', () => {
        const c = base({
            followUpNotes: [{
                date: days(2),
                feedback: 'Call Back Later',
                agent: 'Rohan',
                reminderDate: future(3),
            }],
        });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(true);
        expect(r.suppressionReason).toContain('Callback scheduled');
    });

    it('does NOT suppress when Call Back Later reminder is today or past', () => {
        const c = base({
            totalSpending: 2000,
            purchaseCount: 2,
            followUpNotes: [{
                date: days(3),
                feedback: 'Call Back Later',
                agent: 'Rohan',
                reminderDate: days(0),
            }],
        });
        const r = scoreCustomer(c, 'Rohan', NOW);
        expect(r.suppressed).toBe(false);
    });
});

// ─── Scoring: VIP priority ──────────────────────────────────────────────────

describe('scoring: VIP outranks dormant low-value customer', () => {
    it('VIP with 55-day dormancy scores higher than one-time buyer at same dormancy', () => {
        const vip = base({
            totalSpending: 12000,
            purchaseCount: 6,
            lastPurchaseDate: days(55),
        });
        const oneTime = base({
            id: '01700000002',
            totalSpending: 500,
            purchaseCount: 1,
            lastPurchaseDate: days(55),
        });
        const vipScore = scoreCustomer(vip, 'Rohan', NOW).score;
        const oneTimeScore = scoreCustomer(oneTime, 'Rohan', NOW).score;
        expect(vipScore).toBeGreaterThan(oneTimeScore);
    });

    it('never-called VIP scores higher than recently-called medium customer', () => {
        const vip = base({
            totalSpending: 8000,
            purchaseCount: 5,
            lastPurchaseDate: days(45),
            followUpNotes: [],
        });
        const medium = base({
            id: '01700000003',
            totalSpending: 2000,
            purchaseCount: 2,
            lastPurchaseDate: days(40),
            followUpNotes: [{ date: days(1), feedback: 'Neutral', agent: 'Rohan' }],
        });
        expect(scoreCustomer(vip, 'Rohan', NOW).score).toBeGreaterThan(
            scoreCustomer(medium, 'Rohan', NOW).score
        );
    });
});

// ─── Scoring: sentiment modifier ───────────────────────────────────────────

describe('scoring: sentiment modifier', () => {
    const withSentiment = (feedback: string) => base({
        totalSpending: 2000,
        purchaseCount: 2,
        lastPurchaseDate: days(40),
        followUpNotes: [{ date: days(5), feedback, agent: 'Rohan' }],
    });

    it('Happy scores higher than Neutral', () => {
        expect(scoreCustomer(withSentiment('Happy'), 'Rohan', NOW).score)
            .toBeGreaterThan(scoreCustomer(withSentiment('Neutral'), 'Rohan', NOW).score);
    });

    it('Neutral scores higher than Not Interested', () => {
        expect(scoreCustomer(withSentiment('Neutral'), 'Rohan', NOW).score)
            .toBeGreaterThan(scoreCustomer(withSentiment('Not Interested'), 'Rohan', NOW).score);
    });

    it('overdue Call Back Later gets highest sentiment boost', () => {
        const overdueCallback = base({
            totalSpending: 2000,
            purchaseCount: 2,
            lastPurchaseDate: days(40),
            followUpNotes: [{
                date: days(3),
                feedback: 'Call Back Later',
                agent: 'Rohan',
                reminderDate: days(1),
            }],
        });
        const happy = withSentiment('Happy');
        expect(scoreCustomer(overdueCallback, 'Rohan', NOW).score)
            .toBeGreaterThan(scoreCustomer(happy, 'Rohan', NOW).score);
    });
});

// ─── Scoring: call recency penalty ─────────────────────────────────────────

describe('scoring: call recency penalty', () => {
    const withLastCall = (daysAgo: number) => base({
        totalSpending: 2000,
        purchaseCount: 2,
        lastPurchaseDate: days(45),
        followUpNotes: [{ date: days(daysAgo), feedback: 'Neutral', agent: 'Rohan' }],
    });

    it('called today scores much lower than called 15 days ago', () => {
        expect(scoreCustomer(withLastCall(0), 'Rohan', NOW).score)
            .toBeLessThan(scoreCustomer(withLastCall(15), 'Rohan', NOW).score);
    });

    it('called 2 days ago scores lower than called 8 days ago', () => {
        expect(scoreCustomer(withLastCall(2), 'Rohan', NOW).score)
            .toBeLessThan(scoreCustomer(withLastCall(8), 'Rohan', NOW).score);
    });
});

// ─── Scoring: recency urgency ───────────────────────────────────────────────

describe('scoring: recency urgency (prime reorder window 31–60 days)', () => {
    const withOrderAge = (daysAgo: number) => base({
        totalSpending: 3000,
        purchaseCount: 3,
        lastPurchaseDate: days(daysAgo),
    });

    it('45-day order scores higher than 10-day order (prime window vs too-soon)', () => {
        expect(scoreCustomer(withOrderAge(45), 'Rohan', NOW).score)
            .toBeGreaterThan(scoreCustomer(withOrderAge(10), 'Rohan', NOW).score);
    });

    it('45-day order scores higher than 200-day dormant', () => {
        expect(scoreCustomer(withOrderAge(45), 'Rohan', NOW).score)
            .toBeGreaterThan(scoreCustomer(withOrderAge(200), 'Rohan', NOW).score);
    });
});

// ─── Scoring: agent exclusivity penalty ────────────────────────────────────

describe('scoring: agent exclusivity', () => {
    it('customer called today by OTHER agent gets 60pt penalty', () => {
        const calledByOther = base({
            totalSpending: 3000,
            purchaseCount: 3,
            lastPurchaseDate: days(45),
            followUpNotes: [{ date: new Date(NOW), feedback: 'Neutral', agent: 'Wasi' }],
        });
        const notCalled = base({
            id: '01700000002',
            totalSpending: 3000,
            purchaseCount: 3,
            lastPurchaseDate: days(45),
            followUpNotes: [],
        });
        const diff = scoreCustomer(notCalled, 'Rohan', NOW).score -
                     scoreCustomer(calledByOther, 'Rohan', NOW).score;
        // call penalty (today = 80) + exclusivity (60) vs just exclusivity
        // The not-called has no call penalty, the calledByOther has both 80 (recency) + 60 (exclusivity)
        expect(diff).toBeGreaterThanOrEqual(60);
    });

    it('customer called today by SAME agent does not get exclusivity penalty', () => {
        const calledBySelf = base({
            totalSpending: 3000,
            purchaseCount: 3,
            lastPurchaseDate: days(45),
            followUpNotes: [{ date: new Date(NOW), feedback: 'Neutral', agent: 'Rohan' }],
        });
        const calledByOther = base({
            id: '01700000002',
            totalSpending: 3000,
            purchaseCount: 3,
            lastPurchaseDate: days(45),
            followUpNotes: [{ date: new Date(NOW), feedback: 'Neutral', agent: 'Wasi' }],
        });
        expect(scoreCustomer(calledBySelf, 'Rohan', NOW).score)
            .toBeGreaterThan(scoreCustomer(calledByOther, 'Rohan', NOW).score);
    });
});

// ─── Reason strings ─────────────────────────────────────────────────────────

describe('reason strings', () => {
    it('VIP in prime reorder window gets correct reason', () => {
        const c = base({ totalSpending: 12000, purchaseCount: 6, lastPurchaseDate: days(45) });
        const { reason } = scoreCustomer(c, 'Rohan', NOW);
        expect(reason).toContain('VIP');
        expect(reason).toContain('prime reorder window');
    });

    it('overdue callback gets correct reason', () => {
        const c = base({
            totalSpending: 2000,
            purchaseCount: 2,
            lastPurchaseDate: days(40),
            followUpNotes: [{
                date: days(3),
                feedback: 'Call Back Later',
                agent: 'Rohan',
                reminderDate: days(1),
            }],
        });
        expect(scoreCustomer(c, 'Rohan', NOW).reason).toContain('callback');
    });

    it('Happy lead includes sentiment in reason', () => {
        const c = base({
            totalSpending: 2000,
            purchaseCount: 2,
            lastPurchaseDate: days(40),
            followUpNotes: [{ date: days(8), feedback: 'Happy', agent: 'Rohan' }],
        });
        expect(scoreCustomer(c, 'Rohan', NOW).reason).toContain('Happy');
    });
});
