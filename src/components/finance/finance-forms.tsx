"use client";

import { useActionState } from "react";
import {
  recordExpenseAction,
  recordIncomeAction,
  recordTransferAction,
  saveAccountAction,
  saveExchangeRateAction,
  saveFinanceCategoryAction,
} from "@/app/admin/(private)/finance/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { FormState } from "@/lib/validation/schemas";
import type { Account, FinanceCategory } from "../../../types/supabase";

const initial: FormState = { status: "idle" };

function FormNotice({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={
        state.status === "error"
          ? "text-danger text-sm"
          : "text-primary text-sm"
      }
    >
      {state.message}
    </p>
  );
}

function numberValue(value: number | null | undefined, fallback = ""): string {
  return value == null ? fallback : String(value);
}

function accountLabel(account: Account): string {
  return `${account.name} (${account.currency_code})`;
}

export function AccountForm({ account }: { account?: Account | null }) {
  const [state, action, pending] = useActionState(saveAccountAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={account?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="account-name">Name</Label>
          <Input
            id="account-name"
            name="name"
            required
            maxLength={100}
            defaultValue={account?.name ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="account-currency">Currency</Label>
          <Input
            id="account-currency"
            name="currencyCode"
            required
            maxLength={3}
            placeholder="EUR"
            defaultValue={account?.currency_code ?? "EUR"}
          />
        </div>
        <div>
          <Label htmlFor="account-country">Country code</Label>
          <Input
            id="account-country"
            name="countryCode"
            maxLength={3}
            placeholder="BD"
            defaultValue={account?.country_code ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="account-type">Account type</Label>
          <Select
            id="account-type"
            name="accountType"
            defaultValue={account?.account_type ?? "bank"}
          >
            <option value="bank">Bank</option>
            <option value="savings">Savings</option>
            <option value="cash">Cash</option>
            <option value="mobile_money">Mobile money</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="account-opening">Opening balance</Label>
          <Input
            id="account-opening"
            name="openingBalance"
            type="number"
            step="0.0001"
            required
            defaultValue={numberValue(account?.opening_balance, "0")}
          />
          <p className="text-muted-foreground mt-1 text-xs">
            In the account&apos;s own currency. Negative balances are allowed.
          </p>
        </div>
        <div>
          <Label htmlFor="account-opening-date">Opening date</Label>
          <Input
            id="account-opening-date"
            name="openingDate"
            type="date"
            defaultValue={account?.opening_date ?? ""}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="account-description">Description</Label>
          <Textarea
            id="account-description"
            name="description"
            rows={2}
            maxLength={500}
            defaultValue={account?.description ?? ""}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={account?.is_active ?? true}
            className="h-4 w-4"
          />
          Active account
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : account ? "Save changes" : "Add account"}
        </Button>
        <FormNotice state={state} />
      </div>
    </form>
  );
}

export function FinanceCategoryForm({
  category,
  categories = [],
}: {
  category?: FinanceCategory | null;
  categories?: FinanceCategory[];
}) {
  const [state, action, pending] = useActionState(
    saveFinanceCategoryAction,
    initial,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={category?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            name="name"
            required
            maxLength={100}
            defaultValue={category?.name ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="category-kind">Kind</Label>
          <Select
            id="category-kind"
            name="kind"
            defaultValue={category?.kind ?? "expense"}
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="category-parent">Parent category</Label>
          <Select
            id="category-parent"
            name="parentId"
            defaultValue={category?.parent_id ?? ""}
          >
            <option value="">None</option>
            {categories
              .filter((item) => item.id !== category?.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.kind})
                </option>
              ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="category-icon">Icon</Label>
          <Input
            id="category-icon"
            name="icon"
            maxLength={60}
            placeholder="home"
            defaultValue={category?.icon ?? ""}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={category?.is_active ?? true}
            className="h-4 w-4"
          />
          Active category
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : category ? "Save changes" : "Add category"}
        </Button>
        <FormNotice state={state} />
      </div>
    </form>
  );
}

export function MovementForm({
  kind,
  accounts,
  categories,
}: {
  kind: "income" | "expense";
  accounts: Account[];
  categories: FinanceCategory[];
}) {
  const action = kind === "income" ? recordIncomeAction : recordExpenseAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const options = categories.filter((category) => category.kind === kind);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor={`${kind}-account`}>Account</Label>
          <Select
            id={`${kind}-account`}
            name="accountId"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Choose an account
            </option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {accountLabel(account)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${kind}-amount`}>Amount</Label>
          <Input
            id={`${kind}-amount`}
            name="amount"
            type="number"
            min="0.0001"
            step="0.0001"
            required
            placeholder="0.0000"
          />
        </div>
        <div>
          <Label htmlFor={`${kind}-date`}>Business date</Label>
          <Input id={`${kind}-date`} name="businessDate" type="date" required />
        </div>
        <div>
          <Label htmlFor={`${kind}-category`}>Category</Label>
          <Select id={`${kind}-category`} name="categoryId" defaultValue="">
            <option value="">No category</option>
            {options.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor={`${kind}-description`}>Description</Label>
          <Input
            id={`${kind}-description`}
            name="description"
            maxLength={200}
            placeholder="What happened?"
          />
        </div>
        <div>
          <Label htmlFor={`${kind}-reference`}>Reference number</Label>
          <Input
            id={`${kind}-reference`}
            name="referenceNumber"
            maxLength={100}
          />
        </div>
        <div>
          <Label htmlFor={`${kind}-notes`}>Notes</Label>
          <Textarea
            id={`${kind}-notes`}
            name="notes"
            rows={2}
            maxLength={1000}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : `Record ${kind}`}
        </Button>
        <FormNotice state={state} />
      </div>
    </form>
  );
}

export function TransferForm({ accounts }: { accounts: Account[] }) {
  const [state, action, pending] = useActionState(
    recordTransferAction,
    initial,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="transfer-source">From account</Label>
          <Select
            id="transfer-source"
            name="sourceAccountId"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Choose an account
            </option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {accountLabel(account)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="transfer-destination">To account</Label>
          <Select
            id="transfer-destination"
            name="destinationAccountId"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Choose an account
            </option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {accountLabel(account)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="transfer-source-amount">Amount leaving source</Label>
          <Input
            id="transfer-source-amount"
            name="sourceAmount"
            type="number"
            min="0.0001"
            step="0.0001"
            required
          />
        </div>
        <div>
          <Label htmlFor="transfer-destination-amount">
            Amount arriving destination
          </Label>
          <Input
            id="transfer-destination-amount"
            name="destinationAmount"
            type="number"
            min="0.0001"
            step="0.0001"
            required
          />
        </div>
        <div>
          <Label htmlFor="transfer-rate">Exchange rate</Label>
          <Input
            id="transfer-rate"
            name="exchangeRate"
            type="number"
            min="0.00000001"
            step="0.00000001"
            defaultValue="1"
            required
          />
        </div>
        <div>
          <Label htmlFor="transfer-fee">Fee (source currency)</Label>
          <Input
            id="transfer-fee"
            name="feeAmount"
            type="number"
            min="0"
            step="0.0001"
            defaultValue="0"
            required
          />
        </div>
        <div>
          <Label htmlFor="transfer-date">Transfer date</Label>
          <Input id="transfer-date" name="transferDate" type="date" required />
        </div>
        <div>
          <Label htmlFor="transfer-reference">Reference number</Label>
          <Input
            id="transfer-reference"
            name="referenceNumber"
            maxLength={100}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="transfer-notes">Notes</Label>
          <Textarea
            id="transfer-notes"
            name="notes"
            rows={2}
            maxLength={1000}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Same currency: destination = source − fee. Different currencies: enter
        the applied rate; snapshots are managed under Exchange rates.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record transfer"}
        </Button>
        <FormNotice state={state} />
      </div>
    </form>
  );
}

export function ExchangeRateForm() {
  const [state, action, pending] = useActionState(
    saveExchangeRateAction,
    initial,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="rate-from">From currency</Label>
          <Input
            id="rate-from"
            name="fromCurrency"
            maxLength={3}
            placeholder="EUR"
            required
          />
        </div>
        <div>
          <Label htmlFor="rate-to">To currency</Label>
          <Input
            id="rate-to"
            name="toCurrency"
            maxLength={3}
            placeholder="BDT"
            required
          />
        </div>
        <div>
          <Label htmlFor="rate-value">Rate</Label>
          <Input
            id="rate-value"
            name="rate"
            type="number"
            min="0.00000001"
            step="0.00000001"
            required
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Units of “to” currency per one unit of “from” currency.
          </p>
        </div>
        <div>
          <Label htmlFor="rate-date">Effective date</Label>
          <Input id="rate-date" name="effectiveDate" type="date" required />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="rate-source">Source</Label>
          <Input
            id="rate-source"
            name="source"
            maxLength={100}
            placeholder="Central bank, statement, …"
            required
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add snapshot"}
        </Button>
        <FormNotice state={state} />
      </div>
    </form>
  );
}
