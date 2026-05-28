import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { invoiceAPI } from "../../api";
import { getError, formatDate, todayString } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, ConfirmModal, Field } from "../../components/common";
import toast from "react-hot-toast";

const EMPTY_LINE = { description: "", details: "", qty: 1, rate: 0, amount: 0 };

function InvoiceModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    invoiceDate: todayString(),
    from: { name: "Aspiration AISA", email: "", address1: "", address2: "", zip: "", phone: "" },
    billTo: { name: "", email: "", address: "", mobile: "" },
    lineItems: [{ ...EMPTY_LINE }],
    subtotal: 0, discountType: "none", discountValue: 0, discount: 0, advance: 0, total: 0,
    currency: "Rs.", notes: "", terms: "",
  });
  const [loading, setLoading] = useState(false);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setFrom  = (k, v) => setForm((f) => ({ ...f, from:   { ...f.from,   [k]: v } }));
  const setBill  = (k, v) => setForm((f) => ({ ...f, billTo: { ...f.billTo, [k]: v } }));

  const setLine = (i, k, v) => {
    setForm((f) => {
      const lines = [...f.lineItems];
      lines[i] = { ...lines[i], [k]: v };
      if (k === "qty" || k === "rate") {
        lines[i].amount = (Number(lines[i].qty) || 0) * (Number(lines[i].rate) || 0);
      }
      const subtotal = lines.reduce((s, l) => s + (l.amount || 0), 0);
      const discount = f.discountType === "percent"
        ? (subtotal * (Number(f.discountValue) || 0)) / 100
        : Number(f.discountValue) || 0;
      const total = subtotal - discount - (Number(f.advance) || 0);
      return { ...f, lineItems: lines, subtotal, discount, total };
    });
  };

  const recalc = (f) => {
    const subtotal = f.lineItems.reduce((s, l) => s + (l.amount || 0), 0);
    const discount = f.discountType === "percent"
      ? (subtotal * (Number(f.discountValue) || 0)) / 100
      : Number(f.discountValue) || 0;
    const total = subtotal - discount - (Number(f.advance) || 0);
    return { ...f, subtotal, discount, total };
  };

  const addLine    = () => setForm((f) => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_LINE }] }));
  const removeLine = (i) => setForm((f) => recalc({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await invoiceAPI.create(form);
      toast.success("Invoice created");
      onSaved();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">New Invoice</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-5">
            {/* Header row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Invoice Number" required>
                <input className="input" value={form.invoiceNumber} onChange={(e) => setField("invoiceNumber", e.target.value)} required />
              </Field>
              <Field label="Invoice Date" required>
                <input className="input" type="date" value={form.invoiceDate} onChange={(e) => setField("invoiceDate", e.target.value)} required />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* From */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">From</p>
                {[["name","Company Name"],["email","Email"],["address1","Address Line 1"],["address2","Address Line 2"],["phone","Phone"]].map(([k,l]) => (
                  <Field key={k} label={l}>
                    <input className="input" value={form.from[k]} onChange={(e) => setFrom(k, e.target.value)} />
                  </Field>
                ))}
              </div>
              {/* Bill To */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bill To</p>
                {[["name","Client Name"],["email","Email"],["address","Address"],["mobile","Mobile"]].map(([k,l]) => (
                  <Field key={k} label={l} required={k==="name"}>
                    <input className="input" value={form.billTo[k]} onChange={(e) => setBill(k, e.target.value)} required={k==="name"} />
                  </Field>
                ))}
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Line Items</p>
                <button type="button" onClick={addLine} className="btn-secondary text-xs py-1"><i className="fa fa-plus" /> Add Row</button>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Description</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Details</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 w-16">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-24">Rate</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-24">Amount</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.lineItems.map((l, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-2 py-1">
                          <input className="input text-xs" value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} required placeholder="Service description" />
                        </td>
                        <td className="px-2 py-1">
                          <input className="input text-xs" value={l.details} onChange={(e) => setLine(i, "details", e.target.value)} placeholder="Details" />
                        </td>
                        <td className="px-2 py-1">
                          <input className="input text-xs text-center" type="number" min="1" value={l.qty} onChange={(e) => setLine(i, "qty", e.target.value)} />
                        </td>
                        <td className="px-2 py-1">
                          <input className="input text-xs text-right" type="number" min="0" value={l.rate} onChange={(e) => setLine(i, "rate", e.target.value)} />
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-600 font-medium">
                          {form.currency} {(l.amount || 0).toLocaleString()}
                        </td>
                        <td className="px-1">
                          {form.lineItems.length > 1 && (
                            <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 p-1">
                              <i className="fa fa-times text-xs" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span>{form.currency} {form.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Discount</span>
                  <select className="input py-0.5 text-xs flex-1" value={form.discountType}
                    onChange={(e) => setForm((f) => recalc({ ...f, discountType: e.target.value }))}>
                    <option value="none">None</option>
                    <option value="flat">Flat</option>
                    <option value="percent">%</option>
                  </select>
                  {form.discountType !== "none" && (
                    <input className="input py-0.5 text-xs w-20 text-right" type="number" min="0"
                      value={form.discountValue}
                      onChange={(e) => setForm((f) => recalc({ ...f, discountValue: e.target.value }))} />
                  )}
                  <span>{form.currency} {form.discount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Advance</span>
                  <input className="input py-0.5 text-xs w-24 text-right ml-auto" type="number" min="0"
                    value={form.advance}
                    onChange={(e) => setForm((f) => recalc({ ...f, advance: e.target.value }))} />
                  <span>{form.currency} {Number(form.advance).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-slate-800 border-t border-slate-200 pt-2">
                  <span>Total Due</span>
                  <span className="text-brand-600">{form.currency} {form.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Notes">
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Thank you for your business!" />
              </Field>
              <Field label="Terms & Conditions">
                <textarea className="input" rows={2} value={form.terms} onChange={(e) => setField("terms", e.target.value)} placeholder="Payment due within 30 days" />
              </Field>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving…" : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [date, setDate]       = useState("");
  const [modal, setModal]     = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = useCallback(async () => {
    try { setLoading(true); const { data } = await invoiceAPI.getAll({ search, date }); setList(data.data || []); }
    catch (err) { toast.error(getError(err)); }
    finally { setLoading(false); }
  }, [search, date]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async () => {
    setDeleting(true);
    try { await invoiceAPI.remove(confirm._id); toast.success("Invoice deleted"); setConfirm(null); fetch(); }
    catch (err) { toast.error(getError(err)); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Create and manage client invoices</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><i className="fa fa-plus" /> New Invoice</button>
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by client…" />
          <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          {date && <button onClick={() => setDate("")} className="btn-ghost text-xs">Clear</button>}
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : list.length === 0 ? (
          <Empty icon="fa-file-invoice" message="No invoices yet" />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr>
                <th>Invoice #</th><th>Date</th><th>Bill To</th><th>Total</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {list.map((inv) => (
                  <tr key={inv._id}>
                    <td className="font-mono text-xs text-brand-600 font-medium">{inv.invoiceNumber}</td>
                    <td className="text-xs text-slate-500">{inv.invoiceDate}</td>
                    <td>
                      <p className="font-medium text-slate-800">{inv.billTo?.name}</p>
                      <p className="text-xs text-slate-400">{inv.billTo?.email}</p>
                    </td>
                    <td className="font-semibold text-slate-800">{inv.currency} {inv.total?.toLocaleString()}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => navigate(`/invoices/${inv._id}`)} className="btn-ghost text-xs py-1 px-2"><i className="fa fa-eye" /></button>
                        <button onClick={() => setConfirm(inv)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2"><i className="fa fa-trash-alt" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <InvoiceModal onClose={() => setModal(false)} onSaved={() => { setModal(false); fetch(); }} />}
      <ConfirmModal open={!!confirm} title="Delete Invoice" message={`Delete invoice ${confirm?.invoiceNumber}?`}
        onConfirm={handleDelete} onCancel={() => setConfirm(null)} loading={deleting} />
    </div>
  );
}
