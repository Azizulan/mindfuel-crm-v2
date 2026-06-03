# Phase 1 — CRM Intelligence Build

This batch transformed the CRM from a passive logger into a system that decides
the work. The features compound: each one feeds the next, all driven from data
the team was already collecting.

## What shipped

### Customer intelligence (per-customer prediction)

| Tier | Feature | What it answers |
|---|---|---|
| 1.1 | Reorder cycle prediction | When is this customer due to reorder? |
| 1.2 | Conversion-probability scoring / EV | What's this call worth in expected revenue? |
| 1.3 | Best-next-product recommendation | What should the agent pitch? |
| 1.4 | Optimal call-time prediction | Will they actually pick up if I call now? |
| 1.5 | Win-back queue + Save Squad | Which customers are slipping that I can still save? |
| 1.6 | RFM segmentation (9 segments) | What kind of customer is this — upsell / save / nurture? |
| 3.12 | Phone normalisation + indexed lookups | Are these dupe records the same person? |

### Operations + dashboards

| Tier | Feature |
|---|---|
| 2.7 | Sentiment-triggered automation (auto-schedules next outreach for Happy / Positive / Neutral calls) |
| 2.8 | Agent coaching signals (per-agent quality metrics + coaching flags) |
| 2.9 | Revenue-at-risk dashboard cards (recoverable / Can't Lose / already lost) |
| 2.11 | Daily founder digest email (cron at 07:00 Asia/Dhaka) |
| — | Settings: RFM segment campaign filter + one-click recompute |

### Closing playbook embedded in the product

| Feature | Where |
|---|---|
| In-call **Bengali script panel** — per-customer, picks the right script from segment + sentiment + reorder status, auto-fills name + last product + recommendation, with collapsible objection-handling block | Call Queue + Win-Back expanded forms |

### Security + UX polish

| Tier | Feature |
|---|---|
| 7.28 | Steadfast API keys moved server-side, encrypted (AES-256-GCM) — browser never holds the secret |
| — | New shadcn-style glassmorphism auth screen (single-screen form, autofill-compatible, frosted-glass card) |

## The compound loop

The agent's queue card now answers — automatically, from data:

- **Who to call** → score + EV + segment urgency
- **When to call** → personal best-pickup-time window
- **Why now** → personal reorder-cycle timing
- **What to pitch** → market-basket recommendation
- **What to say** → ready Bengali script for the right scenario

## Files of note (new)

```
lib/utils.ts                                                shadcn cn() helper
app/lib/crypto.ts                                           AES-256-GCM
app/lib/steadfast.ts                                        server-side credential store
app/api/admin/agent-coaching/route.ts                       quality metrics
app/api/admin/recompute-reorder/route.ts                    train cycle + RFM + call-time + product associations + conversion model
app/api/courier/{track,orders,create-order}/route.ts        Packzy proxies (keys server-side)
app/api/cron/daily-digest/route.ts                          founder digest
app/api/queue/today/route.ts                                full scoring (incl. EV boost)
app/api/queue/winback/route.ts                              save squad
app/api/settings/queue-focus-segments/route.ts              campaign filter
app/api/settings/steadfast-credentials/route.ts             encrypted credential settings
app/api/stats/segment-distribution/route.ts                 segment population counts
src/components/AgentCoachingPage.tsx                        quality dashboard
src/components/CallScriptPanel.tsx                          Bengali script panel
src/components/WinBackPage.tsx                              save squad UI
src/components/ui/sign-up.tsx                               new auth screen
src/lib/callScript.ts                                       Bengali script generator
vercel.json                                                 daily cron schedule
```

## Required env vars (set in Vercel)

```
CREDENTIALS_SECRET     # encrypts Steadfast keys at rest
CRM_TIMEZONE           # default Asia/Dhaka (used by call-time prediction)
RESEND_API_KEY         # for the daily digest email
DIGEST_EMAIL_TO        # founder@yourdomain
DIGEST_EMAIL_FROM      # digest@verified-domain
CRON_SECRET            # locks the daily-digest endpoint
```

## Post-deploy actions

1. Re-enter Steadfast keys in **Settings → Courier Integration** so they're stored encrypted server-side.
2. Click **Settings → Data Maintenance → Recompute Now** to backfill reorder cycles, RFM segments, call-time predictions, product associations, and the conversion model for every existing customer.
3. Click **Normalise Now** to backfill the indexed phone field and review the duplicate-customer list dumped to the browser console.

## Note on workflow

This batch landed directly on `main` as features were validated. Future work
should use feature branches → PR → review → merge so the per-feature diff is
reviewable in isolation.
