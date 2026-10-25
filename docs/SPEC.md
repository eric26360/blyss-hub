# Blyss Creative Hub — Specification

> Source: provided by Eric on 2026-10-25. The text arrived cut off partway through
> section 13 (Creative Calendar → Upcoming Events). Sections after that are still to come.

## 1. Project overview

A private web app that is the central management platform for the Blyss creative department. It gives the owner visibility into:

- What every creative strategist is working on, and what each employee accomplishes every day.
- How each strategist is performing; which ads and which UGC creators perform best.
- How much each strategist spends on UGC.
- Creative ideas in development; upcoming deadlines and events.
- Which employees are meeting expectations and which are falling behind.

Combines employee accountability, creative performance analytics, UGC management, budgeting, and creative planning.

**ClickUp is the production pipeline. Do not build a separate one** — integrate ClickUp so employees see their tasks and progress.

## 2. User accounts and permissions

Every employee has their own login. Three roles; the owner can customize permissions per employee.

**Owner / Super Admin** — full access: every employee's dashboard; all morning/evening check-ins; individual and company-wide performance; all UGC creators and rates; set/adjust UGC budgets; all expenses; manage accounts; leaderboard; announcements and company-wide tasks; all notifications; historical data; calendar events. Has a special admin dashboard summarizing the whole department.

**Creative Strategist** — personal dashboard; submit daily check-ins; view assigned ClickUp tasks; own performance and weekly/monthly reports; public leaderboard; winning ads library; submit and vote on ideas; manage assigned UGC creators; view/manage own monthly UGC budget; creative calendar. Cannot change others' budgets, performance data, or private reports.

**UGC Manager** — UGC creator database, profiles and socials, rates, performance history, assignments, UGC expenses, relevant ClickUp tasks, creative calendar, own daily check-ins.

## 3. Personal employee dashboard (shown after login)

- **A. Today's overview:** date, name, morning check-in status, evening check-in status, tasks due today, overdue tasks, upcoming deadlines.
- **B. Weekly performance (strategists):** concepts submitted, concepts approved, ads produced from their concepts, ads launched, winning ads, attributed ad spend, attributed revenue, avg ROAS, avg CPA — with comparison to previous week.
- **C. Monthly performance:** same metrics for the month, with a graph over time. Range switcher: Today | This Week | This Month | Last Month | Custom.
- **D. UGC budget overview:** monthly budget, spent, remaining, horizontal progress bar that updates as expenses are recorded.
- **E. Assigned tasks (ClickUp):** name, due date, priority, status, link that opens the task in ClickUp.

## 4. Daily morning check-in

Required every working day, submitted on the site. Questions (free-text):

1. What are your main priorities today?
2. What specific tasks do you plan to complete?
3. What creative concepts or projects are you working on?
4. Are there any obstacles preventing you from completing your work?
5. Is there anything you need from management?

Auto-record employee, date, submission time, status.

**Missing check-ins:** owner configures a deadline (e.g. 9:30 AM EST). If missed: mark missing, notify owner, show on missing list, remind the employee.

**Admin morning dashboard:** table of Employee | Date | Submitted At | Status | View Answers. "View" opens full answers. Filters: employee, date, department, status.

## 5. Daily evening check-in

Questions:

1. What did you complete today?
2. Which tasks are still unfinished?
3. What prevented you from completing any planned work?
4. Did you encounter any problems today?
5. What are your priorities for tomorrow?

Encourage links to completed work. Automatically compare morning plan vs evening result (e.g. planned 3 concepts, completed 2 → "Partially Completed"). Do not auto-penalize; allow explanations.

**Admin evening dashboard:** employee, morning commitments, evening accomplishments, unfinished work, blockers, submission time. Notifications for missing evening check-ins. All check-ins stored permanently.

## 6. Creative strategist leaderboard

Public to all logged-in employees; a headline feature.

**Metrics:** concepts submitted, approved concepts, ads launched, winning ads, win %, attributed ad spend, attributed revenue, avg CPA, avg ROAS.

**Layout:** Rank (🥇🥈🥉) | Strategist | Ads Launched | Winning Ads | Win Rate | Ad Spend.

**Filters:** this week, this month, last month, last 90 days, all time, custom.

**Ranking:** default by number of winning ads; owner can switch to profitable spend, win %, revenue, etc.

**Winning ad definition is configurable** by the owner. Use consistent attribution rules for fair comparison.

**Current definition (Eric, 2026-10-25):** an ad is a winner in Northbeam when **all** of these are true:

- Spend **over $10,000**
- CAC **below $70**
- New visitor % **above 50%**

## 7. Winning ads dashboard

Performance dashboard + searchable creative library.

**Per ad:** thumbnail/preview, ad name, strategist, UGC creator, launch date, product/scent, creative angle, hook, format, spend, revenue, ROAS, CPA, CTR, conversions.

**Filters:** Daily | Weekly | Monthly | All Time; plus strategist, UGC creator, product, scent, angle, format.

**Sections:** Top Ads Today / This Week / This Month / All Time, ranked by the selected metric. Click an ad for full performance history. Notes section where strategists explain why it worked.

## 8. Creative strategy analytics

Separate from the leaderboard; shows which strategies produce results.

- **By creative angle:** luxury home fragrance, social proof, viral product hype, scent experience, cleaning demonstrations, customer testimonials, limited-time offers, before-and-after cleaning, emotional storytelling, FOMO.
- **By format:** UGC testimonial, UGC demonstration, AI voiceover, product montage, static image, founder-style, storytelling.
- **By product/scent:** Brazilian Waves, Heartbreaker, Royalty, Sunwashed Linen, Imported Mahogany.

**Show:** ads tested, winners, win rate, spend, revenue, CPA, ROAS. Comparison charts across angles, formats, scents. Filter by week, month, custom range.

## 9. ClickUp integration

Dedicated ClickUp Overview page via the ClickUp API. Show: all active creative tasks, tasks per employee, due today, overdue, completed, awaiting approval, upcoming deadlines.

Employees see only their tasks on their dashboard; owner sees all.

**Production stats** on admin dashboard, e.g. this week: 65 videos assigned, 42 completed, 18 in progress, 5 overdue.

ClickUp stays the source of truth; no competing task system. Sync statuses automatically where possible.

## 10. UGC creator management

One of the largest sections: central database of every creator.

**Per creator:** full name, profile picture, email, country, TikTok, Instagram, other socials, rate per video, package rates, usage rights, whitelisting rates, videos completed, assigned strategist, assigned UGC manager, status, performance rating, internal notes.

**Statuses:** Active, Previously Worked With, Available, Negotiating, Unresponsive, Do Not Work With.

**Creator profile:** info (socials, contact, pricing), collaboration history, financial history (total paid), creative performance (their ads and results), internal notes.

**Top UGC Creators:** rank by winning ads, win %, ad spend, revenue, CPA, ROAS; time-period filter; favorites.

## 11. UGC budget tracker

Inside the UGC section. Each strategist has a monthly UGC budget set by the owner.

**Per strategist:** budget, paid, committed, available, with a large progress bar split into available / committed / paid.

**Rules:** booking a creator records the agreed cost as committed; paying moves it from committed to paid; never double-count.

**Expense record:** creator, strategist, UGC manager, project, number of videos, agreed price, payment status, date, notes.

**Admin budget dashboard:** Strategist | Monthly Budget | Paid | Committed | Available, plus department total.

**Notifications to owner:** strategist hits 80%; hits 100%; attempts to exceed available budget; expense requires approval. Owner can approve extra spending. Budgets reset monthly; history stays accessible.

## 12. Creative ideas bank

Submit, browse, discuss, vote.

**Idea fields:** title, description, angle, product/scent, suggested hook, reference links, example videos/images, submitter, date.

**Voting:** 👍 / 👎, one vote per employee per idea, changeable; show totals.

**Collections:** UGC Concepts, Viral Hooks, Luxury Scent Marketing, Competitor Inspirations, Product Demonstrations, Static Ad Ideas, Sales and Promotions, AI Voiceover Concepts, Experimental Concepts. Employees can create collections with permission.

**Statuses:** New, Under Review, Approved, Rejected, In Testing, Winner, Loser. Owner approves/rejects. Approved ideas can link to ClickUp tasks.

**Also:** comments, search, filtering, sort by most upvoted / newest, favorites, attachments.

## 13. Creative calendar

Large interactive calendar for every employee. Views: month, week, day, list.

**Events:** company (team meetings, creative reviews, strategy meetings, deadlines); marketing (product launches, new scent launches, promos, sales, ad deadlines); major US shopping holidays (Valentine's, Mother's Day, Father's Day, Labor Day, Halloween, Thanksgiving, Black Friday, Cyber Monday, Christmas, New Year's, and other relevant ones). Holiday dates must be computed correctly for each year.

**Event fields:** name, date/time, description, assigned employees, category, priority, related tasks, links.

**Upcoming events** section on the dashboard showing important upcoming dates (e.g. "Black Friday — 33 days").

_[Specification text cut off here — remaining sections pending.]_
