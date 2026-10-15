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
- **Red Badge Alert:** When $\text{Last Price} < \text{Final Stop}$, the Stop value is displayed with a **red badge** (`bg-red-100 text-red-800 border border-red-300`), identical to the Signal column format.
- **Missing MK-TOS Quote:** If the symbol is not found in the MK-TOS quotes table or has not been uploaded yet:
  - The `Stop` value is marked as **`Review`**.
  - The row is highlighted with a **yellow background** (`bg-amber-50`) to prompt the operator to upload or verify the MK-TOS quotes file.

---

## 2. 20% Flipper

- **Strategy Identifier:** `20% Flipper` / `20%Flipper` / `Flipper`
- **Data Sources:**
  - **Trades Table:** `first_buy_date`, `stock_entry_price`, `max_stock_price`, `max_stock_price_date`
  - **MK-TOS Quotes:** `high_price` (header `High`), `last_price`, `quote_date` (all unarchived historical quotes for the symbol $\ge \text{first\_buy\_date}$)
  - **Position Statement:** `stock_last` (current active quote)

### Formulas & Logic:
1. **Max Stock Price & Date Calculation:**
   $$\text{Max Stock Price} = \max\left(\text{Stock Entry Price}, \max_{q \in \text{Quotes}, \text{Date}_q \ge \text{first\_buy\_date}} (\text{high\_price}_q), \text{Current Last}\right)$$
   - Evaluates **all trading days** from the trade's `first_buy_date` to today.
   - Evaluates the **`High`** column (`high_price`) from MK-TOS quotes to track the absolute maximum intraday peak reached.
   - Preserves the date on which the highest price was recorded (`max_stock_price_date`).
   - If the trade already has a previously persisted `max_stock_price` in the `trades` table that exceeds current quotes, the stored historical high is kept intact.

2. **Trailing Stop (0.8 × Max Stock Price):**
   $$\text{Stop} = \text{Max Stock Price} \times 0.80$$
   - Red Badge Alert: When $\text{Last Price} < \text{Stop}$, the Stop value is displayed with a **red badge** (`bg-red-100 text-red-800 border border-red-300`), identical to the Signal and Stop alert format.

3. **Persistence, Archiving & Closed Lifecycle Rule:**
   - Both `max_stock_price` and `max_stock_price_date` are autocalculated and stored in the `trades` table **exclusively while the trade is `Open`**.
   - **Trade Closure Rule:** As soon as a trade is marked as `Closed` (via Option 1 net quantity balance $= 0$, or via Option 2 manual confirmation), both `max_stock_price` and `max_stock_price_date` are automatically reset to `NULL`.
   - **Purpose:** Allows older MK-TOS quote CSV files outside the active trade period to be safely archived without losing the peak price reference needed for trailing stop calculations while the position is active.

---

## 3. Weekend Trader

- **Strategy Identifier:** `Weekend Trader` / `WeekendTrader` (or `weekend_trader_flag = true`)
- **Data Sources:**
  - **Trades Table:** `first_buy_date`, `stock_entry_price`, `max_stock_price`, `max_stock_price_date`, `weekend_trader_flag`
  - **MK-TOS Quotes:** `high_price` (header `High`), `last_price`, `quote_date` (evaluated on weekly close sessions: Fridays, or Thursdays if Friday was a market holiday)
  - **MK-TOS Quotes (SPY):** `last_price` and `sma_10w` (header `SMA 10W`) for ticker `SPY`
  - **Position Statement:** `stock_last` (Last Price)

### Formulas & Logic:
1. **Weekly Peak High Calculation:**
   $$\text{High} = \max\left(\text{Stock Entry Price (si cayó en cierre semanal)}, \max_{q \in \text{Quotes Weekly Close}, \text{Date}_q \ge \text{first\_buy\_date}} (\text{high\_price}_q), \text{Current Last (si hoy es cierre semanal)}\right)$$
   - Evaluates quotes from `first_buy_date` to today, strictly on **weekly close sessions** (Fridays, or Thursdays if Friday was a holiday / no quote).
   - Evaluates the **`High`** column (`high_price`) to track the highest peak reached.

2. **General Market Filter (SPY vs SMA 10W):**
   Evaluates the latest weekly close for the S&P 500 ETF (`SPY`):
   - **Bullish Market / Normal ($\text{SPY.Last} > \text{SPY.SMA\_10W}$):**
     $$\text{Stop} = \text{High} \times 0.60$$
     *(Trailing stop configurado con un 40% de caída desde el máximo).*
   - **Bearish Market / Defensivo ($\text{SPY.Last} \le \text{SPY.SMA\_10W}$):**
     $$\text{Stop} = \text{High} \times 0.90$$
     *(Stop defensivo configurado con un 10% de caída desde el máximo).*

3. **Permanent Trade Flag Rule (Ratchet Irreversible):**
   - **Regla Histórica de Compra:** Todas las operaciones de Weekend Trader compradas antes del **24/07/2026** (`first_buy_date < '2026-07-24'`) tienen el flag activo por definición (**`weekend_trader_flag = true`**), fijando su stop permanentemente en $\text{High} \times 0.90$.
   - **Regla Dinámica posterior:** Para operaciones compradas a partir del 24/07/2026, una vez que la operación experimenta un cierre semanal con $\text{SPY.Last} \le \text{SPY.SMA\_10W}$, queda marcada con **`weekend_trader_flag = true`** en la tabla `trades`.
   - Una vez flageada, su stop **permanece en $\text{High} \times 0.90$ para siempre**, incluso si en semanas posteriores el SPY vuelve a superar la `SMA 10W`.
   - Nuevas operaciones abiertas posteriormente arrancan con $\text{High} \times 0.60$ si al momento de su ciclo el SPY está alcista.

4. **Alert & Review Conditions:**
   - **Red Badge Alert:** Cuando $\text{Last Price} < \text{Stop}$, la celda se resalta con badge rojo (`bg-red-100 text-red-800 border border-red-300`).
   - **Missing SPY in MK-TOS:** Si `SPY` no está presente en MK-TOS, o falta el pico `High`, la fila pasa automáticamente a **`Review`** con aviso explicativo.

5. **Persistence, Archiving & Closed Lifecycle Rule:**
   - Tanto `max_stock_price`, `max_stock_price_date` como `weekend_trader_flag` se persisten exclusivamente mientras el trade está **`Open`**.
   - Al pasar a `Closed`, los precios máximos se reinician a `NULL`.

---

## 4. Trend Pilot

- **Strategy Identifier:** `Trend Pilot` / `TrendPilot` / `Tend Pilot` / `TendPilot`
- **Data Sources:**
  - **MK-TOS Quotes:** `trendpilot_stop` (header `TrendPilot_STOP`)
  - **Position Statement:** `stock_last` (Last Price)

### Formulas & Logic:
1. **Signal Column (before Last):**
   - Displays the indicator value extracted from `trendpilot_stop` (`TrendPilot_STOP`) when **$\ge 3$**. Otherwise displays **`'-'`**.
2. **Stop Value:**
   - Always displays the current **`Last Price`**:
     $$\text{Stop} = \text{Last Price}$$
3. **Trigger Condition ($\ge 3$):**
   - When the signal value is **$\ge 3$**:
     - The Stop value is displayed with a **red badge** (`bg-red-100 text-red-800 border border-red-300`), matching the Signal column format.
   - When the signal value is **$< 3$**:
     - The Stop cell retains standard styling (not highlighted in red).
4. **Missing MK-TOS Quote:**
   - If the symbol is not found in MK-TOS quotes, the position is marked as **`Review`** with a yellow row alert.

---

## 5. MAC (MACD)

- **Strategy Identifier:** `MAC` / `MACD`
- **Data Sources:**
  - **MK-TOS Quotes:** `mac_stop` (header `MAC_STOP`)
  - **Position Statement:** `stock_last` (Last Price)

### Formulas & Logic:
1. **Signal Column (before Last):**
   - Displays the indicator value extracted from `mac_stop` (`MAC_STOP`) when **$\ge 3$**. Otherwise displays **`'-'`**.
2. **Stop Value:**
   - Always displays the current **`Last Price`**:
     $$\text{Stop} = \text{Last Price}$$
3. **Trigger Condition ($\ge 3$):**
   - When the signal value is **$\ge 3$**:
     - The Stop value is displayed with a **red badge** (`bg-red-100 text-red-800 border border-red-300`), matching the Signal column format.
   - When the signal value is **$< 3$**:
     - The Stop cell retains standard styling (not highlighted in red).
4. **Missing MK-TOS Quote:**
   - If the symbol is not found in MK-TOS quotes, the position is marked as **`Review`** with a yellow row alert.

---

## 6. New Yearly Highs

- **Strategy Identifier:** `New Yearly Highs` / `New Yearly High` / `NewYearlyHighs`
- **Data Sources:**
  - **MK-TOS Quotes:** `low_52` (header `52Low`, 250-trading-day / 52-week minimum price)
  - **Trades Table:** `first_buy_date`, `ratchet_stop` (persisted peak stop floor)
  - **Position Statement:** `stock_last` (Last Price)

### Formulas & Logic:
1. **Ratchet Trailing Stop (Strictly Increasing / Trinquete que nunca baja):**
   - **Excel (The Closing Bell):**
     $$= \text{IF}(52\text{Low}_{t-1} \ge 52\text{Low}_t, 52\text{Low}_{t-1}, 52\text{Low}_t)$$
   - **Formula:**
     $$\text{Stop} = \max\left(\text{persisted\_ratchet\_stop}, \max_{q \in \text{Quotes}, \text{Date}_q \ge \text{first\_buy\_date}} (\text{low\_52}_q)\right)$$
   - Ensures the stop is strictly increasing (trailing): if the 52-week minimum price (`52Low`) rises, the stop rises; if it drops or fluctuates, the highest previous stop floor is preserved and never steps down.
   - Evaluates all MK-TOS quotes from `first_buy_date` to today, falling back to the current quote if no post-entry quotes exist.
2. **Persistence & Archiving Rule:**
   - The highest ratchet stop floor is persisted in the `trades.ratchet_stop` master column while the trade is `Open`, ensuring that historical MK-TOS files older than 10 quote dates can be safely archived without losing the ratcheted stop value.
3. **Trigger Condition (Red Alert):**
   - When $\text{Last Price} < \text{Stop}$ (precio de la acción cierra/cotiza por debajo del stop trinquete):
     - The Stop cell is highlighted with a **red badge** (`bg-red-100 text-red-800 border border-red-300`).
   - When $\text{Last Price} \ge \text{Stop}$:
     - The Stop cell retains standard styling.
4. **Missing MK-TOS Quote:**
   - If the symbol is not found in MK-TOS quotes or `52Low` is missing/zero, the position is marked as **`Review`** with a yellow row alert.

---

## 7. 100-day-High

- **Strategy Identifier:** `100-day-High` / `100 Day High` / `100dayhigh`
- **Data Sources:**
  - **MK-TOS Quotes:** `low_100_day` (header `100-day-Low`, minimum price over the trailing 100 trading days)
  - **Trades Table:** `first_buy_date`, `ratchet_stop` (persisted peak stop floor)
  - **Position Statement:** `stock_last` (Last Price)

### Formulas & Logic:
1. **Ratchet Trailing Stop (Strictly Increasing / Trinquete que nunca baja):**
   - **Excel (The Closing Bell):**
     $$= \text{IF}(100\text{Low}_{t-1} \ge 100\text{Low}_t, 100\text{Low}_{t-1}, 100\text{Low}_t)$$
   - **Formula:**
     $$\text{Stop} = \max\left(\text{persisted\_ratchet\_stop}, \max_{q \in \text{Quotes}, \text{Date}_q \ge \text{first\_buy\_date}} (\text{low\_100\_day}_q)\right)$$
   - Ensures the stop is strictly increasing (trailing): if the 100-day minimum price (`100-day-Low`) rises, the stop rises; if it drops or fluctuates, the highest previous stop floor is preserved and never steps down.
   - Evaluates all MK-TOS quotes from `first_buy_date` to today, falling back to the current quote if no post-entry quotes exist.
2. **Persistence & Archiving Rule:**
   - The highest ratchet stop floor is persisted in the `trades.ratchet_stop` master column while the trade is `Open`, ensuring that historical MK-TOS files older than 10 quote dates can be safely archived without losing the ratcheted stop value.
3. **Trigger Condition (Red Alert / Vender):**
   - When $\text{Last Price} < \text{Stop}$ (precio de la acción cierra o cotiza por debajo del stop trinquete de los últimos 100 días):
     - The Stop cell is highlighted with a **red badge** (`bg-red-100 text-red-800 border border-red-300`).
   - When $\text{Last Price} \ge \text{Stop}$:
     - The Stop cell retains standard styling.
4. **Missing MK-TOS Quote:**
   - If the symbol is not found in MK-TOS quotes or `100-day-Low` is missing/zero, the position is marked as **`Review`** with a yellow row alert.

---

## 8. BBO (Bollinger Bands)

- **Strategy Identifier:** `BBO` / `Bollinger Bands` / `Bollinger`
- **Data Sources:**
  - **MK-TOS Quotes:** `bollinger_bands` (header `BBO` / `BollingerBands`, representing the lower Bollinger Band configured at 1 standard deviation)
  - **Position Statement:** `stock_last` (Last Price)

### Formulas & Logic:
1. **Stop Value:**
   $$\text{Stop} = \text{quote.bollinger\_bands}$$
   Displays the lower Bollinger Band (1 standard deviation) directly from the active MK-TOS quote (`BBO`).
2. **Trigger Condition / Punto de salida (Red Alert):**
   - When $\text{Last Price} < \text{Stop}$ (el precio de la acción registra un cierre por debajo de la banda inferior configurada a 1 desviación estándar):
     - The Stop cell is highlighted with a **red badge** (`bg-red-100 text-red-800 border border-red-300`).
   - When $\text{Last Price} \ge \text{Stop}$:
     - The Stop cell retains standard styling.
3. **Missing MK-TOS Quote:**
   - If the symbol is not found in MK-TOS quotes or `bollinger_bands` is missing/zero, the position is marked as **`Review`** with a yellow row alert.

---

## 9. Hedge

- **Strategy Identifier:** `Hedge` / `hegde` / `Hedging`
- **Data Sources:**
  - **Position Statement:** `stock_last` (Last Price)
- **Formulas & Logic:**
  1. **Stop Value:**
     $$\text{Stop} = \text{Last Price}$$
     Always displays the current Last Price.
  2. **No Stop Rule / Trigger:**
     Hedge positions do not execute an automatic stop-loss exit rule. The Stop cell remains informational and will not trigger a red badge alert (`isStopRed = false`).
  3. **Missing Last Price:**
     If `Last Price` is missing or $\le 0$, the position is flagged as **`Review`**.

---

## 10. Global Review Rule (Handling '-' and Uncalculated Stops)

- **Rule:** Any position whose Stop value cannot be calculated or would otherwise display as **`'-'`** (due to any new unconfigured strategy, missing MK-TOS quotes, or missing peak prices) is automatically treated as **`Review`**.
- **Display Behavior:**
  - The Stop cell displays a **`⚠️ Review`** badge (`bg-amber-200 text-amber-900 border border-amber-400`).
  - The Stop cell has a warning background (`bg-amber-100/80 border-y border-amber-300`).
  - The row has a warning highlight (`bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-400`).
  - The row is included in the **`⚠️ Review (N)`** quick filter button count and filtered view.

---

## 11. Upcoming Strategies Roadmap

All current standard strategies (Tech Trader, Trend Pilot, MAC, 20% Flipper, Weekend Trader, New Yearly Highs, 100-day-High, BBO, and Hedge) have their Stop rules configured. Any additional strategies added to the system will be documented here.



