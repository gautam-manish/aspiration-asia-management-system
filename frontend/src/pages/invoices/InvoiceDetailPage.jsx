import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoiceAPI } from "../../api";
import { getError, numberToWords } from "../../utils/helpers";
import { PageLoader } from "../../components/common";
import { InvoiceModal } from "./InvoicesPage";
import toast from "react-hot-toast";

// ─── Exact original invoice preview template ─────────────────────────────────
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
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 3, lineHeight: 1.2 }}>
                {inv.from?.name || "Aspiration Asia Trekking & Expedition Pvt Ltd"}
              </div>
              <div style={{ fontSize: "0.88rem", color: "#475569", lineHeight: 1.6 }}>
                {inv.from?.address1 && <div>{inv.from.address1}</div>}
                {inv.from?.address2 && <div>{inv.from.address2}</div>}
                {inv.from?.phone   && <div>{inv.from.phone}</div>}
                {inv.from?.email   && <div style={{ color: "#2563eb" }}>{inv.from.email}</div>}
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
            {inv.advance > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ fontWeight: 600, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.75rem" }}>Booking Amount</span>
                <span style={{ color: "#16a34a", fontWeight: 500, fontSize: "0.9rem" }}>{cur} {fmt(inv.advance)}</span>
              </div>
            )}
            {inv.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ fontWeight: 600, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.8rem" }}>Discount</span>
                <span style={{ color: "#ef4444", fontWeight: 500, fontSize: "0.9rem" }}>- {cur} {fmt(inv.discount)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ fontWeight: 600, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.8rem" }}>Subtotal</span>
              <span style={{ color: "#1e293b", fontWeight: 500, fontSize: "0.9rem" }}>{cur} {fmt(inv.subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "0.95rem" }}>
              <span style={{ fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</span>
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

  const [inv,     setInv]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const loadInvoice = () =>
    invoiceAPI.getById(id)
      .then(({ data }) => setInv(data.data))
      .catch((err) => toast.error(getError(err)))
      .finally(() => setLoading(false));

  useEffect(() => { loadInvoice(); }, [id]);

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
          <button onClick={() => setEditing(true)} className="btn-secondary">
            <i className="fa fa-edit" /> Edit Invoice
          </button>
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
                  <p className="font-bold text-slate-800">{inv.from?.name || "Aspiration Asia Trekking & Expedition Pvt Ltd"}</p>
                  <p className="text-xs text-slate-500">{inv.from?.address1} {inv.from?.address2}</p>
                  <p className="text-xs text-slate-500">{inv.from?.phone}</p>
                  <p className="text-xs text-brand-600">{inv.from?.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-slate-800">{inv.title || "Invoice"}</p>
                <p className="font-mono text-brand-600 font-semibold">{inv.invoiceNumber || ""}</p>
                <p className="text-sm text-slate-500">{inv.invoiceDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="card mb-4">
          <div className="card-body">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Bill To</p>
            <p className="font-bold text-slate-800">{inv.billTo?.name}</p>
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
              {inv.advance > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Booking Amount</span>
                  <span>{cur} {fmt(inv.advance)}</span>
                </div>
              )}
              {inv.discount > 0 && (
                <div className="flex justify-between text-sm text-red-500">
                  <span>Discount</span>
                  <span>- {cur} {fmt(inv.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>{cur} {fmt(inv.subtotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 text-base pt-1 border-t border-slate-200">
                <span>Total</span>
                <span>{cur} {fmt(inv.total)}</span>
              </div>
              <div className="flex justify-between font-bold text-brand-700 text-lg pt-1 border-t-2 border-slate-200">
                <span>Balance Due</span>
                <span>{cur} {fmt(inv.total)}</span>
              </div>
            </div>
          </div>
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

      {editing && (
        <InvoiceModal
          invoice={inv}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setLoading(true); loadInvoice(); }}
        />
      )}
    </div>
  );
}
