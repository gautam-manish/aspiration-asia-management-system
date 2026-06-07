import { useEffect } from "react";
import { Empty, PageLoader } from "../../components/common";
import { useAccountingReconciliation } from "../../hooks/useApiQueries";
import { notifyError } from "../../utils/helpers";
import { downloadCsv } from "../../utils/csvExport";

const money = (value) => "Rs. " + Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SummaryCard({ label, value, tone = "text-slate-800" }) {
  return <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">{label}</p><p className={`text-xl font-bold ${tone}`}>{value}</p></div>;
}

function StatusBadge({ status }) {
  return status === "pass"
    ? <span className="badge badge-green">Pass</span>
    : <span className="badge badge-red">Fail</span>;
}

export default function AccountingReconciliationPage() {
  const { data, isLoading, isFetching, error, refetch } = useAccountingReconciliation();
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const checks = data?.checks || [];
  const totals = data?.totals || {};
  const exportRows = () => downloadCsv("accounting-reconciliation.csv", [
    { header: "Group", value: "group" },
    { header: "Check", value: "name" },
    { header: "Source Total", value: "source" },
    { header: "Journal Total", value: "journal" },
    { header: "Delta", value: "delta" },
    { header: "Status", value: "status" },
  ], checks);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounting Reconciliation</h1>
          <p className="page-subtitle">Source documents compared against posted journal entries</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportRows} className="btn-secondary" disabled={checks.length === 0}><i className="fa fa-download" /> Export CSV</button>
          <button onClick={() => refetch()} className="btn-secondary" disabled={isFetching}><i className={`fa ${isFetching ? "fa-spinner fa-spin" : "fa-sync-alt"}`} /> Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Overall Status" value={data?.status === "pass" ? "Pass" : "Fail"} tone={data?.status === "pass" ? "text-green-700" : "text-red-700"} />
        <SummaryCard label="Checks" value={totals.checks || 0} />
        <SummaryCard label="Failed" value={totals.failed || 0} tone={Number(totals.failed || 0) > 0 ? "text-red-700" : "text-green-700"} />
        <SummaryCard label="Total Delta" value={money(totals.absoluteDelta)} tone={Number(totals.absoluteDelta || 0) > 0 ? "text-red-700" : "text-green-700"} />
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-display font-semibold text-slate-800">Checks</h2>
          <span className="text-xs text-slate-400 ml-auto">{data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : ""}</span>
        </div>

        {isLoading ? <div className="p-8"><PageLoader /></div> : checks.length === 0 ? (
          <Empty icon="fa-clipboard-check" message="No reconciliation checks found" />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Group</th><th>Check</th><th>Source</th><th>Journal</th><th>Delta</th><th>Status</th></tr></thead>
              <tbody>
                {checks.map((check) => (
                  <tr key={`${check.group}-${check.name}`}>
                    <td><span className="badge badge-gray">{check.group}</span></td>
                    <td className="font-medium text-slate-800">{check.name}</td>
                    <td>{money(check.source)}</td>
                    <td>{money(check.journal)}</td>
                    <td className={Number(check.delta || 0) === 0 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>{money(check.delta)}</td>
                    <td><StatusBadge status={check.status} /></td>
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
