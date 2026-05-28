import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { salesRecordAPI } from "../../api";
import { getError } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, ConfirmModal, Field } from "../../components/common";
import toast from "react-hot-toast";

const fmt = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function statusBadge(r) {
  const out = Number(r.outstandingBalance || 0);
  if (out <= 0) return <span className="badge badge-green">Paid</span>;
  if (Number(r.receivedAmount) > 0) return <span className="badge badge-yellow">Partial</span>;
  return <span className="badge badge-red">Unpaid</span>;
}

const EMPTY_ENTRY = { referenceCode: "", amount: "", date: "" };

function SalesModal({ onClose, onSaved }) {
  const [form, setForm]     = useState({ invoiceNumber: "", clientName: "", address: "", phone: "", email: "", totalAmount: "" });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addEntry    = () => setEntries((e) => [...e, { ...EMPTY_ENTRY }]);
  const removeEntry = (i) => setEntries((e) => e.filter((_, ii) => ii !== i));
  const setEntry    = (i, k, v) => setEntries((e) => { const n = [...e]; n[i] = { ...n[i], [k]: v }; return n; });

  const received = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const outstanding = (Number(form.totalAmount) || 0) - received;

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!form.invoiceNumber.trim()) { toast.error("Invoice number required"); return; }
    if (!form.clientName.trim())    { toast.error("Client name required"); return; }
    setLoading(true);
    try {
      await salesRecordAPI.create({ ...form, paymentEntries: entries });
      toast.success("Sales record created ✓");
      onSaved();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">New Sales Record</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {/* Invoice Reference */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Invoice Reference</p>
              <Field label="Invoice Number *">
                <input className="input" value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} required />
              </Field>
            </div>

            {/* Client */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Client / Agent Information</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Client Name *" className="col-span-2">
                  <input className="input" value={form.clientName} onChange={(e) => set("clientName", e.target.value)} required />
                </Field>
                <Field label="Address" className="col-span-2">
                  <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} />
                </Field>
                <Field label="Phone">
                  <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field label="Email">
                  <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
              </div>
            </div>

            {/* Amount */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Amount Summary</p>
              <Field label="Total Invoice Amount (Rs.)">
                <input className="input" type="number" min="0" value={form.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} />
              </Field>
              <div className="grid grid-cols-3 gap-px bg-slate-200 rounded-xl overflow-hidden mt-3">
                {[["Total", form.totalAmount, "text-slate-800"], ["Received", received, "text-green-600"], ["Outstanding", outstanding, outstanding > 0 ? "text-red-600" : "text-green-600"]].map(([lbl, val, cls]) => (
                  <div key={lbl} className="bg-white text-center py-3 px-2">
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{lbl}</p>
                    <p className={`text-sm font-bold mt-1 ${cls}`}>Rs. {Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Entries */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Payment Entries</p>
              <div className="space-y-2">
                {entries.map((e, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <Field label="Ref. Code"><input className="input text-xs" value={e.referenceCode} onChange={(ev) => setEntry(i, "referenceCode", ev.target.value)} /></Field>
                    <Field label="Amount"><input className="input text-xs" type="number" min="0" value={e.amount} onChange={(ev) => setEntry(i, "amount", ev.target.value)} /></Field>
                    <Field label="Date"><input className="input text-xs" type="date" value={e.date} onChange={(ev) => setEntry(i, "date", ev.target.value)} /></Field>
                    <button type="button" onClick={() => removeEntry(i)} className="btn-ghost text-red-400 hover:text-red-600 p-2 mb-0.5"><i className="fa fa-times text-xs" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addEntry} className="w-full mt-2 border-2 border-dashed border-blue-200 rounded-xl py-2.5 text-sm text-brand-600 font-semibold hover:bg-blue-50 transition-colors">
                <i className="fa fa-plus-circle mr-1" /> Add Payment Entry
              </button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              <i className="fa fa-save" /> {loading ? "Saving…" : "Create Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SalesRecordsPage() {
  const navigate             = useNavigate();
  const [records,  setRecords]  = useState([]);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [confirm,  setConfirm]  = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await salesRecordAPI.getAll({ search });
      setRecords(data.data || []);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await salesRecordAPI.remove(confirm._id);
      toast.success("Record deleted");
      setConfirm(null);
      fetchRecords();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setDeleting(false);
    }
  };

  const totalOutstanding = records.reduce((s, r) => s + (Number(r.outstandingBalance) || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Records</h1>
          <p className="page-subtitle">Invoice payment tracking</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <i className="fa fa-plus" /> New Record
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Total Records</p><p className="text-2xl font-bold text-slate-800">{records.length}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Total Received</p><p className="text-xl font-bold text-green-600">{fmt(records.reduce((s, r) => s + (Number(r.receivedAmount) || 0), 0))}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Total Outstanding</p><p className={`text-xl font-bold ${totalOutstanding > 0 ? "text-red-600" : "text-green-600"}`}>{fmt(totalOutstanding)}</p></div>
      </div>

      <div className="card">
        <div className="card-header">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by invoice no. or client…" />
          <span className="text-sm text-slate-500">{records.length} records</span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : records.length === 0 ? (
          <Empty icon="fa-chart-line" message="No sales records found" action={<button onClick={() => setModal(true)} className="btn-primary">Create first record</button>} />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Client</th>
                  <th>Total</th>
                  <th>Received</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id}>
                    <td><span className="font-mono text-xs bg-blue-50 text-brand-600 border border-blue-100 px-2 py-0.5 rounded">{r.invoiceNumber}</span></td>
                    <td>
                      <p className="font-medium text-slate-800">{r.clientName}</p>
                      {r.email && <p className="text-xs text-slate-400">{r.email}</p>}
                    </td>
                    <td className="font-medium">{fmt(r.totalAmount)}</td>
                    <td className="text-green-600 font-medium">{fmt(r.receivedAmount)}</td>
                    <td className={`font-bold ${Number(r.outstandingBalance) > 0 ? "text-red-600" : "text-green-600"}`}>{fmt(r.outstandingBalance)}</td>
                    <td>{statusBadge(r)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => navigate(`/sales-records/${r._id}`)} className="btn-ghost text-xs py-1 px-2"><i className="fa fa-edit" /> Open</button>
                        <button onClick={() => setConfirm(r)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2"><i className="fa fa-trash-alt" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <SalesModal onClose={() => setModal(false)} onSaved={() => { setModal(false); fetchRecords(); }} />}

      <ConfirmModal
        open={!!confirm}
        title="Delete Sales Record"
        message={`Delete record for "${confirm?.invoiceNumber}" (${confirm?.clientName})? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
        loading={deleting}
      />
    </div>
  );
}
