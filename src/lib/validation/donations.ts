import { z } from "zod";
import {
  currencyCode,
  isoDate,
  moneyAmount,
  optionalId,
  recipientType,
} from "./finance";

export type { FormState } from "./schemas";

/** Empty FormData values are normalized here; RPCs receive strings or null. */

const optionalCurrency = z.union([currencyCode, z.literal("")]).default("");

const optionalCountry = z
  .union([
    z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/),
    z.literal(""),
  ])
  .transform((value) => (value ? value.toUpperCase() : null))
  .default("");

const notes = z.string().trim().max(2000).default("");

export const donationSchema = z
  .object({
    contactId: optionalId.transform((value) => value || null),
    recipientName: z.string().trim().max(150).default(""),
    recipientType: z
      .union([recipientType, z.literal("")])
      .transform((value) => value || "individual"),
    amount: moneyAmount,
    currencyCode: optionalCurrency,
    donationDate: isoDate,
    sourceAccountId: z.string().uuid("Select an account"),
    purpose: z.string().trim().max(300).default(""),
    categoryId: optionalId.transform((value) => value || null),
    countryCode: optionalCountry,
    paymentMethod: z.string().trim().max(60).default(""),
    referenceNumber: z.string().trim().max(80).default(""),
    notes,
  })
  .superRefine((value, ctx) => {
    if (!value.contactId && !value.recipientName) {
      ctx.addIssue({
        code: "custom",
        path: ["recipientName"],
        message: "Enter a recipient name or choose a contact",
      });
    }
  });

export const donationCorrectionSchema = z.object({
  donationId: z.string().uuid(),
  correctionType: z.enum(["reversal", "adjustment"]),
  amount: moneyAmount,
  reason: z.string().trim().min(3, "Explain the reason").max(2000),
});

export type DonationInput = z.infer<typeof donationSchema>;
export type DonationCorrectionInput = z.infer<typeof donationCorrectionSchema>;
