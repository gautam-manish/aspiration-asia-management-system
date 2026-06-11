import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ConfirmModal, PageLoader } from "../../components/common";
import AuditTrailPanel from "../../components/common/AuditTrailPanel";
import { notifyError } from "../../utils/helpers";
import { useVendorBill, useVendorBillMutations } from "../../hooks/useApiQueries";
import { useEffect, useState } from "react";
import { BillModal } from "./VendorBillsPage";
import { useAuth } from "../../context/AuthContext";
import { resolveUploadUrl } from "../../api";

const money = (value, currency = "Rs.") => `${currency} ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function statusBadge(status) {
  const map = { open: "badge-yellow", partial: "badge-blue", overdue: "badge-red", paid: "badge-green", void: "badge-red" };
  const label = { open: "Open", partial: "Partial", overdue: "Overdue", paid: "Paid", void: "Void" };
  return <span className={map[status] || "badge-gray"}>{label[status] || status || "Open"}</span>;
}

function Info({ label, children }) {
  return <div><p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">{label}</p><div className="text-sm text-slate-700">{children || "-"}</div></div>;
}

export default function VendorBillDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [editing, setEditing] = useState(false);
  const { data, isLoading, error } = useVendorBill(id);
  const { void: voidBill } = useVendorBillMutations();

  useEffect(() => { if (error) notifyError(error); }, [error]);

  if (isLoading) return <PageLoader />;
  const bill = data?.bill;
  const payments = data?.payments || [];
  if (!bill) return <div className="text-center py-20 text-slate-400">Vendor cost entry not found</div>;

  const summary = bill.paymentSummary || {};
  const status = summary.status || bill.status || "open";
  const cur = bill.currency || "Rs.";
  const isAdmin = user?.role === "admin";

  const handleVoid = () => {
    voidBill.mutate(
      { id: bill._id, data: { notes: "Voided from vendor bill detail page" } },
      {
        onSuccess: () => { toast.success("Vendor bill voided"); setConfirmVoid(false); },
        onError: (err) => notifyError(err),
      },
    );
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/vendor-bills")} className="btn-ghost p-2"><i className="fa fa-arrow-left" /></button>
          <div>
            <h1 className="page-title">Vendor Cost / Tax Invoice</h1>
            <p className="page-subtitle font-mono text-brand-600">{bill.billNumber || bill._id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {statusBadge(status)}
          {isAdmin && bill.status !== "void" && <button onClick={() => setEditing(true)} className="btn-secondary"><i className="fa fa-edit" /> Edit</button>}
          {isAdmin && bill.status !== "void" && <button onClick={() => setConfirmVoid(true)} className="btn-secondary text-red-600"><i className="fa fa-ban" /> Void</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        <div className="card card-body"><p className="text-xs text-slate-500 mb-1">Total Cost</p><p className="text-2xl font-bold text-slate-800">{money(bill.total, cur)}</p></div>
        <div className="card card-body"><p className="text-xs text-slate-500 mb-1">Paid</p><p className="text-2xl font-bold text-green-600">{money(summary.paid ?? bill.amountPaid, cur)}</p></div>
        <div className="card card-body"><p className="text-xs text-slate-500 mb-1">Balance</p><p className="text-2xl font-bold text-red-600">{money(summary.balance ?? bill.balance, cur)}</p></div>
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Tax Invoice</p>
          <p className={`text-xl font-bold ${bill.taxInvoiceSlip?.url ? "text-green-600" : "text-amber-600"}`}>{bill.taxInvoiceSlip?.url ? "Uploaded" : "Pending"}</p>
          <p className="text-xs text-slate-400 mt-1">{bill.billDate || "-"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Vendor</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Info label="Name">{bill.vendor?.name || bill.vendor?.company}</Info>
            <Info label="Company">{bill.vendor?.company}</Info>
            <Info label="Email">{bill.vendor?.email}</Info>
            <Info label="Phone">{bill.vendor?.phone}</Info>
            <Info label="PAN/VAT/GST">{bill.vendor?.pan}</Info>
            <Info label="Address">{bill.vendor?.address}</Info>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Cost / Tax Invoice Info</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Info label="Vendor Tax Invoice #">{bill.vendorInvoiceNumber}</Info>
            <Info label="Entry / Invoice Date">{bill.billDate}</Info>
            <Info label="Booking">{bill.bookingId && <span className="font-mono">{bill.bookingId}</span>}</Info>
            <Info label="Tax Invoice Slip">
              {bill.taxInvoiceSlip?.url ? (
                <a href={resolveUploadUrl(bill.taxInvoiceSlip.url)} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline inline-flex items-center gap-1">
                  <i className={`fa ${/^application\/pdf/.test(bill.taxInvoiceSlip.mimeType) ? "fa-file-pdf text-red-500" : "fa-file-image text-blue-600"}`} />
                  {bill.taxInvoiceSlip.fileName || "View tax invoice"}
                </a>
              ) : null}
            </Info>
            <Info label="Notes"><span className="whitespace-pre-wrap">{bill.notes}</span></Info>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Cost Lines</h2></div>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Service</th><th>Description</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {(bill.lines || []).map((line, idx) => (
                <tr key={`${line.description}-${idx}`}>
                  <td><span className="badge badge-gray capitalize">{line.serviceType || "other"}</span></td>
                  <td className="text-sm text-slate-700">{line.description}</td>
                  <td className="text-right">{line.qty}</td>
                  <td className="text-right">{money(line.rate, cur)}</td>
                  <td className="text-right font-semibold">{money(line.amount, cur)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={4} className="text-right">Subtotal</td>
                <td className="text-right">{money(bill.subtotal, cur)}</td>
              </tr>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={4} className="text-right">Tax</td>
                <td className="text-right">{money(bill.taxAmount, cur)}</td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td colSpan={4} className="text-right">Total</td>
                <td className="text-right">{money(bill.total, cur)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Payments</h2></div>
        {payments.length === 0 ? (
          <div className="card-body text-sm text-slate-400 text-center py-6">No vendor payments recorded.</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Payment #</th><th>Date</th><th>Method</th><th>Reference</th><th>Status</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment._id}>
                    <td><Link to={`/vendor-payments/${payment._id}`} className="font-mono text-xs text-brand-600 font-medium hover:underline">{payment.paymentNumber}</Link></td>
                    <td className="text-sm text-slate-500">{payment.paymentDate}</td>
                    <td><span className="badge badge-gray capitalize">{payment.method}</span></td>
                    <td className="text-xs text-slate-500">{payment.referenceCode || "-"}</td>
                    <td>{payment.status === "void" ? <span className="badge badge-red">Void</span> : <span className="badge badge-green">Posted</span>}</td>
                    <td className="text-right font-semibold text-green-700">{money(payment.amount, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4">
        <AuditTrailPanel entity="vendor-bill" entityId={bill._id} />
      </div>

      <ConfirmModal
        open={confirmVoid}
        title="Void Vendor Cost Entry"
        message={`Void entry ${bill.billNumber}? Posted payments must be voided first.`}
        onConfirm={handleVoid}
        onCancel={() => setConfirmVoid(false)}
        loading={voidBill.isPending}
      />
      {editing && <BillModal bill={bill} onClose={() => setEditing(false)} onSaved={() => {
        setEditing(false);
        qc.invalidateQueries({ queryKey: ["vendor-bill", id] });
        qc.invalidateQueries({ queryKey: ["vendor-bills"] });
        qc.invalidateQueries({ queryKey: ["reports", "ap-aging"] });
      }} />}
    </div>
  );
}
