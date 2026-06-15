import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Empty, PageLoader, SearchBar } from "../../components/common";
import { useSundryDropdown, useVendorLedger } from "../../hooks/useApiQueries";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { notifyError } from "../../utils/helpers";
import { downloadCsv } from "../../utils/csvExport";

const money = (value, currency = "Rs.") => `${currency} ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function SummaryCard({ label, value, tone = "text-slate-800" }) {
  return <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">{label}</p><p className={`text-xl font-bold ${tone}`}>{money(value)}</p></div>;
}

export default function VendorLedgerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vendorId, setVendorId] = useState(searchParams.get("vendorId") || "");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data: vendors = [] } = useSundryDropdown({ role: "vendor" });
  const { data, isLoading, isFetching, error, refetch } = useVendorLedger({ vendorId, search: debouncedSearch, from, to });

  useEffect(() => { if (error) notifyError(error); }, [error]);
  useEffect(() => {
    const nextVendorId = searchParams.get("vendorId") || "";
    setVendorId(nextVendorId);
  }, [searchParams]);

  const changeVendor = (nextVendorId) => {
    setVendorId(nextVendorId);
    const next = new URLSearchParams(searchParams);
    if (nextVendorId) next.set("vendorId", nextVendorId);
    else next.delete("vendorId");
    setSearchParams(next, { replace: true });
  };

  const entries = data?.entries ?? [];
  const totals = data?.totals ?? {};
  const exportLedger = () => downloadCsv("vendor-ledger.csv", [
    { header: "Date", value: "date" },
    { header: "Vendor", value: "partyName" },
    { header: "Email", value: "partyEmail" },
    { header: "Reference", value: "reference" },
    { header: "Secondary Reference", value: "secondaryReference" },
    { header: "Booking", value: "bookingId" },
    { header: "Type", value: "type" },
    { header: "Description", value: "description" },
    { header: "Debit", value: "debit" },
    { header: "Credit", value: "credit" },
    { header: "Balance", value: "balance" },
    { header: "Currency", value: "currency" },
  ], entries);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendor Ledger</h1>
          <p className="page-subtitle">Bill credits, payment debits, and payable balances</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportLedger} className="btn-secondary" disabled={entries.length === 0}>
            <i className="fa fa-download" /> Export CSV
          </button>
          <button onClick={() => refetch()} className="btn-secondary" disabled={isFetching}>
            <i className={`fa ${isFetching ? "fa-spinner fa-spin" : "fa-sync-alt"}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Payment Debits" value={totals.debit} tone="text-green-600" />
        <SummaryCard label="Bill Credits" value={totals.credit} tone="text-red-600" />
        <SummaryCard label="Net Payable" value={totals.balance} tone={Number(totals.balance || 0) >= 0 ? "text-red-700" : "text-green-700"} />
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search vendor, bill, booking..." />
          <select className="input w-56" value={vendorId} onChange={(e) => changeVendor(e.target.value)}>
            <option value="">All vendors</option>
            {vendors.map((v) => <option key={v._id} value={v._id}>{v.contactPerson}{v.companyName ? ` (${v.companyName})` : ""}</option>)}
          </select>
          <input className="input w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          {(from || to || vendorId) && <button onClick={() => { setFrom(""); setTo(""); changeVendor(""); }} className="btn-ghost text-xs"><i className="fa fa-times" /> Clear</button>}
          <span className="text-sm text-slate-500 ml-auto">{entries.length} entr{entries.length === 1 ? "y" : "ies"}</span>
        </div>

        {isLoading ? <div className="p-8"><PageLoader /></div> : entries.length === 0 ? (
          <Empty icon="fa-book-open" message="No vendor ledger entries found" />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Date</th><th>Vendor</th><th>Reference</th><th>Booking</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={`${entry.partyName}-${entry.reference}-${idx}`}>
                    <td className="text-sm text-slate-500">{entry.date || "-"}</td>
                    <td><p className="font-medium text-slate-800">{entry.partyName || "-"}</p>{entry.partyEmail && <p className="text-xs text-slate-400">{entry.partyEmail}</p>}</td>
                    <td>
                      {entry.sourcePath ? (
                        <Link to={entry.sourcePath} className="font-mono text-xs text-brand-600 font-medium hover:underline">{entry.reference || "-"}</Link>
                      ) : (
                        <p className="font-mono text-xs text-brand-600">{entry.reference || "-"}</p>
                      )}
                      {entry.secondaryReference && <p className="text-xs text-slate-400">{entry.secondaryReference}</p>}
                    </td>
                    <td className="font-mono text-xs text-slate-500">{entry.bookingId || "-"}</td>
                    <td className="text-sm text-slate-600">{entry.description}</td>
                    <td className="text-green-600 font-semibold">{entry.debit ? money(entry.debit, entry.currency) : "-"}</td>
                    <td className="text-red-600 font-semibold">{entry.credit ? money(entry.credit, entry.currency) : "-"}</td>
                    <td className={entry.balance >= 0 ? "font-semibold text-red-700" : "font-semibold text-green-700"}>{money(entry.balance, entry.currency)}</td>
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
