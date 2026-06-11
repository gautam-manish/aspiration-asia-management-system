import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { bookingAPI, resolveUploadUrl, vendorBillAPI } from "../../api";
import { ConfirmModal, Empty, Field, PageLoader, Pagination, SearchBar } from "../../components/common";
import { notifyError } from "../../utils/helpers";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  useBankDropdown,
  useSundryDropdown,
  useVendorBillMutations,
  useVendorBillsPaginated,
  useVendorPaymentMutations,
} from "../../hooks/useApiQueries";
import { useAuth } from "../../context/AuthContext";

const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EMPTY_LINE = { serviceType: "hotel", description: "", qty: 1, rate: "", amount: "" };
const TAX_INVOICE_ACCEPT = ".pdf,.jpg,.jpeg,application/pdf,image/jpeg";

const fmtSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

function TaxInvoiceSlipField({ slip, onChange }) {
  const [busy, setBusy] = useState(false);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const ok = /\.(pdf|jpe?g)$/i.test(file.name) || /^application\/pdf$|^image\/jpeg$/i.test(file.type);
    if (!ok) { toast.error("Only PDF, JPG, or JPEG files are allowed"); return; }
    if (file.size > 1 * 1024 * 1024) { toast.error("File is too large. Please upload under 1 MB"); return; }

    setBusy(true);
    try {
      const { data } = await vendorBillAPI.uploadTaxInvoiceSlip(file);
      onChange(data?.data || null);
      toast.success("Tax invoice uploaded");
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  };

  if (slip?.url) {
    return (
      <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5">
        <i className={`fa ${/^application\/pdf/.test(slip.mimeType) ? "fa-file-pdf text-red-500" : "fa-file-image text-blue-600"}`} />
        <a href={resolveUploadUrl(slip.url)} target="_blank" rel="noreferrer" className="font-medium text-brand-700 truncate hover:underline" title={slip.fileName}>
          {slip.fileName || "Tax invoice"}
        </a>
        <span className="text-slate-400 ml-auto whitespace-nowrap">{fmtSize(slip.size)}</span>
        <button type="button" onClick={() => onChange(null)} disabled={busy} className="btn-ghost text-red-400 hover:text-red-600 p-1" title="Remove tax invoice">
          <i className="fa fa-times" />
        </button>
      </div>
    );
  }

  return (
    <label className={`flex items-center justify-center gap-2 text-xs border-2 border-dashed border-slate-300 rounded-lg px-2 py-2.5 cursor-pointer hover:border-brand-400 hover:bg-blue-50 transition-colors ${busy ? "opacity-50 pointer-events-none" : ""}`}>
      <i className="fa fa-paperclip" />
      <span>{busy ? "Uploading..." : "Upload tax invoice (PDF / JPG / JPEG)"}</span>
      <input type="file" accept={TAX_INVOICE_ACCEPT} onChange={onPick} className="hidden" disabled={busy} />
    </label>
  );
}

export function BillModal({ bill, onClose, onSaved }) {
  const isEdit = !!bill;
  const { data: vendors = [] } = useSundryDropdown({ role: "vendor" });
  const { create, update } = useVendorBillMutations();
  const [bookingLookup, setBookingLookup] = useState(false);
  const [form, setForm] = useState(bill ? {
    vendorId: bill.vendorId || "",
    vendor: {
      name: bill.vendor?.name || "",
      company: bill.vendor?.company || "",
      email: bill.vendor?.email || "",
      phone: bill.vendor?.phone || "",
      address: bill.vendor?.address || "",
      pan: bill.vendor?.pan || "",
    },
    vendorInvoiceNumber: bill.vendorInvoiceNumber || "",
    billDate: bill.billDate || today(),
    bookingId: bill.bookingId || "",
    taxAmount: bill.taxAmount || "",
    taxInvoiceSlip: bill.taxInvoiceSlip?.url ? { ...bill.taxInvoiceSlip } : null,
    notes: bill.notes || "",
    lines: (bill.lines || []).length ? bill.lines.map((line) => ({ ...line })) : [{ ...EMPTY_LINE }],
  } : {
    vendorId: "",
    vendor: { name: "", company: "", email: "", phone: "", address: "", pan: "" },
    vendorInvoiceNumber: "",
    billDate: today(),
    bookingId: "",
    taxAmount: "",
    taxInvoiceSlip: null,
    notes: "",
    lines: [{ ...EMPTY_LINE }],
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setVendor = (k, v) => setForm((f) => ({ ...f, vendor: { ...f.vendor, [k]: v } }));

  const fetchBooking = async () => {
    const bookingId = (form.bookingId || "").trim();
    if (!bookingId) { toast.error("Booking ID required"); return; }
    setBookingLookup(true);
    try {
      const { data } = await bookingAPI.getByQueryId(bookingId);
      const booking = data?.data || {};
      set("bookingId", booking.queryId || bookingId);
      toast.success(`Booking ${booking.queryId || bookingId} loaded`);
    } catch (err) {
      notifyError(err);
    } finally {
      setBookingLookup(false);
    }
  };

  const selectVendor = (id) => {
    const vendor = vendors.find((v) => v._id === id);
    setForm((f) => ({
      ...f,
      vendorId: id,
      vendor: {
        name: vendor?.contactPerson || "",
        company: vendor?.companyName || "",
        email: vendor?.email || "",
        phone: vendor?.phone || "",
        address: vendor?.address || "",
        pan: vendor?.panVatGst || "",
      },
    }));
  };

  const updateLine = (idx, key, value) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((line, i) => {
        if (i !== idx) return line;
        const next = { ...line, [key]: value };
        const qty = Number(next.qty) || 0;
        const rate = Number(next.rate) || 0;
        if (key === "qty" || key === "rate") next.amount = qty * rate || "";
        return next;
      }),
    }));
  };

  const totals = useMemo(() => {
    const subtotal = form.lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
    const taxAmount = Number(form.taxAmount) || 0;
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }, [form.lines, form.taxAmount]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.vendor.name.trim() && !form.vendor.company.trim()) {
      toast.error("Vendor is required");
      return;
    }
    if (!form.bookingId.trim()) {
      toast.error("Booking ID is required");
      return;
    }
    if (!form.lines.some((line) => line.description.trim() && Number(line.amount) >= 0)) {
      toast.error("At least one bill line is required");
      return;
    }
    const mutation = isEdit ? update : create;
    mutation.mutate(
      isEdit
        ? { id: bill._id, data: { ...form, subtotal: totals.subtotal, taxAmount: totals.taxAmount, total: totals.total } }
        : { ...form, subtotal: totals.subtotal, taxAmount: totals.taxAmount, total: totals.total },
      {
        onSuccess: () => {
          toast.success(isEdit ? "Vendor bill updated" : "Vendor bill created");
          onSaved();
        },
        onError: (err) => notifyError(err),
      },
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">{isEdit ? "Edit Vendor Cost / Tax Invoice" : "New Vendor Cost Entry"}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Vendor">
                <select className="input" value={form.vendorId} onChange={(e) => selectVendor(e.target.value)}>
                  <option value="">Manual / Select vendor</option>
                  {vendors.map((v) => <option key={v._id} value={v._id}>{v.contactPerson}{v.companyName ? ` (${v.companyName})` : ""}</option>)}
                </select>
              </Field>
              <Field label="Vendor Name" required>
                <input className="input" value={form.vendor.name} onChange={(e) => setVendor("name", e.target.value)} required />
              </Field>
              <Field label="Company">
                <input className="input" value={form.vendor.company} onChange={(e) => setVendor("company", e.target.value)} />
              </Field>
              <Field label="Vendor Tax Invoice #">
                <input className="input" value={form.vendorInvoiceNumber} onChange={(e) => set("vendorInvoiceNumber", e.target.value)} />
              </Field>
              <Field label="Entry / Invoice Date" required>
                <input className="input" type="date" value={form.billDate} onChange={(e) => set("billDate", e.target.value)} required />
              </Field>
              <Field label="Booking ID" required>
                <div className="flex gap-2">
                  <input className="input flex-1" value={form.bookingId} onChange={(e) => set("bookingId", e.target.value)} placeholder="ASA..." required />
                  <button type="button" onClick={fetchBooking} disabled={bookingLookup || !form.bookingId.trim()} className="btn-secondary text-xs whitespace-nowrap">
                    {bookingLookup ? "Fetching…" : <><i className="fa fa-search" /> Fetch</>}
                  </button>
                </div>
              </Field>
              <Field label="Tax Amount">
                <input className="input" type="number" min="0" step="any" value={form.taxAmount} onChange={(e) => set("taxAmount", e.target.value)} />
              </Field>
              <Field label="Final Tax Invoice Slip" className="sm:col-span-2">
                <TaxInvoiceSlipField slip={form.taxInvoiceSlip} onChange={(slip) => set("taxInvoiceSlip", slip)} />
              </Field>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Cost Lines</p>
                <button type="button" className="btn-secondary text-xs" onClick={() => set("lines", [...form.lines, { ...EMPTY_LINE }])}>
                  <i className="fa fa-plus" /> Line
                </button>
              </div>
              <div className="space-y-2">
                {form.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-[130px_minmax(220px,1fr)_90px_130px_140px_42px] gap-2 items-end rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <Field label="Service">
                      <select className="input" value={line.serviceType} onChange={(e) => updateLine(idx, "serviceType", e.target.value)}>
                        {["hotel", "transport", "guide", "activity", "flight", "visa", "meal", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="Description">
                      <input className="input" value={line.description} onChange={(e) => updateLine(idx, "description", e.target.value)} placeholder="Description" />
                    </Field>
                    <Field label="Qty">
                      <input className="input" type="number" min="0" step="any" value={line.qty} onChange={(e) => updateLine(idx, "qty", e.target.value)} />
                    </Field>
                    <Field label="Rate">
                      <input className="input" type="number" min="0" step="any" value={line.rate} onChange={(e) => updateLine(idx, "rate", e.target.value)} placeholder="0.00" />
                    </Field>
                    <Field label="Total">
                      <input className="input" type="number" min="0" step="any" value={line.amount} onChange={(e) => updateLine(idx, "amount", e.target.value)} placeholder="0.00" />
                    </Field>
                    <button type="button" className="btn-ghost text-red-400 h-10" onClick={() => set("lines", form.lines.filter((_, i) => i !== idx))} disabled={form.lines.length === 1} title="Remove line">
                      <i className="fa fa-trash" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card card-body !py-3"><p className="text-xs text-slate-500">Subtotal</p><p className="font-bold">{money(totals.subtotal)}</p></div>
              <div className="card card-body !py-3"><p className="text-xs text-slate-500">Tax</p><p className="font-bold">{money(totals.taxAmount)}</p></div>
              <div className="card card-body !py-3"><p className="text-xs text-slate-500">Total</p><p className="font-bold text-red-600">{money(totals.total)}</p></div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending} className="btn-primary"><i className="fa fa-save" /> {isEdit ? "Update Entry" : "Save Entry"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentModal({ bill, onClose, onSaved }) {
  const { data: banks = [] } = useBankDropdown();
  const { create } = useVendorPaymentMutations();
  const [form, setForm] = useState({
    paymentDate: today(),
    amount: bill?.balance || "",
    method: "bank",
    referenceCode: "",
    bankAccountId: "",
    notes: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    create.mutate(
      {
        ...form,
        amount: Number(form.amount) || 0,
        vendorBillId: bill._id,
        billNumber: bill.billNumber,
      },
      {
        onSuccess: () => {
          toast.success("Vendor payment recorded");
          onSaved();
        },
        onError: (err) => notifyError(err),
      },
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">Pay Vendor Cost</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body space-y-3">
            <p className="text-sm text-slate-500">Cost entry <span className="font-mono">{bill.billNumber}</span> balance {money(bill.balance)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Payment Date" required><input className="input" type="date" value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} required /></Field>
              <Field label="Amount" required><input className="input" type="number" min="0.01" step="any" value={form.amount} onChange={(e) => set("amount", e.target.value)} required /></Field>
              <Field label="Method">
                <select className="input" value={form.method} onChange={(e) => set("method", e.target.value)}>
                  {["bank", "cash", "card", "wallet", "cheque", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Bank Account">
                <select className="input" value={form.bankAccountId} onChange={(e) => set("bankAccountId", e.target.value)}>
                  <option value="">Not linked</option>
                  {banks.map((b) => <option key={b._id} value={b._id}>{b.bankName}</option>)}
                </select>
              </Field>
              <Field label="Reference Code"><input className="input" value={form.referenceCode} onChange={(e) => set("referenceCode", e.target.value)} /></Field>
              <Field label="Notes"><input className="input" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary"><i className="fa fa-money-bill-wave" /> Record Payment</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VendorBillsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [payBill, setPayBill] = useState(null);
  const [voidBill, setVoidBill] = useState(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const isAdmin = user?.role === "admin";

  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  const { data: { bills = [], total = 0, totalPages = 1 } = {}, isLoading, isFetching, error } =
    useVendorBillsPaginated({ search: debouncedSearch, status, page, limit: 50 });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const { void: voidMutation } = useVendorBillMutations();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["vendor-bills"] });
    qc.invalidateQueries({ queryKey: ["vendor-bill"] });
    qc.invalidateQueries({ queryKey: ["vendor-payments"] });
    qc.invalidateQueries({ queryKey: ["vendor-payment"] });
    qc.invalidateQueries({ queryKey: ["reports", "ap-aging"] });
    qc.invalidateQueries({ queryKey: ["reports", "vendor-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "booking-profitability"] });
    qc.invalidateQueries({ queryKey: ["reports", "profit-loss"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["bank-account"] });
  };

  const totalOutstanding = bills.reduce((sum, bill) => sum + (bill.status !== "void" ? Number(bill.balance || 0) : 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendor Costs / Tax Invoices</h1>
          <p className="page-subtitle">Estimated vendor costs, installment payments, and final tax invoices</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><i className="fa fa-plus" /> New Cost Entry</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card card-body !py-4"><p className="text-xs text-slate-500">Cost Entries</p><p className="text-2xl font-bold">{total}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500">Outstanding (this page)</p><p className="text-xl font-bold text-red-600">{money(totalOutstanding)}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500">Status Filter</p><p className="text-xl font-bold capitalize">{status || "all"}</p></div>
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search vendor, tax invoice, booking..." />
          <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </select>
          <span className="text-sm text-slate-500 ml-auto">{total} entr{total !== 1 ? "ies" : "y"}</span>
        </div>
        {isLoading ? <div className="p-8"><PageLoader /></div> : bills.length === 0 ? (
          <Empty icon="fa-file-invoice-dollar" message="No vendor cost entries found" action={<button onClick={() => setModal(true)} className="btn-primary">Create first entry</button>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Entry #</th><th>Date</th><th>Vendor</th><th>Booking</th><th>Total Cost</th><th>Paid</th><th>Balance</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill._id}>
                      <td><Link to={`/vendor-bills/${bill._id}`} className="font-mono text-xs text-brand-600 font-medium hover:underline">{bill.billNumber}</Link>{bill.vendorInvoiceNumber && <p className="text-xs text-slate-400">{bill.vendorInvoiceNumber}</p>}</td>
                      <td className="text-sm text-slate-500">
                        <p>{bill.billDate}</p>
                        <p className="text-xs text-slate-400">{bill.taxInvoiceSlip?.url ? "Tax invoice uploaded" : "Tax invoice pending"}</p>
                      </td>
                      <td><p className="font-medium text-slate-800">{bill.vendor?.name || bill.vendor?.company || "-"}</p>{bill.vendor?.company && <p className="text-xs text-slate-400">{bill.vendor.company}</p>}</td>
                      <td className="font-mono text-xs text-slate-500">{bill.bookingId || "-"}</td>
                      <td className="font-semibold">{money(bill.total)}</td>
                      <td className="text-green-600">{money(bill.amountPaid)}</td>
                      <td className="font-semibold text-red-600">{money(bill.balance)}</td>
                      <td><div className="flex justify-end gap-1">
                        {isAdmin && bill.status !== "void" && <button onClick={() => setEditBill(bill)} className="btn-ghost text-xs py-1 px-2">Edit</button>}
                        {["open", "partial"].includes(bill.status) && <button onClick={() => setPayBill(bill)} className="btn-ghost text-xs py-1 px-2">Pay</button>}
                        {isAdmin && bill.status !== "void" && <button onClick={() => setVoidBill(bill)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2">Void</button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={50} onChange={setPage} isFetching={isFetching} />
          </>
        )}
      </div>

      {modal && <BillModal onClose={() => setModal(false)} onSaved={() => { setModal(false); refresh(); }} />}
      {editBill && <BillModal bill={editBill} onClose={() => setEditBill(null)} onSaved={() => { setEditBill(null); refresh(); }} />}
      {payBill && <PaymentModal bill={payBill} onClose={() => setPayBill(null)} onSaved={() => { setPayBill(null); refresh(); }} />}
      <ConfirmModal
        open={!!voidBill}
        title="Void Vendor Cost Entry"
        message={`Void entry ${voidBill?.billNumber}? Posted payments must be voided first.`}
        onConfirm={() => voidMutation.mutate({ id: voidBill._id, data: { notes: "Voided from Vendor Costs page" } }, {
          onSuccess: () => { toast.success("Vendor cost entry voided"); setVoidBill(null); },
          onError: (err) => notifyError(err),
        })}
        onCancel={() => setVoidBill(null)}
        loading={voidMutation.isPending}
      />
    </div>
  );
}
