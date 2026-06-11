import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmModal, PageLoader } from "../../components/common";
import AuditTrailPanel from "../../components/common/AuditTrailPanel";
import { notifyError } from "../../utils/helpers";
import { useOfficeExpense, useOfficeExpenseMutations } from "../../hooks/useApiQueries";
import { ExpenseModal } from "./OfficeExpensesPage";
import { useAuth } from "../../context/AuthContext";
import { resolveUploadUrl } from "../../api";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function statusBadge(status) {
  return status === "void" ? <span className="badge badge-red">Void</span> : <span className="badge badge-green">Posted</span>;
}

function Info({ label, children }) {
  return <div><p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">{label}</p><div className="text-sm text-slate-700">{children || "-"}</div></div>;
}

export default function OfficeExpenseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [editing, setEditing] = useState(false);
  const { data: expense, isLoading, error } = useOfficeExpense(id);
  const { void: voidExpense } = useOfficeExpenseMutations();

  useEffect(() => { if (error) notifyError(error); }, [error]);

  if (isLoading) return <PageLoader />;
  if (!expense) return <div className="text-center py-20 text-slate-400">Office expense not found</div>;
  const isAdmin = user?.role === "admin";

  const handleVoid = () => {
    voidExpense.mutate(
      { id: expense._id, data: { notes: "Voided from office expense detail page" } },
      {
        onSuccess: () => { toast.success("Office expense voided"); setConfirmVoid(false); },
        onError: (err) => notifyError(err),
      },
    );
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/office-expenses")} className="btn-ghost p-2"><i className="fa fa-arrow-left" /></button>
          <div>
            <h1 className="page-title">Office Expense</h1>
            <p className="page-subtitle font-mono text-brand-600">{expense.expenseNumber || expense._id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {statusBadge(expense.status)}
          {isAdmin && expense.status === "posted" && <button onClick={() => setEditing(true)} className="btn-secondary"><i className="fa fa-edit" /> Edit</button>}
          {isAdmin && expense.status === "posted" && <button onClick={() => setConfirmVoid(true)} className="btn-secondary text-red-600"><i className="fa fa-ban" /> Void</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card card-body"><p className="text-xs text-slate-500 mb-1">Amount</p><p className="text-2xl font-bold text-red-600">{money(expense.amount)}</p></div>
        <div className="card card-body"><p className="text-xs text-slate-500 mb-1">Expense Date</p><p className="text-xl font-bold text-slate-800">{expense.expenseDate || "-"}</p></div>
        <div className="card card-body"><p className="text-xs text-slate-500 mb-1">Category</p><p className="text-xl font-bold text-slate-800">{expense.category || "-"}</p></div>
      </div>

      <div className="card mb-4">
        <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Expense Details</h2></div>
        <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Info label="Paid To">{expense.paidTo}</Info>
          <Info label="Description">{expense.description}</Info>
          <Info label="Payment Method"><span className="capitalize">{expense.paymentMethod}</span></Info>
          <Info label="Reference Code">{expense.referenceCode}</Info>
          <Info label="Bank Account">{expense.bankAccountId}</Info>
          <Info label="Notes"><span className="whitespace-pre-wrap">{expense.notes}</span></Info>
          {expense.slip?.url && <Info label="Slip"><a href={resolveUploadUrl(expense.slip.url)} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{expense.slip.fileName || "View slip"}</a></Info>}
        </div>
      </div>

      <AuditTrailPanel entity="office-expense" entityId={expense._id} />

      <ConfirmModal
        open={confirmVoid}
        title="Void Office Expense"
        message={`Void expense ${expense.expenseNumber} for ${money(expense.amount)}?`}
        onConfirm={handleVoid}
        onCancel={() => setConfirmVoid(false)}
        loading={voidExpense.isPending}
      />
      {editing && <ExpenseModal expense={expense} onClose={() => setEditing(false)} onSaved={() => {
        setEditing(false);
        qc.invalidateQueries({ queryKey: ["office-expense", id] });
        qc.invalidateQueries({ queryKey: ["office-expenses"] });
        qc.invalidateQueries({ queryKey: ["reports", "profit-loss"] });
      }} />}
    </div>
  );
}
