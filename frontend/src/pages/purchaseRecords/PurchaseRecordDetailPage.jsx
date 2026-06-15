import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { bookingAPI, purchaseRecordAPI, resolveUploadUrl } from "../../api";
import { formatDate, notifyError } from "../../utils/helpers";
import { PageLoader, Field } from "../../components/common";
import { usePurchaseRecord, useBankAccounts } from "../../hooks/useApiQueries";
import { AddModal } from "./PurchaseRecordsPage";
import toast from "react-hot-toast";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const ATTACHMENT_ACCEPT = ".pdf,.jpg,.jpeg,application/pdf,image/jpeg";

const fmtSize = (bytes = 0) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

function AttachmentField({ label, attachment, onChange }) {
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error("File is too large. Please upload under 1 MB");
      return;
    }
    setBusy(true);
    try {
      const { data } = await purchaseRecordAPI.uploadAttachment(file);
      onChange(data?.data || null);
      toast.success("Attachment uploaded");
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  };

  if (attachment?.url) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2 min-w-0">
        <i className={`fa ${/^application\/pdf/.test(attachment.mimeType) ? "fa-file-pdf text-red-500" : "fa-file-image text-blue-600"}`} />
        <a href={resolveUploadUrl(attachment.url)} target="_blank" rel="noreferrer" className="font-medium text-brand-700 truncate hover:underline" title={attachment.fileName}>
          {attachment.fileName || label}
        </a>
        <span className="text-slate-400 ml-auto whitespace-nowrap text-xs">{fmtSize(attachment.size)}</span>
        <button type="button" onClick={() => onChange(null)} disabled={busy} className="btn-ghost text-red-400 hover:text-red-600 p-1" title="Remove attachment">
          <i className="fa fa-times" />
        </button>
      </div>
    );
  }

  return (
    <label className="rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-3 text-sm text-slate-500 cursor-pointer flex items-center justify-center gap-2">
      <i className={`fa ${busy ? "fa-spinner fa-spin" : "fa-paperclip"}`} />
      <span>{busy ? "Uploading..." : `Attach ${label} (PDF / JPG, max 1 MB)`}</span>
      <input type="file" className="hidden" accept={ATTACHMENT_ACCEPT} disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
    </label>
  );
}

export default function PurchaseRecordDetailPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const printRef  = useRef();

  const [record,     setRecord]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [addModal,   setAddModal]   = useState(false);
  const [entryModal, setEntryModal] = useState(null);
  const [pdfModal,   setPdfModal]   = useState(false);
  const [pdfFrom,    setPdfFrom]    = useState("");
  const [pdfTo,      setPdfTo]      = useState("");
  const [pdfFiscal,  setPdfFiscal]  = useState("");
  const [txn,        setTxn]        = useState({ date: "", refNo: "", bookingId: "", clientName: "", description: "", amount: "", bank: "", type: "cr", attachment: null });
  const [saving,     setSaving]     = useState(false);
  const [bookingLookup, setBookingLookup] = useState(false);

  const qc = useQueryClient();
  const { data: recordData, isLoading: recordLoading, error: recordError } = usePurchaseRecord(id);
  const { data: bankList = [] } = useBankAccounts();

  useEffect(() => { if (recordData) setRecord(recordData); }, [recordData]);
  useEffect(() => { setLoading(recordLoading); }, [recordLoading]);
  useEffect(() => { if (recordError) notifyError(recordError); }, [recordError]);

  const loadRecord = () => qc.invalidateQueries({ queryKey: ["purchase-record", id] });

  const setT = (k, v) => setTxn((t) => ({ ...t, [k]: v }));
  const selectedBank = bankList.find((b) => b.bankName === txn.bank);

  const fetchBooking = async () => {
    const bookingId = (txn.bookingId || "").trim();
    if (!bookingId) { toast.error("Booking ID required"); return; }
    setBookingLookup(true);
    try {
      const { data } = await bookingAPI.getByQueryId(bookingId);
      const booking = data?.data || {};
      setTxn((t) => ({
        ...t,
        bookingId: booking.queryId || bookingId,
        clientName: t.clientName || booking.clientName || "",
      }));
      toast.success(`Booking ${booking.queryId || bookingId} loaded`);
    } catch (err) {
      notifyError(err);
    } finally {
      setBookingLookup(false);
    }
  };

  const handleAddTxn = async (e) => {
    e.preventDefault();
    if (!txn.bookingId.trim()) { toast.error("Booking ID required"); return; }
    if (!txn.date)   { toast.error("Date required"); return; }
    if (!txn.amount || Number(txn.amount) <= 0) { toast.error("Amount must be > 0"); return; }
    if (txn.type === "dr" && !txn.bank) { toast.error("Select a bank account for debit entry"); return; }
    if (txn.type === "dr" && selectedBank && Number(txn.amount) > Number(selectedBank.balance || 0)) {
      toast.error(`Amount exceeds selected bank balance (Rs. ${fmt(selectedBank.balance)})`);
      return;
    }
    setSaving(true);
    try {
      const { data } = await purchaseRecordAPI.addTransaction(id, { transaction: { ...txn, bank: txn.type === "dr" ? txn.bank : "", amount: Number(txn.amount) } });
      if (data?.data) {
        setRecord(data.data);
        qc.setQueryData(["purchase-record", id], data.data);
      }
      toast.success("Transaction added ✓");
      setAddModal(false);
      setTxn({ date: "", refNo: "", bookingId: "", clientName: "", description: "", amount: "", bank: "", type: "cr", attachment: null });
      loadRecord();
      qc.invalidateQueries({ queryKey: ["purchase-records"] });
      qc.invalidateQueries({ queryKey: ["customer-payments"] });
      qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
      qc.invalidateQueries({ queryKey: ["reports", "vendor-ledger"] });
      qc.invalidateQueries({ queryKey: ["reports", "booking-profitability"] });
      qc.invalidateQueries({ queryKey: ["reports", "profit-loss"] });
      qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      qc.invalidateQueries({ queryKey: ["bank-account"] });
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePDF = () => {
    if (!record) return;
    let txns = [...(record.transactions || [])].sort((a, b) => a.date.localeCompare(b.date));
    if (pdfFrom) txns = txns.filter((t) => t.date >= pdfFrom);
    if (pdfTo)   txns = txns.filter((t) => t.date <= pdfTo);

    let runBal = Number(record.openingBalance || 0);
    const totalDR = txns.reduce((s, t) => s + (t.type === "dr" ? Number(t.amount) || 0 : 0), 0);
    const totalCR = txns.reduce((s, t) => s + (t.type === "cr" ? Number(t.amount) || 0 : 0), 0);

    // Description cell — shows description / clientName / bank stacked vertically.
    const descCell = (t) => {
      const lines = [];
      if (t.bookingId) lines.push(`<div style="font-size:11px;color:#2563eb;font-family:monospace;">Booking: ${t.bookingId}</div>`);
      lines.push(t.description ? `<div>${t.description}</div>` : `<div>—</div>`);
      if (t.clientName) lines.push(`<div style="font-size:11px;color:#475569;">${t.clientName}</div>`);
      if (t.bank)       lines.push(`<div style="font-size:11px;color:#475569;">${t.bank}</div>`);
      return lines.join("");
    };

    const rows = txns.map((t) => {
      const dr = t.type === "dr" ? Number(t.amount) || 0 : 0;
      const cr = t.type === "cr" ? Number(t.amount) || 0 : 0;
      runBal = runBal + dr - cr;
      const isDR = runBal >= 0;
      return `<tr>
        <td style="padding:14px 12px;border:1px solid #94a3b8;font-size:12px;vertical-align:top;">${t.date || "—"}</td>
        <td style="padding:14px 12px;border:1px solid #94a3b8;font-size:12px;vertical-align:top;">${t.refNo || "—"}</td>
        <td style="padding:14px 12px;border:1px solid #94a3b8;font-size:12px;vertical-align:top;line-height:1.5;">${descCell(t)}</td>
        <td style="padding:14px 12px;border:1px solid #94a3b8;font-size:12px;text-align:right;font-weight:700;vertical-align:top;">${dr > 0 ? "Rs " + fmt(dr) : "—"}</td>
        <td style="padding:14px 12px;border:1px solid #94a3b8;font-size:12px;text-align:right;font-weight:700;vertical-align:top;">${cr > 0 ? "Rs " + fmt(cr) : "—"}</td>
        <td style="padding:14px 12px;border:1px solid #94a3b8;font-size:12px;text-align:right;font-weight:700;vertical-align:top;">Rs ${fmt(Math.abs(runBal))} ${isDR ? "DR" : "CR"}</td>
      </tr>`;
    }).join("");

    const closing = Number(record.closingBalance || 0);
    const closingLabel = closing >= 0 ? "DR" : "CR";

    const win = window.open("", "_blank", "width=900,height=1100");
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Purchase Ledger — ${record.debtorName}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; }
        table { border-collapse: collapse; }
        .label { font-size: 11px; color: #0f172a; }
        .val   { font-size: 11px; color: #0f172a; font-weight: 700; }
      </style>
    </head><body>

      <!-- ═══════ HEADER ═══════ -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <img src="https://i.ibb.co/bRJr7nNM/images.png" style="height:75px;" alt="logo" />
        <div style="text-align:right;font-size:11px;line-height:1.55;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;">Aspiration Asia Trekking and Expedition Pvt Ltd.</div>
          <div>Bhaktapur Durbar Square - Kathmandu, Nepal</div>
          <div>Web: www.aspirationasia.com</div>
          <div>Email: sales@aspirationasia.com / reservations@aspirationasia.com</div>
          <div>Contact: +977-982761738 / +977-9851021924</div>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid #94a3b8;margin:8px 0 14px;" />

      <!-- ═══════ TOP SUMMARY ═══════ -->
      <div style="display:flex;gap:0;margin-bottom:18px;align-items:flex-start;">

        <!-- Left: Ledger / Creditor/Vendor info -->
        <div style="flex:1;padding-right:14px;font-size:11px;line-height:1.85;">
          <div style="font-weight:700;color:#0f172a;">LEDGER BALANCE REPORT : SUNDRY CREDITORS / VENDORS</div>
          <div><strong>FISCAL YEAR :</strong> ${pdfFiscal || record.fiscalYear || "—"}</div>
          <div><strong>NAME :</strong> ${(record.debtorName || "").toUpperCase()}</div>
          <div><strong>PAN :</strong> ${record.debtorPan || "—"}</div>
          <div><strong>PHONE :</strong> ${record.debtorPhone || ""}</div>
          <div><strong>ADDRESS :</strong> ${record.debtorAddress || "—"}</div>
        </div>

        <!-- Right: Balance summary table -->
        <table style="flex:0 0 55%;border-collapse:collapse;font-size:11px;">
          <tr>
            <td style="padding:8px 10px;border:1px solid #94a3b8;font-weight:700;width:25%;">Opening</td>
            <td style="padding:8px 10px;border:1px solid #94a3b8;text-align:right;font-weight:700;width:55%;">Rs ${fmt(record.openingBalance)}</td>
            <td style="padding:8px 10px;border:1px solid #94a3b8;font-weight:700;width:20%;text-align:center;">${(Number(record.openingBalance) || 0) >= 0 ? "DR" : "CR"}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #94a3b8;font-weight:700;">Debit</td>
            <td style="padding:8px 10px;border:1px solid #94a3b8;text-align:right;font-weight:700;">Rs ${fmt(record.totalDebit)}</td>
            <td style="padding:8px 10px;border:1px solid #94a3b8;"></td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #94a3b8;font-weight:700;">Credit</td>
            <td style="padding:8px 10px;border:1px solid #94a3b8;text-align:right;font-weight:700;">Rs ${fmt(record.totalCredit)}</td>
            <td style="padding:8px 10px;border:1px solid #94a3b8;"></td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #94a3b8;font-weight:700;">Closing</td>
            <td style="padding:8px 10px;border:1px solid #94a3b8;text-align:right;font-weight:700;">Rs ${fmt(Math.abs(closing))}</td>
            <td style="padding:8px 10px;border:1px solid #94a3b8;font-weight:700;text-align:center;">${closingLabel}</td>
          </tr>
        </table>
      </div>

      <!-- ═══════ TRANSACTION TABLE ═══════ -->
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:8px 8px;border:1px solid #94a3b8;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:0.04em;">Date</th>
            <th style="padding:8px 8px;border:1px solid #94a3b8;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:0.04em;">Ref / Voucher</th>
            <th style="padding:8px 8px;border:1px solid #94a3b8;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:0.04em;">Description</th>
            <th style="padding:8px 8px;border:1px solid #94a3b8;font-size:10px;text-align:right;text-transform:uppercase;letter-spacing:0.04em;">Debit</th>
            <th style="padding:8px 8px;border:1px solid #94a3b8;font-size:10px;text-align:right;text-transform:uppercase;letter-spacing:0.04em;">Credit</th>
            <th style="padding:8px 8px;border:1px solid #94a3b8;font-size:10px;text-align:right;text-transform:uppercase;letter-spacing:0.04em;">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:10px 8px;border:1px solid #94a3b8;font-size:11px;">—</td>
            <td style="padding:10px 8px;border:1px solid #94a3b8;font-size:11px;">—</td>
            <td style="padding:10px 8px;border:1px solid #94a3b8;font-size:11px;font-weight:700;">Opening Balance</td>
            <td style="padding:10px 8px;border:1px solid #94a3b8;font-size:11px;text-align:right;">Rs ${fmt(record.openingBalance)}</td>
            <td style="padding:10px 8px;border:1px solid #94a3b8;font-size:11px;text-align:right;">—</td>
            <td style="padding:10px 8px;border:1px solid #94a3b8;font-size:11px;text-align:right;font-weight:700;">Rs ${fmt(Math.abs(Number(record.openingBalance) || 0))} ${(Number(record.openingBalance) || 0) >= 0 ? "DR" : "CR"}</td>
          </tr>
          ${rows}
          <tr>
            <td colspan="3" style="padding:10px 8px;border:1px solid #94a3b8;font-size:11px;font-weight:700;">TOTAL (—)</td>
            <td style="padding:10px 8px;border:1px solid #94a3b8;font-size:11px;text-align:right;font-weight:700;">Rs ${fmt(totalDR)}</td>
            <td style="padding:10px 8px;border:1px solid #94a3b8;font-size:11px;text-align:right;font-weight:700;">Rs ${fmt(totalCR)}</td>
            <td style="padding:10px 8px;border:1px solid #94a3b8;font-size:11px;text-align:right;font-weight:700;">Rs ${fmt(Math.abs(closing))} ${closingLabel}</td>
          </tr>
        </tbody>
      </table>

      <hr style="border:none;border-top:1px solid #94a3b8;margin:18px 0 10px;" />

      <!-- ═══════ FOOTER ═══════ -->
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#475569;">
        <div>Generated on: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</div>
        <div>Aspiration Asia Trekking and Expedition Pvt Ltd.</div>
      </div>

    </body></html>`);
    win.document.close();
    win.focus();
    setPdfModal(false);
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  if (loading) return <PageLoader />;
  if (!record) return <div className="text-center py-20 text-slate-400">Record not found</div>;

  const sortedTxns = [...(record.transactions || [])].sort((a, b) => a.date.localeCompare(b.date));
  const purchaseEntries = sortedTxns.filter((t) => t.type === "cr");
  const paymentEntries = sortedTxns.filter((t) => t.type === "dr");
  const purchaseTotal = purchaseEntries.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const paymentTotal = paymentEntries.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const currentVendor = {
    _id: record.vendorId || "",
    contactPerson: record.debtorName || "",
    companyName: record.debtorCompany || "",
    panVatGst: record.debtorPan || "",
    address: record.debtorAddress || "",
    phone: record.debtorPhone || "",
    email: record.debtorEmail || "",
    openingBalance: record.openingBalance || 0,
    existingRecord: record,
  };
  const refreshFinanceViews = () => {
    loadRecord();
    qc.invalidateQueries({ queryKey: ["purchase-records"] });
    qc.invalidateQueries({ queryKey: ["reports", "vendor-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "booking-profitability"] });
    qc.invalidateQueries({ queryKey: ["reports", "profit-loss"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["bank-account"] });
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/purchase-records")} className="btn-ghost p-2"><i className="fa fa-arrow-left" /></button>
          <div>
            <h1 className="page-title">{record.debtorName}</h1>
            {record.debtorCompany && <p className="page-subtitle">{record.debtorCompany}</p>}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[["Purchase Entries", purchaseTotal, "text-red-600"],["Payment Entries", paymentTotal, "text-green-600"],["Outstanding", purchaseTotal - paymentTotal, purchaseTotal - paymentTotal >= 0 ? "text-red-600" : "text-green-600"],["Total Documents", sortedTxns.length, "text-slate-800"]].map(([lbl, val, cls]) => (
          <div key={lbl} className="card card-body !py-4">
            <p className="text-xs text-slate-500 mb-1">{lbl}</p>
            {lbl === "Total Documents"
              ? <p className={`text-xl font-bold ${cls}`}>{val}</p>
              : <p className={`text-xl font-bold ${cls}`}>Rs. {fmt(Math.abs(val))}</p>}
          </div>
        ))}
      </div>

      {/* Creditor / Vendor Info */}
      <div className="card mb-4">
        <div className="card-header"><h3 className="font-semibold text-slate-700">Creditor / Vendor Information</h3></div>
        <div className="card-body grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[["Name", record.debtorName],["Company", record.debtorCompany],["PAN/VAT", record.debtorPan],["Address", record.debtorAddress],["Phone", record.debtorPhone],["Email", record.debtorEmail],["Fiscal Year", record.fiscalYear]].map(([lbl, val]) => (
            <div key={lbl}><p className="text-xs text-slate-400 mb-0.5">{lbl}</p><p className="font-medium text-slate-800">{val || "—"}</p></div>
          ))}
        </div>
      </div>

      {/* Purchase Entries */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="font-semibold text-slate-700">Purchase Entries</h3>
          <div className="flex items-center gap-2">
            <span className="badge badge-blue">{purchaseEntries.length} entries</span>
            <button type="button" onClick={() => setEntryModal("purchase")} className="btn-secondary text-xs">
              <i className="fa fa-edit" /> Edit Purchase Entries
            </button>
          </div>
        </div>
        {purchaseEntries.length === 0 ? (
          <div className="card-body text-sm text-slate-400">No purchase entries recorded for this vendor.</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Tax Invoice</th><th>Booking</th><th>Purchase Details</th><th>Tax Invoice File</th><th className="text-right">Amount</th></tr>
              </thead>
              <tbody>
                {purchaseEntries.map((entry, idx) => (
                  <tr key={entry._id || idx}>
                    <td className="text-sm text-slate-600">{entry.date || "-"}</td>
                    <td className="font-mono text-xs text-slate-500">{entry.refNo || "-"}</td>
                    <td className="font-mono text-xs text-brand-600">{entry.bookingId || "-"}</td>
                    <td className="text-sm text-slate-700">
                      {(entry.lineItems || []).length > 0 ? (
                        <div className="space-y-1">
                          {(entry.lineItems || []).map((line, lineIdx) => (
                            <div key={lineIdx} className="text-xs">
                              <span className="font-medium text-slate-700">{line.description || line.serviceType || "Line item"}</span>
                              <span className="text-slate-400"> - {line.qty || 0} x Rs. {fmt(line.rate)} = Rs. {fmt(line.amount)}</span>
                            </div>
                          ))}
                          {Number(entry.taxAmount || 0) > 0 && <p className="text-xs text-slate-500">Tax: Rs. {fmt(entry.taxAmount)}</p>}
                        </div>
                      ) : (
                        entry.description || "-"
                      )}
                    </td>
                    <td>
                      {entry.attachment?.url ? (
                        <a href={resolveUploadUrl(entry.attachment.url)} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline inline-flex items-center gap-1">
                          <i className={`fa ${/^application\/pdf/.test(entry.attachment.mimeType) ? "fa-file-pdf text-red-500" : "fa-file-image text-blue-600"}`} />
                          {entry.attachment.fileName || "View invoice"}
                        </a>
                      ) : "-"}
                    </td>
                    <td className="text-right font-semibold text-red-600">Rs. {fmt(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Entries */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-700">Payment Entries</h3>
          <div className="flex items-center gap-2">
            <span className="badge badge-green">{paymentEntries.length} entries</span>
            <button type="button" onClick={() => setEntryModal("payment")} className="btn-secondary text-xs">
              <i className="fa fa-plus" /> Add Payment Entry
            </button>
          </div>
        </div>
        {paymentEntries.length === 0 ? (
          <div className="card-body text-sm text-slate-400">No payment entries recorded for this vendor.</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Reference</th><th>Booking</th><th>Description</th><th>Bank</th><th>Slip</th><th className="text-right">Amount</th></tr>
              </thead>
              <tbody>
                {paymentEntries.map((entry, idx) => (
                  <tr key={entry._id || idx}>
                    <td className="text-sm text-slate-600">{entry.date || "-"}</td>
                    <td className="font-mono text-xs text-slate-500">{entry.refNo || "-"}</td>
                    <td className="font-mono text-xs text-brand-600">{entry.bookingId || "-"}</td>
                    <td className="text-sm text-slate-700">{entry.description || "-"}</td>
                    <td className="text-sm text-slate-500">{entry.bank || "-"}</td>
                    <td>
                      {entry.attachment?.url ? (
                        <a href={resolveUploadUrl(entry.attachment.url)} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline inline-flex items-center gap-1">
                          <i className={`fa ${/^application\/pdf/.test(entry.attachment.mimeType) ? "fa-file-pdf text-red-500" : "fa-file-image text-blue-600"}`} />
                          {entry.attachment.fileName || "View slip"}
                        </a>
                      ) : "-"}
                    </td>
                    <td className="text-right font-semibold text-green-600">Rs. {fmt(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {entryModal && (
        <AddModal
          mode={entryModal}
          initialVendor={currentVendor}
          onClose={() => setEntryModal(null)}
          onSaved={() => {
            setEntryModal(null);
            refreshFinanceViews();
          }}
        />
      )}

      {false && <>
      {/* Ledger Transactions */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-700">Ledger Transactions</h3>
          <span className="badge badge-blue">{sortedTxns.length} entries</span>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Ref / Voucher</th><th>Booking</th><th>Description</th><th className="text-right">Debit (DR)</th><th className="text-right">Credit (CR)</th><th>Attachment</th><th className="text-right">Balance</th></tr>
            </thead>
            <tbody>
              <tr className="bg-slate-50">
                <td colSpan={7} className="font-semibold text-slate-500 text-xs">Opening Balance</td>
                <td className="text-right font-bold text-sm">Rs. {fmt(record.openingBalance)} DR</td>
              </tr>
              {sortedTxns.map((t, i) => {
                const dr = t.type === "dr" ? t.amount : 0;
                const cr = t.type === "cr" ? t.amount : 0;
                runBal = runBal + dr - cr;
                const isDR = runBal >= 0;
                return (
                  <tr key={t._id || i}>
                    <td className="text-sm text-slate-600">{t.date}</td>
                    <td className="font-mono text-xs text-slate-500">{t.refNo || "—"}</td>
                    <td className="font-mono text-xs text-brand-600">{t.bookingId || "—"}</td>
                    <td className="text-sm text-slate-700">{t.description || "—"}</td>
                    <td className="text-right font-medium text-red-600 text-sm">{dr > 0 ? `Rs. ${fmt(dr)}` : "—"}</td>
                    <td className="text-right font-medium text-green-600 text-sm">{cr > 0 ? `Rs. ${fmt(cr)}` : "—"}</td>
                    <td>
                      {t.attachment?.url ? (
                        <a href={resolveUploadUrl(t.attachment.url)} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline inline-flex items-center gap-1">
                          <i className={`fa ${/^application\/pdf/.test(t.attachment.mimeType) ? "fa-file-pdf text-red-500" : "fa-file-image text-blue-600"}`} />
                          {t.attachment.fileName || "View"}
                        </a>
                      ) : "â€”"}
                    </td>
                    <td className="text-right">
                      <span className={`font-bold text-sm ${isDR ? "text-red-600" : "text-green-600"}`}>
                        Rs. {fmt(Math.abs(runBal))} <span className="text-xs">{isDR ? "DR" : "CR"}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      </>}

      {/* Add Transaction Modal */}
      {addModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-display font-semibold text-slate-800">Add Transaction</h2>
              <button onClick={() => setAddModal(false)} className="btn-ghost p-1"><i className="fa fa-times" /></button>
            </div>
            <form onSubmit={handleAddTxn}>
              <div className="modal-body space-y-3">
                <div>
                  <p className="label mb-2">Entry Type *</p>
                  <div className="flex gap-3">
                    {[["cr","Purchase Entry (CR)"],["dr","Payment Entry (DR)"]].map(([val, lbl]) => (
                      <button key={val} type="button" onClick={() => { setTxn((t) => ({ ...t, type: val, bank: val === "cr" ? "" : t.bank, attachment: null })); }}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${txn.type === val ? (val === "cr" ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700") : "border-slate-200 text-slate-500"}`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Date *"><input className="input" type="date" value={txn.date} onChange={(e) => setT("date", e.target.value)} required /></Field>
                  <Field label="Ref / Voucher No."><input className="input" value={txn.refNo} onChange={(e) => setT("refNo", e.target.value)} /></Field>
                  <Field label="Booking ID *">
                    <div className="flex gap-2">
                      <input className="input flex-1" value={txn.bookingId} onChange={(e) => setT("bookingId", e.target.value)} placeholder="ASA..." required />
                      <button type="button" onClick={fetchBooking} disabled={bookingLookup || !txn.bookingId.trim()} className="btn-secondary text-xs whitespace-nowrap">
                        {bookingLookup ? "Fetching…" : <><i className="fa fa-search" /> Fetch</>}
                      </button>
                    </div>
                  </Field>
                  <Field label="Client Name"><input className="input" value={txn.clientName} onChange={(e) => setT("clientName", e.target.value)} /></Field>
                  <Field label="Amount (Rs.) *"><input className="input" type="number" min="0.01" step="0.01" value={txn.amount} onChange={(e) => setT("amount", e.target.value)} required /></Field>
                  <Field label="Description" className="col-span-2"><textarea className="input min-h-[90px]" value={txn.description} onChange={(e) => setT("description", e.target.value)} /></Field>
                  <Field label={txn.type === "cr" ? "Purchase Invoice" : "Payment Slip"} className="sm:col-span-2">
                    <AttachmentField
                      label={txn.type === "cr" ? "Purchase Invoice" : "Payment Slip"}
                      attachment={txn.attachment}
                      onChange={(attachment) => setT("attachment", attachment)}
                    />
                  </Field>
                  {txn.type === "dr" && (
                    <Field label="Bank Account *" className="sm:col-span-2 min-w-0">
                    <select className="input min-w-0 max-w-full truncate" value={txn.bank} onChange={(e) => setT("bank", e.target.value)} required>
                      <option value="">— Select Bank —</option>
                      {bankList.map((b) => (
                        <option key={b._id} value={b.bankName}>{b.bankName} - Balance Rs. {fmt(b.balance)}</option>
                      ))}
                    </select>
                    {selectedBank && <p className="text-xs text-slate-400 mt-1">Available balance: Rs. {fmt(selectedBank.balance)}</p>}
                  </Field>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setAddModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary"><i className="fa fa-save" /> {saving ? "Saving…" : "Add Transaction"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Date Range Modal */}
      {pdfModal && (
        <div className="modal-overlay">
          <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-display font-semibold text-slate-800">Generate PDF Report</h2>
              <button onClick={() => setPdfModal(false)} className="btn-ghost p-1"><i className="fa fa-times" /></button>
            </div>
            <div className="modal-body space-y-3">
              <p className="text-sm text-slate-500">Optionally filter by date range. Leave blank to include all transactions.</p>
              <Field label="Fiscal Year">
                <input
                  className="input"
                  value={pdfFiscal}
                  onChange={(e) => setPdfFiscal(e.target.value)}
                  placeholder="e.g. 2082/2083"
                />
              </Field>
              <Field label="From Date"><input className="input" type="date" value={pdfFrom} onChange={(e) => setPdfFrom(e.target.value)} /></Field>
              <Field label="To Date"><input className="input" type="date" value={pdfTo} onChange={(e) => setPdfTo(e.target.value)} /></Field>
            </div>
            <div className="modal-footer">
              <button onClick={() => setPdfModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handlePDF} className="btn-primary"><i className="fa fa-file-pdf" /> Generate PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
