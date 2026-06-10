import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { bankAccountAPI } from "../../api";
import { notifyError } from "../../utils/helpers";
import { PageLoader, Empty, Field, ConfirmModal } from "../../components/common";
import { useBankAccounts, useBankAccount, useBankAccountMutations } from "../../hooks/useApiQueries";
import toast from "react-hot-toast";

const fmt = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

// ── Helpers ──────────────────────────────────────────────────────
const toDateKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "";
  const yyyy = dt.getFullYear();
  const mm   = String(dt.getMonth() + 1).padStart(2, "0");
  const dd   = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const addDays = (d, n) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

// Build the strip: today and previous 5 days (6 buttons total).
const buildDateStrip = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return [0, -1, -2, -3, -4, -5].map((offset) => {
    const d = addDays(today, offset);
    return {
      date: d,
      key: toDateKey(d),
      offset,
      label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
    };
  });
};

const RELATIVE_LABEL = { "0": "Today", "-1": "Yesterday" };

// ═══════════════════════════════════════════════════════════════
//  AddBankModal — create a new bank account
// ═══════════════════════════════════════════════════════════════
function AddBankModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    bankName: "", branch: "", accountName: "", accountNumber: "",
    codeType: "swift", codeValue: "", openingBalance: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.bankName.trim()) { toast.error("Bank name is required"); return; }
    setSaving(true);
    try {
      await bankAccountAPI.create({ ...form, openingBalance: Number(form.openingBalance) || 0 });
      toast.success("Bank account created ✓");
      onSaved();
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
          <h2 className="font-display font-semibold text-slate-800">Add Bank Account</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank Name *" className="col-span-2">
                <input className="input" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} required />
              </Field>
              <Field label="Branch">
                <input className="input" value={form.branch} onChange={(e) => set("branch", e.target.value)} />
              </Field>
              <Field label="Account Name">
                <input className="input" value={form.accountName} onChange={(e) => set("accountName", e.target.value)} />
              </Field>
              <Field label="Account Number">
                <input className="input" value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} />
              </Field>
              <Field label="Opening Balance (Rs.)">
                <input className="input" type="number" step="any" value={form.openingBalance} onChange={(e) => set("openingBalance", e.target.value)} />
              </Field>
            </div>

            {/* SWIFT / IFSC Radio */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Code Type</p>
              <div className="flex gap-3 mb-2">
                {[["swift", "SWIFT Code"], ["ifsc", "IFSC Code"]].map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => set("codeType", val)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      form.codeType === val
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-500"
                    }`}>
                    {lbl}
                  </button>
                ))}
              </div>
              <input
                className="input"
                placeholder={form.codeType === "swift" ? "e.g. EVBLNPKA" : "e.g. SBIN0001234"}
                value={form.codeValue}
                onChange={(e) => set("codeValue", e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              <i className="fa fa-save" /> {saving ? "Saving…" : "Create Bank"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AddCreditModal — add a manual credit transaction to a bank
// ═══════════════════════════════════════════════════════════════
function AddCreditModal({ bankId, bankName, onClose, onSaved }) {
  const [txn, setTxn] = useState({ date: "", refNo: "", description: "", amount: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setTxn((t) => ({ ...t, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!txn.date) { toast.error("Date is required"); return; }
    if (!txn.amount || Number(txn.amount) <= 0) { toast.error("Amount must be > 0"); return; }
    setSaving(true);
    try {
      await bankAccountAPI.addTransaction(bankId, {
        transaction: { ...txn, amount: Number(txn.amount) },
      });
      toast.success("Credit entry added ✓");
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">
            Add Credit — {bankName}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date *">
                <input className="input" type="date" value={txn.date} onChange={(e) => set("date", e.target.value)} required />
              </Field>
              <Field label="Ref No.">
                <input className="input" value={txn.refNo} onChange={(e) => set("refNo", e.target.value)} />
              </Field>
              <Field label="Amount (Rs.) *">
                <input className="input" type="number" min="0.01" step="0.01" value={txn.amount} onChange={(e) => set("amount", e.target.value)} required />
              </Field>
              <Field label="Description">
                <input className="input" value={txn.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              <i className="fa fa-plus" /> {saving ? "Saving…" : "Add Credit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BankChargesModal — add a bank charge (debit) to a bank
// ═══════════════════════════════════════════════════════════════
function BankChargesModal({ bankId, bankName, onClose, onSaved }) {
  const [txn, setTxn] = useState({ date: "", amount: "", description: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setTxn((t) => ({ ...t, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!txn.date) { toast.error("Date is required"); return; }
    if (!txn.amount || Number(txn.amount) <= 0) { toast.error("Amount must be > 0"); return; }
    setSaving(true);
    try {
      await bankAccountAPI.addTransaction(bankId, {
        transaction: { ...txn, amount: Number(txn.amount), type: "dr" },
      });
      toast.success("Bank charge added ✓");
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">
            Bank Charges — {bankName}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <Field label="Date *">
              <input className="input" type="date" value={txn.date} onChange={(e) => set("date", e.target.value)} required />
            </Field>
            <Field label="Amount (Rs.) *">
              <input className="input" type="number" min="0.01" step="0.01" value={txn.amount} onChange={(e) => set("amount", e.target.value)} required />
            </Field>
            <Field label="Description">
              <input className="input" value={txn.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. SMS charges, annual fee" />
            </Field>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              <i className="fa fa-minus-circle" /> {saving ? "Saving…" : "Add Charge"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Transaction Table — shows merged DR/CR entries for selected bank
// ═══════════════════════════════════════════════════════════════
function TransactionTable({ bankId, bankName, dateKey, fromDate, toDate, openingBalance }) {
  const params = {};
  // If quick-date is selected use it as from/to, otherwise use the custom range
  if (dateKey) {
    params.from = dateKey;
    params.to   = dateKey;
  } else {
    if (fromDate) params.from = fromDate;
    if (toDate)   params.to   = toDate;
  }

  const { data: bankDetail, isLoading } = useBankAccount(bankId, params);

  if (isLoading) return <div className="p-6"><PageLoader /></div>;
  if (!bankDetail) return <div className="p-6 text-center text-slate-400">No data</div>;

  const txns = bankDetail.mergedTransactions || [];
  let runBal = Number(openingBalance || 0);

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Ref No.</th>
            <th>Description</th>

            <th className="text-right">Debit (DR)</th>
            <th className="text-right">Credit (CR)</th>
            <th className="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {txns.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center text-slate-400 py-8">
                No transactions found for this date.
              </td>
            </tr>
          ) : (
            txns.map((t, i) => {
              const dr = t.type === "dr" ? t.amount : 0;
              const cr = t.type === "cr" ? t.amount : 0;
              runBal = runBal + cr - dr;
              return (
                <tr key={t._id || i}>
                  <td className="text-sm text-slate-600">{t.date || "—"}</td>
                  <td className="font-mono text-xs text-slate-500">{t.refNo || "—"}</td>
                  <td className="text-sm text-slate-700">
                    {t.description || "—"}
                    {t.debtorName && (
                      <span className="block text-xs text-slate-400">{t.debtorName}</span>
                    )}
                  </td>

                  <td className="text-right font-medium text-red-600 text-sm">
                    {dr > 0 ? fmt(dr) : "—"}
                  </td>
                  <td className="text-right font-medium text-green-600 text-sm">
                    {cr > 0 ? fmt(cr) : "—"}
                  </td>
                  <td className="text-right">
                    <span className={`font-bold text-sm ${runBal >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(Math.abs(runBal))}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BankAccountsPage — main page
// ═══════════════════════════════════════════════════════════════
export default function BankAccountsPage() {
  const qc = useQueryClient();
  const { data: banks = [], isLoading, error } = useBankAccounts();
  const { remove } = useBankAccountMutations();

  const [addBankModal, setAddBankModal]     = useState(false);
  const [creditModal,  setCreditModal]      = useState(null); // { bankId, bankName }
  const [chargeModal,  setChargeModal]      = useState(null); // { bankId, bankName }
  const [selectedBank, setSelectedBank]     = useState(null); // bank._id
  const [confirmDelete, setConfirmDelete]   = useState(null);

  // Date strip for quick filtering
  const dateStrip = useMemo(() => buildDateStrip(), []);
  const [selectedDateKey, setSelectedDateKey] = useState(dateStrip[0]?.key || "");

  // Custom date range filter
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [selectedRangePreset, setSelectedRangePreset] = useState(null); // 7, 15, or 30
  const [filterModal, setFilterModal] = useState(false);
  const [tempFrom, setTempFrom] = useState("");
  const [tempTo,   setTempTo]   = useState("");

  useEffect(() => { if (error) notifyError(error); }, [error]);

  // Auto-select first bank if none selected
  useEffect(() => {
    if (banks.length > 0 && !selectedBank) {
      setSelectedBank(banks[0]._id);
    }
  }, [banks, selectedBank]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["bank-account"] });
    qc.invalidateQueries({ queryKey: ["customer-payments"] });
    qc.invalidateQueries({ queryKey: ["vendor-payments"] });
    qc.invalidateQueries({ queryKey: ["office-expenses"] });
    qc.invalidateQueries({ queryKey: ["purchase-records"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
  };

  const handleDelete = () => {
    remove.mutate(confirmDelete._id, {
      onSuccess: () => {
        toast.success("Bank account deleted");
        setConfirmDelete(null);
        if (selectedBank === confirmDelete._id) setSelectedBank(null);
      },
      onError: (err) => notifyError(err),
    });
  };

  const activeBankObj = banks.find((b) => b._id === selectedBank);

  if (isLoading) return <PageLoader />;

  return (
    <div>
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank Accounts</h1>
          <p className="page-subtitle">Track bank transactions & balances</p>
        </div>
        <button onClick={() => setAddBankModal(true)} className="btn-primary">
          <i className="fa fa-plus" /> Add Bank
        </button>
      </div>

      {/* ── Bank Cards Row ───────────────────────────────── */}
      {banks.length === 0 ? (
        <Empty
          icon="fa-university"
          message="No bank accounts yet"
          action={<button onClick={() => setAddBankModal(true)} className="btn-primary">Create your first bank</button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {banks.map((bank) => {
              const isActive = selectedBank === bank._id;
              return (
                <button
                  key={bank._id}
                  onClick={() => setSelectedBank(bank._id)}
                  className={`card card-body !py-4 text-left transition-all cursor-pointer border-2 ${
                    isActive
                      ? "border-brand-600 bg-brand-50 shadow-md ring-2 ring-brand-200"
                      : "border-transparent hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isActive ? "bg-brand-600" : "bg-slate-200"
                      }`}>
                        <i className={`fa fa-university text-sm ${isActive ? "text-white" : "text-slate-500"}`} />
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${isActive ? "text-brand-700" : "text-slate-800"}`}>
                          {bank.bankName}
                        </p>
                        {bank.branch && (
                          <p className="text-[10px] text-slate-400">{bank.branch}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(bank); }}
                      className="btn-ghost text-slate-300 hover:text-red-500 p-1 text-xs"
                      title="Delete bank"
                    >
                      <i className="fa fa-trash-alt" />
                    </button>
                  </div>
                  <div className="mt-1">
                    <p className="text-xs text-slate-400">A/C: {bank.accountNumber || "—"}</p>
                    <p className={`text-lg font-bold mt-1 ${
                      (bank.balance || 0) >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {fmt(Math.abs(bank.balance || 0))}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Date Strip + Custom Range ────────────────────── */}
          {selectedBank && (
            <>
              <div className="card mb-4">
                <div className="card-body !py-3">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Quick date buttons */}
                    <div className="flex gap-2 overflow-x-auto flex-1 min-w-0">
                      {dateStrip.map((d) => {
                        const isActive = !useCustomRange && d.key === selectedDateKey;
                        const relLabel = RELATIVE_LABEL[String(d.offset)];
                        return (
                          <button
                            key={d.key}
                            onClick={() => {
                              setSelectedDateKey(d.key);
                              setUseCustomRange(false);
                            }}
                            className={`flex-shrink-0 w-20 sm:w-24 rounded-xl border-2 px-2 py-2 text-center transition-colors ${
                              isActive
                                ? "border-brand-600 bg-brand-50 text-brand-700"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <p className={`text-[10px] uppercase tracking-widest font-semibold ${isActive ? "text-brand-500" : "text-slate-400"}`}>
                              {relLabel || d.weekday}
                            </p>
                            <p className={`text-sm font-bold mt-0.5 ${isActive ? "text-brand-700" : "text-slate-800"}`}>
                              {d.label}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Divider */}
                    <div className="hidden lg:block w-px h-10 bg-slate-200" />

                    {/* Quick range buttons */}
                    <div className="flex gap-2 flex-shrink-0">
                      {[7, 15, 30].map((days) => {
                        const isActive = useCustomRange && selectedRangePreset === days;
                        return (
                          <button
                            key={days}
                            onClick={() => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const from = addDays(today, -(days - 1));
                              setFromDate(toDateKey(from));
                              setToDate(toDateKey(today));
                              setUseCustomRange(true);
                              setSelectedRangePreset(days);
                            }}
                            className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${
                              isActive
                                ? "border-brand-600 bg-brand-50 text-brand-700"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            {days}D
                          </button>
                        );
                      })}
                    </div>

                    {/* Divider */}
                    <div className="hidden lg:block w-px h-10 bg-slate-200" />

                    {/* Filter Date button */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => { setTempFrom(fromDate); setTempTo(toDate); setFilterModal(true); }}
                        className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
                          useCustomRange && !selectedRangePreset
                            ? "border-brand-600 bg-brand-50 text-brand-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <i className="fa fa-calendar-alt" /> Filter Date
                      </button>
                      {useCustomRange && !selectedRangePreset && (
                        <button
                          onClick={() => { setUseCustomRange(false); setFromDate(""); setToDate(""); setSelectedRangePreset(null); }}
                          className="btn-ghost text-xs py-2 px-2 text-slate-400"
                          title="Clear date filter"
                        >
                          <i className="fa fa-times" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Transaction Table ────────────────────────────── */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="font-semibold text-slate-700">
                      {activeBankObj?.bankName} — Transactions
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {useCustomRange
                        ? `${fromDate || "Start"} → ${toDate || "End"}`
                        : dateStrip.find((d) => d.key === selectedDateKey)?.date.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
                      }
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setChargeModal({ bankId: selectedBank, bankName: activeBankObj?.bankName })}
                      className="btn-secondary text-sm"
                    >
                      <i className="fa fa-minus-circle" /> Bank Charges
                    </button>
                    <button
                      onClick={() => setCreditModal({ bankId: selectedBank, bankName: activeBankObj?.bankName })}
                      className="btn-primary text-sm"
                    >
                      <i className="fa fa-plus" /> Add Credit
                    </button>
                  </div>
                </div>

                <TransactionTable
                  bankId={selectedBank}
                  bankName={activeBankObj?.bankName}
                  dateKey={useCustomRange ? null : selectedDateKey}
                  fromDate={useCustomRange ? fromDate : null}
                  toDate={useCustomRange ? toDate : null}
                  openingBalance={activeBankObj?.openingBalance}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      {addBankModal && (
        <AddBankModal
          onClose={() => setAddBankModal(false)}
          onSaved={() => { setAddBankModal(false); refresh(); }}
        />
      )}

      {creditModal && (
        <AddCreditModal
          bankId={creditModal.bankId}
          bankName={creditModal.bankName}
          onClose={() => setCreditModal(null)}
          onSaved={() => {
            setCreditModal(null);
            refresh();
            qc.invalidateQueries({ queryKey: ["bank-account", creditModal.bankId] });
          }}
        />
      )}

      {/* Bank Charges Modal */}
      {chargeModal && (
        <BankChargesModal
          bankId={chargeModal.bankId}
          bankName={chargeModal.bankName}
          onClose={() => setChargeModal(null)}
          onSaved={() => {
            setChargeModal(null);
            refresh();
            qc.invalidateQueries({ queryKey: ["bank-account", chargeModal.bankId] });
          }}
        />
      )}

      {/* Filter Date Modal */}
      {filterModal && (
        <div className="modal-overlay">
          <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-display font-semibold text-slate-800">Filter by Date</h2>
              <button onClick={() => setFilterModal(false)} className="btn-ghost p-1"><i className="fa fa-times" /></button>
            </div>
            <div className="modal-body space-y-3">
              <Field label="From Date">
                <input className="input" type="date" value={tempFrom} onChange={(e) => setTempFrom(e.target.value)} />
              </Field>
              <Field label="To Date">
                <input className="input" type="date" value={tempTo} onChange={(e) => setTempTo(e.target.value)} />
              </Field>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setFilterModal(false)} className="btn-secondary">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  setFromDate(tempFrom);
                  setToDate(tempTo);
                  setUseCustomRange(true);
                  setSelectedRangePreset(null);
                  setFilterModal(false);
                }}
                className="btn-primary"
              >
                <i className="fa fa-filter" /> Filter
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Bank Account"
        message={`Delete "${confirmDelete?.bankName}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        loading={remove.isPending}
      />
    </div>
  );
}
