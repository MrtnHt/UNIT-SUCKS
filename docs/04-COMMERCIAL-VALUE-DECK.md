# Module 4 — Commercial Value Deck

**For the owner of UNIT Breda / Tekno sucks.**
The sequencer is not a toy on the website. It is three retail machines in one:
a **customer acquisition channel** (shared loops), a **cross-sell engine**
(taste → vinyl matching), and an **in-store dwell-time installation** (tablet).

> Every number below is a *model with stated assumptions*, not a measurement.
> The whole point of Modules 2–3 is that after 90 days you replace these
> assumptions with your own data. Baseline figures marked ⚙ need your real
> numbers before presenting externally.

---

## 4.1 The three value loops

```
ONLINE          loop export (Module 3) → shared file/link carries shop URL
                → new visitor plays → e-mail captured → pre-order list
                = CAC ↓  (owned audience instead of paid ads)

CROSS-SELL      knob positions (Module 2) → matched vinyl panel next to the
                sequencer, online AND on the store tablet
                = AOV ↑  (right record in front of the right hands)

IN-STORE        tablet + headphones station: "program your loop, the shop
                shows you the bin to dig in"
                = dwell time ↑ → basket probability ↑ → repeat visits
```

## 4.2 CAC — customer acquisition cost

**Mechanism.** Every exported loop is a self-replicating flyer: the filename
(`unit-loop-195bpm-hardcore-vinyl.mp3`) and the share page carry the shop. Each
confirmed newsletter subscriber is a reusable contact; paid social is rented
reach, this is owned.

| Assumption | Value | Basis |
|---|---|---|
| Paid CAC benchmark, niche e-com ⚙ | €8–15 / customer | typical NL social ads range — replace with your ad history |
| Sequencer sessions / month (yr-1 avg) | 1,500 | modest: local scene + 2 label releases |
| Export rate (sessions → e-mail) | 8% | gated download, Module 3 funnel |
| Double opt-in completion | 60% | ESP norm for double opt-in |
| **New subscribers / month** | **≈ 72** | 1,500 × 8% × 60% |
| Subscriber → first purchase (12 mo) | 15% | pre-order list, high intent |
| Marginal cost / subscriber | ≈ €0.35 | hosting + ESP ÷ volume |
| **Effective CAC via sequencer** | **≈ €2.30 / customer** | €0.35 ÷ 15% |

**Claim for the deck: the tool acquires customers at roughly one-quarter of
paid-ads cost, and the asset (the list) compounds instead of expiring.**

## 4.3 AOV — average order value

**Mechanism.** The Module 2 taste panel is a digital version of the owner's best
skill — "you like this? then listen to *this*" — running 24/7. Online it sits
next to the sequencer; in-store the tablet names the physical bin.

| Assumption | Value | Basis |
|---|---|---|
| Current AOV ⚙ | €22 (1.5 records) | fill in from POS/Woo |
| Shop sessions touching the sequencer | 25% | homepage placement |
| Attach rate of matched suggestion | 6% of those sessions | conservative for on-profile suggestions |
| Avg attached item | €13.50 (label 12") | Tekno sucks pricing |
| **Blended AOV uplift** | **+€0.85–1.10 / order (≈ +4–5%)** | 25% × 6% × €13.50 across orders |

Second-order effect: the taste log tells the label **what to press**. If 60% of
winter sessions profile `hardcore-vinyl`, the next Tekno sucks pressing decision
is data-backed — that's margin protection on the most capital-intensive thing
the business does (vinyl runs are prepaid).

## 4.4 Dwell time — the in-store installation

**Mechanism.** A tablet + wired headphones + "MAAK JE EIGEN BANGER" sign near
the tekno bins. Retail research consistently ties dwell time to conversion;
for a record store the link is direct — digging time *is* the purchase funnel.

| Assumption | Value | Basis |
|---|---|---|
| Hardware (tablet, mount, headphones) | €350 one-off | consumer Android + kiosk app |
| Avg session at the station | 4–6 min | comparable interactive retail installs |
| Sessions / open day | 8–12 | weekend-weighted |
| Extra dwell / day | ≈ 45–70 min aggregate | sessions × duration |
| Kiosk exports (e-mail capture in-store) | 2–3 / day | same Module 3 gate on the tablet |
| **Payback** | **< 2 months** | vs €2.30 CAC equivalent of ~60 subscribers |

Plus the unquantifiable one that matters in Breda: **nobody else has this.** The
station is a reason to visit, a story for local press, and a live demo of the
label's identity.

## 4.5 Cost side (full year)

| Item | Annual |
|---|---|
| Static hosting + serverless functions | €0–60 |
| ESP (Brevo, growing list) | €0–300 |
| Domain / misc | €30 |
| Tablet install | €350 one-off |
| **Total year-1 cash cost** | **< €750** |

Break-even: ≈ 55 attributable record sales at €13.50 avg — under 5/month.

## 4.6 Twelve-month commercial integration roadmap

**Q1 — WIRE IT (months 1–3)**
- Ship Module 1 (audio bus + clap pedal) and Module 3 (export gate). The list starts growing from day one.
- Instrument everything: sessions, exports, opt-ins, taste profiles.
- KPI gate to proceed: ≥ 500 sessions/mo and ≥ 5% export rate.

**Q2 — SELL WITH IT (months 4–6)**
- Ship Module 2: Woo tagging + taste panel online.
- In-store tablet installation live.
- First segmented pre-order mail (match release profile → subscriber tags).
- KPI gate: attach rate ≥ 3%, subscriber → sale conversions observed.

**Q3 — GROW WITH IT (months 7–9)**
- Shareable loop pages (`/loop/:id` with player + matched records) — the loop
  becomes the landing page, CAC engine at full power.
- Local press push: "record store in Breda built its own acid machine."
- Monthly "loop battle": best exported loop wins store credit; entries = subscribers.

**Q4 — PRESS WITH IT (months 10–12)**
- Use 9 months of taste-log data to program the next Tekno sucks pressing.
- Evaluate: white-label the sequencer for 2–3 befriended stores/labels
  (each install feeds a shared-nothing copy of the stack; potential
  €50–100/mo service line).
- Year-1 review against the ⚙ baselines; reset the model with real numbers.

## 4.7 The dashboard the owner actually looks at

Five numbers, monthly, one page:

1. Sequencer sessions (web + kiosk)
2. E-mail opt-ins (and cumulative list size)
3. Taste-profile distribution (which bins are in demand)
4. Attributed revenue (taste-panel clicks → orders, ESP campaign → orders)
5. Effective CAC and AOV delta vs the ⚙ baselines

If numbers 2 and 4 climb for two consecutive quarters, the machines work.
If not, the model above says exactly which assumption broke.
