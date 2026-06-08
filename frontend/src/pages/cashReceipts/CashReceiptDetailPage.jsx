import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cashReceiptAPI } from "../../api";
import { notifyError } from "../../utils/helpers";
import { PageLoader } from "../../components/common";
import { useCashReceipt } from "../../hooks/useApiQueries";
import toast from "react-hot-toast";

// ─── Exact original receipt HTML template ────────────────────────────────────
export function ReceiptPrint({ r }) {
  const date = r.date
    ? new Date(r.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const amt = Number(r.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <div>
      {/* receipt-wrap */}
      <div style={{ maxWidth: 680, margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
        {/* receipt-box */}
        <div style={{ border: "2px solid #1e293b", borderRadius: 5, padding: "24px 28px" }}>

          {/* receipt-header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #e2e8f0" }}>
            <img
              src="https://i.ibb.co/bRJr7nNM/images.png"
              style={{ width: 80, height: 80, objectFit: "contain", flexShrink: 0 }}
              alt="logo"
            />
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
                Aspiration Asia Trekking and Expedition Pvt Ltd.
              </div>
              <div style={{ fontSize: "0.78rem", color: "#475569", lineHeight: 1.6 }}>
                Bhaktapur Durbar Square, Kathmandu, Nepal<br />
                Tel: +977-982761738 / +977-9851021924<br />
                Email: sales@aspirationasia.com<br />
                Web: www.aspirationasia.com
              </div>
            </div>
          </div>

          {/* receipt-meta: R.No | CASH RECEIPT | Date */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: "0.88rem", color: "#1e293b" }}>
              R.No.: <span style={{ fontWeight: 700, color: "#dc2626", fontSize: "1rem" }}>{r.registrationNumber || "—"}</span>
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", textDecoration: "underline", letterSpacing: "0.05em" }}>
              CASH RECEIPT
            </div>
            <div style={{ fontSize: "0.88rem", color: "#1e293b" }}>
              Date: <span style={{ fontWeight: 600 }}>{date}</span>
            </div>
          </div>

          {/* receipt-body */}
          <div style={{ fontSize: "0.9rem", color: "#1e293b", lineHeight: 2, marginBottom: 20 }}>
            Received with thanks from{" "}
            <span style={{ borderBottom: "1px dotted #475569", display: "inline", padding: "0 4px" }}>&nbsp;{r.name}&nbsp;</span>
            {" "}a sum of in words{" "}
            <span style={{ borderBottom: "1px dotted #475569", display: "inline", padding: "0 4px" }}>&nbsp;{r.amountInWords || ""}&nbsp;</span>
            <br />
            Cash/Cheque No.:{" "}
            <span style={{ borderBottom: "1px dotted #475569", display: "inline", padding: "0 4px" }}>&nbsp;{r.cashChequeNo || ""}&nbsp;</span>
            &nbsp;&nbsp; Bank{" "}
            <span style={{ borderBottom: "1px dotted #475569", display: "inline", padding: "0 4px" }}>&nbsp;{r.bank || ""}&nbsp;</span>
            {" "}as Payment Against For{" "}
            <span style={{ borderBottom: "1px dotted #475569", display: "inline", padding: "0 4px" }}>&nbsp;{r.paymentType || ""}&nbsp;</span>
          </div>

          {/* receipt-footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 20, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
            {/* dark pill amount — exact original */}
            <div style={{
              background: "#1e293b",
              color: "white",
              borderRadius: 20,
              padding: "8px 20px",
              fontSize: "1rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}>
              Rs. {amt}/-
            </div>
          </div>

        </div>

        {/* computer generated message */}
        <div style={{ textAlign: "center", fontSize: "0.75rem", color: "#64748b", marginTop: 12, fontStyle: "italic" }}>
          This is computer generated voucher and doesn't need signature.
        </div>
      </div>
    </div>
  );
}

export default function CashReceiptDetailPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const printRef  = useRef();

  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);

  const { data: receiptData, isLoading: receiptLoading, error: receiptError } = useCashReceipt(id);

  useEffect(() => { if (receiptData) setReceipt(receiptData); }, [receiptData]);
  useEffect(() => { setLoading(receiptLoading); }, [receiptLoading]);
  useEffect(() => { if (receiptError) notifyError(receiptError); }, [receiptError]);

  // Same print mechanic as original — new window + window.print()
  const handlePrint = () => {
    const printContents = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=800,height=600");
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Receipt — ${receipt?.registrationNumber}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
      </style>
    </head><body>${printContents}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  if (loading) return <PageLoader />;
  if (!receipt) return <div className="text-center py-20 text-slate-400">Receipt not found</div>;

  const date = receipt.date
    ? new Date(receipt.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : new Date(receipt.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div>
      {/* Toolbar */}
      <div className="page-header no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/cash-receipts")} className="btn-ghost p-2">
            <i className="fa fa-arrow-left" />
          </button>
          <div>
            <h1 className="page-title">Cash Receipt</h1>
            <p className="page-subtitle">Reg. No. {receipt.registrationNumber}</p>
          </div>
        </div>
        <button onClick={handlePrint} className="btn-primary">
          <i className="fa fa-print" /> Print / PDF
        </button>
      </div>

      {/* Screen preview card */}
      <div className="card no-print max-w-2xl mx-auto">
        <div className="card-body">
          {/* Company header on screen */}
          <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100">
            <img src="https://i.ibb.co/bRJr7nNM/images.png" className="w-16 h-16 object-contain" alt="logo" onError={(e) => (e.target.style.display = "none")} />
            <div>
              <p className="font-bold text-slate-800">Aspiration Asia Trekking and Expedition Pvt Ltd.</p>
              <p className="text-xs text-slate-500">Bhaktapur Durbar Square, Kathmandu, Nepal</p>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-slate-600">R.No.: <span className="font-bold text-red-600 text-base">{receipt.registrationNumber || "—"}</span></p>
            <p className="font-bold text-slate-800 underline tracking-wide text-sm">CASH RECEIPT</p>
            <p className="text-sm text-slate-600">Date: <span className="font-semibold">{date}</span></p>
          </div>

          {/* Body */}
          <div className="space-y-2 text-sm text-slate-700 leading-relaxed mb-5">
            <p>Received with thanks from <span className="border-b border-dotted border-slate-500 px-1 font-medium">{receipt.name}</span></p>
            <p>A sum of in words <span className="border-b border-dotted border-slate-500 px-1 italic">{receipt.amountInWords || "—"}</span></p>
            <p>
              Cash/Cheque No.: <span className="border-b border-dotted border-slate-500 px-1">{receipt.cashChequeNo || "—"}</span>
              &nbsp;&nbsp; Bank: <span className="border-b border-dotted border-slate-500 px-1">{receipt.bank || "—"}</span>
            </p>
            <p>Payment Against For: <span className="border-b border-dotted border-slate-500 px-1">{receipt.paymentType || "—"}</span></p>
          </div>

          {/* Amount pill */}
          <div className="flex justify-start">
            <div className="bg-slate-800 text-white rounded-full px-6 py-2 font-bold text-base">
              Rs. {Number(receipt.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}/-
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 italic mt-4">
            This is computer generated voucher and doesn't need signature.
          </p>
        </div>
      </div>

      {/* Hidden print template */}
      <div style={{ position: "absolute", left: -9999, top: 0, visibility: "hidden" }}>
        <div ref={printRef}>
          <ReceiptPrint r={receipt} />
        </div>
      </div>
    </div>
  );
}
