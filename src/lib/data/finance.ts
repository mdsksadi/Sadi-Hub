import { logDataError } from "@/lib/data/log";
import { createClient } from "@/lib/supabase/server";
import type {
  Account,
  AccountBalance,
  AccountTransfer,
  Database,
  FinanceCategory,
  FinancialTransaction,
  MonthlyCashflow,
} from "../../../types/supabase";

type ExchangeRate = Database["public"]["Tables"]["exchange_rates"]["Row"];

/** Read-only finance queries. Callers have already resolved the owner. */

export async function getAccounts(ownerId: string): Promise<Account[]> {
  const supabase = await createClient(false);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("owner_id", ownerId)
    .order("name", { ascending: true });
  if (error) {
    logDataError("finance_accounts", error);
    return [];
  }
  return (data ?? []) as Account[];
}

export async function getFinanceCategories(
  ownerId: string,
): Promise<FinanceCategory[]> {
  const supabase = await createClient(false);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("finance_categories")
    .select("*")
    .eq("owner_id", ownerId)
    .order("kind", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    logDataError("finance_categories", error);
    return [];
  }
  return (data ?? []) as FinanceCategory[];
}

export async function getLedger(
  ownerId: string,
  limit = 50,
): Promise<FinancialTransaction[]> {
  const supabase = await createClient(false);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("owner_id", ownerId)
    .order("business_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(200, limit)));
  if (error) {
    logDataError("finance_ledger", error);
    return [];
  }
  return (data ?? []) as FinancialTransaction[];
}

export async function getTransfers(
  ownerId: string,
  limit = 50,
): Promise<AccountTransfer[]> {
  const supabase = await createClient(false);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("account_transfers")
    .select("*")
    .eq("owner_id", ownerId)
    .order("transfer_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(200, limit)));
  if (error) {
    logDataError("finance_transfers", error);
    return [];
  }
  return (data ?? []) as AccountTransfer[];
}

export async function getAccountBalances(
  ownerId: string,
): Promise<AccountBalance[]> {
  const supabase = await createClient(false);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("account_balances_v")
    .select("*")
    .eq("owner_id", ownerId)
    .order("name", { ascending: true });
  if (error) {
    logDataError("finance_account_balances", error);
    return [];
  }
  return (data ?? []) as AccountBalance[];
}

/**
 * Most recent months, returned oldest-first for charts. The view is scoped by
 * RLS; `owner_id` is still filtered explicitly for defence in depth.
 */
export async function getMonthlyCashflow(
  ownerId: string,
  limit = 12,
): Promise<MonthlyCashflow[]> {
  const supabase = await createClient(false);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("monthly_cashflow_v")
    .select("*")
    .eq("owner_id", ownerId)
    .order("month", { ascending: false })
    .limit(Math.max(1, Math.min(36, limit)));
  if (error) {
    logDataError("finance_monthly_cashflow", error);
    return [];
  }
  return ((data ?? []) as MonthlyCashflow[]).reverse();
}

/**
 * Exchange-rate snapshots are global, not owner-scoped rows; RLS still limits
 * them to authenticated owners. They are never mixed with owner filters that
 * the table does not have.
 */
export async function getExchangeRates(limit = 50): Promise<ExchangeRate[]> {
  const supabase = await createClient(false);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("*")
    .order("effective_date", { ascending: false })
    .limit(Math.max(1, Math.min(200, limit)));
  if (error) {
    logDataError("finance_exchange_rates", error);
    return [];
  }
  return (data ?? []) as ExchangeRate[];
}

export type FinanceOverview = {
  accounts: Account[];
  categories: FinanceCategory[];
  balances: AccountBalance[];
  ledger: FinancialTransaction[];
  transfers: AccountTransfer[];
  cashflow: MonthlyCashflow[];
  exchangeRates: ExchangeRate[];
};

export async function getFinanceOverview(
  ownerId: string,
  ledgerLimit = 8,
): Promise<FinanceOverview> {
  const [accounts, categories, balances, ledger, transfers, cashflow, rates] =
    await Promise.all([
      getAccounts(ownerId),
      getFinanceCategories(ownerId),
      getAccountBalances(ownerId),
      getLedger(ownerId, ledgerLimit),
      getTransfers(ownerId, 8),
      getMonthlyCashflow(ownerId),
      getExchangeRates(),
    ]);

  return {
    accounts,
    categories,
    balances,
    ledger,
    transfers,
    cashflow,
    exchangeRates: rates,
  };
}
