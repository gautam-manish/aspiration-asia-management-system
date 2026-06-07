import { useAuditLogsPaginated } from "../../hooks/useApiQueries";

const formatWhen = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};

function actionLabel(log) {
  const method = String(log.method || "").toUpperCase();
  if (log.path?.includes("/void")) return "Void";
  if (method === "POST") return "Create";
  if (method === "PUT" || method === "PATCH") return "Update";
  if (method === "DELETE") return "Delete";
  return log.action || "Write";
}

export default function AuditTrailPanel({ entity, entityId, title = "Audit History" }) {
  const { data, isLoading, error } = useAuditLogsPaginated({
    entity,
    entityId,
    page: 1,
    limit: 10,
  });
  const logs = data?.logs || [];

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="font-display font-semibold text-slate-800">{title}</h2>
        <span className="text-xs text-slate-400">{data?.total || 0} event{data?.total === 1 ? "" : "s"}</span>
      </div>
      {isLoading ? (
        <div className="card-body text-sm text-slate-400">Loading audit history...</div>
      ) : error ? (
        <div className="card-body text-sm text-slate-400">Audit history unavailable.</div>
      ) : logs.length === 0 ? (
        <div className="card-body text-sm text-slate-400">No audit events recorded for this record yet.</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>When</th><th>Action</th><th>User</th><th>Route</th><th>Status</th></tr></thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td className="text-xs text-slate-500 whitespace-nowrap">{formatWhen(log.createdAt)}</td>
                  <td><span className="badge badge-gray">{actionLabel(log)}</span></td>
                  <td>
                    <p className="text-sm font-medium text-slate-700">{log.actor?.username || "-"}</p>
                    {log.actor?.role && <p className="text-xs text-slate-400 capitalize">{log.actor.role}</p>}
                  </td>
                  <td className="text-xs text-slate-500 max-w-[240px] truncate">{log.method} {log.path}</td>
                  <td className="text-xs text-slate-500">{log.statusCode || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
