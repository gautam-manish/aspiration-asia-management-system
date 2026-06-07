import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ConfirmModal, Empty, Field, PageLoader, Pagination, SearchBar } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useBankDropdown, useOfficeExpenseMutations, useOfficeExpensesPaginated } from "../../hooks/useApiQueries";
import { notifyError } from "../../utils/helpers";
import { useAuth } from "../../context/AuthContext";

const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORIES = [
  "rent",
  "salary",
  "utilities",
  "marketing",
  "office-supplies",
  "communication",
  "bank-charges",
  "maintenance",
  "tax",
  "other",
];

function statusBadge(status) {
  return status === "void" ? <span className="badge badge-red">Void</span> : <span className="badge badge-green">Posted</span>;
}

export function ExpenseModal({ expense, onClose, onSaved }) {
  const isEdit = !!expense;
  const { data: banks = [] } = useBankDropdown();
  const { create, update } = useOfficeExpenseMutations();
  const [form, setForm] = useState(expense ? {
    expenseDate: expense.expenseDate || today(),
    category: expense.category || "other",
    paidTo: expense.paidTo || "",
    description: expense.description || "",
    amount: expense.amount || "",
    paymentMethod: expense.paymentMethod || "cash",
    referenceCode: expense.referenceCode || "",
    bankAccountId: expense.bankAccountId || "",
    notes: expense.notes || "",
  } : {
    expenseDate: today(),
    category: "other",
    paidTo: "",
    description: "",
    amount: "",
    paymentMethod: "cash",
    referenceCode: "",
    bankAccountId: "",
    notes: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.description.trim()) {
      toast.error("Description is required");
      return;
    }
    if (!Number(form.amount || 0)) {
      toast.error("Amount is required");
      return;
    }
    const mutation = isEdit ? update : create;
    mutation.mutate(
      isEdit
        ? { id: expense._id, data: { ...form, amount: Number(form.amount) || 0 } }
        : { ...form, amount: Number(form.amount) || 0 },
      {
        onSuccess: () => {
          toast.success(isEdit ? "Office expense updated" : "Office expense recorded");
          onSaved();
        },
        onError: (err) => notifyError(err),
      },
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">{isEdit ? "Edit Office Expense" : "New Office Expense"}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Date" required><input className="input" type="date" value={form.expenseDate} onChange={(e) => set("expenseDate", e.target.value)} required /></Field>
              <Field label="Category"><select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
              <Field label="Paid To"><input className="input" value={form.paidTo} onChange={(e) => set("paidTo", e.target.value)} /></Field>
              <Field label="Amount" required><input className="input" type="number" min="0.01" step="any" value={form.amount} onChange={(e) => set("amount", e.target.value)} required /></Field>
              <Field label="Payment Method"><select className="input" value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>{["cash", "bank", "card", "wallet", "cheque", "other"].map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
              <Field label="Bank Account"><select className="input" value={form.bankAccountId} onChange={(e) => set("bankAccountId", e.target.value)}><option value="">Not linked</option>{banks.map((b) => <option key={b._id} value={b._id}>{b.bankName}</option>)}</select></Field>
              <Field label="Reference Code"><input className="input" value={form.referenceCode} onChange={(e) => set("referenceCode", e.target.value)} /></Field>
              <Field label="Description" required><input className="input" value={form.description} onChange={(e) => set("description", e.target.value)} required /></Field>
              <Field label="Notes"><textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending} className="btn-primary"><i className="fa fa-save" /> {isEdit ? "Update Expense" : "Save Expense"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OfficeExpensesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("posted");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const isAdmin = user?.role === "admin";

  useEffect(() => { setPage(1); }, [debouncedSearch, category, status, from, to]);

  const { data: { expenses = [], total = 0, totalPages = 1 } = {}, isLoading, isFetching, error } =
    useOfficeExpensesPaginated({ search: debouncedSearch, category, status, from, to, page, limit: 50 });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const { void: voidExpense } = useOfficeExpenseMutations();
  const totalAmount = expenses.reduce((sum, expense) => sum + (expense.status === "posted" ? Number(expense.amount || 0) : 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Office Expenses</h1>
          <p className="page-subtitle">Operating expenses outside booking direct costs</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><i className="fa fa-plus" /> New Expense</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card card-body !py-4"><p className="text-xs text-slate-500">Expenses</p><p className="text-2xl font-bold">{total}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500">Posted Total (this page)</p><p className="text-xl font-bold text-red-600">{money(totalAmount)}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500">Status Filter</p><p className="text-xl font-bold capitalize">{status}</p></div>
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search expense, paid to, ref..." />
          <select className="input w-44" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}><option value="posted">Posted</option><option value="void">Void</option></select>
          <input className="input w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          {(from || to || category) && <button onClick={() => { setFrom(""); setTo(""); setCategory(""); }} className="btn-ghost text-xs"><i className="fa fa-times" /> Clear</button>}
          <span className="text-sm text-slate-500 ml-auto">{total} expense{total !== 1 ? "s" : ""}</span>
        </div>

        {isLoading ? <div className="p-8"><PageLoader /></div> : expenses.length === 0 ? (
          <Empty icon="fa-wallet" message="No office expenses found" action={<button onClick={() => setModal(true)} className="btn-primary">Record first expense</button>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Expense #</th><th>Date</th><th>Category</th><th>Paid To</th><th>Description</th><th>Method</th><th>Amount</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense._id}>
                      <td><Link to={`/office-expenses/${expense._id}`} className="font-mono text-xs text-brand-600 font-medium hover:underline">{expense.expenseNumber}</Link>{expense.referenceCode && <p className="text-xs text-slate-400">{expense.referenceCode}</p>}</td>
                      <td className="text-sm text-slate-500">{expense.expenseDate}</td>
                      <td><span className="badge badge-gray">{expense.category}</span></td>
                      <td className="font-medium text-slate-800">{expense.paidTo || "-"}</td>
                      <td className="text-sm text-slate-600">{expense.description}</td>
                      <td><span className="badge badge-gray capitalize">{expense.paymentMethod}</span></td>
                      <td className="font-semibold text-red-600">{money(expense.amount)}</td>
                      <td>{statusBadge(expense.status)}</td>
                      <td><div className="flex justify-end gap-1">
                        {isAdmin && expense.status === "posted" && <button onClick={() => setEditTarget(expense)} className="btn-ghost text-xs py-1 px-2">Edit</button>}
                        {isAdmin && expense.status === "posted" && <button onClick={() => setVoidTarget(expense)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2">Void</button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={50} onChange={setPage} isFetching={isFetching} />
          </>
        )}
      </div>

      {modal && <ExpenseModal onClose={() => setModal(false)} onSaved={() => setModal(false)} />}
      {editTarget && <ExpenseModal expense={editTarget} onClose={() => setEditTarget(null)} onSaved={() => setEditTarget(null)} />}
      <ConfirmModal
        open={!!voidTarget}
        title="Void Office Expense"
        message={`Void expense ${voidTarget?.expenseNumber} for ${money(voidTarget?.amount)}?`}
        onConfirm={() => voidExpense.mutate({ id: voidTarget._id, data: { notes: "Voided from Office Expenses page" } }, {
          onSuccess: () => { toast.success("Office expense voided"); setVoidTarget(null); },
          onError: (err) => notifyError(err),
        })}
        onCancel={() => setVoidTarget(null)}
        loading={voidExpense.isPending}
      />
    </div>
  );
}
