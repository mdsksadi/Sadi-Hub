"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import {
  deleteDocument,
  updateDocument,
  uploadDocument,
} from "@/lib/services/documents";
import { friendlyRpcError } from "@/lib/services/rpc-error";
import { formList, formOptionalText, formText } from "@/lib/validation/forms";
import {
  documentDeleteSchema,
  documentUpdateSchema,
  documentUploadSchema,
  validateDocumentFile,
} from "@/lib/validation/property";
import type { FormState } from "@/lib/validation/schemas";

function invalid(message: string, detail?: string): FormState {
  return {
    status: "error",
    message: detail ? `${message}: ${detail}` : message,
  };
}

function caught(error: unknown, fallback: string): FormState {
  const raw = error instanceof Error ? error.message : String(error);
  const sqlShaped =
    /relation |column |syntax|SQLSTATE|permission denied|duplicate key|constraint |invalid input syntax/i.test(
      raw,
    );
  return {
    status: "error",
    message: friendlyRpcError(error, sqlShaped ? fallback : raw || fallback),
  };
}

function revalidateDocuments(): void {
  revalidatePath("/admin/documents");
  revalidatePath("/admin/property");
  revalidatePath("/admin/dashboard");
}

function relations(formData: FormData) {
  return {
    relatedPropertyId: formText(formData, "relatedPropertyId"),
    relatedContactId: formText(formData, "relatedContactId"),
    relatedTransactionId: formText(formData, "relatedTransactionId"),
    relatedLoanGivenId: formText(formData, "relatedLoanGivenId"),
    relatedLoanTakenId: formText(formData, "relatedLoanTakenId"),
    relatedDonationId: formText(formData, "relatedDonationId"),
  };
}

export async function uploadDocumentAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return invalid("Choose a PDF to upload.");
  }
  const fileProblem = validateDocumentFile(file);
  if (fileProblem) return invalid(fileProblem);

  const parsed = documentUploadSchema.safeParse({
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    category: formText(formData, "category") || "other",
    description: formOptionalText(formData, "description"),
    tags: formList(formData, "tags"),
    ...relations(formData),
  });
  if (!parsed.success) {
    return invalid(
      "Check the document fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await uploadDocument(owner.userId, file, parsed.data);
  } catch (error) {
    return caught(error, "Could not upload the document.");
  }
  revalidateDocuments();
  return { status: "success", message: "Document uploaded." };
}

export async function updateDocumentAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = documentUpdateSchema.safeParse({
    id: formText(formData, "id"),
    category: formText(formData, "category") || "other",
    description: formOptionalText(formData, "description"),
    tags: formList(formData, "tags"),
    ...relations(formData),
  });
  if (!parsed.success) {
    return invalid(
      "Check the document fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await updateDocument(owner.userId, parsed.data);
  } catch (error) {
    return caught(error, "Could not update the document.");
  }
  revalidateDocuments();
  return { status: "success", message: "Document links saved." };
}

export async function deleteDocumentAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = documentDeleteSchema.safeParse({
    id: formText(formData, "id"),
  });
  if (!parsed.success) {
    return invalid("Select a valid document", parsed.error.issues[0]?.message);
  }

  try {
    await deleteDocument(owner.userId, parsed.data);
  } catch (error) {
    return caught(error, "Could not delete the document.");
  }
  revalidateDocuments();
  return { status: "success", message: "Document deleted." };
}
