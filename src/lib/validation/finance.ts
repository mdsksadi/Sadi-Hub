import { z } from "zod";

/** Shared primitives for finance, lending, borrowing and donations. */

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

export const moneyAmount = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,4})?$/, "Enter a positive amount with up to 4 decimals")
  .refine((value) => Number(value) > 0, "Enter an amount greater than zero");

export const feeAmount = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,4})?$/, "Enter zero or a positive amount")
  .refine((value) => Number.isFinite(Number(value)), "Enter a valid amount");

export const exchangeRate = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,8})?$/, "Enter a rate with up to 8 decimals")
  .refine((value) => Number(value) > 0, "The rate must be greater than zero");

export const currencyCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Use a 3-letter currency code")
  .transform((value) => value.toUpperCase());

/** Empty select values are normalised by the caller with `|| null`. */
export const optionalId = z.union([z.string().uuid(), z.literal("")]);

export const recipientType = z.enum(["individual", "organization"]);
