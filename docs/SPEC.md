# Blyss Creative Hub — Specification

> Merged from two versions Eric sent on 2026-10-25. Version 2 is the base; anything only in
> version 1 is folded in and marked _(v1)_. Version 2 arrived cut off in section 14
> (Top UGC Creators → Filters). **Sections after that are still to come.**

## 1. Project overview

A private web app that is the central management platform for Blyss's creative marketing department. It gives the owner visibility into:

- What every creative strategist is working on and accomplishes every day.
- How many creative assets are being produced.
- Which ads, strategists, and UGC creators perform best.
- How much each strategist spends on UGC creators.
- Upcoming creative projects, promotions, and deadlines.
- Creative ideas proposed by the team.

It combines an employee management dashboard, creative performance analytics, a UGC creator database, and a marketing calendar.

**ClickUp manages creative production. Do not rebuild it** — integrate it so we can monitor production progress.

Design: clean, modern, premium, intuitive.

## 2. User accounts and permissions

Every employee has their own login. Three roles; the owner can customize permissions per employee.

**Owner / Super Admin** — full access: every employee's dashboard; all check-ins; everyone's performance reports; all production activity; every strategist's UGC budget and the ability to modify it; add/remove employees; assign roles and permissions; manage all creators; company-wide ad performance; manage the creative calendar; notifications for missing check-ins, overdue work, upcoming deadlines; manage leaderboard settings and performance calculations; create announcements and company-wide tasks _(v1)_; historical data _(v1)_. Has a special admin dashboard (section 3).

**Creative Strategist** — personal dashboard; morning and evening check-ins; assigned ClickUp tasks; own performance and weekly/monthly reports; assigned UGC creators; own monthly UGC budget; submit and vote on ideas; leaderboard; winning ads library; creative calendar. Can only modify their own information unless granted more.

**UGC Manager** — assigned creators; creator profiles and contact info; rates and negotiations; deliverables; creator performance; UGC spending records; relevant ClickUp tasks; creative calendar; daily check-ins if the admin requires them. Cannot modify strategist budgets by default.

## 3. Owner dashboard (owner's homepage)

**Stat cards** (update automatically): active strategists; active UGC managers; creatives completed today / this week / this month; creatives in progress; new ads launched this week; winning ads this month; UGC spend this month; remaining UGC budget. ClickUp production stats too (e.g. this week: 65 assigned, 42 completed, 18 in progress, 5 overdue) _(v1)_.

**Employee activity table:** Employee | Morning Check-In | Evening Check-In | Weekly Creatives | Monthly Creatives | Current Tasks. Green = completed, yellow = pending, red = missing/overdue. Clicking a name opens that person's dashboard.

**Live activity feed** — real-time, no page refresh. Built only from actual recorded events, never guessed. Sources: actions in the website, ClickUp updates, ad performance integrations, UGC creator/budget updates, calendar changes. Each event: employee, action, timestamp, related task/creator/ad, link to the page. Examples: check-in submitted, brief completed, creator added, idea submitted, winning ad identified, creator video delivered, ClickUp task became overdue.

## 4. Employee personal dashboard

**Overview:** welcome + name, today's date, morning/evening check-in status, tasks due today, overdue tasks, creatives completed this week and month, UGC budget remaining, current leaderboard position, upcoming deadlines _(v1)_.

**Weekly creative performance** (prominent): creatives completed this week vs last week; weekly production target and % achieved; ads launched; winning ads; attributed ad spend; avg CPA and ROAS where available. Graph of weekly performance over time. Range switcher: this week, last week, this month, last month, custom. Updates automatically.

Also from v1: concepts submitted/approved, attributed revenue; **UGC budget bar** (budget / spent / remaining, horizontal progress bar); **assigned ClickUp tasks** (name, due date, priority, status, link that opens in ClickUp).

## 5. Morning check-in

Required each working day, on a dedicated page with a Submit button.

1. What are your main priorities today?
2. What specific tasks or creative projects will you complete today?
3. How many creatives or briefs do you plan to complete today?
4. Are there any blockers preventing you from completing your work?
5. Do you need anything from management or another team member?

**Rules:** one morning check-in per person per day; answers editable but edits are recorded; save timestamp; show on time vs late; history visible to the employee. Admin-configurable deadline, default **9:30 AM in the employee's own timezone**.

**Missing:** after the deadline, mark missing, notify admin, show on missing list, optionally remind the employee. Never mark missing on approved days off or non-working days.

## 6. Evening (end-of-day) check-in

1. What did you accomplish today?
2. Which tasks or creative projects did you complete?
3. How many creatives or briefs did you complete?
4. Did you complete everything you planned during your morning check-in?
5. If not, what prevented you from completing your planned work?
6. Are there any issues or blockers management should know about?

The form shows the employee's morning commitments. The system compares planned vs actual (e.g. "2 of 3 planned briefs completed — 67%"). This is **self-reported** and must be shown as distinct from verified ClickUp completion data. Encourage links to completed work _(v1)_. Don't auto-penalize; allow explanations _(v1)_. All check-ins stored permanently.

## 7. Team Check-Ins (admin page)

**Top:** employees expected, morning completed, morning missing, evening completed, evening missing.

**Table** of employees; clicking a row expands their answers. Filters: employee, date, department, morning/evening, completed, missing, late. Daily, weekly, monthly views.

## 8. Production Overview (ClickUp)

**Stats:** active tasks; completed today / this week / this month; in progress; overdue; awaiting approval.

**Task table:** Task | Assigned Employee | Status | Due Date | ClickUp Link (opens the original task). Strategists see their own tasks; owner sees all.

**Integration:** ClickUp is the source of truth. Sync statuses, assignees, due dates, completion dates. Webhooks for live updates plus periodic sync as backup. Match ClickUp users to website accounts. No duplicate task records. Admin chooses which spaces, folders, and lists are included.

**Much production goes through UGC creators and UGC managers, not video editors.** Track both UGC and other creative work based on the actual ClickUp structure. Don't assume every task is a video edit.

## 9. Creative Leaderboard

Visible to every logged-in employee; never public on the internet without a separate admin-controlled publishing option.

**Table:** Rank | Strategist | Creatives Produced | Winning Ads | Win Rate | Ad Spend | ROAS.

**Filters:** today, this week, this month, last month, last 90 days, all time, custom _(v1)_.

**Metrics:** creatives produced, creatives launched, winning ads, win rate, attributed spend, ROAS, CPA, % of production target achieved. Also concepts submitted/approved and attributed revenue _(v1)_.

**Ranking:** default prioritizes winning performance, not volume. Admin can switch: most winning ads, highest win rate, most spend generated, highest production volume, best overall score. Overall score uses **configurable weights**, not hardcoded. Compare only clearly defined metrics over comparable periods.

## 10. Winning Ads

Visual gallery of the best ads, as cards: thumbnail/static, ad name, strategist, UGC creator, launch date, spend, revenue, ROAS, CPA, current status. Also product/scent, angle, hook, format, CTR, conversions _(v1)_. Clicking opens a detail page with full performance history.

**Date filters:** today, yesterday, last 7 days, last 30 days, this month, last month, custom.
**Other filters:** strategist, UGC creator, product, scent, format, ad platform, angle, hook type.
**Sections** _(v1)_: Top Ads Today / This Week / This Month / All Time.

**Winner identification:** automatic, using admin-configurable thresholds. Never ROAS alone.

> **Current definition (Eric, 2026-10-25):** an ad is a winner in Northbeam when **all** are true:
> spend **over $10,000**, CAC **below $70**, new visitor % **above 50%**.

**Analysis notes** on each winner: why it worked, hook used, angle used, audience/desire targeted, what to improve, variations to test next.

## 11. Creative Performance (analytics)

Separate from the leaderboard; about strategy, not people.

**Metrics:** creatives launched, winning creatives, win rate, total spend, avg CPA, avg ROAS, attributed revenue, new concepts tested.

**Periods:** daily, weekly, monthly, quarterly, custom.

**Breakdowns:** strategist, angle, hook type, product, scent, UGC creator, format.

- Angles _(v1)_: luxury home fragrance, social proof, viral product hype, scent experience, cleaning demonstrations, customer testimonials, limited-time offers, before-and-after cleaning, emotional storytelling, FOMO.
- Formats: UGC testimonial, UGC demonstration, storytelling, voiceover / AI voiceover, static image, product demonstration / montage, offer-focused, founder-style _(v1)_.
- Scents _(v1)_: Brazilian Waves, Heartbreaker, Royalty, Sunwashed Linen, Imported Mahogany.

**Charts:** winning ads over time, creative output over time, CPA trend, ROAS trend, testing volume, performance by strategist; comparisons across angles, formats, scents _(v1)_.

## 12. Weekly and monthly employee reports

**Weekly:** creatives completed, launched, winning ads, win rate, attributed spend, avg CPA, avg ROAS, ClickUp tasks completed and overdue, morning and evening check-in completion rate, UGC spending.

**Monthly:** same, aggregated, plus comparison to previous month, production target achieved, best and worst creative, most successful angle, UGC budget used and remaining.

**Team Reports (admin):** every employee's reports on one page, side-by-side comparison table, click through to detail. Export to CSV and PDF. Generated automatically from real data.

## 13. UGC Management

Central database of every creator Blyss has worked with or is working with. Searchable list.

**Profile fields:** full name, photo, email, Instagram, TikTok, other socials, country/location, standard rate, negotiated rate, package rate, assigned strategist, assigned UGC manager, videos ordered, videos delivered, total spent, status, internal notes. Also usage rights and whitelisting rates _(v1)_.

**Statuses:** Prospect, Contacted, Negotiating, Active, Awaiting Content, Completed, Previously Worked With, Do Not Work With.

**Creator profile page:** contact info, socials, rate history, previous collaborations, videos delivered, performance of ads using their content, lifetime spend, internal rating, team notes.

**Rating:** authorized employees give 1–5 stars on video quality, on-camera delivery, reliability, communication, pricing, creative performance.

Favorites so employees can save preferred creators _(v1)_.

## 14. Top UGC Creators

A curated library of the best creators, separate from the full database.

**Cards:** photo, name, socials, average video rate, total collaborations, winning ads, attributed ad spend, internal rating.

**Ranking** _(v1)_: winning ads, win %, ad spend, revenue, CPA, ROAS, by time period.

**Filters:** _[text cut off here — remaining v2 sections pending]_

---

## Sections from v1 not yet covered by v2

These may reappear in the rest of v2; until then, v1 is the spec.

### UGC budget tracker _(v1)_

Inside UGC Management. Each strategist has a monthly UGC budget set by the owner.

- Per strategist: budget, paid, committed, available; large progress bar split into available / committed / paid.
- Booking a creator records the agreed cost as **committed**; paying moves it to **paid**. Never double-count.
- Expense record: creator, strategist, UGC manager, project, number of videos, agreed price, payment status, date, notes.
- Admin budget page: Strategist | Monthly Budget | Paid | Committed | Available, plus department total.
- Owner notified at 80% and 100% of budget, on any attempt to exceed it, and when an expense needs approval. Owner can approve extra spending.
- Budgets reset monthly; history stays.

### Creative ideas bank _(v1)_

- Idea fields: title, description, angle, product/scent, suggested hook, reference links, example videos/images, submitter, date.
- 👍/👎 voting, one changeable vote per employee per idea; show totals.
- Collections: UGC Concepts, Viral Hooks, Luxury Scent Marketing, Competitor Inspirations, Product Demonstrations, Static Ad Ideas, Sales and Promotions, AI Voiceover Concepts, Experimental Concepts. New collections with permission.
- Statuses: New, Under Review, Approved, Rejected, In Testing, Winner, Loser. Owner approves/rejects; approved ideas can link to ClickUp tasks.
- Comments, search, filtering, sort by most upvoted / newest, favorites, attachments.

### Creative calendar _(v1)_

- Month, week, day, and list views; visible to everyone.
- Company events (meetings, creative reviews, strategy meetings, deadlines); marketing events (product and scent launches, promos, sales, ad deadlines); US shopping holidays (Valentine's, Mother's Day, Father's Day, Labor Day, Halloween, Thanksgiving, Black Friday, Cyber Monday, Christmas, New Year's, and others), with dates computed correctly each year.
- Event fields: name, date/time, description, assigned employees, category, priority, related tasks, links.
- Dashboard shows upcoming dates as a countdown (e.g. "Black Friday — 33 days").

---

## Ad naming convention (from the Blyss Creative Log sheet, "NEW NAMING" tab)

Ads are attributed to strategists, creators, angles, etc. by reading the ad name (`src/lib/ad-naming.ts`):

`CXXXX-Y _ V# _ Concept Name _ Product _ Type _ Format _ Angle _ Scent _ Creator _ CS _ Editor _ Agency _ Destination _ Offer`

- `CXXXX` = concept number (net new); `-Y` = iteration (e.g. C5436-1). `V1/V2/V3` = variation.
- Empty slots (no creator / no agency) stay empty between separators.
- Old convention (no strategist field): `Blyss_Product_Offer_Type_Format_Angle_USP_Scent_Agency_Destination`. Old ads can't be credited to a strategist from the name alone.
- Separator assumed to be `_` — **to confirm with a real ad name.**
- Sheet also tracks Winner / Loser / Testing per Creative ID (META ADS tab, ~3,900 rows) — candidate for a one-time import.
