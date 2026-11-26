import { logDataError } from "@/lib/data/log";
import { createClient } from "@/lib/supabase/server";
import { PRIVATE_BUCKET, storagePathFor } from "@/lib/supabase/storage";
import {
  validateDocumentFile,
  type DocumentDeleteInput,
  type DocumentUpdateInput,
  type DocumentUploadInput,
} from "@/lib/validation/property";
import { friendlyRpcError } from "./rpc-error";

async function client() {
  const supabase = await createClient(true);
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function relations(input: DocumentUploadInput | DocumentUpdateInput) {
  return {
    related_property_id: input.relatedPropertyId,
    related_contact_id: input.relatedContactId,
    related_transaction_id: input.relatedTransactionId,
    related_loan_given_id: input.relatedLoanGivenId,
    related_loan_taken_id: input.relatedLoanTakenId,
    related_donation_id: input.relatedDonationId,
  };
}

/**
 * Upload into the owner's private folder first, then insert metadata. If the
 * database write fails the object is removed so no orphaned file remains.
 */
export async function uploadDocument(
  ownerId: string,
  file: File,
  input: DocumentUploadInput,
): Promise<string> {
  const problem = validateDocumentFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (problem) throw new Error(problem);

  const supabase = await client();
  const path = storagePathFor(ownerId, file.name);
  const { error: uploadError } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    throw new Error(
      friendlyRpcError(uploadError, "Could not upload the file."),
    );
  }

  try {
    const { data, error } = await supabase
      .from("documents")
      .insert({
        owner_id: ownerId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        category: input.category,
        description: input.description,
        tags: input.tags,
        ...relations(input),
      })
      .select("id")
      .single();
    if (error) {
      throw new Error(
        friendlyRpcError(error, "Could not save the document record."),
      );
    }
    return data.id;
  } catch (error) {
    const { error: cleanupError } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .remove([path]);
    if (cleanupError) {
      // Never leak the private object path to the browser.
      logDataError("document_upload_cleanup", cleanupError);
    }
    throw error;
  }
}

/** Change category, description, tags or the related entity links. */
export async function updateDocument(
  ownerId: string,
  input: DocumentUpdateInput,
): Promise<void> {
  const supabase = await client();
  const { error } = await supabase
    .from("documents")
    .update({
      category: input.category,
      description: input.description,
      tags: input.tags,
      ...relations(input),
    })
    .eq("id", input.id)
    .eq("owner_id", ownerId);
  if (error) {
    throw new Error(friendlyRpcError(error, "Could not update the document."));
  }
}

/**
 * Remove the index row first. If storage cleanup fails, the row is restored on
 * a best-effort basis so the registry never claims an existing file is gone.
 */
export async function deleteDocument(
  ownerId: string,
  input: DocumentDeleteInput,
): Promise<void> {
  const supabase = await client();
  const { data: document, error: lookupError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", input.id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (lookupError) {
    throw new Error(
      friendlyRpcError(lookupError, "Could not find the document."),
    );
  }
  if (!document) throw new Error("The document no longer exists.");

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", input.id)
    .eq("owner_id", ownerId);
  if (deleteError) {
    throw new Error(
      friendlyRpcError(deleteError, "Could not delete the document."),
    );
  }

  const { error: cleanupError } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .remove([document.storage_path]);
  if (cleanupError) {
    const { error: restoreError } = await supabase
      .from("documents")
      .insert(document);
    if (restoreError) {
      logDataError("document_delete_rollback", restoreError);
    }
    throw new Error("The file could not be deleted from storage. Try again.");
  }
}
