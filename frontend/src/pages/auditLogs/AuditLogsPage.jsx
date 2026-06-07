import { useEffect, useState } from "react";
import { Empty, PageLoader, Pagination, SearchBar } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useAuditLogsPaginated } from "../../hooks/useApiQueries";
import { notifyError } from "../../utils/helpers";

const ENTITIES = [
  "booking",
  "invoice",
  "cash-receipt",
  "customer-payment",
  "vendor-bill",
  "vendor-payment",
  "office-expense",
  "sales-record",
  "purchase-record",
  "bank-account",
  "voucher",
];

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => { setPage(1); }, [debouncedSearch, entity, from, to]);

  const { data: { logs = [], total = 0, totalPages = 1 } = {}, isLoading, isFetching, error } =
    useAuditLogsPaginated({ search: debouncedSearch, entity, from, to, page, limit: 50 });

  useEffect(() => { if (error) notifyError(error); }, [error]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Track financial and operational changes by user, role, route, and timestamp</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search user, path, entity..." />
          <select className="input w-48" value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">All entities</option>
            {ENTITIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input className="input w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          {(from || to || entity) && <button onClick={() => { setFrom(""); setTo(""); setEntity(""); }} className="btn-ghost text-xs"><i className="fa fa-times" /> Clear</button>}
          <span className="text-sm text-slate-500 ml-auto">{total} log{total !== 1 ? "s" : ""}</span>
        </div>

        {isLoading ? <div className="p-8"><PageLoader /></div> : logs.length === 0 ? (
          <Empty icon="fa-shield-alt" message="No audit logs found" />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Time</th><th>User</th><th>Entity</th><th>Action</th><th>Method</th><th>Path</th><th>Status</th></tr></thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td className="text-sm text-slate-500">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}</td>
                      <td><p className="font-medium text-slate-800">{log.actor?.username || "-"}</p><p className="text-xs text-slate-400">{log.actor?.role || "-"}</p></td>
                      <td><span className="badge badge-gray">{log.entity}</span></td>
                      <td className="text-sm text-slate-600">{log.action}</td>
                      <td className="font-mono text-xs text-slate-500">{log.method}</td>
                      <td className="font-mono text-xs text-slate-500 max-w-[340px] truncate">{log.path}</td>
                      <td><span className="badge badge-green">{log.statusCode}</span></td>
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
