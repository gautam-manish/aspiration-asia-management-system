import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { purchaseRecordAPI } from "../../api";
import { getError, formatDate } from "../../utils/helpers";
import { PageLoader, Field } from "../../components/common";
import toast from "react-hot-toast";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function PurchaseRecordDetailPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const printRef  = useRef();

  const [record,     setRecord]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [addModal,   setAddModal]   = useState(false);
  const [pdfModal,   setPdfModal]   = useState(false);
  const [pdfFrom,    setPdfFrom]    = useState("");
  const [pdfTo,      setPdfTo]      = useState("");
  const [txn,        setTxn]        = useState({ date: "", refNo: "", clientName: "", description: "", amount: "", bank: "", type: "cr" });
  const [saving,     setSaving]     = useState(false);

  const loadRecord = () =>
    purchaseRecordAPI.getById(id)
      .then(({ data }) => setRecord(data.data))
      .catch((err) => toast.error(getError(err)))
      .finally(() => setLoading(false));

  useEffect(() => { loadRecord(); }, [id]);

  const setT = (k, v) => setTxn((t) => ({ ...t, [k]: v }));

  const handleAddTxn = async (e) => {
    e.preventDefault();
    if (!txn.date)   { toast.error("Date required"); return; }
    if (!txn.amount || Number(txn.amount) <= 0) { toast.error("Amount must be > 0"); return; }
    setSaving(true);
    try {
      await purchaseRecordAPI.addTransaction(id, { transaction: { ...txn, amount: Number(txn.amount) } });
      toast.success("Transaction added ✓");
      setAddModal(false);
      setTxn({ date: "", refNo: "", clientName: "", description: "", amount: "", bank: "", type: "cr" });
      loadRecord();
    } catch (err) {
      toast.error(getError(err));
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
    const rows = txns.map((t, i) => {
      const dr = t.type === "dr" ? t.amount : 0;
      const cr = t.type === "cr" ? t.amount : 0;
      runBal = runBal + dr - cr;
      const isDR = runBal >= 0;
      return `<tr>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;font-size:11px;">${t.date || ""}</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;font-size:11px;">${t.refNo || ""}</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;font-size:11px;">${t.description || ""}</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;font-size:11px;text-align:right;color:${dr>0?"#dc2626":"#94a3b8"};">${dr > 0 ? "Rs. "+fmt(dr) : ""}</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;font-size:11px;text-align:right;color:${cr>0?"#16a34a":"#94a3b8"};">${cr > 0 ? "Rs. "+fmt(cr) : ""}</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;font-size:11px;text-align:right;font-weight:700;color:${isDR?"#dc2626":"#16a34a"};">Rs. ${fmt(Math.abs(runBal))} ${isDR?"DR":"CR"}</td>
      </tr>`;
    }).join("");

    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Ledger — ${record.debtorName}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1e3a8a; color: white; padding: 9px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid #1e3a8a; text-align: left; }
      </style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <div style="font-size:18px;font-weight:700;color:#1e293b;">${record.debtorName}</div>
          ${record.debtorCompany ? `<div style="color:#475569;font-size:13px;">${record.debtorCompany}</div>` : ""}
          ${record.debtorPan ? `<div style="color:#64748b;font-size:11px;">PAN/VAT: ${record.debtorPan}</div>` : ""}
        </div>
        <div style="text-align:right;">
          <div style="font-size:16px;font-weight:700;color:#1e3a8a;">PURCHASE LEDGER</div>
          <div style="font-size:11px;color:#64748b;">Aspiration Asia Trekking &amp; Expedition Pvt Ltd</div>
          ${record.fiscalYear ? `<div style="font-size:11px;color:#64748b;">FY: ${record.fiscalYear}</div>` : ""}
          ${(pdfFrom || pdfTo) ? `<div style="font-size:11px;color:#64748b;">Period: ${pdfFrom || "Start"} to ${pdfTo || "End"}</div>` : ""}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px;">
        ${[["Opening Balance","Rs. "+fmt(record.openingBalance),"#1e293b"],["Total Debit (DR)","Rs. "+fmt(record.totalDebit),"#dc2626"],["Total Credit (CR)","Rs. "+fmt(record.totalCredit),"#16a34a"],["Closing Balance","Rs. "+fmt(Math.abs(record.closingBalance))+" "+(record.closingBalance>=0?"DR":"CR"),record.closingBalance>=0?"#dc2626":"#16a34a"]].map(([l,v,c])=>`
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;font-weight:600;">${l}</div>
            <div style="font-size:14px;font-weight:700;color:${c};margin-top:2px;">${v}</div>
          </div>`).join("")}
      </div>

      <table>
        <thead><tr>
          <th>Date</th><th>Ref / Voucher</th><th>Description</th>
          <th style="text-align:right;">Debit (DR)</th>
          <th style="text-align:right;">Credit (CR)</th>
          <th style="text-align:right;">Balance</th>
        </tr></thead>
        <tbody>
          <tr style="background:#f8fafc;">
            <td colspan="5" style="padding:7px 10px;border:1px solid #cbd5e1;font-size:11px;font-weight:600;color:#475569;">Opening Balance</td>
            <td style="padding:7px 10px;border:1px solid #cbd5e1;font-size:11px;text-align:right;font-weight:700;">Rs. ${fmt(record.openingBalance)} DR</td>
          </tr>
          ${rows}
        </tbody>
      </table>
      <div style="text-align:center;margin-top:14px;font-size:10px;color:#94a3b8;font-style:italic;">
        Generated on ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})} — Aspiration Asia Trekking &amp; Expedition Pvt Ltd
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
  let runBal = Number(record.openingBalance || 0);

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
        <div className="flex gap-2">
          <button onClick={() => setPdfModal(true)} className="btn-secondary">
            <i className="fa fa-file-pdf" /> PDF Report
          </button>
          <button onClick={() => setAddModal(true)} className="btn-primary">
            <i className="fa fa-plus" /> Add Transaction
          </button>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[["Opening Balance", record.openingBalance, "text-slate-800"],["Total Debit (DR)", record.totalDebit, "text-red-600"],["Total Credit (CR)", record.totalCredit, "text-green-600"],["Closing Balance", null, record.closingBalance >= 0 ? "text-red-600" : "text-green-600"]].map(([lbl, val, cls]) => (
          <div key={lbl} className="card card-body !py-4">
            <p className="text-xs text-slate-500 mb-1">{lbl}</p>
            {lbl === "Closing Balance"
              ? <p className={`text-xl font-bold ${cls}`}>Rs. {fmt(Math.abs(record.closingBalance))} <span className="text-sm">{record.closingBalance >= 0 ? "DR" : "CR"}</span></p>
              : <p className={`text-xl font-bold ${cls}`}>Rs. {fmt(val)}</p>
            }
          </div>
        ))}
      </div>

      {/* Debtor Info */}
      <div className="card mb-4">
        <div className="card-header"><h3 className="font-semibold text-slate-700">Debtor Information</h3></div>
        <div className="card-body grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[["Name", record.debtorName],["Company", record.debtorCompany],["PAN/VAT", record.debtorPan],["Address", record.debtorAddress],["Phone", record.debtorPhone],["Email", record.debtorEmail],["Fiscal Year", record.fiscalYear]].map(([lbl, val]) => (
            <div key={lbl}><p className="text-xs text-slate-400 mb-0.5">{lbl}</p><p className="font-medium text-slate-800">{val || "—"}</p></div>
          ))}
        </div>
      </div>

      {/* Ledger Transactions */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-700">Ledger Transactions</h3>
          <span className="badge badge-blue">{sortedTxns.length} entries</span>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Ref / Voucher</th><th>Description</th><th className="text-right">Debit (DR)</th><th className="text-right">Credit (CR)</th><th className="text-right">Balance</th></tr>
            </thead>
            <tbody>
              <tr className="bg-slate-50">
                <td colSpan={5} className="font-semibold text-slate-500 text-xs">Opening Balance</td>
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
                    <td className="text-sm text-slate-700">{t.description || "—"}</td>
                    <td className="text-right font-medium text-red-600 text-sm">{dr > 0 ? `Rs. ${fmt(dr)}` : "—"}</td>
                    <td className="text-right font-medium text-green-600 text-sm">{cr > 0 ? `Rs. ${fmt(cr)}` : "—"}</td>
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
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date *"><input className="input" type="date" value={txn.date} onChange={(e) => setT("date", e.target.value)} required /></Field>
                  <Field label="Ref / Voucher No."><input className="input" value={txn.refNo} onChange={(e) => setT("refNo", e.target.value)} /></Field>
                  <Field label="Client Name"><input className="input" value={txn.clientName} onChange={(e) => setT("clientName", e.target.value)} /></Field>
                  <Field label="Amount (Rs.) *"><input className="input" type="number" min="0.01" step="0.01" value={txn.amount} onChange={(e) => setT("amount", e.target.value)} required /></Field>
                  <Field label="Description" className="col-span-2"><input className="input" value={txn.description} onChange={(e) => setT("description", e.target.value)} /></Field>
                  <Field label="Bank"><input className="input" value={txn.bank} onChange={(e) => setT("bank", e.target.value)} /></Field>
                </div>
                <div>
                  <p className="label mb-2">Entry Type *</p>
                  <div className="flex gap-3">
                    {[["cr","Credit (CR)"],["dr","Debit (DR)"]].map(([val, lbl]) => (
                      <button key={val} type="button" onClick={() => setT("type", val)}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${txn.type === val ? (val === "cr" ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700") : "border-slate-200 text-slate-500"}`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
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
