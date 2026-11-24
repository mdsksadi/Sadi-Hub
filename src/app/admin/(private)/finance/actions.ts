"use server";

import { revalidateFinance } from "@/lib/admin/finance-revalidate";
import { requireOwner } from "@/lib/auth/owner";
import { friendlyRpcError } from "@/lib/services/rpc-error";
import {
  recordExpense,
  recordIncome,
  recordTransfer,
  saveAccount,
  saveExchangeRate,
  saveFinanceCategory,
} from "@/lib/services/finance";
import { formBoolean, formText } from "@/lib/validation/forms";
import {
  accountSchema,
  exchangeRateSchema,
  expenseSchema,
  financeCategorySchema,
  incomeSchema,
  transferSchema,
} from "@/lib/validation/finance-schemas";
import type { FormState } from "@/lib/validation/schemas";

function failure(message: string): FormState {
  return { status: "error", message };
}

function invalidFields(message: string, detail?: string): FormState {
  return failure(detail ? `${message}: ${detail}` : message);
}

function success(message: string): FormState {
  revalidateFinance();
  return { status: "success", message };
}

function caught(error: unknown, fallback: string): FormState {
  return failure(friendlyRpcError(error, fallback));
}

export async function saveAccountAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = accountSchema.safeParse({
    id: formText(formData, "id"),
    name: formText(formData, "name"),
    countryCode: formText(formData, "countryCode"),
    currencyCode: formText(formData, "currencyCode"),
    accountType: formText(formData, "accountType"),
    openingBalance: formText(formData, "openingBalance"),
    openingDate: formText(formData, "openingDate"),
    description: formText(formData, "description"),
    isActive: formBoolean(formData, "isActive"),
  });
  if (!parsed.success) {
    return invalidFields(
      "Check the account fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await saveAccount(owner.userId, parsed.data);
  } catch (error) {
    return caught(error, "Could not save the account.");
  }
  return success("Account saved.");
}

export async function saveFinanceCategoryAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = financeCategorySchema.safeParse({
    id: formText(formData, "id"),
    name: formText(formData, "name"),
    kind: formText(formData, "kind"),
    parentId: formText(formData, "parentId"),
    icon: formText(formData, "icon"),
    isActive: formBoolean(formData, "isActive"),
  });
  if (!parsed.success) {
    return invalidFields(
      "Check the category fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await saveFinanceCategory(owner.userId, parsed.data);
  } catch (error) {
    return caught(error, "Could not save the category.");
  }
  return success("Category saved.");
}

function movementInput(formData: FormData) {
  return {
    accountId: formText(formData, "accountId"),
    amount: formText(formData, "amount"),
    businessDate: formText(formData, "businessDate"),
    categoryId: formText(formData, "categoryId"),
    description: formText(formData, "description"),
    notes: formText(formData, "notes"),
    referenceNumber: formText(formData, "referenceNumber"),
  };
}

export async function recordIncomeAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = incomeSchema.safeParse(movementInput(formData));
  if (!parsed.success) {
    return invalidFields(
      "Check the income fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await recordIncome(owner.userId, parsed.data);
  } catch (error) {
    return caught(error, "Could not record the income.");
  }
  return success("Income recorded.");
}

export async function recordExpenseAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = expenseSchema.safeParse(movementInput(formData));
  if (!parsed.success) {
    return invalidFields(
      "Check the expense fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await recordExpense(owner.userId, parsed.data);
  } catch (error) {
    return caught(error, "Could not record the expense.");
  }
  return success("Expense recorded.");
}

export async function recordTransferAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = transferSchema.safeParse({
    sourceAccountId: formText(formData, "sourceAccountId"),
    destinationAccountId: formText(formData, "destinationAccountId"),
    sourceAmount: formText(formData, "sourceAmount"),
    destinationAmount: formText(formData, "destinationAmount"),
    exchangeRate: formText(formData, "exchangeRate"),
    feeAmount: formText(formData, "feeAmount"),
    transferDate: formText(formData, "transferDate"),
    referenceNumber: formText(formData, "referenceNumber"),
    notes: formText(formData, "notes"),
  });
  if (!parsed.success) {
    return invalidFields(
      "Check the transfer fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await recordTransfer(owner.userId, parsed.data);
  } catch (error) {
    return caught(error, "Could not record the transfer.");
  }
  return success("Transfer recorded.");
}

export async function saveExchangeRateAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const parsed = exchangeRateSchema.safeParse({
    fromCurrency: formText(formData, "fromCurrency"),
    toCurrency: formText(formData, "toCurrency"),
    rate: formText(formData, "rate"),
    effectiveDate: formText(formData, "effectiveDate"),
    source: formText(formData, "source"),
  });
  if (!parsed.success) {
    return invalidFields(
      "Check the exchange rate fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await saveExchangeRate(parsed.data);
  } catch (error) {
    return caught(error, "Could not save the exchange rate.");
  }
  return success("Exchange rate saved.");
}
