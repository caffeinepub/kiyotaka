# Giotaka

## Current State
- Chart page loads candle data from the backend (`getCandleData`) which returns **mock/generated** candles -- not real market data.
- Live price ticker fetches from CoinGecko free API (rate-limited, often fails).
- Backtester accepts custom JS strategy functions only; no Pine Script syntax support; no pre-built strategy templates.
- Indicators limited to: MA20, MA50, MA200, EMA9, EMA21, Bollinger Bands, Volume, RSI, MACD.

## Requested Changes (Diff)

### Add
- Real OHLCV candle data fetched directly from Binance public REST API (`https://api.binance.com/api/v3/klines`) -- no API key required, no rate-limit issues.
- Real live spot price from Binance ticker (`/api/v3/ticker/24hr`).
- Pine Script-style backtester: a dedicated tab/section where the user can write Pine Script-like code (custom JS with Pine-style API helpers: `close`, `open`, `high`, `low`, `volume`, `sma()`, `ema()`, `rsi()`, `macd()`, `crossover()`, `crossunder()`, `strategy.entry()`, `strategy.close()`) and run it live against real candle data.
- Full TradingView indicator suite cloned as toggleable overlays and sub-charts:
  - **Overlays**: SMA (custom period), EMA (custom period), VWAP, Bollinger Bands (custom), Ichimoku Cloud, Parabolic SAR, Pivot Points
  - **Oscillators / sub-charts**: RSI (14), MACD (12,26,9), Stochastic (14,3,3), ATR (14), OBV, CCI (20), Williams %R (14), MFI (14), ADX (14)
- Indicator settings panel: click an active indicator to configure its period/parameters inline.
- More crypto symbols: top 20 coins including LINK, LTC, UNI, ATOM, FIL, ICP.

### Modify
- Replace `useCandleData` hook -- stop calling `actor.getCandleData`; fetch directly from Binance REST API based on selected symbol+timeframe.
- Replace `useLivePrice` hook -- use Binance 24hr ticker instead of CoinGecko.
- Rename "Strategy Backtester" panel to "Pine Script Backtester" and expand the editor with Pine-style built-ins available via a helper library injected into the strategy context.
- Add pre-built strategy templates: RSI Overbought/Oversold, MACD Crossover, Bollinger Squeeze, EMA Crossover 9/21.
- Indicator toggle row now scrollable with two groups: Overlays and Oscillators.

### Remove
- Dependency on `actor.getCandleData` for the chart page (backend mock data no longer used for chart).
- Dependency on CoinGecko API.

## Implementation Plan
1. Add Binance API utility functions (`fetchBinanceCandles`, `fetchBinanceTicker`) that map symbol+timeframe to Binance pair format (e.g. BTC -> BTCUSDT).
2. Update `useCandleData` to call Binance klines endpoint. Map timeframes: 1m, 5m, 15m, 1h, 4h, 1d, 1w -> Binance interval strings.
3. Update `useLivePrice` to call Binance 24hr ticker.
4. Add full math library: `calcStochastic`, `calcATR`, `calcOBV`, `calcCCI`, `calcWilliamsR`, `calcMFI`, `calcADX`, `calcIchimoku`, `calcParabolicSAR`, `calcVWAP`, `calcPivotPoints`.
5. Add all new indicator toggles to the UI (grouped: Overlays | Oscillators).
6. Wire each indicator to its chart rendering (overlays on main chart, oscillators as sub-charts).
7. Add Pine Script helper library injected into backtester sandbox: `sma()`, `ema()`, `rsi()`, `macd()`, `crossover()`, `crossunder()`, `strategy.entry()`, `strategy.close()`, `strategy.long()`, `strategy.short()`.
8. Update backtester default code to use Pine-style API.
9. Add 4 pre-built strategy templates to a template picker dropdown in the backtester.
10. Expand symbol list to top 20 cryptos.
