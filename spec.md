# Kiyotaka Crypto Terminal

## Current State
Full-stack crypto trading dashboard with:
- Dashboard (Fear & Greed, Top Gainers/Losers, Watchlist, Signals feed)
- Markets page (sortable table of 10 coins with sparklines, detail sheet with RSI/MACD/MA indicators)
- Portfolio page (holdings with P&L, login required)
- Alerts page (price alerts per coin, login required)
- Signals page (admin-posted buy/sell/hold signals)
- Backend: Motoko with authorization, coin data (mock static), watchlist, holdings, alerts, signals
- No live price data, no advanced charting, no backtesting

## Requested Changes (Diff)

### Add
- **Chart Page** ("Chart" nav item): Full-screen interactive candlestick chart for BTC (and other coins selectable via dropdown)
  - Candlestick OHLCV chart using lightweight-charts (TradingView library) or recharts
  - Timeframe selector: 1m, 5m, 15m, 1h, 4h, 1D, 1W
  - Live Bitcoin price ticker (fetched via CoinGecko public API from the frontend)
  - Indicator panel: user can toggle overlays on/off
    - Moving Averages: MA20, MA50, MA200
    - Bollinger Bands
    - Volume bars
    - RSI (separate sub-chart pane)
    - MACD (separate sub-chart pane)
    - EMA 9, EMA 21
  - **Backtesting module** (panel below or side drawer):
    - User writes JavaScript strategy code in a Monaco Editor (code editor)
    - Strategy receives candle data array and must return array of `{time, action: 'buy'|'sell'}` signals
    - Backtest runs client-side: executes strategy code against historical candle data
    - Results panel: shows total return %, number of trades, win rate, max drawdown, equity curve chart
    - Buy/Sell signal markers overlaid on the main candlestick chart
- Backend: new `getCandleData(symbol: Text, timeframe: Text) -> [Candle]` endpoint returning mock OHLCV data for BTC and other coins (enough data points for backtesting, ~200 candles)
- Backend: new `Candle` type: `{ time: Int; open: Float; high: Float; low: Float; close: Float; volume: Float }`

### Modify
- Navigation: add "Chart" link between Markets and Portfolio
- Dashboard: show live BTC price fetched from CoinGecko in the header/ticker strip

### Remove
- Nothing removed

## Implementation Plan
1. Add `Candle` type and `getCandleData` function to Motoko backend returning ~200 mock OHLCV candles for BTC, ETH, SOL
2. Regenerate backend bindings
3. Install `lightweight-charts` npm package for professional candlestick rendering
4. Install `@monaco-editor/react` for the strategy code editor
5. Create `src/pages/Chart.tsx`:
   - Symbol/timeframe selectors at top
   - Live BTC price fetched from CoinGecko REST API (frontend HTTP fetch, polling every 30s)
   - Candlestick chart using lightweight-charts with indicator overlays (MA, BB, Volume, RSI pane, MACD pane)
   - Indicator toggle sidebar
   - Backtesting drawer/panel with Monaco code editor, Run Backtest button, results metrics, equity curve, trade markers on chart
6. Wire Chart page into App.tsx routing and navigation
7. Add BTC live price ticker strip to Dashboard header
