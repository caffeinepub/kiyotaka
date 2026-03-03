import { Badge } from "@/components/ui/badge";

interface SignalBadgeProps {
  type: string;
  size?: "sm" | "md";
}

const SIGNAL_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  BUY: {
    bg: "bg-gain",
    text: "text-gain",
    border: "border-gain",
  },
  SELL: {
    bg: "bg-loss",
    text: "text-loss",
    border: "border-loss",
  },
  HOLD: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
  },
  NEUTRAL: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
};

export function SignalBadge({ type, size = "md" }: SignalBadgeProps) {
  const colors = SIGNAL_COLORS[type.toUpperCase()] ?? SIGNAL_COLORS.NEUTRAL;

  return (
    <Badge
      variant="outline"
      className={`
        ${colors.bg} ${colors.text} ${colors.border}
        font-mono font-bold tracking-wider
        ${size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"}
      `}
    >
      {type.toUpperCase()}
    </Badge>
  );
}
