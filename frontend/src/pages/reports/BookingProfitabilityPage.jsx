import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, PageLoader, SearchBar } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useBookingProfitability } from "../../hooks/useApiQueries";
import { notifyError } from "../../utils/helpers";
import { downloadCsv } from "../../utils/csvExport";

const money = (value, currency = "NPR") => `${currency} ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function SummaryCard({ label, value, tone = "text-slate-800", suffix = "" }) {
  return (
    <div className="card card-body !py-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${tone}`}>{value}{suffix}</p>
    </div>
  );
}

function MiniGroupTable({ title, rows }) {
  const topRows = (rows || []).slice(0, 6);
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="font-display font-semibold text-slate-800">{title}</h2>
      </div>
      {topRows.length === 0 ? (
        <Empty icon="fa-chart-pie" message="No grouped data found" />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Name</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin</th></tr></thead>
            <tbody>
              {topRows.map((row) => (
                <tr key={row.key}>
                  <td className="font-medium text-slate-800">{row.key}</td>
                  <td>{money(row.revenue)}</td>
                  <td className="text-red-600">{money(row.directCost)}</td>
                  <td className={row.grossProfit >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{money(row.grossProfit)}</td>
                  <td>{row.marginPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BookingProfitabilityPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isFetching, error, refetch } = useBookingProfitability({ from, to, search: debouncedSearch });

  useEffect(() => { if (error) notifyError(error); }, [error]);

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? {};
  const exportReport = () => downloadCsv("booking-profitability.csv", [
    { header: "Booking", value: "bookingId" },
    { header: "Customer", value: (row) => row.customerName || row.companyName || "" },
    { header: "Company", value: "companyName" },
    { header: "Destination", value: "destination" },
    { header: "Arrival Date", value: "arrivalDate" },
    { header: "Departure Date", value: "departureDate" },
    { header: "Revenue", value: "revenue" },
    { header: "Direct Cost", value: "directCost" },
    { header: "Gross Profit", value: "grossProfit" },
    { header: "Margin Percent", value: "marginPercent" },
    { header: "Invoice Count", value: "invoiceCount" },
    { header: "Invoices", value: (row) => (row.invoiceNumbers || []).join(", ") },
    { header: "Vendor Bill Count", value: "vendorBillCount" },
    { header: "Vendor Bills", value: (row) => (row.vendorBillNumbers || []).join(", ") },
    { header: "Currency", value: "currency" },
  ], rows);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Booking Profitability</h1>
          <p className="page-subtitle">Revenue, direct vendor cost, gross profit, and margin per booking in NPR</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Revenue" value={money(totals.revenue)} tone="text-green-600" />
        <SummaryCard label="Direct Cost" value={money(totals.directCost)} tone="text-red-600" />
        <SummaryCard label="Gross Profit" value={money(totals.grossProfit)} tone={Number(totals.grossProfit || 0) >= 0 ? "text-green-700" : "text-red-700"} />
        <SummaryCard label="Profit Margin" value={Number(totals.marginPercent || 0).toFixed(2)} suffix="%" tone="text-slate-800" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <MiniGroupTable title="By Customer" rows={data?.byCustomer} />
        <MiniGroupTable title="By Destination" rows={data?.byDestination} />
        <MiniGroupTable title="By Month" rows={data?.byMonth} />
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search booking, customer, destination..." />
          <input className="input w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
          <input className="input w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
          {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="btn-ghost text-xs"><i className="fa fa-times" /> Clear</button>}
          <span className="text-sm text-slate-500 ml-auto">{rows.length} booking{rows.length !== 1 ? "s" : ""}</span>
        </div>

        {isLoading ? <div className="p-8"><PageLoader /></div> : rows.length === 0 ? (
          <Empty icon="fa-chart-line" message="No profitability data found" />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Destination</th>
                  <th>Revenue</th>
                  <th>Direct Cost</th>
                  <th>Gross Profit</th>
                  <th>Margin</th>
                  <th>Invoices</th>
                  <th>Vendor Bills</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.bookingId || "UNLINKED"}>
                    <td>
                      {row.bookingDbId ? (
                        <Link to={`/bookings/${row.bookingDbId}`} className="font-mono text-xs text-brand-600 font-medium hover:underline">{row.bookingId || "Unlinked"}</Link>
                      ) : (
                        <p className="font-mono text-xs text-brand-600 font-medium">{row.bookingId || "Unlinked"}</p>
                      )}
                      {row.arrivalDate && <p className="text-xs text-slate-400">{row.arrivalDate}</p>}
                    </td>
                    <td>
                      <p className="font-medium text-slate-800">{row.customerName || row.companyName || "-"}</p>
                      {row.companyName && row.customerName && <p className="text-xs text-slate-400">{row.companyName}</p>}
                    </td>
                    <td className="text-sm text-slate-600">{row.destination || "-"}</td>
                    <td className="font-semibold text-green-600">{money(row.revenue, row.currency)}</td>
                    <td className="font-semibold text-red-600">{money(row.directCost, row.currency)}</td>
                    <td className={row.grossProfit >= 0 ? "font-semibold text-green-700" : "font-semibold text-red-700"}>{money(row.grossProfit, row.currency)}</td>
                    <td>{row.marginPercent}%</td>
                    <td>
                      <p className="text-sm text-slate-600">{row.invoiceCount}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[160px]">
                        {(row.invoiceNumbers || []).map((number, idx) => (
                          row.invoiceIds?.[idx]
                            ? <Link key={number} to={`/invoices/${row.invoiceIds[idx]}`} className="hover:underline text-brand-600">{idx > 0 ? `, ${number}` : number}</Link>
                            : <span key={number}>{idx > 0 ? `, ${number}` : number}</span>
                        ))}
                      </p>
                    </td>
                    <td>
                      <p className="text-sm text-slate-600">{row.vendorBillCount}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[160px]">
                        {(row.vendorBillNumbers || []).map((number, idx) => (
                          row.vendorBillIds?.[idx]
                            ? <Link key={number} to={`/vendor-bills/${row.vendorBillIds[idx]}`} className="hover:underline text-brand-600">{idx > 0 ? `, ${number}` : number}</Link>
                            : <span key={number}>{idx > 0 ? `, ${number}` : number}</span>
                        ))}
                      </p>
                    </td>
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
