import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Alert, Candle, Coin, Holding, Signal } from "../backend.d.ts";
import { useActor } from "./useActor";

// Re-export types for convenience
export type { Alert, Candle, Holding, Signal, Coin };

export function useGetAllCoins() {
  const { actor, isFetching } = useActor();
  return useQuery<Coin[]>({
    queryKey: ["allCoins"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllCoins();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useGetTopGainers() {
  const { actor, isFetching } = useActor();
  return useQuery<Coin[]>({
    queryKey: ["topGainers"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTopGainers();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useGetTopLosers() {
  const { actor, isFetching } = useActor();
  return useQuery<Coin[]>({
    queryKey: ["topLosers"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTopLosers();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useGetMarketSentiment() {
  const { actor, isFetching } = useActor();
  return useQuery<number>({
    queryKey: ["marketSentiment"],
    queryFn: async () => {
      if (!actor) return 50;
      return actor.getMarketSentiment();
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000,
  });
}

export function useGetWatchlist() {
  const { actor, isFetching } = useActor();
  return useQuery<string[]>({
    queryKey: ["watchlist"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getWatchlist();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetSignals() {
  const { actor, isFetching } = useActor();
  return useQuery<Signal[]>({
    queryKey: ["signals"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSignals();
    },
    enabled: !!actor && !isFetching,
    staleTime: 15_000,
  });
}

export function useGetHoldings() {
  const { actor, isFetching } = useActor();
  return useQuery<Holding[]>({
    queryKey: ["holdings"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getHoldings();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetAlerts() {
  const { actor, isFetching } = useActor();
  return useQuery<Alert[]>({
    queryKey: ["alerts"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAlerts();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useIsCallerAdmin() {
  const { actor, isFetching } = useActor();
  return useQuery<boolean>({
    queryKey: ["isAdmin"],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !isFetching,
  });
}

// Mutations
export function useAddToWatchlist() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) => actor!.addToWatchlist(symbol),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

export function useRemoveFromWatchlist() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) => actor!.removeFromWatchlist(symbol),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

export function useAddHolding() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (holding: Holding) => actor!.addHolding(holding),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["holdings"] }),
  });
}

export function useRemoveHolding() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) => actor!.removeHolding(symbol),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["holdings"] }),
  });
}

export function useUpdateHolding() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      symbol,
      amount,
      buyPrice,
    }: {
      symbol: string;
      amount: number;
      buyPrice: number;
    }) => actor!.updateHolding(symbol, amount, buyPrice),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["holdings"] }),
  });
}

export function useAddAlert() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alert: Alert) => actor!.addAlert(alert),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useRemoveAlert() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) => actor!.removeAlert(symbol),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useToggleAlert() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) => actor!.toggleAlert(symbol),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useCreateSignal() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      title,
      body,
      symbol,
      signalType,
    }: {
      title: string;
      body: string;
      symbol: string;
      signalType: string;
    }) => actor!.createSignal(title, body, symbol, signalType),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signals"] }),
  });
}

export function useGetCandleData(symbol: string, timeframe: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Candle[]>({
    queryKey: ["candles", symbol, timeframe],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getCandleData(symbol, timeframe);
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000,
  });
}

export function useDeleteSignal() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: bigint) => actor!.deleteSignal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signals"] }),
  });
}
