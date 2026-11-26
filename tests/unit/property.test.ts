import { describe, expect, it } from "vitest";
import {
  ESTIMATED_LABEL,
  convertArea,
  formatArea,
  formatEstimatedValue,
  normalizeOwnerShares,
  parseShareHundredths,
  validateOwnerShares,
  valuationChartRows,
  type AreaConversion,
} from "@/lib/domain/property";
import {
  documentUploadSchema,
  propertyCreateSchema,
  propertyOwnerSchema,
  propertyOwnersSchema,
  propertyValuationSchema,
  unitConversionSchema,
  validateDocumentFile,
} from "@/lib/validation/property";

const PROPERTY_ID = "11111111-1111-4111-8111-111111111111";
const CONTACT_ID = "22222222-2222-4222-8222-222222222222";

describe("ownership share validation", () => {
  it("parses shares as exact hundredths", () => {
    expect(parseShareHundredths("0.01")).toBe(1);
    expect(parseShareHundredths("60.00")).toBe(6000);
    expect(parseShareHundredths(100)).toBe(10_000);
    expect(parseShareHundredths("33.333")).toBeNull();
    expect(parseShareHundredths("100.01")).toBeNull();
    expect(parseShareHundredths("0")).toBeNull();
    expect(parseShareHundredths("-1")).toBeNull();
    expect(parseShareHundredths("abc")).toBeNull();
  });

  it("accepts an exact 100.00 total across one or more owners", () => {
    expect(
      validateOwnerShares([
        { ownershipPercentage: "60.00" },
        { ownershipPercentage: "40.00" },
      ]),
    ).toBe(true);
    expect(validateOwnerShares([{ ownershipPercentage: "100" }])).toBe(true);
    expect(
      validateOwnerShares([
        { ownershipPercentage: "33.33" },
        { ownershipPercentage: "33.33" },
        { ownershipPercentage: "33.34" },
      ]),
    ).toBe(true);
  });

  it("rejects totals just below and just above 100.00", () => {
    expect(validateOwnerShares([{ ownershipPercentage: "99.99" }])).toBe(false);
    expect(
      validateOwnerShares([
        { ownershipPercentage: "50.01" },
        { ownershipPercentage: "50.00" },
      ]),
    ).toBe(false);
    const result = normalizeOwnerShares([{ ownershipPercentage: "99.99" }]);
    expect(result.total).toBe("99.99");
    expect(result.totalHundredths).toBe(9999);
    expect(result.message).toContain("exactly 100.00");
  });

  it("rejects zero, negative, over-100 and over-two-decimal shares", () => {
    for (const share of ["0", "0.00", "-1", "100.01", "33.333", "0.001"]) {
      expect(validateOwnerShares([{ ownershipPercentage: share }])).toBe(false);
    }
  });

  it("requires between one and twenty owners", () => {
    expect(validateOwnerShares([])).toBe(false);
    expect(
      validateOwnerShares(
        Array.from({ length: 21 }, () => ({ ownershipPercentage: "4.76" })),
      ),
    ).toBe(false);
  });
});

describe("area conversion", () => {
  const conversions: AreaConversion[] = [
    {
      from_unit: "Katha",
      to_unit: "Decimal",
      factor: 3,
      valid_from: "2025-01-01",
    },
    {
      from_unit: "Katha",
      to_unit: "Decimal",
      factor: 3.5,
      valid_from: "2026-01-01",
    },
  ];

  it("uses the newest snapshot effective on or before the requested date", () => {
    expect(convertArea(2, "Katha", "Decimal", conversions, "2025-06-01")).toBe(
      6,
    );
    expect(convertArea(2, "Katha", "Decimal", conversions, "2026-02-01")).toBe(
      7,
    );
  });

  it("does not assume a universal Katha/Bigha factor or a reverse rate", () => {
    expect(
      convertArea(2, "Katha", "Decimal", conversions, "2024-12-31"),
    ).toBeNull();
    expect(
      convertArea(2, "Bigha", "Katha", conversions, "2026-02-01"),
    ).toBeNull();
    expect(
      convertArea(2, "Decimal", "Katha", conversions, "2026-02-01"),
    ).toBeNull();
    expect(convertArea(2, "Katha", "Decimal", [], "2026-02-01")).toBeNull();
  });

  it("returns null for a missing area and is a no-op for the same unit", () => {
    expect(
      convertArea(null, "Katha", "Decimal", conversions, "2026-02-01"),
    ).toBeNull();
    expect(
      convertArea(3.25, "katha", " KATHA ", conversions, "2026-02-01"),
    ).toBe(3.25);
  });
});

describe("area formatting", () => {
  it("preserves the original regional unit", () => {
    expect(formatArea(3.5, "Katha")).toBe("3.5 Katha");
    expect(formatArea(1200, " Square Feet ")).toBe("1,200 Square Feet");
  });

  it("keeps a converted value advisory rather than replacing the original", () => {
    const conversions: AreaConversion[] = [
      {
        from_unit: "Katha",
        to_unit: "Decimal",
        factor: 3.5,
        valid_from: "2026-01-01",
      },
    ];
    const original = formatArea(3.5, "Katha");
    const converted = convertArea(
      3.5,
      "Katha",
      "Decimal",
      conversions,
      "2026-02-01",
    );
    expect(original).toBe("3.5 Katha");
    expect(converted).toBe(12.25);
    expect(`${original} (${formatArea(converted, "Decimal")})`).toBe(
      "3.5 Katha (12.25 Decimal)",
    );
  });

  it("uses a placeholder for a missing area and never invents a unit", () => {
    expect(formatArea(null, "Katha")).toBe("—");
    expect(formatArea(10, null)).toBe("10");
  });
});

describe("valuation display", () => {
  it("always labels a value as ESTIMATED", () => {
    const label = formatEstimatedValue(150000, "BDT", "2026-02-01");
    expect(ESTIMATED_LABEL).toBe("ESTIMATED");
    expect(label).toContain("ESTIMATED");
    expect(label).toContain("150,000");
    expect(label).toContain("2026-02-01");
  });

  it("never presents an owner-reviewed estimate as a verified market price", () => {
    const label = formatEstimatedValue(
      150000,
      "bdt",
      "2026-02-01",
    ).toLowerCase();
    expect(label).toContain("estimated");
    expect(label).not.toContain("verified market price");
    expect(label).not.toContain("market value");
    expect(formatEstimatedValue(null, "BDT")).toContain("ESTIMATED");
  });

  it("labels chart rows with the same ESTIMATED display", () => {
    const rows = valuationChartRows([
      {
        valued_on: "2026-02-01",
        estimated_value: 150000,
        currency_code: "BDT",
      },
      {
        valued_on: "2026-01-01",
        estimated_value: 120000,
        currency_code: "BDT",
      },
    ]);
    expect(rows.map((row) => row.label)).toEqual(["2026-01-01", "2026-02-01"]);
    expect(rows[1].display).toContain("ESTIMATED");
    expect(rows[1].value).toBe(150000);
  });
});

describe("property and document schemas", () => {
  const validProperty = {
    name: "Dhaka land",
    areaUnit: "Katha",
    countryCode: "bd",
    division: "",
    district: "Dhaka",
    upazila: "",
    unionName: "",
    village: "",
    mouza: "",
    khatianNumber: "",
    dagNumber: "",
    landClassification: "",
    totalArea: "3.5000",
    purchaseDate: "2026-01-15",
    purchasePrice: "100000.0000",
    currencyCode: "bdt",
    currentEstimatedValue: "120000.0000",
    notes: "",
    owners: [
      {
        ownerName: "First Owner",
        ownershipPercentage: "60.00",
        acquisitionDate: "",
        ownershipType: "",
        notes: "",
      },
      {
        ownerName: "Second Owner",
        ownershipPercentage: "40.00",
        acquisitionDate: "",
        ownershipType: "",
        notes: "",
      },
    ],
  };

  it("normalizes property form values to the RPC contract", () => {
    const parsed = propertyCreateSchema.safeParse(validProperty);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.countryCode).toBe("BD");
      expect(parsed.data.currencyCode).toBe("BDT");
      expect(parsed.data.owners[0]).toMatchObject({
        owner_name: "First Owner",
        ownership_percentage: "60.00",
      });
      expect(parsed.data.notes).toBeNull();
    }
  });

  it("rejects a roster that does not total 100.00", () => {
    const parsed = propertyCreateSchema.safeParse({
      ...validProperty,
      owners: [
        { ...validProperty.owners[0], ownershipPercentage: "59.99" },
        validProperty.owners[1],
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((issue) => issue.path[0] === "owners"),
      ).toBe(true);
    }
    expect(
      propertyOwnersSchema.safeParse({
        propertyId: PROPERTY_ID,
        owners: [
          {
            ownerName: "Only Owner",
            ownershipPercentage: "99.99",
            acquisitionDate: "",
            ownershipType: "",
            notes: "",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires an original area unit and rejects malformed shares", () => {
    expect(
      propertyCreateSchema.safeParse({
        ...validProperty,
        areaUnit: "",
      }).success,
    ).toBe(false);
    expect(
      propertyOwnerSchema.safeParse({
        ownerName: "A",
        ownershipPercentage: "33.333",
        acquisitionDate: "",
        ownershipType: "",
        notes: "",
      }).success,
    ).toBe(false);
  });

  it("validates valuation snapshots without promoting estimates", () => {
    const parsed = propertyValuationSchema.safeParse({
      propertyId: PROPERTY_ID,
      estimatedValue: "150000.0000",
      currencyCode: "bdt",
      valuedOn: "2026-02-01",
      source: "Owner estimate",
      isVerified: true,
      notes: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.currencyCode).toBe("BDT");
      expect(parsed.data.isVerified).toBe(true);
    }
    const withoutVerifiedFlag = propertyValuationSchema.safeParse({
      propertyId: PROPERTY_ID,
      estimatedValue: "150000.0000",
      currencyCode: "BDT",
      valuedOn: "2026-02-01",
      source: "",
      notes: "",
    });
    expect(withoutVerifiedFlag.success).toBe(true);
    if (withoutVerifiedFlag.success) {
      expect(withoutVerifiedFlag.data.isVerified).toBe(false);
    }
    expect(
      propertyValuationSchema.safeParse({
        propertyId: PROPERTY_ID,
        estimatedValue: "150000.0000",
        currencyCode: "BDT",
        valuedOn: "01/02/2026",
        source: "",
        notes: "",
      }).success,
    ).toBe(false);
    expect(
      propertyValuationSchema.safeParse({
        propertyId: PROPERTY_ID,
        estimatedValue: "-1",
        currencyCode: "BDT",
        valuedOn: "2026-02-01",
        source: "",
        notes: "",
      }).success,
    ).toBe(false);
  });

  it("requires a dated, positive and non-identity conversion rate", () => {
    expect(
      unitConversionSchema.safeParse({
        fromUnit: "Katha",
        toUnit: "Decimal",
        factor: "3.50000000",
        sourceNote: "Local survey",
        validFrom: "2026-01-01",
      }).success,
    ).toBe(true);
    expect(
      unitConversionSchema.safeParse({
        fromUnit: "katha",
        toUnit: "KATHA",
        factor: "3.5",
        sourceNote: "",
        validFrom: "2026-01-01",
      }).success,
    ).toBe(false);
    expect(
      unitConversionSchema.safeParse({
        fromUnit: "Katha",
        toUnit: "Decimal",
        factor: "0",
        sourceNote: "",
        validFrom: "2026-01-01",
      }).success,
    ).toBe(false);
  });

  it("limits private document uploads to allowed PDF/image files", () => {
    const validDocument = {
      fileName: "deed.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      category: "deed",
      description: "",
      tags: ["property"],
      relatedPropertyId: PROPERTY_ID,
      relatedContactId: CONTACT_ID,
      relatedTransactionId: "",
      relatedLoanGivenId: "",
      relatedLoanTakenId: "",
      relatedDonationId: "",
    };
    expect(documentUploadSchema.safeParse(validDocument).success).toBe(true);
    expect(
      documentUploadSchema.safeParse({
        ...validDocument,
        mimeType: "application/x-msdownload",
      }).success,
    ).toBe(false);
    expect(
      documentUploadSchema.safeParse({
        ...validDocument,
        sizeBytes: 21 * 1024 * 1024,
      }).success,
    ).toBe(false);
    expect(
      validateDocumentFile({
        name: "deed.exe",
        type: "application/pdf",
        size: 10,
      }),
    ).toMatch(/PDF/);
  });
});
