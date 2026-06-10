import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { salesRecordAPI, invoiceAPI } from "../../api";
import { notifyError } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, ConfirmModal, Field, Pagination } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useSalesRecordsPaginated, useSalesRecordMutations } from "../../hooks/useApiQueries";
import toast from "react-hot-toast";

const fmt = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function statusBadge(r) {
  const out = Number(r.outstandingBalance || 0);
  if (out <= 0) return <span className="badge badge-green">Paid</span>;
  if (Number(r.receivedAmount) > 0) return <span className="badge badge-yellow">Partial</span>;
  return <span className="badge badge-red">Unpaid</span>;
}

const EMPTY_ENTRY = { referenceCode: "", amount: "", date: "", slip: null };

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,application/pdf,image/jpeg";

const fmtSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// ── Reusable Payment Slip Uploader ──────────────────────────────────
// Used inside each payment-entry row. `slip` is { url, fileName, mimeType, size }
// or null. `onChange(newSlip)` is called when the user uploads / removes.
export function SlipField({ slip, onChange }) {
  const [busy, setBusy] = useState(false);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    // Client-side validation (mirrors backend rules)
    const ok = /\.(pdf|jpe?g)$/i.test(file.name) ||
               /^application\/pdf$|^image\/jpeg$/i.test(file.type);
    if (!ok) { toast.error("Only PDF, JPG, or JPEG files are allowed"); return; }

    setBusy(true);
    try {
      // Hard 1 MB cap — refuse outright instead of silently compressing.
      if (file.size > 1 * 1024 * 1024) {
        toast.error("File is too large — please upload a slip under 1 MB");
        return;
      }
      const { data } = await salesRecordAPI.uploadSlip(file);
      onChange(data?.data || null);
      toast.success("Slip uploaded ✓");
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    if (!slip?.url) { onChange(null); return; }
    setBusy(true);
    try {
      await salesRecordAPI.removeSlip(slip.url);
    } catch { /* file may already be gone — ignore */ }
    finally { setBusy(false); }
    onChange(null);
  };

  if (slip?.url) {
    return (
      <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5">
        <i className={`fa ${/^application\/pdf/.test(slip.mimeType) ? "fa-file-pdf text-red-500" : "fa-file-image text-blue-600"}`} />
        <a href={slip.url} target="_blank" rel="noreferrer" className="font-medium text-brand-700 truncate hover:underline" title={slip.fileName}>
          {slip.fileName || "Slip"}
        </a>
        <span className="text-slate-400 ml-auto whitespace-nowrap">{fmtSize(slip.size)}</span>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="btn-ghost text-red-400 hover:text-red-600 p-1"
          title="Remove slip"
        >
          <i className="fa fa-times" />
        </button>
      </div>
    );
  }

  return (
    <label className={`flex items-center justify-center gap-2 text-xs border-2 border-dashed border-slate-300 rounded-lg px-2 py-1.5 cursor-pointer hover:border-brand-400 hover:bg-blue-50 transition-colors ${busy ? "opacity-50 pointer-events-none" : ""}`}>
      <i className="fa fa-paperclip" />
      <span>{busy ? "Uploading…" : "Attach slip (PDF / JPG, max 1 MB)"}</span>
      <input type="file" accept={ACCEPTED_TYPES} onChange={onPick} className="hidden" disabled={busy} />
    </label>
  );
}

function SalesModal({ onClose, onSaved }) {
  const qc = useQueryClient();
  const [form, setForm]     = useState({ invoiceNumber: "", clientName: "", address: "", phone: "", email: "", totalAmount: "" });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  // If the typed invoice number matches an EXISTING sales record, we capture
  // its id here so submit performs an update instead of a create.
  const [existingId, setExistingId] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const lookupInvoice = async () => {
    const num = (form.invoiceNumber || "").trim();
    if (!num) { toast.error("Enter an invoice number first"); return; }
    setLookingUp(true);
    try {
      // 1. Check if a sales record already exists for this invoice number.
      try {
        const { data } = await salesRecordAPI.getByInvoiceNumber(num);
        const r = data.data;
        setExistingId(r._id);
        setForm({
          invoiceNumber: r.invoiceNumber || num,
          clientName:    r.clientName || "",
          address:       r.address    || "",
          phone:         r.phone      || "",
          email:         r.email      || "",
          totalAmount:   r.totalAmount != null ? String(r.totalAmount) : "",
        });
        setEntries((r.paymentEntries || []).map((e) => ({
          referenceCode: e.referenceCode || "",
          amount:        e.amount != null ? String(e.amount) : "",
          date:          e.date || "",
          slip:          (e.slip && e.slip.url) ? { ...e.slip } : null,
        })));
        toast.success(`Existing sales record loaded — switched to update mode`);
        return;
      } catch (err) {
        // 404 = no sales record yet, fall through to invoice lookup
        if (err?.response?.status !== 404) throw err;
      }

      // 2. No existing sales record: load from the underlying invoice instead.
      const { data } = await invoiceAPI.getByNumber(num);
      const inv = data.data;
      setExistingId(null);
      setForm((f) => ({
        ...f,
        invoiceNumber: inv.invoiceNumber || num,
        clientName:    inv.billTo?.name    || f.clientName,
        address:       inv.billTo?.address || f.address,
        phone:         inv.billTo?.mobile  || f.phone,
        email:         inv.billTo?.email   || f.email,
        totalAmount:   inv.total != null ? String(inv.total) : f.totalAmount,
      }));
      toast.success(`Invoice ${inv.invoiceNumber} loaded`);
    } catch (err) {
      notifyError(err);
    } finally {
      setLookingUp(false);
    }
  };

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
      if (existingId) {
        const { data } = await salesRecordAPI.update(existingId, { ...form, paymentEntries: entries });
        if (data?.data) qc.setQueryData(["sales-record", existingId], data.data);
        toast.success("Sales record updated ✓");
      } else {
        await salesRecordAPI.create({ ...form, paymentEntries: entries });
        toast.success("Sales record created ✓");
      }
      qc.invalidateQueries({ queryKey: ["sales-records"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
      qc.invalidateQueries({ queryKey: ["customer-payments"] });
      qc.invalidateQueries({ queryKey: ["reports", "ar-aging"] });
      qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">{existingId ? "Update Sales Record" : "New Sales Record"}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {/* Invoice Reference */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Invoice Reference</p>
              <Field label="Invoice Number *">
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={form.invoiceNumber}
                    onChange={(e) => { set("invoiceNumber", e.target.value); setExistingId(null); }}
                    placeholder="e.g. ASA47821396"
                    required
                  />
                  <button
                    type="button"
                    onClick={lookupInvoice}
                    disabled={lookingUp || !form.invoiceNumber.trim()}
                    className="btn-secondary text-xs whitespace-nowrap"
                  >
                    {lookingUp ? "Fetching…" : <><i className="fa fa-search" /> Fetch</>}
                  </button>
                </div>
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
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              <i className="fa fa-save" /> {loading ? "Saving…" : (existingId ? "Update Record" : "Create Record")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SalesRecordsPage() {
  const navigate              = useNavigate();
  const qc                    = useQueryClient();
  const [search,   setSearch] = useState("");
  const [page,     setPage]   = useState(1);
  const [modal,    setModal]  = useState(false);
  const [confirm,  setConfirm] = useState(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const {
    data: { records = [], total = 0, totalPages = 1 } = {},
    isLoading: loading,
    isFetching,
    error,
  } = useSalesRecordsPaginated({ search: debouncedSearch, page, limit: 50 });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const { remove } = useSalesRecordMutations();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sales-records"] });
    qc.invalidateQueries({ queryKey: ["sales-record"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["invoice"] });
    qc.invalidateQueries({ queryKey: ["customer-payments"] });
    qc.invalidateQueries({ queryKey: ["customer-payment"] });
    qc.invalidateQueries({ queryKey: ["reports", "ar-aging"] });
    qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
  };

  const handleDelete = () => {
    remove.mutate(confirm._id, {
      onSuccess: () => {
        toast.success("Record deleted");
        setConfirm(null);
      },
      onError: (err) => notifyError(err),
    });
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

      {/* Summary (current page) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Total Records</p><p className="text-2xl font-bold text-slate-800">{total}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Received (this page)</p><p className="text-xl font-bold text-green-600">{fmt(records.reduce((s, r) => s + (Number(r.receivedAmount) || 0), 0))}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Outstanding (this page)</p><p className={`text-xl font-bold ${totalOutstanding > 0 ? "text-red-600" : "text-green-600"}`}>{fmt(totalOutstanding)}</p></div>
      </div>

      <div className="card">
        <div className="card-header">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by invoice no. or client…" />
          <span className="text-sm text-slate-500">
            {total === 0
              ? "No records"
              : `${(page - 1) * 50 + 1}–${Math.min(page * 50, total)} of ${total} record${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : records.length === 0 ? (
          <Empty icon="fa-chart-line" message="No sales records found" action={<button onClick={() => setModal(true)} className="btn-primary">Create first record</button>} />
        ) : (
          <>
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
            <Pagination page={page} totalPages={totalPages} total={total} limit={50} onChange={setPage} isFetching={isFetching} />
          </>
        )}
      </div>

      {modal && <SalesModal onClose={() => setModal(false)} onSaved={() => { setModal(false); refresh(); }} />}

      <ConfirmModal
        open={!!confirm}
        title="Delete Sales Record"
        message={`Delete record for "${confirm?.invoiceNumber}" (${confirm?.clientName})? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
        loading={remove.isPending}
      />
    </div>
  );
}
