import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { purchaseRecordAPI, sundryAPI } from "../../api";
import { getError } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, ConfirmModal, Field } from "../../components/common";
import toast from "react-hot-toast";

const fmt = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function AddModal({ onClose, onSaved }) {
  const [debtors,  setDebtors]  = useState([]);
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState(null);
  const [showDrop, setShowDrop] = useState(false);
  const [txn,      setTxn]      = useState({ date: "", refNo: "", clientName: "", description: "", amount: "", bank: "", type: "cr" });
  const [opening,  setOpening]  = useState("");
  const [loading,  setLoading]  = useState(false);
  // Holds the existing PurchaseRecord doc when one is found for the typed debtor.
  // null = unknown, false = no existing account (new ledger), object = existing.
  const [existing, setExisting] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    sundryAPI.getAll().then(({ data }) => setDebtors(data.data || [])).catch(() => {});
  }, []);

  const filtered = debtors.filter((d) =>
    d.contactPerson.toLowerCase().includes(query.toLowerCase()) ||
    (d.companyName || "").toLowerCase().includes(query.toLowerCase())
  );

  // Look up an existing ledger by debtor name. Debounced lightly via blur/select.
  const checkExistingByName = async (name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) { setExisting(null); return; }
    setChecking(true);
    try {
      const { data } = await purchaseRecordAPI.getByDebtor(trimmed);
      setExisting(data?.data || null);
      // Clear the opening balance input since it isn't applicable.
      if (data?.data) { setOpening(""); }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        setExisting(false); // confirmed no account → show opening balance fields
      } else {
        setExisting(null);
      }
    } finally {
      setChecking(false);
    }
  };

  const selectDebtor = (d) => {
    setSelected(d);
    setQuery(d.contactPerson + (d.companyName ? ` (${d.companyName})` : ""));
    setShowDrop(false);
    // The query string includes the company suffix; check by the contact person name only.
    checkExistingByName(d.contactPerson);
  };

  const setT = (k, v) => setTxn((t) => ({ ...t, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const debtorNameClean = selected
      ? selected.contactPerson
      : query.replace(/\s*\(.*\)\s*$/, "").trim();
    if (!debtorNameClean) { toast.error("Select or enter a debtor name"); return; }
    if (!txn.date)   { toast.error("Transaction date required"); return; }
    if (!txn.amount || Number(txn.amount) <= 0) { toast.error("Amount must be > 0"); return; }
    setLoading(true);
    try {
      await purchaseRecordAPI.create({
        debtorName:    debtorNameClean,
        debtorCompany: selected?.companyName  || existing?.debtorCompany || "",
        debtorPan:     selected?.panVatGst    || existing?.debtorPan     || "",
        debtorAddress: selected?.address      || existing?.debtorAddress || "",
        debtorPhone:   selected?.phone        || existing?.debtorPhone   || "",
        debtorEmail:   selected?.email        || existing?.debtorEmail   || "",
        // For new ledgers, send opening. For existing ledgers, omit it
        // so the controller doesn't try to override (controller only honors it on create anyway).
        ...(existing ? {} : { openingBalance: Number(opening) || 0 }),
        transaction:   { ...txn, amount: Number(txn.amount) },
      });
      toast.success(existing ? "Entry added to existing ledger ✓" : "New ledger created ✓");
      onSaved();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">Add Purchase Entry</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {/* Debtor */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Debtor *</p>
              <div className="relative">
                <input
                  className="input"
                  placeholder="Search or type debtor name…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowDrop(true);
                    setSelected(null);
                    setExisting(null); // reset until blur or selection
                  }}
                  onFocus={() => setShowDrop(true)}
                  onBlur={() => {
                    // Allow click on dropdown options to register before checking.
                    setTimeout(() => {
                      // Strip any trailing "(Company)" suffix when typed manually
                      const cleanName = selected
                        ? selected.contactPerson
                        : query.replace(/\s*\(.*\)\s*$/, "");
                      checkExistingByName(cleanName);
                    }, 150);
                  }}
                />
                {showDrop && filtered.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filtered.map((d) => (
                      <button key={d._id} type="button" onClick={() => selectDebtor(d)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <p className="font-medium text-slate-800">{d.contactPerson}</p>
                        {d.companyName && <p className="text-xs text-slate-400">{d.companyName}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Existing-account banner (shown when a ledger already exists) */}
              {existing && (
                <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-brand-700 flex items-start gap-2">
                  <i className="fa fa-info-circle mt-0.5" />
                  <div>
                    <p className="font-semibold">Existing ledger found</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      This entry will be appended to <span className="font-medium">{existing.debtorName}</span>'s account.
                      Opening balance is locked at <span className="font-mono">{fmt(existing.openingBalance)}</span>.
                    </p>
                  </div>
                </div>
              )}

              {/* No-account banner (shown after lookup confirms no ledger exists) */}
              {existing === false && (
                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                  <i className="fa fa-exclamation-circle mt-0.5" />
                  <div>
                    <p className="font-semibold">No account exists for this debtor</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      A new ledger will be created on save. Set the opening balance below.
                    </p>
                  </div>
                </div>
              )}

              {checking && (
                <p className="mt-2 text-xs text-slate-400">Checking existing account…</p>
              )}

              {/* Opening balance — only when no existing account yet */}
              {!existing && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <Field label="Opening Balance (Rs.)">
                    <input className="input" type="number" min="0" step="any" value={opening} onChange={(e) => setOpening(e.target.value)} />
                  </Field>
                </div>
              )}
            </div>

            {/* Transaction */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Transaction Details</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date *">
                  <input className="input" type="date" value={txn.date} onChange={(e) => setT("date", e.target.value)} required />
                </Field>
                <Field label="Ref / Voucher No.">
                  <input className="input" value={txn.refNo} onChange={(e) => setT("refNo", e.target.value)} />
                </Field>
                <Field label="Client Name">
                  <input className="input" value={txn.clientName} onChange={(e) => setT("clientName", e.target.value)} />
                </Field>
                <Field label="Amount (Rs.) *">
                  <input className="input" type="number" min="0.01" step="0.01" value={txn.amount} onChange={(e) => setT("amount", e.target.value)} required />
                </Field>
                <Field label="Description" className="col-span-2">
                  <input className="input" value={txn.description} onChange={(e) => setT("description", e.target.value)} />
                </Field>
                <Field label="Bank">
                  <input className="input" value={txn.bank} onChange={(e) => setT("bank", e.target.value)} />
                </Field>
              </div>
            </div>

            {/* Entry type */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Entry Type *</p>
              <div className="flex gap-3">
                {[["cr","Credit (CR)","badge-green"], ["dr","Debit (DR)","badge-red"]].map(([val, lbl, cls]) => (
                  <button key={val} type="button" onClick={() => setT("type", val)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      txn.type === val ? (val === "cr" ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700") : "border-slate-200 text-slate-500"
                    }`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              <i className="fa fa-save" /> {loading ? "Saving…" : "Save Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PurchaseRecordsPage() {
  const navigate             = useNavigate();
  const [records,  setRecords]  = useState([]);
  const [allRecs,  setAllRecs]  = useState([]);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [confirm,  setConfirm]  = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await purchaseRecordAPI.getAll();
      setAllRecs(data.data || []);
      setRecords(data.data || []);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    if (!search.trim()) { setRecords(allRecs); return; }
    setRecords(allRecs.filter((r) => r.debtorName.toLowerCase().includes(search.toLowerCase())));
  }, [search, allRecs]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await purchaseRecordAPI.remove(confirm._id);
      toast.success("Record deleted");
      setConfirm(null);
      fetchRecords();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setDeleting(false);
    }
  };

  const totalDR = records.reduce((s, r) => s + (Number(r.totalDebit) || 0), 0);
  const totalCR = records.reduce((s, r) => s + (Number(r.totalCredit) || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Records</h1>
          <p className="page-subtitle">Debtor ledger management</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <i className="fa fa-plus" /> Add Entry
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Total Debtors</p><p className="text-2xl font-bold text-slate-800">{records.length}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Total Debit (DR)</p><p className="text-xl font-bold text-red-600">{fmt(totalDR)}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Total Credit (CR)</p><p className="text-xl font-bold text-green-600">{fmt(totalCR)}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Net Balance</p><p className={`text-xl font-bold ${totalDR - totalCR >= 0 ? "text-red-600" : "text-green-600"}`}>{fmt(Math.abs(totalDR - totalCR))} {totalDR - totalCR >= 0 ? "DR" : "CR"}</p></div>
      </div>

      <div className="card">
        <div className="card-header">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by debtor name…" />
          <span className="text-sm text-slate-500">{records.length} debtors</span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : records.length === 0 ? (
          <Empty icon="fa-book" message="No purchase records found" action={<button onClick={() => setModal(true)} className="btn-primary">Add first entry</button>} />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Debtor</th>
                  <th>PAN / VAT</th>
                  <th>Opening Balance</th>
                  <th>Total Debit</th>
                  <th>Total Credit</th>
                  <th>Closing Balance</th>
                  <th>Entries</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const closing = Number(r.closingBalance || 0);
                  const isDR = closing >= 0;
                  return (
                    <tr key={r._id}>
                      <td className="text-slate-400 text-xs">{i + 1}</td>
                      <td>
                        <p className="font-medium text-slate-800">{r.debtorName}</p>
                        {r.debtorCompany && <p className="text-xs text-slate-400">{r.debtorCompany}</p>}
                      </td>
                      <td className="text-slate-500 text-sm font-mono">{r.debtorPan || "—"}</td>
                      <td className="text-sm">{fmt(r.openingBalance)}</td>
                      <td className="text-red-600 font-medium text-sm">{fmt(r.totalDebit)}</td>
                      <td className="text-green-600 font-medium text-sm">{fmt(r.totalCredit)}</td>
                      <td>
                        <span className={`font-bold text-sm ${isDR ? "text-red-600" : "text-green-600"}`}>
                          {fmt(Math.abs(closing))} <span className="text-xs font-semibold">{isDR ? "DR" : "CR"}</span>
                        </span>
                      </td>
                      <td className="text-slate-500 text-sm">{(r.transactions || []).length}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button onClick={() => navigate(`/purchase-records/${r._id}`)} className="btn-ghost text-xs py-1 px-2"><i className="fa fa-eye" /> View</button>
                          <button onClick={() => setConfirm(r)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2"><i className="fa fa-trash-alt" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <AddModal onClose={() => setModal(false)} onSaved={() => { setModal(false); fetchRecords(); }} />}

      <ConfirmModal
        open={!!confirm}
        title="Delete Purchase Record"
        message={`Delete all ledger data for "${confirm?.debtorName}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
        loading={deleting}
      />
    </div>
  );
}
