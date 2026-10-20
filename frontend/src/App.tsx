import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, AlertTriangle, ArrowDownToLine, BarChart3, Boxes, CheckCircle2, FileSpreadsheet, LayoutDashboard, Printer, RefreshCw, ShieldCheck, Upload, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { sampleSales } from "./data";
import { calculateMetrics, formatMoney } from "./lib/metrics";
import { readSalesFile } from "./lib/importer";
import type { Sale } from "./types";

type Page = "overview" | "import" | "quality" | "report";
const nav: { id: Page; title: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", title: "نمای کلی", icon: LayoutDashboard },
  { id: "import", title: "ورود داده", icon: FileSpreadsheet },
  { id: "quality", title: "کیفیت داده", icon: ShieldCheck },
  { id: "report", title: "گزارش مدیریتی", icon: BarChart3 },
];

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [sales, setSales] = useState<Sale[]>(sampleSales);
  const [period, setPeriod] = useState(30);
  const [isDemo, setIsDemo] = useState(true);
  const [fileName, setFileName] = useState("اطلاعات آزمایشی");
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const metrics = useMemo(() => calculateMetrics(sales, period), [sales, period]);

  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      const result = await readSalesFile(file);
      setSales(result.rows); setErrors(result.errors); setIsDemo(false); setFileName(file.name);
      setMessage(result.rows.length.toLocaleString("fa-IR") + " ردیف معتبر خوانده شد؛ " + result.errors.length.toLocaleString("fa-IR") + " ردیف نیازمند بررسی است.");
      setPage("overview");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "خواندن فایل انجام نشد.");
    } finally { setBusy(false); }
  }

  function resetDemo() {
    setSales(sampleSales); setErrors([]); setIsDemo(true); setFileName("اطلاعات آزمایشی");
    setMessage("داده‌های آزمایشی بازیابی شدند."); setPage("overview");
  }

  function downloadReport() {
    const rows = [["نام محصول", "مبلغ فروش", "تعداد"], ...metrics.products.map((p) => [p.name, String(p.sales), String(p.quantity)])];
    const csv = rows.map((r) => r.map((v) => '"' + v.replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "distropulse-report.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  const money = (value: number) => new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(value);
  const activeTitle = nav.find((item) => item.id === page)?.title ?? "نمای کلی";
  const change = metrics.changePercent === null ? "داده‌ی مقایسه‌ای کافی نیست"
    : (metrics.changePercent >= 0 ? "▲ " : "▼ ") + Math.abs(metrics.changePercent).toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + "٪ نسبت به دوره‌ی قبل";

  return <div className="app" dir="rtl">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Activity size={21} /></span><div><b>DistroPulse</b><small>هوشمندتر از فایل خام</small></div></div>
      <div className="workspace"><i /> فضای کاری نمونه</div><div className="nav-label">محیط تحلیل</div>
      <nav>{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={"nav-item" + (page === item.id ? " active" : "")} onClick={() => setPage(item.id)}><Icon size={18} />{item.title}</button>; })}</nav>
      <div className="side-bottom"><div className="privacy"><ShieldCheck size={18} /><div><b>حریم داده</b><p>فایل در مرورگر پردازش می‌شود.</p></div></div><div className="user"><span>DP</span><div><b>مدیر فروش</b><small>نسخه اولیه</small></div></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">محیط کار <span>/</span> <b>{activeTitle}</b></div><div className="top-actions"><span className={"status" + (isDemo ? " demo" : "")}><i />{isDemo ? "اطلاعات آزمایشی" : "فایل بارگذاری‌شده"}</span><button className="icon-btn" onClick={resetDemo} title="بازنشانی داده‌ها"><RefreshCw size={16} /></button></div></header>
      <div className="content">
        <section className="heading"><div><small>مرکز تصمیم‌گیری فروش</small><h1>{page === "overview" ? "نمای کلی فروش" : page === "import" ? "ورود و بررسی داده" : page === "quality" ? "کیفیت داده‌ها" : "گزارش مدیریتی"}</h1><p>تصویر روشنی از عملکرد فروش، بدون محاسبات دستی تکراری.</p></div><div className="actions"><label className="primary"><Upload size={16} /> بارگذاری فایل<input type="file" accept=".csv,.xlsx" hidden onChange={(event) => void importFile(event.target.files?.[0])} /></label><button className="secondary" onClick={() => window.print()}><Printer size={16} /> چاپ</button></div></section>
        {message && <div className="notice" role="status"><CheckCircle2 size={17} />{message}<button onClick={() => setMessage("")}>×</button></div>}

        {page === "import" && <section className="panel import-panel"><div className="panel-head"><div><h2>فایل فروش را انتخاب کنید</h2><p>فقط CSV و XLSX؛ حداکثر حجم ۵ مگابایت</p></div><FileSpreadsheet /></div><label className="drop"><Upload size={25} /><b>{busy ? "در حال خواندن فایل…" : "برای انتخاب فایل کلیک کنید"}</b><span>پردازش در مرورگر انجام می‌شود و فایل خودکار ارسال نمی‌شود.</span><input hidden disabled={busy} type="file" accept=".csv,.xlsx" onChange={(event) => void importFile(event.target.files?.[0])} /></label><div className="file-row"><span>منبع: {fileName}</span><a href="/distro-pulse-sample.csv" download>دانلود فایل نمونه <ArrowDownToLine size={14} /></a></div>{errors.length > 0 && <ErrorList errors={errors} />}</section>}

        {page === "quality" && <section className="panel"><div className="panel-head"><div><h2>خلاصه‌ی کیفیت داده</h2><p>ردیف‌های مشکل‌دار حذف یا اصلاح نمی‌شوند.</p></div><ShieldCheck /></div><div className="quality-cards"><div><CheckCircle2 /><b>{sales.length.toLocaleString("fa-IR")}</b><span>ردیف قابل‌استفاده</span></div><div><AlertTriangle /><b>{errors.length.toLocaleString("fa-IR")}</b><span>ردیف نیازمند بررسی</span></div><div><Boxes /><b>{new Set(sales.map((row) => row.invoiceId)).size.toLocaleString("fa-IR")}</b><span>فاکتور یکتا</span></div></div>{errors.length ? <ErrorList errors={errors} /> : <div className="empty"><CheckCircle2 /><b>در پردازش فعلی خطایی ثبت نشده است.</b><span>این نتیجه جایگزین ممیزی کامل کیفیت داده نیست.</span></div>}</section>}

        {(page === "overview" || page === "report") && <>
          <div className="period-row"><span><i /> بازه‌ی تحلیل <small>تا آخرین تاریخ موجود در فایل</small></span><div>{[30, 60, 90].map((day) => <button key={day} className={period === day ? "selected" : ""} onClick={() => setPeriod(day)}>{day.toLocaleString("fa-IR")} روز</button>)}</div></div>
          <section className="kpis">
            <Kpi title="فروش در بازه" value={formatMoney(metrics.totalSales)} note={change} icon={<BarChart3 />} />
            <Kpi title="فاکتورهای یکتا" value={metrics.orderCount.toLocaleString("fa-IR")} note="شناسه فاکتورهای معتبر" icon={<FileSpreadsheet />} />
            <Kpi title="واحد فروخته‌شده" value={metrics.units.toLocaleString("fa-IR")} note="مجموع تعداد ردیف‌ها" icon={<Boxes />} />
            <Kpi title="میانگین مبلغ فاکتور" value={formatMoney(metrics.averageOrder)} note="فروش تقسیم بر فاکتور یکتا" icon={<Activity />} />
          </section>
          <section className="chart-grid">
            <div className="panel"><div className="panel-head"><div><h2>روند فروش</h2><p>مبلغ فروش در روزهای دارای داده</p></div><span className="unit">ریال</span></div>{metrics.trend.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={metrics.trend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eee9" /><XAxis dataKey="label" tick={{ fill: "#74877a", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#74877a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={money} width={70} /><Tooltip formatter={(value) => [formatMoney(Number(value)), "فروش"]} /><Line dataKey="sales" type="monotone" stroke="#28775a" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div> : <div className="empty">برای نمایش نمودار داده وارد کنید.</div>}</div>
            <div className="panel"><div className="panel-head"><div><h2>محصولات برتر</h2><p>رتبه‌بندی بر اساس مبلغ فروش</p></div><Boxes /></div>{metrics.products.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.products} layout="vertical" margin={{ left: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8eee9" /><XAxis type="number" tick={{ fill: "#74877a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={money} /><YAxis type="category" dataKey="name" width={108} tick={{ fill: "#566a5b", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [formatMoney(Number(value)), "فروش"]} /><Bar dataKey="sales" fill="#28775a" radius={[0, 5, 5, 0]} barSize={17} /></BarChart></ResponsiveContainer></div> : <div className="empty">محصول قابل‌رتبه‌بندی وجود ندارد.</div>}</div>
          </section>
          <section className="bottom-grid"><div className="panel"><div className="panel-head"><div><h2>جزئیات محصولات</h2><p>مبالغ محاسبه‌شده از داده‌ی ورودی</p></div><button className="link-btn" onClick={downloadReport}>خروجی CSV <ArrowDownToLine size={14} /></button></div><div className="table-scroll"><table><thead><tr><th>محصول</th><th>تعداد</th><th>مبلغ فروش</th><th>سهم</th></tr></thead><tbody>{metrics.products.map((product) => <tr key={product.name}><td>{product.name}</td><td>{product.quantity.toLocaleString("fa-IR")}</td><td>{money(product.sales)}</td><td>{metrics.totalSales ? (product.sales / metrics.totalSales * 100).toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + "٪" : "—"}</td></tr>)}</tbody></table></div></div>
            <div className="panel"><div className="panel-head"><div><h2>خلاصه مدیریتی</h2><p>بر پایه‌ی محاسبات قطعی</p></div><Activity /></div><div className="summary"><i />{metrics.totalSales > 0 ? "در بازه انتخاب‌شده " + formatMoney(metrics.totalSales) + " فروش محاسبه شده است." : "برای این بازه فروش قابل‌محاسبه‌ای ثبت نشده است."}</div>{metrics.products[0] && <div className="insight"><small>محصول اول از نظر مبلغ</small><b>{metrics.products[0].name}</b><span>{formatMoney(metrics.products[0].sales)}</span></div>}<p className="warning"><AlertTriangle size={14} />تفسیر فروش منفی به قواعد مرجوعی و اصلاح فاکتور وابسته است.</p></div>
          </section>
        </>}
        <footer className="footer"><span>© DistroPulse · نسخه‌ی اولیه</span><span><ShieldCheck size={14} /> شاخص‌ها از داده‌ی فعلی محاسبه شده‌اند</span></footer>
      </div>
    </main>
  </div>;
}

function Kpi({ title, value, note, icon }: { title: string; value: string; note: string; icon: ReactNode }) {
  return <article className="kpi"><div className="kpi-head"><span>{title}</span><i>{icon}</i></div><b>{value}</b><small>{note}</small></article>;
}
function ErrorList({ errors }: { errors: string[] }) {
  return <div className="error-list"><b>{errors.length.toLocaleString("fa-IR")} ردیف نیازمند بررسی</b>{errors.slice(0, 15).map((error) => <p key={error}><AlertTriangle size={14} />{error}</p>)}</div>;
}
