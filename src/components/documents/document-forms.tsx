"use client";

import { useActionState } from "react";
import {
  deleteDocumentAction,
  updateDocumentAction,
  uploadDocumentAction,
} from "@/app/admin/(private)/documents/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/validation/schemas";
import type { Document } from "../../../types/supabase";

const initialState: FormState = { status: "idle" };

const CATEGORIES = [
  "deed",
  "khatian",
  "mutation",
  "tax_receipt",
  "agreement",
  "map",
  "resume",
  "certification",
  "loan",
  "donation",
  "other",
] as const;

const FILE_ACCEPT = ".pdf,application/pdf";

type Option = { id: string; label: string };

function Feedback({ state, pending }: { state: FormState; pending: boolean }) {
  if (state.status === "idle" && !pending) return null;
  if (state.status === "error") {
    return (
      <p role="alert" className="text-danger text-sm">
        {pending ? "Saving…" : state.message}
      </p>
    );
  }
  return (
    <p role="status" className="text-muted-foreground text-sm">
      {pending ? "Saving…" : state.message}
    </p>
  );
}

function RelationSelect({
  id,
  name,
  label,
  options,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  options: Option[];
  defaultValue: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="bg-background w-full rounded-md border px-3 py-2 text-sm"
      >
        <option value="">Not linked</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CategorySelect({
  id,
  defaultValue,
}: {
  id: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>Category</Label>
      <select
        id={id}
        name="category"
        defaultValue={defaultValue ?? "other"}
        className="bg-background w-full rounded-md border px-3 py-2 text-sm"
      >
        {CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

export type DocumentOptions = {
  properties: Option[];
  contacts: Option[];
  loansGiven: Option[];
  loansTaken: Option[];
  donations: Option[];
};

export function DocumentUploadForm({ options }: { options: DocumentOptions }) {
  const [state, action, pending] = useActionState(
    uploadDocumentAction,
    initialState,
  );

  return (
    <form action={action} encType="multipart/form-data" className="space-y-4">
      <div>
        <Label htmlFor="document-file">PDF file</Label>
        <Input
          id="document-file"
          name="file"
          type="file"
          accept={FILE_ACCEPT}
          required
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Private storage · PDF only · max 20 MiB
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CategorySelect id="upload-category" />
        <div>
          <Label htmlFor="upload-tags">Tags (comma separated)</Label>
          <Input id="upload-tags" name="tags" maxLength={400} />
        </div>
      </div>
      <div>
        <Label htmlFor="upload-description">Description</Label>
        <Textarea
          id="upload-description"
          name="description"
          rows={2}
          maxLength={1000}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <RelationSelect
          id="upload-property"
          name="relatedPropertyId"
          label="Related property"
          options={options.properties}
          defaultValue=""
        />
        <RelationSelect
          id="upload-contact"
          name="relatedContactId"
          label="Related contact"
          options={options.contacts}
          defaultValue=""
        />
        <RelationSelect
          id="upload-loan-given"
          name="relatedLoanGivenId"
          label="Related loan given"
          options={options.loansGiven}
          defaultValue=""
        />
        <RelationSelect
          id="upload-loan-taken"
          name="relatedLoanTakenId"
          label="Related loan taken"
          options={options.loansTaken}
          defaultValue=""
        />
        <RelationSelect
          id="upload-donation"
          name="relatedDonationId"
          label="Related donation"
          options={options.donations}
          defaultValue=""
        />
      </div>
      <Feedback state={state} pending={pending} />
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload document"}
      </Button>
    </form>
  );
}

/** Per-row category/attachment editor plus an explicit delete action. */
export function DocumentRowControls({
  doc,
  options,
}: {
  doc: Document;
  options: DocumentOptions;
}) {
  const [editState, editAction, editPending] = useActionState(
    updateDocumentAction,
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteDocumentAction,
    initialState,
  );
  const key = doc.id;

  return (
    <div className="space-y-2">
      <a
        href={`/api/documents/${doc.id}`}
        className="text-primary text-sm underline"
      >
        Download
      </a>
      <details>
        <summary className="text-muted-foreground cursor-pointer text-xs">
          Attach / edit links
        </summary>
        <form
          action={editAction}
          className="mt-3 space-y-3 rounded-md border p-3"
        >
          <input type="hidden" name="id" value={doc.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <CategorySelect
              id={`edit-category-${key}`}
              defaultValue={doc.category}
            />
            <div>
              <Label htmlFor={`edit-tags-${key}`}>Tags</Label>
              <Input
                id={`edit-tags-${key}`}
                name="tags"
                defaultValue={doc.tags.join(", ")}
                maxLength={400}
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`edit-description-${key}`}>Description</Label>
            <Textarea
              id={`edit-description-${key}`}
              name="description"
              rows={2}
              maxLength={1000}
              defaultValue={doc.description ?? ""}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <RelationSelect
              id={`edit-property-${key}`}
              name="relatedPropertyId"
              label="Related property"
              options={options.properties}
              defaultValue={doc.related_property_id ?? ""}
            />
            <RelationSelect
              id={`edit-contact-${key}`}
              name="relatedContactId"
              label="Related contact"
              options={options.contacts}
              defaultValue={doc.related_contact_id ?? ""}
            />
            <RelationSelect
              id={`edit-loan-given-${key}`}
              name="relatedLoanGivenId"
              label="Related loan given"
              options={options.loansGiven}
              defaultValue={doc.related_loan_given_id ?? ""}
            />
            <RelationSelect
              id={`edit-loan-taken-${key}`}
              name="relatedLoanTakenId"
              label="Related loan taken"
              options={options.loansTaken}
              defaultValue={doc.related_loan_taken_id ?? ""}
            />
            <RelationSelect
              id={`edit-donation-${key}`}
              name="relatedDonationId"
              label="Related donation"
              options={options.donations}
              defaultValue={doc.related_donation_id ?? ""}
            />
          </div>
          <Feedback state={editState} pending={editPending} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={editPending}
          >
            Save links
          </Button>
        </form>
      </details>
      <form action={deleteAction}>
        <input type="hidden" name="id" value={doc.id} />
        <Button
          type="submit"
          size="sm"
          variant="danger"
          disabled={deletePending}
          aria-label={`Delete ${doc.file_name}`}
        >
          Delete
        </Button>
        <Feedback state={deleteState} pending={deletePending} />
      </form>
    </div>
  );
}
