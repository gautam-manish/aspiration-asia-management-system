import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { invoiceAPI, bookingAPI } from "../../api";
import { todayString, notifyError } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, ConfirmModal, Field, Pagination } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useInvoicesPaginated, useInvoiceMutations } from "../../hooks/useApiQueries";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

const EMPTY_LINE = { description: "", details: "", qty: 1, rate: 0, amount: 0 };

const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Math.max(0, Number(days) || 0));
  return d.toISOString().slice(0, 10);
};

const paymentStatusClass = {
  paid: "badge-green",
  partial: "badge-blue",
  unpaid: "badge-yellow",
};

const paymentStatusLabel = {
  paid: "Paid",
  partial: "Partially Paid",
  unpaid: "Unpaid",
};

const normalizeInvoiceListStatus = (summary = {}, total = 0) => {
  const paid = Number(summary.paid) || 0;
  const invoiceTotal = Number(total || summary.total || 0);
  if (paid <= 0.009) return "unpaid";
  if (paid + 0.009 < invoiceTotal) return "partial";
  return "paid";
};

export function InvoiceModal({ invoice, onClose, onSaved }) {
  const isEdit = !!invoice;

  const buildInitial = () => {
    if (invoice) {
      return {
        invoiceNumber: invoice.invoiceNumber || "",
        invoiceDate:   invoice.invoiceDate   || todayString(),
        paymentTermsDays: invoice.paymentTermsDays ?? 0,
        dueDate: invoice.dueDate || addDays(invoice.invoiceDate || todayString(), invoice.paymentTermsDays ?? 0),
        bookingId:     invoice.bookingId     || "",
        clientName:    invoice.clientName    || "",
        partyCompanyName: invoice.partyCompanyName || invoice.billTo?.name || "",
        partyContactPerson: invoice.partyContactPerson || invoice.billTo?.name || "",
        customerId:    invoice.customerId    || "",
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
        taxApplicable: !!invoice.taxApplicable,
        taxPercent:    invoice.taxPercent    || 0,
        taxAmount:     invoice.taxAmount     || 0,
        totalWithTax:  invoice.totalWithTax  || 0,
        total:         invoice.total         || 0,
        currency:      invoice.currency      || "Rs.",
        notes:         invoice.notes         || "",
        terms:         invoice.terms         || "",
      };
    }
    return {
      invoiceNumber: "",
      invoiceDate: todayString(),
      paymentTermsDays: 0,
      dueDate: todayString(),
      bookingId: "",
      clientName: "",
      partyCompanyName: "",
      partyContactPerson: "",
      customerId: "",
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
      subtotal: 0, discountType: "none", discountValue: 0, discount: 0,
      taxApplicable: false, taxPercent: 0, taxAmount: 0, totalWithTax: 0,
      total: 0,
      currency: "Rs.", notes: "", terms: "",
    };
  };

  const [form, setForm] = useState(buildInitial());
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [partyNameMode, setPartyNameMode] = useState("company");

  // Fetch a unique server-generated invoice number when creating a new invoice
  useEffect(() => {
    if (isEdit) return;
    invoiceAPI.getNextNumber()
      .then(({ data }) => setForm((f) => ({ ...f, invoiceNumber: data?.data?.invoiceNumber || "" })))
      .catch((err) => notifyError(err));
  }, [isEdit]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setFrom  = (k, v) => setForm((f) => ({ ...f, from:   { ...f.from,   [k]: v } }));
  const setBill  = (k, v) => setForm((f) => ({ ...f, billTo: { ...f.billTo, [k]: v } }));
  const setInvoiceDate = (value) => setForm((f) => ({ ...f, invoiceDate: value, dueDate: value }));

  const changePartyNameMode = (mode) => {
    setPartyNameMode(mode);
    setForm((f) => {
      const partyName = mode === "contact"
        ? (f.partyContactPerson || f.partyCompanyName || "")
        : (f.partyCompanyName || f.partyContactPerson || "");
      return { ...f, billTo: { ...f.billTo, name: partyName || f.billTo.name } };
    });
  };

  const lookupBooking = async () => {
    const id = (form.bookingId || "").trim();
    if (!id) { toast.error("Enter a booking ID first"); return; }
    setLookingUp(true);
    try {
      const { data } = await bookingAPI.getByQueryId(id);
      const b = data.data;
      const companyName = b.companyName || "";
      const contactPerson = b.contactPerson || "";
      if (!companyName && !contactPerson) {
        toast.error("Booking has no linked sundry party name");
      }
      setForm((f) => ({
        ...f,
        bookingId: b.queryId || id,
        customerId: b.customerId || f.customerId || "",
        clientName: b.clientName || f.clientName || "",
        partyCompanyName: companyName,
        partyContactPerson: contactPerson,
        billTo: {
          name: partyNameMode === "contact"
            ? (contactPerson || companyName || "")
            : (companyName || contactPerson || ""),
          email:   b.email || f.billTo.email || "",
          address: b.address || f.billTo.address || "",
          mobile:  b.mobile || f.billTo.mobile || "",
        },
      }));
      toast.success(`Booking ${b.queryId} loaded`);
    } catch (err) {
      notifyError(err);
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
      return recalc({ ...f, lineItems: lines });
    });
  };

  const recalc = (f) => {
    const subtotal = round2(f.lineItems.reduce((s, l) => s + (Number(l.amount) || 0), 0));
    const discount = round2(
      f.discountType === "percent"
        ? (subtotal * (Number(f.discountValue) || 0)) / 100
        : (Number(f.discountValue) || 0)
    );
    const taxBase  = round2(subtotal - discount);
    const taxAmount = f.taxApplicable
      ? round2((taxBase * (Number(f.taxPercent) || 0)) / 100)
      : 0;
    const totalWithTax = round2(taxBase + taxAmount);
    // Total Due is now the final figure including VAT/GST.
    const total = totalWithTax;
    return { ...f, subtotal, discount, taxAmount, totalWithTax, total };
  };

  const addLine    = () => setForm((f) => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_LINE }] }));
  const removeLine = (i) => setForm((f) => recalc({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.bookingId?.trim()) {
      toast.error("Booking ID is required");
      return;
    }
    if (!form.billTo.name?.trim()) {
      toast.error("Fetch booking to set party name");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        paymentTermsDays: 0,
        dueDate: form.invoiceDate,
        terms: "",
      };
      let saved;
      if (isEdit) {
        const { data } = await invoiceAPI.update(invoice._id, payload);
        saved = data?.data;
        toast.success("Invoice updated");
      } else {
        const { data } = await invoiceAPI.create(payload);
        saved = data?.data;
        toast.success("Invoice created");
      }
      onSaved(saved);
    } catch (err) {
      notifyError(err);
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
                <input className="input" type="date" value={form.invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
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
              <Field label="Client Name">
                <input className="input bg-slate-50" value={form.clientName || ""} readOnly placeholder="Fetch from booking" />
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
                <Field label="Party Name">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {[
                      ["company", "Company Name"],
                      ["contact", "Contact Person"],
                    ].map(([value, label]) => (
                      <label key={value} className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-xs font-medium cursor-pointer ${
                        partyNameMode === value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500"
                      }`}>
                        <input
                          type="radio"
                          name="partyNameMode"
                          value={value}
                          checked={partyNameMode === value}
                          onChange={() => changePartyNameMode(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <input
                    className="input bg-slate-50"
                    value={form.billTo.name || ""}
                    readOnly
                    placeholder="Fetch booking, then choose company/contact"
                  />
                </Field>
                {[["email","Email"],["address","Address"],["mobile","Mobile"]].map(([k,l]) => (
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

                {/* Tax applicable? */}
                <div className="flex justify-between items-center text-base text-slate-600 gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      checked={form.taxApplicable}
                      onChange={(e) => setForm((f) => recalc({ ...f, taxApplicable: e.target.checked }))}
                    />
                    <span className="font-medium whitespace-nowrap">Tax applicable?</span>
                  </label>
                  {form.taxApplicable && (
                    <div className="flex items-center gap-2">
                      <input
                        className="input py-1 text-sm w-20 text-right"
                        type="number"
                        min="0"
                        step="any"
                        value={form.taxPercent}
                        onChange={(e) => setForm((f) => recalc({ ...f, taxPercent: e.target.value }))}
                        placeholder="0"
                      />
                      <span className="text-slate-500 text-sm">%</span>
                    </div>
                  )}
                </div>

                {/* VAT/GST amount + Total inc tax (only when applicable) */}
                {form.taxApplicable && (
                  <>
                    <div className="flex justify-between items-center text-base text-slate-600">
                      <span className="font-medium">VAT / GST</span>
                      <span>+ {form.currency} {fmt(form.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-base text-slate-700 border-t border-slate-200 pt-2">
                      <span className="font-semibold">Total including VAT/GST</span>
                      <span className="font-semibold">{form.currency} {fmt(form.totalWithTax)}</span>
                    </div>
                  </>
                )}

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
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch]   = useState("");
  const [date, setDate]       = useState("");
  const [page, setPage]       = useState(1);
  const [modal, setModal]     = useState(false);
  const [confirm, setConfirm] = useState(null);

  const debouncedSearch = useDebouncedValue(search, 300);
  const isAdmin = user?.role === "admin";

  useEffect(() => { setPage(1); }, [debouncedSearch, date]);

  const {
    data: { invoices: list = [], total = 0, totalPages = 1 } = {},
    isLoading: loading,
    isFetching,
    error,
  } = useInvoicesPaginated({ search: debouncedSearch, date, page, limit: 50 });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const { remove } = useInvoiceMutations();
  const refresh = () => qc.invalidateQueries({ queryKey: ["invoices"] });

  const handleDelete = () => {
    remove.mutate(confirm._id, {
      onSuccess: () => {
        toast.success("Invoice deleted");
        setConfirm(null);
      },
      onError: (err) => notifyError(err),
    });
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
          <span className="text-sm text-slate-500 ml-auto">
            {total === 0
              ? "No invoices"
              : `${(page - 1) * 50 + 1}–${Math.min(page * 50, total)} of ${total} invoice${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : list.length === 0 ? (
          <Empty icon="fa-file-invoice" message="No invoices yet" />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr>
                  <th>Invoice #</th><th>Booking ID</th><th>Invoice / Due</th><th>Bill To</th><th>Total</th><th>Status</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {list.map((inv) => (
                    <tr key={inv._id}>
                      <td className="font-mono text-xs text-brand-600 font-medium">{inv.invoiceNumber}</td>
                      <td className="font-mono text-xs text-slate-600">{inv.bookingId || "—"}</td>
                      <td className="text-xs text-slate-500">
                        <p>{inv.invoiceDate}</p>
                        <p className="text-slate-400">Due {inv.dueDate || inv.invoiceDate}</p>
                      </td>
                      <td>
                        <p className="font-medium text-slate-800">{inv.billTo?.name}</p>
                        <p className="text-xs text-slate-400">{inv.billTo?.email}</p>
                      </td>
                      <td>
                        <p className="font-semibold text-slate-800">{inv.currency} {Number(inv.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-xs text-slate-400">
                          Bal {inv.currency} {Number(inv.paymentSummary?.balance ?? inv.total ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </td>
                      <td>
                        <span className={paymentStatusClass[normalizeInvoiceListStatus(inv.paymentSummary, inv.total)]}>
                          {paymentStatusLabel[normalizeInvoiceListStatus(inv.paymentSummary, inv.total)]}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => navigate(`/invoices/${inv._id}`)} className="btn-ghost text-xs py-1 px-2"><i className="fa fa-eye" /></button>
                          {isAdmin && <button onClick={() => setConfirm(inv)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2"><i className="fa fa-trash-alt" /></button>}
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

      {modal && <InvoiceModal onClose={() => setModal(false)} onSaved={() => { setModal(false); refresh(); }} />}
      <ConfirmModal open={!!confirm} title="Delete Invoice" message={`Delete invoice ${confirm?.invoiceNumber}?`}
        onConfirm={handleDelete} onCancel={() => setConfirm(null)} loading={remove.isPending} />
    </div>
  );
}
