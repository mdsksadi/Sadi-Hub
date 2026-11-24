import { roundAmount } from "@/lib/domain/finance";
import { friendlyRpcError } from "@/lib/services/rpc-error";
import { createClient } from "@/lib/supabase/server";
import type {
  AccountInput,
  ExchangeRateInput,
  FinanceCategoryInput,
  MovementInput,
  TransferInput,
} from "@/lib/validation/finance-schemas";

/**
 * PostgREST accepts exact decimal literals as strings. Generated types model
 * NUMERIC columns as numbers, so the cast only shapes TypeScript's view of the
 * value; the string itself is sent unchanged.
 */
function dbNumeric(value: string): number {
  return value as unknown as number;
}

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyRpcError(error, fallback));
}

export async function saveAccount(
  ownerId: string,
  input: AccountInput,
): Promise<void> {
  const supabase = await createClient(true);
  if (!supabase) throw new Error("Supabase is not configured.");

  const row = {
    name: input.name,
    country_code: input.countryCode || null,
    currency_code: input.currencyCode,
    account_type: input.accountType,
    opening_balance: dbNumeric(input.openingBalance),
    opening_date: input.openingDate || null,
    description: input.description || null,
    is_active: input.isActive,
  };

  const result = input.id
    ? await supabase
        .from("accounts")
        .update(row)
        .eq("id", input.id)
        .eq("owner_id", ownerId)
    : await supabase.from("accounts").insert({ ...row, owner_id: ownerId });

  if (result.error) fail(result.error, "Could not save the account.");
}

export async function saveFinanceCategory(
  ownerId: string,
  input: FinanceCategoryInput,
): Promise<void> {
  const supabase = await createClient(true);
  if (!supabase) throw new Error("Supabase is not configured.");

  const row = {
    name: input.name,
    kind: input.kind,
    parent_id: input.parentId || null,
    icon: input.icon || null,
    is_active: input.isActive,
  };

  const result = input.id
    ? await supabase
        .from("finance_categories")
        .update(row)
        .eq("id", input.id)
        .eq("owner_id", ownerId)
    : await supabase
        .from("finance_categories")
        .insert({ ...row, owner_id: ownerId });

  if (result.error) fail(result.error, "Could not save the category.");
}

/** Exchange rates are immutable snapshots; there is no update path. */
export async function saveExchangeRate(
  input: ExchangeRateInput,
): Promise<void> {
  const supabase = await createClient(true);
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.from("exchange_rates").insert({
    from_currency: input.fromCurrency,
    to_currency: input.toCurrency,
    rate: dbNumeric(input.rate),
    effective_date: input.effectiveDate,
    source: input.source,
  });
  if (error) fail(error, "Could not save the exchange rate.");
}

export async function recordIncome(
  ownerId: string,
  input: MovementInput,
): Promise<string> {
  const supabase = await createClient(true);
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("create_income", {
    p_account_id: input.accountId,
    p_amount: input.amount,
    p_business_date: input.businessDate,
    p_category_id: input.categoryId || null,
    p_description: input.description || null,
    p_notes: input.notes || null,
    p_reference_number: input.referenceNumber || null,
  });
  if (error) fail(error, "Could not record the income.");
  if (!data) throw new Error("Could not record the income.");
  void ownerId; // The RPC derives ownership from the verified auth context.
  return data;
}

export async function recordExpense(
  ownerId: string,
  input: MovementInput,
): Promise<string> {
  const supabase = await createClient(true);
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("create_expense", {
    p_account_id: input.accountId,
    p_amount: input.amount,
    p_business_date: input.businessDate,
    p_category_id: input.categoryId || null,
    p_description: input.description || null,
    p_notes: input.notes || null,
    p_reference_number: input.referenceNumber || null,
  });
  if (error) fail(error, "Could not record the expense.");
  if (!data) throw new Error("Could not record the expense.");
  void ownerId; // The RPC derives ownership from the verified auth context.
  return data;
}

export async function recordTransfer(
  ownerId: string,
  input: TransferInput,
): Promise<string> {
  const supabase = await createClient(true);
  if (!supabase) throw new Error("Supabase is not configured.");

  // The RPC enforces the same rule atomically; this lookup gives the form a
  // clear message before the write and picks the effective rate for same-currency transfers.
  const { data: accounts, error: lookupError } = await supabase
    .from("accounts")
    .select("id, currency_code")
    .eq("owner_id", ownerId)
    .in("id", [input.sourceAccountId, input.destinationAccountId]);
  if (lookupError)
    fail(lookupError, "Could not validate the transfer accounts.");

  const currencyById = new Map(
    (accounts ?? []).map((account) => [account.id, account.currency_code]),
  );
  const sourceCurrency = currencyById.get(input.sourceAccountId);
  const destinationCurrency = currencyById.get(input.destinationAccountId);
  if (!sourceCurrency || !destinationCurrency) {
    throw new Error(
      "The selected account no longer exists. Refresh and try again.",
    );
  }

  let effectiveRate = input.exchangeRate;
  if (sourceCurrency === destinationCurrency) {
    const expected = roundAmount(
      Number(input.sourceAmount) - Number(input.feeAmount),
      4,
    );
    if (roundAmount(Number(input.destinationAmount), 4) !== expected) {
      throw new Error(
        "For the same currency, the destination amount must equal the source amount minus the fee.",
      );
    }
    effectiveRate = "1";
  }

  const { data, error } = await supabase.rpc("create_transfer", {
    p_source_account_id: input.sourceAccountId,
    p_destination_account_id: input.destinationAccountId,
    p_source_amount: input.sourceAmount,
    p_destination_amount: input.destinationAmount,
    p_exchange_rate: effectiveRate,
    p_fee_amount: input.feeAmount,
    p_transfer_date: input.transferDate,
    p_reference_number: input.referenceNumber || null,
    p_notes: input.notes || null,
  });
  if (error) fail(error, "Could not record the transfer.");
  if (!data) throw new Error("Could not record the transfer.");
  return data;
}
