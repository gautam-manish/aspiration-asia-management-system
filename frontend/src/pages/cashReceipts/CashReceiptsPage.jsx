import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { cashReceiptAPI } from "../../api";
import { getError, formatDate, numberToWords } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, ConfirmModal, Field } from "../../components/common";
import toast from "react-hot-toast";

const PAYMENT_TYPES = ["Guest Ledger", "City Ledger", "Cash", "Cheque", "Bank Transfer", "Other"];

const EMPTY_FORM = {
  date: new Date().toISOString().split("T")[0],
  name: "", amount: "", amountInWords: "",
  cashChequeNo: "", bank: "", paymentType: "Guest Ledger",
};

function CashReceiptModal({ onClose, onSaved }) {
  const [form, setForm]     = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => {
    setForm((f) => {
      const updated = { ...f, [k]: v };
      if (k === "amount") updated.amountInWords = numberToWords(v);
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await cashReceiptAPI.create(form);
      toast.success("Cash receipt created");
      onSaved();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">New Cash Receipt</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required>
                <input className="input" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
              </Field>
              <Field label="Payment Type">
                <select className="input" value={form.paymentType} onChange={(e) => set("paymentType", e.target.value)}>
                  {PAYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Received From (Name)" required>
              <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="Client / Company name" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (Rs.)" required>
                <input className="input" type="number" min="0" value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
              </Field>
              <Field label="Cheque / Ref No.">
                <input className="input" value={form.cashChequeNo} onChange={(e) => set("cashChequeNo", e.target.value)} />
              </Field>
            </div>
            <Field label="Amount in Words">
              <input className="input bg-slate-50" value={form.amountInWords} onChange={(e) => set("amountInWords", e.target.value)} placeholder="Auto-filled from amount" />
            </Field>
            <Field label="Bank">
              <input className="input" value={form.bank} onChange={(e) => set("bank", e.target.value)} placeholder="Bank name (if applicable)" />
            </Field>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating…" : "Create Receipt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CashReceiptsPage() {
  const [receipts, setReceipts] = useState([]);
  const [search, setSearch]     = useState("");
  const [date, setDate]         = useState("");
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [confirm, setConfirm]   = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await cashReceiptAPI.getAll({ search, date });
      setReceipts(data.data || []);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  }, [search, date]);

  useEffect(() => { fetchReceipts(); }, [fetchReceipts]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await cashReceiptAPI.remove(confirm._id);
      toast.success("Receipt deleted");
      setConfirm(null);
      fetchReceipts();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cash Receipts</h1>
          <p className="page-subtitle">Track all payments received</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <i className="fa fa-plus" /> New Receipt
        </button>
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div className="flex gap-3 flex-wrap">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by name…" />
            <div className="relative">
              <i className="fa fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input pl-9 w-44"
              />
            </div>
            {date && <button onClick={() => setDate("")} className="btn-ghost text-xs"><i className="fa fa-times" /> Clear</button>}
          </div>
          <span className="text-sm text-slate-500">{receipts.length} receipts</span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : receipts.length === 0 ? (
          <Empty icon="fa-receipt" message="No cash receipts found" action={<button onClick={() => setModal(true)} className="btn-primary">Create first receipt</button>} />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Reg. No.</th>
                  <th>Date</th>
                  <th>Received From</th>
                  <th>Amount</th>
                  <th>Payment Type</th>
                  <th>Ref / Cheque</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r._id}>
                    <td><span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{r.registrationNumber || "—"}</span></td>
                    <td className="text-slate-500 text-sm">{r.date || formatDate(r.createdAt)}</td>
                    <td className="font-medium text-slate-800">{r.name}</td>
                    <td className="font-semibold text-slate-800">Rs. {Number(r.amount).toLocaleString("en-IN")}</td>
                    <td><span className="badge badge-blue">{r.paymentType}</span></td>
                    <td className="text-slate-500 text-sm">{r.cashChequeNo || "—"}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link to={`/cash-receipts/${r._id}`} className="btn-ghost text-xs py-1 px-2"><i className="fa fa-eye" /></Link>
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

      {modal && (
        <CashReceiptModal
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); fetchReceipts(); }}
        />
      )}

      <ConfirmModal
        open={!!confirm}
        title="Delete Receipt"
        message={`Delete receipt for "${confirm?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
        loading={deleting}
      />
    </div>
  );
}
