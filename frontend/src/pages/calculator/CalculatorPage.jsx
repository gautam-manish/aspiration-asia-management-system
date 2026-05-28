import { useState, useEffect, useCallback } from "react";
import { calculatorAPI } from "../../api";
import { getError } from "../../utils/helpers";
import { PageLoader, Empty, ConfirmModal, Spinner } from "../../components/common";
import toast from "react-hot-toast";

// ── Helpers ──────────────────────────────────────────────────────────
const sum = (arr = [], key = "amount") =>
  arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);

const EMPTY_RECORD = {
  title: "Allowance/Expense Calculator",
  allowances: [],
  expenses: [],
  payments: [],
  totalAllowance: 0,
  totalExpense: 0,
  totalPayment: 0,
  balance: 0,
};

// ── Sub-components ───────────────────────────────────────────────────
function ItemRow({ item, onChange, onRemove, colConfig }) {
  return (
    <div className="grid gap-2 items-center" style={{ gridTemplateColumns: colConfig }}>
      {item.clientName !== undefined && (
        <input className="input text-xs" value={item.clientName} onChange={(e) => onChange("clientName", e.target.value)} placeholder="Client name" />
      )}
      {item.startDate !== undefined && (
        <input className="input text-xs" type="date" value={item.startDate} onChange={(e) => onChange("startDate", e.target.value)} />
      )}
      {item.endDate !== undefined && (
        <input className="input text-xs" type="date" value={item.endDate} onChange={(e) => onChange("endDate", e.target.value)} />
      )}
      {item.purpose !== undefined && (
        <input className="input text-xs" value={item.purpose} onChange={(e) => onChange("purpose", e.target.value)} placeholder="Purpose / Description" />
      )}
      {item.referenceNumber !== undefined && (
        <input className="input text-xs font-mono" value={item.referenceNumber} onChange={(e) => onChange("referenceNumber", e.target.value)} placeholder="Ref. No." />
      )}
      {item.amount !== undefined && (
        <input className="input text-xs text-right" type="number" value={item.amount} onChange={(e) => onChange("amount", e.target.value)} placeholder="0" min="0" />
      )}
      <button onClick={onRemove} className="btn-ghost text-red-400 hover:text-red-600 p-1 justify-self-center">
        <i className="fa fa-trash-alt text-xs" />
      </button>
    </div>
  );
}

function Section({ title, icon, color, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
            <i className={`fa ${icon} text-white text-xs`} />
          </div>
          <h3 className="font-semibold text-slate-700">{title}</h3>
        </div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

// ── Allowance client block ───────────────────────────────────────────
function AllowanceClient({ client, idx, onChange, onRemove }) {
  const addItem  = () => onChange(idx, "items", [...(client.items || []), { purpose: "", amount: 0 }]);
  const removeItem = (i) => onChange(idx, "items", client.items.filter((_, ii) => ii !== i));
  const setItem  = (i, k, v) => {
    const items = [...client.items];
    items[i] = { ...items[i], [k]: v };
    onChange(idx, "items", items);
    onChange(idx, "total", sum(items));
  };

  return (
    <div className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50/50">
      <div className="grid grid-cols-4 gap-2">
        <input className="input text-xs col-span-2" value={client.clientName} onChange={(e) => onChange(idx, "clientName", e.target.value)} placeholder="Client name" />
        <input className="input text-xs" type="date" value={client.startDate} onChange={(e) => onChange(idx, "startDate", e.target.value)} />
        <input className="input text-xs" type="date" value={client.endDate} onChange={(e) => onChange(idx, "endDate", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        {(client.items || []).map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_120px_32px] gap-2 items-center">
            <input className="input text-xs" value={item.purpose} onChange={(e) => setItem(i, "purpose", e.target.value)} placeholder="Purpose" />
            <input className="input text-xs text-right" type="number" value={item.amount} onChange={(e) => setItem(i, "amount", e.target.value)} placeholder="0" min="0" />
            <button onClick={() => removeItem(i)} className="btn-ghost text-red-400 text-xs p-1"><i className="fa fa-times" /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={addItem} className="btn-ghost text-xs text-brand-600"><i className="fa fa-plus" /> Add Item</button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Total: <strong>Rs. {Number(client.total || 0).toLocaleString()}</strong></span>
          <button onClick={() => onRemove(idx)} className="btn-ghost text-red-400 text-xs"><i className="fa fa-trash-alt" /> Remove Client</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function CalculatorPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive]   = useState(null); // current working record
  const [saving, setSaving]   = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await calculatorAPI.getAll();
      setRecords(data.data || []);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Recalculate totals whenever active changes
  const recalc = (rec) => {
    const totalAllowance = rec.allowances.reduce((a, c) => a + Number(c.total || 0), 0);
    const totalExpense   = sum(rec.expenses);
    const totalPayment   = sum(rec.payments);
    const balance        = totalAllowance + totalExpense - totalPayment;
    return { ...rec, totalAllowance, totalExpense, totalPayment, balance };
  };

  const setActive_ = (rec) => setActive(rec ? recalc(rec) : null);

  const updateField = (section, updater) => {
    setActive((prev) => {
      const updated = { ...prev, [section]: updater(prev[section] || []) };
      return recalc(updated);
    });
  };

  // Allowances
  const addAllowanceClient = () => updateField("allowances", (a) => [...a, { clientName: "", startDate: "", endDate: "", items: [], total: 0 }]);
  const updateAllowanceClient = (idx, k, v) => updateField("allowances", (a) => {
    const next = [...a]; next[idx] = { ...next[idx], [k]: v }; return next;
  });
  const removeAllowanceClient = (idx) => updateField("allowances", (a) => a.filter((_, i) => i !== idx));

  // Expenses
  const addExpense    = () => updateField("expenses", (e) => [...e, { purpose: "", amount: 0 }]);
  const updateExpense = (idx, k, v) => updateField("expenses", (e) => { const n = [...e]; n[idx] = { ...n[idx], [k]: v }; return n; });
  const removeExpense = (idx) => updateField("expenses", (e) => e.filter((_, i) => i !== idx));

  // Payments
  const addPayment    = () => updateField("payments", (p) => [...p, { referenceNumber: "", amount: 0 }]);
  const updatePayment = (idx, k, v) => updateField("payments", (p) => { const n = [...p]; n[idx] = { ...n[idx], [k]: v }; return n; });
  const removePayment = (idx) => updateField("payments", (p) => p.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (active._id) await calculatorAPI.update(active._id, active);
      else            await calculatorAPI.create(active);
      toast.success("Record saved");
      fetchAll();
      setActive_(null);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await calculatorAPI.remove(confirm._id);
      toast.success("Record deleted");
      setConfirm(null);
      fetchAll();
      if (active?._id === confirm._id) setActive_(null);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setDeleting(false);
    }
  };

  if (active) {
    return (
      <div>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <button onClick={() => setActive_(null)} className="btn-ghost p-2"><i className="fa fa-arrow-left" /></button>
            <div>
              <h1 className="page-title">Calculator</h1>
              <p className="page-subtitle">{active._id ? "Edit Record" : "New Record"}</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Spinner size="sm" /> : <><i className="fa fa-save" /> Save Record</>}
          </button>
        </div>

        {/* Title */}
        <div className="card mb-4">
          <div className="card-body">
            <label className="label">Record Title</label>
            <input className="input max-w-md" value={active.title} onChange={(e) => setActive_({ ...active, title: e.target.value })} />
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Allowance", value: active.totalAllowance, color: "text-green-600" },
            { label: "Total Expense",   value: active.totalExpense,   color: "text-red-600" },
            { label: "Total Payment",   value: active.totalPayment,   color: "text-blue-600" },
            { label: "Balance",         value: active.balance,        color: active.balance >= 0 ? "text-green-700" : "text-red-700", bold: true },
          ].map(({ label, value, color, bold }) => (
            <div key={label} className="card card-body !py-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color} ${bold ? "text-2xl" : ""}`}>Rs. {Number(value || 0).toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {/* Allowances */}
          <Section title="Allowances" icon="fa-hand-holding-usd" color="bg-green-500">
            <div className="space-y-3">
              {active.allowances.map((c, i) => (
                <AllowanceClient key={i} client={c} idx={i} onChange={updateAllowanceClient} onRemove={removeAllowanceClient} />
              ))}
              <button onClick={addAllowanceClient} className="btn-secondary w-full text-sm">
                <i className="fa fa-plus" /> Add Client Allowance
              </button>
            </div>
          </Section>

          {/* Expenses */}
          <Section title="Expenses" icon="fa-file-invoice-dollar" color="bg-red-500">
            <div className="space-y-1.5">
              {active.expenses.map((e, i) => (
                <div key={i} className="grid grid-cols-[1fr_140px_32px] gap-2 items-center">
                  <input className="input text-xs" value={e.purpose} onChange={(ev) => updateExpense(i, "purpose", ev.target.value)} placeholder="Expense description" />
                  <input className="input text-xs text-right" type="number" value={e.amount} onChange={(ev) => updateExpense(i, "amount", ev.target.value)} placeholder="0" min="0" />
                  <button onClick={() => removeExpense(i)} className="btn-ghost text-red-400 text-xs p-1"><i className="fa fa-times" /></button>
                </div>
              ))}
              <button onClick={addExpense} className="btn-secondary w-full text-sm mt-2"><i className="fa fa-plus" /> Add Expense</button>
            </div>
          </Section>

          {/* Payments Received */}
          <Section title="Payments Received" icon="fa-money-bill-wave" color="bg-blue-500">
            <div className="space-y-1.5">
              {active.payments.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_140px_32px] gap-2 items-center">
                  <input className="input text-xs font-mono" value={p.referenceNumber} onChange={(ev) => updatePayment(i, "referenceNumber", ev.target.value)} placeholder="Reference No." />
                  <input className="input text-xs text-right" type="number" value={p.amount} onChange={(ev) => updatePayment(i, "amount", ev.target.value)} placeholder="0" min="0" />
                  <button onClick={() => removePayment(i)} className="btn-ghost text-red-400 text-xs p-1"><i className="fa fa-times" /></button>
                </div>
              ))}
              <button onClick={addPayment} className="btn-secondary w-full text-sm mt-2"><i className="fa fa-plus" /> Add Payment</button>
            </div>
          </Section>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Calculator</h1>
          <p className="page-subtitle">Allowance &amp; expense management</p>
        </div>
        <button onClick={() => setActive_({ ...EMPTY_RECORD })} className="btn-primary">
          <i className="fa fa-plus" /> New Record
        </button>
      </div>

      {loading ? <div className="p-8"><PageLoader /></div> : records.length === 0 ? (
        <Empty icon="fa-calculator" message="No calculator records found" action={<button onClick={() => setActive_({ ...EMPTY_RECORD })} className="btn-primary">Create first record</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map((r) => (
            <div key={r._id} className="card hover:shadow-md transition-shadow">
              <div className="card-body">
                <h3 className="font-semibold text-slate-800 mb-3 truncate">{r.title || "Untitled"}</h3>
                <div className="space-y-1 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Allowance</span>
                    <span className="font-medium text-green-600">Rs. {Number(r.totalAllowance).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Expense</span>
                    <span className="font-medium text-red-600">Rs. {Number(r.totalExpense).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Payment</span>
                    <span className="font-medium text-blue-600">Rs. {Number(r.totalPayment).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                    <span className="font-medium text-slate-700">Balance</span>
                    <span className={`font-bold text-base ${Number(r.balance) >= 0 ? "text-green-700" : "text-red-700"}`}>
                      Rs. {Number(r.balance).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setActive_(r)} className="btn-primary flex-1 text-xs"><i className="fa fa-edit" /> Open</button>
                  <button onClick={() => setConfirm(r)} className="btn-ghost text-red-400 hover:text-red-600 px-3"><i className="fa fa-trash-alt text-xs" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirm}
        title="Delete Record"
        message={`Delete "${confirm?.title}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
        loading={deleting}
      />
    </div>
  );
}
