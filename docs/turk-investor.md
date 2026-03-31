# The Turk Investor — Specialized AI Agents for Financial Research

> Design document for the next evolution of Turk: domain-specific agents that train themselves on websites before performing tasks.

---

## The Problem with Generic Agents

Today, every turk starts from zero. When a "SeekingAlpha News Scraper" turk launches, it has never seen SeekingAlpha before. It navigates blindly, takes screenshots, reads accessibility trees, and slowly figures out the site layout — burning through tokens and time before it even begins its actual task.

A human analyst wouldn't work this way. They already know that SeekingAlpha has a news feed, article pages, earnings transcripts, and stock summary pages. They know where the data is, how the navigation works, and what's behind the paywall.

**Trained turks would work the same way.** Press a button, the turk studies a website, and from that point forward any turk working on that site starts with knowledge instead of guesswork.

---

## Core Concept: Site Training

```
┌─────────────────────────────────────────────────────┐
│                   TRAINING PHASE                     │
│                                                      │
│  User provides URL ──► Turk explores site ──►        │
│  Builds Site Profile ──► Saves to database           │
│                                                      │
│  "Train on seekingalpha.com"                         │
│  "Train on finance.yahoo.com"                        │
│  "Train on m4th.com"                                 │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                   TASK PHASE                         │
│                                                      │
│  User assigns task ──► Turk loads Site Profile ──►   │
│  Starts with full site knowledge ──► Works faster    │
│                                                      │
│  "Find all Adobe earnings articles"                  │
│  "Extract Q1 2026 financial data"                    │
│  "Monitor for new analyst reports"                   │
└─────────────────────────────────────────────────────┘
```

A **Site Profile** is a structured document that captures everything an agent needs to know about a website: its page types, navigation patterns, data locations, interactive elements, and quirks. It's not code — it's knowledge, stored as markdown that gets injected into the agent's workspace files at container start.

---

## What a Site Profile Contains

A Site Profile for SeekingAlpha might look like this:

```markdown
# SeekingAlpha — Site Profile

## Overview
Financial research platform. Article-based content with stock analysis,
earnings transcripts, and news. Freemium model with premium paywall.

## Page Types

### Stock Summary Page
- URL pattern: seekingalpha.com/symbol/{TICKER}
- Contains: current price, market cap, P/E ratio, dividend yield
- Tabs: Overview, News, Analysis, Earnings, Dividends, Financials
- Interactive: tab navigation, time period selectors

### Article Page
- URL pattern: seekingalpha.com/article/{slug}
- Contains: title, author, date, ticker mentions, full text
- Structure: summary box at top, body text, disclosure at bottom
- Note: premium articles show first 2 paragraphs only

### News Feed
- URL pattern: seekingalpha.com/market-news
- Contains: headline list with timestamps and ticker tags
- Interactive: infinite scroll pagination
- Filter: by sector, by market cap, by time range

### Earnings Transcripts
- URL pattern: seekingalpha.com/symbol/{TICKER}/earnings/transcripts
- Contains: Q&A format with speaker identification
- Data: EPS estimates, revenue estimates, guidance figures

## Navigation
- Main nav: Markets, News, Analysis, Investing, Alpha Picks
- Stock search: search bar at top, autocomplete with ticker suggestions
- Per-stock tabs: accessible from any stock page

## Authentication
- Login required for: full article text, earnings transcripts, analyst ratings
- Login flow: top-right "Sign In" → email/password form
- Premium content: shows "Premium" badge, truncated content without subscription

## Data Extraction Tips
- Financial figures appear in standardized table layouts
- Date formats: "Mar. 29, 2026" in articles, "2026-03-29" in data tables
- Ticker symbols are linked elements with class "ticker-link"

## Known Issues
- Heavy JavaScript rendering — page must fully load before snapshots
- Some content loads via AJAX after initial page render
- Rate limiting on rapid page loads (429 errors after ~30 requests/minute)
```

This is pure context — it costs nothing to generate once and dramatically reduces the tokens and time needed for every subsequent task on that site.

---

## How Training Would Work

### The Training Flow

1. **User clicks "Train"** on a turk and provides a target URL
2. **The turk enters training mode** — a distinct phase before any task
3. **Systematic exploration begins:**
   - Navigate to the target URL
   - Capture the accessibility tree (semantic DOM structure)
   - Extract any schema.org structured data (JSON-LD)
   - Identify the main navigation elements
   - Follow primary navigation links to discover page types
   - For each page type: capture the layout, identify data regions, note interactive elements
   - Test common interaction patterns (search, filters, pagination)
   - Check for authentication walls
4. **The agent compiles findings** into a Site Profile document
5. **The profile is saved** — either as a Memory Bank entry, a database record, or both
6. **Training complete** — future turks on this domain load the profile automatically

### What the Agent Looks For

| Aspect | How It's Discovered |
|--------|-------------------|
| Page types | Follow navigation links, categorize by URL pattern and content structure |
| Data locations | Accessibility tree roles (tables, lists, headings), ARIA labels |
| Navigation patterns | Main nav links, breadcrumbs, tab bars, sidebar menus |
| Interactive elements | Forms, buttons, dropdowns, search bars, filters |
| Pagination | "Next" buttons, infinite scroll triggers, page number links |
| Authentication | Login prompts, paywall overlays, premium badges |
| Content structure | Heading hierarchy, article schemas, table layouts |
| Schema.org data | JSON-LD scripts in page head (articles, products, organizations) |
| Anti-patterns | Cookie banners, popup modals, ad overlays to dismiss |
| Rate limiting | Response codes, delays, CAPTCHA triggers |

### Training Output

The training phase produces:
1. **Site Profile document** — Structured markdown (see example above)
2. **Navigation graph** — A map of page types and how to reach them
3. **Element selectors** — Preferred ways to find key data on each page type (accessibility labels, ARIA roles, semantic HTML rather than brittle CSS classes)
4. **Example data** — Sample extractions to validate the profile

---

## Architecture: Where This Fits

There are two viable paths for implementing specialized turks. They aren't mutually exclusive.

### Path A: Extend the Existing Turk Platform

Add Site Profiles as a first-class feature within the current codebase.

```
turk/ (existing repo)
├── web/
│   ├── prisma/schema.prisma     # Add SiteProfile model
│   ├── src/app/
│   │   ├── api/site-profiles/   # CRUD + training trigger
│   │   └── site-profiles/       # UI for managing profiles
│   └── src/components/
│       └── site-profile.tsx     # Profile viewer + train button
│
├── agent/
│   ├── entrypoint.sh            # Inject SITE_PROFILE.md into workspace
│   ├── bridge/index.js          # Add training mode (pre-task exploration)
│   └── skills/
│       └── site-trainer/        # New skill for systematic site exploration
│           └── SKILL.md
```

**New database model:**

```prisma
model SiteProfile {
  id          String   @id @default(uuid())
  domain      String   @unique   // e.g., "seekingalpha.com"
  name        String              // e.g., "SeekingAlpha"
  profile     String   @db.Text   // The full markdown profile
  version     Int      @default(1)
  trainedAt   DateTime
  trainedBy   String?             // turkId that generated this profile
  metadata    Json?               // Navigation graph, page types, etc.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Turks that have used this profile
  turks       Turk[]

  @@index([domain])
}
```

**Turk model additions:**

```prisma
model Turk {
  // ... existing fields ...
  siteProfileId  String?       // FK to SiteProfile
  siteProfile    SiteProfile?  @relation(fields: [siteProfileId], references: [id])
}
```

**Pros:** No new repos, shared infrastructure, Memory Bank integration, all turk types benefit.
**Cons:** Increases complexity of the main codebase, risk of scope creep.

### Path B: Create "The Turk Investor" as a Specialized Product

A separate repo that imports or forks the core Turk engine and adds domain-specific capabilities for financial research.

```
turk-investor/
├── core/                        # Shared engine (git submodule or npm package)
│   ├── docker.ts                # Container orchestration
│   ├── bridge/                  # OpenClaw bridge
│   └── entrypoint.sh            # Agent bootstrap
│
├── web/                         # Investor-focused dashboard
│   ├── src/app/
│   │   ├── portfolio/           # Stock watchlist management
│   │   ├── training/            # Site training UI
│   │   ├── research/            # Research project management
│   │   └── reports/             # Generated research reports
│   └── prisma/schema.prisma     # Financial-specific schema
│
├── agent/
│   ├── skills/
│   │   ├── site-trainer/        # Site exploration + profile generation
│   │   ├── financial-analyst/   # Financial data extraction + analysis
│   │   ├── news-monitor/        # Continuous news monitoring
│   │   └── earnings-parser/     # Earnings transcript analysis
│   └── profiles/                # Pre-built site profiles
│       ├── seekingalpha.md
│       ├── yahoo-finance.md
│       ├── sec-edgar.md
│       └── m4th.md
│
└── docs/
    └── site-profile-format.md   # Specification for profile documents
```

**Turk Investor-specific features:**
- **Stock Watchlist** — Manage a list of tickers, each with assigned turks
- **Pre-built Site Profiles** — Ship with profiles for major financial sites
- **Financial Data Types** — Schema-aware extraction for earnings, revenue, EPS, etc.
- **Report Generation** — Compile Memory Bank findings into investment reports
- **Scheduled Monitoring** — Turks that wake up periodically to check for new data
- **API Connectors** — Turk types that pull from financial APIs (SEC EDGAR, Alpha Vantage) instead of browsing

**Pros:** Clean separation, financial-specific UX, can ship pre-trained profiles, focused product.
**Cons:** Code duplication, maintaining two codebases, slower iteration on shared features.

### Recommendation: Start with Path A, Graduate to Path B

Begin by adding Site Profiles to the existing Turk platform. This validates the concept with minimal overhead. If financial research turks become a significant use case, extract them into a standalone product.

---

## The Training Pipeline in Detail

### Phase 1: Initial Crawl

The training turk navigates to the provided URL and performs a breadth-first exploration:

```
1. Load homepage → capture accessibility tree + screenshot
2. Extract all navigation links (nav elements, header links, footer links)
3. Categorize links by URL pattern:
   - /symbol/{ticker} → "Stock Page"
   - /article/{slug} → "Article Page"
   - /market-news → "News Feed"
4. Visit one example of each page type
5. For each page type, capture:
   - Full accessibility tree
   - Heading hierarchy (H1, H2, H3 structure)
   - Table structures (headers + sample data)
   - Form elements (inputs, selects, buttons)
   - Schema.org structured data (JSON-LD)
```

### Phase 2: Interaction Testing

The turk tests how the site responds to interactions:

```
1. Search functionality:
   - Find the search input
   - Enter a test query (e.g., a stock ticker)
   - Observe how results appear (new page, dropdown, AJAX update)

2. Pagination:
   - Find "next" buttons, page numbers, or infinite scroll triggers
   - Test navigation between pages
   - Note loading patterns (full page reload vs. AJAX)

3. Filters:
   - Find filter/sort controls
   - Test common filter combinations
   - Note how filtered results are displayed

4. Authentication:
   - Identify login prompts
   - Note which content requires authentication
   - Map the login flow (for later credential injection)
```

### Phase 3: Profile Compilation

The turk synthesizes its findings into a structured Site Profile:

```
1. Generate the overview section (site purpose, content model)
2. Document each page type with URL patterns and data locations
3. Map the navigation structure
4. Note interaction patterns and their outcomes
5. List known issues (rate limiting, JavaScript requirements, etc.)
6. Save the profile to the database
7. Optionally save navigation graph as structured JSON metadata
```

### Phase 4: Validation

The turk performs a quick validation pass:

```
1. Navigate to a page type using only the profile's instructions
2. Attempt to extract data from the documented locations
3. Verify that navigation paths work as described
4. Report any discrepancies
5. Mark the profile as validated (or flag for review)
```

---

## How Trained Turks Use Profiles

When a turk starts a task and a Site Profile exists for the target domain:

1. **`entrypoint.sh` injects the profile** — The profile document is added to the workspace as `SITE_PROFILE.md` (or appended to `AGENTS.md`)
2. **The agent reads it as context** — OpenClaw loads all workspace files into the agent's context window
3. **Task execution is faster** — The agent already knows:
   - Where to find the data it needs
   - How to navigate to the right pages
   - What interactive elements to use
   - What to avoid (paywalls, rate limits)
4. **Fallback to generic reasoning** — If the profile is outdated (site redesign), the agent detects mismatches and falls back to standard exploration, noting what changed
5. **Profile updates** — After a task, the agent can flag profile inaccuracies for re-training

### Token and Time Savings

A rough estimate of the impact:

| Metric | Without Profile | With Profile | Improvement |
|--------|----------------|--------------|-------------|
| Turns to first useful data | 5-8 | 1-2 | 3-6x faster |
| Tokens per task | 15,000-25,000 | 5,000-10,000 | 2-3x cheaper |
| Navigation errors | 3-5 per run | 0-1 per run | Fewer retries |
| Total task time | 8-15 minutes | 2-5 minutes | 3-5x faster |

These are estimates based on observed behavior with the current generic turks. The first few turns of every task are currently spent on exploration and orientation — a trained turk skips this entirely.

---

## Specialized Turk Types for Financial Research

Beyond site training, a "Turk Investor" product would feature purpose-built turk types:

### 1. The News Monitor

**Role:** Watch a news source for new articles about a set of tickers.

**Behavior:**
- Loads with a SeekingAlpha (or similar) Site Profile
- Given a watchlist of tickers
- Periodically checks the news feed for new articles
- Saves headlines, summaries, and links to the Memory Bank
- Flags articles with high-impact keywords (earnings, acquisition, downgrade)
- Runs on a schedule (every 15 minutes, hourly, etc.)

### 2. The Earnings Analyst

**Role:** Extract and analyze quarterly earnings data.

**Behavior:**
- Loads with Site Profile for the earnings data source
- Navigates to the earnings transcript page for a given ticker
- Extracts: EPS (actual vs. estimate), revenue (actual vs. estimate), guidance
- Parses the Q&A section for key analyst questions and management responses
- Saves structured earnings data to the Memory Bank
- Compares against prior quarters if historical data is available

### 3. The Valuation Engine

**Role:** Gather financial data and compute valuation metrics.

**Behavior:**
- Loads with Site Profiles for financial data sources (m4th.com, Yahoo Finance)
- Collects: revenue, EPS, FCF, growth rates, discount rates
- Runs DCF calculations using gathered inputs
- Compares intrinsic value estimates across multiple sources
- Saves a comprehensive valuation summary to the Memory Bank

### 4. The SEC Filing Reader

**Role:** Parse SEC filings (10-K, 10-Q, 8-K) for key information.

**Behavior:**
- Loads with a Site Profile for SEC EDGAR
- Navigates to the filing page for a given ticker
- Identifies filing sections (risk factors, MD&A, financial statements)
- Extracts key figures and management commentary
- Cross-references with prior filings for changes
- Saves findings to the Memory Bank with citations

### 5. The Sentiment Tracker

**Role:** Gauge market sentiment from multiple sources.

**Behavior:**
- Loads Site Profiles for multiple news and social sources
- Collects analyst ratings, price targets, article sentiment
- Categorizes as bullish/bearish/neutral with confidence scores
- Tracks sentiment changes over time
- Saves a sentiment dashboard to the Memory Bank

---

## Implementation Phases

### Phase 1: Site Profile Infrastructure (2-3 weeks)

**Goal:** Add the ability to create, store, and inject Site Profiles.

- Add `SiteProfile` model to Prisma schema
- Create API routes for CRUD operations
- Build a basic UI for viewing and managing profiles
- Modify `entrypoint.sh` to inject profiles into workspace files
- Modify `docker.ts` to pass profile data to containers
- Create a `site-trainer` skill with exploration instructions

### Phase 2: Training Mode (2-3 weeks)

**Goal:** Turks can explore a site and generate a profile automatically.

- Add a "Train" button to the turk UI
- Implement training mode in the bridge (pre-task exploration phase)
- Build the profile compilation logic (agent generates markdown from observations)
- Add validation pass (agent tests its own profile)
- Auto-associate profiles with domains for future turks

### Phase 3: Financial Specialization (3-4 weeks)

**Goal:** Ship pre-built profiles and financial-specific turk types.

- Create hand-curated profiles for 5-10 major financial sites
- Build the "News Monitor" turk type with scheduled execution
- Build the "Earnings Analyst" turk type
- Add financial data types to the Memory Bank (structured earnings, valuations)
- Create a "Research Report" export that compiles Memory Bank findings

### Phase 4: The Turk Investor Product (4-6 weeks)

**Goal:** If financial research proves to be the dominant use case, extract into a standalone product.

- Fork or extract the core engine
- Build the investor-focused dashboard (watchlists, portfolios, reports)
- Ship with pre-built profiles and specialized turk types
- Add API connectors for structured data sources
- Implement scheduled monitoring with alerting

---

## Open Questions

1. **Profile freshness** — How do we detect when a site has changed enough that a profile is stale? Options: version timestamps, automatic re-validation runs, user-triggered re-training.

2. **Profile sharing** — Should profiles be shareable across Turk installations? A community library of site profiles could be valuable. Privacy implications of sharing site structure data need consideration.

3. **Profile granularity** — One profile per domain, or per site section? SeekingAlpha's news section is very different from its earnings transcripts. Sub-profiles might be needed.

4. **Training cost** — A full site exploration could consume significant tokens. Should training be incremental (explore one section at a time) or all-at-once?

5. **API vs. Browser** — For financial data specifically, APIs (Alpha Vantage, SEC EDGAR, Yahoo Finance API) are more reliable than browser automation. Should trained turks prefer APIs when available, falling back to browser only when needed?

6. **Multi-model strategy** — Should training runs use a larger, more capable model (for better understanding) while task runs use a smaller, faster model (with the profile compensating for reduced capability)?

7. **Legal considerations** — Automated site exploration and data extraction have legal implications (terms of service, rate limiting, robots.txt). Profiles should include compliance guidance.

---

## Conclusion

The gap between a generic agent and a trained agent is the gap between a new hire and an experienced employee. Both can do the work, but the experienced one knows where everything is.

Site Profiles bridge this gap without requiring model fine-tuning, massive datasets, or complex ML infrastructure. They're markdown documents — the same format Turk already uses for workspace files. The training pipeline is a systematic exploration task — the same kind of task turks already perform.

The investment case for building this is clear: **every minute a turk spends exploring a known site is wasted work.** A trained turk starts productive from its first turn.

For the financial research use case specifically, the combination of site training + specialized turk types + Memory Bank creates a research automation system that could genuinely replace hours of manual analyst work. The question isn't whether to build it — it's whether to build it as an extension of Turk or as its own product.
