import { useState, useEffect, useCallback } from "react";
import { clientAPI } from "../../api";
import { getError, formatCurrency } from "../../utils/helpers";
import { PageLoader, Empty, ConfirmModal, Field, SearchBar } from "../../components/common";
import toast from "react-hot-toast";

const EMPTY_FORM = {
  clientName: "", invoiceNumber: "", address: "",
  phone: "", email: "", totalAmount: "",
  receivedAmount: "", outstandingBalance: "",
};

function ClientModal({ onClose, onSaved }) {
  const [form, setForm]     = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => {
    setForm((f) => {
      const updated = { ...f, [k]: v };
      const total    = Number(updated.totalAmount)    || 0;
      const received = Number(updated.receivedAmount) || 0;
      if (k === "totalAmount" || k === "receivedAmount") {
        updated.outstandingBalance = total - received;
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await clientAPI.create(form);
      toast.success("Client entry added");
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
          <h2 className="font-display font-semibold text-slate-800">Add Client Entry</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <Field label="Client Name" required>
              <input className="input" value={form.clientName} onChange={(e) => set("clientName", e.target.value)} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Invoice Number">
                <input className="input" value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
            </div>
            <Field label="Email">
              <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Address">
              <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total Amount (Rs.)">
                <input className="input" type="number" min="0" value={form.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} />
              </Field>
              <Field label="Received Amount (Rs.)">
                <input className="input" type="number" min="0" value={form.receivedAmount} onChange={(e) => set("receivedAmount", e.target.value)} />
              </Field>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-slate-600 font-medium">Outstanding Balance</span>
              <span className={`font-bold text-lg ${Number(form.outstandingBalance) > 0 ? "text-red-600" : "text-green-600"}`}>
                Rs. {Number(form.outstandingBalance || 0).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Adding…" : "Add Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LedgerPage() {
  const [clients, setClients]   = useState([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [confirm, setConfirm]   = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await clientAPI.getAll();
      setClients(data.data || []);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await clientAPI.remove(confirm._id);
      toast.success("Entry deleted");
      setConfirm(null);
      fetchClients();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setDeleting(false);
    }
  };

  const filtered = clients.filter((c) =>
    !search || c.clientName?.toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = filtered.reduce((acc, c) => acc + (Number(c.outstandingBalance) || 0), 0);
  const totalReceived    = filtered.reduce((acc, c) => acc + (Number(c.receivedAmount) || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Client Ledger</h1>
          <p className="page-subtitle">Track outstanding balances across all clients</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <i className="fa fa-plus" /> Add Entry
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card card-body !py-4">
          <p className="text-xs text-slate-500 mb-1">Total Clients</p>
          <p className="text-2xl font-bold text-slate-800">{filtered.length}</p>
        </div>
        <div className="card card-body !py-4">
          <p className="text-xs text-slate-500 mb-1">Total Received</p>
          <p className="text-2xl font-bold text-green-600">Rs. {totalReceived.toLocaleString("en-IN")}</p>
        </div>
        <div className="card card-body !py-4">
          <p className="text-xs text-slate-500 mb-1">Total Outstanding</p>
          <p className={`text-2xl font-bold ${totalOutstanding > 0 ? "text-red-600" : "text-green-600"}`}>
            Rs. {Math.abs(totalOutstanding).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by client name…" />
          <span className="text-sm text-slate-500">{filtered.length} entries</span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : filtered.length === 0 ? (
          <Empty icon="fa-book" message="No ledger entries found" action={<button onClick={() => setModal(true)} className="btn-primary">Add first entry</button>} />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Invoice No.</th>
                  <th>Contact</th>
                  <th>Total</th>
                  <th>Received</th>
                  <th>Outstanding</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <p className="font-medium text-slate-800">{c.clientName}</p>
                      {c.address && <p className="text-xs text-slate-400">{c.address}</p>}
                    </td>
                    <td className="font-mono text-xs text-slate-500">{c.invoiceNumber || "—"}</td>
                    <td className="text-sm text-slate-500">
                      {c.phone && <p>{c.phone}</p>}
                      {c.email && <p className="text-xs">{c.email}</p>}
                    </td>
                    <td className="font-medium">Rs. {Number(c.totalAmount || 0).toLocaleString("en-IN")}</td>
                    <td className="text-green-600 font-medium">Rs. {Number(c.receivedAmount || 0).toLocaleString("en-IN")}</td>
                    <td>
                      <span className={`font-bold ${Number(c.outstandingBalance) > 0 ? "text-red-600" : "text-green-600"}`}>
                        Rs. {Math.abs(Number(c.outstandingBalance || 0)).toLocaleString("en-IN")}
                        {Number(c.outstandingBalance) < 0 && <span className="text-xs font-normal ml-1">(overpaid)</span>}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <button onClick={() => setConfirm(c)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2">
                          <i className="fa fa-trash-alt" />
                        </button>
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
        <ClientModal
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); fetchClients(); }}
        />
      )}

      <ConfirmModal
        open={!!confirm}
        title="Delete Entry"
        message={`Remove ledger entry for "${confirm?.clientName}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
        loading={deleting}
      />
    </div>
  );
}
