import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, PageLoader } from "../../components/common";
import { useApAging } from "../../hooks/useApiQueries";
import { notifyError } from "../../utils/helpers";
import { downloadCsv } from "../../utils/csvExport";

const today = () => new Date().toISOString().slice(0, 10);
const money = (value, currency = "Rs.") => `${currency} ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const bucketClass = { current: "badge-gray", "0-30": "badge-green", "31-60": "badge-yellow", "61-90": "badge-blue", "90+": "badge-red" };

function SummaryCard({ label, value, tone = "text-slate-800" }) {
  return <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">{label}</p><p className={`text-xl font-bold ${tone}`}>{money(value)}</p></div>;
}

export default function ApAgingPage() {
  const [asOf, setAsOf] = useState(today());
  const { data, isLoading, isFetching, error, refetch } = useApAging({ asOf });
  useEffect(() => { if (error) notifyError(error); }, [error]);
  const rows = data?.rows ?? [];
  const totals = data?.totals ?? {};
  const exportReport = () => downloadCsv("ap-aging.csv", [
    { header: "Bill Number", value: "billNumber" },
    { header: "Vendor Invoice Number", value: "vendorInvoiceNumber" },
    { header: "Bill Date", value: "billDate" },
    { header: "Due Date", value: "dueDate" },
    { header: "Vendor", value: "vendorName" },
    { header: "Email", value: "vendorEmail" },
    { header: "Booking", value: "bookingId" },
    { header: "Bill Total", value: "billTotal" },
    { header: "Paid", value: "paid" },
    { header: "Balance", value: "balance" },
    { header: "Age Days", value: "ageDays" },
    { header: "Bucket", value: "bucket" },
    { header: "Currency", value: "currency" },
  ], rows);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AP Aging</h1>
          <p className="page-subtitle">Outstanding vendor bill balances by age bucket</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportReport} className="btn-secondary" disabled={rows.length === 0}><i className="fa fa-download" /> Export CSV</button>
          <button onClick={() => refetch()} className="btn-secondary" disabled={isFetching}><i className={`fa ${isFetching ? "fa-spinner fa-spin" : "fa-sync-alt"}`} /> Refresh</button>
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
          <span className="text-sm text-slate-500 ml-auto">{rows.length === 0 ? "No outstanding vendor bills" : `${rows.length} open bill${rows.length !== 1 ? "s" : ""}`}</span>
        </div>

        {isLoading ? <div className="p-8"><PageLoader /></div> : rows.length === 0 ? (
          <Empty icon="fa-clock" message="No outstanding payables found" />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Bill #</th><th>Bill Date</th><th>Due Date</th><th>Vendor</th><th>Booking</th><th>Bill Total</th><th>Paid</th><th>Balance</th><th>Age</th><th>Bucket</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.vendorBillId}-${row.billNumber}`}>
                    <td><Link to={`/vendor-bills/${row.vendorBillId}`} className="font-mono text-xs text-brand-600 font-medium hover:underline">{row.billNumber}</Link>{row.vendorInvoiceNumber && <p className="text-xs text-slate-400">{row.vendorInvoiceNumber}</p>}</td>
                    <td className="text-sm text-slate-500">{row.billDate || "-"}</td>
                    <td className="text-sm text-slate-500">{row.dueDate || "-"}</td>
                    <td><p className="font-medium text-slate-800">{row.vendorName || "-"}</p>{row.vendorEmail && <p className="text-xs text-slate-400">{row.vendorEmail}</p>}</td>
                    <td className="font-mono text-xs text-slate-500">{row.bookingId || "-"}</td>
                    <td>{money(row.billTotal, row.currency)}</td>
                    <td className="text-green-600">{money(row.paid, row.currency)}</td>
                    <td className="font-semibold text-red-600">{money(row.balance, row.currency)}</td>
                    <td className="text-sm text-slate-500">{row.isOverdue ? `${row.ageDays} days` : "Current"}</td>
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
