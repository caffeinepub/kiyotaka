import { formatPercent } from "@/lib/formatters";
import { TrendingDown, TrendingUp } from "lucide-react";

interface ChangeCellProps {
  value: number;
  showIcon?: boolean;
  className?: string;
}

export function ChangeCell({
  value,
  showIcon = false,
  className = "",
}: ChangeCellProps) {
  const isPositive = value >= 0;

  return (
    <span
      className={`flex items-center gap-1 font-mono text-sm ${isPositive ? "text-gain" : "text-loss"} ${className}`}
    >
      {showIcon &&
        (isPositive ? (
          <TrendingUp className="w-3.5 h-3.5" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5" />
        ))}
      {formatPercent(value)}
    </span>
  );
}
