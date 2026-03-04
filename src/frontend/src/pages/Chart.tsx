import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/formatters";
import Editor from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  LineSeries,
  type SeriesMarker,
  type Time,
  createChart,
  createSeriesMarkers,
} from "lightweight-charts";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const SYMBOLS = [
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "ADA",
  "DOGE",
  "AVAX",
  "MATIC",
  "DOT",
  "LINK",
  "LTC",
  "UNI",
  "ATOM",
  "FIL",
  "ICP",
  "NEAR",
  "APT",
  "ARB",
  "OP",
];

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const TF_MAP: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1H": "1h",
  "4H": "4h",
  "1D": "1d",
  "1W": "1w",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface CandleBar {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BacktestSignal {
  time: number;
  action: "buy" | "sell";
}

interface TradeRecord {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
}

interface BacktestResult {
  totalReturn: number;
  numTrades: number;
  winRate: number;
  maxDrawdown: number;
  equityCurve: { time: number; equity: number }[];
  trades: TradeRecord[];
  markers: BacktestSignal[];
}

interface IndicatorState {
  // Overlays
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  ema9: boolean;
  ema21: boolean;
  bbands: boolean;
  vwap: boolean;
  ichimoku: boolean;
  psar: boolean;
  volume: boolean;
  // Oscillators
  rsi: boolean;
  macd: boolean;
  stoch: boolean;
  atr: boolean;
  obv: boolean;
  cci: boolean;
  williamsr: boolean;
  mfi: boolean;
  adx: boolean;
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function calcSMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return slice.reduce((s, v) => s + v, 0) / period;
  });
}

function calcEMA(data: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(data.length).fill(null);
  let ema: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    if (ema === null) {
      ema = data.slice(0, period).reduce((s, v) => s + v, 0) / period;
    } else {
      ema = data[i] * k + ema * (1 - k);
    }
    result[i] = ema;
  }
  return result;
}

function calcBBands(
  data: number[],
  period = 20,
  multiplier = 2,
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const sma = calcSMA(data, period);
  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];
  data.forEach((_, i) => {
    if (sma[i] === null) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
      return;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const mean = sma[i]!;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const stddev = Math.sqrt(variance);
    upper.push(mean + multiplier * stddev);
    middle.push(mean);
    lower.push(mean - multiplier * stddev);
  });
  return { upper, middle, lower };
}

function calcVWAP(candles: CandleBar[]): number[] {
  let cumPV = 0;
  let cumVol = 0;
  return candles.map((c) => {
    const tp = (c.high + c.low + c.close) / 3;
    cumPV += tp * c.volume;
    cumVol += c.volume;
    return cumVol === 0 ? c.close : cumPV / cumVol;
  });
}

function calcIchimoku(candles: CandleBar[]): {
  tenkan: (number | null)[];
  kijun: (number | null)[];
  senkouA: (number | null)[];
  senkouB: (number | null)[];
  chikou: (number | null)[];
} {
  const n = candles.length;
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const periodHigh = (arr: number[], i: number, p: number) =>
    Math.max(...arr.slice(Math.max(0, i - p + 1), i + 1));
  const periodLow = (_arr: number[], i: number, p: number) =>
    Math.min(...lows.slice(Math.max(0, i - p + 1), i + 1));

  const tenkan: (number | null)[] = [];
  const kijun: (number | null)[] = [];
  const senkouA: (number | null)[] = [];
  const senkouB: (number | null)[] = [];
  const chikou: (number | null)[] = [];

  for (let i = 0; i < n; i++) {
    const t =
      i >= 8 ? (periodHigh(highs, i, 9) + periodLow(lows, i, 9)) / 2 : null;
    const k =
      i >= 25 ? (periodHigh(highs, i, 26) + periodLow(lows, i, 26)) / 2 : null;
    tenkan.push(t);
    kijun.push(k);

    // Senkou A & B projected 26 bars forward (stored at i+26)
    if (i + 26 < n) {
      senkouA[i + 26] = t !== null && k !== null ? (t + k) / 2 : null;
      const sb =
        i >= 51
          ? (periodHigh(highs, i, 52) + periodLow(lows, i, 52)) / 2
          : null;
      senkouB[i + 26] = sb;
    }

    // Chikou span = close plotted 26 bars back
    if (i >= 26) {
      chikou[i - 26] = candles[i].close;
    }
  }

  // Fill null gaps in senkouA and senkouB
  for (let i = 0; i < n; i++) {
    if (senkouA[i] === undefined) senkouA[i] = null;
    if (senkouB[i] === undefined) senkouB[i] = null;
    if (chikou[i] === undefined) chikou[i] = null;
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

function calcParabolicSAR(
  candles: CandleBar[],
  step = 0.02,
  max = 0.2,
): (number | null)[] {
  if (candles.length < 2) return new Array(candles.length).fill(null);
  const result: (number | null)[] = new Array(candles.length).fill(null);
  let bull = true;
  let af = step;
  let ep = candles[0].high;
  let sar = candles[0].low;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];

    if (bull) {
      sar = sar + af * (ep - sar);
      sar = Math.min(sar, prev.low, i > 1 ? candles[i - 2].low : prev.low);
      if (curr.low < sar) {
        bull = false;
        sar = ep;
        ep = curr.low;
        af = step;
      } else {
        if (curr.high > ep) {
          ep = curr.high;
          af = Math.min(af + step, max);
        }
      }
    } else {
      sar = sar + af * (ep - sar);
      sar = Math.max(sar, prev.high, i > 1 ? candles[i - 2].high : prev.high);
      if (curr.high > sar) {
        bull = true;
        sar = ep;
        ep = curr.high;
        af = step;
      } else {
        if (curr.low < ep) {
          ep = curr.low;
          af = Math.min(af + step, max);
        }
      }
    }
    result[i] = sar;
  }
  return result;
}

function calcRSI(data: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (data.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < data.length; i++) {
    if (i > period) {
      const diff = data[i] - data[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rs);
  }
  return result;
}

function calcMACD(
  data: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);
  const macdLine = emaFast.map((v, i) =>
    v !== null && emaSlow[i] !== null ? v - emaSlow[i]! : null,
  );
  const macdValues = macdLine.filter((v): v is number => v !== null);
  const signalRaw = calcEMA(macdValues, signal);
  const signalLine: (number | null)[] = new Array(data.length).fill(null);
  let rawIdx = 0;
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] !== null) {
      signalLine[i] = signalRaw[rawIdx] ?? null;
      rawIdx++;
    }
  }
  const histogram = macdLine.map((v, i) =>
    v !== null && signalLine[i] !== null ? v - signalLine[i]! : null,
  );
  return { macd: macdLine, signal: signalLine, histogram };
}

function calcStochastic(
  candles: CandleBar[],
  kPeriod = 14,
  dPeriod = 3,
): { k: (number | null)[]; d: (number | null)[] } {
  const n = candles.length;
  const kLine: (number | null)[] = new Array(n).fill(null);
  for (let i = kPeriod - 1; i < n; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...slice.map((c) => c.high));
    const lowest = Math.min(...slice.map((c) => c.low));
    kLine[i] =
      highest === lowest
        ? 50
        : ((candles[i].close - lowest) / (highest - lowest)) * 100;
  }
  const kValues = kLine.filter((v): v is number => v !== null);
  const dRaw = calcSMA(kValues, dPeriod);
  const dLine: (number | null)[] = new Array(n).fill(null);
  let rawIdx = 0;
  for (let i = 0; i < n; i++) {
    if (kLine[i] !== null) {
      dLine[i] = dRaw[rawIdx] ?? null;
      rawIdx++;
    }
  }
  return { k: kLine, d: dLine };
}

function calcATR(candles: CandleBar[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < 2) return result;
  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].close;
    tr.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - prevClose),
        Math.abs(candles[i].low - prevClose),
      ),
    );
  }
  let atr = tr.slice(0, period).reduce((s, v) => s + v, 0) / period;
  result[period - 1] = atr;
  for (let i = period; i < candles.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    result[i] = atr;
  }
  return result;
}

function calcOBV(candles: CandleBar[]): number[] {
  const result: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) {
      result.push(result[i - 1] + candles[i].volume);
    } else if (candles[i].close < candles[i - 1].close) {
      result.push(result[i - 1] - candles[i].volume);
    } else {
      result.push(result[i - 1]);
    }
  }
  return result;
}

function calcCCI(candles: CandleBar[], period = 20): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const tps = slice.map((c) => (c.high + c.low + c.close) / 3);
    const mean = tps.reduce((s, v) => s + v, 0) / period;
    const meanDev = tps.reduce((s, v) => s + Math.abs(v - mean), 0) / period;
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    result[i] = meanDev === 0 ? 0 : (tp - mean) / (0.015 * meanDev);
  }
  return result;
}

function calcWilliamsR(candles: CandleBar[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const highest = Math.max(...slice.map((c) => c.high));
    const lowest = Math.min(...slice.map((c) => c.low));
    result[i] =
      highest === lowest
        ? -50
        : ((highest - candles[i].close) / (highest - lowest)) * -100;
  }
  return result;
}

function calcMFI(candles: CandleBar[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = period; i < candles.length; i++) {
    let posFlow = 0;
    let negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const tp = (candles[j].high + candles[j].low + candles[j].close) / 3;
      const prevTp =
        j > 0
          ? (candles[j - 1].high + candles[j - 1].low + candles[j - 1].close) /
            3
          : tp;
      const mf = tp * candles[j].volume;
      if (tp > prevTp) posFlow += mf;
      else negFlow += mf;
    }
    const ratio = negFlow === 0 ? 100 : posFlow / negFlow;
    result[i] = 100 - 100 / (1 + ratio);
  }
  return result;
}

function calcADX(
  candles: CandleBar[],
  period = 14,
): {
  adx: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
} {
  const n = candles.length;
  const adxArr: (number | null)[] = new Array(n).fill(null);
  const plusDIArr: (number | null)[] = new Array(n).fill(null);
  const minusDIArr: (number | null)[] = new Array(n).fill(null);
  if (n < period + 1)
    return { adx: adxArr, plusDI: plusDIArr, minusDI: minusDIArr };

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < n; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;
    const prevClose = candles[i - 1].close;
    tr.push(
      Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose),
      ),
    );
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  let smoothTR = tr.slice(0, period).reduce((s, v) => s + v, 0);
  let smoothPlus = plusDM.slice(0, period).reduce((s, v) => s + v, 0);
  let smoothMinus = minusDM.slice(0, period).reduce((s, v) => s + v, 0);

  const dxArr: number[] = [];
  for (let i = period; i < tr.length; i++) {
    smoothTR = smoothTR - smoothTR / period + tr[i];
    smoothPlus = smoothPlus - smoothPlus / period + plusDM[i];
    smoothMinus = smoothMinus - smoothMinus / period + minusDM[i];
    const pDI = smoothTR === 0 ? 0 : (smoothPlus / smoothTR) * 100;
    const mDI = smoothTR === 0 ? 0 : (smoothMinus / smoothTR) * 100;
    plusDIArr[i + 1] = pDI;
    minusDIArr[i + 1] = mDI;
    const dx = pDI + mDI === 0 ? 0 : (Math.abs(pDI - mDI) / (pDI + mDI)) * 100;
    dxArr.push(dx);
  }

  if (dxArr.length >= period) {
    let adx = dxArr.slice(0, period).reduce((s, v) => s + v, 0) / period;
    adxArr[period * 2] = adx;
    for (let i = period; i < dxArr.length; i++) {
      adx = (adx * (period - 1) + dxArr[i]) / period;
      adxArr[i + period + 1] = adx;
    }
  }

  return { adx: adxArr, plusDI: plusDIArr, minusDI: minusDIArr };
}

// ─── Pine-style strategy templates ────────────────────────────────────────────

const STRATEGY_TEMPLATES: Record<string, { name: string; code: string }> = {
  "ema-rsi": {
    name: "EMA Cross + RSI",
    code: `// Pine Script-style strategy
// Available: pine.close, pine.open, pine.high, pine.low, pine.volume
// pine.sma(src, period), pine.ema(src, period), pine.rsi(src, period)
// pine.crossover(s1, s2, i), pine.crossunder(s1, s2, i)
// strategy.entry(name, direction, index), strategy.close(name, index)

function strategy(candles, pine, strategy) {
  const close = pine.close;
  const rsi = pine.rsi(close, 14);
  const ema9 = pine.ema(close, 9);
  const ema21 = pine.ema(close, 21);

  for (let i = 1; i < candles.length; i++) {
    if (!rsi[i] || !ema9[i] || !ema21[i]) continue;
    
    // Buy: EMA crossover + RSI not overbought
    if (pine.crossover(ema9, ema21, i) && rsi[i] < 70) {
      strategy.entry('Long', strategy.long, i);
    }
    // Sell: EMA crossunder or RSI overbought
    else if (pine.crossunder(ema9, ema21, i) || rsi[i] > 75) {
      strategy.close('Long', i);
    }
  }
  return strategy.entries;
}`,
  },
  "rsi-ob-os": {
    name: "RSI Overbought/Oversold",
    code: `// RSI mean reversion strategy
// Buy on RSI crossing above 30 (oversold recovery)
// Sell on RSI crossing below 70 (overbought exit)

function strategy(candles, pine, strategy) {
  const close = pine.close;
  const rsi = pine.rsi(close, 14);

  for (let i = 1; i < candles.length; i++) {
    if (!rsi[i] || !rsi[i - 1]) continue;

    // RSI crossing above 30 - oversold recovery
    if (rsi[i] > 30 && rsi[i - 1] <= 30) {
      strategy.entry('Long', strategy.long, i);
    }
    // RSI crossing below 70 - overbought exit
    else if (rsi[i] < 70 && rsi[i - 1] >= 70) {
      strategy.close('Long', i);
    }
  }
  return strategy.entries;
}`,
  },
  "macd-cross": {
    name: "MACD Crossover",
    code: `// MACD crossover strategy
// Buy when MACD line crosses above signal line
// Sell when MACD line crosses below signal line

function strategy(candles, pine, strategy) {
  const close = pine.close;
  const { macd, signal } = pine.macd(close, 12, 26, 9);

  for (let i = 1; i < candles.length; i++) {
    if (!macd[i] || !signal[i] || !macd[i-1] || !signal[i-1]) continue;

    // MACD line crosses above signal
    if (pine.crossover(macd, signal, i)) {
      strategy.entry('Long', strategy.long, i);
    }
    // MACD line crosses below signal
    else if (pine.crossunder(macd, signal, i)) {
      strategy.close('Long', i);
    }
  }
  return strategy.entries;
}`,
  },
  "bb-squeeze": {
    name: "Bollinger Squeeze",
    code: `// Bollinger Band squeeze breakout strategy
// Detects compression (squeeze) and trades the breakout direction

function strategy(candles, pine, strategy) {
  const close = pine.close;
  const sma20 = pine.sma(close, 20);
  const ema9 = pine.ema(close, 9);

  for (let i = 21; i < candles.length; i++) {
    if (!sma20[i] || !ema9[i]) continue;

    const slice = close.slice(i - 20, i);
    const mean = slice.reduce((s, v) => s + v, 0) / 20;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / 20);
    const upper = mean + 2 * std;
    const lower = mean - 2 * std;
    const bandwidth = (upper - lower) / mean;

    // Low bandwidth indicates squeeze
    const isSqueezing = bandwidth < 0.04;

    // Breakout above upper band after squeeze
    if (!isSqueezing && close[i] > upper && close[i - 1] <= upper) {
      strategy.entry('Long', strategy.long, i);
    }
    // Breakout below lower band
    else if (!isSqueezing && close[i] < lower && close[i - 1] >= lower) {
      strategy.close('Long', i);
    }
  }
  return strategy.entries;
}`,
  },
};

// ─── Backtesting engine ───────────────────────────────────────────────────────

function runBacktest(
  candles: CandleBar[],
  strategyCode: string,
): BacktestResult {
  const candlesPlain = candles.map((c) => ({
    time: Number(c.time),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));

  const closes = candlesPlain.map((c) => c.close);
  const opens = candlesPlain.map((c) => c.open);
  const highs = candlesPlain.map((c) => c.high);
  const lows = candlesPlain.map((c) => c.low);
  const volumes = candlesPlain.map((c) => c.volume);

  const pine = {
    close: closes,
    open: opens,
    high: highs,
    low: lows,
    volume: volumes,
    sma: (src: number[], period: number) => calcSMA(src, period),
    ema: (src: number[], period: number) => calcEMA(src, period),
    rsi: (src: number[], period: number) => calcRSI(src, period),
    macd: (src: number[], fast = 12, slow = 26, sig = 9) =>
      calcMACD(src, fast, slow, sig),
    stoch: (kPeriod: number, dPeriod: number) =>
      calcStochastic(candles, kPeriod, dPeriod),
    atr: (period: number) => calcATR(candles, period),
    crossover: (
      series1: (number | null)[],
      series2: (number | null)[],
      i: number,
    ) =>
      (series1[i] ?? 0) > (series2[i] ?? 0) &&
      (series1[i - 1] ?? 0) <= (series2[i - 1] ?? 0),
    crossunder: (
      series1: (number | null)[],
      series2: (number | null)[],
      i: number,
    ) =>
      (series1[i] ?? 0) < (series2[i] ?? 0) &&
      (series1[i - 1] ?? 0) >= (series2[i - 1] ?? 0),
    highest: (src: number[], period: number, i: number) =>
      Math.max(...src.slice(Math.max(0, i - period + 1), i + 1)),
    lowest: (src: number[], period: number, i: number) =>
      Math.min(...src.slice(Math.max(0, i - period + 1), i + 1)),
  };

  const strategyObj = {
    entries: [] as BacktestSignal[],
    entry: (_name: string, direction: string, i: number) => {
      strategyObj.entries.push({
        time: candlesPlain[i].time,
        action: direction === "long" ? "buy" : "sell",
      });
    },
    close: (_name: string, i: number) => {
      strategyObj.entries.push({ time: candlesPlain[i].time, action: "sell" });
    },
    long: "long",
    short: "short",
  };

  // Support both old and new strategy signatures
  const fn = new Function(
    "candles",
    "pine",
    "strategy",
    `${strategyCode}\nreturn typeof strategy === 'function' ? strategy(candles, pine, strategy) : [];`,
  );

  const rawSignals: BacktestSignal[] =
    fn(candlesPlain, pine, strategyObj) ?? strategyObj.entries;

  let capital = 10_000;
  let holdings = 0;
  let entryPrice = 0;
  let entryTime = 0;
  const trades: TradeRecord[] = [];
  const equityCurve: { time: number; equity: number }[] = [
    { time: Number(candles[0]?.time ?? 0), equity: capital },
  ];
  let peakEquity = capital;
  let maxDrawdown = 0;

  const priceMap = new Map<number, number>();
  for (const c of candles) {
    priceMap.set(Number(c.time), c.close);
  }

  for (const sig of rawSignals) {
    const price = priceMap.get(sig.time);
    if (!price) continue;

    if (sig.action === "buy" && holdings === 0) {
      holdings = capital / price;
      entryPrice = price;
      entryTime = sig.time;
    } else if (sig.action === "sell" && holdings > 0) {
      const exitPrice = price;
      const pnl = (exitPrice - entryPrice) * holdings;
      const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;
      capital = holdings * exitPrice;
      trades.push({
        entryTime,
        exitTime: sig.time,
        entryPrice,
        exitPrice,
        pnl,
        pnlPct,
      });
      holdings = 0;
      equityCurve.push({ time: sig.time, equity: capital });
      if (capital > peakEquity) peakEquity = capital;
      const drawdown = ((peakEquity - capital) / peakEquity) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
  }

  if (holdings > 0) {
    const lastCandle = candles[candles.length - 1];
    const exitPrice = lastCandle.close;
    const pnl = (exitPrice - entryPrice) * holdings;
    const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;
    capital = holdings * exitPrice;
    trades.push({
      entryTime,
      exitTime: Number(lastCandle.time),
      entryPrice,
      exitPrice,
      pnl,
      pnlPct,
    });
    equityCurve.push({ time: Number(lastCandle.time), equity: capital });
    const drawdown = ((peakEquity - capital) / peakEquity) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const totalReturn = ((capital - 10_000) / 10_000) * 100;
  const wins = trades.filter((t) => t.pnlPct > 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  return {
    totalReturn,
    numTrades: trades.length,
    winRate,
    maxDrawdown,
    equityCurve,
    trades,
    markers: rawSignals,
  };
}

// ─── Equity Curve Chart ───────────────────────────────────────────────────────

function EquityCurveChart({
  curve,
}: { curve: { time: number; equity: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || curve.length === 0) return;
    const container = containerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 120,
      layout: {
        background: { type: ColorType.Solid, color: "#0d0e14" },
        textColor: "rgba(145,152,170,0.9)",
      },
      grid: {
        vertLines: { color: "rgba(42,46,57,0.3)" },
        horzLines: { color: "rgba(42,46,57,0.3)" },
      },
      timeScale: {
        borderColor: "rgba(42,46,57,0.9)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: "rgba(42,46,57,0.9)" },
      crosshair: { mode: CrosshairMode.Magnet },
    });

    const series = chart.addSeries(LineSeries, {
      color: "#00e5ff",
      lineWidth: 2,
    });
    series.setData(
      curve.map((p) => ({ time: p.time as Time, value: p.equity })),
    );
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current)
        chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [curve]);

  return <div ref={containerRef} className="w-full h-[120px]" />;
}

// ─── Indicator toggle button ──────────────────────────────────────────────────

function IndicatorToggle({
  label,
  color,
  active,
  onClick,
  ocid,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  ocid: string;
}) {
  return (
    <button
      type="button"
      data-ocid={ocid}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono font-medium transition-all border flex-shrink-0 ${
        active
          ? "border-transparent text-black"
          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground bg-transparent"
      }`}
      style={active ? { background: color, borderColor: color } : {}}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color, opacity: active ? 1 : 0.5 }}
      />
      {label}
    </button>
  );
}

// ─── Binance data hooks ────────────────────────────────────────────────────────

function useBinancePrice(symbol: string) {
  const pair = `${symbol}USDT`;
  return useQuery({
    queryKey: ["binancePrice", symbol],
    queryFn: async () => {
      const res = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`,
      );
      if (!res.ok) throw new Error("Binance price fetch failed");
      const data = await res.json();
      return {
        price: Number.parseFloat(data.lastPrice),
        change24h: Number.parseFloat(data.priceChangePercent),
      };
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: 3,
  });
}

function useBinanceCandles(symbol: string, timeframe: Timeframe) {
  const pair = `${symbol}USDT`;
  const interval = TF_MAP[timeframe];
  return useQuery<CandleBar[]>({
    queryKey: ["binanceCandles", symbol, timeframe],
    queryFn: async () => {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=500`,
      );
      if (!res.ok) throw new Error("Binance candle fetch failed");
      const data: (string | number)[][] = await res.json();
      return data.map((k) => ({
        time: (Number(k[0]) / 1000) as Time,
        open: Number.parseFloat(k[1] as string),
        high: Number.parseFloat(k[2] as string),
        low: Number.parseFloat(k[3] as string),
        close: Number.parseFloat(k[4] as string),
        volume: Number.parseFloat(k[5] as string),
      }));
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
    retry: 3,
  });
}

// ─── Sub-chart factory ─────────────────────────────────────────────────────────

function createSubChart(container: HTMLDivElement): IChartApi {
  return createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight,
    layout: {
      background: { type: ColorType.Solid, color: "#09090d" },
      textColor: "rgba(145,152,170,0.9)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 11,
    },
    grid: {
      vertLines: { color: "rgba(42,46,57,0.3)" },
      horzLines: { color: "rgba(42,46,57,0.3)" },
    },
    crosshair: { mode: CrosshairMode.Magnet },
    timeScale: {
      borderColor: "rgba(42,46,57,0.9)",
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: { borderColor: "rgba(42,46,57,0.9)" },
  });
}

// ─── Sub-chart component ────────────────────────────────────────────────────────

function SubChart({
  label,
  candles,
  renderFn,
}: {
  label: string;
  candles: CandleBar[];
  renderFn: (chart: IChartApi, candles: CandleBar[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    const container = containerRef.current;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createSubChart(container);
    chartRef.current = chart;
    renderFn(chart, candles);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, renderFn]);

  return (
    <div className="h-[22%] min-h-[80px] border-t border-border/40 relative flex-shrink-0">
      <div className="absolute top-1 left-3 z-10">
        <span className="text-[10px] font-mono text-muted-foreground/50 bg-background/80 px-1 rounded">
          {label}
        </span>
      </div>
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: "#09090d" }}
      />
    </div>
  );
}

// ─── Oscillator render functions ───────────────────────────────────────────────

function renderRSI(chart: IChartApi, candles: CandleBar[]) {
  const closes = candles.map((c) => c.close);
  const rsiValues = calcRSI(closes);
  const rsiSeries = chart.addSeries(LineSeries, {
    color: "#a855f7",
    lineWidth: 2,
  });
  rsiSeries.setData(
    candles
      .map((c, i) => ({ time: c.time, value: rsiValues[i]! }))
      .filter((d) => d.value != null),
  );
  // Bands
  const first = candles[0].time;
  const last = candles[candles.length - 1].time;
  const ob = chart.addSeries(LineSeries, {
    color: "rgba(244,80,58,0.35)",
    lineWidth: 1,
    lineStyle: 2,
  });
  const os = chart.addSeries(LineSeries, {
    color: "rgba(34,211,122,0.35)",
    lineWidth: 1,
    lineStyle: 2,
  });
  ob.setData([
    { time: first, value: 70 },
    { time: last, value: 70 },
  ]);
  os.setData([
    { time: first, value: 30 },
    { time: last, value: 30 },
  ]);
}

function renderMACD(chart: IChartApi, candles: CandleBar[]) {
  const closes = candles.map((c) => c.close);
  const { macd, signal, histogram } = calcMACD(closes);
  const histSeries = chart.addSeries(HistogramSeries, {
    color: "rgba(96,165,250,0.5)",
  });
  histSeries.setData(
    candles
      .map((c, i) => ({
        time: c.time,
        value: histogram[i]!,
        color:
          (histogram[i] ?? 0) >= 0
            ? "rgba(34,211,122,0.5)"
            : "rgba(244,80,58,0.5)",
      }))
      .filter((d) => d.value != null),
  );
  const macdS = chart.addSeries(LineSeries, { color: "#60a5fa", lineWidth: 2 });
  macdS.setData(
    candles
      .map((c, i) => ({ time: c.time, value: macd[i]! }))
      .filter((d) => d.value != null),
  );
  const sigS = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 2 });
  sigS.setData(
    candles
      .map((c, i) => ({ time: c.time, value: signal[i]! }))
      .filter((d) => d.value != null),
  );
}

function renderStoch(chart: IChartApi, candles: CandleBar[]) {
  const { k, d } = calcStochastic(candles);
  const kS = chart.addSeries(LineSeries, { color: "#60a5fa", lineWidth: 2 });
  kS.setData(
    candles
      .map((c, i) => ({ time: c.time, value: k[i]! }))
      .filter((d) => d.value != null),
  );
  const dS = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 2 });
  dS.setData(
    candles
      .map((c, i) => ({ time: c.time, value: d[i]! }))
      .filter((d) => d.value != null),
  );
  const first = candles[0].time;
  const last = candles[candles.length - 1].time;
  const ob = chart.addSeries(LineSeries, {
    color: "rgba(244,80,58,0.3)",
    lineWidth: 1,
    lineStyle: 2,
  });
  const os = chart.addSeries(LineSeries, {
    color: "rgba(34,211,122,0.3)",
    lineWidth: 1,
    lineStyle: 2,
  });
  ob.setData([
    { time: first, value: 80 },
    { time: last, value: 80 },
  ]);
  os.setData([
    { time: first, value: 20 },
    { time: last, value: 20 },
  ]);
}

function renderATR(chart: IChartApi, candles: CandleBar[]) {
  const atr = calcATR(candles);
  const s = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 2 });
  s.setData(
    candles
      .map((c, i) => ({ time: c.time, value: atr[i]! }))
      .filter((d) => d.value != null),
  );
}

function renderOBV(chart: IChartApi, candles: CandleBar[]) {
  const obv = calcOBV(candles);
  const s = chart.addSeries(LineSeries, { color: "#06b6d4", lineWidth: 2 });
  s.setData(candles.map((c, i) => ({ time: c.time, value: obv[i] })));
}

function renderCCI(chart: IChartApi, candles: CandleBar[]) {
  const cci = calcCCI(candles);
  const s = chart.addSeries(LineSeries, { color: "#ec4899", lineWidth: 2 });
  s.setData(
    candles
      .map((c, i) => ({ time: c.time, value: cci[i]! }))
      .filter((d) => d.value != null),
  );
  const first = candles[0].time;
  const last = candles[candles.length - 1].time;
  const up = chart.addSeries(LineSeries, {
    color: "rgba(244,80,58,0.3)",
    lineWidth: 1,
    lineStyle: 2,
  });
  const dn = chart.addSeries(LineSeries, {
    color: "rgba(34,211,122,0.3)",
    lineWidth: 1,
    lineStyle: 2,
  });
  up.setData([
    { time: first, value: 100 },
    { time: last, value: 100 },
  ]);
  dn.setData([
    { time: first, value: -100 },
    { time: last, value: -100 },
  ]);
}

function renderWilliamsR(chart: IChartApi, candles: CandleBar[]) {
  const wr = calcWilliamsR(candles);
  const s = chart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 2 });
  s.setData(
    candles
      .map((c, i) => ({ time: c.time, value: wr[i]! }))
      .filter((d) => d.value != null),
  );
  const first = candles[0].time;
  const last = candles[candles.length - 1].time;
  const ob = chart.addSeries(LineSeries, {
    color: "rgba(244,80,58,0.3)",
    lineWidth: 1,
    lineStyle: 2,
  });
  const os = chart.addSeries(LineSeries, {
    color: "rgba(34,211,122,0.3)",
    lineWidth: 1,
    lineStyle: 2,
  });
  ob.setData([
    { time: first, value: -20 },
    { time: last, value: -20 },
  ]);
  os.setData([
    { time: first, value: -80 },
    { time: last, value: -80 },
  ]);
}

function renderMFI(chart: IChartApi, candles: CandleBar[]) {
  const mfi = calcMFI(candles);
  const s = chart.addSeries(LineSeries, { color: "#10b981", lineWidth: 2 });
  s.setData(
    candles
      .map((c, i) => ({ time: c.time, value: mfi[i]! }))
      .filter((d) => d.value != null),
  );
  const first = candles[0].time;
  const last = candles[candles.length - 1].time;
  const ob = chart.addSeries(LineSeries, {
    color: "rgba(244,80,58,0.3)",
    lineWidth: 1,
    lineStyle: 2,
  });
  const os = chart.addSeries(LineSeries, {
    color: "rgba(34,211,122,0.3)",
    lineWidth: 1,
    lineStyle: 2,
  });
  ob.setData([
    { time: first, value: 80 },
    { time: last, value: 80 },
  ]);
  os.setData([
    { time: first, value: 20 },
    { time: last, value: 20 },
  ]);
}

function renderADX(chart: IChartApi, candles: CandleBar[]) {
  const { adx, plusDI, minusDI } = calcADX(candles);
  const adxS = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 2 });
  adxS.setData(
    candles
      .map((c, i) => ({ time: c.time, value: adx[i]! }))
      .filter((d) => d.value != null),
  );
  const pS = chart.addSeries(LineSeries, { color: "#22c55e", lineWidth: 1 });
  pS.setData(
    candles
      .map((c, i) => ({ time: c.time, value: plusDI[i]! }))
      .filter((d) => d.value != null),
  );
  const mS = chart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 1 });
  mS.setData(
    candles
      .map((c, i) => ({ time: c.time, value: minusDI[i]! }))
      .filter((d) => d.value != null),
  );
}

// ─── Types for chart refs ──────────────────────────────────────────────────────

type AnySeriesApi = ISeriesApi<"Candlestick" | "Line" | "Histogram">;

interface ChartRefs {
  chart: IChartApi | null;
  candle: ISeriesApi<"Candlestick"> | null;
  overlays: AnySeriesApi[];
  markers: ISeriesMarkersPluginApi<Time> | null;
}

// ─── Main Chart Page ──────────────────────────────────────────────────────────

export function Chart() {
  const [symbol, setSymbol] = useState("BTC");
  const [timeframe, setTimeframe] = useState<Timeframe>("1H");
  const [indicators, setIndicators] = useState<IndicatorState>({
    sma20: false,
    sma50: false,
    sma200: false,
    ema9: false,
    ema21: false,
    bbands: false,
    vwap: false,
    ichimoku: false,
    psar: false,
    volume: true,
    rsi: false,
    macd: false,
    stoch: false,
    atr: false,
    obv: false,
    cci: false,
    williamsr: false,
    mfi: false,
    adx: false,
  });
  const [backtestOpen, setBacktestOpen] = useState(false);
  const [strategyCode, setStrategyCode] = useState(
    STRATEGY_TEMPLATES["ema-rsi"].code,
  );
  const [selectedTemplate, setSelectedTemplate] = useState("ema-rsi");
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(
    null,
  );
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [backtestRunning, setBacktestRunning] = useState(false);

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const mainRefs = useRef<ChartRefs>({
    chart: null,
    candle: null,
    overlays: [],
    markers: null,
  });

  const { data: priceData, isLoading: priceLoading } = useBinancePrice(symbol);

  const {
    data: candles = [],
    isLoading: candlesLoading,
    isError: candlesError,
    refetch: refetchCandles,
  } = useBinanceCandles(symbol, timeframe);

  const closes = useMemo(() => candles.map((c) => c.close), [candles]);

  const toggleIndicator = useCallback((key: keyof IndicatorState) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Handle template change ────────────────────────────────────────────────
  const handleTemplateChange = useCallback((value: string) => {
    setSelectedTemplate(value);
    setStrategyCode(STRATEGY_TEMPLATES[value]?.code ?? "");
    setBacktestResult(null);
    setBacktestError(null);
  }, []);

  // ── Build/destroy main chart ──────────────────────────────────────────────
  useEffect(() => {
    if (!mainContainerRef.current) return;
    const container = mainContainerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#0d0e14" },
        textColor: "rgba(145,152,170,0.9)",
        fontFamily: "Geist Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(42,46,57,0.5)" },
        horzLines: { color: "rgba(42,46,57,0.5)" },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      timeScale: {
        borderColor: "rgba(42,46,57,0.9)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: "rgba(42,46,57,0.9)" },
    });
    mainRefs.current.chart = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22d37a",
      downColor: "#f4503a",
      borderUpColor: "#22d37a",
      borderDownColor: "#f4503a",
      wickUpColor: "#22d37a",
      wickDownColor: "#f4503a",
    });
    mainRefs.current.candle = candleSeries;
    mainRefs.current.markers = createSeriesMarkers(candleSeries);

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      mainRefs.current = {
        chart: null,
        candle: null,
        overlays: [],
        markers: null,
      };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Set candle data ───────────────────────────────────────────────────────
  useEffect(() => {
    const series = mainRefs.current.candle;
    if (!series || candles.length === 0) return;
    series.setData(candles);
    mainRefs.current.chart?.timeScale().fitContent();
  }, [candles]);

  // ── Overlay indicators ────────────────────────────────────────────────────
  useEffect(() => {
    const chart = mainRefs.current.chart;
    if (!chart || candles.length === 0) return;

    for (const s of mainRefs.current.overlays) {
      try {
        chart.removeSeries(s);
      } catch {
        /* ignore */
      }
    }
    mainRefs.current.overlays = [];

    const addLine = (
      color: string,
      width: number,
      data: { time: Time; value: number }[],
    ) => {
      const s = chart.addSeries(LineSeries, {
        color,
        lineWidth: width as 1 | 2 | 3 | 4,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(data.filter((d) => d.value != null && !Number.isNaN(d.value)));
      mainRefs.current.overlays.push(s as AnySeriesApi);
      return s;
    };

    // Volume
    if (indicators.volume) {
      const vs = chart.addSeries(HistogramSeries, {
        color: "rgba(42,46,57,0.5)",
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.75, bottom: 0 },
        borderColor: "rgba(42,46,57,0.9)",
      });
      vs.setData(
        candles.map((c) => ({
          time: c.time,
          value: c.volume,
          color:
            c.close >= c.open
              ? "rgba(34,211,122,0.35)"
              : "rgba(244,80,58,0.35)",
        })),
      );
      mainRefs.current.overlays.push(vs as AnySeriesApi);
    }

    // SMAs
    if (indicators.sma20) {
      addLine(
        "#eab308",
        1,
        candles.map((c, i) => ({
          time: c.time,
          value: calcSMA(closes, 20)[i]!,
        })),
      );
    }
    if (indicators.sma50) {
      addLine(
        "#60a5fa",
        1,
        candles.map((c, i) => ({
          time: c.time,
          value: calcSMA(closes, 50)[i]!,
        })),
      );
    }
    if (indicators.sma200) {
      addLine(
        "#f4503a",
        1,
        candles.map((c, i) => ({
          time: c.time,
          value: calcSMA(closes, 200)[i]!,
        })),
      );
    }

    // EMAs
    if (indicators.ema9) {
      addLine(
        "#22d37a",
        1,
        candles.map((c, i) => ({
          time: c.time,
          value: calcEMA(closes, 9)[i]!,
        })),
      );
    }
    if (indicators.ema21) {
      addLine(
        "#f97316",
        1,
        candles.map((c, i) => ({
          time: c.time,
          value: calcEMA(closes, 21)[i]!,
        })),
      );
    }

    // Bollinger Bands
    if (indicators.bbands) {
      const { upper, middle, lower } = calcBBands(closes);
      addLine(
        "rgba(168,85,247,0.8)",
        1,
        candles.map((c, i) => ({ time: c.time, value: upper[i]! })),
      );
      addLine(
        "rgba(168,85,247,0.4)",
        1,
        candles.map((c, i) => ({ time: c.time, value: middle[i]! })),
      );
      addLine(
        "rgba(168,85,247,0.8)",
        1,
        candles.map((c, i) => ({ time: c.time, value: lower[i]! })),
      );
    }

    // VWAP
    if (indicators.vwap) {
      const vwap = calcVWAP(candles);
      addLine(
        "#00e5ff",
        2,
        candles.map((c, i) => ({ time: c.time, value: vwap[i] })),
      );
    }

    // Ichimoku
    if (indicators.ichimoku) {
      const { tenkan, kijun, senkouA, senkouB, chikou } = calcIchimoku(candles);
      addLine(
        "#e11d48",
        1,
        candles.map((c, i) => ({ time: c.time, value: tenkan[i]! })),
      );
      addLine(
        "#3b82f6",
        1,
        candles.map((c, i) => ({ time: c.time, value: kijun[i]! })),
      );
      addLine(
        "rgba(34,197,94,0.6)",
        1,
        candles.map((c, i) => ({ time: c.time, value: senkouA[i]! })),
      );
      addLine(
        "rgba(239,68,68,0.6)",
        1,
        candles.map((c, i) => ({ time: c.time, value: senkouB[i]! })),
      );
      addLine(
        "rgba(234,179,8,0.5)",
        1,
        candles.map((c, i) => ({ time: c.time, value: chikou[i]! })),
      );
    }

    // Parabolic SAR
    if (indicators.psar) {
      const psar = calcParabolicSAR(candles);
      const sarSeries = chart.addSeries(LineSeries, {
        color: "rgba(255,255,255,0)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        pointMarkersVisible: true,
      });
      sarSeries.setData(
        candles
          .map((c, i) => ({ time: c.time, value: psar[i]! }))
          .filter((d) => d.value != null && !Number.isNaN(d.value)),
      );
      mainRefs.current.overlays.push(sarSeries as AnySeriesApi);
    }
  }, [
    candles,
    closes,
    indicators.sma20,
    indicators.sma50,
    indicators.sma200,
    indicators.ema9,
    indicators.ema21,
    indicators.bbands,
    indicators.volume,
    indicators.vwap,
    indicators.ichimoku,
    indicators.psar,
  ]);

  // ── Backtest markers ──────────────────────────────────────────────────────
  useEffect(() => {
    const markersApi = mainRefs.current.markers;
    if (!markersApi) return;
    if (!backtestResult) {
      markersApi.setMarkers([]);
      return;
    }
    const priceMap = new Map(candles.map((c) => [Number(c.time), c]));
    const markers: SeriesMarker<Time>[] = backtestResult.markers
      .flatMap((sig) => {
        const c = priceMap.get(sig.time);
        if (!c) return [];
        return [
          {
            time: c.time,
            position: sig.action === "buy" ? "belowBar" : "aboveBar",
            color: sig.action === "buy" ? "#22d37a" : "#f4503a",
            shape: sig.action === "buy" ? "arrowUp" : "arrowDown",
            text: sig.action === "buy" ? "B" : "S",
            size: 1,
          } as SeriesMarker<Time>,
        ];
      })
      .sort((a, b) => (Number(a.time) < Number(b.time) ? -1 : 1));
    markersApi.setMarkers(markers);
  }, [backtestResult, candles]);

  // ── Run backtest ──────────────────────────────────────────────────────────
  const handleRunBacktest = useCallback(() => {
    if (candles.length === 0) return;
    setBacktestRunning(true);
    setBacktestError(null);
    setBacktestResult(null);

    setTimeout(() => {
      try {
        const result = runBacktest(candles, strategyCode);
        setBacktestResult(result);
      } catch (err) {
        setBacktestError(err instanceof Error ? err.message : String(err));
      } finally {
        setBacktestRunning(false);
      }
    }, 50);
  }, [candles, strategyCode]);

  // ── Active oscillators ────────────────────────────────────────────────────
  const activeOscillators = useMemo(
    () =>
      (
        [
          { key: "rsi" as const, label: "RSI (14)", fn: renderRSI },
          { key: "macd" as const, label: "MACD (12,26,9)", fn: renderMACD },
          { key: "stoch" as const, label: "Stoch (14,3,3)", fn: renderStoch },
          { key: "atr" as const, label: "ATR (14)", fn: renderATR },
          { key: "obv" as const, label: "OBV", fn: renderOBV },
          { key: "cci" as const, label: "CCI (20)", fn: renderCCI },
          {
            key: "williamsr" as const,
            label: "Williams %R (14)",
            fn: renderWilliamsR,
          },
          { key: "mfi" as const, label: "MFI (14)", fn: renderMFI },
          { key: "adx" as const, label: "ADX (14)", fn: renderADX },
        ] as const
      ).filter(({ key }) => indicators[key]),
    [indicators],
  );

  const subChartCount = activeOscillators.length;
  const mainHeightClass =
    subChartCount === 0
      ? "flex-1"
      : subChartCount <= 2
        ? "h-[50%]"
        : subChartCount <= 4
          ? "h-[38%]"
          : "h-[28%]";

  // ── Indicator definitions ─────────────────────────────────────────────────
  const overlayDefs: {
    key: keyof IndicatorState;
    label: string;
    color: string;
    idx: number;
  }[] = [
    { key: "sma20", label: "SMA20", color: "#eab308", idx: 1 },
    { key: "sma50", label: "SMA50", color: "#60a5fa", idx: 2 },
    { key: "sma200", label: "SMA200", color: "#f4503a", idx: 3 },
    { key: "ema9", label: "EMA9", color: "#22d37a", idx: 4 },
    { key: "ema21", label: "EMA21", color: "#f97316", idx: 5 },
    { key: "bbands", label: "BB (20,2)", color: "#a855f7", idx: 6 },
    { key: "vwap", label: "VWAP", color: "#00e5ff", idx: 7 },
    { key: "ichimoku", label: "Ichimoku", color: "#e11d48", idx: 8 },
    { key: "psar", label: "P.SAR", color: "#d1d5db", idx: 9 },
    { key: "volume", label: "VOL", color: "#6b7280", idx: 10 },
  ];

  const oscillatorDefs: {
    key: keyof IndicatorState;
    label: string;
    color: string;
    idx: number;
  }[] = [
    { key: "rsi", label: "RSI", color: "#a855f7", idx: 11 },
    { key: "macd", label: "MACD", color: "#60a5fa", idx: 12 },
    { key: "stoch", label: "Stoch", color: "#3b82f6", idx: 13 },
    { key: "atr", label: "ATR", color: "#f59e0b", idx: 14 },
    { key: "obv", label: "OBV", color: "#06b6d4", idx: 15 },
    { key: "cci", label: "CCI", color: "#ec4899", idx: 16 },
    { key: "williamsr", label: "%R", color: "#8b5cf6", idx: 17 },
    { key: "mfi", label: "MFI", color: "#10b981", idx: 18 },
    { key: "adx", label: "ADX", color: "#f59e0b", idx: 19 },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── Top Control Bar ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 h-11 border-b border-border flex-shrink-0 overflow-x-auto"
        style={{ background: "oklch(0.10 0.022 265)" }}
      >
        {/* Symbol selector */}
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger
            className="w-[120px] h-7 text-[11px] font-mono bg-secondary/40 border-border/60"
            data-ocid="chart.symbol_select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {SYMBOLS.map((s) => (
              <SelectItem key={s} value={s} className="font-mono text-[11px]">
                {s}/USDT
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Timeframe buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              data-ocid="chart.timeframe.tab"
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all ${
                timeframe === tf
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border/60 flex-shrink-0" />

        {/* Live price */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {priceLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : priceData ? (
            <>
              <span className="font-mono font-semibold text-[14px] tabular-nums text-foreground">
                {formatPrice(priceData.price)}
              </span>
              <Badge
                className="text-[10px] font-mono px-1.5 py-0 border"
                style={{
                  background:
                    priceData.change24h >= 0
                      ? "oklch(0.72 0.19 152 / 0.12)"
                      : "oklch(0.62 0.26 22 / 0.12)",
                  borderColor:
                    priceData.change24h >= 0
                      ? "oklch(0.72 0.19 152 / 0.35)"
                      : "oklch(0.62 0.26 22 / 0.35)",
                  color:
                    priceData.change24h >= 0
                      ? "oklch(0.72 0.19 152)"
                      : "oklch(0.72 0.26 22)",
                }}
              >
                {priceData.change24h >= 0 ? "+" : ""}
                {priceData.change24h.toFixed(2)}%
              </Badge>
              {priceData.change24h >= 0 ? (
                <TrendingUp
                  className="w-3 h-3 flex-shrink-0"
                  style={{ color: "oklch(0.72 0.19 152)" }}
                />
              ) : (
                <TrendingDown
                  className="w-3 h-3 flex-shrink-0"
                  style={{ color: "oklch(0.72 0.26 22)" }}
                />
              )}
            </>
          ) : (
            <span className="text-muted-foreground text-[12px] font-mono">
              —
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[9px] font-mono text-muted-foreground/40 tracking-widest">
            Binance
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "oklch(0.72 0.19 152)" }}
          />
          <span className="text-[9px] font-mono text-muted-foreground/40 tracking-widest">
            LIVE
          </span>
        </div>
      </div>

      {/* ── Indicator Toolbar (Two rows) ─────────────────────────────────── */}
      <div
        className="flex flex-col gap-1 px-3 py-1.5 border-b border-border flex-shrink-0"
        style={{ background: "oklch(0.105 0.022 265)" }}
      >
        {/* Row 1: Overlays */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest mr-1 flex-shrink-0 w-16">
            Overlays:
          </span>
          {overlayDefs.map((def) => (
            <IndicatorToggle
              key={def.key}
              label={def.label}
              color={def.color}
              active={indicators[def.key]}
              onClick={() => toggleIndicator(def.key)}
              ocid={`chart.indicator.toggle.${def.idx}`}
            />
          ))}
        </div>
        {/* Row 2: Oscillators */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest mr-1 flex-shrink-0 w-16">
            Oscillators:
          </span>
          {oscillatorDefs.map((def) => (
            <IndicatorToggle
              key={def.key}
              label={def.label}
              color={def.color}
              active={indicators[def.key]}
              onClick={() => toggleIndicator(def.key)}
              ocid={`chart.indicator.toggle.${def.idx}`}
            />
          ))}
        </div>
      </div>

      {/* ── Chart Area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {/* Loading state */}
        {candlesLoading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm"
            data-ocid="chart.loading_state"
          >
            <div className="flex flex-col items-center gap-3">
              <Loader2
                className="w-6 h-6 animate-spin"
                style={{ color: "oklch(0.74 0.20 208)" }}
              />
              <span className="text-[12px] font-mono text-muted-foreground">
                Loading real-time data from Binance...
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {candlesError && !candlesLoading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-background/80"
            data-ocid="chart.error_state"
          >
            <div className="flex flex-col items-center gap-4 text-center px-6">
              <AlertCircle
                className="w-8 h-8"
                style={{ color: "oklch(0.72 0.26 22)" }}
              />
              <div>
                <p className="text-[13px] font-mono text-foreground font-semibold">
                  Failed to load Binance data
                </p>
                <p className="text-[11px] font-mono text-muted-foreground mt-1">
                  Check your connection or try again
                </p>
              </div>
              <Button
                size="sm"
                className="h-7 text-[11px] font-mono gap-1.5"
                onClick={() => refetchCandles()}
                data-ocid="chart.retry.button"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Main candlestick chart */}
        <div className={`${mainHeightClass} min-h-[120px] flex-shrink-0`}>
          <div
            ref={mainContainerRef}
            data-ocid="chart.canvas_target"
            className="w-full h-full"
            style={{ background: "#0d0e14" }}
          />
        </div>

        {/* Oscillator sub-charts */}
        {activeOscillators.map(({ key, label, fn }) => (
          <SubChart key={key} label={label} candles={candles} renderFn={fn} />
        ))}
      </div>

      {/* ── Pine Script Backtester ───────────────────────────────────────── */}
      <div
        data-ocid="chart.backtest.panel"
        className="flex-shrink-0 border-t border-border"
        style={{
          background: "oklch(0.09 0.020 265)",
          maxHeight: backtestOpen ? "500px" : "40px",
          transition: "max-height 0.28s ease-in-out",
          overflow: "hidden",
        }}
      >
        {/* Panel header */}
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 h-10 hover:bg-accent/20 transition-colors"
          onClick={() => setBacktestOpen((o) => !o)}
          data-ocid="chart.backtest.open_modal_button"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground/70 uppercase tracking-widest">
              Pine Script Backtester
            </span>
            {backtestResult && (
              <Badge
                className="text-[10px] font-mono px-1.5 py-0 border-0"
                style={{
                  background:
                    backtestResult.totalReturn >= 0
                      ? "oklch(0.72 0.19 152 / 0.15)"
                      : "oklch(0.62 0.26 22 / 0.15)",
                  color:
                    backtestResult.totalReturn >= 0
                      ? "oklch(0.72 0.19 152)"
                      : "oklch(0.72 0.26 22)",
                }}
              >
                {backtestResult.totalReturn >= 0 ? "+" : ""}
                {backtestResult.totalReturn.toFixed(2)}%
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {candles.length > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground/30">
                {candles.length} candles · {symbol}/USDT
              </span>
            )}
            {backtestOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Panel body */}
        <div className="flex flex-col" style={{ height: "460px" }}>
          <div className="flex flex-1 min-h-0 divide-x divide-border overflow-hidden">
            {/* Code editor + template picker */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              {/* Template picker */}
              <div
                className="flex items-center gap-2 px-3 py-1.5 border-b border-border flex-shrink-0"
                style={{ background: "oklch(0.085 0.018 265)" }}
              >
                <span className="text-[10px] font-mono text-muted-foreground/50 flex-shrink-0">
                  Template:
                </span>
                <Select
                  value={selectedTemplate}
                  onValueChange={handleTemplateChange}
                >
                  <SelectTrigger
                    className="h-6 text-[10px] font-mono bg-secondary/30 border-border/50 flex-1"
                    data-ocid="chart.backtest.select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {Object.entries(STRATEGY_TEMPLATES).map(
                      ([key, { name }]) => (
                        <SelectItem
                          key={key}
                          value={key}
                          className="font-mono text-[11px]"
                        >
                          {name}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Monaco editor */}
              <div data-ocid="chart.backtest.editor" className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  defaultLanguage="javascript"
                  value={strategyCode}
                  onChange={(val) => setStrategyCode(val ?? "")}
                  theme="vs-dark"
                  options={{
                    fontSize: 12,
                    fontFamily: "Geist Mono, JetBrains Mono, monospace",
                    minimap: { enabled: false },
                    lineNumbers: "on",
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    renderLineHighlight: "line",
                    padding: { top: 8, bottom: 8 },
                  }}
                />
              </div>

              {/* Run controls */}
              <div className="flex items-center gap-2 px-3 py-2 border-t border-border flex-shrink-0">
                <Button
                  data-ocid="chart.backtest.submit_button"
                  onClick={handleRunBacktest}
                  disabled={backtestRunning || candles.length === 0}
                  size="sm"
                  className="h-7 text-[11px] font-mono gap-1.5"
                  style={{
                    background: "oklch(0.74 0.20 208 / 0.9)",
                    color: "oklch(0.08 0.025 265)",
                  }}
                >
                  {backtestRunning ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  {backtestRunning ? "Running…" : "Run Backtest"}
                </Button>
                {backtestResult && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] font-mono text-muted-foreground"
                    onClick={() => {
                      setBacktestResult(null);
                      setBacktestError(null);
                    }}
                    data-ocid="chart.backtest.cancel_button"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                )}
                {candles.length === 0 && (
                  <span className="text-[11px] font-mono text-muted-foreground/40">
                    No candle data
                  </span>
                )}
              </div>
            </div>

            {/* Results panel */}
            <div className="w-64 flex-shrink-0 flex flex-col overflow-y-auto">
              {backtestError && (
                <div
                  data-ocid="chart.backtest.error_state"
                  className="flex flex-col gap-2 p-3"
                >
                  <div
                    className="flex items-center gap-1.5"
                    style={{ color: "oklch(0.72 0.26 22)" }}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold">
                      Strategy Error
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground leading-relaxed bg-destructive/10 rounded p-2 break-words">
                    {backtestError}
                  </p>
                </div>
              )}

              {backtestResult && !backtestError && (
                <div
                  data-ocid="chart.backtest.success_state"
                  className="p-3 space-y-3"
                >
                  <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
                    Backtest Results
                  </span>

                  <div className="grid grid-cols-2 gap-1.5">
                    <MetricCard
                      label="Total Return"
                      value={`${backtestResult.totalReturn >= 0 ? "+" : ""}${backtestResult.totalReturn.toFixed(2)}%`}
                      positive={backtestResult.totalReturn >= 0}
                    />
                    <MetricCard
                      label="# Trades"
                      value={String(backtestResult.numTrades)}
                    />
                    <MetricCard
                      label="Win Rate"
                      value={`${backtestResult.winRate.toFixed(1)}%`}
                      positive={backtestResult.winRate >= 50}
                    />
                    <MetricCard
                      label="Max DD"
                      value={`-${backtestResult.maxDrawdown.toFixed(2)}%`}
                      positive={false}
                    />
                  </div>

                  {backtestResult.equityCurve.length > 1 && (
                    <div>
                      <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">
                        Equity Curve
                      </span>
                      <div className="mt-1 rounded overflow-hidden border border-border/40">
                        <EquityCurveChart curve={backtestResult.equityCurve} />
                      </div>
                    </div>
                  )}

                  {backtestResult.trades.length > 0 && (
                    <div>
                      <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">
                        Recent Trades
                      </span>
                      <div className="mt-1 space-y-1">
                        {backtestResult.trades.slice(-5).map((trade, i) => (
                          <div
                            key={`trade-${trade.entryTime}-${i}`}
                            className="flex items-center justify-between p-1.5 rounded border border-border/30 text-[10px] font-mono"
                            style={{ background: "oklch(0.135 0.026 265)" }}
                          >
                            <span className="text-muted-foreground">
                              #
                              {backtestResult.trades.length -
                                backtestResult.trades.slice(-5).length +
                                i +
                                1}
                            </span>
                            <span
                              style={{
                                color:
                                  trade.pnlPct >= 0
                                    ? "oklch(0.72 0.19 152)"
                                    : "oklch(0.72 0.26 22)",
                              }}
                            >
                              {trade.pnlPct >= 0 ? "+" : ""}
                              {trade.pnlPct.toFixed(2)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {backtestResult.numTrades === 0 && (
                    <p className="text-[11px] text-muted-foreground/50 text-center py-4">
                      No trades generated
                    </p>
                  )}
                </div>
              )}

              {!backtestResult && !backtestError && !backtestRunning && (
                <div className="flex flex-col items-center justify-center flex-1 gap-2 p-4 text-center">
                  <Play className="w-5 h-5 text-muted-foreground/20" />
                  <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
                    Select a template or write your Pine-style strategy, then
                    click Run Backtest
                  </p>
                </div>
              )}

              {backtestRunning && (
                <div
                  data-ocid="chart.backtest.loading_state"
                  className="flex flex-col items-center justify-center flex-1 gap-2 p-4"
                >
                  <Loader2
                    className="w-5 h-5 animate-spin"
                    style={{ color: "oklch(0.74 0.20 208)" }}
                  />
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Simulating trades…
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div
      className="p-2 rounded border border-border/40 space-y-0.5"
      style={{ background: "oklch(0.135 0.026 265)" }}
    >
      <div className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">
        {label}
      </div>
      <div
        className="text-[13px] font-mono font-semibold tabular-nums"
        style={{
          color:
            positive === undefined
              ? "oklch(0.93 0.012 255)"
              : positive
                ? "oklch(0.72 0.19 152)"
                : "oklch(0.72 0.26 22)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
