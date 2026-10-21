import type { Sale } from "../types";

export interface Metrics {
  totalSales: number;
  orderCount: number;
  units: number;
  averageOrder: number;
  changePercent: number | null;
  trend: { label: string; sales: number }[];
  products: { name: string; sales: number; quantity: number }[];
}

const sum = (rows: Sale[]) => rows.reduce((total, row) => total + row.amount, 0);

export function calculateMetrics(rows: Sale[], days = 30): Metrics {
  const valid = rows.filter((row) =>
    Number.isFinite(row.amount) && Number.isFinite(row.quantity) &&
    Number.isFinite(Date.parse(row.date)) && row.invoiceId.trim().length > 0
  );
  if (!valid.length) return { totalSales: 0, orderCount: 0, units: 0, averageOrder: 0, changePercent: null, trend: [], products: [] };

  const end = Math.max(...valid.map((row) => Date.parse(row.date)));
  const start = end - (days - 1) * 86_400_000;
  const previousStart = start - days * 86_400_000;
  const current = valid.filter((row) => Date.parse(row.date) >= start && Date.parse(row.date) <= end);
  const previous = valid.filter((row) => Date.parse(row.date) >= previousStart && Date.parse(row.date) < start);
  const totalSales = sum(current);
  const orderCount = new Set(current.map((row) => row.invoiceId)).size;
  const previousSales = sum(previous);
  const changePercent = previous.length && previousSales !== 0
    ? (totalSales - previousSales) / Math.abs(previousSales) * 100 : null;
  const byDay = new Map<string, number>();
  const byProduct = new Map<string, { sales: number; quantity: number }>();
  current.forEach((row) => {
    byDay.set(row.date, (byDay.get(row.date) ?? 0) + row.amount);
    const product = byProduct.get(row.productName) ?? { sales: 0, quantity: 0 };
    product.sales += row.amount;
    product.quantity += row.quantity;
    byProduct.set(row.productName, product);
  });
  return {
    totalSales, orderCount,
    units: current.reduce((total, row) => total + row.quantity, 0),
    averageOrder: orderCount ? totalSales / orderCount : 0,
    changePercent,
    trend: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([iso, sales]) => ({
      label: new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z")),
      sales,
    })),
    products: [...byProduct.entries()].map(([name, item]) => ({ name, ...item })).sort((a, b) => b.sales - a.sales).slice(0, 5),
  };
}

export function formatMoney(value: number): string {
  return "IRR " + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
