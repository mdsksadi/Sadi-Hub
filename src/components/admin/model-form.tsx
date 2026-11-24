"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/validation/schemas";

export type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "date" | "number" | "url" | "textarea" | "checkbox";
  hint?: string;
  rows?: number;
  required?: boolean;
};

type Action = (state: FormState, formData: FormData) => Promise<FormState>;
type Initial = Record<string, string | number | boolean | null | undefined>;

const initialState: FormState = { status: "idle" };

export function ModelForm({
  action,
  fields,
  initial = {},
  submitLabel = "Save",
}: {
  action: Action;
  fields: FieldConfig[];
  initial?: Initial;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const allFields =
    initial.id && !fields.some((field) => field.name === "id")
      ? [{ name: "id", label: "", type: "text" as const }, ...fields]
      : fields;

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      {allFields.map((field) => {
        const value = initial[field.name];
        if (field.name === "id") {
          return (
            <input
              key={field.name}
              type="hidden"
              name="id"
              value={String(value ?? "")}
            />
          );
        }
        if (field.type === "checkbox") {
          return (
            <label
              key={field.name}
              className="flex items-center gap-2 text-sm sm:col-span-2"
            >
              <input
                type="checkbox"
                name={field.name}
                defaultChecked={value === true}
                className="h-4 w-4"
              />
              {field.label}
            </label>
          );
        }
        if (field.type === "textarea") {
          return (
            <div key={field.name} className="sm:col-span-2">
              <Label htmlFor={field.name}>{field.label}</Label>
              <Textarea
                id={field.name}
                name={field.name}
                rows={field.rows ?? 3}
                defaultValue={value == null ? "" : String(value)}
                required={field.required}
              />
              {field.hint && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {field.hint}
                </p>
              )}
            </div>
          );
        }
        return (
          <div key={field.name}>
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              name={field.name}
              type={field.type ?? "text"}
              defaultValue={value == null ? "" : String(value)}
              required={field.required}
            />
            {field.hint && (
              <p className="text-muted-foreground mt-1 text-xs">{field.hint}</p>
            )}
          </div>
        );
      })}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {state.message && (
          <p
            role="status"
            className={`ml-3 text-sm ${state.status === "error" ? "text-danger" : "text-primary"}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
