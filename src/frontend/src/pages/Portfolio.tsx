import type { Coin, Holding } from "@/backend.d.ts";
import { ChangeCell } from "@/components/shared/ChangeCell";
import { CoinBadge } from "@/components/shared/CoinBadge";
import { LoginGate } from "@/components/shared/LoginGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import {
  useAddHolding,
  useGetAllCoins,
  useGetHoldings,
  useRemoveHolding,
} from "@/hooks/useQueries";
import {
  formatLargeNumber,
  formatPercent,
  formatPrice,
} from "@/lib/formatters";
import { Briefcase, DollarSign, Plus, Trash2, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useMemo } from "react";
import { toast } from "sonner";

function PortfolioStats({
  holdings,
  coins,
}: {
  holdings: Holding[];
  coins: Coin[];
}) {
  const stats = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;
    for (const h of holdings) {
      const coin = coins.find((c) => c.symbol === h.symbol);
      if (coin) {
        const currentValue = coin.price * h.amount;
        const costBasis = h.buyPrice * h.amount;
        totalValue += currentValue;
        totalCost += costBasis;
      }
    }
    const pnl = totalValue - totalCost;
    const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
    return { totalValue, totalCost, pnl, pnlPct };
  }, [holdings, coins]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Value
            </p>
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {formatLargeNumber(stats.totalValue)}
          </p>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total P&L
            </p>
          </div>
          <p
            className={`font-display text-2xl font-bold ${stats.pnl >= 0 ? "text-gain" : "text-loss"}`}
          >
            {stats.pnl >= 0 ? "+" : ""}
            {formatLargeNumber(stats.pnl)}
          </p>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              P&L %
            </p>
          </div>
          <p
            className={`font-display text-2xl font-bold ${stats.pnlPct >= 0 ? "text-gain" : "text-loss"}`}
          >
            {formatPercent(stats.pnlPct)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AddHoldingForm({
  coins,
  onSubmit,
  isPending,
}: {
  coins: Coin[];
  onSubmit: (h: Holding) => void;
  isPending: boolean;
}) {
  const [symbol, setSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [buyPrice, setBuyPrice] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !amount || !buyPrice) {
      toast.error("Please fill in all fields");
      return;
    }
    const amountN = Number.parseFloat(amount);
    const buyPriceN = Number.parseFloat(buyPrice);
    if (
      Number.isNaN(amountN) ||
      Number.isNaN(buyPriceN) ||
      amountN <= 0 ||
      buyPriceN <= 0
    ) {
      toast.error("Please enter valid numbers");
      return;
    }
    const coin = coins.find((c) => c.symbol === symbol);
    onSubmit({
      symbol,
      name: coin?.name ?? symbol,
      amount: amountN,
      buyPrice: buyPriceN,
    });
    setAmount("");
    setBuyPrice("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="panel p-4 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
    >
      <div className="space-y-1.5">
        <Label
          htmlFor="portfolio-symbol"
          className="text-xs text-muted-foreground"
        >
          Coin
        </Label>
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger
            id="portfolio-symbol"
            className="bg-secondary border-border h-9"
            data-ocid="portfolio.symbol_input"
          >
            <SelectValue placeholder="Select coin" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border max-h-60">
            {coins.map((c) => (
              <SelectItem key={c.symbol} value={c.symbol}>
                <span className="font-mono text-sm">
                  {c.symbol} — {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label
          htmlFor="portfolio-amount"
          className="text-xs text-muted-foreground"
        >
          Amount
        </Label>
        <Input
          id="portfolio-amount"
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-secondary border-border h-9 font-mono"
          data-ocid="portfolio.amount_input"
        />
      </div>
      <div className="space-y-1.5">
        <Label
          htmlFor="portfolio-buyprice"
          className="text-xs text-muted-foreground"
        >
          Buy Price (USD)
        </Label>
        <Input
          id="portfolio-buyprice"
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
          value={buyPrice}
          onChange={(e) => setBuyPrice(e.target.value)}
          className="bg-secondary border-border h-9 font-mono"
          data-ocid="portfolio.buyprice_input"
        />
      </div>
      <Button
        type="submit"
        disabled={isPending}
        className="h-9 gap-2"
        data-ocid="portfolio.submit_button"
      >
        {isPending ? (
          <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        Add Holding
      </Button>
    </form>
  );
}

export function Portfolio() {
  const { identity, loginStatus } = useInternetIdentity();
  const isLoggedIn = loginStatus === "success" && !!identity;

  const { data: holdings = [], isLoading: holdingsLoading } = useGetHoldings();
  const { data: coins = [] } = useGetAllCoins();
  const addHolding = useAddHolding();
  const removeHolding = useRemoveHolding();

  if (!isLoggedIn) {
    return (
      <div className="p-6">
        <LoginGate
          title="Portfolio Access Required"
          description="Connect your identity to track your crypto portfolio and P&L."
        />
      </div>
    );
  }

  const handleAdd = async (holding: Holding) => {
    try {
      await addHolding.mutateAsync(holding);
      toast.success(`${holding.symbol} added to portfolio`);
    } catch {
      toast.error("Failed to add holding");
    }
  };

  const handleRemove = async (symbol: string) => {
    try {
      await removeHolding.mutateAsync(symbol);
      toast.success(`${symbol} removed from portfolio`);
    } catch {
      toast.error("Failed to remove holding");
    }
  };

  const enrichedHoldings = holdings.map((h) => {
    const coin = coins.find((c) => c.symbol === h.symbol);
    const currentPrice = coin?.price ?? h.buyPrice;
    const currentValue = currentPrice * h.amount;
    const costBasis = h.buyPrice * h.amount;
    const pnl = currentValue - costBasis;
    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    return { ...h, currentPrice, currentValue, costBasis, pnl, pnlPct };
  });

  const totalValue = enrichedHoldings.reduce(
    (sum, h) => sum + h.currentValue,
    0,
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold text-foreground">
          Portfolio
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Track your crypto holdings and performance
        </p>
      </div>

      {holdings.length > 0 && (
        <PortfolioStats holdings={holdings} coins={coins} />
      )}

      <AddHoldingForm
        coins={coins}
        onSubmit={handleAdd}
        isPending={addHolding.isPending}
      />

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <Table data-ocid="portfolio.table">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Coin</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
                <TableHead className="text-xs text-right hidden sm:table-cell">
                  Buy Price
                </TableHead>
                <TableHead className="text-xs text-right">
                  Current Price
                </TableHead>
                <TableHead className="text-xs text-right hidden md:table-cell">
                  Value
                </TableHead>
                <TableHead className="text-xs text-right">P&L</TableHead>
                <TableHead className="text-xs text-right w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdingsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
                  <TableRow key={i} className="border-border">
                    {Array.from({ length: 7 }).map((_, j) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cells
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : enrichedHoldings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div
                      className="flex flex-col items-center justify-center py-16 gap-3"
                      data-ocid="portfolio.empty_state"
                    >
                      <Briefcase className="w-10 h-10 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">
                        No holdings yet. Add your first position above.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {enrichedHoldings.map((h, idx) => (
                    <TableRow
                      key={h.symbol}
                      data-ocid={`portfolio.holding.item.${idx + 1}`}
                      className="border-border/50"
                    >
                      <TableCell>
                        <CoinBadge symbol={h.symbol} name={h.name} size="sm" />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {h.amount.toLocaleString("en-US", {
                          maximumFractionDigits: 8,
                        })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                        {formatPrice(h.buyPrice)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPrice(h.currentPrice)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm hidden md:table-cell">
                        {formatLargeNumber(h.currentValue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-mono text-sm ${h.pnl >= 0 ? "text-gain" : "text-loss"}`}
                          >
                            {h.pnl >= 0 ? "+" : ""}
                            {formatLargeNumber(h.pnl)}
                          </span>
                          <ChangeCell
                            value={h.pnlPct}
                            className="text-xs justify-end"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-loss hover:bg-loss/10"
                          onClick={() => handleRemove(h.symbol)}
                          disabled={removeHolding.isPending}
                          data-ocid={`portfolio.holding.delete_button.${idx + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow className="border-border/50 bg-secondary/30 font-medium">
                    <TableCell
                      colSpan={4}
                      className="text-sm font-display font-bold text-foreground"
                    >
                      Total Portfolio
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold hidden md:table-cell">
                      {formatLargeNumber(totalValue)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold text-foreground">
                      {formatLargeNumber(totalValue)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
