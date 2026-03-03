import type { Coin } from "@/backend.d.ts";
import { ChangeCell } from "@/components/shared/ChangeCell";
import { CoinBadge } from "@/components/shared/CoinBadge";
import { SignalBadge } from "@/components/shared/SignalBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetAllCoins,
  useGetMarketSentiment,
  useGetSignals,
  useGetTopGainers,
  useGetTopLosers,
  useGetWatchlist,
  useRemoveFromWatchlist,
} from "@/hooks/useQueries";
import { formatPrice, formatTimestamp } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";

// ─── Live BTC Price Ticker ────────────────────────────────────────────────────

function useBTCPrice() {
  return useQuery({
    queryKey: ["btcLiveTicker"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
      );
      if (!res.ok) throw new Error("CoinGecko fetch failed");
      const data = await res.json();
      return {
        price: data.bitcoin?.usd as number,
        change24h: data.bitcoin?.usd_24h_change as number,
      };
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: 2,
  });
}

function BTCPriceTicker({
  onNavigate,
}: { onNavigate: (page: string) => void }) {
  const { data, isLoading } = useBTCPrice();

  return (
    <button
      type="button"
      onClick={() => onNavigate("chart")}
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-border/50 hover:border-primary/40 hover:bg-accent/30 transition-all group"
      style={{ background: "oklch(0.135 0.026 265)" }}
      title="Open BTC Chart"
    >
      <span className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
        BTC
      </span>
      {isLoading ? (
        <Skeleton className="w-20 h-4 rounded" />
      ) : data ? (
        <>
          <span className="font-mono font-semibold text-[13px] tabular-nums text-foreground">
            {formatPrice(data.price)}
          </span>
          <span
            className="flex items-center gap-0.5 text-[11px] font-mono"
            style={{
              color:
                data.change24h >= 0
                  ? "oklch(0.72 0.19 152)"
                  : "oklch(0.72 0.26 22)",
            }}
          >
            {data.change24h >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {data.change24h >= 0 ? "+" : ""}
            {data.change24h.toFixed(2)}%
          </span>
        </>
      ) : (
        <span className="text-muted-foreground text-[11px] font-mono">—</span>
      )}
      <span className="text-[9px] text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors font-mono ml-0.5">
        →CHART
      </span>
    </button>
  );
}

// ─── Fear & Greed Gauge ──────────────────────────────────────────────────────

function FearGreedGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  // Map 0–100 to needle rotation -90° to +90°
  const rotation = -90 + (clamped / 100) * 180;

  type Zone = { label: string; color: string; bg: string };
  const getZone = (v: number): Zone => {
    if (v < 20)
      return {
        label: "Extreme Fear",
        color: "#f4503a",
        bg: "oklch(0.62 0.26 22 / 0.10)",
      };
    if (v < 40)
      return {
        label: "Fear",
        color: "#f97316",
        bg: "oklch(0.70 0.18 45 / 0.10)",
      };
    if (v < 60)
      return {
        label: "Neutral",
        color: "#eab308",
        bg: "oklch(0.79 0.19 98 / 0.10)",
      };
    if (v < 80)
      return {
        label: "Greed",
        color: "#22d37a",
        bg: "oklch(0.72 0.19 152 / 0.10)",
      };
    return {
      label: "Extreme Greed",
      color: "#16c55e",
      bg: "oklch(0.68 0.22 152 / 0.12)",
    };
  };

  const zone = getZone(clamped);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Gauge SVG */}
      <div className="relative w-52 h-28">
        <svg viewBox="0 0 220 110" className="w-full h-full" aria-hidden="true">
          <title>Fear and Greed Index</title>
          {/* Track */}
          <path
            d="M 15 110 A 95 95 0 0 1 205 110"
            fill="none"
            stroke="oklch(0.195 0.024 265)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* Extreme Fear */}
          <path
            d="M 15 110 A 95 95 0 0 1 57 24"
            fill="none"
            stroke="#f4503a"
            strokeWidth="16"
            strokeLinecap="butt"
            opacity="0.75"
          />
          {/* Fear */}
          <path
            d="M 57 24 A 95 95 0 0 1 110 8"
            fill="none"
            stroke="#f97316"
            strokeWidth="16"
            strokeLinecap="butt"
            opacity="0.75"
          />
          {/* Neutral */}
          <path
            d="M 110 8 A 95 95 0 0 1 163 24"
            fill="none"
            stroke="#eab308"
            strokeWidth="16"
            strokeLinecap="butt"
            opacity="0.75"
          />
          {/* Greed */}
          <path
            d="M 163 24 A 95 95 0 0 1 205 110"
            fill="none"
            stroke="#22d37a"
            strokeWidth="16"
            strokeLinecap="butt"
            opacity="0.75"
          />

          {/* Zone tick marks */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const angle = (-90 + (pct / 100) * 180) * (Math.PI / 180);
            const r = 95;
            const cx = 110 + r * Math.cos(angle);
            const cy = 110 + r * Math.sin(angle);
            return (
              <circle
                key={pct}
                cx={cx}
                cy={cy}
                r="2.5"
                fill="oklch(0.10 0.022 265)"
                opacity="0.9"
              />
            );
          })}

          {/* Needle group */}
          <g transform={`rotate(${rotation}, 110, 110)`}>
            <line
              x1="110"
              y1="110"
              x2="110"
              y2="22"
              stroke="oklch(0.93 0.012 255)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="110" cy="110" r="5.5" fill="oklch(0.93 0.012 255)" />
            <circle cx="110" cy="110" r="3" fill="oklch(0.10 0.022 265)" />
          </g>
        </svg>
      </div>

      {/* Value display */}
      <div
        className="flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-md border"
        style={{
          background: zone.bg,
          borderColor: `${zone.color}30`,
        }}
      >
        <span
          className="font-display font-bold text-4xl leading-none tabular-nums"
          style={{ color: zone.color }}
        >
          {clamped}
        </span>
        <span
          className="text-xs font-semibold tracking-wide"
          style={{ color: zone.color }}
        >
          {zone.label}
        </span>
      </div>

      {/* Scale labels */}
      <div className="flex items-center justify-between w-full px-1 text-[10px] font-mono text-muted-foreground/50 mt-0.5">
        <span style={{ color: "#f4503a99" }}>Fear</span>
        <span>50</span>
        <span style={{ color: "#22d37a99" }}>Greed</span>
      </div>
    </div>
  );
}

// ─── Coin row (gainers/losers) ───────────────────────────────────────────────

function CoinRow({ coin, rank }: { coin: Coin; rank: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 hover:bg-accent/30 transition-colors px-1 -mx-1 rounded">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] text-muted-foreground/40 font-mono w-4 text-right flex-shrink-0 tabular-nums">
          {rank}
        </span>
        <CoinBadge symbol={coin.symbol} name={coin.name} size="sm" />
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="num-primary text-xs">{formatPrice(coin.price)}</span>
        <ChangeCell value={coin.change24h} showIcon />
      </div>
    </div>
  );
}

// ─── Panel section header ────────────────────────────────────────────────────

function PanelHeader({
  label,
  accent,
  children,
}: {
  label: string;
  accent?: "cyan" | "gain" | "loss" | "neutral";
  children?: React.ReactNode;
}) {
  const dotColor = {
    cyan: "bg-primary",
    gain: "bg-gain",
    loss: "bg-loss",
    neutral: "bg-muted-foreground",
  }[accent ?? "neutral"];

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {accent && accent !== "neutral" && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${dotColor} pulse-dot flex-shrink-0`}
          />
        )}
        <h3 className="section-label">{label}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function Dashboard({
  onNavigate,
}: { onNavigate: (page: string, coin?: string) => void }) {
  const { data: sentiment, isLoading: sentimentLoading } =
    useGetMarketSentiment();
  const { data: gainers, isLoading: gainersLoading } = useGetTopGainers();
  const { data: losers, isLoading: losersLoading } = useGetTopLosers();
  const { data: watchlistSymbols } = useGetWatchlist();
  const { data: allCoins } = useGetAllCoins();
  const { data: signals, isLoading: signalsLoading } = useGetSignals();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const watchlistCoins = useMemo(() => {
    if (!watchlistSymbols || !allCoins) return [];
    return watchlistSymbols
      .map((sym) => allCoins.find((c) => c.symbol === sym))
      .filter(Boolean) as Coin[];
  }, [watchlistSymbols, allCoins]);

  const recentSignals = useMemo(() => (signals ?? []).slice(0, 3), [signals]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-5 space-y-3"
    >
      {/* BTC Live Price Strip */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <BTCPriceTicker onNavigate={onNavigate} />
        <span className="text-[10px] font-mono text-muted-foreground/30 hidden sm:block">
          Click to open live chart with indicators & backtester
        </span>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {/* ── Fear & Greed — Hero panel with cyan top-accent ── */}
        <motion.div
          variants={itemVariants}
          data-ocid="dashboard.fear_greed_panel"
          className="panel-cyan p-4 col-span-1 flex flex-col"
        >
          <PanelHeader label="Fear & Greed Index" accent="cyan">
            <span className="text-[10px] font-mono text-muted-foreground/50 border border-border/50 px-1.5 py-0.5 rounded">
              24H
            </span>
          </PanelHeader>

          {sentimentLoading ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <Skeleton className="w-52 h-28 rounded" />
              <Skeleton className="w-28 h-14 rounded" />
            </div>
          ) : (
            <FearGreedGauge value={sentiment ?? 50} />
          )}
        </motion.div>

        {/* ── Top Gainers — Green accent panel ── */}
        <motion.div
          variants={itemVariants}
          data-ocid="dashboard.top_gainers_panel"
          className="panel-gain p-4 col-span-1 flex flex-col"
        >
          <PanelHeader label="Top Gainers" accent="gain" />

          {gainersLoading ? (
            <div className="space-y-2">
              {["g1", "g2", "g3", "g4", "g5"].map((k) => (
                <Skeleton key={k} className="h-9 w-full rounded" />
              ))}
            </div>
          ) : gainers && gainers.length > 0 ? (
            <div>
              {gainers.slice(0, 5).map((coin, i) => (
                <CoinRow key={coin.symbol} coin={coin} rank={i + 1} />
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-6">
              <p className="text-muted-foreground text-xs">No data available</p>
            </div>
          )}
        </motion.div>

        {/* ── Top Losers — Red accent panel ── */}
        <motion.div
          variants={itemVariants}
          data-ocid="dashboard.top_losers_panel"
          className="panel-loss p-4 col-span-1 flex flex-col"
        >
          <PanelHeader label="Top Losers" accent="loss" />

          {losersLoading ? (
            <div className="space-y-2">
              {["l1", "l2", "l3", "l4", "l5"].map((k) => (
                <Skeleton key={k} className="h-9 w-full rounded" />
              ))}
            </div>
          ) : losers && losers.length > 0 ? (
            <div>
              {losers.slice(0, 5).map((coin, i) => (
                <CoinRow key={coin.symbol} coin={coin} rank={i + 1} />
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-6">
              <p className="text-muted-foreground text-xs">No data available</p>
            </div>
          )}
        </motion.div>

        {/* ── Watchlist — Wide card ── */}
        <motion.div
          variants={itemVariants}
          data-ocid="dashboard.watchlist_panel"
          className="panel p-4 col-span-1 md:col-span-2 flex flex-col"
        >
          <PanelHeader label="Watchlist">
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] text-primary hover:text-primary/80 h-6 px-2"
              onClick={() => onNavigate("markets")}
            >
              + Add coins
            </Button>
          </PanelHeader>

          {watchlistCoins.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 gap-2.5"
              data-ocid="watchlist.empty_state"
            >
              <BookOpen className="w-7 h-7 text-muted-foreground/25" />
              <p className="text-muted-foreground/60 text-[11px] text-center">
                No coins in watchlist. Go to Markets to add some.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {watchlistCoins.map((coin) => (
                <div
                  key={coin.symbol}
                  className="flex items-center justify-between p-2.5 bg-secondary/30 rounded border border-border/40 hover:border-primary/25 hover:bg-secondary/50 transition-all group"
                >
                  <CoinBadge symbol={coin.symbol} name={coin.name} size="sm" />
                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      <div className="num-primary text-sm">
                        {formatPrice(coin.price)}
                      </div>
                      <ChangeCell
                        value={coin.change24h}
                        className="text-xs justify-end"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromWatchlist.mutate(coin.symbol)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-loss"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Recent Signals ── */}
        <motion.div
          variants={itemVariants}
          data-ocid="dashboard.signals_panel"
          className="panel p-4 col-span-1 flex flex-col"
        >
          <PanelHeader label="Recent Signals">
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] text-primary hover:text-primary/80 h-6 px-2"
              onClick={() => onNavigate("signals")}
            >
              View all
            </Button>
          </PanelHeader>

          {signalsLoading ? (
            <div className="space-y-2">
              {["s1", "s2", "s3"].map((k) => (
                <Skeleton key={k} className="h-16 w-full rounded" />
              ))}
            </div>
          ) : recentSignals.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 gap-2.5"
              data-ocid="signals.empty_state"
            >
              <AlertCircle className="w-7 h-7 text-muted-foreground/25" />
              <p className="text-muted-foreground/60 text-[11px] text-center">
                No signals yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSignals.map((signal) => (
                <div
                  key={signal.id.toString()}
                  className="p-2.5 bg-secondary/30 rounded border border-border/40 hover:border-border/60 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CoinBadge symbol={signal.symbol} size="sm" />
                      <span className="font-medium text-[11px] text-foreground truncate">
                        {signal.title}
                      </span>
                    </div>
                    <SignalBadge type={signal.signalType} size="sm" />
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {signal.body}
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 font-mono">
                    {formatTimestamp(signal.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
