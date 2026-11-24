"use server";

import { requireOwner } from "@/lib/auth/owner";
import { revalidateLending } from "@/lib/admin/finance-revalidate";
import { saveContact, setContactArchived } from "@/lib/services/lending";
import { friendlyRpcError } from "@/lib/services/rpc-error";
import {
  formBoolean,
  formOptionalText,
  formText,
} from "@/lib/validation/forms";
import {
  adminContactSchema,
  contactArchiveSchema,
} from "@/lib/validation/lending";
import type { FormState } from "@/lib/validation/schemas";

function invalid(message: string, detail?: string): FormState {
  return {
    status: "error",
    message: detail ? `${message}: ${detail}` : message,
  };
}

export async function saveContactAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = adminContactSchema.safeParse({
    id: formText(formData, "id"),
    fullName: formText(formData, "fullName"),
    contactType: formText(formData, "contactType"),
    phone: formOptionalText(formData, "phone"),
    email: formOptionalText(formData, "email"),
    address: formOptionalText(formData, "address"),
    countryCode: formOptionalText(formData, "countryCode"),
    notes: formOptionalText(formData, "notes"),
    archived: formBoolean(formData, "archived"),
  });
  if (!parsed.success) {
    return invalid("Check the contact fields", parsed.error.issues[0]?.message);
  }

  try {
    await saveContact(owner.userId, parsed.data);
  } catch (error) {
    return {
      status: "error",
      message: friendlyRpcError(error, "Could not save the contact."),
    };
  }

  revalidateLending();
  return { status: "success", message: "Contact saved." };
}

export async function setContactArchivedAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = contactArchiveSchema.safeParse({
    id: formText(formData, "id"),
    archived: formBoolean(formData, "archived"),
  });
  if (!parsed.success) {
    return invalid(
      "Could not update the contact.",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await setContactArchived(owner.userId, parsed.data);
  } catch (error) {
    return {
      status: "error",
      message: friendlyRpcError(error, "Could not update the contact."),
    };
  }

  revalidateLending();
  return {
    status: "success",
    message: parsed.data.archived ? "Contact archived." : "Contact restored.",
  };
}
