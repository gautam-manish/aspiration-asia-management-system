import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { customerPaymentAPI, invoiceAPI } from "../../api";
import { notifyError } from "../../utils/helpers";
import { ConfirmModal, Empty, Field, PageLoader, Pagination, SearchBar } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useCustomerPaymentMutations, useCustomerPaymentsPaginated } from "../../hooks/useApiQueries";
import { useAuth } from "../../context/AuthContext";

const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const EMPTY_FORM = {
  invoiceId: "",
  invoiceNumber: "",
  bookingId: "",
  customerId: "",
  customer: { name: "", email: "", phone: "", address: "" },
  paymentDate: today(),
  amount: "",
  method: "bank",
  referenceCode: "",
  notes: "",
};

function statusBadge(status) {
  return status === "void"
    ? <span className="badge badge-red">Void</span>
    : <span className="badge badge-green">Posted</span>;
}

export function PaymentModal({ payment, onClose, onSaved }) {
  const isEdit = !!payment;
  const [form, setForm] = useState(payment ? {
    invoiceId: payment.invoiceId || "",
    invoiceNumber: payment.invoiceNumber || "",
    bookingId: payment.bookingId || "",
    customerId: payment.customerId || "",
    customer: {
      name: payment.customer?.name || "",
      email: payment.customer?.email || "",
      phone: payment.customer?.phone || "",
      address: payment.customer?.address || "",
    },
    paymentDate: payment.paymentDate || today(),
    amount: payment.amount || "",
    method: payment.method || "bank",
    referenceCode: payment.referenceCode || "",
    notes: payment.notes || "",
  } : { ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCustomer = (k, v) => setForm((f) => ({ ...f, customer: { ...f.customer, [k]: v } }));

  const lookupInvoice = async () => {
    const num = form.invoiceNumber.trim();
    if (!num) {
      toast.error("Enter an invoice number first");
      return;
    }
    setLookingUp(true);
    try {
      const { data } = await invoiceAPI.getByNumber(num);
      const inv = data.data;
      setForm((f) => ({
        ...f,
        invoiceId: inv._id || "",
        invoiceNumber: inv.invoiceNumber || num,
        bookingId: inv.bookingId || "",
        customerId: inv.customerId || "",
        amount: f.amount || "",
        customer: {
          name: inv.billTo?.name || f.customer.name,
          email: inv.billTo?.email || f.customer.email,
          phone: inv.billTo?.mobile || f.customer.phone,
          address: inv.billTo?.address || f.customer.address,
        },
      }));
      toast.success(`Invoice ${inv.invoiceNumber} loaded`);
    } catch (err) {
      notifyError(err);
    } finally {
      setLookingUp(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.customer.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!Number(form.amount || 0)) {
      toast.error("Amount is required");
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form, amount: Number(form.amount) || 0, source: "manual" };
      if (isEdit) {
        await customerPaymentAPI.update(payment._id, payload);
        toast.success("Customer payment updated");
      } else {
        await customerPaymentAPI.create(payload);
        toast.success("Customer payment recorded");
      }
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
          <h2 className="font-display font-semibold text-slate-800">{isEdit ? "Edit Customer Payment" : "Record Customer Payment"}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Invoice Reference</p>
              <Field label="Invoice Number">
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={form.invoiceNumber}
                    onChange={(e) => set("invoiceNumber", e.target.value)}
                    placeholder="e.g. ASA47821396"
                  />
                  <button type="button" onClick={lookupInvoice} disabled={lookingUp || !form.invoiceNumber.trim()} className="btn-secondary text-xs whitespace-nowrap">
                    {lookingUp ? "Fetching..." : <><i className="fa fa-search" /> Fetch</>}
                  </button>
                </div>
              </Field>
              {form.bookingId && <p className="text-xs text-slate-400 mt-1">Booking ID: <span className="font-mono">{form.bookingId}</span></p>}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Customer</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Customer Name" required>
                  <input className="input" value={form.customer.name} onChange={(e) => setCustomer("name", e.target.value)} required />
                </Field>
                <Field label="Email">
                  <input className="input" type="email" value={form.customer.email} onChange={(e) => setCustomer("email", e.target.value)} />
                </Field>
                <Field label="Phone">
                  <input className="input" value={form.customer.phone} onChange={(e) => setCustomer("phone", e.target.value)} />
                </Field>
                <Field label="Address">
                  <input className="input" value={form.customer.address} onChange={(e) => setCustomer("address", e.target.value)} />
                </Field>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Payment</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Date" required>
                  <input className="input" type="date" value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} required />
                </Field>
                <Field label="Amount" required>
                  <input className="input" type="number" min="0" step="any" value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
                </Field>
                <Field label="Method">
                  <select className="input" value={form.method} onChange={(e) => set("method", e.target.value)}>
                    <option value="bank">Bank</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="wallet">Wallet</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Reference Code">
                  <input className="input" value={form.referenceCode} onChange={(e) => set("referenceCode", e.target.value)} />
                </Field>
                <Field label="Notes" className="sm:col-span-2">
                  <textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                </Field>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              <i className="fa fa-save" /> {loading ? "Saving..." : isEdit ? "Update Payment" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomerPaymentsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("posted");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);

  const debouncedSearch = useDebouncedValue(search, 300);
  const isAdmin = user?.role === "admin";

  useEffect(() => { setPage(1); }, [debouncedSearch, status, from, to]);

  const {
    data: { payments = [], total = 0, totalPages = 1 } = {},
    isLoading,
    isFetching,
    error,
  } = useCustomerPaymentsPaginated({ search: debouncedSearch, status, from, to, page, limit: 50 });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const { void: voidPayment } = useCustomerPaymentMutations();
  const refresh = () => qc.invalidateQueries({ queryKey: ["customer-payments"] });

  const totalAmount = payments.reduce((s, p) => s + (p.status === "posted" ? Number(p.amount || 0) : 0), 0);

  const handleVoid = () => {
    voidPayment.mutate(
      { id: voidTarget._id, data: { notes: "Voided from Customer Payments page" } },
      {
        onSuccess: () => {
          toast.success("Payment voided");
          setVoidTarget(null);
        },
        onError: (err) => notifyError(err),
      },
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Payments</h1>
          <p className="page-subtitle">Accounts receivable payment register</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <i className="fa fa-plus" /> Record Payment
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card card-body !py-4">
          <p className="text-xs text-slate-500 mb-1">Payments</p>
          <p className="text-2xl font-bold text-slate-800">{total}</p>
        </div>
        <div className="card card-body !py-4">
          <p className="text-xs text-slate-500 mb-1">Posted Total (this page)</p>
          <p className="text-xl font-bold text-green-600">{money(totalAmount)}</p>
        </div>
        <div className="card card-body !py-4">
          <p className="text-xs text-slate-500 mb-1">Status Filter</p>
          <p className="text-xl font-bold text-slate-800 capitalize">{status}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search payment, invoice, customer..." />
          <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="posted">Posted</option>
            <option value="void">Void</option>
          </select>
          <input className="input w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
          <input className="input w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
          {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="btn-ghost text-xs"><i className="fa fa-times" /> Clear</button>}
          <span className="text-sm text-slate-500 ml-auto">
            {total === 0
              ? "No payments"
              : `${(page - 1) * 50 + 1}-${Math.min(page * 50, total)} of ${total} payment${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {isLoading ? <div className="p-8"><PageLoader /></div> : payments.length === 0 ? (
          <Empty icon="fa-money-bill-wave" message="No customer payments found" action={<button onClick={() => setModal(true)} className="btn-primary">Record first payment</button>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Invoice</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <Link to={`/customer-payments/${p._id}`} className="font-mono text-xs text-brand-600 font-medium hover:underline">{p.paymentNumber}</Link>
                        {p.referenceCode && <p className="text-xs text-slate-400">{p.referenceCode}</p>}
                      </td>
                      <td className="text-sm text-slate-500">{p.paymentDate}</td>
                      <td>
                        <p className="font-medium text-slate-800">{p.customer?.name || "-"}</p>
                        {p.customer?.email && <p className="text-xs text-slate-400">{p.customer.email}</p>}
                      </td>
                      <td>
                        {p.invoiceId ? (
                          <Link to={`/invoices/${p.invoiceId}`} className="font-mono text-xs text-brand-600 hover:underline">{p.invoiceNumber || "-"}</Link>
                        ) : (
                          <p className="font-mono text-xs text-slate-600">{p.invoiceNumber || "-"}</p>
                        )}
                        {p.bookingId && <p className="text-xs text-slate-400">{p.bookingId}</p>}
                      </td>
                      <td><span className="badge badge-gray capitalize">{p.method}</span></td>
                      <td className="font-semibold text-slate-800">{money(p.amount)}</td>
                      <td>{statusBadge(p.status)}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          {p.slip?.url && (
                            <a href={p.slip.url} target="_blank" rel="noreferrer" className="btn-ghost text-xs py-1 px-2">
                              <i className="fa fa-paperclip" />
                            </a>
                          )}
                          {isAdmin && p.status === "posted" && p.source === "manual" && (
                            <button onClick={() => setEditTarget(p)} className="btn-ghost text-xs py-1 px-2">
                              Edit
                            </button>
                          )}
                          {isAdmin && p.status === "posted" && (
                            <button onClick={() => setVoidTarget(p)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2">
                              Void
                            </button>
                          )}
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

      {modal && <PaymentModal onClose={() => setModal(false)} onSaved={() => { setModal(false); refresh(); }} />}
      {editTarget && <PaymentModal payment={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); refresh(); }} />}

      <ConfirmModal
        open={!!voidTarget}
        title="Void Payment"
        message={`Void payment ${voidTarget?.paymentNumber} for ${money(voidTarget?.amount)}?`}
        onConfirm={handleVoid}
        onCancel={() => setVoidTarget(null)}
        loading={voidPayment.isPending}
      />
    </div>
  );
}
