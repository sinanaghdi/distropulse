# قرارداد اولیه API

داده‌های فایل فقط در حافظه خوانده و پیش‌نمایش می‌شوند. API فعلی رکوردی را به‌طور دائمی ذخیره نمی‌کند.

## GET /api/v1/health
نمونه پاسخ:
```json
{ "status": "ok", "service": "distropulse-api", "version": "0.1.0" }
```

## POST /api/v1/sales/preview
- ورودی: multipart/form-data با فیلد file؛ فایل CSV یا XLSX تا ۵ مگابایت.
- خروجی: نام فایل، ستون‌ها، تعداد ردیف‌ها، ۲۰ ردیف نخست و persistent_storage=false.
- خطاها: 400 برای ساختار نامعتبر، 413 برای حجم بیش از سقف.
- ذخیره‌سازی دائمی انجام نمی‌شود.

## Endpointهای آتی و پیاده‌سازی‌نشده
- POST /api/v1/sales/import
- GET /api/v1/reports/overview
- GET /api/v1/reports/trends
- GET /api/v1/reports/products
- GET /api/v1/reports/customers
- GET /api/v1/reports/quality
- POST /api/v1/reports/summary
- GET /api/v1/exports/report

این مسیرها تا زمان پیاده‌سازی واقعی، فعال یا آماده معرفی نمی‌شوند.
