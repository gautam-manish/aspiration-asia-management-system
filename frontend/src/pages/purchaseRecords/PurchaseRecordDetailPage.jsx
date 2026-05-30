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
  const [pdfFiscal,  setPdfFiscal]  = useState("");
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
    const totalDR = txns.reduce((s, t) => s + (t.type === "dr" ? Number(t.amount) || 0 : 0), 0);
    const totalCR = txns.reduce((s, t) => s + (t.type === "cr" ? Number(t.amount) || 0 : 0), 0);

    // Description cell — shows description / clientName / bank stacked vertically.
    const descCell = (t) => {
      const lines = [];
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

        <!-- Left: Ledger / Debtor info -->
        <div style="flex:1;padding-right:14px;font-size:11px;line-height:1.85;">
          <div style="font-weight:700;color:#0f172a;">LEDGER BALANCE REPORT : SUNDRY DEBTORS</div>
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
          <button onClick={() => { setPdfFiscal(record.fiscalYear || ""); setPdfModal(true); }} className="btn-secondary">
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
