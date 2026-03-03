import type { Candle } from "@/backend.d.ts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActor } from "@/hooks/useActor";
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
];

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const COIN_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  DOT: "polkadot",
};

const DEFAULT_STRATEGY = `// Strategy receives: candles array [{time, open, high, low, close, volume}]
// Must return: array of {time, action} where action is 'buy' or 'sell'
function strategy(candles) {
  const signals = [];
  // Example: Simple MA crossover
  for (let i = 20; i < candles.length; i++) {
    const ma5 = candles.slice(i-5,i).reduce((s,c)=>s+c.close,0)/5;
    const ma20 = candles.slice(i-20,i).reduce((s,c)=>s+c.close,0)/20;
    if (ma5 > ma20 && candles[i-1] && candles.slice(i-6,i-1).reduce((s,c)=>s+c.close,0)/5 <= candles.slice(i-21,i-1).reduce((s,c)=>s+c.close,0)/20) {
      signals.push({time: candles[i].time, action: 'buy'});
    } else if (ma5 < ma20 && candles[i-1] && candles.slice(i-6,i-1).reduce((s,c)=>s+c.close,0)/5 >= candles.slice(i-21,i-1).reduce((s,c)=>s+c.close,0)/20) {
      signals.push({time: candles[i].time, action: 'sell'});
    }
  }
  return signals;
}`;

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
  ma20: boolean;
  ma50: boolean;
  ma200: boolean;
  ema9: boolean;
  ema21: boolean;
  bbands: boolean;
  volume: boolean;
  rsi: boolean;
  macd: boolean;
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
): { upper: (number | null)[]; lower: (number | null)[] } {
  const sma = calcSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  data.forEach((_, i) => {
    if (sma[i] === null) {
      upper.push(null);
      lower.push(null);
      return;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const mean = sma[i]!;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const stddev = Math.sqrt(variance);
    upper.push(mean + multiplier * stddev);
    lower.push(mean - multiplier * stddev);
  });
  return { upper, lower };
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

function calcMACD(data: number[]): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const ema12 = calcEMA(data, 12);
  const ema26 = calcEMA(data, 26);
  const macdLine = ema12.map((v, i) =>
    v !== null && ema26[i] !== null ? v - ema26[i]! : null,
  );
  const macdValues = macdLine.filter((v): v is number => v !== null);
  const signalRaw = calcEMA(macdValues, 9);
  const signal: (number | null)[] = new Array(data.length).fill(null);
  let rawIdx = 0;
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] !== null) {
      signal[i] = signalRaw[rawIdx] ?? null;
      rawIdx++;
    }
  }
  const histogram = macdLine.map((v, i) =>
    v !== null && signal[i] !== null ? v - signal[i]! : null,
  );
  return { macd: macdLine, signal, histogram };
}

// ─── Backtesting engine ───────────────────────────────────────────────────────

function runBacktest(
  candles: CandleBar[],
  strategyCode: string,
): BacktestResult {
  const fn = new Function(
    "candles",
    `${strategyCode}\nreturn strategy(candles);`,
  );
  const candlesPlain = candles.map((c) => ({
    time: Number(c.time),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
  const rawSignals: BacktestSignal[] = fn(candlesPlain);

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
}: {
  curve: { time: number; equity: number }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || curve.length === 0) return;
    const container = containerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 120,
      layout: {
        background: { type: ColorType.Solid, color: "oklch(0.135 0.026 265)" },
        textColor: "oklch(0.52 0.028 255)",
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
      color: "oklch(0.74 0.20 208)",
      lineWidth: 2,
    });

    series.setData(
      curve.map((p) => ({
        time: p.time as Time,
        value: p.equity,
      })),
    );
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
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
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-all border ${
        active
          ? "border-transparent text-background"
          : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground bg-transparent"
      }`}
      style={active ? { background: color, borderColor: color } : {}}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: color, opacity: active ? 1 : 0.4 }}
      />
      {label}
    </button>
  );
}

// ─── Live price hook ──────────────────────────────────────────────────────────

function useLivePrice(symbol: string) {
  const coinId = COIN_IDS[symbol] ?? "bitcoin";
  return useQuery({
    queryKey: ["livePrice", coinId],
    queryFn: async () => {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`,
      );
      if (!res.ok) throw new Error("CoinGecko fetch failed");
      const data = await res.json();
      return {
        price: data[coinId]?.usd as number,
        change24h: data[coinId]?.usd_24h_change as number,
      };
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: 2,
  });
}

// ─── Candle data hook ─────────────────────────────────────────────────────────

function useCandleData(symbol: string, timeframe: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Candle[]>({
    queryKey: ["candles", symbol, timeframe],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getCandleData(symbol, timeframe);
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000,
  });
}

// ─── Chart instance wrapper ───────────────────────────────────────────────────

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
    ma20: false,
    ma50: false,
    ma200: false,
    ema9: false,
    ema21: false,
    bbands: false,
    volume: true,
    rsi: false,
    macd: false,
  });
  const [backtestOpen, setBacktestOpen] = useState(false);
  const [strategyCode, setStrategyCode] = useState(DEFAULT_STRATEGY);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(
    null,
  );
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [backtestRunning, setBacktestRunning] = useState(false);

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);
  const mainRefs = useRef<ChartRefs>({
    chart: null,
    candle: null,
    overlays: [],
    markers: null,
  });
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);

  const { data: priceData, isLoading: priceLoading } = useLivePrice(symbol);
  const { data: rawCandles, isLoading: candlesLoading } = useCandleData(
    symbol,
    timeframe,
  );

  const candles: CandleBar[] = useMemo(() => {
    if (!rawCandles) return [];
    return rawCandles
      .map((c) => ({
        time: Number(c.time / 1_000_000_000n) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }))
      .sort((a, b) => (Number(a.time) < Number(b.time) ? -1 : 1));
  }, [rawCandles]);

  const closes = useMemo(() => candles.map((c) => c.close), [candles]);

  const toggleIndicator = useCallback((key: keyof IndicatorState) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
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
        vertLines: { color: "rgba(42,46,57,0.6)" },
        horzLines: { color: "rgba(42,46,57,0.6)" },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      timeScale: {
        borderColor: "rgba(42,46,57,0.9)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "rgba(42,46,57,0.9)",
      },
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

    // Remove old overlays
    for (const s of mainRefs.current.overlays) {
      try {
        chart.removeSeries(s);
      } catch {
        /* ignore */
      }
    }
    mainRefs.current.overlays = [];

    // Volume histogram
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

    // MA20
    if (indicators.ma20) {
      const sma = calcSMA(closes, 20);
      const s = chart.addSeries(LineSeries, {
        color: "#eab308",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(
        candles
          .map((c, i) => ({ time: c.time, value: sma[i]! }))
          .filter((d) => d.value !== null && d.value !== undefined),
      );
      mainRefs.current.overlays.push(s as AnySeriesApi);
    }
    // MA50
    if (indicators.ma50) {
      const sma = calcSMA(closes, 50);
      const s = chart.addSeries(LineSeries, {
        color: "#60a5fa",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(
        candles
          .map((c, i) => ({ time: c.time, value: sma[i]! }))
          .filter((d) => d.value !== null && d.value !== undefined),
      );
      mainRefs.current.overlays.push(s as AnySeriesApi);
    }
    // MA200
    if (indicators.ma200) {
      const sma = calcSMA(closes, 200);
      const s = chart.addSeries(LineSeries, {
        color: "#f4503a",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(
        candles
          .map((c, i) => ({ time: c.time, value: sma[i]! }))
          .filter((d) => d.value !== null && d.value !== undefined),
      );
      mainRefs.current.overlays.push(s as AnySeriesApi);
    }
    // EMA9
    if (indicators.ema9) {
      const ema = calcEMA(closes, 9);
      const s = chart.addSeries(LineSeries, {
        color: "#22d37a",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(
        candles
          .map((c, i) => ({ time: c.time, value: ema[i]! }))
          .filter((d) => d.value !== null && d.value !== undefined),
      );
      mainRefs.current.overlays.push(s as AnySeriesApi);
    }
    // EMA21
    if (indicators.ema21) {
      const ema = calcEMA(closes, 21);
      const s = chart.addSeries(LineSeries, {
        color: "#f97316",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(
        candles
          .map((c, i) => ({ time: c.time, value: ema[i]! }))
          .filter((d) => d.value !== null && d.value !== undefined),
      );
      mainRefs.current.overlays.push(s as AnySeriesApi);
    }
    // Bollinger Bands
    if (indicators.bbands) {
      const { upper, lower } = calcBBands(closes);
      const upperS = chart.addSeries(LineSeries, {
        color: "rgba(168,85,247,0.8)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const lowerS = chart.addSeries(LineSeries, {
        color: "rgba(168,85,247,0.8)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      upperS.setData(
        candles
          .map((c, i) => ({ time: c.time, value: upper[i]! }))
          .filter((d) => d.value !== null && d.value !== undefined),
      );
      lowerS.setData(
        candles
          .map((c, i) => ({ time: c.time, value: lower[i]! }))
          .filter((d) => d.value !== null && d.value !== undefined),
      );
      mainRefs.current.overlays.push(
        upperS as AnySeriesApi,
        lowerS as AnySeriesApi,
      );
    }
  }, [
    candles,
    closes,
    indicators.ma20,
    indicators.ma50,
    indicators.ma200,
    indicators.ema9,
    indicators.ema21,
    indicators.bbands,
    indicators.volume,
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
        // signals time is in seconds (same as candle time)
        const c = priceMap.get(sig.time);
        if (!c) return [];
        const marker: SeriesMarker<Time> = {
          time: c.time,
          position: sig.action === "buy" ? "belowBar" : "aboveBar",
          color: sig.action === "buy" ? "#22d37a" : "#f4503a",
          shape: sig.action === "buy" ? "arrowUp" : "arrowDown",
          text: sig.action === "buy" ? "B" : "S",
          size: 1,
        };
        return [marker];
      })
      .sort((a, b) => (Number(a.time) < Number(b.time) ? -1 : 1));
    markersApi.setMarkers(markers);
  }, [backtestResult, candles]);

  // ── RSI sub-chart ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!rsiContainerRef.current) return;
    if (!indicators.rsi || candles.length === 0) {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
      }
      return;
    }
    const container = rsiContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#0a0b10" },
        textColor: "rgba(145,152,170,0.9)",
        fontFamily: "Geist Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(42,46,57,0.4)" },
        horzLines: { color: "rgba(42,46,57,0.4)" },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      timeScale: {
        borderColor: "rgba(42,46,57,0.9)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: "rgba(42,46,57,0.9)" },
    });
    rsiChartRef.current = chart;

    const rsiValues = calcRSI(closes);
    const rsiSeries = chart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 2,
    });
    rsiSeries.setData(
      candles
        .map((c, i) => ({ time: c.time, value: rsiValues[i]! }))
        .filter((d) => d.value !== null && d.value !== undefined),
    );

    // Overbought/Oversold bands
    const obSeries = chart.addSeries(LineSeries, {
      color: "rgba(244,80,58,0.4)",
      lineWidth: 1,
      lineStyle: 2,
    });
    const osSeries = chart.addSeries(LineSeries, {
      color: "rgba(34,211,122,0.4)",
      lineWidth: 1,
      lineStyle: 2,
    });
    const first = candles[0].time;
    const last = candles[candles.length - 1].time;
    obSeries.setData([
      { time: first, value: 70 },
      { time: last, value: 70 },
    ]);
    osSeries.setData([
      { time: first, value: 30 },
      { time: last, value: 30 },
    ]);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      rsiChartRef.current = null;
    };
  }, [indicators.rsi, candles, closes]);

  // ── MACD sub-chart ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!macdContainerRef.current) return;
    if (!indicators.macd || candles.length === 0) {
      if (macdChartRef.current) {
        macdChartRef.current.remove();
        macdChartRef.current = null;
      }
      return;
    }
    const container = macdContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#0a0b10" },
        textColor: "rgba(145,152,170,0.9)",
        fontFamily: "Geist Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(42,46,57,0.4)" },
        horzLines: { color: "rgba(42,46,57,0.4)" },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      timeScale: {
        borderColor: "rgba(42,46,57,0.9)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: "rgba(42,46,57,0.9)" },
    });
    macdChartRef.current = chart;

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
        .filter((d) => d.value !== null && d.value !== undefined),
    );

    const macdSeries = chart.addSeries(LineSeries, {
      color: "#60a5fa",
      lineWidth: 2,
    });
    macdSeries.setData(
      candles
        .map((c, i) => ({ time: c.time, value: macd[i]! }))
        .filter((d) => d.value !== null && d.value !== undefined),
    );

    const signalSeries = chart.addSeries(LineSeries, {
      color: "#f97316",
      lineWidth: 2,
    });
    signalSeries.setData(
      candles
        .map((c, i) => ({ time: c.time, value: signal[i]! }))
        .filter((d) => d.value !== null && d.value !== undefined),
    );

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      macdChartRef.current = null;
    };
  }, [indicators.macd, candles, closes]);

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

  // ── Sub-chart count for height calculations ───────────────────────────────
  const subChartCount = (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0);
  const mainHeightClass =
    subChartCount === 0
      ? "flex-1"
      : subChartCount === 1
        ? "h-[55%]"
        : "h-[40%]";

  const indicatorDefs: {
    key: keyof IndicatorState;
    label: string;
    color: string;
    idx: number;
  }[] = [
    { key: "ma20", label: "MA20", color: "#eab308", idx: 1 },
    { key: "ma50", label: "MA50", color: "#60a5fa", idx: 2 },
    { key: "ma200", label: "MA200", color: "#f4503a", idx: 3 },
    { key: "ema9", label: "EMA9", color: "#22d37a", idx: 4 },
    { key: "ema21", label: "EMA21", color: "#f97316", idx: 5 },
    { key: "bbands", label: "BB", color: "#a855f7", idx: 6 },
    { key: "volume", label: "VOL", color: "#6b7280", idx: 7 },
    { key: "rsi", label: "RSI", color: "#a855f7", idx: 8 },
    { key: "macd", label: "MACD", color: "#60a5fa", idx: 9 },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── Top Control Bar ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 h-12 border-b border-border flex-shrink-0 overflow-x-auto"
        style={{ background: "oklch(0.10 0.022 265)" }}
      >
        {/* Symbol selector */}
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger
            className="w-[110px] h-8 text-[12px] font-mono bg-secondary/50 border-border/60"
            data-ocid="chart.symbol_select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {SYMBOLS.map((s) => (
              <SelectItem key={s} value={s} className="font-mono text-[12px]">
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
              className={`px-2.5 py-1 text-[11px] font-mono rounded transition-all ${
                timeframe === tf
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border flex-shrink-0" />

        {/* Live price */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {priceLoading ? (
            <div className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground text-[12px] font-mono">
                Loading…
              </span>
            </div>
          ) : priceData ? (
            <>
              <span className="font-mono font-semibold text-[15px] tabular-nums text-foreground">
                {formatPrice(priceData.price)}
              </span>
              <Badge
                className="text-[10px] font-mono px-1.5 py-0.5 border"
                style={{
                  background:
                    priceData.change24h >= 0
                      ? "oklch(0.72 0.19 152 / 0.15)"
                      : "oklch(0.62 0.26 22 / 0.15)",
                  borderColor:
                    priceData.change24h >= 0
                      ? "oklch(0.72 0.19 152 / 0.4)"
                      : "oklch(0.62 0.26 22 / 0.4)",
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

        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          <span
            className="w-1.5 h-1.5 rounded-full pulse-dot"
            style={{ background: "oklch(0.72 0.19 152)" }}
          />
          <span className="text-[10px] font-mono text-muted-foreground/50 tracking-widest">
            LIVE
          </span>
        </div>
      </div>

      {/* ── Indicator Toggles Row ────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1.5 px-4 py-2 border-b border-border flex-shrink-0 overflow-x-auto"
        style={{ background: "oklch(0.105 0.022 265)" }}
      >
        <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest mr-1 flex-shrink-0">
          Indicators
        </span>
        {indicatorDefs.map((def) => (
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

      {/* ── Chart Area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {candlesLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div
              className="flex flex-col items-center gap-3"
              data-ocid="chart.backtest.loading_state"
            >
              <Loader2
                className="w-6 h-6 animate-spin"
                style={{ color: "oklch(0.74 0.20 208)" }}
              />
              <span className="text-[12px] font-mono text-muted-foreground">
                Loading chart data…
              </span>
            </div>
          </div>
        )}

        {/* Main candlestick chart */}
        <div className={`${mainHeightClass} min-h-0`}>
          <div
            ref={mainContainerRef}
            data-ocid="chart.canvas_target"
            className="w-full h-full"
            style={{ background: "#0d0e14" }}
          />
        </div>

        {/* RSI sub-chart */}
        {indicators.rsi && (
          <div className="h-[28%] min-h-0 border-t border-border/50 relative">
            <div className="absolute top-1 left-3 z-10">
              <span className="text-[10px] font-mono text-muted-foreground/60">
                RSI (14)
              </span>
            </div>
            <div
              ref={rsiContainerRef}
              className="w-full h-full"
              style={{ background: "#0a0b10" }}
            />
          </div>
        )}

        {/* MACD sub-chart */}
        {indicators.macd && (
          <div className="h-[28%] min-h-0 border-t border-border/50 relative">
            <div className="absolute top-1 left-3 z-10">
              <span className="text-[10px] font-mono text-muted-foreground/60">
                MACD (12,26,9)
              </span>
            </div>
            <div
              ref={macdContainerRef}
              className="w-full h-full"
              style={{ background: "#0a0b10" }}
            />
          </div>
        )}
      </div>

      {/* ── Backtesting Panel ────────────────────────────────────────────── */}
      <div
        data-ocid="chart.backtest.panel"
        className="flex-shrink-0 border-t border-border"
        style={{
          background: "oklch(0.09 0.020 265)",
          maxHeight: backtestOpen ? "480px" : "40px",
          transition: "max-height 0.25s ease-in-out",
          overflow: "hidden",
        }}
      >
        {/* Panel header */}
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 h-10 hover:bg-accent/30 transition-colors"
          onClick={() => setBacktestOpen((o) => !o)}
        >
          <div className="flex items-center gap-2">
            <span className="section-label text-[10px]">
              Strategy Backtester
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
              <span className="text-[10px] font-mono text-muted-foreground/40">
                {candles.length} candles
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
        <div className="flex flex-col" style={{ height: "440px" }}>
          <div className="flex flex-1 min-h-0 divide-x divide-border overflow-hidden">
            {/* Code editor */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
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
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                )}
                {candles.length === 0 && (
                  <span className="text-[11px] font-mono text-muted-foreground/50">
                    No candle data loaded
                  </span>
                )}
              </div>
            </div>

            {/* Results panel */}
            <div className="w-64 flex-shrink-0 flex flex-col overflow-y-auto">
              {/* Error state */}
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

              {/* Success state */}
              {backtestResult && !backtestError && (
                <div
                  data-ocid="chart.backtest.success_state"
                  className="p-3 space-y-3"
                >
                  <span className="section-label text-[9px]">
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
                      <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
                        Equity Curve
                      </span>
                      <div className="mt-1 rounded overflow-hidden border border-border/50">
                        <EquityCurveChart curve={backtestResult.equityCurve} />
                      </div>
                    </div>
                  )}

                  {backtestResult.trades.length > 0 && (
                    <div>
                      <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
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
                    <p className="text-[11px] text-muted-foreground/60 text-center py-4">
                      No trades generated
                    </p>
                  )}
                </div>
              )}

              {/* Idle state */}
              {!backtestResult && !backtestError && !backtestRunning && (
                <div className="flex flex-col items-center justify-center flex-1 gap-2 p-4 text-center">
                  <Play className="w-6 h-6 text-muted-foreground/25" />
                  <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                    Write your strategy and click Run Backtest to see results
                  </p>
                </div>
              )}

              {/* Running state */}
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
      <div className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
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
