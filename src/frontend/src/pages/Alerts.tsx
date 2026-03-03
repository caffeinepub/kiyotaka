import type { Alert } from "@/backend.d.ts";
import { CoinBadge } from "@/components/shared/CoinBadge";
import { LoginGate } from "@/components/shared/LoginGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import {
  useAddAlert,
  useGetAlerts,
  useGetAllCoins,
  useRemoveAlert,
  useToggleAlert,
} from "@/hooks/useQueries";
import { formatPrice } from "@/lib/formatters";
import { ArrowDown, ArrowUp, Bell, BellOff, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

function AddAlertForm({
  coins,
  onSubmit,
  isPending,
}: {
  coins: { symbol: string; name: string }[];
  onSubmit: (a: Alert) => void;
  isPending: boolean;
}) {
  const [symbol, setSymbol] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState("above");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !targetPrice) {
      toast.error("Please fill in all fields");
      return;
    }
    const price = Number.parseFloat(targetPrice);
    if (Number.isNaN(price) || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    onSubmit({ symbol, targetPrice: price, direction, active: true });
    setTargetPrice("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="panel p-4 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
    >
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Coin</Label>
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger
            className="bg-secondary border-border h-9"
            data-ocid="alerts.symbol_input"
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
        <Label className="text-xs text-muted-foreground">
          Target Price (USD)
        </Label>
        <Input
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          className="bg-secondary border-border h-9 font-mono"
          data-ocid="alerts.price_input"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Direction</Label>
        <Select value={direction} onValueChange={setDirection}>
          <SelectTrigger
            className="bg-secondary border-border h-9"
            data-ocid="alerts.direction_select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="above">
              <span className="flex items-center gap-1.5">
                <ArrowUp className="w-3.5 h-3.5 text-gain" />
                Above
              </span>
            </SelectItem>
            <SelectItem value="below">
              <span className="flex items-center gap-1.5">
                <ArrowDown className="w-3.5 h-3.5 text-loss" />
                Below
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        type="submit"
        disabled={isPending}
        className="h-9 gap-2"
        data-ocid="alerts.submit_button"
      >
        {isPending ? (
          <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        Add Alert
      </Button>
    </form>
  );
}

export function Alerts() {
  const { identity, loginStatus } = useInternetIdentity();
  const isLoggedIn = loginStatus === "success" && !!identity;

  const { data: alerts = [], isLoading } = useGetAlerts();
  const { data: coins = [] } = useGetAllCoins();
  const addAlert = useAddAlert();
  const removeAlert = useRemoveAlert();
  const toggleAlert = useToggleAlert();

  if (!isLoggedIn) {
    return (
      <div className="p-6">
        <LoginGate
          title="Alerts Access Required"
          description="Connect your identity to set up price alerts for your favorite cryptocurrencies."
        />
      </div>
    );
  }

  const handleAdd = async (alert: Alert) => {
    try {
      await addAlert.mutateAsync(alert);
      toast.success(
        `Alert set for ${alert.symbol} ${alert.direction} ${formatPrice(alert.targetPrice)}`,
      );
    } catch {
      toast.error("Failed to add alert");
    }
  };

  const handleRemove = async (symbol: string) => {
    try {
      await removeAlert.mutateAsync(symbol);
      toast.success("Alert removed");
    } catch {
      toast.error("Failed to remove alert");
    }
  };

  const handleToggle = async (symbol: string) => {
    try {
      await toggleAlert.mutateAsync(symbol);
    } catch {
      toast.error("Failed to toggle alert");
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold text-foreground">
          Price Alerts
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Get notified when coins reach your target prices
        </p>
      </div>

      <AddAlertForm
        coins={coins}
        onSubmit={handleAdd}
        isPending={addAlert.isPending}
      />

      <div className="panel" data-ocid="alerts.list">
        {isLoading ? (
          <div className="p-4 space-y-3" data-ocid="alerts.loading_state">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 gap-3"
            data-ocid="alerts.empty_state"
          >
            <BellOff className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              No alerts set. Create your first price alert above.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {alerts.map((alert, idx) => (
              <motion.div
                key={alert.symbol}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ delay: idx * 0.04 }}
                data-ocid={`alerts.item.${idx + 1}`}
                className="flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CoinBadge symbol={alert.symbol} size="sm" />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-foreground font-medium">
                        {formatPrice(alert.targetPrice)}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          alert.direction === "above"
                            ? "text-gain border-gain bg-gain/10 text-xs"
                            : "text-loss border-loss bg-loss/10 text-xs"
                        }
                      >
                        {alert.direction === "above" ? (
                          <ArrowUp className="w-2.5 h-2.5 mr-1" />
                        ) : (
                          <ArrowDown className="w-2.5 h-2.5 mr-1" />
                        )}
                        {alert.direction}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          alert.active
                            ? "text-primary border-primary/30 bg-primary/10 text-xs"
                            : "text-muted-foreground border-border text-xs"
                        }
                      >
                        {alert.active ? (
                          <>
                            <Bell className="w-2.5 h-2.5 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <BellOff className="w-2.5 h-2.5 mr-1" />
                            Paused
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <Switch
                    checked={alert.active}
                    onCheckedChange={() => handleToggle(alert.symbol)}
                    data-ocid={`alerts.toggle.${idx + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-loss hover:bg-loss/10"
                    onClick={() => handleRemove(alert.symbol)}
                    disabled={removeAlert.isPending}
                    data-ocid={`alerts.delete_button.${idx + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
