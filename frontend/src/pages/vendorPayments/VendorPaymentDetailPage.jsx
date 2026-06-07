import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ConfirmModal, Field, PageLoader } from "../../components/common";
import AuditTrailPanel from "../../components/common/AuditTrailPanel";
import { notifyError } from "../../utils/helpers";
import { useVendorPayment, useVendorPaymentMutations } from "../../hooks/useApiQueries";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

const money = (value, currency = "Rs.") => `${currency} ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function statusBadge(status) {
  return status === "void" ? <span className="badge badge-red">Void</span> : <span className="badge badge-green">Posted</span>;
}

function Info({ label, children }) {
  return <div><p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">{label}</p><div className="text-sm text-slate-700">{children || "-"}</div></div>;
}

function EditVendorPaymentModal({ payment, onClose, onSaved }) {
  const { update } = useVendorPaymentMutations();
  const [form, setForm] = useState({
    vendorBillId: payment.vendorBillId || "",
    billNumber: payment.billNumber || "",
    vendorId: payment.vendorId || "",
    bookingId: payment.bookingId || "",
    vendor: {
      name: payment.vendor?.name || "",
      company: payment.vendor?.company || "",
      email: payment.vendor?.email || "",
      phone: payment.vendor?.phone || "",
      address: payment.vendor?.address || "",
    },
    paymentDate: payment.paymentDate || "",
    amount: payment.amount || "",
    method: payment.method || "bank",
    referenceCode: payment.referenceCode || "",
    bankAccountId: payment.bankAccountId || "",
    notes: payment.notes || "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setVendor = (k, v) => setForm((f) => ({ ...f, vendor: { ...f.vendor, [k]: v } }));

  const submit = (e) => {
    e.preventDefault();
    update.mutate(
      { id: payment._id, data: { ...form, amount: Number(form.amount) || 0 } },
      {
        onSuccess: () => { toast.success("Vendor payment updated"); onSaved(); },
        onError: (err) => notifyError(err),
      },
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">Edit Vendor Payment</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Payment Date" required><input className="input" type="date" value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} required /></Field>
            <Field label="Amount" required><input className="input" type="number" min="0.01" step="any" value={form.amount} onChange={(e) => set("amount", e.target.value)} required /></Field>
            <Field label="Method">
              <select className="input" value={form.method} onChange={(e) => set("method", e.target.value)}>
                {["bank", "cash", "card", "wallet", "cheque", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Reference Code"><input className="input" value={form.referenceCode} onChange={(e) => set("referenceCode", e.target.value)} /></Field>
            <Field label="Bill Number"><input className="input" value={form.billNumber} onChange={(e) => set("billNumber", e.target.value)} /></Field>
            <Field label="Booking ID"><input className="input" value={form.bookingId} onChange={(e) => set("bookingId", e.target.value)} /></Field>
            <Field label="Vendor Name" required><input className="input" value={form.vendor.name} onChange={(e) => setVendor("name", e.target.value)} required /></Field>
            <Field label="Company"><input className="input" value={form.vendor.company} onChange={(e) => setVendor("company", e.target.value)} /></Field>
            <Field label="Email"><input className="input" type="email" value={form.vendor.email} onChange={(e) => setVendor("email", e.target.value)} /></Field>
            <Field label="Phone"><input className="input" value={form.vendor.phone} onChange={(e) => setVendor("phone", e.target.value)} /></Field>
            <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={update.isPending} className="btn-primary"><i className="fa fa-save" /> Update Payment</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VendorPaymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [editing, setEditing] = useState(false);
  const { data: payment, isLoading, error } = useVendorPayment(id);
  const { void: voidPayment } = useVendorPaymentMutations();

  useEffect(() => { if (error) notifyError(error); }, [error]);

  if (isLoading) return <PageLoader />;
  if (!payment) return <div className="text-center py-20 text-slate-400">Vendor payment not found</div>;
  const isAdmin = user?.role === "admin";

  const handleVoid = () => {
    voidPayment.mutate(
      { id: payment._id, data: { notes: "Voided from payment detail page" } },
      {
        onSuccess: () => { toast.success("Vendor payment voided"); setConfirmVoid(false); },
        onError: (err) => notifyError(err),
      },
    );
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/vendor-payments")} className="btn-ghost p-2"><i className="fa fa-arrow-left" /></button>
          <div>
            <h1 className="page-title">Vendor Payment</h1>
            <p className="page-subtitle font-mono text-brand-600">{payment.paymentNumber || payment.referenceCode || payment._id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {statusBadge(payment.status)}
          {isAdmin && payment.status === "posted" && <button onClick={() => setEditing(true)} className="btn-secondary"><i className="fa fa-edit" /> Edit</button>}
          {isAdmin && payment.status === "posted" && <button onClick={() => setConfirmVoid(true)} className="btn-secondary text-red-600"><i className="fa fa-ban" /> Void</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card card-body"><p className="text-xs text-slate-500 mb-1">Amount</p><p className="text-2xl font-bold text-green-600">{money(payment.amount)}</p></div>
        <div className="card card-body"><p className="text-xs text-slate-500 mb-1">Payment Date</p><p className="text-xl font-bold text-slate-800">{payment.paymentDate || "-"}</p></div>
        <div className="card card-body"><p className="text-xs text-slate-500 mb-1">Method</p><p className="text-xl font-bold capitalize text-slate-800">{payment.method || "-"}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Vendor</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Info label="Name">{payment.vendor?.name || payment.vendor?.company}</Info>
            <Info label="Company">{payment.vendor?.company}</Info>
            <Info label="Email">{payment.vendor?.email}</Info>
            <Info label="Phone">{payment.vendor?.phone}</Info>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Reference</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Info label="Vendor Bill">
              {payment.vendorBillId ? <Link to={`/vendor-bills/${payment.vendorBillId}`} className="font-mono text-brand-600 hover:underline">{payment.billNumber || payment.vendorBillId}</Link> : payment.billNumber}
            </Info>
            <Info label="Booking">{payment.bookingId && <span className="font-mono">{payment.bookingId}</span>}</Info>
            <Info label="Reference Code">{payment.referenceCode}</Info>
            <Info label="Bank Account">{payment.bankAccountId}</Info>
            <Info label="Notes"><span className="whitespace-pre-wrap">{payment.notes}</span></Info>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AuditTrailPanel entity="vendor-payment" entityId={payment._id} />
      </div>

      <ConfirmModal
        open={confirmVoid}
        title="Void Vendor Payment"
        message={`Void payment ${payment.paymentNumber || payment.referenceCode} for ${money(payment.amount)}?`}
        onConfirm={handleVoid}
        onCancel={() => setConfirmVoid(false)}
        loading={voidPayment.isPending}
      />
      {editing && <EditVendorPaymentModal payment={payment} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
    </div>
  );
}
