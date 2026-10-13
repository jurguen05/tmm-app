# Strategies Stops Rules & Calculations Reference

This document centralizes the business logic, formulas, and data sources used to calculate the **Stops** for each strategy in the **TMM System** (`/dashboard/strategies-stops`).

---

## 1. Tech Trader

- **Strategy Identifier:** `Tech Trader` / `TechTrader`
- **Data Sources:**
  - **Position Statement:** `symbol`, `stock_last` (Last Price)
  - **Transaction History:** `stock_entry_price` / `price` (Stock Entry Price is always extracted from the very first chronological purchase transaction of the entire trade, whether it originated as an Option with manual underlying entry price or as a Stock purchase).
  - **MK-TOS Quotes:** `ema` (MovAvgExponential / 180-day EMA from latest active quote)

### Formulas:
1. **Stock Entry Price:**
   - Evaluates all transactions sharing the same `trade_code`.
   - Uses `firstTransaction.stock_entry_price` exclusively (avoids accidentally reading option premium prices).

2. **Protective Stop (Initial Downside Defense):**
   $$\text{Protective Stop} = \text{Stock Entry Price} \times 0.90$$
   *Establishes a baseline floor at 90% of the entry price (-10%).*

2. **Trailing Stop (180-Day EMA):**
   $$\text{Trailing Stop} = \text{quote.ema}$$
   *Extracted from the most recent active MK-TOS quote for that symbol.*

3. **Final Stop:**
   $$\text{Final Stop} = \max(\text{Protective Stop}, \text{Trailing Stop})$$
   *When the stock appreciates and the 180-day EMA exceeds the initial protective floor, the stop automatically trails upward.*

### Alert & Fallback Conditions:
- **Missing MK-TOS Quote:** If the symbol is not found in the MK-TOS quotes table or has not been uploaded yet:
  - The `Stop` value is marked as **`Review`**.
  - The row is highlighted with a **yellow background** (`bg-amber-50`) to prompt the operator to upload or verify the MK-TOS quotes file.

---

## 2. 20% Flipper

- **Strategy Identifier:** `20% Flipper` / `20%Flipper` / `Flipper`
- **Data Sources:**
  - **Trades Table:** `first_buy_date`, `stock_entry_price`, `max_stock_price`, `max_stock_price_date`
  - **MK-TOS Quotes:** `last_price`, `quote_date` (all unarchived historical quotes for the symbol $\ge \text{first\_buy\_date}$)
  - **Position Statement:** `stock_last` (current active quote)

### Formulas & Logic:
1. **Max Stock Price & Date Calculation:**
   $$\text{Max Stock Price} = \max\left(\text{Stock Entry Price}, \max_{q \in \text{Quotes}, \text{Date}_q \ge \text{first\_buy\_date}} (\text{last\_price}_q), \text{Current Last}\right)$$
   - Evaluates **all trading days** from the trade's `first_buy_date` to today.
   - Preserves the date on which the highest price was recorded (`max_stock_price_date`).
   - If the trade already has a previously persisted `max_stock_price` in the `trades` table that exceeds current quotes, the stored historical high is kept intact.

2. **Persistence & MK-TOS Archiving:**
   - Both `max_stock_price` and `max_stock_price_date` are autocalculated and stored in the `trades` table.
   - **Purpose:** Allows older MK-TOS quote CSV files outside the active trade period to be safely archived in the future without losing the peak price reference needed for trailing stop calculations.

---

## 3. Weekend Trader

- **Strategy Identifier:** `Weekend Trader` / `WeekendTrader` (or `weekend_trader_flag = true`)
- **Data Sources:**
  - **Trades Table:** `first_buy_date`, `stock_entry_price`, `max_stock_price`, `max_stock_price_date`, `weekend_trader_flag`
  - **MK-TOS Quotes:** `last_price`, `quote_date` (filtered **exclusively to Fridays**)
  - **Position Statement:** `stock_last` (evaluated only if today is Friday)

### Formulas & Logic:
1. **Friday-Only Peak Evaluation:**
   - Evaluates quotes from `first_buy_date` to today, but **ONLY considers quotes whose date falls on a Friday** ($\text{Day of week} = 5$ in UTC).
   - If `first_buy_date` is a Friday, `stock_entry_price` is considered as the initial candidate. If `first_buy_date` was not a Friday, only subsequent Friday quotes are evaluated.
   - Non-Friday quotes (Monday through Thursday) are strictly ignored for this strategy's peak calculation.

2. **Persistence & Archiving:**
   - Automatically persisted to `trades.max_stock_price` and `trades.max_stock_price_date`.
   - Protects stop reference points against future MK-TOS CSV archiving.

---

## 4. Upcoming Strategies Roadmap

The following strategies will be documented and implemented incrementally:
- **Hedge:** Initial protective stop rules.
- **100-day-High:** MK-TOS `low_100_day` trailing indicator.
- **BBO:** Bollinger Bands trailing indicators (`bollinger_bands`).
- **New Yearly Highs:** 52-week low/high indicator logic.
- **MACD / MAC:** `mac_stop` indicator.
- **Trend Pilot:** `trendpilot_stop` indicator.

