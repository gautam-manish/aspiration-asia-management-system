import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ConfirmModal, PageLoader } from "../../components/common";
import AuditTrailPanel from "../../components/common/AuditTrailPanel";
import { notifyError } from "../../utils/helpers";
import { useCustomerPayment, useCustomerPaymentMutations } from "../../hooks/useApiQueries";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

const money = (value, currency = "Rs.") => `${currency} ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function statusBadge(status) {
  return status === "void" ? <span className="badge badge-red">Void</span> : <span className="badge badge-green">Posted</span>;
}

function Info({ label, children }) {
  return <div><p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">{label}</p><div className="text-sm text-slate-700">{children || "-"}</div></div>;
}

export default function CustomerPaymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [confirmVoid, setConfirmVoid] = useState(false);
  const { data: payment, isLoading, error } = useCustomerPayment(id);
  const { void: voidPayment } = useCustomerPaymentMutations();

  useEffect(() => { if (error) notifyError(error); }, [error]);

  if (isLoading) return <PageLoader />;
  if (!payment) return <div className="text-center py-20 text-slate-400">Customer payment not found</div>;
  const isAdmin = user?.role === "admin";

  const handleVoid = () => {
    voidPayment.mutate(
      { id: payment._id, data: { notes: "Voided from payment detail page" } },
      {
        onSuccess: () => { toast.success("Payment voided"); setConfirmVoid(false); },
        onError: (err) => notifyError(err),
      },
    );
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/customer-payments")} className="btn-ghost p-2"><i className="fa fa-arrow-left" /></button>
          <div>
            <h1 className="page-title">Customer Payment</h1>
            <p className="page-subtitle font-mono text-brand-600">{payment.paymentNumber || payment.referenceCode || payment._id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {statusBadge(payment.status)}
          {isAdmin && payment.status === "posted" && payment.source === "manual" && <button onClick={() => setConfirmVoid(true)} className="btn-secondary text-red-600"><i className="fa fa-ban" /> Void</button>}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-800">Ledger record only</p>
        <p className="text-xs text-slate-500 mt-0.5">Invoice payment entries are maintained from Sales Records. This page is for accounting review, audit trail, and voiding old manual entries when needed.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Amount</p>
          <p className="text-2xl font-bold text-green-600">{money(payment.amount)}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Payment Date</p>
          <p className="text-xl font-bold text-slate-800">{payment.paymentDate || "-"}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Method</p>
          <p className="text-xl font-bold capitalize text-slate-800">{payment.method || "-"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Customer</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Info label="Name">{payment.customer?.name}</Info>
            <Info label="Email">{payment.customer?.email}</Info>
            <Info label="Phone">{payment.customer?.phone}</Info>
            <Info label="Address">{payment.customer?.address}</Info>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Reference</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Info label="Invoice">
              {payment.invoiceId ? <Link to={`/invoices/${payment.invoiceId}`} className="font-mono text-brand-600 hover:underline">{payment.invoiceNumber || payment.invoiceId}</Link> : payment.invoiceNumber}
            </Info>
            <Info label="Booking">{payment.bookingId && <span className="font-mono">{payment.bookingId}</span>}</Info>
            <Info label="Reference Code">{payment.referenceCode}</Info>
            <Info label="Source"><span className="capitalize">{payment.source || "manual"}</span></Info>
            <Info label="Notes"><span className="whitespace-pre-wrap">{payment.notes}</span></Info>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AuditTrailPanel entity="customer-payment" entityId={payment._id} />
      </div>

      <ConfirmModal
        open={confirmVoid}
        title="Void Customer Payment"
        message={`Void payment ${payment.paymentNumber || payment.referenceCode} for ${money(payment.amount)}?`}
        onConfirm={handleVoid}
        onCancel={() => setConfirmVoid(false)}
        loading={voidPayment.isPending}
      />
    </div>
  );
}
