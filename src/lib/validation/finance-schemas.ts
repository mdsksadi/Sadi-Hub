import { z } from "zod";
import {
  currencyCode,
  exchangeRate,
  feeAmount,
  isoDate,
  moneyAmount,
  optionalId,
} from "./finance";

/**
 * Form schemas for the finance module. Numeric inputs stay strings so exact
 * decimal values survive until the database or an RPC parses them.
 */

const signedAmount = z
  .string()
  .trim()
  .regex(/^-?\d+(?:\.\d{1,4})?$/, "Enter an amount with up to 4 decimals")
  .refine((value) => Number.isFinite(Number(value)), "Enter a valid amount");

const optionalDate = z.union([isoDate, z.literal("")]);
const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(1000);

export const accountSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1).max(100),
  countryCode: z
    .string()
    .trim()
    .max(3)
    .transform((value) => value.toUpperCase()),
  currencyCode: currencyCode,
  accountType: z.enum(["bank", "savings", "cash", "mobile_money", "other"]),
  openingBalance: signedAmount,
  openingDate: optionalDate,
  description: z.string().trim().max(500),
  isActive: z.boolean(),
});

export const financeCategorySchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["income", "expense"]),
  parentId: optionalId,
  icon: z.string().trim().max(60),
  isActive: z.boolean(),
});

const movementSchema = z.object({
  accountId: z.string().uuid(),
  amount: moneyAmount,
  businessDate: isoDate,
  categoryId: optionalId,
  description: shortText,
  notes: longText,
  referenceNumber: z.string().trim().max(100),
});

export const incomeSchema = movementSchema;
export const expenseSchema = movementSchema;

export const transferSchema = z
  .object({
    sourceAccountId: z.string().uuid(),
    destinationAccountId: z.string().uuid(),
    sourceAmount: moneyAmount,
    destinationAmount: moneyAmount,
    exchangeRate,
    feeAmount,
    transferDate: isoDate,
    referenceNumber: z.string().trim().max(100),
    notes: longText,
  })
  .refine(
    (value) => value.sourceAccountId !== value.destinationAccountId,
    "Choose two different accounts",
  );

export const exchangeRateSchema = z
  .object({
    fromCurrency: currencyCode,
    toCurrency: currencyCode,
    rate: exchangeRate,
    effectiveDate: isoDate,
    source: z.string().trim().min(1).max(100),
  })
  .refine(
    (value) => value.fromCurrency !== value.toCurrency,
    "Choose two different currencies",
  );

export type AccountInput = z.infer<typeof accountSchema>;
export type FinanceCategoryInput = z.infer<typeof financeCategorySchema>;
export type MovementInput = z.infer<typeof movementSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
export type ExchangeRateInput = z.infer<typeof exchangeRateSchema>;
