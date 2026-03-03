import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Signal {
    id: bigint;
    title: string;
    body: string;
    timestamp: bigint;
    symbol: string;
    signalType: string;
}
export interface Coin {
    change24h: number;
    circulatingSupply: number;
    marketCap: number;
    name: string;
    rank: bigint;
    volume24h: number;
    change7d: number;
    price: number;
    symbol: string;
}
export interface Holding {
    name: string;
    buyPrice: number;
    amount: number;
    symbol: string;
}
export interface Candle {
    low: number;
    high: number;
    close: number;
    open: number;
    time: bigint;
    volume: number;
}
export interface Alert {
    direction: string;
    active: boolean;
    targetPrice: number;
    symbol: string;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addAlert(alert: Alert): Promise<void>;
    addHolding(holding: Holding): Promise<void>;
    addToWatchlist(symbol: string): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createSignal(title: string, body: string, symbol: string, signalType: string): Promise<void>;
    deleteSignal(id: bigint): Promise<void>;
    getAlerts(): Promise<Array<Alert>>;
    getAllCoins(): Promise<Array<Coin>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCandleData(symbol: string, timeframe: string): Promise<Array<Candle>>;
    getCoin(symbol: string): Promise<Coin>;
    getHoldings(): Promise<Array<Holding>>;
    getMarketSentiment(): Promise<number>;
    getSignals(): Promise<Array<Signal>>;
    getTopGainers(): Promise<Array<Coin>>;
    getTopLosers(): Promise<Array<Coin>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getWatchlist(): Promise<Array<string>>;
    isCallerAdmin(): Promise<boolean>;
    removeAlert(symbol: string): Promise<void>;
    removeFromWatchlist(symbol: string): Promise<void>;
    removeHolding(symbol: string): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    toggleAlert(symbol: string): Promise<void>;
    updateHolding(symbol: string, amount: number, buyPrice: number): Promise<void>;
}
