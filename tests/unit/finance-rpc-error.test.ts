import { describe, expect, it } from "vitest";
import { friendlyRpcError } from "@/lib/services/rpc-error";

describe("friendlyRpcError", () => {
  it("maps known database failures to actionable messages", () => {
    expect(
      friendlyRpcError(new Error("Insufficient balance in account"), "x"),
    ).toContain("Insufficient balance");
    expect(
      friendlyRpcError(new Error("No snapshotted exchange rate found"), "x"),
    ).toContain("exchange rate");
    expect(
      friendlyRpcError(new Error("Repayment exceeds loan amount"), "x"),
    ).toContain("exceeds");
    expect(
      friendlyRpcError(new Error("Donations are immutable"), "x"),
    ).toContain("immutable");
  });

  it("never leaks raw SQL text", () => {
    const raw =
      'permission denied for table "financial_transactions" (SQLSTATE 42501)';
    expect(friendlyRpcError(new Error(raw), "Could not save.")).toBe(
      "Could not save.",
    );
  });
});
