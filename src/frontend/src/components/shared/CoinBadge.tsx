import { getCoinColor, getCoinInitials } from "@/lib/coinColors";

interface CoinBadgeProps {
  symbol: string;
  name?: string;
  size?: "sm" | "md" | "lg";
}

export function CoinBadge({ symbol, name, size = "md" }: CoinBadgeProps) {
  const color = getCoinColor(symbol);
  const initials = getCoinInitials(symbol);

  const sizeClasses = {
    sm: "w-7 h-7 text-[10px]",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-sm",
  };

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-mono font-bold flex-shrink-0`}
        style={{
          backgroundColor: `${color}22`,
          border: `1px solid ${color}55`,
          color: color,
        }}
      >
        {initials}
      </div>
      {name && (
        <div className="flex flex-col">
          <span className="font-medium text-foreground text-sm leading-tight">
            {name}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {symbol}
          </span>
        </div>
      )}
    </div>
  );
}
