"use server";

import { requireOwner } from "@/lib/auth/owner";
import { revalidateLending } from "@/lib/admin/finance-revalidate";
import {
  createLoanGiven,
  recordLoanGivenRepayment,
} from "@/lib/services/lending";
import { friendlyRpcError } from "@/lib/services/rpc-error";
import { formOptionalText, formText } from "@/lib/validation/forms";
import {
  loanGivenRepaymentSchema,
  loanGivenSchema,
} from "@/lib/validation/lending";
import type { FormState } from "@/lib/validation/schemas";

function invalid(message: string, detail?: string): FormState {
  return {
    status: "error",
    message: detail ? `${message}: ${detail}` : message,
  };
}

export async function createLoanGivenAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const parsed = loanGivenSchema.safeParse({
    contactId: formText(formData, "contactId"),
    amount: formText(formData, "amount"),
    currencyCode: formText(formData, "currencyCode"),
    dateGiven: formText(formData, "dateGiven"),
    sourceAccountId: formText(formData, "sourceAccountId"),
    expectedRepaymentDate: formText(formData, "expectedRepaymentDate"),
    reason: formOptionalText(formData, "reason"),
    paymentMethod: formOptionalText(formData, "paymentMethod"),
    referenceNumber: formOptionalText(formData, "referenceNumber"),
    notes: formOptionalText(formData, "notes"),
  });
  if (!parsed.success) {
    return invalid("Check the loan fields", parsed.error.issues[0]?.message);
  }

  try {
    await createLoanGiven(parsed.data);
  } catch (error) {
    return {
      status: "error",
      message: friendlyRpcError(error, "Could not record the loan given."),
    };
  }

  revalidateLending();
  return { status: "success", message: "Loan given recorded." };
}

export async function recordLoanGivenRepaymentAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const parsed = loanGivenRepaymentSchema.safeParse({
    loanId: formText(formData, "loanId"),
    amount: formText(formData, "amount"),
    repaymentDate: formText(formData, "repaymentDate"),
    receivingAccountId: formText(formData, "receivingAccountId"),
    paymentMethod: formOptionalText(formData, "paymentMethod"),
    referenceNumber: formOptionalText(formData, "referenceNumber"),
    notes: formOptionalText(formData, "notes"),
  });
  if (!parsed.success) {
    return invalid(
      "Check the repayment fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await recordLoanGivenRepayment(parsed.data);
  } catch (error) {
    return {
      status: "error",
      message: friendlyRpcError(error, "Could not record the repayment."),
    };
  }

  revalidateLending();
  return { status: "success", message: "Repayment received recorded." };
}
