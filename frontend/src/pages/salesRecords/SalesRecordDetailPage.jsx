import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { salesRecordAPI } from "../../api";
import { formatDate, notifyError } from "../../utils/helpers";
import { PageLoader, Field } from "../../components/common";
import { useSalesRecord } from "../../hooks/useApiQueries";
import { SlipField } from "./SalesRecordsPage";
import toast from "react-hot-toast";

const fmt = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const EMPTY_ENTRY = { referenceCode: "", amount: "", date: "", slip: null };

function statusBadge(r) {
  const out = Number(r.outstandingBalance || 0);
  if (out <= 0) return <span className="badge badge-green"><i className="fa fa-check mr-1" />Paid</span>;
  if (Number(r.receivedAmount) > 0) return <span className="badge badge-yellow"><i className="fa fa-clock mr-1" />Partial</span>;
  return <span className="badge badge-red"><i className="fa fa-times mr-1" />Unpaid</span>;
}

export default function SalesRecordDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [record,  setRecord]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState({});
  const [entries, setEntries] = useState([]);
  const [saving,  setSaving]  = useState(false);

  const qc = useQueryClient();
  const { data: recordData, isLoading: recordLoading, error: recordError } = useSalesRecord(id);

  useEffect(() => {
    if (recordData) {
      setRecord(recordData);
      setForm({ ...recordData });
      setEntries((recordData.paymentEntries || []).map((e) => ({
        referenceCode: e.referenceCode || "",
        amount:        e.amount != null ? String(e.amount) : "",
        date:          e.date || "",
        slip:          (e.slip && e.slip.url) ? { ...e.slip } : null,
      })));
    }
  }, [recordData]);
  useEffect(() => { setLoading(recordLoading); }, [recordLoading]);
  useEffect(() => { if (recordError) notifyError(recordError); }, [recordError]);

  const loadRecord = () => qc.invalidateQueries({ queryKey: ["sales-record", id] });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addEntry    = () => setEntries((e) => [...e, { ...EMPTY_ENTRY }]);
  const removeEntry = (i) => setEntries((e) => e.filter((_, ii) => ii !== i));
  const setEntry    = (i, k, v) => setEntries((e) => { const n = [...e]; n[i] = { ...n[i], [k]: v }; return n; });

  const received    = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const outstanding = (Number(form.totalAmount) || 0) - received;

  const handleUpdate = async (ev) => {
    ev.preventDefault();
    if (!form.clientName?.trim()) { toast.error("Client name required"); return; }
    setSaving(true);
    try {
      await salesRecordAPI.update(id, { ...form, paymentEntries: entries });
      toast.success("Record updated ✓");
      setEditing(false);
      loadRecord();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!record) return <div className="text-center py-20 text-slate-400">Record not found</div>;

  const Row = ({ label, value }) => (
    <div className="flex items-start py-2.5 border-b border-slate-100 last:border-0">
      <span className="w-40 text-sm text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value || "—"}</span>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/sales-records")} className="btn-ghost p-2"><i className="fa fa-arrow-left" /></button>
          <div>
            <h1 className="page-title font-mono">{record.invoiceNumber}</h1>
            <p className="page-subtitle">{record.clientName} · Created {formatDate(record.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge(record)}
          <button onClick={() => {
            setForm({ ...record });
            setEntries((record.paymentEntries || []).map((e) => ({
              referenceCode: e.referenceCode || "",
              amount:        e.amount != null ? String(e.amount) : "",
              date:          e.date || "",
              slip:          (e.slip && e.slip.url) ? { ...e.slip } : null,
            })));
            setEditing(true);
          }} className="btn-secondary">
            <i className="fa fa-edit" /> Edit
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-px bg-slate-200 rounded-xl overflow-hidden mb-6">
        {[["Total Amount", record.totalAmount, "text-slate-800"], ["Received", record.receivedAmount, "text-green-600"], ["Outstanding", record.outstandingBalance, Number(record.outstandingBalance) > 0 ? "text-red-600" : "text-green-600"]].map(([lbl, val, cls]) => (
          <div key={lbl} className="bg-white text-center py-4">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{lbl}</p>
            <p className={`text-lg font-bold mt-1 ${cls}`}>{fmt(val)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-slate-700">Invoice Reference</h3></div>
          <div className="card-body">
            <Row label="Invoice Number" value={<span className="font-mono text-brand-600">{record.invoiceNumber}</span>} />
            <Row label="Created"        value={formatDate(record.createdAt)} />
            <Row label="Last Updated"   value={formatDate(record.updatedAt)} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-slate-700">Client / Agent</h3></div>
          <div className="card-body">
            <Row label="Client Name" value={<strong>{record.clientName}</strong>} />
            <Row label="Address"     value={record.address} />
            <Row label="Phone"       value={record.phone} />
            <Row label="Email"       value={record.email} />
          </div>
        </div>
      </div>

      {/* Payment Entries */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-700">Payment Entries</h3>
          <span className="badge badge-blue">{(record.paymentEntries || []).length} entries</span>
        </div>
        {(record.paymentEntries || []).length === 0 ? (
          <div className="card-body text-center text-slate-400 text-sm py-8">No payment entries recorded</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>#</th><th>Reference Code</th><th>Amount</th><th>Date</th><th>Slip</th></tr></thead>
              <tbody>
                {(record.paymentEntries || []).map((e, i) => (
                  <tr key={e._id || i}>
                    <td className="text-slate-400 text-xs">{i + 1}</td>
                    <td className="font-mono text-sm">{e.referenceCode || "—"}</td>
                    <td className="font-semibold text-green-600">{fmt(e.amount)}</td>
                    <td className="text-slate-500 text-sm">{e.date || "—"}</td>
                    <td className="text-sm">
                      {e.slip?.url ? (
                        <a href={e.slip.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline inline-flex items-center gap-1">
                          <i className={`fa ${/^application\/pdf/.test(e.slip.mimeType) ? "fa-file-pdf" : "fa-file-image"}`} />
                          {e.slip.fileName || "View"}
                        </a>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay">
          <div className="modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-display font-semibold text-slate-800">Edit Sales Record</h2>
              <button onClick={() => setEditing(false)} className="btn-ghost p-1"><i className="fa fa-times" /></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="modal-body space-y-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Client Name *" className="col-span-2">
                    <input className="input" value={form.clientName || ""} onChange={(e) => set("clientName", e.target.value)} required />
                  </Field>
                  <Field label="Address" className="col-span-2">
                    <input className="input" value={form.address || ""} onChange={(e) => set("address", e.target.value)} />
                  </Field>
                  <Field label="Phone">
                    <input className="input" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
                  </Field>
                  <Field label="Email">
                    <input className="input" type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
                  </Field>
                  <Field label="Total Amount (Rs.)" className="col-span-2">
                    <input className="input" type="number" min="0" value={form.totalAmount || ""} onChange={(e) => set("totalAmount", e.target.value)} />
                  </Field>
                </div>

                {/* Amount bar */}
                <div className="grid grid-cols-3 gap-px bg-slate-200 rounded-xl overflow-hidden">
                  {[["Total", form.totalAmount, "text-slate-800"], ["Received", received, "text-green-600"], ["Outstanding", outstanding, outstanding > 0 ? "text-red-600" : "text-green-600"]].map(([lbl, val, cls]) => (
                    <div key={lbl} className="bg-white text-center py-3">
                      <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{lbl}</p>
                      <p className={`text-sm font-bold mt-1 ${cls}`}>Rs. {Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Payment Entries</p>
                  <div className="space-y-2">
                    {entries.map((e, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                          <Field label="Ref. Code"><input className="input text-xs" value={e.referenceCode} onChange={(ev) => setEntry(i, "referenceCode", ev.target.value)} /></Field>
                          <Field label="Amount"><input className="input text-xs" type="number" min="0" value={e.amount} onChange={(ev) => setEntry(i, "amount", ev.target.value)} /></Field>
                          <Field label="Date"><input className="input text-xs" type="date" value={e.date} onChange={(ev) => setEntry(i, "date", ev.target.value)} /></Field>
                          <button type="button" onClick={() => removeEntry(i)} className="btn-ghost text-red-400 hover:text-red-600 p-2 mb-0.5"><i className="fa fa-times text-xs" /></button>
                        </div>
                        <SlipField slip={e.slip} onChange={(slip) => setEntry(i, "slip", slip)} />
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addEntry} className="w-full mt-2 border-2 border-dashed border-blue-200 rounded-xl py-2.5 text-sm text-brand-600 font-semibold hover:bg-blue-50 transition-colors">
                    <i className="fa fa-plus-circle mr-1" /> Add Payment Entry
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  <i className="fa fa-save" /> {saving ? "Updating…" : "Update Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
