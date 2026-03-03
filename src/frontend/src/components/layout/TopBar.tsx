import type { Coin } from "@/backend.d.ts";
import { useGetAllCoins } from "@/hooks/useQueries";
import { formatLargeNumber, formatPercent } from "@/lib/formatters";
import { Activity, Bitcoin, TrendingUp } from "lucide-react";
import { useMemo } from "react";

export function TopBar() {
  const { data: coins } = useGetAllCoins();

  const stats = useMemo(() => {
    if (!coins || coins.length === 0) {
      return { totalMarketCap: 0, totalVolume: 0, btcDominance: 0 };
    }
    const totalMarketCap = coins.reduce(
      (sum: number, c: Coin) => sum + c.marketCap,
      0,
    );
    const totalVolume = coins.reduce(
      (sum: number, c: Coin) => sum + c.volume24h,
      0,
    );
    const btc = coins.find((c: Coin) => c.symbol === "BTC");
    const btcDominance =
      totalMarketCap > 0 && btc ? (btc.marketCap / totalMarketCap) * 100 : 0;
    return { totalMarketCap, totalVolume, btcDominance };
  }, [coins]);

  return (
    <div
      className="h-8 flex items-center px-4 gap-5 text-[11px] overflow-x-auto flex-shrink-0 border-b border-sidebar-border"
      style={{ background: "oklch(0.075 0.020 268)" }}
    >
      <Stat
        icon={<Activity className="w-2.5 h-2.5 text-primary" />}
        label="Mkt Cap"
        value={formatLargeNumber(stats.totalMarketCap)}
      />
      <Divider />
      <Stat
        icon={<TrendingUp className="w-2.5 h-2.5 text-primary" />}
        label="24h Vol"
        value={formatLargeNumber(stats.totalVolume)}
      />
      <Divider />
      <Stat
        icon={<Bitcoin className="w-2.5 h-2.5" style={{ color: "#F7931A" }} />}
        label="BTC Dom"
        value={formatPercent(stats.btcDominance).replace("+", "")}
      />
      {coins && coins.length > 0 && (
        <>
          <Divider />
          <Stat label="Assets" value={String(coins.length)} />
        </>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      {icon}
      <span className="text-muted-foreground/50 tracking-wider uppercase text-[10px] font-mono">
        {label}
      </span>
      <span className="font-mono font-medium text-foreground/80 tabular-nums">
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-3 bg-sidebar-border flex-shrink-0" />;
}
