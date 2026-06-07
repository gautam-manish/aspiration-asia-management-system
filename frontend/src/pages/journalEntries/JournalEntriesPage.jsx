import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Empty, PageLoader, Pagination, SearchBar } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useJournalEntriesPaginated } from "../../hooks/useApiQueries";
import { notifyError } from "../../utils/helpers";
import { journalEntryAPI } from "../../api";
import { useAuth } from "../../context/AuthContext";

const money = (value, currency = "Rs.") => `${currency} ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SOURCE_OPTIONS = [
  "invoice",
  "customer-payment",
  "vendor-bill",
  "vendor-payment",
  "office-expense",
];

export default function JournalEntriesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sourceEntity, setSourceEntity] = useState("");
  const [backfillSource, setBackfillSource] = useState("");
  const [backfillConfirm, setBackfillConfirm] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [backfilling, setBackfilling] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);
  const isAdmin = user?.role === "admin";
  const canBackfill = isAdmin && backfillConfirm === "BACKFILL JOURNALS";

  useEffect(() => { setPage(1); }, [debouncedSearch, sourceEntity, status, from, to]);

  const { data: { entries = [], total = 0, totalPages = 1 } = {}, isLoading, isFetching, error } =
    useJournalEntriesPaginated({ search: debouncedSearch, sourceEntity, status, from, to, page, limit: 50 });

  useEffect(() => { if (error) notifyError(error); }, [error]);

  const runBackfill = async () => {
    setBackfilling(true);
    try {
      const { data } = await journalEntryAPI.backfill({ sourceEntity: backfillSource, confirm: backfillConfirm });
      const totals = data?.data?.totals || {};
      toast.success(`Backfill complete: ${totals.posted || 0} posted, ${totals.skipped || 0} skipped`);
      setBackfillConfirm("");
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
    } catch (err) {
      notifyError(err);
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Journal Entries</h1>
          <p className="page-subtitle">Immutable debit and credit postings generated from finance workflows</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap justify-end gap-2">
            <select className="input w-44" value={backfillSource} onChange={(e) => setBackfillSource(e.target.value)}>
              <option value="">Backfill all</option>
              {SOURCE_OPTIONS.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
            <input
              className="input w-56"
              value={backfillConfirm}
              onChange={(e) => setBackfillConfirm(e.target.value)}
              placeholder="Type BACKFILL JOURNALS"
            />
            <button onClick={runBackfill} className="btn-secondary" disabled={backfilling || !canBackfill}>
              <i className={`fa ${backfilling ? "fa-spinner fa-spin" : "fa-database"}`} /> Backfill
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search entry, source, party, account..." />
          <select className="input w-48" value={sourceEntity} onChange={(e) => setSourceEntity(e.target.value)}>
            <option value="">All sources</option>
            {SOURCE_OPTIONS.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
          <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All status</option>
            <option value="posted">Posted</option>
            <option value="reversed">Reversed</option>
          </select>
          <input className="input w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          {(from || to || sourceEntity || status) && <button onClick={() => { setFrom(""); setTo(""); setSourceEntity(""); setStatus(""); }} className="btn-ghost text-xs"><i className="fa fa-times" /> Clear</button>}
          <span className="text-sm text-slate-500 ml-auto">{total} entr{total === 1 ? "y" : "ies"}</span>
        </div>

        {isLoading ? <div className="p-8"><PageLoader /></div> : entries.length === 0 ? (
          <Empty icon="fa-book" message="No journal entries found" />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Entry</th><th>Date</th><th>Source</th><th>Memo</th><th>Status</th><th>Debits</th><th>Credits</th></tr></thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry._id} className="align-top">
                      <td><p className="font-mono text-xs text-brand-600 font-medium">{entry.entryNumber}</p>{entry.sourceAction === "reversal" && <p className="text-xs text-red-500">Reversal</p>}</td>
                      <td className="text-sm text-slate-500">{entry.entryDate}</td>
                      <td><p className="text-sm font-medium text-slate-800">{entry.sourceEntity}</p><p className="font-mono text-xs text-slate-400">{entry.sourceNumber || entry.sourceId}</p></td>
                      <td className="text-sm text-slate-600 max-w-[220px]">{entry.memo || "-"}</td>
                      <td><span className={entry.status === "reversed" ? "badge-red" : "badge-green"}>{entry.status}</span></td>
                      <td className="text-sm">
                        {(entry.lines || []).filter((line) => Number(line.debit) > 0).map((line, idx) => (
                          <p key={`${line.accountCode}-d-${idx}`}><span className="font-mono text-xs text-slate-400">{line.accountCode}</span> {line.accountName}: <span className="font-semibold">{money(line.debit, entry.currency)}</span></p>
                        ))}
                      </td>
                      <td className="text-sm">
                        {(entry.lines || []).filter((line) => Number(line.credit) > 0).map((line, idx) => (
                          <p key={`${line.accountCode}-c-${idx}`}><span className="font-mono text-xs text-slate-400">{line.accountCode}</span> {line.accountName}: <span className="font-semibold">{money(line.credit, entry.currency)}</span></p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={50} onChange={setPage} isFetching={isFetching} />
          </>
        )}
      </div>
    </div>
  );
}
