import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, AlertTriangle, ArrowDownToLine, BarChart3, Boxes, CheckCircle2, FileSpreadsheet, LayoutDashboard, Printer, RefreshCw, ShieldCheck, Truck, Upload } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { sampleSales } from "./data";
import { calculateMetrics, formatMoney } from "./lib/metrics";
import { readSalesFile } from "./lib/importer";
import type { Sale } from "./types";

type Page = "overview" | "import" | "quality" | "report";
const navigation: { id: Page; title: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", title: "Overview", icon: LayoutDashboard },
  { id: "import", title: "Import data", icon: FileSpreadsheet },
  { id: "quality", title: "Data quality", icon: ShieldCheck },
  { id: "report", title: "Management report", icon: BarChart3 },
];

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [sales, setSales] = useState<Sale[]>(sampleSales);
  const [period, setPeriod] = useState(30);
  const [isDemo, setIsDemo] = useState(true);
  const [fileName, setFileName] = useState("Synthetic demo data");
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const metrics = useMemo(() => calculateMetrics(sales, period), [sales, period]);

  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await readSalesFile(file);
      setSales(result.rows); setErrors(result.errors); setIsDemo(false); setFileName(file.name);
      setMessage(result.rows.length.toLocaleString("en-US") + " valid rows loaded; " + result.errors.length.toLocaleString("en-US") + " rows require review.");
      setPage("overview");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The file could not be read.");
    } finally { setBusy(false); }
  }

  function resetDemo() {
    setSales(sampleSales); setErrors([]); setIsDemo(true); setFileName("Synthetic demo data");
    setMessage("Synthetic sample data restored."); setPage("overview");
  }

  function safeCell(value: string): string {
    const guarded = /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
    return '"' + guarded.replace(/"/g, '""') + '"';
  }

  function downloadReport() {
    const rows = [["Product", "Sales amount (IRR)", "Units"],
      ...metrics.products.map((product) => [product.name, String(product.sales), String(product.quantity)])];
    const csv = rows.map((row) => row.map(safeCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "distropulse-product-report.csv";
    anchor.click(); URL.revokeObjectURL(url);
  }

  const activeTitle = navigation.find((item) => item.id === page)?.title ?? "Overview";
  const change = metrics.changePercent === null ? "No comparable baseline"
    : (metrics.changePercent >= 0 ? "▲ " : "▼ ") + Math.abs(metrics.changePercent).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "% vs previous period";

  return <div className="app" dir="ltr">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Activity size={21} /></span><div><b>DistroPulse</b><small>Distribution intelligence</small></div></div>
      <div className="workspace"><i /> Demo workspace</div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{navigation.map((item) => { const Icon = item.icon; return <button key={item.id} className={"nav-item" + (page === item.id ? " active" : "")} onClick={() => setPage(item.id)}><Icon size={18} />{item.title}</button>; })}</nav>
      <div className="side-bottom">
        <div className="privacy"><ShieldCheck size={18} /><div><b>Local file processing</b><p>Sales preview files stay in this browser.</p></div></div>
        <div className="user"><span>DP</span><div><b>Sales operator</b><small>Portfolio demo</small></div></div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> <b>{activeTitle}</b></div><div className="top-actions"><span className={"status" + (isDemo ? " demo" : "")}><i />{isDemo ? "Synthetic demo" : "Imported file"}</span><button className="icon-btn" onClick={resetDemo} title="Reset demo data" aria-label="Reset demo data"><RefreshCw size={16} /></button></div></header>
      <div className="content">
        <section className="heading"><div><small>OPERATIONS INTELLIGENCE</small><h1>{page === "overview" ? "Sales performance" : page === "import" ? "Import and inspect data" : page === "quality" ? "Data quality review" : "Management report"}</h1><p>Turn distribution sales files into clear, explainable operating metrics.</p></div><div className="actions"><label className="primary"><Upload size={16} /> Import file<input type="file" accept=".csv,.xlsx" hidden onChange={(event) => void importFile(event.target.files?.[0])} /></label><button className="secondary" onClick={() => window.print()}><Printer size={16} /> Print</button></div></section>
        {message && <div className="notice" role="status"><CheckCircle2 size={17} />{message}<button onClick={() => setMessage("")} aria-label="Dismiss message">×</button></div>}

        {page === "import" && <section className="panel import-panel"><div className="panel-head"><div><h2>Choose a sales file</h2><p>CSV or XLSX, up to 5 MiB. Files are parsed in memory.</p></div><FileSpreadsheet /></div><label className="drop"><Upload size={25} /><b>{busy ? "Reading file…" : "Choose a file to preview"}</b><span>Uploaded content is not sent to the API or stored by this preview flow.</span><input hidden disabled={busy} type="file" accept=".csv,.xlsx" onChange={(event) => void importFile(event.target.files?.[0])} /></label><div className="file-row"><span>Current source: {fileName}</span><a href="/distro-pulse-sample.csv" download>Download sample CSV <ArrowDownToLine size={14} /></a></div>{errors.length > 0 && <ErrorList errors={errors} />}</section>}

        {page === "quality" && <section className="panel"><div className="panel-head"><div><h2>Import quality summary</h2><p>Rows with validation issues are reported, not silently corrected.</p></div><ShieldCheck /></div><div className="quality-cards"><div><CheckCircle2 /><b>{sales.length.toLocaleString("en-US")}</b><span>Valid rows loaded</span></div><div><AlertTriangle /><b>{errors.length.toLocaleString("en-US")}</b><span>Rows needing review</span></div><div><Boxes /><b>{new Set(sales.map((row) => row.invoiceId)).size.toLocaleString("en-US")}</b><span>Distinct invoice IDs</span></div></div>{errors.length ? <ErrorList errors={errors} /> : <div className="empty"><CheckCircle2 /><b>No import errors were recorded.</b><span>This is not a substitute for a full source-data audit.</span></div>}</section>}

        {(page === "overview" || page === "report") && <>
          <div className="period-row"><span><i /> Analysis window <small>ending on the latest date in the selected data</small></span><div>{[30, 60, 90].map((day) => <button key={day} className={period === day ? "selected" : ""} onClick={() => setPeriod(day)}>{day} days</button>)}</div></div>
          <section className="kpis">
            <Kpi title="Sales in period" value={formatMoney(metrics.totalSales)} note={change} icon={<BarChart3 />} />
            <Kpi title="Distinct invoices" value={metrics.orderCount.toLocaleString("en-US")} note="Unique non-empty invoice IDs" icon={<FileSpreadsheet />} />
            <Kpi title="Units recorded" value={metrics.units.toLocaleString("en-US")} note="Sum of imported quantities" icon={<Boxes />} />
            <Kpi title="Average invoice value" value={formatMoney(metrics.averageOrder)} note="Sales divided by distinct invoices" icon={<Activity />} />
          </section>
          <section className="chart-grid">
            <div className="panel"><div className="panel-head"><div><h2>Sales trend</h2><p>Daily sales for dates represented in the file</p></div><span className="unit">IRR</span></div>{metrics.trend.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={metrics.trend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eee9" /><XAxis dataKey="label" tick={{ fill: "#74877a", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#74877a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(Number(value))} width={58} /><Tooltip formatter={(value) => [formatMoney(Number(value)), "Sales"]} /><Line dataKey="sales" type="monotone" stroke="#28775a" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div> : <div className="empty">Import data to display a trend.</div>}</div>
            <div className="panel"><div className="panel-head"><div><h2>Top products</h2><p>Ranked by recorded sales amount</p></div><Boxes /></div>{metrics.products.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.products} layout="vertical" margin={{ left: 4, right: 18 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8eee9" /><XAxis type="number" tick={{ fill: "#74877a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(Number(value))} /><YAxis type="category" dataKey="name" width={122} tick={{ fill: "#52685a", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [formatMoney(Number(value)), "Sales"]} /><Bar dataKey="sales" fill="#28775a" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <div className="empty">No product metrics are available.</div>}</div>
          </section>
          <section className="lower-grid">
            <div className="panel"><div className="panel-head"><div><h2>Product contribution</h2><p>Top products by recorded value</p></div><Truck /></div><div className="table-wrap"><table><thead><tr><th>Product</th><th>Sales</th><th>Units</th></tr></thead><tbody>{metrics.products.map((product) => <tr key={product.name}><td>{product.name}</td><td>{formatMoney(product.sales)}</td><td>{product.quantity.toLocaleString("en-US")}</td></tr>)}</tbody></table></div></div>
            <div className="panel report-card"><div className="panel-head"><div><h2>Report actions</h2><p>Export a small aggregate report</p></div><ArrowDownToLine /></div><p className="muted">Export includes product-level totals only. Validate source meaning, returns, discounts, tax and currency before business use.</p><button className="primary" onClick={downloadReport}><ArrowDownToLine size={16} /> Download product CSV</button><div className="report-note"><ShieldCheck size={16} /> Formula-like text values are escaped in the CSV export.</div></div>
          </section>
        </>}
      </div>
    </main>
  </div>;
}

function Kpi({ title, value, note, icon }: { title: string; value: string; note: string; icon: ReactNode }) {
  return <article className="kpi"><div className="kpi-top"><span>{title}</span><i>{icon}</i></div><strong>{value}</strong><small>{note}</small></article>;
}
function ErrorList({ errors }: { errors: string[] }) {
  return <div className="errors"><b><AlertTriangle size={16} /> Rows requiring review</b><ul>{errors.slice(0, 50).map((error, index) => <li key={index}>{error}</li>)}</ul>{errors.length > 50 && <small>Only the first 50 messages are shown.</small>}</div>;
}
