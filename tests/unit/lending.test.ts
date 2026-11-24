import { describe, expect, it } from "vitest";
import {
  contactTotals,
  isOverdue,
  loanGivenStatus,
  loanStatus,
  loanTakenStatus,
  remainingPrincipal,
  totalRepaid,
  type ContactLoanLike,
  type LoanStatusInput,
} from "@/lib/domain/lending";
import {
  adminContactSchema,
  loanGivenRepaymentSchema,
  loanGivenSchema,
  loanTakenRepaymentSchema,
  loanTakenSchema,
} from "@/lib/validation/lending";

const TODAY = new Date("2026-11-25T12:00:00.000Z");
const OWNER = "11111111-1111-4111-8111-111111111111";
const CONTACT = "22222222-2222-4222-8222-222222222222";
const ACCOUNT = "33333333-3333-4333-8333-333333333333";
const LOAN = "44444444-4444-4444-8444-444444444444";

function statusInput(
  overrides: Partial<LoanStatusInput> = {},
): LoanStatusInput {
  return {
    amount: 1000,
    totalRepaid: 0,
    expectedRepaymentDate: null,
    cancelledAt: null,
    ...overrides,
  };
}

describe("repayment arithmetic", () => {
  it("sums only active repayments", () => {
    expect(
      totalRepaid([
        { amount: 200 },
        { amount: 250 },
        { amount: 999, cancelled_at: "2026-11-20T10:00:00Z" },
      ]),
    ).toBe(450);
  });

  it("computes remaining principal with four-decimal rounding", () => {
    expect(
      remainingPrincipal(1000.12345, [
        { amount: 100.00005 },
        { amount: 50, cancelled_at: "2026-11-20T10:00:00Z" },
      ]),
    ).toBe(900.1234);
  });

  it("keeps fully repaid loans at zero or below", () => {
    expect(remainingPrincipal(500, [{ amount: 500 }])).toBe(0);
  });
});

describe("isOverdue", () => {
  it("requires an outstanding balance and a past ISO date", () => {
    expect(isOverdue("2026-11-24", 100, TODAY)).toBe(true);
    expect(isOverdue("2026-11-25", 100, TODAY)).toBe(false);
    expect(isOverdue("2026-11-26", 100, TODAY)).toBe(false);
    expect(isOverdue("2026-11-24", 0, TODAY)).toBe(false);
    expect(isOverdue(null, 100, TODAY)).toBe(false);
    expect(isOverdue("24-11-2026", 100, TODAY)).toBe(false);
  });
});

describe("loan statuses", () => {
  it("uses Pending for given and Active for taken loans with no repayments", () => {
    expect(loanGivenStatus(statusInput(), TODAY)).toBe("Pending");
    expect(loanTakenStatus(statusInput(), TODAY)).toBe("Active");
    expect(loanStatus({ ...statusInput(), kind: "given" }, TODAY)).toBe(
      "Pending",
    );
    expect(loanStatus({ ...statusInput(), kind: "taken" }, TODAY)).toBe(
      "Active",
    );
  });

  it("marks unpaid loans overdue only after the expected date", () => {
    const input = statusInput({ expectedRepaymentDate: "2026-11-24" });
    expect(loanGivenStatus(input, TODAY)).toBe("Overdue");
    expect(loanTakenStatus(input, TODAY)).toBe("Overdue");
    expect(
      loanGivenStatus({ ...input, expectedRepaymentDate: "2026-11-26" }, TODAY),
    ).toBe("Pending");
  });

  it("gives partial and full repayment priority over overdue", () => {
    const overdue = statusInput({
      expectedRepaymentDate: "2026-10-01",
      totalRepaid: 250,
    });
    expect(loanGivenStatus(overdue, TODAY)).toBe("Partially Repaid");
    expect(loanTakenStatus({ ...overdue, totalRepaid: 1000 }, TODAY)).toBe(
      "Fully Repaid",
    );
  });

  it("lets cancellation override every other rule", () => {
    expect(
      loanGivenStatus(
        statusInput({
          cancelledAt: "2026-11-20T10:00:00Z",
          totalRepaid: 1000,
        }),
        TODAY,
      ),
    ).toBe("Cancelled");
  });
});

describe("contactTotals", () => {
  const loans: ContactLoanLike[] = [
    {
      owner_id: OWNER,
      contact_id: CONTACT,
      full_name: "Asha Rahman",
      contact_type: "individual",
      currency_code: "eur",
      amount: 1000,
      total_repaid: 200,
      date: "2026-01-01",
    },
    {
      owner_id: OWNER,
      contact_id: CONTACT,
      full_name: "Asha Rahman",
      contact_type: "individual",
      currency_code: "EUR",
      amount: 500,
      total_repaid: 100,
      date: "2026-02-01",
    },
    {
      owner_id: OWNER,
      contact_id: CONTACT,
      full_name: "Asha Rahman",
      contact_type: "individual",
      currency_code: "BDT",
      amount: 20000,
      total_repaid: 0,
      date: "2026-03-01",
    },
    {
      owner_id: OWNER,
      contact_id: CONTACT,
      full_name: "Asha Rahman",
      contact_type: "individual",
      currency_code: "EUR",
      amount: 9000,
      total_repaid: 0,
      date: "2025-01-01",
      cancelled_at: "2026-04-01T10:00:00Z",
    },
  ];

  it("groups by contact and currency, never across currencies", () => {
    const totals = contactTotals(loans);
    expect(totals).toHaveLength(2);

    const eur = totals.find((row) => row.currency_code === "EUR");
    expect(eur).toMatchObject({
      contact_id: CONTACT,
      lent_amount: 1500,
      repaid_amount: 300,
      outstanding_amount: 1200,
      loan_count: 2,
      first_date: "2026-01-01",
      last_date: "2026-02-01",
    });

    const bdt = totals.find((row) => row.currency_code === "BDT");
    expect(bdt).toMatchObject({
      lent_amount: 20000,
      repaid_amount: 0,
      outstanding_amount: 20000,
      loan_count: 1,
    });
    expect(totals[0].currency_code).toBe("BDT");
  });

  it("reports overdue outstanding only for due loans", () => {
    const due = {
      ...loans[0],
      expectedRepaymentDate: "2020-01-01",
      amount: 1000,
      total_repaid: 200,
    };
    const notDue = {
      ...loans[2],
      expectedRepaymentDate: "2099-01-01",
      amount: 20000,
      total_repaid: 0,
    };
    const totals = contactTotals([due, notDue]);

    expect(
      totals.find((row) => row.currency_code === "EUR")?.overdue_amount,
    ).toBe(800);
    expect(
      totals.find((row) => row.currency_code === "BDT")?.overdue_amount,
    ).toBe(0);
  });

  it("returns an empty list when every loan is cancelled", () => {
    expect(
      contactTotals(loans.map((loan) => ({ ...loan, cancelled_at: "x" }))),
    ).toEqual([]);
  });
});

describe("lending validation", () => {
  it("normalises optional ids and text to null", () => {
    const parsed = adminContactSchema.safeParse({
      id: "",
      fullName: "Asha Rahman",
      contactType: "individual",
      phone: "",
      email: "",
      address: "",
      countryCode: "",
      notes: "",
      archived: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toBeNull();
      expect(parsed.data.email).toBeNull();
      expect(parsed.data.countryCode).toBeNull();
    }
  });

  it("rejects invalid contact details", () => {
    expect(
      adminContactSchema.safeParse({
        id: "",
        fullName: "A",
        contactType: "individual",
        phone: null,
        email: "not-an-email",
        address: null,
        countryCode: null,
        notes: null,
        archived: false,
      }).success,
    ).toBe(false);
  });

  it("uppercases currency and accepts an empty expected date", () => {
    const parsed = loanGivenSchema.safeParse({
      contactId: CONTACT,
      amount: "1250.50",
      currencyCode: "bdt",
      dateGiven: "2026-11-25",
      sourceAccountId: ACCOUNT,
      expectedRepaymentDate: "",
      reason: null,
      paymentMethod: null,
      referenceNumber: null,
      notes: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.currencyCode).toBe("BDT");
      expect(parsed.data.expectedRepaymentDate).toBeNull();
      expect(parsed.data.amount).toBe("1250.50");
    }
  });

  it("rejects zero, negative and malformed repayment amounts", () => {
    const base = {
      loanId: LOAN,
      repaymentDate: "2026-11-25",
      receivingAccountId: ACCOUNT,
      paymentMethod: null,
      referenceNumber: null,
      notes: null,
    };
    for (const amount of ["0", "0.0000", "-5", "12.34567", "abc"]) {
      expect(
        loanGivenRepaymentSchema.safeParse({ ...base, amount }).success,
      ).toBe(false);
    }
    expect(
      loanGivenRepaymentSchema.safeParse({ ...base, amount: "1.0001" }).success,
    ).toBe(true);
  });

  it("requires real UUIDs and ISO dates on loans", () => {
    expect(
      loanTakenSchema.safeParse({
        lenderContactId: "not-a-uuid",
        amount: "100",
        currencyCode: "EUR",
        dateBorrowed: "25-11-2026",
        receivingAccountId: ACCOUNT,
        expectedRepaymentDate: null,
        reason: null,
        agreementDetails: null,
        notes: null,
      }).success,
    ).toBe(false);
    expect(
      loanTakenRepaymentSchema.safeParse({
        loanId: LOAN,
        amount: "10",
        paymentDate: "2026-11-25",
        sourceAccountId: ACCOUNT,
        paymentMethod: null,
        referenceNumber: null,
        notes: null,
      }).success,
    ).toBe(true);
  });
});
