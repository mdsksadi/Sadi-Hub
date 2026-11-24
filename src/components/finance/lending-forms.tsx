"use client";

import { useActionState, useState } from "react";
import {
  saveContactAction,
  setContactArchivedAction,
} from "@/app/admin/(private)/finance/contacts/actions";
import {
  createLoanGivenAction,
  recordLoanGivenRepaymentAction,
} from "@/app/admin/(private)/finance/lending/actions";
import {
  createLoanTakenAction,
  recordLoanTakenRepaymentAction,
} from "@/app/admin/(private)/finance/borrowing/actions";
import { formatMoney } from "@/lib/domain/money";
import type { FormState } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { Account, Contact } from "../../../types/supabase";

const initialState: FormState = { status: "idle" };

type AccountOption = Pick<Account, "id" | "name" | "currency_code">;
type ContactOption = Pick<Contact, "id" | "full_name">;

function Feedback({ state, pending }: { state: FormState; pending: boolean }) {
  if (state.status === "idle" && !pending) return null;
  const tone =
    state.status === "error"
      ? "text-red-600"
      : state.status === "success"
        ? "text-emerald-600"
        : "text-muted-foreground";
  return (
    <p role="status" className={`${tone} text-sm`}>
      {pending ? "Saving…" : state.message}
    </p>
  );
}

export function ContactForm({ contact }: { contact?: Contact | null }) {
  const [state, action, pending] = useActionState(
    saveContactAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={contact?.id ?? ""} />
      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          required
          maxLength={100}
          defaultValue={contact?.full_name ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="contactType">Type</Label>
        <Select
          id="contactType"
          name="contactType"
          defaultValue={contact?.contact_type ?? "individual"}
        >
          <option value="individual">Individual</option>
          <option value="organization">Organization</option>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            maxLength={40}
            defaultValue={contact?.phone ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            maxLength={200}
            defaultValue={contact?.email ?? ""}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          name="address"
          maxLength={200}
          defaultValue={contact?.address ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="countryCode">Country code</Label>
        <Input
          id="countryCode"
          name="countryCode"
          maxLength={3}
          placeholder="BD"
          defaultValue={contact?.country_code ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={contact?.notes ?? ""}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="archived"
          defaultChecked={Boolean(contact?.archived_at)}
        />
        Archived (kept for history, hidden from new forms where possible)
      </label>
      <Feedback state={state} pending={pending} />
      <Button type="submit" disabled={pending}>
        {contact ? "Save contact" : "Add contact"}
      </Button>
    </form>
  );
}

export function ContactArchiveToggle({
  contact,
}: {
  contact: Pick<Contact, "id" | "archived_at" | "full_name">;
}) {
  const [state, action, pending] = useActionState(
    setContactArchivedAction,
    initialState,
  );
  const archived = Boolean(contact.archived_at);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={contact.id} />
      <input type="hidden" name="archived" value={archived ? "" : "true"} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {archived ? "Restore" : "Archive"}
        <span className="sr-only"> {contact.full_name}</span>
      </Button>
      <Feedback state={state} pending={pending} />
    </form>
  );
}

export function LoanGivenForm({
  contacts,
  accounts,
  today,
}: {
  contacts: ContactOption[];
  accounts: AccountOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState(
    createLoanGivenAction,
    initialState,
  );
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const currency =
    accounts.find((account) => account.id === accountId)?.currency_code ?? "";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="currencyCode" value={currency} />
      <div>
        <Label htmlFor="given-contact">Contact</Label>
        <Select
          id="given-contact"
          name="contactId"
          required
          defaultValue={contacts[0]?.id ?? ""}
        >
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.full_name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="given-amount">Amount</Label>
          <Input
            id="given-amount"
            name="amount"
            inputMode="decimal"
            placeholder="1000.00"
            required
          />
        </div>
        <div>
          <Label htmlFor="given-date">Date given</Label>
          <Input
            id="given-date"
            name="dateGiven"
            type="date"
            defaultValue={today}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="given-account">Source account</Label>
        <Select
          id="given-account"
          name="sourceAccountId"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          required
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currency_code})
            </option>
          ))}
        </Select>
        <p className="text-muted-foreground mt-1 text-xs">
          Currency follows the account: {currency || "select an account"}
        </p>
      </div>
      <div>
        <Label htmlFor="given-due">Expected repayment date</Label>
        <Input id="given-due" name="expectedRepaymentDate" type="date" />
      </div>
      <div>
        <Label htmlFor="given-reason">Reason</Label>
        <Input id="given-reason" name="reason" maxLength={300} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="given-method">Payment method</Label>
          <Input id="given-method" name="paymentMethod" maxLength={80} />
        </div>
        <div>
          <Label htmlFor="given-reference">Reference</Label>
          <Input id="given-reference" name="referenceNumber" maxLength={120} />
        </div>
      </div>
      <div>
        <Label htmlFor="given-notes">Notes</Label>
        <Textarea id="given-notes" name="notes" rows={2} maxLength={1000} />
      </div>
      <Feedback state={state} pending={pending} />
      <Button type="submit" disabled={pending}>
        Record loan given
      </Button>
    </form>
  );
}

export function LoanTakenForm({
  contacts,
  accounts,
  today,
}: {
  contacts: ContactOption[];
  accounts: AccountOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState(
    createLoanTakenAction,
    initialState,
  );
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const currency =
    accounts.find((account) => account.id === accountId)?.currency_code ?? "";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="currencyCode" value={currency} />
      <div>
        <Label htmlFor="taken-lender">Lender</Label>
        <Select
          id="taken-lender"
          name="lenderContactId"
          required
          defaultValue={contacts[0]?.id ?? ""}
        >
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.full_name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="taken-amount">Amount</Label>
          <Input
            id="taken-amount"
            name="amount"
            inputMode="decimal"
            placeholder="1000.00"
            required
          />
        </div>
        <div>
          <Label htmlFor="taken-date">Date borrowed</Label>
          <Input
            id="taken-date"
            name="dateBorrowed"
            type="date"
            defaultValue={today}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="taken-account">Receiving account</Label>
        <Select
          id="taken-account"
          name="receivingAccountId"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          required
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currency_code})
            </option>
          ))}
        </Select>
        <p className="text-muted-foreground mt-1 text-xs">
          Currency follows the account: {currency || "select an account"}
        </p>
      </div>
      <div>
        <Label htmlFor="taken-due">Expected repayment date</Label>
        <Input id="taken-due" name="expectedRepaymentDate" type="date" />
      </div>
      <div>
        <Label htmlFor="taken-reason">Reason</Label>
        <Input id="taken-reason" name="reason" maxLength={300} />
      </div>
      <div>
        <Label htmlFor="taken-agreement">Agreement details</Label>
        <Textarea
          id="taken-agreement"
          name="agreementDetails"
          rows={2}
          maxLength={1000}
        />
      </div>
      <div>
        <Label htmlFor="taken-notes">Notes</Label>
        <Textarea id="taken-notes" name="notes" rows={2} maxLength={1000} />
      </div>
      <Feedback state={state} pending={pending} />
      <Button type="submit" disabled={pending}>
        Record loan taken
      </Button>
    </form>
  );
}

/**
 * Compact per-loan repayment form. Only accounts in the loan currency are
 * offered, and the RPC re-checks the currency before writing to the ledger.
 */
export function RepaymentForm({
  mode,
  loanId,
  currency,
  outstanding,
  accounts,
  today,
}: {
  mode: "given" | "taken";
  loanId: string;
  currency: string;
  outstanding: number;
  accounts: AccountOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState(
    mode === "given"
      ? recordLoanGivenRepaymentAction
      : recordLoanTakenRepaymentAction,
    initialState,
  );
  const eligible = accounts.filter(
    (account) => account.currency_code.toUpperCase() === currency.toUpperCase(),
  );
  const [accountId, setAccountId] = useState(eligible[0]?.id ?? "");
  const accountName =
    mode === "given" ? "receivingAccountId" : "sourceAccountId";
  const dateName = mode === "given" ? "repaymentDate" : "paymentDate";

  if (outstanding <= 0) {
    return <p className="text-muted-foreground text-xs">Fully repaid.</p>;
  }

  return (
    <form action={action} className="mt-3 space-y-2 rounded-md border p-3">
      <input type="hidden" name="loanId" value={loanId} />
      <p className="text-muted-foreground text-xs">
        Outstanding: {formatMoney(outstanding, currency)}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <Label htmlFor={`${loanId}-repayment-amount`}>Amount</Label>
          <Input
            id={`${loanId}-repayment-amount`}
            name="amount"
            inputMode="decimal"
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <Label htmlFor={`${loanId}-repayment-date`}>Date</Label>
          <Input
            id={`${loanId}-repayment-date`}
            name={dateName}
            type="date"
            defaultValue={today}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${loanId}-repayment-account`}>Account</Label>
          <Select
            id={`${loanId}-repayment-account`}
            name={accountName}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            required
          >
            {eligible.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Feedback state={state} pending={pending} />
      <Button
        type="submit"
        size="sm"
        disabled={pending || eligible.length === 0}
      >
        {mode === "given" ? "Add repayment received" : "Add repayment paid"}
      </Button>
      {eligible.length === 0 && (
        <p className="text-muted-foreground text-xs">
          No active {currency} account is available for this repayment.
        </p>
      )}
    </form>
  );
}
