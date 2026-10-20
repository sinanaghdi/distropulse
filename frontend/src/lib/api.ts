const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export interface PreviewResponse {
  filename: string;
  columns: string[];
  row_count: number;
  non_empty_rows: number;
  preview: Record<string, string | number | boolean | null>[];
  persistent_storage: false;
  message: string;
}

export async function previewFileOnApi(file: File): Promise<PreviewResponse> {
  if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL تنظیم نشده است.");
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(API_BASE_URL + "/api/v1/sales/preview", { method: "POST", body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.detail === "string" ? payload.detail : "پیش‌نمایش فایل از API ناموفق بود.");
  }
  return payload as PreviewResponse;
}
