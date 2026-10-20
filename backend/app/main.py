from __future__ import annotations

import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.app.services.file_preview import MAX_FILE_BYTES, PreviewError, read_table

app = FastAPI(
    title="DistroPulse API",
    description="API پایه برای پیش‌نمایش فایل‌های فروش؛ داده‌ها در این نسخه ذخیره نمی‌شوند.",
    version="0.1.0",
)

origins = [item.strip() for item in os.getenv(
    "DISTROPULSE_CORS_ORIGINS", "http://localhost:5173"
).split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "distropulse-api", "version": "0.1.0"}


@app.post("/api/v1/sales/preview")
async def preview_sales(file: UploadFile = File(...)) -> dict:
    """Inspect a file in memory. Preview never stores records permanently."""
    filename = file.filename or ""
    content = await file.read(MAX_FILE_BYTES + 1)
    await file.close()
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="حجم فایل بیشتر از ۵ مگابایت است.")
    try:
        columns, rows = read_table(filename, content)
    except PreviewError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    non_empty = [row for row in rows if any(value is not None and str(value).strip() for value in row.values())]
    return {
        "filename": filename,
        "columns": columns,
        "row_count": len(rows),
        "non_empty_rows": len(non_empty),
        "preview": rows[:20],
        "persistent_storage": False,
        "message": "پیش‌نمایش انجام شد؛ هیچ داده‌ای ذخیره نشده است.",
    }
