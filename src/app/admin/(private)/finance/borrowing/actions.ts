"use server";

import { requireOwner } from "@/lib/auth/owner";
import { revalidateLending } from "@/lib/admin/finance-revalidate";
import {
  createLoanTaken,
  recordLoanTakenRepayment,
} from "@/lib/services/lending";
import { friendlyRpcError } from "@/lib/services/rpc-error";
import { formOptionalText, formText } from "@/lib/validation/forms";
import {
  loanTakenRepaymentSchema,
  loanTakenSchema,
} from "@/lib/validation/lending";
import type { FormState } from "@/lib/validation/schemas";

function invalid(message: string, detail?: string): FormState {
  return {
    status: "error",
    message: detail ? `${message}: ${detail}` : message,
  };
}

export async function createLoanTakenAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const parsed = loanTakenSchema.safeParse({
    lenderContactId: formText(formData, "lenderContactId"),
    amount: formText(formData, "amount"),
    currencyCode: formText(formData, "currencyCode"),
    dateBorrowed: formText(formData, "dateBorrowed"),
    receivingAccountId: formText(formData, "receivingAccountId"),
    expectedRepaymentDate: formText(formData, "expectedRepaymentDate"),
    reason: formOptionalText(formData, "reason"),
    agreementDetails: formOptionalText(formData, "agreementDetails"),
    notes: formOptionalText(formData, "notes"),
  });
  if (!parsed.success) {
    return invalid("Check the loan fields", parsed.error.issues[0]?.message);
  }

  try {
    await createLoanTaken(parsed.data);
  } catch (error) {
    return {
      status: "error",
      message: friendlyRpcError(error, "Could not record the loan taken."),
    };
  }

  revalidateLending();
  return { status: "success", message: "Loan taken recorded." };
}

export async function recordLoanTakenRepaymentAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const parsed = loanTakenRepaymentSchema.safeParse({
    loanId: formText(formData, "loanId"),
    amount: formText(formData, "amount"),
    paymentDate: formText(formData, "paymentDate"),
    sourceAccountId: formText(formData, "sourceAccountId"),
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
    await recordLoanTakenRepayment(parsed.data);
  } catch (error) {
    return {
      status: "error",
      message: friendlyRpcError(error, "Could not record the repayment."),
    };
  }

  revalidateLending();
  return { status: "success", message: "Repayment paid recorded." };
}
