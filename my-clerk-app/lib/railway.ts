import "server-only";

type RequestOptions = {
  token?: string | null;
  path: string;
  adminSession?: string | null;
};

export function getRailwayApiBaseUrl() {
  const value =
    process.env.RAILWAY_API_URL ||
    process.env.NEXT_PUBLIC_RAILWAY_API_URL ||
    "https://investieren-production.up.railway.app";

  return value.replace(/\/+$/, "");
}

export async function fetchRailwayJson<T>({
  path,
  token,
  adminSession,
}: RequestOptions): Promise<T> {
  const response = await fetch(`${getRailwayApiBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(adminSession ? { "X-Admin-Session": adminSession } : {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      (payload && typeof payload === "object" && ("detail" in payload || "error" in payload))
        ? String((payload as { detail?: string; error?: string }).detail || (payload as { error?: string }).error)
        : `Railway API request failed (${response.status}).`;
    throw new Error(detail);
  }

  return payload as T;
}

export type BackendUser = {
  id: number;
  auth_subject: string;
  provider: string;
  email?: string | null;
  name?: string | null;
  picture_url?: string | null;
  is_admin?: boolean;
};

export type BillingSubscription = {
  active: boolean;
  status: string;
  plan_name: string;
  amount_cents: number;
  currency: string;
  interval: string;
  cancel_at_period_end: boolean;
  current_period_end?: string | null;
};

export type WatchlistItem = {
  symbol: string;
  name: string;
  exchange?: string | null;
  price?: number | null;
  change_percent?: number | null;
  stale: boolean;
  no_data: boolean;
};

export type SymbolOverview = {
  symbol: string;
  name: string;
  exchange?: string | null;
  logo?: string | null;
  weburl?: string | null;
  price?: number | null;
  change_percent?: number | null;
  high?: number | null;
  low?: number | null;
  open?: number | null;
  previous_close?: number | null;
  stale: boolean;
  no_data: boolean;
};
