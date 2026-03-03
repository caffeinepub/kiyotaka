import type { Coin } from "@/backend.d.ts";
import { ChangeCell } from "@/components/shared/ChangeCell";
import { CoinBadge } from "@/components/shared/CoinBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAddToWatchlist,
  useGetAllCoins,
  useGetWatchlist,
  useRemoveFromWatchlist,
} from "@/hooks/useQueries";

import {
  formatLargeNumber,
  formatNumber,
  formatPercent,
  formatPrice,
} from "@/lib/formatters";
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  Search,
  Star,
  StarOff,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
} from "recharts";

type SortKey = keyof Pick<
  Coin,
  "rank" | "price" | "change24h" | "change7d" | "volume24h" | "marketCap"
>;

function generateSparklineData(coin: Coin): { v: number }[] {
  const seed = coin.price;
  const data: { v: number }[] = [];
  let price = seed * (1 - coin.change7d / 100);
  for (let i = 0; i < 20; i++) {
    const noise =
      Math.sin(i * 0.7 + seed * 0.001) * seed * 0.02 +
      Math.cos(i * 1.3) * seed * 0.01;
    price += noise;
    data.push({ v: Math.max(0, price) });
  }
  data.push({ v: seed });
  return data;
}

/** Inline sparkline for the table row */
function MiniSparkline({ coin }: { coin: Coin }) {
  const data = useMemo(() => generateSparklineData(coin), [coin]);
  const isPositive = coin.change7d >= 0;
  const color = isPositive ? "#22d37a" : "#f4503a";

  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
        >
          <defs>
            <linearGradient
              id={`sg-${coin.symbol}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1}
            fill={`url(#sg-${coin.symbol})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TechnicalIndicators({ coin }: { coin: Coin }) {
  const hash = coin.symbol
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rsi = 30 + (hash % 40);
  const macdSignal = hash % 2 === 0 ? "Bullish" : "Bearish";
  const macdColor = macdSignal === "Bullish" ? "text-gain" : "text-loss";
  const ma50 = coin.price * (1 - 0.02 + (hash % 10) * 0.005);
  const ma200 = coin.price * (1 - 0.08 + (hash % 15) * 0.01);
  const aboveMA50 = coin.price > ma50;
  const aboveMA200 = coin.price > ma200;

  const getRsiColor = (v: number) => {
    if (v < 35) return "text-loss";
    if (v > 65) return "text-gain";
    return "text-yellow-400";
  };

  return (
    <div className="space-y-3">
      <h4 className="section-label">Technical Indicators</h4>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-secondary/50 rounded border border-border/60">
          <p className="section-label mb-2">RSI (14)</p>
          <div className="flex items-center gap-2">
            <span
              className={`font-mono font-bold text-xl tracking-tight ${getRsiColor(rsi)}`}
            >
              {rsi.toFixed(1)}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] ${getRsiColor(rsi)} border-current/30 bg-current/10`}
            >
              {rsi < 35 ? "Oversold" : rsi > 65 ? "Overbought" : "Neutral"}
            </Badge>
          </div>
          <div className="mt-2.5 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${rsi < 35 ? "bg-loss" : rsi > 65 ? "bg-gain" : "bg-yellow-400"}`}
              style={{ width: `${rsi}%` }}
            />
          </div>
        </div>

        <div className="p-3 bg-secondary/50 rounded border border-border/60">
          <p className="section-label mb-2">MACD</p>
          <span className={`font-mono font-bold text-base ${macdColor}`}>
            {macdSignal}
          </span>
          <p className="text-xs text-muted-foreground mt-1 leading-tight">
            {macdSignal === "Bullish"
              ? "Above signal line"
              : "Below signal line"}
          </p>
        </div>

        <div className="p-3 bg-secondary/50 rounded border border-border/60">
          <p className="section-label mb-2">vs MA50</p>
          <div className="flex items-center gap-1.5">
            {aboveMA50 ? (
              <TrendingUp className="w-3.5 h-3.5 text-gain flex-shrink-0" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-loss flex-shrink-0" />
            )}
            <span
              className={`font-mono text-sm font-semibold ${aboveMA50 ? "text-gain" : "text-loss"}`}
            >
              {aboveMA50 ? "Above" : "Below"}
            </span>
          </div>
          <p className="num-secondary text-xs mt-1">{formatPrice(ma50)}</p>
        </div>

        <div className="p-3 bg-secondary/50 rounded border border-border/60">
          <p className="section-label mb-2">vs MA200</p>
          <div className="flex items-center gap-1.5">
            {aboveMA200 ? (
              <TrendingUp className="w-3.5 h-3.5 text-gain flex-shrink-0" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-loss flex-shrink-0" />
            )}
            <span
              className={`font-mono text-sm font-semibold ${aboveMA200 ? "text-gain" : "text-loss"}`}
            >
              {aboveMA200 ? "Above" : "Below"}
            </span>
          </div>
          <p className="num-secondary text-xs mt-1">{formatPrice(ma200)}</p>
        </div>
      </div>
    </div>
  );
}

function CoinDetailSheet({
  coin,
  open,
  onClose,
  inWatchlist,
  onToggleWatchlist,
}: {
  coin: Coin | null;
  open: boolean;
  onClose: () => void;
  inWatchlist: boolean;
  onToggleWatchlist: () => void;
}) {
  if (!coin) return null;

  const sparkData = generateSparklineData(coin);
  const isPositive = coin.change24h >= 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl bg-popover border-l border-border overflow-y-auto p-0"
        data-ocid="coin_detail.sheet"
      >
        {/* Header band */}
        <div className="px-6 py-5 border-b border-border bg-card">
          <SheetHeader>
            <SheetTitle className="sr-only">{coin.name} Detail</SheetTitle>
          </SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CoinBadge symbol={coin.symbol} name={coin.name} size="lg" />
              <Badge
                variant="outline"
                className="text-[10px] font-mono text-muted-foreground border-border"
              >
                Rank #{coin.rank.toString()}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              className={`gap-1.5 text-xs ${
                inWatchlist
                  ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10 hover:bg-yellow-400/15"
                  : "text-muted-foreground border-border hover:text-foreground"
              }`}
              onClick={onToggleWatchlist}
              data-ocid="coin_detail.watchlist_toggle"
            >
              {inWatchlist ? (
                <>
                  <StarOff className="w-3.5 h-3.5" />
                  Remove
                </>
              ) : (
                <>
                  <Star className="w-3.5 h-3.5" />
                  Watch
                </>
              )}
            </Button>
          </div>

          {/* Price hero — inside the header band */}
          <div className="mt-4">
            <p className="num-lg text-3xl font-bold tracking-tight">
              {formatPrice(coin.price)}
            </p>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">24h</span>
                <ChangeCell value={coin.change24h} showIcon />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">7d</span>
                <ChangeCell value={coin.change7d} showIcon />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Sparkline */}
          <div>
            <p className="section-label mb-3">7-Day Price Chart</p>
            <div
              className="h-36 bg-background rounded border border-border/60 overflow-hidden"
              style={{
                background: isPositive
                  ? "linear-gradient(180deg, oklch(0.72 0.19 152 / 0.05) 0%, transparent 100%)"
                  : "linear-gradient(180deg, oklch(0.62 0.26 22 / 0.05) 0%, transparent 100%)",
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={sparkData}
                  margin={{ top: 8, right: 8, bottom: 4, left: 8 }}
                >
                  <defs>
                    <linearGradient
                      id={`grad-${coin.symbol}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={isPositive ? "#22d37a" : "#f4503a"}
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="100%"
                        stopColor={isPositive ? "#22d37a" : "#f4503a"}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={isPositive ? "#22d37a" : "#f4503a"}
                    strokeWidth={1.5}
                    fill={`url(#grad-${coin.symbol})`}
                    dot={false}
                  />
                  <RechartTooltip
                    contentStyle={{
                      background: "oklch(0.165 0.028 265)",
                      border: "1px solid oklch(0.24 0.028 265)",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontFamily: "Geist Mono",
                      color: "oklch(0.93 0.012 255)",
                    }}
                    formatter={(v: number) => [formatPrice(v), "Price"]}
                    labelFormatter={() => ""}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stats grid */}
          <div>
            <p className="section-label mb-3">Market Data</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Market Cap",
                  value: formatLargeNumber(coin.marketCap),
                },
                {
                  label: "24h Volume",
                  value: formatLargeNumber(coin.volume24h),
                },
                {
                  label: "Circulating Supply",
                  value: `${formatNumber(coin.circulatingSupply)} ${coin.symbol}`,
                },
                {
                  label: "7d Change",
                  value: formatPercent(coin.change7d),
                  isChange: true,
                  changeVal: coin.change7d,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-3 bg-secondary/40 rounded border border-border/60"
                >
                  <p className="section-label">{stat.label}</p>
                  {stat.isChange ? (
                    <ChangeCell value={stat.changeVal ?? 0} className="mt-1" />
                  ) : (
                    <p className="num-primary text-sm mt-1">{stat.value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Technical indicators */}
          <TechnicalIndicators coin={coin} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function Markets() {
  const { data: coins, isLoading } = useGetAllCoins();
  const { data: watchlist = [] } = useGetWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  };

  const sortedCoins = useMemo(() => {
    if (!coins) return [];
    let filtered = coins;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = coins.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.symbol.toLowerCase().includes(q),
      );
    }
    return [...filtered].sort((a, b) => {
      const av =
        sortKey === "rank" ? Number(a[sortKey]) : (a[sortKey] as number);
      const bv =
        sortKey === "rank" ? Number(b[sortKey]) : (b[sortKey] as number);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [coins, search, sortKey, sortDir]);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? (
        <ChevronUp className="w-2.5 h-2.5 inline ml-0.5 opacity-80" />
      ) : (
        <ChevronDown className="w-2.5 h-2.5 inline ml-0.5 opacity-80" />
      )
    ) : (
      <ChevronDown className="w-2.5 h-2.5 inline ml-0.5 opacity-20" />
    );

  const isInWatchlist = (symbol: string) => watchlist.includes(symbol);

  const handleToggleWatchlist = (symbol: string) => {
    if (isInWatchlist(symbol)) {
      removeFromWatchlist.mutate(symbol);
    } else {
      addToWatchlist.mutate(symbol);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground tracking-tight">
            Crypto Markets
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
            {sortedCoins.length} assets · live data
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs w-44 bg-secondary border-border focus-visible:ring-primary/40"
            data-ocid="markets.search_input"
          />
        </div>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <Table data-ocid="markets.table">
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                {/* Column headers — slightly elevated background */}
                <TableHead
                  className="cursor-pointer w-10 select-none section-label pl-4 py-2.5 bg-secondary/30"
                  onClick={() => handleSort("rank")}
                >
                  #<SortIcon k="rank" />
                </TableHead>
                <TableHead className="section-label py-2.5 bg-secondary/30">
                  Coin
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none section-label text-right py-2.5 bg-secondary/30"
                  onClick={() => handleSort("price")}
                >
                  Price <SortIcon k="price" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none section-label text-right py-2.5 bg-secondary/30 hidden sm:table-cell"
                  onClick={() => handleSort("change24h")}
                >
                  24h% <SortIcon k="change24h" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none section-label text-right py-2.5 bg-secondary/30 hidden lg:table-cell"
                  onClick={() => handleSort("change7d")}
                >
                  7d% <SortIcon k="change7d" />
                </TableHead>
                {/* Mini chart column */}
                <TableHead className="section-label text-right py-2.5 bg-secondary/30 hidden md:table-cell w-20">
                  7d Chart
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none section-label text-right py-2.5 bg-secondary/30 hidden xl:table-cell"
                  onClick={() => handleSort("volume24h")}
                >
                  Volume <SortIcon k="volume24h" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none section-label text-right py-2.5 bg-secondary/30 hidden md:table-cell"
                  onClick={() => handleSort("marketCap")}
                >
                  Mkt Cap <SortIcon k="marketCap" />
                </TableHead>
                <TableHead className="section-label text-right py-2.5 bg-secondary/30 pr-4 w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? [
                    "sk1",
                    "sk2",
                    "sk3",
                    "sk4",
                    "sk5",
                    "sk6",
                    "sk7",
                    "sk8",
                    "sk9",
                    "sk10",
                    "sk11",
                    "sk12",
                  ].map((sk, i) => (
                    <TableRow
                      key={sk}
                      className={`border-border/40 ${i % 2 === 1 ? "bg-secondary/10" : ""}`}
                    >
                      <TableCell className="pl-4 py-2.5">
                        <Skeleton className="h-3 w-5" />
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                          <div className="space-y-1">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-2.5 w-10" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Skeleton className="h-3 w-20 ml-auto" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2.5">
                        <Skeleton className="h-3 w-14 ml-auto" />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell py-2.5">
                        <Skeleton className="h-3 w-14 ml-auto" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2.5">
                        <Skeleton className="h-8 w-16 ml-auto" />
                      </TableCell>
                      <TableCell className="hidden xl:table-cell py-2.5">
                        <Skeleton className="h-3 w-20 ml-auto" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2.5">
                        <Skeleton className="h-3 w-20 ml-auto" />
                      </TableCell>
                      <TableCell className="pr-4 py-2.5">
                        <Skeleton className="h-4 w-4 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                : sortedCoins.map((coin, idx) => (
                    <TableRow
                      key={coin.symbol}
                      data-ocid={`markets.coin.item.${idx + 1}`}
                      className={`border-border/30 cursor-pointer transition-colors duration-100 ${
                        idx % 2 === 1 ? "bg-secondary/10" : ""
                      } hover:bg-accent/50`}
                      onClick={() => setSelectedCoin(coin)}
                    >
                      {/* Rank */}
                      <TableCell className="pl-4 py-2.5 font-mono text-[11px] text-muted-foreground/60 tabular-nums">
                        {coin.rank.toString()}
                      </TableCell>

                      {/* Coin */}
                      <TableCell className="py-2.5">
                        <CoinBadge
                          symbol={coin.symbol}
                          name={coin.name}
                          size="sm"
                        />
                      </TableCell>

                      {/* Price */}
                      <TableCell className="py-2.5 text-right">
                        <span className="num-primary text-sm">
                          {formatPrice(coin.price)}
                        </span>
                      </TableCell>

                      {/* 24h % */}
                      <TableCell className="py-2.5 text-right hidden sm:table-cell">
                        <ChangeCell
                          value={coin.change24h}
                          className="justify-end text-xs"
                        />
                      </TableCell>

                      {/* 7d % */}
                      <TableCell className="py-2.5 text-right hidden lg:table-cell">
                        <ChangeCell
                          value={coin.change7d}
                          className="justify-end text-xs"
                        />
                      </TableCell>

                      {/* Mini sparkline */}
                      <TableCell
                        className="py-2.5 text-right hidden md:table-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end">
                          <MiniSparkline coin={coin} />
                        </div>
                      </TableCell>

                      {/* Volume */}
                      <TableCell className="py-2.5 text-right num-secondary text-[11px] hidden xl:table-cell tabular-nums">
                        {formatLargeNumber(coin.volume24h)}
                      </TableCell>

                      {/* Market Cap */}
                      <TableCell className="py-2.5 text-right num-secondary text-[11px] hidden md:table-cell tabular-nums">
                        {formatLargeNumber(coin.marketCap)}
                      </TableCell>

                      {/* Watchlist star */}
                      <TableCell
                        className="py-2.5 pr-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleWatchlist(coin.symbol)}
                          className={`transition-all duration-150 hover:scale-110 ${
                            isInWatchlist(coin.symbol)
                              ? "text-yellow-400"
                              : "text-muted-foreground/25 hover:text-yellow-400"
                          }`}
                        >
                          <Star
                            className="w-3.5 h-3.5"
                            fill={
                              isInWatchlist(coin.symbol)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>

        {!isLoading && sortedCoins.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-20 gap-3"
            data-ocid="markets.empty_state"
          >
            <BarChart2 className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm">
              {search
                ? "No coins match your search"
                : "No market data available"}
            </p>
          </div>
        )}
      </div>

      <CoinDetailSheet
        coin={selectedCoin}
        open={!!selectedCoin}
        onClose={() => setSelectedCoin(null)}
        inWatchlist={selectedCoin ? isInWatchlist(selectedCoin.symbol) : false}
        onToggleWatchlist={() =>
          selectedCoin && handleToggleWatchlist(selectedCoin.symbol)
        }
      />
    </div>
  );
}
