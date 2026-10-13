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

## 2. Upcoming Strategies Roadmap

The following strategies will be documented and implemented incrementally:
- **Hedge:** Initial protective stop rules.
- **100-day-High:** MK-TOS `low_100_day` trailing indicator.
- **20%-Flipper:** Trailing rules based on entry and peak prices.
- **BBO:** Bollinger Bands trailing indicators (`bollinger_bands`).
- **New Yearly Highs:** 52-week low/high indicator logic.
- **MACD / MAC:** `mac_stop` indicator.
- **Weekend Trader:** Dynamic percentage stops based on trade duration.
- **Trend Pilot:** `trendpilot_stop` indicator.
