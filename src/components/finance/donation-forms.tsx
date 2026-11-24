"use client";

import { useActionState, useState } from "react";
import {
  correctDonationAction,
  createDonationAction,
} from "@/app/admin/(private)/finance/donations/actions";
import { formatMoney } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { FormState } from "@/lib/validation/schemas";
import type {
  Account,
  Contact,
  Donation,
  DonationCategory,
} from "../../../types/supabase";

const initialState: FormState = { status: "idle" };

function Feedback({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      className={state.status === "error" ? "text-danger text-sm" : "text-sm"}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

export function DonationCreateForm({
  contacts,
  categories,
  accounts,
}: {
  contacts: Contact[];
  categories: DonationCategory[];
  accounts: Account[];
}) {
  const [state, action, pending] = useActionState(
    createDonationAction,
    initialState,
  );
  const [contactId, setContactId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientType, setRecipientType] = useState<
    "individual" | "organization"
  >("individual");

  function chooseContact(id: string) {
    setContactId(id);
    const contact = contacts.find((item) => item.id === id);
    setRecipientName(contact?.full_name ?? "");
    setRecipientType(contact?.contact_type ?? "individual");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record a donation</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="contactId" value={contactId} />
          <input type="hidden" name="currencyCode" value="" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="donation-contact">Contact (optional)</Label>
              <Select
                id="donation-contact"
                name="contactSelect"
                value={contactId}
                onChange={(event) => chooseContact(event.target.value)}
              >
                <option value="">Type a recipient instead</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.full_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="donation-recipient">Recipient name</Label>
              <Input
                id="donation-recipient"
                name="recipientName"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                maxLength={150}
                placeholder="Name or organization"
                required={!contactId}
              />
            </div>
            <div>
              <Label htmlFor="donation-type">Recipient type</Label>
              <Select
                id="donation-type"
                name="recipientType"
                value={recipientType}
                onChange={(event) =>
                  setRecipientType(
                    event.target.value as "individual" | "organization",
                  )
                }
              >
                <option value="individual">Individual</option>
                <option value="organization">Organization</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="donation-account">Source account</Label>
              <Select
                id="donation-account"
                name="sourceAccountId"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Select an account
                </option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency_code.trim()})
                  </option>
                ))}
              </Select>
              <p className="text-muted-foreground mt-1 text-xs">
                The donation currency follows the selected account.
              </p>
            </div>
            <div>
              <Label htmlFor="donation-amount">Amount</Label>
              <Input
                id="donation-amount"
                name="amount"
                type="number"
                min="0.0001"
                step="0.0001"
                required
              />
            </div>
            <div>
              <Label htmlFor="donation-date">Date</Label>
              <Input
                id="donation-date"
                name="donationDate"
                type="date"
                required
              />
            </div>
            <div>
              <Label htmlFor="donation-category">Category</Label>
              <Select id="donation-category" name="categoryId" defaultValue="">
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="donation-country">Country (optional)</Label>
              <Input
                id="donation-country"
                name="countryCode"
                maxLength={2}
                placeholder="BD"
              />
            </div>
            <div>
              <Label htmlFor="donation-purpose">Purpose (optional)</Label>
              <Input id="donation-purpose" name="purpose" maxLength={300} />
            </div>
            <div>
              <Label htmlFor="donation-reference">Reference (optional)</Label>
              <Input
                id="donation-reference"
                name="referenceNumber"
                maxLength={80}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="donation-notes">Notes (optional)</Label>
            <Textarea id="donation-notes" name="notes" maxLength={2000} />
          </div>

          <Feedback state={state} />
          <Button type="submit" disabled={pending}>
            {pending ? "Recording…" : "Record donation"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function DonationCorrectionForm({ donation }: { donation: Donation }) {
  const [state, action, pending] = useActionState(
    correctDonationAction,
    initialState,
  );

  return (
    <details className="mt-2">
      <summary className="text-muted-foreground cursor-pointer text-xs">
        Add correction
      </summary>
      <form action={action} className="mt-3 space-y-3 rounded-md border p-3">
        <input type="hidden" name="donationId" value={donation.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`correction-type-${donation.id}`}>Type</Label>
            <Select
              id={`correction-type-${donation.id}`}
              name="correctionType"
              defaultValue="adjustment"
            >
              <option value="reversal">Reversal (refund)</option>
              <option value="adjustment">Adjustment (extra expense)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={`correction-amount-${donation.id}`}>
              Amount ({donation.currency_code.trim()})
            </Label>
            <Input
              id={`correction-amount-${donation.id}`}
              name="amount"
              type="number"
              min="0.0001"
              step="0.0001"
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor={`correction-reason-${donation.id}`}>Reason</Label>
          <Textarea
            id={`correction-reason-${donation.id}`}
            name="reason"
            minLength={3}
            maxLength={2000}
            required
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Original: {formatMoney(donation.amount, donation.currency_code)} to{" "}
          {donation.recipient_name}. The donation itself stays immutable.
        </p>
        <Feedback state={state} />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Add correction"}
        </Button>
      </form>
    </details>
  );
}
