import { z } from "zod";
import { parseShareHundredths } from "@/lib/domain/property";
import type { PropertyOwnerInput } from "../../../types/supabase";
import { currencyCode, isoDate } from "./finance";

export type { FormState } from "./schemas";

/** Empty form values are normalised to null before reaching the database. */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null));

const optionalDate = isoDate
  .or(z.literal(""))
  .transform((value) => value || null);

const optionalCurrency = z
  .union([currencyCode, z.literal("")])
  .transform((value) => value || null);

const optionalCountry = z
  .union([
    z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/),
    z.literal(""),
  ])
  .transform((value) => (value ? value.toUpperCase() : null));

const optionalId = z
  .string()
  .uuid()
  .or(z.literal(""))
  .transform((value) => value || null);

const areaAmount = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" || (/^\d+(?:\.\d{1,4})?$/.test(value) && Number(value) > 0),
    "Enter an area greater than zero with up to 4 decimals",
  )
  .transform((value) => value || null);

const moneyValue = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" || (/^\d+(?:\.\d{1,4})?$/.test(value) && Number(value) >= 0),
    "Enter zero or a positive amount with up to 4 decimals",
  )
  .transform((value) => value || null);

const requiredMoneyValue = z
  .string()
  .trim()
  .regex(
    /^\d+(?:\.\d{1,4})?$/,
    "Enter an estimated value with up to 4 decimals",
  )
  .refine((value) => Number(value) >= 0, "Enter zero or a positive value");

const share = z
  .string()
  .trim()
  .refine(
    (value) => parseShareHundredths(value) !== null,
    "Use a share from 0.01 to 100.00 with two decimals",
  );

/** Form row → exact JSON shape expected by the ownership RPCs. */
export const propertyOwnerSchema = z
  .object({
    ownerName: z.string().trim().min(1).max(200),
    ownershipPercentage: share,
    acquisitionDate: optionalDate,
    ownershipType: nullableText(80),
    notes: nullableText(1000),
  })
  .transform((value): PropertyOwnerInput => ({
    owner_name: value.ownerName,
    ownership_percentage: value.ownershipPercentage,
    acquisition_date: value.acquisitionDate,
    ownership_type: value.ownershipType,
    notes: value.notes,
  }));

const ownerList = z.array(propertyOwnerSchema).min(1).max(20);

function sharesOf(owners: PropertyOwnerInput[]) {
  return owners.map((owner) => ({
    ownershipPercentage: owner.ownership_percentage,
  }));
}

const propertyFields = {
  name: z.string().trim().min(1).max(200),
  areaUnit: z.string().trim().min(1).max(40),
  countryCode: optionalCountry,
  division: nullableText(120),
  district: nullableText(120),
  upazila: nullableText(120),
  unionName: nullableText(120),
  village: nullableText(120),
  mouza: nullableText(120),
  khatianNumber: nullableText(120),
  dagNumber: nullableText(120),
  landClassification: nullableText(120),
  totalArea: areaAmount,
  purchaseDate: optionalDate,
  purchasePrice: moneyValue,
  currencyCode: optionalCurrency,
  currentEstimatedValue: moneyValue,
  notes: nullableText(2000),
};

function checkAreaUnit<
  T extends { areaUnit: string; totalArea: string | null },
>(value: T, ctx: z.RefinementCtx): void {
  if (value.totalArea !== null && value.areaUnit.trim().length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["areaUnit"],
      message: "Enter the original area unit",
    });
  }
}

function checkOwners<T extends { owners: PropertyOwnerInput[] }>(
  value: T,
  ctx: z.RefinementCtx,
): void {
  const shares = sharesOf(value.owners);
  if (
    shares.length === 0 ||
    shares.some((item) => !parseShareHundredths(item.ownershipPercentage))
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["owners"],
      message: "Every owner needs a share between 0.01 and 100.00",
    });
    return;
  }
  const total = shares.reduce(
    (sum, item) => sum + (parseShareHundredths(item.ownershipPercentage) ?? 0),
    0,
  );
  if (total !== 10_000) {
    ctx.addIssue({
      code: "custom",
      path: ["owners"],
      message: "Ownership shares must total exactly 100.00",
    });
  }
}

export const propertyCreateSchema = z
  .object({ ...propertyFields, owners: ownerList })
  .superRefine((value, ctx) => {
    checkAreaUnit(value, ctx);
    checkOwners(value, ctx);
  });

export const propertyOwnersSchema = z
  .object({ propertyId: z.string().uuid(), owners: ownerList })
  .superRefine(checkOwners);

/** The cached estimate is changed only by record_property_valuation(). */
export const propertyUpdateSchema = z
  .object({
    id: z.string().uuid(),
    ...propertyFields,
  })
  .superRefine(checkAreaUnit);

export const propertyValuationSchema = z.object({
  propertyId: z.string().uuid(),
  estimatedValue: requiredMoneyValue,
  currencyCode,
  valuedOn: isoDate,
  source: nullableText(120),
  isVerified: z.boolean().default(false),
  notes: nullableText(1000),
});

export const unitConversionSchema = z
  .object({
    fromUnit: z.string().trim().min(1).max(40),
    toUnit: z.string().trim().min(1).max(40),
    factor: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,8})?$/, "Use a factor with up to 8 decimals")
      .refine((value) => Number(value) > 0, "The factor must be positive"),
    sourceNote: nullableText(300),
    validFrom: isoDate,
  })
  .superRefine((value, ctx) => {
    if (value.fromUnit.toLowerCase() === value.toUnit.toLowerCase()) {
      ctx.addIssue({
        code: "custom",
        path: ["toUnit"],
        message: "Choose a different target unit",
      });
    }
  });

export const DOCUMENT_CATEGORIES = [
  "deed",
  "khatian",
  "mutation",
  "tax_receipt",
  "agreement",
  "map",
  "resume",
  "certification",
  "loan",
  "donation",
  "other",
] as const;

export const documentCategory = z.enum(DOCUMENT_CATEGORIES);
export type DocumentCategoryValue = z.infer<typeof documentCategory>;

/** The private documents bucket is configured for PDFs only, max 20 MiB. */
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_ACCEPT = ".pdf,application/pdf";
const ALLOWED_MIME = new Set(["application/pdf"]);
const ALLOWED_EXTENSION = /\.pdf$/i;

export function validateDocumentFile(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  const name = file.name.trim();
  if (!name || name.length > 255 || !ALLOWED_EXTENSION.test(name)) {
    return "Use a PDF file";
  }
  if (!ALLOWED_MIME.has(file.type.toLowerCase())) {
    return "Use a PDF file";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "The file is empty";
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return "Files must be 20 MiB or smaller";
  }
  return null;
}

const documentRelations = {
  relatedPropertyId: optionalId,
  relatedContactId: optionalId,
  relatedTransactionId: optionalId,
  relatedLoanGivenId: optionalId,
  relatedLoanTakenId: optionalId,
  relatedDonationId: optionalId,
};

export const documentUploadSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(100),
    sizeBytes: z.number().int().positive().max(DOCUMENT_MAX_BYTES),
    category: documentCategory,
    description: nullableText(1000),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    ...documentRelations,
  })
  .superRefine((value, ctx) => {
    const issue = validateDocumentFile({
      name: value.fileName,
      type: value.mimeType,
      size: value.sizeBytes,
    });
    if (issue) {
      ctx.addIssue({ code: "custom", path: ["fileName"], message: issue });
    }
  });

export const documentUpdateSchema = z.object({
  id: z.string().uuid(),
  category: documentCategory,
  description: nullableText(1000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  ...documentRelations,
});

export const documentDeleteSchema = z.object({ id: z.string().uuid() });

export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>;
export type PropertyOwnersInput = z.infer<typeof propertyOwnersSchema>;
export type PropertyUpdateInput = z.infer<typeof propertyUpdateSchema>;
export type PropertyValuationInput = z.infer<typeof propertyValuationSchema>;
export type UnitConversionInput = z.infer<typeof unitConversionSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
export type DocumentDeleteInput = z.infer<typeof documentDeleteSchema>;
