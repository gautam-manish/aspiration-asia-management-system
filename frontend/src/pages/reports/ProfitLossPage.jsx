import { useEffect, useState } from "react";
import { Empty, PageLoader } from "../../components/common";
import { useProfitLoss } from "../../hooks/useApiQueries";
import { notifyError } from "../../utils/helpers";
import { downloadCsv } from "../../utils/csvExport";

const money = (value) => "NPR " + Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SummaryCard({ label, value, tone = "text-slate-800", suffix = "" }) {
  return <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">{label}</p><p className={`text-xl font-bold ${tone}`}>{value}{suffix}</p></div>;
}

export default function ProfitLossPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useProfitLoss({ from, to });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const totals = data?.totals ?? {};
  const counts = data?.counts ?? {};
  const categories = data?.byExpenseCategory ?? [];
  const months = data?.byMonth ?? [];
  const exportMonthly = () => downloadCsv("profit-loss-monthly.csv", [
    { header: "Month", value: "month" },
    { header: "Revenue", value: "revenue" },
    { header: "Direct Cost", value: "directCost" },
    { header: "Operating Expenses", value: "operatingExpenses" },
    { header: "Gross Profit", value: "grossProfit" },
    { header: "Net Profit", value: "netProfit" },
  ], months);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profit & Loss</h1>
          <p className="page-subtitle">Revenue, direct costs, operating expenses, and net profit in NPR</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportMonthly} className="btn-secondary" disabled={months.length === 0}><i className="fa fa-download" /> Export CSV</button>
          <button onClick={() => refetch()} className="btn-secondary" disabled={isFetching}><i className={`fa ${isFetching ? "fa-spinner fa-spin" : "fa-sync-alt"}`} /> Refresh</button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header flex-wrap gap-3">
          <input className="input w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
          <input className="input w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
          {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="btn-ghost text-xs"><i className="fa fa-times" /> Clear</button>}
          <span className="text-sm text-slate-500 ml-auto">
            {counts.invoices || 0} invoices, {counts.vendorBills || 0} vendor bills, {counts.officeExpenses || 0} expenses
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <SummaryCard label="Revenue" value={money(totals.revenue)} tone="text-green-600" />
        <SummaryCard label="Direct Cost" value={money(totals.directCost)} tone="text-red-600" />
        <SummaryCard label="Gross Profit" value={money(totals.grossProfit)} tone={Number(totals.grossProfit || 0) >= 0 ? "text-green-700" : "text-red-700"} />
        <SummaryCard label="Operating Expenses" value={money(totals.operatingExpenses)} tone="text-red-600" />
        <SummaryCard label="Net Profit" value={money(totals.netProfit)} tone={Number(totals.netProfit || 0) >= 0 ? "text-green-700" : "text-red-700"} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <SummaryCard label="Gross Margin" value={Number(totals.grossMarginPercent || 0).toFixed(2)} suffix="%" />
        <SummaryCard label="Net Margin" value={Number(totals.netMarginPercent || 0).toFixed(2)} suffix="%" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Expense Categories</h2></div>
          {isLoading ? <div className="p-8"><PageLoader /></div> : categories.length === 0 ? <Empty icon="fa-wallet" message="No operating expenses found" /> : (
            <div className="table-wrapper">
              <table className="table"><thead><tr><th>Category</th><th>Entries</th><th>Amount</th></tr></thead><tbody>
                {categories.map((row) => <tr key={row.key}><td><span className="badge badge-gray">{row.key}</span></td><td>{row.count}</td><td className="font-semibold text-red-600">{money(row.amount)}</td></tr>)}
              </tbody></table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Monthly P&L</h2></div>
          {isLoading ? <div className="p-8"><PageLoader /></div> : months.length === 0 ? <Empty icon="fa-chart-line" message="No P&L data found" /> : (
            <div className="table-wrapper">
              <table className="table"><thead><tr><th>Month</th><th>Revenue</th><th>Direct Cost</th><th>OpEx</th><th>Net Profit</th></tr></thead><tbody>
                {months.map((row) => (
                  <tr key={row.month}>
                    <td className="font-mono text-xs text-slate-600">{row.month}</td>
                    <td className="text-green-600 font-semibold">{money(row.revenue)}</td>
                    <td className="text-red-600">{money(row.directCost)}</td>
                    <td className="text-red-600">{money(row.operatingExpenses)}</td>
                    <td className={row.netProfit >= 0 ? "font-semibold text-green-700" : "font-semibold text-red-700"}>{money(row.netProfit)}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
