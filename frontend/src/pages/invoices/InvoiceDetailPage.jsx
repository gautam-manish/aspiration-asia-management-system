import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { invoiceAPI, resolveUploadUrl } from "../../api";
import { numberToWords, notifyError } from "../../utils/helpers";
import { PageLoader, Field } from "../../components/common";
import AuditTrailPanel from "../../components/common/AuditTrailPanel";
import { InvoiceModal } from "./InvoicesPage";
import { useInvoice } from "../../hooks/useApiQueries";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const paymentStatusClass = {
  paid: "badge-green",
  partial: "badge-blue",
  overdue: "badge-red",
  unpaid: "badge-yellow",
  draft: "badge-gray",
};

const paymentStatusLabel = {
  paid: "Paid",
  partial: "Partial",
  overdue: "Overdue",
  unpaid: "Unpaid",
  draft: "Draft",
};

// ─── Exact original invoice preview template ─────────────────────────────────
const ADVANCE_MAX_BYTES = 1 * 1024 * 1024;
const ADVANCE_ACCEPT = ".pdf,.jpg,.jpeg,application/pdf,image/jpeg";

const fmtSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

function AddAdvanceModal({ invoice, onClose, onSaved }) {
  const cur = invoice.currency || "Rs.";
  const [referenceCode, setReferenceCode] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slip, setSlip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const onPickSlip = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const okType = /\.(pdf|jpe?g)$/i.test(file.name) ||
      /^application\/pdf$|^image\/jpeg$/i.test(file.type);
    if (!okType) {
      toast.error("Only PDF, JPG, or JPEG files are allowed");
      return;
    }

    if (file.size > ADVANCE_MAX_BYTES) {
      toast.error("File is too large. Please upload a slip under 1 MB");
      return;
    }

    setBusy(true);
    try {
      const { data } = await invoiceAPI.uploadAdvanceSlip(file);
      setSlip(data?.data || null);
      toast.success("Slip uploaded");
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    setSaving(true);
    try {
      const { data } = await invoiceAPI.addAdvancePayment(invoice._id, {
        referenceCode,
        amount: numericAmount,
        date,
        slip,
      });
      toast.success("Advance payment recorded");
      onSaved(data?.data);
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">Add Advance Payment</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Reference Code">
                <input className="input" value={referenceCode} onChange={(e) => setReferenceCode(e.target.value)} placeholder="e.g. TXN-12345" />
              </Field>
              <Field label="Date" required>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </Field>
            </div>
            <Field label={`Amount (${cur})`} required>
              <input className="input" type="number" min="0.01" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0" />
            </Field>

            <div>
              <p className="label mb-1">Payment Slip <span className="text-xs font-normal text-slate-400">(PDF / JPG / JPEG, max 1 MB)</span></p>
              {slip?.url ? (
                <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5">
                  <i className={`fa ${/^application\/pdf/.test(slip.mimeType) ? "fa-file-pdf text-red-500" : "fa-file-image text-blue-600"}`} />
                  <a href={resolveUploadUrl(slip.url)} target="_blank" rel="noreferrer" className="font-medium text-brand-700 truncate hover:underline" title={slip.fileName}>
                    {slip.fileName || "Slip"}
                  </a>
                  <span className="text-slate-400 ml-auto whitespace-nowrap">{fmtSize(slip.size)}</span>
                  <button type="button" onClick={() => setSlip(null)} disabled={busy} className="btn-ghost text-red-400 hover:text-red-600 p-1" title="Remove slip">
                    <i className="fa fa-times" />
                  </button>
                </div>
              ) : (
                <label className={`flex items-center justify-center gap-2 text-xs border-2 border-dashed border-slate-300 rounded-lg px-2 py-3 cursor-pointer hover:border-brand-400 hover:bg-blue-50 transition-colors ${busy ? "opacity-50 pointer-events-none" : ""}`}>
                  <i className="fa fa-paperclip" />
                  <span>{busy ? "Uploading..." : "Click to attach slip"}</span>
                  <input type="file" accept={ADVANCE_ACCEPT} onChange={onPickSlip} className="hidden" disabled={busy} />
                </label>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || busy} className="btn-primary">
              <i className="fa fa-save" /> {saving ? "Saving..." : "Save Advance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InvoicePrint({ inv }) {
  const cur = inv.currency || "Rs.";

  const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  // pv-label style
  const pvLabel = {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 4,
    display: "block",
  };

  const pvDivider = { border: "none", borderTop: "1px solid #e2e8f0", margin: "0 32px" };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", color: "#1e293b", background: "white" }}>
      {/* invoice-wrap */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", maxWidth: 800, margin: "0 auto" }}>

        {/* ── HEADER: logo+company LEFT | invoice meta RIGHT ── */}
        <div style={{ padding: "18px 32px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 70, height: 70, flexShrink: 0, overflow: "hidden" }}>
              <img
                src="https://i.ibb.co/bRJr7nNM/images.png"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                alt="logo"
              />
            </div>
            <div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 4, lineHeight: 1.2 }}>
                Aspiration Asia Trekking &amp; Expedition Pvt Ltd
              </div>
              <div style={{ fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                <div>Near Nyatapol Temple Bhaktapur, Nepal</div>
                <div>
                  +977 9746239349 <span style={{ color: "#1e293b" }}>|</span>{" "}
                  <span style={{ color: "#2563eb" }}>account@aspirationasia.com</span>
                </div>
                <div><strong style={{ color: "#1e293b" }}>PAN:</strong> 610278626</div>
                <div><strong style={{ color: "#1e293b" }}>Registration No:</strong> 290216/78/079</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 160 }}>
            <div style={{ fontWeight: "bold", fontSize: 20, color: "#1e293b", marginBottom: 4 }}>{inv.title || "Invoice"}</div>
            <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#1e293b", marginBottom: 6 }}>{inv.invoiceNumber || ""}</div>
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.88rem", color: "#94a3b8" }}>Date:</span>
              <span style={{ fontSize: "0.98rem", color: "#1e293b" }}>{inv.invoiceDate || ""}</span>
            </div>
          </div>
        </div>

        <hr style={pvDivider} />

        {/* ── BILL TO ── */}
        <div style={{ padding: "10px 32px 10px" }}>
          <span style={{ ...pvLabel, fontSize: 15 }}>Bill To</span>
          {inv.billTo?.name   && <div style={{ fontSize: "0.98rem", fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>{inv.billTo.name}</div>}
          {inv.clientName && <div style={{ fontSize: "0.88rem", color: "#475569", marginBottom: 2 }}><strong>Client:</strong> {inv.clientName}</div>}
          {inv.billTo?.email  && <div style={{ fontSize: "0.88rem", color: "#2563eb", marginBottom: 2 }}>{inv.billTo.email}</div>}
          {inv.billTo?.address && <div style={{ fontSize: "0.88rem", color: "#475569", marginBottom: 2 }}>{inv.billTo.address}</div>}
          {inv.billTo?.mobile && <div style={{ fontSize: "0.88rem", color: "#475569" }}>{inv.billTo.mobile}</div>}
        </div>

        <hr style={pvDivider} />

        {/* ── LINE ITEMS ── */}
        <div style={{ padding: "0 32px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ fontWeight: "bold" }}>
                <th style={{ textAlign: "left", width: "50%", fontSize: 13, padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>Description</th>
                <th style={{ textAlign: "center", width: "20%", fontSize: 13, padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>Rate</th>
                <th style={{ textAlign: "center", width: "10%", fontSize: 13, padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>Qty</th>
                <th style={{ textAlign: "right", width: "20%", fontSize: 13, padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(inv.lineItems || []).map((l, i) => (
                <tr key={i}>
                  <td style={{ padding: "8px 8px", fontSize: 13, borderBottom: "1px solid #f1f5f9" }}>
                    <div>{l.description}</div>
                    {l.details && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{l.details}</div>}
                  </td>
                  <td style={{ padding: "8px 8px", fontSize: 13, textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>{cur} {fmt(l.rate)}</td>
                  <td style={{ padding: "8px 8px", fontSize: 13, textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>{l.qty}</td>
                  <td style={{ padding: "8px 8px", fontSize: 13, textAlign: "right", borderBottom: "1px solid #f1f5f9" }}>{cur} {fmt(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── TOTALS (right-aligned) ── */}
        <div style={{ padding: "8px 32px 4px", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 280 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ fontWeight: 600, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.8rem" }}>Subtotal</span>
              <span style={{ color: "#1e293b", fontWeight: 500, fontSize: "0.9rem" }}>{cur} {fmt(inv.subtotal)}</span>
            </div>
            {inv.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ fontWeight: 600, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.8rem" }}>Discount</span>
                <span style={{ color: "#ef4444", fontWeight: 500, fontSize: "0.9rem" }}>- {cur} {fmt(inv.discount)}</span>
              </div>
            )}
            {inv.taxApplicable && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span style={{ fontWeight: 600, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.8rem" }}>
                    VAT / GST {inv.taxPercent ? `(${inv.taxPercent}%)` : ""}
                  </span>
                  <span style={{ color: "#1e293b", fontWeight: 500, fontSize: "0.9rem" }}>+ {cur} {fmt(inv.taxAmount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid #e2e8f0", marginTop: 2 }}>
                  <span style={{ fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.8rem" }}>Total incl. VAT/GST</span>
                  <span style={{ color: "#1e293b", fontWeight: 700, fontSize: "0.95rem" }}>{cur} {fmt(inv.totalWithTax)}</span>
                </div>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "0.95rem", borderTop: "2px solid #e2e8f0", marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Due</span>
              <span style={{ fontWeight: 700, color: "#1e293b" }}>{cur} {fmt(inv.total)}</span>
            </div>
          </div>
        </div>

        {/* ── BALANCE DUE FOOTER ── */}
        <div style={{ margin: "2px 32px 0", borderTop: "2px solid #e2e8f0", padding: "8px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ ...pvLabel, margin: 0, fontSize: "0.9rem" }}>Balance Due</span>
          <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "#1e293b" }}>{cur} {fmt(inv.total)}</span>
        </div>

        {/* ── BOTTOM: Amount in Words + Notes + Terms | Account Details ── */}
        <div style={{ display: "flex", gap: 24, padding: "0 32px 20px", alignItems: "flex-start" }}>
          {/* LEFT */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Amount in words */}
            <div style={{ padding: "6px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, marginBottom: 10 }}>
              <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", fontWeight: 600 }}>
                Amount in Words
              </span>
              <div style={{ fontSize: "0.88rem", color: "#1e293b", fontWeight: 600, fontStyle: "italic", marginTop: 2 }}>
                {inv.amountInWords || numberToWords(inv.total, inv.currency)}
              </div>
            </div>

            {/* Notes */}
            {inv.notes && (
              <div style={{ marginBottom: 8 }}>
                <span style={pvLabel}>Notes</span>
                <div style={{ fontSize: "0.85rem", color: "#64748b", whiteSpace: "pre-wrap" }}>{inv.notes}</div>
              </div>
            )}

            {/* Terms */}
            {inv.terms && (
              <div>
                <span style={pvLabel}>Terms &amp; Conditions</span>
                <div style={{ fontSize: "0.85rem", color: "#64748b", whiteSpace: "pre-wrap" }}>{inv.terms}</div>
              </div>
            )}
          </div>

          {/* RIGHT — Account Details */}
          <div style={{ flex: "0 0 260px", minWidth: 230 }}>
            <span style={pvLabel}>Account Details</span>
            <div style={{ fontSize: "0.85rem", color: "#475569", lineHeight: 1.7 }}>
              <div><span style={{ fontWeight: "bold" }}>Bank Name:</span> {inv.accountDetails?.bankName || "Everest Bank Limited"}</div>
              <div><span style={{ fontWeight: "bold" }}>Account No:</span> {inv.accountDetails?.accountNo || "94EBLN02600105200710ASPIR"}</div>
              <div><span style={{ fontWeight: "bold" }}>Account Name:</span> {inv.accountDetails?.accountName || "Aspiration Asia Trekking"}</div>
              <div><span style={{ fontWeight: "bold" }}>IFSC:</span> {inv.accountDetails?.ifsc || "HDFC0000240"}</div>
              <div><span style={{ fontWeight: "bold" }}>Branch:</span> {inv.accountDetails?.branch || "Sandoz Bazar"}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const printRef = useRef();
  const { user } = useAuth();

  const [inv,     setInv]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [advanceModal, setAdvanceModal] = useState(false);

  const qc = useQueryClient();
  const { data: invData, isLoading: invLoading, error: invError } = useInvoice(id);

  useEffect(() => { if (invData) setInv(invData); }, [invData]);
  useEffect(() => { setLoading(invLoading); }, [invLoading]);
  useEffect(() => { if (invError) notifyError(invError); }, [invError]);

  const loadInvoice = () => qc.invalidateQueries({ queryKey: ["invoice", id] });
  // Same print mechanic as original
  const handlePrint = () => {
    const printContents = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Invoice — ${inv?.invoiceNumber}</title>
      <style>
        @page { size: A4; margin: 10mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; color: #1e293b; }
        .no-print { display: none !important; }
      </style>
    </head><body>${printContents}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  if (loading) return <PageLoader />;
  if (!inv) return <div className="text-center py-20 text-slate-400">Invoice not found</div>;

  const cur = inv.currency || "Rs.";
  const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const paymentSummary = inv.paymentSummary || {};
  const paymentStatus = paymentSummary.status || "unpaid";
  const isAdmin = user?.role === "admin";
  const canAddAdvance = isAdmin || user?.role === "accountant";

  return (
    <div>
      {/* Toolbar */}
      <div className="page-header no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/invoices")} className="btn-ghost p-2">
            <i className="fa fa-arrow-left" />
          </button>
          <div>
            <h1 className="page-title">{inv.title || "Invoice"}</h1>
            <p className="page-subtitle font-mono text-brand-600">{inv.invoiceNumber || ""}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className={`${paymentStatusClass[paymentStatus] || "badge-gray"} self-center`}>
            {paymentStatusLabel[paymentStatus] || "Unknown"}
          </span>
          {(inv.advancePayments?.length || 0) > 0 ? (
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
              <i className="fa fa-check-circle" /> Advance Payment Recorded
            </span>
          ) : canAddAdvance ? (
            <button onClick={() => setAdvanceModal(true)} className="btn-secondary">
              <i className="fa fa-money-bill-wave" /> Add Advance Payment
            </button>
          ) : null}
          {isAdmin && <button onClick={() => setEditing(true)} className="btn-secondary">
            <i className="fa fa-edit" /> Edit Invoice
          </button>}
          <button onClick={handlePrint} className="btn-primary">
            <i className="fa fa-print" /> Print / PDF
          </button>
        </div>
      </div>

      {/* Screen preview — mirrors the exact print layout */}
      <div className="no-print max-w-3xl mx-auto">

        {/* Header */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 items-start">
                <img src="https://i.ibb.co/bRJr7nNM/images.png" className="w-16 h-16 object-contain" alt="logo" onError={(e) => (e.target.style.display = "none")} />
                <div>
                  <p className="font-bold text-slate-800">Aspiration Asia Trekking &amp; Expedition Pvt Ltd</p>
                  <p className="text-xs text-slate-500">Near Nyatapol Temple Bhaktapur, Nepal</p>
                  <p className="text-xs text-slate-500">+977 9746239349 <span className="text-slate-800">|</span> <span className="text-brand-600">account@aspirationasia.com</span></p>
                  <p className="text-xs text-slate-500"><span className="font-bold text-slate-800">PAN:</span> 610278626</p>
                  <p className="text-xs text-slate-500"><span className="font-bold text-slate-800">Registration No:</span> 290216/78/079</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-slate-800">{inv.title || "Invoice"}</p>
                <p className="font-mono text-brand-600 font-semibold">{inv.invoiceNumber || ""}</p>
                <p className="text-sm text-slate-500">{inv.invoiceDate}</p>
                {paymentSummary.overdueDays > 0 && <p className="text-xs text-red-500">{paymentSummary.overdueDays} days overdue</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="card mb-4">
          <div className="card-body">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Bill To</p>
            <p className="font-bold text-slate-800">{inv.billTo?.name}</p>
            {inv.clientName && <p className="text-sm text-slate-500"><span className="font-medium">Client:</span> {inv.clientName}</p>}
            <p className="text-sm text-brand-600">{inv.billTo?.email}</p>
            <p className="text-sm text-slate-500">{inv.billTo?.address}</p>
            <p className="text-sm text-slate-500">{inv.billTo?.mobile}</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="card mb-4">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="text-center">Rate</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(inv.lineItems || []).map((l, i) => (
                  <tr key={i}>
                    <td>
                      <p className="font-medium text-slate-800">{l.description}</p>
                      {l.details && <p className="text-xs text-slate-400">{l.details}</p>}
                    </td>
                    <td className="text-center">{cur} {fmt(l.rate)}</td>
                    <td className="text-center">{l.qty}</td>
                    <td className="text-right font-semibold">{cur} {fmt(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="card-body flex justify-end">
            <div className="w-64 space-y-1">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>{cur} {fmt(inv.subtotal)}</span>
              </div>
              {inv.discount > 0 && (
                <div className="flex justify-between text-sm text-red-500">
                  <span>Discount</span>
                  <span>- {cur} {fmt(inv.discount)}</span>
                </div>
              )}
              {inv.taxApplicable && (
                <>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>VAT / GST {inv.taxPercent ? `(${inv.taxPercent}%)` : ""}</span>
                    <span>+ {cur} {fmt(inv.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-slate-700 pt-1 border-t border-slate-200">
                    <span>Total incl. VAT/GST</span>
                    <span>{cur} {fmt(inv.totalWithTax)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-brand-700 text-lg pt-1 border-t-2 border-slate-200">
                <span>Total Due</span>
                <span>{cur} {fmt(inv.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Record Payments */}
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
              <i className="fa fa-receipt text-brand-500" /> Sales Record Payment Entries
            </h3>
          </div>
          {(inv.salesRecordPaymentEntries || []).length === 0 ? (
            <div className="card-body text-center text-sm text-slate-400 py-6">
              No sales record payment entries found.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th className="text-right">Amount</th>
                    <th>Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {(inv.salesRecordPaymentEntries || []).map((p) => (
                    <tr key={p._id || `${p.referenceCode}-${p.date}-${p.amount}`}>
                      <td className="text-sm text-slate-600">{p.date || "—"}</td>
                      <td className="text-xs font-mono text-slate-600">{p.referenceCode || "—"}</td>
                      <td className="text-right font-semibold text-green-700">{cur} {fmt(p.amount)}</td>
                      <td>
                        {p.slip?.url ? (
                          <a href={resolveUploadUrl(p.slip.url)} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline inline-flex items-center gap-1">
                            <i className={`fa ${/^application\/pdf/.test(p.slip.mimeType) ? "fa-file-pdf text-red-500" : "fa-file-image text-blue-600"}`} />
                            {p.slip.fileName || "View"}
                          </a>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                  {(() => {
                    const salesPaid = (inv.salesRecordPaymentEntries || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                    const salesBalance = Math.max(0, (Number(inv.total) || 0) - salesPaid);
                    return (
                      <tr className="bg-slate-50 font-semibold">
                        <td colSpan={2} className="text-right text-slate-700">Total</td>
                        <td className="text-right text-green-700">{cur} {fmt(salesPaid)}</td>
                        <td className={`text-right ${salesBalance > 0 ? "text-red-600" : "text-green-700"}`}>
                          <span className="text-slate-500 text-xs mr-2">Balance Due</span>
                          {cur} {fmt(salesBalance)}
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom: Amount in words + Notes/Terms | Account Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="card">
            <div className="card-body space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Amount in Words</p>
                <p className="text-sm font-semibold text-slate-800 italic">{inv.amountInWords || numberToWords(inv.total, inv.currency)}</p>
              </div>
              {inv.notes && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Notes</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{inv.notes}</p>
                </div>
              )}
              {inv.terms && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Terms &amp; Conditions</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{inv.terms}</p>
                </div>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Account Details</p>
              <div className="text-sm text-slate-600 space-y-1">
                <p><span className="font-semibold">Bank:</span> {inv.accountDetails?.bankName || "Everest Bank Limited"}</p>
                <p><span className="font-semibold">Account No:</span> {inv.accountDetails?.accountNo || "94EBLN02600105200710ASPIR"}</p>
                <p><span className="font-semibold">Account Name:</span> {inv.accountDetails?.accountName || "Aspiration Asia Trekking"}</p>
                <p><span className="font-semibold">IFSC:</span> {inv.accountDetails?.ifsc || "HDFC0000240"}</p>
                <p><span className="font-semibold">Branch:</span> {inv.accountDetails?.branch || "Sandoz Bazar"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden print template */}
      <div style={{ position: "absolute", left: -9999, top: 0, visibility: "hidden" }}>
        <div ref={printRef}>
          <InvoicePrint inv={inv} />
        </div>
      </div>

      <div className="no-print max-w-3xl mx-auto mt-4">
        <AuditTrailPanel entity="invoice" entityId={inv._id} />
      </div>

      {editing && (
        <InvoiceModal
          invoice={inv}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            if (updated) {
              setInv(updated);
              qc.setQueryData(["invoice", id], updated);
            }
            setEditing(false);
            loadInvoice();
            qc.invalidateQueries({ queryKey: ["invoices"] });
            qc.invalidateQueries({ queryKey: ["sales-records"] });
          }}
        />
      )}

      {advanceModal && (
        <AddAdvanceModal
          invoice={inv}
          onClose={() => setAdvanceModal(false)}
          onSaved={(updated) => {
            if (updated) {
              setInv(updated);
              qc.setQueryData(["invoice", id], updated);
            }
            setAdvanceModal(false);
            loadInvoice();
            qc.invalidateQueries({ queryKey: ["invoices"] });
            qc.invalidateQueries({ queryKey: ["sales-records"] });
            qc.invalidateQueries({ queryKey: ["sales-record"] });
            qc.invalidateQueries({ queryKey: ["customer-payments"] });
            qc.invalidateQueries({ queryKey: ["reports", "ar-aging"] });
            qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
          }}
        />
      )}
    </div>
  );
}
