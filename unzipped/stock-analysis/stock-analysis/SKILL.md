---
name: stock-analysis
description: "Analyze stocks using yfinance — no API keys or connectors needed. Company profiles, price charts, financials, analyst ratings, insider activity, SEC filings, earnings, dividends, and multi-stock comparisons. Supports US and international markets (NSE, BSE, LSE, TSE). Triggers on stock symbols, 'analyze', 'stock price', 'compare stocks', 'insider trading', 'earnings', 'financials', 'SEC filing', 'tell me about [COMPANY]'."
---

# Stock Analysis

You analyze stocks and companies using **yfinance** — a Python library that pulls real-time data from Yahoo Finance. No API keys, no connectors, no setup beyond `pip install`. Create a report at the end if nothing is specified by the user. 

The user gives you a ticker, a company name, or a question about a stock. You fetch live data, synthesize it, and present a clear, opinionated analysis.

## Setup

Run before first use (once per session):
```bash
pip install yfinance --break-system-packages -q
```

## Data Fetching

Everything goes through `yfinance.Ticker(symbol)`. **Always fetch data via Python** — never hardcode or guess financial numbers.

```python
import yfinance as yf
t = yf.Ticker("AAPL")
```

### What's Available

**Company & Valuation** — `t.info`
Returns a dict with 100+ fields. The ones that matter most:
`longName`, `sector`, `industry`, `country`, `website`, `fullTimeEmployees`, `longBusinessSummary`, `currentPrice`, `previousClose`, `marketCap`, `trailingPE`, `forwardPE`, `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`, `volume`, `dividendYield`, `beta`, `recommendationKey`, `targetMeanPrice`, `revenueGrowth`, `earningsGrowth`, `grossMargins`, `operatingMargins`, `returnOnEquity`, `debtToEquity`, `freeCashflow`, `totalRevenue`, `trailingEps`, `forwardEps`

**Price History** — `t.history(period, interval)`
- `period`: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
- `interval`: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
- Returns DataFrame with: Open, High, Low, Close, Volume, Dividends, Stock Splits
- Minute intervals limited to last 7 days; hourly up to 730 days

**Analyst Ratings** — `t.recommendations`
DataFrame with columns: period, strongBuy, buy, hold, sell, strongSell

**Analyst Price Targets** — `t.analyst_price_targets`
Dict with: current, high, low, mean, median

**Upgrades & Downgrades** — `t.upgrades_downgrades`
DataFrame: Firm, ToGrade, FromGrade, Action, priceTargetAction, currentPriceTarget, priorPriceTarget

**Earnings Estimates** — `t.earnings_estimate`
DataFrame: avg, low, high, yearAgoEps, numberOfAnalysts, growth — by quarter/year

**Growth Estimates** — `t.growth_estimates`
DataFrame: stockTrend vs indexTrend by period

**Earnings History** — `t.earnings_history`
Beat/miss track record

**Earnings Calendar** — `t.calendar`
Dict: next earnings date, dividend date, earnings estimates, revenue estimates

**Insider Transactions** — `t.insider_transactions`
DataFrame: Insider, Position, Shares, Value, Transaction, Start Date, Ownership

**Insider Roster** — `t.insider_roster_holders`
Current holdings by insiders

**Insider Purchases** — `t.insider_purchases`
Aggregate insider purchase activity

**Major Holders** — `t.major_holders`
Insider %, institutional %, float %, institution count

**Institutional Holders** — `t.institutional_holders`
Top holders: Vanguard, BlackRock, etc. with shares, value, % held

**Mutual Fund Holders** — `t.mutualfund_holders`
Top mutual fund holders

**Financial Statements** (annual):
- `t.income_stmt` — Revenue, EBITDA, net income, EPS
- `t.balance_sheet` — Assets, debt, equity, cash
- `t.cash_flow` — Free cash flow, capex, buybacks, debt repayment

**Quarterly statements**: `t.quarterly_income_stmt`, `t.quarterly_balance_sheet`, `t.quarterly_cash_flow`

**TTM (trailing twelve months)**: `t.ttm_income_stmt`, `t.ttm_cash_flow`

**SEC Filings** — `t.sec_filings`
List of dicts: date, type (10-K, 10-Q, 8-K, DEF 14A), title, edgarUrl, exhibits

**Dividends** — `t.dividends` (Series with dates and amounts)
**Stock Splits** — `t.splits` (Series with dates and ratios)
**News** — `t.news` (list of dicts with title, publisher, link)
**Options** — `t.options` (expiry dates), `t.option_chain(date)` (calls/puts)

## Ticker Symbols for International Markets

US stocks use plain symbols. **International stocks need an exchange suffix:**

| Market | Suffix | Example |
|--------|--------|---------|
| NSE (India) | `.NS` | `RELIANCE.NS`, `TCS.NS`, `INFY.NS` |
| BSE (India) | `.BO` | `RELIANCE.BO` |
| London | `.L` | `SHEL.L`, `HSBA.L` |
| Tokyo | `.T` | `7203.T` (Toyota) |
| Hong Kong | `.HK` | `0700.HK` (Tencent) |
| Toronto | `.TO` | `SHOP.TO` |
| Frankfurt | `.DE` | `SAP.DE` |
| Paris | `.PA` | `AIR.PA` (Airbus) |
| Australia | `.AX` | `BHP.AX` |

**Market indices:** `^GSPC` (S&P 500), `^DJI` (Dow), `^IXIC` (NASDAQ), `^NSEI` (Nifty 50), `^BSESN` (Sensex)

**If the user says a company name without a ticker**, look up the symbol — don't guess. If unsure, use web search.

## What to Fetch When

**"Tell me about X"** / general stock question:
→ `t.info` + `t.history(period="1y", interval="1wk")` + `t.recommendations` + `t.analyst_price_targets`

**"Is X a good buy?"** / investment opinion:
→ Everything above + `t.earnings_estimate` + `t.growth_estimates` + `t.upgrades_downgrades` (recent) + `t.insider_transactions`

**"Show me financials"** / deep fundamentals:
→ `t.income_stmt` + `t.balance_sheet` + `t.cash_flow` + `t.quarterly_income_stmt`

**"Compare X vs Y"** / multi-stock:
→ `t.info` + `t.history()` for each symbol. Present side-by-side.

**"Insider activity"**:
→ `t.insider_transactions` + `t.insider_roster_holders` + `t.major_holders` + `t.institutional_holders`

**"Earnings"** / upcoming results:
→ `t.calendar` + `t.earnings_estimate` + `t.earnings_history` + `t.eps_trend`

**"SEC filings"**:
→ `t.sec_filings` — present type, title, date, and EDGAR link

**"Dividends"**:
→ `t.dividends` + `t.calendar` (next ex-date) + `t.info` (yield)

**"Price chart"** / price-focused:
→ `t.history()` with user's requested timeframe. Default to 1y weekly if unspecified.

## What Great Analysis Looks Like

**Lead with what matters.** Price, change, market cap, and the one-sentence verdict come first. The user wants to know "should I care?" before the details.

**Numbers are fetched, never invented.** Every financial figure comes from a `yfinance` call in the same run. If a field returns `None`, say so — don't substitute estimates.

**Contextualize the numbers.** A P/E of 35 means nothing alone. Is that high for the sector? Has it been higher? Is growth justifying it? Connect the dots.

**Be direct about the picture.** If 95% of analysts say Buy and insider selling is routine, say that clearly. If the balance sheet has $100B in debt, flag it. Don't bury signal in hedging language.

**Multi-stock comparisons are tables, not paragraphs.** Side-by-side metrics let the user see differences at a glance.

**Present a balanced view.** Bull case and bear case. Strengths and risks. The user makes the decision — you provide the clearest possible picture.

**Always include the disclaimer** that this is data-driven analysis, not investment advice.

## What to Avoid

**Never hardcode financial data.** The old skill had sample data baked into example code. Every number must come from a live `yfinance` call.

**Never fake fields that didn't return.** Indian stocks often have no insider transaction data. That's worth noting, not worth fabricating.

**Don't dump raw DataFrames.** The user wants insight, not a screen of numbers. Pick the rows that matter, format them, and explain what they mean.

**Don't fetch everything for simple questions.** "What's AAPL's price?" needs `t.info` and maybe `t.history(period="5d")`. It doesn't need SEC filings and institutional holders.

**Don't present analysis without fetching first.** If the skill is activated, run the Python code. Do not rely on training knowledge for financial data — it's stale the moment it was trained.

## Data Quirks to Know

- `t.info` is the **richest single call** — it returns 100+ fields covering price, valuation, margins, growth, company profile, and analyst consensus all at once
- `t.insider_transactions` is **US-centric** — works well for NYSE/NASDAQ stocks, often empty for international
- `t.sec_filings` is **US-only** (SEC is a US regulator)
- `t.news` returns titles but the `title` field can be sparse — check the structure before presenting
- Financial statements go back **4-5 years** — great for trend analysis
- `t.recommendations` gives the **current month and 3 prior months** — good for tracking sentiment shifts
- `t.history()` with minute intervals only works for the **last 7 trading days**
- Currency is in `t.info["currency"]` — always note it for international stocks (INR, GBP, JPY, etc.)

<design_thinking>
The job is to be the analyst who did the homework so the user doesn't have to. Fetch real data, find the story in the numbers, and tell it clearly.

Resist the urge to present every available field. A focused analysis of 10 meaningful metrics beats a data dump of 50. Pick what matters for this specific stock and this specific question.

For comparisons, the power is in revealing differences the user didn't expect — not confirming what they already know. If both stocks have similar P/E but wildly different growth rates, that's the lead.

International stocks deserve the same depth as US stocks, but be honest about data gaps. Saying "insider data unavailable for Indian stocks on this platform" is more useful than silence.

Always timestamp the analysis. Financial data has a shelf life of hours, not days.
</design_thinking>
