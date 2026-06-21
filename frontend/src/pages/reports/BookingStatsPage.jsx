import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, PageLoader, Pagination, SearchBar } from "../../components/common";
import { useBookingStats } from "../../hooks/useApiQueries";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { notifyError } from "../../utils/helpers";
import { downloadCsv } from "../../utils/csvExport";

const money = (value) => `NPR ${Number(value || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

function Stat({ label, value, tone = "text-slate-800", icon }) {
  return (
    <div className="card card-body !py-4 flex flex-row items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
        <i className={`fa ${icon} text-sm`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`text-lg font-bold truncate ${tone}`}>{value}</p>
      </div>
    </div>
  );
}

export default function BookingStatsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isFetching, error, refetch } = useBookingStats({
    search: debouncedSearch,
    page,
    limit: 50,
  });

  useEffect(() => { setPage(1); }, [debouncedSearch]);
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? {};
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const exportStats = () => downloadCsv("booking-stats.csv", [
    { header: "Booking ID", value: "bookingId" },
    { header: "Client", value: "clientName" },
    { header: "Company", value: "companyName" },
    { header: "Destination", value: "destination" },
    { header: "Arrival", value: "arrivalDate" },
    { header: "Departure", value: "departureDate" },
    { header: "Total Income NPR", value: "totalIncome" },
    { header: "Total Expense NPR", value: "totalExpense" },
    { header: "Profit NPR", value: "profit" },
    { header: "Margin Percent", value: "marginPercent" },
    { header: "Invoices", value: (row) => (row.invoiceNumbers || []).join(", ") },
    { header: "Purchase Entries", value: (row) => (row.purchaseReferences || []).join(", ") },
  ], rows);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Booking Stats</h1>
          <p className="page-subtitle">Confirmed booking income, expenses, and profit in NPR</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportStats} disabled={rows.length === 0} className="btn-secondary">
            <i className="fa fa-download" /> Export CSV
          </button>
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-secondary">
            <i className={`fa ${isFetching ? "fa-spinner fa-spin" : "fa-sync-alt"}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat label="Confirmed Bookings" value={totals.bookings || 0} icon="fa-bookmark" />
        <Stat label="Total Income" value={money(totals.income)} tone="text-green-700" icon="fa-arrow-down" />
        <Stat label="Total Expenses" value={money(totals.expense)} tone="text-red-600" icon="fa-arrow-up" />
        <Stat label="Total Profit" value={money(totals.profit)} tone={Number(totals.profit || 0) >= 0 ? "text-green-700" : "text-red-600"} icon="fa-chart-line" />
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search booking, client, company, destination..." />
          <span className="text-sm text-slate-500 ml-auto">
            {total} confirmed booking{total !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="p-8"><PageLoader /></div>
        ) : rows.length === 0 ? (
          <Empty icon="fa-chart-bar" message="No confirmed bookings found" />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Client / Company</th>
                    <th>Destination</th>
                    <th>Travel Dates</th>
                    <th className="text-right">Income</th>
                    <th className="text-right">Expenses</th>
                    <th className="text-right">Profit</th>
                    <th className="text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.bookingDbId || row.bookingId}>
                      <td>
                        <Link to={`/bookings/${row.bookingDbId}`} className="font-mono text-xs font-semibold text-brand-600 hover:underline">
                          {row.bookingId || "-"}
                        </Link>
                      </td>
                      <td>
                        <p className="font-medium text-slate-800">{row.clientName || "-"}</p>
                        {row.companyName && <p className="text-xs text-slate-400">{row.companyName}</p>}
                      </td>
                      <td className="text-sm text-slate-600">{row.destination || "-"}</td>
                      <td className="text-xs text-slate-500 whitespace-nowrap">
                        <p>{row.arrivalDate || "-"}</p>
                        <p className="text-slate-400">{row.departureDate || "-"}</p>
                      </td>
                      <td className="text-right">
                        <p className="font-semibold text-green-700 whitespace-nowrap">{money(row.totalIncome)}</p>
                        <p className="text-xs text-slate-400">{row.invoiceCount} invoice{row.invoiceCount !== 1 ? "s" : ""}</p>
                      </td>
                      <td className="text-right">
                        <p className="font-semibold text-red-600 whitespace-nowrap">{money(row.totalExpense)}</p>
                        <p className="text-xs text-slate-400">{row.purchaseEntryCount} purchase entr{row.purchaseEntryCount === 1 ? "y" : "ies"}</p>
                      </td>
                      <td className={`text-right font-bold whitespace-nowrap ${row.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {money(row.profit)}
                      </td>
                      <td className="text-right">
                        <span className={`badge ${row.profit >= 0 ? "badge-green" : "badge-red"}`}>{Number(row.marginPercent || 0).toFixed(2)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={50}
              onChange={setPage}
              isFetching={isFetching}
            />
          </>
        )}
      </div>
    </div>
  );
}
