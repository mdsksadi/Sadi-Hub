import { describe, expect, it } from "vitest";
import {
  correctionDirection,
  correctionLedgerType,
  groupDonationsByRecipient,
  monthlyCashflowByCurrency,
  monthlyDonationTotals,
  monthlyDonationTotalsByCurrency,
  netDonationAmount,
  normalizeRecipientName,
  recipientKey,
  recipientTotals,
  recipientTotalsByCurrency,
} from "@/lib/domain/donations";
import {
  donationCorrectionSchema,
  donationSchema,
} from "@/lib/validation/donations";
import type {
  ContactDonationSummary,
  Donation,
  DonationCorrection,
  MonthlyCashflow,
} from "../../types/supabase";

function gift(overrides: Partial<Donation> = {}): Donation {
  return {
    id: "gift",
    owner_id: "owner",
    contact_id: null,
    recipient_name: "Hope Foundation",
    recipient_type: "organization",
    amount: 100,
    currency_code: "EUR",
    donation_date: "2026-10-02",
    purpose: null,
    category_id: null,
    country_code: "BD",
    source_account_id: "account",
    payment_method: null,
    reference_number: null,
    notes: null,
    ledger_transaction_id: null,
    created_at: "2026-10-02T00:00:00Z",
    created_by: "owner",
    ...overrides,
  };
}

function correction(
  overrides: Partial<DonationCorrection> = {},
): DonationCorrection {
  return {
    id: "correction",
    owner_id: "owner",
    donation_id: "gift",
    correction_type: "reversal",
    amount: 10,
    reason: "Duplicate entry",
    ledger_transaction_id: null,
    created_at: "2026-10-03T00:00:00Z",
    ...overrides,
  };
}

function summary(
  overrides: Partial<ContactDonationSummary> = {},
): ContactDonationSummary {
  return {
    owner_id: "owner",
    recipient_key: "name:hope foundation",
    contact_id: null,
    recipient_name: "Hope Foundation",
    recipient_type: "organization",
    currency_code: "EUR",
    country_code: "BD",
    total_amount: 100,
    donation_count: 1,
    first_date: "2026-10-02",
    last_date: "2026-10-02",
    ...overrides,
  };
}

describe("recipient grouping and totals", () => {
  it("normalizes snapshot names and keys named recipients by name", () => {
    expect(normalizeRecipientName("  Hope   Foundation ")).toBe(
      "hope foundation",
    );
    expect(
      recipientKey({
        contact_id: null,
        recipient_name: "  Hope   Foundation ",
      }),
    ).toBe("name:hope foundation");
    expect(
      recipientKey({ contact_id: "contact-1", recipient_name: "Old name" }),
    ).toBe("contact:contact-1");
  });

  it("merges repeated donations to one recipient but keeps currencies separate", () => {
    const groups = groupDonationsByRecipient([
      gift({ amount: 100, donation_date: "2026-10-02" }),
      gift({
        recipient_name: "hope foundation",
        amount: 50,
        donation_date: "2026-10-20",
      }),
      gift({ amount: 1000, currency_code: "BDT", donation_date: "2026-10-21" }),
      gift({
        contact_id: "contact-1",
        recipient_name: "Masud",
        recipient_type: "individual",
        amount: 30,
      }),
      gift({
        contact_id: "contact-1",
        recipient_name: "Masud Ahmed",
        recipient_type: "individual",
        amount: 20,
        donation_date: "2026-10-25",
      }),
    ]);

    expect(groups).toHaveLength(3);

    const eur = groups.find(
      (row) =>
        row.recipient_key === "name:hope foundation" &&
        row.currency_code === "EUR",
    );
    expect(eur).toMatchObject({
      total_amount: 150,
      donation_count: 2,
      first_date: "2026-10-02",
      last_date: "2026-10-20",
      country_code: "BD",
    });

    const bdt = groups.find((row) => row.currency_code === "BDT");
    expect(bdt).toMatchObject({ total_amount: 1000, donation_count: 1 });

    const contact = groups.find((row) => row.contact_id === "contact-1");
    expect(contact).toMatchObject({
      recipient_name: "Masud Ahmed",
      total_amount: 50,
      donation_count: 2,
    });
  });

  it("totals summary rows by currency without mixing EUR and BDT", () => {
    const rows = recipientTotals([
      summary({ total_amount: 100 }),
      summary({
        total_amount: 50,
        first_date: "2026-11-01",
        last_date: "2026-11-01",
      }),
      summary({
        recipient_key: "name:orphanage",
        recipient_name: "Orphanage",
        currency_code: "BDT",
        total_amount: 2000,
      }),
    ]);

    expect(rows.map((row) => row.total_amount).sort((a, b) => a - b)).toEqual([
      150, 2000,
    ]);
    expect(rows.find((row) => row.currency_code === "EUR")).toMatchObject({
      donation_count: 2,
      first_date: "2026-10-02",
      last_date: "2026-11-01",
    });
  });

  it("keeps per-currency donation totals independent", () => {
    const totals = recipientTotalsByCurrency([
      gift({ amount: 100 }),
      gift({ amount: 50 }),
      gift({ currency_code: "bdt", amount: 1000 }),
    ]);
    expect(totals).toEqual({ EUR: 150, BDT: 1000 });
  });
});

describe("corrections", () => {
  it("maps correction types to ledger direction and transaction type", () => {
    expect(correctionDirection("reversal")).toBe(1);
    expect(correctionDirection("adjustment")).toBe(-1);
    expect(correctionLedgerType("reversal")).toBe("reversal");
    expect(correctionLedgerType("adjustment")).toBe("correction");
  });

  it("nets reversals and adjustments against the original donation", () => {
    expect(
      netDonationAmount(gift({ amount: 100 }), [
        correction({ correction_type: "reversal", amount: 30 }),
        correction({ correction_type: "adjustment", amount: 20 }),
      ]),
    ).toBe(90);
    expect(netDonationAmount(gift({ amount: 100 }), [])).toBe(100);
    expect(
      netDonationAmount(gift({ amount: 100 }), [
        correction({ correction_type: "reversal", amount: 150 }),
      ]),
    ).toBe(0);
  });
});

describe("monthly totals", () => {
  it("groups donations by month and can filter to one currency", () => {
    const donations = [
      gift({ amount: 100, donation_date: "2026-10-02" }),
      gift({ amount: 50, donation_date: "2026-10-20" }),
      gift({ amount: 25, donation_date: "2026-11-01" }),
      gift({ amount: 1000, currency_code: "BDT", donation_date: "2026-10-21" }),
    ];

    expect(monthlyDonationTotals(donations, "EUR")).toEqual([
      { month: "2026-10", total: 150 },
      { month: "2026-11", total: 25 },
    ]);
    expect(monthlyDonationTotalsByCurrency(donations)).toEqual({
      EUR: [
        { month: "2026-10", total: 150 },
        { month: "2026-11", total: 25 },
      ],
      BDT: [{ month: "2026-10", total: 1000 }],
    });
  });

  it("builds per-currency cashflow series from monthly view rows", () => {
    const rows: MonthlyCashflow[] = [
      {
        owner_id: "owner",
        month: "2026-10",
        country_code: "BD",
        currency_code: "EUR",
        reporting_currency: "EUR",
        income_amount: 500,
        expense_amount: 100,
        net_amount: 400,
        income_reporting: 500,
        expense_reporting: 100,
        net_reporting: 400,
      },
      {
        owner_id: "owner",
        month: "2026-10",
        country_code: "DE",
        currency_code: "EUR",
        reporting_currency: "EUR",
        income_amount: 100,
        expense_amount: 50,
        net_amount: 50,
        income_reporting: 100,
        expense_reporting: 50,
        net_reporting: 50,
      },
      {
        owner_id: "owner",
        month: "2026-10",
        country_code: "BD",
        currency_code: "BDT",
        reporting_currency: "EUR",
        income_amount: 1000,
        expense_amount: 200,
        net_amount: 800,
        income_reporting: 10,
        expense_reporting: 2,
        net_reporting: 8,
      },
    ];

    expect(monthlyCashflowByCurrency(rows)).toEqual({
      EUR: [{ month: "2026-10", income: 600, expense: 150, net: 450 }],
      BDT: [{ month: "2026-10", income: 1000, expense: 200, net: 800 }],
    });
  });
});

describe("donationSchema", () => {
  const valid = {
    contactId: "",
    recipientName: "Hope Foundation",
    recipientType: "organization",
    amount: "125.5000",
    currencyCode: "eur",
    donationDate: "2026-10-02",
    sourceAccountId: "00000000-0000-4000-8000-000000000001",
    purpose: "",
    categoryId: "",
    countryCode: "bd",
    paymentMethod: "",
    referenceNumber: "",
    notes: "",
  };

  it("accepts a named donation and normalizes optional ids and codes", () => {
    const result = donationSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currencyCode).toBe("EUR");
      expect(result.data.countryCode).toBe("BD");
      expect(result.data.categoryId).toBeNull();
      expect(result.data.contactId).toBeNull();
      expect(result.data.amount).toBe("125.5000");
    }
  });

  it("allows a blank recipient name when a contact is selected", () => {
    expect(
      donationSchema.safeParse({
        ...valid,
        contactId: "00000000-0000-4000-8000-000000000002",
        recipientName: "",
      }).success,
    ).toBe(true);
  });

  it("rejects a missing recipient, invalid money and invalid dates", () => {
    const missingName = donationSchema.safeParse({
      ...valid,
      recipientName: "",
    });
    expect(missingName.success).toBe(false);
    if (!missingName.success) {
      expect(
        missingName.error.issues.some(
          (issue) => issue.path[0] === "recipientName",
        ),
      ).toBe(true);
    }

    expect(donationSchema.safeParse({ ...valid, amount: "-5" }).success).toBe(
      false,
    );
    expect(
      donationSchema.safeParse({ ...valid, donationDate: "02/10/2026" })
        .success,
    ).toBe(false);
    expect(
      donationSchema.safeParse({ ...valid, countryCode: "BGD" }).success,
    ).toBe(false);
  });
});

describe("donationCorrectionSchema", () => {
  it("accepts a reversal or adjustment with a reason", () => {
    expect(
      donationCorrectionSchema.safeParse({
        donationId: "00000000-0000-4000-8000-000000000003",
        correctionType: "reversal",
        amount: "12.5",
        reason: "Duplicate transfer",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown types, blank reasons and non-positive amounts", () => {
    const base = {
      donationId: "00000000-0000-4000-8000-000000000003",
      correctionType: "refund",
      amount: "12.5",
      reason: "Duplicate transfer",
    };
    expect(donationCorrectionSchema.safeParse(base).success).toBe(false);
    expect(
      donationCorrectionSchema.safeParse({
        ...base,
        correctionType: "adjustment",
        reason: "",
      }).success,
    ).toBe(false);
    expect(
      donationCorrectionSchema.safeParse({
        ...base,
        correctionType: "adjustment",
        amount: "0",
      }).success,
    ).toBe(false);
  });
});
