import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { notifyError } from "../../utils/helpers";
import { ConfirmModal, Empty, PageLoader, Pagination, SearchBar } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useCustomerPaymentMutations, useCustomerPaymentsPaginated } from "../../hooks/useApiQueries";
import { useAuth } from "../../context/AuthContext";

const money = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function statusBadge(status) {
  return status === "void"
    ? <span className="badge badge-red">Void</span>
    : <span className="badge badge-green">Posted</span>;
}

function sourceLabel(source = "manual") {
  return ({
    manual: "Manual",
    "sales-record": "Sales Record",
    "cash-receipt": "Cash Receipt",
    "invoice-advance": "Invoice Advance",
    "purchase-record": "Purchase Record",
  })[source] || source;
}


export default function CustomerPaymentsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("posted");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [voidTarget, setVoidTarget] = useState(null);

  const debouncedSearch = useDebouncedValue(search, 300);
  const isAdmin = user?.role === "admin";

  useEffect(() => { setPage(1); }, [debouncedSearch, status, from, to]);

  const {
    data: { payments = [], total = 0, totalPages = 1 } = {},
    isLoading,
    isFetching,
    error,
  } = useCustomerPaymentsPaginated({ search: debouncedSearch, status, from, to, page, limit: 50 });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const { void: voidPayment } = useCustomerPaymentMutations();
  const totalAmount = payments.reduce((s, p) => s + (p.status === "posted" ? Number(p.amount || 0) : 0), 0);

  const handleVoid = () => {
    voidPayment.mutate(
      { id: voidTarget._id, data: { notes: "Voided from Customer Payments page" } },
      {
        onSuccess: () => {
          toast.success("Payment voided");
          setVoidTarget(null);
        },
        onError: (err) => notifyError(err),
      },
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Payments</h1>
          <p className="page-subtitle">Accounting ledger synced from Sales Records and receipts</p>
        </div>
        <Link to="/sales-records" className="btn-primary">
          <i className="fa fa-receipt" /> Enter Payments in Sales Records
        </Link>
      </div>

      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800">This page is the customer payment ledger.</p>
          <p className="text-xs text-slate-500 mt-0.5">To add or change invoice payment entries, use Sales Records. Synced payments appear here automatically for accounting and audit.</p>
        </div>
        <Link to="/sales-records" className="btn-secondary text-xs whitespace-nowrap">
          Open Sales Records
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card card-body !py-4">
          <p className="text-xs text-slate-500 mb-1">Payments</p>
          <p className="text-2xl font-bold text-slate-800">{total}</p>
        </div>
        <div className="card card-body !py-4">
          <p className="text-xs text-slate-500 mb-1">Posted Total (this page)</p>
          <p className="text-xl font-bold text-green-600">{money(totalAmount)}</p>
        </div>
        <div className="card card-body !py-4">
          <p className="text-xs text-slate-500 mb-1">Status Filter</p>
          <p className="text-xl font-bold text-slate-800 capitalize">{status}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search payment, invoice, customer..." />
          <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="posted">Posted</option>
            <option value="void">Void</option>
          </select>
          <input className="input w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
          <input className="input w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
          {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="btn-ghost text-xs"><i className="fa fa-times" /> Clear</button>}
          <span className="text-sm text-slate-500 ml-auto">
            {total === 0
              ? "No payments"
              : `${(page - 1) * 50 + 1}-${Math.min(page * 50, total)} of ${total} payment${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {isLoading ? <div className="p-8"><PageLoader /></div> : payments.length === 0 ? (
          <Empty icon="fa-money-bill-wave" message="No customer payments found" action={<Link to="/sales-records" className="btn-primary">Go to Sales Records</Link>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Invoice</th>
                    <th>Method</th>
                    <th>Source</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <Link to={`/customer-payments/${p._id}`} className="font-mono text-xs text-brand-600 font-medium hover:underline">{p.paymentNumber}</Link>
                        {p.referenceCode && <p className="text-xs text-slate-400">{p.referenceCode}</p>}
                      </td>
                      <td className="text-sm text-slate-500">{p.paymentDate}</td>
                      <td>
                        <p className="font-medium text-slate-800">{p.customer?.name || "-"}</p>
                        {p.customer?.email && <p className="text-xs text-slate-400">{p.customer.email}</p>}
                      </td>
                      <td>
                        {p.invoiceId ? (
                          <Link to={`/invoices/${p.invoiceId}`} className="font-mono text-xs text-brand-600 hover:underline">{p.invoiceNumber || "-"}</Link>
                        ) : (
                          <p className="font-mono text-xs text-slate-600">{p.invoiceNumber || "-"}</p>
                        )}
                        {p.bookingId && <p className="text-xs text-slate-400">{p.bookingId}</p>}
                      </td>
                      <td><span className="badge badge-gray capitalize">{p.method}</span></td>
                      <td><span className="badge badge-blue">{sourceLabel(p.source)}</span></td>
                      <td className="font-semibold text-slate-800">{money(p.amount)}</td>
                      <td>{statusBadge(p.status)}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          {p.slip?.url && (
                            <a href={p.slip.url} target="_blank" rel="noreferrer" className="btn-ghost text-xs py-1 px-2">
                              <i className="fa fa-paperclip" />
                            </a>
                          )}
                          {isAdmin && p.status === "posted" && p.source === "manual" && (
                            <button onClick={() => setVoidTarget(p)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2">
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={50} onChange={setPage} isFetching={isFetching} />
          </>
        )}
      </div>

      <ConfirmModal
        open={!!voidTarget}
        title="Void Payment"
        message={`Void payment ${voidTarget?.paymentNumber} for ${money(voidTarget?.amount)}?`}
        onConfirm={handleVoid}
        onCancel={() => setVoidTarget(null)}
        loading={voidPayment.isPending}
      />
    </div>
  );
}
