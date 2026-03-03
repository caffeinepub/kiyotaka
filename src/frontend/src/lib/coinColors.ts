export const COIN_COLORS: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  BNB: "#F3BA2F",
  SOL: "#9945FF",
  XRP: "#346AA9",
  ADA: "#0033AD",
  DOGE: "#C3A634",
  AVAX: "#E84142",
  MATIC: "#8247E5",
  POL: "#8247E5",
  DOT: "#E6007A",
  LINK: "#2A5ADA",
  LTC: "#BFBBBB",
  UNI: "#FF007A",
  ATOM: "#2E3148",
  TRX: "#EF0027",
  NEAR: "#00C08B",
  ICP: "#3B00B9",
  FIL: "#0090FF",
  APT: "#00C2FF",
  OP: "#FF0420",
  ARB: "#28A0F0",
  SAND: "#04ADEF",
  MANA: "#FF2D55",
  AAVE: "#B6509E",
  CRO: "#002D74",
};

export function getCoinColor(symbol: string): string {
  return COIN_COLORS[symbol.toUpperCase()] ?? "#6B7280";
}

export function getCoinInitials(symbol: string): string {
  return symbol.slice(0, 3).toUpperCase();
}
