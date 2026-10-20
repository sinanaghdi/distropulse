import * as XLSX from "xlsx";
import type { Sale } from "../types";

export interface ImportResult { rows: Sale[]; errors: string[]; headers: string[]; }
const aliases = {
  date: ["تاریخ فروش", "تاریخ", "date", "sale date"],
  invoice: ["شناسه فاکتور", "شماره فاکتور", "فاکتور", "invoice", "invoice id", "order id"],
  code: ["کد محصول", "شناسه محصول", "product code", "sku"],
  product: ["نام محصول", "محصول", "product", "product name", "item"],
  quantity: ["تعداد", "quantity", "qty"],
  amount: ["مبلغ فروش", "مبلغ", "فروش", "amount", "sales", "total"],
  price: ["قیمت واحد", "قیمت", "unit price", "price"],
  customerId: ["شناسه مشتری", "کد مشتری", "customer id", "customer code"],
  customer: ["نام مشتری", "مشتری", "customer", "customer name"],
} as const;

function key(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("fa-IR").replace(/[\s_\-]+/g, "");
}
function valueOf(row: Record<string, unknown>, names: readonly string[]): unknown {
  const field = Object.keys(row).find((candidate) => names.some((name) => key(name) === key(candidate)));
  return field === undefined ? undefined : row[field];
}
function numberOf(value: unknown): number | null {
  const digits = String(value ?? "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٬,\s]/g, "").replace("٫", ".");
  if (!digits) return null;
  const n = Number(digits); return Number.isFinite(n) ? n : null;
}
function dateOf(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
    const parts = raw.split("-").map(Number);
    return String(parts[0]) + "-" + String(parts[1]).padStart(2, "0") + "-" + String(parts[2]).padStart(2, "0");
  }
  return raw;
}

export async function readSalesFile(file: File): Promise<ImportResult> {
  if (file.size > 5 * 1024 * 1024) throw new Error("حجم فایل نباید بیشتر از ۵ مگابایت باشد.");
  if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error("فقط فایل CSV یا XLSX قابل قبول است.");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("فایل برگه‌ی قابل خواندنی ندارد.");
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  if (!raw.length) throw new Error("در فایل ردیف داده‌ای پیدا نشد.");
  const headers = Object.keys(raw[0] ?? []);
  const rows: Sale[] = [];
  const errors: string[] = [];
  raw.forEach((source, index) => {
    const date = dateOf(valueOf(source, aliases.date));
    const invoiceId = String(valueOf(source, aliases.invoice) ?? "").trim();
    const productName = String(valueOf(source, aliases.product) ?? "").trim();
    const quantity = numberOf(valueOf(source, aliases.quantity));
    const amountValue = valueOf(source, aliases.amount);
    const unitPrice = numberOf(valueOf(source, aliases.price));
    const amount = amountValue === undefined || String(amountValue).trim() === ""
      ? (quantity !== null && unitPrice !== null ? quantity * unitPrice : null) : numberOf(amountValue);
    if (!date || !Number.isFinite(Date.parse(date))) { errors.push("ردیف " + (index + 2) + ": تاریخ نامعتبر یا خالی است."); return; }
    if (!invoiceId) { errors.push("ردیف " + (index + 2) + ": شناسه فاکتور مشخص نیست."); return; }
    if (!productName) { errors.push("ردیف " + (index + 2) + ": نام محصول مشخص نیست."); return; }
    if (quantity === null || amount === null) { errors.push("ردیف " + (index + 2) + ": تعداد یا مبلغ عددی نیست."); return; }
    rows.push({
      date, invoiceId, productCode: String(valueOf(source, aliases.code) ?? "").trim(),
      productName, quantity, amount,
      customerId: String(valueOf(source, aliases.customerId) ?? "").trim(),
      customerName: String(valueOf(source, aliases.customer) ?? "بدون نام").trim() || "بدون نام",
    });
  });
  if (!rows.length) throw new Error("هیچ ردیف معتبری پیدا نشد؛ نام ستون‌ها را با فایل نمونه مقایسه کنید.");
  return { rows, errors, headers };
}
