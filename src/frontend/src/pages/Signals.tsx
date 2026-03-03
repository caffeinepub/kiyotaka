import { CoinBadge } from "@/components/shared/CoinBadge";
import { SignalBadge } from "@/components/shared/SignalBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateSignal,
  useDeleteSignal,
  useGetSignals,
  useIsCallerAdmin,
} from "@/hooks/useQueries";
import { useGetAllCoins } from "@/hooks/useQueries";
import { formatTimestamp } from "@/lib/formatters";
import { Plus, Radio, Trash2, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

const SIGNAL_TYPES = ["BUY", "SELL", "HOLD", "NEUTRAL"];

export function Signals() {
  const { data: signals = [], isLoading } = useGetSignals();
  const { data: coins = [] } = useGetAllCoins();
  const { data: isAdmin } = useIsCallerAdmin();
  const createSignal = useCreateSignal();
  const deleteSignal = useDeleteSignal();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    symbol: "",
    signalType: "BUY",
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.body || !form.symbol) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      await createSignal.mutateAsync(form);
      toast.success("Signal posted successfully");
      setDialogOpen(false);
      setForm({ title: "", body: "", symbol: "", signalType: "BUY" });
    } catch {
      toast.error("Failed to create signal");
    }
  };

  const handleDelete = async (id: bigint) => {
    try {
      await deleteSignal.mutateAsync(id);
      toast.success("Signal deleted");
    } catch {
      toast.error("Failed to delete signal");
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">
            Trading Signals
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Curated crypto trading signals and analysis
          </p>
        </div>
        {isAdmin && (
          <Button
            className="gap-2"
            onClick={() => setDialogOpen(true)}
            data-ocid="signals.open_modal_button"
          >
            <Plus className="w-4 h-4" />
            Post Signal
          </Button>
        )}
      </div>

      {/* Signals list */}
      <div className="space-y-3" data-ocid="signals.list">
        {isLoading ? (
          ["sk-signal-a", "sk-signal-b", "sk-signal-c", "sk-signal-d"].map(
            (sk) => (
              <div
                key={sk}
                data-ocid="signals.loading_state"
                className="panel p-4"
              >
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ),
          )
        ) : signals.length === 0 ? (
          <div
            className="panel flex flex-col items-center justify-center py-20 gap-4"
            data-ocid="signals.empty_state"
          >
            <Radio className="w-12 h-12 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-muted-foreground text-sm">No signals yet.</p>
              {isAdmin && (
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Post the first signal using the button above.
                </p>
              )}
            </div>
          </div>
        ) : (
          <AnimatePresence>
            {signals.map((signal, idx) => (
              <motion.div
                key={signal.id.toString()}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: idx * 0.04 }}
                data-ocid={`signals.item.${idx + 1}`}
                className="panel p-4 hover:border-primary/20 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <CoinBadge symbol={signal.symbol} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-display font-semibold text-sm text-foreground truncate">
                          {signal.title}
                        </h3>
                        <SignalBadge type={signal.signalType} />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {signal.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground/50 font-mono mt-2">
                        {formatTimestamp(signal.timestamp)}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0 text-muted-foreground hover:text-loss hover:bg-loss/10"
                      onClick={() => handleDelete(signal.id)}
                      disabled={deleteSignal.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Post Signal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="bg-card border-border w-full max-w-md"
          data-ocid="signals.dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Post New Signal
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                placeholder="Signal title..."
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="bg-secondary border-border"
                data-ocid="signals.title_input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Coin</Label>
                <Select
                  value={form.symbol}
                  onValueChange={(v) => setForm((f) => ({ ...f, symbol: v }))}
                >
                  <SelectTrigger
                    className="bg-secondary border-border"
                    data-ocid="signals.symbol_input"
                  >
                    <SelectValue placeholder="Select coin" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-60">
                    {coins.map((c) => (
                      <SelectItem key={c.symbol} value={c.symbol}>
                        <span className="font-mono text-sm">{c.symbol}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Signal Type
                </Label>
                <Select
                  value={form.signalType}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, signalType: v }))
                  }
                >
                  <SelectTrigger
                    className="bg-secondary border-border"
                    data-ocid="signals.type_select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {SIGNAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        <SignalBadge type={t} size="sm" />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Analysis</Label>
              <Textarea
                placeholder="Write your signal analysis..."
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
                className="bg-secondary border-border min-h-[100px] resize-none"
                data-ocid="signals.body_textarea"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-border"
                data-ocid="signals.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createSignal.isPending}
                data-ocid="signals.submit_button"
              >
                {createSignal.isPending ? (
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Post Signal
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
