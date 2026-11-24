import { z } from "zod";
import {
  currencyCode,
  isoDate,
  moneyAmount,
  optionalId,
  recipientType,
} from "./finance";

/** Empty form values are normalised to null before reaching the database. */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null));

const nullableEmail = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) => value === "" || z.string().email().safeParse(value).success,
    "Enter a valid email",
  )
  .nullable()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalUuid = optionalId.transform((value) => value || null);
const optionalDate = isoDate
  .or(z.literal(""))
  .transform((value) => value || null);
const requiredUuid = z.string().uuid();

export const adminContactSchema = z.object({
  id: optionalUuid,
  fullName: z.string().trim().min(2).max(100),
  contactType: recipientType,
  phone: nullableText(40),
  email: nullableEmail,
  address: nullableText(200),
  countryCode: nullableText(3),
  notes: nullableText(1000),
  archived: z.boolean(),
});

export const contactArchiveSchema = z.object({
  id: requiredUuid,
  archived: z.boolean(),
});

export const loanGivenSchema = z.object({
  contactId: requiredUuid,
  amount: moneyAmount,
  currencyCode,
  dateGiven: isoDate,
  sourceAccountId: requiredUuid,
  expectedRepaymentDate: optionalDate,
  reason: nullableText(300),
  paymentMethod: nullableText(80),
  referenceNumber: nullableText(120),
  notes: nullableText(1000),
});

export const loanGivenRepaymentSchema = z.object({
  loanId: requiredUuid,
  amount: moneyAmount,
  repaymentDate: isoDate,
  receivingAccountId: requiredUuid,
  paymentMethod: nullableText(80),
  referenceNumber: nullableText(120),
  notes: nullableText(1000),
});

export const loanTakenSchema = z.object({
  lenderContactId: requiredUuid,
  amount: moneyAmount,
  currencyCode,
  dateBorrowed: isoDate,
  receivingAccountId: requiredUuid,
  expectedRepaymentDate: optionalDate,
  reason: nullableText(300),
  agreementDetails: nullableText(1000),
  notes: nullableText(1000),
});

export const loanTakenRepaymentSchema = z.object({
  loanId: requiredUuid,
  amount: moneyAmount,
  paymentDate: isoDate,
  sourceAccountId: requiredUuid,
  paymentMethod: nullableText(80),
  referenceNumber: nullableText(120),
  notes: nullableText(1000),
});

export type AdminContactInput = z.infer<typeof adminContactSchema>;
export type ContactArchiveInput = z.infer<typeof contactArchiveSchema>;
export type LoanGivenInput = z.infer<typeof loanGivenSchema>;
export type LoanGivenRepaymentInput = z.infer<typeof loanGivenRepaymentSchema>;
export type LoanTakenInput = z.infer<typeof loanTakenSchema>;
export type LoanTakenRepaymentInput = z.infer<typeof loanTakenRepaymentSchema>;
