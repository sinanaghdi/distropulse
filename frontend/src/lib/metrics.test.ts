import { describe, expect, it } from "vitest";
import { calculateMetrics } from "./metrics";
import type { Sale } from "../types";

const row = (overrides: Partial<Sale> = {}): Sale => ({
  date: "2026-09-02", invoiceId: "F-1", productCode: "P-1",
  productName: "محصول نمونه", quantity: 2, amount: 100,
  customerId: "C-1", customerName: "مشتری نمونه", ...overrides,
});

describe("calculateMetrics", () => {
  it("sums sales and counts unique invoices rather than rows", () => {
    const metrics = calculateMetrics([
      row({ amount: 100, quantity: 2 }),
      row({ amount: 50, quantity: 3 }),
      row({ invoiceId: "F-2", amount: 75, quantity: 1, date: "2026-09-03" }),
    ], 30);
    expect(metrics.totalSales).toBe(225);
    expect(metrics.orderCount).toBe(2);
    expect(metrics.units).toBe(6);
  });

  it("does not invent a percentage when the comparison period is missing", () => {
    const metrics = calculateMetrics([row()], 30);
    expect(metrics.changePercent).toBeNull();
  });

  it("calculates percentage change when the baseline is non-zero", () => {
    const metrics = calculateMetrics([
      row({ date: "2026-08-01", amount: 100 }),
      row({ date: "2026-09-02", amount: 300 }),
    ], 30);
    expect(metrics.changePercent).toBe(200);
  });

  it("returns stable empty metrics for empty input", () => {
    const metrics = calculateMetrics([]);
    expect(metrics.totalSales).toBe(0);
    expect(metrics.orderCount).toBe(0);
    expect(metrics.changePercent).toBeNull();
  });
});
