import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, PageLoader } from "../../components/common";
import { useArAging } from "../../hooks/useApiQueries";
import { notifyError } from "../../utils/helpers";
import { downloadCsv } from "../../utils/csvExport";

const today = () => new Date().toISOString().slice(0, 10);

const money = (value, currency = "Rs.") =>
  `${currency} ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const bucketClass = {
  current: "badge-gray",
  "0-30": "badge-green",
  "31-60": "badge-yellow",
  "61-90": "badge-blue",
  "90+": "badge-red",
};

function SummaryCard({ label, value, tone = "text-slate-800" }) {
  return (
    <div className="card card-body !py-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${tone}`}>{money(value)}</p>
    </div>
  );
}

export default function ArAgingPage() {
  const [asOf, setAsOf] = useState(today());
  const [minBalance, setMinBalance] = useState("0.01");
  const { data, isLoading, isFetching, error, refetch } = useArAging({
    asOf,
    minBalance: Number(minBalance) || 0.01,
  });

  useEffect(() => {
    if (error) notifyError(error);
  }, [error]);

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? {};
  const exportReport = () => downloadCsv("ar-aging.csv", [
    { header: "Invoice Number", value: "invoiceNumber" },
    { header: "Invoice Date", value: "invoiceDate" },
    { header: "Due Date", value: "dueDate" },
    { header: "Customer", value: "customerName" },
    { header: "Email", value: "customerEmail" },
    { header: "Booking", value: "bookingId" },
    { header: "Invoice Total", value: "invoiceTotal" },
    { header: "Paid", value: "paid" },
    { header: "Balance", value: "balance" },
    { header: "Age Days", value: "ageDays" },
    { header: "Bucket", value: "bucket" },
    { header: "Currency", value: "currency" },
  ], rows);

  const largestCurrency = useMemo(() => {
    const match = rows.find((row) => row.currency);
    return match?.currency || "Rs.";
  }, [rows]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AR Aging</h1>
          <p className="page-subtitle">Outstanding customer invoice balances by age bucket</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportReport} className="btn-secondary" disabled={rows.length === 0}>
            <i className="fa fa-download" /> Export CSV
          </button>
          <button onClick={() => refetch()} className="btn-secondary" disabled={isFetching}>
            <i className={`fa ${isFetching ? "fa-spinner fa-spin" : "fa-sync-alt"}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
        <SummaryCard label="Outstanding" value={totals.outstanding} tone="text-red-600" />
        <SummaryCard label="Current" value={totals.current} tone="text-slate-700" />
        <SummaryCard label="0-30 Days" value={totals["0-30"]} tone="text-green-600" />
        <SummaryCard label="31-60 Days" value={totals["31-60"]} tone="text-yellow-600" />
        <SummaryCard label="61-90 Days" value={totals["61-90"]} tone="text-blue-600" />
        <SummaryCard label="90+ Days" value={totals["90+"]} tone="text-red-700" />
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">As Of</span>
            <input className="input w-40" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Min Balance</span>
            <input
              className="input w-32"
              type="number"
              min="0"
              step="any"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
            />
          </div>
          <span className="text-sm text-slate-500 ml-auto">
            {rows.length === 0 ? "No outstanding invoices" : `${rows.length} open invoice${rows.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {isLoading ? (
          <div className="p-8"><PageLoader /></div>
        ) : rows.length === 0 ? (
          <Empty icon="fa-clock" message="No outstanding receivables found" />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Invoice / Due</th>
                  <th>Customer</th>
                  <th>Booking</th>
                  <th>Invoice Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Age</th>
                  <th>Bucket</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.invoiceId}-${row.invoiceNumber}`}>
                    <td>
                      {row.invoiceId ? (
                        <Link to={`/invoices/${row.invoiceId}`} className="font-mono text-xs text-brand-600 font-medium hover:underline">
                          {row.invoiceNumber || "-"}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-slate-500">{row.invoiceNumber || "-"}</span>
                      )}
                    </td>
                    <td className="text-sm text-slate-500">
                      <p>{row.invoiceDate || "-"}</p>
                      <p className="text-xs text-slate-400">Due {row.dueDate || row.invoiceDate || "-"}</p>
                    </td>
                    <td>
                      <p className="font-medium text-slate-800">{row.customerName || "-"}</p>
                      {row.customerEmail && <p className="text-xs text-slate-400">{row.customerEmail}</p>}
                    </td>
                    <td className="font-mono text-xs text-slate-500">{row.bookingId || "-"}</td>
                    <td className="text-sm text-slate-700">{money(row.invoiceTotal, row.currency || largestCurrency)}</td>
                    <td className="text-sm text-green-600">{money(row.paid, row.currency || largestCurrency)}</td>
                    <td className="font-semibold text-red-600">{money(row.balance, row.currency || largestCurrency)}</td>
                    <td className="text-sm text-slate-500">
                      {row.isOverdue ? `${row.ageDays} days` : "Current"}
                    </td>
                    <td><span className={bucketClass[row.bucket] || "badge-gray"}>{row.bucket === "current" ? "Current" : row.bucket}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
