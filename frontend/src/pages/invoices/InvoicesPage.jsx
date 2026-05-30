import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { invoiceAPI, bookingAPI } from "../../api";
import { getError, formatDate, todayString } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, ConfirmModal, Field } from "../../components/common";
import toast from "react-hot-toast";

const EMPTY_LINE = { description: "", details: "", qty: 1, rate: 0, amount: 0 };

export function InvoiceModal({ invoice, onClose, onSaved }) {
  const isEdit = !!invoice;

  const buildInitial = () => {
    if (invoice) {
      return {
        invoiceNumber: invoice.invoiceNumber || "",
        invoiceDate:   invoice.invoiceDate   || todayString(),
        bookingId:     invoice.bookingId     || "",
        from: {
          name:     invoice.from?.name     || "Aspiration AISA",
          email:    invoice.from?.email    || "account@aspirationasia.com",
          address1: invoice.from?.address1 || "Near Nyatapol Temple",
          address2: invoice.from?.address2 || "Bhaktapur, Nepal",
          zip:      invoice.from?.zip      || "",
          phone:    invoice.from?.phone    || "+977 9746239349",
        },
        billTo: {
          name:    invoice.billTo?.name    || "",
          email:   invoice.billTo?.email   || "",
          address: invoice.billTo?.address || "",
          mobile:  invoice.billTo?.mobile  || "",
        },
        lineItems: (invoice.lineItems && invoice.lineItems.length > 0)
          ? invoice.lineItems.map((l) => ({ ...l }))
          : [{ ...EMPTY_LINE }],
        subtotal:      invoice.subtotal      || 0,
        discountType:  invoice.discountType  || "none",
        discountValue: invoice.discountValue || 0,
        discount:      invoice.discount      || 0,
        advance:       invoice.advance       || 0,
        total:         invoice.total         || 0,
        currency:      invoice.currency      || "Rs.",
        notes:         invoice.notes         || "",
        terms:         invoice.terms         || "",
      };
    }
    return {
      invoiceNumber: "",
      invoiceDate: todayString(),
      bookingId: "",
      from: {
        name: "Aspiration AISA",
        email: "account@aspirationasia.com",
        address1: "Near Nyatapol Temple",
        address2: "Bhaktapur, Nepal",
        zip: "",
        phone: "+977 9746239349",
      },
      billTo: { name: "", email: "", address: "", mobile: "" },
      lineItems: [{ ...EMPTY_LINE }],
      subtotal: 0, discountType: "none", discountValue: 0, discount: 0, advance: 0, total: 0,
      currency: "Rs.", notes: "", terms: "",
    };
  };

  const [form, setForm] = useState(buildInitial());
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // Fetch a unique server-generated invoice number when creating a new invoice
  useEffect(() => {
    if (isEdit) return;
    invoiceAPI.getNextNumber()
      .then(({ data }) => setForm((f) => ({ ...f, invoiceNumber: data?.data?.invoiceNumber || "" })))
      .catch((err) => toast.error(getError(err)));
  }, [isEdit]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setFrom  = (k, v) => setForm((f) => ({ ...f, from:   { ...f.from,   [k]: v } }));
  const setBill  = (k, v) => setForm((f) => ({ ...f, billTo: { ...f.billTo, [k]: v } }));

  const lookupBooking = async () => {
    const id = (form.bookingId || "").trim();
    if (!id) { toast.error("Enter a booking ID first"); return; }
    setLookingUp(true);
    try {
      const { data } = await bookingAPI.getByQueryId(id);
      const b = data.data;
      setForm((f) => ({
        ...f,
        bookingId: b.queryId || id,
        billTo: {
          name:    b.clientName || f.billTo.name,
          email:   b.email      || f.billTo.email,
          address: b.address    || f.billTo.address,
          mobile:  b.mobile     || f.billTo.mobile,
        },
      }));
      toast.success(`Booking ${b.queryId} loaded`);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLookingUp(false);
    }
  };

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const setLine = (i, k, v) => {
    setForm((f) => {
      const lines = [...f.lineItems];
      lines[i] = { ...lines[i], [k]: v };
      if (k === "qty" || k === "rate") {
        lines[i].amount = round2((Number(lines[i].qty) || 0) * (Number(lines[i].rate) || 0));
      }
      const subtotal = round2(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
      const discount = round2(
        f.discountType === "percent"
          ? (subtotal * (Number(f.discountValue) || 0)) / 100
          : (Number(f.discountValue) || 0)
      );
      const total = round2(subtotal - discount - (Number(f.advance) || 0));
      return { ...f, lineItems: lines, subtotal, discount, total };
    });
  };

  const recalc = (f) => {
    const subtotal = round2(f.lineItems.reduce((s, l) => s + (Number(l.amount) || 0), 0));
    const discount = round2(
      f.discountType === "percent"
        ? (subtotal * (Number(f.discountValue) || 0)) / 100
        : (Number(f.discountValue) || 0)
    );
    const total = round2(subtotal - discount - (Number(f.advance) || 0));
    return { ...f, subtotal, discount, total };
  };

  const addLine    = () => setForm((f) => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_LINE }] }));
  const removeLine = (i) => setForm((f) => recalc({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await invoiceAPI.update(invoice._id, form);
        toast.success("Invoice updated");
      } else {
        await invoiceAPI.create(form);
        toast.success("Invoice created");
      }
      onSaved();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">{isEdit ? "Edit Invoice" : "New Invoice"}</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-5">
            {/* Header row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Invoice Number" required>
                <input
                  className="input bg-slate-50 font-mono text-brand-600 cursor-not-allowed"
                  value={form.invoiceNumber}
                  readOnly
                  placeholder="Generating…"
                />
              </Field>
              <Field label="Invoice Date" required>
                <input className="input" type="date" value={form.invoiceDate} onChange={(e) => setField("invoiceDate", e.target.value)} required />
              </Field>
              <Field label="Currency" required>
                <select
                  className="input"
                  value={form.currency}
                  onChange={(e) => setForm((f) => recalc({ ...f, currency: e.target.value }))}
                  required
                >
                  <option value="$">USD ($)</option>
                  <option value="€">EUR (€)</option>
                  <option value="£">GBP (£)</option>
                  <option value="₹">INR (₹)</option>
                  <option value="Rs.">NPR (Rs)</option>
                </select>
              </Field>
            </div>

            {/* Booking lookup */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Booking ID">
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={form.bookingId}
                    onChange={(e) => setField("bookingId", e.target.value)}
                    placeholder="e.g. ASA2026100"
                  />
                  <button
                    type="button"
                    onClick={lookupBooking}
                    disabled={lookingUp || !form.bookingId.trim()}
                    className="btn-secondary text-xs whitespace-nowrap"
                  >
                    {lookingUp ? "Fetching…" : <><i className="fa fa-search" /> Fetch</>}
                  </button>
                </div>
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
                      <th className="px-3 py-2 text-left text-sm font-semibold text-slate-500">Description</th>
                      <th className="px-3 py-2 text-center text-sm font-semibold text-slate-500 w-20">Qty</th>
                      <th className="px-3 py-2 text-right text-sm font-semibold text-slate-500 w-32">Rate</th>
                      <th className="px-3 py-2 text-right text-sm font-semibold text-slate-500 w-32">Amount</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.lineItems.map((l, i) => (
                      <tr key={i} className="border-t border-slate-100 align-top">
                        <td className="px-2 py-2">
                          <input className="input text-sm mb-1" value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} required placeholder="Item description" />
                          <textarea
                            className="input text-sm"
                            rows={2}
                            value={l.details}
                            onChange={(e) => setLine(i, "details", e.target.value)}
                            placeholder="Additional details (optional)"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input className="input text-sm text-center" type="number" min="0" step="any" value={l.qty} onChange={(e) => setLine(i, "qty", e.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <input className="input text-sm text-right" type="number" min="0" step="any" value={l.rate} onChange={(e) => setLine(i, "rate", e.target.value)} />
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-slate-600 font-medium">
                          {form.currency} {fmt(l.amount)}
                        </td>
                        <td className="px-1 py-2">
                          {form.lineItems.length > 1 && (
                            <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 p-1">
                              <i className="fa fa-times text-sm" />
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
              <div className="w-full sm:w-[30rem] space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex justify-between items-center text-base text-slate-600">
                  <span className="font-medium">Subtotal</span>
                  <span>{form.currency} {fmt(form.subtotal)}</span>
                </div>

                {/* Discount */}
                <div className="flex justify-between items-center text-base text-slate-600 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium whitespace-nowrap">Discount</span>
                    <select
                      className="input py-1 text-sm w-24"
                      value={form.discountType}
                      onChange={(e) => setForm((f) => recalc({ ...f, discountType: e.target.value }))}
                    >
                      <option value="none">None</option>
                      <option value="flat">Flat</option>
                      <option value="percent">%</option>
                    </select>
                    {form.discountType !== "none" && (
                      <input
                        className="input py-1 text-sm w-20 text-right"
                        type="number"
                        min="0"
                        step="any"
                        value={form.discountValue}
                        onChange={(e) => setForm((f) => recalc({ ...f, discountValue: e.target.value }))}
                        placeholder="0"
                      />
                    )}
                  </div>
                  <span className="text-red-500 whitespace-nowrap">
                    - {form.currency} {fmt(form.discount)}
                  </span>
                </div>

                {/* Advance */}
                <div className="flex justify-between items-center text-base text-slate-600 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium whitespace-nowrap">Advance Paid</span>
                    <input
                      className="input py-1 text-sm w-24 text-right"
                      type="number"
                      min="0"
                      step="any"
                      value={form.advance}
                      onChange={(e) => setForm((f) => recalc({ ...f, advance: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <span className="text-green-600 whitespace-nowrap">
                    {form.currency} {fmt(form.advance)}
                  </span>
                </div>

                <div className="flex justify-between text-lg font-semibold text-slate-800 border-t border-slate-200 pt-2 mt-2">
                  <span>Total Due</span>
                  <span className="text-brand-600">{form.currency} {fmt(form.total)}</span>
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
              {loading ? "Saving…" : (isEdit ? "Update Invoice" : "Create Invoice")}
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
          <SearchBar value={search} onChange={setSearch} placeholder="Search by client, booking ID, invoice #…" />
          <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          {date && <button onClick={() => setDate("")} className="btn-ghost text-xs">Clear</button>}
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : list.length === 0 ? (
          <Empty icon="fa-file-invoice" message="No invoices yet" />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr>
                <th>Invoice #</th><th>Booking ID</th><th>Date</th><th>Bill To</th><th>Total</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {list.map((inv) => (
                  <tr key={inv._id}>
                    <td className="font-mono text-xs text-brand-600 font-medium">{inv.invoiceNumber}</td>
                    <td className="font-mono text-xs text-slate-600">{inv.bookingId || "—"}</td>
                    <td className="text-xs text-slate-500">{inv.invoiceDate}</td>
                    <td>
                      <p className="font-medium text-slate-800">{inv.billTo?.name}</p>
                      <p className="text-xs text-slate-400">{inv.billTo?.email}</p>
                    </td>
                    <td className="font-semibold text-slate-800">{inv.currency} {Number(inv.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
